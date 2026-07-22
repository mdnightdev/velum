import { db, saveDb } from '../db.js';
import { broadcastToRoom } from './websocket.js';

export function updateUserPresence(userId: number, lastSeen: string) {
  const userObj = db.users.find(u => u.user_id === userId);
  if (userObj) {
    userObj.last_seen_at = lastSeen;
    saveDb();
    broadcastToRoom('admin_channel', {
      type: 'presence_update',
      user_id: userId,
      last_seen_at: lastSeen
    });
  }
}
