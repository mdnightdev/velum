const fs = require('fs');

let seedCode = fs.readFileSync('server/services/bankStore.ts', 'utf8');
if (seedCode.includes('VELUM MEMBER TRUST')) {
  seedCode = seedCode.replace(/VELUM MEMBER TRUST/g, 'VELUM TRUST BANK');
  fs.writeFileSync('server/services/bankStore.ts', seedCode);
  console.log("Patched bankStore.ts");
}
