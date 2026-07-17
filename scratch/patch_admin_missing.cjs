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
    else if (action === '/bank/staff') action = 'bank-staff';
    else if (action === '/users/sanctions') action = 'users-sanctions';
    else if (action === '/fraud/risklog') action = 'fraud-risklog';
`;

code = code.replace(/    else if \(action === '\/sys\/activest'\) action = 'sys-activest';[\s\S]*?    else if \(action === '\/bank\/txlog'\) action = 'bank-txlog';/, newAliases.trim());

const newCases = `
    case 'bank-staff': {
      const staff = db.users?.filter((u: any) => u.role === 'FINANCE_ADMIN' || u.role === 'BANK_SUPPORT') || [];
      if (staff.length === 0) return ' === BANKING STAFF ===\\n  No specialized banking staff found.';
      let out = ' === BANKING STAFF ===\\n';
      staff.forEach((u: any) => {
        out += \`  [\${u.user_id}] @\${u.username} - Role: \${u.role} - Status: \${u.status}\\n\`;
      });
      return out;
    }
    case 'users-sanctions': {
      if (!arg1) return ' ERROR: User ID required.';
      const user = findUserInDb(arg1);
      if (!user) return \` ERROR: User "\${arg1}" not found.\`;
      const sanctions = db.audit_logs?.filter((l: any) => l.user_id === user.user_id && ['ban', 'mute', 'jail'].includes(l.action)) || [];
      if (sanctions.length === 0) return \` === SANCTIONS FOR @\${user.username} ===\\n  No active sanctions.\`;
      let out = \` === SANCTIONS FOR @\${user.username} ===\\n\`;
      sanctions.forEach((s: any) => {
        out += \`  [\${s.timestamp}] \${s.action.toUpperCase()} - Reason: \${s.details}\\n\`;
      });
      return out;
    }
    case 'fraud-risklog': {
      const logs = db.audit_logs?.filter((l: any) => l.action.includes('fraud') || l.action.includes('risk')) || [];
      if (logs.length === 0) return ' === FRAUD & RISK LOGS ===\\n  No recent fraud alerts.';
      let out = ' === FRAUD & RISK LOGS ===\\n';
      logs.slice(-10).forEach((l: any) => {
        out += \`  [\${l.timestamp}] \${l.action.toUpperCase()} - User: \${l.user_id} - \${l.details}\\n\`;
      });
      return out;
    }
`;

code = code.replace(/    default: \{/, newCases + "\\n    default: {");

fs.writeFileSync(path, code);
