const fs = require('fs');
let code = fs.readFileSync('server/controllers/bank.ts', 'utf8');
code = code.replace(/require\('fs'\)\.appendFileSync\('bank-log\.txt', JSON\.stringify\(accounts\) \+ '\\n'\); /g, "");
fs.writeFileSync('server/controllers/bank.ts', code);
