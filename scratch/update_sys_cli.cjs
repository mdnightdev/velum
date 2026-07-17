const fs = require('fs');
let code = fs.readFileSync('server/services/admin.ts', 'utf8');

// Replace sys-config-set with sys-fee and sys-limit
const oldCommands = /case 'sys-config': \{[\s\S]*?case 'sys-activest': \{/;
const newCommands = `
    case 'sys-config': {
      if (!db.system_settings) db.system_settings = { platform_fee_percent: 5 };
      return \\\`SYSTEM CONFIGURATION:
- Platform Fee: \\\${db.system_settings.platform_fee_percent}%
- Default Limit: $\\\${db.system_settings.limit_default || 500}
- Platinum Limit: $\\\${db.system_settings.limit_platinum || 5000}
- Black Limit: $\\\${db.system_settings.limit_black || 15000}
- Titanium Limit: $\\\${db.system_settings.limit_titanium || 50000}
\\\`;
    }
    case 'sys-fee': {
      if (!arg1) return 'ERROR: Usage: /sys fee <value>';
      if (!db.system_settings) db.system_settings = { platform_fee_percent: 5 };
      const val = Number(arg1);
      if (isNaN(val) || val < 0 || val > 100) return 'ERROR: Invalid percentage value.';
      db.system_settings.platform_fee_percent = val;
      saveDb();
      return \\\`SUCCESS: Platform fee set to \\\${val}%\\\`;
    }
    case 'sys-limit': {
      if (!arg1 || !arg2Plus) return 'ERROR: Usage: /sys limit <tier> <value> (tiers: default, platinum, black, titanium)';
      if (!db.system_settings) db.system_settings = { platform_fee_percent: 5 };
      const val = Number(arg2Plus);
      if (isNaN(val) || val < 0) return 'ERROR: Invalid limit value.';
      
      const tier = arg1.toLowerCase();
      if (tier === 'default') db.system_settings.limit_default = val;
      else if (tier === 'platinum') db.system_settings.limit_platinum = val;
      else if (tier === 'black') db.system_settings.limit_black = val;
      else if (tier === 'titanium') db.system_settings.limit_titanium = val;
      else return \\\`ERROR: Unknown tier \\\${tier}\\\`;
      
      saveDb();
      return \\\`SUCCESS: Credit limit for \\\${tier} set to $\\\${val}\\\`;
    }
    case 'sys-activest': {`;

code = code.replace(oldCommands, newCommands);

code = code.replace(/else if \(action === '\/sys\/config'\) action = 'sys-config';\n    else if \(action === '\/sys\/config-set'\) action = 'sys-config-set';/, 
  "else if (action === '/sys/config') action = 'sys-config';\n    else if (action === '/sys/fee') action = 'sys-fee';\n    else if (action === '/sys/limit') action = 'sys-limit';");

fs.writeFileSync('server/services/admin.ts', code);

let ctrl = fs.readFileSync('server/controllers/admin.ts', 'utf8');
ctrl = ctrl.replace(/'\/sys\/config', '\/daemon\/config',\n  '\/sys\/config-set', '\/daemon\/config-set',/, 
  "'/sys/config', '/daemon/config',\n  '/sys/fee', '/daemon/fee',\n  '/sys/limit', '/daemon/limit',");
fs.writeFileSync('server/controllers/admin.ts', ctrl);
