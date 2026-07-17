const fs = require('fs');
let code = fs.readFileSync('server/tests/paymentsIdentity.test.ts', 'utf8');
code = code.replace(/methodType: 'CARD', institution: 'Test Bank', maskedNumber: '4242'/g, "methodType: 'CARD', institution: 'Test Bank', methodCategory: 'DEBIT'");
fs.writeFileSync('server/tests/paymentsIdentity.test.ts', code);
