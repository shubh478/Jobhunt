// Reserved for future use (scheduling, badge counts, etc.).
// Keeps MV3 service worker alive so fetch requests from the popup
// always have a background context available.
chrome.runtime.onInstalled.addListener(() => {
  console.log('Job Hunt Pro Autofill installed');
});
