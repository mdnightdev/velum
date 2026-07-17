const fs = require('fs');
let code = fs.readFileSync('server/controllers/payments.ts', 'utf8');

code = code.replace(/const bankType = extAccount\.account_kind === 'CREDIT_CARD' \? 'CENTRAL' : 'TRUST';/g, "const bankType = extAccount.account_kind === 'CREDIT_CARD' ? 'CENTRAL' : 'MEMBER';");
fs.writeFileSync('server/controllers/payments.ts', code);
