// ============================== STATE ==============================
var allApps = [];
var allPrep = [];
var allTemplates = [];
var currentFilter = 'ALL';
var generatedSubject = '';
var generatedBody = '';
var selectedAppIds = new Set();

// ============================== TABS ==============================
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelector('.nav-btn[onclick*="' + name + '"]').classList.add('active');
  if (name === 'dashboard') loadDashboard();
  if (name === 'analytics') loadAnalytics();
  if (name === 'automation') loadAutomation();
  if (name === 'applications') loadApplications();
  if (name === 'prep') loadPrep();
  if (name === 'quickapply') loadQuickApply();
  if (name === 'settings') loadSettings();
  if (name === 'search') initSearch();
  if (name === 'study') loadStudyTopics();
}

// ============================== UTILS ==============================
function toast(msg, isError) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(function() { t.className = 'toast'; }, 2500);
}

async function api(url, method, body) {
  method = method || 'GET';
  var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  try {
    var res = await fetch(url, opts);
    var text = await res.text();
    var data;
    try { data = JSON.parse(text); } catch (e) {
      console.error('Invalid JSON from', url, ':', text.substring(0, 200));
      toast('Server error — please try again', true);
      throw new Error('Invalid response from server');
    }
    if (data.error && !res.ok) { toast(data.error, true); throw new Error(data.error); }
    return data;
  } catch (e) {
    if (e.message === 'Invalid response from server') throw e;
    if (e.message && e.message.includes('Failed to fetch')) {
      toast('Cannot reach server — check your connection', true);
    }
    throw e;
  }
}

function esc(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(function(el) {
  el.addEventListener('click', function(e) { if (e.target === el) el.classList.remove('open'); });
});

function showConfirm(title, msg, onOk) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  var btn = document.getElementById('confirm-ok-btn');
  var newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', function() { closeModal('confirm-modal'); onOk(); });
  document.getElementById('confirm-modal').classList.add('open');
}

function setLoading(elId, loading) {
  var el = document.getElementById(elId);
  if (!el) return;
  if (loading) {
    el.disabled = true;
    el.dataset.origText = el.textContent;
    el.innerHTML = '<span class="spinner"></span>Loading...';
  } else {
    el.disabled = false;
    el.textContent = el.dataset.origText || 'Done';
  }
}

// ============================== DASHBOARD ==============================
async function loadDashboard() {
  var data;
  try {
    data = await Promise.all([api('/api/stats'), api('/api/applications'), api('/api/daily-log')]);
  } catch (e) {
    document.getElementById('stats-grid').innerHTML = '<div class="stat-card" style="grid-column:1/-1"><div class="label">Could not load dashboard — database may be connecting. Try refreshing in a few seconds.</div></div>';
    return;
  }
  var stats = data[0];
  allApps = data[1] || [];
  var logs = data[2] || [];

  var banner = document.getElementById('followup-banner');
  if (stats.followUps && stats.followUps.length > 0) {
    banner.innerHTML = '<div class="alert-banner"><h3>Follow-up Reminders (' + stats.followUps.length + ')</h3>' +
      stats.followUps.map(function(a) {
        return '<div class="alert-item">' + esc(a.company) + ' - ' + esc(a.role) + ' (follow up: ' + a.follow_up_date + ')</div>';
      }).join('') + '</div>';
  } else {
    banner.innerHTML = '';
  }

  var byStatus = {};
  stats.applicationsByStatus.forEach(function(s) { byStatus[s.status] = parseInt(s.count); });
  var prepDone = stats.prepByStatus.find(function(p) { return p.status === 'DONE'; });
  var prepTotal = stats.prepByStatus.reduce(function(a, p) { return a + parseInt(p.count); }, 0);
  var active = (byStatus['APPLIED'] || 0) + (byStatus['SCREENING'] || 0) + (byStatus['INTERVIEW'] || 0);

  var cards = [
    { num: stats.totalApplications, label: 'Total Apps', color: '#3b82f6' },
    { num: active, label: 'Active', color: '#a78bfa' },
    { num: byStatus['INTERVIEW'] || 0, label: 'Interviews', color: '#22c55e' },
    { num: byStatus['OFFER'] || 0, label: 'Offers', color: '#84cc16' },
    { num: byStatus['REJECTED'] || 0, label: 'Rejected', color: '#f87171' },
    { num: (prepDone ? parseInt(prepDone.count) : 0) + '/' + prepTotal, label: 'Prep Done', color: '#fbbf24' },
  ];

  document.getElementById('stats-grid').innerHTML = cards.map(function(c) {
    return '<div class="stat-card"><div class="num" style="color:' + c.color + '">' + c.num + '</div><div class="label">' + c.label + '</div></div>';
  }).join('');

  var today = new Date().toISOString().split('T')[0];
  document.getElementById('daily-log-date').textContent = today;
  var todayLog = logs.find(function(l) { return l.date === today; });
  document.getElementById('dl-apps').value = todayLog ? todayLog.applications_sent : 0;
  document.getElementById('dl-problems').value = todayLog ? todayLog.problems_solved : 0;
  document.getElementById('dl-notes').value = todayLog ? todayLog.notes || '' : '';

  var recent = allApps.slice(0, 10);
  document.getElementById('recent-table').innerHTML = recent.length === 0
    ? '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:32px">No applications yet. Click "+ Add Application" to start!</td></tr>'
    : recent.map(function(a) {
      return '<tr><td><strong>' + esc(a.company) + '</strong></td><td>' + esc(a.role) + '</td>' +
        '<td><span class="badge badge-' + a.status + '">' + a.status + '</span></td>' +
        '<td>' + esc(a.platform) + '</td><td>' + esc(a.applied_date) + '</td>' +
        '<td><button class="btn btn-sm btn-ghost" onclick="editApp(' + a.id + ')">Edit</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="deleteApp(' + a.id + ')">Del</button></td></tr>';
    }).join('');
}

async function saveDailyLog() {
  var today = new Date().toISOString().split('T')[0];
  await api('/api/daily-log', 'POST', {
    date: today,
    applications_sent: parseInt(document.getElementById('dl-apps').value) || 0,
    problems_solved: parseInt(document.getElementById('dl-problems').value) || 0,
    notes: document.getElementById('dl-notes').value.trim()
  });
  toast('Daily log saved!');
}

// ============================== ANALYTICS ==============================
async function loadAnalytics() {
  var data;
  try { data = await Promise.all([api('/api/stats'), api('/api/daily-log')]); } catch (e) { return; }
  var stats = data[0];
  var logs = data[1] || [];

  var byStatus = {};
  stats.applicationsByStatus.forEach(function(s) { byStatus[s.status] = parseInt(s.count); });

  document.getElementById('analytics-stats').innerHTML = [
    { num: stats.totalApplications, label: 'Total Applications', color: '#3b82f6' },
    { num: stats.responseRate + '%', label: 'Response Rate', color: '#22c55e' },
    { num: stats.avgResponseDays !== null ? stats.avgResponseDays + 'd' : 'N/A', label: 'Avg Response Time', color: '#fbbf24' },
    { num: byStatus['GHOSTED'] || 0, label: 'Ghosted', color: '#a1a1aa' },
  ].map(function(c) {
    return '<div class="stat-card"><div class="num" style="color:' + c.color + '">' + c.num + '</div><div class="label">' + c.label + '</div></div>';
  }).join('');

  var funnelData = [
    { label: 'Applied', count: (byStatus['APPLIED'] || 0) + (byStatus['SCREENING'] || 0) + (byStatus['INTERVIEW'] || 0) + (byStatus['OFFER'] || 0) + (byStatus['REJECTED'] || 0) + (byStatus['GHOSTED'] || 0), color: '#3b82f6' },
    { label: 'Screening', count: (byStatus['SCREENING'] || 0) + (byStatus['INTERVIEW'] || 0) + (byStatus['OFFER'] || 0), color: '#a78bfa' },
    { label: 'Interview', count: (byStatus['INTERVIEW'] || 0) + (byStatus['OFFER'] || 0), color: '#22c55e' },
    { label: 'Offer', count: byStatus['OFFER'] || 0, color: '#84cc16' },
  ];
  var maxFunnel = Math.max(funnelData[0].count, 1);
  document.getElementById('funnel-chart').innerHTML = funnelData.map(function(f) {
    var pct = Math.max(Math.round(f.count / maxFunnel * 100), 8);
    return '<div class="funnel-row"><span class="funnel-label">' + f.label + '</span>' +
      '<div class="funnel-bar" style="width:' + pct + '%;background:' + f.color + '">' + f.count + '</div></div>';
  }).join('');

  var rejected = byStatus['REJECTED'] || 0;
  var ghosted = byStatus['GHOSTED'] || 0;
  var total = stats.totalApplications || 1;
  document.getElementById('key-metrics').innerHTML =
    '<div style="display:flex;flex-direction:column;gap:14px;padding:8px 0">' +
    '<div><span style="font-size:24px;font-weight:700;color:#3b82f6">' + stats.responseRate + '%</span><div style="font-size:12px;color:#94a3b8">Response Rate (moved past Applied)</div></div>' +
    '<div><span style="font-size:24px;font-weight:700;color:#f87171">' + Math.round((rejected + ghosted) / total * 100) + '%</span><div style="font-size:12px;color:#94a3b8">Rejection + Ghost Rate</div></div>' +
    '<div><span style="font-size:24px;font-weight:700;color:#fbbf24">' + (stats.avgResponseDays !== null ? stats.avgResponseDays + ' days' : 'N/A') + '</span><div style="font-size:12px;color:#94a3b8">Avg Time to Response</div></div>' +
    '</div>';

  var trend = stats.dailyTrend || [];
  if (trend.length > 0) {
    var maxCount = Math.max.apply(null, trend.map(function(d) { return parseInt(d.count); }));
    document.getElementById('daily-chart').innerHTML = trend.map(function(d) {
      var h = Math.max(Math.round(parseInt(d.count) / Math.max(maxCount, 1) * 100), 4);
      var dateLabel = d.date ? d.date.substring(5) : '';
      return '<div class="bar-col"><span class="bar-value">' + d.count + '</span><div class="bar" style="height:' + h + 'px"></div><span class="bar-label">' + dateLabel + '</span></div>';
    }).join('');
  } else {
    document.getElementById('daily-chart').innerHTML = '<div style="text-align:center;color:#64748b;width:100%;padding:30px">No application data yet. Start applying to see trends!</div>';
  }

  document.getElementById('log-history-table').innerHTML = logs.length === 0
    ? '<tr><td colspan="4" style="text-align:center;color:#64748b;padding:20px">No daily logs yet</td></tr>'
    : logs.map(function(l) {
      return '<tr><td>' + esc(l.date) + '</td><td>' + l.applications_sent + '</td><td>' + l.problems_solved + '</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(l.notes) + '</td></tr>';
    }).join('');
}

