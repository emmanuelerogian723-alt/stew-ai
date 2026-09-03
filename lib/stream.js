const { StewError } = require('./api');

async function streamChatCompletion(client, messages, options = {}) {
  const body = {
    model: options.model || 'stew-default',
    messages,
    stream: true,
    temperature: options.temperature ?? 0.7,
  };

  if (options.maxTokens) body.max_tokens = options.maxTokens;
  if (options.webSearch) body.web_search = true;
  if (options.fusionMode) body.fusion_mode = true;

  const url = `${client.baseURL}/v1/chat/completions`;
  const headers = { 'Content-Type': 'application/json' };
  if (client.apiKey) headers['Authorization'] = `Bearer ${client.apiKey}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') return '';
    throw new StewError('NETWORK_ERROR', err.message, 'Check your internet connection.');
  }

  if (!response.ok) {
    let errBody;
    try { errBody = await response.json(); } catch { errBody = {}; }
    throw StewError.fromResponse(response.status, errBody);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream') && !contentType.includes('application/x-ndjson')) {
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || data.response || '';
    if (options.onToken) options.onToken(text);
    if (options.onDone) options.onDone(text, data);
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let lastData = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);
            lastData = data;
            const delta = data.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              if (options.onToken) options.onToken(delta);
            }
          } catch (e) {
          }
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') return fullText;
    throw err;
  }

  if (options.onDone) options.onDone(fullText, lastData);
  return fullText;
}

module.exports = { streamChatCompletion };
