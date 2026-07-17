const fs = require('fs');
let code = fs.readFileSync('server/services/bankStore.ts', 'utf8');

// Replace seeder logic
const seederCode = `
export function seedBankSystemIfEmpty(localDb: any) {
  if (!localDb.bank_accounts) localDb.bank_accounts = [];
  if (!localDb.bank_transactions) localDb.bank_transactions = [];

  const performMigration = (oldId: string, newPrefix: string, name: string) => {
    let acc = localDb.bank_accounts.find((a: any) => a.account_name === name);
    if (!acc) {
      acc = {
        account_id: \`\${newPrefix}_\${generateUlid()}\`,
        user_id: null,
        account_number: oldId === 'bank_member_trust' ? '4222 2222 3333 4444' : oldId === 'bank_central_reserve' ? '4222 2222 8888 9999' : '4222 2222 7777 8888',
        routing_number: '021000021',
        account_name: name,
        institution: 'Taiwan Cooperative Bank',
        balance_cents: 0,
        currency_code: 'TWD',
        owner_name: oldId === 'bank_escrow_reserve' ? 'VELUM SECURE ESCROW AGENT' : 'VELUM CORPORATION',
        status: 'active',
        created_at: Date.now() - 31536000000
      };
      if (oldId === 'bank_member_trust') localDb.bank_accounts.unshift(acc);
      else localDb.bank_accounts.push(acc);
    } else if (acc.account_id === oldId) {
      // Migrate old hardcoded ID to ULID
      const newId = \`\${newPrefix}_\${generateUlid()}\`;
      localDb.bank_transactions.forEach((t: any) => {
        if (t.account_id === acc.account_id) t.account_id = newId;
      });
      acc.account_id = newId;
    }
  };

  performMigration('bank_member_trust', 'vtb', 'VELUM TRUST BANK');
  performMigration('bank_central_reserve', 'clr', 'VELUM CENTRAL LIQUIDITY RESERVE');
  performMigration('bank_escrow_reserve', 'eth', 'VELUM ESCROW TRUSTEE HOLDINGS');
}

export const getSystemAccount = async (type: 'MEMBER' | 'CENTRAL' | 'ESCROW') => {
  const accounts = await bankStore.getAccounts();
  if (type === 'MEMBER') return accounts.find(a => a.account_name === 'VELUM TRUST BANK');
  if (type === 'CENTRAL') return accounts.find(a => a.account_name === 'VELUM CENTRAL LIQUIDITY RESERVE');
  if (type === 'ESCROW') return accounts.find(a => a.account_name === 'VELUM ESCROW TRUSTEE HOLDINGS');
  return undefined;
};
`;

const lines = code.split('\n');
const startIdx = lines.findIndex(l => l.includes('export function seedBankSystemIfEmpty'));
const endIdx = lines.findIndex((l, i) => i > startIdx && l === '}');
lines.splice(startIdx, endIdx - startIdx + 1, seederCode);
fs.writeFileSync('server/services/bankStore.ts', lines.join('\n'));
console.log("Updated bankStore.ts");
