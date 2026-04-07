const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const multer = require('multer');
const nodemailer = require('nodemailer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Profile
router.get('/profile', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM profile WHERE id=1');
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/profile', async (req, res) => {
  try {
    const { full_name, email, phone, linkedin_url, github_url, portfolio_url, current_role, experience_years, skills, summary, resume_text } = req.body;
    let query = `UPDATE profile SET full_name=$1, email=$2, phone=$3, linkedin_url=$4, github_url=$5, portfolio_url=$6, current_role=$7, experience_years=$8, skills=$9, summary=$10`;
    let params = [full_name || '', email || '', phone || '', linkedin_url || '', github_url || '', portfolio_url || '', current_role || '', experience_years || '', skills || '', summary || ''];
    if (resume_text !== undefined) {
      query += `, resume_text=$11 WHERE id=1`;
      params.push(resume_text);
    } else {
      query += ` WHERE id=1`;
    }
    await pool.query(query, params);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Resume upload
router.post('/resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const base64 = req.file.buffer.toString('base64');
    const filename = req.file.originalname;
    const mimetype = req.file.mimetype;
    await pool.query(
      'UPDATE profile SET resume_path=$1, resume_data=$2, resume_mimetype=$3 WHERE id=1',
      [filename, base64, mimetype]
    );
    res.json({ ok: true, filename });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/resume-info', async (req, res) => {
  try {
    const result = await pool.query('SELECT resume_path, resume_data FROM profile WHERE id=1');
    const p = result.rows[0];
    const exists = !!(p && p.resume_path && p.resume_data);
    res.json({ exists, filename: p ? p.resume_path : null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/resume-download', async (req, res) => {
  try {
    const result = await pool.query('SELECT resume_path, resume_data, resume_mimetype FROM profile WHERE id=1');
    const p = result.rows[0];
    if (!p || !p.resume_data) return res.status(404).json({ error: 'No resume uploaded' });
    const buffer = Buffer.from(p.resume_data, 'base64');
    res.setHeader('Content-Type', p.resume_mimetype || 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + (p.resume_path || 'resume.pdf') + '"');
    res.send(buffer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Email config
router.get('/email-config', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM email_config WHERE id=1');
    const cfg = { ...result.rows[0] };
    if (cfg.smtp_pass) cfg.smtp_pass = '********';
    res.json(cfg);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/email-config', async (req, res) => {
  try {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, from_name } = req.body;
    if (smtp_pass && smtp_pass !== '********') {
      await pool.query(
        'UPDATE email_config SET smtp_host=$1, smtp_port=$2, smtp_user=$3, smtp_pass=$4, from_name=$5 WHERE id=1',
        [smtp_host || 'smtp.gmail.com', smtp_port || 587, smtp_user || '', smtp_pass, from_name || '']
      );
    } else {
      await pool.query(
        'UPDATE email_config SET smtp_host=$1, smtp_port=$2, smtp_user=$3, from_name=$4 WHERE id=1',
        [smtp_host || 'smtp.gmail.com', smtp_port || 587, smtp_user || '', from_name || '']
      );
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Send email
router.post('/send-email', async (req, res) => {
  try {
    const { to, subject, body, attachResume } = req.body;
    const cfgResult = await pool.query('SELECT * FROM email_config WHERE id=1');
    const cfg = cfgResult.rows[0];
    if (!cfg.smtp_user || !cfg.smtp_pass) return res.status(400).json({ error: 'Email not configured. Go to Settings > Email Config.' });

    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: cfg.smtp_port,
      secure: cfg.smtp_port === 465,
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass }
    });

    const mailOpts = {
      from: cfg.from_name ? `"${cfg.from_name}" <${cfg.smtp_user}>` : cfg.smtp_user,
      to, subject, text: body
    };

    if (attachResume) {
      const profileResult = await pool.query('SELECT resume_path, resume_data, resume_mimetype FROM profile WHERE id=1');
      const profile = profileResult.rows[0];
      if (profile && profile.resume_data) {
        mailOpts.attachments = [{
          filename: profile.resume_path || 'resume.pdf',
          content: Buffer.from(profile.resume_data, 'base64'),
          contentType: profile.resume_mimetype || 'application/pdf'
        }];
      }
    }

    await transporter.sendMail(mailOpts);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
