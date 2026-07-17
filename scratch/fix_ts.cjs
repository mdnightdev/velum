const fs = require('fs');

// 1. Fix server/db/schema.ts
let schema = fs.readFileSync('server/db/schema.ts', 'utf8');
schema = schema.replace(
  /export interface DbSchema \{/,
  `export interface DbSchema {\n  bank_accounts?: any[];\n  bank_transactions?: any[];`
);
fs.writeFileSync('server/db/schema.ts', schema);

// 2. Fix payments.ts errors
let payments = fs.readFileSync('server/controllers/payments.ts', 'utf8');
payments = payments.replace(
  /console.error\(`\[PAYMENTS\] Payment method creation failed: \$\{err.message\}`\);/g,
  `console.error(\`[PAYMENTS] Payment method creation failed: \${(err as Error).message}\`);`
);
payments = payments.replace(
  /console.error\(`\[PAYMENTS\] Recharge request creation failed: \$\{err.message\}`\);/g,
  `console.error(\`[PAYMENTS] Recharge request creation failed: \${(err as Error).message}\`);`
);
fs.writeFileSync('server/controllers/payments.ts', payments);

// 3. Fix marketplaceService.ts errors
let market = fs.readFileSync('server/services/marketplaceService.ts', 'utf8');
market = market.replace(
  /generateTrcCode\('autowd', 'ACH'\)/,
  `generateTrcCode('withdrawal', 'ACH')`
);
market = market.replace(
  /const bankType = extAccount.account_kind === 'CREDIT_CARD' \? 'CENTRAL' : 'TRUST';/,
  `const bankType = extAccount.account_kind === 'CREDIT_CARD' ? 'CENTRAL' : 'MEMBER';`
);
fs.writeFileSync('server/services/marketplaceService.ts', market);

