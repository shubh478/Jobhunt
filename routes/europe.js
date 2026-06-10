const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// =================== REFERENCE DATA ===================
// Static reference data for the Europe Job Prep section. Sourced from Jun 2026
// research (IND, BAMF, Migrationsverket, company career pages, Glassdoor, LC).
// User-specific progress is stored separately in europe_progress.

const COUNTRIES = [
  {
    code: 'NL', name: 'Netherlands', flag: '🇳🇱',
    visa: 'Highly Skilled Migrant (Kennismigrant)',
    threshold_under30: '€4,357/mo (€52,284/yr)',
    threshold_30plus: '€5,942/mo (€71,304/yr)',
    processing: '2 weeks (recognized sponsor)',
    firing_protection: 9,
    english_jobs: '90%+',
    pr_years: '5 yrs + A2 Dutch',
    tax_benefit: '30% ruling (drops to 27% from 1 Jan 2027)',
    rank: 1,
    note: 'Best fit for under-30. Threshold locked at application date.'
  },
  {
    code: 'DE', name: 'Germany', flag: '🇩🇪',
    visa: 'Blue Card / Opportunity Card (Chancenkarte)',
    threshold_under30: '€45,934/yr (IT shortage)',
    threshold_30plus: '€50,700/yr (regular)',
    processing: '4–8 weeks from India',
    firing_protection: 8,
    english_jobs: 'Berlin yes; rest needs German',
    pr_years: '21 mo with B1, 27 mo with A1',
    tax_benefit: 'None specific',
    rank: 2,
    note: 'Chancenkarte: profile scores 10/6 points needed. PT work only during job search.'
  },
  {
    code: 'SE', name: 'Sweden', flag: '🇸🇪',
    visa: 'Work Permit',
    threshold_under30: 'SEK 28,480/mo (~€2,500)',
    threshold_30plus: 'SEK 28,480/mo (~€2,500)',
    processing: '2–6 months; 30 days fast-track',
    firing_protection: 9,
    english_jobs: 'High in Stockholm',
    pr_years: '4 yrs',
    tax_benefit: 'Expat tax relief (limited)',
    rank: 3,
    note: 'LAS law remains strong even post-2022 reform.'
  },
  {
    code: 'IE', name: 'Ireland', flag: '🇮🇪',
    visa: 'Critical Skills Employment Permit (CSEP)',
    threshold_under30: '€38,000/yr',
    threshold_30plus: '€38,000/yr',
    processing: '4–8 weeks (trusted partner)',
    firing_protection: 5,
    english_jobs: '100%',
    pr_years: 'Stamp 4 after 2 yrs',
    tax_benefit: 'SARP (35% relief, conditions apply)',
    rank: 4,
    note: 'Effectively at-will first 12 months. Accept that risk.'
  },
  {
    code: 'FI', name: 'Finland', flag: '🇫🇮',
    visa: 'Specialist Residence Permit',
    threshold_under30: '€3,827/mo',
    threshold_30plus: '€3,827/mo',
    processing: '14 days fast-track (cert. employer)',
    firing_protection: 7,
    english_jobs: 'High',
    pr_years: '4 yrs',
    tax_benefit: 'Foreign expert tax (32% flat, 4 yrs)',
    rank: 5,
    note: 'Wolt, Nokia hire from India regularly.'
  },
  {
    code: 'CH', name: 'Switzerland', flag: '🇨🇭',
    visa: 'Permit B (Non-EU, QUOTA)',
    threshold_under30: 'CHF 95k–115k effective',
    threshold_30plus: 'CHF 95k–115k effective',
    processing: '2–4 months; quota limited',
    firing_protection: 4,
    english_jobs: 'Zurich only',
    pr_years: '10 yrs (Permit C)',
    tax_benefit: 'Cantonal',
    rank: 7,
    note: 'SKIP for now: 2 YOE too low + quota exhausts by Q3 + weak firing protection.'
  },
  {
    code: 'BE', name: 'Belgium', flag: '🇧🇪',
    visa: 'Single Permit',
    threshold_under30: '€49,000–50,310/yr',
    threshold_30plus: '€49,000–50,310/yr',
    processing: '3–4 months',
    firing_protection: 8,
    english_jobs: 'Mixed',
    pr_years: '5 yrs',
    tax_benefit: 'Expat regime (limited)',
    rank: 6,
    note: 'Salary threshold too high for 2 YOE. Wait until 4 YOE.'
  },
  {
    code: 'DK', name: 'Denmark', flag: '🇩🇰',
    visa: 'Pay Limit Scheme',
    threshold_under30: 'DKK 514k (~€69k)',
    threshold_30plus: 'DKK 514k (~€69k)',
    processing: '1–3 months (Fast-Track)',
    firing_protection: 5,
    english_jobs: 'High',
    pr_years: '4 yrs',
    tax_benefit: 'Researcher tax (27% flat, 7 yrs)',
    rank: 8,
    note: 'SKIP: "flexicurity" model means easier firing despite Nordic reputation.'
  }
];

