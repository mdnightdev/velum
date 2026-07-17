const fs = require('fs');
let code = fs.readFileSync('server/services/admin.ts', 'utf8');

code = code.replace(/else if \(action === '\/sys\/activest'\) action = 'sys-activest';/, "else if (action === '/sys/activest') action = 'sys-activest';\n    else if (action === '/sys/config') action = 'sys-config';\n    else if (action === '/sys/config-set') action = 'sys-config-set';");
fs.writeFileSync('server/services/admin.ts', code);

let ctrl = fs.readFileSync('server/controllers/admin.ts', 'utf8');
ctrl = ctrl.replace(/'\/sys\/activest', '\/daemon\/activest',/, "'/sys/activest', '/daemon/activest',\n  '/sys/config', '/daemon/config',\n  '/sys/config-set', '/daemon/config-set',");
fs.writeFileSync('server/controllers/admin.ts', ctrl);
