const fs = require('fs');

let c = fs.readFileSync('server/controllers/marketplace.ts', 'utf8');
c = c.replace(/const platformFee = esc\.platform_fee !== undefined \? Number\(esc\.platform_fee\) : parseFloat\(\(amt \* 0\.05\)\.toFixed\(2\)\);/g, "const feePercent = (db.system_settings?.platform_fee_percent || 5) / 100;\n  const platformFee = esc.platform_fee !== undefined ? Number(esc.platform_fee) : parseFloat((amt * feePercent).toFixed(2));");
fs.writeFileSync('server/controllers/marketplace.ts', c);

let s = fs.readFileSync('server/services/marketplaceService.ts', 'utf8');
s = s.replace(/const settlement = calculateOrderSettlement\(itemPriceCents, 0, 0\.05, couponObj\);/, "const feePercent = (db.system_settings?.platform_fee_percent || 5) / 100;\n    const settlement = calculateOrderSettlement(itemPriceCents, 0, feePercent, couponObj);");
fs.writeFileSync('server/services/marketplaceService.ts', s);
