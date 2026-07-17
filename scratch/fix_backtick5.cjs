const fs = require('fs');
let code = fs.readFileSync('server/services/admin.ts', 'utf8');

code = code.replace(/\\`;\n    \}/, "`;\n    }");
fs.writeFileSync('server/services/admin.ts', code);
