# 🍲 Stew Code

Terminal coding agent. Zero dependencies.

## What's New in v2.4 — Web Scraper + API Caller + Marathon Mode + Skill Forge

*Marathon Mode* — run autonomously for hours, checkpoints to disk, fully resumable.

*Skill Forge* — writes new skills for itself, no plugins needed.

*Web Scraper* — `stew scrape <url>` and `stew crawl <url> --depth N`.

*API Caller* — `stew api GET/POST <url>` with headers, body, auth.

*Mascot* — ANSI art that reacts to state.

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


## v2.4 — Security Scanner + Self-Verify + Endurance + Dev Environment

*Security Scanner* — `/scan` scans your code for hardcoded secrets, injection risks, phishing patterns, and malware indicators. 20+ patterns, threat scoring.

*Self-Verification* — `/verify` checks all files changed in the session: syntax, logic, and security. Auto-retries 3x.

*Endurance Mode* — `/endurance <hours> [task]` runs for hours with checkpoints + self-heal.

*Dev Environment Setup* — `/setup vscode` creates settings, launch, tasks, extensions. `/setup opencode` creates opencode.json config. `/setup all` does both + .editorconfig.

*New slash commands* — `/install <pkg>`, `/clone <url>`, `/serve [port]`, `/deploy [target]`, `/create <type> <prompt>`.

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

## Authentication

Get a free API key at [https://stew-agent.onrender.com](https://stew-agent.onrender.com):

```bash
stew login your_api_key_here
```

Free tier: 1,500 API calls/month. No credit card required.
