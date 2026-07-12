const fs = require('fs');
let code = fs.readFileSync('server/db.ts', 'utf8');

code = code.replace(
  /else if \(action === 'list-rooms' \|\| action === 'list_rooms'\) action = 'rooms';/,
  "else if (action === 'list-lounges' || action === 'list_lounges') action = 'lounges';"
);

code = code.replace(
  /• rooms                        - List all active chat channels/,
  "• lounges                      - List all active lounges"
);

const oldRoomsCase = `    case 'rooms':
    case 'list-rooms': {
      return 'No active room channels defined in database.';
    }`;

const newLoungesCase = `    case 'lounges':
    case 'list-lounges': {
      if (!db.lounges || db.lounges.length === 0) {
        return 'No active lounges defined in database.';
      }
      let output = '\\n=== SECURE LOUNGES REGISTRY MATRIX ===\\n';
      db.lounges.forEach((lounge: any) => {
        const owner = db.users.find((u: any) => u.user_id === lounge.owner_id);
        output += \` - [ID: \${lounge.lounge_id || lounge.id}] "\${lounge.name}" | Owner: \${owner?.username || 'System'} | Private: \${lounge.is_private ? 'TRUE' : 'FALSE'}\\n\`;
      });
      return output;
    }`;

code = code.replace(oldRoomsCase, newLoungesCase);

fs.writeFileSync('server/db.ts', code);
