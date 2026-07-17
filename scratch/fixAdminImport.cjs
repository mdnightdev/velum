const fs = require('fs');
let code = fs.readFileSync('server/services/admin.ts', 'utf8');
code = code.replace(/import \{ bankStore \} from '\.\/bankStore\.js';/g, "import { bankStore, getSystemAccount } from './bankStore.js';");
fs.writeFileSync('server/services/admin.ts', code);
