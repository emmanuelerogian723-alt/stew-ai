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

module.exports = { Search };
