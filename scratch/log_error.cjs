const fs = require('fs');
let code = fs.readFileSync('src/components/AdminVerificationView.tsx', 'utf8');
code = code.replace(/console\.error\('Failed to load verification queue'\);/g, "console.error('Failed to load verification queue', e.message, e.stack);");
fs.writeFileSync('src/components/AdminVerificationView.tsx', code);
