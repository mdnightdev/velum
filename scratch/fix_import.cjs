const fs = require('fs');
let code = fs.readFileSync('server/services/marketplaceService.ts', 'utf8');

code = code.replace(/await import\('\.\.\/db\/bankStore\.js'\);/g, "await import('./bankStore.js');");
fs.writeFileSync('server/services/marketplaceService.ts', code);
