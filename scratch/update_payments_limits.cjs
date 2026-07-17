const fs = require('fs');
let code = fs.readFileSync('server/controllers/payments.ts', 'utf8');

const regex = /let maxBalance = 0;[\s\S]*?startingBalance = creditLimit \* 100;/;
const replacement = `let creditLimit = db.system_settings?.limit_default || 500;
      if (institution.includes("Titanium")) creditLimit = db.system_settings?.limit_titanium || 50000;
      else if (institution.includes("Black")) creditLimit = db.system_settings?.limit_black || 15000;
      else if (institution.includes("Platinum")) creditLimit = db.system_settings?.limit_platinum || 5000;
      startingBalance = creditLimit * 100;`;

code = code.replace(regex, replacement);
fs.writeFileSync('server/controllers/payments.ts', code);
