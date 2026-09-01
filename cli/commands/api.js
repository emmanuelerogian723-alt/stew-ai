var { smartCall, callApi, formatResponse } = require('../utils/apicaller');
var C = { reset:'\x1b[0m', bold:'\x1b[1m', dim:'\x1b[2m', red:'\x1b[31m', green:'\x1b[32m', cyan:'\x1b[36m' };

async function apiCommand(args) {
  var input = (args._ && args._.join(' ')) || '';
  var jsonOutput = args.flags && args.flags.json;

  if (!input) {
    console.log(C.red + 'Usage: stew api <method?> <url> [options]' + C.reset);
    console.log(C.dim + 'Methods: GET (default), POST, PUT, PATCH, DELETE, graphql' + C.reset);
    console.log(C.dim + 'Options: -H "Header:Value" -d "json body" -q key=value --json' + C.reset);
    console.log(C.dim + 'Examples:' + C.reset);
    console.log(C.dim + '  stew api https://api.github.com/repos/nodejs/node' + C.reset);
    console.log(C.dim + '  stew api POST https://api.example.com/users -d \'{"name":"test"}\'' + C.reset);
    console.log(C.dim + '  stew api https://api.example.com/data -H "Authorization:Bearer mytoken"' + C.reset);
    process.exit(1);
  }

  var isGraphQL = false;
  if (input.startsWith('graphql ')) {
    isGraphQL = true;
    input = 'POST ' + input.slice(8);
  }

  if (!jsonOutput) console.log(C.cyan + 'Calling API...' + C.reset);

  try {
    var result = await smartCall(input, {});
    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatResponse(result));
    }
  } catch (err) {
    console.log(C.red + 'Error: ' + err.message + C.reset);
    process.exit(1);
  }
}

module.exports = { apiCommand };
