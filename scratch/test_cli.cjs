const { executeCliCommand } = require('./dist/server.cjs');
async function test() {
  const out = await executeCliCommand('fund 100000 "Initial funding"');
  console.log(out);
}
test().catch(e => console.error(e));
