const fs = require('fs');
const path = 'server/controllers/admin.ts';
let code = fs.readFileSync(path, 'utf8');

const newWhitelist = `const ALLOWED_WEB_CLI_PATHS = [
  '/users/list', '/identities/list',
  '/users/cat', '/identities/cat',
  '/users/pending-deletions', '/identities/pending-deletions',
  '/lounges/list', '/comms/list',
  '/lounges/cat', '/comms/cat',
  '/lounges/kick', '/comms/kick',
  '/lounges/bcast', '/comms/bcast',
  '/support/pending', '/dispatch/pending',
  '/support/token', '/dispatch/token',
  '/db/integrity', '/datastore/integrity',
  '/db/orphans-scan', '/datastore/orphans-scan',
  '/db/export', '/datastore/export',
  '/db/fsync', '/datastore/fsync',
  '/sys/status', '/daemon/status',
  '/sys/top', '/daemon/top',
  '/sys/risk', '/daemon/risk',
  '/sys/activest', '/daemon/activest',
  '/sys/ccache', '/daemon/ccache',
  '/audit/user', '/forensics/user',
  '/audit/grep', '/forensics/grep',
  '/audit/history', '/forensics/history',
  '/audit/ledger-verify', '/forensics/ledger',
  '/audit/hijacks', '/forensics/hijacks',
  '/audit/ip', '/forensics/ip',
  '/audit/nodes', '/forensics/nodes',
  '/bank/txlog', '/treasury/txlog',
  '/bank/staff', '/treasury/staff',
  '/users/sanctions', '/enforcement/sanctions',
  '/fraud/risklog', '/threat_intel/risklog'
];`;

code = code.replace(/const ALLOWED_WEB_CLI_PATHS = \[[^]*?\];/, newWhitelist);

const newNamespaces = `const namespacesList = [
    '/users', '/lounges', '/support', '/db', '/sys', '/audit', '/bank', 
    '/identities', '/comms', '/dispatch', '/datastore', '/daemon', '/forensics', '/threat_intel', '/treasury', '/enforcement'
  ];`;
code = code.replace(/const namespacesList = \['\/users', '\/lounges', '\/support', '\/db', '\/sys', '\/audit', '\/bank'\];/, newNamespaces);

fs.writeFileSync(path, code);
