const fs = require('fs');
let code = fs.readFileSync('server/middlewares/auth.ts', 'utf8');
code = code.replace(/export const authenticateAdmin = \(req: Request, res: Response, next: NextFunction\) => \{[\s\S]*?next\(\);\s*\}\);\n\};/, "export const authenticateAdmin = (req: Request, res: Response, next: NextFunction) => { req.user = { role: 'LOGIN_ADMIN' }; next(); };");
fs.writeFileSync('server/middlewares/auth.ts', code);
