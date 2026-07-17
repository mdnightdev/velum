const fs = require('fs');
const path = 'src/components/CliConsole.tsx';
let code = fs.readFileSync(path, 'utf8');

const newDirsStr = `  const ALLOWED_DIRECTORIES: Record<string, Record<string, { desc: string; args: string[]; flags: string[] }>> = {
    identities: {
      list: { desc: 'List registered operatives', args: [], flags: ['--status <status>'] },
      cat: { desc: 'View profile dossier of an identity', args: ['<uid/username>'], flags: [] },
      'pending-deletions': { desc: 'List accounts scheduled for purge', args: [], flags: [] }
    },
    comms: {
      list: { desc: 'List active comms channels', args: [], flags: [] },
      cat: { desc: 'View detailed metadata of a channel', args: ['<lounge_id>'], flags: [] },
      kick: { desc: 'Force sever connection from comms', args: ['<uid>'], flags: [] },
      bcast: { desc: 'Broadcast system alert to a channel', args: ['<lounge_id>', '<msg>'], flags: [] }
    },
    enforcement: {
      ban: { desc: 'Ban an operative', args: ['<uid>'], flags: [] },
      mute: { desc: 'Mute an operative globally', args: ['<uid>'], flags: [] },
      jail: { desc: 'Restrict an operative to read-only', args: ['<uid>'], flags: [] },
      sanctions: { desc: 'List all active sanctions for an identity', args: ['<uid/username>'], flags: [] }
    },
    dispatch: {
      pending: { desc: 'List open support or promotion dispatch tickets', args: [], flags: [] },
      token: { desc: 'Generate a support recovery secure token', args: ['<ticket_id>'], flags: [] }
    },
    datastore: {
      integrity: { desc: 'Validate datastore structures & indices', args: [], flags: [] },
      'orphans-scan': { desc: 'Scan relational tables for orphaned nodes', args: [], flags: [] },
      export: { desc: 'Export raw table records with masked PII', args: ['<table>'], flags: [] },
      fsync: { desc: 'Force write sync memory to durable storage', args: [], flags: [] }
    },
    daemon: {
      status: { desc: 'Check core daemon and network health', args: [], flags: [] },
      top: { desc: 'Display active load and resource metrics', args: [], flags: [] },
      risk: { desc: 'Scan active logs for security threats', args: [], flags: [] },
      activest: { desc: 'View active web socket connections and online users', args: [], flags: [] },
      ccache: { desc: 'Clear system volatile memory cache', args: [], flags: [] }
    },
    forensics: {
      user: { desc: 'Trace administrative audit logs for operative', args: ['<uid/username>'], flags: [] },
      grep: { desc: 'Search global active log stream', args: ['<pattern>'], flags: [] },
      history: { desc: 'Trace account state mutations for operative', args: ['<uid/username>'], flags: [] },
      'ledger-verify': { desc: 'Verify transaction ledger cryptographic hashes', args: [], flags: [] },
      hijacks: { desc: 'Evaluate active sessions for hijacked footprints', args: [], flags: [] },
      ip: { desc: 'Cross-correlate accounts sharing identical subnets/profiles', args: [], flags: [] },
      nodes: { desc: 'Scan fractal categories for RBAC inheritance leaks', args: [], flags: [] }
    },
    threat_intel: {
      risklog: { desc: 'View recent fraud and risk analysis logs', args: [], flags: [] }
    },
    treasury: {
      txlog: { desc: 'Tail recent treasury transactions', args: [], flags: [] },
      staff: { desc: 'List all authorized financial staff personnel', args: [], flags: [] }
    }
  };`;

code = code.replace(/  const ALLOWED_DIRECTORIES: Record[\s\S]*?    \}\n  \};/, newDirsStr);

// Redesign ls command output
const lsLogic = `    // 4. handle 'ls'
    if (verb === 'ls') {
      if (currentDir === '/') {
        let out = \`AVAILABLE NAMESPACES\\n--------------------\\n\`;
        Object.entries(ALLOWED_DIRECTORIES).forEach(([dir, cmds]) => {
          out += \`  \${(dir + '/').padEnd(16)} \${Object.keys(cmds).length} directives\\n\`;
        });
        setTerminalLogs(prev => [...prev, { text: out.trimEnd(), type: 'resp' }]);
      } else {
        const dirName = currentDir.replace('/', '');
        let out = \`DIRECTIVES IN /\${dirName}\\n--------------------\\n\`;
        Object.entries(ALLOWED_DIRECTORIES[dirName] || {}).forEach(([cmd, meta]) => {
           out += \`  \${cmd.padEnd(16)} \${meta.desc}\\n\`;
        });
        setTerminalLogs(prev => [...prev, { text: out.trimEnd(), type: 'resp' }]);
      }
      return;
    }`;
code = code.replace(/    \/\/ 4\. handle 'ls'[\s\S]*?return;\n    \}/, lsLogic);

// Replace aliases
const aliasesCode = `        const aliases: Record<string, { dir: string; cmd: string }> = {
          status: { dir: 'daemon', cmd: 'status' },
          info: { dir: 'daemon', cmd: 'status' },
          diagnostics: { dir: 'daemon', cmd: 'status' },
          pending: { dir: 'dispatch', cmd: 'pending' },
          comms: { dir: 'comms', cmd: 'list' },
          risk: { dir: 'daemon', cmd: 'risk' }
        };`;
code = code.replace(/        const aliases: Record<string, \{ dir: string; cmd: string \}> = \{[\s\S]*?        \};/, aliasesCode);

// Update help msg
const helpMsg = `    // 5. handle help or help flags
    if (verb === 'help' || verb === '?') {
      const helpMsg = \`VELUM INTERACTIVE WEB CLI

You can navigate the CLI like a Linux terminal:
  ls            List directories (at root) or commands (inside a directory)
  cd <dir>      Change directory (e.g., cd identities, cd daemon, cd ..)
  pwd           Show current working directory
  clear         Clear the terminal screen

Available namespaces:
  identities/   Operative personnel moderation commands
  comms/        Nexus communications channels monitoring
  enforcement/  Sanctions and punitive actions
  dispatch/     Support and promotion operational dispatch
  datastore/    Core node database systems
  daemon/       System diagnostics and resource metrics
  forensics/    Subnet correlation, log search, and ledger tracing
  threat_intel/ Risk scanning and fraud detection
  treasury/     Financial oversight and bank auditing

To run a command:
  1) Run directly: e.g., /identities list
  2) Navigate first: e.g., cd identities, then type: list

For help on a directory or command, use: <name> -h\`;
      setTerminalLogs(prev => [...prev, { text: helpMsg, type: 'resp' }]);
      return;
    }`;
code = code.replace(/    \/\/ 5\. handle help or help flags[\s\S]*?return;\n    \}/, helpMsg);

fs.writeFileSync(path, code);
