// Build step: minify shipped files in-place for publish (repo source stays readable on GitHub).
const { minify } = require('terser');
const fs = require('fs'), path = require('path');
const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d)) {
    const p = path.join(d, e);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (e.endsWith('.js')) files.push(p);
  }
}
walk('lib'); walk('cli'); files.push('index.js');
(async () => {
  for (const f of files) {
    const out = await minify(fs.readFileSync(f, 'utf8'), { compress: { passes: 3, toplevel: true }, mangle: { toplevel: true }, format: { comments: false, shebang: f === 'cli/index.js' } });
    fs.writeFileSync(f, out.code);
  }
  console.log('minified', files.length, 'files');
})();
