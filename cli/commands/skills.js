const { getApiKey } = require('../utils/config');
const { green, red, dim, bold, cyan, printError, printJson } = require('../utils/output');
const Stew = require('../../index.js');

async function skillsCommand(args) {
  const apiKey = getApiKey();
  const stew = new Stew({ apiKey });
  const jsonOutput = args.flags.json;

  // stew skills run <skill_name> '{"param":"value"}'
  if (args._[0] === 'run') {
    const skillName = args._[1];
    const paramsStr = args._[2] || '{}';
    if (!skillName) {
      console.log(`${red('Usage')}: stew skills run <skill_name> '{"key":"value"}'`);
      return;
    }
    let params;
    try { params = JSON.parse(paramsStr); } catch {
      console.log(`${red('Invalid JSON params')}: ${paramsStr}`);
      return;
    }
    try {
      const result = await stew.skills.run(skillName, params);
      if (jsonOutput) {
        printJson(result);
      } else {
        console.log(`\n${bold('⚙️ Skill')}: ${skillName}\n`);
        if (typeof result.result === 'string') {
          console.log(result.result);
        } else {
          printJson(result.result);
        }
      }
    } catch (err) {
      printError(err);
      process.exit(1);
    }
    return;
  }

  // stew skills [list] --category <name>
  const category = args.options.category || '';
  try {
    const result = await stew.skills.list(category);
    if (jsonOutput) {
      printJson(result);
      return;
    }
    console.log(`\n${bold(`🛠️  S.T.E.W Skills (${result.total})`)}\n`);
    const categories = {};
    result.skills.forEach(s => {
      if (!categories[s.category]) categories[s.category] = [];
      categories[s.category].push(s);
    });
    Object.keys(categories).sort().forEach(cat => {
      console.log(`${cyan(bold(cat.toUpperCase()))}`);
      categories[cat].forEach(s => {
        console.log(`  ${bold(s.name.padEnd(25))} ${dim(s.description)}`);
      });
      console.log('');
    });
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

module.exports = { skillsCommand };
