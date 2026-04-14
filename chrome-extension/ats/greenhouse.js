// Greenhouse selector map — based on job-boards.greenhouse.io markup
// inspected against gitlab/jobs/8324132002 on 2026-04-14.
window.__jhpATS = window.__jhpATS || {};
window.__jhpATS.greenhouse = {
  detect: () => /greenhouse\.io/.test(location.hostname),
  name: 'Greenhouse',
  selectors: {
    firstName: '#first_name',
    lastName:  '#last_name',
    email:     '#email',
    phone:     '#phone',
    country:   '#country',
    resume:    '#resume',
    coverLetter: '#cover_letter',
  },
  // Greenhouse custom questions have dynamic IDs like #question_34496964002.
  // Match them by their label text instead.
  customQuestionSelector: 'input[id^="question_"], textarea[id^="question_"], select[id^="question_"]',
};
