// Web search example
const Stew = require('stew-ai');

const stew = new Stew({ apiKey: 'stew_your_api_key_here' });

async function main() {
  const response = await stew.chat.send('What are the top 5 Nigerian fintechs in 2026?', {
    webSearch: true
  });
  console.log(response.response);
  console.log('\nSources:');
  response.sources.forEach((s, i) => {
    console.log(`[${i + 1}] ${s.title}`);
    console.log(`    ${s.url}`);
  });
}

main();
