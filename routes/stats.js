const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// Stats
router.get('/stats', async (req, res) => {
  try {
    const apps = await pool.query('SELECT status, COUNT(*) as count FROM applications GROUP BY status');
    const prepStats = await pool.query('SELECT status, COUNT(*) as count FROM prep_topics GROUP BY status');
    const total = await pool.query('SELECT COUNT(*) as c FROM applications');
    const today = new Date().toISOString().split('T')[0];
    const followUps = await pool.query(
      `SELECT * FROM applications WHERE follow_up_date <= $1 AND status IN ('APPLIED','SCREENING','INTERVIEW') ORDER BY follow_up_date`,
      [today]
    );
    const dailyTrend = await pool.query(
      `SELECT applied_date as date, COUNT(*) as count FROM applications WHERE applied_date != '' AND applied_date >= (CURRENT_DATE - INTERVAL '30 days')::TEXT GROUP BY applied_date ORDER BY applied_date`
    );
    const totalApplied = await pool.query("SELECT COUNT(*) as c FROM applications WHERE status != 'WISHLIST'");
    const gotResponse = await pool.query("SELECT COUNT(*) as c FROM applications WHERE status IN ('SCREENING','INTERVIEW','OFFER')");
    const avgDays = await pool.query(
      `SELECT AVG(EXTRACT(DAY FROM (updated_at - created_at))) as avg_days FROM applications WHERE status IN ('SCREENING','INTERVIEW','OFFER') AND updated_at > created_at`
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

// Daily log
router.get('/daily-log', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM daily_log ORDER BY date DESC LIMIT 30');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/daily-log', async (req, res) => {
  try {
    const { date, applications_sent, problems_solved, notes } = req.body;
    const d = date || new Date().toISOString().split('T')[0];
    const existing = await pool.query('SELECT id FROM daily_log WHERE date=$1', [d]);
    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE daily_log SET applications_sent=$1, problems_solved=$2, notes=$3 WHERE date=$4',
        [applications_sent || 0, problems_solved || 0, notes || '', d]
      );
      res.json({ ok: true, id: existing.rows[0].id });
    } else {
      const result = await pool.query(
        'INSERT INTO daily_log (date, applications_sent, problems_solved, notes) VALUES ($1,$2,$3,$4) RETURNING id',
        [d, applications_sent || 0, problems_solved || 0, notes || '']
      );
      res.json({ ok: true, id: result.rows[0].id });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Export/Import
router.get('/export', async (req, res) => {
  try {
    const applications = await pool.query('SELECT * FROM applications');
    const prep = await pool.query('SELECT * FROM prep_topics');
    const profile = await pool.query('SELECT * FROM profile WHERE id=1');
    const templates = await pool.query('SELECT * FROM cover_templates');
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
    if (data.applications) {
      await pool.query('DELETE FROM applications');
      for (const a of data.applications) {
        await pool.query(
          `INSERT INTO applications (company, role, platform, portal_url, status, salary_range, location, notes, applied_date, interview_date, follow_up_date, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [a.company, a.role, a.platform || '', a.portal_url || '', a.status || 'WISHLIST', a.salary_range || '', a.location || '', a.notes || '', a.applied_date || '', a.interview_date || '', a.follow_up_date || '', a.created_at || new Date().toISOString(), a.updated_at || new Date().toISOString()]
        );
      }
    }
    if (data.prep_topics) {
      await pool.query('DELETE FROM prep_topics');
      for (const t of data.prep_topics) {
        await pool.query(
          `INSERT INTO prep_topics (category, topic, difficulty, status, notes, resource_url) VALUES ($1,$2,$3,$4,$5,$6)`,
          [t.category, t.topic, t.difficulty || 'MEDIUM', t.status || 'TODO', t.notes || '', t.resource_url || '']
        );
      }
    }
    if (data.profile) {
      const p = data.profile;
      await pool.query(
        `UPDATE profile SET full_name=$1, email=$2, phone=$3, linkedin_url=$4, github_url=$5, portfolio_url=$6, "current_role"=$7, experience_years=$8, skills=$9, summary=$10 WHERE id=1`,
        [p.full_name || '', p.email || '', p.phone || '', p.linkedin_url || '', p.github_url || '', p.portfolio_url || '', p.current_role || '', p.experience_years || '', p.skills || '', p.summary || '']
      );
    }
    if (data.cover_templates) {
      await pool.query('DELETE FROM cover_templates');
      for (const t of data.cover_templates) {
        await pool.query(
          'INSERT INTO cover_templates (name, subject, body) VALUES ($1,$2,$3)',
          [t.name, t.subject || '', t.body || '']
        );
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
