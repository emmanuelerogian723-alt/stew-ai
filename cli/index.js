#!/usr/bin/env node

const { parseArgs } = require('./utils/args');
const { printBanner, printError, red, dim, bold } = require('./utils/output');
const { getApiKey } = require('./utils/config');

// Command imports
const { chatCommand } = require('./commands/chat');
const { searchCommand } = require('./commands/search');
const { skillsCommand } = require('./commands/skills');
const { docCommand } = require('./commands/doc');
const { finetuneCommand } = require('./commands/finetune');
const { statusCommand } = require('./commands/status');
const { authCommand } = require('./commands/auth');

const COMMANDS = {
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
  const rawArgs = process.argv.slice(2);

  if (rawArgs.length === 0) {
    showHelp();
    process.exit(0);
  }

  const command = rawArgs[0].toLowerCase();
  const restArgs = rawArgs.slice(1);

  if (command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }

  if (command === 'version' || command === '--version' || command === '-v') {
    console.log('stew-ai v1.0.0');
    process.exit(0);
  }

  const handler = COMMANDS[command];
  if (!handler) {
    console.log(`${red('Unknown command')}: ${command}\n`);
    showHelp();
    process.exit(1);
  }

  const args = parseArgs(restArgs);

  // Check for API key on protected commands
  const protectedCommands = ['chat', 'ask', 'search', 'doc', 'document', 'finetune', 'ft', 'whoami', 'register'];
  if (protectedCommands.includes(command) && command !== 'register') {
    const apiKey = getApiKey();
    if (!apiKey && !process.env.STEW_API_KEY) {
      console.log(`${red('No API key found')}. Run: stew login <your_api_key>`);
      console.log(`${dim('Get a free key at https://stew-agent.onrender.com')}\n`);
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
  console.log(`${bold('Usage')}: stew <command> [args] [options]\n`);
  console.log(`${bold('Commands')}:`);
  console.log(`  ${'chat <message>'.padEnd(35)} Chat with S.T.E.W AI`);
  console.log(`  ${'search <query>'.padEnd(35)} Web search with sources`);
  console.log(`  ${'skills'.padEnd(35)} List all 59 skills`);
  console.log(`  ${'skills run <name> <params>'.padEnd(35)} Run a specific skill`);
  console.log(`  ${'doc <type> <json_data>'.padEnd(35)} Generate PDF/DOCX/XLSX/PPTX`);
  console.log(`  ${'finetune'.padEnd(35)} View/set persona and instructions`);
  console.log(`  ${'status'.padEnd(35)} Check API health`);
  console.log(`  ${'login <api_key>'.padEnd(35)} Save your API key`);
  console.log(`  ${'logout'.padEnd(35)} Clear saved API key`);
  console.log(`  ${'whoami'.padEnd(35)} Show current account info`);
  console.log(`  ${'register --name --email --pass'.padEnd(35)} Create a free account\n`);
  console.log(`${bold('Options')}:`);
  console.log(`  ${'--json'.padEnd(20)} Output as JSON`);
  console.log(`  ${'--raw'.padEnd(20)} Raw text output (for scripts)`);
  console.log(`  ${'--web'.padEnd(20)} Enable web search (chat)`);
  console.log(`  ${'--persona <name>'.padEnd(20)} Set persona (chat)`);
  console.log(`  ${'--output <file>'.padEnd(20)} Save output to file`);
  console.log(`  ${'--category <name>'.padEnd(20)} Filter skills by category\n`);
  console.log(`${bold('Examples')}:`);
  console.log(`  ${dim('stew chat "What is the capital of Nigeria?"')}`);
  console.log(`  ${dim('stew chat "latest news in Lagos" --web')}`);
  console.log(`  ${dim('stew search "top Nigerian fintechs 2026" --json')}`);
  console.log(`  ${dim('stew skills --category finance')}`);
  console.log(`  ${dim('stew skills run generate_cv \'{"name":"Emmanuel","role":"Dev"}\'')}`);
  console.log(`  ${dim('stew doc pdf \'{"title":"Report","content":"Hello"}\' --output report.pdf')}`);
  console.log(`  ${dim('stew finetune --persona doctor --instructions "Always cite NHS"')}`);
  console.log(`  ${dim('cat file.txt | stew chat "Summarize this"')}`);
  console.log(`  ${dim('stew status')}`);
  console.log(`  ${dim('stew login stew_your_api_key_here')}\n`);
  console.log(`${dim('Docs: https://stew-agent.onrender.com/docs')}`);
  console.log(`${dim('Get a free key: https://stew-agent.onrender.com')}\n`);
}

main().catch((err) => {
  printError(err);
  process.exit(1);
});
