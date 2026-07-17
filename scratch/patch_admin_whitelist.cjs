const fs = require('fs');
const path = 'server/controllers/admin.ts';
let code = fs.readFileSync(path, 'utf8');

const newWhitelist = `  '/audit/ip',
  '/audit/nodes',
  '/bank/txlog',
  '/bank/staff',
  '/users/sanctions',
  '/fraud/risklog'
];`;

code = code.replace(/  '\/audit\/ip',\n  '\/audit\/nodes',\n  '\/bank\/txlog'\n\];/, newWhitelist);

fs.writeFileSync(path, code);
