const Database = require('better-sqlite3');
const db = new Database('velum_db.sqlite');

try {
  db.exec('ALTER TABLE channels RENAME COLUMN community_id TO lounge_id;');
  console.log('Renamed community_id to lounge_id in channels table');
} catch (err) {
  console.log('Failed to rename community_id in channels:', err.message);
}

try {
  db.exec('ALTER TABLE nodes RENAME COLUMN community_id TO lounge_id;');
  console.log('Renamed community_id to lounge_id in nodes table');
} catch (err) {
  console.log('Failed to rename community_id in nodes:', err.message);
}
