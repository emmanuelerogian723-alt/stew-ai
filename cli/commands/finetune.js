const { getApiKey } = require('../utils/config');
const { green, red, dim, bold, cyan, printError } = require('../utils/output');
const Stew = require('../../index.js');

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

  // stew finetune (no args) -> show current settings
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

  // stew finetune --persona doctor --instructions "..."
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

module.exports = { finetuneCommand, PERSONAS };
