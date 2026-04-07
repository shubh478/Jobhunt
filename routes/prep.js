const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// Prep topics
router.get('/prep', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM prep_topics ORDER BY category, difficulty');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/prep/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    await pool.query('UPDATE prep_topics SET status=$1, notes=$2 WHERE id=$3', [status, notes || '', req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/prep', async (req, res) => {
  try {
    const { category, topic, difficulty, resource_url } = req.body;
    const result = await pool.query(
      'INSERT INTO prep_topics (category, topic, difficulty, resource_url) VALUES ($1,$2,$3,$4) RETURNING id',
      [category, topic, difficulty || 'MEDIUM', resource_url || '']
    );
    res.json({ id: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Practice questions (AI-generated)
router.get('/practice-questions', async (req, res) => {
  try {
    const { application_id } = req.query;
    let query = 'SELECT * FROM practice_questions';
    let params = [];
    if (application_id) {
      query += ' WHERE application_id=$1';
      params = [application_id];
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/practice-questions/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    await pool.query('UPDATE practice_questions SET status=$1, notes=$2 WHERE id=$3', [status, notes || '', req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
