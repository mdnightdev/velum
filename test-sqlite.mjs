import sqlite3 from 'better-sqlite3';

const db = sqlite3('data/velum_db.sqlite');
const sessions = db.prepare('SELECT * FROM sessions').all();
console.log(sessions);
