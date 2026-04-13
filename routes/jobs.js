const express = require('express');
const router = express.Router();

// Domains we consider 'aggregators' — we want to escape them and reach the real company page.
const AGGREGATOR_HOSTS = [
  'adzuna.com', 'adzuna.in', 'adzuna.co.uk',
  'jsearch.', 'rapidapi.com',
  'jobicy.com',
  'remoteok.com', 'remoteok.io',
  'remotive.com', 'remotive.io',
  'indeed.com', 'in.indeed.com',
  'glassdoor.com', 'glassdoor.co.in',
  'naukri.com',
  'google.com/url', 'google.com/search',
  'linkedin.com/comm', // tracking redirects
  'click.appcast', 'click.indeed',
  'jobs.google.com',
  'simplyhired.com', 'monster.com'
];

// Hosts that ARE the company's ATS — these are the "good" final destinations.
const ATS_HOSTS = [
  'greenhouse.io', 'boards.greenhouse.io',
  'lever.co', 'jobs.lever.co',
  'ashbyhq.com', 'jobs.ashbyhq.com',
  'workday.com', 'myworkdayjobs.com', 'wd1.myworkdayjobs.com', 'wd5.myworkdayjobs.com',
  'workable.com',
  'smartrecruiters.com',
  'bamboohr.com',
  'jazz.co',
  'recruitee.com',
  'teamtailor.com',
  'icims.com',
  'taleo.net',
  'successfactors.com',
  'cornerstoneondemand.com',
  'oraclecloud.com',
  'breezy.hr',
  'jobvite.com',
  'eightfold.ai'
];

function isAggregator(url) {
  if (!url) return true;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return AGGREGATOR_HOSTS.some(h => host.includes(h));
  } catch { return true; }
}

function isATS(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return ATS_HOSTS.some(h => host.includes(h));
  } catch { return false; }
}

// Walk HTTP redirects manually (max 6 hops) so we get every intermediate URL.
// We use HEAD where possible; fall back to GET for hosts that 405 on HEAD.
async function followRedirects(startUrl, maxHops = 6) {
  let url = startUrl;
  const chain = [url];
  for (let i = 0; i < maxHops; i++) {
    let resp;
    try {
      resp = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          'Accept': 'text/html'
        },
        signal: AbortSignal.timeout(5000)
      });
    } catch (e) {
      // Some servers reject HEAD — retry as GET (don't read body)
      try {
        resp = await fetch(url, {
          method: 'GET',
          redirect: 'manual',
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36' },
          signal: AbortSignal.timeout(5000)
        });
      } catch (e2) {
        return { final: url, chain, error: e2.message };
      }
    }

    const status = resp.status;
    const loc = resp.headers.get('location');

    if (status >= 300 && status < 400 && loc) {
      // Resolve relative location against current URL
      try { url = new URL(loc, url).toString(); }
      catch { url = loc; }
      chain.push(url);
      // If we've already escaped to a non-aggregator + ATS host, stop early
      if (isATS(url)) return { final: url, chain };
    } else {
      return { final: url, chain };
    }
  }
  return { final: url, chain };
}

// POST /api/jobs/resolve-url — body: { url }
// Returns: { finalUrl, isCompanyPage, isATS, hops, escaped }
router.post('/jobs/resolve-url', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url required' });
    if (!/^https?:\/\//.test(url)) return res.status(400).json({ error: 'must be http(s) url' });

    const startedAggregator = isAggregator(url);
    const result = await followRedirects(url, 6);
    const finalIsAggregator = isAggregator(result.final);
    const finalIsATS = isATS(result.final);

    res.json({
      finalUrl: result.final,
      isATS: finalIsATS,
      escaped: startedAggregator && !finalIsAggregator,
      stillAggregator: finalIsAggregator,
      hops: result.chain.length - 1,
      chain: result.chain
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
