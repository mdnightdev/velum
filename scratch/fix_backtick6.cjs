const fs = require('fs');
let code = fs.readFileSync('server/services/admin.ts', 'utf8');

code = code.replace(/\\`SUCCESS:/g, "`SUCCESS:");
fs.writeFileSync('server/services/admin.ts', code);
