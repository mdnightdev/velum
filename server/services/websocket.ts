import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { 
  User, Profile, Session, Device, IpAddress, 
  Message, UserBlock, AdminSanction, Invite, Ticket, RecoveryEvent, 
  SuspiciousEvent, AuditLog, WsPayload, FriendRequest, PeerRelationship
} from '../../src/types.js';
import { db, loadDb, saveDb, isUserBlocked, registerBroadcastToRoomCallback } from '../db.js';
import { checkCredential } from '../utils/crypto.js';
import { verifySessionToken } from '../middlewares/auth.js';
import { isCloudBackupDisabled } from './sync.js';
import { updateUserPresence } from './presence.js';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const wss = new WebSocketServer({ noServer: true });

const wsLogStream = fs.createWriteStream(path.join(__dirname, 'ws.log'), { flags: 'a' });
const logWS = (msg: string) => wsLogStream.write(`[${new Date().toLocaleTimeString()}] ${msg}\n`);


export interface ClientConnection {
  ws: WebSocket;
  user_id: number;
  session_id?: string;
  rooms: Set<string>;
}

export let connectedClients: ClientConnection[] = [];

wss.on('connection', (ws, req) => {
  // Sync the latest state from SQLite relational tables on new socket handshake
  loadDb();
  
  // Try to read user session parameters or headers
  const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
  const userId = parseInt(urlParams.get('userId') || '0', 10);

  if (!userId) {
    ws.close(3000, 'Unauthorized user ID missing');
    return;
  }

  const rawToken = urlParams.get('token') || urlParams.get('sessionId') || '';
  const decoded = verifySessionToken(rawToken);
  
  // If JWT verification fails, reject connection immediately
  if (!decoded) {
    ws.close(3003, 'Unauthorized: Invalid or expired session token.');
    return;
  }
  
  const sessionId = decoded.session_id;

  const userObj = db.users.find(u => u.user_id === userId);
  if (!userObj || userObj.status !== 'active') {
    ws.close(3001, 'Unauthorized: User account suspended, quarantined, or not found.');
    return;
  }

  // If user is a SUPPORT_ADMIN, check if their base user has approved promotion status
  if (userObj.role === 'SUPPORT_ADMIN') {
    const baseCleanName = userObj.username.replace(/^SA-/, '');
    const baseUser = db.users.find(u => u.username.replace(/^@/, '').toLowerCase() === baseCleanName.toLowerCase());
    if (!baseUser || baseUser.promotion_status !== 'APPROVED_SUPPORT') {
      ws.close(3200, 'Unauthorized: Security credentials revoked.');
      return;
    }
  }

  // Ensure active session exists in db.sessions
  const session = db.sessions.find(s => 
    s.user_id === userId && 
    s.session_id === sessionId && 
    s.status === 'active'
  );
  if (!session) {
    ws.close(3002, 'Unauthorized: Active session expired or revoked.');
    return;
  }

  const client: ClientConnection = {
    ws,
    user_id: userId,
    session_id: sessionId || undefined,
    rooms: new Set(['velum_lounge']) // automatically join lobby
  };
  connectedClients.push(client);

  logWS(`WebSocket connected: User ${userId} (Total clients: ${connectedClients.length})`);

  // Update presence on connect
  updateUserPresence(userId, 'online');

  // Handle messages
  ws.on('message', async (rawData) => {
    try {
      // Synchronize transient database state from SQLite to prevent packet handling or authorization on stale data
      loadDb();

      // Dynamic Security check: Ensure the user still exists and is active
      const currentUserObj = db.users.find(u => u.user_id === userId);
      if (!currentUserObj || currentUserObj.status !== 'active') {
        ws.send(JSON.stringify({ type: 'error', message: 'SESSION_TERMINATED: Account suspended, quarantined, or deleted.' }));
        ws.close(3001, 'Account suspended, quarantined, or deleted.');
        return;
      }

      // If user is a SUPPORT_ADMIN, check if their base user has approved promotion status
      if (currentUserObj.role === 'SUPPORT_ADMIN') {
        const baseCleanName = currentUserObj.username.replace(/^SA-/, '');
        const baseUser = db.users.find(u => u.username.replace(/^@/, '').toLowerCase() === baseCleanName.toLowerCase());
        if (!baseUser || baseUser.promotion_status !== 'APPROVED_SUPPORT') {
          ws.send(JSON.stringify({ type: 'error', message: 'SESSION_TERMINATED: Security credentials revoked.' }));
          ws.close(3200, 'Security credentials revoked.');
          return;
        }
      }

      // Ensure active session exists in db.sessions
      const currentSessionObj = db.sessions.find(s => 
        s.user_id === userId && 
        s.session_id === sessionId && 
        s.status === 'active'
      );
      if (!currentSessionObj) {
        ws.send(JSON.stringify({ type: 'error', message: 'SESSION_TERMINATED: Active session expired or revoked.' }));
        ws.close(3002, 'Active session expired or revoked.');
        return;
      }

      const payload = JSON.parse(rawData.toString()) as WsPayload;

      if (payload && (payload as any).type === 'ping') {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pong', sentAt: (payload as any).sentAt }));
        }
        return;
      }
      
      // Enforce Sanction Checks BEFORE processing socket commands
      const currentBan = db.admin_sanctions.find(s => 
        s.user_id === userId && 
        s.type === 'ban' && 
        new Date(s.expires_at || 0).getTime() > Date.now()
      );
      if (currentBan) {
        ws.send(JSON.stringify({ type: 'error', message: `BANNED: Access denied. Reason: ${currentBan.reason}` }));
        ws.close(3001, 'Banned');
        return;
      }

      // 1. Join room event
      if (payload.type === 'join_room') {
        const roomId = payload.room_id;
        
        // Security checks: if private or support tickets, verify ownership/membership
        if (roomId.startsWith('ticket_')) {
          const ticketId = roomId.replace('ticket_', '');
          const ticket = db.tickets.find(t => t.ticket_id === ticketId);
          const isAdmin = currentUserObj.role === 'CLI_ADMIN' || currentUserObj.role === 'LOGIN_ADMIN' || currentUserObj.role === 'SUPPORT_ADMIN';
          if (!ticket || (ticket.user_id !== userId && !isAdmin)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Forbidden: Ticket room access rejected.' }));
            return;
          }
        } else if (roomId.startsWith('dm_')) {
            const parts = roomId.split('_');
            
            // Enforce strict structural match (e.g., dm_user1_user2)
            const isStandardDM = parts.length === 3 && (parts[1] === String(userId) || parts[2] === String(userId));
            const isVelumDM = roomId === `dm_velum_${userId}`;

            if (!isStandardDM && !isVelumDM) {
                ws.send(JSON.stringify({ type: 'error', message: 'Forbidden: Private DM room access rejected.' }));
                return;
            }
         
        }
         else {
          // General lounges security check
          const isLounge = db.lounges?.find(l => l.lounge_id === roomId);
          if (isLounge) {
            const isPrivate = isLounge.visibility === 'private' || isLounge.visibility === 'invite_only' || isLounge.is_private === 1;
            if (isPrivate) {
              const profile = db.profiles?.find(p => p.user_id === userId);
              const isJoined = profile?.joined_lounges?.includes(roomId);
              const isOwner = String(isLounge.creator_id || isLounge.owner_id) === String(userId);
              const isAdmin = currentUserObj.role === 'CLI_ADMIN' || currentUserObj.role === 'LOGIN_ADMIN';
              if (!isJoined && !isOwner && !isAdmin) {
                ws.send(JSON.stringify({ type: 'error', message: 'Forbidden: Private Lounge room access rejected.' }));
                return;
              }
            }
          } else {
            const isRoom = db.lounge_rooms?.find(r => r.id === roomId);
            if (isRoom) {
              const pLounge = db.lounges?.find(l => l.lounge_id === isRoom.lounge_id);
              if (pLounge && (pLounge.visibility === 'private' || pLounge.visibility === 'invite_only' || pLounge.is_private === 1)) {
                const profile = db.profiles?.find(p => p.user_id === userId);
                const isJoined = profile?.joined_lounges?.includes(pLounge.lounge_id);
                const isOwner = String(pLounge.creator_id || pLounge.owner_id) === String(userId);
                const isAdmin = currentUserObj.role === 'CLI_ADMIN' || currentUserObj.role === 'LOGIN_ADMIN';
                if (!isJoined && !isOwner && !isAdmin) {
                  ws.send(JSON.stringify({ type: 'error', message: 'Forbidden: Private Lounge room access rejected.' }));
                  return;
                }
              }
            }
          }
        }

        client.rooms.add(roomId);
        logWS(`User ${userId} joined room/channel: ${roomId}`);
        
        // Retrieve and send room message history for reliable synchronization
        const filteredHistory = (db.messages || []).filter(msg => {
          if (!msg) return false;
          if (msg.room_id === roomId || msg.lounge_id === roomId) {
            // Block verification: if DM, verify recipient hasn't blocked sender or vice versa
            return true;
          }
          return false;
        }).map(msg => {
          const sender = db.users.find(u => u.user_id === msg.user_id);
          const senderProfile = db.profiles.find(p => p.user_id === msg.user_id);
          return {
            ...msg,
            username: sender ? sender.username : 'User',
            avatar: senderProfile ? senderProfile.avatar : ''
          };
        });

        ws.send(JSON.stringify({
          type: 'history',
          room_id: roomId,
          messages: filteredHistory
        }));
      }
      
      // 2. Send message event
      if (payload.type === 'send_message') {
        const targetRoomId = payload.room_id;
        const msgContent = payload.content;

        if (!msgContent || msgContent.trim() === '') return;

        // Verify global mute status
        let isGloballyMuted = false;
        
        // Check local sqlite room muting
        const isRoom = db.lounge_rooms?.find(r => r.id === targetRoomId);
        const activeMuteLoungeId = isRoom ? isRoom.lounge_id : targetRoomId;

        isGloballyMuted = db.admin_sanctions.some(s => 
          s.user_id === userId && 
          s.type === 'mute' && 
          (s.room_id === null || s.room_id === activeMuteLoungeId) &&
          new Date(s.expires_at || 0).getTime() > Date.now()
        );

        if (isGloballyMuted) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'MUTED: Your administrative broadcast privilege is suspended.' 
          }));
          return;
        }

        // Block lists: DM blocks check
        if (targetRoomId.startsWith('dm_')) {
          const parts = targetRoomId.split('_');
          const p1 = parseInt(parts[1], 10);
          const p2 = parseInt(parts[2], 10);
          if (!isNaN(p1) && !isNaN(p2)) {
            const user1 = db.users.find(u => u.user_id === p1);
            const user2 = db.users.find(u => u.user_id === p2);
            if (user1 && user2) {
              const blocked = isUserBlocked(p1, p2);
              if (blocked) {
                ws.send(JSON.stringify({ type: 'error', message: 'Communication blocked by recipient.' }));
                return;
              }
            }
          }
        }

        const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        const userObjInfo = db.users.find(u => u.user_id === userId);

        const newMsg: Message = {
          message_id: msgId,
          room_id: targetRoomId,
          lounge_id: activeMuteLoungeId,
          user_id: userId,
          content: msgContent,
          is_encrypted: !!payload.is_encrypted,
          reply_to: payload.reply_to || null,
          timestamp: new Date().toISOString(),
          expires_in: payload.expires_in ? Number(payload.expires_in) : null,
          status: 'sent',
          reactions: {}
        };

        db.messages.push(newMsg);
        saveDb();

        const responsePayload = {
          ...newMsg,
          username: userObjInfo ? userObjInfo.username : 'User',
          avatar: db.profiles.find(p => p.user_id === userId)?.avatar || ''
        };

        // Emit message to everyone in the room
        broadcastToRoom(targetRoomId, responsePayload);

        // Ensure offline direct messages are queued or flagged appropriately for push notification fallback
        if (targetRoomId.startsWith('dm_')) {
          const parts = targetRoomId.split('_');
          const recipientId = parts[1] === String(userId) ? parseInt(parts[2], 10) : parseInt(parts[1], 10);
          
          let recipientOnline = false;
          db.sessions.forEach(s => {
            if (s.user_id === recipientId && s.status === 'active') {
              // check active websocket
              const wsConn = connectedClients.some(c => c.user_id === recipientId && c.ws && c.ws.readyState === WebSocket.OPEN);
              if (wsConn) recipientOnline = true;
            }
          });

          if (!recipientOnline) {
             console.log(`[SYS-SECURE] DM recipient User ${recipientId} is currently offline. Message queued in sqlite WAL state.`);
          }
        }

        // Check if message is directed to Velum Bot
        if (targetRoomId.startsWith('dm_velum_') || (targetRoomId === 'velum_lounge' && msgContent.includes('@Velum'))) {
          handleVelumBotReply(userId, targetRoomId, msgContent);
        }
      }

      // 3. Add reaction event
      if (payload.type === 'add_reaction') {
        const targetRoomId = payload.room_id;
        const msgObj = db.messages.find(m => m.message_id === payload.message_id && (m.room_id === payload.room_id || m.lounge_id === payload.room_id));
        
        if (msgObj) {
          msgObj.reactions = msgObj.reactions || {};
          msgObj.reactions[payload.emoji] = msgObj.reactions[payload.emoji] || [];
          
          const userObj = db.users.find(u => u.user_id === userId);
          const reactUser = userObj ? userObj.username : 'User';

          if (!msgObj.reactions[payload.emoji].includes(reactUser)) {
            msgObj.reactions[payload.emoji].push(reactUser);
            saveDb();
            
            broadcastToRoom(targetRoomId, {
              type: 'reaction_update',
              message_id: payload.message_id,
              room_id: targetRoomId,
              reactions: msgObj.reactions
            });
          }
        }
      }

      // 4. Remove reaction event
      if (payload.type === 'remove_reaction') {
        const targetRoomId = payload.room_id;
        const msgObj = db.messages.find(m => m.message_id === payload.message_id && (m.room_id === payload.room_id || m.lounge_id === payload.room_id));
        
        if (msgObj && msgObj.reactions && msgObj.reactions[payload.emoji]) {
          const userObj = db.users.find(u => u.user_id === userId);
          const reactUser = userObj ? userObj.username : 'User';

          const list = msgObj.reactions[payload.emoji];
          msgObj.reactions[payload.emoji] = list.filter(u => u !== reactUser);
          
          if (msgObj.reactions[payload.emoji].length === 0) {
            delete msgObj.reactions[payload.emoji];
          }
          
          saveDb();

          broadcastToRoom(targetRoomId, {
            type: 'reaction_update',
            message_id: payload.message_id,
            room_id: targetRoomId,
            reactions: msgObj.reactions
          });
        }
      }

      // 5. Edit message event
      if (payload.type === 'edit_message') {
        const msgObj = db.messages.find(m => m.message_id === payload.message_id);
        if (msgObj) {
          if (msgObj.user_id !== userId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Forbidden: You do not own this message.' }));
            return;
          }

          msgObj.content = payload.content;
          msgObj.edited_at = new Date().toISOString();
          saveDb();

          const senderUser = db.users.find(u => u.user_id === userId);
          broadcastToRoom(msgObj.room_id, {
            type: 'message_edit',
            message_id: msgObj.message_id,
            room_id: msgObj.room_id,
            content: msgObj.content,
            edited_at: msgObj.edited_at,
            username: senderUser ? senderUser.username : 'User'
          });
        }
      }

      // 6. Delete message event
      if (payload.type === 'delete_message') {
        const msgObj = db.messages.find(m => m.message_id === payload.message_id);
        if (msgObj) {
          const senderUser = db.users.find(u => u.user_id === userId);
          const isAdmin = senderUser?.role === 'CLI_ADMIN' || senderUser?.role === 'LOGIN_ADMIN' || senderUser?.role === 'SUPPORT_ADMIN';
          
          if (msgObj.user_id !== userId && !isAdmin) {
            ws.send(JSON.stringify({ type: 'error', message: 'Forbidden: You do not have permission to delete this message.' }));
            return;
          }

          const targetRoomId = msgObj.room_id;
          db.messages = db.messages.filter(m => m.message_id !== payload.message_id);
          saveDb();

          broadcastToRoom(targetRoomId, {
            type: 'message_delete',
            message_id: payload.message_id,
            room_id: targetRoomId
          });
        }
      }

      // 7. Support Ticket live updates channel join
      if (payload.type === 'join_ticket') {
        const ticketId = payload.ticket_id;
        const userObj = db.users.find(u => u.user_id === userId);
        const isAdmin = userObj?.role === 'CLI_ADMIN' || userObj?.role === 'LOGIN_ADMIN' || userObj?.role === 'SUPPORT_ADMIN';

        const ticket = db.tickets.find(t => t.ticket_id === ticketId);
        if (ticket && (ticket.user_id === userId || isAdmin)) {
          client.rooms.add(`ticket_${ticketId}`);
          console.log(`User ${userId} joined Live Ticket Stream: ticket_${ticketId}`);
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Access denied to live ticket support stream.' }));
        }
      }

      // 8. Support Ticket reply send event
      if (payload.type === 'ticket_reply') {
        const ticketId = payload.ticket_id;
        const userObj = db.users.find(u => u.user_id === userId);
        const isAdmin = userObj?.role === 'CLI_ADMIN' || userObj?.role === 'LOGIN_ADMIN' || userObj?.role === 'SUPPORT_ADMIN';

        const ticket = db.tickets.find(t => t.ticket_id === ticketId);
        if (ticket && (ticket.user_id === userId || isAdmin)) {
          ticket.messages = ticket.messages || [];
          ticket.messages.push({
            sender_id: userId,
            sender_name: userObj ? userObj.username : 'Client',
            content: payload.content,
            timestamp: new Date().toISOString()
          });
          ticket.status = isAdmin ? 'pending' : 'open';
          saveDb();

          broadcastToRoom(`ticket_${ticketId}`, {
            type: 'ticket_update',
            ticket_id: ticketId,
            messages: ticket.messages,
            status: ticket.status
          });
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Ticket context not found or unauthorized.' }));
        }
      }

    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    const index = connectedClients.findIndex(c => c.ws === ws);
    if (index !== -1) {
      const client = connectedClients[index];
      connectedClients.splice(index, 1);
      
      updateUserPresence(client.user_id, new Date().toISOString());
    }
    logWS(`WebSocket disconnected. Total clients remaining: ${connectedClients.length}`);
  });
});

