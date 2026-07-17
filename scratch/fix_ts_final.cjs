const fs = require('fs');

let payments = fs.readFileSync('server/controllers/payments.ts', 'utf8');
payments = payments.replace(
  /\} catch \(err\) \{/g,
  `} catch (err: any) {`
);

fs.writeFileSync('server/controllers/payments.ts', payments);
