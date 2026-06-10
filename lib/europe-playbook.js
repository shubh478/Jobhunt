// Deep per-country playbook for landing a Europe software job.
// Sourced from Jun 2026 research (IND, BAMF, Migrationsverket, company career
// pages, Glassdoor, LeetCode Discuss, levels.fyi, Numbeo, government tax sites).
// Static reference data — no runtime API calls needed.

module.exports = {

  // ============================== NETHERLANDS ==============================
  NL: {
    code: 'NL', name: 'Netherlands', flag: '🇳🇱',
    capital: 'Amsterdam',
    tagline: 'Best EU bet for under-30 Indian Java devs. Land in 4-8 weeks. 30% tax break. World-class WLB.',

    overview: {
      why: 'NL is #1 because: (a) HSM visa is decided in 2 weeks, (b) under-30 salary threshold (€4,357/mo) is achievable by most mid-level Spring Boot devs, (c) 90%+ of tech jobs are conducted in English, (d) firing protection 9/10, (e) the 30% tax ruling adds meaningful net pay.',
      key_facts: [
        'Population: 17.9M — concentrated tech hubs in Amsterdam, Utrecht, Eindhoven, Rotterdam',
        'English fluency in tech: ~95% of engineers speak business-fluent English',
        'Indian tech engineers in NL: ~25,000+ (mostly Amsterdam, Eindhoven)',
        'Direct flights from Hyderabad/Bengaluru/Delhi: KLM, Air India, daily',
        'Time zone: CET/CEST — overlaps 5-9 hrs with India'
      ]
    },

    visaTypes: [
      {
        name: 'Highly Skilled Migrant (Kennismigrant)',
        code: 'HSM',
        who_for: 'Mid-level engineers with a job offer from an IND-recognized sponsor',
        threshold: 'Under 30: €4,357/mo gross | 30+: €5,942/mo gross | Recent grad: €3,122/mo',
        processing: '2 weeks SLA (recognized sponsor) | 4-8 weeks from India incl. MVV',
        cost: '€350 fee paid by employer; relocation typically covered',
        pros: ['Fastest visa in EU', '30% tax ruling auto-eligible', 'Spouse gets unrestricted work permit', 'No labor market test'],
        cons: ['Locked to employer for first 3 months (then portable)', '30% ruling reduced to 27% from 2027'],
        family: 'Spouse + kids included. Spouse can work any job/freelance. Kids attend free public school.',
        pr_path: 'PR after 5 years + A2 Dutch + civic integration exam',
        citizenship_path: '5 years + B1 Dutch + naturalization exam. Must surrender Indian citizenship (use OCI).',
        best_for: '⭐ This is YOUR primary visa target.'
      },
      {
        name: 'EU Blue Card',
        code: 'EU-BC',
        who_for: 'Highly qualified with degree + €5,688/mo (regulated profession)',
        threshold: '€5,688/mo gross (lower than HSM 30+)',
        processing: '90 days statutory',
        cost: '€350 fee',
        pros: ['EU mobility — easier move to DE/FR/etc later', 'Same 30% ruling'],
        cons: ['Slower than HSM', 'Same employer for first 12 mo'],
        family: 'Same as HSM',
        pr_path: '5 years (or 21 mo with B1 Dutch in some interpretations)',
        best_for: 'If you might want to bounce around EU later.'
      },
      {
        name: 'Orientation Year (Zoekjaar)',
        code: 'ZJ',
        who_for: 'Recent grads of Dutch Masters/PhD OR top-200 ranked foreign Masters within 3 yrs',
        threshold: 'NO salary requirement — pure job-search visa',
        processing: '4-8 weeks',
        cost: '€243',
        pros: ['1 year to find any job, any salary', 'Convert to HSM with reduced threshold (€3,122/mo) once hired'],
        cons: ['Need eligible degree (NIT Surathkal might qualify under top-200 list — check the list)', 'Self-funded during search'],
        family: 'Spouse can join with own work permit',
        pr_path: 'Counts toward 5-year clock once converted',
        best_for: 'If your MTech qualifies — this is a backup if direct HSM fails.'
      },
      {
        name: 'PhD Researcher (Wetenschappelijk onderzoeker)',
        code: 'PhD',
        who_for: 'PhD candidates at Dutch universities — paid as EMPLOYEES',
        threshold: 'No threshold — university salary contract (~€2,800–3,400/mo)',
        processing: '4-8 weeks',
        cost: 'Paid by university',
        pros: ['Pay is competitive', '4-yr funded position', '30% ruling applies', 'Time counts toward PR'],
        cons: ['Locked to PhD program', 'Stipend < industry pay'],
        family: 'Same family rights as HSM',
        pr_path: '5 years (PhD time counts fully)',
        best_for: 'PhD route — strong fallback if industry job fails.'
      },
      {
        name: 'Intra-Company Transfer (ICT)',
        code: 'ICT',
        who_for: 'Employees of multinationals transferring to Dutch branch',
        threshold: '€4,357/mo under-30 / €5,942/mo 30+',
        processing: '2-8 weeks',
        cost: 'Employer pays',
        pros: ['No labor market test', 'Same threshold as HSM'],
        cons: ['Tied to same employer; ends if you leave'],
        family: 'Spouse + kids',
        pr_path: '5 years',
        best_for: 'If you join Booking India / Adyen India / TomTom India and transfer.'
      }
    ],

    market2026: {
      hiring_trend: 'STRONG. Post-2024 layoffs absorbed; 2025-26 saw renewed Java/backend hiring at Booking, Adyen, ING, bol.com, Picnic. AI/ML roles growing fast.',
      hot_skills: ['Java 21 + Spring Boot 3', 'Kotlin (alongside Java)', 'Kafka/event-driven', 'Kubernetes + EKS/GKE', 'AWS (dominant) > GCP > Azure', 'PostgreSQL deep knowledge', 'Distributed systems patterns', 'Idempotency / saga / outbox patterns (Adyen loves these)'],
      cold_skills: ['Pure frontend (lower demand than backend)', 'PHP (legacy only)', 'Manual QA (automated)', 'Generic full-stack without specialization'],
      faang_presence: 'Booking.com (Dutch unicorn, FAANG-equivalent), Adyen (similar bar), Google Amsterdam (small), Uber Amsterdam, Datadog, Stripe (small office)',
      indian_engineers: '~25,000+ Indian tech engineers; large communities at Booking, Adyen, ING, bol.com, Picnic, Backbase. Indian engineering directors exist.',
      visa_friendly_companies: 18000 + ' IND-recognized sponsors total. Top 50 hire from India regularly.',
      layoff_status: '2024 layoffs at Booking/ASML mostly recovered by mid-2025. Klarna NL minimal exposure. ING expanding tech in 2026.',
      salary_trend: 'Mid-level Java +8% YoY 2024→2026. €65k → €72k now common for 2-3 YOE strong candidates.',
      remote_policy: 'Hybrid dominant (2-3 days office). Fully remote rare. Booking/Adyen require Amsterdam presence.'
    },

    costOfLiving: {
      city: 'Amsterdam',
      rent_1br_center: '€1,800 – €2,400/mo',
      rent_1br_outside: '€1,400 – €1,800/mo',
      rent_shared_room: '€700 – €1,100/mo',
      utilities: '€150 – €220/mo',
      groceries: '€350 – €500/mo single',
      transport_pass: '€100/mo NS+OV',
      eating_out: '€18 – €30 lunch, €40 – €70 dinner',
      gym: '€30 – €50/mo',
      health_insurance: '€145 – €185/mo (mandatory)',
      monthly_total_single: '€2,800 – €3,500 comfortable; €2,200 frugal',
      verdict: 'On €65k with 30% ruling (~€4,100 net), you save €800–€1,500/mo even in Amsterdam.'
    },

    taxSalary: {
      brackets_2026: 'Box 1 income tax: 36.97% up to €75,624; 49.50% above',
      special_regime: '30% ruling: first 30% of salary is TAX-FREE for 5 years (drops to 27% from Jan 1, 2027)',
      effective_rate_65k: 'With 30% ruling on €65k base: effective ~24% — you keep ~€49k net = €4,100/mo',
      without_30_ruling: 'On €65k without ruling: ~€44k net = €3,650/mo',
      tax_filing: 'April–May annually. M-form first year. Belastingdienst handles via DigiD portal.',
      holiday_pay: '8% of annual salary paid in May ("vakantiegeld") — most contracts EXCLUDE this from gross quoted',
      pension: '~6% employee, ~12% employer (varies by sector). Not access until retirement age.'
    },

    companies: {
      tier1_immediate: [
        {
          name: 'Backbase', city: 'Amsterdam', stack: 'Java/Spring + Angular + K8s — YOUR STACK',
          interview: '4 rounds: HR screen → tech (Java + Spring deep dive) → system design (banking flow) → culture fit. Bar: LC medium. Sponsors HSM, ~3-week visa turnaround.',
          salary: '€60–75k base for 2 YOE',
          why: 'Banking software, exact stack match, India-friendly engineering culture',
          apply_at: 'backbase.com/careers (look for Bangalore/Amsterdam openings — they cross-list)'
        },
        {
          name: 'bol.com', city: 'Utrecht', stack: 'Java + Kotlin, GCP, Kafka, PostgreSQL',
          interview: '5 rounds: recruiter → HackerRank (2 mediums) → tech (live coding 60min) → system design (e-commerce flavored) → behavioral. Bar: LC medium-hard.',
          salary: '€62–78k base for 2 YOE',
          why: 'Largest Dutch e-commerce platform; pure Java/Kotlin shop; sponsors regularly',
          apply_at: 'banen.bol.com'
        },
        {
          name: 'Picnic', city: 'Amsterdam', stack: 'Spring Boot heavy, AWS, Kafka, Java 21',
          interview: '4 rounds: recruiter → CodeSignal → tech interview → final loop (system design + behavioral). Bar: LC medium.',
          salary: '€58–72k base + relocation €5k',
          why: 'Grocery delivery scale-up; Spring Boot is their primary stack; hires from India actively',
          apply_at: 'picnic.app/careers'
        },
        {
          name: 'ING', city: 'Amsterdam (HQ) / Bucharest / Manila',
          stack: 'Java/Spring Boot + Angular + Kafka + Azure',
          interview: '5 rounds: HR → HackerRank → tech (Java internals — JVM, GC, threads) → system design (banking) → behavioral (Orange Code values STAR). India-friendly via ING Hubs.',
          salary: '€55–68k Amsterdam (lower than fintech but stable)',
          why: 'Largest engineering org in NL banking. Your stack matches PERFECTLY.',
          apply_at: 'ing.jobs'
        },
        {
          name: 'Rabobank', city: 'Utrecht',
          stack: 'Java/Spring, Azure, microservices',
          interview: '4 rounds: HR → tech → system design → culture. Bar: LC medium.',
          salary: '€55–70k for 2 YOE',
          why: 'Cooperative bank, slower-paced, high stability, sponsor regularly',
          apply_at: 'rabobank.jobs'
        },
        {
          name: 'ABN AMRO', city: 'Amsterdam',
          stack: 'Java/Spring, Kafka, Azure',
          interview: '4 rounds incl. tech + system design + behavioral',
          salary: '€55–72k for 2 YOE',
          why: 'Big bank, banking transformation underway, hiring Java mid-level actively',
          apply_at: 'abnamro.com/careers'
        }
      ],
      tier2_after_prep: [
        {
          name: 'Booking.com', city: 'Amsterdam',
          stack: 'Java/Kotlin/Perl, Spring, Kafka, K8s, MySQL',
          interview: '5 stages over 4-8 weeks. HR → 90min OA (algos + REST + SQL) → 1-2 tech interviews (LC medium-HARD) → system design → behavioral. Bar: ~LC 200-250 mediums, occasional hards.',
          salary: '€68–80k base + 5-10% bonus, no equity',
          why: 'Sponsor king; 3000+ engineers; relocates 300+/yr from India',
          prep_tips: 'Practice their tagged LC list. Strong on trees/graphs/sliding window. System design: hotel search, payments idempotency.',
          apply_at: 'careers.booking.com'
        },
        {
          name: 'Adyen', city: 'Amsterdam',
          stack: 'Java (heavy), PostgreSQL, custom infra, payments',
          interview: 'Famous "Adyen formula": recruiter → take-home (4-8h payment service) → tech interview discussing assignment (probe edge cases hard) → architecture → values fit with execs.',
          salary: '€70–85k base, low offer rate but world-class',
          why: 'Top NL payments unicorn; you join an elite engineering culture',
          prep_tips: 'NO LeetCode emphasis. Production-quality code, money handling, idempotency, distributed systems. Read Adyen engineering blog.',
          apply_at: 'careers.adyen.com'
        }
      ],
      tier3_transfer: [
        {
          name: 'Booking.com India → Amsterdam',
          path: 'Apply to Booking India Bangalore office → perform 12-18 months → internal transfer to Amsterdam. Visa fully sponsored. Booking actively moves Indian engineers.',
          note: 'Lower interview bar than direct hire, smoother visa path'
        },
        {
          name: 'Philips India → Eindhoven',
          path: 'Philips has Bangalore and Pune offices with regular Netherlands transfers, especially for healthcare imaging / AI roles',
          note: 'German + Dutch + English mix; Philips is engineering-heavy'
        }
      ]
    },

    prepRoadmap: [
      {
        month: 1, focus: 'Foundation — Java 21 + Spring Boot 3.x migration',
        tasks: [
          'Build URL shortener in Java 21 + Spring Boot 3.x with virtual threads, PostgreSQL, Redis (10-15 hrs/wk)',
          'Migrate one Toqqer service from SB 2.x to 3.x (jakarta.* namespace) to talk through in interviews',
          'Start AWS Solutions Architect Associate (€150 fee, Cantrill course on Udemy)',
          'LeetCode: refresh 30 easy + start mediums on arrays/hashmaps'
        ],
        why_nl_specific: 'Dutch companies (Booking, Adyen, Picnic, ING) test current-version skills. SB 2.x → 3.x migration story is a real interview signal.'
      },
      {
        month: 2, focus: 'Java depth + LeetCode patterns',
        tasks: [
          '40 LC mediums: trees, BFS/DFS, sliding window, two pointers',
          'Java concurrency: synchronized, ReentrantLock, CompletableFuture, virtual threads',
          'Spring internals on Baeldung: @Transactional propagation, bean lifecycle, AutoConfiguration',
          'Build a Kafka producer-consumer side project'
        ],
        why_nl_specific: 'ING interviews go DEEP on JVM/GC/threads. Adyen probes concurrency hard. Booking expects strong DSA.'
      },
      {
        month: 3, focus: 'System design + AWS exam',
        tasks: [
          'Alex Xu Vol 1 cover-to-cover',
          'Practice 5 designs out loud: URL shortener, rate limiter, chat, payment idempotency, notification',
          'TAKE AWS SAA EXAM (target end of month)',
          'LeetCode: 30 mediums on DP + graphs'
        ],
        why_nl_specific: 'NL system design interviews ALWAYS test payments/idempotency (Adyen). Cloud cert is a hard requirement signal.'
      },
      {
        month: 4, focus: 'K8s + Company-tagged LC',
        tasks: [
          'Docker + K8s basics; deploy SB3 project to free k3s/EKS cluster',
          '20 mediums + 10 hards from LeetCode company-tagged: Booking, Adyen, ING',
          'Read Booking engineering blog (their hotel search architecture is interview gold)',
          'Practice STAR stories from your Toqqer work'
        ],
        why_nl_specific: 'Tagged lists are accurate-ish for Booking/Adyen. K8s now expected at most NL Java shops.'
      },
      {
        month: 5, focus: 'Mock interviews + CV + apply',
        tasks: [
          '2 mock interviews/week (Pramp + interviewing.io)',
          'Rewrite CV to EU format: 1 page, no photo, DD-MM-YYYY dates, no marital status',
          'LinkedIn headline: "Java/Spring Boot Engineer | Open to Relocation to Amsterdam | Visa Sponsorship Needed"',
          'APPLY to Tier 1: Backbase, bol.com, Picnic, ING, Rabobank, ABN AMRO'
        ],
        why_nl_specific: 'Dutch CVs are 1 page max for 2-YOE. No photo (anti-bias). Direct, no flowery language.'
      },
      {
        month: 6, focus: 'Apply Tier 2 + interview sprint',
        tasks: [
          'APPLY to Tier 2: Booking, Adyen, Mendix, Albert Heijn, Coolblue',
          'Continue 5-7 LC/week to stay sharp',
          'Negotiate using levels.fyi + Glassdoor data',
          'Floor: €60k base for 2 YOE; target €68-75k'
        ],
        why_nl_specific: 'NL companies negotiate openly. Ask for 30% ruling explicitly. Push for €5-8k relocation budget.'
      }
    ],

    interviewGuide: [
      {
        company: 'Booking.com',
        format: '90-min HackerRank → 1-2 tech rounds → system design → behavioral',
        topics: ['LC medium-hard (Trees, Graph BFS/DFS, Intervals, Sliding Window)', 'Hotel search system design', 'Payments idempotency', 'Strong on edge cases'],
        sample_questions: ['Design a hotel search with filters and inventory', 'Implement LRU cache from scratch', 'How would you handle double-booking?', 'Variant of word ladder / course schedule'],
        culture: 'Customer-first, data-driven, ownership',
        gotchas: 'Solution efficiency matters — passing visible tests is insufficient. Will probe Big-O hard.'
      },
      {
        company: 'Adyen',
        format: 'Take-home (4-8h) → tech discussion → architecture → values/exec round',
        topics: ['Payment service design', 'Idempotency keys', 'Retries with backoff', 'Distributed transactions', 'Code quality > LeetCode'],
        sample_questions: ['Build a payment authorization service with idempotency', 'How do you handle a flaky downstream payment processor?', 'Explain ACID vs BASE in payment context', 'When would you choose async vs sync flow?'],
        culture: 'Long-term thinking, simplicity, no-ego',
        gotchas: 'Take-home is graded on production-quality. Add tests, README, error handling. Read Adyen engineering blog before applying.'
      },
      {
        company: 'ING',
        format: 'HackerRank Java → tech (Java internals) → system design (banking) → behavioral STAR',
        topics: ['JVM/GC deep', 'Spring internals (transactional, proxies, beans)', 'JPA/Hibernate N+1', 'Banking compliance', 'Orange Code values'],
        sample_questions: ['Explain how @Transactional works under the hood', 'When does @Transactional fail silently?', 'Design a money transfer with eventual consistency', 'Tell me about a time you handled stakeholder pushback'],
        culture: 'Orange Code values: Take it on. Help others. Be one step ahead.',
        gotchas: 'STAR is heavily expected. Memorize 6-8 stories with measurable impact.'
      }
    ],

    communities: [
      { name: 'India Society Netherlands', type: 'Diaspora', what: 'Largest Indian community group, monthly meetups Amsterdam' },
      { name: 'Hindustani Helpdesk NL', type: 'Settlement help', what: 'BSN, housing, banking guidance for newcomers' },
      { name: 'r/Netherlands', type: 'Reddit', what: 'Active expat sub; weekly housing thread; visa Q&A' },
      { name: 'Amsterdam Java User Group', type: 'Tech meetup', what: 'Monthly meetups, networking with Booking/Adyen/ING engineers' },
      { name: 'Bridge2Talent / GeeksforGeeks Recruiters', type: 'Recruiter', what: 'Indian recruiters specializing in NL placements' },
      { name: 'IamExpat Career Events', type: 'Job fair', what: 'Job fairs in Amsterdam, Eindhoven, Utrecht 2-3x/year' },
      { name: 'LinkedIn group: Indians in Netherlands Tech', type: 'Network', what: '12k+ members, job postings + mentorship' }
    ],

    livingInfo: {
      cities: [
        { name: 'Amsterdam', vibe: 'Cosmopolitan, English everywhere, expensive but vibrant', expat_density: 'Very high (~25% population non-Dutch)', rent_1br: '€1,800-2,400', best_for: 'Booking, Adyen, ING, Picnic, Mollie' },
        { name: 'Utrecht', vibe: 'Smaller, family-friendly, 25 min train to Amsterdam', expat_density: 'High in tech areas', rent_1br: '€1,300-1,800', best_for: 'bol.com, Rabobank, ABN' },
        { name: 'Eindhoven', vibe: 'Tech-heavy, Brainport region, lots of engineers', expat_density: 'High in IT', rent_1br: '€1,100-1,600', best_for: 'ASML, Philips, TomTom' },
        { name: 'Rotterdam', vibe: 'Working-class, port city, cheapest big city', expat_density: 'Moderate', rent_1br: '€1,200-1,700', best_for: 'Mendix, Coolblue' }
      ],
      transport: 'Bike-first culture. Train/tram/bus excellent. OV-chipkaart for €110/mo unlimited. Cars rare in cities.',
      healthcare: 'Mandatory insurance (€145-185/mo). High quality but GP gatekeeper system. Dental NOT covered by basic.',
      banking: 'ING/ABN AMRO/Rabobank offer expat accounts. Bunq for app-only. iDEAL is the dominant payment system.',
      social: 'Dutch are direct, punctual, plan-everything. Bring lunch to office (broodjes culture). Birthdays are A Thing.',
      housing_tip: 'Use Pararius, Funda, Kamernet. Be ready with: employment contract + 3-month payslips + ID. Furnished pricier but worth it first 6 months.'
    },

    actionPlan90Day: [
      { week: '1', action: 'Complete AWS SAA prep registration + start side project + audit current resume against EU 1-page format' },
      { week: '2-3', action: 'Migrate Toqqer service to SB 3.x; document the migration in detail (interview gold)' },
      { week: '4-6', action: 'LeetCode 30 mediums; AWS SAA halfway; complete URL shortener side project' },
      { week: '7-8', action: 'AWS SAA exam; system design book chapters 1-5; mock interviews 1/week' },
      { week: '9-10', action: 'CV/LinkedIn final polish; START APPLYING to Tier 1 (6 companies)' },
      { week: '11-12', action: 'Interview loops; backup applications to Tier 2; negotiate first offer with leverage from second' }
    ]
  },

  // ============================== GERMANY ==============================
  DE: {
    code: 'DE', name: 'Germany', flag: '🇩🇪',
    capital: 'Berlin (tech: Berlin + Munich)',
    tagline: 'No age penalty. Most accessible visa for Indians. Strong PhD pathway. SAP transfer route from India.',

    overview: {
      why: 'Germany has the most accessible EU visa for your profile: Blue Card IT-shortage at €45,934 has no age threshold. The Chancenkarte (Opportunity Card) launched 2024 lets you enter without a job. PhD route is paid (TV-L E13 ~€50k/yr). Berlin tech is English-only.',
      key_facts: [
        'Population: 84M — Europe\'s largest tech market',
        'Tech hubs: Berlin (startups, English), Munich (BMW/Siemens/Allianz, German often needed), Frankfurt (banking), Hamburg (Otto/Airbus)',
        'Indian tech engineers: ~80,000+ in Germany',
        'Direct flights HYD/BLR/DEL → FRA/MUC/BER daily (Lufthansa, Air India)',
        'German citizenship 2024 reform: 5 years residency (was 8); dual citizenship now allowed'
      ]
    },

    visaTypes: [
      {
        name: 'EU Blue Card (IT-Shortage)',
        code: 'EU-BC',
        who_for: 'University-degree holders with job offer in shortage IT roles',
        threshold: '€45,934/yr (IT shortage occupation) | €50,700/yr regular',
        processing: '4-12 weeks at German missions in India',
        cost: '€100 application + €100 issuance',
        pros: ['No age threshold — UNLIKE NL', 'Fast PR: 21 months with B1 German', 'Spouse work permit immediate', 'EU mobility'],
        cons: ['Need to physically apply at German consulate in India', 'Some processing delays in spring peak'],
        family: 'Spouse + dependent kids. Spouse can work freely.',
        pr_path: '21 months with B1 German | 27 months with A1 | 33 months without',
        citizenship_path: '5 years (2024 reform) + B1 + civic test. Dual citizenship now allowed.',
        best_for: '⭐ Your primary German visa target.'
      },
      {
        name: 'Opportunity Card (Chancenkarte)',
        code: 'CK',
        who_for: 'Skilled workers without job offer — points-based',
        threshold: '6 points minimum. Your profile scores ~10: MTech (4) + 2YOE (2) + IT shortage (1) + age<35 (2) + English C1 (1)',
        processing: '4-12 weeks at consulate',
        cost: '€75',
        pros: ['Enter without job offer', '12 months to find work', 'Can do trial employments + part-time'],
        cons: ['Cannot work full-time during search', 'Need ~€13,092 in blocked account as financial proof'],
        family: 'Limited family rights during card period',
        pr_path: 'Convert to Blue Card upon employment',
        best_for: 'If you can\'t land a job from India, fly in and search locally.'
      },
      {
        name: 'Job Seeker Visa',
        code: 'JSV',
        who_for: 'Predecessor to Chancenkarte, still available',
        threshold: 'No salary, but need degree + savings (~€1,200/mo)',
        processing: '4-8 weeks',
        cost: '€75',
        pros: ['Older established route', '6 months to find work'],
        cons: ['Chancenkarte usually better — more flexibility, longer period'],
        family: 'Self only',
        pr_path: 'Same as Blue Card after conversion',
        best_for: 'Chancenkarte is strictly better. Skip this.'
      },
      {
        name: 'PhD Researcher (TV-L E13)',
        code: 'PhD',
        who_for: 'PhD candidates at German universities/Max Planck/Fraunhofer',
        threshold: 'TV-L E13 employment contract: €4,000-4,800/mo gross',
        processing: '4-8 weeks',
        cost: 'Paid by university',
        pros: ['Best PhD pay in Europe alongside Switzerland', 'Time counts toward Blue Card residency', 'No tuition (free)', 'Strong industry pipeline post-PhD'],
        cons: ['3-5 yr commitment', 'PhD admission competitive at top schools'],
        family: 'Full family rights',
        pr_path: 'PhD years count fully toward 21-27 mo Blue Card PR',
        best_for: '⭐ STRONGEST PhD route in EU for your profile.'
      },
      {
        name: 'Intra-Company Transfer (ICT)',
        code: 'ICT',
        who_for: 'Employees of multinationals transferring to German branch',
        threshold: 'Job-appropriate salary',
        processing: '4-12 weeks',
        cost: 'Employer pays',
        pros: ['SAP Labs India → SAP Walldorf is well-trodden', 'Bosch BGSW → Stuttgart, MBRDI → Stuttgart, Siemens India → Munich'],
        cons: ['Need 18-24 months tenure at India arm first', 'Visa tied to that employer'],
        family: 'Full family rights',
        pr_path: '21-27 months Blue Card path',
        best_for: '🎯 Highest-EV path: SAP Labs India job → Walldorf transfer.'
      }
    ],

    market2026: {
      hiring_trend: 'STRONG for backend Java/Kotlin. Berlin startups recovered post-2023 layoffs. Munich enterprise (SAP/BMW/Siemens) hiring steadily. PhD positions at Max Planck/TUM open continuously.',
      hot_skills: ['Java 17/21 + Spring Boot 3', 'Kotlin (Berlin tech)', 'Kafka + event sourcing', 'AWS (Berlin) + Azure (Munich Mittelstand)', 'Domain-driven design', 'Cloud-native architecture', 'Embedded systems (BMW/Mercedes)'],
      cold_skills: ['Pure jQuery/legacy JS', 'Cobol (rare exceptions in banking)', 'Windows-only stacks (mostly)'],
      faang_presence: 'Google Munich/Berlin, Amazon Berlin/Munich/Aachen, Meta Berlin, Microsoft Munich, Apple Munich, IBM Munich. Apple Munich silicon team huge.',
      indian_engineers: '~80,000+ Indian tech engineers, largest concentrations at SAP (Walldorf), BMW (Munich), Bosch (Stuttgart), Mercedes (Stuttgart), Siemens, Allianz Tech (Munich)',
      visa_friendly_companies: 'Most large German companies actively sponsor. List on Make-it-in-Germany.com.',
      layoff_status: '2024 layoffs (SAP restructure, mobility OEMs cuts) absorbed. SAP hiring tech-Org again 2026.',
      salary_trend: 'Mid-Java +5-7% YoY. Berlin €68-75k common; Munich €72-85k common for 2-3 YOE.',
      remote_policy: 'Hybrid (2-3 days office) at most. Fully remote at startups. Mercedes/BMW require office presence.'
    },

    costOfLiving: {
      berlin: { rent_1br_center: '€1,200-1,800', rent_1br_outside: '€900-1,400', groceries: '€280-400/mo', utilities: '€180-250', transport: '€49 Deutschland Ticket (national!)', monthly_total_single: '€2,200-2,800' },
      munich: { rent_1br_center: '€1,800-2,500', rent_1br_outside: '€1,400-1,900', groceries: '€300-450/mo', utilities: '€200-280', transport: '€49 Deutschland Ticket', monthly_total_single: '€2,800-3,500' },
      verdict: 'Berlin much cheaper than Munich (~30%). On €68k Berlin = save €1,500/mo; €75k Munich = save €1,200/mo.'
    },

    taxSalary: {
      brackets_2026: 'Progressive up to 45% top. Plus solidarity surcharge (5.5% of tax), church tax (8% if registered).',
      special_regime: 'No expat-specific tax break. Standard progressive system.',
      effective_rate_65k: 'Steuerklasse I (single, no church): ~38% effective. Net ~€40k = €3,350/mo.',
      contributions: 'Pension 9.3%, health 7.3%, unemployment 1.3%, long-term care 1.7% (employee share)',
      tax_filing: 'May 31 deadline next year. ELSTER portal. Most foreign tax-payers file via partner (~€100-200).',
      pension: 'Statutory pension after 5 yrs vesting. Can withdraw with interest if you leave Germany (after 2-yr waiting period).'
    },

    companies: {
      tier1_immediate: [
        { name: 'Zalando', city: 'Berlin', stack: 'Java/Kotlin, Spring Boot, AWS, Scala (legacy)', interview: '5 rounds: HR → online assessment 1.5h (2-3 LC easy-medium) → coding 1h → system design 1h → general tech (SDLC/patterns/past projects). Bar: LC medium-heavy, ~75 LC mediums.', salary: '€68-82k for 2 YOE', why: 'E-commerce scale; English-only; sponsors actively; smooth process from India', apply_at: 'jobs.zalando.com' },
        { name: 'Personio', city: 'Munich', stack: 'TypeScript, Java, Kotlin', interview: '4-5 rounds incl. take-home OR live coding + system design + culture fit', salary: '€68-78k Munich', why: 'HR tech unicorn; growing engineering team; sponsors Blue Card', apply_at: 'personio.com/careers' },
        { name: 'N26', city: 'Berlin', stack: 'Kotlin/Java, AWS, microservices', interview: 'Tech screen → live coding → system design → behavioral. Bar: medium.', salary: '€65-78k Berlin', why: 'Mobile banking; English-first; flat hierarchy', apply_at: 'n26.com/careers' },
        { name: 'Celonis', city: 'Munich', stack: 'Java, Python, React', interview: '5 rounds incl. coding + system design + team panel + director final', salary: '€75-90k Munich', why: 'Process mining unicorn; English-only most roles; well-paid', apply_at: 'celonis.com/careers' },
        { name: 'Delivery Hero', city: 'Berlin', stack: 'Kotlin, Java, Go, K8s', interview: '4-5 rounds incl. tech + system design + behavioral', salary: '€65-80k Berlin', why: 'Food delivery scale; direct India hires', apply_at: 'careers.deliveryhero.com' },
        { name: 'Trivago', city: 'Düsseldorf', stack: 'Java, Scala, PHP', interview: '4 rounds incl. coding + system design + values', salary: '€60-75k Düsseldorf', why: 'Hotel meta-search; English; sponsors', apply_at: 'company.trivago.com/jobs' }
      ],
      tier2_after_prep: [
        { name: 'SAP (Direct)', city: 'Walldorf / Berlin / Munich', stack: 'Java, ABAP, HANA, BTP', interview: 'HackerRank → coding → system design (multi-tenancy, GDPR, HA) → behavioral. LC ~30-50 mediums. Enterprise flavor.', salary: '€68-90k', why: 'Largest German tech employer; world-class engineering; PR fast-track', prep_tips: 'Read SAP engineering blog; understand multi-tenancy + cloud-native architecture.', apply_at: 'jobs.sap.com' },
        { name: 'IONOS', city: 'Karlsruhe/Berlin', stack: 'Java, Spring, K8s, OpenStack', interview: '4 rounds incl. tech + system design + behavioral', salary: '€65-80k', why: 'Cloud infra; growing rapidly; English-first now', apply_at: 'ionos.com/careers' }
      ],
      tier3_transfer: [
        { name: 'SAP Labs India → SAP Walldorf', path: 'Join SAP Labs Bangalore/Gurgaon as Java Developer → 18-24 months performance → apply internal mobility via Global Mobility program → Blue Card sponsored by SAP (Fragomen handles paperwork)', note: '⭐ HIGHEST-EV TRANSFER PATH. Java/Spring/JPA experience is exact match.' },
        { name: 'Bosch (BGSW) → Stuttgart', path: 'Join BGSW Bangalore/Coimbatore → 2-3 yrs → transfer to Stuttgart R&D', note: 'Java for AUTOSAR connected car; German preferred for managers' },
        { name: 'MBRDI (Mercedes-Benz R&D India) → Stuttgart', path: 'Join Bangalore → 2-3 yrs → transfer', note: 'Java + embedded; OEM tech; German useful' },
        { name: 'Siemens India → Munich/Erlangen', path: 'Join Bangalore/Pune Siemens → 2 yrs → transfer via internal mobility', note: 'Java + Industrial IoT; German preferred mid-level' },
        { name: 'Allianz Tech India → Munich', path: 'Trivandrum/Pune → Munich transfer is dominant path', note: 'Java + cloud; English OK for tech roles' }
      ]
    },

    prepRoadmap: [
      { month: 1, focus: 'Same as NL Month 1 + start German A1 on Duolingo (free)', tasks: ['SB3 migration project', 'AWS SAA prep', 'LC fundamentals', 'German A1: 15 min/day Duolingo + 1 Italki session/wk'], why_de_specific: 'B1 German cuts PR time from 27 to 21 months. A1 enough for Blue Card.' },
      { month: 2, focus: 'Java depth + system design + LC', tasks: ['LC 40 mediums', 'Spring internals deep dive', 'Java concurrency', 'German A1 → A2 push'], why_de_specific: 'SAP/BMW/Allianz Tech interviews test enterprise Java patterns (DDD, transactional boundaries).' },
      { month: 3, focus: 'Cloud + Apply to Indian arms', tasks: ['AWS SAA exam', 'Alex Xu Vol 1', 'Apply to SAP Labs India + Bosch BGSW + Allianz Tech (for transfer route)', 'Direct apply to Zalando, N26'], why_de_specific: 'Indian arm route is parallel insurance policy. SAP Labs hiring cycles year-round.' },
      { month: 4, focus: 'K8s + company-tagged LC + interviews', tasks: ['Docker + K8s', 'Mock interviews 2/wk', 'Continue applications', 'Practice STAR stories'], why_de_specific: 'German interviews value structured STAR. Be precise and metric-backed.' },
      { month: 5, focus: 'Interview sprint + Chancenkarte backup', tasks: ['Interview loops with Zalando/SAP/Celonis', 'Apply Chancenkarte as backup (you score 10/6)', 'Negotiate offers'], why_de_specific: 'Chancenkarte fallback: even without offer, you can fly in and search locally.' },
      { month: 6, focus: 'Close offer + visa + relocation', tasks: ['Accept best offer', 'Employer files Blue Card', 'Find housing in target city', 'Visa appointment at German consulate Mumbai/Delhi/Chennai/Bangalore'], why_de_specific: 'Spring/summer visa appointments get backed up. Book consulate appointment EARLY.' }
    ],

    interviewGuide: [
      { company: 'SAP', format: 'HackerRank → coding 60m live → system design 60m → behavioral', topics: ['Java basics + Spring (their stack)', 'Enterprise patterns', 'Multi-tenancy', 'Cloud-native design', 'GDPR awareness'], sample_questions: ['Design a multi-tenant SaaS', 'How to handle eventual consistency in payments?', 'Tell me about a time you handled stakeholder conflict', 'JVM tuning approach'], culture: 'Structured, enterprise, customer-focused', gotchas: 'Don\'t need German for tech interviews. Be precise and structured in answers.' },
      { company: 'Zalando', format: '5 rounds: HR → OA → coding → system design → general tech', topics: ['LC medium', 'Microservices design', 'Amazon LP-style behavioral', 'Past project deep dive'], sample_questions: ['Design product recommendation service', 'LRU cache variant', 'Tell me about a time you took ownership'], culture: 'Amazon-style LPs: ownership, bias for action, deliver results', gotchas: 'STAR rigorously expected. Be ready to deep-dive past Toqqer work.' },
      { company: 'Celonis', format: '5 rounds incl. tech + system design + team panel', topics: ['Java/Python coding (their choice)', 'Process mining concepts (no need to be expert but understand basics)', 'Backend system design'], sample_questions: ['Design a log aggregation pipeline', 'Coding: graph algorithms variant'], culture: 'Innovation, customer impact', gotchas: 'They do longer process (1-2 months). Patience matters.' }
    ],

    communities: [
      { name: 'GIRT (German-Indian Round Table)', type: 'Professional', what: 'Business networking; useful for senior roles' },
      { name: 'Indian Tech Berlin', type: 'Meetup', what: 'Berlin meetup group, monthly events, 5k+ members' },
      { name: 'r/germany / r/IWantOut', type: 'Reddit', what: 'Visa Q&A, housing, expat life' },
      { name: 'Munich Java User Group', type: 'Tech meetup', what: 'Java engineers from BMW/Siemens/Allianz' },
      { name: 'Make-it-in-Germany Forum', type: 'Government', what: 'Official EU Blue Card guidance + community' },
      { name: 'Toytown Germany', type: 'Expat forum', what: 'Active expat forum for German life questions' },
      { name: 'LinkedIn group: Indians in Germany Tech', type: 'Network', what: '30k+ members, regular job postings' }
    ],

    livingInfo: {
      cities: [
        { name: 'Berlin', vibe: 'Startup, bohemian, English-friendly, cheap big-city', expat_density: 'Very high', rent_1br: '€1,200-1,800', best_for: 'Zalando, N26, Delivery Hero, Trivago, Personio (smaller office)' },
        { name: 'Munich', vibe: 'Wealthy, conservative, traditional Bavarian, expensive', expat_density: 'High in tech', rent_1br: '€1,800-2,500', best_for: 'BMW, Siemens, Allianz, SAP Munich, Personio HQ, Celonis HQ' },
        { name: 'Frankfurt', vibe: 'Banking-heavy, international, smaller', expat_density: 'High in finance', rent_1br: '€1,400-2,000', best_for: 'Deutsche Bank, ING (small), banking Java' },
        { name: 'Stuttgart', vibe: 'Industrial, automotive, leafy', expat_density: 'High in mobility', rent_1br: '€1,300-1,800', best_for: 'Mercedes-Benz, Bosch, Daimler Trucks' },
        { name: 'Hamburg', vibe: 'Maritime, media, cool', expat_density: 'Moderate', rent_1br: '€1,200-1,700', best_for: 'Otto Group, Airbus, Beiersdorf' }
      ],
      transport: '€49 Deutschland Ticket gives unlimited regional + bus + tram (entire country). DB Bahncard for fast trains.',
      healthcare: 'Statutory (TK/AOK/Barmer) or private. Excellent quality. Card via Krankenkasse within 1 week of registering.',
      banking: 'N26/Wise for app accounts. Sparkasse/Deutsche Bank for traditional. SEPA dominates.',
      registration: 'Anmeldung within 14 days of moving in to a city. Required for everything: tax ID, bank account, contract phone.',
      housing_tip: 'Use ImmobilienScout24, Immowelt, WG-Gesucht (shared). German rental market is tight in Berlin/Munich. Ready: 3 payslips, SCHUFA credit check, contract.'
    },

    actionPlan90Day: [
      { week: '1', action: 'AWS SAA prep + Java 21 project setup + start Duolingo German + register with consulate' },
      { week: '2-4', action: 'SAP Labs India apply + Bosch BGSW apply + Allianz Tech apply (transfer pipeline)' },
      { week: '5-6', action: 'AWS SAA halfway + LC mediums + Direct apply Zalando + N26 + Personio' },
      { week: '7-8', action: 'AWS SAA exam + System design Alex Xu + Mock interviews 1/wk' },
      { week: '9-10', action: 'CV/LinkedIn polish + Chancenkarte points check + Direct apply Celonis + Trivago' },
      { week: '11-12', action: 'Interview loops + Negotiate first offer + Apply Chancenkarte as parallel option' }
    ]
  },

  // ============================== SWEDEN (focused) ==============================
  SE: {
    code: 'SE', name: 'Sweden', flag: '🇸🇪',
    capital: 'Stockholm',
    tagline: 'Strongest firing protection in EU. Low salary visa bar. KTH → Spotify pipeline. Best work-life balance.',
    overview: { why: 'Sweden LAS gives the strongest job security in EU. Work permit salary is low (~€2,500/mo). KTH PhD → Spotify/Klarna is a proven pipeline. Tech companies are English-first.', key_facts: ['Population: 10.5M', 'Tech hubs: Stockholm, Gothenburg, Malmö', 'Indian engineers: ~15,000+, large at Ericsson/Volvo/Spotify', 'Flights HYD/BLR → ARN via DOH/IST', 'Strong unions (~88% coverage)'] },
    visaTypes: [
      { name: 'Work Permit', code: 'WP', who_for: 'Job offer from Swedish employer', threshold: 'SEK 28,480/mo (~€2,500) — proposed raise to ~€3,000 pending', processing: '30 days for certified employers; 2-6 months otherwise', cost: 'SEK 2,200', pros: ['Lowest salary bar in EU', 'Family included', 'PR after 4 years'], cons: ['Bound to employer first year (then changeable within sector)'], family: 'Spouse + kids; spouse can work', pr_path: '4 years to PR; citizenship 5 years (proposed 8 — pending)', best_for: '⭐ Standard route.' },
      { name: 'PhD Researcher', code: 'PhD', who_for: 'Doctoral candidates — paid as EMPLOYEES', threshold: 'No threshold; doctoral salary ~SEK 35,000/mo', processing: '4-8 weeks', cost: 'University covers', pros: ['Employee status + benefits', '4-yr funded', 'PR counts'], cons: ['Locked to PhD program'], family: 'Full family rights', pr_path: '4 yrs (PhD counts)', best_for: 'KTH/Chalmers/Lund are world-class.' },
      { name: 'EU Blue Card', code: 'EU-BC', who_for: 'Degree + higher salary threshold', threshold: '~SEK 60,000/mo', processing: '90 days', cost: 'SEK 2,200', pros: ['EU mobility'], cons: ['Higher bar than regular WP'], family: 'Full', pr_path: '4 yrs', best_for: 'Use if salary > €5,500/mo and want EU mobility.' }
    ],
    market2026: { hiring_trend: 'Stable. Spotify/Klarna hiring resumed 2025 after 2023 cuts. Volvo Cars EV expansion. Ericsson 5G/6G R&D.', hot_skills: ['Java/Kotlin', 'Python (Spotify backend)', 'Scala (Klarna legacy)', 'Kafka + streaming', 'GCP (Spotify) + AWS (Klarna)', 'ML for music/recsys (Spotify)'], cold_skills: ['Pure frontend without React/Vue depth'], faang_presence: 'Spotify is local FAANG-equivalent. Google has small Stockholm office.', indian_engineers: '~15k; large at Ericsson (Indian-founded engineering culture), Truecaller (Indian-founded), Volvo Cars', visa_friendly_companies: 'Most large tech sponsor. Truecaller especially Indian-friendly.', layoff_status: '2023-24 cuts (Klarna, Spotify, Ericsson) reversed by 2025-26. Now expansion mode.', salary_trend: 'Mid-Java +3% YoY. SEK 600-800k common for 2-3 YOE.', remote_policy: 'Hybrid 2-3 days office. Spotify previously remote-friendly now hybrid.' },
    costOfLiving: { city: 'Stockholm', rent_1br_center: 'SEK 14,000-18,000 (~€1,200-1,600)', rent_1br_outside: 'SEK 10,000-13,000 (~€870-1,130)', groceries: 'SEK 3,500-4,500/mo (~€300-390)', transport: 'SK 1,030/mo SL card (~€90)', monthly_total_single: 'SEK 22,000-28,000 (~€1,900-2,400) frugal; €2,800-3,300 comfortable', verdict: 'High effective tax (~50%) but excellent public services.' },
    taxSalary: { brackets_2026: 'Municipal ~30% + state +20% above ~SEK 600k', special_regime: 'Expert tax (skattereduktion för experter): 25% reduction on first 25% of salary for first 7 years (must apply within 3 months of arrival)', effective_rate_65k: '~50% without expert tax; ~42% with it', contributions: 'Payroll taxes ~31.42% paid by employer; ATP pension', tax_filing: 'Pre-filled by Skatteverket; submit by May', pension: 'Income pension + premium pension + occupational. ~Strong system.' },
    companies: {
      tier1_immediate: [
        { name: 'Truecaller', city: 'Stockholm', stack: 'Java/Scala, Kafka, MongoDB', interview: 'HR → coding → system design → behavioral. Bar: medium.', salary: 'SEK 600-750k for 2 YOE', why: 'Indian-founded; sponsors freely; large Indian engineering team', apply_at: 'truecaller.com/careers' },
        { name: 'Ericsson', city: 'Stockholm/Kista', stack: 'Java/microservices, 5G/6G', interview: '5 rounds incl. tech + system + values', salary: 'SEK 580-700k', why: 'Largest sponsor of Indians in SE; deep 5G/6G work', apply_at: 'ericsson.com/careers' },
        { name: 'Volvo Cars', city: 'Gothenburg', stack: 'Java/Spring Boot, connected services, autonomous', interview: '4 rounds', salary: 'SEK 600-780k', why: 'EV expansion + autonomous driving; strong tech', apply_at: 'careers.volvocars.com' },
        { name: 'IKEA Digital', city: 'Malmö', stack: 'Java microservices', interview: '4-5 rounds', salary: 'SEK 600-750k', why: 'Retail tech; sponsors regularly', apply_at: 'about.ikea.com' }
      ],
      tier2_after_prep: [
        { name: 'Spotify', city: 'Stockholm', stack: 'Java/Kotlin/Python, GCP, Kafka', interview: '5 rounds: recruiter → tech screen → onsite (coding + system design + craft (code review your own past code) + behavioral + chapter fit). LC medium. Squads model questions.', salary: 'SEK 750-900k base + equity', why: 'World-class engineering culture; squad model; remote-friendly history', prep_tips: 'Study Spotify model (tribes/squads/chapters/guilds). Practice code review on your GitHub. LC medium volume.', apply_at: 'lifeatspotify.com' },
        { name: 'Klarna', city: 'Stockholm', stack: 'Java/Kotlin payments, AWS', interview: '5 rounds: recruiter → HackerRank/CodeSignal → tech live → system design (payments flavored) → behavioral', salary: 'SEK 700-850k', why: 'BNPL pioneer; payments scale; hiring tightened but resuming', prep_tips: 'Payment idempotency, retries, distributed transactions. Read Klarna engineering blog.', apply_at: 'careers.klarna.com' }
      ],
      tier3_transfer: [
        { name: 'Ericsson India → Stockholm', path: 'Join Ericsson Bangalore/Chennai → 2 yrs → internal mobility to Sweden', note: '5G/6G R&D pipeline; visa fully sponsored' },
        { name: 'Volvo Cars India → Gothenburg', path: 'Join Volvo Cars Tech Bangalore → transfer to Gothenburg', note: 'Growing autonomous driving teams' }
      ]
    },
    prepRoadmap: [
      { month: 1, focus: 'Java 21 + SB3 + AWS prep', tasks: ['Same Foundation as NL', 'Start Swedish A1 (Duolingo)'], why_se_specific: 'Swedish helpful but not required for Stockholm tech.' },
      { month: 2, focus: 'Streaming + Kafka focus', tasks: ['Build Kafka producer/consumer', 'Java concurrency deep', 'LC mediums'], why_se_specific: 'Spotify and Klarna both heavily test streaming and event-driven.' },
      { month: 3, focus: 'AWS exam + Apply Tier 1', tasks: ['AWS SAA exam', 'Apply Truecaller, Ericsson, Volvo, IKEA', 'System design Alex Xu'], why_se_specific: 'Truecaller has fast hiring loop (4 weeks).' },
      { month: 4, focus: 'K8s + Mock + Apply Spotify/Klarna', tasks: ['K8s basics', 'Mock interviews 2/wk', 'Apply Spotify + Klarna'], why_se_specific: 'Spotify code-review round needs preparation — practice reviewing your old code aloud.' },
      { month: 5, focus: 'Interview sprint', tasks: ['Interview loops', 'Negotiate offers'], why_se_specific: 'SEK 600k floor; negotiate hard for SEK 700k+ in Stockholm.' },
      { month: 6, focus: 'Close + relocate', tasks: ['Accept offer', 'Apply expert tax within 3 months', 'Find housing (BostadsPortal)'], why_se_specific: 'EXPERT TAX must be applied within 3 months of arrival or you lose 25% reduction for 7 yrs.' }
    ],
    interviewGuide: [
      { company: 'Spotify', format: '5 rounds incl. craft (code review)', topics: ['LC medium', 'System design (recsys/streaming)', 'Spotify model knowledge', 'Squad/Chapter fit'], sample_questions: ['Design a music recommendation service', 'Review this Java class — what would you improve?', 'How do you handle disagreement in a squad?'], culture: 'Autonomy, collaboration, learning mindset', gotchas: 'CRAFT round needs prep. Bring 2-3 of your own code samples to discuss.' },
      { company: 'Klarna', format: '5 rounds payments-focused', topics: ['Payment idempotency', 'Distributed systems', 'Java/Kotlin', 'LC medium-heavy'], sample_questions: ['Design checkout flow with retries', 'Handle duplicate payment requests', 'Sliding window LC'], culture: 'Dare to be different, merchant obsession', gotchas: 'Behavioral probes for resilience after their layoff cycle.' }
    ],
    communities: [
      { name: 'India Unlimited Sweden', type: 'Diaspora', what: 'Annual cultural events; networking' },
      { name: 'Stockholm Indian Community', type: 'Meetup', what: 'Monthly meetups + social' },
      { name: 'Stockholm Java User Group', type: 'Tech', what: 'Spotify/Klarna engineers attend' },
      { name: 'r/sweden', type: 'Reddit', what: 'Expat life Q&A' }
    ],
    livingInfo: {
      cities: [
        { name: 'Stockholm', vibe: 'Capital, English-friendly, expensive', expat_density: 'High in tech', rent_1br: 'SEK 14k-18k', best_for: 'Spotify, Klarna, Truecaller, King, Ericsson' },
        { name: 'Gothenburg', vibe: 'West coast, industrial, automotive', expat_density: 'High in mobility', rent_1br: 'SEK 10k-13k', best_for: 'Volvo Cars, Polestar, Volvo Group' },
        { name: 'Malmö', vibe: 'Bridge to Copenhagen, multicultural', expat_density: 'High', rent_1br: 'SEK 9k-12k', best_for: 'IKEA Digital, smaller startups' }
      ],
      transport: 'SL Access pass (Stockholm) ~€90/mo. Trains via SJ. Cycling popular.',
      healthcare: 'Universal; small co-pays per visit',
      banking: 'SEB, Swedbank, Nordea — but need personnummer (~6 weeks to get)',
      housing_tip: 'Stockholm rental market is BRUTAL. First-hand contracts have years-long queue (BostadsFörmedlingen). Most expats start with second-hand or company housing.'
    },
    actionPlan90Day: [
      { week: '1-2', action: 'AWS SAA prep + Java 21 project + apply Truecaller (fast loop)' },
      { week: '3-4', action: 'Apply Ericsson + Volvo + IKEA' },
      { week: '5-6', action: 'AWS SAA exam + LC company-tagged + Mock' },
      { week: '7-8', action: 'Apply Spotify + Klarna; prep CRAFT round for Spotify' },
      { week: '9-12', action: 'Interview loops + negotiate + accept' }
    ]
  },

  // ============================== IRELAND (focused) ==============================
  IE: {
    code: 'IE', name: 'Ireland', flag: '🇮🇪',
    capital: 'Dublin',
    tagline: 'Easiest entry — lowest salary threshold (€38k). English-only. FAANG EU HQs. But: at-will first 12 months.',
    overview: { why: 'CSEP threshold (€38k) is the lowest in EU. English-only. Google, Meta, Stripe, Workday EU HQs are all in Dublin. PR after just 2 years (Stamp 4). Citizenship after 5.', key_facts: ['Population: 5.1M', 'Dublin is the tech hub; some Cork/Galway', 'Indian engineers: ~25,000+', 'Direct flights BLR/DEL → DUB', 'Effectively at-will first 12 months — unique among EU'] },
    visaTypes: [
      { name: 'Critical Skills Employment Permit (CSEP)', code: 'CSEP', who_for: 'Job offer in shortage occupation (software dev is on the list)', threshold: '€38,000/yr', processing: '4-8 weeks (trusted partner); 8-13 weeks standard', cost: '€1,000 employer pays', pros: ['Lowest EU threshold', 'No labor market test', 'Stamp 4 (PR) after 2 yrs', 'Family included immediately'], cons: ['Bound to employer 12 months', 'After 12 months can change employer'], family: 'Spouse + kids; spouse can work after 6 months', pr_path: 'Stamp 4 after 2 years CSEP', citizenship_path: '5 years residence', best_for: '⭐ Easiest EU entry.' },
      { name: 'General Employment Permit', code: 'GEP', who_for: 'Job offer below CSEP shortage list', threshold: '€34,000/yr', processing: 'Slower than CSEP', cost: '€1,000', pros: ['Lower threshold'], cons: ['Labor market test', 'Slower to PR'], family: 'Spouse + kids', pr_path: '5 years', best_for: 'Backup if CSEP unavailable.' },
      { name: 'PhD Research Visa', code: 'PhD', who_for: 'PhD candidates at Irish universities', threshold: 'Stipend (~€18,500-22,000/yr tax-free)', processing: '4-8 weeks', cost: 'University covers', pros: ['Tax-free stipend', '4-yr funded'], cons: ['Lower pay than NL/DE PhDs', 'SFI Centre positions best'], family: 'Possible with proof of funds', pr_path: 'PhD time counts toward Stamp 4', best_for: 'TCD/UCD research-focused.' }
    ],
    market2026: { hiring_trend: 'STRONG. Google + Meta resumed hiring 2025 after 2023-24 cuts. Stripe always hiring. Workday + Salesforce stable.', hot_skills: ['Java/Spring (Fidelity, Mastercard, Workday)', 'Ruby (Stripe)', 'Go (newer Stripe services)', 'AWS', 'Kotlin emerging'], cold_skills: ['Pure jQuery legacy'], faang_presence: 'MASSIVE: Google EMEA HQ, Meta Dublin, AWS, Microsoft, LinkedIn, Apple, Intel, Salesforce, Stripe, Workday, HubSpot, Indeed', indian_engineers: '~25,000+; large at Google/Meta/Workday/Fidelity', visa_friendly_companies: 'Almost all FAANG sponsor CSEP', layoff_status: 'Google/Meta cuts in 2023-24 mostly absorbed. Hiring restored 2025-26.', salary_trend: 'Mid-level Java €60-75k; Senior at FAANG €100k+', remote_policy: 'Hybrid 2-3 days office at most. Some startups fully remote.' },
    costOfLiving: { city: 'Dublin', rent_1br_center: '€2,000-2,800', rent_1br_outside: '€1,500-2,000', groceries: '€350-500', utilities: '€180-260', transport: 'Leap Card €115/mo', monthly_total_single: '€3,000-3,800 frugal; €4,000+ comfortable', verdict: 'Dublin housing crisis is BRUTAL. Worst rental market in this list. Plan extra carefully.' },
    taxSalary: { brackets_2026: 'PAYE: 20% standard up to €42k, 40% above. PRSI 4% + USC 0.5-8% based on income.', special_regime: 'SARP (Special Assignee Relief Programme): 30% relief on income above €100k (conditions: must earn €100k+, employer must have certified scheme)', effective_rate_65k: 'Roughly 34-36% combined PAYE+PRSI+USC', contributions: 'Pension via PRSA or employer scheme', tax_filing: 'PAYE auto. Top up via Revenue.ie if needed.', pension: 'State pension + occupational' },
    companies: {
      tier1_immediate: [
        { name: 'Workday', city: 'Dublin', stack: 'Java-heavy', interview: '4-5 rounds incl. tech + system + behavioral', salary: '€65-80k for 2 YOE', why: 'EMEA HQ; sponsors CSEP heavily; large Indian engineering team', apply_at: 'workday.com/careers' },
        { name: 'Fidelity Investments', city: 'Dublin', stack: 'Java/Spring Boot', interview: '4 rounds: HR → tech → system → behavioral', salary: '€60-75k', why: 'Banking Java; very Indian-friendly; stable', apply_at: 'jobs.fidelity.com' },
        { name: 'Mastercard', city: 'Dublin', stack: 'Java/Spring', interview: '4-5 rounds incl. tech + behavioral', salary: '€62-78k', why: 'Payments Java; CSEP sponsor', apply_at: 'careers.mastercard.com' },
        { name: 'HubSpot', city: 'Dublin', stack: 'Java + microservices', interview: '4 rounds', salary: '€65-80k', why: 'Sponsors CSEP; growing engineering', apply_at: 'hubspot.com/careers' }
      ],
      tier2_after_prep: [
        { name: 'Stripe', city: 'Dublin', stack: 'Java/Ruby/Go', interview: '4-round virtual onsite: BUG SQUASH (debug broken codebase) → INTEGRATION (build against API spec, ~2h) → system design → behavioral. FAANG bar.', salary: '€90-130k', why: 'Top compensation; brilliant engineers; payments + APIs', prep_tips: 'Bug squash is unique. Practice debugging in Ruby/Java/Go codebases. Read Stripe API docs. Integration question is building a webhook receiver with retries/idempotency.', apply_at: 'stripe.com/jobs' },
        { name: 'Google Dublin', city: 'Dublin', stack: 'Java/Python/Go', interview: 'Phone screen + 4-5 onsite rounds (coding, system design, behavioral)', salary: '€90-140k + RSU', why: 'EMEA HQ; sponsors CSEP', prep_tips: 'LC hard. System design at staff bar even for L4. Googliness behavioral.', apply_at: 'careers.google.com' },
        { name: 'Meta Dublin', city: 'Dublin', stack: 'Java/Python/Hack', interview: 'Phone + 4-5 onsite', salary: '€90-130k + RSU', why: 'Hiring resumed; large org', prep_tips: 'LC medium-hard. Behavioral: Move Fast, Be Bold.', apply_at: 'metacareers.com' },
        { name: 'Salesforce', city: 'Dublin', stack: 'Java/Apex', interview: '4 rounds', salary: '€70-90k', why: 'Stable Java enterprise', apply_at: 'salesforce.com/careers' }
      ]
    },
    prepRoadmap: [
      { month: 1, focus: 'Foundation', tasks: ['SB3 migration', 'AWS SAA prep', 'LC fundamentals'], why_ie_specific: 'CSEP threshold low — even Fidelity/Mastercard mid-level offers clear it easily.' },
      { month: 2, focus: 'Java + LC', tasks: ['40 LC mediums', 'Spring deep', 'Java concurrency'], why_ie_specific: 'Workday/Fidelity test Java enterprise patterns.' },
      { month: 3, focus: 'AWS + Apply Tier 1', tasks: ['AWS exam', 'Apply Workday, Fidelity, Mastercard, HubSpot', 'System design Alex Xu'], why_ie_specific: 'Workday has rolling intake; Fidelity has quarterly cohorts.' },
      { month: 4, focus: 'FAANG prep + Apply Tier 2', tasks: ['LC hard', 'Stripe bug squash prep', 'Apply Stripe, Google, Meta'], why_ie_specific: 'Stripe interview is unique — bug squash + integration; not LC-based.' },
      { month: 5, focus: 'Interview sprint', tasks: ['Interview loops', 'Negotiate'], why_ie_specific: 'CSEP processed in 4-8 weeks at trusted partner — apply for visa as soon as offer signed.' },
      { month: 6, focus: 'Close + relocate', tasks: ['Accept', 'Find housing (REMEMBER: brutal market)', 'Open Revolut/AIB account'], why_ie_specific: 'Housing crisis means: start hunting 2 months before move. Employer temp housing for 4-6 wks essential.' }
    ],
    interviewGuide: [
      { company: 'Stripe', format: 'Bug squash + integration + system + behavioral (4 rounds)', topics: ['Real codebase debugging', 'Build against API spec', 'System design', 'Writing-culture probes'], sample_questions: ['Debug this Ruby/Java/Go codebase (broken at multiple points)', 'Build a webhook receiver with idempotency keys and retries', 'Design a rate limiter', 'When have you written a long technical doc?'], culture: 'Rigor, written communication, user empathy', gotchas: 'Bug squash is unique. Practice on GitHub real repos. Writing is central to Stripe culture.' },
      { company: 'Workday', format: '4-5 rounds: HR → tech → system → behavioral', topics: ['Java deep', 'Enterprise patterns', 'SaaS architecture'], sample_questions: ['Design a multi-tenant HR system', 'Java concurrency basics', 'STAR'], culture: 'Customer-first, integrity', gotchas: 'Standard enterprise interview. Be precise.' }
    ],
    communities: [
      { name: 'Indians in Ireland Tech', type: 'LinkedIn', what: '15k+ members; job postings, mentorship' },
      { name: 'Dublin Java User Group', type: 'Tech', what: 'Fidelity/Workday/Mastercard engineers' },
      { name: 'r/ireland / r/dublin', type: 'Reddit', what: 'Housing, visa, expat Q&A' },
      { name: 'Indian Embassy Dublin', type: 'Official', what: 'Cultural events, document help' }
    ],
    livingInfo: {
      cities: [{ name: 'Dublin', vibe: 'Compact, English-speaking, expensive', expat_density: 'Very high in tech', rent_1br: '€2,000-2,800', best_for: 'All FAANG, Workday, Fidelity, Mastercard, Stripe' }],
      transport: 'Leap Card ~€115/mo. Dublin Bus + Luas + DART. Cycling growing.',
      healthcare: 'Mostly private health insurance via employer (VHI/Laya). Public via HSE has waits.',
      banking: 'AIB, BOI traditional. Revolut + N26 popular among expats.',
      housing_tip: 'HOUSING CRISIS REAL. Start search 8 weeks before. Use Daft.ie. Have references + 6-month deposit + payslips ready. Many use Hub Spaces / co-living for first 3 months.'
    },
    actionPlan90Day: [
      { week: '1-2', action: 'Apply Workday, Fidelity, Mastercard (rolling intake)' },
      { week: '3-4', action: 'AWS SAA prep + LC mediums + Apply HubSpot' },
      { week: '5-6', action: 'AWS SAA exam + Prep Stripe bug squash style' },
      { week: '7-8', action: 'Apply Stripe + Google + Meta' },
      { week: '9-12', action: 'Interview loops + offers + visa filing + housing hunt' }
    ]
  }
};
