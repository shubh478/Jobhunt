const express = require('express');
const router = express.Router();
const { GREENHOUSE, LEVER, ASHBY } = require('../lib/ats-companies');

// Helper: fetch with timeout so one slow ATS doesn't block the whole search
function fetchWithTimeout(url, options = {}, ms = 4000) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(ms) });
}

// Tokenize a keyword string into lowercase terms for substring matching
function kwTokens(keywords) {
  return (keywords || '').toLowerCase().split(/[\s,]+/).filter(t => t.length > 2);
}

// Check if a job title or description matches the keyword tokens
function jobMatchesKeywords(title, desc, tokens) {
  if (!tokens.length) return true;
  const hay = ((title || '') + ' ' + (desc || '')).toLowerCase();
  return tokens.some(t => hay.includes(t));
}

// Check if a job's location string matches the location filter
function jobMatchesLocation(jobLoc, locFilter) {
  if (!locFilter) return true;
  const lf = locFilter.toLowerCase();
  const loc = (jobLoc || '').toLowerCase();
  // Remote jobs are always OK; otherwise require location substring match
  return /remote|anywhere|worldwide/.test(loc) || loc.includes(lf);
}

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
            description: (j.description || '').replace(/<[^>]*>/g, '').substring(0, 1500)
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
              description: (j.description || '').substring(0, 1500)
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
              description: (j.job_description || '').substring(0, 1500)
            });
          });
        })
        .catch(e => errors.push('JSearch: ' + e.message))
    );
  }

  // Source 4: RemoteOK removed — their public API started returning 403 to
  // cloud provider IPs (Render included) in early 2026. Kept the slot so
  // the sources array numbering doesn't drift in git history.

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
            description: (j.jobDescription || '').replace(/<[^>]*>/g, '').substring(0, 1500)
          });
        });
      })
      .catch(e => errors.push('Jobicy: ' + e.message))
  );

  // Source 6: Greenhouse public Job Board API — direct company listings, no aggregator
  const kwToks = kwTokens(keywords);
  GREENHOUSE.forEach(slug => {
    fetches.push(
      fetchWithTimeout(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`, {}, 4500)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data || !data.jobs) return;
          data.jobs.forEach(j => {
            const title = j.title || '';
            const jobLoc = (j.location && j.location.name) || 'Remote';
            const plainDesc = (j.content || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
            if (!jobMatchesKeywords(title, plainDesc, kwToks)) return;
            if (!jobMatchesLocation(jobLoc, location)) return;
            results.push({
              title,
              company: (j.company_name || slug).replace(/\b\w/g, c => c.toUpperCase()),
              location: jobLoc,
              salary: '',
              url: j.absolute_url,
              source: 'Greenhouse',
              tags: (j.departments || []).map(d => d.name).filter(Boolean).slice(0, 3),
              posted: j.updated_at || '',
              description: plainDesc.substring(0, 1500)
            });
          });
        })
        .catch(e => { /* single company failure is fine; don't pollute errors array */ })
    );
  });

  // Source 7: Lever public Postings API — direct company listings
  LEVER.forEach(slug => {
    fetches.push(
      fetchWithTimeout(`https://api.lever.co/v0/postings/${slug}?mode=json`, {}, 4500)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!Array.isArray(data)) return;
          data.forEach(j => {
            const title = j.text || '';
            const jobLoc = (j.categories && j.categories.location) || 'Remote';
            const plainDesc = ((j.descriptionPlain || j.description || '') + ' ' +
                               (Array.isArray(j.lists) ? j.lists.map(l => l.text + ' ' + l.content).join(' ') : ''))
                               .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            if (!jobMatchesKeywords(title, plainDesc, kwToks)) return;
            if (!jobMatchesLocation(jobLoc, location)) return;
            results.push({
              title,
              company: slug.replace(/\b\w/g, c => c.toUpperCase()),
              location: jobLoc,
              salary: '',
              url: j.hostedUrl || j.applyUrl || '',
              source: 'Lever',
              tags: [(j.categories && j.categories.team) || '', (j.categories && j.categories.commitment) || ''].filter(Boolean),
              posted: j.createdAt ? new Date(j.createdAt).toISOString() : '',
              description: plainDesc.substring(0, 1500)
            });
          });
        })
        .catch(e => { /* ignore per-company */ })
    );
  });

  // Source 8: Ashby public job board API
  ASHBY.forEach(slug => {
    fetches.push(
      fetchWithTimeout(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`, {}, 4500)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data || !data.jobs) return;
          data.jobs.forEach(j => {
            const title = j.title || '';
            const jobLoc = j.location || j.address?.postalAddress?.addressLocality || 'Remote';
            const plainDesc = ((j.descriptionPlain || '') + ' ' + (j.descriptionHtml || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
            if (!jobMatchesKeywords(title, plainDesc, kwToks)) return;
            if (!jobMatchesLocation(jobLoc, location)) return;
            results.push({
              title,
              company: (data.apiVersion && data.jobs[0]?.organizationId ? slug : slug).replace(/\b\w/g, c => c.toUpperCase()),
              location: jobLoc,
              salary: j.compensationTierSummary || '',
              url: j.jobUrl || j.applyUrl || '',
              source: 'Ashby',
              tags: [j.employmentType, j.team].filter(Boolean),
              posted: j.publishedAt || '',
              description: plainDesc.substring(0, 1500)
            });
          });
        })
        .catch(e => { /* ignore per-company */ })
    );
  });

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
      jobicy: true,
      greenhouse: true,
      lever: true,
      ashby: true
    }
  });
});

module.exports = router;
