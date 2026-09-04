const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

const MAX_FILE_SIZE = 512 * 1024;
const MAX_FILES_LIST = 500;
const BINARY_EXTS = new Set([
'.png','.jpg','.jpeg','.gif','.bmp','.ico','.webp','.svg','.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.zip','.gz','.tar','.rar','.7z','.deb','.dmg','.iso','.exe','.dll','.so','.dylib','.bin','.dat','.mp3','.mp4','.avi','.mov','.wav','.flac','.ogg','.webm','.woff','.woff2','.ttf','.eot','.otf','.pyc','.pyo','.class','.o','.a','.lib','.node','.wasm',
]);
function imageMime(filePath) {
  var ext = require('path').extname(filePath).slice(1).toLowerCase();
  if (ext === 'jpg') ext = 'jpeg';
  if (['png', 'jpeg', 'gif', 'webp'].indexOf(ext) < 0) ext = 'jpeg'; // unknown/no extension: best-effort guess only
  return ext;
}
function isBinary(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  return BINARY_EXTS.has(ext);
}
function readFileSync(filepath, maxSize) {
  maxSize = maxSize || MAX_FILE_SIZE;
  const resolved = path.resolve(filepath);
  const stat = fs.statSync(resolved);
  if (stat.size > maxSize) {
    return { content: '[File too large: ' + stat.size + ' bytes]', truncated: true, size: stat.size };
  }
  if (isBinary(resolved)) {
    return { content: '[Binary file: ' + path.basename(resolved) + ']', binary: true, size: stat.size };
  }
  const content = fs.readFileSync(resolved, 'utf8');
  return { content: content, size: stat.size };
}
function globMatch(pattern, filepath) {
  var p = pattern.replace(/\\/g, '/').replace(/^\.\//, '');
  var f = filepath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (p === '**/*' || p === '*') return true;
  if (p.indexOf('**/') === 0) {
    var suffix = p.substring(3);
    var suffixRe = suffix
      .replace(/\./g, '\\.')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
    var re = new RegExp('^(?:.*/)?' + suffixRe + '$');
    return re.test(f);
  }
  var regex = p
    .replace(/\*\*/g, '\x00')
    .replace(/\*/g, '[^/]*')
    .replace(/\x00/g, '.*')
    .replace(/\?/g, '[^/]')
    .replace(/\./g, '\\.');
  return new RegExp('^' + regex + '$').test(f);
}
function listFiles(dir, pattern, options) {
  dir = dir || '.';
  pattern = pattern || '**/*';
  options = options || {};
  var root = path.resolve(dir);
  var results = [];
  var ignoreDirs = new Set([
    'node_modules', '.git', '__pycache__', '.next', '.nuxt',
    'dist', 'build', '.cache', '.turbo', 'venv', '.venv',
    'env', '.env', 'coverage', '.pytest_cache', '.mypy_cache',
  ]);
  if (options.ignore) {
    for (var i = 0; i < options.ignore.length; i++) {
      ignoreDirs.add(options.ignore[i]);
    }
  }
  function walk(currentDir, depth) {
    depth = depth || 0;
    if (depth > (options.maxDepth || 15) || results.length >= MAX_FILES_LIST) return;
    var entries;
    try { entries = fs.readdirSync(currentDir, { withFileTypes: true }); }
    catch (e) { return; }
    for (var j = 0; j < entries.length; j++) {
      var entry = entries[j];
      var fullPath = path.join(currentDir, entry.name);
      var relPath = path.relative(root, fullPath);
      if (entry.isDirectory()) {
        if (ignoreDirs.has(entry.name)) continue;
        walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        if (isBinary(fullPath) && !options.includeBinary) continue;
        if (pattern === '**/*' || globMatch(pattern, relPath)) {
          results.push(relPath);
        }
      }
      if (results.length >= MAX_FILES_LIST) return;
    }
  }
  walk(root);
  return results.sort();
}
function projectContext(dir) {
  dir = dir || '.';
  var root = path.resolve(dir);
  var info = { root: root, type: 'unknown', files: [], structure: '', stats: {}, config: {} };
  var markers = [
    ['package.json', 'node'],
    ['pyproject.toml', 'python'],
    ['requirements.txt', 'python'],
    ['setup.py', 'python'],
    ['Cargo.toml', 'rust'],
    ['go.mod', 'go'],
    ['pom.xml', 'java'],
    ['build.gradle', 'java'],
    ['CMakeLists.txt', 'cpp'],
    ['Dockerfile', 'docker'],
  ];
  for (var i = 0; i < markers.length; i++) {
    if (fs.existsSync(path.join(root, markers[i][0]))) {
      info.type = markers[i][1];
      break;
    }
  }
  info.files = listFiles(root, '**/*', { maxDepth: 5 });
  info.structure = buildTree(root);
  info.stats.totalFiles = info.files.length;
  info.stats.byExt = {};
  for (var j = 0; j < info.files.length; j++) {
    var ext = path.extname(info.files[j]) || '(no ext)';
    info.stats.byExt[ext] = (info.stats.byExt[ext] || 0) + 1;
  }
  var keyFiles = ['package.json', 'pyproject.toml', 'requirements.txt', 'Cargo.toml', 'go.mod', 'README.md', '.stew/rules', 'STEW.md', 'AGENTS.md'];
  for (var k = 0; k < keyFiles.length; k++) {
    var p = path.join(root, keyFiles[k]);
    if (fs.existsSync(p)) {
      try {
        var stat = fs.statSync(p);
        if (stat.size < 10000) {
          info.config[keyFiles[k]] = fs.readFileSync(p, 'utf8').slice(0, 2000);
        }
      } catch (e) {}
    }
  }
  return info;
}
var _ignoreDirs = new Set([
  'node_modules', '.git', '__pycache__', '.next', '.nuxt',
  'dist', 'build', '.cache', '.turbo', 'venv', '.venv',
]);
function buildTree(root, prefix, depth, maxDepth) {
  prefix = prefix || '';
  depth = depth || 0;
  maxDepth = maxDepth || 3;
  if (depth > maxDepth) return prefix + '...\n';
  var entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); }
  catch (e) { return ''; }
  var dirs = entries.filter(function(e) { return e.isDirectory() && !_ignoreDirs.has(e.name); })
    .sort(function(a, b) { return a.name.localeCompare(b.name); });
  var files = entries.filter(function(e) { return e.isFile() && !isBinary(path.join(root, e.name)); })
    .sort(function(a, b) { return a.name.localeCompare(b.name); });
  var all = dirs.concat(files);
  var result = '';
  for (var i = 0; i < all.length; i++) {
    var entry = all[i];
    var isLast = i === all.length - 1;
    var connector = isLast ? '└── ' : '├── ';
    var childPrefix = prefix + (isLast ? '    ' : '│   ');
    result += prefix + connector + entry.name + (entry.isDirectory() ? '/' : '') + '\n';
    if (entry.isDirectory()) {
      result += buildTree(path.join(root, entry.name), childPrefix, depth + 1, maxDepth);
    }
  }
  return result;
}
function diff(oldText, newText) {
  var oldLines = oldText.split('\n');
  var newLines = newText.split('\n');
  var result = [];
  var i = 0, j = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      i++; j++;
    } else {
      var oldEnd = i, newEnd = j;
      while (oldEnd < oldLines.length && newEnd < newLines.length && oldLines[oldEnd] !== newLines[newEnd]) {
        oldEnd++; newEnd++;
      }
      while (i < oldEnd) {
        result.push('\x1b[31m- ' + oldLines[i] + '\x1b[0m');
        i++;
      }
      while (j < newEnd) {
        result.push('\x1b[32m+ ' + newLines[j] + '\x1b[0m');
        j++;
      }
    }
  }
  return result.join('\n');
}
class UndoStack {
  constructor() {
    this.stack = [];
  }
  push(action) {
    this.stack.push(action);
    if (this.stack.length > 50) this.stack.shift();
  }
  pop() {
    return this.stack.pop();
  }
  get hasItems() {
    return this.stack.length > 0;
  }
  clear() {
    this.stack = [];
  }
}

