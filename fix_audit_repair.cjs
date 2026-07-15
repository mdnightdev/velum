const fs = require('fs');

let content = fs.readFileSync('server/db.ts', 'utf8');

const toReplace = `      // 1. Permanently purge the rogue entry and any previous manual repair deltas
      (db as any).wallet_ledger_entries = (db as any).wallet_ledger_entries.filter(
        (e: any) => e.entry_id !== 'led_rogue123' && !(e.user_id === targetUid && e.entry_type === 'SYSTEM_REPAIR')
      );
    
      // 2. Automatically calculate what the correct sum should be from pristine records
      const cleanEntries = (db as any).wallet_ledger_entries.filter(
        (e: any) => e.user_id === targetUid && e.entry_type !== 'RECHARGE' && e.currency_code !== 'USD'
      );
      
      let calculatedSumCents = 0;
      for (const e of cleanEntries) {
        calculatedSumCents += Number(e.amount_cents || 0);
      }
    
      // 3. Sync the profile's cached balance to match the ledger sum perfectly
      wallet.balance_cents = calculatedSumCents;
    
      // 4. Re-bake the rolling hash chain for the clean ledger entries
      let precedingHash = 'GENESIS_HASH';
      const sorted = [...(db as any).wallet_ledger_entries]
        .filter((e: any) => e.user_id === targetUid && e.entry_type !== 'RECHARGE' && e.currency_code !== 'USD')
        .sort((a, b) => Number(a.created_at || 0) - Number(b.created_at || 0));
    
      for (const entry of sorted) {
        const calculatedHash = crypto.createHash('sha256')
          .update(\`\${entry.entry_id}:\${entry.user_id}:\${entry.amount_cents}:\${entry.entry_type}:\${precedingHash}\`)
          .digest('hex');
        entry.rolling_hash = calculatedHash;
        precedingHash = calculatedHash;
      }`;

const replaceWith = `      // Find the rogue entry to reverse it (Append-only approach)
      const rogueEntry = (db as any).wallet_ledger_entries.find((e: any) => e.entry_id === 'led_rogue123' && e.user_id === targetUid);
      if (rogueEntry) {
         // Issue a correcting entry instead of deleting
         const correctingEntry = {
            entry_id: \`led_repair_\${Date.now()}\`,
            user_id: targetUid,
            amount_cents: -Number(rogueEntry.amount_cents || 0),
            balance_after_cents: wallet.balance_cents - Number(rogueEntry.amount_cents || 0),
            entry_type: 'SYSTEM_REPAIR',
            actor_type: 'SYSTEM',
            created_at: Date.now()
         };
         (db as any).wallet_ledger_entries.push(correctingEntry);
         wallet.balance_cents = correctingEntry.balance_after_cents;
      }
      
      const calculatedSumCents = wallet.balance_cents;
`;

if (content.includes("Permanently purge the rogue entry")) {
  content = content.replace(toReplace, replaceWith);
  fs.writeFileSync('server/db.ts', content);
  console.log("db.ts repair command patched!");
} else {
  console.log("Could not find the block to replace.");
}

