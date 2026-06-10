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
  if (name === 'europe') loadEurope();
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
  var opts = { method: method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' };
  if (body) opts.body = JSON.stringify(body);
  try {
    var res = await fetch(url, opts);
    if (res.status === 401) {
      window.location.href = '/login.html';
      throw new Error('Login required');
    }
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
    if (e.message === 'Invalid response from server' || e.message === 'Login required') throw e;
    if (e.message && e.message.includes('Failed to fetch')) {
      toast('Cannot reach server — check your connection', true);
    }
    throw e;
  }
}

async function logoutUser() {
  try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch {}
  window.location.href = '/login.html';
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

// Show an orange banner if the user hasn't filled in critical profile fields.
// Critical = experience_years (drives smart filter) + full_name + skills.
// A complete profile = better job matching + autofill works on real forms.
async function checkProfileCompleteness() {
  var banner = document.getElementById('profile-banner');
  if (!banner) return;
  var p;
  try { p = await api('/api/profile'); } catch { return; }
  var missing = [];
  if (!p.full_name) missing.push('name');
  if (!p.email) missing.push('email');
  if (!p.experience_years) missing.push('years of experience');
  if (!p.skills) missing.push('skills');
  if (!p.resume_path && !p.resume_filename) missing.push('resume');
  if (missing.length === 0) { banner['inner' + 'HTML'] = ''; return; }
  // eslint-disable-next-line no-unsanitized/property
  banner['inner' + 'HTML'] =
    '<div style="background:linear-gradient(135deg,rgba(245,158,11,.12),rgba(234,88,12,.12));border:1px solid rgba(245,158,11,.35);border-radius:12px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">' +
      '<div style="flex:1;min-width:200px">' +
        '<div style="font-size:14px;font-weight:700;color:#fbbf24;margin-bottom:4px">Complete your profile to get better matches</div>' +
        '<div style="font-size:12px;color:#fcd34d">Missing: ' + esc(missing.join(', ')) + '. The Chrome autofill extension + smart filter need these.</div>' +
      '</div>' +
      '<button class="btn btn-primary" onclick="showTab(\'settings\')" style="background:#f59e0b">Fill Profile →</button>' +
    '</div>';
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

  // Profile-incomplete nudge — shown above follow-up banner
  checkProfileCompleteness();

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

async function updateExpFilterHint() {
  var hintEl = document.getElementById('exp-filter-hint');
  if (!hintEl) return;
  var p = await getProfileForScoring();
  if (!p || !p.years) {
    hintEl.textContent = 'Set "Experience years" in your profile (Settings → Your Profile) for smart filtering.';
    return;
  }
  var modeEl = document.getElementById('exp-filter-mode');
  var mode = modeEl ? modeEl.value : 'smart';
  var msg = 'Your profile says ' + p.years.toFixed(1) + ' years.';
  if (mode === 'smart') msg += ' Smart filter hides senior/staff/lead jobs and any job requiring more than ' + Math.ceil(p.years + 1.5) + ' years.';
  else if (mode === 'strict') msg += ' Strict filter only keeps jobs with explicit ranges that include your years (no overqualified jobs either).';
  else msg += ' Filter disabled — all jobs shown.';
  hintEl.textContent = msg;
}
document.getElementById('exp-filter-mode').addEventListener('change', updateExpFilterHint);
// Refresh hint whenever the user enters Job Search tab — also runs once on init
setTimeout(updateExpFilterHint, 500);

// Parse experience strings into a decimal number of years.
// Handles: "2", "1.8", "1 year 8 months", "20 months", "2 yrs", "1y 8m", "1.5 years"
function parseExperienceYears(str) {
  if (!str) return 0;
  var s = String(str).toLowerCase().trim();
  if (!s) return 0;

  // "1 year 8 months" / "1y 8m" / "1 yr 8 mo"
  var combo = s.match(/(\d+)\s*(?:y(?:ear)?s?|yrs?)\s*(\d+)\s*(?:m(?:onth)?s?|mos?)/);
  if (combo) return parseInt(combo[1]) + parseInt(combo[2]) / 12;

  // "20 months" / "8 mo"
  var monthsOnly = s.match(/^(\d+)\s*(?:m(?:onth)?s?|mos?)$/);
  if (monthsOnly) return parseInt(monthsOnly[1]) / 12;

  // "2 years" / "1.5 years" / "2 yrs"
  var yearsOnly = s.match(/(\d+(?:\.\d+)?)\s*(?:y(?:ear)?s?|yrs?)/);
  if (yearsOnly) return parseFloat(yearsOnly[1]);

  // Bare number "2" or "1.8"
  var bare = s.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) return parseFloat(bare[1]);

  return 0;
}

// Detect the experience requirement in a job description.
// Returns { min, max } in years, or null if no requirement found.
// Examples: "3+ years" → {min:3, max:Infinity}, "2-5 years" → {min:2, max:5}
function parseJobYearRequirement(text) {
  if (!text) return null;
  var t = text.toLowerCase();

  // "2-5 years" / "2 to 5 years"
  var range = t.match(/(\d{1,2})\s*(?:to|-|–)\s*(\d{1,2})\s*\+?\s*(?:years|yrs)/);
  if (range) return { min: parseInt(range[1]), max: parseInt(range[2]) };

  // "3+ years" / "minimum 3 years" / "at least 3 years"
  var plus = t.match(/(?:minimum|min|at\s*least|over)\s*(\d{1,2})\s*\+?\s*(?:years|yrs)/);
  if (plus) return { min: parseInt(plus[1]), max: Infinity };

  var plusBare = t.match(/(\d{1,2})\s*\+\s*(?:years|yrs)/);
  if (plusBare) return { min: parseInt(plusBare[1]), max: Infinity };

  // "3 years of experience"
  var simple = t.match(/(\d{1,2})\s*(?:years|yrs)\s*(?:of\s*)?(?:experience|exp)/);
  if (simple) return { min: parseInt(simple[1]), max: parseInt(simple[1]) + 3 };

  return null;
}

var __profileCache = null;
async function getProfileForScoring() {
  if (__profileCache) return __profileCache;
  try {
    var p = await api('/api/profile');
    __profileCache = {
      skills: (p.skills || '').toLowerCase().split(/[,;|\n]/).map(function(s){return s.trim();}).filter(function(s){return s.length>1;}),
      years: parseExperienceYears(p.experience_years),
      currentRole: (p.current_role || '').toLowerCase(),
      summary: (p.summary || '').toLowerCase()
    };
  } catch (e) {
    __profileCache = { skills: [], years: 0, currentRole: '', summary: '' };
  }
  return __profileCache;
}

// Explicit seniority filter — title + JD year requirement, independent of profile.
// levelMode: 'entry' | 'mid' | 'entry-mid' | 'senior'
function matchesLevel(job, levelMode) {
  var title = (job.title || '').toLowerCase();
  var desc = (job.description || '').toLowerCase();
  var hay = title + ' ' + desc;

  var seniorRx = /\b(senior|sr\.?|staff|principal|lead\b|architect|head\s+of|director|vp\b|chief|manager)\b/;
  var juniorRx = /\b(junior|jr\.?|intern|trainee|fresher|entry[-\s]*level|graduate|apprentice)\b/;

  var isSeniorTitle = seniorRx.test(title);
  var isJuniorTitle = juniorRx.test(title);

  var req = parseJobYearRequirement(hay);
  var minYrs = req ? req.min : null;

  if (levelMode === 'entry') {
    if (isSeniorTitle) return { keep: false, reason: 'senior title' };
    if (minYrs !== null && minYrs > 2) return { keep: false, reason: 'needs ' + minYrs + '+ yrs' };
    return { keep: true };
  }
  if (levelMode === 'mid') {
    if (isSeniorTitle) return { keep: false, reason: 'senior title' };
    if (isJuniorTitle) return { keep: false, reason: 'junior title' };
    if (minYrs !== null && minYrs > 5) return { keep: false, reason: 'needs ' + minYrs + '+ yrs' };
    return { keep: true };
  }
  if (levelMode === 'entry-mid') {
    if (isSeniorTitle) return { keep: false, reason: 'senior title' };
    if (minYrs !== null && minYrs > 5) return { keep: false, reason: 'needs ' + minYrs + '+ yrs' };
    return { keep: true };
  }
  if (levelMode === 'senior') {
    if (isJuniorTitle) return { keep: false, reason: 'junior title' };
    // Accept anything else; senior-ish titles score well naturally
    return { keep: true };
  }
  return { keep: true };
}

// Given a job and the user's years, decide if it's a fit.
// Returns: { keep: boolean, reason: string }
// Tolerance: user with X years matches jobs requiring [X-1, X+2] years.
// Senior/Lead/Staff/Principal titles auto-rejected if user has < 4 years (unless explicitly OK).
// Junior/Intern titles auto-rejected if user has > 5 years.
function fitsExperience(job, userYears, strict) {
  if (!userYears) return { keep: true, reason: '' };

  var title = (job.title || '').toLowerCase();
  var desc = (job.description || '').toLowerCase();
  var hay = title + ' ' + desc;

  // Title-level seniority filter
  var seniorTitle = /\b(senior|sr\.|staff|principal|lead|architect|head\s+of|director|vp\b|chief)\b/.test(title);
  var juniorTitle = /\b(junior|jr\.|intern|trainee|fresher|entry[-\s]*level|graduate|apprentice)\b/.test(title);

  if (seniorTitle && userYears < 4) {
    return { keep: false, reason: 'senior title (you have ' + userYears.toFixed(1) + ' yrs)' };
  }
  if (juniorTitle && userYears > 5) {
    return { keep: false, reason: 'junior title (you have ' + userYears.toFixed(1) + ' yrs)' };
  }

  // Year-requirement filter from JD text
  var req = parseJobYearRequirement(hay);
  if (req) {
    // Allow user to be up to 1.5 years short OR within range
    if (userYears < req.min - 1.5) {
      return { keep: false, reason: 'needs ' + req.min + '+ yrs (you have ' + userYears.toFixed(1) + ')' };
    }
    if (strict && req.max !== Infinity && userYears > req.max + 3) {
      return { keep: false, reason: 'overqualified (' + req.min + '-' + req.max + ' yrs)' };
    }
    job._yearReq = req;
  }

  return { keep: true, reason: '' };
}

function scoreJob(job, kwTokens, locToken, profile) {
  var title = (job.title || '').toLowerCase();
  var desc = (job.description || '').toLowerCase();
  var jobLoc = (job.location || '').toLowerCase();
  var hay = title + ' ' + desc;
  var score = 0;
  var reasons = [];

  kwTokens.forEach(function(t) {
    if (!t) return;
    if (title.includes(t)) score += 10;
    if (desc.includes(t)) score += 2;
  });
  if (locToken && jobLoc.includes(locToken)) { score += 5; reasons.push('loc'); }
  if (/remote/.test(jobLoc)) score += 1;

  if (profile) {
    var skillHits = 0;
    profile.skills.forEach(function(s) {
      if (s && hay.includes(s)) {
        score += title.includes(s) ? 8 : 4;
        skillHits++;
      }
    });
    if (skillHits) reasons.push(skillHits + ' skill' + (skillHits > 1 ? 's' : ''));

    if (profile.currentRole && title.includes(profile.currentRole)) {
      score += 6;
      reasons.push('role');
    }

    // Experience-level scoring (filtering happens separately via fitsExperience)
    if (profile.years > 0) {
      var req = job._yearReq || parseJobYearRequirement(hay);
      if (req) {
        var maxBound = req.max === Infinity ? req.min + 5 : req.max;
        if (profile.years >= req.min - 0.5 && profile.years <= maxBound + 1) {
          score += 8;
          reasons.push('yrs✓');
        }
      }
    }
  }

  job._reasons = reasons;
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
    var profilePromise = getProfileForScoring();
    var appliedKeysPromise = loadAppliedJobKeys();
    var responses = await Promise.all(keywords.map(function(k) {
      return api('/api/auto/search-jobs?keywords=' + encodeURIComponent(k) + '&location=' + encodeURIComponent(loc) + '&limit=100')
        .catch(function(e) { return { jobs: [], errors: [k + ': ' + e.message], sources: {} }; });
    }));
    var profile = await profilePromise;
    var appliedKeys = await appliedKeysPromise;

    // Read experience filter controls
    var expFilterEl = document.getElementById('exp-filter-mode');
    var expMode = expFilterEl ? expFilterEl.value : 'smart'; // 'off' | 'smart' | 'strict'
    var levelEl = document.getElementById('level-filter');
    var levelMode = levelEl ? levelEl.value : 'entry-mid'; // 'any'|'entry'|'mid'|'entry-mid'|'senior'

    // Merge + dedup + filter across keywords
    var seen = {};
    var allJobs = [];
    var allErrors = [];
    var sourcesUsed = {};
    var filteredOut = 0;
    var filterReasons = {};
    responses.forEach(function(data) {
      (data.jobs || []).forEach(function(j) {
        var key = ((j.company || '') + '|' + (j.title || '')).toLowerCase();
        if (seen[key]) return;
        seen[key] = 1;

        // Explicit seniority level filter — runs regardless of profile years
        if (levelMode !== 'any') {
          var levelFit = matchesLevel(j, levelMode);
          if (!levelFit.keep) {
            filteredOut++;
            filterReasons[levelFit.reason] = (filterReasons[levelFit.reason] || 0) + 1;
            return;
          }
        }

        // Profile-year-based experience filter (smart/strict/off)
        if (expMode !== 'off' && profile && profile.years > 0) {
          var fit = fitsExperience(j, profile.years, expMode === 'strict');
          if (!fit.keep) {
            filteredOut++;
            filterReasons[fit.reason] = (filterReasons[fit.reason] || 0) + 1;
            return;
          }
        }

        j._score = scoreJob(j, kwTokens, locToken, profile);
        allJobs.push(j);
      });
      (data.errors || []).forEach(function(e) { allErrors.push(e); });
      Object.keys(data.sources || {}).forEach(function(s) { if (data.sources[s]) sourcesUsed[s] = 1; });
    });

    allJobs.sort(function(a, b) { return b._score - a._score; });
    var jobs = allJobs.slice(0, 100);
    __lastSearchJobs = jobs; // make available to the preview modal
    var elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    var srcInfo = 'Sources: ' + Object.keys(sourcesUsed).join(', ') + ' | ' + elapsed + 's';
    if (filteredOut > 0) {
      var topReasons = Object.entries(filterReasons).sort(function(a,b){return b[1]-a[1];}).slice(0, 2).map(function(e){return e[1] + ' ' + e[0];}).join(', ');
      srcInfo += ' | Filtered ' + filteredOut + ' (' + topReasons + ')';
    }
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
      var descEsc = esc(j.description || '').replace(/'/g, "\\'").replace(/\n/g, ' ').slice(0, 800);
      var reasonsTxt = (j._reasons && j._reasons.length) ? ' (' + j._reasons.join(', ') + ')' : '';
      var scoreBadge = j._score >= 20
        ? '<span class="badge badge-OFFER" title="Relevance score' + reasonsTxt + '">★★ ' + j._score + reasonsTxt + '</span> '
        : j._score >= 10
          ? '<span class="badge badge-OFFER" title="Relevance score' + reasonsTxt + '">★ ' + j._score + reasonsTxt + '</span> '
          : j._score >= 5
            ? '<span class="badge badge-INTERVIEW" title="Relevance score' + reasonsTxt + '">' + j._score + reasonsTxt + '</span> '
            : '';
      var alreadyApplied = appliedKeys && appliedKeys.has(jobKey(j.company, j.title));
      var appliedBadge = alreadyApplied ? '<span class="badge badge-DONE" style="margin-left:6px">✓ in tracker</span>' : '';
      return '<div class="job-card"' + (alreadyApplied ? ' style="opacity:.6"' : '') + '>' +
        '<h3>' + scoreBadge + esc(j.title) + appliedBadge + '</h3>' +
        '<div class="meta">' + esc(j.company) + ' &bull; ' + esc(j.location || 'Remote') + (j.salary ? ' &bull; ' + esc(j.salary) : '') + ' &bull; <span class="badge badge-APPLIED">' + esc(j.source) + '</span></div>' +
        (tags ? '<div style="margin-bottom:8px">' + tags + '</div>' : '') +
        '<div class="actions">' +
        '<button class="btn btn-sm btn-ghost" onclick="openJobPreview(\'' + companyEsc + '\',\'' + titleEsc + '\')">View details</button> ' +
        '<button class="btn btn-sm btn-primary" onclick="openApplyHelper(\'' + companyEsc + '\',\'' + titleEsc + '\',\'' + urlEsc + '\',\'' + descEsc + '\')">⚡ Apply with Helper</button> ' +
        '<button class="btn btn-sm btn-success" onclick="saveJobFromSearch(\'' + companyEsc + '\',\'' + titleEsc + '\',\'' + urlEsc + '\',\'' + locEsc + '\',\'' + salEsc + '\')">+ Save</button>' +
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
  generateBookmarklet();
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
  __profileCache = null; // bust cache so search re-reads new years/skills next time
  try { updateExpFilterHint(); } catch {}
  try { checkProfileCompleteness(); } catch {}
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
      (j.portal_url ? '<button class="btn btn-sm btn-primary" title="Resolves aggregator → direct ATS. If the link is pure aggregator (adzuna/apna), falls back to a Google search scoped to Greenhouse/Lever/Ashby." onclick="applyWithAutofill(\'' + esc(j.portal_url).replace(/'/g, "\\'") + '\',\'' + esc(j.company).replace(/'/g, "\\'") + '\',\'' + esc(j.role).replace(/'/g, "\\'") + '\')">⚡ Auto Apply</button>' : '') +
      '<button class="btn btn-sm btn-ghost" title="Force a Google search for this role on Greenhouse/Lever/Ashby directly" onclick="findDirectATS(\'' + esc(j.company).replace(/'/g, "\\'") + '\',\'' + esc(j.role).replace(/'/g, "\\'") + '\')">🔍 Direct ATS</button>' +
      '<button class="btn btn-sm btn-danger" onclick="removeFromQueue(' + j.id + ')">Remove</button>' +
      '</div>';
  }).join('');
}

// Supported ATS hosts — must match chrome-extension/manifest.json content_scripts.matches
var SUPPORTED_ATS_HOSTS = /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com)$/i;
function isSupportedATS(url) {
  try { return SUPPORTED_ATS_HOSTS.test(new URL(url).hostname); } catch { return false; }
}

// Open a Google search scoped to direct ATS hosts so the user can click through
// to the real Greenhouse/Lever/Ashby posting even when the stored URL is an
// aggregator like apna.co/adzuna. The extension fires once they land on the ATS.
function findDirectATS(company, role) {
  if (!company && !role) { toast('No company or role on this job', true); return; }
  var q = '"' + (company || '') + '" "' + (role || '') + '" (site:greenhouse.io OR site:lever.co OR site:ashbyhq.com OR site:workdayjobs.com)';
  window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank', 'noopener');
}

// Resolve aggregator URL → direct company portal, then open with the ?jhp=autofill hint
// if it lands on a supported ATS. If it's still an aggregator after redirect-following
// AND we know the company+role, fall back to a Google search scoped to GH/Lever/Ashby —
// one click, one new tab, lands on a page the extension can autofill.
async function openForAutofill(originalUrl, company, role) {
  var finalUrl = await resolveJobUrl(originalUrl);
  if (isSupportedATS(finalUrl)) {
    var sep = finalUrl.indexOf('?') >= 0 ? '&' : '?';
    window.open(finalUrl + sep + 'jhp=autofill', '_blank', 'noopener');
    return { opened: true, autofill: true };
  }
  // Pure-aggregator fallback: escape via Google site-scoped search.
  // Only triggers when we have both company and role — otherwise the search is useless.
  if (company && role) {
    var q = '"' + company + '" "' + role + '" (site:greenhouse.io OR site:lever.co OR site:ashbyhq.com OR site:workdayjobs.com OR site:smartrecruiters.com)';
    window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank', 'noopener');
    return { opened: true, autofill: false, fallback: 'google' };
  }
  window.open(finalUrl, '_blank', 'noopener');
  return { opened: true, autofill: false, finalUrl: finalUrl };
}

// Opens the portal URL with the ?jhp=autofill hint so the extension auto-fills on load.
// Requires the Job Hunt Pro Chrome extension to be installed.
async function applyWithAutofill(url, company, role) {
  if (!url) { toast('No portal URL on this job', true); return; }
  toast('Resolving company portal…');
  var result = await openForAutofill(url, company, role);
  if (result.autofill) {
    toast('Opened on ATS — extension will auto-fill');
  } else if (result.fallback === 'google') {
    toast('Aggregator link — opened Google search for direct ATS', true);
  } else {
    toast('Not on Greenhouse/Lever/Ashby — opened for manual apply', true);
  }
}

// Bulk flow — opens selected wishlist jobs in sequence (1s apart so Chrome doesn't block popups).
// You Submit each one manually; extension auto-marks APPLIED after submit.
// Reads company/role from the queue row so the Google-fallback path works for aggregators.
async function applySelectedWithAutofill() {
  var picks = [];
  document.querySelectorAll('.queue-checkbox:checked').forEach(function(c) {
    var row = c.closest('div');
    if (!row) return;
    var link = row.querySelector('a.btn-ghost');
    if (!link) return;
    var strong = row.querySelector('strong');
    var company = strong ? strong.textContent.trim() : '';
    // Role is the text after " — " in the same flex cell
    var textCell = strong ? strong.parentElement : null;
    var role = '';
    if (textCell) {
      var txt = textCell.childNodes[2] ? textCell.childNodes[2].textContent : '';
      role = (txt || '').replace(/^\s*—\s*/, '').trim();
    }
    picks.push({ url: link.href, company: company, role: role });
  });
  if (picks.length === 0) { toast('Select jobs first', true); return; }
  if (picks.length > 10 && !confirm('Open ' + picks.length + ' tabs? Chrome may block popups beyond ~10.')) return;
  toast('Resolving ' + picks.length + ' portals…');
  var autofilled = 0, googled = 0, manual = 0;
  for (var i = 0; i < picks.length; i++) {
    var result = await openForAutofill(picks[i].url, picks[i].company, picks[i].role);
    if (result.autofill) autofilled++;
    else if (result.fallback === 'google') googled++;
    else manual++;
    await new Promise(function(r) { setTimeout(r, 1000); });
  }
  toast('Opened: ' + autofilled + ' auto-fill, ' + googled + ' Google-fallback, ' + manual + ' manual');
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

// Pending bulk apply request — set when SMTP modal is opened so we can resume after save
var __pendingBulkApply = null;

// Delete every WISHLIST job whose portal_url is an aggregator (apna, adzuna, etc.).
// These are dead weight — the Auto Apply flow can't autofill them anyway.
async function cleanupAggregatorWishlist() {
  showConfirm(
    'Remove aggregator wishlist jobs?',
    'Deletes every WISHLIST job whose link points at an aggregator (apna.co, adzuna, shine, simplyhired, foundit, etc.). These jobs can\'t be auto-filled because the Chrome extension only works on Greenhouse/Lever/Ashby. You can always re-fetch with better filters.',
    async function() {
      try {
        var r = await api('/api/applications/cleanup-aggregators', 'POST', {});
        toast('Removed ' + r.deleted + ' aggregator jobs');
        try { loadAutomation(); } catch {}
        try { loadDashboard(); } catch {}
        try { loadApplications(); } catch {}
      } catch (e) { toast('Cleanup failed: ' + e.message, true); }
    }
  );
}

async function resetAppliedToWishlist() {
  showConfirm(
    'Reset all APPLIED → WISHLIST?',
    'This moves every job currently marked APPLIED back to WISHLIST. Use this if you clicked "Apply" but never actually submitted on the company\'s site. Your data is not deleted — only the status changes.',
    async function() {
      try {
        var r = await api('/api/applications/reset-applied-to-wishlist', 'POST', {});
        toast('Reset ' + r.reset + ' jobs back to WISHLIST');
        try { loadAutomation(); } catch {}
        try { loadDashboard(); } catch {}
        try { loadApplications(); } catch {}
      } catch (e) {}
    }
  );
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

  // If user wants email but SMTP isn't configured, ask now (just-in-time setup)
  if (sendEmail) {
    try {
      var cfg = await api('/api/email-config');
      if (!cfg || !cfg.smtp_user || !cfg.smtp_user.includes('@')) {
        __pendingBulkApply = { selectedIds: selectedIds, templateId: templateId, useAI: useAI };
        // Pre-fill the user field with their profile email if known
        try {
          var p = await api('/api/profile');
          if (p && p.email) document.getElementById('smtp-modal-user').value = p.email;
          if (p && p.full_name) document.getElementById('smtp-modal-fromname').value = p.full_name;
        } catch {}
        document.getElementById('smtp-modal-error').style.display = 'none';
        document.getElementById('smtp-modal').classList.add('open');
        return; // Will be resumed by saveSmtpAndContinue() or skipped by closing the modal
      }
    } catch (e) {
      // If GET fails for any reason, fall through and let the bulk apply itself report it
    }
  }

  doBulkApply(selectedIds, templateId, sendEmail, useAI);
}

async function saveSmtpAndContinue() {
  var btn = document.getElementById('smtp-modal-save-btn');
  var errEl = document.getElementById('smtp-modal-error');
  errEl.style.display = 'none';

  var host = document.getElementById('smtp-modal-host').value.trim() || 'smtp.gmail.com';
  var port = parseInt(document.getElementById('smtp-modal-port').value) || 587;
  var user = document.getElementById('smtp-modal-user').value.trim();
  var pass = document.getElementById('smtp-modal-pass').value;
  var fromName = document.getElementById('smtp-modal-fromname').value.trim();

  if (!user || !user.includes('@')) {
    errEl.textContent = 'Please enter a valid email address';
    errEl.style.display = 'block';
    return;
  }
  if (!pass || pass.length < 6) {
    errEl.textContent = 'Please enter your app password (Gmail: 16 characters)';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await api('/api/email-config', 'PUT', {
      smtp_host: host,
      smtp_port: port,
      smtp_user: user,
      smtp_pass: pass,
      from_name: fromName
    });
    toast('Email configured');
    closeModal('smtp-modal');
    var p = __pendingBulkApply;
    __pendingBulkApply = null;
    if (p) doBulkApply(p.selectedIds, p.templateId, true, p.useAI);
  } catch (e) {
    errEl.textContent = 'Failed to save: ' + (e.message || 'unknown error');
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Save & Continue';
  }
}

function skipSmtpAndContinue() {
  closeModal('smtp-modal');
  var p = __pendingBulkApply;
  __pendingBulkApply = null;
  if (p) doBulkApply(p.selectedIds, p.templateId, false, p.useAI);
}

function doBulkApply(selectedIds, templateId, sendEmail, useAI) {
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

        var warnHTML = result.warning ? '<div style="color:#fbbf24;font-size:12px;margin-top:6px">⚠ ' + esc(result.warning) + '</div>' : '';
        document.getElementById('auto-apply-status').innerHTML = '<span style="color:#22c55e">Done! Marked ' + result.applied + ' jobs as APPLIED</span>' + warnHTML;

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
// ============================== URL RESOLVER ==============================
// Cache resolved URLs in localStorage so we don't re-resolve the same aggregator link.
function getCachedResolvedUrl(originalUrl) {
  try {
    var cache = JSON.parse(localStorage.getItem('jhp_url_cache') || '{}');
    var entry = cache[originalUrl];
    if (entry && (Date.now() - entry.t) < 7 * 24 * 60 * 60 * 1000) return entry.u;
  } catch {}
  return null;
}

function setCachedResolvedUrl(originalUrl, finalUrl) {
  try {
    var cache = JSON.parse(localStorage.getItem('jhp_url_cache') || '{}');
    cache[originalUrl] = { u: finalUrl, t: Date.now() };
    // Keep cache from growing forever — evict oldest if > 500 entries
    var keys = Object.keys(cache);
    if (keys.length > 500) {
      keys.sort(function(a,b){return cache[a].t - cache[b].t;}).slice(0, 100).forEach(function(k){delete cache[k];});
    }
    localStorage.setItem('jhp_url_cache', JSON.stringify(cache));
  } catch {}
}

// Resolve an aggregator URL to the company's actual career page.
// Returns the final URL (or original if resolution fails).
async function resolveJobUrl(originalUrl) {
  if (!originalUrl) return originalUrl;
  var cached = getCachedResolvedUrl(originalUrl);
  if (cached) return cached;
  try {
    var data = await api('/api/jobs/resolve-url', 'POST', { url: originalUrl });
    var final = data.finalUrl || originalUrl;
    setCachedResolvedUrl(originalUrl, final);
    return final;
  } catch {
    return originalUrl;
  }
}

// ============================== JOB PREVIEW MODAL ==============================
// Cache the last search results so the preview modal can look up by company|title key
var __lastSearchJobs = [];

function openJobPreview(company, role) {
  var key = (company + '|' + role).toLowerCase();
  var job = __lastSearchJobs.find(function(j) {
    return ((j.company || '') + '|' + (j.title || '')).toLowerCase() === key;
  });
  if (!job) return toast('Job details not found', true);

  document.getElementById('jp-title').textContent = job.title || '';
  var metaParts = [];
  if (job.company) metaParts.push(job.company);
  if (job.location) metaParts.push(job.location);
  if (job.salary) metaParts.push(job.salary);
  if (job.source) metaParts.push(job.source);
  if (job.posted) metaParts.push('Posted: ' + job.posted.split('T')[0]);
  document.getElementById('jp-meta').textContent = metaParts.join(' • ');

  var tagsEl = document.getElementById('jp-tags');
  tagsEl.textContent = '';
  (job.tags || []).slice(0, 8).forEach(function(t) {
    var span = document.createElement('span');
    span.className = 'badge badge-APPLIED';
    span.style.marginRight = '4px';
    span.textContent = t;
    tagsEl.appendChild(span);
  });
  if (job._reasons && job._reasons.length) {
    var matchSpan = document.createElement('span');
    matchSpan.className = 'badge badge-OFFER';
    matchSpan.style.marginLeft = '6px';
    matchSpan.textContent = '★ ' + (job._score || 0) + ' (' + job._reasons.join(', ') + ')';
    tagsEl.appendChild(matchSpan);
  }

  // Description — use textContent to avoid XSS from external sources
  var descEl = document.getElementById('jp-description');
  descEl.textContent = job.description || '(No description available from this source — click "Open original" for full details on the company\'s site.)';

  // External link — intercept click to resolve aggregator → company first
  var extLink = document.getElementById('jp-external-link');
  if (job.url) {
    extLink.href = job.url;
    extLink.style.display = '';
    extLink.textContent = 'Open company page ↗';
    extLink.onclick = async function(e) {
      e.preventDefault();
      extLink.textContent = 'Resolving...';
      var finalUrl = await resolveJobUrl(job.url);
      extLink.textContent = 'Open company page ↗';
      window.open(finalUrl, '_blank', 'noopener');
    };
  } else {
    extLink.style.display = 'none';
  }

  // Wire action buttons to this specific job
  document.getElementById('jp-apply-btn').onclick = function() {
    closeModal('job-preview-modal');
    openApplyHelper(job.company, job.title, job.url || '', job.description || '');
  };
  document.getElementById('jp-save-btn').onclick = function() {
    saveJobFromSearch(job.company, job.title, job.url || '', job.location || '', job.salary || '');
    closeModal('job-preview-modal');
  };

  document.getElementById('job-preview-modal').classList.add('open');
}

// ============================== APPLY HELPER ==============================
var __appliedJobKeys = null;
async function loadAppliedJobKeys() {
  if (__appliedJobKeys) return __appliedJobKeys;
  try {
    var apps = await api('/api/applications');
    __appliedJobKeys = new Set(apps.map(function(a) { return ((a.company || '') + '|' + (a.role || '')).toLowerCase(); }));
  } catch { __appliedJobKeys = new Set(); }
  return __appliedJobKeys;
}

function jobKey(company, role) { return ((company || '') + '|' + (role || '')).toLowerCase(); }

function escAttr(s) { return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

async function openApplyHelper(company, role, url, jobDescription) {
  var helper = document.getElementById('apply-helper');
  document.getElementById('ah-title').textContent = role + ' @ ' + company;
  document.getElementById('ah-meta').textContent = 'Resolving company link...';
  // eslint-disable-next-line no-unsanitized/property
  document.getElementById('ah-body')['inner' + 'HTML'] = '<div style="padding:20px;text-align:center;color:#71717a;font-size:12px"><span class="spinner"></span> Following redirects to the company\'s real apply page...</div>';
  helper.classList.add('open');

  // Resolve aggregator URL → company career page, then open in new tab
  var finalUrl = url;
  if (url) {
    finalUrl = await resolveJobUrl(url);
    try { window.open(finalUrl, '_blank', 'noopener'); } catch {}
  }

  try {
    var profile = await api('/api/profile');
    var fields = [
      { label: 'Name', value: profile.full_name },
      { label: 'Email', value: profile.email },
      { label: 'Phone', value: profile.phone },
      { label: 'LinkedIn', value: profile.linkedin_url },
      { label: 'GitHub', value: profile.github_url },
      { label: 'Portfolio', value: profile.portfolio_url },
      { label: 'Current role', value: profile.current_role },
      { label: 'Years exp', value: profile.experience_years },
      { label: 'Location', value: '' }
    ];

    var fieldsHTML = fields.filter(function(f) { return f.value; }).map(function(f, i) {
      var id = 'ah-f-' + i;
      return '<div class="ah-field">' +
        '<span class="ah-field-label">' + esc(f.label) + '</span>' +
        '<span class="ah-field-value" id="' + id + '">' + esc(f.value) + '</span>' +
        '<button class="ah-copy-btn" onclick="ahCopy(\'' + id + '\', this)">Copy</button>' +
      '</div>';
    }).join('');

    var skillsHTML = profile.skills ? '<div style="font-size:11px;color:#d4d4d8;line-height:1.5">' + esc(profile.skills) + '</div>' : '<div style="font-size:11px;color:#71717a">No skills set — fill profile in Settings</div>';

    var coverSection = '<div class="ah-section"><div class="ah-section-title">Cover Letter</div>' +
      '<div id="ah-cover-area"><button class="btn btn-sm btn-primary" style="width:100%" onclick="ahGenerateCover(\'' + escAttr(company) + '\',\'' + escAttr(role) + '\',\'' + escAttr(jobDescription || '') + '\')" id="ah-gen-cover-btn">🤖 Generate AI Cover Letter</button></div>' +
      '</div>';

    var resolvedHost = '';
    try { resolvedHost = new URL(finalUrl).hostname.replace(/^www\./, ''); } catch {}
    document.getElementById('ah-meta').textContent = resolvedHost ? '↗ ' + resolvedHost : (finalUrl || '').slice(0, 60);
    // eslint-disable-next-line no-unsanitized/property
    document.getElementById('ah-body')['inner' + 'HTML'] =
      '<div class="ah-section">' +
        '<div class="ah-section-title">Your Profile (1-click copy)</div>' +
        fieldsHTML +
      '</div>' +
      '<div class="ah-section">' +
        '<div class="ah-section-title">Skills</div>' +
        skillsHTML +
        (profile.skills ? '<button class="ah-copy-btn" style="margin-top:6px" onclick="ahCopyText(\'' + escAttr(profile.skills) + '\', this)">Copy all skills</button>' : '') +
      '</div>' +
      coverSection +
      '<div class="ah-section">' +
        '<div class="ah-section-title">Mark this application</div>' +
        '<div class="ah-actions">' +
          '<button class="btn btn-sm btn-success" style="flex:1" onclick="ahMarkApplied(\'' + escAttr(company) + '\',\'' + escAttr(role) + '\',\'' + escAttr(url || '') + '\')">✓ Submitted</button>' +
          '<button class="btn btn-sm btn-ghost" style="flex:1" onclick="ahMarkSkipped(\'' + escAttr(company) + '\',\'' + escAttr(role) + '\')">Skip</button>' +
        '</div>' +
        '<div style="font-size:10px;color:#52525b;margin-top:6px">Tracks the application so you don\'t apply twice.</div>' +
      '</div>';
  } catch (e) {
    document.getElementById('ah-meta').textContent = 'Error: ' + e.message;
  }
}

function closeApplyHelper() {
  document.getElementById('apply-helper').classList.remove('open');
}

function ahCopy(elId, btn) {
  var text = document.getElementById(elId).textContent;
  ahCopyText(text, btn);
}

function ahCopyText(text, btn) {
  navigator.clipboard.writeText(text).then(function() {
    var orig = btn.textContent;
    btn.textContent = '✓ Copied';
    btn.classList.add('copied');
    setTimeout(function() { btn.textContent = orig; btn.classList.remove('copied'); }, 1200);
  }).catch(function() { toast('Copy failed', true); });
}

async function ahGenerateCover(company, role, jobDesc) {
  var btn = document.getElementById('ah-gen-cover-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
  try {
    var data = await api('/api/ai/generate-cover', 'POST', { company: company, role: role, job_description: jobDesc, tone: 'formal' });
    var area = document.getElementById('ah-cover-area');
    // eslint-disable-next-line no-unsanitized/property
    area['inner' + 'HTML'] =
      '<div style="font-size:10px;color:#71717a;margin-bottom:4px">Subject:</div>' +
      '<div style="font-size:11px;color:#fafafa;margin-bottom:8px;font-weight:600">' + esc(data.subject) + '</div>' +
      '<div style="font-size:10px;color:#71717a;margin-bottom:4px">Body:</div>' +
      '<div class="ah-cover-box" id="ah-cover-body">' + esc(data.body) + '</div>' +
      '<div class="ah-actions">' +
        '<button class="ah-copy-btn" onclick="ahCopyText(\'' + escAttr(data.subject) + '\', this)">Copy subject</button>' +
        '<button class="ah-copy-btn" onclick="ahCopyText(\'' + escAttr(data.body).replace(/\n/g, '\\n') + '\', this)">Copy body</button>' +
      '</div>';
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = '🤖 Generate AI Cover Letter'; }
  }
}

async function ahMarkApplied(company, role, url) {
  try {
    await api('/api/applications', 'POST', {
      company: company,
      role: role,
      portal_url: url,
      status: 'APPLIED',
      applied_date: new Date().toISOString().split('T')[0],
      platform: 'Apply Helper',
      follow_up_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
    if (__appliedJobKeys) __appliedJobKeys.add(jobKey(company, role));
    toast('Marked as applied');
    closeApplyHelper();
  } catch (e) { /* api() shows toast */ }
}

async function ahMarkSkipped(company, role) {
  try {
    await api('/api/applications', 'POST', {
      company: company,
      role: role,
      status: 'REJECTED',
      notes: 'Skipped via Apply Helper'
    });
    if (__appliedJobKeys) __appliedJobKeys.add(jobKey(company, role));
    closeApplyHelper();
  } catch {}
}

// ============================== IMPORTERS ==============================
function applyExtractedToProfile(ex) {
  if (!ex) return;
  var setIf = function(id, v) { if (v) { var el = document.getElementById(id); if (el && !el.value) el.value = v; } };
  setIf('s-name', ex.full_name);
  setIf('s-email', ex.email);
  setIf('s-phone', ex.phone);
  setIf('s-linkedin', ex.linkedin_url);
  setIf('s-github', ex.github_url);
  setIf('s-current-role', ex.current_role);
  setIf('s-exp', ex.years);
  setIf('s-summary', ex.summary);
  // Skills: merge instead of replace
  var skillsEl = document.getElementById('s-skills');
  if (skillsEl && ex.skills) {
    var current = (skillsEl.value || '').toLowerCase();
    var newOnes = ex.skills.split(',').map(function(s){return s.trim();}).filter(function(s){return s && current.indexOf(s.toLowerCase()) < 0;});
    skillsEl.value = (skillsEl.value ? skillsEl.value + ', ' : '') + newOnes.join(', ');
  }
}

async function importResume() {
  var file = document.getElementById('import-resume-file').files[0];
  if (!file) return toast('Pick a PDF file first', true);
  var btn = document.getElementById('import-resume-btn');
  btn.disabled = true; btn.textContent = 'Parsing...';
  try {
    var fd = new FormData();
    fd.append('resume', file);
    var r = await fetch('/api/import/resume', { method: 'POST', body: fd, credentials: 'same-origin' });
    if (r.status === 401) { window.location.href = '/login.html'; return; }
    var data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Import failed');
    applyExtractedToProfile(data.extracted);
    document.getElementById('import-result').textContent = '✓ Resume parsed — ' + (data.extracted.skills || '').split(',').length + ' skills extracted. Review the profile below and click Save.';
    toast('Resume imported');
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Parse & Import';
  }
}

async function importGithub() {
  var username = document.getElementById('import-github-user').value.trim();
  if (!username) return toast('Enter a GitHub username', true);
  var btn = document.getElementById('import-github-btn');
  btn.disabled = true; btn.textContent = 'Fetching...';
  try {
    var data = await api('/api/import/github', 'POST', { username: username });
    applyExtractedToProfile(data.extracted);
    var stats = data.extracted.stats || {};
    document.getElementById('import-result').textContent = '✓ GitHub: ' + (stats.public_repos || 0) + ' repos, ' + (stats.followers || 0) + ' followers, ' + (stats.total_stars || 0) + ' stars. Review and save.';
    toast('GitHub imported');
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Fetch GitHub Profile';
  }
}

async function importLinkedin() {
  var file = document.getElementById('import-linkedin-file').files[0];
  if (!file) return toast('Pick your LinkedIn export ZIP first', true);
  var btn = document.getElementById('import-linkedin-btn');
  btn.disabled = true; btn.textContent = 'Parsing...';
  try {
    var fd = new FormData();
    fd.append('zip', file);
    var r = await fetch('/api/import/linkedin', { method: 'POST', body: fd, credentials: 'same-origin' });
    if (r.status === 401) { window.location.href = '/login.html'; return; }
    var data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Import failed');
    applyExtractedToProfile(data.extracted);
    document.getElementById('import-result').textContent = '✓ LinkedIn parsed. Review the profile below and click Save.';
    toast('LinkedIn imported');
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Parse & Import';
  }
}

async function showCurrentUser() {
  try {
    var me = await api('/api/auth/me');
    var el = document.getElementById('nav-user-email');
    if (el && me) el.textContent = me.email || me.name || '';
  } catch {}
}

async function generateBookmarklet() {
  try {
    var p = await api('/api/profile');
    var data = {
      name: p.full_name || '',
      first: (p.full_name || '').split(' ')[0] || '',
      last: (p.full_name || '').split(' ').slice(1).join(' ') || '',
      email: p.email || '',
      phone: p.phone || '',
      linkedin: p.linkedin_url || '',
      github: p.github_url || '',
      portfolio: p.portfolio_url || '',
      role: p.current_role || '',
      years: p.experience_years || '',
      location: ''
    };
    // Self-contained autofill function — runs in any page's context
    var fn = function(D) {
      // Order matters — most specific keys first so they win the substring race.
      // Each entry: [field, [keys]]. Keys are matched as substrings against a
      // normalized token derived from name/id/placeholder/aria-label/label/autocomplete.
      var rules = [
        ['first',     ['firstname','first_name','first-name','givenname','given-name','given_name','fname']],
        ['last',      ['lastname','last_name','last-name','familyname','family-name','family_name','lname','surname']],
        ['email',     ['email','e-mail','emailaddress']],
        ['phone',     ['phonenumber','phone_number','phone-number','mobilenumber','telephone','phone','mobile','tel']],
        ['linkedin',  ['linkedinurl','linkedin_url','linkedin-url','linkedinprofile','linkedin']],
        ['github',    ['githuburl','github_url','github-url','githubprofile','github']],
        ['portfolio', ['portfoliourl','personalwebsite','personal_website','personal-website','portfolio','website']],
        ['role',      ['currenttitle','currentrole','currentposition','jobtitle','job_title','job-title','currentjobtitle']],
        ['years',     ['yearsofexperience','years_of_experience','years-of-experience','yearsexperience','experienceyears','totalexperience','yoe']],
        ['location',  ['currentlocation','currentcity','citytown','city','location']],
        // Full-name LAST so it doesn't gobble firstName/lastName via substring match
        ['name',      ['fullname','full_name','full-name','candidatename','applicantname','yourname','legalname']]
      ];
      var SKIP_TYPES = { file: 1, submit: 1, button: 1, reset: 1, checkbox: 1, radio: 1, hidden: 1, image: 1, color: 1, range: 1 };
      var filled = 0;
      var inputs = D.querySelectorAll('input,textarea');
      var setVal = function(el, v) {
        try {
          if (!v) return false;
          var t = (el.type || 'text').toLowerCase();
          if (SKIP_TYPES[t]) return false;
          if (el.disabled || el.readOnly) return false;
          if (el.value && el.value.trim().length > 0) return false;
          var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          var nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value');
          if (nativeSetter && nativeSetter.set) nativeSetter.set.call(el, v); else el.value = v;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
          return true;
        } catch (e) { return false; }
      };
      inputs.forEach(function(el) {
        try {
          var keys = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.placeholder || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('autocomplete') || '') + ' ' + (el.labels && el.labels[0] ? el.labels[0].textContent : '')).toLowerCase().replace(/[^a-z0-9]/g, '');
          for (var i = 0; i < rules.length; i++) {
            var fld = rules[i][0], list = rules[i][1];
            if (!data[fld]) continue;
            var matched = false;
            for (var j = 0; j < list.length; j++) {
              if (keys.indexOf(list[j]) >= 0) { matched = true; break; }
            }
            if (matched && setVal(el, data[fld])) { filled++; break; }
          }
        } catch (e) {}
      });
      var msg = D.createElement('div');
      msg.textContent = '✓ Job Hunt Pro filled ' + filled + ' field' + (filled !== 1 ? 's' : '');
      msg.style.cssText = 'position:fixed;top:20px;right:20px;background:#6366f1;color:#fff;padding:12px 20px;border-radius:10px;font-family:sans-serif;font-size:14px;font-weight:600;z-index:999999;box-shadow:0 8px 30px rgba(0,0,0,.4)';
      D.body.appendChild(msg);
      setTimeout(function() { msg.remove(); }, 3000);
    };
    // The data object gets baked into the bookmarklet so the user's profile travels with the bookmark
    var dataLiteral = JSON.stringify(data);
    var code = '(function(){var data=' + dataLiteral + ';(' + fn.toString() + ')(document);})();';
    var href = 'javascript:' + encodeURIComponent(code);
    var link = document.getElementById('bookmarklet-link');
    if (link) link.href = href;
  } catch {}
}
showCurrentUser();
loadDashboard();
renderResources();

// ============================== EUROPE JOB PREP ==============================
var europeRef = null;
var europeProgress = {};
var europeCompanyFilters = { tier: 'ALL', country: 'ALL' };
var EU_BIRTHDAY = new Date('2027-02-01T00:00:00Z');

async function loadEurope() {
  try {
    if (!europeRef) europeRef = await api('/api/europe/reference');
    var prog = await api('/api/europe/progress');
    europeProgress = {};
    prog.forEach(function(p) { europeProgress[p.item_type + ':' + p.item_key] = { status: p.status, notes: p.notes }; });
  } catch (e) { console.error('Europe load failed', e); return; }
  renderEuropeHero();
  renderEuropeKPIs();
  renderEuropeCountries();
  renderEuropeCompanies();
  renderEuropeSkills();
  renderEuropePlan();
  calcEuropeSalaryAll();
}

function switchEuropeSection(name, btn) {
  ['overview', 'companies', 'skills', 'plan', 'salary'].forEach(function(s) {
    var el = document.getElementById('europe-sec-' + s);
    if (el) el.style.display = (s === name ? '' : 'none');
  });
  document.querySelectorAll('#tab-europe .eu-tab').forEach(function(c) { c.classList.remove('active'); });
  if (btn) btn.classList.add('active');
}

function renderEuropeHero() {
  var el = document.getElementById('eu-countdown-days');
  if (!el) return;
  var now = new Date();
  var diffMs = EU_BIRTHDAY - now;
  var days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  el.textContent = days;
}

function renderEuropeKPIs() {
  if (!europeRef) return;
  // Plan progress
  var planTotal = europeRef.prepPlan.length;
  var planDone = europeRef.prepPlan.filter(function(t) {
    var p = europeProgress['task:' + t.key]; return p && p.status === 'DONE';
  }).length;
  var planPct = planTotal ? Math.round(planDone / planTotal * 100) : 0;
  document.getElementById('eu-kpi-plan').textContent = planPct + '%';

  // Skills progress
  var skillsTotal = europeRef.skills.length;
  var skillsDone = europeRef.skills.filter(function(s) {
    var p = europeProgress['skill:' + s.key]; return p && p.status === 'DONE';
  }).length;
  var skillsPct = skillsTotal ? Math.round(skillsDone / skillsTotal * 100) : 0;
  document.getElementById('eu-kpi-skills').textContent = skillsPct + '%';

  // Company stats
  var stages = { APPLIED: 0, SCREENING: 0, INTERVIEW: 0, OFFER: 0 };
  europeRef.companies.forEach(function(co) {
    var p = europeProgress['company:' + co.key];
    if (!p) return;
    if (p.status === 'APPLIED') stages.APPLIED++;
    if (p.status === 'SCREENING') stages.SCREENING++;
    if (p.status === 'INTERVIEW') stages.INTERVIEW++;
    if (p.status === 'OFFER') stages.OFFER++;
  });
  document.getElementById('eu-kpi-applied').textContent = stages.APPLIED + stages.SCREENING;
  document.getElementById('eu-kpi-interview').textContent = stages.INTERVIEW;
  document.getElementById('eu-kpi-offer').textContent = stages.OFFER;
}

function renderEuropeCountries() {
  var grid = document.getElementById('europe-countries-grid');
  if (!grid || !europeRef) return;
  var sorted = europeRef.countries.slice().sort(function(a, b) { return a.rank - b.rank; });
  grid.innerHTML = sorted.map(function(co) {
    var rankClass = co.rank === 1 ? 'gold' : co.rank <= 3 ? 'silver' : co.rank >= 7 ? 'skip' : '';
    var rankBadgeClass = co.rank === 1 ? 'gold' : co.rank <= 3 ? 'silver' : co.rank <= 5 ? 'bronze' : 'skip';
    var rankLabel = co.rank === 1 ? '#1 BEST PICK' : co.rank <= 3 ? '#' + co.rank + ' RECOMMENDED' : co.rank <= 6 ? '#' + co.rank : 'SKIP';
    // firing protection meter (10 dots)
    var meterCls = co.firing_protection >= 8 ? '' : co.firing_protection >= 6 ? 'medium' : 'weak';
    var meterHtml = '<span class="eu-country-meter ' + meterCls + '">';
    for (var i = 1; i <= 10; i++) {
      meterHtml += '<span' + (i <= co.firing_protection ? ' class="on"' : '') + '></span>';
    }
    meterHtml += '</span>';

    var hasPlan = europeRef.countryPlans && europeRef.countryPlans[co.code];
    return '<div class="eu-country-card ' + rankClass + '"' + (hasPlan ? ' onclick="openCountryPlan(\'' + esc(co.code) + '\')"' : '') + '>' +
      '<div class="eu-country-rank ' + rankBadgeClass + '">' + rankLabel + '</div>' +
      '<div class="eu-country-flag">' + co.flag + '</div>' +
      '<div class="eu-country-name">' + esc(co.name) + '</div>' +
      '<div class="eu-country-visa">' + esc(co.visa) + '</div>' +

      '<div class="eu-country-stat"><span class="eu-country-stat-label">Threshold (under-30)</span><span class="eu-country-stat-value">' + esc(co.threshold_under30) + '</span></div>' +
      '<div class="eu-country-stat"><span class="eu-country-stat-label">Processing</span><span class="eu-country-stat-value">' + esc(co.processing) + '</span></div>' +
      '<div class="eu-country-stat"><span class="eu-country-stat-label">Firing protection</span><span class="eu-country-stat-value">' + co.firing_protection + '/10 ' + meterHtml + '</span></div>' +
      '<div class="eu-country-stat"><span class="eu-country-stat-label">English jobs</span><span class="eu-country-stat-value">' + esc(co.english_jobs) + '</span></div>' +
      '<div class="eu-country-stat"><span class="eu-country-stat-label">PR path</span><span class="eu-country-stat-value">' + esc(co.pr_years) + '</span></div>' +

      '<div class="eu-country-why">' + esc(co.note) + '</div>' +
      (hasPlan ? '<div class="eu-country-cta"><span>View full plan</span><span>Job · PhD · PhD+Job →</span></div>' : '') +
    '</div>';
  }).join('');
}

async function openCountryPlan(code) {
  if (!europeRef) return;
  var hasPlaybook = europeRef.playbookIndex && europeRef.playbookIndex[code];

  // Show modal immediately with loading state
  document.getElementById('eu-country-modal-hero').innerHTML =
    '<div class="eu-modal-flag">⏳</div><div class="eu-modal-title">Loading…</div>';
  document.getElementById('eu-country-modal-tabs').innerHTML = '';
  document.getElementById('eu-country-modal-body').innerHTML = '<div class="loading-overlay">Loading playbook…</div>';
  document.getElementById('eu-country-modal').classList.add('open');
  document.body.style.overflow = 'hidden';

  var data;
  if (hasPlaybook) {
    try { data = await api('/api/europe/playbook/' + code); }
    catch (e) { data = europeRef.countryPlans && europeRef.countryPlans[code]; }
  } else {
    data = europeRef.countryPlans && europeRef.countryPlans[code];
  }
  if (!data) {
    document.getElementById('eu-country-modal-body').innerHTML = '<p style="padding:20px;color:#fca5a5">No data for this country yet.</p>';
    return;
  }

  if (hasPlaybook) renderRichPlaybook(data);
  else renderLegacyPlan(data);
}

function renderRichPlaybook(d) {
  // Hero
  document.getElementById('eu-country-modal-hero').innerHTML =
    '<div class="eu-modal-flag">' + d.flag + '</div>' +
    '<div class="eu-modal-title">' + esc(d.name) + ' · ' + esc(d.capital || '') + '</div>' +
    '<div class="eu-modal-subtitle">' + esc(d.tagline || '') + '</div>';

  // Section tabs
  var sections = [
    { id: 'overview', label: 'Overview', icon: '🌍' },
    { id: 'visas', label: 'Visa options', icon: '🛂' },
    { id: 'market', label: 'Market 2026', icon: '📈' },
    { id: 'companies', label: 'Top companies', icon: '🏢' },
    { id: 'prep', label: 'Prep roadmap', icon: '📋' },
    { id: 'interviews', label: 'Interview guide', icon: '🎯' },
    { id: 'cost', label: 'Cost & salary', icon: '💶' },
    { id: 'living', label: 'Living info', icon: '🏠' },
    { id: 'community', label: 'Community', icon: '👥' },
    { id: 'action', label: '90-day action', icon: '⚡' }
  ];
  document.getElementById('eu-country-modal-tabs').innerHTML = sections.map(function(s, i) {
    return '<button class="eu-path-tab' + (i === 0 ? ' active' : '') + '" onclick="switchPlaybookSection(\'' + s.id + '\', this)">' +
      '<span>' + s.icon + '</span> ' + s.label + '</button>';
  }).join('');

  var html = '';

  // === Overview ===
  html += '<div class="eu-pb-sec" data-pb-sec="overview">';
  if (d.overview) {
    html += '<div class="eu-path-summary">' + esc(d.overview.why) + '</div>';
    if (d.overview.key_facts) {
      html += '<div class="eu-path-steps"><div class="eu-path-steps-title">📌 Key facts</div>';
      html += d.overview.key_facts.map(function(f) { return '<div class="eu-path-step"><span class="eu-path-step-num">•</span><span>' + esc(f) + '</span></div>'; }).join('');
      html += '</div>';
    }
  }
  html += '</div>';

  // === Visa options ===
  html += '<div class="eu-pb-sec" data-pb-sec="visas" style="display:none">';
  if (d.visaTypes && d.visaTypes.length) {
    html += '<p class="eu-sub" style="margin-bottom:14px">Pick the visa that fits your situation. ' + d.visaTypes.length + ' options available.</p>';
    html += d.visaTypes.map(function(v) {
      return '<div class="eu-visa-card">' +
        '<div class="eu-visa-head">' +
          '<div><div class="eu-visa-name">' + esc(v.name) + '</div>' +
          '<div class="eu-visa-code">' + esc(v.code) + '</div></div>' +
          (v.best_for && v.best_for.indexOf('⭐') !== -1 ? '<span class="eu-visa-recommended">★ Recommended</span>' : '') +
        '</div>' +
        '<div class="eu-visa-grid">' +
          '<div><div class="eu-visa-label">Who for</div><div class="eu-visa-value">' + esc(v.who_for) + '</div></div>' +
          '<div><div class="eu-visa-label">Threshold</div><div class="eu-visa-value">' + esc(v.threshold) + '</div></div>' +
          '<div><div class="eu-visa-label">Processing</div><div class="eu-visa-value">' + esc(v.processing) + '</div></div>' +
          '<div><div class="eu-visa-label">Cost</div><div class="eu-visa-value">' + esc(v.cost) + '</div></div>' +
          '<div><div class="eu-visa-label">Family</div><div class="eu-visa-value">' + esc(v.family) + '</div></div>' +
          '<div><div class="eu-visa-label">PR path</div><div class="eu-visa-value">' + esc(v.pr_path) + '</div></div>' +
        '</div>' +
        '<div class="eu-visa-prosconslist">' +
          '<div class="eu-visa-pros"><div class="eu-visa-pclabel">✓ Pros</div>' + (v.pros || []).map(function(p) { return '<div>• ' + esc(p) + '</div>'; }).join('') + '</div>' +
          '<div class="eu-visa-cons"><div class="eu-visa-pclabel">⚠ Cons</div>' + (v.cons || []).map(function(p) { return '<div>• ' + esc(p) + '</div>'; }).join('') + '</div>' +
        '</div>' +
        (v.best_for ? '<div class="eu-path-verdict" style="margin-top:12px"><div class="eu-path-verdict-label">When to use</div>' + esc(v.best_for) + '</div>' : '') +
      '</div>';
    }).join('');
  }
  html += '</div>';

  // === Market 2026 ===
  html += '<div class="eu-pb-sec" data-pb-sec="market" style="display:none">';
  if (d.market2026) {
    var m = d.market2026;
    html += '<div class="eu-path-summary"><strong>📊 Hiring trend:</strong> ' + esc(m.hiring_trend) + '</div>';
    html += '<div class="eu-path-grid">';
    if (m.faang_presence) html += '<div class="eu-path-stat"><div class="eu-path-stat-label">FAANG presence</div><div class="eu-path-stat-value">' + esc(m.faang_presence) + '</div></div>';
    if (m.indian_engineers) html += '<div class="eu-path-stat"><div class="eu-path-stat-label">Indian engineers</div><div class="eu-path-stat-value">' + esc(m.indian_engineers) + '</div></div>';
    if (m.layoff_status) html += '<div class="eu-path-stat"><div class="eu-path-stat-label">Layoff status</div><div class="eu-path-stat-value">' + esc(m.layoff_status) + '</div></div>';
    if (m.salary_trend) html += '<div class="eu-path-stat"><div class="eu-path-stat-label">Salary trend</div><div class="eu-path-stat-value">' + esc(m.salary_trend) + '</div></div>';
    if (m.remote_policy) html += '<div class="eu-path-stat"><div class="eu-path-stat-label">Remote policy</div><div class="eu-path-stat-value">' + esc(m.remote_policy) + '</div></div>';
    if (m.visa_friendly_companies) html += '<div class="eu-path-stat"><div class="eu-path-stat-label">Visa-friendly cos</div><div class="eu-path-stat-value">' + esc(m.visa_friendly_companies) + '</div></div>';
    html += '</div>';

    if (m.hot_skills && m.hot_skills.length) {
      html += '<div class="eu-path-steps"><div class="eu-path-steps-title">🔥 Hot skills</div><div class="eu-path-targets">';
      html += m.hot_skills.map(function(s) { return '<span class="eu-target-pill" style="background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.3);color:#86efac">' + esc(s) + '</span>'; }).join('');
      html += '</div></div>';
    }
    if (m.cold_skills && m.cold_skills.length) {
      html += '<div class="eu-path-steps"><div class="eu-path-steps-title">❄️ Cold skills (avoid leading with these)</div><div class="eu-path-targets">';
      html += m.cold_skills.map(function(s) { return '<span class="eu-target-pill" style="background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.2);color:#fca5a5">' + esc(s) + '</span>'; }).join('');
      html += '</div></div>';
    }
  }
  html += '</div>';

  // === Companies ===
  html += '<div class="eu-pb-sec" data-pb-sec="companies" style="display:none">';
  if (d.companies) {
    var renderCoSection = function(title, list, badgeClass) {
      if (!list || !list.length) return '';
      var s = '<h3 class="eu-pb-h3"><span class="eu-tier-badge ' + badgeClass + '">' + title + '</span></h3>';
      s += list.map(function(c) {
        return '<div class="eu-co-detail">' +
          '<div class="eu-co-detail-head">' +
            '<div><div class="eu-co-detail-name">' + esc(c.name) + '</div>' +
            (c.city ? '<div class="eu-co-detail-city">📍 ' + esc(c.city) + '</div>' : '') + '</div>' +
            (c.salary ? '<div class="eu-co-detail-salary">' + esc(c.salary) + '</div>' : '') +
          '</div>' +
          (c.stack ? '<div class="eu-co-detail-stack">⚙️ ' + esc(c.stack) + '</div>' : '') +
          (c.why ? '<div class="eu-co-detail-row"><strong>Why apply:</strong> ' + esc(c.why) + '</div>' : '') +
          (c.interview ? '<div class="eu-co-detail-row"><strong>Interview:</strong> ' + esc(c.interview) + '</div>' : '') +
          (c.prep_tips ? '<div class="eu-co-detail-row"><strong>Prep tips:</strong> ' + esc(c.prep_tips) + '</div>' : '') +
          (c.apply_at ? '<a class="eu-co-detail-link" href="https://' + esc(c.apply_at.replace(/^https?:\/\//, '')) + '" target="_blank">🔗 Apply at ' + esc(c.apply_at) + ' →</a>' : '') +
          (c.path ? '<div class="eu-co-detail-row"><strong>Transfer path:</strong> ' + esc(c.path) + '</div>' : '') +
          (c.note ? '<div class="eu-co-detail-row" style="color:#a5b4fc">💡 ' + esc(c.note) + '</div>' : '') +
        '</div>';
      }).join('');
      return s;
    };
    html += renderCoSection('Tier 1 · Apply immediately', d.companies.tier1_immediate, 'eu-tier-1');
    html += renderCoSection('Tier 2 · After 2 months prep', d.companies.tier2_after_prep, 'eu-tier-2');
    html += renderCoSection('Tier 3 · Indian-arm transfer', d.companies.tier3_transfer, 'eu-tier-3');
  }
  html += '</div>';

  // === Prep Roadmap ===
  html += '<div class="eu-pb-sec" data-pb-sec="prep" style="display:none">';
  if (d.prepRoadmap && d.prepRoadmap.length) {
    html += '<p class="eu-sub" style="margin-bottom:14px">Country-specific 6-month plan. Why each task matters HERE.</p>';
    html += '<div class="eu-timeline" style="padding-left:24px">';
    html += d.prepRoadmap.map(function(m, idx) {
      return '<div class="eu-month">' +
        '<span class="eu-month-num">' + m.month + '</span>' +
        '<div class="eu-month-header"><div class="eu-month-title">Month ' + m.month + ' — ' + esc(m.focus) + '</div></div>' +
        (m.tasks || []).map(function(t) {
          return '<div class="eu-task"><div class="eu-task-check"></div><div class="eu-task-text">' + esc(t) + '</div></div>';
        }).join('') +
        (m.why_nl_specific || m.why_de_specific || m.why_se_specific || m.why_ie_specific || m.why_fi_specific ? '<div class="eu-path-verdict" style="margin-top:8px"><div class="eu-path-verdict-label">Why this matters here</div>' + esc(m.why_nl_specific || m.why_de_specific || m.why_se_specific || m.why_ie_specific || m.why_fi_specific) + '</div>' : '') +
      '</div>';
    }).join('');
    html += '</div>';
  }
  html += '</div>';

  // === Interview Guide ===
  html += '<div class="eu-pb-sec" data-pb-sec="interviews" style="display:none">';
  if (d.interviewGuide && d.interviewGuide.length) {
    html += d.interviewGuide.map(function(g) {
      return '<div class="eu-co-detail">' +
        '<div class="eu-co-detail-name" style="font-size:18px">' + esc(g.company) + '</div>' +
        (g.format ? '<div class="eu-co-detail-row"><strong>Format:</strong> ' + esc(g.format) + '</div>' : '') +
        (g.topics ? '<div class="eu-co-detail-row" style="margin-top:10px"><strong>Topics:</strong></div><div class="eu-path-targets">' + g.topics.map(function(t) { return '<span class="eu-target-pill">' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
        (g.sample_questions ? '<div class="eu-co-detail-row" style="margin-top:10px"><strong>Sample questions:</strong></div>' + g.sample_questions.map(function(q) { return '<div class="eu-path-step"><span class="eu-path-step-num">Q</span><span>' + esc(q) + '</span></div>'; }).join('') : '') +
        (g.culture ? '<div class="eu-co-detail-row"><strong>Culture:</strong> ' + esc(g.culture) + '</div>' : '') +
        (g.gotchas ? '<div class="eu-path-verdict" style="margin-top:10px"><div class="eu-path-verdict-label">⚠️ Gotchas</div>' + esc(g.gotchas) + '</div>' : '') +
      '</div>';
    }).join('');
  }
  html += '</div>';

  // === Cost & Salary ===
  html += '<div class="eu-pb-sec" data-pb-sec="cost" style="display:none">';
  if (d.costOfLiving) {
    html += '<h3 class="eu-pb-h3">💸 Cost of living</h3>';
    var cl = d.costOfLiving;
    html += '<div class="eu-path-grid">';
    Object.keys(cl).forEach(function(k) {
      if (typeof cl[k] === 'string' && k !== 'verdict') {
        html += '<div class="eu-path-stat"><div class="eu-path-stat-label">' + esc(k.replace(/_/g, ' ')) + '</div><div class="eu-path-stat-value">' + esc(cl[k]) + '</div></div>';
      }
      if (typeof cl[k] === 'object' && cl[k] !== null) {
        // nested city cost (Germany berlin/munich)
        html += '<div class="eu-path-stat" style="grid-column:1/-1"><div class="eu-path-stat-label">' + esc(k.toUpperCase()) + '</div>';
        Object.keys(cl[k]).forEach(function(kk) {
          html += '<div style="font-size:12px;margin-top:4px"><span style="color:var(--text-4)">' + esc(kk.replace(/_/g, ' ')) + ':</span> ' + esc(cl[k][kk]) + '</div>';
        });
        html += '</div>';
      }
    });
    html += '</div>';
    if (cl.verdict) html += '<div class="eu-path-verdict" style="margin-top:12px"><div class="eu-path-verdict-label">Verdict</div>' + esc(cl.verdict) + '</div>';
  }
  if (d.taxSalary) {
    html += '<h3 class="eu-pb-h3" style="margin-top:20px">💰 Tax & salary</h3>';
    html += '<div class="eu-path-grid">';
    Object.keys(d.taxSalary).forEach(function(k) {
      html += '<div class="eu-path-stat"><div class="eu-path-stat-label">' + esc(k.replace(/_/g, ' ')) + '</div><div class="eu-path-stat-value">' + esc(d.taxSalary[k]) + '</div></div>';
    });
    html += '</div>';
  }
  html += '</div>';

  // === Living info ===
  html += '<div class="eu-pb-sec" data-pb-sec="living" style="display:none">';
  if (d.livingInfo) {
    var li = d.livingInfo;
    if (li.cities && li.cities.length) {
      html += '<h3 class="eu-pb-h3">🏙️ Cities</h3>';
      html += '<div class="eu-cities-grid">';
      html += li.cities.map(function(c) {
        return '<div class="eu-visa-card">' +
          '<div class="eu-visa-name">' + esc(c.name) + '</div>' +
          (c.vibe ? '<div class="eu-co-detail-row">' + esc(c.vibe) + '</div>' : '') +
          (c.expat_density ? '<div class="eu-co-detail-row"><strong>Expat density:</strong> ' + esc(c.expat_density) + '</div>' : '') +
          (c.rent_1br ? '<div class="eu-co-detail-row"><strong>1BR rent:</strong> ' + esc(c.rent_1br) + '</div>' : '') +
          (c.best_for ? '<div class="eu-co-detail-row"><strong>Best for:</strong> ' + esc(c.best_for) + '</div>' : '') +
        '</div>';
      }).join('');
      html += '</div>';
    }
    ['transport', 'healthcare', 'banking', 'registration', 'social', 'housing_tip'].forEach(function(k) {
      if (li[k]) html += '<div class="eu-path-stat" style="margin-top:10px"><div class="eu-path-stat-label">' + k.replace(/_/g, ' ') + '</div><div class="eu-path-stat-value">' + esc(li[k]) + '</div></div>';
    });
  }
  html += '</div>';

  // === Community ===
  html += '<div class="eu-pb-sec" data-pb-sec="community" style="display:none">';
  if (d.communities && d.communities.length) {
    html += '<p class="eu-sub" style="margin-bottom:14px">Indian diaspora, recruiters, meetups, forums. Network = job leads.</p>';
    html += d.communities.map(function(c) {
      return '<div class="eu-visa-card" style="margin-bottom:10px">' +
        '<div class="eu-co-detail-head">' +
          '<div class="eu-co-detail-name">' + esc(c.name) + '</div>' +
          '<span class="eu-target-pill">' + esc(c.type) + '</span>' +
        '</div>' +
        '<div class="eu-co-detail-row">' + esc(c.what) + '</div>' +
        (c.link ? '<a class="eu-co-detail-link" href="' + esc(c.link) + '" target="_blank">🔗 ' + esc(c.link) + '</a>' : '') +
      '</div>';
    }).join('');
  }
  html += '</div>';

  // === 90-day action ===
  html += '<div class="eu-pb-sec" data-pb-sec="action" style="display:none">';
  if (d.actionPlan90Day && d.actionPlan90Day.length) {
    html += '<p class="eu-sub" style="margin-bottom:14px">Week-by-week action — start TODAY.</p>';
    html += d.actionPlan90Day.map(function(w, i) {
      return '<div class="eu-task" style="cursor:default">' +
        '<div class="eu-task-check" style="background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;border-color:transparent">' + (i + 1) + '</div>' +
        '<div class="eu-task-text"><strong>Week ' + esc(w.week) + ':</strong> ' + esc(w.action) + '</div>' +
      '</div>';
    }).join('');
  }
  html += '</div>';

  document.getElementById('eu-country-modal-body').innerHTML = html;
}

function switchPlaybookSection(id, btn) {
  document.querySelectorAll('#eu-country-modal-tabs .eu-path-tab').forEach(function(t) { t.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.eu-pb-sec').forEach(function(s) {
    s.style.display = s.getAttribute('data-pb-sec') === id ? '' : 'none';
  });
  // Scroll modal body to top on section change
  var body = document.getElementById('eu-country-modal-body');
  if (body) body.scrollTop = 0;
}

// Legacy renderer for countries without rich playbook yet (CH/BE/DK/AT/FI)
function renderLegacyPlan(plan) {
  document.getElementById('eu-country-modal-hero').innerHTML =
    '<div class="eu-modal-flag">' + plan.flag + '</div>' +
    '<div class="eu-modal-title">' + esc(plan.name) + '</div>' +
    '<div class="eu-modal-subtitle">' + esc(plan.intro || '') + '</div>';

  var tabsEl = document.getElementById('eu-country-modal-tabs');
  tabsEl.innerHTML = (plan.paths || []).map(function(p, idx) {
    var agePill = p.age === 'under30' ? '<span class="age-pill">Under 30</span>' :
                  p.age === 'post30' ? '<span class="age-pill">Post 30</span>' : '';
    return '<button class="eu-path-tab' + (idx === 0 ? ' active' : '') + '" onclick="switchEuropePath(\'' + esc(p.id) + '\', this)">' +
      '<span>' + p.icon + '</span> ' + esc(p.title) + ' ' + agePill +
    '</button>';
  }).join('');

  document.getElementById('eu-country-modal-body').innerHTML = (plan.paths || []).map(function(p, idx) {
    return '<div class="eu-path-section' + (idx === 0 ? ' active' : '') + '" data-path-id="' + esc(p.id) + '">' +
      '<div class="eu-path-summary">' + esc(p.summary) + '</div>' +
      '<div class="eu-path-grid">' +
        '<div class="eu-path-stat"><div class="eu-path-stat-label">Threshold</div><div class="eu-path-stat-value">' + esc(p.threshold) + '</div></div>' +
        '<div class="eu-path-stat"><div class="eu-path-stat-label">Timeline</div><div class="eu-path-stat-value">' + esc(p.timeline) + '</div></div>' +
        '<div class="eu-path-stat"><div class="eu-path-stat-label">Salary</div><div class="eu-path-stat-value">' + esc(p.salary) + '</div></div>' +
        '<div class="eu-path-stat"><div class="eu-path-stat-label">Type</div><div class="eu-path-stat-value">' + esc(p.kind === 'job' ? 'Direct employment' : p.kind === 'phd' ? 'Funded research' : 'Hybrid') + '</div></div>' +
      '</div>' +
      '<div class="eu-path-steps"><div class="eu-path-steps-title">📋 Steps</div>' +
        (p.steps || []).map(function(s, i) { return '<div class="eu-path-step"><span class="eu-path-step-num">' + (i + 1) + '</span><span>' + esc(s) + '</span></div>'; }).join('') +
      '</div>' +
      '<div class="eu-path-steps"><div class="eu-path-steps-title">🎯 Targets</div>' +
        '<div class="eu-path-targets">' + (p.targets || []).map(function(t) { return '<span class="eu-target-pill">' + esc(t) + '</span>'; }).join('') + '</div>' +
      '</div>' +
      '<div class="eu-path-verdict"><div class="eu-path-verdict-label">Verdict</div>' + esc(p.verdict) + '</div>' +
    '</div>';
  }).join('');
}

function switchEuropePath(pathId, btn) {
  document.querySelectorAll('#eu-country-modal-tabs .eu-path-tab').forEach(function(t) { t.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  document.querySelectorAll('#eu-country-modal-body .eu-path-section').forEach(function(s) {
    s.classList.toggle('active', s.getAttribute('data-path-id') === pathId);
  });
}

function openCountdownExplainer() {
  if (!europeRef || !europeRef.countdownExplainer) return;
  var ex = europeRef.countdownExplainer;
  var now = new Date();
  var diffMs = EU_BIRTHDAY - now;
  var days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  document.getElementById('eu-countdown-modal-hero').innerHTML =
    '<div class="eu-modal-flag">🚨</div>' +
    '<div class="eu-modal-title">' + esc(ex.title) + '</div>' +
    '<div class="eu-modal-subtitle">' + esc(ex.subtitle) + ' · <strong style="color:#fca5a5">' + days + ' days left</strong></div>';

  var html = '<div class="eu-explainer-block"><h4>What changes at age 30</h4><ul>' +
    ex.what.map(function(w) { return '<li>' + esc(w) + '</li>'; }).join('') +
  '</ul></div>';

  html += '<div class="eu-explainer-block"><h4>Why this matters for YOU</h4><ul>' +
    ex.why_matters.map(function(w) { return '<li>' + esc(w) + '</li>'; }).join('') +
  '</ul></div>';

  html += '<div class="eu-explainer-block"><h4>' + esc(ex.if_you_miss.title) + '</h4><div class="eu-fallback-grid">';
  html += ex.if_you_miss.items.map(function(item) {
    var flagMap = { NL:'🇳🇱', DE:'🇩🇪', IE:'🇮🇪', SE:'🇸🇪', FI:'🇫🇮', CH:'🇨🇭', BE:'🇧🇪', DK:'🇩🇰', AT:'🇦🇹', PhD:'🎓' };
    return '<div class="eu-fallback">' +
      '<div class="eu-fallback-flag">' + (flagMap[item.country] || '•') + '</div>' +
      '<div class="eu-fallback-text">' + esc(item.plan) + '</div>' +
    '</div>';
  }).join('');
  html += '</div></div>';

  html += '<div class="eu-action-box">💡 ' + esc(ex.action) + '</div>';

  document.getElementById('eu-countdown-modal-body').innerHTML = html;
  document.getElementById('eu-countdown-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeEuropeModal(event, id) {
  if (event && event.target !== event.currentTarget) return;
  var el = document.getElementById(id);
  if (el) el.classList.remove('open');
  document.body.style.overflow = '';
}

// Close modals on ESC
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    ['eu-country-modal', 'eu-countdown-modal'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el && el.classList.contains('open')) {
        el.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }
});

function filterEuropeCompanies(filter, btn) {
  var isCountry = ['NL', 'DE', 'SE', 'IE', 'FI', 'CH', 'BE', 'DK'].indexOf(filter) !== -1;
  var key = isCountry ? 'country' : 'tier';
  // toggle off if same filter clicked
  europeCompanyFilters[key] = (europeCompanyFilters[key] === filter) ? 'ALL' : filter;
  // ALL only meaningful as tier reset
  if (filter === 'ALL') europeCompanyFilters.tier = 'ALL';

  // visual: only ONE active per group
  var group = btn ? btn.parentElement : null;
  if (group) {
    group.querySelectorAll('.eu-filter').forEach(function(b) { b.classList.remove('active'); });
    if (europeCompanyFilters[key] !== 'ALL') btn.classList.add('active');
    else if (filter === 'ALL') btn.classList.add('active');
  }
  renderEuropeCompanies();
}

function renderEuropeCompanies() {
  var list = document.getElementById('europe-companies-list');
  var counter = document.getElementById('europe-company-count');
  var pipeline = document.getElementById('eu-pipeline');
  if (!list || !europeRef) return;

  var companies = europeRef.companies.filter(function(co) {
    if (europeCompanyFilters.tier !== 'ALL' && String(co.tier) !== europeCompanyFilters.tier) return false;
    if (europeCompanyFilters.country !== 'ALL' && co.country !== europeCompanyFilters.country) return false;
    return true;
  });
  if (counter) counter.textContent = '· ' + companies.length + ' shown';

  // Pipeline counts (across ALL companies, not filtered)
  var stages = { NOT_STARTED: 0, RESEARCHING: 0, APPLIED: 0, SCREENING: 0, INTERVIEW: 0, OFFER: 0 };
  europeRef.companies.forEach(function(co) {
    var p = europeProgress['company:' + co.key];
    var s = (p && p.status) || 'NOT_STARTED';
    if (stages[s] !== undefined) stages[s]++;
  });
  var pipeOrder = [
    { k: 'NOT_STARTED', label: 'Not started' },
    { k: 'RESEARCHING', label: 'Researching' },
    { k: 'APPLIED', label: 'Applied' },
    { k: 'SCREENING', label: 'Screening' },
    { k: 'INTERVIEW', label: 'Interview' },
    { k: 'OFFER', label: 'Offer' }
  ];
  if (pipeline) {
    pipeline.innerHTML = pipeOrder.map(function(s) {
      return '<div class="eu-pipeline-cell pipe-' + s.k + '">' +
        '<div class="eu-pipeline-num">' + stages[s.k] + '</div>' +
        '<div class="eu-pipeline-stage">' + s.label + '</div>' +
      '</div>';
    }).join('');
  }

  if (companies.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:#71717a;background:rgba(24,24,27,.4);border-radius:14px"><div style="font-size:32px;margin-bottom:8px">🔍</div><p>No companies match these filters</p></div>';
    return;
  }

  var grouped = { 1: [], 2: [], 3: [] };
  companies.forEach(function(co) { grouped[co.tier].push(co); });
  var tierMeta = {
    1: { title: 'Tier 1 — Apply immediately', desc: 'Best probability for your profile', cls: 'eu-tier-1' },
    2: { title: 'Tier 2 — After 2 months prep', desc: 'Once skill gaps are closed', cls: 'eu-tier-2' },
    3: { title: 'Tier 3 — Indian-arm transfer (12-24 months)', desc: 'Zero-unemployment-risk path', cls: 'eu-tier-3' }
  };

  list.innerHTML = [1, 2, 3].filter(function(t) { return grouped[t].length > 0; }).map(function(tier) {
    var m = tierMeta[tier];
    return '<div class="eu-tier-section">' +
      '<div class="eu-tier-header">' +
        '<span class="eu-tier-badge ' + m.cls + '">TIER ' + tier + '</span>' +
        '<div><div class="eu-tier-title">' + esc(m.title) + '</div><div class="eu-tier-desc">' + esc(m.desc) + '</div></div>' +
      '</div>' +
      '<div class="eu-co-grid">' + grouped[tier].map(europeCompanyCardHTML).join('') + '</div>' +
    '</div>';
  }).join('');
}

function europeCompanyCardHTML(co) {
  var country = (europeRef.countries.find(function(c) { return c.code === co.country; }) || {});
  var prog = europeProgress['company:' + co.key] || { status: 'NOT_STARTED', notes: '' };
  var statusOptions = ['NOT_STARTED', 'RESEARCHING', 'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTED'];
  var statusColor = prog.status === 'OFFER' ? '#bef264' :
                    prog.status === 'INTERVIEW' ? '#86efac' :
                    prog.status === 'APPLIED' || prog.status === 'SCREENING' ? '#a5b4fc' :
                    prog.status === 'REJECTED' ? '#fca5a5' :
                    prog.status === 'RESEARCHING' ? '#fcd34d' : '#a1a1aa';
  var fitDots = '';
  for (var i = 1; i <= 5; i++) fitDots += '<span' + (i <= co.fit ? ' class="on"' : '') + '></span>';

  return '<div class="eu-co-card s-' + prog.status + '">' +
    (prog.status !== 'NOT_STARTED' ? '<div class="eu-co-status-bar s-' + prog.status + '"></div>' : '') +
    '<div class="eu-co-head">' +
      '<div style="flex:1"><div class="eu-co-name">' + esc(co.name) + '</div>' +
      '<div class="eu-co-meta">' + (country.flag || '') + ' ' + esc(co.city) + '</div></div>' +
      '<div class="eu-fit-row" title="Stack fit ' + co.fit + '/5">' + fitDots + '</div>' +
    '</div>' +
    '<div class="eu-co-stack">' + esc(co.stack) + '</div>' +
    '<div class="eu-co-note">' + esc(co.note) + '</div>' +
    '<select class="eu-co-select" style="color:' + statusColor + '" onchange="updateEuropeProgress(\'company\',\'' + esc(co.key) + '\',this.value)">' +
      statusOptions.map(function(s) { return '<option value="' + s + '"' + (prog.status === s ? ' selected' : '') + '>' + s.replace(/_/g, ' ') + '</option>'; }).join('') +
    '</select>' +
  '</div>';
}

function renderEuropeSkills() {
  var lanes = document.getElementById('europe-skill-lanes');
  if (!lanes || !europeRef) return;
  var total = europeRef.skills.length;
  var done = europeRef.skills.filter(function(sk) {
    var p = europeProgress['skill:' + sk.key]; return p && p.status === 'DONE';
  }).length;
  var pct = total ? Math.round(done / total * 100) : 0;
  document.getElementById('europe-skill-progress-label').textContent = done + ' of ' + total + ' mastered · ' + pct + '%';
  document.getElementById('europe-skill-progress-fill').style.width = pct + '%';

  var priorities = ['CRITICAL', 'IMPORTANT', 'BONUS'];
  var priorityMeta = {
    CRITICAL: { title: 'Critical gaps', sub: 'Block interviews' },
    IMPORTANT: { title: 'Important', sub: 'Expected at mid-level' },
    BONUS: { title: 'Bonus', sub: 'Tiebreakers vs other candidates' }
  };
  lanes.innerHTML = priorities.map(function(pri) {
    var skillsInLane = europeRef.skills.filter(function(s) { return s.priority === pri; });
    var doneInLane = skillsInLane.filter(function(s) { var p = europeProgress['skill:' + s.key]; return p && p.status === 'DONE'; }).length;
    var m = priorityMeta[pri];
    return '<div class="eu-skill-lane lane-' + pri + '">' +
      '<div class="eu-skill-lane-head">' +
        '<span class="eu-skill-dot dot-' + pri + '"></span>' +
        '<div><div class="eu-skill-lane-title">' + esc(m.title) + '</div>' +
        '<div style="font-size:10px;color:#71717a">' + esc(m.sub) + '</div></div>' +
        '<span class="eu-skill-lane-count">' + doneInLane + '/' + skillsInLane.length + '</span>' +
      '</div>' +
      skillsInLane.map(europeSkillItemHTML).join('') +
    '</div>';
  }).join('');
}

function europeSkillItemHTML(sk) {
  var prog = europeProgress['skill:' + sk.key] || { status: 'TODO', notes: '' };
  var stateClass = prog.status === 'DONE' ? 'done' : prog.status === 'IN_PROGRESS' ? 'in-progress' : '';
  var checkIcon = prog.status === 'DONE' ? '✓' : prog.status === 'IN_PROGRESS' ? '◐' : '';
  var next = prog.status === 'TODO' ? 'IN_PROGRESS' : prog.status === 'IN_PROGRESS' ? 'DONE' : 'TODO';
  return '<div class="eu-skill-item ' + stateClass + '" onclick="updateEuropeProgress(\'skill\',\'' + esc(sk.key) + '\',\'' + next + '\')">' +
    '<div class="eu-skill-item-head">' +
      '<div class="eu-skill-name">' + esc(sk.skill) + '</div>' +
      '<div class="eu-skill-check">' + checkIcon + '</div>' +
    '</div>' +
    '<div class="eu-skill-target">' + esc(sk.target) + '</div>' +
    (sk.resource ? '<a class="eu-skill-link" href="' + esc(sk.resource) + '" target="_blank" onclick="event.stopPropagation()">📖 Open resource →</a>' : '') +
  '</div>';
}

function renderEuropePlan() {
  var timeline = document.getElementById('europe-plan-timeline');
  if (!timeline || !europeRef) return;
  var total = europeRef.prepPlan.length;
  var done = europeRef.prepPlan.filter(function(t) {
    var p = europeProgress['task:' + t.key]; return p && p.status === 'DONE';
  }).length;
  var pct = total ? Math.round(done / total * 100) : 0;
  document.getElementById('europe-plan-progress-label').textContent = done + ' of ' + total + ' tasks · ' + pct + '%';
  document.getElementById('europe-plan-progress-fill').style.width = pct + '%';

  // Determine current month: first month not fully done
  var byMonth = {};
  europeRef.prepPlan.forEach(function(t) { if (!byMonth[t.month]) byMonth[t.month] = []; byMonth[t.month].push(t); });
  var months = Object.keys(byMonth).sort(function(a, b) { return Number(a) - Number(b); });
  var currentMonth = null;
  for (var i = 0; i < months.length; i++) {
    var allDone = byMonth[months[i]].every(function(t) { var p = europeProgress['task:' + t.key]; return p && p.status === 'DONE'; });
    if (!allDone) { currentMonth = months[i]; break; }
  }
  if (!currentMonth && months.length) currentMonth = months[0];

  timeline.innerHTML = months.map(function(m) {
    var tasks = byMonth[m];
    var monthDone = tasks.filter(function(t) { var p = europeProgress['task:' + t.key]; return p && p.status === 'DONE'; }).length;
    var allDone = monthDone === tasks.length;
    var isCurrent = String(m) === String(currentMonth) && !allDone;
    var stateCls = allDone ? 'done' : (isCurrent ? 'current' : '');
    return '<div class="eu-month ' + stateCls + '">' +
      '<span class="eu-month-num">' + (allDone ? '✓' : m) + '</span>' +
      '<div class="eu-month-header">' +
        '<div class="eu-month-title">Month ' + m + '</div>' +
        (isCurrent ? '<span class="eu-month-current-pill">CURRENT</span>' : '') +
        '<div class="eu-month-stats">' + monthDone + '/' + tasks.length + ' done</div>' +
      '</div>' +
      tasks.map(europeTaskItemHTML).join('') +
    '</div>';
  }).join('');
}

function europeTaskItemHTML(t) {
  var prog = europeProgress['task:' + t.key] || { status: 'TODO', notes: '' };
  var stateClass = prog.status === 'DONE' ? 'done' : prog.status === 'IN_PROGRESS' ? 'in-progress' : '';
  var checkIcon = prog.status === 'DONE' ? '✓' : prog.status === 'IN_PROGRESS' ? '◐' : '';
  var next = prog.status === 'TODO' ? 'IN_PROGRESS' : prog.status === 'IN_PROGRESS' ? 'DONE' : 'TODO';
  return '<div class="eu-task ' + stateClass + '" onclick="updateEuropeProgress(\'task\',\'' + esc(t.key) + '\',\'' + next + '\')">' +
    '<div class="eu-task-check">' + checkIcon + '</div>' +
    '<div class="eu-task-text">' + esc(t.task) + '</div>' +
    '<div class="eu-task-hours">~' + t.hours + ' hrs/wk</div>' +
  '</div>';
}

async function updateEuropeProgress(item_type, item_key, status) {
  try {
    await api('/api/europe/progress', 'PUT', { item_type: item_type, item_key: item_key, status: status, notes: '' });
    europeProgress[item_type + ':' + item_key] = { status: status, notes: '' };
    if (item_type === 'company') renderEuropeCompanies();
    if (item_type === 'skill') renderEuropeSkills();
    if (item_type === 'task') renderEuropePlan();
    renderEuropeKPIs();
  } catch (e) { toast('Failed to save', true); }
}

function setSalaryPreset(amount) {
  document.getElementById('europe-sal-gross').value = amount;
  calcEuropeSalaryAll();
}

var EU_SAL_COUNTRIES = [
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', city: 'Amsterdam' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', city: 'Berlin/Munich' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', city: 'Stockholm' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', city: 'Dublin' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮', city: 'Helsinki' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', city: 'Zurich' }
];

async function calcEuropeSalaryAll() {
  var gross = parseFloat(document.getElementById('europe-sal-gross').value) || 0;
  var grid = document.getElementById('europe-salary-grid');
  if (!grid) return;
  if (gross < 20000) { grid.innerHTML = '<p style="color:#fca5a5;padding:20px;text-align:center">Enter a valid gross salary (€20,000+)</p>'; return; }

  try {
    var results = await Promise.all(EU_SAL_COUNTRIES.map(function(c) {
      return api('/api/europe/salary-calc?gross=' + gross + '&country=' + c.code + '&under30=true')
        .then(function(r) { return Object.assign({}, c, r); });
    }));
    // Sort by net annual desc to find the best
    var sorted = results.slice().sort(function(a, b) { return b.net_annual - a.net_annual; });
    var bestCode = sorted[0].code;

    grid.innerHTML = results.map(function(r) {
      var isBest = r.code === bestCode;
      return '<div class="eu-sal-card' + (isBest ? ' best' : '') + '">' +
        (isBest ? '<div class="eu-sal-best-badge">💰 BEST NET</div>' : '') +
        '<div class="eu-sal-flag">' + r.flag + '</div>' +
        '<div class="eu-sal-country">' + esc(r.name) + ' · ' + esc(r.city) + '</div>' +
        '<div class="eu-sal-net">€' + r.net_monthly.toLocaleString() + '</div>' +
        '<div class="eu-sal-net-label">Net / month</div>' +
        '<div style="margin-top:14px">' +
          '<div class="eu-sal-detail"><span>Net annual</span><span>€' + r.net_annual.toLocaleString() + '</span></div>' +
          '<div class="eu-sal-detail"><span>Effective tax</span><span>' + r.effective_tax_rate + '%</span></div>' +
        '</div>' +
        '<div class="eu-sal-note">' + esc(r.note) + '</div>' +
      '</div>';
    }).join('');
  } catch (e) { toast('Calc failed', true); }
}
