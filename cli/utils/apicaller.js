var C = { reset:'\x1b[0m', bold:'\x1b[1m', dim:'\x1b[2m', red:'\x1b[31m', green:'\x1b[32m', yellow:'\x1b[33m', cyan:'\x1b[36m', magenta:'\x1b[35m', gray:'\x1b[90m' };
var DEFAULT_TIMEOUT = 30000;
async function callApi(opts) {
  opts = opts || {};
  var method = (opts.method || 'GET').toUpperCase();
  var url = opts.url;
  if (!url) return { ok:false, error:'No URL provided' };
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
  if (opts.query && typeof opts.query === 'object') {
    var qs = new URLSearchParams(opts.query).toString();
    url += (url.includes('?') ? '&' : '?') + qs;
  }
  var headers = Object.assign({
    'User-Agent': 'Mozilla/5.0 (compatible; StewCode/2.1; +https://stew-agent.onrender.com)',
    'Accept': 'application/json, text/plain, */*',
  }, opts.headers || {});
  var body = undefined;
  if (opts.body !== undefined) {
    if (typeof opts.body === 'object') {
      body = JSON.stringify(opts.body);
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    } else {
      body = String(opts.body);
    }
  }
  if (opts.graphql) {
    var gql = typeof opts.graphql === 'string' ? opts.graphql : JSON.stringify(opts.graphql);
    body = JSON.stringify({ query: gql, variables: opts.variables || {} });
    headers['Content-Type'] = 'application/json';
    method = 'POST';
  }
  if (opts.bearer) headers['Authorization'] = 'Bearer ' + opts.bearer;
  if (opts.basic) headers['Authorization'] = 'Basic ' + Buffer.from(opts.basic).toString('base64');
  if (opts.apiKey) {
    if (opts.apiKeyHeader) headers[opts.apiKeyHeader] = opts.apiKey;
    else headers['Authorization'] = opts.apiKey;
  }
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, opts.timeout || DEFAULT_TIMEOUT);
  var start = Date.now();
  try {
    var response = await fetch(url, { method: method, headers: headers, body: body, signal: controller.signal, redirect: opts.redirect || 'follow' });
    clearTimeout(timer);
    var durationMs = Date.now() - start;
    var respHeaders = {};
    response.headers.forEach(function(v, k) { respHeaders[k] = v; });
    var contentType = response.headers.get('content-type') || '';
    var data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else if (contentType.includes('text/')) {
      data = await response.text();
    } else {
      data = await response.text();
    }
    return { ok: response.ok, status: response.status, statusText: response.statusText, headers: respHeaders, contentType: contentType, data: data, durationMs: durationMs, url: response.url || url, method: method };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err.name === 'AbortError' ? 'Request timed out after ' + (opts.timeout || DEFAULT_TIMEOUT) + 'ms' : err.message, durationMs: Date.now() - start, url: url, method: method };
  }
}
function formatResponse(r) {
  if (!r.ok && r.error) return C.red + '✗ ' + r.error + C.reset + '\n';
  var out = '\n' + C.bold + C.cyan + r.method + C.reset + ' ' + C.gray + r.url + C.reset + '\n';
  var statusColor = r.ok ? C.green : C.yellow;
  out += statusColor + C.bold + r.status + C.reset + statusColor + ' ' + (r.statusText || '') + C.reset + C.dim + '  ·  ' + r.durationMs + 'ms' + C.reset + '\n';
  if (r.headers) {
    var keyHeaders = ['content-type', 'content-length', 'server', 'date', 'x-request-id', 'set-cookie'].filter(function(h) { return r.headers[h]; });
    if (keyHeaders.length) {
      out += C.dim + 'Headers: ' + keyHeaders.map(function(h) { return h + '=' + r.headers[h].slice(0, 60); }).join(' · ') + C.reset + '\n';
    }
  }
  out += '\n';
  if (typeof r.data === 'object' && r.data !== null) {
    var jsonStr = JSON.stringify(r.data, null, 2);
    if (jsonStr.length > 8000) jsonStr = jsonStr.slice(0, 8000) + '\n\n[... truncated at 8000 chars]';
    out += C.dim + jsonStr + C.reset + '\n';
  } else if (typeof r.data === 'string') {
    var text = r.data;
    if (text.length > 8000) text = text.slice(0, 8000) + '\n\n[... truncated]';
    out += text + '\n';
  }
  return out;
}
async function smartCall(input, options) {
  options = options || {};
  var parts = input.trim().split(/\s+/);
  var method = 'GET';
  var url = '';
  var headers = {};
  var body = undefined;
  if (parts[0] && /^(GET|POST|PUT|PATCH|DELETE)$/i.test(parts[0])) {
    method = parts[0].toUpperCase();
    url = parts[1] || '';
    parts = parts.slice(2);
  } else {
    url = parts[0] || '';
    parts = parts.slice(1);
  }
  var i = 0;
  while (i < parts.length) {
    if (parts[i] === '-H' || parts[i] === '--header') {
      var hdr = parts[i + 1];
      if (hdr) {
        var colonIdx = hdr.indexOf(':');
        if (colonIdx > 0) headers[hdr.slice(0, colonIdx).trim()] = hdr.slice(colonIdx + 1).trim();
      }
      i += 2;
    } else if (parts[i] === '-d' || parts[i] === '--data' || parts[i] === '-b' || parts[i] === '--body') {
      var dataStr = parts[i + 1];
      if (dataStr) {
        try { body = JSON.parse(dataStr); }
        catch (e) { body = dataStr; }
      }
      i += 2;
    } else if (parts[i] === '-q' || parts[i] === '--query') {
      var q = parts[i + 1];
      if (q && q.includes('=')) {
        if (!options.query) options.query = {};
        options.query[q.split('=')[0]] = q.split('=')[1];
      }
      i += 2;
    } else {
      if (!url) url = parts[i];
      i++;
    }
  }
  if (options.bearer) { headers['Authorization'] = 'Bearer ' + options.bearer; }
  if (options.headers) headers = Object.assign(headers, options.headers);
  return await callApi({ method: method, url: url, headers: headers, body: body, query: options.query, timeout: options.timeout, bearer: options.bearer });
}
module.exports = { callApi, smartCall, formatResponse, DEFAULT_TIMEOUT };