const COMPANIES = [
  // ===== TIER 1: Apply immediately — best probability =====
  { key: 'co-backbase', tier: 1, name: 'Backbase', country: 'NL', city: 'Amsterdam', stack: 'Java/Spring + Angular', fit: 5, note: 'LITERALLY your stack — banking software' },
  { key: 'co-bol', tier: 1, name: 'bol.com', country: 'NL', city: 'Utrecht', stack: 'Spring Boot, Kotlin, GCP', fit: 5, note: 'Hires 2-YOE regularly' },
  { key: 'co-picnic', tier: 1, name: 'Picnic', country: 'NL', city: 'Amsterdam', stack: 'Spring Boot heavy, AWS, Kafka', fit: 5, note: 'Hires from India' },
  { key: 'co-ing', tier: 1, name: 'ING', country: 'NL', city: 'Amsterdam', stack: 'Java/Spring Boot + Angular + Kafka', fit: 5, note: '~5000 engineers globally' },
  { key: 'co-rabobank', tier: 1, name: 'Rabobank', country: 'NL', city: 'Utrecht', stack: 'Java/Spring, Azure', fit: 4, note: 'Banking Java' },
  { key: 'co-abn', tier: 1, name: 'ABN AMRO', country: 'NL', city: 'Amsterdam', stack: 'Java/Spring, Kafka, Azure', fit: 4, note: 'Banking Java' },
  { key: 'co-mendix', tier: 1, name: 'Mendix (Siemens)', country: 'NL', city: 'Rotterdam', stack: 'Java low-code platform', fit: 4, note: '~400 engineers' },
  { key: 'co-ah', tier: 1, name: 'Albert Heijn (Ahold)', country: 'NL', city: 'Zaandam', stack: 'Java, Kotlin, GCP', fit: 4, note: 'Retail tech' },
  // ===== TIER 2: Apply after 2 months prep =====
  { key: 'co-booking', tier: 2, name: 'Booking.com', country: 'NL', city: 'Amsterdam', stack: 'Java/Perl/Kotlin, Spring, Kafka, K8s', fit: 5, note: 'LC medium-hard. Sponsor king. 3000+ engineers.' },
  { key: 'co-adyen', tier: 2, name: 'Adyen', country: 'NL', city: 'Amsterdam', stack: 'Java payments, PostgreSQL', fit: 5, note: 'Take-home not LeetCode. Code quality bar.' },
  { key: 'co-zalando', tier: 2, name: 'Zalando', country: 'DE', city: 'Berlin', stack: 'Java/Kotlin, Spring Boot, AWS', fit: 5, note: 'English-only. LC medium-heavy.' },
  { key: 'co-personio', tier: 2, name: 'Personio', country: 'DE', city: 'Munich', stack: 'TypeScript, Java, Kotlin', fit: 4, note: 'Sponsors Blue Card. English.' },
  { key: 'co-deliveryhero', tier: 2, name: 'Delivery Hero', country: 'DE', city: 'Berlin', stack: 'Kotlin, Java, Go, K8s', fit: 4, note: 'Direct India hires.' },
  { key: 'co-n26', tier: 2, name: 'N26', country: 'DE', city: 'Berlin', stack: 'Kotlin/Java, AWS', fit: 4, note: 'Mobile banking. English-first.' },
  { key: 'co-celonis', tier: 2, name: 'Celonis', country: 'DE', city: 'Munich', stack: 'Java, Python, React', fit: 4, note: 'Process mining. English-only most roles.' },
  { key: 'co-trivago', tier: 2, name: 'Trivago', country: 'DE', city: 'Düsseldorf', stack: 'Java, Scala, PHP', fit: 4, note: 'Direct India hires.' },
  { key: 'co-spotify', tier: 2, name: 'Spotify', country: 'SE', city: 'Stockholm', stack: 'Java/Kotlin chapters/squads', fit: 4, note: 'LC medium. Code review interview.' },
  { key: 'co-klarna', tier: 2, name: 'Klarna', country: 'SE', city: 'Stockholm', stack: 'Java/Kotlin payments', fit: 4, note: 'Hiring tightened post-2023 layoffs.' },
  { key: 'co-truecaller', tier: 2, name: 'Truecaller', country: 'SE', city: 'Stockholm', stack: 'Java/Scala', fit: 4, note: 'Indian-founded — sponsors freely.' },
  { key: 'co-volvocars', tier: 2, name: 'Volvo Cars', country: 'SE', city: 'Gothenburg', stack: 'Java/Spring Boot connected services', fit: 4, note: 'EV + connected car backend.' },
  { key: 'co-ericsson', tier: 2, name: 'Ericsson', country: 'SE', city: 'Stockholm', stack: 'Java/microservices', fit: 4, note: 'Largest sponsor of Indians in Sweden.' },
  { key: 'co-ikea', tier: 2, name: 'IKEA Digital', country: 'SE', city: 'Malmö', stack: 'Java microservices', fit: 4, note: 'Sponsors regularly.' },
  { key: 'co-wolt', tier: 2, name: 'Wolt (DoorDash)', country: 'FI', city: 'Helsinki', stack: 'Java/Kotlin/Scala', fit: 4, note: 'Active sponsor.' },
  { key: 'co-workday', tier: 2, name: 'Workday', country: 'IE', city: 'Dublin', stack: 'Java-heavy', fit: 4, note: 'EMEA HQ. Huge Indian hires.' },
  { key: 'co-fidelity', tier: 2, name: 'Fidelity Investments', country: 'IE', city: 'Dublin', stack: 'Java/Spring Boot', fit: 4, note: 'Indian-friendly.' },
  { key: 'co-mastercard', tier: 2, name: 'Mastercard', country: 'IE', city: 'Dublin', stack: 'Java/Spring', fit: 4, note: 'Dublin tech center.' },
  { key: 'co-stripe', tier: 2, name: 'Stripe', country: 'IE', city: 'Dublin', stack: 'Java/Ruby', fit: 3, note: 'Bug-squash + integration interview. FAANG-bar.' },
  { key: 'co-hubspot', tier: 2, name: 'HubSpot', country: 'IE', city: 'Dublin', stack: 'Java microservices', fit: 3, note: 'Sponsors CSEP.' },
  // ===== TIER 3: Indian-arm → Europe transfer (12-24 months) =====
  { key: 'co-saplabs', tier: 3, name: 'SAP Labs India → SAP Walldorf', country: 'DE', city: 'Bangalore → Walldorf', stack: 'Java, ABAP, HANA, BTP', fit: 5, note: 'Highest-EV transfer path. 18-24 mo tenure.' },
  { key: 'co-bgsw', tier: 3, name: 'Bosch (BGSW) → Stuttgart', country: 'DE', city: 'Bangalore → Stuttgart', stack: 'Java, C++, AUTOSAR', fit: 4, note: 'Transfer path.' },
  { key: 'co-mbrdi', tier: 3, name: 'MBRDI → Mercedes Stuttgart', country: 'DE', city: 'Bangalore → Stuttgart', stack: 'Java, Embedded', fit: 4, note: 'Mercedes-Benz R&D transfer.' },
  { key: 'co-siemens', tier: 3, name: 'Siemens India → Munich', country: 'DE', city: 'Bangalore/Pune → Munich', stack: 'Java, C++, Industrial', fit: 4, note: 'Transfer path.' },
  { key: 'co-allianz', tier: 3, name: 'Allianz Tech India → Munich', country: 'DE', city: 'Trivandrum/Pune → Munich', stack: 'Java/Spring, Cloud', fit: 4, note: 'AzTech India transfer.' },
  { key: 'co-ericssonin', tier: 3, name: 'Ericsson India → Stockholm', country: 'SE', city: 'Bangalore → Stockholm', stack: 'Java/microservices', fit: 4, note: 'Transfer path.' },
  { key: 'co-nokiain', tier: 3, name: 'Nokia India → Helsinki', country: 'FI', city: 'Bangalore → Helsinki', stack: 'Java/C++', fit: 4, note: 'Largest Indian tech employer in Finland.' }
];

