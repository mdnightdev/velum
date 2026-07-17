const fs = require('fs');

let payments = fs.readFileSync('server/controllers/payments.ts', 'utf8');
payments = payments.replace(
  /console.error\(`\[PAYMENTS\] Recharge request creation failed: \$\{err\.message\}`\);/g,
  `console.error(\`[PAYMENTS] Recharge request creation failed: \${(err as Error).message}\`);`
);
payments = payments.replace(
  /console.error\(`\[PAYMENTS\] Withdrawal request creation failed: \$\{err\.message\}`\);/g,
  `console.error(\`[PAYMENTS] Withdrawal request creation failed: \${(err as Error).message}\`);`
);
fs.writeFileSync('server/controllers/payments.ts', payments);

let market = fs.readFileSync('server/services/marketplaceService.ts', 'utf8');
market = market.replace(
  /generateTrcCode\('autowd'/g,
  `generateTrcCode('withdrawal'`
);
fs.writeFileSync('server/services/marketplaceService.ts', market);

