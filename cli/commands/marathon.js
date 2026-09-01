/**
 * Stew Code Marathon Mode — run for hours, not minutes.
 * Usage:
 *   stew marathon "build a full REST API with auth and tests"
 *   stew marathon "..." --hours 6
 *   stew marathon --resume <session-id>
 *   stew marathon --list
 *   stew marathon --stop <session-id>
 */
const { getApiKey } = require('../utils/config');
const { StewClient } = require('../../lib/client');
const { runMarathon, listCheckpoints, requestStop } = require('../utils/marathon');

var C = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m' };

async function marathonCommand(args) {
  var apiKey = getApiKey();
  if (!apiKey && !process.env.STEW_API_KEY) {
    console.log(C.red + 'No API key found.' + C.reset + ' Run: stew login <your_api_key>');
    process.exit(1);
  }

  var flags = (args && args.flags) || {};
  var options = (args && args.options) || {};

  if (flags.list) {
    var sessions = listCheckpoints();
    if (sessions.length === 0) { console.log(C.dim + 'No marathon sessions.' + C.reset); return; }
    console.log('\n' + C.bold + 'Marathon Sessions:' + C.reset);
    sessions.forEach(function(s) {
      console.log('  ' + C.cyan + s.id + C.reset);
      console.log('    ' + C.dim + s.goal + C.reset);
      console.log('    status: ' + s.status + '  ·  iteration: ' + s.iteration);
    });
    console.log('');
    return;
  }

  if (options.stop) {
    requestStop(options.stop);
    console.log(C.yellow + 'Stop requested for ' + options.stop + '. It will halt within the current iteration.' + C.reset);
    return;
  }

  var goal = '';
  var resumeId = options.resume;
  if (!resumeId && args && args._ && args._.length > 0) {
    goal = args._.join(' ');
  }

  if (!goal && !resumeId) {
    console.log(C.yellow + 'Usage: stew marathon "your big goal"' + C.reset);
    console.log(C.dim + 'Options: --hours N (default 4), --resume <id>, --list, --stop <id>' + C.reset);
    console.log(C.dim + 'Example: stew marathon "build a full REST API with auth, tests, and docs" --hours 6' + C.reset);
    process.exit(1);
  }

  var client = new StewClient({ apiKey });
  var cwd = process.cwd();
  var maxHours = options.hours ? parseFloat(options.hours) : 4;

  await runMarathon(client, goal, cwd, {
    maxHours: maxHours,
    resumeId: resumeId,
  });
}

module.exports = { marathonCommand };
