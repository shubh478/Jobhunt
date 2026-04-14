const API = 'http://localhost:3456/api';
const statusEl = document.getElementById('status');

const say = (msg, cls = '') => { statusEl.className = 'status ' + cls; statusEl.textContent = msg; };

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

document.getElementById('fill').addEventListener('click', async () => {
  say('Loading profile…');
  try {
    const profRes = await fetch(`${API}/profile`, { credentials: 'include' });
    if (!profRes.ok) throw new Error(`Profile ${profRes.status} — are you logged in to Job Hunt Pro at localhost:3456?`);
    const profile = await profRes.json();

    const resumeRes = await fetch(`${API}/resume-download`, { credentials: 'include' });
    let resumeBlob = null, resumeName = 'resume.pdf';
    if (resumeRes.ok) {
      resumeBlob = await resumeRes.blob();
      const disp = resumeRes.headers.get('content-disposition') || '';
      const m = disp.match(/filename="?([^"]+)"?/);
      if (m) resumeName = m[1];
    }

    const resumeDataUrl = resumeBlob ? await blobToDataUrl(resumeBlob) : null;

    const tab = await getActiveTab();
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (payload) => window.__jhpFill(payload),
      args: [{ profile, resume: resumeDataUrl ? { name: resumeName, dataUrl: resumeDataUrl } : null }],
    });

    const { filled, skipped, ats } = result || {};
    say(`✓ ${ats || 'form'}: filled ${filled}, skipped ${skipped}\nYellow = you decide. Review then submit.`, 'ok');
  } catch (e) {
    say('Error: ' + e.message, 'err');
  }
});

document.getElementById('mark').addEventListener('click', async () => {
  try {
    const tab = await getActiveTab();
    const [{ result: meta }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        url: location.href,
        title: document.title,
        company: (document.querySelector('h1, header')?.innerText || '').split('\n')[0].slice(0, 120),
      }),
    });
    const res = await fetch(`${API}/auto/mark-applied`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meta),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    say(data.created ? '✓ Added to Job Hunt Pro as APPLIED' : '✓ Already tracked — status updated', 'ok');
  } catch (e) {
    say('Error: ' + e.message, 'err');
  }
});

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
