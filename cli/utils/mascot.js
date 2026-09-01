var C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
  gray: '\x1b[90m', white: '\x1b[37m',
  orange: '\x1b[38;5;208m', brown: '\x1b[38;5;94m',
  lightorange: '\x1b[38;5;215m', steam: '\x1b[38;5;250m',
};

function idle() {
  return '\n' +
    '        ' + C.steam + '. . .' + C.reset + '\n' +
    '       ' + C.steam + '(  ' + C.dim + '~' + C.reset + C.steam + '  )' + C.reset + '\n' +
    '      ' + C.dim + '`-.___.-`' + C.reset + '\n' +
    '    ' + C.orange + '╱' + C.lightorange + '▔▔▔▔▔▔▔' + C.orange + '╲' + C.reset + '\n' +
    '   ' + C.orange + '│' + C.lightorange + ' ◕     ◕ ' + C.orange + '│' + C.reset + '  ' + C.bold + C.cyan + 'STEW' + C.reset + '\n' +
    '   ' + C.orange + '│' + C.lightorange + '   ⌣    ' + C.orange + '│' + C.reset + '  ' + C.dim + 'ready when you are' + C.reset + '\n' +
    '    ' + C.brown + '╲_______╱' + C.reset + '\n' +
    '     ' + C.brown + '▔▔▔▔▔▔▔' + C.reset + '\n';
}

function thinking() {
  return '\n' +
    '       ' + C.steam + '~ ? ~' + C.reset + '\n' +
    '      ' + C.steam + '(     )' + C.reset + '\n' +
    '    ' + C.orange + '╱' + C.lightorange + '▔▔▔▔▔▔▔' + C.orange + '╲' + C.reset + '\n' +
    '   ' + C.orange + '│' + C.lightorange + ' ◔     ◔ ' + C.orange + '│' + C.reset + '  ' + C.bold + C.cyan + 'STEW' + C.reset + '\n' +
    '   ' + C.orange + '│' + C.lightorange + '   ‿    ' + C.orange + '│' + C.reset + '  ' + C.dim + 'thinking...' + C.reset + '\n' +
    '    ' + C.brown + '╲_______╱' + C.reset + '\n' +
    '     ' + C.brown + '▔▔▔▔▔▔▔' + C.reset + '\n';
}

function working(task) {
  return '\n' +
    '      ' + C.steam + ') ( ) (' + C.reset + '\n' +
    '     ' + C.steam + '(  ‿‿‿  )' + C.reset + '\n' +
    '    ' + C.orange + '╱' + C.lightorange + '▔▔▔▔▔▔▔' + C.orange + '╲' + C.reset + '\n' +
    '   ' + C.orange + '│' + C.lightorange + ' ●     ● ' + C.orange + '│' + C.reset + '  ' + C.bold + C.cyan + 'STEW' + C.reset + '\n' +
    '   ' + C.orange + '│' + C.lightorange + '   ▽    ' + C.orange + '│' + C.reset + '  ' + C.dim + (task || 'working...') + C.reset + '\n' +
    '    ' + C.brown + '╲▓▓▓▓▓▓▓╱' + C.reset + '\n' +
    '     ' + C.brown + '▔▔▔▔▔▔▔' + C.reset + '\n';
}

function success() {
  return '\n' +
    '       ' + C.yellow + '✦ ✧ ✦' + C.reset + '\n' +
    '      ' + C.steam + '(  ✓  )' + C.reset + '\n' +
    '    ' + C.orange + '╱' + C.lightorange + '▔▔▔▔▔▔▔' + C.orange + '╲' + C.reset + '\n' +
    '   ' + C.orange + '│' + C.lightorange + ' ★     ★ ' + C.orange + '│' + C.reset + '  ' + C.bold + C.green + 'STEW' + C.reset + '\n' +
    '   ' + C.orange + '│' + C.lightorange + '   ◠    ' + C.orange + '│' + C.reset + '  ' + C.green + 'done!' + C.reset + '\n' +
    '    ' + C.brown + '╲_______╱' + C.reset + '\n' +
    '     ' + C.brown + '▔▔▔▔▔▔▔' + C.reset + '\n';
}

function error() {
  return '\n' +
    '       ' + C.red + '‼' + C.reset + '\n' +
    '      ' + C.steam + '(  x  )' + C.reset + '\n' +
    '    ' + C.orange + '╱' + C.lightorange + '▔▔▔▔▔▔▔' + C.orange + '╲' + C.reset + '\n' +
    '   ' + C.orange + '│' + C.lightorange + ' ×     × ' + C.orange + '│' + C.reset + '  ' + C.bold + C.red + 'STEW' + C.reset + '\n' +
    '   ' + C.orange + '│' + C.lightorange + '   ︵    ' + C.orange + '│' + C.reset + '  ' + C.red + 'hit a snag' + C.reset + '\n' +
    '    ' + C.brown + '╲_______╱' + C.reset + '\n' +
    '     ' + C.brown + '▔▔▔▔▔▔▔' + C.reset + '\n';
}

function marathon(hours) {
  return '\n' +
    '     ' + C.cyan + '═══════' + C.reset + '\n' +
    '    ' + C.orange + '╱' + C.lightorange + '▔▔▔▔▔▔▔' + C.orange + '╲' + C.reset + '\n' +
    '   ' + C.orange + '│' + C.lightorange + ' ◉     ◉ ' + C.orange + '│' + C.reset + '  ' + C.bold + C.cyan + 'STEW' + C.reset + ' ' + C.dim + 'MARATHON MODE' + C.reset + '\n' +
    '   ' + C.orange + '│' + C.lightorange + '   ➔    ' + C.orange + '│' + C.reset + '  ' + C.dim + (hours ? 'running up to ' + hours + 'h' : 'running until done') + C.reset + '\n' +
    '    ' + C.brown + '╲▓▓▓▓▓▓▓╱' + C.reset + '\n' +
    '     ' + C.brown + '▔▔▔▔▔▔▔' + C.reset + '\n';
}

function mini(state) {
  var faces = {
    idle: C.orange + '(◕‿◕)' + C.reset,
    thinking: C.orange + '(◔‿◔)' + C.reset,
    working: C.orange + '(●▽●)' + C.reset,
    success: C.green + '(★◠★)' + C.reset,
    error: C.red + '(×︵×)' + C.reset,
  };
  return faces[state] || faces.idle;
}

function bootBanner() {
  var art = idle();
  var wordmark =
    C.cyan + C.bold + '  ___  ___ ___ ___ ___      ' + C.reset + '\n' +
    C.cyan + C.bold + ' / __|/ __| __/ __| _ \\     ' + C.reset + C.dim + 'Code' + C.reset + '\n' +
    C.cyan + C.bold + ' \\__ \\ (__| _| (__|   /     ' + C.reset + C.dim + 'The Ultimate Terminal Agent' + C.reset + '\n' +
    C.cyan + C.bold + ' |___/\\___|___\\___|_|_\\     ' + C.reset + C.dim + 'v2.1 · Zero Deps · Free' + C.reset + '\n';
  return wordmark + art;
}

module.exports = { idle, thinking, working, success, error, marathon, mini, bootBanner };
