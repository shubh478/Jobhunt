const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

router.get('/prep', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM prep_topics WHERE user_id=$1 ORDER BY category, difficulty', [req.userId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/prep/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const result = await pool.query(
      'UPDATE prep_topics SET status=$1, notes=$2 WHERE id=$3 AND user_id=$4',
      [status, notes || '', req.params.id, req.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/prep', async (req, res) => {
  try {
    const { category, topic, difficulty, resource_url } = req.body;
    const result = await pool.query(
      'INSERT INTO prep_topics (user_id, category, topic, difficulty, resource_url) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [req.userId, category, topic, difficulty || 'MEDIUM', resource_url || '']
    );
    res.json({ id: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/practice-questions', async (req, res) => {
  try {
    const { application_id } = req.query;
    let query = `SELECT pq.* FROM practice_questions pq
                 LEFT JOIN applications a ON a.id = pq.application_id
                 WHERE (a.user_id=$1 OR (pq.application_id IS NULL AND pq.user_id=$1))`;
    let params = [req.userId];
    if (application_id) {
      query += ' AND pq.application_id=$2';
      params.push(application_id);
    }
    query += ' ORDER BY pq.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/practice-questions/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const result = await pool.query(
      `UPDATE practice_questions pq SET status=$1, notes=$2
       FROM applications a
       WHERE pq.id=$3
         AND ((pq.application_id IS NOT NULL AND a.id = pq.application_id AND a.user_id=$4)
              OR (pq.application_id IS NULL AND pq.user_id=$4))`,
      [status, notes || '', req.params.id, req.userId]
    );
    res.json({ ok: true, updated: result.rowCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
