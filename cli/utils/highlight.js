const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
  gray: '\x1b[90m',
};
const KEYWORDS = {
  js: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|delete|typeof|instanceof|in|of|class|extends|super|this|import|export|from|as|default|async|await|try|catch|finally|throw|yield|static|get|set|void|null|undefined|true|false)\b/g,
  ts: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|delete|typeof|instanceof|in|of|class|extends|super|this|import|export|from|as|default|async|await|try|catch|finally|throw|yield|static|get|set|void|null|undefined|true|false|type|interface|enum|namespace|declare|readonly|public|private|protected|abstract|implements)\b/g,
  py: /\b(def|class|return|if|elif|else|for|while|break|continue|import|from|as|try|except|finally|raise|with|lambda|yield|global|nonlocal|pass|del|assert|in|not|and|or|is|None|True|False|self|cls|async|await)\b/g,
  go: /\b(func|var|const|type|struct|interface|return|if|else|for|range|switch|case|default|break|continue|go|defer|select|chan|map|package|import|nil|true|false)\b/g,
  rust: /\b(fn|let|mut|const|static|struct|enum|trait|impl|pub|use|mod|return|if|else|for|while|loop|match|break|continue|self|Self|super|crate|move|async|await|unsafe|ref|as|where|dyn|trait)\b/g,
  java: /\b(public|private|protected|class|interface|enum|extends|implements|return|if|else|for|while|do|switch|case|break|continue|new|this|super|static|final|void|int|long|double|float|boolean|char|byte|short|String|import|package|try|catch|finally|throw|throws|null|true|false|instanceof|abstract|synchronized|volatile)\b/g,
  bash: /\b(if|then|fi|else|elif|for|in|do|done|while|case|esac|function|return|exit|echo|printf|read|local|export|source|alias|unset|set|shift|cd|pwd|ls|grep|awk|sed|cat|head|tail|sort|uniq|wc|find|xargs)\b/g,
  sh: /\b(if|then|fi|else|elif|for|in|do|done|while|case|esac|function|return|exit|echo|printf|read|local|export|source|alias|unset|set|shift|cd|pwd|ls|grep|awk|sed|cat|head|tail|sort|uniq|wc|find|xargs)\b/g,
};
const STRING_RE = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g;
const COMMENT_RE_SINGLE = /\/\/[^\n]*/g;
const COMMENT_RE_HASH = /#[^\n]*/g;
const NUMBER_RE = /\b(\d+\.?\d*)\b/g;
const FUNC_CALL_RE = /(\b[a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
function highlightCode(code, lang = 'js') {
  if (!process.stdout.isTTY) return code;
  let result = code;
  const strings = [];
  result = result.replace(STRING_RE, (m) => {
    strings.push(m);
    return `\x00STR${strings.length - 1}\x00`;
  });
  const commentRe = (lang === 'py' || lang === 'bash' || lang === 'sh') ? COMMENT_RE_HASH : COMMENT_RE_SINGLE;
  const comments = [];
  result = result.replace(commentRe, (m) => {
    comments.push(m);
    return `\x00CMT${comments.length - 1}\x00`;
  });
  const kwRe = KEYWORDS[lang] || KEYWORDS.js;
  result = result.replace(kwRe, (m) => `${C.magenta}${C.bold}${m}${C.reset}`);
  result = result.replace(NUMBER_RE, `${C.yellow}$1${C.reset}`);
  result = result.replace(FUNC_CALL_RE, `${C.cyan}$1${C.reset}(`);
  result = result.replace(/\x00CMT(\d+)\x00/g, (m, i) => `${C.gray}${comments[i]}${C.reset}`);
  result = result.replace(/\x00STR(\d+)\x00/g, (m, i) => `${C.green}${strings[i]}${C.reset}`);
  return result;
}
function detectLang(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    js: 'js', jsx: 'js', mjs: 'js', cjs: 'js',
    ts: 'ts', tsx: 'ts',
    py: 'py', python: 'py',
    go: 'go', rs: 'rust', rust: 'rust',
    java: 'java', kt: 'java',
    css: 'css', scss: 'css', less: 'css',
    html: 'html', htm: 'html', xml: 'html',
    json: 'json', jsonl: 'json',
    sh: 'sh', bash: 'bash', zsh: 'bash',
    yml: 'json', yaml: 'json',
    md: 'text', txt: 'text',
  };
  return map[ext] || 'text';
}
module.exports = { highlightCode, detectLang };
