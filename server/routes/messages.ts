import { Message } from '../../src/types.js';
import express from 'express';
import { db, loadDb, saveDb, isUserBlocked } from '../db.js';
import { authenticateUser } from '../middleware.js';
import { broadcastToRoom } from '../websocket.js';
import { generatePrefixedId } from '../utils/ulid.js';
import { can, isLoungeVisible, PERMISSIONS } from '../controllers/lounges.js';

export const messagesRouter = express.Router();

// Return a flattened list of all rooms/lounges that the admin can see (for AdminPanel)
messagesRouter.get('/rooms', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user;
    loadDb();
    const roomsList: any[] = [];
    
    // Add global lobby/lounges
    if (db.lounges) {
      for (const lounge of db.lounges) {
        if (!lounge.parent_lounge_id) {
          if (isLoungeVisible(lounge, user)) {
            roomsList.push({
              room_id: lounge.lounge_id,
              name: lounge.name,
              access_level: lounge.access_level || 'ALL',
              permissions: { isPrivate: lounge.is_private === 1 }
            });
          }
        }
      }
    }
    
    // Add sublounges as rooms
    if (db.lounges) {
      for (const lounge of db.lounges) {
        if (lounge && lounge.parent_lounge_id) {
          const parent = db.lounges.find(p => p && p.lounge_id === lounge.parent_lounge_id);
          if (parent && isLoungeVisible(parent, user) && isLoungeVisible(lounge, user)) {
            roomsList.push({
              room_id: lounge.lounge_id,
              name: lounge.name,
              parent_lounge_id: lounge.parent_lounge_id,
              access_level: lounge.access_level || 'ALL',
              permissions: { isPrivate: lounge.is_private === 1 || lounge.visibility === 'private' || lounge.is_locked === 1 }
            });
          }
        }
      }
    }

    res.json(roomsList);
  } catch (err: any) {
    console.error('Error fetching dynamic rooms list:', err);
    res.status(500).json({ error: 'Failed to retrieve dynamic rooms list.' });
  }
});

