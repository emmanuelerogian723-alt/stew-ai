const { StewError } = require('./errors');

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
    // Use native fetch (Node 18+) or fall back to https module
    if (this.fetchFn) {
      return this.fetchFn(url, options);
    }
    // Fallback for Node < 18
    return this._nodeFetch(url, options);
  }

  async _nodeFetch(url, options) {
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');

    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const reqOptions = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      };

      const req = lib.request(reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({
            status: res.statusCode || 500,
            ok: (res.statusCode || 500) >= 200 && (res.statusCode || 500) < 300,
            json: () => { try { return Promise.resolve(JSON.parse(data)); } catch { return Promise.resolve({}); } },
            text: () => Promise.resolve(data),
            headers: res.headers,
          });
        });
      });

      req.on('error', reject);
      if (options.body) req.write(options.body);
      req.end();
    });
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
          // Clear timer when done
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

        // Non-retryable errors
        if (response.status === 401 || response.status === 400 || response.status === 403) {
          throw StewError.fromResponse(response.status, responseBody);
        }

        // Retryable errors (429, 5xx)
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
