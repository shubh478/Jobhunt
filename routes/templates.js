const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

router.get('/templates', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cover_templates WHERE user_id=$1', [req.userId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/templates', async (req, res) => {
  try {
    const { name, subject, body } = req.body;
    const result = await pool.query(
      'INSERT INTO cover_templates (user_id, name, subject, body) VALUES ($1,$2,$3,$4) RETURNING id',
      [req.userId, name, subject || '', body || '']
    );
    res.json({ id: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/templates/:id', async (req, res) => {
  try {
    const { name, subject, body } = req.body;
    const result = await pool.query(
      'UPDATE cover_templates SET name=$1, subject=$2, body=$3 WHERE id=$4 AND user_id=$5',
      [name, subject || '', body || '', req.params.id, req.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/templates/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM cover_templates WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/generate-cover', async (req, res) => {
  try {
    const { template_id, company, role } = req.body;
    const tplResult = await pool.query('SELECT * FROM cover_templates WHERE id=$1 AND user_id=$2', [template_id, req.userId]);
    if (tplResult.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    const tpl = tplResult.rows[0];
    const profileResult = await pool.query('SELECT * FROM profile WHERE user_id=$1', [req.userId]);
    const profile = profileResult.rows[0] || {};

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

module.exports = router;
