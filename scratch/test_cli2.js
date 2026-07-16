const { VelumShell } = require('./cli/shell.js');
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const shell = new VelumShell();
// bypass auth and setup
shell.start(rl);
