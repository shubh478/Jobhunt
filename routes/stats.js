const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

router.get('/stats', async (req, res) => {
  try {
    const u = req.userId;
    const apps = await pool.query('SELECT status, COUNT(*) as count FROM applications WHERE user_id=$1 GROUP BY status', [u]);
    const prepStats = await pool.query('SELECT status, COUNT(*) as count FROM prep_topics WHERE user_id=$1 GROUP BY status', [u]);
    const total = await pool.query('SELECT COUNT(*) as c FROM applications WHERE user_id=$1', [u]);
    const today = new Date().toISOString().split('T')[0];
    const followUps = await pool.query(
      `SELECT * FROM applications WHERE user_id=$1 AND follow_up_date <= $2 AND status IN ('APPLIED','SCREENING','INTERVIEW') ORDER BY follow_up_date`,
      [u, today]
    );
    const dailyTrend = await pool.query(
      `SELECT applied_date as date, COUNT(*) as count FROM applications
       WHERE user_id=$1 AND applied_date != '' AND applied_date >= (CURRENT_DATE - INTERVAL '30 days')::TEXT
       GROUP BY applied_date ORDER BY applied_date`,
      [u]
    );
    const totalApplied = await pool.query("SELECT COUNT(*) as c FROM applications WHERE user_id=$1 AND status != 'WISHLIST'", [u]);
    const gotResponse = await pool.query("SELECT COUNT(*) as c FROM applications WHERE user_id=$1 AND status IN ('SCREENING','INTERVIEW','OFFER')", [u]);
    const avgDays = await pool.query(
      `SELECT AVG(EXTRACT(DAY FROM (updated_at - created_at))) as avg_days FROM applications
       WHERE user_id=$1 AND status IN ('SCREENING','INTERVIEW','OFFER') AND updated_at > created_at`,
      [u]
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

router.get('/daily-log', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM daily_log WHERE user_id=$1 ORDER BY date DESC LIMIT 30', [req.userId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/daily-log', async (req, res) => {
  try {
    const { date, applications_sent, problems_solved, notes } = req.body;
    const d = date || new Date().toISOString().split('T')[0];
    const existing = await pool.query('SELECT id FROM daily_log WHERE user_id=$1 AND date=$2', [req.userId, d]);
    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE daily_log SET applications_sent=$1, problems_solved=$2, notes=$3 WHERE user_id=$4 AND date=$5',
        [applications_sent || 0, problems_solved || 0, notes || '', req.userId, d]
      );
      res.json({ ok: true, id: existing.rows[0].id });
    } else {
      const result = await pool.query(
        'INSERT INTO daily_log (user_id, date, applications_sent, problems_solved, notes) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [req.userId, d, applications_sent || 0, problems_solved || 0, notes || '']
      );
      res.json({ ok: true, id: result.rows[0].id });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/export', async (req, res) => {
  try {
    const u = req.userId;
    const applications = await pool.query('SELECT * FROM applications WHERE user_id=$1', [u]);
    const prep = await pool.query('SELECT * FROM prep_topics WHERE user_id=$1', [u]);
    const profile = await pool.query('SELECT * FROM profile WHERE user_id=$1', [u]);
    const templates = await pool.query('SELECT * FROM cover_templates WHERE user_id=$1', [u]);
    const data = {
      applications: applications.rows,
      prep_topics: prep.rows,
      profile: profile.rows[0],
      cover_templates: templates.rows,
      exported_at: new Date().toISOString()
    };
    res.setHeader('Content-Disposition', 'attachment; filename=jobhunt-backup.json');
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/import', async (req, res) => {
  try {
    const data = req.body;
    const u = req.userId;
    if (data.applications) {
      await pool.query('DELETE FROM applications WHERE user_id=$1', [u]);
      for (const a of data.applications) {
        await pool.query(
          `INSERT INTO applications (user_id, company, role, platform, portal_url, status, salary_range, location, notes, applied_date, interview_date, follow_up_date, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [u, a.company, a.role, a.platform || '', a.portal_url || '', a.status || 'WISHLIST', a.salary_range || '', a.location || '', a.notes || '', a.applied_date || '', a.interview_date || '', a.follow_up_date || '', a.created_at || new Date().toISOString(), a.updated_at || new Date().toISOString()]
        );
      }
    }
    if (data.prep_topics) {
      await pool.query('DELETE FROM prep_topics WHERE user_id=$1', [u]);
      for (const t of data.prep_topics) {
        await pool.query(
          `INSERT INTO prep_topics (user_id, category, topic, difficulty, status, notes, resource_url) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [u, t.category, t.topic, t.difficulty || 'MEDIUM', t.status || 'TODO', t.notes || '', t.resource_url || '']
        );
      }
    }
    if (data.profile) {
      const p = data.profile;
      await pool.query(
        `UPDATE profile SET full_name=$1, email=$2, phone=$3, linkedin_url=$4, github_url=$5, portfolio_url=$6, "current_role"=$7, experience_years=$8, skills=$9, summary=$10 WHERE user_id=$11`,
        [p.full_name || '', p.email || '', p.phone || '', p.linkedin_url || '', p.github_url || '', p.portfolio_url || '', p.current_role || '', p.experience_years || '', p.skills || '', p.summary || '', u]
      );
    }
    if (data.cover_templates) {
      await pool.query('DELETE FROM cover_templates WHERE user_id=$1', [u]);
      for (const t of data.cover_templates) {
        await pool.query(
          'INSERT INTO cover_templates (user_id, name, subject, body) VALUES ($1,$2,$3,$4)',
          [u, t.name, t.subject || '', t.body || '']
        );
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
