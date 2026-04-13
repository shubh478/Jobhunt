const express = require('express');
const router = express.Router();
const {
  createUser,
  findUserByEmail,
  findUserById,
  comparePassword,
  setSessionCookie,
  clearSessionCookie,
  requireAuth
} = require('../lib/auth');
const pool = require('../db/pool');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Valid email required' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await findUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const user = await createUser(email, password, name || '');

    // First user inherits all pre-existing single-tenant data so nothing is lost.
    const countResult = await pool.query('SELECT COUNT(*)::int AS c FROM users');
    const isFirstUser = countResult.rows[0].c === 1;

    if (isFirstUser) {
      try {
        await pool.query('UPDATE applications SET user_id=$1 WHERE user_id IS NULL', [user.id]);
        await pool.query('UPDATE profile SET user_id=$1 WHERE user_id IS NULL', [user.id]);
        await pool.query('UPDATE daily_log SET user_id=$1 WHERE user_id IS NULL', [user.id]);
        await pool.query('UPDATE prep_topics SET user_id=$1 WHERE user_id IS NULL', [user.id]);
        await pool.query('UPDATE cover_templates SET user_id=$1 WHERE user_id IS NULL', [user.id]);
        await pool.query('UPDATE practice_questions SET user_id=$1 WHERE user_id IS NULL', [user.id]);
        await pool.query('UPDATE follow_ups SET user_id=$1 WHERE user_id IS NULL', [user.id]);
        await pool.query('UPDATE email_config SET user_id=$1 WHERE user_id IS NULL', [user.id]);
      } catch (e) {
        console.warn('Legacy data migration skipped:', e.message);
      }
    }

    // Always ensure profile + email_config rows exist for this user (even the first one)
    await pool.query(
      `INSERT INTO profile (user_id, full_name, email) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO NOTHING`,
      [user.id, name || '', email]
    ).catch(async () => {
      // Fallback if conflict target syntax differs
      const ex = await pool.query('SELECT 1 FROM profile WHERE user_id=$1', [user.id]);
      if (!ex.rows.length) {
        await pool.query('INSERT INTO profile (user_id, full_name, email) VALUES ($1, $2, $3)', [user.id, name || '', email]);
      }
    });

    const ec = await pool.query('SELECT 1 FROM email_config WHERE user_id=$1', [user.id]);
    if (!ec.rows.length) {
      await pool.query('INSERT INTO email_config (user_id, smtp_host) VALUES ($1, $2)', [user.id, 'smtp.gmail.com']);
    }

    // Seed default cover template + prep topics for non-first users
    if (!isFirstUser) {
      const tplCount = await pool.query('SELECT COUNT(*)::int AS c FROM cover_templates WHERE user_id=$1', [user.id]);
      if (tplCount.rows[0].c === 0) {
        await pool.query(
          `INSERT INTO cover_templates (user_id, name, subject, body) VALUES ($1, $2, $3, $4)`,
          [user.id, 'Default Application', 'Application for {role} at {company}',
           `Hi {company} Team,\n\nI am writing to express my interest in the {role} position. With {experience_years} years of experience in {skills}, I believe I can contribute meaningfully to your team.\n\n{summary}\n\nI would welcome the opportunity to discuss how my background aligns with your needs.\n\nBest regards,\n{full_name}\n{email} | {phone}\n{linkedin_url}`]
        );
      }

      const topicCount = await pool.query('SELECT COUNT(*)::int AS c FROM prep_topics WHERE user_id=$1', [user.id]);
      if (topicCount.rows[0].c === 0) {
        const topics = [
          ['DSA', 'Arrays & Hashing', 'EASY', 'https://leetcode.com/tag/array/'],
          ['DSA', 'Two Pointers', 'EASY', 'https://leetcode.com/tag/two-pointers/'],
          ['DSA', 'Sliding Window', 'MEDIUM', 'https://leetcode.com/tag/sliding-window/'],
          ['DSA', 'Binary Search', 'MEDIUM', 'https://leetcode.com/tag/binary-search/'],
          ['DSA', 'Trees (BFS/DFS)', 'MEDIUM', 'https://leetcode.com/tag/tree/'],
          ['DSA', 'Dynamic Programming', 'HARD', 'https://leetcode.com/tag/dynamic-programming/'],
          ['System Design', 'URL Shortener', 'MEDIUM', ''],
          ['System Design', 'Rate Limiter', 'MEDIUM', ''],
          ['Behavioral', 'Tell me about yourself', 'EASY', ''],
          ['Behavioral', 'Why this company?', 'EASY', '']
        ];
        for (const t of topics) {
          await pool.query('INSERT INTO prep_topics (user_id, category, topic, difficulty, resource_url) VALUES ($1,$2,$3,$4,$5)', [user.id, ...t]);
        }
      }
    }

    setSessionCookie(res, user.id);
    res.json({ ok: true, user });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await comparePassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    setSessionCookie(res, user.id);
    res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/auth/me', requireAuth, async (req, res) => {
  const user = await findUserById(req.userId);
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  res.json(user);
});

module.exports = router;
