async function run() {
  try {
    const { executeCliCommand } = require('./dist/server.cjs');
    const out = await executeCliCommand('fund 1000000 "System seed"');
    console.log("OUT:", out);
  } catch (e) {
    console.error(e);
  }
}
run();
