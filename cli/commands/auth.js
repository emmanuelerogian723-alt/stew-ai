const { getApiKey, setApiKey, clearApiKey, getConfig } = require('../utils/config');
const { green, red, dim, bold, cyan, yellow, printError, printBanner } = require('../utils/output');
const Stew = require('../../index.js');

async function authCommand(args) {
  const action = args._[0] || 'whoami';
  const apiKey = getApiKey();

  switch (action) {
    case 'login':
      return loginCommand(args);
    case 'logout':
      return logoutCommand(args);
    case 'whoami':
      return whoamiCommand(args);
    case 'register':
      return registerCommand(args);
    default:
      console.log(`${red('Unknown auth command')}: ${action}`);
      console.log(`${dim('Available: login, logout, whoami, register')}`);
  }
}

async function loginCommand(args) {
  const key = args._[1] || args.options.key;

  if (!key) {
    // Interactive prompt
    printBanner();
    console.log(`${bold('Login to S.T.E.W')}\n`);
    console.log(`${dim('Enter your API key (get one at https://stew-agent.onrender.com)')}`);
    process.stdout.write(`${cyan('>')} `);

    return new Promise((resolve) => {
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (data) => {
        const inputKey = data.trim();
        if (!inputKey) {
          console.log(`${red('No key entered')}`);
          resolve();
          return;
        }
        setApiKey(inputKey);
        console.log(`\n${green('✅')} Logged in! API key saved to ~/.stew/config.json\n`);
        resolve();
      });
    });
  }

  setApiKey(key);
  console.log(`${green('✅')} Logged in! API key saved to ~/.stew/config.json`);
}

async function logoutCommand() {
  clearApiKey();
  console.log(`${green('✅')} Logged out. API key cleared.`);
}

async function whoamiCommand() {
  if (!apiKey) {
    console.log(`${yellow('⚠')} Not logged in. Run: stew login <api_key>`);
    console.log(`${dim('Get a free key at https://stew-agent.onrender.com')}`);
    return;
  }

  const stew = new Stew({ apiKey });
  try {
    const result = await stew.usage();
    console.log(`\n${bold('👤 S.T.E.W Account')}\n`);
    console.log(`  ${bold('API Key')}: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`);
    if (result.plan) console.log(`  ${bold('Plan')}: ${result.plan}`);
    if (result.used !== undefined) console.log(`  ${bold('Calls used')}: ${result.used}/${result.limit || 'unlimited'}`);
    if (result.email) console.log(`  ${bold('Email')}: ${result.email}`);
    if (result.persona) console.log(`  ${bold('Persona')}: ${result.persona}`);
    console.log('');
  } catch (err) {
    // Fallback to just showing the key
    console.log(`\n${bold('👤 S.T.E.W Account')}\n`);
    console.log(`  ${bold('API Key')}: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`);
    console.log(`  ${dim('(Could not fetch account details — API may be sleeping)')}\n`);
  }
}

async function registerCommand(args) {
  const fullName = args.options.name || args._[1];
  const email = args.options.email || args._[2];
  const password = args.options.password || args._[3];

  if (!fullName || !email || !password) {
    console.log(`${red('Usage')}: stew register --name "Your Name" --email you@example.com --password yourpass`);
    return;
  }

  const stew = new Stew({});
  try {
    const result = await stew.register(fullName, email, password);
    console.log(`${green('✅')} Account created!`);
    if (result.api_key) {
      setApiKey(result.api_key);
      console.log(`  ${bold('API Key')}: ${result.api_key}`);
      console.log(`  ${dim('Saved to ~/.stew/config.json')}`);
    }
    console.log(`\n${dim('You can now use: stew chat "hello"')}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

module.exports = { authCommand };
