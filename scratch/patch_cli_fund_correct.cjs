const fs = require('fs');
let code = fs.readFileSync('server/db.ts', 'utf8');

const correctCase = `    case 'fund': {
      if (!arg1 || !arg2Plus) return ' ERROR: Usage: fund <amount_cents> <description>';
      let amountCents = parseInt(arg1);
      if (isNaN(amountCents)) return ' ERROR: Amount must be an integer (in cents).';
      const memberTrust = (db as any).bank_accounts?.find((a: any) => a.account_id === 'bank_member_trust');
      const centralReserve = (db as any).bank_accounts?.find((a: any) => a.account_id === 'bank_central_reserve');
      
      if (!memberTrust) return ' ERROR: bank_member_trust account not found.';
      if (!centralReserve) return ' ERROR: bank_central_reserve account not found.';
      
      memberTrust.balance_cents += amountCents;
      centralReserve.balance_cents -= amountCents;
      
      if (!(db as any).bank_transactions) (db as any).bank_transactions = [];
      (db as any).bank_transactions.push({
        transaction_id: \`bank_tx_\${Date.now()}\`,
        account_id: 'bank_member_trust',
        type: 'deposit',
        amount_cents: Math.abs(amountCents),
        currency_code: 'TWD',
        description: \`Transfer from Central Reserve: \${arg2Plus}\`,
        timestamp: Date.now(),
        status: 'completed'
      });
      (db as any).bank_transactions.push({
        transaction_id: \`bank_tx_\${Date.now()+1}\`,
        account_id: 'bank_central_reserve',
        type: 'withdrawal',
        amount_cents: Math.abs(amountCents),
        currency_code: 'TWD',
        description: \`Transfer to Member Trust: \${arg2Plus}\`,
        timestamp: Date.now(),
        status: 'completed'
      });
      executeSaveDb();
      return \` SUCCESS: Transferred \${amountCents/100} TWD from Central Reserve to Member Trust.\`;
    }`;

code = code.replace(/case 'fund': \{[\s\S]*?return ` SUCCESS: Member Trust account adjusted by \${amountCents\/100} TWD.`;\n    \}/, correctCase);
fs.writeFileSync('server/db.ts', code);
