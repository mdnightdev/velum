const fs = require('fs');
let schema = fs.readFileSync('server/db/schema.ts', 'utf8');
schema = schema.replace(/verified_sellers\?: number\[\];\n\}/, "verified_sellers?: number[];\n  system_settings?: any;\n}");
schema = schema.replace(/market_assets: \[\]\n\};/, "market_assets: [],\n  system_settings: { platform_fee_percent: 5 }\n};");
fs.writeFileSync('server/db/schema.ts', schema);

let dbIndex = fs.readFileSync('server/db/index.ts', 'utf8');
dbIndex = dbIndex.replace(/if \(\!db\.verified_sellers\) db\.verified_sellers = \[\];/, "if (!db.verified_sellers) db.verified_sellers = [];\n  if (!db.system_settings) db.system_settings = { platform_fee_percent: 5 };");
fs.writeFileSync('server/db/index.ts', dbIndex);

let persistence = fs.readFileSync('server/db/persistence.ts', 'utf8');
persistence = persistence.replace(/db\.verified_sellers = loadPayloadTable\('verified_sellers', 'seller_id'\)\.map\(r => Number\(r\.seller_id\)\);/, "db.verified_sellers = loadPayloadTable('verified_sellers', 'seller_id').map(r => Number(r.seller_id));\n        const settings = loadPayloadTable('system_settings', 'id');\n        if (settings.length > 0) db.system_settings = settings[0];");
persistence = persistence.replace(/saveTable\('verified_sellers', \(db\.verified_sellers \|\| \[\]\)\.map\(id => \(\{ seller_id: id \}\)\), 'seller_id'\);/, "saveTable('verified_sellers', (db.verified_sellers || []).map(id => ({ seller_id: id })), 'seller_id');\n      if (db.system_settings) saveTable('system_settings', [{ id: 1, ...db.system_settings }], 'id');");
fs.writeFileSync('server/db/persistence.ts', persistence);
