const fs = require('fs');
let code = fs.readFileSync('server/index.ts', 'utf8');
code = code.replace(/console\.log\('REQ:', req\.method, req\.url\);/g, "require('fs').appendFileSync('req-log.txt', req.method + ' ' + req.url + '\\n');");
fs.writeFileSync('server/index.ts', code);
