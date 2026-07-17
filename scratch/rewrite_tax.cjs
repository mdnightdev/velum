const fs = require('fs');
let code = fs.readFileSync('server/services/admin.ts', 'utf8');

code = code.replace(/return `SUCCESS: Tax rate set to \$\{val\}%\\`;/g, "return `SUCCESS: Tax rate set to ${val}%`;");
code = code.replace(/return `SUCCESS: TWD\/USD exchange rate set to \$\{val\}\\`;/g, "return `SUCCESS: TWD/USD exchange rate set to ${val}`;");

fs.writeFileSync('server/services/admin.ts', code);
