const fs = require('fs');

let payments = fs.readFileSync('server/controllers/payments.ts', 'utf8');
payments = payments.replace(
  /console.error\(`\[PAYMENTS\] Payment method creation failed: \$\{err.message\}`\);/g,
  `console.error(\`[PAYMENTS] Payment method creation failed: \${(err as any).message}\`);`
);
payments = payments.replace(
  /console.error\(`\[PAYMENTS\] Recharge request creation failed: \$\{err.message\}`\);/g,
  `console.error(\`[PAYMENTS] Recharge request creation failed: \${(err as any).message}\`);`
);
payments = payments.replace(
  /console.error\(`\[PAYMENTS\] Withdrawal request creation failed: \$\{err.message\}`\);/g,
  `console.error(\`[PAYMENTS] Withdrawal request creation failed: \${(err as any).message}\`);`
);
// General fallback for any remaining err.message inside templates in payments.ts:
payments = payments.replace(/\$\{err\.message\}/g, '${(err as any).message}');

fs.writeFileSync('server/controllers/payments.ts', payments);

