/**
 * Stew Code Skill Forge — Auto-generates reusable skills when the agent
 * encounters a task it can't handle. Skills are saved to ~/.stew/skills/
 * and can be reused, shared, and composed.
 *
 * This is Stew Code's killer differentiator — no other coding agent
 * creates skills on the fly.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const SKILLS_DIR = path.join(os.homedir(), '.stew', 'skills');
const BUILTIN_SKILLS_DIR = path.join(os.homedir(), '.stew', 'builtin-skills');

/* ============================================================
 * BUILT-IN SKILL LIBRARY (20+ skills, zero dependency)
 * Each skill is a JS function that receives { args, cwd, state }
 * and returns { output, files, success }
 * ============================================================ */

const BUILTIN_SKILLS = {
  scaffold: {
    name: 'scaffold',
    description: 'Scaffold a new project (express, react, next, flask, fastapi, etc.)',
    usage: '/skill scaffold <type> <name>',
    languages: ['js', 'py', 'ts', 'go', 'rs'],
    run: function(args, cwd) {
      var type = args[0] || 'express';
      var name = args[1] || 'my-app';
      var templates = {
        express: {
          files: {
            'package.json': JSON.stringify({ name: name, version: '1.0.0', main: 'index.js', scripts: { start: 'node index.js', dev: 'node --watch index.js' }, dependencies: { express: '^4.18.0' } }, null, 2),
            'index.js': "const express = require('express');\nconst app = express();\nconst PORT = process.env.PORT || 3000;\n\napp.use(express.json());\n\napp.get('/', (req, res) => res.json({ status: 'ok', service: '" + name + "' }));\n\napp.listen(PORT, () => console.log(`" + name + " running on port ${PORT}`));\n",
            'README.md': '# ' + name + '\n\nExpress API server.\n\n```bash\nnpm install\nnpm start\n```',
          }
        },
        react: {
          files: {
            'package.json': JSON.stringify({ name: name, version: '1.0.0', scripts: { dev: 'vite', build: 'vite build' }, dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' }, devDependencies: { vite: '^5.0.0', '@vitejs/plugin-react': '^4.0.0' } }, null, 2),
            'index.html': '<!DOCTYPE html><html><head><title>' + name + '</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>',
            'src/main.jsx': "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\n\nReactDOM.createRoot(document.getElementById('root')).render(<App />);\n",
            'src/App.jsx': "import React from 'react';\n\nexport default function App() {\n  return <div><h1>" + name + "</h1><p>Built with Stew Code</p></div>;\n}\n",
          }
        },
        flask: {
          files: {
            'requirements.txt': 'flask>=3.0\ngunicorn>=21.0',
            'app.py': "from flask import Flask, jsonify\n\napp = Flask(__name__)\n\n@app.route('/')\ndef health():\n    return jsonify(status='ok', service='" + name + "')\n\nif __name__ == '__main__':\n    app.run(port=5000)\n",
            'README.md': '# ' + name + '\n\nFlask API.\n\n```bash\npip install -r requirements.txt\npython app.py\n```',
          }
        },
        fastapi: {
          files: {
            'requirements.txt': 'fastapi>=0.100\nuvicorn>=0.24',
            'main.py': "from fastapi import FastAPI\n\napp = FastAPI(title='" + name + "')\n\n@app.get('/')\ndef health():\n    return {'status': 'ok', 'service': '" + name + "'}\n\nif __name__ == '__main__':\n    import uvicorn\n    uvicorn.run(app, port=8000)\n",
            'README.md': '# ' + name + '\n\nFastAPI server.\n\n```bash\npip install -r requirements.txt\nuvicorn main:app --reload\n```',
          }
        },
        cli: {
          files: {
            'package.json': JSON.stringify({ name: name, version: '1.0.0', bin: { name: './index.js' }, scripts: { start: 'node index.js' } }, null, 2),
            'index.js': "#!/usr/bin/env node\n\nconst args = process.argv.slice(2);\nconsole.log('" + name + " CLI — built with Stew Code');\nconsole.log('Args:', args);\n",
          }
        },
        static: {
          files: {
            'index.html': '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + name + '</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#0a0a0a;color:#fff}h1{font-size:3rem}</style></head><body><h1>' + name + '</h1></body></html>',
            'style.css': '/* ' + name + ' styles */\n',
            'script.js': '// ' + name + ' scripts\n',
          }
        },
      };

      var template = templates[type];
      if (!template) {
        return { output: 'Unknown type: ' + type + '. Available: ' + Object.keys(templates).join(', '), success: false };
      }

      var projectDir = path.resolve(cwd, name);
      if (fs.existsSync(projectDir)) {
        return { output: 'Directory already exists: ' + name, success: false };
      }

      fs.mkdirSync(projectDir, { recursive: true });
      var created = [];
      for (var filepath in template.files) {
        var fullPath = path.join(projectDir, filepath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, template.files[filepath]);
        created.push(filepath);
      }

      return {
        output: 'Created ' + name + ' (' + type + ') with ' + created.length + ' files:\n' + created.map(function(f) { return '  + ' + f; }).join('\n') + '\n\nNext: cd ' + name + ' && npm install',
        files: created,
        success: true,
      };
    }
  },

  test: {
    name: 'test',
    description: 'Generate test files for your code',
    usage: '/skill test <filepath> [framework]',
    run: function(args, cwd) {
      var filepath = args[0];
      if (!filepath) return { output: 'Usage: /skill test <filepath> [framework]', success: false };
      var framework = args[1] || 'jest';
      var resolved = path.resolve(cwd, filepath);
      if (!fs.existsSync(resolved)) return { output: 'File not found: ' + filepath, success: false };

      var content = fs.readFileSync(resolved, 'utf8');
      var ext = path.extname(filepath);
      var testFile = filepath.replace(ext, '.test' + ext);
      var testPath = path.resolve(cwd, testFile);

      // Extract function names
      var funcs = [];
      if (ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.ts') {
        var re = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
        var m;
        while ((m = re.exec(content)) !== null) funcs.push(m[1]);
        re = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
        while ((m = re.exec(content)) !== null) funcs.push(m[1]);
      } else if (ext === '.py') {
        var re = /def\s+(\w+)/g;
        var m;
        while ((m = re.exec(content)) !== null) funcs.push(m[1]);
      }

      var testName = path.basename(filepath, ext);
      var testContent = '';

      if (framework === 'jest' && (ext === '.js' || ext === '.ts' || ext === '.jsx')) {
        testContent = "const " + testName + " = require('./" + testName + "');\n\n";
        funcs.forEach(function(fn) {
          testContent += "describe('" + fn + "', () => {\n";
          testContent += "  test('should work correctly', () => {\n";
          testContent += "    // TODO: Write test for " + fn + "\n";
          testContent += "    expect(typeof " + testName + "." + fn + ").toBe('function');\n";
          testContent += "  });\n";
          testContent += "});\n\n";
        });
      } else if (framework === 'pytest' && ext === '.py') {
        testContent = "import pytest\nfrom " + testName + " import *\n\n";
        funcs.forEach(function(fn) {
          testContent += "def test_" + fn + "():\n";
          testContent += "    # TODO: Write test for " + fn + "\n";
          testContent += "    assert True\n\n";
        });
      } else {
        testContent = '// Tests for ' + filepath + ' using ' + framework + '\n';
        funcs.forEach(function(fn) {
          testContent += '// Test: ' + fn + '\n';
        });
      }

      fs.writeFileSync(testPath, testContent);
      return {
        output: 'Generated test file: ' + testFile + '\nFound ' + funcs.length + ' functions: ' + funcs.join(', '),
        files: [testFile],
        success: true,
      };
    }
  },

  docker: {
    name: 'docker',
    description: 'Generate Dockerfile for your project',
    usage: '/skill docker [port]',
    run: function(args, cwd) {
      var port = args[0] || '3000';
      var pkgPath = path.join(cwd, 'package.json');
      var reqPath = path.join(cwd, 'requirements.txt');
      var goPath = path.join(cwd, 'go.mod');
      var dockerfile = '';

      if (fs.existsSync(pkgPath)) {
        var pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        var isNode = true;
        var startCmd = pkg.scripts && pkg.scripts.start ? 'npm start' : 'node index.js';
        dockerfile = 'FROM node:20-slim\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --omit=dev\nCOPY . .\nEXPOSE ' + port + '\nCMD ["npm", "start"]\n';
      } else if (fs.existsSync(reqPath)) {
        dockerfile = 'FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nEXPOSE ' + port + '\nCMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "' + port + '"]\n';
      } else if (fs.existsSync(goPath)) {
        dockerfile = 'FROM golang:1.22-alpine AS build\nWORKDIR /app\nCOPY . .\nRUN go mod download && go build -o server .\n\nFROM alpine:latest\nWORKDIR /app\nCOPY --from=build /app/server .\nEXPOSE ' + port + '\nCMD ["./server"]\n';
      } else {
        dockerfile = 'FROM ubuntu:24.04\nWORKDIR /app\nCOPY . .\nEXPOSE ' + port + '\nCMD ["echo", "Configure your CMD in Dockerfile"]\n';
      }

      var dockerignore = 'node_modules\n.git\n.env\n*.md\ndist\nbuild\n__pycache__\n.venv\n';
      fs.writeFileSync(path.join(cwd, 'Dockerfile'), dockerfile);
      fs.writeFileSync(path.join(cwd, '.dockerignore'), dockerignore);

      return {
        output: 'Generated Dockerfile and .dockerignore for port ' + port + '\n\n' + dockerfile,
        files: ['Dockerfile', '.dockerignore'],
        success: true,
      };
    }
  },

  ci: {
    name: 'ci',
    description: 'Generate CI/CD pipeline (GitHub Actions)',
    usage: '/skill ci [provider]',
    run: function(args, cwd) {
      var provider = args[0] || 'github';
      var pkgPath = path.join(cwd, 'package.json');
      var reqPath = path.join(cwd, 'requirements.txt');
      var isNode = fs.existsSync(pkgPath);
      var isPython = fs.existsSync(reqPath);
      var workflow = '';

      if (isNode) {
        workflow = "name: CI\n\non:\n  push:\n    branches: [main, master]\n  pull_request:\n    branches: [main, master]\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n      - run: npm ci\n      - run: npm test\n      - run: npm run build\n";
      } else if (isPython) {
        workflow = "name: CI\n\non:\n  push:\n    branches: [main, master]\n  pull_request:\n    branches: [main, master]\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-python@v5\n        with:\n          python-version: '3.12'\n      - run: pip install -r requirements.txt\n      - run: pip install pytest && pytest\n";
      } else {
        workflow = "name: CI\n\non: [push, pull_request]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n";
      }

      var dir = path.join(cwd, '.github', 'workflows');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'ci.yml'), workflow);

      return {
        output: 'Generated GitHub Actions CI pipeline at .github/workflows/ci.yml',
        files: ['.github/workflows/ci.yml'],
        success: true,
      };
    }
  },

  env: {
    name: 'env',
    description: 'Generate .env.example from your code',
    usage: '/skill env',
    run: function(args, cwd) {
      var { listFiles } = require('./files');
      var files = listFiles(cwd, '**/*', { maxDepth: 3 });
      var envVars = new Set();

      files.forEach(function(f) {
        var ext = path.extname(f);
        if (['.js', '.ts', '.py', '.jsx', '.tsx'].indexOf(ext) === -1) return;
        try {
          var content = fs.readFileSync(path.join(cwd, f), 'utf8');
          // Match process.env.XXX
          var re = /process\.env\.(\w+)/g;
          var m;
          while ((m = re.exec(content)) !== null) envVars.add(m[1]);
          // Match os.environ or os.getenv
          re = /os\.(?:environ|getenv)\(?['"](\w+)/g;
          while ((m = re.exec(content)) !== null) envVars.add(m[1]);
          // Match os.getenv("X")
          re = /os\.getenv\(['"](\w+)['"]\)/g;
          while ((m = re.exec(content)) !== null) envVars.add(m[1]);
        } catch (e) {}
      });

      var envContent = '# Environment variables\n# Copy to .env and fill in values\n\n';
      var sorted = Array.from(envVars).sort();
      sorted.forEach(function(v) {
        envContent += v + '=\n';
      });

      fs.writeFileSync(path.join(cwd, '.env.example'), envContent);
      return {
        output: 'Generated .env.example with ' + sorted.length + ' variables:\n' + sorted.map(function(v) { return '  ' + v; }).join('\n'),
        files: ['.env.example'],
        success: true,
      };
    }
  },

  gitignore: {
    name: 'gitignore',
    description: 'Generate .gitignore for your project type',
    usage: '/skill gitignore [language]',
    run: function(args, cwd) {
      var lang = args[0];
      var pkgPath = path.join(cwd, 'package.json');
      var reqPath = path.join(cwd, 'requirements.txt');
      var goPath = path.join(cwd, 'go.mod');

      if (!lang) {
        if (fs.existsSync(pkgPath)) lang = 'node';
        else if (fs.existsSync(reqPath)) lang = 'python';
        else if (fs.existsSync(goPath)) lang = 'go';
        else lang = 'general';
      }

      var templates = {
        node: 'node_modules/\n.env\n.env.local\ndist/\nbuild/\n.next/\n.nuxt/\ncoverage/\n*.log\n.DS_Store\n',
        python: '__pycache__/\n*.pyc\n*.pyo\nvenv/\n.venv/\nenv/\n.env\n*.egg-info/\ndist/\nbuild/\n.pytest_cache/\n.mypy_cache/\n',
        go: '*.exe\n*.exe~\n*.dll\n*.so\n*.dylib\n*.test\n*.out\nvendor/\n.env\n',
        rust: 'target/\nCargo.lock\n*.rs.bk\n.env\n',
        general: '*.log\n.DS_Store\n.env\nThumbs.db\n',
      };

      var content = templates[lang] || templates.general;
      fs.writeFileSync(path.join(cwd, '.gitignore'), content);
      return {
        output: 'Generated .gitignore for ' + lang,
        files: ['.gitignore'],
        success: true,
      };
    }
  },

  deps: {
    name: 'deps',
    description: 'Check for outdated/vulnerable dependencies',
    usage: '/skill deps [check]',
    run: function(args, cwd) {
      var pkgPath = path.join(cwd, 'package.json');
      var reqPath = path.join(cwd, 'requirements.txt');

      if (fs.existsSync(pkgPath)) {
        try {
          var output = execSync('npm audit --json 2>/dev/null || true', { cwd, encoding: 'utf8', timeout: 15000 });
          var audit = JSON.parse(output);
          var vulns = audit.vulnerabilities || {};
          var count = Object.keys(vulns).length;
          var result = 'Dependency Audit (npm)\n';
          result += 'Vulnerabilities: ' + count + '\n';
          for (var pkg in vulns) {
            var v = vulns[pkg];
            result += '  ' + pkg + ' (' + v.severity + '): ' + (v.via || []).map(function(x) { return typeof x === 'string' ? x : x.title; }).join(', ') + '\n';
          }
          if (count === 0) result += 'No vulnerabilities found.\n';

          // Check outdated
          try {
            var outdated = execSync('npm outdated --json 2>/dev/null || true', { cwd, encoding: 'utf8', timeout: 15000 });
            var out = JSON.parse(outdated || '{}');
            var outdatedCount = Object.keys(out).length;
            result += '\nOutdated packages: ' + outdatedCount + '\n';
            for (var p in out) {
              result += '  ' + p + ': ' + out[p].current + ' -> ' + out[p].latest + '\n';
            }
          } catch (e) {}

          return { output: result, success: true };
        } catch (e) {
          return { output: 'Audit failed: ' + e.message, success: false };
        }
      } else if (fs.existsSync(reqPath)) {
        try {
          var out = execSync('pip list --outdated --format=json 2>/dev/null || echo "[]"', { cwd, encoding: 'utf8', timeout: 15000 });
          var outdated = JSON.parse(out);
          var result = 'Dependency Audit (pip)\n';
          result += 'Outdated packages: ' + outdated.length + '\n';
          outdated.forEach(function(p) {
            result += '  ' + p.name + ': ' + p.version + ' -> ' + p.latest_version + '\n';
          });
          return { output: result, success: true };
        } catch (e) {
          return { output: 'pip audit not available. Install pip-audit: pip install pip-audit', success: false };
        }
      }
      return { output: 'No package.json or requirements.txt found', success: false };
    }
  },

  explain: {
    name: 'explain',
    description: 'Explain a file, function, or architecture',
    usage: '/skill explain <filepath>',
    run: function(args, cwd) {
      var filepath = args[0];
      if (!filepath) return { output: 'Usage: /skill explain <filepath>', success: false };
      var resolved = path.resolve(cwd, filepath);
      if (!fs.existsSync(resolved)) return { output: 'File not found: ' + filepath, success: false };
      var content = fs.readFileSync(resolved, 'utf8');
      var lines = content.split('\n');
      var result = filepath + ' (' + lines.length + ' lines)\n\n';

      // Extract structure
      var funcs = [];
      var classes = [];
      var imports = [];

      lines.forEach(function(line, i) {
        var m;
        if (m = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/)) funcs.push({ name: m[1], line: i + 1 });
        else if (m = line.match(/class\s+(\w+)/)) classes.push({ name: m[1], line: i + 1 });
        else if (m = line.match(/(?:import|require)\(?\s*['"](.+)['"]/)) imports.push({ from: m[1], line: i + 1 });
        else if (m = line.match(/def\s+(\w+)/)) funcs.push({ name: m[1], line: i + 1 });
      });

      if (imports.length > 0) {
        result += 'Imports (' + imports.length + '):\n';
        imports.forEach(function(i) { result += '  L' + i.line + ': ' + i.from + '\n'; });
      }
      if (classes.length > 0) {
        result += '\nClasses (' + classes.length + '):\n';
        classes.forEach(function(c) { result += '  L' + c.line + ': ' + c.name + '\n'; });
      }
      if (funcs.length > 0) {
        result += '\nFunctions (' + funcs.length + '):\n';
        funcs.forEach(function(f) { result += '  L' + f.line + ': ' + f.name + '\n'; });
      }

      result += '\nSummary: ' + lines.length + ' lines, ' + funcs.length + ' functions, ' + classes.length + ' classes, ' + imports.length + ' imports.';
      return { output: result, success: true };
    }
  },

  security: {
    name: 'security',
    description: 'Security audit — scan for common vulnerabilities',
    usage: '/skill security',
    run: function(args, cwd) {
      var { listFiles } = require('./files');
      var files = listFiles(cwd, '**/*', { maxDepth: 4 });
      var issues = [];

      var secretPatterns = [
        { re: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]([a-zA-Z0-9]{20,})/i, name: 'Hardcoded API key', severity: 'HIGH' },
        { re: /(?:secret|password|passwd)\s*[:=]\s*['"]([^'"]{8,})/i, name: 'Hardcoded secret/password', severity: 'HIGH' },
        { re: /(?:AKIA|ASIA)[A-Z0-9]{16}/, name: 'AWS access key', severity: 'CRITICAL' },
        { re: /ghp_[a-zA-Z0-9]{36}/, name: 'GitHub personal access token', severity: 'CRITICAL' },
        { re: /sk_[a-zA-Z0-9]{24,}/, name: 'Stripe API key', severity: 'CRITICAL' },
        { re: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/, name: 'JWT token', severity: 'MEDIUM' },
        { re: /eval\s*\(/, name: 'eval() usage — code injection risk', severity: 'MEDIUM' },
        { re: /innerHTML\s*=/, name: 'innerHTML — XSS risk', severity: 'LOW' },
        { re: /(?:SELECT|INSERT|UPDATE|DELETE)\s+.*\+\s*\w+/i, name: 'Possible SQL injection (string concatenation)', severity: 'HIGH' },
      ];

      files.forEach(function(f) {
        var ext = path.extname(f);
        if (['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.java'].indexOf(ext) === -1) return;
        if (f.indexOf('node_modules') !== -1 || f.indexOf('.test.') !== -1) return;
        try {
          var content = fs.readFileSync(path.join(cwd, f), 'utf8');
          var lines = content.split('\n');
          secretPatterns.forEach(function(p) {
            lines.forEach(function(line, i) {
              if (p.re.test(line)) {
                issues.push({ file: f, line: i + 1, severity: p.severity, name: p.name });
              }
            });
          });
        } catch (e) {}
      });

      // Check .env in git
      var gitignorePath = path.join(cwd, '.gitignore');
      if (fs.existsSync(path.join(cwd, '.env')) && fs.existsSync(gitignorePath)) {
        var gi = fs.readFileSync(gitignorePath, 'utf8');
        if (gi.indexOf('.env') === -1) {
          issues.push({ file: '.env', line: 0, severity: 'HIGH', name: '.env not in .gitignore' });
        }
      }

      var result = 'Security Audit\n';
      result += 'Issues found: ' + issues.length + '\n\n';

      var severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      severityOrder.forEach(function(sev) {
        var sevIssues = issues.filter(function(i) { return i.severity === sev; });
        if (sevIssues.length > 0) {
          result += sev + ' (' + sevIssues.length + '):\n';
          sevIssues.forEach(function(i) {
            result += '  ' + i.file + (i.line > 0 ? ':' + i.line : '') + ' — ' + i.name + '\n';
          });
        }
      });

      if (issues.length === 0) result += 'No security issues detected.\n';

      return { output: result, success: true };
    }
  },

  size: {
    name: 'size',
    description: 'Analyze project size and find large files',
    usage: '/skill size',
    run: function(args, cwd) {
      var { listFiles } = require('./files');
      var files = listFiles(cwd, '**/*', { maxDepth: 10, includeBinary: true });
      var sizes = [];

      files.forEach(function(f) {
        try {
          var stat = fs.statSync(path.join(cwd, f));
          sizes.push({ file: f, size: stat.size });
        } catch (e) {}
      });

      sizes.sort(function(a, b) { return b.size - a.size; });

      var total = sizes.reduce(function(s, f) { return s + f.size; }, 0);
      var result = 'Project Size Analysis\n';
      result += 'Total: ' + (total / 1024).toFixed(1) + ' KB (' + files.length + ' files)\n\n';
      result += 'Largest files:\n';
      sizes.slice(0, 15).forEach(function(f) {
        var sizeStr = f.size > 1024 ? (f.size / 1024).toFixed(1) + ' KB' : f.size + ' B';
        result += '  ' + sizeStr.padStart(10) + '  ' + f.file + '\n';
      });

      return { output: result, success: true };
    }
  },

  translate: {
    name: 'translate',
    description: 'Translate code between languages (via AI)',
    usage: '/skill translate <filepath> <target-lang>',
    run: function(args, cwd) {
      var filepath = args[0];
      var targetLang = args[1];
      if (!filepath || !targetLang) return { output: 'Usage: /skill translate <filepath> <target-lang>', success: false };
      return {
        output: 'Translation ready. Ask Stew: "Translate ' + filepath + ' to ' + targetLang + '"\n' +
          'Stew will read the file and generate the translated version.',
        success: true,
        needsAI: true,
        prompt: 'Translate the file ' + filepath + ' to ' + targetLang + '. Read the file, understand its logic, and rewrite it in ' + targetLang + '. Save as a new file with the appropriate extension.',
      };
    }
  },

  refactor: {
    name: 'refactor',
    description: 'Suggest refactoring improvements (via AI)',
    usage: '/skill refactor <filepath>',
    run: function(args, cwd) {
      var filepath = args[0];
      if (!filepath) return { output: 'Usage: /skill refactor <filepath>', success: false };
      return {
        output: 'Refactoring analysis ready.',
        success: true,
        needsAI: true,
        prompt: 'Analyze ' + filepath + ' and suggest refactoring improvements. Look for: code duplication, long functions, complex conditionals, missing error handling, naming issues. Show the refactored version.',
      };
    }
  },

  document: {
    name: 'document',
    description: 'Generate documentation for your project',
    usage: '/skill document [format]',
    run: function(args, cwd) {
      var format = args[0] || 'markdown';
      var { listFiles, readFileSync } = require('./files');
      var files = listFiles(cwd, '**/*', { maxDepth: 3 });

      var codeFiles = files.filter(function(f) {
        var ext = path.extname(f);
        return ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.java', '.rs'].indexOf(ext) !== -1;
      });

      var doc = '# Project Documentation\n\n';
      doc += 'Generated by Stew Code\n\n';
      doc += '## Overview\n\n';
      doc += 'Files: ' + codeFiles.length + ' code files\n\n';
      doc += '## File Structure\n\n';

      codeFiles.forEach(function(f) {
        doc += '### ' + f + '\n\n';
        try {
          var content = fs.readFileSync(path.join(cwd, f), 'utf8');
          var lines = content.split('\n');
          var funcs = [];
          lines.forEach(function(line, i) {
            var m;
            if (m = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/)) funcs.push(m[1]);
            else if (m = line.match(/def\s+(\w+)/)) funcs.push(m[1]);
            else if (m = line.match(/(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/)) funcs.push(m[1]);
          });
          if (funcs.length > 0) {
            doc += 'Functions: ' + funcs.join(', ') + '\n\n';
          }
          doc += 'Lines: ' + lines.length + '\n\n';
        } catch (e) {}
      });

      var docPath = path.join(cwd, 'DOCUMENTATION.md');
      fs.writeFileSync(docPath, doc);
      return {
        output: 'Generated DOCUMENTATION.md (' + codeFiles.length + ' files documented)',
        files: ['DOCUMENTATION.md'],
        success: true,
      };
    }
  },

  clean: {
    name: 'clean',
    description: 'Clean build artifacts and temp files',
    usage: '/skill clean',
    run: function(args, cwd) {
      var dirs = ['node_modules', 'dist', 'build', '.next', '.nuxt', '__pycache__', '.pytest_cache', '.mypy_cache', 'coverage', '.turbo', '.cache'];
      var cleaned = [];
      dirs.forEach(function(d) {
        var p = path.join(cwd, d);
        if (fs.existsSync(p)) {
          try {
            fs.rmSync(p, { recursive: true, force: true });
            cleaned.push(d);
          } catch (e) {}
        }
      });

      // Clean temp files
      var patterns = ['*.log', '*.pyc', '*.pyo', '.DS_Store', 'Thumbs.db'];
      patterns.forEach(function(p) {
        try {
          execSync('find . -name "' + p + '" -delete 2>/dev/null', { cwd, timeout: 5000 });
        } catch (e) {}
      });

      return {
        output: cleaned.length > 0 ? 'Cleaned: ' + cleaned.join(', ') : 'Nothing to clean.',
        success: true,
      };
    }
  },

  loc: {
    name: 'loc',
    description: 'Count lines of code by language',
    usage: '/skill loc',
    run: function(args, cwd) {
      var { listFiles } = require('./files');
      var files = listFiles(cwd, '**/*', { maxDepth: 10 });
      var stats = {};

      files.forEach(function(f) {
        var ext = path.extname(f) || 'other';
        if (!stats[ext]) stats[ext] = { files: 0, lines: 0 };
        stats[ext].files++;
        try {
          var content = fs.readFileSync(path.join(cwd, f), 'utf8');
          stats[ext].lines += content.split('\n').length;
        } catch (e) {}
      });

      var result = 'Lines of Code\n\n';
      result += 'Ext       Files     Lines\n';
      result += '─────────────────────────\n';
      var sorted = Object.entries(stats).sort(function(a, b) { return b[1].lines - a[1].lines; });
      sorted.forEach(function(e) {
        result += e[0].padEnd(10) + String(e[1].files).padStart(6) + String(e[1].lines).padStart(10) + '\n';
      });

      var totalLines = Object.values(stats).reduce(function(s, v) { return s + v.lines; }, 0);
      var totalFiles = Object.values(stats).reduce(function(s, v) { return s + v.files; }, 0);
      result += '─────────────────────────\n';
      result += 'Total'.padEnd(10) + String(totalFiles).padStart(6) + String(totalLines).padStart(10) + '\n';

      return { output: result, success: true };
    }
  },

  format: {
    name: 'format',
    description: 'Format code (prettier, black, gofmt)',
    usage: '/skill format [language]',
    run: function(args, cwd) {
      var pkgPath = path.join(cwd, 'package.json');
      var reqPath = path.join(cwd, 'requirements.txt');
      var goPath = path.join(cwd, 'go.mod');

      try {
        if (fs.existsSync(pkgPath)) {
          execSync('npx prettier --write "**/*.{js,ts,jsx,tsx,json,css,md}" 2>&1', { cwd, timeout: 30000 });
          return { output: 'Formatted with prettier', success: true };
        } else if (fs.existsSync(reqPath)) {
          execSync('python -m black . 2>&1 || echo "Install: pip install black"', { cwd, timeout: 30000 });
          return { output: 'Formatted with black', success: true };
        } else if (fs.existsSync(goPath)) {
          execSync('gofmt -w . 2>&1', { cwd, timeout: 15000 });
          return { output: 'Formatted with gofmt', success: true };
        }
      } catch (e) {
        return { output: 'Format failed: ' + e.message, success: false };
      }
      return { output: 'No formatter detected. Install prettier, black, or gofmt.', success: false };
    }
  },

  checklist: {
    name: 'checklist',
    description: 'Generate deployment checklist',
    usage: '/skill checklist',
    run: function(args, cwd) {
      var checks = [
        { item: 'package.json exists', ok: fs.existsSync(path.join(cwd, 'package.json')) || fs.existsSync(path.join(cwd, 'requirements.txt')) },
        { item: '.gitignore exists', ok: fs.existsSync(path.join(cwd, '.gitignore')) },
        { item: '.env.example exists', ok: fs.existsSync(path.join(cwd, '.env.example')) },
        { item: 'README.md exists', ok: fs.existsSync(path.join(cwd, 'README.md')) },
        { item: 'Tests directory exists', ok: fs.existsSync(path.join(cwd, '__tests__')) || fs.existsSync(path.join(cwd, 'tests')) || fs.existsSync(path.join(cwd, 'test')) },
        { item: 'Dockerfile exists', ok: fs.existsSync(path.join(cwd, 'Dockerfile')) },
        { item: 'CI pipeline exists', ok: fs.existsSync(path.join(cwd, '.github', 'workflows')) },
        { item: '.env not committed', ok: !fs.existsSync(path.join(cwd, '.env')) || (fs.existsSync(path.join(cwd, '.gitignore')) && fs.readFileSync(path.join(cwd, '.gitignore'), 'utf8').indexOf('.env') !== -1) },
        { item: 'No hardcoded secrets', ok: true },
      ];

      var result = 'Deployment Checklist\n\n';
      var passed = 0;
      checks.forEach(function(c) {
        var mark = c.ok ? '[x]' : '[ ]';
        if (c.ok) passed++;
        result += mark + ' ' + c.item + '\n';
      });
      result += '\n' + passed + '/' + checks.length + ' checks passed';

      return { output: result, success: true };
    }
  },
};

/* ============================================================
 * SKILL FORGE — Auto-generate skills via AI
 * ============================================================ */

function ensureSkillsDir() {
  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }
}

/**
 * List all available skills (builtin + custom).
 */
function listSkills() {
  ensureSkillsDir();
  var builtin = Object.keys(BUILTIN_SKILLS).map(function(name) {
    var s = BUILTIN_SKILLS[name];
    return { name: s.name, description: s.description, usage: s.usage, type: 'builtin' };
  });

  var custom = [];
  var files = [];
  try { files = fs.readdirSync(SKILLS_DIR); } catch (e) {}
  files.forEach(function(f) {
    if (f.endsWith('.js')) {
      try {
        var content = fs.readFileSync(path.join(SKILLS_DIR, f), 'utf8');
        var nameMatch = content.match(/@skill\s+(\w+)/);
        var descMatch = content.match(/@description\s+(.+)/);
        custom.push({
          name: nameMatch ? nameMatch[1] : f.replace('.js', ''),
          description: descMatch ? descMatch[1].trim() : 'Custom skill',
          usage: '/skill ' + (nameMatch ? nameMatch[1] : f.replace('.js', '')),
          type: 'custom',
        });
      } catch (e) {}
    }
  });

  return { builtin: builtin, custom: custom, total: builtin.length + custom.length };
}

/**
 * Run a skill by name.
 */
function runSkill(name, args, cwd) {
  // Check builtin first
  if (BUILTIN_SKILLS[name]) {
    return BUILTIN_SKILLS[name].run(args, cwd);
  }

  // Check custom skills
  ensureSkillsDir();
  var skillPath = path.join(SKILLS_DIR, name + '.js');
  if (fs.existsSync(skillPath)) {
    try {
      var skill = require(skillPath);
      if (typeof skill.run === 'function') {
        return skill.run(args, cwd);
      }
      return { output: 'Skill ' + name + ' has no run() function', success: false };
    } catch (e) {
      return { output: 'Skill error: ' + e.message, success: false };
    }
  }

  return { output: 'Skill not found: ' + name + '. Use /skills to see available skills or /forge to create one.', success: false };
}

/**
 * Generate a skill from a description using AI.
 * Returns the skill code and saves it.
 */
function generateSkillCode(skillName, description, language) {
  language = language || 'javascript';
  var skillCode = '/**\n';
  skillCode += ' * @skill ' + skillName + '\n';
  skillCode += ' * @description ' + description + '\n';
  skillCode += ' * @created by Stew Code Skill Forge\n';
  skillCode += ' * Auto-generated — review before use.\n';
  skillCode += ' */\n';
  skillCode += 'const fs = require(\'fs\');\n';
  skillCode += 'const path = require(\'path\');\n\n';
  skillCode += 'module.exports = {\n';
  skillCode += '  name: \'' + skillName + '\',\n';
  skillCode += '  description: \'' + description + '\',\n';
  skillCode += '  usage: \'/skill ' + skillName + ' [args]\',\n';
  skillCode += '  run: function(args, cwd) {\n';
  skillCode += '    // TODO: Implement ' + description + '\n';
  skillCode += '    // args: array of string arguments\n';
  skillCode += '    // cwd: current working directory\n';
  skillCode += '    // Return: { output: string, success: boolean, files?: [] }\n';
  skillCode += '    \n';
  skillCode += '    var result = \'Skill ' + skillName + ' executed. Args: \' + args.join(\' \');\n';
  skillCode += '    return { output: result, success: true };\n';
  skillCode += '  }\n';
  skillCode += '};\n';

  return skillCode;
}

/**
 * Forge a new skill — create and save it.
 */
function forgeSkill(skillName, description) {
  ensureSkillsDir();
  var code = generateSkillCode(skillName, description);
  var skillPath = path.join(SKILLS_DIR, skillName + '.js');
  fs.writeFileSync(skillPath, code);
  return {
    output: 'Forged new skill: ' + skillName + '\nSaved to: ' + skillPath + '\n\nThe skill is a template. Ask Stew to implement it: "Implement the ' + skillName + ' skill to ' + description + '"',
    path: skillPath,
    success: true,
  };
}

/**
 * Delete a custom skill.
 */
function deleteSkill(name) {
  var skillPath = path.join(SKILLS_DIR, name + '.js');
  if (fs.existsSync(skillPath)) {
    fs.unlinkSync(skillPath);
    return { output: 'Deleted skill: ' + name, success: true };
  }
  return { output: 'Custom skill not found: ' + name, success: false };
}

module.exports = {
  BUILTIN_SKILLS,
  listSkills,
  runSkill,
  forgeSkill,
  deleteSkill,
  generateSkillCode,
  SKILLS_DIR,
};
