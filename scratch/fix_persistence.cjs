const fs = require('fs');

// 1. Fix server/db/index.ts
let indexDb = fs.readFileSync('server/db/index.ts', 'utf8');
indexDb = indexDb.replace(
  /'user_wallets', 'wallet_ledger_entries', 'recharge_requests', 'withdrawal_requests',/,
  `'bank_accounts', 'bank_transactions', 'user_wallets', 'wallet_ledger_entries', 'recharge_requests', 'withdrawal_requests',`
);
fs.writeFileSync('server/db/index.ts', indexDb);

// 2. Fix server/db/persistence.ts
let persistence = fs.readFileSync('server/db/persistence.ts', 'utf8');
persistence = persistence.replace(
  /\/\/ Banking & Payment Tables\n\s*db\.user_wallets = loadPayloadTable\('user_wallets', 'user_id'\);/,
  `// Banking & Payment Tables\n        db.bank_accounts = loadPayloadTable('bank_accounts', 'account_id');\n        db.bank_transactions = loadPayloadTable('bank_transactions', 'transaction_id');\n        db.user_wallets = loadPayloadTable('user_wallets', 'user_id');`
);

persistence = persistence.replace(
  /saveTable\('payment_methods', db\.payment_methods \|\| \[\], 'payment_method_id'\);/,
  `saveTable('bank_accounts', (db as any).bank_accounts || [], 'account_id');\n      saveTable('bank_transactions', (db as any).bank_transactions || [], 'transaction_id');\n      saveTable('payment_methods', db.payment_methods || [], 'payment_method_id');`
);

fs.writeFileSync('server/db/persistence.ts', persistence);
