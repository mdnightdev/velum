const fs = require('fs');
let code = fs.readFileSync('cli.js', 'utf8');

const handlers = `
    } else if (command === 'delete-lounge' || command === 'delete_lounge') {
      const loungeIndex = (db.lounges || []).findIndex(l => l.lounge_id === targetUser || l.id === targetUser);
      if (loungeIndex === -1) {
        console.error(\`❌ ERROR: Lounge with ID '\${targetUser}' not found.\`);
      } else {
        db.lounges.splice(loungeIndex, 1);
        if (db.lounge_members) {
            db.lounge_members = db.lounge_members.filter(m => m.lounge_id !== targetUser);
        }
        saveDb();
        console.log(\`✅ SUCCESS: Lounge '\${targetUser}' has been permanently deleted.\`);
      }
    } else if (command === 'delete-user' || command === 'delete_user') {
      const candidate = db.users.find(u => u.username.toLowerCase() === targetUser.toLowerCase() || u.username.toLowerCase() === \`@\${targetUser.replace(/^@/, '').toLowerCase()}\`);
      if (!candidate) {
        console.error(\`❌ ERROR: Account "\${targetUser}" is not registered.\`);
      } else if (candidate.role === 'CLI_ADMIN' || candidate.role === 'LOGIN_ADMIN') {
        console.error(\`❌ ERROR: Severe privilege violation - cannot delete system-level initial accounts.\`);
      } else {
        const uId = candidate.user_id;
        db.users = db.users.filter(u => u.user_id !== uId);
        if (db.profiles) db.profiles = db.profiles.filter(p => p.user_id !== uId);
        if (db.lounge_members) db.lounge_members = db.lounge_members.filter(m => m.user_id !== uId);
        if (db.messages) db.messages = db.messages.filter(m => m.sender_id !== uId);
        if (db.support_tickets) db.support_tickets = db.support_tickets.filter(t => t.creator_id !== uId);
        if (db.sessions) db.sessions = db.sessions.filter(s => s.user_id !== uId);
        if (db.connections) db.connections = db.connections.filter(c => c.user_id !== uId);
        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: \`al_\${Date.now()}_del_usr\`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'user_purged_hard',
          target_type: 'user',
          target_id: String(uId),
          reason: \`User @\${candidate.username} permanently deleted from state by CLI Admin.\`,
          timestamp: new Date().toISOString()
        });
        saveDb();
        console.log(\`✅ SUCCESS: User @\${candidate.username} successfully deleted and hard-purged.\`);
      }
    } else if (command === 'restore-user' || command === 'restore_user') {
      const candidate = db.users.find(u => u.username.toLowerCase() === targetUser.toLowerCase() || u.username.toLowerCase() === \`@\${targetUser.replace(/^@/, '').toLowerCase()}\`);
      if (!candidate) {
        console.error(\`❌ ERROR: Account "\${targetUser}" is not registered. (Hard-purged users cannot be restored unless soft-purged)\`);
      } else if (candidate.status !== 'purged') {
        console.error(\`❌ ERROR: User @\${candidate.username} is not purged.\`);
      } else {
        candidate.status = 'active';
        candidate.updated_at = new Date().toISOString();
        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: \`al_\${Date.now()}_rst_usr\`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'user_restored',
          target_type: 'user',
          target_id: String(candidate.user_id),
          reason: \`Purged account @\${candidate.username} restored back to active state by CLI_ADMIN.\`,
          timestamp: new Date().toISOString()
        });
        saveDb();
        console.log(\`✅ SUCCESS: User @\${candidate.username} successfully restored to active status.\`);
      }
    } else if (command === 'reset-avatar' || command === 'reset_avatar') {
      const candidate = db.users.find(u => u.username.toLowerCase() === targetUser.toLowerCase() || u.username.toLowerCase() === \`@\${targetUser.replace(/^@/, '').toLowerCase()}\`);
      if (!candidate) {
        console.error(\`❌ ERROR: Account "\${targetUser}" is not registered.\`);
      } else {
        const uId = candidate.user_id;
        const profile = db.profiles && db.profiles.find(p => p.user_id === uId);
        if (profile) {
          profile.avatar_url = null;
          profile.updated_at = new Date().toISOString();
          saveDb();
          console.log(\`✅ SUCCESS: Avatar for user @\${candidate.username} has been reset.\`);
        } else {
          console.error(\`❌ ERROR: Profile for user @\${candidate.username} not found.\`);
        }
      }
`;

code = code.replace(
  /} else if \(command === 'risk-report' \|\| command === 'risk_report'\) {/,
  handlers.trim() + "\n    } else if (command === 'risk-report' || command === 'risk_report') {"
);

fs.writeFileSync('cli.js', code);
