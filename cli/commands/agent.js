/**
 * Stew Code Agent Mode — Autonomous multi-step task execution.
 * Usage: stew agent "fix all TypeScript errors"
 *        stew agent --goal "add tests to all API routes"
 *        stew agent "deploy to vercel" --dry-run
 */
const path = require('path');
const { getApiKey } = require('../utils/config');
const { StewClient } = require('../../lib/client');
const { runAgent } = require('../utils/agent-engine');

async function agentCommand(args) {
  var apiKey = getApiKey();
  if (!apiKey && !process.env.STEW_API_KEY) {
    console.log('\x1b[31mNo API key found.\x1b[0m Run: stew login <your_api_key>');
    process.exit(1);
  }

  var goal = '';
  if (args && args._ && args._.length > 0) {
    goal = args._.join(' ');
  } else if (typeof args === 'string') {
    goal = args;
  } else if (args && args.goal) {
    goal = args.goal;
  }

  // Handle flags
  var dryRun = args && (args.flags && args.flags['dry-run']) || false;
  var maxSteps = args && args.options && args.options.maxSteps ? parseInt(args.options.maxSteps) : 10;

  if (!goal) {
    console.log('\x1b[33mUsage: stew agent "your task description"\x1b[0m');
    console.log('\x1b[2mExample: stew agent "fix all TypeScript errors"\x1b[0m');
    console.log('\x1b[2mExample: stew agent "add tests to all API routes"\x1b[0m');
    console.log('\x1b[2mExample: stew agent "refactor the auth module" --dry-run\x1b[0m');
    process.exit(1);
  }

  var client = new StewClient({ apiKey });
  var cwd = process.cwd();

  console.log('\x1b[36m\x1b[1m  ___|  \x1b[0m');
  console.log('\x1b[36m\x1b[1m \\__ \\  \x1b[0m \x1b[2mStew Code Agent\x1b[0m');
  console.log('\x1b[36m\x1b[1m |___/  \x1b[0m \x1b[2mAutonomous Mode\x1b[0m');
  console.log('');

  await runAgent(client, goal, cwd, {
    maxSteps: maxSteps,
    autoApply: !dryRun,
  });
}

module.exports = { agentCommand };
