# 🍲 Stew AI

The zero-dependency AI agent SDK + CLI for the S.T.E.W Agent API. Built in Nigeria 🇳🇬

`npm i stew-ai` · 50KB · 0 dependencies · Node 18+

## Quick start

```bash
npm i -g stew-ai
stew login <api-key>     # free key: https://stew-agent.onrender.com
stew code                # AI coding REPL
```

## Commands

| Command | What it does |
|---|---|
| `stew code` | AI coding REPL (chat, read/write files, run commands) |
| `stew chat` | Plain AI chat |
| `stew search <q>` | Web search |
| `stew scrape <url>` | Scrape a page |
| `stew crawl <url> [depth]` | Crawl a site |
| `stew api <METHOD> <url>` | Call REST/GraphQL APIs |
| `stew marathon <goal>` | Autonomous hours-long runs |
| `stew skills` | List all skills |
| `stew status` | API status + usage |

## REPL slash commands

`/help` all commands · `/build <prompt>` build a complete app from a prompt · `/fix` auto-fix project errors · `/test` run tests + auto-fix failures · `/swarm <task>` multi-agent team build · `/explain <q>` ask how the codebase works · `/review [file]` AI code review · `/changelog` generate CHANGELOG.md · `/doc` generate README.md · `/scan` security scan · `/verify` verify session files · `/sh <cmd>` guarded shell · `/setup vscode` dev environment setup · `/skill <name>` run a skill · `/forge <name> <desc>` create new skills · `/agent <task>` autonomous mode · `/marathon <goal>` long-run mode · `/model` switch model · `/persona` switch persona · `/git <sub>` git ops · `/save` `/load` sessions · `/status` · `/exit`

## Build an app from a prompt

```
stew code
> /build a todo app with express and sqlite
```

Stew plans the app, generates every file, verifies each one, auto-fixes errors, installs deps, and commits to git. Then tells you how to run it.

## Why Stew?

1. Free — no subscription
2. 49KB, zero dependencies
3. Security scanner — 20+ threat patterns
4. Self-verification — checks its own code
5. Marathon + Endurance modes — runs for hours
6. Skill Forge — writes new skills for itself
7. 6 AI providers with auto-failover
8. 12 personas, 16+ built-in skills

## SDK

```js
import Stew from 'stew-ai';
const stew = new Stew('your-api-key');
const res = await stew.chat('Hello!');
```

## Links

npm: https://www.npmjs.com/package/stew-ai
GitHub: https://github.com/emmanuelerogian723-alt/stew-ai
API: https://stew-agent.onrender.com
Telegram: https://t.me/stew_agent_bot

MIT License. Built by Emmanuel Erog (EROGIAN) in Enugu, Nigeria.

## Multi-agent swarm

```
stew code
> /swarm build a REST API with auth
```

A planner agent splits the task into subtasks, specialized agents (backend, frontend, QA, docs) work in parallel, every file is syntax-verified and auto-fixed, and Stew commits the result. Plus: it remembers fixes that worked and applies them next time (memory lives in `~/.stew/learned.md`).

## Understand your codebase

```
> /explain where is the payment logic?
> /explain how does authentication work?
```

Stew maps the project, reads key files, and answers with file citations. Drop a `STEW.md` in your repo with project rules — Stew reads it every session.
