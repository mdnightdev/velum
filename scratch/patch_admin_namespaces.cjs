const fs = require('fs');
const path = 'server/services/admin.ts';
let code = fs.readFileSync(path, 'utf8');

const newNamespaces = `const namespacesList = [
    '/users', '/lounges', '/support', '/db', '/sys', '/audit', '/fraud', '/bank', 
    '/identities', '/comms', '/dispatch', '/datastore', '/daemon', '/forensics', '/threat_intel', '/treasury', '/enforcement'
  ];`;
code = code.replace(/const namespacesList = \['\/users', '\/lounges', '\/support', '\/db', '\/sys', '\/audit', '\/fraud', '\/bank'\];/, newNamespaces);

const newMappings = `
    else if (action === '/identities/list') action = 'users-list';
    else if (action === '/identities/cat') action = 'users-cat';
    else if (action === '/identities/pending-deletions') action = 'users-pending-deletions';
    else if (action === '/enforcement/ban') action = 'ban';
    else if (action === '/enforcement/unban') action = 'unban';
    else if (action === '/enforcement/mute') action = 'mute';
    else if (action === '/enforcement/unmute') action = 'unmute';
    else if (action === '/enforcement/jail') action = 'jail';
    else if (action === '/enforcement/unjail') action = 'unjail';
    else if (action === '/enforcement/blacklist') action = 'blacklist';
    else if (action === '/enforcement/unblacklist') action = 'unblacklist';
    else if (action === '/enforcement/sanctions') action = 'users-sanctions';
    else if (action === '/comms/list') action = 'lounges-list';
    else if (action === '/comms/cat') action = 'lounges-cat';
    else if (action === '/comms/chown') action = 'lounges-chown';
    else if (action === '/comms/clean') action = 'lounges-clean';
    else if (action === '/comms/restore-messages') action = 'lounges-restore-messages';
    else if (action === '/comms/delete') action = 'lounges-delete';
    else if (action === '/comms/lock') action = 'lounges-lock';
    else if (action === '/comms/unlock') action = 'lounges-unlock';
    else if (action === '/comms/kick') action = 'lounges-kick';
    else if (action === '/comms/bcast') action = 'lounges-bcast';
    else if (action === '/dispatch/pending') action = 'pending';
    else if (action === '/dispatch/token') action = 'token';
    else if (action === '/dispatch/approve') action = 'approve';
    else if (action === '/dispatch/reject') action = 'reject';
    else if (action === '/dispatch/demote') action = 'demote';
    else if (action === '/dispatch/delete') action = 'support-delete';
    else if (action === '/datastore/integrity') action = 'db-integrity';
    else if (action === '/datastore/orphans-scan') action = 'db-orphans-scan';
    else if (action === '/datastore/orphans-clean') action = 'db-orphans-clean';
    else if (action === '/datastore/backup') action = 'db-backup';
    else if (action === '/datastore/export') action = 'db-export';
    else if (action === '/datastore/vacuum') action = 'vacuum';
    else if (action === '/datastore/restore') action = 'restore';
    else if (action === '/datastore/seed') action = 'seed';
    else if (action === '/datastore/prune') action = 'prune';
    else if (action === '/datastore/wipe') action = 'wipe';
    else if (action === '/datastore/fsync') action = 'db-fsync';
    else if (action === '/daemon/status') action = 'sys-status';
    else if (action === '/daemon/top') action = 'sys-top';
    else if (action === '/daemon/risk') action = 'sys-risk';
    else if (action === '/daemon/token') action = 'sys-token';
    else if (action === '/daemon/kill') action = 'sys-kill';
    else if (action === '/daemon/clear-sessions') action = 'sys-clear-sessions';
    else if (action === '/daemon/maint-on') action = 'sys-maintenance-enable';
    else if (action === '/daemon/maint-off') action = 'sys-maintenance-disable';
    else if (action === '/daemon/activest') action = 'sys-activest';
    else if (action === '/daemon/ccache') action = 'sys-ccache';
    else if (action === '/forensics/user') action = 'audit-user';
    else if (action === '/forensics/grep') action = 'audit-grep';
    else if (action === '/forensics/history') action = 'audit-history';
    else if (action === '/forensics/ledger') action = 'audit-ledger-verify';
    else if (action === '/forensics/hijacks') action = 'audit-hijacks';
    else if (action === '/forensics/ip') action = 'audit-ip';
    else if (action === '/forensics/nodes') action = 'audit-nodes';
    else if (action === '/forensics/reconstruct') action = 'audit-reconstruct';
    else if (action === '/forensics/escrows') action = 'audit-escrows';
    else if (action === '/forensics/repair') action = 'audit-repair';
    else if (action === '/threat_intel/seize') action = 'seize';
    else if (action === '/threat_intel/freeze') action = 'freeze';
    else if (action === '/threat_intel/unfreeze') action = 'unfreeze';
    else if (action === '/threat_intel/risklog') action = 'fraud-risklog';
    else if (action === '/treasury/fundc') action = 'fundc';
    else if (action === '/treasury/fundt') action = 'fundt';
    else if (action === '/treasury/funde') action = 'funde';
    else if (action === '/treasury/bankau') action = 'bankau';
    else if (action === '/treasury/banks') action = 'banks';
    else if (action === '/treasury/bankf') action = 'bankf';
    else if (action === '/treasury/bankad') action = 'bankad';
    else if (action === '/treasury/txlog') action = 'bank-txlog';
    else if (action === '/treasury/staff') action = 'bank-staff';
`;

// Insert the mappings right before default:
code = code.replace(/    default: \{/, newMappings + "\n    default: {");

fs.writeFileSync(path, code);
