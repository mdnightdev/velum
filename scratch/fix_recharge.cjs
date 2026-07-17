const fs = require('fs');
let code = fs.readFileSync('server/controllers/payments.ts', 'utf8');

const toReplace = `// Also update legacy VLM wallet if needed (to match original behavior)
          const vlmBalance = uow.getBalance(user.user_id, 'VLM');
          const newVlmBalance = vlmBalance + amount;
          uow.stageBalanceUpdate(user.user_id, 'VLM', newVlmBalance);`;

code = code.replace(toReplace, "// Fixed double recharge exploit");

fs.writeFileSync('server/controllers/payments.ts', code);
