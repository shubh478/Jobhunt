const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { getAvailableProviders, getFirstAvailable, generate, generateWithFallback, cacheKey } = require('../lib/ai-provider');

// Get available AI providers
router.get('/ai/providers', async (req, res) => {
  try {
    const providers = getAvailableProviders();
    const profileResult = await pool.query('SELECT ai_provider FROM profile WHERE user_id=$1', [req.userId]);
    const active = profileResult.rows[0]?.ai_provider || 'gemini';
    res.json({ providers, active });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Switch AI provider
router.put('/ai/provider', async (req, res) => {
  try {
    const { provider } = req.body;
    const providers = getAvailableProviders();
    const p = providers.find(x => x.id === provider);
    if (!p) return res.status(400).json({ error: 'Unknown provider' });
    if (!p.available) return res.status(400).json({ error: `${p.name} API key not configured. Add ${provider === 'gemini' ? 'GEMINI_API_KEY' : provider === 'groq' ? 'GROQ_API_KEY' : provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'} to your environment variables.` });
    await pool.query('UPDATE profile SET ai_provider=$1 WHERE user_id=$2', [provider, req.userId]);
    res.json({ ok: true, provider });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Test AI connection
router.post('/ai/test', async (req, res) => {
  try {
    const profileResult = await pool.query('SELECT ai_provider FROM profile WHERE user_id=$1', [req.userId]);
    const preferred = profileResult.rows[0]?.ai_provider || 'gemini';

    const { text, provider } = await generateWithFallback(preferred, 'You are a helpful assistant.', 'Say "AI connection successful!" in exactly those words.');
    res.json({ ok: true, provider, response: text.substring(0, 100) });
  } catch (err) {
    res.status(500).json({ error: `Connection failed: ${err.message}` });
  }
});

// AI Generate cover letter
router.post('/ai/generate-cover', async (req, res) => {
  try {
    const { company, role, job_description, tone } = req.body;
    if (!company || !role) return res.status(400).json({ error: 'Company and role required' });

    const profileResult = await pool.query('SELECT * FROM profile WHERE user_id=$1', [req.userId]);
    const profile = profileResult.rows[0] || {};

    const preferred = profile.ai_provider || 'gemini';

    // Check cache
    const key = cacheKey({ company, role, job_description, skills: profile.skills, tone });
    const cached = await pool.query('SELECT response, provider FROM ai_cache WHERE cache_key=$1 AND user_id=$2', [key, req.userId]);
    if (cached.rows.length > 0) {
      try {
        const parsed = JSON.parse(cached.rows[0].response);
        return res.json({ ...parsed, provider: cached.rows[0].provider, cached: true });
      } catch {}
    }

    const toneInstruction = tone === 'startup' ? 'Use a casual, enthusiastic startup tone.' :
                            tone === 'conversational' ? 'Use a warm, conversational tone.' :
                            'Use a professional, formal tone.';

    const systemPrompt = `You are an expert cover letter writer who helps job seekers stand out. Your letters are concise (150-200 words), specific, and personalized. You NEVER use generic phrases like "I am excited to apply" or "I believe I would be a great fit." Instead, you reference specific requirements from the job and match them to the candidate's actual experience.

IMPORTANT: Return ONLY a valid JSON object with this exact format:
{"subject": "email subject line", "body": "the cover letter text"}

Do not include any text before or after the JSON.`;

    const userPrompt = `Write a cover letter for this job application:

Company: ${company}
Role: ${role}
${job_description ? `Job Description: ${job_description}` : ''}

Candidate Profile:
- Name: ${profile.full_name}
- Current Role: ${profile.current_role || 'Software Engineer'}
- Experience: ${profile.experience_years || '2'} years
- Key Skills: ${profile.skills || 'Not specified'}
- Summary: ${profile.summary || 'Not specified'}
- Email: ${profile.email || ''}
- Phone: ${profile.phone || ''}
- LinkedIn: ${profile.linkedin_url || ''}
- GitHub: ${profile.github_url || ''}
${profile.resume_text ? `- Resume highlights: ${profile.resume_text.substring(0, 500)}` : ''}

${toneInstruction}

Requirements:
1. Reference 2-3 specific requirements from the job description (or infer from the role if no JD provided)
2. Match those to the candidate's actual skills and experience
3. Include ONE concrete achievement or metric from their background
4. End with a clear call to action
5. Include contact info at the bottom`;

    const { text: aiResponse, provider: usedProvider } = await generateWithFallback(preferred, systemPrompt, userPrompt);

    let subject, body;
    try {
      const cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      subject = parsed.subject;
      body = parsed.body;
    } catch {
      subject = `Application for ${role} at ${company} - ${profile.full_name || ''}`;
      body = aiResponse;
    }

    // Cache the response
    await pool.query(
      'INSERT INTO ai_cache (user_id, cache_key, response, provider) VALUES ($1, $2, $3, $4) ON CONFLICT (cache_key) DO UPDATE SET response=$3, provider=$4, user_id=$1',
      [req.userId, key, JSON.stringify({ subject, body }), usedProvider]
    );

    res.json({ subject, body, provider: usedProvider, cached: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Generate cold email
router.post('/ai/generate-cold-email', async (req, res) => {
  try {
    const { company, role, job_description, recipient_name } = req.body;
    if (!company || !role) return res.status(400).json({ error: 'Company and role required' });

    const profileResult = await pool.query('SELECT * FROM profile WHERE user_id=$1', [req.userId]);
    const profile = profileResult.rows[0] || {};
    const preferred = profile.ai_provider || 'gemini';

    const systemPrompt = `You are an expert at writing cold emails that get responses. Your emails are short (80-120 words), personal, and reference something specific about the company or role. You create compelling subject lines with high open rates.

IMPORTANT: Return ONLY valid JSON:
{"subject_options": ["subject 1", "subject 2", "subject 3"], "body": "email text"}`;

    const userPrompt = `Write a cold email for a job opportunity:

Company: ${company}
Role: ${role}
${recipient_name ? `Recipient: ${recipient_name}` : ''}
${job_description ? `Context: ${job_description}` : ''}

From: ${profile.full_name} (${profile.current_role || 'Software Engineer'}, ${profile.experience_years || '2'} years exp)
Skills: ${profile.skills || 'Full stack development'}

Write 3 subject line options (compelling, not generic) and a short cold email body.`;

    const { text: aiResponse, provider: usedProvider } = await generateWithFallback(preferred, systemPrompt, userPrompt);

    let result;
    try {
      const cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      result = {
        subject_options: [`Interested in ${role} at ${company}`],
        body: aiResponse
      };
    }

    res.json({ ...result, provider: usedProvider });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Match score
router.post('/ai/match-score', async (req, res) => {
  try {
    const { job_title, job_description, application_id } = req.body;
    if (!job_title) return res.status(400).json({ error: 'Job title required' });

    const profileResult = await pool.query('SELECT * FROM profile WHERE user_id=$1', [req.userId]);
    const profile = profileResult.rows[0] || {};
    const preferred = profile.ai_provider || 'gemini';

    const systemPrompt = `You are a job matching expert. Analyze how well a candidate's profile matches a job posting. Return ONLY valid JSON:
{"score": 0-100, "matching_skills": ["skill1", "skill2"], "missing_skills": ["skill1"], "tip": "one sentence advice"}`;

    const userPrompt = `Rate the match between this candidate and job:

Job: ${job_title}
${job_description ? `Description: ${job_description.substring(0, 500)}` : ''}

Candidate:
- Current Role: ${profile.current_role || 'Software Engineer'}
- Experience: ${profile.experience_years || '2'} years
- Skills: ${profile.skills || 'Not specified'}
- Summary: ${profile.summary || 'Not specified'}

Score 0-100 based on skills match, experience level, and role fit.`;

    const { text: aiResponse, provider: usedProvider } = await generateWithFallback(preferred, systemPrompt, userPrompt);

    let result;
    try {
      const cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      result = { score: 50, matching_skills: [], missing_skills: [], tip: 'Could not parse match analysis' };
    }

    if (application_id) {
      await pool.query(
        'UPDATE applications SET match_score=$1, match_reasons=$2 WHERE id=$3 AND user_id=$4',
        [result.score, JSON.stringify(result), application_id, req.userId]
      );
    }

    res.json({ ...result, provider: usedProvider });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai/bulk-score', async (req, res) => {
  try {
    const profileResult = await pool.query('SELECT * FROM profile WHERE user_id=$1', [req.userId]);
    const profile = profileResult.rows[0] || {};
    const preferred = profile.ai_provider || 'gemini';

    const jobs = await pool.query("SELECT id, company, role, notes FROM applications WHERE user_id=$1 AND status='WISHLIST' AND match_score IS NULL LIMIT 20", [req.userId]);
    const results = [];

    for (const job of jobs.rows) {
      try {
        const systemPrompt = `You are a job matching expert. Return ONLY valid JSON: {"score": 0-100, "matching_skills": ["skill1"], "missing_skills": ["skill1"], "tip": "advice"}`;
        const userPrompt = `Rate match: Job "${job.role}" at ${job.company}. Description: ${(job.notes || '').substring(0, 300)}. Candidate: ${profile.current_role}, ${profile.experience_years}yr, skills: ${profile.skills}`;

        const { text: aiResponse } = await generateWithFallback(preferred, systemPrompt, userPrompt);
        const cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);

        await pool.query('UPDATE applications SET match_score=$1, match_reasons=$2 WHERE id=$3 AND user_id=$4',
          [parsed.score, JSON.stringify(parsed), job.id, req.userId]);
        results.push({ id: job.id, company: job.company, role: job.role, score: parsed.score });
      } catch (e) {
        results.push({ id: job.id, company: job.company, role: job.role, score: null, error: e.message });
      }
    }

    res.json({ ok: true, scored: results.filter(r => r.score !== null).length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Interview prep
router.post('/ai/interview-prep', async (req, res) => {
  try {
    const { application_id } = req.body;
    if (!application_id) return res.status(400).json({ error: 'Application ID required' });

    const jobResult = await pool.query('SELECT * FROM applications WHERE id=$1 AND user_id=$2', [application_id, req.userId]);
    if (jobResult.rows.length === 0) return res.status(404).json({ error: 'Application not found' });
    const job = jobResult.rows[0];

    const profileResult = await pool.query('SELECT * FROM profile WHERE user_id=$1', [req.userId]);
    const profile = profileResult.rows[0] || {};
    const preferred = profile.ai_provider || 'gemini';

    const systemPrompt = `You are an interview coach. Generate targeted practice questions based on the specific company and role. Return ONLY valid JSON array:
[{"category": "technical|behavioral|system_design|company_specific", "question": "...", "suggested_answer": "brief answer framework", "difficulty": "EASY|MEDIUM|HARD"}]

Generate exactly 10 questions: 4 technical, 2 behavioral, 2 system design, 2 company-specific.`;

    const userPrompt = `Generate interview questions for:
Company: ${job.company}
Role: ${job.role}
Job Notes: ${(job.notes || '').substring(0, 500)}

Candidate Background: ${profile.current_role || 'Software Engineer'}, ${profile.experience_years || '2'}yr experience, skills: ${profile.skills || ''}

Make questions specific to this company and role, not generic.`;

    const { text: aiResponse, provider: usedProvider } = await generateWithFallback(preferred, systemPrompt, userPrompt);

    let questions;
    try {
      const cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      questions = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    // Save questions to DB
    const saved = [];
    for (const q of questions) {
      const result = await pool.query(
        'INSERT INTO practice_questions (user_id, application_id, category, question, suggested_answer, difficulty) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [req.userId, application_id, q.category || 'technical', q.question, q.suggested_answer || '', q.difficulty || 'MEDIUM']
      );
      saved.push({ id: result.rows[0].id, ...q });
    }

    res.json({ ok: true, questions: saved, provider: usedProvider });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Usage stats
router.get('/ai/usage', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT provider, COUNT(*) as calls, SUM(tokens_used) as total_tokens
       FROM ai_cache
       WHERE user_id=$1 AND created_at >= date_trunc('month', CURRENT_DATE)
       GROUP BY provider`,
      [req.userId]
    );
    res.json({ usage: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
