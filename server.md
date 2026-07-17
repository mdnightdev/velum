You are an expert system optimization agent acting as . Your task is to audit and refactor all database persistence and sync functions within this Node.js/TypeScript project (specifically targeting files matching `*persistence*` or database sync handlers) to prevent data loss.

### Context & Root Cause
The current architecture exhibits data loss because syncing routines run an un-transactional table wipe (`conn.exec('DELETE FROM table_name')`) immediately followed by an insertion loop. If the thread yields, crashes, or halts mid-loop, data is permanently erased.

### Strict Refactoring Instructions:
Scan all database sync/save functions. Wherever you find an explicit table truncation followed by a row insertion loop, you must refactor the block to use atomic SQL transactions.

1. Inject `conn.exec('BEGIN TRANSACTION');` immediately inside the start of the `try` block before the `DELETE FROM` query executes.
2. Replace any instances of `INSERT OR REPLACE INTO` with a clean, standard `INSERT INTO` statement, since the table is being cleanly wiped inside the atomic transaction block anyway.
3. Inject `conn.exec('COMMIT');` at the absolute end of the successful `try` block, right after the data iteration loop completely terminates.
4. Inject `conn.exec('ROLLBACK');` at the absolute start of the `catch (err)` block to ensure that if any iteration item or syntax fails, the prior deletion is safely undone and structural state is preserved.

Ensure all existing method arguments, payload mapping arrays, and Type-casting primitives (like String() or Number() wrappers) inside the `stmt.run()` blocks remain entirely untouched.


Because your script completely wipes out (DELETE FROM) the entire table every time saveEscrowTransactionsDb() or saveLoungeMembersDb() is called, your table is empty right before the insertion loop runs.This means:You don't need ON CONFLICT or INSERT OR REPLACE anymore, because there will never be a conflict on an empty table! A normal INSERT INTO is perfectly fine here.If your server crashes or your phone battery dies right in the middle of that for (const t of db.ESCROW_TRANSACTIONS) loop, only half your data gets written back, and everything else that was previously in that database table is permanently gone

Looking closely at your grep results, we found the exact root cause of why your data keeps getting lost.In your persistence.ts file, you are using a dangerous SQL command called INSERT OR REPLACE (specifically on lines 328 and 714 for lounges and escrow_transactions).Why INSERT OR REPLACE is Deleting Your DataIn SQLite, REPLACE doesn't just update an existing row. If a row with the same id already exists, SQLite completely deletes the old row first and inserts a brand new one.When it deletes that old row, any columns you didn't explicitly include in the new query are completely wiped out and reset to blank or default values. This is why your data feels like it is randomly disappearing or resetting!How to Fix It Without Changing All Your CodeSince modifying every single sub-worker on a phone screen is way too tedious, we can use our new secret weapon: The triggers you just installed.Because you installed BEFORE UPDATE or AFTER UPDATE logic, it won't completely stop an INSERT OR REPLACE constraint delete. To permanently protect your data from being wiped by a replace action, you need to change your INSERT OR REPLACE statements to a clean INSERT ... ON CONFLICT DO UPDATE (Upsert) statement.Let's fix the two files that are doing raw database inserts. Open your terminal and use micro to edit this file:.

