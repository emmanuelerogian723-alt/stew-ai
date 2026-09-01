#!/usr/bin/env node

const { parseArgs } = require('./utils/args');
const { printBanner, printError, red, dim, bold, cyan } = require('./utils/output');
const { getApiKey } = require('./utils/config');

const { chatCommand } = require('./commands/chat');
const { codeCommand } = require('./commands/code');
const { marathonCommand } = require('./commands/marathon');
const { scrapeCommand, crawlCommand } = require('./commands/scrape');
const { apiCommand } = require('./commands/api');
const { searchCommand } = require('./commands/search');
const { skillsCommand } = require('./commands/skills');
const { docCommand } = require('./commands/doc');
const { finetuneCommand } = require('./commands/finetune');
const { statusCommand } = require('./commands/status');
const { authCommand } = require('./commands/auth');

const COMMANDS = {
  code: codeCommand,
  marathon: marathonCommand,
  scrape: scrapeCommand,
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
    console.log('stew-code v2.0.0');
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
  console.log(bold('Coding Agent') + ':');
  console.log('  ' + 'code'.padEnd(35) + cyan('Interactive AI coding agent (REPL)'));
  console.log('  ' + dim('(or just run "stew" with no command)'));
  console.log('  ' + 'agent <task>'.padEnd(35) + cyan('Autonomous multi-step task execution'));
  console.log('  ' + 'marathon <goal>'.padEnd(35) + cyan('Run for HOURS — self re-planning, checkpointed'));
  console.log('  ' + 'scrape <url>'.padEnd(35) + cyan('Scrape a URL — extract text, links, metadata'));
  console.log('  ' + 'crawl <url> [--depth N]'.padEnd(35) + cyan('Crawl a website up to N levels deep'));
  console.log('  ' + 'api <METHOD> <url>'.padEnd(35) + cyan('Call any REST/GraphQL API'));
  console.log('');
  console.log(bold('Commands') + ':');
  console.log('  ' + 'chat <message>'.padEnd(35) + 'Chat with S.T.E.W AI');
  console.log('  ' + 'search <query>'.padEnd(35) + 'Web search with sources');
  console.log('  ' + 'skills'.padEnd(35) + 'List all 59+ API skills');
  console.log('  ' + 'doc <type> <json_data>'.padEnd(35) + 'Generate PDF/DOCX/XLSX/PPTX');
  console.log('  ' + 'finetune'.padEnd(35) + 'View/set persona and instructions');
  console.log('  ' + 'status'.padEnd(35) + 'Check API health');
  console.log('  ' + 'login <api_key>'.padEnd(35) + 'Save your API key');
  console.log('  ' + 'logout'.padEnd(35) + 'Clear saved API key');
  console.log('  ' + 'whoami'.padEnd(35) + 'Show current account info\n');
  console.log(bold('Code Agent Commands') + ' ' + dim('(inside stew code)') + ':');
  console.log('  ' + '/help'.padEnd(35) + 'Show all commands');
  console.log('  ' + '/skill <name> [args]'.padEnd(35) + 'Run a skill (16+ built-in)');
  console.log('  ' + '/skills'.padEnd(35) + 'List all available skills');
  console.log('  ' + '/forge <name> <desc>'.padEnd(35) + 'Create a new skill (Skill Forge)');
  console.log('  ' + '/agent <task>'.padEnd(35) + 'Autonomous task execution');
  console.log('  ' + '/files [pattern]'.padEnd(35) + 'List project files');
  console.log('  ' + '/read <file>'.padEnd(35) + 'Read file into context');
  console.log('  ' + '/model [name]'.padEnd(35) + 'Show/set AI model (9 models)');
  console.log('  ' + '/persona [name]'.padEnd(35) + 'Show/set AI persona (12 personas)');
  console.log('  ' + '/web [on|off]'.padEnd(35) + 'Toggle web search');
  console.log('  ' + '/plan [on|off]'.padEnd(35) + 'Plan mode (read-only)');
  console.log('  ' + '/run <cmd>'.padEnd(35) + 'Execute shell command');
  console.log('  ' + '/git status|diff|log|commit'.padEnd(35) + 'Git operations');
  console.log('  ' + '/save <name> / /load <name>'.padEnd(35) + 'Save/load sessions');
  console.log('  ' + '/undo'.padEnd(35) + 'Undo last file change');
  console.log('  ' + '/exit'.padEnd(35) + 'Exit\n');
  console.log(bold('Built-in Skills') + ':');
  console.log('  scaffold, test, docker, ci, env, gitignore, deps,');
  console.log('  explain, security, size, translate, refactor, document,');
  console.log('  clean, loc, format, checklist\n');
  console.log(bold('Options') + ':');
  console.log('  ' + '--json'.padEnd(20) + 'Output as JSON');
  console.log('  ' + '--raw'.padEnd(20) + 'Raw text output (for scripts)');
  console.log('  ' + '--web'.padEnd(20) + 'Enable web search (chat)');
  console.log('  ' + '--persona <name>'.padEnd(20) + 'Set persona (chat)');
  console.log('  ' + '--output <file>'.padEnd(20) + 'Save output to file');
  console.log('  ' + '--dry-run'.padEnd(20) + 'Agent mode: plan without applying');
  console.log('  ' + '--maxSteps <n>'.padEnd(20) + 'Agent mode: max steps (default 10)\n');
  console.log(bold('Examples') + ':');
  console.log('  ' + dim('stew  (launches interactive coding agent)'));
  console.log('  ' + dim('stew agent "fix all TypeScript errors"'));
  console.log('  ' + dim('stew agent "add tests to all API routes"'));
  console.log('  ' + dim('stew code  (explicit launch)'));
  console.log('  ' + dim('stew chat "What is the capital of Nigeria?"'));
  console.log('  ' + dim('stew search "top Nigerian fintechs 2026" --json'));
  console.log('  ' + dim('stew skills --category finance'));
  console.log('  ' + dim('stew doc pdf \'{"title":"Report","content":"Hello"}\' --output report.pdf'));
  console.log('  ' + dim('cat error.log | stew chat "What is causing this error?"'));
  console.log('  ' + dim('stew login stew_your_api_key_here') + '\n');
  console.log(dim('Docs: https://stew-agent.onrender.com/docs'));
  console.log(dim('Get a free key: https://stew-agent.onrender.com'));
  console.log(dim('GitHub: https://github.com/emmanuelerogian723-alt/stew-ai') + '\n');
}

main().catch(function(err) {
  printError(err);
  process.exit(1);
});
