const fs = require('fs');
let code = fs.readFileSync('server/controllers/payments.ts', 'utf8');
code = code.replace(/import \{ bankStore \} from '\.\.\/services\/bankStore\.js';/g, "import { bankStore, getSystemAccount } from '../services/bankStore.js';");

// Replace 'bank_central_reserve'
code = code.replace(/await bankStore\.updateAccountBalance\('bank_central_reserve',/g, 
  "const clr = await getSystemAccount('CENTRAL'); if(!clr) throw new Error('CLR not found');\n          await bankStore.updateAccountBalance(clr.account_id,");

code = code.replace(/account_id: 'bank_central_reserve'/g, "account_id: clr.account_id");

fs.writeFileSync('server/controllers/payments.ts', code);