/**
 * Session persistence for Stew Code — saves/loads conversations locally.
 * Zero dependency — uses fs only.
 */

const sessionDir = path.join(os.homedir(), '.stew', 'sessions');

function ensureSessionDir() {
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
}

function saveSession(name, messages, meta = {}) {
  ensureSessionDir();
  const filename = name.replace(/[^a-zA-Z0-9-_]/g, '_') + '.json';
  const filepath = path.join(sessionDir, filename);
  const data = {
    name,
    messages,
    meta: { ...meta, savedAt: new Date().toISOString() },
  };
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  return filepath;
}

function loadSession(name) {
  const filename = name.replace(/[^a-zA-Z0-9-_]/g, '_') + '.json';
  const filepath = path.join(sessionDir, filename);
  if (!fs.existsSync(filepath)) return null;
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  return data;
}

function listSessions() {
  ensureSessionDir();
  const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(sessionDir, f), 'utf8'));
      return {
        name: data.name || f.replace('.json', ''),
        messages: data.messages?.length || 0,
        savedAt: data.meta?.savedAt || '',
      };
    } catch {
      return { name: f.replace('.json', ''), messages: 0, savedAt: '' };
    }
  });
}

function deleteSession(name) {
  const filename = name.replace(/[^a-zA-Z0-9-_]/g, '_') + '.json';
  const filepath = path.join(sessionDir, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    return true;
  }
  return false;
}

