function parseArgs(argv) {
  const args = { _: [], flags: {}, options: {} };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--') {
      args._.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];

      if (next && !next.startsWith('--') && !next.startsWith('-')) {
        args.options[key] = next;
        i++;
      } else {
        args.flags[key] = true;
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      const key = arg.slice(1);
      args.flags[key] = true;
    } else {
      args._.push(arg);
    }
  }

  return args;
}

module.exports = { parseArgs };
