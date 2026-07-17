const fs = require('fs');
let code = fs.readFileSync('server/services/admin.ts', 'utf8');

const newCommands = `
    case 'sys-config': {
      if (!db.system_settings) db.system_settings = { platform_fee_percent: 5 };
      return \`SYSTEM CONFIGURATION:
- Platform Fee: \${db.system_settings.platform_fee_percent}%
\`;
    }
    case 'sys-config-set': {
      if (!arg1 || !arg2Plus) return 'ERROR: Usage: sys-config-set <key> <value>';
      if (!db.system_settings) db.system_settings = { platform_fee_percent: 5 };
      if (arg1 === 'platform_fee_percent') {
        const val = Number(arg2Plus);
        if (isNaN(val) || val < 0 || val > 100) return 'ERROR: Invalid percentage value.';
        db.system_settings.platform_fee_percent = val;
        saveDb();
        return \`SUCCESS: platform_fee_percent set to \${val}%\`;
      }
      return \`ERROR: Unknown configuration key: \${arg1}\`;
    }
`;

code = code.replace(/case 'sys-activest': \{/, newCommands + "\n    case 'sys-activest': {");
fs.writeFileSync('server/services/admin.ts', code);
