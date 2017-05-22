const spawn = require('cross-spawn');
const path = require('path');

const s = `\\${path.sep}`;
const pattern = `test${s}.+\\.spec\\.js`;

const args = [pattern, '--forceExit'];

spawn.sync(
  path.normalize('./node_modules/.bin/jest'),
  args.concat(process.argv.slice(2)),
  { stdio: 'inherit' }
);
