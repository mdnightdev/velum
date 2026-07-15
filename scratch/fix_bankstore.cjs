const fs = require('fs');

let content = fs.readFileSync('server/services/bankStore.ts', 'utf8');

// Replace createAccount
content = content.replace(
  /createAccount: async \((.*?)\): Promise<BankAccount> => {([\s\S]*?)},\s*updateAccountBalance:/,
  'createAccount: async ($1): Promise<BankAccount> => {\n    return bankMutex.run(async () => {$2    });\n  },\n  updateAccountBalance:'
);

// Replace updateAccountBalance
content = content.replace(
  /updateAccountBalance: async \((.*?)\): Promise<BankAccount> => {([\s\S]*?)},\s*freezeAccount:/,
  'updateAccountBalance: async ($1): Promise<BankAccount> => {\n    return bankMutex.run(async () => {$2    });\n  },\n  freezeAccount:'
);

// Replace freezeAccount
content = content.replace(
  /freezeAccount: async \((.*?)\): Promise<BankAccount> => {([\s\S]*?)},\s*logTransaction:/,
  'freezeAccount: async ($1): Promise<BankAccount> => {\n    return bankMutex.run(async () => {$2    });\n  },\n  logTransaction:'
);

// Replace logTransaction
content = content.replace(
  /logTransaction: async \((.*?)\): Promise<BankTransaction> => {([\s\S]*?)}};/g,
  'logTransaction: async ($1): Promise<BankTransaction> => {\n    return bankMutex.run(async () => {$2    });\n  }\n};'
);

fs.writeFileSync('server/services/bankStore.ts', content);
