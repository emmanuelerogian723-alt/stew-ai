const { streamChatCompletion } = require('./stream');

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

module.exports = { Chat };
