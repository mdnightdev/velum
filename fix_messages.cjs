const fs = require('fs');

const goodBlock = `    if (roomId && typeof roomId === 'string') {
      if (roomId.startsWith('dm_')) {
        resolvedLoungeId = 'dm';
      } else if (roomId === 'velum_lounge') {
        resolvedLoungeId = 'velum_lounge';
        resolvedRoomId = undefined;
      } else {
        const isLounge = db.lounges?.find(l => l.lounge_id === roomId);
        if (isLounge) {
          if (isLounge.parent_lounge_id) {
            resolvedLoungeId = isLounge.parent_lounge_id;
            resolvedRoomId = roomId;
            const isPrivate = isLounge.is_private === 1 || isLounge.visibility === 'private' || isLounge.is_locked === 1;
            if (isPrivate) {
              const profile = db.profiles?.find(p => p.user_id === user.user_id);
              const isCreator = String(isLounge.creator_id || isLounge.owner_id || isLounge.owner_user_id) === String(user.user_id);
              const isSystemAdmin = user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN';
              const parentLounge = db.lounges?.find(l => l.lounge_id === isLounge.parent_lounge_id);
              const isLoungeOwner = parentLounge && String(parentLounge.owner_id) === String(user.user_id);
              const isMember = db.lounge_members?.some(m => m.lounge_id === roomId && String(m.user_id) === String(user.user_id) && m.status === 'active');
              const joinedLegacy = profile?.joined_lounges?.includes(roomId);
              if (!isCreator && !isSystemAdmin && !isLoungeOwner && !isMember && !joinedLegacy) {
                return res.status(403).json({ error: 'Access denied.' });
              }
            }
          } else {
            resolvedLoungeId = roomId;
            resolvedRoomId = undefined;
          }
        }
      }
    }`;

let code = fs.readFileSync('server/routes/messages.ts', 'utf8');

// The block starts at `if (roomId && typeof roomId === 'string') {`
// and ends right before `if (resolvedLoungeId === 'secops') {`

const parts = code.split(/if\s*\(roomId\s*&&\s*typeof\s*roomId\s*===\s*'string'\)\s*\{/);
// parts[0] is everything before first block.
// parts[1] is everything between first block and second block.
// parts[2] is everything after second block.

function replaceUntilSecops(str) {
    const secopsIdx = str.indexOf("if (resolvedLoungeId === 'secops') {");
    if (secopsIdx === -1) return str;
    return "\n" + goodBlock + "\n    \n    " + str.substring(secopsIdx);
}

if (parts.length === 3) {
    code = parts[0] + replaceUntilSecops(parts[1]) + replaceUntilSecops(parts[2]);
    fs.writeFileSync('server/routes/messages.ts', code);
    console.log("File fixed successfully");
} else {
    console.log("Could not find blocks. Parts length:", parts.length);
}

