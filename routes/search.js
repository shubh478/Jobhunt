const express = require('express');
const router = express.Router();

// Multi-source job search (5 sources)
router.get('/auto/search-jobs', async (req, res) => {
  const { keywords, location, limit: maxResults } = req.query;
  if (!keywords) return res.status(400).json({ error: 'Keywords required' });

  const results = [];
  const errors = [];
  const jobLimit = parseInt(maxResults) || 100;
  const isIndia = !(location || '').toLowerCase().match(/\b(us|usa|uk|europe|canada|australia|germany)\b/);

  // Run all sources in parallel for speed
  const fetches = [];

  // Source 1: Remotive (free, no API key)
  fetches.push(
    fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(keywords)}&limit=${Math.min(jobLimit, 50)}`)
      .then(r => r.json())
      .then(remData => {
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
      })
      .catch(e => errors.push('Remotive: ' + e.message))
  );

  // Source 2: Adzuna (India by default)
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_API_KEY) {
    const country = isIndia ? 'in' : 'gb';
    const locationParam = location ? `&where=${encodeURIComponent(location)}` : '';
    fetches.push(
      fetch(`https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${process.env.ADZUNA_APP_ID}&app_key=${process.env.ADZUNA_API_KEY}&what=${encodeURIComponent(keywords)}&results_per_page=${Math.min(jobLimit, 50)}&sort_by=date&max_days_old=7${locationParam}`)
        .then(r => r.json())
        .then(adzData => {
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
        })
        .catch(e => errors.push('Adzuna: ' + e.message))
    );
  }

  // Source 3: JSearch via RapidAPI (pulls from Google Jobs = LinkedIn + Naukri + Indeed)
  if (process.env.RAPIDAPI_KEY) {
    const query = keywords + (location ? ' in ' + location : isIndia ? ' in India' : '');
    fetches.push(
      fetch(`https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&num_pages=1&date_posted=week&country=${isIndia ? 'in' : 'us'}`, {
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
        }
      })
        .then(r => r.json())
        .then(jsData => {
          (jsData.data || []).forEach(j => {
            results.push({
              title: j.job_title,
              company: j.employer_name,
              location: j.job_city ? `${j.job_city}, ${j.job_state || j.job_country}` : j.job_country || 'Remote',
              salary: j.job_min_salary ? `${j.job_min_salary}-${j.job_max_salary}` : '',
              url: j.job_apply_link || j.job_google_link,
              source: 'JSearch',
              tags: [j.job_employment_type, j.employer_name].filter(Boolean),
              posted: j.job_posted_at_datetime_utc || '',
              description: (j.job_description || '').substring(0, 300)
            });
          });
        })
        .catch(e => errors.push('JSearch: ' + e.message))
    );
  }

  // Source 4: RemoteOK (free, no API key)
  fetches.push(
    fetch('https://remoteok.com/api', {
      headers: { 'User-Agent': 'JobHuntPro/1.0' }
    })
      .then(r => r.json())
      .then(data => {
        // First element is metadata, skip it
        const jobs = Array.isArray(data) ? data.slice(1) : [];
        const kwLower = keywords.toLowerCase();
        jobs
          .filter(j => j.position && (
            j.position.toLowerCase().includes(kwLower) ||
            (j.tags || []).some(t => t.toLowerCase().includes(kwLower)) ||
            (j.description || '').toLowerCase().includes(kwLower)
          ))
          .slice(0, 30)
          .forEach(j => {
            results.push({
              title: j.position,
              company: j.company || 'Unknown',
              location: j.location || 'Remote',
              salary: j.salary || '',
              url: j.url || `https://remoteok.com/l/${j.id}`,
              source: 'RemoteOK',
              tags: (j.tags || []).slice(0, 5),
              posted: j.date || '',
              description: (j.description || '').replace(/<[^>]*>/g, '').substring(0, 300)
            });
          });
      })
      .catch(e => errors.push('RemoteOK: ' + e.message))
  );

  // Source 5: Jobicy (free, no API key)
  fetches.push(
    fetch(`https://jobicy.com/api/v2/remote-jobs?count=20&tag=${encodeURIComponent(keywords)}`)
      .then(r => r.json())
      .then(data => {
        (data.jobs || []).forEach(j => {
          results.push({
            title: j.jobTitle || j.title || '',
            company: j.companyName || 'Unknown',
            location: j.jobGeo || 'Remote',
            salary: j.annualSalaryMin ? `${j.annualSalaryMin}-${j.annualSalaryMax || ''}` : '',
            url: j.url || '',
            source: 'Jobicy',
            tags: [j.jobIndustry, j.jobType].filter(Boolean),
            posted: j.pubDate || '',
            description: (j.jobDescription || '').replace(/<[^>]*>/g, '').substring(0, 300)
          });
        });
      })
      .catch(e => errors.push('Jobicy: ' + e.message))
  );

  // Wait for all sources in parallel
  await Promise.allSettled(fetches);

  // Deduplicate by company+title (case insensitive)
  const seen = new Set();
  const deduped = results.filter(j => {
    const key = `${(j.company || '').toLowerCase().trim()}|${(j.title || '').toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  res.json({
    jobs: deduped.slice(0, jobLimit),
    total: deduped.length,
    totalBeforeDedup: results.length,
    errors,
    sources: {
      remotive: true,
      adzuna: !!process.env.ADZUNA_APP_ID,
      jsearch: !!process.env.RAPIDAPI_KEY,
      remoteok: true,
      jobicy: true
    }
  });
});

module.exports = router;
