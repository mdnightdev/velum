const fs = require('fs');
let code = fs.readFileSync('server/services/authService.ts', 'utf8');
code = code.replace(/\/\/ Seed the 4 official frontend simulated financial methods for the new user[\s\S]*?saveDb\(\);/m, "saveDb();");
fs.writeFileSync('server/services/authService.ts', code);
