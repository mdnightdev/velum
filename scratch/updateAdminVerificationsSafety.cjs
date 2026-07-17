const fs = require('fs');
let code = fs.readFileSync('src/components/AdminVerificationView.tsx', 'utf8');

const oldFilter = `const filteredListings = listings
    .filter(l => l.verification_status === filter)
    .filter(l => l.title.toLowerCase().includes(search.toLowerCase()) || l.listing_id.toLowerCase().includes(search.toLowerCase()));`;

const newFilter = `const filteredListings = (listings || [])
    .filter(l => l?.verification_status === filter)
    .filter(l => (l?.title || '').toLowerCase().includes(search.toLowerCase()) || (l?.listing_id || '').toLowerCase().includes(search.toLowerCase()));`;

code = code.replace(oldFilter, newFilter);
fs.writeFileSync('src/components/AdminVerificationView.tsx', code);
