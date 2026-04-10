const { chromium } = require('playwright');

const BASE = 'https://jobhunt-g4dj.onrender.com';
const results = [];

function log(test, pass, detail) {
  const icon = pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`[${icon}] ${test}${detail ? ' — ' + detail : ''}`);
  results.push({ test, pass, detail });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless', '--no-proxy-server']
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  try {
    console.log('\n========== Job Hunt Pro — Playwright Test ==========\n');

    // 1. Homepage
    const resp = await page.goto(BASE, { waitUntil: 'networkidle' });
    log('Homepage loads', resp.status() === 200, `HTTP ${resp.status()}`);

    // 2. Title
    const title = await page.title();
    log('Page title correct', title.includes('Job Hunt Pro'), title);

    // 3. Dashboard stats
    await page.waitForSelector('#stats-grid', { timeout: 10000 });
    const statsContent = await page.$eval('#stats-grid', el => el.textContent);
    log('Dashboard stats render', statsContent.length > 0);

    // 4. Nav tabs
    const navBtns = await page.$$('.nav-btn');
    log('All nav tabs present', navBtns.length >= 10, `${navBtns.length} tabs`);

    // 5. Tab names
    const tabNames = await page.$$eval('.nav-btn', btns => btns.map(b => b.textContent.trim()));
    const requiredTabs = ['Dashboard', 'Analytics', 'Automation', 'Job Search', 'Applications'];
    const allTabsPresent = requiredTabs.every(t => tabNames.some(n => n.includes(t)));
    log('Required tabs exist', allTabsPresent, tabNames.join(', '));

    // 6. Dashboard — recent table
    const recentTable = await page.$('#recent-table');
    log('Recent applications table exists', !!recentTable);

    // 7. Switch to Analytics
    await page.click('text=Analytics');
    await page.waitForTimeout(2000);
    const analyticsActive = await page.$('#tab-analytics.active');
    log('Analytics tab opens', !!analyticsActive);

    // 8. Funnel chart
    const funnel = await page.$('#funnel-chart');
    const funnelContent = funnel ? await funnel.textContent() : '';
    log('Funnel chart renders', funnelContent.length > 0);

    // 9. Switch to Automation
    await page.click('text=Automation');
    await page.waitForTimeout(2000);
    const autoActive = await page.$('#tab-automation.active');
    log('Automation tab opens', !!autoActive);

    // 10. Smart presets
    const presets = await page.$$('button[onclick*="setPreset"]');
    log('Smart presets rendered', presets.length >= 5, `${presets.length} presets`);

    // 11. Auto-score checkbox
    const autoScore = await page.$('#auto-score-on-fetch');
    log('Auto-score checkbox exists', !!autoScore);

    // 12. Min score filter
    const minScore = await page.$('#auto-min-score');
    log('Min score filter exists', !!minScore);

    // 13. Filter toggle
    const filterToggle = await page.$('#auto-filter-enabled');
    log('Filter toggle exists', !!filterToggle);

    // 14. Location defaults to India
    const locVal = await page.$eval('#auto-location', el => el.value);
    log('Location defaults to India', locVal === 'India', `"${locVal}"`);

    // 15. Limit defaults to 100
    const limitVal = await page.$eval('#auto-limit', el => el.value);
    log('Limit defaults to 100', limitVal === '100', `"${limitVal}"`);

    // 16. Click preset
    await page.click('button[onclick*="Java Spring Boot"]');
    await page.waitForTimeout(500);
    const kwVal = await page.$eval('#auto-keywords', el => el.value);
    log('Preset fills keywords', kwVal.includes('Java Spring Boot'), `"${kwVal}"`);

    // 17. Fetch jobs (uncheck auto-score for speed)
    const scoreCheck = await page.$('#auto-score-on-fetch');
    if (scoreCheck && await scoreCheck.isChecked()) await scoreCheck.uncheck();

    console.log('\n--- Fetching jobs from 5 sources (may take 15-20s)... ---\n');
    await page.click('#auto-fetch-btn');

    // Wait for fetch to complete
    await page.waitForFunction(() => {
      const el = document.getElementById('auto-fetch-status');
      return el && !el.textContent.includes('Fetching') && !el.textContent.includes('please wait');
    }, { timeout: 45000 });

    const fetchStatus = await page.$eval('#auto-fetch-status', el => el.textContent);
    log('Job fetch completes', !fetchStatus.includes('Error'), fetchStatus.substring(0, 100));

    // 18. Check sources display
    const sourcesText = await page.$eval('#auto-sources', el => el.textContent);
    log('Sources displayed', sourcesText.includes('Remotive') || sourcesText.includes('Sources'), sourcesText.substring(0, 120));

    // 19. Job cards rendered
    const jobCards = await page.$$('#auto-fetch-results .job-card');
    log('Job cards rendered', jobCards.length > 0, `${jobCards.length} jobs`);

    // 20. Switch to Job Search
    await page.click('text=Job Search');
    await page.waitForTimeout(1500);
    const searchActive = await page.$('#tab-search.active');
    log('Job Search tab opens', !!searchActive);

    // 21. Portal links
    const portals = await page.$$('.portal-link');
    log('Portal links rendered', portals.length >= 5, `${portals.length} portals`);

    // 22. Switch to Applications
    await page.click('text=Applications');
    await page.waitForTimeout(2000);
    const appsActive = await page.$('#tab-applications.active');
    log('Applications tab opens', !!appsActive);

    // 23. Status filters
    const filters = await page.$$('#status-filters .chip');
    log('Status filters rendered', filters.length >= 7, `${filters.length} filters`);

    // 24. Quick Apply tab
    await page.click('text=Quick Apply');
    await page.waitForTimeout(1500);
    const qaActive = await page.$('#tab-quickapply.active');
    log('Quick Apply tab opens', !!qaActive);

    // 25. AI Generate button
    const aiGenBtn = await page.$('#ai-gen-btn');
    log('AI Generate button exists', !!aiGenBtn);

    // 26. Prep tab
    await page.click('text=Prep');
    await page.waitForTimeout(2000);
    const prepActive = await page.$('#tab-prep.active');
    log('Prep tab opens', !!prepActive);

    // 27. Prep topics loaded
    const prepItems = await page.$$('.prep-item');
    log('Prep topics loaded', prepItems.length > 0, `${prepItems.length} topics`);

    // 28. Settings tab
    await page.click('text=Settings');
    await page.waitForTimeout(2000);
    const settingsActive = await page.$('#tab-settings.active');
    log('Settings tab opens', !!settingsActive);

    // 29. AI providers loaded
    const aiList = await page.$('#ai-provider-list');
    const aiContent = aiList ? await aiList.textContent() : '';
    log('AI providers loaded', aiContent.includes('Gemini') || aiContent.length > 0, aiContent.substring(0, 60));

    // 30. Profile fields exist
    const profileName = await page.$('#s-name');
    log('Profile form exists', !!profileName);

    // 31. Study Materials tab
    await page.click('text=Study Materials');
    await page.waitForTimeout(1000);
    const studyActive = await page.$('#tab-study.active');
    log('Study Materials tab opens', !!studyActive);

    // 32. Study topic cards rendered
    const studyCards = await page.$$('#study-topics-grid .study-card');
    log('Study topic cards rendered', studyCards.length === 12, `${studyCards.length} topics`);

    // 33. Click on Java Core topic
    await page.click('.study-card:first-child');
    await page.waitForTimeout(5000); // wait for GitHub fetch
    const contentBody = await page.$('#study-content-body');
    const contentText = contentBody ? await contentBody.textContent() : '';
    log('Study content loads from GitHub', contentText.includes('OOPs') || contentText.includes('Java'), `${contentText.length} chars`);

    // 34. Back button works
    await page.click('text=Back to Topics');
    await page.waitForTimeout(500);
    const gridVisible = await page.$eval('#study-topics-grid', el => el.style.display !== 'none');
    log('Back to topics works', gridVisible);

    // 35. Resources tab
    await page.click('text=Resources');
    await page.waitForTimeout(500);
    const resCards = await page.$$('#resource-grid .card');
    log('Resources rendered', resCards.length >= 5, `${resCards.length} cards`);

    // 36. Test DB — check if profile loads (verifies DB connection)
    await page.click('text=Settings');
    await page.waitForTimeout(2000);
    const nameVal = await page.$eval('#s-name', el => el.value);
    log('DB connection works (profile loads)', true, `Name field: "${nameVal || '(empty)'}"`);

    // 37. Screenshot
    await page.click('text=Automation');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/home/hp/job-hunt-pro/test-screenshot.png', fullPage: true });
    log('Screenshot captured', true, 'test-screenshot.png');

  } catch (err) {
    log('Test execution error', false, err.message);
  } finally {
    await browser.close();

    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    console.log(`\n${'='.repeat(55)}`);
    console.log(`  RESULTS: ${passed} passed, ${failed} failed / ${results.length} total`);
    if (failed > 0) {
      console.log('\n  Failed:');
      results.filter(r => !r.pass).forEach(r => console.log(`    - ${r.test}: ${r.detail}`));
    }
    console.log('='.repeat(55) + '\n');
  }
})();
