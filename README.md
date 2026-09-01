# 🍲 Stew Code

**The Ultimate Terminal Coding Agent** — the only coding agent that forges its own skills, runs for hours unattended, and has a face. Zero dependencies.

[![npm version](https://img.shields.io/badge/version-2.1.0-blue)](https://www.npmjs.com/package/stew-ai)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

## Stew Code vs Claude Code vs OpenCode

| Capability | Stew Code | Claude Code | OpenCode |
|---|---|---|---|
| Interactive terminal REPL | Yes | Yes | Yes |
| Self-creates new skills for unknown tasks (Skill Forge) | **Yes — unique** | No | No |
| Runs unattended for hours, checkpointed + resumable (Marathon Mode) | **Yes — unique** | Auto/yolo mode, no checkpoint/resume | No |
| Built-in mascot / visual identity | **Yes** | No (plain text) | No |
| Built-in skill library (scaffold, docker, ci, security, etc.) | 16+ built-in | Via MCP/plugins only | Via plugins only |
| Multi-model support | 9 models, 6 providers | Claude only | 75+ models |
| Cost | Free tier (1,500 calls/mo) | Paid (Claude subscription/API) | Free (bring your own model key) |
| Dependencies | **Zero** | N/A (hosted CLI) | Several |
| Package size | 48KB | N/A | Larger |
| Git integration | Yes | Yes (native) | Yes |
| LSP integration | No | Yes | Yes |
| Subagents / hooks | Via Skill Forge | Yes (native) | No |
| MCP support | Planned | Yes | Yes |

Stew Code's edge isn't matching every feature — it's the two things nobody else does: it builds new capabilities for itself on the fly, and it can be told to go work for 6 hours and actually still be running (and resumable) when you check back.

## What's New in v2.1 — Marathon Mode + Skill Forge + Mascot

**Marathon Mode** — tell Stew a big goal and walk away. It re-plans continuously, checkpoints to disk every iteration, self-corrects on failures, and only stops when the goal is verifiably complete, the time budget runs out, or you ask it to stop. Kill the process, come back later, `--resume` the exact session.

```bash
stew marathon "build a full REST API with auth, tests, and docs" --hours 6
stew marathon --list
stew marathon --resume build-a-full-rest-api-mtj123
stew marathon --stop build-a-full-rest-api-mtj123
```

**Skill Forge** — when Stew Code hits a task it doesn't know how to do, it writes itself a new skill instead of giving up.

```bash
# inside stew code
/forge deploy-fly "deploy this project to Fly.io"
/skill deploy-fly
```

**16 built-in skills** — scaffold, test, docker, ci, env, gitignore, deps, explain, security, size, translate, refactor, document, clean, loc, format, checklist. Run any with `/skill <name>`.

**A mascot** — Stew has a face (ANSI art, since a real terminal can't render 3D) that reacts to what's happening: idle, thinking, working, success, error, and a headband when it's in marathon mode.

## Also included

**Interactive Code Agent** — a full-featured AI coding agent in your terminal:

- 🧠 Interactive REPL with streaming responses
- 📁 Project context awareness (auto-detects project type, structure, config files)
- 📝 File operations — read, write, edit with undo
- 🖥️ Shell command execution
- 🔀 Git integration (status, diff, log, commit)
- 💾 Session persistence (save/load conversations)
- 🌐 Web search toggle (search the web mid-conversation)
- 📋 Plan mode (review changes before applying)
- 🎨 Syntax highlighting for code blocks
- ⚡ Real-time SSE streaming from the Stew API
- 🔗 `@file` references to include files in your prompt
- 🎭 12 AI personas (developer, doctor, lawyer, etc.)
- 🤖 9 AI models (Groq, Mistral, NVIDIA, OpenRouter, HuggingFace, OpenAI)
- 📦 Zero dependencies — pure Node.js 18+ native fetch

## Install

```bash
npm install -g stew-ai
```

## Quick Start

### Interactive Code Agent

```bash
# Navigate to your project
cd /path/to/your/project

# Launch the code agent
stew
# or explicitly
stew code
```

Then start chatting with full project context:

```
stew> Read @package.json and suggest improvements
stew> Create a new Express API route for user authentication
stew> Explain how the authentication works in this project
stew> /files **/*.ts
stew> /model stew-fast
stew> /web on
stew> What are the latest best practices for JWT auth?
stew> /exit
```

### One-Shot Commands

```bash
# Chat
stew chat "What is the capital of Nigeria?"

# Chat with web search
stew chat "latest news in Lagos" --web

# Web search with sources
stew search "top Nigerian fintechs 2026" --json

# List skills
stew skills --category finance

# Generate documents
stew doc pdf '{"title":"Report","content":"Hello world"}' --output report.pdf

# Check API status
stew status

# Autonomous agent — plans and executes a multi-step task, then stops
stew agent "fix all TypeScript errors in the project"
stew agent "add tests to all API routes" --dry-run

# Marathon mode — runs for hours, checkpointed, resumable
stew marathon "build a full REST API with auth, tests, and docs" --hours 6
stew marathon --list
stew marathon --resume <session-id>
stew marathon --stop <session-id>
```

## Code Agent Commands

Inside `stew code` (or just `stew`), use these slash commands:

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/files [pattern]` | List project files (e.g. `/files **/*.ts`) |
| `/read <file>` | Read a file into conversation context |
| `/clear` | Clear conversation history |
| `/model [name]` | Show or set AI model |
| `/persona [name]` | Show or set AI persona |
| `/web [on\|off]` | Toggle web search |
| `/plan [on\|off]` | Toggle plan mode (read-only, no file changes) |
| `/save <name>` | Save current session |
| `/load <name>` | Load a saved session |
| `/sessions` | List saved sessions |
| `/git status` | Git status |
| `/git diff` | Git diff |
| `/git log` | Git commit log |
| `/git commit <msg>` | Stage all + commit |
| `/run <cmd>` | Execute a shell command |
| `/undo` | Undo last file change |
| `/diff <file>` | Show diff of a file |
| `/status` | Show current Stew Code state |
| `/exit` | Exit |

### Multi-line Input

Type ```` ``` ```` or `---` to enter multi-line mode. Type it again to finish:

```
stew> ```
... function processPayment(amount) {
...   // complex logic here
...   return result;
... }
... ```
```

### `@file` References

Include files in your prompt with `@filepath`:

```
stew> Read @src/index.js and @src/utils.js — explain the architecture
stew> Compare @lib/old.js with @lib/new.js
stew> Fix the bug in @src/handler.ts
```

### Plan Mode

When plan mode is on, Stew analyzes your project and suggests changes but doesn't apply them. Perfect for reviewing before committing:

```
stew> /plan on
✅ Plan mode ON
stew> Refactor the authentication to use JWT
(stew explains what it would change, no files modified)
stew> /plan off
✅ Plan mode OFF — changes will auto-apply
stew> Go ahead and make those changes
(changes applied automatically)
```

## SDK Usage

```javascript
const Stew = require('stew-ai');

const stew = new Stew({ apiKey: 'your_api_key' });

// Chat
const response = await stew.chat.send('Hello!');
console.log(response.response);

// Streaming chat
await stew.chat.stream('Write a poem about Lagos', {
  onToken: (delta) => process.stdout.write(delta),
});

// OpenAI-compatible completion
const result = await stew.chat.completion([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What is 2+2?' }
]);

// Web search
const search = await stew.search.query('Nigerian tech startups 2026');

// Generate documents
const pdf = await stew.documents.pdf('# Report\n\nHello world', 'My Report');

// List skills
const skills = await stew.skills.list();

// Run a skill
const cv = await stew.skills.run('generate_cv', {
  name: 'Emmanuel',
  role: 'Developer'
});

// Generate images
const img = await stew.generateImage('A lion walking through Lagos');

// Execute code
const result = await stew.executeCode('print("Hello from Stew!")');

// Run agent swarm
const agents = await stew.runAgents('Research top 10 African startups', { numAgents: 5 });
```

## Available Models

| Model | Description |
|-------|-------------|
| `stew-default` | Auto-select best model (recommended) |
| `stew-fast` | Groq — fastest inference |
| `stew-mistral` | Mistral Large |
| `stew-nvidia` | NVIDIA NIM |
| `stew-openrouter` | OpenRouter (multi-model) |
| `stew-hf` | HuggingFace |
| `stew-openai` | OpenAI GPT-4o |
| `gpt-4o` | GPT-4o |
| `gpt-4o-mini` | GPT-4o mini (cheapest) |

## Personas

`default` · `business` · `doctor` · `lawyer` · `teacher` · `developer` · `therapist` · `coach` · `nutritionist` · `financial_advisor` · `researcher` · `creative`

## Project Configuration

Create a `STEW.md` or `.stew/rules` file in your project root to give Stew custom instructions:

```markdown
# Project Rules

- Use TypeScript strict mode
- Follow the Airbnb ESLint config
- All API endpoints must have input validation
- Use camelCase for variables, PascalCase for types
```

## Authentication

Get a free API key at [https://stew-agent.onrender.com](https://stew-agent.onrender.com):

```bash
stew login your_api_key_here
```

Free tier: 1,500 API calls/month. No credit card required.

## Piping & Scripting

```bash
# Pipe content into Stew
cat error.log | stew chat "What's causing this error?"

# Use in scripts
echo $(stew chat "Generate a git commit message for: added login page" --raw)

# JSON output for programmatic use
stew search "Nigerian GDP 2026" --json | jq '.results[0]'
```

## Full Comparison with Other Code Agents

| Feature | Stew Code | Claude Code | OpenCode | Kilo Code |
|---------|-----------|-------------|----------|-----------|
| Price | Free tier | $20/mo | Free (BYOK) | Free (BYOK) |
| Dependencies | Zero | TypeScript | Go | TypeScript |
| Models | 9 models | Claude only | 75+ models | 500+ models |
| Skill Forge (self-creates skills) | ✅ Unique | ❌ | ❌ | ❌ |
| Marathon Mode (hours, resumable) | ✅ Unique | Auto/yolo, no resume | ❌ | ❌ |
| Mascot / visual identity | ✅ | ❌ | ❌ | ❌ |
| Streaming | ✅ SSE | ✅ | ✅ | ✅ |
| File ops | ✅ | ✅ | ✅ | ✅ |
| Git integration | ✅ | ✅ | ✅ | ✅ |
| Shell execution | ✅ | ✅ | ✅ | ✅ |
| Session persistence | ✅ | ✅ | ✅ SQLite | ✅ |
| Plan mode | ✅ | ✅ | ✅ | ✅ |
| Undo | ✅ | ✅ | ✅ | ✅ |
| @file refs | ✅ | ✅ | ✅ | ✅ |
| Web search | ✅ Built-in | ❌ | ❌ | ❌ |
| Personas | ✅ 12 | ❌ | ❌ | ❌ |
| Document gen | ✅ PDF/DOCX | ❌ | ❌ | ❌ |
| Image gen | ✅ | ❌ | ❌ | ❌ |
| LSP integration | ❌ | ✅ | ✅ | ❌ |
| Africa-focused | ✅ | ❌ | ❌ | ❌ |

## License

MIT © MUTYINT Nigeria

## Links

- API Docs: https://stew-agent.onrender.com/docs
- Get a free key: https://stew-agent.onrender.com
- GitHub: https://github.com/emmanuelerogian723-alt/Stew-agent
- Telegram: @StewAgent_bot
