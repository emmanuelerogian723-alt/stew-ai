var C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', gray: '\x1b[90m',
};
var MAX_CONTENT_LENGTH = 50000;
var DEFAULT_TIMEOUT = 15000;
var DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; StewCode/2.1; +https://stew-agent.onrender.com)';
async function fetchUrl(url, options) {
  options = options || {};
  var timeout = options.timeout || DEFAULT_TIMEOUT;
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, timeout);
  try {
    var response = await fetch(url, {
      headers: {
        'User-Agent': options.userAgent || DEFAULT_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml,text/plain,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    var contentType = response.headers.get('content-type') || '';
    var finalUrl = response.url || url;
    var html = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      contentType: contentType,
      url: finalUrl,
      html: html,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, status: 0, error: 'Request timed out after ' + timeout + 'ms', url: url };
    }
    return { ok: false, status: 0, error: err.message, url: url };
  } finally {
    clearTimeout(timer);
  }
}
function extractText(html) {
  if (!html) return '';
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  html = html.replace(/<svg[\s\S]*?<\/svg>/gi, '');
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<\/?(p|div|section|article|header|footer|nav|aside|main|ul|ol|li|table|tr|td|th|tbody|thead|blockquote|pre|code|h[1-6])[^>]*>/gi, '\n');
  html = html.replace(/<br\s*\/?>/gi, '\n');
  html = html.replace(/<a\s[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, function(match, href, text) {
    var cleanText = text.replace(/<[^>]+>/g, '').trim();
    if (!cleanText) return '';
    if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
      return cleanText + ' (' + href + ')';
    }
    return cleanText;
  });
  html = html.replace(/<[^>]+>/g, '');
  var entities = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
    '&apos;': "'", '&nbsp;': ' ', '&copy;': '©', '&reg;': '®',
    '&trade;': '™', '&hellip;': '…', '&mdash;': '—', '&ndash;': '–',
    '&laquo;': '«', '&raquo;': '»', '&ldquo;': '"', '&rdquo;': '"',
    '&lsquo;': '\u2018', '&rsquo;': '\u2019', '&bull;': '•',
  };
  html = html.replace(/&#(\d+);/g, function(m, code) { return String.fromCharCode(parseInt(code)); });
  html = html.replace(/&[a-z]+;/gi, function(m) { return entities[m.toLowerCase()] || m; });
  html = html.replace(/[ \t]+/g, ' ');
  html = html.replace(/\n[ \t]+/g, '\n');
  html = html.replace(/\n{3,}/g, '\n\n');
  return html.trim();
}
function extractMetadata(html) {
  var meta = { title: '', description: '', ogTitle: '', ogDescription: '', ogImage: '', canonical: '', headings: [] };
  var titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) meta.title = titleMatch[1].trim();
  var descMatch = html.match(/<meta\s+(?:name|property)=["']description["']\s+content=["']([^"']*)["']/i);
  if (descMatch) meta.description = descMatch[1].trim();
  var ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']*)["']/i);
  if (ogTitleMatch) meta.ogTitle = ogTitleMatch[1].trim();
  var ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i);
  if (ogDescMatch) meta.ogDescription = ogDescMatch[1].trim();
  var ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']*)["']/i);
  if (ogImageMatch) meta.ogImage = ogImageMatch[1].trim();
  var canonMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i);
  if (canonMatch) meta.canonical = canonMatch[1].trim();
  var headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  var hMatch;
  while ((hMatch = headingRegex.exec(html)) !== null && meta.headings.length < 20) {
    var level = parseInt(hMatch[1]);
    var text = hMatch[2].replace(/<[^>]+>/g, '').trim();
    if (text) meta.headings.push({ level: level, text: text });
  }
  return meta;
}
function extractLinks(html, baseUrl) {
  var links = [];
  var linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  var match;
  while ((match = linkRegex.exec(html)) !== null) {
    var href = match[1].trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:') ||
        href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('data:')) continue;
    try {
      var resolved = new URL(href, baseUrl).href;
      links.push(resolved);
    } catch (e) {
    }
  }
  return Array.from(new Set(links));
}
function sameOrigin(url1, url2) {
  try {
    var u1 = new URL(url1);
    var u2 = new URL(url2);
    return u1.origin === u2.origin;
  } catch (e) {
    return false;
  }
}
async function scrape(url, options) {
  options = options || {};
  var result = await fetchUrl(url, options);
  if (!result.ok) {
    return {
      ok: false,
      url: url,
      error: result.error || 'HTTP ' + result.status,
      status: result.status,
    };
  }
  var isHtml = result.contentType.includes('text/html') || result.contentType.includes('application/xhtml');
  var text, metadata, links;
  if (isHtml) {
    text = extractText(result.html);
    metadata = extractMetadata(result.html);
    links = extractLinks(result.html, result.url);
  } else {
    text = result.html;
    metadata = { title: url, description: '', headings: [] };
    links = [];
  }
  var truncated = false;
  if (text.length > MAX_CONTENT_LENGTH) {
    text = text.slice(0, MAX_CONTENT_LENGTH) + '\n\n[... truncated at ' + MAX_CONTENT_LENGTH + ' chars]';
    truncated = true;
  }
  return {
    ok: true,
    url: result.url,
    status: result.status,
    contentType: result.contentType,
    title: metadata.title || metadata.ogTitle || url,
    description: metadata.description || metadata.ogDescription || '',
    headings: metadata.headings,
    links: links,
    text: text,
    truncated: truncated,
    linkCount: links.length,
    contentLength: text.length,
  };
}
async function crawl(startUrl, options) {
  options = options || {};
  var maxDepth = options.depth !== undefined ? options.depth : 2;
  var maxPages = options.maxPages || 20;
  var sameOriginOnly = options.sameOriginOnly !== false;
  var delay = options.delay || 500;
  var visited = new Set();
  var queue = [{ url: startUrl, depth: 0 }];
  var results = [];
  while (queue.length > 0 && results.length < maxPages) {
    var item = queue.shift();
    var currentUrl = item.url;
    var currentDepth = item.depth;
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);
    if (options.onProgress) options.onProgress(currentUrl, currentDepth, results.length, maxPages);
    var page = await scrape(currentUrl, { timeout: options.timeout });
    if (page.ok) {
      results.push({
        url: page.url,
        title: page.title,
        depth: currentDepth,
        linkCount: page.linkCount,
        contentLength: page.contentLength,
        headings: (page.headings || []).slice(0, 5).map(function(h) { return h.text; }),
        text: page.text.slice(0, 2000), // Keep crawl results compact
      });
      if (currentDepth < maxDepth && page.links) {
        for (var i = 0; i < page.links.length && queue.length < maxPages * 2; i++) {
          var link = page.links[i];
          if (visited.has(link)) continue;
          if (sameOriginOnly && !sameOrigin(startUrl, link)) continue;
          if (link.match(/\.(jpg|jpeg|png|gif|svg|css|js|pdf|zip|mp4|mp3|woff|woff2|ttf|ico)$/i)) continue;
          queue.push({ url: link, depth: currentDepth + 1 });
        }
      }
    }
    if (delay > 0 && queue.length > 0) {
      await new Promise(function(r) { setTimeout(r, delay); });
    }
  }
  return {
    startUrl: startUrl,
    pagesCrawled: results.length,
    depth: maxDepth,
    pages: results,
  };
}
function formatScrapeResult(result) {
  if (!result.ok) {
    return C.red + 'Failed to scrape: ' + result.url + C.reset + '\n' +
           C.dim + 'Error: ' + (result.error || 'HTTP ' + result.status) + C.reset + '\n';
  }
  var out = '\n' + C.bold + C.cyan + result.title + C.reset + '\n';
  out += C.gray + result.url + C.reset + '\n';
  if (result.description) out += C.dim + result.description + C.reset + '\n';
  out += C.dim + 'Content-Length: ' + result.contentLength + ' chars  ·  Links: ' + result.linkCount + C.reset + '\n';
  if (result.headings && result.headings.length > 0) {
    out += '\n' + C.bold + 'Headings:' + C.reset + '\n';
    result.headings.forEach(function(h) {
      var indent = '  '.repeat(h.level - 1);
      out += C.dim + indent + 'H' + h.level + C.reset + ' ' + h.text + '\n';
    });
  }
  out += '\n' + C.bold + 'Content:' + C.reset + '\n';
  out += result.text + '\n';
  if (result.links && result.links.length > 0) {
    out += '\n' + C.bold + 'Links (' + result.links.length + '):' + C.reset + '\n';
    result.links.slice(0, 30).forEach(function(link, i) {
      out += C.dim + '  ' + (i + 1) + '. ' + link + C.reset + '\n';
    });
    if (result.links.length > 30) {
      out += C.dim + '  ... and ' + (result.links.length - 30) + ' more' + C.reset + '\n';
    }
  }
  return out;
}
function formatCrawlResult(result) {
  var out = '\n' + C.bold + 'Crawl Results: ' + result.startUrl + C.reset + '\n';
  out += C.dim + 'Pages crawled: ' + result.pagesCrawled + '  ·  Depth: ' + result.depth + C.reset + '\n';
  out += C.dim + '─'.repeat(50) + C.reset + '\n';
  result.pages.forEach(function(page, i) {
    out += '\n' + C.bold + C.green + (i + 1) + '. ' + page.title + C.reset + '\n';
    out += C.gray + '   ' + page.url + C.reset + '\n';
    out += C.dim + '   depth: ' + page.depth + '  ·  links: ' + page.linkCount + '  ·  size: ' + page.contentLength + ' chars' + C.reset + '\n';
    if (page.headings && page.headings.length > 0) {
      out += C.dim + '   headings: ' + page.headings.join(' · ') + C.reset + '\n';
    }
    if (page.text) {
      var preview = page.text.slice(0, 500).replace(/\n+/g, ' ');
      out += C.dim + '   preview: ' + preview + (page.text.length > 500 ? '...' : '') + C.reset + '\n';
    }
  });
  return out;
}
module.exports = {
  scrape, crawl, extractText, extractLinks, extractMetadata,
  fetchUrl, formatScrapeResult, formatCrawlResult, sameOrigin,
  MAX_CONTENT_LENGTH, DEFAULT_TIMEOUT,
};
