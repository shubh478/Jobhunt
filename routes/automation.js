const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const nodemailer = require('nodemailer');

router.post('/auto/queue-jobs', async (req, res) => {
  try {
    const { jobs } = req.body;
    if (!jobs || !jobs.length) return res.status(400).json({ error: 'No jobs provided' });

    let saved = 0;
    for (const j of jobs) {
      const existing = await pool.query(
        'SELECT id FROM applications WHERE user_id=$1 AND LOWER(company)=LOWER($2) AND LOWER(role)=LOWER($3)',
        [req.userId, j.company, j.title]
      );
      if (existing.rows.length > 0) continue;

      await pool.query(
        `INSERT INTO applications (user_id, company, role, platform, portal_url, status, location, salary_range, notes)
         VALUES ($1,$2,$3,$4,$5,'WISHLIST',$6,$7,$8)`,
        [req.userId, j.company, j.title, j.source || 'Auto', j.url || '', j.location || '', j.salary || '', `Auto-fetched from ${j.source}. ${(j.description || '').substring(0, 200)}`]
      );
      saved++;
    }
    res.json({ ok: true, saved, skipped: jobs.length - saved });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/auto/queue', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM applications WHERE user_id=$1 AND status='WISHLIST' ORDER BY created_at DESC", [req.userId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/auto/bulk-apply', async (req, res) => {
  const { job_ids, template_id, send_email, use_ai } = req.body;
  if (!job_ids || !job_ids.length) return res.status(400).json({ error: 'No jobs selected' });

  const profileResult = await pool.query('SELECT * FROM profile WHERE user_id=$1', [req.userId]);
  const profile = profileResult.rows[0] || {};

  const tplResult = await pool.query('SELECT * FROM cover_templates WHERE id=$1 AND user_id=$2', [template_id, req.userId]);
  if (tplResult.rows.length === 0) return res.status(400).json({ error: 'Cover letter template not found. Add one in Settings → Cover Templates, or pick a different template.' });
  const tpl = tplResult.rows[0];

  // Email is optional. If user asked for it but SMTP isn't configured,
  // degrade gracefully — still mark jobs as applied, just don't send mail.
  let emailCfg = null;
  let emailWarning = null;
  if (send_email) {
    const cfgResult = await pool.query('SELECT * FROM email_config WHERE user_id=$1', [req.userId]);
    emailCfg = cfgResult.rows[0];
    if (!emailCfg || !emailCfg.smtp_user || !emailCfg.smtp_pass) {
      emailWarning = 'Email sending was requested but SMTP is not configured in Settings. Applications were still marked as APPLIED, no emails sent.';
      emailCfg = null;
    }
  }

  const replacePlaceholders = (str, company, role) => {
    return str
      .replace(/\{company\}/g, company || '')
      .replace(/\{role\}/g, role || '')
      .replace(/\{full_name\}/g, profile.full_name || '')
      .replace(/\{email\}/g, profile.email || '')
      .replace(/\{phone\}/g, profile.phone || '')
      .replace(/\{linkedin_url\}/g, profile.linkedin_url || '')
      .replace(/\{github_url\}/g, profile.github_url || '')
      .replace(/\{current_role\}/g, profile.current_role || '')
      .replace(/\{experience_years\}/g, profile.experience_years || '')
      .replace(/\{skills\}/g, profile.skills || '')
      .replace(/\{summary\}/g, profile.summary || '');
  };

  let aiProvider = null;
  if (use_ai) {
    try { aiProvider = require('../lib/ai-provider'); } catch { /* no AI */ }
  }

  const results = [];
  let transporter = null;

  if (send_email && emailCfg) {
    transporter = nodemailer.createTransport({
      host: emailCfg.smtp_host,
      port: emailCfg.smtp_port,
      secure: emailCfg.smtp_port === 465,
      auth: { user: emailCfg.smtp_user, pass: emailCfg.smtp_pass }
    });
  }

  const today = new Date().toISOString().split('T')[0];
  const followUpDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  for (const jobId of job_ids) {
    const jobResult = await pool.query('SELECT * FROM applications WHERE id=$1 AND user_id=$2', [jobId, req.userId]);
    if (jobResult.rows.length === 0) { results.push({ id: jobId, status: 'not_found' }); continue; }
    const job = jobResult.rows[0];

    let subject, body;

    if (use_ai && aiProvider) {
      try {
        const providerId = aiProvider.getFirstAvailable(profile.ai_provider);
        if (providerId) {
          const systemPrompt = `You are a professional cover letter writer. Write concise, personalized cover letters (150-200 words). Reference specific requirements from the job description. Avoid generic phrases like "I am excited to apply". Include concrete value propositions. Format output as JSON: {"subject": "...", "body": "..."}`;
          const userPrompt = `Write a cover letter for:
Company: ${job.company}
Role: ${job.role}
Job Description: ${job.notes || 'Not available'}

Candidate Profile:
Name: ${profile.full_name}
Current Role: ${profile.current_role}
Experience: ${profile.experience_years} years
Skills: ${profile.skills}
Summary: ${profile.summary}`;

          const aiResponse = await aiProvider.generate(providerId, systemPrompt, userPrompt);
          try {
            const parsed = JSON.parse(aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
            subject = parsed.subject;
            body = parsed.body;
          } catch {
            subject = `Application for ${job.role} at ${job.company}`;
            body = aiResponse;
          }
        }
      } catch { /* fall through to template */ }
    }

    if (!subject || !body) {
      subject = replacePlaceholders(tpl.subject, job.company, job.role);
      body = replacePlaceholders(tpl.body, job.company, job.role);
    }

    let emailStatus = 'skipped';

    if (send_email && transporter && job.notes) {
      const emailMatch = job.notes.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        try {
          const mailOpts = {
            from: emailCfg.from_name ? `"${emailCfg.from_name}" <${emailCfg.smtp_user}>` : emailCfg.smtp_user,
            to: emailMatch[0], subject, text: body
          };
          if (profile.resume_data) {
            mailOpts.attachments = [{
              filename: profile.resume_path || 'resume.pdf',
              content: Buffer.from(profile.resume_data, 'base64'),
              contentType: profile.resume_mimetype || 'application/pdf'
            }];
          }
          await transporter.sendMail(mailOpts);
          emailStatus = 'sent';
        } catch (e) { emailStatus = 'failed: ' + e.message; }
      }
    }

    await pool.query(
      `UPDATE applications SET status='APPLIED', applied_date=$1, follow_up_date=$2, platform=$3, updated_at=NOW(), notes=$4 WHERE id=$5 AND user_id=$6`,
      [today, followUpDate, job.platform || 'Auto', `${job.notes || ''}\n\n--- Auto-applied ---\nSubject: ${subject}\nEmail: ${emailStatus}\nDate: ${today}`, jobId, req.userId]
    );

    results.push({ id: jobId, company: job.company, role: job.role, subject, emailStatus, status: 'applied' });
  }

  res.json({
    ok: true,
    results,
    applied: results.filter(r => r.status === 'applied').length,
    warning: emailWarning
  });
});

router.get('/auto/stats', async (req, res) => {
  const u = req.userId;
  const today = new Date().toISOString().split('T')[0];
  const queue = await pool.query("SELECT COUNT(*) as c FROM applications WHERE user_id=$1 AND status='WISHLIST'", [u]);
  const appliedToday = await pool.query("SELECT COUNT(*) as c FROM applications WHERE user_id=$1 AND applied_date=$2", [u, today]);
  const totalApplied = await pool.query("SELECT COUNT(*) as c FROM applications WHERE user_id=$1 AND status='APPLIED'", [u]);
  const interviews = await pool.query("SELECT COUNT(*) as c FROM applications WHERE user_id=$1 AND status='INTERVIEW'", [u]);

  res.json({
    inQueue: parseInt(queue.rows[0].c),
    appliedToday: parseInt(appliedToday.rows[0].c),
    totalApplied: parseInt(totalApplied.rows[0].c),
    interviews: parseInt(interviews.rows[0].c)
  });
});

module.exports = router;
