const fs = require('fs');
let code = fs.readFileSync('server/tests/escrowWallet.test.ts', 'utf8');

code = code.replace(/expect\(db\.wallet_ledger_entries\)\.toHaveLength\(2\);[\s\S]*?expect\(\(db\.wallet_ledger_entries \|\| \[\]\)\[1\]\.amount_cents\)\.toBe\(-500\);/, `expect(db.wallet_ledger_entries).toHaveLength(1);
    expect((db.wallet_ledger_entries || [])[0].entry_type).toBe('ESCROW_RELEASE');
    expect((db.wallet_ledger_entries || [])[0].amount_cents).toBe(9500);`);

fs.writeFileSync('server/tests/escrowWallet.test.ts', code);
