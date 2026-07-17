const fs = require('fs');
let code = fs.readFileSync('server/services/banking/commands.ts', 'utf8');

code = code.replace(/import \{ bankStore \} from '\.\.\/\.\.\/services\/bankStore\.js';/g, "import { bankStore, getSystemAccount } from '../../services/bankStore.js';");

code = code.replace(/const centralReserve = accounts\.find\(\(a: any\) => a\.account_id === 'bank_central_reserve'\);/g, "const centralReserve = await getSystemAccount('CENTRAL');");
code = code.replace(/const memberTrust = accounts\.find\(\(a: any\) => a\.account_id === 'bank_member_trust'\);/g, "const memberTrust = await getSystemAccount('MEMBER');");
code = code.replace(/const escrowReserve = accounts\.find\(\(a: any\) => a\.account_id === 'bank_escrow_reserve'\);/g, "const escrowReserve = await getSystemAccount('ESCROW');");
code = code.replace(/account_id: 'bank_central_reserve'/g, "account_id: centralReserve.account_id");
code = code.replace(/account_id: 'bank_member_trust'/g, "account_id: memberTrust.account_id");
code = code.replace(/account_id: 'bank_escrow_reserve'/g, "account_id: escrowReserve.account_id");
code = code.replace(/ERROR: bank_central_reserve account not found\./g, "ERROR: central reserve account not found.");

fs.writeFileSync('server/services/banking/commands.ts', code);