// ============================== APPLICATIONS ==============================
async function loadApplications() {
  try { allApps = await api('/api/applications'); } catch (e) { allApps = []; }
  selectedAppIds.clear();
  updateBulkBar();
  renderFilters();
  renderAppsTable();
}

function renderFilters() {
  var statuses = ['ALL', 'WISHLIST', 'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTED', 'GHOSTED'];
  document.getElementById('status-filters').innerHTML = statuses.map(function(s) {
    return '<button class="chip' + (currentFilter === s ? ' active' : '') + '" onclick="setFilter(\'' + s + '\')">' + s + '</button>';
  }).join('');
}

function setFilter(s) { currentFilter = s; renderFilters(); renderAppsTable(); }

function getFilteredApps() {
  var filtered = currentFilter === 'ALL' ? allApps : allApps.filter(function(a) { return a.status === currentFilter; });
  var search = (document.getElementById('app-search') ? document.getElementById('app-search').value : '').toLowerCase().trim();
  if (search) {
    filtered = filtered.filter(function(a) {
      return (a.company || '').toLowerCase().includes(search) || (a.role || '').toLowerCase().includes(search);
    });
  }
  return filtered;
}

function renderAppsTable() {
  var filtered = getFilteredApps();
  var selectAll = document.getElementById('select-all-apps');
  if (selectAll) selectAll.checked = false;

  document.getElementById('apps-table').innerHTML = filtered.length === 0
    ? '<tr><td colspan="11" style="text-align:center;color:#64748b;padding:32px">No applications found</td></tr>'
    : filtered.map(function(a) {
      var checked = selectedAppIds.has(a.id) ? ' checked' : '';
      var scoreBadge = a.match_score !== null && a.match_score !== undefined
        ? '<span class="badge" style="background:' + (a.match_score >= 70 ? '#14532d' : a.match_score >= 40 ? '#422006' : '#450a0a') +
          ';color:' + (a.match_score >= 70 ? '#4ade80' : a.match_score >= 40 ? '#fbbf24' : '#f87171') + '">' + a.match_score + '%</span>'
        : '<span style="color:#64748b;font-size:11px">--</span>';
      return '<tr><td><input type="checkbox" class="app-checkbox" value="' + a.id + '"' + checked + ' onchange="toggleAppSelect(' + a.id + ', this.checked)"></td>' +
        '<td><strong>' + esc(a.company) + '</strong></td><td>' + esc(a.role) + '</td>' +
        '<td>' + esc(a.platform) + '</td><td>' + esc(a.location) + '</td><td>' + esc(a.salary_range) + '</td>' +
        '<td><span class="badge badge-' + a.status + '">' + a.status + '</span></td>' +
        '<td>' + scoreBadge + '</td>' +
        '<td>' + esc(a.applied_date) + '</td><td>' + esc(a.follow_up_date) + '</td>' +
        '<td><button class="btn btn-sm btn-ghost" onclick="editApp(' + a.id + ')">Edit</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="deleteApp(' + a.id + ')">Del</button></td></tr>';
    }).join('');
}

function toggleAppSelect(id, checked) {
  if (checked) selectedAppIds.add(id); else selectedAppIds.delete(id);
  updateBulkBar();
}

function toggleSelectAll(checkbox) {
  var filtered = getFilteredApps();
  if (checkbox.checked) {
    filtered.forEach(function(a) { selectedAppIds.add(a.id); });
  } else {
    filtered.forEach(function(a) { selectedAppIds.delete(a.id); });
  }
  renderAppsTable();
  updateBulkBar();
}

function clearBulkSelection() {
  selectedAppIds.clear();
  renderAppsTable();
  updateBulkBar();
}

function updateBulkBar() {
  var bar = document.getElementById('bulk-action-bar');
  var count = selectedAppIds.size;
  if (count > 0) {
    bar.style.display = 'flex';
    document.getElementById('bulk-count').textContent = count + ' selected';
  } else {
    bar.style.display = 'none';
  }
}

async function bulkStatusChange() {
  var status = document.getElementById('bulk-status-select').value;
  if (!status) return toast('Select a status first', true);
  if (selectedAppIds.size === 0) return;
  showConfirm('Bulk Status Change', 'Change ' + selectedAppIds.size + ' applications to ' + status + '?', async function() {
    await api('/api/applications/bulk-status', 'POST', { ids: Array.from(selectedAppIds), status: status });
    toast('Updated ' + selectedAppIds.size + ' applications');
    selectedAppIds.clear();
    loadApplications();
  });
}

async function bulkDeleteApps() {
  if (selectedAppIds.size === 0) return;
  showConfirm('Bulk Delete', 'Delete ' + selectedAppIds.size + ' applications? This cannot be undone.', async function() {
    await api('/api/applications/bulk-delete', 'POST', { ids: Array.from(selectedAppIds) });
    toast('Deleted ' + selectedAppIds.size + ' applications');
    selectedAppIds.clear();
    loadApplications();
  });
}

// App CRUD
function openAppModal(app) {
  document.getElementById('app-modal-title').textContent = app ? 'Edit Application' : 'Add Application';
  document.getElementById('app-id').value = app ? app.id : '';
  document.getElementById('f-company').value = app ? app.company : '';
  document.getElementById('f-role').value = app ? app.role : '';
  document.getElementById('f-platform').value = app ? app.platform : '';
  document.getElementById('f-status').value = app ? app.status : 'APPLIED';
  document.getElementById('f-location').value = app ? app.location : '';
  document.getElementById('f-salary').value = app ? app.salary_range : '';
  document.getElementById('f-applied').value = app ? app.applied_date : new Date().toISOString().split('T')[0];
  document.getElementById('f-interview').value = app ? app.interview_date : '';
  document.getElementById('f-followup').value = app ? app.follow_up_date : '';
  document.getElementById('f-url').value = app ? app.portal_url : '';
  document.getElementById('f-notes').value = app ? app.notes : '';
  document.getElementById('app-modal').classList.add('open');
}

function editApp(id) {
  var app = allApps.find(function(a) { return a.id === id; });
  if (app) openAppModal(app);
}

