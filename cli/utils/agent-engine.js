const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { StewClient } = require('../../lib/client');
const { streamChatCompletion } = require('../../lib/stream');
const { listFiles, readFileSync, projectContext } = require('./files');
const { runSkill } = require('./skill-forge');
const { scrape } = require('./scraper');
var C = require('./output').C;
async function planSteps(client, goal, cwd) {
  var ctx = projectContext(cwd);
  var files = listFiles(cwd, '**/*', { maxDepth: 4 }).slice(0, 50);
  var planPrompt = 'You are Stew Code Agent, an autonomous coding agent. Break down this task into concrete steps.\n\n';
  planPrompt += 'GOAL: ' + goal + '\n\n';
  planPrompt += 'PROJECT: ' + ctx.type + ' (' + files.length + ' files)\n';
  planPrompt += 'FILES:\n' + files.join('\n') + '\n\n';
  planPrompt += 'Return a JSON array of steps. Each step has:\n';
  planPrompt += '- action: read|write|shell|search|scrape|api|skill|analyze\n';
  planPrompt += '- description: what this step does\n';
  planPrompt += '- target: file path | command | query | skill name\n';
  planPrompt += '- code: file content (for write only)\n\n';
  planPrompt += '3-8 steps. Return ONLY the JSON array.';
  var result = await streamChatCompletion(client, [
    { role: 'system', content: 'You are a task planning AI. Return only valid JSON arrays.' },
    { role: 'user', content: planPrompt },
  ], { model: 'stew-default', temperature: 0.3 });
  var jsonMatch = result.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return [{ action: 'analyze', description: 'Analyze the task: ' + goal, target: goal }];
  }
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    return [{ action: 'analyze', description: 'Analyze the task: ' + goal, target: goal }];
  }
}
async function executeStep(client, step, cwd, messages) {
  var action = step.action || 'analyze';
  var target = step.target || '';
  var desc = step.description || '';
  process.stdout.write(C.cyan + '  -> ' + C.reset + desc);
  switch (action) {
    case 'read': {
      var resolved = path.resolve(cwd, target);
      if (!fs.existsSync(resolved)) {
        console.log(' ' + C.red + 'FILE NOT FOUND' + C.reset);
        return { ok: false, output: 'File not found: ' + target };
      }
      var content = fs.readFileSync(resolved, 'utf8');
      console.log(' ' + C.green + 'READ' + C.reset);
      return { ok: true, output: content, file: target };
    }
    case 'write': {
      var resolved = path.resolve(cwd, target);
      var dir = path.dirname(resolved);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(resolved, step.code || '');
      console.log(' ' + C.green + 'WRITTEN' + C.reset);
      return { ok: true, output: 'Wrote ' + target };
    }
    case 'shell': {
      try {
        var output = execSync(target, { cwd, encoding: 'utf8', timeout: 30000, stdio: 'pipe' });
        console.log(' ' + C.green + 'DONE' + C.reset);
        return { ok: true, output: output };
      } catch (e) {
        console.log(' ' + C.yellow + 'PARTIAL' + C.reset);
        return { ok: false, output: (e.stderr || e.stdout || e.message || '').toString() };
      }
    }
    case 'search': {
      try {
        var result = await streamChatCompletion(client, [
          { role: 'system', content: 'You are a web research assistant. Provide concise, actionable findings.' },
          { role: 'user', content: 'Search and explain: ' + target },
        ], { model: 'stew-default', webSearch: true });
        console.log(' ' + C.green + 'SEARCHED' + C.reset);
        return { ok: true, output: result };
      } catch (e) {
        console.log(' ' + C.red + 'FAILED' + C.reset);
        return { ok: false, output: e.message };
      }
    }
    case 'scrape': {
      try {
        var sUrl = target;
        if (!sUrl.startsWith('http')) sUrl = 'https://' + sUrl;
        var page = await scrape(sUrl, { timeout: 15000 });
        if (!page.ok) {
          console.log(' ' + C.red + 'FAILED' + C.reset);
          return { ok: false, output: 'Failed: ' + (page.error || 'HTTP ' + page.status) };
        }
        console.log(' ' + C.green + 'SCRAPED' + C.reset);
        return { ok: true, output: 'Title: ' + page.title + '\nURL: ' + page.url + '\n\n' + page.text.slice(0, 3000) };
      } catch (e) {
        console.log(' ' + C.red + 'FAILED' + C.reset);
        return { ok: false, output: e.message };
      }
    }
    case 'skill': {
      var skillArgs = step.args || [];
      var result = runSkill(target, skillArgs, cwd);
      console.log(' ' + (result.success ? C.green + 'SKILL' : C.red + 'FAILED') + C.reset);
      return result;
    }
    case 'analyze':
    default: {
      var context = '';
      if (messages && messages.length > 0) {
        var recent = messages.slice(-5);
        context = '\n\nPrevious step results:\n' + recent.map(function(m) {
          return '--- ' + m.step + ' ---\n' + (m.output || '').slice(0, 2000);
        }).join('\n');
      }
      try {
        var result = await streamChatCompletion(client, [
          { role: 'system', content: 'You are Stew Code Agent. Analyze the task and provide a solution. If you need to write code, output it in code blocks with the filename as a comment on the first line.' },
          { role: 'user', content: desc + ': ' + target + context },
        ], { model: 'stew-default', temperature: 0.4 });
        console.log(' ' + C.green + 'ANALYZED' + C.reset);
        return { ok: true, output: result };
      } catch (e) {
        console.log(' ' + C.red + 'FAILED' + C.reset);
        return { ok: false, output: e.message };
      }
    }
  }
}
async function runAgent(client, goal, cwd, options) {
  options = options || {};
  var maxSteps = options.maxSteps || 10;
  var autoApply = options.autoApply !== false; // default true
  console.log('\n' + C.cyan + C.bold + '  ___|  ' + C.reset);
  console.log(C.cyan + C.bold + ' \\__ \\  ' + C.reset + C.dim + 'Agent Mode' + C.reset);
  console.log(C.cyan + C.bold + ' |___/  ' + C.reset + C.dim + 'Autonomous task execution' + C.reset);
  console.log('');
  console.log(C.bold + 'Goal:' + C.reset + ' ' + goal);
  console.log(C.dim + 'Working directory:' + C.reset + ' ' + cwd);
  console.log('');
  console.log(C.bold + C.magenta + '[Planning]' + C.reset + ' Breaking down the task...');
  var steps;
  try {
    steps = await planSteps(client, goal, cwd);
  } catch (e) {
    console.log(C.red + 'Planning failed: ' + e.message + C.reset);
    return;
  }
  console.log('' + C.dim + 'Planned ' + steps.length + ' steps:' + C.reset);
  steps.forEach(function(s, i) {
    console.log('  ' + C.cyan + (i + 1) + '.' + C.reset + ' ' + (s.description || s.action + ' ' + (s.target || '')));
  });
  console.log('');
  console.log(C.bold + C.magenta + '[Executing]' + C.reset);
  var results = [];
  var allOk = true;
  for (var i = 0; i < steps.length && i < maxSteps; i++) {
    var step = steps[i];
    console.log(C.bold + '\nStep ' + (i + 1) + '/' + steps.length + C.reset);
    var result = await executeStep(client, step, cwd, results);
    results.push({
      step: step.description || step.action,
      action: step.action,
      target: step.target,
      ok: result.ok,
      output: result.output,
    });
    if (!result.ok) allOk = false;
    if (autoApply && result.output && typeof result.output === 'string') {
      applyCodeBlocks(result.output, cwd);
    }
  }
  console.log('\n' + C.dim + '  ' + '─'.repeat(50) + C.reset);
  console.log(C.bold + C.magenta + '[Summary]' + C.reset);
  console.log('Steps executed: ' + results.length);
  console.log('Successful: ' + results.filter(function(r) { return r.ok; }).length);
  console.log('Failed: ' + results.filter(function(r) { return !r.ok; }).length);
  if (allOk) {
    console.log('\n' + C.green + C.bold + '✅ Task completed successfully!' + C.reset);
  } else {
    console.log('\n' + C.yellow + '⚠ Some steps had issues. Review above.' + C.reset);
  }
  console.log('\n' + C.bold + 'Details:' + C.reset);
  results.forEach(function(r, i) {
    var mark = r.ok ? C.green + '✓' : C.red + '✗';
    console.log('  ' + mark + C.reset + ' ' + r.step);
    if (r.output && r.output.length > 0 && r.output.length < 500) {
      console.log(C.dim + '     ' + r.output.slice(0, 200).replace(/\n/g, '\n     ') + C.reset);
    }
  });
  console.log('');
}
function applyCodeBlocks(text, cwd) {
  var blocks = text.match(/```(\w+)\s*\n\/\/\s*(?:filepath:|file:)?\s*(.+?)\n([\s\S]*?)```/g);
  if (!blocks) return;
  blocks.forEach(function(block) {
    var match = block.match(/```(\w+)\s*\n\/\/\s*(?:filepath:|file:)?\s*(.+?)\n([\s\S]*?)```/);
    if (!match) return;
    var filepath = match[2].trim();
    var content = match[3];
    var resolved = path.resolve(cwd, filepath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content);
    console.log(C.green + '  + Applied: ' + filepath + C.reset);
  });
}
module.exports = { runAgent, planSteps, executeStep, applyCodeBlocks };
