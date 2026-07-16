const http = require('http');

// Get the admin token from the database
const sqlite = require('node:sqlite');
const db = new sqlite.DatabaseSync('data/velum_db.sqlite');
const sessions = db.prepare("SELECT * FROM sessions").all();
let token = null;
for (const s of sessions) {
  const p = JSON.parse(s.payload);
  const u = db.prepare("SELECT payload FROM users WHERE id = ?").get(p.user_id);
  if (u) {
    const user = JSON.parse(u.payload);
    if (user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN') {
      token = p.session_token;
      break;
    }
  }
}

if (!token) {
  console.log("NO ADMIN SESSION FOUND");
  process.exit(1);
}

const req = http.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/bank/accounts',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token,
    'x-session-id': token
  }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log("STATUS:", res.statusCode);
    console.log("BODY:", body);
  });
});
req.on('error', console.error);
req.end();