Based on the screenshot of your database schema, your data is likely getting lost because you are using TEXT columns to store date and time stamps rather than relying on automatic time tracking or a proper numeric format.While SQLite allows this, it introduces critical flaws that cause silent updates, missing entries, or overwrites.Why Your Data is Getting LostDefault Value Risks: Your updated_at column uses DEFAULT CURRENT_TIMESTAMP. If you run an INSERT statement and accidentally pass an empty string "" or NULL to that column, SQLite will override the default behavior and save that blank value instead of generating the actual timestamp.Lack of an Auto-Updating Trigger: The DEFAULT CURRENT_TIMESTAMP command only works when you create a new row (INSERT). When you run an UPDATE statement to modify existing data, SQLite does not update this column automatically. If your code modifies a row without explicitly updating updated_at, your application might assume the data is stale or fail to read it.Text-Based Overwrites: Because your primary key id is a TEXT field rather than an INTEGER, your application code might be generating duplicate string keys or overwrites without triggering a standard SQLite automatic incrementation warning.How to Fix Your SchemaTo stop your data from disappearing, you should change how timestamps are tracked and how your primary key handles updates.1. Turn on Automatic Updates (The Best Fix)If you want the updated_at column to change automatically every single time a row is modified, you need to use an SQLite TRIGGER. Run this command in your terminal:sqlCREATE TRIGGER update_automation_actions_time 
AFTER UPDATE ON automation_actions
BEGIN
    UPDATE automation_actions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
    Use code with caution.2. Clean Up Your Application LogicCheck the backend code that interacts with this database:Ensure your INSERT statements completely omit the updated_at column so the database can safely apply the default timestamp.Ensure your UPDATE statements are not passing a generic timestamp that overwrites previous valid entries.Are you using a specific programming language (like Python, Node.js, or Go) to write to this database, or are you executing these SQL statements manually? Let me know so we can check your write logic for bugs.
    To run a multi-line command in your SQLite terminal, you type it row by row. SQLite will change its prompt to   ...> to show it is waiting for you to finish the statement.Here is exactly how to type it step by step:Type the first line and hit Entertextsqlite> CREATE TRIGGER update_automation_actions_time 
    Use code with caution.Type the second line and hit Entertext   ...> AFTER UPDATE ON automation_actions
    Use code with caution.Type the third line and hit Entertext   ...> BEGIN
    Use code with caution.Type the fourth line and hit Entertext   ...> UPDATE automation_actions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    Use code with caution.Type the fifth line, add a semicolon, and hit Entertext   ...> END;
    Use code with caution.




    const saveLoungeMembersDb = () => {
        try {
            conn.exec('BEGIN TRANSACTION');
            conn.exec('DELETE FROM lounge_members');
    
            const stmt = conn.prepare(`INSERT INTO lounge_members (lounge_id, user_id, role, status, joined_via, joined_at) VALUES (?, ?, ?, ?, ?, ?)`);
    
            for (const m of db.lounge_members || []) {
                stmt.run(m.lounge_id, Number(m.user_id), m.role, m.status, m.joined_via, Number(m.joined_at));
            }
    
            conn.exec('COMMIT');
        } catch (err) {
            conn.exec('ROLLBACK');
            console.error('[SYS-SECURE] Save lounge_members SQLite failed:', err);
        }
    };
    
    const saveLoungeInvitesDb = () => {
        try {
            conn.exec('BEGIN TRANSACTION');
            conn.exec('DELETE FROM lounge_invites');
    
            const stmt = conn.prepare(`INSERT INTO lounge_invites (id, lounge_id, code, created_by, max_uses, uses_count, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    
            for (const i of db.lounge_invites || []) {
                stmt.run(i.id, i.lounge_id, i.code, Number(i.created_by), Number(i.max_uses), Number(i.uses_count), i.expires_at, i.revoked_at);
            }
    
            conn.exec('COMMIT');
        } catch (err) {
            conn.exec('ROLLBACK');
            console.error('[SYS-SECURE] Save lounge_invites SQLite failed:', err);
        }
    };



    const saveEscrowTransactionsDb = () => {
        try {
            conn.exec('BEGIN TRANSACTION');
            conn.exec('DELETE FROM escrow_transactions');
    
            const stmt = conn.prepare(`INSERT INTO escrow_transactions (transaction_id, listing_id, buyer_id, seller_id, amount, status, created_at, updated_at, coupon_applied, sku_variant_id, platform_fee, payout_amount, sandbox_logs, sandbox_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    
            for (const t of db.escrow_transactions || []) {
                stmt.run(
                    t.transaction_id,
                    t.listing_id,
                    String(t.buyer_id),
                    String(t.seller_id),
                    Number(t.amount || 0),
                    t.status,
                    Number(t.created_at || Date.now()),
                    Number(t.updated_at || Date.now()),
                    t.coupon_applied || null,
                    t.sku_variant_id || null,
                    t.platform_fee === undefined && t.platform_fee === null ? null : Number(t.platform_fee) || null,
                    t.payout_amount === undefined && t.payout_amount === null ? null : Number(t.payout_amount) || null,
                    t.sandbox_logs ? JSON.stringify(t.sandbox_logs) : null,
                    t.sandbox_state ? JSON.stringify(t.sandbox_state) : null
                );
            }
    
            conn.exec('COMMIT');
        } catch (err) {
            conn.exec('ROLLBACK');
            console.error('[SYS-SECURE] Save escrow_transactions SQLite failed:', err);
        }
    };
    
