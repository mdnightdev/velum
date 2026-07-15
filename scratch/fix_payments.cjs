const fs = require('fs');

let content = fs.readFileSync('server/controllers/payments.ts', 'utf8');

// The original order in rechargeWallet:
// const wallet = getOrCreateWallet(user.user_id);
// const balanceAfter = wallet.balance_cents + amount;
// wallet.balance_cents = balanceAfter;
// wallet.updated_at = Date.now();
// const usdWallet = ...
// usdWallet.balance_cents += amount;
// usdWallet.updated_at = Date.now();
// await bankStore.updateAccountBalance...
// await bankStore.logTransaction...
// db.wallet_ledger_entries.push...
// saveDb(true);

// We need to move await calls before the wallet mutation
const toReplace = `      const wallet = getOrCreateWallet(user.user_id);
      const balanceAfter = wallet.balance_cents + amount;
      wallet.balance_cents = balanceAfter;
      wallet.updated_at = Date.now();

      // Multi-currency balance update (USD) - This fixes the UI!
      const usdWallet = getOrCreateWalletBalance(user.user_id, 'USD');
      usdWallet.balance_cents += amount;
      usdWallet.updated_at = Date.now();

        // Deposit corresponding TWD to central bank reserve
        const twdAmountCents = Math.round(amount / 0.031);
        await bankStore.updateAccountBalance('bank_central_reserve', twdAmountCents);
        await bankStore.logTransaction({
            account_id: 'bank_central_reserve',
            type: 'deposit',
            amount_cents: twdAmountCents,
            currency_code: 'TWD',
            description: \`Central liquidity backup for user \${user.user_id} recharge\`,
            status: 'completed'
        });`;

const replaceWith = `        // Deposit corresponding TWD to central bank reserve
        const twdAmountCents = Math.round(amount / 0.031);
        // Atomicity: Do async calls before local DB mutation
        await bankStore.updateAccountBalance('bank_central_reserve', twdAmountCents);
        await bankStore.logTransaction({
            account_id: 'bank_central_reserve',
            type: 'deposit',
            amount_cents: twdAmountCents,
            currency_code: 'TWD',
            description: \`Central liquidity backup for user \${user.user_id} recharge\`,
            status: 'completed'
        });

      const wallet = getOrCreateWallet(user.user_id);
      const balanceAfter = wallet.balance_cents + amount;
      wallet.balance_cents = balanceAfter;
      wallet.updated_at = Date.now();

      // Multi-currency balance update (USD) - This fixes the UI!
      const usdWallet = getOrCreateWalletBalance(user.user_id, 'USD');
      usdWallet.balance_cents += amount;
      usdWallet.updated_at = Date.now();`;

if (content.includes("const wallet = getOrCreateWallet(user.user_id);")) {
  content = content.replace(toReplace, replaceWith);
  fs.writeFileSync('server/controllers/payments.ts', content);
  console.log("payments.ts patched!");
} else {
  console.log("Could not find the block to replace.");
}

