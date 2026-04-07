const express = require('express');
const router = express.Router();

// Multi-source job search
router.get('/auto/search-jobs', async (req, res) => {
  const { keywords, location, limit: maxResults } = req.query;
  if (!keywords) return res.status(400).json({ error: 'Keywords required' });

  const results = [];
  const errors = [];
  const jobLimit = parseInt(maxResults) || 50;

  // Source 1: Remotive (free, no API key)
  try {
    const remRes = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(keywords)}&limit=${Math.min(jobLimit, 50)}`);
    const remData = await remRes.json();
    (remData.jobs || []).forEach(j => {
      results.push({
        title: j.title,
        company: j.company_name,
        location: j.candidate_required_location || 'Remote',
        salary: j.salary || '',
        url: j.url,
        source: 'Remotive',
        tags: (j.tags || []).slice(0, 5),
        posted: j.publication_date || '',
        description: (j.description || '').replace(/<[^>]*>/g, '').substring(0, 300)
      });
    });
  } catch (e) { errors.push('Remotive: ' + e.message); }

  // Source 2: Adzuna
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_API_KEY) {
    try {
      const country = (location || '').toLowerCase().includes('india') ? 'in' : 'gb';
      const adzRes = await fetch(`https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${process.env.ADZUNA_APP_ID}&app_key=${process.env.ADZUNA_API_KEY}&what=${encodeURIComponent(keywords)}&results_per_page=${Math.min(jobLimit, 50)}`);
      const adzData = await adzRes.json();
      (adzData.results || []).forEach(j => {
        results.push({
          title: j.title,
          company: j.company?.display_name || 'Unknown',
          location: j.location?.display_name || '',
          salary: j.salary_min ? `${Math.round(j.salary_min)}-${Math.round(j.salary_max || j.salary_min)}` : '',
          url: j.redirect_url,
          source: 'Adzuna',
          tags: [j.category?.label].filter(Boolean),
          posted: j.created || '',
          description: (j.description || '').substring(0, 300)
        });
      });
    } catch (e) { errors.push('Adzuna: ' + e.message); }
  }

  // Source 3: JSearch via RapidAPI
  if (process.env.RAPIDAPI_KEY) {
    try {
      const jsRes = await fetch(`https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(keywords + (location ? ' in ' + location : ''))}&num_pages=1`, {
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
        }
      });
      const jsData = await jsRes.json();
      (jsData.data || []).forEach(j => {
        results.push({
          title: j.job_title,
          company: j.employer_name,
          location: j.job_city ? `${j.job_city}, ${j.job_country}` : j.job_country || 'Remote',
          salary: j.job_min_salary ? `${j.job_min_salary}-${j.job_max_salary}` : '',
          url: j.job_apply_link || j.job_google_link,
          source: 'JSearch',
          tags: [j.job_employment_type].filter(Boolean),
          posted: j.job_posted_at_datetime_utc || '',
          description: (j.job_description || '').substring(0, 300)
        });
      });
    } catch (e) { errors.push('JSearch: ' + e.message); }
  }

  res.json({ jobs: results.slice(0, jobLimit), total: results.length, errors, sources: { remotive: true, adzuna: !!process.env.ADZUNA_APP_ID, jsearch: !!process.env.RAPIDAPI_KEY } });
});

module.exports = router;
