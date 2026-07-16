const sqlite = require('node:sqlite');
const db = new sqlite.DatabaseSync('data/velum_db.sqlite');
const sessions = db.prepare("SELECT * FROM sessions").all();
const adminSession = sessions.find(s => {
  const p = JSON.parse(s.payload);
  const u = db.prepare("SELECT payload FROM users WHERE id = ?").get(p.user_id);
  if (u) {
    const user = JSON.parse(u.payload);
    return user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN';
  }
  return false;
});
if (adminSession) {
  const p = JSON.parse(adminSession.payload);
  console.log(p.session_token);
} else {
  console.log("NO_SESSION");
}
