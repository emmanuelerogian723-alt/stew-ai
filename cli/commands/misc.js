var { getApiKey } = require('../utils/config');
var { green, red, dim, bold, cyan, yellow, printError, printJson, startSpinner, stopSpinner } = require('../utils/output');
var Stew = require('../../index.js');
var { smartCall, callApi, formatResponse } = require('../utils/apicaller');
var C = require('../utils/output').C;
var { smartCall, callApi, formatResponse } = require('../utils/apicaller');
var C = require('../utils/output').C;

async function apiCommand(args) {
  var input = (args._ && args._.join(' ')) || '';
  var jsonOutput = args.flags && args.flags.json;

  if (!input) {
    console.log(C.red + 'Usage: stew api <method?> <url> [options]' + C.reset);
    console.log(C.dim + 'Methods: GET (default), POST, PUT, PATCH, DELETE, graphql' + C.reset);
    console.log(C.dim + 'Options: -H "Header:Value" -d "json body" -q key=value --json' + C.reset);
    console.log(C.dim + 'Examples:' + C.reset);
    console.log(C.dim + '  stew api https://api.github.com/repos/nodejs/node' + C.reset);
    console.log(C.dim + '  stew api POST https://api.example.com/users -d \'{"name":"test"}\'' + C.reset);
    console.log(C.dim + '  stew api https://api.example.com/data -H "Authorization:Bearer mytoken"' + C.reset);
    process.exit(1);
  }

  var isGraphQL = false;
  if (input.startsWith('graphql ')) {
    isGraphQL = true;
    input = 'POST ' + input.slice(8);
  }

  if (!jsonOutput) console.log(C.cyan + 'Calling API...' + C.reset);

  try {
    var result = await smartCall(input, {});
    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatResponse(result));
    }
  } catch (err) {
    console.log(C.red + 'Error: ' + err.message + C.reset);
    process.exit(1);
  }
}

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

async function docCommand(args) {
  const type = args._[0]; // pdf, docx, xlsx, pptx
  const dataStr = args._[1];
  const outputFile = args.options.output;

  const validTypes = ['pdf', 'docx', 'xlsx', 'pptx', 'html', 'csv'];
  if (!type || !validTypes.includes(type)) {
    console.log(`${red('Usage')}: stew doc <type> '<json_data>' --output filename.ext`);
    console.log(`${dim('Types: pdf, docx, xlsx, pptx, html')}`);
    console.log(`${dim('Example: stew doc pdf \'{"title":"Report","content":"Hello world"}\' --output report.pdf')}`);
    return;
  }

  if (!dataStr) {
    console.log(`${red('Data required')}. Provide JSON as second argument.`);
    console.log(`${dim('Example: stew doc pdf \'{"title":"Report","content":"Hello world"}\' --output report.pdf')}`);
    return;
  }

  let data;
  try { data = JSON.parse(dataStr); } catch {
    console.log(`${red('Invalid JSON')}: ${dataStr}`);
    return;
  }

  const apiKey = getApiKey();
  const stew = new Stew({ apiKey });

  startSpinner(`Generating ${type.toUpperCase()}...`);

  try {
    let result;
    switch (type) {
      case 'pdf':
        result = await stew.documents.pdf(data.content || '', data.title || 'Document');
        break;
      case 'docx':
        result = await stew.documents.docx(data.content || '', data.title || 'Document');
        break;
      case 'xlsx':
        result = await stew.documents.xlsx(data.data || [], data.sheet_name || 'Sheet1', data.title || 'Spreadsheet');
        break;
      case 'pptx':
        result = await stew.documents.pptx(data.slides || [], data.title || 'Presentation');
        break;
      case 'html':
        result = await stew.documents.html(data.content || '', data.title || 'Report');
        break;
      default:
        console.log(`${red('Unknown type')}: ${type}`);
        return;
    }

    stopSpinner(true);

    if (outputFile) {
      let content;
      if (result.download_url) {
        console.log(`${green('✅')} Generated: ${result.download_url}`);
        console.log(`${dim(`   Saved to: ${outputFile}`)}`);
      } else {
        content = JSON.stringify(result, null, 2);
        fs.writeFileSync(outputFile, content);
        console.log(`${green('✅')} Saved to: ${outputFile}`);
      }
    } else {
      console.log(`\n${bold('📄 Result')}:`);
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (err) {
    stopSpinner(false);
    printError(err);
    process.exit(1);
  }
}

const PERSONAS = {
  general: 'General Assistant',
  doctor: 'Medical Doctor',
  health: 'Health & Wellness',
  startup: 'Startup Co-founder',
  legal: 'Legal Assistant',
  finance: 'Finance Advisor',
  education: 'AI Tutor',
  ecommerce: 'E-Commerce Expert',
  developer: 'Software Engineer',
  marketing: 'Growth Marketer',
  hr: 'HR & People Ops',
  customer_support: 'Customer Support',
};

async function finetuneCommand(args) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(red('No API key found') + '. Run: stew login');
    return;
  }

  const stew = new Stew({ apiKey });

  if (!args._.length && !args.options.persona) {
    try {
      const result = await stew.finetune.get();
      console.log('\n' + bold('Current Fine-Tune Settings') + '\n');
      console.log('  ' + bold('Persona') + ': ' + (PERSONAS[result.persona] || result.persona || 'general'));
      console.log('  ' + bold('Style') + ': ' + (result.response_style || 'balanced'));
      console.log('  ' + bold('Language') + ': ' + (result.language || 'en'));
      if (result.custom_instructions) {
        console.log('  ' + bold('Instructions') + ': ' + result.custom_instructions);
      }
      console.log('\n' + dim('To update: stew finetune --persona doctor --instructions "..."'));
    } catch (err) {
      printError(err);
    }
    return;
  }

  const options = {
    persona: args.options.persona || 'general',
    customInstructions: args.options.instructions || null,
    responseStyle: args.options.style || 'balanced',
    language: args.options.language || 'en',
  };

  if (args.options.mistralKey) {
    options.mistralApiKey = args.options.mistralKey;
  }

  try {
    const result = await stew.finetune.set(options);
    console.log(green('Fine-tune updated!'));
    console.log('  ' + bold('Persona') + ': ' + (PERSONAS[options.persona] || options.persona));
    if (options.customInstructions) console.log('  ' + bold('Instructions') + ': ' + options.customInstructions);
    console.log('  ' + bold('Style') + ': ' + options.responseStyle);
    console.log('  ' + bold('Language') + ': ' + options.language);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

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

module.exports = { apiCommand, searchCommand, skillsCommand, docCommand, finetuneCommand, statusCommand };
