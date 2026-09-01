const { getApiKey } = require('../utils/config');
const { green, red, dim, cyan, bold, startSpinner, stopSpinner, printError } = require('../utils/output');
const Stew = require('../../index.js');

async function chatCommand(args) {
  const message = args._.join(' ');
  if (!message) {
    console.log(`${red('Usage')}: stew chat "your message" [options]`);
    console.log(`${dim('Options: --web (enable web search) --persona <name> --json (JSON output) --raw (plain text)')}`);
    return;
  }

  const apiKey = getApiKey();
  const stew = new Stew({ apiKey });

  const useWebSearch = args.flags.web || args.flags['web-search'];
  const jsonOutput = args.flags.json;
  const rawOutput = args.flags.raw;
  const persona = args.options.persona;

  let context = '';
  if (!process.stdin.isTTY) {
    const chunks = [];
    await new Promise((resolve) => {
      process.stdin.on('data', (chunk) => chunks.push(chunk));
      process.stdin.on('end', () => {
        context = Buffer.concat(chunks).toString('utf8');
        resolve();
      });
      process.stdin.on('error', resolve);
      setTimeout(resolve, 1000); // timeout fallback
    });
  }

  const fullMessage = context ? `${message}\n\n---\n${context}` : message;

  if (!jsonOutput && !rawOutput) startSpinner('Thinking...');

  try {
    const response = await stew.chat.send(fullMessage, {
      webSearch: useWebSearch,
    });

    if (!jsonOutput && !rawOutput) stopSpinner(true);

    if (jsonOutput) {
      console.log(JSON.stringify(response, null, 2));
    } else if (rawOutput) {
      console.log(response.response);
    } else {
      console.log(`\n${bold('🤖 Stew')}: ${response.response}\n`);
      if (response.web_grounded && response.sources?.length) {
        console.log(`${dim('--- Sources ---')}`);
        response.sources.forEach((s, i) => {
          console.log(`${dim(`[${i + 1}]`)} ${s.title || s.url}`);
          console.log(`${dim(`    ${s.url}`)}`);
        });
        console.log('');
      }
      if (response.model) {
        console.log(`${dim(`Model: ${response.model} · Provider: ${response.provider}`)}`);
      }
    }
  } catch (err) {
    if (!jsonOutput && !rawOutput) stopSpinner(false);
    printError(err);
    process.exit(1);
  }
}

module.exports = { chatCommand };
