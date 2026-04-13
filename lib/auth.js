const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

const SECRET = process.env.SESSION_SECRET || 'dev-only-change-me-in-prod';
const COOKIE_NAME = 'jhp_session';
const COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30 days

function sign(value) {
  const sig = crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
  return value + '.' + sig;
}

function verify(signed) {
  if (!signed || typeof signed !== 'string') return null;
  const idx = signed.lastIndexOf('.');
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch { return null; }
  return value;
}

function setSessionCookie(res, userId) {
  const value = sign(String(userId));
  res.cookie(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
    path: '/'
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

// Express middleware: sets req.userId if logged in (no error if not)
async function attachUser(req, _res, next) {
  const raw = req.cookies && req.cookies[COOKIE_NAME];
  const userId = verify(raw);
  if (userId) req.userId = parseInt(userId, 10) || null;
  next();
}

// Middleware: 401 if not logged in
function requireAuth(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'Login required' });
  next();
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

async function comparePassword(plain, hash) {
  if (!hash) return false;
  try { return await bcrypt.compare(plain, hash); } catch { return false; }
}

async function createUser(email, password, name) {
  const hashed = await hashPassword(password);
  const result = await pool.query(
    'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
    [email.toLowerCase().trim(), hashed, name || '']
  );
  return result.rows[0];
}

async function findUserByEmail(email) {
  const result = await pool.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase().trim()]);
  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await pool.query('SELECT id, email, name, created_at FROM users WHERE id=$1', [id]);
  return result.rows[0] || null;
}

module.exports = {
  attachUser,
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
  createUser,
  findUserByEmail,
  findUserById,
  comparePassword
};
