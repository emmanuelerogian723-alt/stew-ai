const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const SKILLS_DIR = path.join(os.homedir(), '.stew', 'skills');

const BUILTIN_SKILLS = {
  scaffold: {
    name: 'scaffold', description: 'Scaffold a project', usage: '/skill scaffold <type> <name>',
    run: function(args, cwd) {
      var type = args[0] || 'express', name = args[1] || 'my-app', dir = path.join(cwd, name);
      var T = {
        express: { 'package.json': JSON.stringify({name,version:'1.0.0',main:'index.js',scripts:{start:'node index.js'},dependencies:{express:'^4.18.0'}},null,2), 'index.js': "const express=require('express');\nconst app=express();\napp.get('/',(r,s)=>s.json({status:'ok'}));\napp.listen(3000,()=>console.log('Running on 3000'));" },
        react: { 'package.json': JSON.stringify({name,version:'1.0.0',scripts:{dev:'vite',build:'vite build'},dependencies:{react:'^18.2.0','react-dom':'^18.2.0'},devDependencies:{vite:'^5.0.0','@vitejs/plugin-react':'^4.0.0'}},null,2), 'index.html': '<div id="root"></div><script type="module" src="/src/main.jsx"></script>', 'src/main.jsx': "import React from'react';import ReactDOM from'react-dom/client';import App from'./App';ReactDOM.createRoot(document.getElementById('root')).render(<App/>)", 'src/App.jsx': "export default()=>(<div><h1>"+name+"</h1></div>)" },
        flask: { 'requirements.txt': 'flask>=3.0', 'app.py': "from flask import Flask\napp=Flask(__name__)\n@app.route('/')\ndef health():return{'status':'ok'}\nif __name__=='__main__':app.run(port=5000)" },
        fastapi: { 'requirements.txt': 'fastapi>=0.100\nuvicorn>=0.24', 'main.py': "from fastapi import FastAPI\napp=FastAPI()\n@app.get('/')\ndef health():return{'status':'ok'}" },
        static: { 'index.html': '<!DOCTYPE html><html><head><title>'+name+'</title></head><body><h1>'+name+'</h1></body></html>', 'style.css': '', 'script.js': '' },
        cli: { 'package.json': JSON.stringify({name,version:'1.0.0',bin:{[name]:'./index.js'}},null,2), 'index.js': "#!/usr/bin/env node\nconsole.log('"+name+" CLI')" },
        next: { 'package.json': JSON.stringify({name,version:'1.0.0',scripts:{dev:'next dev',build:'next build'},dependencies:{next:'^14.0.0',react:'^18.2.0','react-dom':'^18.2.0'}},null,2), 'app/page.js': "export default function Page(){return <div><h1>"+name+"</h1></div> }", 'app/layout.js': "export default function RootLayout({children}){return <html><body>{children}</body></html> }" },
        python: { 'requirements.txt': '', 'main.py': "def main():\n    print('"+name+"')\nif __name__=='__main__':\n    main()", 'README.md': '# '+name },
      };
      var t = T[type]; if (!t) return { success: false, output: 'Unknown type: '+type+'. Available: '+Object.keys(T).join(', ') };
      fs.mkdirSync(dir, {recursive: true});
      for (var f in t) { var fp = path.join(dir, f); fs.mkdirSync(path.dirname(fp), {recursive: true}); fs.writeFileSync(fp, t[f]); }
      return { success: true, output: 'Scaffolded ' + type + ' project: ' + name + ' (' + Object.keys(t).length + ' files)' };
    }
  },
  test: {
    name: 'test', description: 'Generate test files', usage: '/skill test <file>',
    run: function(args, cwd) {
      var file = args[0]; if (!file) return { success: false, output: 'Usage: /skill test <file>' };
      var ext = path.extname(file), base = path.basename(file, ext);
      var content = fs.readFileSync(path.join(cwd, file), 'utf8');
      var tests = {
        '.js': "const test = require('node:test');\nconst assert = require('node:assert');\n// TODO: import and test functions from " + file + "\ntest('placeholder', () => { assert.ok(true); });\n",
        '.py': "import unittest\n# TODO: import from " + file + "\nclass Test" + base + "(unittest.TestCase):\n    def test_placeholder(self):\n        self.assertTrue(True)\nif __name__ == '__main__':\n    unittest.main()\n",
        '.ts': "import { test, assert } from 'node:test/';\n// TODO: import from " + file + "\ntest('placeholder', () => { assert.ok(true); });\n",
      };
      var t = tests[ext] || tests['.js'];
      var testFile = 'test/' + base + '.test' + ext;
      var fp = path.join(cwd, testFile);
      fs.mkdirSync(path.dirname(fp), {recursive: true}); fs.writeFileSync(fp, t);
      return { success: true, output: 'Created: ' + testFile };
    }
  },
  docker: {
    name: 'docker', description: 'Generate Dockerfile', usage: '/skill docker [type]',
    run: function(args, cwd) {
      var type = args[0] || 'node';
      var D = {
        node: 'FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --production\nCOPY . .\nCMD ["node", "index.js"]',
        python: 'FROM python:3.11-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install -r requirements.txt\nCOPY . .\nCMD ["python", "main.py"]',
        static: 'FROM nginx:alpine\nCOPY . /usr/share/nginx/html',
        multi: 'FROM node:20 AS build\nWORKDIR /app\nCOPY . .\nRUN npm ci && npm run build\nFROM nginx:alpine\nCOPY --from=build /app/dist /usr/share/nginx/html',
      };
      fs.writeFileSync(path.join(cwd, 'Dockerfile'), D[type] || D.node);
      return { success: true, output: 'Created Dockerfile (' + type + ')' };
    }
  },
  ci: {
    name: 'ci', description: 'Generate CI config', usage: '/skill ci [github|gitlab]',
    run: function(args, cwd) {
      var p = args[0] || 'github';
      if (p === 'github') {
        var dir = path.join(cwd, '.github/workflows');
        fs.mkdirSync(dir, {recursive: true});
        fs.writeFileSync(path.join(dir, 'ci.yml'), 'name: CI\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n      - run: npm ci\n      - run: npm test\n');
        return { success: true, output: 'Created .github/workflows/ci.yml' };
      }
      fs.writeFileSync(path.join(cwd, '.gitlab-ci.yml'), 'image: node:20\ntest:\n  script:\n    - npm ci\n    - npm test\n');
      return { success: true, output: 'Created .gitlab-ci.yml' };
    }
  },
  env: {
    name: 'env', description: 'Generate .env.example', usage: '/skill env',
    run: function(args, cwd) {
      var files = fs.readdirSync(cwd); var vars = [];
      function scan(d) { try { for (var f of fs.readdirSync(d)) { if (f === 'node_modules' || f.startsWith('.')) continue; var fp = path.join(d, f); if (fs.statSync(fp).isDirectory()) scan(fp); else if (/\.(js|ts|py)$/.test(f)) { var c = fs.readFileSync(fp, 'utf8'); var m = c.match(/process\.env\.(\w+)/g) || c.match(/os\.environ\.get\(['"](\w+)/g) || []; for (var v of m) { var n = v.replace(/.*\.env\.?get\(['"]/, '').replace(/['"]/, ''); if (n && !vars.includes(n)) vars.push(n); } } } } catch(e) {} }
      scan(cwd);
      var content = vars.length ? vars.map(v => v + '=').join('\n') : '# Add your env vars here\nAPI_KEY=';
      fs.writeFileSync(path.join(cwd, '.env.example'), content + '\n');
      return { success: true, output: 'Created .env.example with ' + vars.length + ' vars' };
    }
  },
  gitignore: {
    name: 'gitignore', description: 'Generate .gitignore', usage: '/skill gitignore [type]',
    run: function(args, cwd) {
      var type = args[0] || 'node';
      var G = {
        node: 'node_modules/\n.env\ndist/\n*.log\n.DS_Store\ncoverage/\n',
        python: '__pycache__/\n*.pyc\n.env\nvenv/\n*.egg-info/\n.pytest_cache/\n',
        go: '*.exe\n*.exe~\n*.dll\n*.so\n*.dylib\nvendor/\n.env\n',
        rust: 'target/\n*.rs.bk\n.env\nCargo.lock\n',
        generic: '*.log\n.env\n.DS_Store\ntmp/\ndist/\n',
      };
      fs.writeFileSync(path.join(cwd, '.gitignore'), G[type] || G.generic);
      return { success: true, output: 'Created .gitignore (' + type + ')' };
    }
  },
  deps: {
    name: 'deps', description: 'Analyze dependencies', usage: '/skill deps',
    run: function(args, cwd) {
      var pj = path.join(cwd, 'package.json');
      if (!fs.existsSync(pj)) return { success: false, output: 'No package.json found' };
      var pkg = JSON.parse(fs.readFileSync(pj, 'utf8'));
      var deps = Object.keys(pkg.dependencies || {}); var dev = Object.keys(pkg.devDependencies || {});
      var out = 'Dependencies (' + deps.length + '):\n' + deps.map(d => '  ' + d + ': ' + pkg.dependencies[d]).join('\n');
      out += '\n\nDevDependencies (' + dev.length + '):\n' + dev.map(d => '  ' + d + ': ' + pkg.devDependencies[d]).join('\n');
      return { success: true, output: out };
    }
  },
  explain: {
    name: 'explain', description: 'Explain code in a file', usage: '/skill explain <file>',
    run: function(args, cwd) {
      var file = args[0]; if (!file) return { success: false, output: 'Usage: /skill explain <file>' };
      var content = fs.readFileSync(path.join(cwd, file), 'utf8');
      var lines = content.split('\n'), out = 'File: ' + file + ' (' + lines.length + ' lines)\n\n';
      for (var i = 0; i < Math.min(lines.length, 50); i++) out += (i+1) + ': ' + lines[i] + '\n';
      if (lines.length > 50) out += '... (' + (lines.length - 50) + ' more lines)';
      return { success: true, output: out };
    }
  },
  security: {
    name: 'security', description: 'Basic security check', usage: '/skill security [file]',
    run: function(args, cwd) {
      var target = args[0] || cwd;
      var patterns = [
        { p: /api[_-]?key\s*=\s*['"][^'"]+['"]/gi, m: 'Hardcoded API key' },
        { p: /password\s*=\s*['"][^'"]+['"]/gi, m: 'Hardcoded password' },
        { p: /secret\s*=\s*['"][^'"]+['"]/gi, m: 'Hardcoded secret' },
        { p: /eval\s*\(/g, m: 'Use of eval() - code injection risk' },
        { p: /exec\s*\(/g, m: 'Use of exec() - command injection risk' },
      ];
      var findings = [];
      function scan(f) { var c = fs.readFileSync(f, 'utf8'); for (var p of patterns) { var m = c.match(p.p); if (m) findings.push({file: f, issue: p.m, count: m.length}); } }
      if (fs.statSync(target).isDirectory()) {
        function walk(d) { for (var f of fs.readdirSync(d)) { if (f.startsWith('.') || f === 'node_modules') continue; var fp = path.join(d, f); if (fs.statSync(fp).isDirectory()) walk(fp); else if (/\.(js|ts|py)$/.test(f)) scan(fp); } }
        walk(target);
      } else scan(target);
      if (!findings.length) return { success: true, output: 'No obvious security issues found.' };
      return { success: true, output: 'Security findings:\n' + findings.map(f => '  ' + f.file + ': ' + f.issue + ' (' + f.count + 'x)').join('\n') };
    }
  },
  size: {
    name: 'size', description: 'Analyze bundle/file sizes', usage: '/skill size',
    run: function(args, cwd) {
      var files = []; function walk(d) { for (var f of fs.readdirSync(d)) { if (f === 'node_modules' || f.startsWith('.')) continue; var fp = path.join(d, f); var s = fs.statSync(fp); if (s.isDirectory()) walk(fp); else files.push({path: fp, size: s.size}); } }
      walk(cwd); files.sort((a, b) => b.size - a.size);
      var total = files.reduce((s, f) => s + f.size, 0);
      var out = 'Total: ' + (total / 1024).toFixed(1) + 'KB across ' + files.length + ' files\n\nTop 10:\n';
      out += files.slice(0, 10).map(f => '  ' + (f.size / 1024).toFixed(1) + 'KB ' + f.path.replace(cwd + '/', '')).join('\n');
      return { success: true, output: out };
    }
  },
  translate: {
    name: 'translate', description: 'Translate code to another language', usage: '/skill translate <file> <lang>',
    run: function(args, cwd) {
      var file = args[0], lang = args[1]; if (!file || !lang) return { success: false, output: 'Usage: /skill translate <file> <lang>' };
      var content = fs.readFileSync(path.join(cwd, file), 'utf8');
      return { success: true, output: 'Use: stew code\nThen: Translate ' + file + ' to ' + lang + '\n\nPaste this:\n' + content.substring(0, 2000) };
    }
  },
  refactor: {
    name: 'refactor', description: 'Get refactoring suggestions', usage: '/skill refactor <file>',
    run: function(args, cwd) {
      var file = args[0]; if (!file) return { success: false, output: 'Usage: /skill refactor <file>' };
      var c = fs.readFileSync(path.join(cwd, file), 'utf8'); var lines = c.split('\n');
      var issues = [];
      if (lines.length > 300) issues.push('File is very long (' + lines.length + ' lines) — consider splitting');
      if (c.includes('var ')) issues.push('Uses var — consider const/let');
      if ((c.match(/function /g) || []).length > 10) issues.push('Many functions — consider modularizing');
      if (!issues.length) issues.push('No obvious refactoring needed');
      return { success: true, output: 'Refactoring suggestions for ' + file + ':\n' + issues.map(i => '  ' + i).join('\n') };
    }
  },
  document: {
    name: 'document', description: 'Generate JSDoc/docstrings', usage: '/skill document <file>',
    run: function(args, cwd) {
      var file = args[0]; if (!file) return { success: false, output: 'Usage: /skill document <file>' };
      var c = fs.readFileSync(path.join(cwd, file), 'utf8'); var lines = c.split('\n');
      var fns = lines.filter(l => /function |def |const \w+ = \(/.test(l));
      return { success: true, output: 'Functions found in ' + file + ':\n' + fns.map(f => '  ' + f.trim()).join('\n') + '\n\nUse stew code to generate full docs.' };
    }
  },
  clean: {
    name: 'clean', description: 'Remove common junk files', usage: '/skill clean',
    run: function(args, cwd) {
      var junk = ['.DS_Store', 'Thumbs.db', '*.log', '*.tmp', '*.bak'];
      var removed = 0;
      function walk(d) { for (var f of fs.readdirSync(d)) { var fp = path.join(d, f); if (fs.statSync(fp).isDirectory()) walk(fp); else if (junk.some(j => new RegExp(j.replace('*', '.*')).test(f))) { fs.unlinkSync(fp); removed++; } } }
      walk(cwd); return { success: true, output: 'Removed ' + removed + ' junk file(s)' };
    }
  },
  loc: {
    name: 'loc', description: 'Count lines of code', usage: '/skill loc',
    run: function(args, cwd) {
      var stats = { files: 0, lines: 0, blank: 0, code: 0 };
      function walk(d) { for (var f of fs.readdirSync(d)) { if (f === 'node_modules' || f.startsWith('.')) continue; var fp = path.join(d, f); if (fs.statSync(fp).isDirectory()) walk(fp); else if (/\.(js|ts|py|go|rs|java|c|cpp|rb)$/.test(f)) { stats.files++; var c = fs.readFileSync(fp, 'utf8').split('\n'); stats.lines += c.length; stats.blank += c.filter(l => !l.trim()).length; stats.code += c.filter(l => l.trim() && !l.trim().startsWith('//')).length; } } }
      walk(cwd);
      return { success: true, output: 'Lines of Code:\n  Files: ' + stats.files + '\n  Total: ' + stats.lines + '\n  Code: ' + stats.code + '\n  Blank: ' + stats.blank };
    }
  },
  format: {
    name: 'format', description: 'Format code in a file', usage: '/skill format <file>',
    run: function(args, cwd) {
      var file = args[0]; if (!file) return { success: false, output: 'Usage: /skill format <file>' };
      var fp = path.join(cwd, file); var c = fs.readFileSync(fp, 'utf8');
      var formatted = c.replace(/;\s*\n/g, ';\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/gm, '');
      fs.writeFileSync(fp, formatted);
      return { success: true, output: 'Formatted: ' + file };
    }
  },
  checklist: {
    name: 'checklist', description: 'Code review checklist', usage: '/skill checklist',
    run: function(args, cwd) {
      var items = ['No hardcoded secrets/keys', 'Error handling on all async operations', 'Input validation on all endpoints', 'No console.log in production code', 'Proper HTTP status codes', 'Consistent naming convention', 'Tests for critical paths', 'Documentation for public APIs', 'No unused dependencies', 'Security headers configured'];
      return { success: true, output: 'Code Review Checklist:\n' + items.map((i, n) => '  ' + (n+1) + '. ' + i).join('\n') };
    }
  },
};

function listSkills() {
  var builtins = Object.keys(BUILTIN_SKILLS);
  var custom = [];
  if (fs.existsSync(SKILLS_DIR)) { custom = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.js')).map(f => f.replace('.js', '')); }
  return { builtins, custom };
}

function runSkill(name, args, cwd) {
  cwd = cwd || process.cwd();
  if (BUILTIN_SKILLS[name]) { try { return BUILTIN_SKILLS[name].run(args, cwd); } catch (e) { return { success: false, output: 'Error: ' + e.message }; } }
  var fp = path.join(SKILLS_DIR, name + '.js');
  if (fs.existsSync(fp)) { try { var mod = require(fp); return mod.run ? mod.run(args, cwd) : { success: false, output: 'Invalid skill' }; } catch (e) { return { success: false, output: 'Error: ' + e.message }; } }
  return { success: false, output: 'Skill not found: ' + name + '. Use /skills to list.' };
}

function forgeSkill(name, desc) {
  if (!name || !desc) return { success: false, output: 'Usage: /forge <name> <description>' };
  if (BUILTIN_SKILLS[name]) return { success: false, output: 'Cannot override built-in: ' + name };
  fs.mkdirSync(SKILLS_DIR, {recursive: true});
  var code = "const fs = require('fs');\nconst path = require('path');\n\nmodule.exports = {\n  name: '" + name + "',\n  description: '" + desc + "',\n  run: function(args, cwd) {\n    // TODO: Implement '" + desc + "'\n    return { success: true, output: 'Skill " + name + " executed with args: ' + args.join(' ') };\n  }\n};\n";
  fs.writeFileSync(path.join(SKILLS_DIR, name + '.js'), code);
  return { success: true, output: 'Created skill: ' + name + ' at ' + path.join(SKILLS_DIR, name + '.js') };
}

function deleteSkill(name) {
  var fp = path.join(SKILLS_DIR, name + '.js');
  if (fs.existsSync(fp)) { fs.unlinkSync(fp); return { success: true, output: 'Deleted skill: ' + name }; }
  return { success: false, output: 'Skill not found: ' + name };
}

module.exports = { BUILTIN_SKILLS, listSkills, runSkill, forgeSkill, deleteSkill };
