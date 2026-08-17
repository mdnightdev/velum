const fs = require('fs');
let code = fs.readFileSync('src/services/doubleRatchetService.ts', 'utf8');
code = code.replace(
  /const usedOneTimePrekey = undefined;\s*\?\s*peerBundle\.oneTimePrekeys\[0\]\s*:\s*undefined;/g,
  'const usedOneTimePrekey = undefined;'
);
fs.writeFileSync('src/services/doubleRatchetService.ts', code);
