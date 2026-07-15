const fs = require('fs');
let code = fs.readFileSync('server/services/bankStore.ts', 'utf8');

const correctLogic = `        if (raw) {
          let parsed = JSON.parse(raw);
          const hasMember = parsed.find((a: any) => a.account_id === 'bank_member_trust');
          const hasCentral = parsed.find((a: any) => a.account_id === 'bank_central_reserve');
          const hasEscrow = parsed.find((a: any) => a.account_id === 'bank_escrow_reserve');
          if (!hasMember || !hasCentral || !hasEscrow) {
             console.log('[BANK-REDIS] Missing core accounts, reseeding redis from local db...');
             parsed = [...(db as any).bank_accounts];
             const encryptedForRedis = parsed.map(a => ({
               ...a,
               account_number: a.account_number && !String(a.account_number).includes(':') ? encryptData(a.account_number) : a.account_number,
               routing_number: a.routing_number && !String(a.routing_number).includes(':') ? encryptData(a.routing_number) : a.routing_number
             }));
             await redisClient.set('bank:accounts', JSON.stringify(encryptedForRedis));
          }
          return parsed.map((a: any) => ({
            ...a,
            account_number: a.account_number && String(a.account_number).includes(':') ? decryptData(a.account_number) : a.account_number,
            routing_number: a.routing_number && String(a.routing_number).includes(':') ? decryptData(a.routing_number) : a.routing_number
          }));
        }`;

code = code.replace(/if \(raw\) \{[\s\S]*?return parsed.map\(\(a: any\) => \(\{[\s\S]*?\}\)\);\n        \}/, correctLogic);
fs.writeFileSync('server/services/bankStore.ts', code);
