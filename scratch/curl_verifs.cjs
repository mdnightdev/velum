const db = JSON.parse(require('fs').readFileSync('data/db.json', 'utf8'));
const session = db.sessions.find(s => s.status === 'active' && s.user_id === db.users.find(u => u.username === 'CLI').user_id);
if (!session) {
  console.log('No CLI session found');
} else {
  console.log('Got session:', session.session_id);
  // wait, the token is not stored, only the hashed token!
  // I can just login as CLI via API.
}
