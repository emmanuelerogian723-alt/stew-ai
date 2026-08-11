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

module.exports = { Skills };
