const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const playbook = require('../lib/europe-playbook');

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

// =================== COUNTDOWN EXPLAINER ===================
const COUNTDOWN_EXPLAINER = {
  title: 'Why your 30th birthday matters',
  subtitle: 'Feb 1, 2027 — the Netherlands HSM under-30 threshold deadline',
  what: [
    'The Netherlands "Highly Skilled Migrant" (Kennismigrant) visa has TWO salary thresholds.',
    'Under 30: €4,357/mo gross (€52,284/yr) — your current bar.',
    '30 and over: €5,942/mo gross (€71,304/yr) — 36% higher.',
    'The threshold is locked at your APPLICATION DATE — apply at 29 and you keep €52k bar even when you turn 40 inside NL.'
  ],
  why_matters: [
    'For a 2-YOE Indian Java dev, €52k is achievable at many companies (Backbase, bol.com, ING).',
    '€71k is mid-to-senior level — bar shifts to Booking, Adyen, Picnic senior IC roles.',
    'After Feb 1, 2027, fewer Dutch companies can sponsor you cheaply.'
  ],
  if_you_miss: {
    title: 'If you miss the deadline — fallback plans',
    items: [
      { country: 'NL', plan: 'Aim for senior IC at Booking/Adyen with €72k+ offer (still viable but bar higher)' },
      { country: 'DE', plan: 'Germany Blue Card IT-shortage at €45,934/yr — no age threshold, very accessible' },
      { country: 'IE', plan: 'Ireland CSEP at €38k — no age threshold; lowest bar in EU' },
      { country: 'PhD', plan: 'PhD in NL: paid €2,800–3,400/mo as employee. PhD time counts toward PR. No HSM threshold.' },
      { country: 'SE', plan: 'Sweden Work Permit SEK 28,480/mo (~€2,500) — no age threshold' }
    ]
  },
  action: 'Best move: front-load Tier 1 NL applications between now and Dec 2026.'
};

// =================== PER-COUNTRY PLANS ===================
// Each country has multiple "paths": job (under 30), job (post 30), PhD, PhD → industry hybrid.
// Use this when user clicks a country card to drill into the right strategy.

