const express = require('express');
const Database = require('better-sqlite3');
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

// --- Database Setup ---
const db = new Database(path.join(__dirname, 'jobhunt.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prep_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    topic TEXT NOT NULL,
    difficulty TEXT DEFAULT 'MEDIUM',
    status TEXT DEFAULT 'TODO',
    notes TEXT DEFAULT '',
    resource_url TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS daily_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT DEFAULT (date('now')),
    applications_sent INTEGER DEFAULT 0,
    problems_solved INTEGER DEFAULT 0,
    notes TEXT DEFAULT ''
  );

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
  );

  CREATE TABLE IF NOT EXISTS email_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    smtp_host TEXT DEFAULT 'smtp.gmail.com',
    smtp_port INTEGER DEFAULT 587,
    smtp_user TEXT DEFAULT '',
    smtp_pass TEXT DEFAULT '',
    from_name TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS cover_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT DEFAULT '',
    body TEXT DEFAULT ''
  );
`);

// Init single-row tables
db.prepare(`INSERT OR IGNORE INTO profile (id) VALUES (1)`).run();
db.prepare(`INSERT OR IGNORE INTO email_config (id) VALUES (1)`).run();

// Seed prep topics if empty
const count = db.prepare('SELECT COUNT(*) as c FROM prep_topics').get();
if (count.c === 0) {
  const seed = db.prepare('INSERT INTO prep_topics (category, topic, difficulty, resource_url) VALUES (?,?,?,?)');
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
  const insertMany = db.transaction((rows) => { for (const r of rows) seed.run(...r); });
  insertMany(topics);
}

// Seed a default cover letter template
const tplCount = db.prepare('SELECT COUNT(*) as c FROM cover_templates').get();
if (tplCount.c === 0) {
  db.prepare(`INSERT INTO cover_templates (name, subject, body) VALUES (?, ?, ?)`).run(
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
  );
}

// --- API Routes ---

// Applications CRUD
app.get('/api/applications', (req, res) => {
  const rows = db.prepare('SELECT * FROM applications ORDER BY updated_at DESC').all();
  res.json(rows);
});

app.post('/api/applications', (req, res) => {
  const { company, role, platform, portal_url, status, salary_range, location, notes, applied_date, interview_date, follow_up_date } = req.body;
  const stmt = db.prepare(`INSERT INTO applications (company, role, platform, portal_url, status, salary_range, location, notes, applied_date, interview_date, follow_up_date)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const info = stmt.run(company, role, platform || '', portal_url || '', status || 'WISHLIST', salary_range || '', location || '', notes || '', applied_date || '', interview_date || '', follow_up_date || '');
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/applications/:id', (req, res) => {
  const { company, role, platform, portal_url, status, salary_range, location, notes, applied_date, interview_date, follow_up_date } = req.body;
  db.prepare(`UPDATE applications SET company=?, role=?, platform=?, portal_url=?, status=?, salary_range=?, location=?, notes=?, applied_date=?, interview_date=?, follow_up_date=?, updated_at=datetime('now') WHERE id=?`)
    .run(company, role, platform || '', portal_url || '', status || 'WISHLIST', salary_range || '', location || '', notes || '', applied_date || '', interview_date || '', follow_up_date || '', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/applications/:id', (req, res) => {
  db.prepare('DELETE FROM applications WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Prep topics
app.get('/api/prep', (req, res) => {
  const rows = db.prepare('SELECT * FROM prep_topics ORDER BY category, difficulty').all();
  res.json(rows);
});

app.put('/api/prep/:id', (req, res) => {
  const { status, notes } = req.body;
  db.prepare('UPDATE prep_topics SET status=?, notes=? WHERE id=?').run(status, notes || '', req.params.id);
  res.json({ ok: true });
});

app.post('/api/prep', (req, res) => {
  const { category, topic, difficulty, resource_url } = req.body;
  const info = db.prepare('INSERT INTO prep_topics (category, topic, difficulty, resource_url) VALUES (?,?,?,?)')
    .run(category, topic, difficulty || 'MEDIUM', resource_url || '');
  res.json({ id: info.lastInsertRowid });
});

// Stats
app.get('/api/stats', (req, res) => {
  const apps = db.prepare('SELECT status, COUNT(*) as count FROM applications GROUP BY status').all();
  const prepStats = db.prepare('SELECT status, COUNT(*) as count FROM prep_topics GROUP BY status').all();
  const total = db.prepare('SELECT COUNT(*) as c FROM applications').get();
  const today = new Date().toISOString().split('T')[0];
  const followUps = db.prepare(`SELECT * FROM applications WHERE follow_up_date <= ? AND status IN ('APPLIED','SCREENING','INTERVIEW') ORDER BY follow_up_date`).all(today);
  res.json({ applicationsByStatus: apps, prepByStatus: prepStats, totalApplications: total.c, followUps });
});

// Profile
app.get('/api/profile', (req, res) => {
  res.json(db.prepare('SELECT * FROM profile WHERE id=1').get());
});

app.put('/api/profile', (req, res) => {
  const { full_name, email, phone, linkedin_url, github_url, portfolio_url, current_role, experience_years, skills, summary } = req.body;
  db.prepare(`UPDATE profile SET full_name=?, email=?, phone=?, linkedin_url=?, github_url=?, portfolio_url=?, current_role=?, experience_years=?, skills=?, summary=? WHERE id=1`)
    .run(full_name || '', email || '', phone || '', linkedin_url || '', github_url || '', portfolio_url || '', current_role || '', experience_years || '', skills || '', summary || '');
  res.json({ ok: true });
});

// Resume upload
app.post('/api/resume', upload.single('resume'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  db.prepare('UPDATE profile SET resume_path=? WHERE id=1').run(req.file.filename);
  res.json({ ok: true, filename: req.file.filename });
});

app.get('/api/resume-info', (req, res) => {
  const p = db.prepare('SELECT resume_path FROM profile WHERE id=1').get();
  if (p && p.resume_path) {
    const fullPath = path.join(__dirname, 'uploads', p.resume_path);
    const exists = fs.existsSync(fullPath);
    res.json({ exists, filename: p.resume_path });
  } else {
    res.json({ exists: false, filename: null });
  }
});

// Email config
app.get('/api/email-config', (req, res) => {
  const cfg = db.prepare('SELECT * FROM email_config WHERE id=1').get();
  // Mask password
  if (cfg.smtp_pass) cfg.smtp_pass = '********';
  res.json(cfg);
});

app.put('/api/email-config', (req, res) => {
  const { smtp_host, smtp_port, smtp_user, smtp_pass, from_name } = req.body;
  // Only update password if not masked
  if (smtp_pass && smtp_pass !== '********') {
    db.prepare('UPDATE email_config SET smtp_host=?, smtp_port=?, smtp_user=?, smtp_pass=?, from_name=? WHERE id=1')
      .run(smtp_host || 'smtp.gmail.com', smtp_port || 587, smtp_user || '', smtp_pass, from_name || '');
  } else {
    db.prepare('UPDATE email_config SET smtp_host=?, smtp_port=?, smtp_user=?, from_name=? WHERE id=1')
      .run(smtp_host || 'smtp.gmail.com', smtp_port || 587, smtp_user || '', from_name || '');
  }
  res.json({ ok: true });
});

// Send email application
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, body, attachResume } = req.body;
    const cfg = db.prepare('SELECT * FROM email_config WHERE id=1').get();
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
      const profile = db.prepare('SELECT resume_path FROM profile WHERE id=1').get();
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
app.get('/api/templates', (req, res) => {
  res.json(db.prepare('SELECT * FROM cover_templates').all());
});

app.post('/api/templates', (req, res) => {
  const { name, subject, body } = req.body;
  const info = db.prepare('INSERT INTO cover_templates (name, subject, body) VALUES (?,?,?)').run(name, subject || '', body || '');
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/templates/:id', (req, res) => {
  const { name, subject, body } = req.body;
  db.prepare('UPDATE cover_templates SET name=?, subject=?, body=? WHERE id=?').run(name, subject || '', body || '', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/templates/:id', (req, res) => {
  db.prepare('DELETE FROM cover_templates WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Generate cover letter from template
app.post('/api/generate-cover', (req, res) => {
  const { template_id, company, role } = req.body;
  const tpl = db.prepare('SELECT * FROM cover_templates WHERE id=?').get(template_id);
  if (!tpl) return res.status(404).json({ error: 'Template not found' });
  const profile = db.prepare('SELECT * FROM profile WHERE id=1').get();

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
});

// Data export/import (backup)
app.get('/api/export', (req, res) => {
  const data = {
    applications: db.prepare('SELECT * FROM applications').all(),
    prep_topics: db.prepare('SELECT * FROM prep_topics').all(),
    profile: db.prepare('SELECT * FROM profile WHERE id=1').get(),
    cover_templates: db.prepare('SELECT * FROM cover_templates').all(),
    exported_at: new Date().toISOString()
  };
  res.setHeader('Content-Disposition', 'attachment; filename=jobhunt-backup.json');
  res.json(data);
});

app.post('/api/import', (req, res) => {
  try {
    const data = req.body;
    const tx = db.transaction(() => {
      if (data.applications) {
        db.prepare('DELETE FROM applications').run();
        const stmt = db.prepare(`INSERT INTO applications (id, company, role, platform, portal_url, status, salary_range, location, notes, applied_date, interview_date, follow_up_date, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
        for (const a of data.applications) {
          stmt.run(a.id, a.company, a.role, a.platform || '', a.portal_url || '', a.status || 'WISHLIST', a.salary_range || '', a.location || '', a.notes || '', a.applied_date || '', a.interview_date || '', a.follow_up_date || '', a.created_at || '', a.updated_at || '');
        }
      }
      if (data.prep_topics) {
        db.prepare('DELETE FROM prep_topics').run();
        const stmt = db.prepare(`INSERT INTO prep_topics (id, category, topic, difficulty, status, notes, resource_url) VALUES (?,?,?,?,?,?,?)`);
        for (const t of data.prep_topics) {
          stmt.run(t.id, t.category, t.topic, t.difficulty || 'MEDIUM', t.status || 'TODO', t.notes || '', t.resource_url || '');
        }
      }
      if (data.profile) {
        const p = data.profile;
        db.prepare(`UPDATE profile SET full_name=?, email=?, phone=?, linkedin_url=?, github_url=?, portfolio_url=?, current_role=?, experience_years=?, skills=?, summary=? WHERE id=1`)
          .run(p.full_name || '', p.email || '', p.phone || '', p.linkedin_url || '', p.github_url || '', p.portfolio_url || '', p.current_role || '', p.experience_years || '', p.skills || '', p.summary || '');
      }
      if (data.cover_templates) {
        db.prepare('DELETE FROM cover_templates').run();
        const stmt = db.prepare('INSERT INTO cover_templates (id, name, subject, body) VALUES (?,?,?,?)');
        for (const t of data.cover_templates) {
          stmt.run(t.id, t.name, t.subject || '', t.body || '');
        }
      }
    });
    tx();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3456;
app.listen(PORT, () => {
  console.log('Job Hunt Pro running at http://localhost:' + PORT);
});
