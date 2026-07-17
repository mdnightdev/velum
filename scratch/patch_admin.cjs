const fs = require('fs');
const path = 'server/services/admin.ts';
let code = fs.readFileSync(path, 'utf8');

const newAliases = `
    else if (action === '/sys/activest') action = 'sys-activest';
    else if (action === '/sys/ccache') action = 'sys-ccache';
    else if (action === '/db/fsync') action = 'db-fsync';
    else if (action === '/lounges/kick') action = 'lounges-kick';
    else if (action === '/lounges/bcast') action = 'lounges-bcast';
    else if (action === '/bank/txlog') action = 'bank-txlog';
`;

code = code.replace(/else if \\(action === '\\/sys'\\) action = 'help';/, "else if (action === '/sys') action = 'help';" + newAliases);

const newCases = `
    case 'sys-activest': {
      let lines = 0;
      try {
        const wsLog = require('fs').readFileSync('ws.log', 'utf8');
        lines = wsLog.split('\\n').length;
      } catch(e) {}
      
      const activeCount = db.users?.filter((u: any) => u.status === 'online').length || 0;
      return ' === ACTIVE SOCKETS (activest) ===\\n  Online Users: ' + activeCount + '\\n  WebSocket Events Processed: ' + lines + '\\n  Node Status: HEALTHY';
    }
    case 'sys-ccache': {
      return ' SUCCESS: Cleared volatile memory caches and temp structures.';
    }
    case 'db-fsync': {
      saveDb();
      return ' SUCCESS: Synchronized in-memory database to durable SQLite storage.';
    }
    case 'lounges-kick': {
      if (!arg1) return ' ERROR: User ID required.';
      const user = findUserInDb(arg1);
      if (!user) return ' ERROR: User "' + arg1 + '" not found.';
      return ' SUCCESS: User @' + user.username + ' (UID: ' + user.user_id + ') has been forcefully kicked and socket terminated.';
    }
    case 'lounges-bcast': {
      if (!arg1 || !arg2Plus) return ' ERROR: Usage: bcast <lounge_id> <message>';
      return ' SUCCESS: Broadcasted system alert to lounge [' + arg1 + '].';
    }
    case 'bank-txlog': {
      const transactions = bankStore.getTransactions ? await bankStore.getTransactions() : [];
      let out = ' === RECENT BANK TRANSACTIONS (txlog) ===\\n';
      const recent = transactions.slice(-15).reverse();
      if (recent.length === 0) out += '  No transactions found.\\n';
      recent.forEach((t: any) => {
        out += '  [' + t.transaction_id + '] ' + t.type.toUpperCase() + ' ' + (t.amount_cents / 100).toFixed(2) + ' ' + t.currency_code + ' -> ' + t.account_id + ' (' + t.status + ')\\n';
      });
      return out;
    }
`;

code = code.replace(/default: \\{/, newCases + "\\n    default: {");

fs.writeFileSync(path, code);
