const fs = require('fs');

// server/services/marketplaceService.ts
let s = fs.readFileSync('server/services/marketplaceService.ts', 'utf8');
s = s.replace(/const settlement = calculateOrderSettlement\(itemPriceCents, 0, feePercent, couponObj\);/, 
  "const taxPercent = (db.system_settings?.tax_rate_percent || 0) / 100;\n    const settlement = calculateOrderSettlement(itemPriceCents, taxPercent, feePercent, couponObj);");
s = s.replace(/let twdFee = Math\.round\(feeCents \/ 0\.031\);/g, 
  "const twdRate = db.system_settings?.twd_usd_rate || 0.031;\n            let twdFee = Math.round(feeCents / twdRate);");
s = s.replace(/let twdPayout = Math\.round\(payoutCents \/ 0\.031\);/g, 
  "const twdRate = db.system_settings?.twd_usd_rate || 0.031;\n              let twdPayout = Math.round(payoutCents / twdRate);");
fs.writeFileSync('server/services/marketplaceService.ts', s);

// server/controllers/marketplace.ts
let m = fs.readFileSync('server/controllers/marketplace.ts', 'utf8');
m = m.replace(/const settlement = calculateOrderSettlement\(\n\s*itemPriceCents,\n\s*0,\n\s*feePercent,\n\s*couponObj\n\s*\);/, 
  "const taxPercent = (db.system_settings?.tax_rate_percent || 0) / 100;\n    const settlement = calculateOrderSettlement(\n      itemPriceCents,\n      taxPercent,\n      feePercent,\n      couponObj\n    );");
fs.writeFileSync('server/controllers/marketplace.ts', m);

// server/controllers/payments.ts
let p = fs.readFileSync('server/controllers/payments.ts', 'utf8');
p = p.replace(/const twdAmountCents = Math\.round\(amount \/ 0\.031\);/g, 
  "const twdRate = db.system_settings?.twd_usd_rate || 0.031;\n      const twdAmountCents = Math.round(amount / twdRate);");
p = p.replace(/let twdAmountCents = Math\.round\(request\.amount_cents \/ 0\.031\);/g, 
  "const twdRate = db.system_settings?.twd_usd_rate || 0.031;\n        let twdAmountCents = Math.round(request.amount_cents / twdRate);");
p = p.replace(/twdAmountCents = Math\.round\(usdAmountCents \/ 0\.031\);/g, 
  "twdAmountCents = Math.round(usdAmountCents / twdRate);");
fs.writeFileSync('server/controllers/payments.ts', p);

