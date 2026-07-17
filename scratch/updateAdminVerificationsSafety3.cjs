const fs = require('fs');
let code = fs.readFileSync('src/components/AdminVerificationView.tsx', 'utf8');

code = code.replace(/e\.message, e\.stack/g, "(e as Error).message, (e as Error).stack");

fs.writeFileSync('src/components/AdminVerificationView.tsx', code);
