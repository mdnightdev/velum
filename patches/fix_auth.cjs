const fs = require('fs');
let code = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');

if (!code.includes('purgeLocalMessages')) {
  code = code.replace(
    "import { purgeCryptoVault } from '../services/cryptoDbStore';",
    "import { purgeCryptoVault } from '../services/cryptoDbStore';\nimport { purgeLocalMessages } from '../utils/indexedDb';"
  );
  
  code = code.replace(
    /purgeCryptoVault\(\)\.catch\(\(\) => \{\}\);/g,
    "purgeCryptoVault().catch(() => {});\n    purgeLocalMessages().catch(() => {});"
  );
  
  fs.writeFileSync('src/context/AuthContext.tsx', code);
}
