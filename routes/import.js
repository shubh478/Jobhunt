const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../db/pool');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Lazy-load pdf-parse so a missing/broken install doesn't crash the whole server
function loadPdfParse() {
  try { return require('pdf-parse'); } catch (e) { return null; }
}

// Extract structured fields from raw resume text
function extractFromResume(text) {
  const out = { email: '', phone: '', linkedin_url: '', github_url: '', skills: [], years: '', current_role: '', summary: '' };

  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) out.email = emailMatch[0];

  const phoneMatch = text.match(/(\+?\d{1,3}[\s.-]?)?\(?\d{3,5}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/);
  if (phoneMatch) out.phone = phoneMatch[0].trim();

  const liMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9-_%]+/i);
  if (liMatch) out.linkedin_url = (liMatch[0].startsWith('http') ? liMatch[0] : 'https://' + liMatch[0]);

  const ghMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9-_]+/i);
  if (ghMatch) out.github_url = (ghMatch[0].startsWith('http') ? ghMatch[0] : 'https://' + ghMatch[0]);

  // Years of experience — look for "X years", "X+ years"
  const yrsMatch = text.match(/(\d{1,2})\+?\s*(?:years|yrs)\s*(?:of\s*)?(?:experience|exp)?/i);
  if (yrsMatch) out.years = yrsMatch[1];

  // Common technical skill keywords — pulled from job market frequency
  const SKILL_VOCAB = [
    'javascript','typescript','python','java','c++','c#','go','golang','rust','ruby','php','kotlin','swift','scala',
    'react','angular','vue','svelte','next.js','nextjs','nuxt','remix',
    'node.js','nodejs','express','nestjs','fastify','spring','spring boot','django','flask','fastapi','rails','laravel',
    'postgres','postgresql','mysql','mongodb','redis','elasticsearch','dynamodb','cassandra','sqlite','snowflake','bigquery',
    'aws','gcp','azure','docker','kubernetes','k8s','terraform','ansible','jenkins','github actions','gitlab ci','circleci',
    'graphql','rest','grpc','kafka','rabbitmq','websocket',
    'tensorflow','pytorch','pandas','numpy','scikit-learn','sklearn','keras','huggingface','llm','rag',
    'tailwind','sass','webpack','vite','rollup',
    'jest','mocha','cypress','playwright','selenium','junit','pytest',
    'agile','scrum','tdd','ci/cd','microservices','rest api','soa','event-driven'
  ];
  const lower = text.toLowerCase();
  const found = new Set();
  SKILL_VOCAB.forEach(s => {
    const re = new RegExp('\\b' + s.replace(/[.+]/g, '\\$&') + '\\b', 'i');
    if (re.test(lower)) found.add(s);
  });
  out.skills = [...found];

  // Current role — grab the first line that looks like a job title near the top
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean).slice(0, 25);
  const titleRe = /(software engineer|developer|sde|senior|staff|principal|architect|lead|manager|analyst|consultant|designer|scientist)/i;
  for (const l of lines) {
    if (l.length < 80 && titleRe.test(l) && !/[@:]/.test(l)) { out.current_role = l; break; }
  }

  // Summary — first paragraph after "Summary" / "Profile" / "About"
  const summaryMatch = text.match(/(?:summary|profile|about)\s*[:\n]+([\s\S]{30,400}?)(?:\n\n|\n[A-Z][A-Z]+|$)/i);
  if (summaryMatch) out.summary = summaryMatch[1].trim().replace(/\s+/g, ' ').slice(0, 400);

  return out;
}

