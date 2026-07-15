const fs = require('fs');
let code = fs.readFileSync('server/index.ts', 'utf8');
code = code.replace(/app\.use\(\(req, res, next\) => \{ require\('fs'\)\.appendFileSync\('req-log\.txt', req\.method \+ ' ' \+ req\.url \+ '\\n'\); next\(\); \}\);\n/g, "");
fs.writeFileSync('server/index.ts', code);