/**
 * Git operations for Stew Code — zero dependency, uses child_process.execSync.
 */

function gitExec(args, dir = '.', options = {}) {
  try {
    const result = execSync(`git ${args}`, {
      cwd: dir,
      encoding: 'utf8',
      timeout: options.timeout || 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { ok: true, output: result.trim() };
  } catch (err) {
    return { ok: false, output: err.stderr?.trim() || err.message };
  }
}

function isGitRepo(dir = '.') {
  const result = gitExec('rev-parse --is-inside-work-tree', dir);
  return result.ok;
}

function status(dir = '.') {
  const branch = gitExec('branch --show-current', dir);
  const st = gitExec('status --short', dir);
  const staged = gitExec('diff --cached --stat', dir);

  return {
    isRepo: true,
    branch: branch.ok ? branch.output : 'unknown',
    changes: st.ok ? st.output.split('\n').filter(l => l.trim()) : [],
    staged: staged.ok ? staged.output : '',
  };
}

function diff(dir = '.', staged = false) {
  const flag = staged ? '--cached' : '';
  const result = gitExec(`diff ${flag}`, dir);
  return result.ok ? result.output : '';
}

function log(dir = '.', count = 10) {
  const result = gitExec(
    `log --oneline -${count} --format="%h %s (%cr)"`,
    dir
  );
  return result.ok ? result.output : '';
}

function commit(message, dir = '.') {
  const result = gitExec(`commit -m "${message.replace(/"/g, '\\"')}"`, dir);
  return result;
}

function addAll(dir = '.') {
  return gitExec('add -A', dir);
}

function currentBranch(dir = '.') {
  const result = gitExec('branch --show-current', dir);
  return result.ok ? result.output : 'unknown';
}

module.exports = { readFileSync, isBinary, listFiles, globMatch, projectContext, buildTree, diff, UndoStack, MAX_FILE_SIZE, saveSession, loadSession, listSessions, deleteSession, sessionDir, gitExec, isGitRepo, status, log, commit, addAll, currentBranch, imageMime };
