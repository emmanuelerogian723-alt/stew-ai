var S = require('./scraper');
var describeFetchError = require('../../lib/api').describeFetchError;
var { execSync } = require('child_process');
var fs = require('fs');
var path = require('path');
function decode(s) {
  return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}
function strip(s) { return decode(String(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim(); }
function attr(s, n) {
  var m = s.match(new RegExp(n + '=(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
  return m ? (m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : m[3])) : null;
}
function Jar() { this.map = {}; }
Jar.prototype.store = function (url, setCookies) {
  try {
    var host = new URL(url).hostname.replace(/^www\./, '');
    this.map[host] = this.map[host] || {};
    var self = this;
    (setCookies || []).forEach(function (c) {
      var pair = c.split(';')[0], i = pair.indexOf('=');
      if (i < 1) return;
      var n = pair.slice(0, i).trim(), v = pair.slice(i + 1).trim();
      if (v === '') delete self.map[host][n]; else self.map[host][n] = v;
    });
  } catch (e) {}
};
Jar.prototype.header = function (url) {
  try {
    var host = new URL(url).hostname.replace(/^www\./, ''), out = [];
    for (var d in this.map) {
      if (host === d || host.endsWith('.' + d))
        for (var n in this.map[d]) out.push(n + '=' + this.map[d][n]);
    }
    return out.join('; ');
  } catch (e) { return ''; }
};
function parseForms(html, baseUrl) {
  var forms = [], m, fre = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  while ((m = fre.exec(html)) !== null) {
    var attrs = m[1] || '', inner = m[2] || '';
    var action = attr(attrs, 'action') || baseUrl;
    var method = (attr(attrs, 'method') || 'GET').toUpperCase();
    try { action = new URL(action, baseUrl).href; } catch (e) {}
    var fields = [], skip = /(submit|button|image|reset|file)/i;
    var ire = /<(input|select|textarea)\b([^>]*)(>([\s\S]*?)<\/\1>|\/>|>)/gi, im;
    while ((im = ire.exec(inner)) !== null) {
      var tag = im[1].toLowerCase(), a = im[2] || '';
      var type = (attr(a, 'type') || (tag === 'input' ? 'text' : '')).toLowerCase();
      var name = attr(a, 'name');
      if (!name || (tag === 'input' && skip.test(type))) continue;
      var val = attr(a, 'value') || '';
      if (tag === 'select') {
        var body = im[4] || '';
        var sel = body.match(/<option\b[^>]*selected/i);
        var chunk = sel ? body.substr(body.indexOf(sel[0])) : body;
        var om = chunk.match(/<option\b[^>]*/i);
        val = om ? (attr(om[0], 'value') || '') : '';
      }
      if (tag === 'textarea') val = strip(im[4] || '');
      fields.push({ name: name, type: type || tag, value: decode(val || '') });
    }
    forms.push({ action: action, method: method, fields: fields });
  }
  return forms;
}
function Browsr() { this.url = ''; this.html = ''; this.title = ''; this.links = []; this.forms = []; this.history = []; this.jar = new Jar(); this.status = 0; }
Browsr.prototype._fetch = async function (url, opts) {
  opts = opts || {};
  var headers = opts.headers || {};
  headers['user-agent'] = headers['user-agent'] || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 StewCode/2.7';
  var ck = this.jar.header(url);
  if (ck) headers['cookie'] = (headers['cookie'] ? headers['cookie'] + '; ' : '') + ck;
  var res;
  try {
    res = await fetch(url, { method: opts.method || 'GET', headers: headers, body: opts.body, redirect: 'follow' });
  } catch (fe) {
    throw new Error(describeFetchError(fe));
  }
  var sc = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  if (sc.length) this.jar.store(url, sc);
  this.status = res.status;
  return { text: await res.text(), finalUrl: res.url || url };
};
Browsr.prototype._load = function (html, url) {
  this.history.push(this.url);
  this.url = url; this.html = html;
  this.title = decode(strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || ''));
  this.links = S.extractLinks(html, url).slice(0, 120);
  this.forms = parseForms(html, url);
  return this.summary();
};
Browsr.prototype.open = async function (url) {
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  var r = await this._fetch(url, {});
  return this._load(r.text, r.finalUrl);
};
Browsr.prototype.back = async function () {
  var prev = this.history.pop();
  if (!prev) throw new Error('No history');
  return this.open(prev);
};
Browsr.prototype.click = async function (sel) {
  var href, i = parseInt(sel, 10);
  if (!isNaN(i) && String(i) === String(sel).trim()) href = this.links[i - 1];
  else {
    var re = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, m;
    while ((m = re.exec(this.html)) !== null)
      if (strip(m[2]).toLowerCase().indexOf(sel.toLowerCase()) !== -1) { href = new URL(m[1], this.url).href; break; }
  }
  if (!href) throw new Error('No link matches: ' + sel);
  return this.open(href);
};
Browsr.prototype.fill = async function (formIdx, values) {
  var f = this.forms[formIdx];
  if (!f) throw new Error('No form #' + formIdx + ' — /browse forms');
  var body = {};
  f.fields.forEach(function (fl) { body[fl.name] = fl.value || ''; });
  Object.keys(values).forEach(function (k) { body[k] = values[k]; });
  var data = new URLSearchParams(body).toString(), r;
  if (f.method === 'GET') r = await this._fetch(f.action + (f.action.indexOf('?') === -1 ? '?' : '&') + data, {});
  else r = await this._fetch(f.action, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: data });
  return this._load(r.text, r.finalUrl);
};
Browsr.prototype.text = function () { return S.extractText(this.html).slice(0, 12000); };
Browsr.prototype.summary = function () {
  var out = [this.status + ' ' + this.url];
  if (this.title) out.push('Title: ' + this.title);
  out.push(this.links.length + ' links, ' + this.forms.length + ' forms');
  var t = S.extractText(this.html).replace(/\s+/g, ' ').trim().slice(0, 400);
  if (t) out.push('---\n' + t);
  return out.join('\n');
};
function parseKV(args) {
  var out = {}, re = /([A-Za-z0-9_.\-]+)=("([^"]*)"|\S+)/g, m;
  while ((m = re.exec(args)) !== null) out[m[1]] = decode(m[3] !== undefined ? m[3] : m[2]);
  return out;
}
async function browseCommand(sub, args, C, cwd, onContext) {
  var b = browseCommand.b = browseCommand.b || new Browsr();
  sub = (sub || '').toLowerCase();
  var subs = ['open', 'click', 'back', 'links', 'forms', 'fill', 'text', 'save', 'status'];
  if (subs.indexOf(sub) === -1) { if (sub) { args = (sub + ' ' + (args || '')).trim(); sub = 'open'; } else sub = 'status'; }
  var a = (args || '').trim(), sp = a.indexOf(' ');
  var arg1 = sp === -1 ? a : a.slice(0, sp), rest = sp === -1 ? '' : a.slice(sp + 1);
  var show = function (s) { console.log(s); };
  try {
    if (sub === 'open') show(await b.open(a));
    else if (sub === 'click') show(await b.click(a));
    else if (sub === 'back') show(await b.back());
    else if (sub === 'links') { b.links.forEach(function (l, i) { console.log(C.cyan + String(i + 1).padStart(3) + C.reset + ' ' + l); }); }
    else if (sub === 'forms') {
      if (!b.forms.length) console.log(C.dim + 'No forms on this page' + C.reset);
      b.forms.forEach(function (f, i) {
        console.log(C.bold + '#' + i + C.reset + ' ' + f.method + ' ' + f.action);
        f.fields.forEach(function (fl) { console.log('  ' + C.cyan + fl.name.padEnd(20) + C.reset + C.dim + '(' + fl.type + ')' + (fl.value ? ' =' + fl.value.slice(0, 30) : '') + C.reset); });
      });
    }
    else if (sub === 'fill') {
      var n = parseInt(arg1, 10);
      if (isNaN(n)) { console.log(C.yellow + 'Usage: /browse fill <form#> field=value ...' + C.reset); return; }
      show(await b.fill(n, parseKV(rest)));
    }
    else if (sub === 'text') show(b.text());
    else if (sub === 'save') {
      var file = rest || 'page.html';
      fs.writeFileSync(path.resolve(cwd, file), b.html);
      console.log(C.green + 'Saved ' + b.html.length + ' bytes → ' + file + C.reset);
    }
    else {
      console.log(C.bold + 'Browse session:' + C.reset + ' ' + (b.url || C.dim + 'none — /browse open <url>' + C.reset));
      if (b.url) console.log(b.summary());
      console.log(C.dim + 'open <url> · click <n|text> · links · forms · fill <n> k=v · text · back · save [f]' + C.reset);
      return;
    }
    if (onContext && b.url) onContext('Browsed page ' + b.url + (b.title ? ' ("' + b.title + '")' : '') + ':\n' + b.text().slice(0, 6000));
  } catch (e) {
    console.log(C.red + 'Browse error: ' + e.message + C.reset);
    console.log(C.dim + 'Try: /browse open <url>' + C.reset);
  }
}
function findBrowser() {
  var bins = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome', 'msedge', 'microsoft-edge'];
  if (process.platform === 'win32') {
    var wp = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'];
    for (var i = 0; i < wp.length; i++) if (fs.existsSync(wp[i])) return wp[i];
    return null;
  }
  if (process.platform === 'darwin') {
    var mac = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'];
    for (var j = 0; j < mac.length; j++) if (fs.existsSync(mac[j])) return mac[j];
    return null;
  }
  for (var k = 0; k < bins.length; k++) {
    try { var p = execSync('command -v ' + bins[k] + ' 2>/dev/null').toString().trim(); if (p) return p; } catch (e) {}
  }
  return null;
}
function hasTool(t) { try { return !!execSync('command -v ' + t + ' 2>/dev/null').toString().trim(); } catch (e) { return false; } }
function isRoot() { try { return typeof process.getuid === 'function' && process.getuid() === 0; } catch (e) { return false; } }
function isTermux() { return !!process.env.TERMUX_VERSION || fs.existsSync('/data/data/com.termux'); }
// ── Self-healing dependency installer: detects the platform's package manager
// and installs missing tools automatically instead of just telling the user to. ──
function pkgManager() {
  if (process.platform === 'win32') return hasTool('winget') ? 'winget' : (hasTool('choco') ? 'choco' : null);
  if (process.platform === 'darwin') return hasTool('brew') ? 'brew' : null;
  if (isTermux() && hasTool('pkg')) return 'pkg';
  if (hasTool('apt-get')) return 'apt-get';
  if (hasTool('apt')) return 'apt';
  if (hasTool('dnf')) return 'dnf';
  if (hasTool('yum')) return 'yum';
  if (hasTool('apk')) return 'apk';
  if (hasTool('pacman')) return 'pacman';
  if (hasTool('zypper')) return 'zypper';
  if (hasTool('brew')) return 'brew';
  return null;
}
function installCmd(mgr, pkg) {
  var sudo = (mgr === 'pkg' || mgr === 'brew' || mgr === 'winget' || mgr === 'choco' || isRoot()) ? '' : 'sudo ';
  switch (mgr) {
    case 'apt-get': return sudo + 'apt-get update -qq && ' + sudo + 'apt-get install -y ' + pkg;
    case 'apt': return sudo + 'apt update -qq && ' + sudo + 'apt install -y ' + pkg;
    case 'pkg': return 'pkg install -y ' + pkg;
    case 'dnf': return sudo + 'dnf install -y ' + pkg;
    case 'yum': return sudo + 'yum install -y ' + pkg;
    case 'apk': return sudo + 'apk add ' + pkg;
    case 'pacman': return sudo + 'pacman -Sy --noconfirm ' + pkg;
    case 'zypper': return sudo + 'zypper install -y ' + pkg;
    case 'brew': return 'brew install ' + pkg;
    case 'winget': return 'winget install -e --id ' + pkg + ' --silent --accept-package-agreements --accept-source-agreements';
    case 'choco': return 'choco install -y ' + pkg;
    default: return null;
  }
}
function manualHint(pkg) {
  var mgr = pkgManager();
  var cmd = mgr ? installCmd(mgr, pkg) : null;
  return cmd || ('install "' + pkg + '" using your system package manager');
}
// Rough download size hints (MB, incl. typical deps) for the heavy packages we auto-install.
var PKG_MB = { chromium: 250, 'chromium-browser': 250, 'google-chrome': 300, ffmpeg: 80, 'gnome-screenshot': 15, imagemagick: 25, tesseract: 40 };
function freeMB() {
  try { var row = execSync('df -m . 2>/dev/null').toString().split('\n')[1].split(/\s+/); return parseInt(row[3], 10) || 0; } catch (e) { return 0; }
}
function battery() {
  if (isTermux()) { try { var j = JSON.parse(execSync('termux-battery-status 2>/dev/null').toString()); return { pct: j.percentage, charging: j.status === 'CHARGING' }; } catch (e) { return null; } }
  try {
    var dirs = fs.readdirSync('/sys/class/power_supply');
    for (var i = 0; i < dirs.length; i++) {
      var base = '/sys/class/power_supply/' + dirs[i] + '/';
      if (fs.existsSync(base + 'capacity')) {
        var pct = parseInt(fs.readFileSync(base + 'capacity', 'utf8').trim(), 10);
        if (!isNaN(pct)) { var st = ''; try { st = fs.readFileSync(base + 'status', 'utf8').trim(); } catch (e) {} return { pct: pct, charging: st === 'Charging' }; }
      }
    }
  } catch (e) {}
  return null;
}
// Warns BEFORE a long install: expected size, low disk, low battery. Runs quietly if no onLog.
function preInstallWarn(pkg, onLog) {
  if (!onLog) return;
  var mb = PKG_MB[pkg];
  if (mb) onLog('Heads up: ' + pkg + ' downloads ~' + mb + 'MB+ with dependencies — this can take minutes on a slow connection (not stuck, just slow).');
  var free = freeMB();
  if (free && free < 500) onLog('WARNING: only ' + free + 'MB free — install may fail partway. Free up space first.');
  var b = battery();
  if (b && b.pct < 25 && !b.charging) onLog('WARNING: battery ' + b.pct + '% and not charging — plug in first; power loss mid-install can corrupt the package.');
}
// Environment report — `stew sysinfo` prints this so users can paste it when reporting issues.
function sysInfo() {
  var mgr = pkgManager();
  var b = battery();
  var free = freeMB();
  return {
    platform: process.platform, arch: process.arch, node: process.version,
    termux: isTermux(), root: isRoot(), packageManager: mgr || 'none',
    browser: findBrowser() || 'none', display: !noDisplay(),
    freeDiskMB: free || 'unknown', battery: b ? (String(b.pct) + '%' + (b.charging ? ' (charging)' : '')) : 'unknown/desktop',
    network: netUp()
  };
}
function netUp() { if (!hasTool('curl')) return 'unknown (no curl)'; try { execSync('curl -s -m 5 -o /dev/null https://registry.npmjs.org'); return true; } catch (e) { return false; } }
// Tries each candidate package name with the detected manager until one installs successfully.
// Reports progress via onLog since installs can take a while — never do this silently.
function autoInstall(candidates, onLog) {
  var mgr = pkgManager();
  if (!mgr) { if (onLog) onLog('No package manager detected — cannot auto-install.'); return false; }
  for (var i = 0; i < candidates.length; i++) {
    var cmd = installCmd(mgr, candidates[i]);
    if (!cmd) continue;
    try {
      preInstallWarn(candidates[i], onLog);
      if (onLog) onLog('Installing ' + candidates[i] + ' via ' + mgr + '... (this can take a minute)');
      execSync(cmd, { stdio: 'ignore', timeout: 240000 });
      return true;
    } catch (e) { if (onLog) onLog(candidates[i] + ' install failed, trying next option...'); }
  }
  return false;
}
function pageShot(url, out, onLog) {
  var bin = findBrowser();
  if (!bin) {
    var candidates = isTermux() ? ['chromium'] : (process.platform === 'darwin' ? ['chromium'] : ['chromium', 'chromium-browser']);
    if (autoInstall(candidates, onLog)) bin = findBrowser();
  }
  if (!bin) throw new Error('No Chrome/Chromium found and auto-install failed (network/permissions/package manager). Install manually: ' + manualHint('chromium'));
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  var sandboxFlag = isRoot() ? ' --no-sandbox' : '';
  execSync('"' + bin + '" --headless=new --disable-gpu' + sandboxFlag + ' --hide-scrollbars --window-size=1280,800 --virtual-time-budget=8000 --screenshot="' + out + '" "' + url + '"', { timeout: 60000, stdio: 'ignore' });
  return out;
}
function noDisplay() { return process.platform !== 'win32' && process.platform !== 'darwin' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY; }
function screenShot(out, onLog) {
  if (noDisplay()) throw new Error('No display detected — screen capture needs a desktop session (not over SSH).');
  if (process.platform === 'darwin') { execSync('screencapture -x "' + out + '"'); return out; }
  if (process.platform === 'win32') {
    var ps = "Add-Type -AssemblyName System.Windows.Forms,System.Drawing;$b=[Windows.Forms.Screen]::PrimaryScreen.Bounds;$bmp=New-Object Drawing.Bitmap $b.Width,$b.Height;$g=[Drawing.Graphics]::FromImage($bmp);$g.CopyFromScreen($b.Location,[Drawing.Point]::Empty,$b.Size);$g.Dispose();$bmp.Save('" + out.replace(/'/g, "''") + "');";
    execSync('powershell -NoProfile -Command "' + ps.replace(/"/g, '\\"') + '"', { timeout: 30000 });
    return out;
  }
  if (!hasTool('scrot') && !hasTool('gnome-screenshot') && !hasTool('grim') && !hasTool('import')) {
    autoInstall(['scrot'], onLog);
  }
  if (hasTool('scrot')) execSync('scrot "' + out + '"');
  else if (hasTool('gnome-screenshot')) execSync('gnome-screenshot -f "' + out + '"');
  else if (hasTool('grim')) execSync('grim "' + out + '"');
  else if (hasTool('import')) execSync('import -window root "' + out + '"');
  else if (hasTool('ffmpeg')) execSync('ffmpeg -y -f x11grab -video_size 1366x768 -i :0.0 -frames:v 1 "' + out + '"', { stdio: 'ignore' });
  else throw new Error('No screen capture tool and auto-install did not succeed. Install it yourself with: ' + manualHint('scrot'));
  return out;
}
var shotCount = 0;
function screenshot(args, cwd, onLog) {
  var a = (args || '').trim();
  var isUrl = /^https?:\/\//i.test(a) || (/^[\w.-]+\.[a-z]{2,}([\/?#]|$)/i.test(a) && a.indexOf(' ') === -1);
  shotCount++;
  var out = isUrl || !a ? path.resolve(cwd, 'stew-shot-' + shotCount + '.png') : path.resolve(cwd, a);
  if (isUrl) pageShot(a, out, onLog); else screenShot(out, onLog);
  return out;
}
function record(secs, file, cwd, onLog) {
  secs = parseInt(secs, 10) || 10;
  var ext = process.platform === 'darwin' ? '.mov' : '.mp4';
  var out = path.resolve(cwd, file || ('stew-recording-' + Date.now() + ext));
  if (process.platform === 'darwin') { execSync('screencapture -V ' + secs + ' "' + out + '"'); return { file: out, secs: secs }; }
  if (noDisplay()) throw new Error('No display detected. Screen recording needs a desktop session — over SSH, run it on the machine directly.');
  if (!hasTool('ffmpeg')) autoInstall(['ffmpeg'], onLog);
  if (!hasTool('ffmpeg')) throw new Error('ffmpeg not found and auto-install did not succeed. Install it yourself with: ' + manualHint('ffmpeg'));
  if (process.platform === 'win32') execSync('ffmpeg -y -f gdigrab -framerate 25 -i desktop -t ' + secs + ' "' + out + '"', { stdio: 'ignore' });
  else execSync('ffmpeg -y -f x11grab -framerate 25 -i :0.0 -t ' + secs + ' "' + out + '"', { stdio: 'ignore' });
  return { file: out, secs: secs };
}
module.exports = { Browsr, Jar, parseForms, browseCommand, screenshot, record, findBrowser, pageShot, screenShot, strip, decode, parseKV, pkgManager, installCmd, autoInstall, manualHint, preInstallWarn, sysInfo };