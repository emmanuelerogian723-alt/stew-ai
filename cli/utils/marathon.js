const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { streamChatCompletion } = require('../../lib/stream');
const { listFiles, projectContext } = require('./files');
const { runSkill } = require('./skill-forge');
const mascot = require('./mascot');
const { scrape } = require('./scraper');
var C = require('./output').C;
var MARATHON_DIR = path.join(os.homedir(), '.stew', 'marathon');
function ensureDir() {
  if (!fs.existsSync(MARATHON_DIR)) fs.mkdirSync(MARATHON_DIR, { recursive: true });
}
function sessionPath(id) {
  return path.join(MARATHON_DIR, id + '.json');
}
function stopFlagPath(id) {
  return path.join(MARATHON_DIR, id + '.stop');
}
function saveCheckpoint(session) {
  ensureDir();
  fs.writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2));
}
function loadCheckpoint(id) {
  var p = sessionPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function listCheckpoints() {
  ensureDir();
  var files = fs.readdirSync(MARATHON_DIR).filter(function(f) { return f.endsWith('.json'); });
  return files.map(function(f) {
    try {
      var s = JSON.parse(fs.readFileSync(path.join(MARATHON_DIR, f), 'utf8'));
      return { id: s.id, goal: s.goal, status: s.status, iteration: s.iteration, startedAt: s.startedAt };
    } catch (e) { return null; }
  }).filter(Boolean);
}
function requestStop(id) {
  ensureDir();
  fs.writeFileSync(stopFlagPath(id), 'stop');
}
function checkStopFlag(id) {
  var p = stopFlagPath(id);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    return true;
  }
  return false;
}
function newSessionId(goal) {
  var slug = goal.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30).replace(/^-|-$/g, '');
  return slug + '-' + Date.now().toString(36);
}
async function checkCompletion(client, goal, log, cwd) {
  var recentLog = log.slice(-8).map(function(l) {
    return '- ' + l.description + ' => ' + (l.ok ? 'OK' : 'FAILED') + ': ' + (l.output || '').slice(0, 300);
  }).join('\n');
  var prompt = 'GOAL: ' + goal + '\n\nWORK LOG (recent):\n' + recentLog + '\n\n' +
    'Based on this log, is the goal fully achieved? Reply with ONLY a JSON object: ' +
    '{"complete": true|false, "reason": "short explanation", "next_focus": "what to do next if not complete"}';
  try {
    var result = await streamChatCompletion(client, [
      { role: 'system', content: 'You are a strict completion judge for autonomous coding tasks. Be conservative — only say complete if there is clear evidence.' },
      { role: 'user', content: prompt },
    ], { model: 'stew-default', temperature: 0.1 });
    var match = result.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch (e) {}
  return { complete: false, reason: 'Could not verify — continuing', next_focus: goal };
}
async function planNextBatch(client, goal, log, cwd, focus) {
  var ctx = projectContext(cwd);
  var recentLog = log.slice(-6).map(function(l) {
    return '- ' + l.description + ' => ' + (l.ok ? 'OK' : 'FAILED');
  }).join('\n') || '(nothing done yet)';
  var prompt = 'You are Stew Code running in MARATHON MODE — a long-running autonomous session.\n\n';
  prompt += 'OVERALL GOAL: ' + goal + '\n';
  if (focus) prompt += 'CURRENT FOCUS: ' + focus + '\n';
  prompt += '\nPROJECT: ' + ctx.type + ', ' + (ctx.stats.totalFiles || 0) + ' files\n';
  prompt += '\nPROGRESS SO FAR:\n' + recentLog + '\n\n';
  prompt += 'Plan the NEXT 2-4 concrete steps toward the goal. Return ONLY a JSON array. Each step:\n';
  prompt += '{"action": "read|write|shell|search|scrape|api|skill|analyze", "description": "...", "target": "...", "code": "... (write only)"}\n';
  prompt += 'Be specific and small — steps should be independently verifiable.';
  var result = await streamChatCompletion(client, [
    { role: 'system', content: 'You are a task planning AI for a long-running agent. Return only valid JSON arrays, nothing else.' },
    { role: 'user', content: prompt },
  ], { model: 'stew-default', temperature: 0.3 });
  var match = result.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try { return JSON.parse(match[0]); } catch (e) { return []; }
}
async function executeOne(client, step, cwd) {
  var action = step.action || 'analyze';
  var target = step.target || '';
  try {
    switch (action) {
      case 'read': {
        var resolved = path.resolve(cwd, target);
        if (!fs.existsSync(resolved)) return { ok: false, output: 'File not found: ' + target };
        return { ok: true, output: fs.readFileSync(resolved, 'utf8').slice(0, 4000) };
      }
      case 'write': {
        var resolved = path.resolve(cwd, target);
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        fs.writeFileSync(resolved, step.code || '');
        return { ok: true, output: 'Wrote ' + target };
      }
      case 'shell': {
        var out = execSync(target, { cwd, encoding: 'utf8', timeout: 60000, stdio: 'pipe' });
        return { ok: true, output: out.slice(0, 2000) };
      }
      case 'skill': {
        var r = runSkill(target, step.args || [], cwd);
        return { ok: r.success, output: r.output };
      }
      case 'search': {
        var res = await streamChatCompletion(client, [
          { role: 'system', content: 'Concise web research assistant.' },
          { role: 'user', content: 'Search: ' + target },
        ], { model: 'stew-default', webSearch: true });
        return { ok: true, output: res.slice(0, 2000) };
      }
      case 'scrape': {
        var sUrl = target;
        if (!sUrl.startsWith('http')) sUrl = 'https://' + sUrl;
        var page = await scrape(sUrl, { timeout: 15000 });
        if (!page.ok) return { ok: false, output: 'Failed: ' + (page.error || 'HTTP ' + page.status) };
        return { ok: true, output: ('Title: ' + page.title + '\n' + page.text).slice(0, 3000) };
      }
      case 'analyze':
      default: {
        var res2 = await streamChatCompletion(client, [
          { role: 'system', content: 'You are Stew Code. Analyze and solve. If writing code, use code blocks with "// filepath: x" as the first line.' },
          { role: 'user', content: (step.description || '') + ': ' + target },
        ], { model: 'stew-default', temperature: 0.4 });
        var blocks = res2.match(/```\w*\s*\n\/\/\s*(?:filepath:|file:)\s*(.+?)\n([\s\S]*?)```/g);
        if (blocks) {
          blocks.forEach(function(b) {
            var m = b.match(/```\w*\s*\n\/\/\s*(?:filepath:|file:)\s*(.+?)\n([\s\S]*?)```/);
            if (m) {
              var fp = path.resolve(cwd, m[1].trim());
              fs.mkdirSync(path.dirname(fp), { recursive: true });
              fs.writeFileSync(fp, m[2]);
            }
          });
        }
        return { ok: true, output: res2.slice(0, 2000) };
      }
    }
  } catch (e) {
    return { ok: false, output: (e.message || String(e)).slice(0, 500) };
  }
}
async function runMarathon(client, goal, cwd, options) {
  options = options || {};
  var maxHours = options.maxHours || 4;
  var maxIterations = options.maxIterations || 200;
  var heartbeatEvery = options.heartbeatEvery || 3;
  var session;
  if (options.resumeId) {
    session = loadCheckpoint(options.resumeId);
    if (!session) {
      console.log(C.red + 'No checkpoint found for: ' + options.resumeId + C.reset);
      return;
    }
    console.log(C.cyan + 'Resuming session ' + session.id + ' (iteration ' + session.iteration + ')' + C.reset);
  } else {
    session = {
      id: newSessionId(goal),
      goal: goal,
      cwd: cwd,
      startedAt: new Date().toISOString(),
      deadline: new Date(Date.now() + maxHours * 3600 * 1000).toISOString(),
      iteration: 0,
      status: 'running',
      log: [],
      filesChanged: 0,
    };
  }
  console.log(mascot.marathon(maxHours));
  console.log(C.bold + 'Goal: ' + C.reset + goal);
  console.log(C.dim + 'Session ID: ' + session.id + C.reset);
  console.log(C.dim + 'Time budget: ' + maxHours + 'h  ·  Iteration budget: ' + maxIterations + C.reset);
  console.log(C.dim + 'Stop anytime: stew marathon --stop ' + session.id + C.reset);
  console.log('');
  saveCheckpoint(session);
  var deadline = new Date(session.deadline).getTime();
  var focus = goal;
  while (session.iteration < maxIterations) {
    if (Date.now() > deadline) {
      session.status = 'time_budget_exceeded';
      console.log(C.yellow + '\nTime budget reached (' + maxHours + 'h). Stopping.' + C.reset);
      break;
    }
    if (checkStopFlag(session.id)) {
      session.status = 'stopped_by_user';
      console.log(C.yellow + '\nStop requested. Halting cleanly.' + C.reset);
      break;
    }
    session.iteration++;
    console.log(C.magenta + C.bold + '\n[Iteration ' + session.iteration + ']' + C.reset + ' ' + C.dim + new Date().toLocaleTimeString() + C.reset);
    var steps;
    try {
      steps = await planNextBatch(client, goal, session.log, cwd, focus);
    } catch (e) {
      console.log(C.red + 'Planning error: ' + e.message + C.reset);
      steps = [];
    }
    if (steps.length === 0) {
      console.log(C.dim + 'No further steps planned — checking completion...' + C.reset);
    }
    for (var i = 0; i < steps.length; i++) {
      var step = steps[i];
      process.stdout.write(C.cyan + '  → ' + C.reset + (step.description || step.action));
      var result = await executeOne(client, step, cwd);
      console.log(' ' + (result.ok ? C.green + 'OK' : C.red + 'FAIL') + C.reset);
      session.log.push({
        iteration: session.iteration,
        description: step.description || step.action,
        action: step.action,
        target: step.target,
        ok: result.ok,
        output: result.output,
        at: new Date().toISOString(),
      });
      if (step.action === 'write' && result.ok) session.filesChanged++;
    }
    saveCheckpoint(session);
    if (session.iteration % heartbeatEvery === 0 || steps.length === 0) {
      console.log(C.dim + '  (checking if goal is complete...)' + C.reset);
      var check = await checkCompletion(client, goal, session.log, cwd);
      if (check.complete) {
        session.status = 'complete';
        session.completionReason = check.reason;
        console.log(C.green + C.bold + '\n✓ Goal complete: ' + C.reset + check.reason);
        break;
      } else {
        focus = check.next_focus || goal;
        console.log(C.dim + '  Not complete yet — ' + (check.reason || '') + C.reset);
      }
    }
    if (options.onUpdate) {
      try { options.onUpdate(session); } catch (e) {}
    }
    if (steps.length === 0 && session.iteration > 1) {
      console.log(C.yellow + 'No actionable steps and goal not confirmed complete. Stopping to avoid a loop.' + C.reset);
      session.status = 'stalled';
      break;
    }
  }
  if (session.status === 'running') session.status = 'max_iterations_reached';
  session.endedAt = new Date().toISOString();
  saveCheckpoint(session);
  console.log('\n' + C.dim + '─'.repeat(50) + C.reset);
  console.log(C.bold + 'Marathon Summary' + C.reset);
  console.log('  Status: ' + statusColor(session.status) + session.status + C.reset);
  console.log('  Iterations: ' + session.iteration);
  console.log('  Files changed: ' + session.filesChanged);
  console.log('  Duration: ' + durationSince(session.startedAt));
  console.log('  Checkpoint: ' + sessionPath(session.id));
  console.log('');
  if (session.status !== 'complete') {
    console.log(C.dim + 'Resume anytime with: stew marathon --resume ' + session.id + C.reset + '\n');
  }
  return session;
}
function statusColor(status) {
  if (status === 'complete') return C.green;
  if (status === 'stopped_by_user' || status === 'time_budget_exceeded') return C.yellow;
  return C.red;
}
function durationSince(iso) {
  var ms = Date.now() - new Date(iso).getTime();
  var h = Math.floor(ms / 3600000);
  var m = Math.floor((ms % 3600000) / 60000);
  return h + 'h ' + m + 'm';
}
module.exports = {
  runMarathon, listCheckpoints, loadCheckpoint, requestStop,
  MARATHON_DIR,
};
