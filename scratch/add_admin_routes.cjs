const fs = require('fs');
let code = fs.readFileSync('server/routes/admin.ts', 'utf8');

code = code.replace(/updateSettings\n\} from '\.\.\/controllers\/admin\.js';/, "updateSettings,\n  updateSystemConfig,\n  getSystemConfig\n} from '../controllers/admin.js';");
code = code.replace(/adminRouter\.post\('\/settings', authenticateAdmin, updateSettings\);/, "adminRouter.post('/settings', authenticateAdmin, updateSettings);\nadminRouter.get('/system-config', authenticateAdmin, getSystemConfig);\nadminRouter.post('/system-config', authenticateAdmin, updateSystemConfig);");

fs.writeFileSync('server/routes/admin.ts', code);
