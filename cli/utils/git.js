/**
 * Git operations for Stew Code — zero dependency, uses child_process.execSync.
 */
const { execSync } = require('child_process');

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

module.exports = { gitExec, isGitRepo, status, diff, log, commit, addAll, currentBranch };
