const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
};

function colorize(text, color) {
  return `${C[color] || ''}${text}${C.reset}`;
}

function bold(text) { return colorize(text, 'bold'); }
function green(text) { return colorize(text, 'green'); }
function red(text) { return colorize(text, 'red'); }
function yellow(text) { return colorize(text, 'yellow'); }
function cyan(text) { return colorize(text, 'cyan'); }
function dim(text) { return colorize(text, 'dim'); }

let spinnerInterval = null;
let spinnerActive = false;

function startSpinner(message) {
  if (spinnerActive) return;
  spinnerActive = true;
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  process.stdout.write(`${C.cyan}${frames[0]}${C.reset} ${message}`);
  spinnerInterval = setInterval(() => {
    process.stdout.write(`\r${C.cyan}${frames[i = (i + 1) % frames.length]}${C.reset} ${message}`);
  }, 80);
}

function stopSpinner(success = true, message = '') {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }
  if (spinnerActive) {
    process.stdout.write(`\r${' '.repeat(50)}\r`);
    spinnerActive = false;
  }
  if (message) {
    const symbol = success ? '✅' : '❌';
    const colored = success ? green(message) : red(message);
    console.log(`${symbol} ${colored}`);
  }
}

function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

function printError(error) {
  console.error(`\n${red('❌ Error')}: ${error.message || error}`);
  if (error.suggestion) {
    console.error(`${dim('   💡 ' + error.suggestion)}\n`);
  } else {
    console.error('');
  }
}

function printBanner() {
  console.log(`\n${cyan(bold('  S.T.E.W'))} ${dim('— Africa\'s #1 AI Agent API')}`);
  console.log(`${dim('  60+ skills · 12 personas · 6 AI providers')}\n`);
}

module.exports = {
  C, colorize, bold, green, red, yellow, cyan, dim,
  startSpinner, stopSpinner, printJson, printError, printBanner,
};
