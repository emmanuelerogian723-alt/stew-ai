const fs = require('fs');
const { execSync, exec } = require('child_process');
const path = require('path');
const readline = require('readline');
const { getApiKey } = require('../utils/config');
const { StewClient } = require('../../lib/client');
const { streamChatCompletion } = require('../../lib/stream');
const git = require('../utils/files');
const { readFileSync, listFiles, projectContext, diff, UndoStack, saveSession, loadSession, listSessions, deleteSession } = git;
const { BUILTIN_SKILLS, listSkills, runSkill, forgeSkill, deleteSkill } = require('../utils/skill-forge');
const mascot = require('../utils/mascot');
const adv = require('../utils/advanced');
const mcp = require('../utils/mcp');
const A = require('../utils/automation');
const { scrape } = require('../utils/scraper');
const PKG = require('../../package.json');

var C = require('../utils/output').C;

var MODELS = [
  ['stew-default', 'Auto'], ['stew-fast', 'Fast'], ['stew-mistral', 'Mistral'],
  ['stew-nvidia', 'NVIDIA'], ['stew-openrouter', 'OpenRouter'], ['stew-hf', 'HF'],
  ['stew-openai', 'OpenAI'], ['gpt-4o', 'GPT-4o'], ['gpt-4o-mini', 'GPT-4o mini'],
];

var PERSONAS = [
  'default', 'business', 'doctor', 'lawyer', 'teacher',
  'developer', 'therapist', 'coach', 'nutritionist',
  'financial_advisor', 'researcher', 'creative',
];

