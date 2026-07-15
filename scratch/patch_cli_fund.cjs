const fs = require('fs');
let code = fs.readFileSync('server/db.ts', 'utf8');
const caseFund = `    case 'fund': {
      if (!arg1 || !arg2Plus) return ' ERROR: Usage: fund <amount_cents> <description>';
      let amountCents = parseInt(arg1);
      if (isNaN(amountCents)) return ' ERROR: Amount must be an integer (in cents).';
      const memberTrust = (db as any).bank_accounts?.find((a: any) => a.account_id === 'bank_member_trust');
      if (!memberTrust) return ' ERROR: bank_member_trust account not found.';
      memberTrust.balance_cents += amountCents;
      
      if (!(db as any).bank_transactions) (db as any).bank_transactions = [];
      (db as any).bank_transactions.push({
        transaction_id: \`bank_tx_\${Date.now()}\`,
        account_id: 'bank_member_trust',
        type: amountCents >= 0 ? 'deposit' : 'withdrawal',
        amount_cents: Math.abs(amountCents),
        currency_code: 'TWD',
        description: arg2Plus,
        timestamp: Date.now(),
        status: 'completed'
      });
      executeSaveDb();
      return \` SUCCESS: Member Trust account adjusted by \${amountCents/100} TWD.\`;
    }\n`;

code = code.replace("    case 'help': {", caseFund + "    case 'help': {");
fs.writeFileSync('server/db.ts', code);
