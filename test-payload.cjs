const sqlite = require('node:sqlite');
const db = new sqlite.DatabaseSync('data/velum_db.sqlite');
const sessions = db.prepare("SELECT * FROM sessions LIMIT 1").all();
console.log(sessions[0].payload.toString());