// Get messages for a specific room (or active chat workspace)
messagesRouter.get('/rooms/:roomId/messages', authenticateUser, (req, res) => {
  try {
    const { roomId } = req.params;
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: No session payload.' });
    }

    loadDb();

    // Check if DM room involves an administrator
    if (roomId.startsWith('dm_')) {
      const parts = roomId.split('_');
      if (parts.length === 3) {
        const u1 = Number(parts[1]);
        const u2 = Number(parts[2]);
        const targetUserId = u1 === Number(user.user_id) ? u2 : u1;
        const target = (db.users || []).find(u => u && Number(u.user_id) === targetUserId);
        if (target) {
          const isSenderAdmin = (user.role as string) === 'SUPPORT_ADMIN' || (user.role as string) === 'SYSTEM_ADMIN' || (user.role as string) === 'LOGIN_ADMIN' || (user.role as string) === 'ADMIN' || (user.role && (user.role as string).includes('ADMIN'));
          const isTargetAdmin = (target.role as string) === 'SUPPORT_ADMIN' || (target.role as string) === 'SYSTEM_ADMIN' || (target.role as string) === 'LOGIN_ADMIN' || (target.role as string) === 'ADMIN' || (target.role && (target.role as string).includes('ADMIN'));
          if (isTargetAdmin && !isSenderAdmin) {
            return res.status(403).json({ error: 'Admin messages are restricted.' });
          }
        }
      }
    }
    
    let resolvedLoungeId = 'unknown';
    let resolvedRoomId: string | undefined = roomId;
    
    if (roomId && typeof roomId === 'string') {
      if (roomId.startsWith('dm_')) {
        resolvedLoungeId = 'dm';
      } else {
        const targetRoom = db.lounges?.find(l => l.lounge_id === roomId);
        if (targetRoom) {
          const isAdmin = ['SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'].includes(user.role);
          if (targetRoom.accessLevel === 'EXEC_ONLY' && !isAdmin) {
             return res.status(403).json({ error: 'Access denied.' });
          }
          if (!isLoungeVisible(targetRoom, user) || !can(user, PERMISSIONS.VIEW_MEMBERS, targetRoom)) {
            return res.status(403).json({ error: 'Access denied.' });
          }
          if (targetRoom.parent_lounge_id) {
            resolvedLoungeId = targetRoom.parent_lounge_id;
            resolvedRoomId = roomId;
          } else {
            resolvedLoungeId = roomId;
            resolvedRoomId = undefined;
          }
        } else {
          return res.status(404).json({ error: 'Room not found.' });
        }
      }
    }
    
    // Fetch all messages matching the room
    const filtered = (db.messages || []).filter(msg => {
      if (!msg) return false;
      if (resolvedRoomId !== undefined) {
        return msg.room_id === resolvedRoomId;
      }
      return msg.lounge_id === resolvedLoungeId && !msg.room_id;
    });

    res.json(filtered);
  } catch (err: any) {
    console.error('Error in GET /rooms/:roomId/messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Post a message inside a room
messagesRouter.post('/rooms/:roomId/messages', authenticateUser, (req, res) => {
  try {
    const { roomId } = req.params;
    const { content, isEncrypted, is_encrypted, replyTo, burnSeconds } = req.body;
    const isEncryptedVal = isEncrypted !== undefined ? isEncrypted : is_encrypted;
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Session required.' });
    }

    if (!content && content !== '') {
      return res.status(400).json({ error: 'Content is required.' });
    }

    loadDb();

    // Check if DM room involves an administrator or if a block is active
    if (roomId.startsWith('dm_')) {
      const parts = roomId.split('_');
      if (parts.length === 3) {
        const u1 = Number(parts[1]);
        const u2 = Number(parts[2]);
        const targetUserId = u1 === Number(user.user_id) ? u2 : u1;
        
        if (isUserBlocked(user.user_id, targetUserId)) {
          return res.status(403).json({ error: 'Action Blocked: You cannot send messages to this peer.' });
        }

        const target = (db.users || []).find(u => u && Number(u.user_id) === targetUserId);
        if (target) {
          const isSenderAdmin = (user.role as string) === 'SUPPORT_ADMIN' || (user.role as string) === 'SYSTEM_ADMIN' || (user.role as string) === 'LOGIN_ADMIN' || (user.role as string) === 'ADMIN' || (user.role && (user.role as string).includes('ADMIN'));
          const isTargetAdmin = (target.role as string) === 'SUPPORT_ADMIN' || (target.role as string) === 'SYSTEM_ADMIN' || (target.role as string) === 'LOGIN_ADMIN' || (target.role as string) === 'ADMIN' || (target.role && (target.role as string).includes('ADMIN'));
          if (isTargetAdmin && !isSenderAdmin) {
            return res.status(403).json({ error: 'Admin messages are read-only.' });
          }
        }
      }
    }

    let resolvedLoungeId = 'unknown';
    let resolvedRoomId: string | undefined = roomId;
    
    if (roomId && typeof roomId === 'string') {
      if (roomId.startsWith('dm_')) {
        resolvedLoungeId = 'dm';
      } else {
        const targetRoom = db.lounges?.find(l => l.lounge_id === roomId);
        if (targetRoom) {
          const isAdmin = ['SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'].includes(user.role);
          if (targetRoom.accessLevel === 'EXEC_ONLY' && !isAdmin) {
            return res.status(403).json({ error: 'Access denied.' });
          }
          if (targetRoom.accessLevel === 'ANNOUNCE' && !isAdmin) {
            return res.status(403).json({ error: 'Announcements channel is read-only for users.' });
          }
          if (!isLoungeVisible(targetRoom, user) || !can(user, PERMISSIONS.SEND_MESSAGE, targetRoom)) {
            return res.status(403).json({ error: 'Access denied.' });
          }
          if (targetRoom.parent_lounge_id) {
            resolvedLoungeId = targetRoom.parent_lounge_id;
            resolvedRoomId = roomId;
          } else {
            resolvedLoungeId = roomId;
            resolvedRoomId = undefined;
          }
        } else {
          return res.status(404).json({ error: 'Room not found.' });
        }
      }
    }
    
    const newMessage: Message = {
      message_id: generatePrefixedId('msg'),
      lounge_id: resolvedLoungeId,
      room_id: resolvedRoomId || '',
      user_id: user.user_id,
      content,
      is_encrypted: !!isEncryptedVal,
      reply_to: replyTo || null,
      timestamp: new Date().toISOString(),
      expires_in: burnSeconds ? Number(burnSeconds) : null,
      status: 'sent',
      burn_seconds: burnSeconds ? Number(burnSeconds) : null
    };

    db.messages = db.messages || [];
    db.messages.push(newMessage);
    saveDb();

    // Broadcast message over local active Websocket presence engine
    try {
      broadcastToRoom(roomId, {
        type: 'message',
        message: newMessage
      });
    } catch (wsErr) {
      console.warn('WebSocket broadcast bypass:', wsErr);
    }

    res.json(newMessage);
  } catch (err: any) {
    console.error('Error in POST /rooms/:roomId/messages:', err);
    res.status(500).json({ error: 'Internal server error posting message' });
  }
});

// Delete message completely from database mapping (Absolute Purge compliance directive)
messagesRouter.delete('/messages/:messageId', authenticateUser, (req, res) => {
  try {
    const { messageId } = req.params;
    const user = (req as any).user;

    loadDb();
    db.messages = db.messages || [];

    const index = db.messages.findIndex(m => m && m.message_id === messageId);
    if (index === -1) {
      return res.status(404).json({ error: 'Message index not located.' });
    }

    const msg = db.messages[index];
    // Must be admin or the original author
    const isAdmin = user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_ADMIN';
    if (Number(msg.user_id) !== Number(user.user_id) && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    const roomId = msg.room_id;

    // Remove item completely
    db.messages.splice(index, 1);
    saveDb();

    // Notify clients across channels
    try {
      broadcastToRoom(roomId, {
        type: 'message_deleted',
        messageId
      });
    } catch (e) {}

    res.json({ success: true, messageId });
  } catch (err: any) {
    console.error('Error in DELETE /messages/:messageId:', err);
    res.status(500).json({ error: 'Error purging message record' });
  }
});
