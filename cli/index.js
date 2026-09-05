#!/usr/bin/env node

function parseArgs(argv) {
  const args = { _: [], flags: {}, options: {} };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--') {
      args._.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];

      if (next && !next.startsWith('--') && !next.startsWith('-')) {
        args.options[key] = next;
        i++;
      } else {
        args.flags[key] = true;
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      const key = arg.slice(1);
      args.flags[key] = true;
    } else {
      args._.push(arg);
    }
  }

  return args;
}

const { printBanner, printError, red, dim, bold, cyan } = require('./utils/output');
const { getApiKey } = require('./utils/config');

const { chatCommand } = require('./commands/chat');
const { codeCommand } = require('./commands/code');
const { runMarathon, listCheckpoints, requestStop } = require('./utils/marathon');

async function marathonCommand(args) {
  var apiKey = getApiKey();
  if (!apiKey && !process.env.STEW_API_KEY) { console.log(red('No API key found.') + ' Run: stew login <your_api_key>'); process.exit(1); }
  var flags = (args && args.flags) || {};
  var options = (args && args.options) || {};
  if (flags.list) {
    var sessions = listCheckpoints();
    if (sessions.length === 0) { console.log(dim('No marathon sessions.')); return; }
    console.log('\n' + bold('Marathon Sessions:'));
    sessions.forEach(function (s) { console.log('  ' + cyan(s.id) + dim('  ' + s.goal + '  ·  ' + s.status + '  ·  iter ' + s.iteration)); });
    console.log('');
    return;
  }
  if (options.stop) { requestStop(options.stop); console.log('Stopping ' + options.stop + '...'); return; }
  var goal = '';
  var resumeId = options.resume;
  if (!resumeId && args && args._ && args._.length > 0) goal = args._.join(' ');
  if (!goal && !resumeId) { console.log(cyan('Usage: stew marathon "your big goal"') + dim('  --hours N · --resume <id> · --list · --stop <id>')); process.exit(1); }
  var client = new (require('../lib/client').StewClient)({ apiKey });
  await runMarathon(client, goal, process.cwd(), { maxHours: options.hours ? parseFloat(options.hours) : 4, resumeId: resumeId });
}
const { scrapeCommand, crawlCommand } = require('./commands/scrape');
const { apiCommand, searchCommand, skillsCommand, docCommand, finetuneCommand, statusCommand } = require('./commands/misc');
const { authCommand } = require('./commands/auth');
const A = require('./utils/automation');
const C = require('./utils/output').C;
async function browseCommand(args) { await A.browseCommand(args._[0] || '', args._.slice(1).join(' '), C, process.cwd(), null); }
async function screenshotCommand(args) { console.log('Screenshot saved → ' + A.screenshot(args._.join(' '), process.cwd())); }
async function recordCommand(args) { var r = A.record(args._[0], args._[1], process.cwd()); console.log('Recorded ' + r.secs + 's → ' + r.file); }
async function sysinfoCommand() { var i = A.sysInfo(); console.log(bold('S.T.E.W Environment Report') + '\n' + Object.keys(i).map(function (k) { return '  ' + cyan(k) + ': ' + i[k]; }).join('\n')); }

const COMMANDS = {
  code: codeCommand,
  marathon: marathonCommand,
  scrape: scrapeCommand,
  browse: browseCommand,
  screenshot: screenshotCommand,
  ss: screenshotCommand,
  record: recordCommand,
  sysinfo: sysinfoCommand,
  crawl: crawlCommand,
  api: apiCommand,
  curl: apiCommand,
  http: apiCommand,
  chat: chatCommand,
  ask: chatCommand,
  search: searchCommand,
  skills: skillsCommand,
  skill: skillsCommand,
  doc: docCommand,
  document: docCommand,
  finetune: finetuneCommand,
  ft: finetuneCommand,
  status: statusCommand,
  health: statusCommand,
  login: authCommand,
  logout: authCommand,
  whoami: authCommand,
  register: authCommand,
  auth: authCommand,
};

async function main() {
  var rawArgs = process.argv.slice(2);

  if (rawArgs.length === 0) {
    await codeCommand({ _: [], flags: {}, options: {} });
    return;
  }

  var command = rawArgs[0].toLowerCase();
  var restArgs = rawArgs.slice(1);

  if (command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }

  if (command === 'version' || command === '--version' || command === '-v') {
    console.log('stew-code v' + require('../package.json').version);
    process.exit(0);
  }

  var handler = COMMANDS[command];
  if (!handler) {
    console.log(red('Unknown command') + ': ' + command + '\n');
    showHelp();
    process.exit(1);
  }

  var args = parseArgs(restArgs);

  var protectedCommands = ['chat', 'ask', 'search', 'doc', 'document', 'finetune', 'ft', 'whoami', 'register', 'code', 'agent', 'a', 'marathon', 'scrape', 'crawl', 'api', 'curl', 'http', 'agent', 'a'];
  if (protectedCommands.indexOf(command) !== -1 && command !== 'register') {
    var apiKey = getApiKey();
    if (!apiKey && !process.env.STEW_API_KEY) {
      console.log(red('No API key found') + '. Run: stew login <your_api_key>');
      console.log(dim('Get a free key at https://stew-agent.onrender.com') + '\n');
      process.exit(1);
    }
  }

  try {
    await handler(args);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

function showHelp() {
  printBanner();
  console.log(bold('Stew Code') + ' — The Ultimate Terminal Coding Agent\n');
  console.log(bold('Usage') + ': stew <command> [args] [options]\n');
  console.log(bold('Coding Agent') + ':\n  ' + cyan('code') + ' interactive REPL · ' + cyan('build <p>') + ' app from prompt · ' + cyan('agent <task>') + ' autonomous · ' + cyan('marathon <goal>') + ' hours-long · ' + cyan('swarm <task>') + ' multi-agent team\n');
  console.log(bold('Web & API') + ':\n  ' + cyan('chat <msg>') + ' · ' + cyan('search <q>') + ' web search · ' + cyan('scrape <url>') + ' · ' + cyan('crawl <url> -d N') + ' · ' + cyan('browse <url>') + ' interactive web automation · ' + cyan('screenshot [url]') + ' page/screen · ' + cyan('record [secs]') + ' screen · ' + cyan('sysinfo') + ' env report\n  ' + cyan('api <METHOD> <url>') + ' REST/GraphQL\n');
  console.log(bold('More') + ':\n  ' + cyan('skills') + ' list skills · ' + cyan('doc <type> <json>') + ' PDF/DOCX/XLSX/PPTX · ' + cyan('finetune') + ' personas · ' + cyan('status') + ' API health · ' + cyan('login|logout|whoami') + ' keys\n');
  console.log(bold('Inside stew code') + ' ' + dim('(REPL)') + ':\n  ' + '/build /swarm /explain /review /image /voice /mcp /changelog /fix /test /doc /scan /sh /undo /agent /marathon /skill /forge /model /persona /plan /web /git /run /save /load\n');
  console.log(bold('Options') + ':\n  ' + '--json --raw --web --persona <n> --output <f> --dry-run --maxSteps <n>\n');
  console.log(bold('Examples') + ':\n  ' + dim('stew · stew agent "fix all TypeScript errors" · stew chat "hi" · cat err.log | stew chat "what broke?"') + '\n');
  console.log(dim('Docs: https://stew-agent.onrender.com/docs · GitHub: github.com/emmanuelerogian723-alt/stew-ai') + '\n');
}

main().catch(function(err) {
  printError(err);
  process.exit(1);
});
