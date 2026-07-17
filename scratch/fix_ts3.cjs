const fs = require('fs');

let payments = fs.readFileSync('server/controllers/payments.ts', 'utf8');
payments = payments.replace(
  /\$\{err\.message\}/g,
  `\${(err as Error).message}`
);
fs.writeFileSync('server/controllers/payments.ts', payments);

