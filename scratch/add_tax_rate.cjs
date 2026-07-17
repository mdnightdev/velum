const fs = require('fs');
let code = fs.readFileSync('server/services/admin.ts', 'utf8');

const replacement = `
    case 'sys-config': {
      if (!db.system_settings) db.system_settings = { platform_fee_percent: 5 };
      return \\\`SYSTEM CONFIGURATION:
- Platform Fee: \\\${db.system_settings.platform_fee_percent}%
- Tax Rate: \\\${db.system_settings.tax_rate_percent || 0}%
- TWD/USD Rate: \\\${db.system_settings.twd_usd_rate || 0.031}
- Default Limit: $\\\${db.system_settings.limit_default || 500}
- Platinum Limit: $\\\${db.system_settings.limit_platinum || 5000}
- Black Limit: $\\\${db.system_settings.limit_black || 15000}
- Titanium Limit: $\\\${db.system_settings.limit_titanium || 50000}
\\\`;
    }
    case 'sys-tax': {
      if (!arg1) return 'ERROR: Usage: /sys tax <value_percent>';
      if (!db.system_settings) db.system_settings = { platform_fee_percent: 5 };
      const val = Number(arg1);
      if (isNaN(val) || val < 0 || val > 100) return 'ERROR: Invalid tax percentage.';
      db.system_settings.tax_rate_percent = val;
      saveDb();
      return \\\`SUCCESS: Tax rate set to \\\${val}%\\\`;
    }
    case 'sys-twd-rate': {
      if (!arg1) return 'ERROR: Usage: /sys twd-rate <value_multiplier>';
      if (!db.system_settings) db.system_settings = { platform_fee_percent: 5 };
      const val = Number(arg1);
      if (isNaN(val) || val <= 0) return 'ERROR: Invalid exchange rate.';
      db.system_settings.twd_usd_rate = val;
      
      const twdRate = db.exchange_rates?.find(r => r.base_currency === 'TWD' && r.quote_currency === 'USD');
      if (twdRate) twdRate.rate = val;
      
      saveDb();
      return \\\`SUCCESS: TWD/USD exchange rate set to \\\${val}\\\`;
    }`;

code = code.replace(/case 'sys-config': \{[\s\S]*?case 'sys-fee': \{/, replacement + "\n    case 'sys-fee': {");
code = code.replace(/else if \(action === '\/sys\/limit'\) action = 'sys-limit';/, "else if (action === '/sys/limit') action = 'sys-limit';\n    else if (action === '/sys/tax') action = 'sys-tax';\n    else if (action === '/sys/twd-rate') action = 'sys-twd-rate';");
fs.writeFileSync('server/services/admin.ts', code);

let ctrl = fs.readFileSync('server/controllers/admin.ts', 'utf8');
ctrl = ctrl.replace(/'\/sys\/limit', '\/daemon\/limit',/, "'/sys/limit', '/daemon/limit',\n  '/sys/tax', '/daemon/tax',\n  '/sys/twd-rate', '/daemon/twd-rate',");
fs.writeFileSync('server/controllers/admin.ts', ctrl);
