const fs = require('fs');
const db = JSON.parse(fs.readFileSync('./server/db.json', 'utf8'));
console.log('Accounts:', db.bank_accounts ? db.bank_accounts.length : 'none');
