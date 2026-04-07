const crypto = require('crypto');

// Provider configurations
const PROVIDERS = {
  gemini: {
    name: 'Google Gemini (Free)',
    model: 'gemini-2.0-flash',
    envKey: 'GEMINI_API_KEY',
    free: true
  },
  groq: {
    name: 'Groq (Free)',
    model: 'llama-3.3-70b-versatile',
    envKey: 'GROQ_API_KEY',
    free: true
  },
  anthropic: {
    name: 'Claude (Paid)',
    model: 'claude-3-5-haiku-20241022',
    envKey: 'ANTHROPIC_API_KEY',
    free: false
  },
  openai: {
    name: 'OpenAI (Paid)',
    model: 'gpt-4o-mini',
    envKey: 'OPENAI_API_KEY',
    free: false
  }
};

function getAvailableProviders() {
  return Object.entries(PROVIDERS).map(([id, config]) => ({
    id,
    name: config.name,
    model: config.model,
    free: config.free,
    available: !!process.env[config.envKey]
  }));
}

function getFirstAvailable(preferred) {
  if (preferred && process.env[PROVIDERS[preferred]?.envKey]) return preferred;
  const order = ['gemini', 'groq', 'anthropic', 'openai'];
  for (const id of order) {
    if (process.env[PROVIDERS[id].envKey]) return id;
  }
  return null;
}

async function generate(providerId, systemPrompt, userPrompt) {
  const provider = PROVIDERS[providerId];
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);
  const apiKey = process.env[provider.envKey];
  if (!apiKey) throw new Error(`API key not configured for ${provider.name}. Set ${provider.envKey} environment variable.`);

  switch (providerId) {
    case 'gemini': return callGemini(apiKey, provider.model, systemPrompt, userPrompt);
    case 'groq': return callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', apiKey, provider.model, systemPrompt, userPrompt);
    case 'anthropic': return callAnthropic(apiKey, provider.model, systemPrompt, userPrompt);
    case 'openai': return callOpenAICompatible('https://api.openai.com/v1/chat/completions', apiKey, provider.model, systemPrompt, userPrompt);
    default: throw new Error(`Unsupported provider: ${providerId}`);
  }
}

async function callGemini(apiKey, model, systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Gemini API error');
  if (!data.candidates || !data.candidates[0]) throw new Error('No response from Gemini');
  return data.candidates[0].content.parts[0].text;
}

async function callOpenAICompatible(baseUrl, apiKey, model, systemPrompt, userPrompt) {
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2048
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'API error');
  return data.choices[0].message.content;
}

async function callAnthropic(apiKey, model, systemPrompt, userPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 2048,
      temperature: 0.7
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Anthropic API error');
  return data.content[0].text;
}

function cacheKey(inputs) {
  return crypto.createHash('md5').update(JSON.stringify(inputs)).digest('hex');
}

module.exports = { PROVIDERS, getAvailableProviders, getFirstAvailable, generate, cacheKey };
