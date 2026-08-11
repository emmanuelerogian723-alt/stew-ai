const { StewClient } = require('./lib/client');
const { Chat } = require('./lib/chat');
const { Search } = require('./lib/search');
const { Skills } = require('./lib/skills');
const { Documents } = require('./lib/documents');
const { FineTune } = require('./lib/finetune');
const { StewError } = require('./lib/errors');

class Stew {
  constructor(options = {}) {
    if (!options || typeof options !== 'object') {
      throw new Error('Stew constructor requires an options object: new Stew({ apiKey: "..." })');
    }

    this.client = new StewClient(options);

    // Expose API modules
    this.chat = new Chat(this.client);
    this.search = new Search(this.client);
    this.skills = new Skills(this.client);
    this.documents = new Documents(this.client);
    this.finetune = new FineTune(this.client);

    // Quick access to raw client
    this.baseURL = this.client.baseURL;
    this.apiKey = this.client.apiKey;
  }

  async heartbeat() {
    return this.client.get('/heartbeat');
  }

  async register(fullName, email, password) {
    return this.client.post('/auth/register', {
      full_name: fullName,
      email,
      password,
      plan: 'free',
    });
  }

  async login(email, password) {
    return this.client.post('/auth/login', { email, password });
  }

  async me() {
    return this.client.get('/auth/me', { Authorization: `Bearer ${this.client.apiKey}` });
  }

  async usage() {
    return this.client.get('/auth/usage', { Authorization: `Bearer ${this.client.apiKey}` });
  }

  async generateImage(prompt, options = {}) {
    return this.client.post('/generate/image', {
      prompt,
      api_key: this.client.apiKey || '',
      size: options.size || '1024x1024',
      style: options.style || 'natural',
    });
  }

  async runAgents(task, options = {}) {
    return this.client.post('/agents/run', {
      task,
      api_key: this.client.apiKey || '',
      num_agents: options.numAgents || 3,
      synthesize: options.synthesize !== undefined ? options.synthesize : true,
    });
  }

  async executeCode(code, options = {}) {
    return this.client.post('/api/code/exec', {
      code,
      api_key: this.client.apiKey || '',
      timeout: options.timeout || 10,
    });
  }

  async ocr(imageData, options = {}) {
    return this.client.post('/api/ocr', {
      image: imageData,
      api_key: this.client.apiKey || '',
      languages: options.languages || ['eng'],
    });
  }
}

Stew.StewError = StewError;
Stew.version = '1.0.0';

module.exports = Stew;
module.exports.default = Stew;
module.exports.Stew = Stew;
module.exports.StewError = StewError;
