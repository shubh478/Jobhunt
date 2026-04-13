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
    if (countResult.rows[0].c === 1) {
      try {
        await pool.query('UPDATE applications SET user_id=$1 WHERE user_id IS NULL', [user.id]);
        await pool.query('UPDATE profile SET user_id=$1 WHERE id=1 AND user_id IS NULL', [user.id]);
        await pool.query('UPDATE daily_log SET user_id=$1 WHERE user_id IS NULL', [user.id]);
        await pool.query('UPDATE prep_topics SET user_id=$1 WHERE user_id IS NULL', [user.id]);
        await pool.query('UPDATE cover_templates SET user_id=$1 WHERE user_id IS NULL', [user.id]);
        await pool.query('UPDATE practice_questions SET user_id=$1 WHERE user_id IS NULL', [user.id]);
        await pool.query('UPDATE follow_ups SET user_id=$1 WHERE user_id IS NULL', [user.id]);
        await pool.query('UPDATE email_config SET user_id=$1 WHERE id=1 AND user_id IS NULL', [user.id]);
      } catch (e) {
        console.warn('Legacy data migration skipped:', e.message);
      }
    } else {
      // For non-first users, ensure a profile + email_config row exists for them
      await pool.query('INSERT INTO profile (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]).catch(() => {});
      await pool.query('INSERT INTO email_config (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]).catch(() => {});
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