const COUNTRY_PLANS = {
  NL: {
    code: 'NL', name: 'Netherlands', flag: '🇳🇱',
    intro: 'Best fit for under-30. HSM visa decision in 2 weeks. 30% tax ruling for first 5 years (drops to 27% from 2027). Firing protection 9/10.',
    paths: [
      {
        id: 'job_under30', kind: 'job', age: 'under30',
        title: 'Job route — Under 30', icon: '⭐',
        threshold: '€4,357/mo gross (€52,284/yr)',
        timeline: '4–8 weeks from offer to landing',
        summary: 'EASIEST path. HSM under-30 threshold locked at application date — apply before Feb 1, 2027 to keep this lower bar for life.',
        steps: [
          'Pass AWS SAA + complete Spring Boot 3 migration story (~3 months prep)',
          'Apply to Backbase, bol.com, Picnic, ING, Rabobank (Tier 1 — match your stack)',
          'Pass HackerRank screen + system design interview',
          'Offer → employer files HSM visa (IND 2-week SLA for recognized sponsors)',
          'Move to Amsterdam. 30% tax ruling kicks in (saves ~€8k/yr on €65k base)',
          'PR after 5 years with A2 Dutch'
        ],
        targets: ['Backbase', 'bol.com', 'Picnic', 'ING', 'Rabobank', 'ABN AMRO', 'Booking.com', 'Adyen'],
        salary: '€55–72k base. With 30% ruling, ~€4,100/mo net.',
        verdict: '⭐ Top recommended path for your profile.'
      },
      {
        id: 'job_post30', kind: 'job', age: 'post30',
        title: 'Job route — Post 30', icon: '💼',
        threshold: '€5,942/mo gross (€71,304/yr)',
        timeline: '4–8 weeks from offer; harder to find offers at this band',
        summary: 'Threshold jumps 36% at age 30. You need a senior-level offer. Doable but the bar shifts from mid to senior IC.',
        steps: [
          'Build 4+ YOE total before applying (2 more years at Toqqer or similar)',
          'Specialize: become known for distributed systems / payments / cloud architecture',
          'Target senior IC roles at Booking, Adyen, Picnic, ING senior tech',
          'Push base offers to €72k+ — negotiate hard against levels.fyi data',
          'Alternative: EU Blue Card route €5,688/mo for IT-shortage occupations',
          'Alternative: Orientation Year visa (Zoekjaar) AFTER a Dutch Master\'s = 12 months free job-search'
        ],
        targets: ['Booking.com senior', 'Adyen senior', 'Picnic platform', 'ING senior architect', 'KLM tech', 'Albert Heijn senior'],
        salary: '€72–95k base. Still gets 30% ruling.',
        verdict: 'Strong path but you need a sharper specialization.'
      },
      {
        id: 'phd', kind: 'phd', age: 'any',
        title: 'PhD route', icon: '🎓',
        threshold: 'PhDs are EMPLOYEES in NL: €2,800–3,400/mo gross',
        timeline: '4 years funded as TU employee',
        summary: 'Dutch PhDs are paid employees, not students. Strong AI/CS programs. PhD time counts toward PR clock.',
        steps: [
          'Identify supervisor + group match: distributed systems / ML / data engineering',
          'Apply via academictransfer.com (Jan–Apr for Sep start)',
          'Need: MTech (✓), publication (✓ Springer LNNS), GRE optional, IELTS 6.5+',
          'Universities for your background: TU Delft (Distributed Systems), TU Eindhoven (Data Science Center), UvA (Informatics Institute), VU (VU Network Institute)',
          'Defend in 4 years → 30% ruling continues, pivot to industry'
        ],
        targets: ['TU Delft', 'TU Eindhoven', 'University of Amsterdam (UvA)', 'VU Amsterdam', 'Leiden', 'University of Groningen'],
        salary: '€2,800–3,400/mo as PhD employee (gross). Net ~€2,200 with 30% ruling.',
        verdict: 'Your Springer publication + MTech NIT make you a strong candidate.'
      },
      {
        id: 'phd_to_job', kind: 'combined', age: 'any',
        title: 'PhD → Industry hybrid', icon: '🔀',
        threshold: 'PhD years count toward HSM 5-year PR clock',
        timeline: '4 yr PhD + immediate industry pivot',
        summary: 'Smart hybrid: PhD gives you 4 paid years in NL, builds research profile, AND counts toward PR.',
        steps: [
          'Start PhD year 1 at TU Delft/UvA/TU Eindhoven',
          'Summer internships year 2+ at Booking, Google Amsterdam, Adyen, ING AI Lab',
          'Build industry relationships during PhD',
          'Defend → pivot to Senior Research Engineer / Staff Engineer roles',
          'PR eligible by year 5 (PhD time counts toward residence)',
          'Pay range post-PhD: €75–100k base'
        ],
        targets: ['Booking Research', 'Google Amsterdam', 'Adyen', 'ING AI Lab', 'TomTom Research'],
        salary: '€2,800/mo during PhD → €75–100k post-PhD industry pivot.',
        verdict: 'Highest ceiling. Longest commitment. Best for AI/ML pivot or research-engineer track.'
      }
    ]
  },

  DE: {
    code: 'DE', name: 'Germany', flag: '🇩🇪',
    intro: 'No age-based threshold. Most accessible visa system in EU. PhDs paid as researchers (TV-L E13 ~€50k/yr). Firing protection 8/10 after 6mo probation.',
    paths: [
      {
        id: 'job_under30', kind: 'job', age: 'under30',
        title: 'Job route — Blue Card', icon: '💳',
        threshold: '€45,934/yr (IT shortage) — no age component',
        timeline: '4–8 weeks visa from India',
        summary: 'Germany has the most accessible EU visa for your profile. No age discount, but the base threshold is already low.',
        steps: [
          'Build same prep as NL plan (Java 21, SB3, AWS, K8s)',
          'Apply to Zalando, Personio, N26, Trivago, Delivery Hero (English-only)',
          'OR Chancenkarte (Opportunity Card) — you score 10/6 needed points',
          'Blue Card processed at German embassy in India (4–8 weeks)',
          'PR after 21 months with B1 German, 27 with A1, 33 without',
          'Citizenship at 5 years (new 2024 law)'
        ],
        targets: ['Zalando (Berlin)', 'Personio (Munich)', 'N26 (Berlin)', 'Celonis (Munich)', 'Delivery Hero', 'Trivago', 'SAP (direct)'],
        salary: '€60–80k Berlin, €65–90k Munich. No 30% ruling but lower cost of living.',
        verdict: 'Best backup if NL doesn\'t work. Or primary if you want zero deadline pressure.'
      },
      {
        id: 'job_post30', kind: 'job', age: 'post30',
        title: 'Job route — Post 30 (same Blue Card)', icon: '💼',
        threshold: '€45,934/yr (IT shortage) — UNCHANGED at 30',
        timeline: 'Same — 4–8 weeks',
        summary: 'No threshold change at 30. Germany doesn\'t penalize age — this is its biggest advantage over NL.',
        steps: [
          'Same as under-30 path',
          'More YOE actually helps (German Mittelstand values seniority)',
          'Salary expectations rise: target €75–90k for 4+ YOE',
          'Senior roles at SAP, BMW, Mercedes R&D become accessible'
        ],
        targets: ['SAP SE', 'BMW Tech', 'Mercedes-Benz R&D', 'Allianz Tech', 'Siemens', 'Bosch Global Software'],
        salary: '€75–110k for 4+ YOE.',
        verdict: 'Germany is your "no deadline" safety net.'
      },
      {
        id: 'phd', kind: 'phd', age: 'any',
        title: 'PhD route — TV-L E13 paid', icon: '🎓',
        threshold: 'PhDs paid TV-L E13: ~€50k/yr gross (researcher contract)',
        timeline: '3–5 years (varies by program)',
        summary: 'German PhDs are paid employees, not students. World-class CS programs. PhD time counts toward Blue Card residency.',
        steps: [
          'Apply directly to PhD positions on DAAD database, university job boards',
          'Top universities for your profile: TUM, RWTH Aachen, TU Darmstadt, MPI for Informatics (Saarbrücken)',
          'No GRE required; need MTech + IELTS/TOEFL + proposal',
          'Your Springer publication + intrusion detection ML work is strong fit',
          'TV-L E13 pays €4,000–4,800/mo gross (full-time researcher)',
          'PR after 4 years (PhD years count)'
        ],
        targets: ['TUM Informatics', 'RWTH Aachen', 'TU Darmstadt', 'MPI Informatik (Saarbrücken)', 'KIT (Karlsruhe)', 'University of Stuttgart'],
        salary: '€4,000–4,800/mo gross during PhD. ~€2,700/mo net.',
        verdict: '🌟 STRONGEST PhD option in EU for your profile. Paid as researcher, no tuition, world-class.'
      },
      {
        id: 'phd_to_job', kind: 'combined', age: 'any',
        title: 'PhD → SAP / BMW / Siemens R&D', icon: '🔀',
        threshold: 'PhD counts toward residency; smooth Blue Card transition',
        timeline: '3–5 yr PhD + industry pivot',
        summary: 'German PhD → industry R&D is a paved road. SAP, BMW, Mercedes-Benz, Siemens have direct PhD-to-Staff-Engineer pipelines.',
        steps: [
          'PhD at TUM, RWTH, or MPI',
          'Industry collaboration during PhD (most German PhDs do this)',
          'Defend → join SAP Research, BMW AI, Mercedes R&D as Senior Research Engineer',
          'Or join Bosch Center for AI (Bosch CR)',
          'Salary post-PhD: €80–120k'
        ],
        targets: ['SAP Research', 'BMW AI / Group Research', 'Mercedes-Benz R&D', 'Bosch Center for AI', 'Siemens AI Lab'],
        salary: '€4,500/mo during PhD → €80–120k post-PhD.',
        verdict: 'Best EV combined path. PhD is paid + industry payoff is massive.'
      }
    ]
  },

  SE: {
    code: 'SE', name: 'Sweden', flag: '🇸🇪',
    intro: 'Strongest firing protection (LAS still robust post-2022 reform). Doctoral candidates are employees. Low work-permit salary bar.',
    paths: [
      {
        id: 'job_under30', kind: 'job', age: 'under30',
        title: 'Job route — Work Permit', icon: '💳',
        threshold: 'SEK 28,480/mo (~€2,500) — no age component',
        timeline: '2–6 months; 30 days for certified employers',
        summary: 'Low salary bar but Swedish tech is competitive. Strong fit for stable, long-term career.',
        steps: [
          'Apply to Spotify, Klarna, Ericsson, Volvo Cars, Truecaller',
          'Truecaller especially Indian-friendly (Indian-founded)',
          'Pass interview loop (Spotify and Klarna are FAANG-tier)',
          'Sponsor files Migrationsverket application',
          'Move to Stockholm or Gothenburg',
          'PR after 4 years; citizenship after 5'
        ],
        targets: ['Spotify', 'Klarna', 'Ericsson', 'Volvo Cars', 'Truecaller', 'IKEA Digital', 'King (Activision)', 'Tink'],
        salary: 'SEK 600–800k (~€53–70k). Effective tax ~50%.',
        verdict: 'Strong path if firing protection is top priority.'
      },
      {
        id: 'job_post30', kind: 'job', age: 'post30',
        title: 'Job route — Post 30 (same)', icon: '💼',
        threshold: 'Same SEK 28,480/mo — no age effect',
        timeline: 'Same',
        summary: 'No age-based change. Senior roles are more competitive but no visa penalty.',
        steps: [
          'Same as under-30, but target senior IC roles',
          'Volvo Cars autonomous driving / Polestar EV are growing',
          'KTH connections help (alumni network)'
        ],
        targets: ['Spotify senior', 'Klarna staff', 'Volvo Cars senior', 'Ericsson principal', 'Polestar'],
        salary: 'SEK 800k–1.1M (€70–96k) for 4+ YOE.',
        verdict: 'Same EV as under-30 path.'
      },
      {
        id: 'phd', kind: 'phd', age: 'any',
        title: 'PhD route — KTH / Chalmers', icon: '🎓',
        threshold: 'Doctoral candidates are employees: ~SEK 35,000/mo gross (~€3,100)',
        timeline: '4 years funded',
        summary: 'Swedish PhDs are employees with social benefits. Strong CS programs at KTH (Stockholm), Chalmers (Gothenburg), Lund.',
        steps: [
          'Apply directly to advertised PhD positions (varbi.com, university sites)',
          'Top: KTH Royal Institute of Technology, Chalmers, Lund, Uppsala',
          'KTH especially strong in distributed systems + ML',
          'Need MTech + supervisor match',
          'Salary increases with seniority (research vs teaching duties)',
          'PR after 4 yrs (PhD time counts)'
        ],
        targets: ['KTH (Stockholm)', 'Chalmers (Gothenburg)', 'Lund University', 'Uppsala University', 'Linköping (computer vision)'],
        salary: 'SEK 35,000–40,000/mo gross during PhD.',
        verdict: 'KTH → Spotify/Klarna is a proven pipeline.'
      },
      {
        id: 'phd_to_job', kind: 'combined', age: 'any',
        title: 'PhD → Spotify / Klarna pipeline', icon: '🔀',
        threshold: 'Smooth transition; PhD years count toward PR',
        timeline: '4 yr PhD + industry',
        summary: 'KTH grads have a proven pipeline into Spotify, Klarna, Ericsson Research, and Volvo Cars autonomous driving.',
        steps: [
          'PhD at KTH or Chalmers',
          'Industry collaboration is encouraged (KTH explicitly partners with Ericsson, Spotify)',
          'Defend → join as Staff / Principal Engineer or Researcher',
          'Strong unions (Sweco / Akademikerförbundet) protect post-PhD job'
        ],
        targets: ['Spotify Research', 'Klarna Tech', 'Ericsson Research', 'Volvo Cars Autonomous'],
        salary: 'SEK 850k–1.2M post-PhD (€75–105k).',
        verdict: 'High EV but Sweden is small market — fewer industry options than NL/DE.'
      }
    ]
  },

  IE: {
    code: 'IE', name: 'Ireland', flag: '🇮🇪',
    intro: 'English-speaking. FAANG EU HQs (Google, Meta, Stripe, Workday). Easiest entry but WEAK firing protection first 12 months.',
    paths: [
      {
        id: 'job_under30', kind: 'job', age: 'under30',
        title: 'Job route — Critical Skills Permit (CSEP)', icon: '💳',
        threshold: '€38,000/yr — no age component, lowest EU threshold',
        timeline: '4–8 weeks (trusted partner) to 8–13 weeks standard',
        summary: 'Lowest salary bar in EU. Easy entry. But: effectively at-will for first 12 months.',
        steps: [
          'Apply to Stripe, Workday, Mastercard, Fidelity, HubSpot, Intuit',
          'Software dev is on the Critical Skills List (no labor market test)',
          'Pass interview loop (Stripe is FAANG-bar)',
          'Employer files CSEP application',
          'Move to Dublin; Stamp 4 (PR) after 2 years',
          'Citizenship after 5 years residence'
        ],
        targets: ['Stripe', 'Workday', 'Mastercard', 'Fidelity Investments', 'HubSpot', 'Salesforce', 'Microsoft / LinkedIn', 'Intuit', 'Google Dublin', 'Meta Dublin'],
        salary: '€55–75k base. SARP tax relief (35%) if eligible.',
        verdict: 'Strong if you accept the 12-month probation risk.'
      },
      {
        id: 'job_post30', kind: 'job', age: 'post30',
        title: 'Job route — Post 30 (same)', icon: '💼',
        threshold: 'Same €38k — no age effect',
        timeline: 'Same',
        summary: 'No age penalty. Senior roles at FAANG Dublin become accessible with more YOE.',
        steps: [
          'Same path, target senior IC roles',
          'Google/Meta/Stripe Dublin senior IC = €100k+ base',
          'Mastercard / Fidelity = stable enterprise Java tracks'
        ],
        targets: ['Google senior', 'Meta senior', 'Stripe senior', 'Mastercard staff', 'Fidelity senior'],
        salary: '€85–130k for 4+ YOE.',
        verdict: 'Same path, higher pay band.'
      },
      {
        id: 'phd', kind: 'phd', age: 'any',
        title: 'PhD route — TCD / UCD', icon: '🎓',
        threshold: 'Stipend ~€18,500–22,000/yr tax-free (SFI Centre funding)',
        timeline: '4 years',
        summary: 'Irish PhDs are stipend-funded (not employee contracts). Lower pay than NL/DE/SE but tax-free.',
        steps: [
          'Top: Trinity College Dublin (TCD), University College Dublin (UCD)',
          'SFI Centre-funded positions are best (~€22k tax-free + tuition waiver)',
          'Need MTech + supervisor + research proposal',
          'TCD strong in AI/ML, UCD strong in distributed systems',
          'PhD years can count toward Stamp 4 eligibility'
        ],
        targets: ['Trinity College Dublin', 'University College Dublin', 'National University of Ireland Galway', 'Dublin City University', 'University of Limerick'],
        salary: '€18,500–22,000/yr stipend (tax-free).',
        verdict: 'Lower pay than NL/DE/SE PhD. Only do it if specific advisor match.'
      },
      {
        id: 'phd_to_job', kind: 'combined', age: 'any',
        title: 'PhD → FAANG Dublin', icon: '🔀',
        threshold: 'PhD → Stamp 4 + senior IC at FAANG Dublin',
        timeline: '4 yr PhD + industry',
        summary: 'TCD/UCD PhDs have direct paths to Google, Meta, Stripe Dublin research/engineering teams.',
        steps: [
          'PhD at TCD or UCD',
          'Industry collaboration via SFI Centre partnerships',
          'Defend → pivot to FAANG Dublin or Mastercard Labs',
          'Senior IC offers €120–160k post-PhD'
        ],
        targets: ['Google Dublin Research', 'Meta Dublin', 'Stripe Engineering', 'Mastercard Labs', 'Workday R&D'],
        salary: 'Stipend → €120–160k post-PhD industry pivot.',
        verdict: 'Decent but Germany is better PhD EV.'
      }
    ]
  },

  FI: {
    code: 'FI', name: 'Finland', flag: '🇫🇮',
    intro: 'Strong firing protection. Aalto University → Helsinki tech pipeline. Wolt, Nokia hire Indian engineers regularly. Foreign expert tax (32% flat first 4 yrs).',
    paths: [
      {
        id: 'job_under30', kind: 'job', age: 'under30',
        title: 'Job route — Specialist Permit', icon: '💳',
        threshold: '€3,827/mo — no age component',
        timeline: '14 days fast-track (certified employer) to 1–3 months',
        summary: 'Foreign expert tax = 32% flat for first 4 years (saves vs normal ~46% bracket). Wolt/Nokia hire from India directly.',
        steps: [
          'Apply to Wolt (Helsinki) — Java/Kotlin, active sponsor',
          'Nokia — largest Indian tech employer in FI',
          'Supercell, F-Secure, Reaktor, Smartly.io',
          'Sponsor files Migri specialist permit',
          'D-visa allows entry while waiting for residence card',
          'PR after 4 yrs continuous A-permit'
        ],
        targets: ['Wolt (DoorDash)', 'Nokia', 'Supercell', 'F-Secure / WithSecure', 'Reaktor', 'Smartly.io', 'Vaisala', 'OP Financial'],
        salary: '€55–75k base. Net ~€3,200/mo with foreign expert tax.',
        verdict: 'Solid alternative to NL/DE for stability-focused candidates.'
      },
      {
        id: 'job_post30', kind: 'job', age: 'post30',
        title: 'Job route — Post 30 (same)', icon: '💼',
        threshold: 'Same €3,827/mo — no age effect',
        timeline: 'Same',
        summary: 'No threshold change. Nokia and Wolt favor experienced engineers.',
        steps: [
          'Same path, target senior IC at Nokia 5G/6G R&D or Wolt platform',
          'Nokia Bell Labs research roles open up with seniority'
        ],
        targets: ['Nokia Bell Labs', 'Wolt platform', 'Supercell senior', 'F-Secure principal'],
        salary: '€75–95k for 4+ YOE.',
        verdict: 'Strong stable career path.'
      },
      {
        id: 'phd', kind: 'phd', age: 'any',
        title: 'PhD route — Aalto', icon: '🎓',
        threshold: 'Doctoral researchers paid: €2,800–3,800/mo gross',
        timeline: '4 years funded',
        summary: 'Aalto University is the strongest CS PhD destination. University of Helsinki strong in ML. Both pay PhD researchers as employees.',
        steps: [
          'Apply directly to Aalto / U Helsinki PhD positions',
          'Aalto especially strong in distributed systems, security, ML',
          'Need MTech + supervisor match',
          'Foreign expert tax applies to PhDs too'
        ],
        targets: ['Aalto University', 'University of Helsinki', 'Tampere University', 'University of Oulu', 'University of Turku'],
        salary: '€2,800–3,800/mo gross.',
        verdict: 'Aalto PhD → Helsinki tech pipeline is well-established.'
      },
      {
        id: 'phd_to_job', kind: 'combined', age: 'any',
        title: 'PhD → Nokia / Wolt / Supercell', icon: '🔀',
        threshold: 'PhD years count toward PR',
        timeline: '4 yr PhD + industry',
        summary: 'Aalto PhDs have direct paths to Nokia Bell Labs, Wolt platform, F-Secure research.',
        steps: [
          'PhD at Aalto',
          'Industry collaboration via Aalto Industrial Internet Campus',
          'Defend → Nokia Bell Labs / F-Secure / Wolt R&D',
          'Senior IC: €85–110k post-PhD'
        ],
        targets: ['Nokia Bell Labs', 'F-Secure Research', 'Wolt Engineering', 'Supercell Tech'],
        salary: '€85–110k post-PhD.',
        verdict: 'Strong path. Smaller market than NL/DE.'
      }
    ]
  },

  CH: {
    code: 'CH', name: 'Switzerland', flag: '🇨🇭',
    intro: 'World-class PhD destination (ETH Zurich, EPFL). Job market QUOTA-LIMITED for non-EU and weak firing protection. PhD is the only winning angle.',
    paths: [
      {
        id: 'job_under30', kind: 'job', age: 'under30',
        title: 'Job route — Permit B (DIFFICULT)', icon: '⚠️',
        threshold: 'No federal minimum but cantonal "ortsüblich" enforced; CHF 95k–115k effective',
        timeline: 'QUOTA-limited; ~8,500 total non-EU permits/year; Zurich quota exhausts by Q3',
        summary: 'Switzerland is hard for 2-YOE Indians. Quota system + employer must prove no Swiss/EU candidate available + weak firing protection.',
        steps: [
          'Not recommended at 2 YOE',
          'If you do try: target Google Zurich, Meta Zurich, Microsoft (they bypass quota easier)',
          'Need to clear FAANG-tier interview bar',
          'Permit C (PR) only after 10 years — much longer than other EU'
        ],
        targets: ['Google Zurich (very tough)', 'Meta Zurich', 'Microsoft Switzerland'],
        salary: 'CHF 110–160k. Highest take-home in EU.',
        verdict: '🚫 SKIP at 2 YOE. Revisit at 5+ YOE.'
      },
      {
        id: 'job_post30', kind: 'job', age: 'post30',
        title: 'Job route — Post 30 (more accessible)', icon: '💼',
        threshold: 'Same Permit B + cantonal salary',
        timeline: 'Quota-limited but employer leverage helps',
        summary: 'Senior IC (5+ YOE) with FAANG offer is the realistic path.',
        steps: [
          'Build 5+ YOE',
          'Aim for senior IC at Google Zurich / Meta Zurich',
          'Specialize in distributed systems or ML infra',
          'Negotiate hard — Swiss comp is the highest in Europe'
        ],
        targets: ['Google Zurich senior', 'Meta Zurich senior', 'Roche pharma tech', 'UBS / Credit Suisse'],
        salary: 'CHF 140–200k base + RSUs.',
        verdict: 'Wait until you have 5+ YOE and a FAANG offer.'
      },
      {
        id: 'phd', kind: 'phd', age: 'any',
        title: 'PhD route — ETH Zurich / EPFL', icon: '🎓',
        threshold: 'Paid as research / teaching assistant: CHF 65–80k/yr gross',
        timeline: '4–5 years funded',
        summary: '🌟 STRONGEST PhD in Europe (arguably world-class). ETH Zurich, EPFL pay PhDs as employees at very high rates.',
        steps: [
          'ETH Zurich (Department of Computer Science) — top 3 worldwide',
          'EPFL Lausanne — strong AI/ML',
          'University of Zurich (DZNE/AI Center) — strong NLP',
          'Need very strong profile: MTech + publications + GRE 320+ + IELTS 7.5+',
          'Your Springer publication is a plus but ETH/EPFL bar is very high',
          'PhD years pay so well you SAVE during PhD'
        ],
        targets: ['ETH Zurich CS Department', 'EPFL (Lausanne)', 'University of Zurich', 'University of Basel'],
        salary: 'CHF 65–80k/yr (~€68–85k). Highest PhD pay in Europe.',
        verdict: '⭐ If you want PhD, this is THE top destination globally. Pay is also incredible.'
      },
      {
        id: 'phd_to_job', kind: 'combined', age: 'any',
        title: 'PhD → Google Zurich / FAANG', icon: '🔀',
        threshold: 'ETH/EPFL PhD bypasses most Swiss visa quota issues',
        timeline: '4–5 yr PhD + industry',
        summary: 'ETH/EPFL CS PhDs have the strongest industry pipeline in Europe: Google Zurich, DeepMind, Meta AI, Apple, financial sector all hire directly.',
        steps: [
          'PhD at ETH or EPFL',
          'Industry internships at Google Brain Zurich, DeepMind, Apple AI',
          'Defend → top of the market: Staff Engineer / Senior Research Scientist',
          'Post-PhD offers commonly CHF 200k+ TC',
          'Permit C path easier as PhD employee'
        ],
        targets: ['Google Zurich', 'Google DeepMind', 'Meta AI Zurich', 'Apple AI', 'DisneyResearch', 'Roche Pharma Tech', 'UBS quant'],
        salary: 'CHF 65k during PhD → CHF 200–300k post-PhD.',
        verdict: '🏆 HIGHEST EV path in this entire plan. Bar is brutal but payoff is unmatched.'
      }
    ]
  },

  BE: {
    code: 'BE', name: 'Belgium', flag: '🇧🇪',
    intro: 'Strong firing protection (8/10). Salary threshold high for 2 YOE. Better target after 4+ YOE. KU Leuven world-class for PhD.',
    paths: [
      {
        id: 'job_under30', kind: 'job', age: 'under30',
        title: 'Job route — Single Permit', icon: '⚠️',
        threshold: '€49,000–50,310/yr — too high for 2 YOE',
        timeline: '3–4 months',
        summary: 'Threshold too high for entry-level. Revisit after 4+ YOE.',
        steps: [
          'Build to 4+ YOE first',
          'Or target SWIFT, Euroclear (banking infra)',
          'Companies: Showpad, Collibra, ING Belgium'
        ],
        targets: ['SWIFT (La Hulpe)', 'Euroclear', 'KBC Bank', 'Showpad', 'Collibra'],
        salary: '€55–75k base.',
        verdict: '⏸️ Wait until 4 YOE.'
      },
      {
        id: 'job_post30', kind: 'job', age: 'post30',
        title: 'Job route — Post 30 (accessible)', icon: '💼',
        threshold: 'Same €49k+ — but achievable with 4+ YOE',
        timeline: '3–4 months',
        summary: 'After 4 YOE the threshold is achievable. Banking + biotech are growing.',
        steps: [
          'Target Euroclear / SWIFT / KBC senior Java',
          'AB InBev Tech (Leuven) — global brewery tech',
          'Brussels banking sector pays well'
        ],
        targets: ['Euroclear senior', 'SWIFT senior', 'AB InBev Tech', 'KBC senior'],
        salary: '€70–95k for 4+ YOE.',
        verdict: 'Decent path post-30.'
      },
      {
        id: 'phd', kind: 'phd', age: 'any',
        title: 'PhD route — KU Leuven', icon: '🎓',
        threshold: 'Paid as researcher: ~€2,200–2,800/mo gross',
        timeline: '4 years',
        summary: 'KU Leuven is consistently top-5 EU for CS. UCLouvain also strong. Both pay PhDs as employees.',
        steps: [
          'KU Leuven (top program)',
          'UCLouvain (Louvain-la-Neuve)',
          'Ghent University',
          'PhD years count toward residence'
        ],
        targets: ['KU Leuven', 'UCLouvain', 'Ghent University', 'VUB (Brussels)'],
        salary: '€2,200–2,800/mo gross.',
        verdict: 'KU Leuven is excellent if research interests align.'
      },
      {
        id: 'phd_to_job', kind: 'combined', age: 'any',
        title: 'PhD → European Tech Hub', icon: '🔀',
        threshold: 'PhD time counts toward residence',
        timeline: '4 yr PhD + industry',
        summary: 'KU Leuven PhDs go to Collibra, Showpad, SWIFT research, or European Commission tech roles.',
        steps: [
          'PhD at KU Leuven',
          'Industry: Collibra (data lineage), Showpad (sales enablement)',
          'European Commission has tech research roles for EU residents'
        ],
        targets: ['Collibra', 'Showpad', 'SWIFT Research', 'European Commission Tech'],
        salary: '€70–95k post-PhD.',
        verdict: 'Decent but Germany/Switzerland are stronger.'
      }
    ]
  },

  DK: {
    code: 'DK', name: 'Denmark', flag: '🇩🇰',
    intro: 'High salaries but "flexicurity" = easy firing despite Nordic reputation. PhD is the strong angle. DTU and Copenhagen are top.',
    paths: [
      {
        id: 'job_under30', kind: 'job', age: 'under30',
        title: 'Job route — Pay Limit Scheme', icon: '⚠️',
        threshold: 'DKK 514,000/yr (~€69,000) — high',
        timeline: '1–3 months (Fast-Track for certified employers)',
        summary: 'High salary bar but easy firing. Maersk, Novo Nordisk, Unity sponsor IT roles.',
        steps: [
          'Target Maersk, Novo Nordisk, Unity, Trustpilot, Pleo',
          'Fast-Track Scheme available with certified employers',
          'PR after 4 years'
        ],
        targets: ['Maersk', 'Novo Nordisk (tech)', 'Unity (Copenhagen)', 'Trustpilot', 'Pleo', 'Lego Digital'],
        salary: 'DKK 600–800k base.',
        verdict: 'Skip unless very high offer + flexicurity acceptable.'
      },
      {
        id: 'job_post30', kind: 'job', age: 'post30',
        title: 'Job route — Post 30', icon: '💼',
        threshold: 'Same DKK 514k',
        timeline: 'Same',
        summary: 'Senior IC roles at Maersk / Unity are accessible. Same firing risk.',
        steps: ['Build YOE first', 'Target senior IC', 'Negotiate generous severance upfront'],
        targets: ['Maersk senior', 'Unity senior', 'Novo Nordisk staff'],
        salary: 'DKK 800k–1.1M.',
        verdict: 'Same risk profile.'
      },
      {
        id: 'phd', kind: 'phd', age: 'any',
        title: 'PhD route — DTU / Copenhagen', icon: '🎓',
        threshold: 'PhDs paid ~DKK 30,000/mo gross + tax-free researcher status (27% flat 7 yrs)',
        timeline: '3 years (shorter than NL/DE/SE)',
        summary: 'DTU (Technical University of Denmark) and University of Copenhagen pay PhDs as researchers. 27% flat tax for 7 years is excellent.',
        steps: [
          'DTU — strong systems/AI/cybersecurity',
          'University of Copenhagen — Department of Computer Science',
          'Aarhus University — CS strong in algorithms',
          '27% Researcher tax + standard PhD pay = competitive net pay'
        ],
        targets: ['DTU', 'University of Copenhagen', 'Aarhus University', 'IT University of Copenhagen'],
        salary: 'DKK 30,000+/mo (~€4,000), 27% flat tax = excellent net.',
        verdict: 'PhD is the strongest Denmark angle.'
      },
      {
        id: 'phd_to_job', kind: 'combined', age: 'any',
        title: 'PhD → Maersk / Novo Nordisk Tech', icon: '🔀',
        threshold: 'PhD time counts toward PR',
        timeline: '3 yr PhD + industry',
        summary: 'DTU PhDs go to Maersk Tech, Novo Nordisk, Unity, or pharma research.',
        steps: ['PhD at DTU', 'Industry: Maersk / Novo Nordisk / Lego Digital', 'PR after PhD'],
        targets: ['Maersk Tech', 'Novo Nordisk', 'Unity Research', 'Lego Digital'],
        salary: 'DKK 800k+ post-PhD.',
        verdict: 'Good combined path. PhD bypasses easy-firing risk for 3 years.'
      }
    ]
  },

  AT: {
    code: 'AT', name: 'Austria', flag: '🇦🇹',
    intro: 'Strong protections. Small tech market. ISTA and TU Wien are world-class research. German language helpful for jobs, not PhD.',
    paths: [
      {
        id: 'job_under30', kind: 'job', age: 'under30',
        title: 'Job route — RWR Card', icon: '⚠️',
        threshold: '€3,030/mo (~€42k) for ICT shortage occupation',
        timeline: '8 weeks statutory; 2–4 months actual',
        summary: 'Threshold accessible but tech market is small. German language strongly helpful.',
        steps: [
          'Target Bitpanda, Dynatrace, Tricentis',
          'A1 Telekom, Erste Group banking',
          'Start learning German A1+'
        ],
        targets: ['Bitpanda (Vienna)', 'Dynatrace', 'Tricentis', 'A1 Telekom', 'Erste Group', 'Runtastic (adidas)'],
        salary: '€55–75k.',
        verdict: 'OK backup option. German barrier real.'
      },
      {
        id: 'job_post30', kind: 'job', age: 'post30',
        title: 'Job route — Post 30', icon: '💼',
        threshold: 'Same €3,030/mo',
        timeline: 'Same',
        summary: 'Same threshold; senior roles more accessible.',
        steps: ['Same path, target senior IC roles'],
        targets: ['Bitpanda senior', 'Dynatrace principal'],
        salary: '€75–95k.',
        verdict: 'Same profile.'
      },
      {
        id: 'phd', kind: 'phd', age: 'any',
        title: 'PhD route — ISTA / TU Wien', icon: '🎓',
        threshold: 'PhDs paid ~€2,500/mo (TU Wien) to €3,000/mo (ISTA)',
        timeline: '3–4 years',
        summary: 'ISTA (Institute of Science and Technology Austria) is world-class research; TU Wien also strong CS. Both pay PhDs as employees.',
        steps: [
          'ISTA (Klosterneuburg) — top-3 research institute in Europe',
          'TU Wien — top Austrian CS program',
          'University of Vienna',
          'English-language PhDs available (no German required)'
        ],
        targets: ['ISTA (Klosterneuburg)', 'TU Wien', 'University of Vienna', 'JKU Linz', 'University of Innsbruck'],
        salary: '€2,500–3,000/mo gross.',
        verdict: 'ISTA is hidden gem — world-class research, English-only, full funding.'
      },
      {
        id: 'phd_to_job', kind: 'combined', age: 'any',
        title: 'PhD → European Tech', icon: '🔀',
        threshold: 'PhD time counts toward residence',
        timeline: '3–4 yr PhD + industry',
        summary: 'ISTA/TU Wien PhDs can pivot to Bitpanda, Dynatrace, or move to Germany/Switzerland.',
        steps: ['PhD at ISTA or TU Wien', 'Industry: Bitpanda / Dynatrace', 'Or relocate to DE/CH post-PhD with EU mobility'],
        targets: ['Bitpanda', 'Dynatrace', 'Or relocate to DE/CH'],
        salary: '€70–95k post-PhD.',
        verdict: 'Use Austria as PhD springboard to bigger EU markets.'
      }
    ]
  }
};

