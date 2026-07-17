const fs = require('fs');
let code = fs.readFileSync('src/components/Admin/AdminBank.tsx', 'utf8');

code = code.replace(/setSelectedWithdrawal\(null\); \}\}/g, "setSelectedWithdrawal(null); setSelectedDispute(null); }}");

fs.writeFileSync('src/components/Admin/AdminBank.tsx', code);
