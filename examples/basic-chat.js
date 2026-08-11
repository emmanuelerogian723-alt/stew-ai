// Basic chat example
const Stew = require('stew-ai');

const stew = new Stew({ apiKey: 'stew_your_api_key_here' });

async function main() {
  const response = await stew.chat.send('What is the capital of Nigeria?', {
    webSearch: false
  });
  console.log(response.response);
  console.log('Provider:', response.provider);
  console.log('Model:', response.model);
}

main();
