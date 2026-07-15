const fs = require('fs');
let code = fs.readFileSync('server/controllers/bank.ts', 'utf8');
code = code.replace(/console\.log\('Returning accounts:', accounts\);/g, "require('fs').appendFileSync('bank-log.txt', JSON.stringify(accounts) + '\\n'); console.log('Returning accounts:', accounts);");
fs.writeFileSync('server/controllers/bank.ts', code);
