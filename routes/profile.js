const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const multer = require('multer');
const nodemailer = require('nodemailer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/profile', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM profile WHERE user_id=$1', [req.userId]);
    res.json(result.rows[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/profile', async (req, res) => {
  try {
    const { full_name, email, phone, linkedin_url, github_url, portfolio_url, current_role, experience_years, skills, summary, resume_text } = req.body;
    let query = `UPDATE profile SET full_name=$1, email=$2, phone=$3, linkedin_url=$4, github_url=$5, portfolio_url=$6, "current_role"=$7, experience_years=$8, skills=$9, summary=$10`;
    let params = [full_name || '', email || '', phone || '', linkedin_url || '', github_url || '', portfolio_url || '', current_role || '', experience_years || '', skills || '', summary || ''];
    if (resume_text !== undefined) {
      query += `, resume_text=$11 WHERE user_id=$12`;
      params.push(resume_text, req.userId);
    } else {
      query += ` WHERE user_id=$11`;
      params.push(req.userId);
    }
    const result = await pool.query(query, params);
    if (result.rowCount === 0) {
      // Create row if missing (defensive)
      await pool.query(
        `INSERT INTO profile (user_id, full_name, email, phone, linkedin_url, github_url, portfolio_url, "current_role", experience_years, skills, summary, resume_text)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [req.userId, full_name || '', email || '', phone || '', linkedin_url || '', github_url || '', portfolio_url || '', current_role || '', experience_years || '', skills || '', summary || '', resume_text || '']
      );
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const base64 = req.file.buffer.toString('base64');
    const filename = req.file.originalname;
    const mimetype = req.file.mimetype;
    await pool.query(
      'UPDATE profile SET resume_path=$1, resume_data=$2, resume_mimetype=$3 WHERE user_id=$4',
      [filename, base64, mimetype, req.userId]
    );
    res.json({ ok: true, filename });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/resume-info', async (req, res) => {
  try {
    const result = await pool.query('SELECT resume_path, resume_data FROM profile WHERE user_id=$1', [req.userId]);
    const p = result.rows[0];
    const exists = !!(p && p.resume_path && p.resume_data);
    res.json({ exists, filename: p ? p.resume_path : null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/resume-download', async (req, res) => {
  try {
    const result = await pool.query('SELECT resume_path, resume_data, resume_mimetype FROM profile WHERE user_id=$1', [req.userId]);
    const p = result.rows[0];
    if (!p || !p.resume_data) return res.status(404).json({ error: 'No resume uploaded' });
    const buffer = Buffer.from(p.resume_data, 'base64');
    res.setHeader('Content-Type', p.resume_mimetype || 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + (p.resume_path || 'resume.pdf') + '"');
    res.send(buffer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/email-config', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM email_config WHERE user_id=$1', [req.userId]);
    const cfg = { ...(result.rows[0] || {}) };
    if (cfg.smtp_pass) cfg.smtp_pass = '********';
    res.json(cfg);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/email-config', async (req, res) => {
  try {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, from_name } = req.body;
    let result;
    if (smtp_pass && smtp_pass !== '********') {
      result = await pool.query(
        'UPDATE email_config SET smtp_host=$1, smtp_port=$2, smtp_user=$3, smtp_pass=$4, from_name=$5 WHERE user_id=$6',
        [smtp_host || 'smtp.gmail.com', smtp_port || 587, smtp_user || '', smtp_pass, from_name || '', req.userId]
      );
    } else {
      result = await pool.query(
        'UPDATE email_config SET smtp_host=$1, smtp_port=$2, smtp_user=$3, from_name=$4 WHERE user_id=$5',
        [smtp_host || 'smtp.gmail.com', smtp_port || 587, smtp_user || '', from_name || '', req.userId]
      );
    }
    if (result.rowCount === 0) {
      await pool.query(
        'INSERT INTO email_config (user_id, smtp_host, smtp_port, smtp_user, smtp_pass, from_name) VALUES ($1,$2,$3,$4,$5,$6)',
        [req.userId, smtp_host || 'smtp.gmail.com', smtp_port || 587, smtp_user || '', smtp_pass && smtp_pass !== '********' ? smtp_pass : '', from_name || '']
      );
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/send-email', async (req, res) => {
  try {
    const { to, subject, body, attachResume } = req.body;
    const cfgResult = await pool.query('SELECT * FROM email_config WHERE user_id=$1', [req.userId]);
    const cfg = cfgResult.rows[0];
    if (!cfg || !cfg.smtp_user || !cfg.smtp_pass) return res.status(400).json({ error: 'Email not configured. Go to Settings > Email Config.' });

    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: cfg.smtp_port,
      secure: cfg.smtp_port === 465,
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass }
    });

    const mailOpts = {
      from: cfg.from_name ? `"${cfg.from_name}" <${cfg.smtp_user}>` : cfg.smtp_user,
      to, subject, text: body
    };

    if (attachResume) {
      const profileResult = await pool.query('SELECT resume_path, resume_data, resume_mimetype FROM profile WHERE user_id=$1', [req.userId]);
      const profile = profileResult.rows[0];
      if (profile && profile.resume_data) {
        mailOpts.attachments = [{
          filename: profile.resume_path || 'resume.pdf',
          content: Buffer.from(profile.resume_data, 'base64'),
          contentType: profile.resume_mimetype || 'application/pdf'
        }];
      }
    }

    await transporter.sendMail(mailOpts);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