// =================== ROUTES ===================

router.get('/europe/reference', (req, res) => {
  // Send lightweight playbook summary (country codes only) — full data fetched lazily per country
  const playbookIndex = Object.keys(playbook).reduce((acc, code) => {
    acc[code] = { code, name: playbook[code].name, flag: playbook[code].flag, hasPlaybook: true };
    return acc;
  }, {});
  res.json({
    countries: COUNTRIES,
    companies: COMPANIES,
    skills: SKILLS,
    prepPlan: PREP_PLAN,
    anchors: ANCHORS,
    countdownExplainer: COUNTDOWN_EXPLAINER,
    countryPlans: COUNTRY_PLANS,    // keep legacy data for backward compat
    playbookIndex                    // new: which countries have deep playbooks
  });
});

router.get('/europe/playbook/:code', (req, res) => {
  const code = (req.params.code || '').toUpperCase();
  const data = playbook[code];
  if (!data) return res.status(404).json({ error: 'Playbook not found for ' + code });
  res.json(data);
});

router.get('/europe/country/:code', (req, res) => {
  const code = (req.params.code || '').toUpperCase();
  // Prefer deep playbook if available, fall back to legacy country plan
  const data = playbook[code] || COUNTRY_PLANS[code];
  if (!data) return res.status(404).json({ error: 'Country not found' });
  res.json(data);
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
