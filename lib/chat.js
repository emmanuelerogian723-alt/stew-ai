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
    // Stew API doesn't have SSE streaming yet — simulate with polling
    const result = await this.send(message, { ...options, webSearch: false });
    return result;
  }
}

module.exports = { Chat };
