// Fine-tune for Medical domain
const Stew = require('stew-ai');

const stew = new Stew({ apiKey: 'stew_your_api_key_here' });

async function main() {
  const result = await stew.finetune.set({
    persona: 'doctor',
    customInstructions: 'Always cite NHS and WHO guidelines. Speak in simple terms patients can understand.',
    responseStyle: 'detailed',
    language: 'en'
  });
  console.log('Fine-tune set:', result);

  // Now every chat call uses the doctor persona automatically
  const response = await stew.chat.send('What are the symptoms of malaria?');
  console.log('\nDoctor response:', response.response);
}

main();
