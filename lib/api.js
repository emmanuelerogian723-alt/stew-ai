class StewError extends Error {
  constructor(code, message, suggestion) {
    super(message);
    this.name = 'StewError';
    this.code = code;
    this.suggestion = suggestion || '';
  }

  static fromResponse(status, body) {
    const msg = body?.detail || body?.message || body?.error || `HTTP ${status}`;
    let code = 'UNKNOWN';
    let suggestion = '';

    if (status === 401) { code = 'AUTH_ERROR'; suggestion = 'Check your API key. Get one at https://stew-agent.onrender.com'; }
    else if (status === 429) { code = 'RATE_LIMIT'; suggestion = 'You have reached your monthly call limit. Upgrade at https://stew-agent.onrender.com#pricing'; }
    else if (status === 500) { code = 'SERVER_ERROR'; suggestion = 'The Stew API may be waking up (free tier). Retry in a few seconds.'; }
    else if (status === 503) { code = 'SERVICE_UNAVAILABLE'; suggestion = 'Service is starting up. Retry in 10-15 seconds.'; }
    else if (status >= 400 && status < 500) { code = 'BAD_REQUEST'; }

    return new StewError(code, msg, suggestion);
  }
}


class Search {
  constructor(client) {
    this.client = client;
  }

  async query(query, options = {}) {
    const body = {
      query,
      api_key: this.client.apiKey || '',
    };
    const result = await this.client.post('/search', body);
    return result;
  }

  async browse(url, options = {}) {
    const body = {
      url,
      api_key: this.client.apiKey || '',
      question: options.question || null,
    };
    const result = await this.client.post('/browse/navigate', body);
    return result;
  }
}


class Skills {
  constructor(client) {
    this.client = client;
  }

  async list(category) {
    const path = category ? `/skills?category=${encodeURIComponent(category)}` : '/skills';
    return this.client.get(path);
  }

  async run(skillName, params = {}) {
    const body = {
      skill: skillName,
      params,
      api_key: this.client.apiKey || '',
    };
    return this.client.post('/skills/run', body);
  }
}


class Documents {
  constructor(client) {
    this.client = client;
  }

  async pdf(content, title = 'Document') {
    return this.client.post('/generate/pdf', {
      content, title, api_key: this.client.apiKey || '',
    });
  }

  async docx(content, title = 'Document') {
    return this.client.post('/generate/docx', {
      content, title, api_key: this.client.apiKey || '',
    });
  }

  async xlsx(data, sheetName = 'Sheet1', title = 'Spreadsheet') {
    return this.client.post('/generate/xlsx', {
      data, sheet_name: sheetName, title, api_key: this.client.apiKey || '',
    });
  }

  async pptx(slides, title = 'Presentation') {
    return this.client.post('/generate/pptx', {
      slides, title, api_key: this.client.apiKey || '',
    });
  }

  async html(content, title = 'Report') {
    return this.client.post('/generate/html', {
      content, title, api_key: this.client.apiKey || '',
    });
  }
}


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

class Chat {
  constructor(client) {
    this.client = client;
  }

  async send(message, options = {}) {
    const body = {
      message,
      api_key: this.client.apiKey || '',
      web_search: options.webSearch !== undefined ? options.webSearch : true,
      fusion_mode: options.fusionMode || false,
    };

    if (options.conversationId) body.conversation_id = options.conversationId;

    const result = await this.client.post('/chat', body);
    return result;
  }

  async stream(message, options = {}) {
    const messages = [];

    if (options.system) {
      messages.push({ role: 'system', content: options.system });
    }

    if (options.history && Array.isArray(options.history)) {
      messages.push(...options.history);
    }

    messages.push({ role: 'user', content: message });

    return streamChatCompletion(this.client, messages, {
      model: options.model || 'stew-default',
      webSearch: options.webSearch,
      fusionMode: options.fusionMode,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      onToken: options.onToken,
      onDone: options.onDone,
    });
  }

  async completion(messages, options = {}) {
    if (options.stream && options.onToken) {
      return streamChatCompletion(this.client, messages, {
        model: options.model || 'stew-default',
        webSearch: options.webSearch,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        onToken: options.onToken,
        onDone: options.onDone,
      });
    }

    const result = await this.client.post('/v1/chat/completions', {
      model: options.model || 'stew-default',
      messages,
      web_search: options.webSearch,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
    });

    return result.choices?.[0]?.message?.content || result.response || '';
  }
}

module.exports = { StewError, Search, Skills, Documents, FineTune, Chat };
