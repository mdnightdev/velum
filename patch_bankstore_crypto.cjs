const fs = require('fs');

let content = fs.readFileSync('server/services/bankStore.ts', 'utf8');

if (!content.includes('encryptData')) {
  content = content.replace(
    /import \{ createClient \} from 'redis';/,
    "import { createClient } from 'redis';\nimport { encryptData, decryptData } from './cryptoService.js';"
  );
}

// Replace getAccounts body to use decrypt
content = content.replace(
  /getAccounts: async \(\): Promise<BankAccount\[\]> => \{([\s\S]*?)return \(db as any\)\.bank_accounts \|\| \[\];\n  \},/g,
  `getAccounts: async (): Promise<BankAccount[]> => {$1
    const rawLocal = (db as any).bank_accounts || [];
    return rawLocal.map((a: any) => ({
      ...a,
      account_number: a.account_number && a.account_number.includes(':') ? decryptData(a.account_number) : a.account_number,
      routing_number: a.routing_number && a.routing_number.includes(':') ? decryptData(a.routing_number) : a.routing_number
    }));
  },`
);

// We need to also fix the Redis part inside getAccounts:
content = content.replace(
  /const raw = await redisClient\.get\('bank:accounts'\);\n\s*if \(raw\) return JSON\.parse\(raw\);/g,
  `const raw = await redisClient.get('bank:accounts');
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed.map((a: any) => ({
            ...a,
            account_number: a.account_number && a.account_number.includes(':') ? decryptData(a.account_number) : a.account_number,
            routing_number: a.routing_number && a.routing_number.includes(':') ? decryptData(a.routing_number) : a.routing_number
          }));
        }`
);

// Replace saveAccounts to encrypt
content = content.replace(
  /saveAccounts: async \(accounts: BankAccount\[\]\): Promise<void> => {\n\s*\(db as any\)\.bank_accounts = accounts;/g,
  `saveAccounts: async (accounts: BankAccount[]): Promise<void> => {
    const encryptedAccounts = accounts.map(a => ({
      ...a,
      account_number: a.account_number && !a.account_number.includes(':') ? encryptData(a.account_number) : a.account_number,
      routing_number: a.routing_number && !a.routing_number.includes(':') ? encryptData(a.routing_number) : a.routing_number
    }));
    (db as any).bank_accounts = encryptedAccounts;`
);

content = content.replace(
  /await redisClient\.set\('bank:accounts', JSON\.stringify\(accounts\)\);/g,
  `await redisClient.set('bank:accounts', JSON.stringify(encryptedAccounts));`
);

fs.writeFileSync('server/services/bankStore.ts', content);
