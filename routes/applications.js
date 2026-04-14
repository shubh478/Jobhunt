const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

router.get('/applications', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM applications WHERE user_id=$1 ORDER BY updated_at DESC', [req.userId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/applications', async (req, res) => {
  try {
    const { company, role, platform, portal_url, status, salary_range, location, notes, applied_date, interview_date, follow_up_date } = req.body;
    const result = await pool.query(
      `INSERT INTO applications (user_id, company, role, platform, portal_url, status, salary_range, location, notes, applied_date, interview_date, follow_up_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [req.userId, company, role, platform || '', portal_url || '', status || 'WISHLIST', salary_range || '', location || '', notes || '', applied_date || '', interview_date || '', follow_up_date || '']
    );
    res.json({ id: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/applications/:id', async (req, res) => {
  try {
    const { company, role, platform, portal_url, status, salary_range, location, notes, applied_date, interview_date, follow_up_date } = req.body;
    const result = await pool.query(
      `UPDATE applications SET company=$1, role=$2, platform=$3, portal_url=$4, status=$5, salary_range=$6, location=$7, notes=$8, applied_date=$9, interview_date=$10, follow_up_date=$11, updated_at=NOW()
       WHERE id=$12 AND user_id=$13`,
      [company, role, platform || '', portal_url || '', status || 'WISHLIST', salary_range || '', location || '', notes || '', applied_date || '', interview_date || '', follow_up_date || '', req.params.id, req.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/applications/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM applications WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/applications/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ error: 'No IDs provided' });
    const result = await pool.query('DELETE FROM applications WHERE id = ANY($1) AND user_id=$2', [ids, req.userId]);
    res.json({ ok: true, deleted: result.rowCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/applications/bulk-status', async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!ids || !ids.length || !status) return res.status(400).json({ error: 'IDs and status required' });
    const result = await pool.query('UPDATE applications SET status=$1, updated_at=NOW() WHERE id = ANY($2) AND user_id=$3', [status, ids, req.userId]);
    res.json({ ok: true, updated: result.rowCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Reset APPLIED applications back to WISHLIST — for users who clicked "Apply"
// thinking it actually submitted, then realized it only updated the tracker.
router.post('/applications/reset-applied-to-wishlist', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE applications
       SET status='WISHLIST', applied_date='', follow_up_date='', updated_at=NOW()
       WHERE user_id=$1 AND status='APPLIED'
       RETURNING id, company, role`,
      [req.userId]
    );
    res.json({ ok: true, reset: result.rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete WISHLIST rows whose portal_url points at an aggregator site
// (apna, shine, adzuna, simplyhired, etc.) — used to clean out stale
// aggregator-sourced saved jobs that can never be autofilled.
router.post('/applications/cleanup-aggregators', async (req, res) => {
  try {
    const hosts = [
      'apna.co','shine.com','adzuna.','jobicy.com','jobrapido.','simplyhired.',
      'foundit.','timesjobs.com','iimjobs.com','hirist.','cutshort.io',
      'instahyre.com','wellfound.com','monster.','ziprecruiter.com',
      'jooble.org','flexjobs.com','jobs.google.com',
      'indeed.com','glassdoor.com','glassdoor.co.in','glassdoor.',
      'bebee.com','naukri.com','remoteok.','remotive.',
      'example.com' // test URLs
    ];
    const likeClause = hosts.map((_, i) => `portal_url ILIKE $${i + 2}`).join(' OR ');
    const params = [req.userId, ...hosts.map(h => `%${h}%`)];
    const result = await pool.query(
      `DELETE FROM applications
       WHERE user_id=$1 AND status='WISHLIST' AND (${likeClause})
       RETURNING id, company, role`,
      params
    );
    res.json({ ok: true, deleted: result.rows.length, sample: result.rows.slice(0, 5) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/auto-ghost', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE applications SET status='GHOSTED', updated_at=NOW()
       WHERE user_id=$1 AND status IN ('APPLIED','SCREENING')
       AND updated_at < NOW() - INTERVAL '30 days'
       RETURNING id, company, role`,
      [req.userId]
    );
    res.json({ ok: true, ghosted: result.rows.length, applications: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
