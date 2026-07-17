const fs = require('fs');
let code = fs.readFileSync('server/services/admin.ts', 'utf8');

code = code.replace(/return \\`SYSTEM CONFIGURATION:/, "return `SYSTEM CONFIGURATION:");
code = code.replace(/- Titanium Limit: \$\\\$\{db\.system_settings\.limit_titanium \|\| 50000\}\n\\`;/, "- Titanium Limit: $${db.system_settings.limit_titanium || 50000}\n`;");
code = code.replace(/return \\`SUCCESS: Tax rate set to \\\$\{val\}%\\`;/, "return `SUCCESS: Tax rate set to ${val}%`;");
code = code.replace(/return \\`SUCCESS: TWD\/USD exchange rate set to \\\$\{val\}\\`;/, "return `SUCCESS: TWD/USD exchange rate set to ${val}`;");

fs.writeFileSync('server/services/admin.ts', code);