const SKILLS = [
  // CRITICAL (red) gaps
  { key: 'sk-java21', category: 'Critical Gap', skill: 'Java 21 LTS (from Java 11)', priority: 'CRITICAL', target: 'Build a Spring Boot 3 service using virtual threads, records, pattern matching', resource: 'https://docs.oracle.com/en/java/javase/21/' },
  { key: 'sk-spring3', category: 'Critical Gap', skill: 'Spring Boot 3.x (from 2.x)', priority: 'CRITICAL', target: 'Migrate one Toqqer service to SB 3.x + jakarta.* namespace; be able to talk through migration in interview', resource: 'https://docs.spring.io/spring-boot/docs/current/reference/htmlsingle/' },
  { key: 'sk-aws-saa', category: 'Critical Gap', skill: 'AWS Solutions Architect Associate', priority: 'CRITICAL', target: 'Pass exam within 3 months. ~€150 fee.', resource: 'https://learn.cantrill.io/p/aws-certified-solutions-architect-associate-saa-c03' },
  // IMPORTANT (yellow)
  { key: 'sk-k8s', category: 'Important', skill: 'Kubernetes basics', priority: 'IMPORTANT', target: 'Pods, Deployments, Services, ConfigMaps, kubectl. Deploy SB3 project to k3s.', resource: 'https://kubernetes.io/docs/tutorials/' },
  { key: 'sk-leetcode', category: 'Important', skill: 'LeetCode (target 1700+ rating)', priority: 'IMPORTANT', target: '150 more mediums on Trees, BFS/DFS, Sliding Window, DP, Graphs', resource: 'https://leetcode.com/problemset/' },
  { key: 'sk-systemdesign', category: 'Important', skill: 'System Design (Alex Xu Vol 1)', priority: 'IMPORTANT', target: 'Practice 5 designs out loud: URL shortener, rate limiter, chat, payment idempotency, notification', resource: 'https://bytebytego.com/' },
  { key: 'sk-virtualthreads', category: 'Important', skill: 'Java Virtual Threads (Loom)', priority: 'IMPORTANT', target: 'Understand carrier threads, when to use vs platform threads', resource: 'https://openjdk.org/projects/loom/' },
  // BONUS (green)
  { key: 'sk-terraform', category: 'Bonus', skill: 'Terraform basics', priority: 'BONUS', target: 'Provision a small AWS stack with TF', resource: 'https://developer.hashicorp.com/terraform/tutorials' },
  { key: 'sk-otel', category: 'Bonus', skill: 'OpenTelemetry', priority: 'BONUS', target: 'Add traces to your SB3 project', resource: 'https://opentelemetry.io/docs/' },
  { key: 'sk-german', category: 'Bonus', skill: 'German A1 (or Dutch A1)', priority: 'BONUS', target: 'Duolingo daily + 1 Italki session/week. Speeds NL PR by 1 year.', resource: 'https://www.duolingo.com' },
  { key: 'sk-ddia', category: 'Bonus', skill: 'Designing Data-Intensive Apps (Kleppmann)', priority: 'BONUS', target: 'Read chapters 1-7 for system design depth', resource: 'https://dataintensive.net/' }
];

