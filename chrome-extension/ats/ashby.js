// Ashby selector map — jobs.ashbyhq.com application forms.
// Ashby fields use _fieldEntry ids that are stable per form; we match by label.
window.__jhpATS = window.__jhpATS || {};
window.__jhpATS.ashby = {
  detect: () => /ashbyhq\.com/.test(location.hostname),
  name: 'Ashby',
  selectors: {
    // Ashby doesn't expose stable ids; content script falls back to label matching.
    resume: 'input[type="file"]',
  },
  // All regular fields matched via label text.
  useLabelMatching: true,
  labelMap: {
    firstName: /first name/i,
    lastName:  /last name/i,
    fullName:  /^name$|full name/i,
    email:     /^email/i,
    phone:     /phone/i,
    linkedin:  /linkedin/i,
    github:    /github/i,
  },
};
