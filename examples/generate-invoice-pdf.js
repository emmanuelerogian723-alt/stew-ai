// Generate an invoice PDF
const Stew = require('stew-ai');

const stew = new Stew({ apiKey: 'stew_your_api_key_here' });

async function main() {
  const result = await stew.documents.pdf(
    'Invoice #INV-2026-001\n\nClient: ACME Corp\nAmount: 250,000 NGN\nDue Date: 2026-08-15\n\nServices:\n- AI Agent Development\n- API Integration\n- Cloud Deployment',
    'Invoice INV-2026-001'
  );
  console.log('PDF generated:', result);
}

main();
