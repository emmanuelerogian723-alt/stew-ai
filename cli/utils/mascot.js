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


function bootBanner() {
  var art = idle();
  var wordmark = C.bold + C.cyan + ' STEW Code' + C.reset + C.dim + ' — The Ultimate Terminal Agent · v2.5 · Zero Deps · Free\n\n';
  return wordmark + art;
}

module.exports = { idle, error, marathon, bootBanner };
