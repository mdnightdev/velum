const fs = require('fs');
let code = fs.readFileSync('server/services/bankStore.ts', 'utf8');
code = code.replace("const encryptedForRedis = parsed.map(a => ({", "const encryptedForRedis = parsed.map((a: any) => ({");
fs.writeFileSync('server/services/bankStore.ts', code);
