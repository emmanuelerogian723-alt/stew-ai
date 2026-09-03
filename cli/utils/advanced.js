const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const files = require('./files');

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
    try { new Function(code.replace(/^#![^\n]*\n/, '')); } catch(e) { passes.syntax = { pass: false, issues: [e.message] }; }
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

// ============ AUTO-FIX / TEST / DOCS ============
function _projectFiles(cwd, ext) {
  var out = [];
  (function walk(d) {
    try { for (var f of fs.readdirSync(d)) {
      if (f.startsWith('.') || f === 'node_modules') continue;
      var fp = path.join(d, f);
      if (fs.statSync(fp).isDirectory()) walk(fp);
      else if (ext.test(f)) out.push(fp);
    } } catch (e) {}
  })(cwd);
  return out;
}

async function fixProject(client, opts) {
  opts = opts || {};
  var cwd = opts.cwd || process.cwd();
  var model = opts.model;
  var result = { fixed: [], remaining: [] };
  var files = _projectFiles(cwd, /\.(js|ts)$/);
  for (var fp of files) {
    var code = fs.readFileSync(fp, 'utf8');
    var v = verifyCode(code, fp);
    if (v.allPass) continue;
    var errs = v.passes.syntax.issues.concat(v.passes.security.issues);
    if (!errs.length) continue;
    try {
      var fix = await _bllm(client, [
        { role: 'system', content: 'Fix this file. Issues: ' + errs.join('; ') + '. Return the corrected complete file content wrapped in one code fence. Keep template literal backticks.' },
        { role: 'user', content: code }
      ], model);
      var fixed = _bstrip(fix); if (fixed.startsWith('!/usr/bin')) fixed = '#' + fixed; fixed += '\n';
      if (verifyCode(fixed, fp).allPass) {
        fs.writeFileSync(fp, fixed);
        result.fixed.push(path.relative(cwd, fp));
        saveLearned(path.relative(cwd, fp), errs);
      } else result.remaining.push(path.relative(cwd, fp));
    } catch (e) { result.remaining.push(path.relative(cwd, fp)); }
  }
  return result;
}

async function testProject(client, opts) {
  opts = opts || {};
  var cwd = opts.cwd || process.cwd();
  var model = opts.model;
  var rounds = 0;
  function run() {
    try {
      execSync('npm test', { cwd: cwd, stdio: 'pipe', timeout: 90000 });
      return { pass: true, out: '' };
    } catch (e) {
      return { pass: false, out: (e.stdout || '') + (e.stderr || '') };
    }
  }
  var r = run();
  while (!r.pass && rounds < 3) {
    rounds++;
    try {
      var fix = await _bllm(client, [
        { role: 'system', content: 'Tests are failing. Fix the code so they pass. Return ONLY the file content that needs changing as JSON: {"file":"path","content":"..."}' },
        { role: 'user', content: 'Test output (last 2000 chars):\n' + r.out.slice(-2000) }
      ], model);
      var j = _bjson(fix);
      if (j && j.file && j.content) {
        var fp = path.join(cwd, j.file);
        if (fs.existsSync(fp)) fs.writeFileSync(fp, j.content.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```\s*$/, '') + '\n');
      }
    } catch (e) {}
    r = run();
  }
  return { pass: r.pass, rounds };
}

async function genDocs(client, opts) {
  opts = opts || {};
  var cwd = opts.cwd || process.cwd();
  var model = opts.model;
  var files = _projectFiles(cwd, /\.(js|ts|py|json|html|css)$/).slice(0, 12);
  if (!files.length) return { error: 'No source files found.' };
  var context = '';
  for (var fp of files) {
    var rel = path.relative(cwd, fp);
    var src = fs.readFileSync(fp, 'utf8').slice(0, 1500);
    context += '-- ' + rel + '\n' + src + '\n\n';
  }
  try {
    var pkg = fs.existsSync(path.join(cwd, 'package.json')) ? fs.readFileSync(path.join(cwd, 'package.json'), 'utf8').slice(0, 800) : '';
    var doc = await _bllm(client, [
      { role: 'system', content: 'Write a professional README.md for this project based on the source files. Include: title, description, features, install, usage, API (if any), license. Return ONLY markdown content.' },
      { role: 'user', content: 'package.json: ' + pkg + '\n\nSource files:\n' + context.slice(0, 8000) }
    ], model);
    var md = doc.replace(/^```markdown\n?/, '').replace(/\n?```\s*$/, '');
    fs.writeFileSync(path.join(cwd, 'README.md'), md + '\n');
    return 'README.md generated from ' + files.length + ' source files';
  } catch (e) { return { error: e.message }; }
}

// ============ APP BUILDER (prompt -> finished app) ============
var _stream = require('../../lib/stream');

async function _bllm(client, messages, model) {
  return await _stream.streamChatCompletion(client, messages, { model: model || 'stew-default', temperature: 0.3 });
}

function _bstrip(text) {
  var m = text.match(/^\s*```[^\n]*\n([\s\S]*?)\n?```\s*$/);
  if (m) return m[1];
  text = text.replace(/^\s*```[^\n]*\n?/, '').replace(/\n?```\s*$/, '');
  return text;
}

function _bjson(text) {
  var m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  var t = m ? m[1] : text;
  var s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s === -1) return null;
  try { return JSON.parse(t.slice(s, e + 1)); } catch (err) { return null; }
}

async function buildApp(prompt, client, opts) {
  opts = opts || {};
  var log = opts.log || function () {};
  var cwd = opts.cwd || process.cwd();
  var model = opts.model;
  var summary = { name: '', files: [], failed: [], fixed: 0, threats: [], run: '' };

  // PHASE 1: PLAN
  log('Phase 1/4: Planning...');
  var planTxt = await _bllm(client, [
    { role: 'system', content: 'You are an expert app architect. Output ONLY JSON, no markdown: {"name":"kebab-case-name","description":"one line","files":[{"path":"relative/path","purpose":"what it does"}],"deps":["npm packages"],"run":"command to run the app"} Plan a COMPLETE runnable app (max 14 files). Always include package.json, README.md, entry point, all source files. Prefer plain Node.js/Express, static HTML+CSS+JS, or Python stdlib. Avoid heavy build tools.' },
    { role: 'user', content: prompt }
  ], model);
  var plan = _bjson(planTxt);
  if (!plan || !plan.files || !plan.files.length) return { error: 'Could not create a build plan. Try rephrasing your prompt.' };
  summary.name = plan.name || 'stew-app';
  var dir = path.join(cwd, summary.name);
  fs.mkdirSync(dir, { recursive: true });
  log('Project: ' + dir);

  // PHASE 2: GENERATE + VERIFY + AUTO-FIX each file
  log('Phase 2/4: Generating ' + plan.files.length + ' files...');
  var fileList = plan.files.map(function (f) { return f.path; }).join(', ');
  for (var i = 0; i < plan.files.length; i++) {
    var f = plan.files[i];
    log('  [' + (i + 1) + '/' + plan.files.length + '] ' + f.path);
    var gen = await _bllm(client, [
      { role: 'system', content: 'You are a senior engineer building "' + summary.name + '". Write the COMPLETE content for the file ' + f.path + ' (' + (f.purpose || '') + '). It must work with the other files: ' + fileList + '. Return ONLY the complete file content, wrapped in exactly one markdown code fence (```...```). Template literal backticks inside JavaScript are allowed and required. No placeholders or TODOs.' },
      { role: 'user', content: prompt + '\n\nFile to write: ' + f.path + '\nPurpose: ' + (f.purpose || '') }
    ], model);
    var content = _bstrip(gen); if (content.startsWith('!/usr/bin')) content = '#' + content; content += '\n';
    var fp = path.join(dir, f.path);
    fs.mkdirSync(path.dirname(fp), { recursive: true });

    // verify + auto-fix loop for JS/TS
    var attempts = 0;
    while (attempts < 3) {
      fs.writeFileSync(fp, content);
      if (!/\.js$/.test(f.path)) break;
      var v = verifyCode(content, f.path);
      var errs = v.passes.syntax.issues.concat(v.passes.security.issues);
      if (!errs.length) break;
      attempts++;
      if (attempts >= 3) break;
      log('    fixing: ' + errs[0]);
      var fix = await _bllm(client, [
        { role: 'system', content: 'Fix this file. Issues: ' + errs.join('; ') + '. Return ONLY the corrected complete file content, no fences.' },
        { role: 'user', content: content }
      ], model);
      content = _bstrip(fix); if (content.startsWith('!/usr/bin')) content = '#' + content; content += '\n';
      summary.fixed++;
    }
    var finalV = (/\.js$/.test(f.path)) ? verifyCode(content, f.path) : { allPass: true, passes: {} };
    if (finalV.allPass) summary.files.push(f.path);
    else { summary.failed.push(f.path); log('    WARN: ' + f.path + ' still has issues'); }

    // security scan
    if (/\.(js|ts|json|html|py)$/.test(f.path)) {
      var sc = scanFile(fp);
      if (sc.score >= 10) summary.threats.push(f.path + ' (score ' + sc.score + ')');
    }
  }

  // PHASE 3: INSTALL DEPS
  if (plan.deps && plan.deps.length) {
    log('Phase 3/4: Installing deps: ' + plan.deps.join(', '));
    try { execSync('npm install ' + plan.deps.join(' ') + ' --no-audit --no-fund', { cwd: dir, stdio: 'pipe', timeout: 120000 }); }
    catch (e) { log('  WARN: npm install failed: ' + e.message.slice(0, 80)); }
  } else log('Phase 3/4: No deps to install');

  // PHASE 4: GIT
  log('Phase 4/4: Git init + commit...');
  try {
    execSync('git init -q && git add -A && git commit -q -m "Initial build by Stew Code: ' + prompt.replace(/["\\`$]/g, '').slice(0, 60) + '"', { cwd: dir, stdio: 'pipe', timeout: 30000 });
  } catch (e) { try { execSync('git init -q', { cwd: dir, stdio: 'pipe' }); } catch (e2) {} }

  summary.run = plan.run || 'npm start';
  summary.dir = dir;
  return summary;
}


// ===== v2.5 ENGINES: Explain, Review, Swarm, Changelog, Learned Fixes =====
var LEARNED_PATH = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.stew', 'learned.md');

function loadLearned() {
  try { return fs.readFileSync(LEARNED_PATH, 'utf8').split('---').slice(-6).join('---').trim(); } catch (e) { return ''; }
}

function saveLearned(task, fixes) {
  try {
    fs.mkdirSync(path.dirname(LEARNED_PATH), { recursive: true });
    fs.appendFileSync(LEARNED_PATH, '\n---\nTASK: ' + String(task).slice(0, 120) + '\nFIX: ' + fixes.join('; ').slice(0, 400) + '\n');
  } catch (e) {}
}

function _issues(v) {
  var out = [];
  for (var k in (v.passes || {})) { var p = v.passes[k]; if (p && p.issues) out = out.concat(p.issues); }
  return out;
}

async function explainCodebase(client, question, cwd) {
  var pc = files.projectContext(cwd);
  var all = files.listFiles(cwd);
  var key = all.filter(function (f) { return /\.(js|ts|py|go|rs|java|php|rb|json)$/i.test(f) && !/node_modules|lock|min\.|test|spec/i.test(f); }).slice(0, 14);
  var map = 'PROJECT TYPE: ' + pc.type + ' | ' + all.length + ' files\nSTRUCTURE:\n' + String(pc.structure || '').slice(0, 2000) + '\n';
  for (var i = 0; i < key.length && map.length < 14000; i++) {
    try { var r = files.readFileSync(path.join(cwd, key[i])); map += '\n=== ' + key[i] + ' ===\n' + r.content.split('\n').slice(0, 50).join('\n'); } catch (e) {}
  }
  var a = await _bllm(client, [
    { role: 'system', content: 'You are Stew Code. Answer questions about a codebase using the repo map. Cite file paths. Be concise. If the answer is not fully in the map, say which files to read next.' },
    { role: 'user', content: 'REPO MAP:\n' + map.slice(0, 15000) + '\n\nQUESTION: ' + question }
  ]);
  return String(a || '').trim();
}

async function reviewCode(client, cwd, opts) {
  opts = opts || {};
  var targets = (opts.files && opts.files.length) ? opts.files : null;
  if (!targets) {
    var changed = [];
    try { changed = execSync('git status --porcelain', { cwd: cwd }).toString().trim().split('\n').filter(Boolean).map(function (l) { return l.slice(3).trim(); }); } catch (e) {}
    targets = changed.length ? changed : files.listFiles(cwd).filter(function (f) { return /\.(js|ts|py)$/i.test(f) && !/node_modules|test|spec/i.test(f); }).slice(0, 6);
  }
  var out = [];
  for (var t of targets.slice(0, 8)) {
    var p = path.join(cwd, t);
    if (!fs.existsSync(p)) continue;
    try {
      var r = files.readFileSync(p);
      if (r.content.length > 18000) continue;
      var sc = []; try { sc = (scanFile(p).findings || []).map(function (f) { return f.issue; }); } catch (e) {}
      var a = await _bllm(client, [
        { role: 'system', content: 'You are Stew Code reviewing code. Find: bugs, security issues, performance problems, dead code, architecture improvements. Plain text, max 10 lines per file. Format: [SEVERITY] issue - how to fix. Only real issues, no praise, no filler.' },
        { role: 'user', content: 'FILE: ' + t + '\n```\n' + r.content + '\n```\n\nSecurity scanner flagged: ' + (sc.length ? sc.join(', ') : 'nothing') }
      ]);
      if (a && String(a).trim()) out.push({ file: t, review: String(a).trim(), flagged: sc.length });
    } catch (e) {}
  }
  return out;
}

async function runSwarm(client, task, cwd, opts) {
  opts = opts || {};
  var log = opts.log || function () {};
  log('Swarming: ' + task);
  var plan = _bjson(await _bllm(client, [
    { role: 'system', content: 'You are the Planner agent. Break the task into 2-4 concrete subtasks for roles: backend, frontend, qa, docs. Reply ONLY JSON: {"subtasks":[{"role":"backend","desc":"..."}]}' },
    { role: 'user', content: 'Task: ' + task + '\nExisting files:\n' + files.listFiles(cwd).slice(0, 50).join('\n') }
  ]));
  var subs = (plan && plan.subtasks && plan.subtasks.length) ? plan.subtasks : [{ role: 'backend', desc: task }];
  log('Plan: ' + subs.length + ' subtasks (' + subs.map(function (s) { return s.role; }).join(', ') + ')');
  var learned = loadLearned();
  var results = await Promise.all(subs.slice(0, 4).map(async function (s) {
    var r = await _bllm(client, [
      { role: 'system', content: 'You are the ' + s.role + ' agent on a team building: ' + task + '. Do ONLY your own subtask, do not touch other roles files. For each file output exactly one block:\n```lang path\n// filepath: relative/path/to/file\n<complete file content>\n```' + (learned ? '\n\nLearned fixes from past sessions:\n' + learned : '') },
      { role: 'user', content: 'Subtask: ' + s.desc + '\nExisting files:\n' + files.listFiles(cwd).slice(0, 40).join('\n') }
    ]);
    return { role: s.role, out: String(r || '') };
  }));
  var written = [], failed = [];
  for (var res of results) {
    var blocks = res.out.match(/```[a-zA-Z]*[^\n]*\n[\s\S]*?```/g) || [];
    for (var b of blocks) {
      var body = _bstrip(b);
      var fm = body.match(/^\/\/\s*filepath:\s*(.+)/);
      if (!fm) continue;
      var fpath = fm[1].trim();
      var content = body.replace(/^\/\/\s*filepath:[^\n]*\n/, '');
      var full = path.join(cwd, fpath);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
      var v = /\.js$/.test(fpath) ? verifyCode(content, fpath) : { allPass: true, passes: {} };
      (v.allPass ? written : failed).push(fpath);
      if (!v.allPass) log('  [' + res.role + '] ' + fpath + ': ' + _issues(v).join('; ').slice(0, 100));
    }
  }
  for (var fp of failed.slice(0, 4)) {
    try { var fr = await fixProject(client, cwd, { files: [fp], log: function () {} }); if (fr && fr.fixed && fr.fixed.length) { saveLearned(task, _issues(verifyCode(fs.readFileSync(path.join(cwd, fp), 'utf8'), fp)).length ? [] : [fp + ' auto-fixed']); } } catch (e) {}
  }
  return { subtasks: subs.length, roles: subs.map(function (s) { return s.role; }), written: written, failed: failed };
}

async function genChangelog(client, cwd) {
  var logTxt = '';
  try { logTxt = execSync('git log --oneline -40', { cwd: cwd }).toString().trim(); } catch (e) { return null; }
  var cl = await _bllm(client, [
    { role: 'system', content: 'You are Stew Code. Turn git history into a clean CHANGELOG.md in Keep a Changelog format (Added/Changed/Fixed/Removed). Concise, no fluff.' },
    { role: 'user', content: logTxt }
  ]);
  return String(cl || '').trim() || null;
}

module.exports = { scan, scanFile, scanDir, PATTERNS, verifyCode, verifySession, buildApp, fixProject, testProject, genDocs, explainCodebase, reviewCode, runSwarm, genChangelog, loadLearned, saveLearned };
