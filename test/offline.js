// Offline test suite for stew-ai v2.6.0 — no network required.
const assert = require('assert');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + ': ' + e.message); }
}
const ROOT = __dirname + '/..';
process.chdir(ROOT);

test('SDK exports + class wiring', () => {
  const Stew = require(ROOT);
  const s = new Stew({ apiKey: 't' });
  assert.ok(s.chat && s.search && s.skills && s.documents && s.finetune);
});
test('lib/api merged module exports', () => {
  const api = require(ROOT + '/lib/api');
  assert.ok(api.StewError && api.Search && api.Skills && api.Documents && api.FineTune && api.Chat);
});
test('StewError carries code + suggestion', () => {
  const { StewError } = require(ROOT + '/lib/api');
  const e = new StewError('X', 'msg', 'try this');
  assert.equal(e.code, 'X'); assert.equal(e.suggestion, 'try this');
});
test('colors centralized (orange/steam/gray present)', () => {
  const out = require(ROOT + '/cli/utils/output');
  assert.ok(out.C.orange && out.C.steam && out.C.gray);
});
test('files: listFiles, projectContext, session roundtrip, git', () => {
  const f = require(ROOT + '/cli/utils/files');
  assert.ok(f.listFiles('cli', '**/*.js').length >= 15);
  const ctx = f.projectContext('.');
  assert.ok(ctx.type && ctx.files.length > 0);
  f.saveSession('t1', [{ role: 'user', content: 'hi' }]);
  assert.equal(f.loadSession('t1').messages[0].content, 'hi');
  f.deleteSession('t1');
  assert.ok(f.isGitRepo('.'));
  assert.equal(typeof f.status('.').branch, 'string');
  assert.ok(f.UndoStack);
});
test('mascot faces render', () => {
  const m = require(ROOT + '/cli/utils/mascot');
  assert.ok(m.bootBanner().includes('STEW'));
  assert.ok(m.idle() && m.error() && m.marathon(2));
});
test('config get/set/clear', () => {
  const cfg = require(ROOT + '/cli/utils/config');
  cfg.setApiKey('k-test-123');
  assert.equal(cfg.getApiKey(), 'k-test-123');
  cfg.clearApiKey();
  assert.ok(!cfg.getApiKey());
});
test('scraper extractors on sample HTML', () => {
  const s = require(ROOT + '/cli/utils/scraper');
  const html = '<html><head><title>T</title></head><body><a href="/x">go</a><p>hello world of stew</p></body></html>';
  assert.ok(s.extractText(html).includes('hello'));
  assert.ok(s.extractLinks(html, 'https://ex.com').some(l => l.includes('ex.com/x')));
});
test('skill-forge: builtin skills + forge/delete custom skill', () => {
  const sf = require(ROOT + '/cli/utils/skill-forge');
  assert.ok(sf.listSkills().builtins.length >= 10);
  sf.forgeSkill('t-skill', 'test skill', 'echo hi');
  assert.ok(sf.listSkills().custom.includes('t-skill'));
  sf.deleteSkill('t-skill');
  assert.ok(!sf.listSkills().custom.includes('t-skill'));
});
test('mcp config add/list/remove', () => {
  const mcp = require(ROOT + '/cli/utils/mcp');
  mcp.addServer('t-server', 'echo hi');
  assert.ok(Object.keys(mcp.mcpConfig()).includes('t-server'));
  mcp.removeServer('t-server');
  assert.ok(!Object.keys(mcp.mcpConfig()).includes('t-server'));
});
test('advanced: learned fixes persistence', () => {
  const adv = require(ROOT + '/cli/utils/advanced');
  adv.saveLearned('test task', ['always use const']);
  assert.ok(adv.loadLearned().includes('const'));
});
test('all command modules load + exports intact', () => {
  const misc = require(ROOT + '/cli/commands/misc');
  assert.ok(misc.apiCommand && misc.searchCommand && misc.skillsCommand && misc.docCommand && misc.finetuneCommand && misc.statusCommand);
  require(ROOT + '/cli/commands/code');
  require(ROOT + '/cli/commands/chat');
  require(ROOT + '/cli/commands/auth');
  require(ROOT + '/cli/commands/scrape');
});
test('code.js defines all v2.6 commands', () => {
  const src = require('fs').readFileSync(ROOT + '/cli/commands/code.js', 'utf8');
  for (const c of ["'voice'", "'image'", "'mcp'", "'sh'", "'swarm'", "'explain'", "'review'", "'changelog'", "'fix'"]) {
    assert.ok(src.includes(c), 'missing command ' + c);
  }
});
test('image mime falls back to jpeg', () => {
  const src = require('fs').readFileSync(ROOT + '/cli/commands/code.js', 'utf8');
  assert.ok(src.includes("['gif', 'webp'].indexOf(mime) < 0"), 'mime guard missing');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);

// ── v2.7.0: automation module (browse engine, screenshots, record) ──
(function () {
  var A = require('../cli/utils/automation');
  var failed = 0;

  function check(name, cond) {
    if (cond) console.log('  ✓ ' + name);
    else { console.log('  ✗ ' + name); failed++; }
  }

  var j = new A.Jar();
  j.store('https://example.com/', ['sid=abc; Path=/', 'tok=xyz']);
  check('cookie jar stores + sends', j.header('https://example.com/x') === 'sid=abc; tok=xyz');
  j.store('https://example.com/', ['sid=; Path=/']);
  check('cookie jar deletes empty values', j.header('https://example.com/x') === 'tok=xyz');

  var forms = A.parseForms('<form action="/login" method="post"><input name="u" value="bob"><input type="password" name="p"><input type="submit" name="go"></form><form><select name="c"><option value="1">One</option><option value="2" selected>Two</option></select></form>', 'https://x.com/');
  check('parseForms finds 2 forms', forms.length === 2);
  check('parseForms skips submit inputs', forms[0].fields.length === 2 && forms[0].fields[0].value === 'bob');
  check('parseForms reads selected option', forms[1].fields[0].value === '2');
  check('parseForms resolves action URL', forms[0].action === 'https://x.com/login');

  var unq = A.parseForms('<form><input name=a value=1></form>', 'https://x.com/');
  check('parseForms handles unquoted attrs', unq[0].fields[0].value === '1');

  var kv = A.parseKV('user="John Doe" pass=secret');
  check('parseKV parses quoted + bare values', kv.user === 'John Doe' && kv.pass === 'secret');

  check('strip/decode HTML entities', A.strip('<p>A &amp; B</p>') === 'A & B');

  check('findBrowser returns string or null', typeof A.findBrowser() === 'string' || A.findBrowser() === null);
  check('screenshot guard throws on headless', (function () { try { A.screenshot('', '/tmp'); return false; } catch (e) { return /display|capture|Chrome|Chromium/i.test(e.message); } })());

  console.log(failed === 0 ? 'automation: ALL PASS' : 'automation: ' + failed + ' FAILED');
  process.exitCode = failed === 0 ? 0 : 1;
})();
