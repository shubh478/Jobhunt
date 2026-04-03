const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const nodemailer = require('nodemailer');
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// File upload setup
const storage = multer.diskStorage({
  destination: path.join(__dirname, 'uploads'),
  filename: (req, file, cb) => cb(null, 'resume' + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// --- Database Setup (PostgreSQL / Supabase) ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
      company TEXT NOT NULL,
      role TEXT NOT NULL,
      platform TEXT DEFAULT '',
      portal_url TEXT DEFAULT '',
      status TEXT DEFAULT 'WISHLIST',
      salary_range TEXT DEFAULT '',
      location TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      applied_date TEXT DEFAULT '',
      interview_date TEXT DEFAULT '',
      follow_up_date TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS prep_topics (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      topic TEXT NOT NULL,
      difficulty TEXT DEFAULT 'MEDIUM',
      status TEXT DEFAULT 'TODO',
      notes TEXT DEFAULT '',
      resource_url TEXT DEFAULT ''
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_log (
      id SERIAL PRIMARY KEY,
      date TEXT DEFAULT CURRENT_DATE::TEXT,
      applications_sent INTEGER DEFAULT 0,
      problems_solved INTEGER DEFAULT 0,
      notes TEXT DEFAULT ''
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      full_name TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      linkedin_url TEXT DEFAULT '',
      github_url TEXT DEFAULT '',
      portfolio_url TEXT DEFAULT '',
      current_role TEXT DEFAULT '',
      experience_years TEXT DEFAULT '',
      skills TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      resume_path TEXT DEFAULT ''
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      smtp_host TEXT DEFAULT 'smtp.gmail.com',
      smtp_port INTEGER DEFAULT 587,
      smtp_user TEXT DEFAULT '',
      smtp_pass TEXT DEFAULT '',
      from_name TEXT DEFAULT ''
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cover_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT DEFAULT '',
      body TEXT DEFAULT ''
    )
  `);

  // Init single-row tables
  await pool.query(`INSERT INTO profile (id, full_name) VALUES (1, '') ON CONFLICT (id) DO NOTHING`);
  await pool.query(`INSERT INTO email_config (id, smtp_host) VALUES (1, 'smtp.gmail.com') ON CONFLICT (id) DO NOTHING`);

  // Seed prep topics if empty
  const count = await pool.query('SELECT COUNT(*) as c FROM prep_topics');
  if (parseInt(count.rows[0].c) === 0) {
    const topics = [
      ['DSA', 'Arrays & Hashing', 'EASY', 'https://leetcode.com/tag/array/'],
      ['DSA', 'Two Pointers', 'EASY', 'https://leetcode.com/tag/two-pointers/'],
      ['DSA', 'Sliding Window', 'MEDIUM', 'https://leetcode.com/tag/sliding-window/'],
      ['DSA', 'Stack', 'MEDIUM', 'https://leetcode.com/tag/stack/'],
      ['DSA', 'Binary Search', 'MEDIUM', 'https://leetcode.com/tag/binary-search/'],
      ['DSA', 'Linked List', 'MEDIUM', 'https://leetcode.com/tag/linked-list/'],
      ['DSA', 'Trees (BFS/DFS)', 'MEDIUM', 'https://leetcode.com/tag/tree/'],
      ['DSA', 'Graphs (BFS/DFS/Topo)', 'HARD', 'https://leetcode.com/tag/graph/'],
      ['DSA', 'Dynamic Programming', 'HARD', 'https://leetcode.com/tag/dynamic-programming/'],
      ['DSA', 'Backtracking', 'HARD', 'https://leetcode.com/tag/backtracking/'],
      ['DSA', 'Tries', 'HARD', 'https://leetcode.com/tag/trie/'],
      ['DSA', 'Heap / Priority Queue', 'MEDIUM', 'https://leetcode.com/tag/heap-priority-queue/'],
      ['System Design', 'URL Shortener', 'MEDIUM', ''],
      ['System Design', 'Rate Limiter', 'MEDIUM', ''],
      ['System Design', 'Chat System (WhatsApp)', 'HARD', ''],
      ['System Design', 'Video Streaming (Netflix/YouTube)', 'HARD', ''],
      ['System Design', 'Notification Service', 'MEDIUM', ''],
      ['System Design', 'Distributed Cache (Redis)', 'HARD', ''],
      ['System Design', 'Search Autocomplete', 'HARD', ''],
      ['System Design', 'Payment System', 'HARD', ''],
      ['Java/Spring', 'Spring Boot Internals', 'MEDIUM', ''],
      ['Java/Spring', 'JPA & Hibernate N+1', 'MEDIUM', ''],
      ['Java/Spring', 'Microservices Patterns', 'HARD', ''],
      ['Java/Spring', 'Java Concurrency', 'HARD', ''],
      ['Java/Spring', 'Spring Security + JWT', 'MEDIUM', ''],
      ['Java/Spring', 'REST API Best Practices', 'EASY', ''],
      ['Frontend', 'Angular Lifecycle & Change Detection', 'MEDIUM', ''],
      ['Frontend', 'RxJS Operators', 'MEDIUM', ''],
      ['Frontend', 'React Hooks & State Mgmt', 'MEDIUM', ''],
      ['Behavioral', 'Tell me about yourself', 'EASY', ''],
      ['Behavioral', 'Biggest challenge / conflict', 'EASY', ''],
      ['Behavioral', 'Why this company?', 'EASY', ''],
      ['Behavioral', 'Leadership / ownership story', 'EASY', ''],
    ];
    for (const t of topics) {
      await pool.query('INSERT INTO prep_topics (category, topic, difficulty, resource_url) VALUES ($1,$2,$3,$4)', t);
    }
  }

  // Seed default cover letter template
  const tplCount = await pool.query('SELECT COUNT(*) as c FROM cover_templates');
  if (parseInt(tplCount.rows[0].c) === 0) {
    await pool.query(
      'INSERT INTO cover_templates (name, subject, body) VALUES ($1, $2, $3)',
      [
        'Default Application',
        'Application for {role} at {company}',
        `Hi {company} Team,

I am writing to express my interest in the {role} position. With {experience_years} years of experience in {skills}, I believe I can contribute meaningfully to your team.

{summary}

I would welcome the opportunity to discuss how my background aligns with your needs.

Best regards,
{full_name}
{email} | {phone}
{linkedin_url}`
      ]
    );
  }

  console.log('Database initialized');
}

// --- API Routes ---

// Applications CRUD
app.get('/api/applications', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM applications ORDER BY updated_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/applications', async (req, res) => {
  try {
    const { company, role, platform, portal_url, status, salary_range, location, notes, applied_date, interview_date, follow_up_date } = req.body;
    const result = await pool.query(
      `INSERT INTO applications (company, role, platform, portal_url, status, salary_range, location, notes, applied_date, interview_date, follow_up_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [company, role, platform || '', portal_url || '', status || 'WISHLIST', salary_range || '', location || '', notes || '', applied_date || '', interview_date || '', follow_up_date || '']
    );
    res.json({ id: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/applications/:id', async (req, res) => {
  try {
    const { company, role, platform, portal_url, status, salary_range, location, notes, applied_date, interview_date, follow_up_date } = req.body;
    await pool.query(
      `UPDATE applications SET company=$1, role=$2, platform=$3, portal_url=$4, status=$5, salary_range=$6, location=$7, notes=$8, applied_date=$9, interview_date=$10, follow_up_date=$11, updated_at=NOW() WHERE id=$12`,
      [company, role, platform || '', portal_url || '', status || 'WISHLIST', salary_range || '', location || '', notes || '', applied_date || '', interview_date || '', follow_up_date || '', req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/applications/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM applications WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Bulk delete applications
app.post('/api/applications/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ error: 'No IDs provided' });
    await pool.query('DELETE FROM applications WHERE id = ANY($1)', [ids]);
    res.json({ ok: true, deleted: ids.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Bulk update status
app.post('/api/applications/bulk-status', async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!ids || !ids.length || !status) return res.status(400).json({ error: 'IDs and status required' });
    await pool.query('UPDATE applications SET status=$1, updated_at=NOW() WHERE id = ANY($2)', [status, ids]);
    res.json({ ok: true, updated: ids.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Prep topics
app.get('/api/prep', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM prep_topics ORDER BY category, difficulty');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/prep/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    await pool.query('UPDATE prep_topics SET status=$1, notes=$2 WHERE id=$3', [status, notes || '', req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/prep', async (req, res) => {
  try {
    const { category, topic, difficulty, resource_url } = req.body;
    const result = await pool.query(
      'INSERT INTO prep_topics (category, topic, difficulty, resource_url) VALUES ($1,$2,$3,$4) RETURNING id',
      [category, topic, difficulty || 'MEDIUM', resource_url || '']
    );
    res.json({ id: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Stats
app.get('/api/stats', async (req, res) => {
  try {
    const apps = await pool.query('SELECT status, COUNT(*) as count FROM applications GROUP BY status');
    const prepStats = await pool.query('SELECT status, COUNT(*) as count FROM prep_topics GROUP BY status');
    const total = await pool.query('SELECT COUNT(*) as c FROM applications');
    const today = new Date().toISOString().split('T')[0];
    const followUps = await pool.query(
      `SELECT * FROM applications WHERE follow_up_date <= $1 AND status IN ('APPLIED','SCREENING','INTERVIEW') ORDER BY follow_up_date`,
      [today]
    );
    // Daily application counts for last 30 days
    const dailyTrend = await pool.query(
      `SELECT applied_date as date, COUNT(*) as count FROM applications WHERE applied_date != '' AND applied_date >= (CURRENT_DATE - INTERVAL '30 days')::TEXT GROUP BY applied_date ORDER BY applied_date`
    );
    // Response rate: how many moved past APPLIED
    const totalApplied = await pool.query("SELECT COUNT(*) as c FROM applications WHERE status != 'WISHLIST'");
    const gotResponse = await pool.query("SELECT COUNT(*) as c FROM applications WHERE status IN ('SCREENING','INTERVIEW','OFFER')");
    const avgDays = await pool.query(
      `SELECT AVG(EXTRACT(DAY FROM (updated_at - created_at))) as avg_days FROM applications WHERE status IN ('SCREENING','INTERVIEW','OFFER') AND updated_at > created_at`
    );
    res.json({
      applicationsByStatus: apps.rows,
      prepByStatus: prepStats.rows,
      totalApplications: parseInt(total.rows[0].c),
      followUps: followUps.rows,
      dailyTrend: dailyTrend.rows,
      responseRate: parseInt(totalApplied.rows[0].c) > 0 ? Math.round(parseInt(gotResponse.rows[0].c) / parseInt(totalApplied.rows[0].c) * 100) : 0,
      avgResponseDays: avgDays.rows[0].avg_days ? Math.round(parseFloat(avgDays.rows[0].avg_days)) : null
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Profile
app.get('/api/profile', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM profile WHERE id=1');
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/profile', async (req, res) => {
  try {
    const { full_name, email, phone, linkedin_url, github_url, portfolio_url, current_role, experience_years, skills, summary } = req.body;
    await pool.query(
      `UPDATE profile SET full_name=$1, email=$2, phone=$3, linkedin_url=$4, github_url=$5, portfolio_url=$6, current_role=$7, experience_years=$8, skills=$9, summary=$10 WHERE id=1`,
      [full_name || '', email || '', phone || '', linkedin_url || '', github_url || '', portfolio_url || '', current_role || '', experience_years || '', skills || '', summary || '']
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Resume upload
app.post('/api/resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    await pool.query('UPDATE profile SET resume_path=$1 WHERE id=1', [req.file.filename]);
    res.json({ ok: true, filename: req.file.filename });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/resume-info', async (req, res) => {
  try {
    const result = await pool.query('SELECT resume_path FROM profile WHERE id=1');
    const p = result.rows[0];
    if (p && p.resume_path) {
      const fullPath = path.join(__dirname, 'uploads', p.resume_path);
      const exists = fs.existsSync(fullPath);
      res.json({ exists, filename: p.resume_path });
    } else {
      res.json({ exists: false, filename: null });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Email config
app.get('/api/email-config', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM email_config WHERE id=1');
    const cfg = { ...result.rows[0] };
    if (cfg.smtp_pass) cfg.smtp_pass = '********';
    res.json(cfg);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/email-config', async (req, res) => {
  try {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, from_name } = req.body;
    if (smtp_pass && smtp_pass !== '********') {
      await pool.query(
        'UPDATE email_config SET smtp_host=$1, smtp_port=$2, smtp_user=$3, smtp_pass=$4, from_name=$5 WHERE id=1',
        [smtp_host || 'smtp.gmail.com', smtp_port || 587, smtp_user || '', smtp_pass, from_name || '']
      );
    } else {
      await pool.query(
        'UPDATE email_config SET smtp_host=$1, smtp_port=$2, smtp_user=$3, from_name=$4 WHERE id=1',
        [smtp_host || 'smtp.gmail.com', smtp_port || 587, smtp_user || '', from_name || '']
      );
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Send email application
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, body, attachResume } = req.body;
    const cfgResult = await pool.query('SELECT * FROM email_config WHERE id=1');
    const cfg = cfgResult.rows[0];
    if (!cfg.smtp_user || !cfg.smtp_pass) return res.status(400).json({ error: 'Email not configured. Go to Settings > Email Config.' });

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
      const profileResult = await pool.query('SELECT resume_path FROM profile WHERE id=1');
      const profile = profileResult.rows[0];
      if (profile && profile.resume_path) {
        const resumePath = path.join(__dirname, 'uploads', profile.resume_path);
        if (fs.existsSync(resumePath)) {
          mailOpts.attachments = [{ filename: profile.resume_path, path: resumePath }];
        }
      }
    }

    await transporter.sendMail(mailOpts);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cover letter templates
app.get('/api/templates', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cover_templates');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/templates', async (req, res) => {
  try {
    const { name, subject, body } = req.body;
    const result = await pool.query(
      'INSERT INTO cover_templates (name, subject, body) VALUES ($1,$2,$3) RETURNING id',
      [name, subject || '', body || '']
    );
    res.json({ id: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/templates/:id', async (req, res) => {
  try {
    const { name, subject, body } = req.body;
    await pool.query(
      'UPDATE cover_templates SET name=$1, subject=$2, body=$3 WHERE id=$4',
      [name, subject || '', body || '', req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/templates/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM cover_templates WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Generate cover letter from template
app.post('/api/generate-cover', async (req, res) => {
  try {
    const { template_id, company, role } = req.body;
    const tplResult = await pool.query('SELECT * FROM cover_templates WHERE id=$1', [template_id]);
    if (tplResult.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    const tpl = tplResult.rows[0];
    const profileResult = await pool.query('SELECT * FROM profile WHERE id=1');
    const profile = profileResult.rows[0];

    const replace = (str) => {
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

    res.json({ subject: replace(tpl.subject), body: replace(tpl.body) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Data export/import (backup)
app.get('/api/export', async (req, res) => {
  const applications = await pool.query('SELECT * FROM applications');
  const prep = await pool.query('SELECT * FROM prep_topics');
  const profile = await pool.query('SELECT * FROM profile WHERE id=1');
  const templates = await pool.query('SELECT * FROM cover_templates');
  const data = {
    applications: applications.rows,
    prep_topics: prep.rows,
    profile: profile.rows[0],
    cover_templates: templates.rows,
    exported_at: new Date().toISOString()
  };
  res.setHeader('Content-Disposition', 'attachment; filename=jobhunt-backup.json');
  res.json(data);
});

app.post('/api/import', async (req, res) => {
  try {
    const data = req.body;
    if (data.applications) {
      await pool.query('DELETE FROM applications');
      for (const a of data.applications) {
        await pool.query(
          `INSERT INTO applications (company, role, platform, portal_url, status, salary_range, location, notes, applied_date, interview_date, follow_up_date, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [a.company, a.role, a.platform || '', a.portal_url || '', a.status || 'WISHLIST', a.salary_range || '', a.location || '', a.notes || '', a.applied_date || '', a.interview_date || '', a.follow_up_date || '', a.created_at || new Date().toISOString(), a.updated_at || new Date().toISOString()]
        );
      }
    }
    if (data.prep_topics) {
      await pool.query('DELETE FROM prep_topics');
      for (const t of data.prep_topics) {
        await pool.query(
          `INSERT INTO prep_topics (category, topic, difficulty, status, notes, resource_url) VALUES ($1,$2,$3,$4,$5,$6)`,
          [t.category, t.topic, t.difficulty || 'MEDIUM', t.status || 'TODO', t.notes || '', t.resource_url || '']
        );
      }
    }
    if (data.profile) {
      const p = data.profile;
      await pool.query(
        `UPDATE profile SET full_name=$1, email=$2, phone=$3, linkedin_url=$4, github_url=$5, portfolio_url=$6, current_role=$7, experience_years=$8, skills=$9, summary=$10 WHERE id=1`,
        [p.full_name || '', p.email || '', p.phone || '', p.linkedin_url || '', p.github_url || '', p.portfolio_url || '', p.current_role || '', p.experience_years || '', p.skills || '', p.summary || '']
      );
    }
    if (data.cover_templates) {
      await pool.query('DELETE FROM cover_templates');
      for (const t of data.cover_templates) {
        await pool.query(
          'INSERT INTO cover_templates (name, subject, body) VALUES ($1,$2,$3)',
          [t.name, t.subject || '', t.body || '']
        );
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================== DAILY LOG ==============================

app.get('/api/daily-log', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM daily_log ORDER BY date DESC LIMIT 30');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/daily-log', async (req, res) => {
  try {
    const { date, applications_sent, problems_solved, notes } = req.body;
    const d = date || new Date().toISOString().split('T')[0];
    // Upsert: update if date exists, insert if not
    const existing = await pool.query('SELECT id FROM daily_log WHERE date=$1', [d]);
    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE daily_log SET applications_sent=$1, problems_solved=$2, notes=$3 WHERE date=$4',
        [applications_sent || 0, problems_solved || 0, notes || '', d]
      );
      res.json({ ok: true, id: existing.rows[0].id });
    } else {
      const result = await pool.query(
        'INSERT INTO daily_log (date, applications_sent, problems_solved, notes) VALUES ($1,$2,$3,$4) RETURNING id',
        [d, applications_sent || 0, problems_solved || 0, notes || '']
      );
      res.json({ ok: true, id: result.rows[0].id });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================== AUTO-GHOSTED ==============================

// Mark stale applications as GHOSTED (no update in 30+ days while in APPLIED/SCREENING)
app.post('/api/auto-ghost', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE applications SET status='GHOSTED', updated_at=NOW()
       WHERE status IN ('APPLIED','SCREENING')
       AND updated_at < NOW() - INTERVAL '30 days'
       RETURNING id, company, role`
    );
    res.json({ ok: true, ghosted: result.rows.length, applications: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================== AUTOMATION APIs ==============================

// Multi-source job search (aggregates Remotive + Adzuna + JSearch)
app.get('/api/auto/search-jobs', async (req, res) => {
  const { keywords, location, limit: maxResults } = req.query;
  if (!keywords) return res.status(400).json({ error: 'Keywords required' });

  const results = [];
  const errors = [];
  const jobLimit = parseInt(maxResults) || 50;

  // Source 1: Remotive (free, no API key)
  try {
    const remRes = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(keywords)}&limit=${Math.min(jobLimit, 50)}`);
    const remData = await remRes.json();
    (remData.jobs || []).forEach(j => {
      results.push({
        title: j.title,
        company: j.company_name,
        location: j.candidate_required_location || 'Remote',
        salary: j.salary || '',
        url: j.url,
        source: 'Remotive',
        tags: (j.tags || []).slice(0, 5),
        posted: j.publication_date || '',
        description: (j.description || '').replace(/<[^>]*>/g, '').substring(0, 300)
      });
    });
  } catch (e) { errors.push('Remotive: ' + e.message); }

  // Source 2: Adzuna (free with API key)
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_API_KEY) {
    try {
      const country = (location || '').toLowerCase().includes('india') ? 'in' : 'gb';
      const adzRes = await fetch(`https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${process.env.ADZUNA_APP_ID}&app_key=${process.env.ADZUNA_API_KEY}&what=${encodeURIComponent(keywords)}&results_per_page=${Math.min(jobLimit, 50)}`);
      const adzData = await adzRes.json();
      (adzData.results || []).forEach(j => {
        results.push({
          title: j.title,
          company: j.company?.display_name || 'Unknown',
          location: j.location?.display_name || '',
          salary: j.salary_min ? `${Math.round(j.salary_min)}-${Math.round(j.salary_max || j.salary_min)}` : '',
          url: j.redirect_url,
          source: 'Adzuna',
          tags: [j.category?.label].filter(Boolean),
          posted: j.created || '',
          description: (j.description || '').substring(0, 300)
        });
      });
    } catch (e) { errors.push('Adzuna: ' + e.message); }
  }

  // Source 3: JSearch via RapidAPI (free tier: 200 requests/month)
  if (process.env.RAPIDAPI_KEY) {
    try {
      const jsRes = await fetch(`https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(keywords + (location ? ' in ' + location : ''))}&num_pages=1`, {
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
        }
      });
      const jsData = await jsRes.json();
      (jsData.data || []).forEach(j => {
        results.push({
          title: j.job_title,
          company: j.employer_name,
          location: j.job_city ? `${j.job_city}, ${j.job_country}` : j.job_country || 'Remote',
          salary: j.job_min_salary ? `${j.job_min_salary}-${j.job_max_salary}` : '',
          url: j.job_apply_link || j.job_google_link,
          source: 'JSearch',
          tags: [j.job_employment_type].filter(Boolean),
          posted: j.job_posted_at_datetime_utc || '',
          description: (j.job_description || '').substring(0, 300)
        });
      });
    } catch (e) { errors.push('JSearch: ' + e.message); }
  }

  res.json({ jobs: results.slice(0, jobLimit), total: results.length, errors, sources: { remotive: true, adzuna: !!process.env.ADZUNA_APP_ID, jsearch: !!process.env.RAPIDAPI_KEY } });
});

// Bulk save jobs to queue (saves as WISHLIST)
app.post('/api/auto/queue-jobs', async (req, res) => {
  const { jobs } = req.body;
  if (!jobs || !jobs.length) return res.status(400).json({ error: 'No jobs provided' });

  let saved = 0;
  for (const j of jobs) {
    // Skip duplicates (same company + role)
    const existing = await pool.query(
      'SELECT id FROM applications WHERE LOWER(company)=LOWER($1) AND LOWER(role)=LOWER($2)',
      [j.company, j.title]
    );
    if (existing.rows.length > 0) continue;

    await pool.query(
      `INSERT INTO applications (company, role, platform, portal_url, status, location, salary_range, notes) VALUES ($1,$2,$3,$4,'WISHLIST',$5,$6,$7)`,
      [j.company, j.title, j.source || 'Auto', j.url || '', j.location || '', j.salary || '', `Auto-fetched from ${j.source}. ${(j.description || '').substring(0, 200)}`]
    );
    saved++;
  }
  res.json({ ok: true, saved, skipped: jobs.length - saved });
});

// Get queued jobs (WISHLIST) for bulk apply
app.get('/api/auto/queue', async (req, res) => {
  const result = await pool.query("SELECT * FROM applications WHERE status='WISHLIST' ORDER BY created_at DESC");
  res.json(result.rows);
});

// Bulk apply: generate cover letter + send email for multiple jobs
app.post('/api/auto/bulk-apply', async (req, res) => {
  const { job_ids, template_id, send_email } = req.body;
  if (!job_ids || !job_ids.length) return res.status(400).json({ error: 'No jobs selected' });

  // Get profile and template
  const profileResult = await pool.query('SELECT * FROM profile WHERE id=1');
  const profile = profileResult.rows[0];
  if (!profile || !profile.full_name) return res.status(400).json({ error: 'Set up your profile in Settings first' });

  const tplResult = await pool.query('SELECT * FROM cover_templates WHERE id=$1', [template_id]);
  if (tplResult.rows.length === 0) return res.status(400).json({ error: 'Template not found' });
  const tpl = tplResult.rows[0];

  let emailCfg = null;
  if (send_email) {
    const cfgResult = await pool.query('SELECT * FROM email_config WHERE id=1');
    emailCfg = cfgResult.rows[0];
    if (!emailCfg || !emailCfg.smtp_user || !emailCfg.smtp_pass) {
      return res.status(400).json({ error: 'Configure email in Settings first' });
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
    const jobResult = await pool.query('SELECT * FROM applications WHERE id=$1', [jobId]);
    if (jobResult.rows.length === 0) { results.push({ id: jobId, status: 'not_found' }); continue; }
    const job = jobResult.rows[0];

    const subject = replacePlaceholders(tpl.subject, job.company, job.role);
    const body = replacePlaceholders(tpl.body, job.company, job.role);

    let emailStatus = 'skipped';

    if (send_email && transporter && job.notes) {
      // Try to extract email from notes or use a generic pattern
      const emailMatch = job.notes.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        try {
          const mailOpts = {
            from: emailCfg.from_name ? `"${emailCfg.from_name}" <${emailCfg.smtp_user}>` : emailCfg.smtp_user,
            to: emailMatch[0],
            subject,
            text: body
          };

          // Attach resume if available
          if (profile.resume_path) {
            const resumePath = path.join(__dirname, 'uploads', profile.resume_path);
            if (fs.existsSync(resumePath)) {
              mailOpts.attachments = [{ filename: profile.resume_path, path: resumePath }];
            }
          }

          await transporter.sendMail(mailOpts);
          emailStatus = 'sent';
        } catch (e) {
          emailStatus = 'failed: ' + e.message;
        }
      }
    }

    // Update status to APPLIED
    await pool.query(
      `UPDATE applications SET status='APPLIED', applied_date=$1, follow_up_date=$2, platform=$3, updated_at=NOW(), notes=$4 WHERE id=$5`,
      [today, followUpDate, job.platform || 'Auto', `${job.notes || ''}\n\n--- Auto-applied ---\nSubject: ${subject}\nEmail: ${emailStatus}\nDate: ${today}`, jobId]
    );

    results.push({ id: jobId, company: job.company, role: job.role, subject, emailStatus, status: 'applied' });
  }

  res.json({ ok: true, results, applied: results.filter(r => r.status === 'applied').length });
});

// Get automation stats
app.get('/api/auto/stats', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const queue = await pool.query("SELECT COUNT(*) as c FROM applications WHERE status='WISHLIST'");
  const appliedToday = await pool.query("SELECT COUNT(*) as c FROM applications WHERE applied_date=$1", [today]);
  const totalApplied = await pool.query("SELECT COUNT(*) as c FROM applications WHERE status='APPLIED'");
  const interviews = await pool.query("SELECT COUNT(*) as c FROM applications WHERE status='INTERVIEW'");

  res.json({
    inQueue: parseInt(queue.rows[0].c),
    appliedToday: parseInt(appliedToday.rows[0].c),
    totalApplied: parseInt(totalApplied.rows[0].c),
    interviews: parseInt(interviews.rows[0].c)
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3456;
initDB().then(() => {
  app.listen(PORT, () => {
    console.log('Job Hunt Pro running at http://localhost:' + PORT);
  });
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