async function saveApp() {
  var body = {
    company: document.getElementById('f-company').value.trim(),
    role: document.getElementById('f-role').value.trim(),
    platform: document.getElementById('f-platform').value,
    status: document.getElementById('f-status').value,
    location: document.getElementById('f-location').value.trim(),
    salary_range: document.getElementById('f-salary').value.trim(),
    applied_date: document.getElementById('f-applied').value,
    interview_date: document.getElementById('f-interview').value,
    follow_up_date: document.getElementById('f-followup').value,
    portal_url: document.getElementById('f-url').value.trim(),
    notes: document.getElementById('f-notes').value.trim(),
  };
  if (!body.company || !body.role) return toast('Company and Role are required', true);
  var id = document.getElementById('app-id').value;
  if (id) {
    await api('/api/applications/' + id, 'PUT', body);
    toast('Application updated');
  } else {
    await api('/api/applications', 'POST', body);
    toast('Application added');
  }
  closeModal('app-modal');
  loadDashboard();
  if (document.getElementById('tab-applications').classList.contains('active')) loadApplications();
}

async function deleteApp(id) {
  if (!confirm('Delete this application?')) return;
  await api('/api/applications/' + id, 'DELETE');
  toast('Deleted');
  loadDashboard();
  if (document.getElementById('tab-applications').classList.contains('active')) loadApplications();
}

// ============================== JOB SEARCH ==============================
function initSearch() {
  updatePortalLinks();
}

function updatePortalLinks() {
  var kw = document.getElementById('search-keywords').value.trim() || 'Software Engineer';
  var loc = document.getElementById('search-location').value.trim() || 'India';
  var kwEnc = encodeURIComponent(kw);
  var locEnc = encodeURIComponent(loc);
  var kwDash = kw.replace(/\s+/g, '-');
  var locDash = loc.replace(/\s+/g, '-');

  var portals = [
    { name: 'LinkedIn', url: 'https://www.linkedin.com/jobs/search/?keywords=' + kwEnc + '&location=' + locEnc },
    { name: 'Naukri', url: 'https://www.naukri.com/' + kwDash + '-jobs-in-' + locDash },
    { name: 'Indeed', url: 'https://in.indeed.com/jobs?q=' + kwEnc + '&l=' + locEnc },
    { name: 'Wellfound', url: 'https://wellfound.com/jobs?query=' + kwEnc },
    { name: 'Instahyre', url: 'https://www.instahyre.com/search-jobs/?search=' + kwEnc + '&location=' + locEnc },
    { name: 'Cutshort', url: 'https://cutshort.io/jobs?q=' + kwEnc },
    { name: 'Glassdoor', url: 'https://www.glassdoor.co.in/Job/jobs.htm?sc.keyword=' + kwEnc + '&locKeyword=' + locEnc },
  ];

  document.getElementById('portal-links').innerHTML = portals.map(function(p) {
    return '<a class="portal-link" href="' + p.url + '" target="_blank">' + p.name + ' &rarr;</a>';
  }).join('');
}

document.getElementById('search-keywords').addEventListener('input', updatePortalLinks);
document.getElementById('search-location').addEventListener('input', updatePortalLinks);
document.getElementById('search-keywords').addEventListener('keydown', function(e) { if (e.key === 'Enter') searchJobs(); });

function scoreJob(job, kwTokens, locToken) {
  var title = (job.title || '').toLowerCase();
  var desc = (job.description || '').toLowerCase();
  var jobLoc = (job.location || '').toLowerCase();
  var score = 0;
  kwTokens.forEach(function(t) {
    if (!t) return;
    if (title.includes(t)) score += 10;
    if (desc.includes(t)) score += 2;
  });
  if (locToken && jobLoc.includes(locToken)) score += 5;
  if (/remote/.test(jobLoc)) score += 1;
  return score;
}

