/**
 * Stew Code — Interactive AI coding agent for the terminal.
 * Competes with Claude Code, OpenCode, Kilo Code.
 * 
 * Features:
 * - Interactive REPL with streaming responses
 * - @file references for project context
 * - Slash commands: /help /files /clear /model /persona /exit /save /load /diff /git /run /undo /web /plan /code
 * - File read/write/edit with undo
 * - Code execution (shell commands)
 * - Git integration (status, diff, commit)
 * - Session persistence (save/load conversations)
 * - Project context awareness
 * - Plan mode (review before changes)
 * - Multi-line input support
 * - Syntax highlighting
 * - Web search toggle
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { getApiKey } = require('../utils/config');
const { StewClient } = require('../../lib/client');
const { streamChatCompletion } = require('../../lib/stream');
const { highlightCode, detectLang } = require('../utils/highlight');
const { readFileSync, listFiles, projectContext, diff, UndoStack } = require('../utils/files');
const git = require('../utils/git');
const { saveSession, loadSession, listSessions, deleteSession } = require('../utils/session');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', italic: '\x1b[3m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
  gray: '\x1b[90m', white: '\x1b[37m',
  bgRed: '\x1b[41m', bgGreen: '\x1b[42m', bgBlue: '\x1b[44m', bgMagenta: '\x1b[45m',
};

const BANNER = `
${C.cyan}${C.bold}  ___  ___ ___ ___ ___
 / __|/ __| __/ __| _ \\${C.reset}
${C.cyan}${C.bold} \\__ \\ (__| _| (__|   /${C.reset}
${C.cyan}${C.bold} |___/\\___|___\\___|_|_\\${C.reset}
${C.dim}  AI Coding Agent · Zero dependencies · Africa's #1${C.reset}
`;

const MODELS = [
  ['stew-default', 'Auto-select best model'],
  ['stew-fast', 'Groq (fastest)'],
  ['stew-mistral', 'Mistral Large'],
  ['stew-nvidia', 'NVIDIA NIM'],
  ['stew-openrouter', 'OpenRouter (multi-model)'],
  ['stew-hf', 'HuggingFace'],
  ['stew-openai', 'OpenAI GPT-4o'],
  ['gpt-4o', 'GPT-4o'],
  ['gpt-4o-mini', 'GPT-4o mini (cheap)'],
];

const PERSONAS = [
  'default', 'business', 'doctor', 'lawyer', 'teacher',
  'developer', 'therapist', 'coach', 'nutritionist',
  'financial_advisor', 'researcher', 'creative',
];

const SLASH_COMMANDS = [
  ['/help', 'Show available commands'],
  ['/files [pattern]', 'List project files'],
  ['/read <file>', 'Read a file into context'],
  ['/clear', 'Clear conversation history'],
  ['/model [name]', 'Show/set AI model'],
  ['/persona [name]', 'Show/set persona'],
  ['/web [on|off]', 'Toggle web search'],
  ['/plan [on|off]', 'Toggle plan mode (no file changes)'],
  ['/save <name>', 'Save current session'],
  ['/load <name>', 'Load a saved session'],
  ['/sessions', 'List saved sessions'],
  ['/git status', 'Git status'],
  ['/git diff', 'Git diff'],
  ['/git log', 'Git log'],
  ['/git commit <msg>', 'Stage all + commit'],
  ['/run <cmd>', 'Execute shell command'],
  ['/undo', 'Undo last file change'],
  ['/diff <file>', 'Show diff of a file'],
  ['/exit', 'Exit Stew Code'],
  ['/quit', 'Exit Stew Code'],
];

async function codeCommand(args) {
  const apiKey = getApiKey();
  if (!apiKey && !process.env.STEW_API_KEY) {
    console.log(`${C.red}No API key found.${C.reset} Run: ${C.bold}stew login <your_api_key>${C.reset}`);
    console.log(`${C.dim}Get a free key at https://stew-agent.onrender.com${C.reset}\n`);
    process.exit(1);
  }

  const client = new StewClient({ apiKey });
  const cwd = process.cwd();

  // State
  const state = {
    messages: [],
    model: 'stew-default',
    persona: 'developer',
    webSearch: false,
    planMode: false,
    undoStack: new UndoStack(),
    projectCtx: null,
    streaming: true,
    debugMode: false,
  };

  // Build project context
  const projCtx = projectContext(cwd);
  state.projectCtx = projCtx;

  // System prompt with project context
  function buildSystemPrompt() {
    let prompt = `You are S.T.E.W, an expert AI coding agent working in a terminal. You help developers write, debug, and understand code.

CAPABILITIES:
- Read and write files in the user's project
- Execute shell commands
- Search the web for documentation
- Generate code, tests, and documentation
- Debug and fix issues
- Explain code and architecture

CURRENT PROJECT:
- Directory: ${projCtx.root}
- Type: ${projCtx.type}
- Files (${projCtx.stats.totalFiles || 0}): ${projCtx.files.slice(0, 30).join(', ')}${projCtx.files.length > 30 ? '...' : ''}

PROJECT STRUCTURE:
${projCtx.structure || '(empty)'}`;

    // Add config files context
    if (projCtx.config) {
      for (const [file, content] of Object.entries(projCtx.config)) {
        prompt += `\n\n--- ${file} ---\n${content}`;
      }
    }

    // Add .stew/rules or STEW.md if present
    const rulesPath = path.join(cwd, '.stew', 'rules');
    const stewMdPath = path.join(cwd, 'STEW.md');
    if (fs.existsSync(rulesPath)) {
      prompt += `\n\nPROJECT RULES (.stew/rules):\n${fs.readFileSync(rulesPath, 'utf8').slice(0, 3000)}`;
    }
    if (fs.existsSync(stewMdPath)) {
      prompt += `\n\nPROJECT RULES (STEW.md):\n${fs.readFileSync(stewMdPath, 'utf8').slice(0, 3000)}`;
    }

    prompt += `

BEHAVIOR:
1. Be concise and direct. Show code, not paragraphs.
2. When you want to read a file, say "Let me read <file>" and the user will provide its content.
3. When you suggest writing/editing a file, show the complete file content in a code block with the filename as a comment on the first line.
4. Use the format: \`\`\`lang filepath
// filepath: relative/path/to/file.js
code here
\`\`\`
5. When suggesting shell commands, use: \`\`\`bash\ncommand here\n\`\`\`
6. Always explain what changed and why.
7. If in plan mode, do NOT suggest file writes — only explain what you would do.
8. Match the project's existing code style and conventions.`;

    if (state.persona !== 'default' && state.persona !== 'developer') {
      prompt += `\n\nPERSONA: ${state.persona}`;
    }

    return prompt;
  }

  // Initialize system message
  state.messages.push({ role: 'system', content: buildSystemPrompt() });

  // Print banner
  console.log(BANNER);
  console.log(`${C.dim}  Model: ${C.reset}${C.bold}${state.model}${C.reset}  ${C.dim}·${C.reset}  ${C.dim}Persona: ${C.reset}${C.bold}${state.persona}${C.reset}  ${C.dim}·${C.reset}  ${C.dim}Web: ${C.reset}${state.webSearch ? C.green + 'on' : C.gray + 'off'}${C.reset}  ${C.dim}·${C.reset}  ${C.dim}Plan: ${C.reset}${state.planMode ? C.yellow + 'on' : C.gray + 'off'}${C.reset}`);
  console.log(`${C.dim}  Project: ${C.reset}${projCtx.root} ${C.dim}(${projCtx.type})${C.reset}`);
  
  if (git.isGitRepo(cwd)) {
    const gs = git.status(cwd);
    console.log(`${C.dim}  Branch: ${C.reset}${C.cyan}${gs.branch}${C.reset}  ${C.dim}·${C.reset}  ${gs.changes.length > 0 ? C.yellow + gs.changes.length + ' changes' : C.green + 'clean'}${C.reset}`);
  }
  
  console.log(`${C.dim}  Type a message, /help for commands, or @file to include files${C.reset}`);
  console.log(`${C.dim}  ${'─'.repeat(60)}${C.reset}\n`);

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${C.cyan}${C.bold}stew>${C.reset} `,
  });

  // Input handling state
  let multilineBuffer = '';
  let inMultiline = false;

  rl.prompt();

  rl.on('line', async (input) => {
    const trimmed = input.trim();

    // Multi-line input handling
    if (inMultiline) {
      if (trimmed === '```' || trimmed === '---') {
        // End of multi-line
        inMultiline = false;
        const fullInput = multilineBuffer;
        multilineBuffer = '';
        if (fullInput.trim()) {
          await processInput(fullInput);
        }
        rl.prompt();
        return;
      }
      multilineBuffer += input + '\n';
      process.stdout.write(`${C.gray}... ${C.reset}`);
      return;
    }

    // Start multi-line with ``` or ---
    if (trimmed === '```' || trimmed === '---') {
      inMultiline = true;
      multilineBuffer = '';
      process.stdout.write(`${C.dim}Multi-line mode. Type ${C.bold}\`\`\`${C.reset}${C.dim} or ${C.bold}---${C.reset}${C.dim} to finish${C.reset}\n`);
      process.stdout.write(`${C.gray}... ${C.reset}`);
      return;
    }

    // Empty input
    if (!trimmed) {
      rl.prompt();
      return;
    }

    // Slash commands
    if (trimmed.startsWith('/')) {
      await handleSlashCommand(trimmed, state, rl);
      rl.prompt();
      return;
    }

    await processInput(trimmed);
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(`\n${C.dim}Goodbye! 👋${C.reset}\n`);
    process.exit(0);
  });

  async function processInput(input) {
    // Expand @file references
    let expandedInput = input;
    const fileRefs = input.match(/@[\w\-\.\/]+/g);
    let fileContexts = '';

    if (fileRefs) {
      for (const ref of fileRefs) {
        const filepath = ref.slice(1);
        const resolved = path.resolve(cwd, filepath);
        if (fs.existsSync(resolved)) {
          try {
            const { content, truncated } = readFileSync(resolved);
            fileContexts += `\n\n--- File: ${filepath} ---\n${content}${truncated ? '\n[...truncated]' : ''}\n`;
            expandedInput = expandedInput.replace(ref, `[file: ${filepath}]`);
          } catch {
            fileContexts += `\n--- File: ${filepath} (could not read) ---\n`;
          }
        }
      }
    }

    // Add file context as a separate message
    if (fileContexts) {
      state.messages.push({ role: 'user', content: `Please review these files:\n${fileContexts}` });
    }

    // Add user message
    state.messages.push({ role: 'user', content: expandedInput });

    // Trim conversation if too long (keep system + last 20 messages)
    if (state.messages.length > 22) {
      const sysMsg = state.messages[0];
      state.messages = [sysMsg, ...state.messages.slice(-20)];
    }

    // Stream response
    process.stdout.write(`${C.green}${C.bold}stew${C.reset} ${C.dim}›${C.reset} `);

    let fullResponse = '';
    let inCodeBlock = false;
    let codeBuffer = '';
    let codeLang = '';
    let thinkingDots = true;

    try {
      const controller = new AbortController();

      if (state.streaming) {
        await streamChatCompletion(client, state.messages, {
          model: state.model,
          webSearch: state.webSearch,
          temperature: 0.7,
          onToken: (token) => {
            if (thinkingDots) {
              thinkingDots = false;
              process.stdout.write('\r' + ' '.repeat(20) + '\r');
            }

            fullResponse += token;

            // Basic streaming output — just print tokens
            // Detect code blocks for highlighting
            if (fullResponse.includes('```')) {
              // Will highlight after completion
            }
            process.stdout.write(token);
          },
        });
      } else {
        // Non-streaming fallback
        const result = await client.post('/v1/chat/completions', {
          model: state.model,
          messages: state.messages,
          web_search: state.webSearch,
        });
        fullResponse = result.choices?.[0]?.message?.content || result.response || '';
        process.stdout.write(fullResponse);
      }

      console.log('\n');

      // Add assistant response to history
      state.messages.push({ role: 'assistant', content: fullResponse });

      // Extract and offer to apply file changes
      await extractAndOfferChanges(fullResponse, state);

      // Check for shell command suggestions
      await extractAndOfferShellCommands(fullResponse, state);

    } catch (err) {
      process.stdout.write('\r' + ' '.repeat(50) + '\r');
      console.log(`${C.red}❌ ${err.message || err}${C.reset}`);
      if (err.suggestion) {
        console.log(`${C.dim}💡 ${err.suggestion}${C.reset}`);
      }
      console.log('');
      // Remove the failed user message
      if (state.messages[state.messages.length - 1]?.role === 'user') {
        state.messages.pop();
      }
    }
  }

  async function extractAndOfferChanges(response, state) {
    // Find code blocks with file paths
    const codeBlocks = response.match(/```(\w+)\s*\n\/\/\s*(?:filepath:|file:)?\s*(.+?)\n([\s\S]*?)```/g);
    if (!codeBlocks || codeBlocks.length === 0) return;
    if (state.planMode) {
      console.log(`${C.dim}(Plan mode — no files changed. Turn off with /plan off)${C.reset}\n`);
      return;
    }

    for (const block of codeBlocks) {
      const match = block.match(/```(\w+)\s*\n\/\/\s*(?:filepath:|file:)?\s*(.+?)\n([\s\S]*?)```/);
      if (!match) continue;

      const [, lang, filepath, content] = match;
      const resolved = path.resolve(cwd, filepath.trim());
      const fileExists = fs.existsSync(resolved);

      if (fileExists) {
        // Check if content is actually different
        const oldContent = fs.readFileSync(resolved, 'utf8');
        if (oldContent === content) continue;

        const relPath = path.relative(cwd, resolved);
        console.log(`${C.yellow}📝 ${relPath} ${C.reset}${C.dim}was modified by Stew${C.reset}`);

        // Show diff
        const d = diff(oldContent, content);
        const dLines = d.split('\n').slice(0, 15);
        console.log(dLines.join('\n'));
        if (d.split('\n').length > 15) console.log(`${C.dim}... (${d.split('\n').length - 15} more lines)${C.reset}`);
        console.log('');

        // Auto-apply (with undo)
        state.undoStack.push({
          type: 'edit',
          path: resolved,
          oldContent,
          newContent: content,
        });
        fs.writeFileSync(resolved, content);
        console.log(`${C.green}✅ Applied to ${relPath}${C.reset} ${C.dim}(undo with /undo)${C.reset}\n`);
      } else {
        // New file — create directory if needed
        const dir = path.dirname(resolved);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        state.undoStack.push({
          type: 'create',
          path: resolved,
        });
        fs.writeFileSync(resolved, content);
        console.log(`${C.green}✅ Created ${path.relative(cwd, resolved)}${C.reset} ${C.dim}(undo with /undo)${C.reset}\n`);
      }
    }
  }

  async function extractAndOfferShellCommands(response, state) {
    // Find bash/shell code blocks
    const bashBlocks = response.match(/```(?:bash|sh|shell|zsh)\s*\n([\s\S]*?)```/g);
    if (!bashBlocks || state.planMode) return;

    for (const block of bashBlocks) {
      const match = block.match(/```(?:bash|sh|shell|zsh)\s*\n([\s\S]*?)```/);
      if (!match) continue;
      const cmd = match[1].trim();
      // Skip if it's inside a file code block (has filepath comment)
      if (cmd.startsWith('// filepath') || cmd.startsWith('// file:')) continue;
      // Skip trivial commands
      if (cmd.length < 3 || cmd.startsWith('#!')) continue;

      console.log(`${C.dim}💡 Run this? ${C.reset}${C.cyan}${cmd.slice(0, 80)}${cmd.length > 80 ? '...' : ''}${C.reset}`);
      console.log(`${C.dim}   Use ${C.reset}${C.bold}/run ${cmd}${C.reset}${C.dim} to execute${C.reset}\n`);
    }
  }

  async function handleSlashCommand(input, state, rl) {
    const parts = input.slice(1).split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    switch (cmd) {
      case 'help': case 'h': case '?':
        console.log(`\n${C.bold}Commands:${C.reset}`);
        for (const [name, desc] of SLASH_COMMANDS) {
          console.log(`  ${C.cyan}${name.padEnd(22)}${C.reset} ${C.dim}${desc}${C.reset}`);
        }
        console.log('');
        break;

      case 'files': case 'ls':
        const pattern = args || '**/*';
        const files = listFiles(cwd, pattern, { maxDepth: 5 });
        if (files.length === 0) {
          console.log(`${C.dim}No files matching ${pattern}${C.reset}`);
        } else {
          console.log(`\n${C.bold}Files (${files.length})${C.reset}:`);
          for (const f of files.slice(0, 50)) {
            console.log(`  ${C.dim}${f}${C.reset}`);
          }
          if (files.length > 50) console.log(`${C.dim}  ... and ${files.length - 50} more${C.reset}`);
        }
        console.log('');
        break;

      case 'read': case 'cat':
        if (!args) {
          console.log(`${C.red}Usage: /read <filepath>${C.reset}`);
          break;
        }
        const readPath = path.resolve(cwd, args);
        if (!fs.existsSync(readPath)) {
          console.log(`${C.red}File not found: ${args}${C.reset}`);
          break;
        }
        const { content: fileContent, truncated } = readFileSync(readPath);
        const lang = detectLang(args);
        console.log(`\n${C.bold}${args}${C.reset} ${C.dim}(${lang})${C.reset}`);
        console.log(C.dim + '─'.repeat(60) + C.reset);
        console.log(highlightCode(fileContent, lang));
        if (truncated) console.log(`${C.yellow}\n[...truncated]${C.reset}`);
        console.log(C.dim + '─'.repeat(60) + C.reset + '\n');
        // Also add to context
        state.messages.push({ role: 'user', content: `Read file ${args}:\n${fileContent}` });
        break;

      case 'clear': case 'reset':
        state.messages = [{ role: 'system', content: buildSystemPrompt() }];
        console.log(`${C.green}✅ Conversation cleared${C.reset}\n`);
        break;

      case 'model': case 'm':
        if (!args) {
          console.log(`\n${C.bold}Available models:${C.reset}`);
          for (const [id, desc] of MODELS) {
            const active = state.model === id ? C.green + '→ ' : '  ';
            console.log(`${active}${id.padEnd(20)} ${C.dim}${desc}${C.reset}`);
          }
          console.log('');
        } else {
          state.model = args;
          console.log(`${C.green}✅ Model set to: ${args}${C.reset}\n`);
        }
        break;

      case 'persona': case 'p':
        if (!args) {
          console.log(`\n${C.bold}Personas:${C.reset}`);
          for (const p of PERSONAS) {
            const active = state.persona === p ? C.green + '→ ' : '  ';
            console.log(`${active}${p}`);
          }
          console.log('');
        } else {
          state.persona = args;
          state.messages[0].content = buildSystemPrompt();
          console.log(`${C.green}✅ Persona set to: ${args}${C.reset}\n`);
        }
        break;

      case 'web': case 'search':
        if (args === 'on' || args === 'true' || args === '1') {
          state.webSearch = true;
          console.log(`${C.green}✅ Web search enabled${C.reset}\n`);
        } else if (args === 'off' || args === 'false' || args === '0') {
          state.webSearch = false;
          console.log(`${C.green}✅ Web search disabled${C.reset}\n`);
        } else {
          state.webSearch = !state.webSearch;
          console.log(`${C.cyan}Web search: ${state.webSearch ? 'on' : 'off'}${C.reset}\n`);
        }
        break;

      case 'plan':
        if (args === 'on' || args === 'true') {
          state.planMode = true;
          console.log(`${C.yellow}✅ Plan mode ON — Stew will suggest changes but won't apply them${C.reset}\n`);
        } else if (args === 'off' || args === 'false') {
          state.planMode = false;
          console.log(`${C.green}✅ Plan mode OFF — Stew will apply changes automatically${C.reset}\n`);
        } else {
          state.planMode = !state.planMode;
          console.log(`${C.cyan}Plan mode: ${state.planMode ? C.yellow + 'on (read-only)' : C.green + 'off (auto-apply)'}${C.reset}\n`);
        }
        break;

      case 'save':
        if (!args) {
          const defaultName = `session-${Date.now()}`;
          saveSession(defaultName, state.messages, { model: state.model, persona: state.persona });
          console.log(`${C.green}✅ Session saved as: ${defaultName}${C.reset}\n`);
        } else {
          saveSession(args, state.messages, { model: state.model, persona: state.persona });
          console.log(`${C.green}✅ Session saved as: ${args}${C.reset}\n`);
        }
        break;

      case 'load':
        if (!args) {
          console.log(`${C.red}Usage: /load <name>${C.reset}`);
          break;
        }
        const session = loadSession(args);
        if (session) {
          state.messages = session.messages;
          state.model = session.meta?.model || state.model;
          state.persona = session.meta?.persona || state.persona;
          console.log(`${C.green}✅ Loaded session: ${args} (${session.messages.length} messages)${C.reset}\n`);
        } else {
          console.log(`${C.red}Session not found: ${args}${C.reset}\n`);
        }
        break;

      case 'sessions': case 'ls-sessions':
        const sessions = listSessions();
        if (sessions.length === 0) {
          console.log(`${C.dim}No saved sessions${C.reset}\n`);
        } else {
          console.log(`\n${C.bold}Saved sessions:${C.reset}`);
          for (const s of sessions) {
            console.log(`  ${C.cyan}${s.name.padEnd(25)}${C.reset} ${C.dim}${s.messages} msgs · ${s.savedAt}${C.reset}`);
          }
          console.log('');
        }
        break;

      case 'git':
        if (!git.isGitRepo(cwd)) {
          console.log(`${C.red}Not a git repo${C.reset}\n`);
          break;
        }
        const subCmd = parts[1]?.toLowerCase() || 'status';
        if (subCmd === 'status' || subCmd === 'st') {
          const gs = git.status(cwd);
          console.log(`\n${C.bold}Branch:${C.reset} ${C.cyan}${gs.branch}${C.reset}`);
          console.log(`${C.bold}Changes:${C.reset} ${gs.changes.length > 0 ? C.yellow + gs.changes.length : C.green + '0'}${C.reset}`);
          for (const c of gs.changes) {
            const status = c.slice(0, 2);
            const file = c.slice(3);
            const color = status.includes('M') ? C.yellow : status.includes('A') ? C.green : status.includes('D') ? C.red : C.cyan;
            console.log(`  ${color}${status}${C.reset} ${file}`);
          }
          console.log('');
        } else if (subCmd === 'diff') {
          const d = git.diff(cwd, parts[2] === '--staged');
          if (d) {
            console.log(d);
          } else {
            console.log(`${C.green}No changes${C.reset}`);
          }
          console.log('');
        } else if (subCmd === 'log') {
          const l = git.log(cwd, parseInt(parts[2]) || 10);
          console.log(l || 'No commits');
          console.log('');
        } else if (subCmd === 'commit') {
          const msg = parts.slice(2).join(' ');
          if (!msg) {
            console.log(`${C.red}Usage: /git commit <message>${C.reset}`);
            break;
          }
          git.addAll(cwd);
          const result = git.commit(msg, cwd);
          if (result.ok) {
            console.log(`${C.green}✅ Committed: ${msg}${C.reset}`);
          } else {
            console.log(`${C.red}❌ ${result.output}${C.reset}`);
          }
          console.log('');
        }
        break;

      case 'run': case 'exec': case '$':
        if (!args) {
          console.log(`${C.red}Usage: /run <command>${C.reset}\n`);
          break;
        }
        console.log(`${C.dim}$ ${args}${C.reset}`);
        try {
          const { execSync } = require('child_process');
          const output = execSync(args, { cwd, encoding: 'utf8', timeout: 30000, stdio: 'pipe' });
          console.log(output || C.dim + '(no output)' + C.reset);
        } catch (err) {
          console.log(`${C.red}${err.stderr || err.stdout || err.message}${C.reset}`);
        }
        console.log('');
        break;

      case 'undo':
        const action = state.undoStack.pop();
        if (!action) {
          console.log(`${C.dim}Nothing to undo${C.reset}\n`);
          break;
        }
        if (action.type === 'edit') {
          fs.writeFileSync(action.path, action.oldContent);
          console.log(`${C.green}✅ Reverted ${path.relative(cwd, action.path)}${C.reset}\n`);
        } else if (action.type === 'create') {
          fs.unlinkSync(action.path);
          console.log(`${C.green}✅ Deleted ${path.relative(cwd, action.path)}${C.reset}\n`);
        }
        break;

      case 'diff':
        if (!args) {
          console.log(`${C.red}Usage: /diff <filepath>${C.reset}\n`);
          break;
        }
        const diffPath = path.resolve(cwd, args);
        if (!fs.existsSync(diffPath)) {
          console.log(`${C.red}File not found: ${args}${C.reset}\n`);
          break;
        }
        if (git.isGitRepo(cwd)) {
          const d = git.diff(cwd);
          // Filter for the specific file
          const fileDiff = d.split('diff --git').find(b => b.includes(args));
          if (fileDiff) {
            console.log('diff --git' + fileDiff);
          } else {
            console.log(`${C.green}No git changes for ${args}${C.reset}`);
          }
        } else {
          console.log(`${C.dim}Not a git repo — showing current content:${C.reset}`);
          const { content: c } = readFileSync(diffPath);
          console.log(c);
        }
        console.log('');
        break;

      case 'exit': case 'quit': case 'q':
        console.log(`\n${C.dim}Goodbye! 👋${C.reset}\n`);
        process.exit(0);
        break;

      case 'status':
        // Show current state
        console.log(`\n${C.bold}Stew Code Status${C.reset}`);
        console.log(`  Model: ${C.cyan}${state.model}${C.reset}`);
        console.log(`  Persona: ${C.cyan}${state.persona}${C.reset}`);
        console.log(`  Web search: ${state.webSearch ? C.green + 'on' : C.gray + 'off'}${C.reset}`);
        console.log(`  Plan mode: ${state.planMode ? C.yellow + 'on' : C.gray + 'off'}${C.reset}`);
        console.log(`  Messages: ${state.messages.length}`);
        console.log(`  Undo stack: ${state.undoStack.stack.length}`);
        console.log(`  Project: ${C.dim}${projCtx.root}${C.reset} (${projCtx.type})`);
        if (git.isGitRepo(cwd)) {
          const gs = git.status(cwd);
          console.log(`  Git: ${C.cyan}${gs.branch}${C.reset} ${gs.changes.length > 0 ? C.yellow + `(${gs.changes.length} changes)` : C.green + '(clean)'}${C.reset}`);
        }
        console.log('');
        break;

      case 'debug':
        state.debugMode = !state.debugMode;
        console.log(`${C.cyan}Debug mode: ${state.debugMode ? 'on' : 'off'}${C.reset}\n`);
        break;

      default:
        console.log(`${C.red}Unknown command: /${cmd}${C.reset} ${C.dim}(try /help)${C.reset}\n`);
        break;
    }
  }
}

module.exports = { codeCommand };
