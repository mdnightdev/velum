const fs = require('fs');
let code = fs.readFileSync('server/index.ts', 'utf8');
code = code.replace(/app\.use\('\/api', apiRouter\);/, "app.use((req, res, next) => { console.log('REQ:', req.method, req.url); next(); });\napp.use('/api', apiRouter);");
fs.writeFileSync('server/index.ts', code);