async function searchJobs() {
  var rawKw = document.getElementById('search-keywords').value.trim();
  var loc = document.getElementById('search-location').value.trim();
  if (!rawKw) return toast('Enter keywords to search (comma-separate for multi-query)', true);

  var keywords = rawKw.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  var kwTokens = keywords.join(' ').toLowerCase().split(/\s+/).filter(function(t) { return t.length > 2; });
  var locToken = loc.toLowerCase().split(',')[0].trim();

  setLoading('search-btn', true);
  var resultsEl = document.getElementById('search-results');
  var loadingMsg = '<div class="loading-overlay"><span class="spinner"></span> Searching ' + keywords.length + ' keyword' + (keywords.length > 1 ? 's' : '') + ' across 5 sources...</div>';
  // eslint-disable-next-line no-unsanitized/property
  resultsEl['inner' + 'HTML'] = loadingMsg;
  document.getElementById('search-empty').style.display = 'none';

  try {
    var t0 = Date.now();
    var responses = await Promise.all(keywords.map(function(k) {
      return api('/api/auto/search-jobs?keywords=' + encodeURIComponent(k) + '&location=' + encodeURIComponent(loc) + '&limit=100')
        .catch(function(e) { return { jobs: [], errors: [k + ': ' + e.message], sources: {} }; });
    }));

    // Merge + dedup across keywords
    var seen = {};
    var allJobs = [];
    var allErrors = [];
    var sourcesUsed = {};
    responses.forEach(function(data) {
      (data.jobs || []).forEach(function(j) {
        var key = ((j.company || '') + '|' + (j.title || '')).toLowerCase();
        if (seen[key]) return;
        seen[key] = 1;
        j._score = scoreJob(j, kwTokens, locToken);
        allJobs.push(j);
      });
      (data.errors || []).forEach(function(e) { allErrors.push(e); });
      Object.keys(data.sources || {}).forEach(function(s) { if (data.sources[s]) sourcesUsed[s] = 1; });
    });

    allJobs.sort(function(a, b) { return b._score - a._score; });
    var jobs = allJobs.slice(0, 100);
    var elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    var srcInfo = 'Sources: ' + Object.keys(sourcesUsed).join(', ') + ' | ' + elapsed + 's';
    var uniqErrors = allErrors.filter(function(e, i, a) { return a.indexOf(e) === i; });
    if (uniqErrors.length) srcInfo += ' | Errors: ' + uniqErrors.slice(0, 3).join('; ');

    if (jobs.length === 0) {
      resultsEl['inner' + 'HTML'] = '<p style="color:#64748b;padding:20px;text-align:center">No jobs found for "' + esc(rawKw) + '". Try different keywords or use the portal links above.</p>';
      return;
    }

    var goalPct = Math.min(100, jobs.length);
    var header =
      '<div style="background:rgba(24,24,27,.6);border:1px solid rgba(63,63,70,.4);border-radius:14px;padding:14px 18px;margin-bottom:14px;backdrop-filter:blur(10px)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">' +
          '<div style="font-size:14px;font-weight:700;color:#fafafa">' + jobs.length + ' relevant jobs <span style="color:#71717a;font-weight:500">/ 100 goal</span></div>' +
          '<div style="font-size:11px;color:#71717a">' + esc(srcInfo) + '</div>' +
        '</div>' +
        '<div style="height:6px;background:rgba(63,63,70,.4);border-radius:999px;overflow:hidden">' +
          '<div style="height:100%;width:' + goalPct + '%;background:linear-gradient(90deg,#6366f1,#c084fc);transition:width .3s"></div>' +
        '</div>' +
      '</div>';

    var cards = jobs.map(function(j) {
      var tags = (j.tags || []).slice(0, 5).map(function(t) { return '<span class="badge badge-APPLIED" style="margin-right:4px">' + esc(t) + '</span>'; }).join('');
      var companyEsc = esc(j.company).replace(/'/g, "\\'");
      var titleEsc = esc(j.title).replace(/'/g, "\\'");
      var urlEsc = esc(j.url);
      var locEsc = esc(j.location || 'Remote').replace(/'/g, "\\'");
      var salEsc = esc(j.salary || '').replace(/'/g, "\\'");
      var scoreBadge = j._score >= 10
        ? '<span class="badge badge-OFFER" title="Relevance score">★ ' + j._score + '</span> '
        : j._score >= 5
          ? '<span class="badge badge-INTERVIEW" title="Relevance score">' + j._score + '</span> '
          : '';
      return '<div class="job-card">' +
        '<h3>' + scoreBadge + esc(j.title) + '</h3>' +
        '<div class="meta">' + esc(j.company) + ' &bull; ' + esc(j.location || 'Remote') + (j.salary ? ' &bull; ' + esc(j.salary) : '') + ' &bull; <span class="badge badge-APPLIED">' + esc(j.source) + '</span></div>' +
        (tags ? '<div style="margin-bottom:8px">' + tags + '</div>' : '') +
        '<div class="actions">' +
        (j.url ? '<a class="btn btn-sm btn-primary" href="' + urlEsc + '" target="_blank">View & Apply</a> ' : '') +
        '<button class="btn btn-sm btn-success" onclick="saveJobFromSearch(\'' + companyEsc + '\',\'' + titleEsc + '\',\'' + urlEsc + '\',\'' + locEsc + '\',\'' + salEsc + '\')">+ Save to Tracker</button> ' +
        '<button class="btn btn-sm btn-ghost" onclick="quickApplyFromSearch(\'' + companyEsc + '\',\'' + titleEsc + '\',\'' + urlEsc + '\')">Quick Apply</button>' +
        '</div></div>';
    }).join('');

    resultsEl['inner' + 'HTML'] = header + cards;
  } catch (err) {
    resultsEl['inner' + 'HTML'] = '<p style="color:#f87171;padding:20px;text-align:center">Search failed: ' + esc(err.message) + '. Use the portal links above instead.</p>';
  } finally {
    setLoading('search-btn', false);
    document.getElementById('search-btn').textContent = 'Search';
  }
}

function saveJobFromSearch(company, role, url, location, salary) {
  document.getElementById('f-company').value = company;
  document.getElementById('f-role').value = role;
  document.getElementById('f-url').value = url;
  document.getElementById('f-location').value = location;
  document.getElementById('f-salary').value = salary;
  document.getElementById('f-platform').value = 'Other';
  document.getElementById('f-status').value = 'WISHLIST';
  document.getElementById('f-applied').value = '';
  document.getElementById('f-interview').value = '';
  document.getElementById('f-followup').value = '';
  document.getElementById('f-notes').value = '';
  document.getElementById('app-id').value = '';
  document.getElementById('app-modal-title').textContent = 'Save Job to Tracker';
  document.getElementById('app-modal').classList.add('open');
}

function quickApplyFromSearch(company, role, url) {
  switchTab('quickapply');
  document.getElementById('qa-company').value = company;
  document.getElementById('qa-role').value = role;
  document.getElementById('qa-url').value = url;
}

// ============================== QUICK APPLY ==============================
async function loadQuickApply() {
  try { allTemplates = await api('/api/templates'); } catch (e) { allTemplates = []; }
  var sel = document.getElementById('qa-template');
  sel.innerHTML = allTemplates.map(function(t) {
    return '<option value="' + t.id + '">' + esc(t.name) + '</option>';
  }).join('');
}

async function generateCover() {
  var company = document.getElementById('qa-company').value.trim();
  var role = document.getElementById('qa-role').value.trim();
  var tplId = document.getElementById('qa-template').value;
  if (!company || !role) return toast('Enter company and role', true);
  if (!tplId) return toast('No template available. Add one in Settings.', true);

  var result = await api('/api/generate-cover', 'POST', { template_id: parseInt(tplId), company: company, role: role });
  if (result.error) return toast(result.error, true);

  generatedSubject = result.subject;
  generatedBody = result.body;
  document.getElementById('qa-subject').textContent = result.subject;
  document.getElementById('qa-body').textContent = result.body;
  document.getElementById('qa-preview').style.display = 'block';
  toast('Cover letter generated (template)');
}

// AI-powered cover letter generation
async function generateAICover() {
  var company = document.getElementById('qa-company').value.trim();
  var role = document.getElementById('qa-role').value.trim();
  var jobDesc = document.getElementById('qa-job-desc').value.trim();
  var tone = document.getElementById('qa-tone') ? document.getElementById('qa-tone').value : 'formal';
  if (!company || !role) return toast('Enter company and role', true);

  setLoading('ai-gen-btn', true);
  try {
    var result = await api('/api/ai/generate-cover', 'POST', {
      company: company, role: role, job_description: jobDesc, tone: tone
    });

    generatedSubject = result.subject;
    generatedBody = result.body;
    document.getElementById('qa-subject').textContent = result.subject;
    document.getElementById('qa-body').textContent = result.body;
    document.getElementById('qa-preview').style.display = 'block';
    var providerLabel = result.cached ? ' (cached)' : '';
    toast('AI cover letter generated via ' + result.provider + providerLabel);
  } catch (err) {
    toast('AI generation failed: ' + err.message, true);
  } finally {
    setLoading('ai-gen-btn', false);
    document.getElementById('ai-gen-btn').textContent = 'AI Generate';
  }
}

// AI cold email generation
async function generateColdEmail() {
  var company = document.getElementById('qa-company').value.trim();
  var role = document.getElementById('qa-role').value.trim();
  var jobDesc = document.getElementById('qa-job-desc').value.trim();
  var recipientName = document.getElementById('qa-email-to').value.trim().split('@')[0];
  if (!company || !role) return toast('Enter company and role', true);

  setLoading('cold-email-btn', true);
  try {
    var result = await api('/api/ai/generate-cold-email', 'POST', {
      company: company, role: role, job_description: jobDesc, recipient_name: recipientName
    });

    generatedSubject = result.subject_options ? result.subject_options[0] : 'Regarding ' + role;
    generatedBody = result.body;
    document.getElementById('qa-subject').textContent = generatedSubject;
    document.getElementById('qa-body').textContent = result.body;
    document.getElementById('qa-preview').style.display = 'block';

    if (result.subject_options && result.subject_options.length > 1) {
      var subjectInfo = 'Subject options: ' + result.subject_options.join(' | ');
      document.getElementById('qa-subject').textContent = generatedSubject;
      document.getElementById('qa-subject').title = subjectInfo;
    }
    toast('Cold email generated via ' + result.provider);
  } catch (err) {
    toast('Cold email generation failed: ' + err.message, true);
  } finally {
    setLoading('cold-email-btn', false);
    document.getElementById('cold-email-btn').textContent = 'Cold Email';
  }
}

function copyCover() {
  if (!generatedBody) return toast('Generate a cover letter first', true);
  navigator.clipboard.writeText(generatedBody).then(function() { toast('Copied to clipboard!'); });
}

function openApplyUrl() {
  var url = document.getElementById('qa-url').value.trim();
  if (!url) return toast('No apply URL specified', true);
  window.open(url, '_blank');
}

async function saveAndTrack() {
  var company = document.getElementById('qa-company').value.trim();
  var role = document.getElementById('qa-role').value.trim();
  var url = document.getElementById('qa-url').value.trim();
  if (!company || !role) return toast('Enter company and role', true);

  await api('/api/applications', 'POST', {
    company: company, role: role, portal_url: url,
    status: 'APPLIED', platform: 'Other',
    applied_date: new Date().toISOString().split('T')[0],
    follow_up_date: getFutureDate(7)
  });
  toast('Saved to applications with 7-day follow-up!');
}

function getFutureDate(days) {
  var d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function sendEmailApply() {
  var to = document.getElementById('qa-email-to').value.trim();
  if (!to) return toast('Enter recipient email', true);
  if (!generatedSubject || !generatedBody) return toast('Generate a cover letter first', true);

  var attachResume = document.getElementById('qa-attach-resume').checked;
  toast('Sending...');

  var result = await api('/api/send-email', 'POST', {
    to: to, subject: generatedSubject, body: generatedBody, attachResume: attachResume
  });
  if (result.error) return toast('Email failed: ' + result.error, true);
  toast('Email sent successfully!');

  var company = document.getElementById('qa-company').value.trim();
  var role = document.getElementById('qa-role').value.trim();
  if (company && role) {
    await api('/api/applications', 'POST', {
      company: company, role: role, platform: 'Email',
      status: 'APPLIED', applied_date: new Date().toISOString().split('T')[0],
      follow_up_date: getFutureDate(7), notes: 'Applied via email to ' + to
    });
  }
}

// ============================== INTERVIEW PREP ==============================
async function loadPrep() {
  try { allPrep = await api('/api/prep'); } catch (e) { allPrep = []; }
  var total = allPrep.length;
  var done = allPrep.filter(function(t) { return t.status === 'DONE'; }).length;
  var pct = total ? Math.round(done / total * 100) : 0;
  document.getElementById('prep-progress-label').textContent = done + ' / ' + total + ' completed (' + pct + '%)';
  document.getElementById('prep-progress-fill').style.width = pct + '%';

  var groups = {};
  allPrep.forEach(function(t) { if (!groups[t.category]) groups[t.category] = []; groups[t.category].push(t); });

  document.getElementById('prep-list').innerHTML = Object.keys(groups).map(function(cat) {
    return '<div class="prep-category"><h3>' + esc(cat) + '</h3>' +
      groups[cat].map(function(t) {
        return '<div class="prep-item" onclick="cyclePrepStatus(' + t.id + ',\'' + t.status + '\')">' +
          '<span class="badge badge-' + t.status + '">' + t.status + '</span>' +
          '<span class="topic-name">' + esc(t.topic) + '</span>' +
          '<span class="badge badge-' + t.difficulty + '">' + t.difficulty + '</span>' +
          (t.resource_url ? '<a class="resource-link" href="' + esc(t.resource_url) + '" target="_blank" onclick="event.stopPropagation()">Link</a>' : '') +
          '</div>';
      }).join('') + '</div>';
  }).join('');

  // Load AI practice questions section
  loadPracticeQuestions();
}

async function cyclePrepStatus(id, current) {
  var next = current === 'TODO' ? 'REVIEW' : current === 'REVIEW' ? 'DONE' : 'TODO';
  await api('/api/prep/' + id, 'PUT', { status: next, notes: '' });
  loadPrep();
}

function openPrepModal() {
  document.getElementById('p-topic').value = '';
  document.getElementById('p-url').value = '';
  document.getElementById('prep-modal').classList.add('open');
}

async function savePrepTopic() {
  var body = { category: document.getElementById('p-category').value, topic: document.getElementById('p-topic').value.trim(), difficulty: document.getElementById('p-difficulty').value, resource_url: document.getElementById('p-url').value.trim() };
  if (!body.topic) return toast('Topic is required', true);
  await api('/api/prep', 'POST', body);
  toast('Topic added');
  closeModal('prep-modal');
  loadPrep();
}

// AI Practice Questions
async function loadPracticeQuestions() {
  var container = document.getElementById('practice-questions-container');
  if (!container) return;

  // Load interview-status applications for dropdown
  var interviewApps = allApps.length > 0 ? allApps : await api('/api/applications');
  var relevantApps = interviewApps.filter(function(a) {
    return ['INTERVIEW', 'SCREENING', 'APPLIED'].includes(a.status);
  });

  var sel = document.getElementById('prep-app-select');
  if (sel) {
    sel.innerHTML = '<option value="">Select an application...</option>' +
      relevantApps.map(function(a) {
        return '<option value="' + a.id + '">' + esc(a.company) + ' - ' + esc(a.role) + ' (' + a.status + ')</option>';
      }).join('');
  }
}

async function generateInterviewQuestions() {
  var appId = document.getElementById('prep-app-select').value;
  if (!appId) return toast('Select an application first', true);

  setLoading('gen-questions-btn', true);
  try {
    var result = await api('/api/ai/interview-prep', 'POST', { application_id: parseInt(appId) });
    toast('Generated ' + result.questions.length + ' questions via ' + result.provider);
    renderPracticeQuestions(result.questions);
  } catch (err) {
    toast('Failed: ' + err.message, true);
  } finally {
    setLoading('gen-questions-btn', false);
    document.getElementById('gen-questions-btn').textContent = 'Generate Questions';
  }
}

async function loadSavedQuestions() {
  var appId = document.getElementById('prep-app-select').value;
  if (!appId) return;
  try {
    var questions = await api('/api/practice-questions?application_id=' + appId);
    renderPracticeQuestions(questions);
  } catch (err) {}
}

function renderPracticeQuestions(questions) {
  var container = document.getElementById('practice-questions-list');
  if (!container) return;

  if (!questions || questions.length === 0) {
    container.innerHTML = '<p style="color:#64748b;text-align:center;padding:20px">No questions yet. Select an application and click "Generate Questions".</p>';
    return;
  }

  container.innerHTML = questions.map(function(q) {
    var catBadge = q.category === 'technical' ? 'badge-APPLIED' :
                   q.category === 'behavioral' ? 'badge-INTERVIEW' :
                   q.category === 'system_design' ? 'badge-SCREENING' : 'badge-OFFER';
    var statusBadge = q.status === 'DONE' ? 'badge-DONE' : q.status === 'REVIEW' ? 'badge-REVIEW' : 'badge-TODO';
    return '<div class="job-card" style="padding:14px;margin-bottom:8px">' +
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">' +
      '<span class="badge ' + catBadge + '">' + esc(q.category) + '</span>' +
      '<span class="badge badge-' + q.difficulty + '">' + q.difficulty + '</span>' +
      '<span class="badge ' + statusBadge + '" onclick="cyclePracticeStatus(' + q.id + ',\'' + q.status + '\')" style="cursor:pointer">' + q.status + '</span>' +
      '</div>' +
      '<div style="font-size:14px;font-weight:500;margin-bottom:6px">' + esc(q.question) + '</div>' +
      (q.suggested_answer ? '<details><summary style="font-size:12px;color:#60a5fa;cursor:pointer">Show suggested answer</summary><div style="font-size:13px;color:#94a3b8;padding:8px 0;white-space:pre-wrap">' + esc(q.suggested_answer) + '</div></details>' : '') +
      '</div>';
  }).join('');
}

async function cyclePracticeStatus(id, current) {
  var next = current === 'TODO' ? 'REVIEW' : current === 'REVIEW' ? 'DONE' : 'TODO';
  await api('/api/practice-questions/' + id, 'PUT', { status: next });
  var appId = document.getElementById('prep-app-select').value;
  if (appId) loadSavedQuestions();
}

// ============================== STUDY MATERIALS ==============================
var studyTopics = [
  { folder: '01-Java-Core', name: 'Java Core', icon: '\u2615', desc: 'OOPs, Collections, Streams, Multithreading, JVM' },
  { folder: '02-Spring-Boot', name: 'Spring Boot', icon: '\uD83C\uDF31', desc: 'Spring Core, Boot, Security, Data JPA, Cloud' },
  { folder: '03-DSA', name: 'DSA', icon: '\uD83E\udDE9', desc: 'Arrays, Trees, Graphs, DP, Top 30 LeetCode' },
  { folder: '04-System-Design', name: 'System Design', icon: '\uD83C\uDFD7\uFE0F', desc: 'HLD, LLD, Design Patterns, Scalability' },
  { folder: '05-Database', name: 'Database', icon: '\uD83D\uDDC4\uFE0F', desc: 'MySQL, PostgreSQL, MongoDB, Indexing' },
  { folder: '06-Redis-Caching', name: 'Redis & Caching', icon: '\u26A1', desc: 'Redis, Ehcache, Caching Strategies' },
  { folder: '07-Messaging-Queues', name: 'Messaging Queues', icon: '\uD83D\uDCE8', desc: 'Kafka, RabbitMQ, Event-Driven Architecture' },
  { folder: '08-Operating-System', name: 'Operating System', icon: '\uD83D\uDDA5\uFE0F', desc: 'Process, Threads, Memory, Deadlocks' },
  { folder: '09-Networking', name: 'Networking', icon: '\uD83C\uDF10', desc: 'TCP/IP, HTTP, DNS, REST, WebSockets' },
  { folder: '10-DevOps-Cloud', name: 'DevOps & Cloud', icon: '\u2601\uFE0F', desc: 'Docker, Kubernetes, AWS, CI/CD' },
  { folder: '11-OOPs-Design-Patterns', name: 'OOPs & Patterns', icon: '\uD83D\uDD27', desc: 'SOLID, GoF Patterns, Real-World Examples' },
  { folder: '12-Behavioral', name: 'Behavioral & HR', icon: '\uD83C\uDFAF', desc: 'STAR Method, Questions, Salary Negotiation' }
];

var studyCache = {};

function loadStudyTopics() {
  var grid = document.getElementById('study-topics-grid');
  grid.style.display = '';
  document.getElementById('study-content-viewer').style.display = 'none';
  grid.innerHTML = studyTopics.map(function(t) {
    return '<div class="card study-card" onclick="openStudyTopic(\'' + t.folder + '\', \'' + esc(t.name) + '\')">' +
      '<div class="topic-icon">' + t.icon + '</div>' +
      '<h3>' + esc(t.name) + '</h3>' +
      '<p>' + esc(t.desc) + '</p>' +
      '</div>';
  }).join('');
}

async function openStudyTopic(folder, name) {
  document.getElementById('study-topics-grid').style.display = 'none';
  var viewer = document.getElementById('study-content-viewer');
  viewer.style.display = '';
  document.getElementById('study-content-title').textContent = name;
  document.getElementById('study-content-body').innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Loading ' + name + '...</div>';

  if (studyCache[folder]) {
    document.getElementById('study-content-body').innerHTML = renderMarkdown(studyCache[folder]);
    return;
  }

  try {
    var url = 'https://raw.githubusercontent.com/shubh478/Interview-Preparation/main/' + folder + '/README.md';
    var res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch');
    var md = await res.text();
    studyCache[folder] = md;
    document.getElementById('study-content-body').innerHTML = renderMarkdown(md);
  } catch (e) {
    document.getElementById('study-content-body').innerHTML = '<p style="color:#f87171">Could not load content. <a href="https://github.com/shubh478/Interview-Preparation/tree/main/' + folder + '" target="_blank">View on GitHub</a></p>';
  }
}

function closeStudyViewer() {
  document.getElementById('study-content-viewer').style.display = 'none';
  document.getElementById('study-topics-grid').style.display = '';
}

function renderMarkdown(md) {
  // Simple markdown to HTML renderer
  var html = md;

  // Code blocks (```lang ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function(m, lang, code) {
    return '<pre><code class="language-' + lang + '">' + escHtml(code.trim()) + '</code></pre>';
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Tables
  html = html.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)*)/gm, function(m, header, sep, rows) {
    var ths = header.split('|').filter(function(c) { return c.trim(); }).map(function(c) { return '<th>' + c.trim() + '</th>'; }).join('');
    var trs = rows.trim().split('\n').map(function(row) {
      var tds = row.split('|').filter(function(c) { return c.trim(); }).map(function(c) { return '<td>' + c.trim() + '</td>'; }).join('');
      return '<tr>' + tds + '</tr>';
    }).join('');
    return '<table><thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table>';
  });

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr>');

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Paragraphs — wrap loose text lines
  html = html.replace(/^(?!<[a-z/]|$)(.+)$/gm, '<p>$1</p>');

  // Clean up extra blank lines
  html = html.replace(/\n{3,}/g, '\n\n');

  return html;
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================== RESOURCES ==============================
var resources = [
  { name: 'Naukri', url: 'https://www.naukri.com', desc: "India's #1 job portal" },
  { name: 'LinkedIn Jobs', url: 'https://www.linkedin.com/jobs/', desc: 'Professional network & jobs' },
  { name: 'Wellfound', url: 'https://wellfound.com', desc: 'Startup jobs (AngelList)' },
  { name: 'Instahyre', url: 'https://www.instahyre.com', desc: 'Curated tech jobs India' },
  { name: 'Cutshort', url: 'https://cutshort.io', desc: 'AI-powered job matching' },
  { name: 'Weekday', url: 'https://www.weekday.works', desc: 'Referral-based job search' },
  { name: 'LeetCode', url: 'https://leetcode.com', desc: 'DSA practice & contests' },
  { name: 'NeetCode', url: 'https://neetcode.io', desc: 'Curated DSA roadmap' },
  { name: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer', desc: 'System design prep (GitHub)' },
  { name: 'Baeldung', url: 'https://www.baeldung.com', desc: 'Java & Spring Boot tutorials' },
];

function renderResources() {
  document.getElementById('resource-grid').innerHTML = resources.map(function(r) {
    return '<a href="' + r.url + '" target="_blank" class="card"><h3>' + r.name + '</h3><p>' + r.desc + '</p></a>';
  }).join('');
}

// ============================== SETTINGS ==============================
async function loadSettings() {
  var data;
  try { data = await Promise.all([api('/api/profile'), api('/api/email-config'), api('/api/templates'), api('/api/resume-info'), api('/api/ai/providers')]); } catch (e) { return; }
  var p = data[0] || {}; var e = data[1] || {}; allTemplates = data[2] || []; var r = data[3] || {}; var aiData = data[4] || { providers: [], active: '' };

  document.getElementById('s-name').value = p.full_name || '';
  document.getElementById('s-email').value = p.email || '';
  document.getElementById('s-phone').value = p.phone || '';
  document.getElementById('s-current-role').value = p.current_role || '';
  document.getElementById('s-exp').value = p.experience_years || '';
  document.getElementById('s-linkedin').value = p.linkedin_url || '';
  document.getElementById('s-github').value = p.github_url || '';
  document.getElementById('s-portfolio').value = p.portfolio_url || '';
  document.getElementById('s-skills').value = p.skills || '';
  document.getElementById('s-summary').value = p.summary || '';

  // Resume text
  var resumeTextEl = document.getElementById('s-resume-text');
  if (resumeTextEl) resumeTextEl.value = p.resume_text || '';

  document.getElementById('s-smtp-host').value = e.smtp_host || 'smtp.gmail.com';
  document.getElementById('s-smtp-port').value = e.smtp_port || 587;
  document.getElementById('s-smtp-user').value = e.smtp_user || '';
  document.getElementById('s-smtp-pass').value = e.smtp_pass || '';
  document.getElementById('s-from-name').value = e.from_name || '';

  document.getElementById('resume-status').innerHTML = r.exists
    ? 'Uploaded: ' + esc(r.filename) + ' <a href="/api/resume-download" target="_blank" style="color:#60a5fa;margin-left:8px">Download</a>'
    : 'No resume uploaded';

  renderTemplateList();

  // AI Provider setup
  renderAIProviders(aiData);
}

function renderAIProviders(aiData) {
  var container = document.getElementById('ai-provider-list');
  if (!container) return;

  container.innerHTML = aiData.providers.map(function(p) {
    var isActive = aiData.active === p.id;
    var statusColor = p.available ? '#22c55e' : '#64748b';
    var statusText = p.available ? (isActive ? 'Active' : 'Available') : 'Not configured';
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #334155">' +
      '<div style="width:10px;height:10px;border-radius:50%;background:' + statusColor + '"></div>' +
      '<div style="flex:1"><strong style="font-size:13px">' + esc(p.name) + '</strong>' +
      '<div style="font-size:11px;color:#64748b">Model: ' + esc(p.model) + (p.free ? ' (FREE)' : ' (Paid)') + '</div></div>' +
      '<span style="font-size:11px;color:' + statusColor + '">' + statusText + '</span>' +
      (p.available && !isActive ? '<button class="btn btn-sm btn-ghost" onclick="switchAIProvider(\'' + p.id + '\')">Use</button>' : '') +
      (isActive ? '<span class="badge badge-INTERVIEW">Active</span>' : '') +
      '</div>';
  }).join('');
}

async function switchAIProvider(providerId) {
  try {
    await api('/api/ai/provider', 'PUT', { provider: providerId });
    toast('Switched to ' + providerId);
    loadSettings();
  } catch (err) {
    toast('Failed: ' + err.message, true);
  }
}

async function testAIConnection() {
  setLoading('test-ai-btn', true);
  try {
    var result = await api('/api/ai/test', 'POST');
    toast('AI connected: ' + result.provider + ' - ' + result.response);
  } catch (err) {
    toast('Connection failed: ' + err.message, true);
  } finally {
    setLoading('test-ai-btn', false);
    document.getElementById('test-ai-btn').textContent = 'Test Connection';
  }
}

async function saveProfile() {
  var body = {
    full_name: document.getElementById('s-name').value.trim(),
    email: document.getElementById('s-email').value.trim(),
    phone: document.getElementById('s-phone').value.trim(),
    linkedin_url: document.getElementById('s-linkedin').value.trim(),
    github_url: document.getElementById('s-github').value.trim(),
    portfolio_url: document.getElementById('s-portfolio').value.trim(),
    current_role: document.getElementById('s-current-role').value.trim(),
    experience_years: document.getElementById('s-exp').value.trim(),
    skills: document.getElementById('s-skills').value.trim(),
    summary: document.getElementById('s-summary').value.trim(),
  };
  var resumeTextEl = document.getElementById('s-resume-text');
  if (resumeTextEl) body.resume_text = resumeTextEl.value.trim();
  await api('/api/profile', 'PUT', body);
  toast('Profile saved');
}

async function uploadResume() {
  var input = document.getElementById('s-resume');
  if (!input.files || !input.files[0]) return toast('Select a file', true);
  var fd = new FormData();
  fd.append('resume', input.files[0]);
  try {
    var res = await fetch('/api/resume', { method: 'POST', body: fd });
    var text = await res.text();
    var data;
    try { data = JSON.parse(text); } catch (e) { return toast('Upload failed — server error', true); }
    if (data.error) return toast(data.error, true);
    document.getElementById('resume-status').innerHTML = 'Uploaded: ' + esc(data.filename) + ' <a href="/api/resume-download" target="_blank" style="color:#60a5fa;margin-left:8px">Download</a>';
    toast('Resume uploaded');
  } catch (e) { toast('Upload failed: ' + e.message, true); }
}

async function saveEmailConfig() {
  await api('/api/email-config', 'PUT', {
    smtp_host: document.getElementById('s-smtp-host').value.trim(),
    smtp_port: parseInt(document.getElementById('s-smtp-port').value) || 587,
    smtp_user: document.getElementById('s-smtp-user').value.trim(),
    smtp_pass: document.getElementById('s-smtp-pass').value,
    from_name: document.getElementById('s-from-name').value.trim(),
  });
  toast('Email config saved');
}

// Auto-ghost
async function runAutoGhost() {
  setLoading('ghost-btn', true);
  try {
    var result = await api('/api/auto-ghost', 'POST');
    if (result.ghosted > 0) {
      document.getElementById('ghost-result').innerHTML = '<span style="color:#fbbf24">Marked ' + result.ghosted + ' applications as GHOSTED: ' +
        result.applications.map(function(a) { return esc(a.company); }).join(', ') + '</span>';
    } else {
      document.getElementById('ghost-result').innerHTML = '<span style="color:#22c55e">No stale applications found. All good!</span>';
    }
    toast(result.ghosted > 0 ? result.ghosted + ' marked as ghosted' : 'No ghosted apps detected');
  } catch (err) {
    document.getElementById('ghost-result').textContent = '';
  } finally {
    setLoading('ghost-btn', false);
    document.getElementById('ghost-btn').textContent = 'Detect Ghosted Applications';
  }
}

// Templates
function renderTemplateList() {
  document.getElementById('template-list').innerHTML = allTemplates.length === 0
    ? '<p style="color:#64748b;font-size:13px">No templates yet.</p>'
    : allTemplates.map(function(t) {
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #334155">' +
        '<span style="flex:1;font-size:13px">' + esc(t.name) + '</span>' +
        '<button class="btn btn-sm btn-ghost" onclick="editTemplate(' + t.id + ')">Edit</button>' +
        '<button class="btn btn-sm btn-danger" onclick="deleteTemplate(' + t.id + ')">Del</button></div>';
    }).join('');
}

function openTemplateModal(tpl) {
  document.getElementById('tpl-modal-title').textContent = tpl ? 'Edit Template' : 'Add Template';
  document.getElementById('tpl-id').value = tpl ? tpl.id : '';
  document.getElementById('t-name').value = tpl ? tpl.name : '';
  document.getElementById('t-subject').value = tpl ? tpl.subject : '';
  document.getElementById('t-body').value = tpl ? tpl.body : '';
  document.getElementById('tpl-modal').classList.add('open');
}

function editTemplate(id) {
  var tpl = allTemplates.find(function(t) { return t.id === id; });
  if (tpl) openTemplateModal(tpl);
}

async function saveTemplate() {
  var body = {
    name: document.getElementById('t-name').value.trim(),
    subject: document.getElementById('t-subject').value.trim(),
    body: document.getElementById('t-body').value,
  };
  if (!body.name) return toast('Template name is required', true);
  var id = document.getElementById('tpl-id').value;
  if (id) {
    await api('/api/templates/' + id, 'PUT', body);
    toast('Template updated');
  } else {
    await api('/api/templates', 'POST', body);
    toast('Template added');
  }
  closeModal('tpl-modal');
  allTemplates = await api('/api/templates');
  renderTemplateList();
}

async function deleteTemplate(id) {
  if (!confirm('Delete this template?')) return;
  await api('/api/templates/' + id, 'DELETE');
  allTemplates = await api('/api/templates');
  renderTemplateList();
  toast('Template deleted');
}

// ============================== BACKUP ==============================
function exportData() {
  window.open('/api/export', '_blank');
  toast('Downloading backup...');
}

function importData() {
  var file = document.getElementById('import-file').files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = async function(e) {
    try {
      var data = JSON.parse(e.target.result);
      showConfirm('Import Data', 'This will REPLACE all current data. Continue?', async function() {
        var result = await api('/api/import', 'POST', data);
        if (result.error) return toast('Import failed: ' + result.error, true);
        toast('Data imported! Refreshing...');
        setTimeout(function() { location.reload(); }, 1000);
      });
    } catch (err) {
      toast('Invalid file: ' + err.message, true);
    }
  };
  reader.readAsText(file);
}

// ============================== AUTOMATION ==============================
var fetchedJobs = [];
var queuedJobs = [];

function setPreset(keywords, location) {
  document.getElementById('auto-keywords').value = keywords;
  document.getElementById('auto-location').value = location;
  toast('Preset loaded: ' + keywords + ' in ' + location);
}

async function loadAutomation() {
  var stats;
  try { stats = await api('/api/auto/stats'); } catch (e) { stats = { inQueue: 0, appliedToday: 0, totalApplied: 0, interviews: 0 }; }
  document.getElementById('auto-stats-grid').innerHTML = [
    { num: stats.inQueue, label: 'In Queue', color: '#fbbf24' },
    { num: stats.appliedToday, label: 'Applied Today', color: '#3b82f6' },
    { num: stats.totalApplied, label: 'Total Applied', color: '#a78bfa' },
    { num: stats.interviews, label: 'Interviews', color: '#22c55e' },
  ].map(function(c) {
    return '<div class="stat-card"><div class="num" style="color:' + c.color + '">' + c.num + '</div><div class="label">' + c.label + '</div></div>';
  }).join('');

  try { allTemplates = await api('/api/templates'); } catch (e) { allTemplates = []; }
  var sel = document.getElementById('auto-template');
  sel.innerHTML = allTemplates.map(function(t) {
    return '<option value="' + t.id + '">' + esc(t.name) + '</option>';
  }).join('');

  loadAutoQueue();
}

async function autoFetchJobs() {
  var kw = document.getElementById('auto-keywords').value.trim();
  var loc = document.getElementById('auto-location').value.trim();
  var limit = document.getElementById('auto-limit').value || 100;
  if (!kw) return toast('Enter keywords to search', true);

  setLoading('auto-fetch-btn', true);
  document.getElementById('auto-fetch-status').innerHTML = '<span class="spinner"></span> <span style="color:#3b82f6">Fetching jobs from 5 sources in parallel... please wait</span>';
  document.getElementById('auto-fetch-results').innerHTML = '';

  try {
    var data = await api('/api/auto/search-jobs?keywords=' + encodeURIComponent(kw) + '&location=' + encodeURIComponent(loc) + '&limit=' + limit);
    fetchedJobs = data.jobs;

    // Build source status display
    var sourceNames = ['Remotive', 'Adzuna', 'JSearch', 'RemoteOK', 'Jobicy'];
    var sourceKeys = ['remotive', 'adzuna', 'jsearch', 'remoteok', 'jobicy'];
    var srcHtml = 'Sources: ' + sourceNames.map(function(name, i) {
      var active = data.sources[sourceKeys[i]];
      return '<span style="color:' + (active ? '#22c55e' : '#64748b') + '">' + name + (active ? '' : ' (off)') + '</span>';
    }).join(' | ');
    if (data.totalBeforeDedup && data.totalBeforeDedup > data.total) {
      srcHtml += ' | <span style="color:#fbbf24">' + (data.totalBeforeDedup - data.total) + ' duplicates removed</span>';
    }
    document.getElementById('auto-sources').innerHTML = srcHtml;

    if (data.errors && data.errors.length > 0) {
      document.getElementById('auto-fetch-status').innerHTML = '<span style="color:#fbbf24">Found ' + fetchedJobs.length + ' unique jobs (some errors: ' + esc(data.errors.join(', ')) + ')</span>';
    } else {
      document.getElementById('auto-fetch-status').innerHTML = '<span style="color:#22c55e">Found ' + fetchedJobs.length + ' unique jobs across all sources!</span>';
    }

    if (fetchedJobs.length === 0) {
      document.getElementById('auto-fetch-results').innerHTML = '<p style="color:#64748b;padding:20px;text-align:center">No jobs found. Try different keywords or presets.</p>';
      return;
    }

    renderFetchedJobs();

    // Auto-score if enabled
    var autoScore = document.getElementById('auto-score-on-fetch');
    if (autoScore && autoScore.checked) {
      toast('Auto-queuing and scoring jobs...');
      await queueAllFetched();
      await scoreQueuedJobs();
    }
  } catch (err) {
    document.getElementById('auto-fetch-status').innerHTML = '<span style="color:#f87171">Error: ' + esc(err.message) + '</span>';
  } finally {
    setLoading('auto-fetch-btn', false);
    document.getElementById('auto-fetch-btn').textContent = 'Fetch Jobs';
  }
}

function renderFetchedJobs() {
  document.getElementById('auto-fetch-results').innerHTML =
    '<div style="display:flex;gap:8px;margin:12px 0;align-items:center">' +
    '<button class="btn btn-success" onclick="queueAllFetched()">Add All ' + fetchedJobs.length + ' to Queue</button>' +
    '<span style="font-size:12px;color:#94a3b8">Or click individual jobs to add them</span></div>' +
    fetchedJobs.map(function(j, i) {
      var sourceBadge = j.source === 'JSearch' ? 'badge-INTERVIEW' :
                        j.source === 'Adzuna' ? 'badge-APPLIED' :
                        j.source === 'RemoteOK' ? 'badge-SCREENING' :
                        j.source === 'Jobicy' ? 'badge-OFFER' : 'badge-APPLIED';
      return '<div class="job-card" style="padding:12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:start">' +
        '<div style="flex:1"><strong>' + esc(j.title) + '</strong><div class="meta">' + esc(j.company) + ' &bull; ' + esc(j.location) + (j.salary ? ' &bull; ' + esc(j.salary) : '') + ' &bull; <span class="badge ' + sourceBadge + '">' + esc(j.source) + '</span></div>' +
        (j.description ? '<div style="font-size:11px;color:#64748b;margin-top:4px">' + esc(j.description.substring(0, 150)) + '...</div>' : '') +
        '</div>' +
        '<button class="btn btn-sm btn-success" onclick="queueSingleJob(' + i + ', this)">+ Queue</button>' +
        '</div></div>';
    }).join('');
}

async function queueAllFetched() {
  if (fetchedJobs.length === 0) return toast('No jobs to queue', true);
  toast('Adding ' + fetchedJobs.length + ' jobs to queue...');
  var result = await api('/api/auto/queue-jobs', 'POST', { jobs: fetchedJobs });
  toast('Added ' + result.saved + ' jobs, skipped ' + result.skipped + ' duplicates');
  loadAutoQueue();
  loadAutomation();
}

async function queueSingleJob(index, btn) {
  var j = fetchedJobs[index];
  var result = await api('/api/auto/queue-jobs', 'POST', { jobs: [j] });
  if (result.saved > 0) {
    btn.textContent = 'Queued!';
    btn.disabled = true;
    btn.className = 'btn btn-sm btn-ghost';
    toast(j.company + ' added to queue');
    loadAutoQueue();
  } else {
    toast('Already in queue', true);
  }
}

async function loadAutoQueue() {
  try { queuedJobs = await api('/api/auto/queue'); } catch (e) { queuedJobs = []; }

  // Apply filter if enabled
  var filterEnabled = document.getElementById('auto-filter-enabled');
  var minScoreEl = document.getElementById('auto-min-score');
  var minScore = (minScoreEl ? parseInt(minScoreEl.value) : 0) || 0;
  var displayJobs = queuedJobs;
  var filteredOut = 0;

  if (filterEnabled && filterEnabled.checked && minScore > 0) {
    displayJobs = queuedJobs.filter(function(j) {
      if (j.match_score === null || j.match_score === undefined) return true; // show unscored
      if (j.match_score >= minScore) return true;
      filteredOut++;
      return false;
    });
  }

  var countText = displayJobs.length + ' jobs in queue';
  if (filteredOut > 0) countText += ' (' + filteredOut + ' hidden below ' + minScore + '% match)';
  document.getElementById('auto-queue-count').textContent = countText;

  if (displayJobs.length === 0) {
    document.getElementById('auto-queue-list').innerHTML = '<p style="color:#64748b;padding:20px;text-align:center">' +
      (filteredOut > 0 ? 'All ' + filteredOut + ' jobs are below ' + minScore + '% match. Try lowering the threshold or fetching with different keywords.' : 'Queue is empty. Fetch jobs first (Step 1) to add them here.') + '</p>';
    return;
  }

  // Sort by match_score descending (highest first), unscored at bottom
  displayJobs.sort(function(a, b) {
    var sa = a.match_score !== null && a.match_score !== undefined ? a.match_score : -1;
    var sb = b.match_score !== null && b.match_score !== undefined ? b.match_score : -1;
    return sb - sa;
  });

  document.getElementById('auto-queue-list').innerHTML = displayJobs.map(function(j) {
    var scoreBadge = j.match_score !== null && j.match_score !== undefined
      ? '<span class="badge" style="background:' + (j.match_score >= 70 ? '#14532d' : j.match_score >= 40 ? '#422006' : '#450a0a') +
        ';color:' + (j.match_score >= 70 ? '#4ade80' : j.match_score >= 40 ? '#fbbf24' : '#f87171') + ';font-size:12px">' + j.match_score + '%</span>'
      : '<span style="color:#64748b;font-size:10px">unscored</span>';
    var checked = (j.match_score === null || j.match_score === undefined || j.match_score >= 50) ? ' checked' : '';
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid #334155">' +
      '<input type="checkbox" class="queue-checkbox" value="' + j.id + '"' + checked + '>' +
      '<div style="flex:1"><strong style="font-size:13px">' + esc(j.company) + '</strong> — ' + esc(j.role) +
      '<div style="font-size:11px;color:#64748b">' + esc(j.location) + (j.salary_range ? ' | ' + esc(j.salary_range) : '') + ' | ' + esc(j.platform) + '</div></div>' +
      scoreBadge +
      (j.portal_url ? '<a class="btn btn-sm btn-ghost" href="' + esc(j.portal_url) + '" target="_blank">View</a>' : '') +
      '<button class="btn btn-sm btn-danger" onclick="removeFromQueue(' + j.id + ')">Remove</button>' +
      '</div>';
  }).join('');
}

function selectAllQueue() {
  document.querySelectorAll('.queue-checkbox').forEach(function(c) { c.checked = true; });
}
function deselectAllQueue() {
  document.querySelectorAll('.queue-checkbox').forEach(function(c) { c.checked = false; });
}

async function removeFromQueue(id) {
  await api('/api/applications/' + id, 'DELETE');
  toast('Removed from queue');
  loadAutoQueue();
  loadAutomation();
}

async function scoreQueuedJobs() {
  setLoading('score-queue-btn', true);
  try {
    var result = await api('/api/ai/bulk-score', 'POST');
    toast('Scored ' + result.scored + ' jobs');
    loadAutoQueue();
  } catch (err) {
    toast('Scoring failed: ' + err.message, true);
  } finally {
    setLoading('score-queue-btn', false);
    document.getElementById('score-queue-btn').textContent = 'AI Score Jobs';
  }
}

async function bulkApply() {
  var selectedIds = [];
  document.querySelectorAll('.queue-checkbox:checked').forEach(function(c) {
    selectedIds.push(parseInt(c.value));
  });

  if (selectedIds.length === 0) return toast('Select at least one job', true);

  var templateId = document.getElementById('auto-template').value;
  if (!templateId) return toast('Select a cover letter template', true);

  var sendEmail = document.getElementById('auto-send-email').checked;
  var useAI = document.getElementById('auto-use-ai') ? document.getElementById('auto-use-ai').checked : false;

  showConfirm(
    'Confirm Bulk Apply',
    'Apply to ' + selectedIds.length + ' jobs' + (useAI ? ' with AI personalization' : '') + (sendEmail ? ' and send emails where possible' : '') + '? This will mark them as APPLIED.',
    async function() {
      document.getElementById('bulk-apply-btn').disabled = true;
      document.getElementById('auto-apply-status').innerHTML = '<span class="spinner"></span> Applying to ' + selectedIds.length + ' jobs' + (useAI ? ' (AI mode - may take longer)' : '') + '... please wait';

      try {
        var result = await api('/api/auto/bulk-apply', 'POST', {
          job_ids: selectedIds,
          template_id: parseInt(templateId),
          send_email: sendEmail,
          use_ai: useAI
        });

        document.getElementById('auto-apply-status').innerHTML = '<span style="color:#22c55e">Done! Applied to ' + result.applied + ' jobs</span>';

        document.getElementById('auto-log-section').style.display = 'block';
        document.getElementById('auto-apply-log').innerHTML =
          '<table style="width:100%"><thead><tr><th>Company</th><th>Role</th><th>Email</th><th>Status</th></tr></thead><tbody>' +
          result.results.map(function(r) {
            var emailBadge = r.emailStatus === 'sent' ? '<span class="badge badge-INTERVIEW">Sent</span>' :
                             r.emailStatus === 'skipped' ? '<span class="badge badge-GHOSTED">No email</span>' :
                             '<span class="badge badge-REJECTED">' + esc(r.emailStatus) + '</span>';
            return '<tr><td>' + esc(r.company) + '</td><td>' + esc(r.role) + '</td><td>' + emailBadge + '</td><td><span class="badge badge-APPLIED">APPLIED</span></td></tr>';
          }).join('') + '</tbody></table>';

        toast('Applied to ' + result.applied + ' jobs!');
        loadAutoQueue();
        loadAutomation();
      } catch (err) {
        document.getElementById('auto-apply-status').innerHTML = '<span style="color:#f87171">Error: ' + esc(err.message) + '</span>';
      }

      document.getElementById('bulk-apply-btn').disabled = false;
    }
  );
}

// ============================== INIT ==============================
loadDashboard();
renderResources();
