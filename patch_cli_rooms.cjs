const fs = require('fs');
let code = fs.readFileSync('cli.js', 'utf8');

code = code.replace(
  /'list-rooms', 'list_rooms', 'rooms',/,
  "'list-lounges', 'list_lounges', 'lounges',"
);

code = code.replace(
  /'rooms': 'list-rooms',/,
  "'lounges': 'list-lounges',"
);

code = code.replace(
  / \.\/rooms\\x1b\[0m                 List active room metadata/,
  " ./lounges\\x1b[0m               List active lounges metadata"
);

const oldRoomsBlock = `    } else if (command === 'list-rooms' || command === 'list_rooms') {
      console.log(\`\\n\\x1b[1m\\x1b[36m=== SECURE CHANNELS REGISTRY MATRIX ===\\x1b[0m\`);
      if (db.rooms) {
        db.rooms.forEach(room => {
          const owner = db.users.find(u => u.user_id === room.owner_id);
          console.log(\` - [ID: \\x1b[35m\${room.room_id}\\x1b[0m] "\\x1b[1m\${room.name}\\x1b[0m" | Owner: \${owner?.username || 'System'} | Private: \${room.permissions.isPrivate ? '\\x1b[31mTRUE\\x1b[0m' : '\\x1b[32mFALSE\\x1b[0m'}\`);
        });
      } else {
        console.log('No rooms defined in database.');
      }`;

const newLoungesBlock = `    } else if (command === 'list-lounges' || command === 'list_lounges') {
      console.log(\`\\n\\x1b[1m\\x1b[36m=== SECURE LOUNGES REGISTRY MATRIX ===\\x1b[0m\`);
      if (db.lounges) {
        db.lounges.forEach(lounge => {
          const owner = db.users.find(u => u.user_id === lounge.owner_id);
          console.log(\` - [ID: \\x1b[35m\${lounge.lounge_id || lounge.id}\\x1b[0m] "\\x1b[1m\${lounge.name}\\x1b[0m" | Owner: \${owner?.username || 'System'} | Private: \${lounge.is_private ? '\\x1b[31mTRUE\\x1b[0m' : '\\x1b[32mFALSE\\x1b[0m'}\`);
        });
      } else {
        console.log('No lounges defined in database.');
      }`;

code = code.replace(oldRoomsBlock, newLoungesBlock);
fs.writeFileSync('cli.js', code);
