const fs = require('fs');
let code = fs.readFileSync('server/controllers/bank.ts', 'utf8');
code = code.replace(/console\.error\('RETURNING ACCOUNTS:', accounts\);/g, "require('fs').appendFileSync('bank-debug.txt', 'ACCOUNTS: ' + JSON.stringify(accounts) + '\\n');");
code = code.replace(/console\.error\('BANK ERR:', err\);/g, "require('fs').appendFileSync('bank-debug.txt', 'ERR: ' + err.stack + '\\n');");
fs.writeFileSync('server/controllers/bank.ts', code);
