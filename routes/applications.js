const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// Applications CRUD
router.get('/applications', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM applications ORDER BY updated_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/applications', async (req, res) => {
  try {
    const { company, role, platform, portal_url, status, salary_range, location, notes, applied_date, interview_date, follow_up_date } = req.body;
    const result = await pool.query(
      `INSERT INTO applications (company, role, platform, portal_url, status, salary_range, location, notes, applied_date, interview_date, follow_up_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [company, role, platform || '', portal_url || '', status || 'WISHLIST', salary_range || '', location || '', notes || '', applied_date || '', interview_date || '', follow_up_date || '']
    );
    res.json({ id: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/applications/:id', async (req, res) => {
  try {
    const { company, role, platform, portal_url, status, salary_range, location, notes, applied_date, interview_date, follow_up_date } = req.body;
    await pool.query(
      `UPDATE applications SET company=$1, role=$2, platform=$3, portal_url=$4, status=$5, salary_range=$6, location=$7, notes=$8, applied_date=$9, interview_date=$10, follow_up_date=$11, updated_at=NOW() WHERE id=$12`,
      [company, role, platform || '', portal_url || '', status || 'WISHLIST', salary_range || '', location || '', notes || '', applied_date || '', interview_date || '', follow_up_date || '', req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/applications/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM applications WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Bulk delete
router.post('/applications/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ error: 'No IDs provided' });
    await pool.query('DELETE FROM applications WHERE id = ANY($1)', [ids]);
    res.json({ ok: true, deleted: ids.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Bulk update status
router.post('/applications/bulk-status', async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!ids || !ids.length || !status) return res.status(400).json({ error: 'IDs and status required' });
    await pool.query('UPDATE applications SET status=$1, updated_at=NOW() WHERE id = ANY($2)', [status, ids]);
    res.json({ ok: true, updated: ids.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Auto-ghost
router.post('/auto-ghost', async (req, res) => {
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

module.exports = router;
