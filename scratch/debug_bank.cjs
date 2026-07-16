const fs = require('fs');
let code = fs.readFileSync('server/controllers/bank.ts', 'utf8');
code = code.replace(/res\.status\(500\)\.json\(\{ error: err\.message \|\| 'Failed to fetch bank accounts\.' \}\);/g, "console.error('BANK ERR:', err); res.status(500).json({ error: err.message || 'Failed to fetch bank accounts.' });");
code = code.replace(/console\.log\('Returning accounts:', accounts\);/g, "console.error('RETURNING ACCOUNTS:', accounts);");
fs.writeFileSync('server/controllers/bank.ts', code);
