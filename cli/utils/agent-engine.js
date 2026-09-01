/**
 * Stew Code Agent Engine — Autonomous multi-step task execution.
 *
 * Unlike the interactive REPL, Agent Mode:
 * 1. Plans steps from a natural language goal
 * 2. Executes each step (read, write, shell, search)
 * 3. Verifies results and self-corrects
 * 4. Reports progress and final summary
 *
 * Usage: stew agent "fix all TypeScript errors in the project"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { StewClient } = require('../../lib/client');
const { streamChatCompletion } = require('../../lib/stream');
const { listFiles, readFileSync, projectContext } = require('./files');
const { runSkill } = require('./skill-forge');

var C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m',
};

/**
 * Plan steps from a natural language goal.
 * Returns an array of step objects: { action, description, target, code }
 */
async function planSteps(client, goal, cwd) {
  var ctx = projectContext(cwd);
  var files = listFiles(cwd, '**/*', { maxDepth: 4 }).slice(0, 50);

  var planPrompt = 'You are Stew Code Agent, an autonomous coding agent. Break down this task into concrete steps.\n\n';
  planPrompt += 'GOAL: ' + goal + '\n\n';
  planPrompt += 'PROJECT: ' + ctx.type + ' (' + files.length + ' files)\n';
  planPrompt += 'FILES:\n' + files.join('\n') + '\n\n';
  planPrompt += 'Return a JSON array of steps. Each step has:\n';
  planPrompt += '- action: "read" | "write" | "shell" | "search" | "skill" | "analyze"\n';
  planPrompt += '- description: what this step does\n';
  planPrompt += '- target: file path (for read/write), command (for shell), query (for search), skill name (for skill)\n';
  planPrompt += '- code: file content (for write only)\n\n';
  planPrompt += 'Keep it to 3-8 steps. Be specific. Return ONLY the JSON array, no explanation.';

  var result = await streamChatCompletion(client, [
    { role: 'system', content: 'You are a task planning AI. Return only valid JSON arrays.' },
    { role: 'user', content: planPrompt },
  ], { model: 'stew-default', temperature: 0.3 });

  // Parse the JSON from the response
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

/**
 * Execute a single step.
 */
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

    case 'skill': {
      var skillArgs = step.args || [];
      var result = runSkill(target, skillArgs, cwd);
      console.log(' ' + (result.success ? C.green + 'SKILL' : C.red + 'FAILED') + C.reset);
      return result;
    }

    case 'analyze':
    default: {
      // Ask AI to analyze and produce output
      var context = '';
      if (messages && messages.length > 0) {
        // Include recent step outputs
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

/**
 * Run the agent loop — plan, execute, verify, report.
 */
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

  // Phase 1: Plan
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

  // Phase 2: Execute
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

    // If a step produced AI output with code blocks, extract and apply them
    if (autoApply && result.output && typeof result.output === 'string') {
      applyCodeBlocks(result.output, cwd);
    }
  }

  // Phase 3: Report
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

  // Print details
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

/**
 * Extract code blocks from AI output and write files.
 */
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
