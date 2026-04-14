// Autofill content script. Runs in isolated world on ATS pages.
// Exposes window.__jhpFill(payload) for the popup to call.
(function () {
  const HIGHLIGHT = '3px solid #facc15';
  const FILLED    = '2px solid #22c55e';

  function pickATS() {
    for (const key of Object.keys(window.__jhpATS || {})) {
      const ats = window.__jhpATS[key];
      if (ats.detect && ats.detect()) return ats;
    }
    return null;
  }

  function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    desc.set.call(el, value);
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillText(selector, value) {
    if (!value) return false;
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) return false;
    setNativeValue(el, value);
    el.style.outline = FILLED;
    return true;
  }

  function dataUrlToFile(dataUrl, name) {
    const [meta, b64] = dataUrl.split(',');
    const mime = /data:(.*?);base64/.exec(meta)[1];
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name, { type: mime });
  }

  function attachFile(selector, file) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el || !file) return false;
    const dt = new DataTransfer();
    dt.items.add(file);
    el.files = dt.files;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.style.outline = FILLED;
    return true;
  }

  function findByLabel(regex) {
    const labels = document.querySelectorAll('label');
    for (const lbl of labels) {
      if (!regex.test(lbl.innerText || '')) continue;
      const forId = lbl.getAttribute('for');
      if (forId) {
        const byId = document.getElementById(forId);
        if (byId) return byId;
      }
      const nested = lbl.querySelector('input, textarea, select');
      if (nested) return nested;
      let sib = lbl.nextElementSibling;
      while (sib) {
        const found = sib.matches?.('input, textarea, select')
          ? sib
          : sib.querySelector?.('input, textarea, select');
        if (found) return found;
        sib = sib.nextElementSibling;
      }
    }
    return null;
  }

  function applyCustomRules(ats, defaults, profile) {
    let filled = 0, skipped = 0;
    const map = window.__jhpFieldMap;
    if (!map) return { filled, skipped };

    const questionEls = ats.customQuestionSelector
      ? document.querySelectorAll(ats.customQuestionSelector)
      : [];

    questionEls.forEach(el => {
      const labelEl = el.labels?.[0] || document.querySelector(`label[for="${el.id}"]`);
      const labelText = (labelEl?.innerText || '').trim();
      if (!labelText) { skipped++; el.style.outline = HIGHLIGHT; return; }

      const rule = map.rules.find(r => r.match.test(labelText));
      const value = rule ? rule.value(defaults, profile) : '';
      if (value) {
        setNativeValue(el, value);
        el.style.outline = FILLED;
        filled++;
      } else {
        el.style.outline = HIGHLIGHT;
        skipped++;
      }
    });

    return { filled, skipped };
  }

  window.__jhpFill = function (payload) {
    const { profile, resume } = payload;
    const ats = pickATS();
    if (!ats) return { filled: 0, skipped: 0, ats: 'unknown ATS' };

    let filled = 0, skipped = 0;
    const s = ats.selectors || {};
    const [firstName, ...rest] = (profile.full_name || '').split(' ');
    const lastName = rest.join(' ');

    if (s.firstName && ats.name === 'Lever') {
      if (fillText(s.firstName, profile.full_name)) filled++;
    } else {
      if (fillText(s.firstName, firstName)) filled++;
      if (fillText(s.lastName,  lastName))  filled++;
    }
    if (fillText(s.email,     profile.email))         filled++;
    if (fillText(s.phone,     profile.phone))         filled++;
    if (fillText(s.linkedin,  profile.linkedin_url))  filled++;
    if (fillText(s.github,    profile.github_url))    filled++;
    if (fillText(s.portfolio, profile.portfolio_url)) filled++;

    if (ats.useLabelMatching && ats.labelMap) {
      for (const [field, regex] of Object.entries(ats.labelMap)) {
        const el = findByLabel(regex);
        if (!el) continue;
        let val = '';
        if (field === 'firstName')      val = firstName;
        else if (field === 'lastName')  val = lastName;
        else if (field === 'fullName')  val = profile.full_name;
        else if (field === 'email')     val = profile.email;
        else if (field === 'phone')     val = profile.phone;
        else if (field === 'linkedin')  val = profile.linkedin_url;
        else if (field === 'github')    val = profile.github_url;
        if (val && fillText(el, val)) filled++;
      }
    }

    if (resume && s.resume) {
      const file = dataUrlToFile(resume.dataUrl, resume.name);
      if (attachFile(s.resume, file)) filled++;
    }

    const custom = applyCustomRules(ats, window.__jhpFieldMap?.defaults || {}, profile);
    filled  += custom.filled;
    skipped += custom.skipped;

    const firstSkipped = document.querySelector('[style*="facc15"]');
    if (firstSkipped) firstSkipped.scrollIntoView({ behavior: 'smooth', block: 'center' });

    return { filled, skipped, ats: ats.name };
  };

  // ============================================================
  // Auto-fill on page load when URL hints ?jhp=autofill
  // Triggered by the "Apply with Autofill" button in Job Hunt Pro.
  // ============================================================
  const API = 'http://localhost:3456/api';

  async function autoFillFromServer() {
    try {
      const profRes = await fetch(`${API}/profile`, { credentials: 'include' });
      if (!profRes.ok) { console.warn('[JHP] not logged in to Job Hunt Pro'); return; }
      const profile = await profRes.json();

      let resumePayload = null;
      try {
        const rRes = await fetch(`${API}/resume-download`, { credentials: 'include' });
        if (rRes.ok) {
          const blob = await rRes.blob();
          const disp = rRes.headers.get('content-disposition') || '';
          const nameMatch = disp.match(/filename="?([^"]+)"?/);
          const dataUrl = await new Promise(resolve => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.readAsDataURL(blob);
          });
          resumePayload = { name: nameMatch ? nameMatch[1] : 'resume.pdf', dataUrl };
        }
      } catch {}

      const result = window.__jhpFill({ profile, resume: resumePayload });
      showBanner(result);
      hookSubmitForMarkApplied();
    } catch (e) {
      console.error('[JHP] auto-fill error', e);
    }
  }

  function showBanner({ filled, skipped, ats }) {
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:14px;right:14px;z-index:999999;background:#111;color:#fff;padding:12px 16px;border-radius:10px;font:13px -apple-system,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:280px';

    const title = document.createElement('div');
    title.style.cssText = 'font-weight:600;margin-bottom:4px';
    title.textContent = `Job Hunt Pro · ${ats}`;
    banner.appendChild(title);

    const stats = document.createElement('div');
    stats.appendChild(document.createTextNode('Filled '));
    const ok = document.createElement('b'); ok.style.color = '#4ade80'; ok.textContent = filled;
    stats.appendChild(ok);
    stats.appendChild(document.createTextNode(' · Skipped '));
    const warn = document.createElement('b'); warn.style.color = '#facc15'; warn.textContent = skipped;
    stats.appendChild(warn);
    banner.appendChild(stats);

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:11px;color:#94a3b8;margin-top:6px';
    hint.textContent = 'Review yellow fields, then Submit.';
    banner.appendChild(hint);

    document.body.appendChild(banner);
    setTimeout(() => { banner.style.opacity = '0.5'; }, 6000);
  }

  function hookSubmitForMarkApplied() {
    const form = document.querySelector('form');
    if (!form) return;
    form.addEventListener('submit', () => {
      const body = JSON.stringify({ url: location.href, title: document.title });
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(`${API}/auto/mark-applied`, blob);
    }, { capture: true });
  }

  if (/[?&]jhp=autofill/.test(location.search)) {
    setTimeout(autoFillFromServer, 800);
  }
})();
