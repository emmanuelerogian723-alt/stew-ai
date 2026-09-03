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
process.exit(failed ? 1 : 0);
