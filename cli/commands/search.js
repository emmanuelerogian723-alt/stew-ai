const { getApiKey } = require('../utils/config');
const { green, red, dim, bold, startSpinner, stopSpinner, printError, printJson } = require('../utils/output');
const Stew = require('../../index.js');

async function searchCommand(args) {
  const query = args._.join(' ');
  if (!query) {
    console.log(`${red('Usage')}: stew search "your query" [options]`);
    console.log(`${dim('Options: --json (JSON output)')}`);
    return;
  }

  const apiKey = getApiKey();
  const stew = new Stew({ apiKey });
  const jsonOutput = args.flags.json;

  if (!jsonOutput) startSpinner('Searching...');

  try {
    const result = await stew.search.query(query);
    if (!jsonOutput) stopSpinner(true);

    if (jsonOutput) {
      printJson(result);
    } else {
      const results = result.results;
      if (results?.organic?.length) {
        console.log(`\n${bold(`🔍 Results for: "${query}"`)}\n`);
        results.organic.forEach((r, i) => {
          console.log(`${bold(`${i + 1}.`)} ${r.title || 'No title'}`);
          console.log(`${dim(`   ${r.link || r.url || ''}`)}`);
          if (r.snippet) console.log(`   ${r.snippet}\n`);
        });
      } else {
        console.log(`${dim('No results found.')}`);
      }
    }
  } catch (err) {
    if (!jsonOutput) stopSpinner(false);
    printError(err);
    process.exit(1);
  }
}

module.exports = { searchCommand };
