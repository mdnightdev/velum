const fs = require('fs');
let code = fs.readFileSync('server/controllers/payments.ts', 'utf8');

code = code.replace(/res\.status\(500\)\.json\(\{ error: 'Recharge process failed\.' \}\);/g, "res.status(500).json({ error: 'Recharge process failed: ' + (err.message || String(err)) });");
code = code.replace(/res\.status\(500\)\.json\(\{ error: 'Failed to process payout review\.' \}\);/g, "res.status(500).json({ error: 'Failed to process payout review: ' + (err.message || String(err)) });");
fs.writeFileSync('server/controllers/payments.ts', code);
