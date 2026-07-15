const fs = require('fs');
let code = fs.readFileSync('server/services/bankStore.ts', 'utf8');
code = code.replace(
  `          const parsed = JSON.parse(raw);
          return parsed.map((a: any) => ({`,
  `          let parsed = JSON.parse(raw);
          const hasMember = parsed.find((a: any) => a.account_id === 'bank_member_trust');
          if (!hasMember) {
             const memberAcc = (db as any).bank_accounts.find((a: any) => a.account_id === 'bank_member_trust');
             if (memberAcc) {
                parsed.unshift(memberAcc);
                await redisClient.set('bank:accounts', JSON.stringify(parsed));
             }
          }
          return parsed.map((a: any) => ({`
);
fs.writeFileSync('server/services/bankStore.ts', code);
