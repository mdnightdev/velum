const fs = require('fs');
let code = fs.readFileSync('cli.js', 'utf8');

const validCommandsToAdd = [
  "  'clean-lounge', 'clean_lounge', 'clean-lobby', 'clean_lobby', 'clean',",
  "  'delete-ticket', 'delete_ticket',",
  "  'override-user', 'override_user',",
  "  'integrity',",
  "  'seed',"
].join('\n');

code = code.replace(
  /'prune-db', 'prune_db', 'prune',/,
  validCommandsToAdd + "\n  'prune-db', 'prune_db', 'prune',"
);

const shortMappingsToAdd = [
  "  'clean': 'clean-lounge',",
  "  'ticket': 'delete-ticket',",
  "  'override': 'override-user',"
].join('\n');

code = code.replace(
  /'prune': 'prune-db',/,
  shortMappingsToAdd + "\n  'prune': 'prune-db',"
);

const requiresTargetToAdd = [
  "  'delete-ticket', 'delete_ticket',",
  "  'override-user', 'override_user',"
].join('\n');

code = code.replace(
  /'reset-avatar', 'reset_avatar',/,
  "'reset-avatar', 'reset_avatar',\n" + requiresTargetToAdd
);

// We need an arg2 for override-user. It is targetUser and arg2.
// In cli.js we only have targetUser = args[1]. Let's add arg2 = args[2].
// Actually, `args[2]` can be accessed directly.

const handlers = `
    } else if (command === 'clean-lounge' || command === 'clean_lounge' || command === 'clean-lobby' || command === 'clean_lobby' || command === 'clean') {
      if (db.messages) {
        db.messages = db.messages.filter(m => m.room_id !== 'velum_lounge' && m.room_id !== 'secops');
        saveDb();
        console.log('✅ SUCCESS: Global lounge channels cleared of messages.');
      } else {
        console.log('✅ SUCCESS: Global lounge channels cleared of messages.');
      }
    } else if (command === 'delete-ticket' || command === 'delete_ticket') {
      if (!targetUser) {
        console.error('❌ ERROR: Command "delete-ticket" requires a <ticket_id> argument.');
      } else {
        const ticketId = targetUser;
        const ticketIndex = (db.support_tickets || []).findIndex(t => t.ticket_id === ticketId);
        if (ticketIndex === -1) {
          console.error(\`❌ ERROR: Support ticket '#\${ticketId}' not found.\`);
        } else {
          db.support_tickets.splice(ticketIndex, 1);
          if (db.messages) db.messages = db.messages.filter(m => m.room_id !== \`ticket_\${ticketId}\`);
          saveDb();
          console.log(\`✅ SUCCESS: Support ticket '#\${ticketId}' permanently deleted.\`);
        }
      }
    } else if (command === 'override-user' || command === 'override_user') {
      const newPass = args[2];
      if (!targetUser || !newPass) {
        console.error('❌ ERROR: Command "override-user" requires <username> and <new_password> arguments.');
      } else {
        const candidate = db.users.find(u => u.username.toLowerCase() === targetUser.toLowerCase() || u.username.toLowerCase() === \`@\${targetUser.replace(/^@/, '').toLowerCase()}\`);
        if (!candidate) {
          console.error(\`❌ ERROR: Account "\${targetUser}" is not registered.\`);
        } else {
          // Note: hash-wasm requires async, but we can't do async easily inside cli.js if it's synchronous read.
          // Wait, cli.js uses hashArgon2id? No, cli.js doesn't have it imported!
          console.error('❌ ERROR: override-user is currently unsupported in the local CLI due to async hashing requirements. Use the Web Terminal instead.');
        }
      }
    } else if (command === 'integrity') {
      let issues = 0;
      let logs = '--- DATABASE INTEGRITY CHECK ---\\n';
      const uIds = new Set(db.users ? db.users.map(u => u.user_id) : []);
      if (db.profiles) {
        for (const p of db.profiles) {
          if (!uIds.has(p.user_id)) { issues++; logs += \`[WARN] Orphaned profile found: user_id \${p.user_id}\\n\`; }
        }
      }
      if (db.lounge_members) {
        for (const m of db.lounge_members) {
          if (!uIds.has(m.user_id)) { issues++; logs += \`[WARN] Orphaned lounge member: user_id \${m.user_id}\\n\`; }
        }
      }
      if (db.messages) {
        for (const m of db.messages) {
          if (m.sender_id && !uIds.has(m.sender_id)) { issues++; logs += \`[WARN] Orphaned message: message_id \${m.message_id} from unknown user_id \${m.sender_id}\\n\`; }
        }
      }
      if (issues === 0) {
        logs += '✅ SUCCESS: No database integrity issues found.';
      } else {
        logs += \`⚠️ WARNING: Found \${issues} integrity issues. Please prune or manually clean.\`;
      }
      console.log(logs);
    } else if (command === 'seed') {
      console.log('✅ SUCCESS: Seed command stub. (Pending tasks: Seeding accounts safely)');
`;

code = code.replace(
  /} else if \(command === 'risk-report' \|\| command === 'risk_report'\) {/,
  handlers.trim() + "\n    } else if (command === 'risk-report' || command === 'risk_report') {"
);

fs.writeFileSync('cli.js', code);
