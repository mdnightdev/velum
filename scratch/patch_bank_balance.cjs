const fs = require('fs');
let code = fs.readFileSync('server/services/bankStore.ts', 'utf8');

// Replace 18.4B with 0 for the seed
code = code.replace(/balance_cents: 1840000000000,/g, 'balance_cents: 0,');
// Remove the auto-upgrade self-healing rule
code = code.replace(/\} else if \(centralAccount\.balance_cents === 25000000000\) \{[\s\S]*?centralAccount\.balance_cents = 1840000000000;\n\s*\}/g, '}');

fs.writeFileSync('server/services/bankStore.ts', code);
console.log('Patched bankStore.ts to start Central Liquidity at 0');
