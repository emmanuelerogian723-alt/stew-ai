// Generate a CV/Resume
const Stew = require('stew-ai');

const stew = new Stew({ apiKey: 'stew_your_api_key_here' });

async function main() {
  const result = await stew.skills.run('generate_cv', {
    name: 'Emmanuel Erog',
    role: 'AI Engineer & Product Builder',
    experience: '5+ years building AI products for African markets',
    skills: ['Python', 'FastAPI', 'React', 'AI Agent Design', 'Cloud Deployment']
  });
  console.log(result);
}

main();