// POST /api/import/resume — upload PDF, parse, return suggested fields (do NOT save automatically)
router.post('/import/resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const pdfParse = loadPdfParse();
    if (!pdfParse) return res.status(500).json({ error: 'PDF parser not installed (pdf-parse missing)' });

    let text = '';
    try {
      const parsed = await pdfParse(req.file.buffer);
      text = parsed.text || '';
    } catch (e) {
      return res.status(400).json({ error: 'Could not parse PDF: ' + e.message });
    }

    if (text.length < 50) return res.status(400).json({ error: 'Resume seems empty or unparseable. Try a text-based PDF (not a scan).' });

    const extracted = extractFromResume(text);

    // Save raw text + the file to profile
    const base64 = req.file.buffer.toString('base64');
    await pool.query(
      `UPDATE profile
       SET resume_path=$1, resume_data=$2, resume_mimetype=$3, resume_text=$4
       WHERE user_id=$5`,
      [req.file.originalname, base64, req.file.mimetype || 'application/pdf', text.slice(0, 50000), req.userId]
    );

    res.json({
      ok: true,
      filename: req.file.originalname,
      extracted: {
        ...extracted,
        skills: extracted.skills.join(', ')
      },
      preview: text.slice(0, 500)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/github — fetch top languages and recent repos for a username
router.post('/import/github', async (req, res) => {
  try {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: 'GitHub username required' });

    const headers = { 'User-Agent': 'JobHuntPro', 'Accept': 'application/vnd.github+json' };
    if (process.env.GITHUB_TOKEN) headers['Authorization'] = 'Bearer ' + process.env.GITHUB_TOKEN;

    const userResp = await fetch('https://api.github.com/users/' + encodeURIComponent(username), { headers });
    if (!userResp.ok) {
      const body = await userResp.text();
      return res.status(userResp.status).json({ error: 'GitHub: ' + body.slice(0, 200) });
    }
    const user = await userResp.json();

    const reposResp = await fetch('https://api.github.com/users/' + encodeURIComponent(username) + '/repos?per_page=100&sort=pushed', { headers });
    const repos = reposResp.ok ? await reposResp.json() : [];

    const langCounts = {};
    let totalStars = 0;
    repos.forEach(r => {
      if (r.fork) return;
      if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
      totalStars += r.stargazers_count || 0;
    });

    const topLanguages = Object.entries(langCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k);
    const topRepos = repos
      .filter(r => !r.fork)
      .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
      .slice(0, 5)
      .map(r => ({ name: r.name, description: r.description, stars: r.stargazers_count, language: r.language, url: r.html_url }));

    const extracted = {
      github_url: user.html_url,
      full_name: user.name || '',
      summary: user.bio || '',
      skills: topLanguages.join(', '),
      stats: { public_repos: user.public_repos, followers: user.followers, total_stars: totalStars, top_repos: topRepos }
    };

    res.json({ ok: true, extracted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/linkedin — accept LinkedIn data export ZIP, parse Profile.csv + Skills.csv
router.post('/import/linkedin', upload.single('zip'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    let AdmZip;
    try { AdmZip = require('adm-zip'); }
    catch { return res.status(500).json({ error: 'ZIP parser not installed. Run: npm install adm-zip' }); }

    let zip;
    try { zip = new AdmZip(req.file.buffer); }
    catch (e) { return res.status(400).json({ error: 'Not a valid ZIP file: ' + e.message }); }

    const entries = zip.getEntries();
    const findCsv = (name) => entries.find(e => e.entryName.toLowerCase().endsWith(name.toLowerCase()));

    const parseCSV = (text) => {
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) return [];
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      return lines.slice(1).map(line => {
        // Simple CSV split that handles quoted fields
        const cells = [];
        let cur = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQ = !inQ; continue; }
          if (ch === ',' && !inQ) { cells.push(cur); cur = ''; continue; }
          cur += ch;
        }
        cells.push(cur);
        const row = {};
        headers.forEach((h, i) => row[h] = (cells[i] || '').trim());
        return row;
      });
    };

    const extracted = {};

    const profileEntry = findCsv('Profile.csv');
    if (profileEntry) {
      const rows = parseCSV(profileEntry.getData().toString('utf8'));
      const p = rows[0] || {};
      extracted.full_name = ((p['First Name'] || '') + ' ' + (p['Last Name'] || '')).trim();
      extracted.summary = p['Summary'] || p['Headline'] || '';
      extracted.current_role = p['Headline'] || '';
    }

    const skillsEntry = findCsv('Skills.csv');
    if (skillsEntry) {
      const rows = parseCSV(skillsEntry.getData().toString('utf8'));
      extracted.skills = rows.map(r => r['Name'] || r['Skill'] || '').filter(Boolean).slice(0, 30).join(', ');
    }

    const positionsEntry = findCsv('Positions.csv');
    if (positionsEntry) {
      const rows = parseCSV(positionsEntry.getData().toString('utf8'));
      if (rows.length > 0) {
        const latest = rows[0];
        if (!extracted.current_role) extracted.current_role = latest['Title'] || '';
        // Estimate years from earliest start date
        const dates = rows.map(r => r['Started On'] || r['Start Date'] || '').filter(Boolean);
        if (dates.length) {
          const earliest = dates.sort()[0];
          const year = parseInt((earliest.match(/\d{4}/) || [])[0]);
          if (year) extracted.years = String(new Date().getFullYear() - year);
        }
      }
    }

    if (!Object.keys(extracted).length) {
      return res.status(400).json({ error: 'No recognizable LinkedIn CSVs found in ZIP. Make sure you uploaded the LinkedIn Data Export ZIP.' });
    }

    res.json({ ok: true, extracted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
