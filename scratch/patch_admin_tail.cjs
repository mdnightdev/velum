const fs = require('fs');
const path = 'server/services/admin.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/    default: \{[\s\S]*?\}\n  \}\n\}/, `    default: {
      return \` COMMAND NOT RECOGNIZED: "\${action}"\\nType "help" to list valid virtual console commands.\`;
    }
  }
}`);

fs.writeFileSync(path, code);
