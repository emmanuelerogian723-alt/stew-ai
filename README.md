# stew-ai 🥘

**Africa's #1 AI Agent API** — 60+ skills, web research, document generation, code execution, OCR, and a 100-agent swarm. Zero dependencies.

[![npm version](https://img.shields.io/npm/v/stew-ai)](https://www.npmjs.com/package/stew-ai)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Built in Nigeria](https://img.shields.io/badge/built%20in-Nigeria-%23009739)](https://stew-agent.onrender.com)

> **S.T.E.W** = **S**mart **T**ask **E**xecution **W**orker

One SDK. Every skill your app needs. Chat with 6 AI providers (automatic failover), search the web, generate PDF/DOCX/XLSX/PPTX, run Python code, OCR images, and spawn 100 AI agents — all from a single SDK.

🌐 **Live API**: https://stew-agent.onrender.com · 📚 **Docs**: https://stew-agent.onrender.com/docs

---

## Install

```bash
npm install stew-ai
```

Or install globally for CLI access:

```bash
npm install -g stew-ai
```

---

## Quick Start (3 lines)

```js
const Stew = require('stew-ai');
const stew = new Stew({ apiKey: 'stew_your_key_here' });
const res = await stew.chat.send('Hello from Africa!');
console.log(res.response);
```

Get a free API key at https://stew-agent.onrender.com — no credit card needed.

---

## CLI Usage

```bash
# Save your API key
stew login stew_your_api_key_here

# Chat
stew chat "What is the capital of Nigeria?"
stew chat "Latest news in Lagos" --web
stew chat "Write a poem" --json

# Search
stew search "top Nigerian fintechs 2026"

# Skills
stew skills
stew skills run generate_cv '{"name":"Emmanuel","role":"Developer"}'

# Documents
stew doc pdf '{"title":"Report","content":"Hello"}' --output report.pdf

# Fine-tune
stew finetune --persona doctor --instructions "Always cite NHS guidelines"

# Status
stew status

# Piping
cat file.txt | stew chat "Summarize this"
```

---

## SDK Methods

### Chat

```js
const stew = new Stew({ apiKey: 'stew_xxx' });

// Basic chat
const res = await stew.chat.send('What is 2+2?');

// Chat with web search
const res = await stew.chat.send('Latest news in Nigeria?', { webSearch: true });

// Chat with persona (requires fine-tuning)
await stew.finetune.set({ persona: 'doctor' });
const res = await stew.chat.send('What are malaria symptoms?');
```

### Web Search

```js
// Search the web
const results = await stew.search.query('top Nigerian startups 2026');

// Browse a URL
const page = await stew.search.browse('https://example.com', {
  question: 'What does this company do?'
});
```

### Skills (59 available)

```js
// List all skills
const skills = await stew.skills.list();
const financeSkills = await stew.skills.list('finance');

// Run a skill
const cv = await stew.skills.run('generate_cv', {
  name: 'Emmanuel Erog',
  role: 'AI Engineer'
});

const weather = await stew.skills.run('weather', { city: 'Lagos' });
const rates = await stew.skills.run('currency_rates', { base: 'NGN', target: 'USD' });
```

### Document Generation

```js
// PDF
await stew.documents.pdf('Content here', 'My Report');

// Word document
await stew.documents.docx('Content here', 'My Document');

// Excel spreadsheet
await stew.documents.xlsx([
  { name: 'Emmanuel', role: 'Developer' },
  { name: 'Jane', role: 'Designer' }
], 'Team', 'Staff Sheet');

// PowerPoint
await stew.documents.pptx([
  { title: 'Q3 Results', content: 'Revenue up 40%' }
], 'Quarterly Report');

// HTML report
await stew.documents.html('<h1>Hello</h1>', 'My Report');
```

### Fine-Tune (12 personas)

```js
// Set persona
await stew.finetune.set({
  persona: 'doctor',          // general|doctor|health|startup|legal|finance|education|ecommerce|developer|marketing|hr|customer_support
  customInstructions: 'Always cite NHS guidelines',
  responseStyle: 'detailed',  // concise|balanced|detailed
  language: 'en'              // en|pidgin|yoruba|igbo|hausa|fr
});

// Get current settings
const settings = await stew.finetune.get();
```

### 100-Agent Swarm

```js
// Spawn multiple agents for complex tasks
const result = await stew.runAgents(
  'Research the top 10 AI startups in Africa and create a summary report',
  { numAgents: 5, synthesize: true }
);
```

### Code Execution

```js
// Run Python code in a safe sandbox
const result = await stew.executeCode(
  'import numpy as np\nprint(np.array([1,2,3]).mean())'
);
```

### Image Generation

```js
const result = await stew.generateImage('A futuristic African city');
```

### OCR

```js
const result = await stew.ocr(base64ImageData, {
  languages: ['eng', 'fra']
});
```

### System

```js
// Health check
const health = await stew.heartbeat();

// Account usage
const usage = await stew.usage();
```

---

## Authentication

Three ways to provide your API key:

```js
// 1. Constructor
const stew = new Stew({ apiKey: 'stew_xxx' });

// 2. Environment variable
process.env.STEW_API_KEY = 'stew_xxx';
const stew = new Stew({});

// 3. CLI config (saved with `stew login`)
// CLI reads from ~/.stew/config.json automatically
```

---

## Error Handling

```js
const { StewError } = require('stew-ai');

try {
  const res = await stew.chat.send('Hello');
} catch (err) {
  if (err instanceof StewError) {
    console.log(err.code);       // AUTH_ERROR | RATE_LIMIT | SERVER_ERROR | NETWORK_ERROR
    console.log(err.message);    // Human-readable message
    console.log(err.suggestion); // What to do about it
  }
}
```

| Code | Meaning |
|---|---|
| `AUTH_ERROR` | Invalid or missing API key |
| `RATE_LIMIT` | Monthly call limit reached — upgrade your plan |
| `SERVER_ERROR` | API is down or waking up (free tier sleeps) |
| `NETWORK_ERROR` | Cannot reach the API |
| `BAD_REQUEST` | Malformed request |

---

## Migration from OpenAI SDK

```js
// OpenAI
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: 'sk-xxx' });
const res = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello' }]
});
console.log(res.choices[0].message.content);

// S.T.E.W (simpler, more features, Naira billing)
const Stew = require('stew-ai');
const stew = new Stew({ apiKey: 'stew_xxx' });
const res = await stew.chat.send('Hello');
console.log(res.response);
```

---

## AI Providers (6 with auto-failover)

| Provider | Model | Role |
|---|---|---|
| Groq | gpt-oss-120b | Primary (ultra-fast) |
| Mistral AI | mistral-large-latest | Secondary |
| NVIDIA NIM | llama-3.3-70b | Tertiary (free) |
| OpenRouter | llama-3.3-70b:free | Quaternary |
| HuggingFace | Qwen3-235B | Fallback |
| OpenAI | gpt-4o-mini | Emergency |

If one goes down, the next picks up automatically. Your app never breaks.

---

## Pricing (Naira billing, no dollar card)

| Plan | Price | Calls/month |
|---|---|---|
| Free | ₦0 | 1,500 |
| Pro | ₦9,900/mo (~$6) | 10,000 |
| Business | ₦29,000/mo (~$18) | 100,000 |
| Enterprise | ₦49k+/mo | Unlimited |

---

## Why stew-ai?

1. **Zero dependencies** — installs instantly, never breaks from dependency updates
2. **6 AI providers** — automatic failover means 99.9% uptime
3. **59 skills** — web search, document gen, code exec, OCR, and more
4. **100-agent swarm** — complex multi-step tasks in parallel
5. **Naira billing** — Paystack-powered, no dollar card needed
6. **12 personas** — fine-tune for medical, legal, finance, startup, and more
7. **African-first** — Pidgin, Yoruba, Igbo, Hausa language support
8. **Free tier** — 1,500 calls/month, no credit card

---

## License

MIT

---

<p align="center">
  🇳🇬 Built by Africans, for Africans.<br>
  <a href="https://stew-agent.onrender.com">stew-agent.onrender.com</a>
</p>
