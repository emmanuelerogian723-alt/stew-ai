const { StewError } = require('./api');

const DEFAULT_BASE_URL = 'https://stew-agent.onrender.com';
const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;

class StewClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.STEW_API_KEY || '';
    this.baseURL = (options.baseURL || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries !== undefined ? options.maxRetries : MAX_RETRIES;
    this.fetchFn = typeof fetch !== 'undefined' ? fetch : null;
  }

  async _fetch(url, options) {
    if (!this.fetchFn) throw new StewError('Node 18+ required (native fetch)');
    return this.fetchFn(url, options);
  }


  async request(method, path, body = null, customHeaders = {}) {
    const url = `${this.baseURL}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const options = {
      method,
      headers,
    };

    if (body) {
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    let lastError = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        if (controller) {
          options.signal = controller.signal;
          const timer = setTimeout(() => controller.abort(), this.timeout);
          const origThen = Promise.prototype.then;
        }

        const response = await this._fetch(url, options);
        let responseBody;
        const contentType = response.headers?.get?.('content-type') || '';
        if (contentType.includes('application/json') || typeof response.json === 'function') {
          responseBody = await response.json();
        } else {
          const text = await response.text();
          try { responseBody = JSON.parse(text); } catch { responseBody = { raw: text }; }
        }

        if (response.ok) {
          return responseBody;
        }

        if (response.status === 401 || response.status === 400 || response.status === 403) {
          throw StewError.fromResponse(response.status, responseBody);
        }

        lastError = StewError.fromResponse(response.status, responseBody);

        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      } catch (err) {
        if (err instanceof StewError) throw err;
        lastError = new StewError('NETWORK_ERROR', err.message || 'Network request failed',
          'Check your internet connection or if the Stew API is reachable.');
        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }
    }

    throw lastError || new StewError('UNKNOWN', 'Unknown error');
  }

  async get(path, headers) {
    return this.request('GET', path, null, headers);
  }

  async post(path, body, headers) {
    return this.request('POST', path, body, headers);
  }
}

module.exports = { StewClient };
