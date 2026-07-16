const fs = require('fs');
let code = fs.readFileSync('server/services/marketplaceService.ts', 'utf8');

// Replace \` with `
code = code.replace(/\\`/g, '`');
// Replace \${ with ${
code = code.replace(/\\\${/g, '${');

fs.writeFileSync('server/services/marketplaceService.ts', code);
console.log("Fixed strings");
