const { getApiKey } = require('../utils/config');
const { green, red, dim, bold, cyan, printError, printJson } = require('../utils/output');
const Stew = require('../../index.js');

async function statusCommand(args) {
  const jsonOutput = args.flags.json;
  const apiKey = getApiKey();
  const stew = new Stew({ apiKey });

  try {
    const result = await stew.heartbeat();
    if (jsonOutput) {
      printJson(result);
      return;
    }
    console.log(`\n${bold('🟢 S.T.E.W Agent Status')}\n`);
    console.log(`  ${bold('Status')}: ${green(result.status || 'ok')}`);
    console.log(`  ${bold('Version')}: ${result.version || 'unknown'}`);
    console.log(`  ${bold('Timestamp')}: ${result.timestamp || 'N/A'}`);
    if (result.services) {
      console.log(`\n  ${bold('Services')}:`);
      Object.entries(result.services).forEach(([name, status]) => {
        const icon = status === 'operational' ? '✅' : '⚠️';
        console.log(`    ${icon} ${name}: ${status}`);
      });
    }
    console.log('');
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

module.exports = { statusCommand };
