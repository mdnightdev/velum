const fs = require('fs');
let code = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');

if (!code.includes('clearMemoryState')) {
  if (!code.includes("import { doubleRatchetService }")) {
    code = code.replace(
      "import { purgeLocalMessages } from '../utils/indexedDb';",
      "import { purgeLocalMessages } from '../utils/indexedDb';\nimport { doubleRatchetService } from '../services/doubleRatchetService';"
    );
  }
  
  code = code.replace(
    /purgeLocalMessages\(\)\.catch\(\(\) => \{\}\);/g,
    "purgeLocalMessages().catch(() => {});\n    doubleRatchetService.clearMemoryState();"
  );
  
  fs.writeFileSync('src/context/AuthContext.tsx', code);
}