const PREP_PLAN = [
  { key: 'pp-m1-sb3', month: 1, task: 'Java 21 + Spring Boot 3.x side project (URL shortener with virtual threads, PG, Redis). Push to GitHub.', hours: 4 },
  { key: 'pp-m1-aws', month: 1, task: 'Start AWS SAA cert prep (Cantrill or Maarek on Udemy)', hours: 3 },
  { key: 'pp-m1-lc', month: 1, task: 'LeetCode: 30 easy refresh + start mediums on arrays/hashmaps', hours: 3 },
  { key: 'pp-m2-lc', month: 2, task: 'LeetCode: 40 mediums — trees, BFS/DFS, sliding window, two pointers', hours: 5 },
  { key: 'pp-m2-spring', month: 2, task: 'Spring internals deep dive on Baeldung: @Transactional propagation, bean lifecycle, virtual threads', hours: 3 },
  { key: 'pp-m2-concur', month: 2, task: 'Java concurrency: synchronized vs ReentrantLock, CompletableFuture, virtual threads', hours: 2 },
  { key: 'pp-m3-design', month: 3, task: 'Alex Xu Vol 1 cover-to-cover. Practice 5 designs out loud (URL shortener, rate limiter, chat, payments idempotency, notification)', hours: 5 },
  { key: 'pp-m3-aws-exam', month: 3, task: 'TAKE AWS SAA EXAM', hours: 2 },
  { key: 'pp-m3-lc', month: 3, task: 'LeetCode: 30 mediums on DP, graphs', hours: 5 },
  { key: 'pp-m4-k8s', month: 4, task: 'Docker + K8s basics. Deploy Spring Boot 3 project to free k3s/EKS cluster', hours: 4 },
  { key: 'pp-m4-lc-comp', month: 4, task: 'LeetCode: 20 mediums + 10 hards on company-tagged lists (Booking, Adyen, ING, Zalando)', hours: 6 },
  { key: 'pp-m5-mock', month: 5, task: 'Mock interviews: 2/week (Pramp + interviewing.io)', hours: 4 },
  { key: 'pp-m5-star', month: 5, task: 'Write 8-10 STAR stories from Toqqer work (content sharing, contributor workflow, caching, DRM)', hours: 3 },
  { key: 'pp-m5-cv', month: 5, task: 'Rewrite resume to EU format: 1 page, no photo, DD-MM-YYYY dates', hours: 2 },
  { key: 'pp-m5-apply-tier1', month: 5, task: 'Apply to Tier 1 NL companies: Backbase, bol.com, Picnic, ING, Rabobank, ABN AMRO', hours: 3 },
  { key: 'pp-m6-apply-tier2', month: 6, task: 'Apply to Tier 2 + 3: Booking, Adyen, Zalando, Spotify, Klarna, Workday, Wolt, SAP Labs India', hours: 4 },
  { key: 'pp-m6-stay-sharp', month: 6, task: '5-7 LC/week to stay sharp; system design mocks before each loop', hours: 4 },
  { key: 'pp-m6-negotiate', month: 6, task: 'Negotiation prep: levels.fyi + Glassdoor for target salaries. Floor: €55k NL / €58k Berlin / €62k Munich', hours: 2 }
];