var SLASH_COMMANDS = [
  ['/help', 'All commands'],
  ['/files [pattern]', 'Files'],
  ['/read <file>', 'Read a file'],
  ['/clear', 'Clear conversation'],
  ['/model [name]', 'Model'],
  ['/persona [name]', 'Persona'],
  ['/web [on|off]', 'Web search'],
  ['/plan [on|off]', 'Plan mode'],
  ['/skill <name> [args]', 'Run a skill'],
  ['/skills', 'List skills'],
  ['/forge <name> <desc>', 'New skill'],
  ['/unforge <name>', 'Remove skill'],
  ['/agent <task>', 'Autonomous build'],
  ['/marathon <g> [-h N]', 'Long-run+ckpt'],
  ['/save <name>', 'Save session'],
  ['/load <name>', 'Load session'],
  ['/sessions', 'Sessions'],
  ['/git <sub>', 'Git ops'],
  ['/run <cmd>', 'Shell command'],
  ['/undo', 'Revert last write'],
  ['/diff <file>', 'Show diff'],
  ['/status', 'State'],
  ['/build <prompt>', 'Build app'],
  ['/explain <q>', 'Codebase Q&A'],
  ['/review [f]', 'AI review'],
  ['/swarm <task>', 'Agent team'],
  ['/changelog', 'Gen CHANGELOG'],
  ['/voice [on|off]', 'Speak replies'],
  ['/image <path> [q]', 'Vision'],
  ['/mcp <sub>', 'MCP'],
  ['/sh <cmd>', 'Guarded shell'],
  ['/browse <sub>', 'Web automation'],
  ['/screenshot [url]', 'Page/screen shot'],
  ['/record <secs>', 'Screen recording'],
  ['/sysinfo', 'Environment report'],
  ['/fix', 'Autofix'],
  ['/test', 'Tests+fix'],
  ['/doc', 'Gen README'],
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

  var state = { sessionFiles: {}, voice: false,
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
    var prompt = 'You are Stew Code, an AI coding agent for the terminal. You write, debug, refactor, test, deploy, and explain code.\n\n';
    prompt += 'CAPABILITIES: files, shell, web search, tests/docs, debug, skills, autonomous tasks, CI, security audit.\n\n';
    prompt += 'PROJECT:\n- Dir: ' + projCtx.root + '\n- Type: ' + projCtx.type + '\n- Files (' + (projCtx.stats.totalFiles || 0) + '): ' +
      projCtx.files.slice(0, 30).join(', ') + (projCtx.files.length > 30 ? '...' : '') + '\n\nSTRUCTURE:\n' + (projCtx.structure || '(empty)');

    if (projCtx.config) {
      for (var file in projCtx.config) {
        prompt += '\n\n--- ' + file + ' ---\n' + projCtx.config[file];
      }
    }

    var rulesPath = path.join(cwd, '.stew', 'rules');
    var stewMdPath = path.join(cwd, 'STEW.md');
    if (fs.existsSync(rulesPath)) {
      prompt += '\n\nRULES:\n' + fs.readFileSync(rulesPath, 'utf8').slice(0, 3000);
    }
    if (fs.existsSync(stewMdPath)) {
      prompt += '\n\nSTEW.md RULES:\n' + fs.readFileSync(stewMdPath, 'utf8').slice(0, 3000);
    }
    var mcpServers = Object.keys(mcp.mcpConfig());
    if (mcpServers.length) prompt += '\n\nMCP SERVERS (run via /mcp run): ' + mcpServers.join(', ');
    var learned = adv.loadLearned();
    if (learned) prompt += '\n\nLEARNED FIXES:\n' + learned;

    prompt += '\n\nBEHAVIOR:\n1. Be concise — show code, not paragraphs.\n2. File changes: code block w/ filepath on first line, e.g. ```lang filepath\n// filepath: path/file.js\ncode\n```\n3. Shell: ```bash\ncmd\n```\n4. Explain what changed and why.\n5. Plan mode: do NOT write files, only explain.\n6. Match existing code style.\n7. Proactively suggest next steps.';

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

  console.log(C.dim + '  /help commands · /skills skills · @file include file' + C.reset);
  console.log(C.dim + '  ' + '─'.repeat(60) + C.reset + '\n');

  fetch('https://registry.npmjs.org/-/package/stew-ai/dist-tags').then(function (r) { return r.json(); }).then(function (d) {
    if (d && d.latest && d.latest !== PKG.version) console.log(C.yellow + '  Update available: stew-ai ' + d.latest + ' → npm i -g stew-ai' + C.reset + '\n');
  }).catch(function () {});

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

    var urlRefs = input.match(/https?:\/\/[^\s)>\]"']+/g);
    for (var u = 0; urlRefs && u < Math.min(urlRefs.length, 2); u++) {
      try {
        var page = await scrape(urlRefs[u], { timeout: 12000 });
        fileContexts += page.ok ? '\n\n--- ' + page.url + ' (' + page.title + ') ---\n' + page.text.slice(0, 4000) + '\n' : '\n\n--- ' + urlRefs[u] + ' fetch failed: ' + (page.error || page.status) + ' ---\n';
      } catch (e) { fileContexts += '\n\n--- ' + urlRefs[u] + ' fetch failed: ' + e.message + ' ---\n'; }
    }

    if (fileContexts) {
      state.messages.push({ role: 'user', content: 'Additional context:\n' + fileContexts });
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
      if (state.voice) speak(fullResponse);

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

  function speak(text) {
    var clean = text.replace(/```[\s\S]*?```/g, ' code block ').replace(/[*_#`>|]/g, '').replace(/\s+/g, ' ').slice(0, 400);
    if (!clean) return;
    var p = process.platform;
    var cmd = p === 'darwin' ? 'say ' + JSON.stringify(clean)
      : p === 'win32' ? 'powershell -c "(New-Object -ComObject SAPI.SpVoice).Speak(\'' + clean.replace(/'/g, '') + '\')"'
      : 'espeak ' + JSON.stringify(clean) + ' 2>/dev/null || spd-say ' + JSON.stringify(clean) + ' 2>/dev/null';
    exec(cmd, function () {});
  }

  async function extractAndApplyChanges(response, state) {
    var codeBlocks = response.match(/```(\w+)\s*\n\/\/\s*(?:filepath:|file:)?\s*(.+?)\n([\s\S]*?)```/g);
    if (!codeBlocks || codeBlocks.length === 0) return;
    if (state.planMode) {
      console.log(C.dim + 'Plan mode. /plan off to apply' + C.reset + '\n');
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

      console.log(C.dim + '/run ' + cmd.slice(0, 90) + C.reset + '\n');
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
        skills.builtins.forEach(function(s) {
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
        if (!args) { console.log(C.red + 'Usage: /read <file>' + C.reset); break; }
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
        console.log(C.bold + 'Built-in (' + sl.builtins.length + '):' + C.reset);
        sl.builtins.forEach(function(s) {
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
        if (!args) { console.log(C.red + 'Usage: /skill <name>' + C.reset + '\n'); break; }
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
        if (!args) { console.log(C.red + 'Usage: /forge <name> <desc>' + C.reset + '\n'); break; }
        var forgeParts = args.split(/\s+/);
        var forgeName = forgeParts[0];
        var forgeDesc = forgeParts.slice(1).join(' ');
        if (!forgeDesc) { console.log(C.red + 'Provide a description for the skill' + C.reset + '\n'); break; }
        var forged = forgeSkill(forgeName, forgeDesc);
        console.log(C.green + forged.output + C.reset + '\n');
        state.skillsForged++;
        break;

      case 'unforge':
        if (!args) { console.log(C.red + 'Usage: /unforge <name>' + C.reset + '\n'); break; }
        var deleted = deleteSkill(args.trim());
        console.log((deleted.success ? C.green : C.red) + deleted.output + C.reset + '\n');
        break;

      case 'agent':
        if (!args) { console.log(C.red + 'Usage: /agent <task>' + C.reset); console.log(C.dim + 'Example: /agent fix all TS errors' + C.reset + '\n'); break; }
        var { runAgent } = require('../utils/agent-engine');
        await runAgent(client, args, cwd, { autoApply: !state.planMode });
        break;

      case 'marathon':
        if (!args) { console.log(C.red + 'Usage: /marathon <goal> [-h N]' + C.reset); console.log(C.dim + 'Example: /marathon build a REST API with auth --hours 6' + C.reset + '\n'); break; }
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
        if (!args) { console.log(C.red + 'Usage: /diff <file>' + C.reset + '\n'); break; }
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
        if (!args) { console.log(C.red + 'Usage: /install <pkg>' + C.reset + '\n'); break; }
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
        if (!args) { console.log(C.red + 'Usage: /build <what to build>' + C.reset + '\n' + C.dim + '  e.g. /build a todo app w/ express + sqlite' + C.reset + '\n'); break; }
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

      case 'create': case 'new': {
        if (!args) { console.log(C.yellow + '  /create <template> [name]' + C.reset + '\n'); break; }
        var r = runSkill('scaffold', [parts[2] || 'new-project', (parts[1] || 'node').toLowerCase()], cwd);
        console.log((r.success ? C.green : C.red) + '  ' + r.output + C.reset + '\n');
        break;
      }

      case 'explain': case 'why': case 'how': {
        if (!args) { console.log(C.yellow + '  /explain <question>' + C.reset + '\n'); break; }
        console.log(C.cyan + '  Mapping codebase...' + C.reset);
        try {
          var ans = await adv.explainCodebase(client, args, cwd);
          console.log('\n' + ans + '\n');
        } catch (ee) { console.log(C.red + '  ' + (ee.message || ee) + C.reset + '\n'); }
        break;
      }

      case 'review': {
        console.log(C.cyan + '  Reviewing code...' + C.reset);
        try {
          var revFiles = parts.length > 1 ? [args] : null;
          var reviews = await adv.reviewCode(client, cwd, { files: revFiles });
          if (!reviews.length) { console.log(C.dim + '  No files to review.' + C.reset + '\n'); break; }
          reviews.forEach(function (rv) {
            console.log('\n' + C.bold + '  ' + rv.file + C.reset + (rv.flagged ? C.yellow + '  (security: ' + rv.flagged + ')' + C.reset : ''));
            console.log('  ' + C.dim + rv.review.split('\n').join('\n  ') + C.reset);
          });
          console.log('');
        } catch (re) { console.log(C.red + '  ' + (re.message || re) + C.reset + '\n'); }
        break;
      }

      case 'swarm': case 'team': {
        if (!args) { console.log(C.yellow + '  /swarm <task>' + C.reset + '\n'); break; }
        console.log(C.bold + '  Swarm Mode engaged.' + C.reset);
        try {
          var swarmRes = await adv.runSwarm(client, args, cwd, { log: function (m) { console.log(C.magenta + '  ' + m + C.reset); } });
          console.log(C.green + '  Done. ' + swarmRes.written.length + ' files written by ' + swarmRes.roles.join(', ') + '.' + C.reset);
          if (swarmRes.failed.length) console.log(C.yellow + '  Auto-fix attempted on: ' + swarmRes.failed.join(', ') + C.reset);
          console.log('');
        } catch (se) { console.log(C.red + '  Swarm failed: ' + (se.message || se) + C.reset + '\n'); }
        break;
      }

      case 'changelog': case 'changes': {
        console.log(C.dim + '  changelog...' + C.reset);
        var cl = await adv.genChangelog(client, cwd);
        if (!cl) { console.log(C.yellow + '  No git history found. Commit some code first.' + C.reset + '\n'); break; }
        fs.writeFileSync(path.join(cwd, 'CHANGELOG.md'), cl);
        console.log(C.green + '  CHANGELOG.md written.' + C.reset + '\n');
        break;
      }

      case 'browse': {
        await A.browseCommand(parts[1], parts.slice(2).join(' '), C, cwd, function (c) { state.messages.push({ role: 'user', content: c }); });
        break;
      }
      case 'screenshot': case 'ss': {
        try {
          var sf = A.screenshot(args, cwd, function (m) { console.log(C.dim + m + C.reset); });
          console.log(C.green + 'Screenshot saved → ' + sf + C.reset);
          console.log(C.dim + 'Ask about it: /image ' + sf + C.reset + '\n');
        } catch (e) { console.log(C.red + e.message + C.reset + '\n'); }
        break;
      }
      case 'sysinfo': {
        var si = A.sysInfo();
        console.log(C.cyan + '  S.T.E.W Environment Report' + C.reset);
        Object.keys(si).forEach(function (k) { console.log('  ' + C.bold + k + C.reset + ': ' + si[k]); });
        console.log('');
        break;
      }
      case 'record': case 'rec': {
        try {
          var rec = A.record(parts[1], parts[2], cwd, function (m) { console.log(C.dim + m + C.reset); });
          console.log(C.green + 'Recorded ' + rec.secs + 's → ' + rec.file + C.reset + '\n');
        } catch (e) { console.log(C.red + e.message + C.reset + '\n'); }
        break;
      }
      case 'sh': case 'shell': {
        if (!args) { console.log(C.yellow + '  /sh <command>' + C.reset + '\n'); break; }
        var danger = new RegExp('rm\\s+-rf\\s+\\/|sudo|dd\\s+if=|mk' + 'fs|:\\(\\)\\s*\\{');
        if (danger.test(args)) { console.log(C.red + '  Blocked: dangerous command rejected.' + C.reset + '\n'); break; }
        try {
          var so = execSync(args, { cwd: cwd, encoding: 'utf8', timeout: 30000 });
          console.log(so || C.dim + '  (no output)' + C.reset);
        } catch (se2) {
          var errText = (se2.stderr ? se2.stderr.toString() : '') + (se2.stdout || '') + (se2.message || '');
          var missing = errText.match(/(?:command not found|not found|not recognized as an internal or external command)[:\s]*([\w.-]+)?/i) || errText.match(/([\w.-]+):\s*(?:command not found|not found)/i);
          var missingBin = missing && (missing[1] || errText.match(/^([\w.-]+):/)) ? (missing[1] || '') : '';
          if (missingBin && A.autoInstall([missingBin], function (m) { console.log(C.dim + m + C.reset); })) {
            try {
              var so2 = execSync(args, { cwd: cwd, encoding: 'utf8', timeout: 30000 });
              console.log(C.green + 'Installed ' + missingBin + ' and re-ran the command.' + C.reset);
              console.log(so2 || C.dim + '  (no output)' + C.reset);
            } catch (se3) { console.log(C.red + '  ' + (se3.stdout || se3.message) + C.reset); }
          } else {
            console.log(C.red + '  ' + (se2.stdout || se2.message) + C.reset);
          }
        }
        console.log('');
        break;
      }

      case 'voice': case 'speak': {
        var v = (args || '').toLowerCase();
        state.voice = v === 'on' ? true : v === 'off' ? false : !state.voice;
        console.log(C.dim + '  Voice ' + C.reset + (state.voice ? C.green + 'on' : C.gray + 'off') + C.reset + '\n');
        if (state.voice) speak('Voice mode on.');
        break;
      }

      case 'image': case 'img': {
        var imgFile = parts[1];
        if (!imgFile) { console.log(C.yellow + '  /image <path> [question]' + C.reset + '\n'); break; }
        var resolvedImg = path.resolve(cwd, imgFile);
        if (!fs.existsSync(resolvedImg)) { console.log(C.red + '  not found: ' + imgFile + C.reset + '\n'); break; }
        var imgQ = parts.slice(2).join(' ') || 'Describe this image in detail.';
        var mime = git.imageMime(resolvedImg);
        var imgB64 = fs.readFileSync(resolvedImg).toString('base64');
        console.log(C.dim + '  analyzing image...' + C.reset);
        process.stdout.write(C.green + C.bold + 'stew' + C.reset + ' ' + C.dim + '>' + C.reset + ' ');
        var imgResp = '';
        try {
          await streamChatCompletion(client, [{ role: 'user', content: [
            { type: 'text', text: imgQ },
            { type: 'image_url', image_url: { url: 'data:image/' + mime + ';base64,' + imgB64 } }
          ]}], { model: state.model, onToken: function (t) { imgResp += t; process.stdout.write(t); } });
          console.log('\n');
          state.messages.push({ role: 'user', content: imgQ + ' [image: ' + imgFile + ']' });
          state.messages.push({ role: 'assistant', content: imgResp });
          if (state.voice) speak(imgResp);
        } catch (imgErr) {
          console.log('\n' + C.red + '  Vision error: ' + (imgErr.message || imgErr) + C.reset);
          console.log(C.dim + '  API may not support images yet.' + C.reset + '\n');
        }
        break;
      }

      case 'mcp': {
        var mcpSub = (parts[1] || 'list').toLowerCase();
        if (mcpSub === 'add' && parts.length >= 4) {
          console.log(C.green + '  ' + mcp.addServer(parts[2], parts.slice(3).join(' ')) + C.reset + '\n');
        } else if (mcpSub === 'remove' && parts[2]) {
          console.log(C.green + '  ' + mcp.removeServer(parts[2]) + C.reset + '\n');
        } else if (mcpSub === 'tools' && parts[2]) {
          mcp.listTools(parts[2]).then(function (tools) {
            console.log('');
            tools.forEach(function (t) { console.log('  ' + C.cyan + (t.name || '?') + C.reset + C.dim + '  ' + (t.description || '').split('\n')[0].slice(0, 90) + C.reset); });
            console.log('');
          }).catch(function (e) { console.log(C.red + '  ' + e.message + C.reset + '\n'); });
        } else if ((mcpSub === 'run' || mcpSub === 'call') && parts.length >= 4) {
          var mcpArgs = {};
          try { mcpArgs = JSON.parse(parts.slice(4).join(' ') || '{}'); } catch (e) { console.log(C.red + '  Bad JSON args' + C.reset + '\n'); break; }
          mcp.callTool(parts[2], parts[3], mcpArgs).then(function (r) {
            console.log((r.ok ? C.green : C.red) + '  ' + r.output + C.reset + '\n');
          }).catch(function (e) { console.log(C.red + '  ' + e.message + C.reset + '\n'); });
        } else {
          var mcpCfg = mcp.mcpConfig();
          var mcpNames = Object.keys(mcpCfg);
          console.log('\n' + C.bold + '  MCP Servers:' + C.reset);
          if (!mcpNames.length) console.log(C.dim + '  none — /mcp add <name> <cmd>' + C.reset);
          mcpNames.forEach(function (n) { console.log('  ' + C.cyan + n + C.reset + C.dim + '  ' + mcpCfg[n].command + C.reset); });
          console.log(C.dim + '\n  /mcp add|tools|run|remove <args>' + C.reset + '\n');
        }
        break;
      }

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
