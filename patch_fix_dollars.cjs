const fs = require('fs');
let code = fs.readFileSync('wipe_db.ts', 'utf8');
code = code.replace(/DO \$ DECLARE/g, 'DO $$ DECLARE');
code = code.replace(/END \$/g, 'END $$');
fs.writeFileSync('wipe_db.ts', code);
