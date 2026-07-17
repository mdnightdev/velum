const fs = require('fs');
let code = fs.readFileSync('src/components/AdminVerificationView.tsx', 'utf8');

code = code.replace(/listing\.listing_id\.substring\(0, 8\)/g, "(listing.listing_id || '').substring(0, 8)");
code = code.replace(/\(listing\.price \/ 100\)\.toFixed\(2\)/g, "((listing.price || 0) / 100).toFixed(2)");

fs.writeFileSync('src/components/AdminVerificationView.tsx', code);
