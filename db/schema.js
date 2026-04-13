const pool = require('./pool');

async function initDB() {
  // Users table — Phase 1a auth
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
      company TEXT NOT NULL,
      role TEXT NOT NULL,
      platform TEXT DEFAULT '',
      portal_url TEXT DEFAULT '',
      status TEXT DEFAULT 'WISHLIST',
      salary_range TEXT DEFAULT '',
      location TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      applied_date TEXT DEFAULT '',
      interview_date TEXT DEFAULT '',
      follow_up_date TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Phase 2: match scoring columns
  await pool.query(`ALTER TABLE applications ADD COLUMN IF NOT EXISTS match_score INTEGER DEFAULT NULL`);
  await pool.query(`ALTER TABLE applications ADD COLUMN IF NOT EXISTS match_reasons TEXT DEFAULT ''`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS prep_topics (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      topic TEXT NOT NULL,
      difficulty TEXT DEFAULT 'MEDIUM',
      status TEXT DEFAULT 'TODO',
      notes TEXT DEFAULT '',
      resource_url TEXT DEFAULT ''
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_log (
      id SERIAL PRIMARY KEY,
      date TEXT DEFAULT CURRENT_DATE::TEXT,
      applications_sent INTEGER DEFAULT 0,
      problems_solved INTEGER DEFAULT 0,
      notes TEXT DEFAULT ''
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      full_name TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      linkedin_url TEXT DEFAULT '',
      github_url TEXT DEFAULT '',
      portfolio_url TEXT DEFAULT '',
      "current_role" TEXT DEFAULT '',
      experience_years TEXT DEFAULT '',
      skills TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      resume_path TEXT DEFAULT '',
      resume_data TEXT DEFAULT '',
      resume_mimetype TEXT DEFAULT ''
    )
  `);

  await pool.query(`ALTER TABLE profile ADD COLUMN IF NOT EXISTS resume_data TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE profile ADD COLUMN IF NOT EXISTS resume_mimetype TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE profile ADD COLUMN IF NOT EXISTS resume_text TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE profile ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'gemini'`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      smtp_host TEXT DEFAULT 'smtp.gmail.com',
      smtp_port INTEGER DEFAULT 587,
      smtp_user TEXT DEFAULT '',
      smtp_pass TEXT DEFAULT '',
      from_name TEXT DEFAULT ''
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cover_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT DEFAULT '',
      body TEXT DEFAULT ''
    )
  `);

  // AI cache table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_cache (
      id SERIAL PRIMARY KEY,
      cache_key TEXT UNIQUE NOT NULL,
      response TEXT NOT NULL,
      provider TEXT DEFAULT '',
      tokens_used INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Follow-ups table (Phase 3)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS follow_ups (
      id SERIAL PRIMARY KEY,
      application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
      sequence_number INTEGER DEFAULT 1,
      scheduled_date TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      subject TEXT DEFAULT '',
      body TEXT DEFAULT '',
      sent_at TIMESTAMPTZ
    )
  `);

  await pool.query(`ALTER TABLE profile ADD COLUMN IF NOT EXISTS follow_up_days TEXT DEFAULT '3,7,14'`);

  // Practice questions table (Phase 4)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS practice_questions (
      id SERIAL PRIMARY KEY,
      application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
      category TEXT NOT NULL,
      question TEXT NOT NULL,
      suggested_answer TEXT DEFAULT '',
      difficulty TEXT DEFAULT 'MEDIUM',
      status TEXT DEFAULT 'TODO',
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Phase 1a: nullable user_id columns on every per-user table.
  // Phase 1b will gate routes by user_id; for now legacy single-tenant code keeps working.
  const userScopedTables = [
    'applications', 'profile', 'prep_topics', 'daily_log',
    'email_config', 'cover_templates', 'follow_ups', 'practice_questions', 'ai_cache'
  ];
  for (const t of userScopedTables) {
    await pool.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`);
  }

  // Init single-row tables
  await pool.query(`INSERT INTO profile (id, full_name) VALUES (1, '') ON CONFLICT (id) DO NOTHING`);
  await pool.query(`INSERT INTO email_config (id, smtp_host) VALUES (1, 'smtp.gmail.com') ON CONFLICT (id) DO NOTHING`);

  // Seed prep topics if empty
  const count = await pool.query('SELECT COUNT(*) as c FROM prep_topics');
  if (parseInt(count.rows[0].c) === 0) {
    const topics = [
      ['DSA', 'Arrays & Hashing', 'EASY', 'https://leetcode.com/tag/array/'],
      ['DSA', 'Two Pointers', 'EASY', 'https://leetcode.com/tag/two-pointers/'],
      ['DSA', 'Sliding Window', 'MEDIUM', 'https://leetcode.com/tag/sliding-window/'],
      ['DSA', 'Stack', 'MEDIUM', 'https://leetcode.com/tag/stack/'],
      ['DSA', 'Binary Search', 'MEDIUM', 'https://leetcode.com/tag/binary-search/'],
      ['DSA', 'Linked List', 'MEDIUM', 'https://leetcode.com/tag/linked-list/'],
      ['DSA', 'Trees (BFS/DFS)', 'MEDIUM', 'https://leetcode.com/tag/tree/'],
      ['DSA', 'Graphs (BFS/DFS/Topo)', 'HARD', 'https://leetcode.com/tag/graph/'],
      ['DSA', 'Dynamic Programming', 'HARD', 'https://leetcode.com/tag/dynamic-programming/'],
      ['DSA', 'Backtracking', 'HARD', 'https://leetcode.com/tag/backtracking/'],
      ['DSA', 'Tries', 'HARD', 'https://leetcode.com/tag/trie/'],
      ['DSA', 'Heap / Priority Queue', 'MEDIUM', 'https://leetcode.com/tag/heap-priority-queue/'],
      ['System Design', 'URL Shortener', 'MEDIUM', ''],
      ['System Design', 'Rate Limiter', 'MEDIUM', ''],
      ['System Design', 'Chat System (WhatsApp)', 'HARD', ''],
      ['System Design', 'Video Streaming (Netflix/YouTube)', 'HARD', ''],
      ['System Design', 'Notification Service', 'MEDIUM', ''],
      ['System Design', 'Distributed Cache (Redis)', 'HARD', ''],
      ['System Design', 'Search Autocomplete', 'HARD', ''],
      ['System Design', 'Payment System', 'HARD', ''],
      ['Java/Spring', 'Spring Boot Internals', 'MEDIUM', ''],
      ['Java/Spring', 'JPA & Hibernate N+1', 'MEDIUM', ''],
      ['Java/Spring', 'Microservices Patterns', 'HARD', ''],
      ['Java/Spring', 'Java Concurrency', 'HARD', ''],
      ['Java/Spring', 'Spring Security + JWT', 'MEDIUM', ''],
      ['Java/Spring', 'REST API Best Practices', 'EASY', ''],
      ['Frontend', 'Angular Lifecycle & Change Detection', 'MEDIUM', ''],
      ['Frontend', 'RxJS Operators', 'MEDIUM', ''],
      ['Frontend', 'React Hooks & State Mgmt', 'MEDIUM', ''],
      ['Behavioral', 'Tell me about yourself', 'EASY', ''],
      ['Behavioral', 'Biggest challenge / conflict', 'EASY', ''],
      ['Behavioral', 'Why this company?', 'EASY', ''],
      ['Behavioral', 'Leadership / ownership story', 'EASY', ''],
    ];
    for (const t of topics) {
      await pool.query('INSERT INTO prep_topics (category, topic, difficulty, resource_url) VALUES ($1,$2,$3,$4)', t);
    }
  }

  // Seed default cover letter template
  const tplCount = await pool.query('SELECT COUNT(*) as c FROM cover_templates');
  if (parseInt(tplCount.rows[0].c) === 0) {
    await pool.query(
      'INSERT INTO cover_templates (name, subject, body) VALUES ($1, $2, $3)',
      [
        'Default Application',
        'Application for {role} at {company}',
        `Hi {company} Team,

I am writing to express my interest in the {role} position. With {experience_years} years of experience in {skills}, I believe I can contribute meaningfully to your team.

{summary}

I would welcome the opportunity to discuss how my background aligns with your needs.

Best regards,
{full_name}
{email} | {phone}
{linkedin_url}`
      ]
    );
  }

  console.log('Database initialized');
}

module.exports = { initDB };
