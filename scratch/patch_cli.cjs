const fs = require('fs');

// Patch cli/registry.ts
let regCode = fs.readFileSync('cli/registry.ts', 'utf8');
if (!regCode.includes('fund: {')) {
  regCode = regCode.replace(
    /kill: \{/,
    `fund: {
      desc: 'Fund member trust from central reserve',
      risk: 'CRITICAL',
      args: ['<amount_cents>', '"<description>"']
    },
    kill: {`
  );
  fs.writeFileSync('cli/registry.ts', regCode);
  console.log("Patched cli/registry.ts");
}

// Patch cli/registry.js as well if it exists
if (fs.existsSync('cli/registry.js')) {
  let regJsCode = fs.readFileSync('cli/registry.js', 'utf8');
  if (!regJsCode.includes('fund: {')) {
    regJsCode = regJsCode.replace(
      /kill: \{/,
      `fund: {
        desc: 'Fund member trust from central reserve',
        risk: 'CRITICAL',
        args: ['<amount_cents>', '"<description>"']
      },
      kill: {`
    );
    fs.writeFileSync('cli/registry.js', regJsCode);
    console.log("Patched cli/registry.js");
  }
}

// Patch server/db.ts
let dbCode = fs.readFileSync('server/db.ts', 'utf8');
if (!dbCode.includes("/sys/fund")) {
  dbCode = dbCode.replace(
    /else if \(action === '\/sys\/kill'\)/,
    "else if (action === '/sys/fund') action = 'fund';\n    else if (action === '/sys/kill')"
  );
  fs.writeFileSync('server/db.ts', dbCode);
  console.log("Patched server/db.ts");
}
