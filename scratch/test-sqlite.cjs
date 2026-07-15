const sqlite = require('node:sqlite');
const db = new sqlite.DatabaseSync('data/velum_db.sqlite');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tables);
