const fs = require('fs');
let code = fs.readFileSync('server/db.ts', 'utf8');

const handlers = `
    case 'restore-user':
    case 'restore_user': {
      try {
        if (!arg1) return '❌ ERROR: Command "restore-user" requires a <username> argument.';
        const candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase() || u.username.toLowerCase() === \`@\${arg1.replace(/^@/, '').toLowerCase()}\`);
        if (!candidate) {
          return \`❌ ERROR: Account "\${arg1}" is not registered. (Hard-purged users cannot be restored)\`;
        }
        if (candidate.status !== 'purged') {
          return \`❌ ERROR: User @\${candidate.username} is not purged.\`;
        }
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
        saveDb(true);
        return \`✅ SUCCESS: User @\${candidate.username} successfully restored to active status.\`;
      } catch (err: any) {
        return \`❌ ERROR restoring user: \${err.message || err}\`;
      }
    }
    case 'reset-avatar':
    case 'reset_avatar': {
      try {
        if (!arg1) return '❌ ERROR: Command "reset-avatar" requires a <username> argument.';
        const candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase() || u.username.toLowerCase() === \`@\${arg1.replace(/^@/, '').toLowerCase()}\`);
        if (!candidate) {
          return \`❌ ERROR: Account "\${arg1}" is not registered.\`;
        }
        const uId = candidate.user_id;
        const profile = db.profiles && db.profiles.find(p => p.user_id === uId);
        if (profile) {
          profile.avatar_url = null;
          profile.updated_at = new Date().toISOString();
          saveDb(true);
          return \`✅ SUCCESS: Avatar for user @\${candidate.username} has been reset.\`;
        } else {
          return \`❌ ERROR: Profile for user @\${candidate.username} not found.\`;
        }
      } catch (err: any) {
        return \`❌ ERROR resetting avatar: \${err.message || err}\`;
      }
    }
`;

code = code.replace(
  /    case 'delete-user':/,
  handlers.trim() + "\n    case 'delete-user':"
);

const validCommandsAlias = `
  else if (action === 'restore-user' || action === 'restore_user') action = 'restore-user';
  else if (action === 'reset-avatar' || action === 'reset_avatar') action = 'reset-avatar';
`;

code = code.replace(
  /  else if \(action === 'delete-user' \|\| action === 'delete_user'\) action = 'delete-user';/,
  "  else if (action === 'delete-user' || action === 'delete_user') action = 'delete-user';" + validCommandsAlias
);

const helpText = `
        \`• restore-user <user>          - Restore a soft-purged user account\\n\` +
        \`• reset-avatar <user>          - Reset user's avatar\\n\` +
`;

code = code.replace(
  /        `• delete-user <user>           - Permanently delete user account and all data\\n` \+/,
  "        `• delete-user <user>           - Permanently delete user account and all data\\n` +\n" + helpText.trim() + " +"
);

fs.writeFileSync('server/db.ts', code);
