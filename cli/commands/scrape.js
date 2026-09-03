const { scrape, crawl, formatScrapeResult, formatCrawlResult } = require('../utils/scraper');

var C = require('../utils/output').C;

async function scrapeCommand(args) {
  var url = args._ && args._[0];
  if (!url) {
    console.log(C.red + 'Usage: stew scrape <url>' + C.reset);
    console.log(C.dim + 'Options: --json (JSON output) --links (show only links)' + C.reset);
    console.log(C.dim + 'Example: stew scrape https://example.com' + C.reset);
    process.exit(1);
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  var jsonOutput = args.flags && args.flags.json;
  var linksOnly = args.flags && args.flags.links;

  if (!jsonOutput) {
    console.log(C.cyan + 'Scraping ' + url + '...' + C.reset);
  }

  try {
    var result = await scrape(url, { timeout: 20000 });

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else if (linksOnly) {
      if (!result.ok) {
        console.log(C.red + 'Failed: ' + (result.error || 'HTTP ' + result.status) + C.reset);
        process.exit(1);
      }
      console.log(C.bold + 'Links found on ' + result.url + ' (' + result.linkCount + '):' + C.reset);
      (result.links || []).forEach(function(link, i) {
        console.log((i + 1) + '. ' + link);
      });
    } else {
      console.log(formatScrapeResult(result));
    }
  } catch (err) {
    console.log(C.red + 'Error: ' + err.message + C.reset);
    process.exit(1);
  }
}

async function crawlCommand(args) {
  var url = args._ && args._[0];
  if (!url) {
    console.log(C.red + 'Usage: stew crawl <url> [options]' + C.reset);
    console.log(C.dim + 'Options: --depth N (default 2) --pages N (max pages, default 20) --external (allow cross-domain) --json' + C.reset);
    console.log(C.dim + 'Example: stew crawl https://example.com --depth 3' + C.reset);
    process.exit(1);
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  var jsonOutput = args.flags && args.flags.json;
  var depth = args.options && args.options.depth ? parseInt(args.options.depth) : 2;
  var maxPages = args.options && args.options.pages ? parseInt(args.options.pages) : 20;
  var sameOriginOnly = !(args.flags && args.flags.external);

  if (!jsonOutput) {
    console.log(C.cyan + 'Crawling ' + url + ' (depth: ' + depth + ', max: ' + maxPages + ' pages)' + C.reset);
  }

  try {
    var result = await crawl(url, {
      depth: depth,
      maxPages: maxPages,
      sameOriginOnly: sameOriginOnly,
      delay: 500,
      onProgress: jsonOutput ? null : function(currentUrl, currentDepth, crawled, max) {
        process.stdout.write('\r' + C.dim + '[' + crawled + '/' + max + '] depth ' + currentDepth + ': ' + currentUrl.slice(0, 60).padEnd(60) + C.reset);
      },
    });

    if (!jsonOutput) console.log('');
    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatCrawlResult(result));
    }
  } catch (err) {
    console.log(C.red + 'Error: ' + err.message + C.reset);
    process.exit(1);
  }
}

module.exports = { scrapeCommand, crawlCommand };
