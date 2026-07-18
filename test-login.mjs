import fs from 'fs';

const dbRaw = fs.readFileSync('server/db/database.json', 'utf8');
const db = JSON.parse(dbRaw);

const adminSession = db.sessions.find(s => s.user_id === 2 && s.status === 'active');
console.log(adminSession);
