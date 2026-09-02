const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============ SECURITY SCANNER ============
var PATTERNS = {
  secrets: [
    { p: /api[_-]?key\s*=\s*['"][^'"]{10,}['"]/gi, m: 'Hardcoded API key', s: 10 },
    { p: /password\s*=\s*['"][^'"]{4,}['"]/gi, m: 'Hardcoded password', s: 8 },
    { p: /secret\s*=\s*['"][^'"]{8,}['"]/gi, m: 'Hardcoded secret', s: 9 },
    { p: /token\s*=\s*['"][^'"]{16,}['"]/gi, m: 'Hardcoded token', s: 9 },
    { p: /AKIA[0-9A-Z]{16}/g, m: 'AWS Access Key', s: 15 },
    { p: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g, m: 'Private key', s: 20 },
  ],
  injection: [
    { p: /\beval\s*\(/g, m: 'eval() - code injection', s: 7 },
    { p: /child_process\.exec\s*\(/g, m: 'exec() - cmd injection', s: 6 },
    { p: /\bexec\s*\(\s*[^'"]*['"][^'"]*\+/g, m: 'Dynamic exec - injection risk', s: 8 },
    { p: /innerHTML\s*=\s*[^'"]*\+/gi, m: 'XSS via innerHTML', s: 6 },
  ],
  phishing: [
    { p: /https?:\/\/(?!github|npmjs|nodejs|google|microsoft)[a-z0-9-]+\.(?:tk|ml|ga|cf|gq)\b/gi, m: 'Suspicious free domain', s: 5 },
    { p: /click\s+here\s+to\s+(verify|claim|activate|unlock)/gi, m: 'Phishing language', s: 4 },
  ],
  malware: [
    { p: /cryptojacking|coinhive|cryptonight/gi, m: 'Cryptojacking', s: 15 },
    { p: /keylog|backdoor|reverse.?shell/gi, m: 'Malware pattern', s: 12 },
    { p: /powershell.*-enc.*[A-Z0-9+/=]{20,}/gi, m: 'PS encoded payload', s: 10 },
  ],
};

function scanFile(filePath) {
  var content = fs.readFileSync(filePath, 'utf8');
  var findings = [], score = 0;
  for (var cat in PATTERNS) {
    for (var p of PATTERNS[cat]) {
      var m = content.match(p.p);
      if (m) { score += p.s * m.length; findings.push({ category: cat, issue: p.m, count: m.length }); }
    }
  }
  var level = score >= 20 ? 'CRITICAL' : score >= 10 ? 'HIGH' : score >= 5 ? 'MEDIUM' : score >= 1 ? 'LOW' : 'SAFE';
  return { file: filePath, score, threatLevel: level, findings };
}

function scanDir(dir) {
  var results = [];
  function walk(d) {
    try { for (var f of fs.readdirSync(d)) {
      if (f.startsWith('.') || f === 'node_modules') continue;
      var fp = path.join(d, f);
      if (fs.statSync(fp).isDirectory()) walk(fp);
      else if (/\.(js|ts|py|json|html|sh|env)$/.test(f)) {
        var r = scanFile(fp);
        if (r.score >= 5) results.push(r);
      }
    } } catch(e) {}
  }
  walk(dir); return results;
}

function scan(target) {
  if (!fs.existsSync(target)) return { error: 'Not found: ' + target };
  return fs.statSync(target).isDirectory() ? scanDir(target) : [scanFile(target)];
}

// ============ SELF-VERIFICATION ============
function verifyCode(code, task) {
  var passes = { syntax: { pass: true, issues: [] }, logic: { pass: true, issues: [] }, security: { pass: true, issues: [] } };
  var ext = path.extname(task || '.js');
  if (ext === '.js' || ext === '.ts') {
    try { new Function(code); } catch(e) { passes.syntax = { pass: false, issues: [e.message] }; }
  }
  var lines = code.split('\n');
  if (lines.length > 500) passes.logic.issues.push('Very long file (' + lines.length + ' lines)');
  if (/\bTODO\b/.test(code)) passes.logic.issues.push('Contains TODO comments');
  if (/console\.log/.test(code) && !/test/.test(task || '')) passes.logic.issues.push('Console.log in production code');
  if (passes.logic.issues.length) passes.logic.pass = false;
  for (var p of PATTERNS.secrets.concat(PATTERNS.injection)) {
    if (p.p.test(code)) { passes.security.issues.push(p.m); passes.security.pass = false; }
  }
  var allPass = passes.syntax.pass && passes.logic.pass && passes.security.pass;
  return { allPass, passes };
}

function verifySession(files) {
  var results = [];
  for (var fp in files) {
    var r = verifyCode(files[fp], fp);
    results.push({ file: fp, pass: r.allPass, issues: r.passes.syntax.issues.concat(r.passes.logic.issues).concat(r.passes.security.issues) });
  }
  return results;
}

// ============ ENDURANCE MODE ============
function startEndurance(goal, hours) {
  var deadline = Date.now() + (hours || 1) * 3600000;
  var checkpoints = [];
  var heartbeat = { last: Date.now(), interval: 30000 };
  return {
    deadline, checkpoints, heartbeat,
    isExpired: function() { return Date.now() > deadline; },
    checkpoint: function(label) {
      var cp = { id: checkpoints.length, time: Date.now(), label: label || 'checkpoint' };
      checkpoints.push(cp); return cp;
    },
    selfHeal: function(error) {
      var strategies = ['retry', 'simplify', 'alternative', 'skip'];
      var idx = checkpoints.length % strategies.length;
      return { strategy: strategies[idx], error: error ? error.message : 'unknown' };
    },
    stats: function() {
      var elapsed = Date.now() - (deadline - (hours || 1) * 3600000);
      var remaining = deadline - Date.now();
      return { elapsed: Math.floor(elapsed / 1000), remaining: Math.max(0, Math.floor(remaining / 1000)), checkpoints: checkpoints.length };
    }
  };
}

module.exports = { scan, scanFile, scanDir, PATTERNS, verifyCode, verifySession, startEndurance };
