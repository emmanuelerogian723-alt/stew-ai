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

module.exports = { StewError };
