var C = require('./output').C;

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
  var wordmark = C.bold + C.cyan + ' STEW Code' + C.reset + C.dim + ' — v2.6 · Zero Deps · Free\n\n';
  return wordmark + art;
}

module.exports = { idle, error, marathon, bootBanner };
