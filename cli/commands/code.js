const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const readline = require('readline');
const { getApiKey } = require('../utils/config');
const { StewClient } = require('../../lib/client');
const { streamChatCompletion } = require('../../lib/stream');
const { readFileSync, listFiles, projectContext, diff, UndoStack } = require('../utils/files');
const git = require('../utils/git');
const { saveSession, loadSession, listSessions, deleteSession } = require('../utils/session');
const { BUILTIN_SKILLS, listSkills, runSkill, forgeSkill, deleteSkill } = require('../utils/skill-forge');
const mascot = require('../utils/mascot');
const adv = require('../utils/advanced');

var C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', italic: '\x1b[3m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
  gray: '\x1b[90m', white: '\x1b[37m',
};

var MODELS = [
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

var PERSONAS = [
  'default', 'business', 'doctor', 'lawyer', 'teacher',
  'developer', 'therapist', 'coach', 'nutritionist',
  'financial_advisor', 'researcher', 'creative',
];

var SLASH_COMMANDS = [
  ['/help', 'Show all commands'],
  ['/files [pattern]', 'List project files'],
  ['/read <file>', 'Read a file'],
  ['/clear', 'Clear conversation'],
  ['/model [name]', 'Show/set model'],
  ['/persona [name]', 'Show/set persona'],
  ['/web [on|off]', 'Toggle web search'],
  ['/plan [on|off]', 'Plan mode'],
  ['/skill <name> [args]', 'Run a skill'],
  ['/skills', 'List all skills'],
  ['/forge <name> <desc>', 'Create a new skill'],
  ['/unforge <name>', 'Delete a custom skill'],
  ['/agent <task>', 'Autonomous mode'],
  ['/marathon <goal> [-h N]', 'Run for hours — checkpointed'],
  ['/save <name>', 'Save session'],
  ['/load <name>', 'Load session'],
  ['/sessions', 'List sessions'],
  ['/git <sub>', 'Git: status|diff|log|commit'],
  ['/run <cmd>', 'Execute shell command'],
  ['/undo', 'Undo last change'],
  ['/diff <file>', 'Show diff'],
  ['/status', 'Show state'],
  ['/build <prompt>', 'Build an app from a prompt'],
  ['/explain <question>', 'Ask how the codebase works'],
  ['/review [file]', 'AI code review'],
  ['/swarm <task>', 'Multi-agent team build'],
  ['/changelog', 'Generate CHANGELOG.md'],
  ['/sh <cmd>', 'Run a shell command'],
  ['/fix', 'Auto-fix all errors in the project'],
  ['/test', 'Run tests + auto-fix'],
  ['/doc', 'Generate README.md from your code'],
  ['/exit', 'Exit'],
];

async function codeCommand(args) {
  var apiKey = getApiKey();
  if (!apiKey && !process.env.STEW_API_KEY) {
    console.log(C.red + 'No API key found.' + C.reset + ' Run: ' + C.bold + 'stew login <your_api_key>' + C.reset);
    console.log(C.dim + 'Get a free key at https://stew-agent.onrender.com' + C.reset + '\n');
    process.exit(1);
  }

  var client = new StewClient({ apiKey });
  var cwd = process.cwd();

  var state = { sessionFiles: {},
    messages: [],
    model: 'stew-default',
    persona: 'developer',
    webSearch: false,
    planMode: false,
    undoStack: new UndoStack(),
    projectCtx: null,
    streaming: true,
    filesChanged: 0,
    skillsForged: 0,
  };

  var projCtx = projectContext(cwd);
  state.projectCtx = projCtx;

  function buildSystemPrompt() {
    var prompt = 'You are Stew Code, the most powerful AI coding agent for the terminal. You help developers write, debug, refactor, test, deploy, and understand code.\n\n';
    prompt += 'CAPABILITIES: read/write files, run shell commands, web search, generate code/tests/docs, debug, explain, Skill Forge, autonomous tasks, scaffolding, Dockerfile/CI, security audit.\n\n';
    prompt += 'CURRENT PROJECT:\n';
    prompt += '- Directory: ' + projCtx.root + '\n';
    prompt += '- Type: ' + projCtx.type + '\n';
    prompt += '- Files (' + (projCtx.stats.totalFiles || 0) + '): ' + projCtx.files.slice(0, 30).join(', ');
    if (projCtx.files.length > 30) prompt += '...';
    prompt += '\n\nPROJECT STRUCTURE:\n' + (projCtx.structure || '(empty)');

    if (projCtx.config) {
      for (var file in projCtx.config) {
        prompt += '\n\n--- ' + file + ' ---\n' + projCtx.config[file];
      }
    }

    var rulesPath = path.join(cwd, '.stew', 'rules');
    var stewMdPath = path.join(cwd, 'STEW.md');
    if (fs.existsSync(rulesPath)) {
      prompt += '\n\nPROJECT RULES (.stew/rules):\n' + fs.readFileSync(rulesPath, 'utf8').slice(0, 3000);
    }
    if (fs.existsSync(stewMdPath)) {
      prompt += '\n\nPROJECT RULES (STEW.md):\n' + fs.readFileSync(stewMdPath, 'utf8').slice(0, 3000);
    }
    var learned = adv.loadLearned();
    if (learned) prompt += '\n\nLEARNED FIXES (remember these):\n' + learned;

    prompt += '\n\nBEHAVIOR:\n';
    prompt += '1. Be concise and direct. Show code, not paragraphs.\n';
    prompt += '2. When suggesting file changes, use code blocks with filepath on first line:\n';
    prompt += '   ```lang filepath\n   // filepath: relative/path/to/file.js\n   code here\n   ```\n';
    prompt += '3. For shell commands, use: ```bash\ncommand here\n```\n';
    prompt += '4. Always explain what changed and why.\n';
    prompt += '5. In plan mode, do NOT write files — only explain what you would do.\n';
    prompt += '6. Match the project\'s existing code style.\n';
    prompt += '7. If you cannot do something, suggest using /forge to create a skill for it.\n';
    prompt += '8. Be proactive — suggest next steps after completing tasks.';

    if (state.persona !== 'default' && state.persona !== 'developer') {
      prompt += '\n\nPERSONA: ' + state.persona;
    }

    return prompt;
  }

  state.messages.push({ role: 'system', content: buildSystemPrompt() });

  console.log(mascot.bootBanner());

  var skillsList = listSkills();
  console.log(C.dim + '  Model: ' + C.reset + C.bold + state.model + C.reset +
    '  ' + C.dim + '·' + C.reset + '  ' + C.dim + 'Persona: ' + C.reset + C.bold + state.persona + C.reset +
    '  ' + C.dim + '·' + C.reset + '  ' + C.dim + 'Skills: ' + C.reset + C.bold + skillsList.total + C.reset);
  console.log(C.dim + '  Web: ' + C.reset + (state.webSearch ? C.green + 'on' : C.gray + 'off') + C.reset +
    '  ' + C.dim + '·' + C.reset + '  ' + C.dim + 'Plan: ' + C.reset + (state.planMode ? C.yellow + 'on' : C.gray + 'off') + C.reset +
    '  ' + C.dim + '·' + C.reset + '  ' + C.dim + 'Project: ' + C.reset + projCtx.type);

  if (git.isGitRepo(cwd)) {
    var gs = git.status(cwd);
    console.log(C.dim + '  Branch: ' + C.reset + C.cyan + gs.branch + C.reset +
      '  ' + C.dim + '·' + C.reset + '  ' + (gs.changes.length > 0 ? C.yellow + gs.changes.length + ' changes' : C.green + 'clean') + C.reset);
  }

  console.log(C.dim + '  Type a message, /help for commands, /skills for skills, @file to include files' + C.reset);
  console.log(C.dim + '  ' + '─'.repeat(60) + C.reset + '\n');

  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: C.cyan + C.bold + 'stew>' + C.reset + ' ',
  });

  var multilineBuffer = '';
  var inMultiline = false;

  rl.prompt();

  rl.on('line', async function(input) {
    var trimmed = input.trim();

    if (inMultiline) {
      if (trimmed === '```' || trimmed === '---') {
        inMultiline = false;
        var fullInput = multilineBuffer;
        multilineBuffer = '';
        if (fullInput.trim()) await processInput(fullInput);
        rl.prompt();
        return;
      }
      multilineBuffer += input + '\n';
      process.stdout.write(C.gray + '... ' + C.reset);
      return;
    }

    if (trimmed === '```' || trimmed === '---') {
      inMultiline = true;
      multilineBuffer = '';
      process.stdout.write(C.dim + 'Multi-line mode. Type ' + C.bold + '```' + C.reset + C.dim + ' or ' + C.bold + '---' + C.reset + C.dim + ' to finish' + C.reset + '\n');
      process.stdout.write(C.gray + '... ' + C.reset);
      return;
    }

    if (!trimmed) { rl.prompt(); return; }

    if (trimmed.startsWith('/')) {
      await handleSlashCommand(trimmed, state, rl);
      rl.prompt();
      return;
    }

    await processInput(trimmed);
    rl.prompt();
  });

  rl.on('close', function() {
    console.log('\n' + C.dim + 'Goodbye! 👋' + C.reset + '\n');
    process.exit(0);
  });

  async function processInput(input) {
    var expandedInput = input;
    var fileRefs = input.match(/@[\w\-\.\/]+/g);
    var fileContexts = '';

    if (fileRefs) {
      for (var i = 0; i < fileRefs.length; i++) {
        var filepath = fileRefs[i].slice(1);
        var resolved = path.resolve(cwd, filepath);
        if (fs.existsSync(resolved)) {
          try {
            var result = readFileSync(resolved);
            fileContexts += '\n\n--- File: ' + filepath + ' ---\n' + result.content + (result.truncated ? '\n[...truncated]' : '') + '\n';
            expandedInput = expandedInput.replace(fileRefs[i], '[file: ' + filepath + ']');
          } catch (e) {
            fileContexts += '\n--- File: ' + filepath + ' (could not read) ---\n';
          }
        }
      }
    }

    if (fileContexts) {
      state.messages.push({ role: 'user', content: 'Please review these files:\n' + fileContexts });
    }

    state.messages.push({ role: 'user', content: expandedInput });

    if (state.messages.length > 22) {
      var sysMsg = state.messages[0];
      state.messages = [sysMsg].concat(state.messages.slice(-20));
    }

    process.stdout.write(C.green + C.bold + 'stew' + C.reset + ' ' + C.dim + '>' + C.reset + ' ');

    var fullResponse = '';

    try {
      await streamChatCompletion(client, state.messages, {
        model: state.model,
        webSearch: state.webSearch,
        temperature: 0.7,
        onToken: function(token) {
          fullResponse += token;
          process.stdout.write(token);
        },
      });

      console.log('\n');
      state.messages.push({ role: 'assistant', content: fullResponse });

      await extractAndApplyChanges(fullResponse, state);

      suggestShellCommands(fullResponse, state);

    } catch (err) {
      process.stdout.write('\r' + ' '.repeat(50) + '\r');
      console.log(mascot.error());
      console.log(C.red + 'Error: ' + (err.message || err) + C.reset);
      if (err.suggestion) console.log(C.dim + 'Hint: ' + err.suggestion + C.reset);
      console.log('');
      if (state.messages[state.messages.length - 1] && state.messages[state.messages.length - 1].role === 'user') {
        state.messages.pop();
      }
    }
  }

  async function extractAndApplyChanges(response, state) {
    var codeBlocks = response.match(/```(\w+)\s*\n\/\/\s*(?:filepath:|file:)?\s*(.+?)\n([\s\S]*?)```/g);
    if (!codeBlocks || codeBlocks.length === 0) return;
    if (state.planMode) {
      console.log(C.dim + '(Plan mode — no files changed. /plan off to apply)' + C.reset + '\n');
      return;
    }

    for (var i = 0; i < codeBlocks.length; i++) {
      var match = codeBlocks[i].match(/```(\w+)\s*\n\/\/\s*(?:filepath:|file:)?\s*(.+?)\n([\s\S]*?)```/);
      if (!match) continue;

      var lang = match[1];
      var filepath = match[2].trim();
      var content = match[3];
      var resolved = path.resolve(cwd, filepath);
      var fileExists = fs.existsSync(resolved);

      if (fileExists) {
        var oldContent = fs.readFileSync(resolved, 'utf8');
        if (oldContent === content) continue;

        state.undoStack.push({ type: 'edit', path: resolved, oldContent: oldContent, newContent: content });
        fs.writeFileSync(resolved, content);
        console.log(C.green + 'Applied to ' + path.relative(cwd, resolved) + C.reset + C.dim + ' (/undo to revert)' + C.reset);
        state.filesChanged++;
      } else {
        var dir = path.dirname(resolved);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        state.undoStack.push({ type: 'create', path: resolved });
        fs.writeFileSync(resolved, content);
        console.log(C.green + 'Created ' + path.relative(cwd, resolved) + C.reset + C.dim + ' (/undo to revert)' + C.reset);
        state.filesChanged++;
      }
    }
    console.log('');
  }

  function suggestShellCommands(response, state) {
    var bashBlocks = response.match(/```(?:bash|sh|shell|zsh)\s*\n([\s\S]*?)```/g);
    if (!bashBlocks || state.planMode) return;

    for (var i = 0; i < bashBlocks.length; i++) {
      var match = bashBlocks[i].match(/```(?:bash|sh|shell|zsh)\s*\n([\s\S]*?)```/);
      if (!match) continue;
      var cmd = match[1].trim();
      if (cmd.indexOf('// filepath') === 0 || cmd.indexOf('// file:') === 0) continue;
      if (cmd.length < 3 || cmd.indexOf('#!') === 0) continue;

      console.log(C.dim + 'Run: ' + C.reset + C.cyan + cmd.slice(0, 80) + (cmd.length > 80 ? '...' : '') + C.reset);
      console.log(C.dim + '  Use /run ' + cmd + C.reset + '\n');
    }
  }

  async function handleSlashCommand(input, state, rl) {
    var parts = input.slice(1).split(/\s+/);
    var cmd = parts[0].toLowerCase();
    var args = parts.slice(1).join(' ');

    switch (cmd) {
      case 'help': case 'h': case '?':
        console.log('\n' + C.bold + 'Stew Code Commands:' + C.reset);
        for (var i = 0; i < SLASH_COMMANDS.length; i++) {
          console.log('  ' + C.cyan + SLASH_COMMANDS[i][0].padEnd(24) + C.reset + C.dim + SLASH_COMMANDS[i][1] + C.reset);
        }
        console.log('\n' + C.bold + 'Built-in Skills:' + C.reset);
        var skills = listSkills();
        skills.builtin.forEach(function(s) {
          console.log('  ' + C.magenta + ('/skill ' + s.name).padEnd(24) + C.reset + C.dim + s.description + C.reset);
        });
        console.log('');
        break;

      case 'files': case 'ls':
        var pattern = args || '**/*';
        var files = listFiles(cwd, pattern, { maxDepth: 5 });
        if (files.length === 0) {
          console.log(C.dim + 'No files matching ' + pattern + C.reset);
        } else {
          console.log('\n' + C.bold + 'Files (' + files.length + '):' + C.reset);
          for (var j = 0; j < Math.min(files.length, 50); j++) {
            console.log('  ' + C.dim + files[j] + C.reset);
          }
          if (files.length > 50) console.log(C.dim + '  ... and ' + (files.length - 50) + ' more' + C.reset);
        }
        console.log('');
        break;

      case 'read': case 'cat':
        if (!args) { console.log(C.red + 'Usage: /read <filepath>' + C.reset); break; }
        var readPath = path.resolve(cwd, args);
        if (!fs.existsSync(readPath)) { console.log(C.red + 'File not found: ' + args + C.reset); break; }
        var fc = readFileSync(readPath);

        console.log('\n' + C.bold + args + C.reset);
        console.log(C.dim + '─'.repeat(60) + C.reset);
        console.log(fc.content);
        if (fc.truncated) console.log(C.yellow + '\n[...truncated]' + C.reset);
        console.log(C.dim + '─'.repeat(60) + C.reset + '\n');
        state.messages.push({ role: 'user', content: 'Read file ' + args + ':\n' + fc.content });
        break;

      case 'clear': case 'reset':
        state.messages = [{ role: 'system', content: buildSystemPrompt() }];
        console.log(C.green + 'Conversation cleared' + C.reset + '\n');
        break;

      case 'model': case 'm':
        if (!args) {
          console.log('\n' + C.bold + 'Models:' + C.reset);
          for (var k = 0; k < MODELS.length; k++) {
            var active = state.model === MODELS[k][0] ? C.green + '→ ' : '  ';
            console.log(active + MODELS[k][0].padEnd(20) + C.dim + MODELS[k][1] + C.reset);
          }
        } else {
          state.model = args;
          console.log(C.green + 'Model: ' + args + C.reset + '\n');
        }
        break;

      case 'persona': case 'p':
        if (!args) {
          console.log('\n' + C.bold + 'Personas:' + C.reset);
          for (var m = 0; m < PERSONAS.length; m++) {
            var a = state.persona === PERSONAS[m] ? C.green + '→ ' : '  ';
            console.log(a + PERSONAS[m]);
          }
        } else {
          state.persona = args;
          state.messages[0].content = buildSystemPrompt();
          console.log(C.green + 'Persona: ' + args + C.reset + '\n');
        }
        break;

      case 'web': case 'search':
        if (args === 'on' || args === 'true' || args === '1') state.webSearch = true;
        else if (args === 'off' || args === 'false' || args === '0') state.webSearch = false;
        else state.webSearch = !state.webSearch;
        console.log(C.cyan + 'Web search: ' + (state.webSearch ? 'on' : 'off') + C.reset + '\n');
        break;

      case 'plan':
        if (args === 'on' || args === 'true') state.planMode = true;
        else if (args === 'off' || args === 'false') state.planMode = false;
        else state.planMode = !state.planMode;
        console.log(C.cyan + 'Plan mode: ' + (state.planMode ? C.yellow + 'on (read-only)' : C.green + 'off (auto-apply)') + C.reset + '\n');
        break;

      case 'skills': case 'skill-list':
        var sl = listSkills();
        console.log('\n' + C.bold + 'Stew Code Skills (' + sl.total + ' total)' + C.reset + '\n');
        console.log(C.bold + 'Built-in (' + sl.builtin.length + '):' + C.reset);
        sl.builtin.forEach(function(s) {
          console.log('  ' + C.magenta + s.name.padEnd(14) + C.reset + C.dim + s.description + C.reset);
        });
        if (sl.custom.length > 0) {
          console.log('\n' + C.bold + 'Custom (' + sl.custom.length + '):' + C.reset);
          sl.custom.forEach(function(s) {
            console.log('  ' + C.yellow + s.name.padEnd(14) + C.reset + C.dim + s.description + C.reset);
          });
        }
        console.log('\n' + C.dim + 'Use /skill <name> [args] to run a skill' + C.reset);
        console.log(C.dim + 'Use /forge <name> <description> to create a new skill' + C.reset + '\n');
        break;

      case 'skill':
        if (!args) { console.log(C.red + 'Usage: /skill <name> [args]' + C.reset + '\n'); break; }
        var skillParts = args.split(/\s+/);
        var skillName = skillParts[0];
        var skillArgs = skillParts.slice(1);
        console.log(C.dim + 'Running skill: ' + skillName + '...' + C.reset);
        var skillResult = runSkill(skillName, skillArgs, cwd);
        console.log('');
        console.log(skillResult.output || 'No output');
        console.log('');

        if (skillResult.needsAI && skillResult.prompt) {
          console.log(C.dim + 'Feeding to Stew AI...' + C.reset + '\n');
          await processInput(skillResult.prompt);
        }
        break;

      case 'forge':
        if (!args) { console.log(C.red + 'Usage: /forge <skill-name> <description>' + C.reset + '\n'); break; }
        var forgeParts = args.split(/\s+/);
        var forgeName = forgeParts[0];
        var forgeDesc = forgeParts.slice(1).join(' ');
        if (!forgeDesc) { console.log(C.red + 'Provide a description for the skill' + C.reset + '\n'); break; }
        var forged = forgeSkill(forgeName, forgeDesc);
        console.log(C.green + forged.output + C.reset + '\n');
        state.skillsForged++;
        break;

      case 'unforge':
        if (!args) { console.log(C.red + 'Usage: /unforge <skill-name>' + C.reset + '\n'); break; }
        var deleted = deleteSkill(args.trim());
        console.log((deleted.success ? C.green : C.red) + deleted.output + C.reset + '\n');
        break;

      case 'agent':
        if (!args) { console.log(C.red + 'Usage: /agent <task description>' + C.reset); console.log(C.dim + 'Example: /agent fix all TypeScript errors' + C.reset + '\n'); break; }
        var { runAgent } = require('../utils/agent-engine');
        await runAgent(client, args, cwd, { autoApply: !state.planMode });
        break;

      case 'marathon':
        if (!args) { console.log(C.red + 'Usage: /marathon <goal> [--hours N]' + C.reset); console.log(C.dim + 'Example: /marathon build a full REST API with auth and tests --hours 6' + C.reset + '\n'); break; }
        var marathonArgs = args.split(/\s+--hours\s+/);
        var marathonGoal = marathonArgs[0];
        var marathonHours = marathonArgs[1] ? parseFloat(marathonArgs[1]) : 4;
        var { runMarathon } = require('../utils/marathon');
        await runMarathon(client, marathonGoal, cwd, { maxHours: marathonHours });
        break;

      case 'save':
        var sessionName = args || ('session-' + Date.now());
        saveSession(sessionName, state.messages, { model: state.model, persona: state.persona });
        console.log(C.green + 'Saved: ' + sessionName + C.reset + '\n');
        break;

      case 'load':
        if (!args) { console.log(C.red + 'Usage: /load <name>' + C.reset); break; }
        var session = loadSession(args);
        if (session) {
          state.messages = session.messages;
          state.model = (session.meta && session.meta.model) || state.model;
          state.persona = (session.meta && session.meta.persona) || state.persona;
          console.log(C.green + 'Loaded: ' + args + ' (' + session.messages.length + ' messages)' + C.reset + '\n');
        } else {
          console.log(C.red + 'Session not found: ' + args + C.reset + '\n');
        }
        break;

      case 'sessions':
        var sessions = listSessions();
        if (sessions.length === 0) { console.log(C.dim + 'No saved sessions' + C.reset + '\n'); break; }
        console.log('\n' + C.bold + 'Sessions:' + C.reset);
        sessions.forEach(function(s) {
          console.log('  ' + C.cyan + s.name.padEnd(25) + C.reset + C.dim + s.messages + ' msgs · ' + s.savedAt + C.reset);
        });
        console.log('');
        break;

      case 'git':
        if (!git.isGitRepo(cwd)) { console.log(C.red + 'Not a git repo' + C.reset + '\n'); break; }
        var subCmd = parts[1] ? parts[1].toLowerCase() : 'status';
        if (subCmd === 'status' || subCmd === 'st') {
          var gs = git.status(cwd);
          console.log('\n' + C.bold + 'Branch:' + C.reset + ' ' + C.cyan + gs.branch + C.reset);
          console.log(C.bold + 'Changes:' + C.reset + ' ' + (gs.changes.length > 0 ? C.yellow + gs.changes.length : C.green + '0') + C.reset);
          gs.changes.forEach(function(c) {
            var st = c.slice(0, 2);
            var f = c.slice(3);
            var color = st.indexOf('M') !== -1 ? C.yellow : st.indexOf('A') !== -1 ? C.green : st.indexOf('D') !== -1 ? C.red : C.cyan;
            console.log('  ' + color + st + C.reset + ' ' + f);
          });
        } else if (subCmd === 'diff') {
          var d = git.diff(cwd, parts[2] === '--staged');
          console.log(d || C.green + 'No changes' + C.reset);
        } else if (subCmd === 'log') {
          var l = git.log(cwd, parseInt(parts[2]) || 10);
          console.log(l || 'No commits');
        } else if (subCmd === 'commit') {
          var msg = parts.slice(2).join(' ');
          if (!msg) { console.log(C.red + 'Usage: /git commit <message>' + C.reset); break; }
          git.addAll(cwd);
          var result = git.commit(msg, cwd);
          console.log(result.ok ? C.green + 'Committed: ' + msg + C.reset : C.red + result.output + C.reset);
        }
        console.log('');
        break;

      case 'run': case 'exec': case '$':
        if (!args) { console.log(C.red + 'Usage: /run <command>' + C.reset + '\n'); break; }
        console.log(C.dim + '$ ' + args + C.reset);
        try {
          var output = execSync(args, { cwd, encoding: 'utf8', timeout: 30000, stdio: 'pipe' });
          console.log(output || C.dim + '(no output)' + C.reset);
        } catch (err) {
          console.log(C.red + (err.stderr || err.stdout || err.message) + C.reset);
        }
        console.log('');
        break;

      case 'undo':
        var action = state.undoStack.pop();
        if (!action) { console.log(C.dim + 'Nothing to undo' + C.reset + '\n'); break; }
        if (action.type === 'edit') {
          fs.writeFileSync(action.path, action.oldContent);
          console.log(C.green + 'Reverted ' + path.relative(cwd, action.path) + C.reset + '\n');
        } else if (action.type === 'create') {
          fs.unlinkSync(action.path);
          console.log(C.green + 'Deleted ' + path.relative(cwd, action.path) + C.reset + '\n');
        }
        break;

      case 'diff':
        if (!args) { console.log(C.red + 'Usage: /diff <filepath>' + C.reset + '\n'); break; }
        var diffPath = path.resolve(cwd, args);
        if (!fs.existsSync(diffPath)) { console.log(C.red + 'File not found: ' + args + C.reset + '\n'); break; }
        if (git.isGitRepo(cwd)) {
          var gd = git.diff(cwd);
          var fileDiff = gd.split('diff --git').find(function(b) { return b.indexOf(args) !== -1; });
          console.log(fileDiff ? 'diff --git' + fileDiff : C.green + 'No git changes for ' + args + C.reset);
        } else {
          var dc = readFileSync(diffPath);
          console.log(dc.content);
        }
        console.log('');
        break;

      case 'status':
        console.log('\n' + C.bold + 'Stew Code Status' + C.reset);
        console.log('  Model: ' + C.cyan + state.model + C.reset);
        console.log('  Persona: ' + C.cyan + state.persona + C.reset);
        console.log('  Web search: ' + (state.webSearch ? C.green + 'on' : C.gray + 'off') + C.reset);
        console.log('  Plan mode: ' + (state.planMode ? C.yellow + 'on' : C.gray + 'off') + C.reset);
        console.log('  Messages: ' + state.messages.length);
        console.log('  Files changed: ' + state.filesChanged);
        console.log('  Skills forged: ' + state.skillsForged);
        console.log('  Undo stack: ' + state.undoStack.stack.length);
        console.log('  Project: ' + C.dim + projCtx.root + C.reset + ' (' + projCtx.type + ')');
        if (git.isGitRepo(cwd)) {
          var gss = git.status(cwd);
          console.log('  Git: ' + C.cyan + gss.branch + C.reset + ' ' + (gss.changes.length > 0 ? C.yellow + '(' + gss.changes.length + ' changes)' : C.green + '(clean)') + C.reset);
        }
        console.log('');
        break;

      case 'exit': case 'quit': case 'q':
        if (state.filesChanged > 0 || state.skillsForged > 0) {
          console.log(C.dim + 'Session: ' + state.filesChanged + ' files changed, ' + state.skillsForged + ' skills forged.' + C.reset);
        }
        console.log('\n' + C.dim + 'Goodbye! 👋' + C.reset + '\n');
        process.exit(0);
        break;


      case 'scan': case 'security': case 'sec':
        var target = args || '.';
        console.log(C.dim + '  Scanning ' + target + '...' + C.reset);
        var scanResults = adv.scan(target);
        if (scanResults.error) { console.log(C.red + '  ' + scanResults.error + C.reset + '\n'); break; }
        if (!scanResults.length) { console.log(C.green + '  No threats found in ' + target + C.reset + '\n'); break; }
        for (var sr of scanResults) {
          var sc = sr.threatLevel === 'CRITICAL' ? C.red : sr.threatLevel === 'HIGH' ? C.red : sr.threatLevel === 'MEDIUM' ? C.yellow : C.cyan;
          console.log(sc + '  [' + sr.threatLevel + '] ' + sr.file.replace(cwd + '/', '') + ' (score: ' + sr.score + ')' + C.reset);
          for (var f of sr.findings) console.log(C.dim + '    - ' + f.issue + ' (' + f.count + 'x)' + C.reset);
        }
        var totalScore = scanResults.reduce(function(s, r) { return s + r.score; }, 0);
        console.log('\n' + C.bold + '  Total threat score: ' + totalScore + C.reset + (totalScore >= 20 ? C.red + ' CRITICAL' : totalScore >= 10 ? C.yellow + ' HIGH' : C.green + ' LOW') + C.reset + '\n');
        break;

      case 'verify': case 'check':
        if (!state.filesChanged) { console.log(C.dim + '  No files changed this session.' + C.reset + '\n'); break; }
        var verifyResults = adv.verifySession(state.sessionFiles || {});
        var passCount = verifyResults.filter(function(r) { return r.pass; }).length;
        console.log(C.bold + '  Verification: ' + passCount + '/' + verifyResults.length + ' passed' + C.reset + '\n');
        for (var vr of verifyResults) {
          console.log((vr.pass ? C.green + '  ✓ ' : C.red + '  ✗ ') + vr.file + C.reset);
          if (vr.issues.length) for (var iss of vr.issues) console.log(C.dim + '    - ' + iss + C.reset);
        }
        console.log('');
        break;

      case 'setup': case 'init': case 'env':
        var setupType = args || 'vscode';
        var vscodeDir = path.join(cwd, '.vscode');
        fs.mkdirSync(vscodeDir, { recursive: true });
        if (setupType === 'vscode' || setupType === 'code') {
          var vs = {
            'settings.json': { 'editor.fontSize': 14, 'editor.tabSize': 2, 'editor.formatOnSave': true, 'editor.minimap.enabled': false, 'editor.wordWrap': 'on', 'files.autoSave': 'afterDelay', 'workbench.colorTheme': 'Default Dark+' },
            'launch.json': { version: '0.2.0', configurations: [{ type: 'node', request: 'launch', name: 'Debug', program: '${workspaceFolder}/index.js' }] },
            'tasks.json': { version: '2.0.0', tasks: [{ label: 'Build', type: 'shell', command: 'npm run build', group: { kind: 'build', isDefault: true } }, { label: 'Test', type: 'shell', command: 'npm test' }, { label: 'Serve', type: 'shell', command: 'npm start' }] },
            'extensions.json': { recommendations: ['esbenp.prettier-vscode', 'dbaeumer.vscode-eslint', 'bradlc.vscode-tailwindcss'] }
          };
          for (var vf in vs) fs.writeFileSync(path.join(vscodeDir, vf), JSON.stringify(vs[vf], null, 2));
          console.log(C.green + '  .vscode/ created (4 files)' + C.reset + '\n');
        }
        if (setupType === 'all') {
          fs.writeFileSync(path.join(cwd, '.editorconfig'), 'root = true\n\n[*]\ncharset = utf-8\nend_of_line = lf\nindent_size = 2\nindent_style = space\ninsert_final_newline = true\n');
          console.log(C.green + '  .editorconfig created' + C.reset + '\n');
        }
        break;

      case 'install': case 'i':
        if (!args) { console.log(C.red + 'Usage: /install <package>' + C.reset + '\n'); break; }
        try { execSync('npm install ' + args, { cwd: cwd, stdio: 'inherit' }); console.log(C.green + '  Installed: ' + args + C.reset + '\n'); }
        catch(e) { console.log(C.red + '  Failed: ' + e.message + C.reset + '\n'); }
        break;

      case 'clone':
        if (!args) { console.log(C.red + 'Usage: /clone <url>' + C.reset + '\n'); break; }
        try { execSync('git clone ' + args, { cwd: cwd, stdio: 'inherit' }); console.log(C.green + '  Cloned: ' + args + C.reset + '\n'); }
        catch(e) { console.log(C.red + '  Clone failed: ' + C.message + C.reset + '\n'); }
        break;

      case 'serve': case 'server':
        var port = args || '3000';
        try { execSync('npx serve -l ' + port + ' .', { cwd: cwd, stdio: 'inherit' }); }
        catch(e) { console.log(C.red + '  Try: npm i -g serve' + C.reset + '\n'); }
        break;

      case 'deploy':
        var target = args || 'vercel';
        console.log(C.dim + '  Deploying...' + C.reset);
        try { execSync(target === 'vercel' ? 'npx vercel --prod' : target === 'render' ? 'render deploy' : target + ' deploy', { cwd: cwd, stdio: 'inherit' }); }
        catch(e) { console.log(C.red + '  Failed: ' + e.message + C.reset + '\n'); }
        break;

      case 'build': case 'app':
        if (!args) { console.log(C.red + 'Usage: /build <what to build>' + C.reset + '\n' + C.dim + '  e.g. /build a todo app with express and sqlite' + C.reset + '\n'); break; }
        console.log(C.bold + C.cyan + '  🍲 Stew Builder — prompt to finished app' + C.reset);
        console.log(C.dim + '  Plan → generate → verify → fix → install → git' + C.reset + '\n');
        try {
          var bres = await adv.buildApp(args, client, { cwd: cwd, model: state.model });
          if (bres.error) { console.log(C.red + '  ' + bres.error + C.reset + '\n'); break; }
          console.log(C.bold + C.green + '  ✓ Build complete!' + C.reset);
          console.log(C.dim + '  Project: ' + bres.name + '/' + C.reset);
          for (var bf of bres.files) console.log(C.green + '    ✓ ' + bf + C.reset);
          for (var bff of bres.failed) console.log(C.yellow + '    ! ' + bff + ' (still has issues)' + C.reset);
          if (bres.fixed) console.log(C.dim + '    Auto-fixed ' + bres.fixed + ' issue(s)' + C.reset);
          for (var bt of bres.threats) console.log(C.yellow + '    ⚠ security: ' + bt + C.reset);
          console.log('\n' + C.bold + '  Run it:' + C.reset + '  cd ' + bres.name + ' && ' + bres.run + '\n');
        } catch (be) { console.log(C.red + '  Build failed: ' + be.message + C.reset + '\n'); }
        break;

      case 'fix': case 'heal': case 'selfheal':
        console.log(C.cyan + '  🔧 Auto-fixing project...' + C.reset);
        try {
          var fres = await adv.fixProject(client, { cwd: cwd, model: state.model });
          console.log(fres.fixed.length ? C.green + '  ✓ Fixed ' + fres.fixed.length + ' file(s): ' + fres.fixed.join(', ') + C.reset : C.dim + '  No fixable errors found.' + C.reset);
          for (var fe of fres.remaining) console.log(C.yellow + '  ! Could not fix: ' + fe + C.reset);
          console.log('');
        } catch (fxe) { console.log(C.red + '  Fix failed: ' + fxe.message + C.reset + '\n'); }
        break;

      case 'test':
        console.log(C.cyan + '  🧪 Running tests with auto-fix...' + C.reset);
        try {
          var tres = await adv.testProject(client, { cwd: cwd, model: state.model });
          console.log(tres.pass ? C.green + '  ✓ All tests passed' + C.reset : C.yellow + '  Tests still failing after ' + tres.rounds + ' fix round(s)' + C.reset);
          console.log('');
        } catch (te) { console.log(C.red + '  Test failed: ' + te.message + C.reset + '\n'); }
        break;

      case 'doc': case 'docs':
        console.log(C.cyan + '  📝 Generating README.md...' + C.reset);
        try {
          var dres = await adv.genDocs(client, { cwd: cwd, model: state.model });
          console.log(dres.error ? C.red + '  ' + dres.error + C.reset : C.green + '  ✓ ' + dres + C.reset + '\n');
        } catch (de) { console.log(C.red + '  Doc failed: ' + de.message + C.reset + '\n'); }
        break;

      default:
        var skillCheck = runSkill(cmd, parts.slice(1), cwd);
        if (skillCheck.success || skillCheck.output !== ('Skill not found: ' + cmd + '. Use /skills to see available skills or /forge to create one.')) {
          console.log(skillCheck.output + '\n');
        } else {
          console.log(C.red + 'Unknown command: /' + cmd + C.reset + ' ' + C.dim + '(try /help)' + C.reset + '\n');
        }
        break;
    }
  }
}

module.exports = { codeCommand };
