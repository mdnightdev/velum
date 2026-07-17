const fs = require('fs');
let code = fs.readFileSync('server/services/admin.ts', 'utf8');

code = code.replace(/return \\`SYSTEM CONFIGURATION:/, "return `SYSTEM CONFIGURATION:");
code = code.replace(/- Titanium Limit: \$\\\$\{db\.system_settings\.limit_titanium \|\| 50000\}\n\\`;/, "- Titanium Limit: $${db.system_settings.limit_titanium || 50000}\n`;");
code = code.replace(/return \\`SUCCESS: Platform fee set to \\\$\{val\}%\\`;/, "return `SUCCESS: Platform fee set to ${val}%`;");
code = code.replace(/return \\`ERROR: Unknown tier \\\$\{tier\}\\`;/, "return `ERROR: Unknown tier ${tier}`;");
code = code.replace(/return \\`SUCCESS: Credit limit for \\\$\{tier\} set to \$\\\$\{val\}\\`;/, "return `SUCCESS: Credit limit for ${tier} set to $${val}`;");

fs.writeFileSync('server/services/admin.ts', code);
