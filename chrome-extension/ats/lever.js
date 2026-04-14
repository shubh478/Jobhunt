// Lever selector map — jobs.lever.co application forms.
// Selectors verified against Lever's public form markup (name-based).
window.__jhpATS = window.__jhpATS || {};
window.__jhpATS.lever = {
  detect: () => /jobs\.lever\.co/.test(location.hostname),
  name: 'Lever',
  selectors: {
    firstName:   'input[name="name"]',        // Lever uses single full-name field
    email:       'input[name="email"]',
    phone:       'input[name="phone"]',
    company:     'input[name="org"]',
    resume:      'input[type="file"][name="resume"]',
    linkedin:    'input[name="urls[LinkedIn]"]',
    github:      'input[name="urls[GitHub]"]',
    portfolio:   'input[name="urls[Portfolio]"]',
  },
  customQuestionSelector: 'input[name^="cards["], textarea[name^="cards["]',
};