const ANCHORS = [
  { label: 'Today', value: '2026-06-10', emoji: '📅' },
  { label: 'Your 30th birthday (NL HSM under-30 deadline)', value: '2027-02-01', emoji: '🚨', danger: true },
  { label: 'Months to act on under-30 visa', value: '~8 months', emoji: '⏱️' }
];

// =================== ROUTES ===================

router.get('/europe/reference', (req, res) => {
  res.json({ countries: COUNTRIES, companies: COMPANIES, skills: SKILLS, prepPlan: PREP_PLAN, anchors: ANCHORS });
});

router.get('/europe/progress', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT item_type, item_key, status, notes FROM europe_progress WHERE user_id=$1',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const ALLOWED_TYPES = new Set(['company', 'skill', 'task']);
const ALLOWED_STATUSES = new Set([
  'TODO', 'IN_PROGRESS', 'DONE',
  'NOT_STARTED', 'RESEARCHING', 'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTED'
]);

router.put('/europe/progress', async (req, res) => {
  try {
    const { item_type, item_key, status, notes } = req.body;
    if (!ALLOWED_TYPES.has(item_type)) return res.status(400).json({ error: 'invalid item_type' });
    if (typeof item_key !== 'string' || item_key.length === 0 || item_key.length > 64) {
      return res.status(400).json({ error: 'invalid item_key' });
    }
    const safeStatus = ALLOWED_STATUSES.has(status) ? status : 'TODO';
    const safeNotes = typeof notes === 'string' ? notes.slice(0, 2000) : '';
    await pool.query(
      `INSERT INTO europe_progress (user_id, item_type, item_key, status, notes, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, item_type, item_key)
       DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes, updated_at = NOW()`,
      [req.userId, item_type, item_key, safeStatus, safeNotes]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Salary calculator — used by frontend to compute take-home with NL 30% ruling etc.
router.get('/europe/salary-calc', (req, res) => {
  const gross = parseFloat(req.query.gross) || 0;
  const country = (req.query.country || 'NL').toUpperCase();
  const under30 = req.query.under30 === 'true';

  // Rough effective-rate approximations (2026). For directional guidance only.
  let netAnnual = 0, taxRate = 0, note = '';
  if (country === 'NL') {
    // 30% ruling tax-free portion (27% from 2027 — show both)
    const taxFree = gross * 0.30;
    const taxable = gross - taxFree;
    const taxOnTaxable = taxable * 0.495; // top bracket approx
    netAnnual = gross - taxOnTaxable;
    taxRate = taxOnTaxable / gross;
    note = '30% ruling applied. From 1 Jan 2027 drops to 27%.';
  } else if (country === 'DE') {
    netAnnual = gross * 0.62; // Steuerklasse I single, no church tax
    taxRate = 0.38;
    note = 'Lohnsteuer + Soli + KV/PV/RV/AV combined.';
  } else if (country === 'SE') {
    netAnnual = gross * 0.65;
    taxRate = 0.35;
    note = 'Municipal + state tax combined.';
  } else if (country === 'IE') {
    netAnnual = gross * 0.66;
    taxRate = 0.34;
    note = 'PAYE + USC + PRSI combined.';
  } else if (country === 'FI') {
    netAnnual = gross * 0.66;
    taxRate = 0.34;
    note = 'Foreign expert tax (32% flat) may apply first 4 yrs.';
  } else if (country === 'CH') {
    netAnnual = gross * 0.78;
    taxRate = 0.22;
    note = 'Zurich canton approx. Very low compared to other EU.';
  } else {
    netAnnual = gross * 0.65;
    taxRate = 0.35;
    note = 'Rough EU average.';
  }

  res.json({
    gross,
    country,
    under30,
    net_annual: Math.round(netAnnual),
    net_monthly: Math.round(netAnnual / 12),
    effective_tax_rate: Math.round(taxRate * 1000) / 10,
    note
  });
});

module.exports = router;
