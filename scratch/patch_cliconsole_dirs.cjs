const fs = require('fs');
const path = 'src/components/CliConsole.tsx';
let code = fs.readFileSync(path, 'utf8');

const newDirsStr = `  const ALLOWED_DIRECTORIES: Record<string, Record<string, { desc: string; args: string[]; flags: string[] }>> = {
    users: {
      list: { desc: 'List registered users', args: [], flags: ['--status <status>'] },
      cat: { desc: 'View profile details of a user', args: ['<uid/username>'], flags: [] },
      'pending-deletions': { desc: 'List all accounts scheduled for deactivation', args: [], flags: [] },
      sanctions: { desc: 'List all active sanctions for a user', args: ['<uid/username>'], flags: [] }
    },
    lounges: {
      list: { desc: 'List active lounges', args: [], flags: [] },
      cat: { desc: 'View detailed metadata of a lounge', args: ['<lounge_id>'], flags: [] },
      kick: { desc: 'Force disconnect user websocket from lounge', args: ['<uid>'], flags: [] },
      bcast: { desc: 'Broadcast system alert to a lounge', args: ['<lounge_id>', '<msg>'], flags: [] }
    },
    support: {
      pending: { desc: 'List open or pending Support Operator promotion nominations', args: [], flags: [] },
      token: { desc: 'Generate a support recovery secure token', args: ['<ticket_id>'], flags: [] }
    },
    db: {
      integrity: { desc: 'Validate SQLite database structures & indices', args: [], flags: [] },
      'orphans-scan': { desc: 'Scan relational database tables for orphaned nodes', args: [], flags: [] },
      export: { desc: 'Export raw table records with masked PII', args: ['<table>'], flags: [] },
      fsync: { desc: 'Force write sync memory db to SQLite', args: [], flags: [] }
    },
    sys: {
      status: { desc: 'Check system daemon and network health', args: [], flags: [] },
      top: { desc: 'Display active load and resource metrics', args: [], flags: [] },
      risk: { desc: 'Scan active logs for security threats', args: [], flags: [] },
      activest: { desc: 'View active web socket connections and online users', args: [], flags: [] },
      ccache: { desc: 'Clear system volatile memory cache', args: [], flags: [] }
    },
    audit: {
      user: { desc: 'Trace administrative audit logs for user', args: ['<uid/username>'], flags: [] },
      grep: { desc: 'Search global active log stream', args: ['<pattern>'], flags: [] },
      history: { desc: 'Trace account state mutations for user', args: ['<uid/username>'], flags: [] },
      'ledger-verify': { desc: 'Verify transaction ledger cryptographic hashes', args: [], flags: [] },
      hijacks: { desc: 'Evaluate active sessions for hijacked footprints (Power 1)', args: [], flags: [] },
      ip: { desc: 'Cross-correlate accounts sharing identical subnets/profiles (Power 3)', args: [], flags: [] },
      nodes: { desc: 'Scan fractal categories for RBAC inheritance leaks (Power 4)', args: [], flags: [] }
    },
    fraud: {
      risklog: { desc: 'View recent fraud and risk analysis logs', args: [], flags: [] }
    },
    bank: {
      txlog: { desc: 'Tail recent bank transactions', args: [], flags: [] },
      staff: { desc: 'List all authorized banking staff personnel', args: [], flags: [] }
    }
  };`;

code = code.replace(/  const ALLOWED_DIRECTORIES: Record[\s\S]*?    \}\n  \};/, newDirsStr);

fs.writeFileSync(path, code);