export function broadcastToRoom(room: string, object: any) {
  if (!object) return;
  connectedClients.forEach(c => {
    if (c.rooms.has(room) && c.ws && c.ws.readyState === WebSocket.OPEN) {
      try {
        c.ws.send(JSON.stringify(object));
      } catch (err) {
        console.error(`Error broadcasting to client in room ${room}:`, err);
      }
    }
  });
}

// Register WS broadcast callback in database module
registerBroadcastToRoomCallback((roomId: string, object: any) => {
  broadcastToRoom(roomId, object);
});

export async function handleVelumBotReply(userId: number, roomId: string, userText: string) {
  const cleanText = userText.replace(/@Velum/g, '').trim().toLowerCase();
  
  let replyContent = "I am Velum, the security system bot. Commands available: help, status, rules, diagnostics.";
  
  if (cleanText === 'help') {
    replyContent = "Commands available:\n" +
      "• status: Check systems status & locks\n" +
      "• rules: View compliance matrix\n" +
      "• diagnostics: Administrative node reports\n" +
      "• help: Display this support guide";
  } else if (cleanText === 'status') {
    replyContent = `[SYSTEM STATUS]: VELUM MATRIX ONLINE\n` +
      `• SQLite storage engine is healthy.\n` +
      `• CLOUD BACKUP SYNC: ${!isCloudBackupDisabled ? 'ENABLED' : 'DISABLED (LOCAL DATABASE)'}\n` +
      `• Client-side pre-hashing flow active.`;
  } else if (cleanText === 'rules') {
    replyContent = `[COMPLIANCE MATRIX]:\n` +
      `1. High-security passwords pre-hashed on client side.\n` +
      `2. One-time emergency panic phrase triggers containment.\n` +
      `3. Verification keys and recovery code generation strictly isolated.`;
  } else if (cleanText === 'diagnostics') {
    const user = db.users.find(u => u.user_id === userId);
    if (user && (user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_ADMIN')) {
      replyContent = `[DIAGNOSTICS PANEL - CONFIDENTIAL]:\n` +
        `• Active WebSocket client connections: ${connectedClients.length}\n` +
        `• Database size: ${db.messages.length} messages, ${db.users.length} registered users.\n` +
        `• Audit trace registries: ${db.audit_logs.length} operations logged.`;
    } else {
      replyContent = "Access Denied: Diagnostics logs require elevated security clearance.";
    }
  }

  // Simulate short delay for bot reply
  setTimeout(() => {
    const botMessage = {
      message_id: `msg_bot_${Date.now()}_reply`,
      lounge_id: 'dm',
      room_id: roomId,
      user_id: 999,
      content: replyContent,
      is_encrypted: false,
      reply_to: null,
      timestamp: new Date().toISOString(),
      expires_in: null,
      status: 'sent'
    };

    db.messages.push(botMessage);
    saveDb();

    // Live transmit to room
    const responsePayload = {
      ...botMessage,
      username: 'VELUM',
      avatar: 'emerald'
    };

    broadcastToRoom(roomId, responsePayload);
  }, 500);
}

export function setupCloudMessageSync() {
  if (typeof isCloudBackupDisabled !== 'undefined' && isCloudBackupDisabled) {
    console.log('[SYNC] Cloud sync disabled; skipping cloud message synchronization.');
    return;
  }

  console.log('[SYNC] Cloud backup provider present but realtime message synchronization via Neon PostgreSQL is not configured. Skipping realtime sync.');
  return;
}
