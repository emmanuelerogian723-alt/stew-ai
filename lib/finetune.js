const VALID_PERSONAS = [
  'general', 'doctor', 'health', 'startup', 'legal', 'finance',
  'education', 'ecommerce', 'developer', 'marketing', 'hr', 'customer_support'
];

const VALID_STYLES = ['concise', 'balanced', 'detailed'];
const VALID_LANGUAGES = ['en', 'pidgin', 'yoruba', 'igbo', 'hausa', 'fr'];

class FineTune {
  constructor(client) {
    this.client = client;
  }

  async set(options = {}) {
    const body = {
      api_key: this.client.apiKey || '',
      persona: options.persona || 'general',
      custom_instructions: options.customInstructions || null,
      persona_name: options.personaName || null,
      response_style: options.responseStyle || 'balanced',
      language: options.language || 'en',
      preferred_model: options.preferredModel || null,
      mistral_api_key: options.mistralApiKey || null,
    };

    if (body.persona && !VALID_PERSONAS.includes(body.persona)) {
      throw new Error(`Invalid persona. Valid options: ${VALID_PERSONAS.join(', ')}`);
    }
    if (body.response_style && !VALID_STYLES.includes(body.response_style)) {
      throw new Error(`Invalid response style. Valid options: ${VALID_STYLES.join(', ')}`);
    }

    return this.client.post('/finetune', body);
  }

  async get() {
    return this.client.get(`/finetune/${this.client.apiKey}`);
  }

  static get PERSONAS() { return VALID_PERSONAS; }
  static get STYLES() { return VALID_STYLES; }
  static get LANGUAGES() { return VALID_LANGUAGES; }
}

module.exports = { FineTune };
