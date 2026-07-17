const fs = require('fs');
let code = fs.readFileSync('server/routes/bank.ts', 'utf8');

code = code.replace(/getLimitsMonitoring\n\} from '\.\.\/controllers\/bank\.js';/, "getLimitsMonitoring,\n  getIssuedCards\n} from '../controllers/bank.js';");
code += "\nbankRouter.get('/bank/issued-cards', authenticateAdmin, getIssuedCards);\n";

fs.writeFileSync('server/routes/bank.ts', code);
