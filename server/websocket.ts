import { WebSocketServer, WebSocket } from 'ws';
import { SystemBot } from './v2/services/systemBot.js';
export { SystemBot };
import { db, executeWithRetry } from './v2/db/client.js';
import { sessions, users, userUnreadCounts, messageReactions } from './v2/db/schema/index.js';
import { lounges, messages as dbMessages } from './v2/db/schema/lounges.js';
import { eq, desc, and, sql, inArray, ne } from 'drizzle-orm';
import type { Server } from 'http';
import { hashSessionToken } from './v2/middleware/auth.js';
import { getRedisClient } from './v2/db/redis.js';
import { config } from './v2/config.js';

interface ClientConnection {
  ws: WebSocket;
  userId: number;
  username: string;
  avatarUrl:string;
  sessionId: string;
  rooms: Set<string>;
}

const connectedClients = new Map<WebSocket, ClientConnection>();
const roomMembers = new Map<string, Set<WebSocket>>();

// Message batching for performance
const messageQueues = new Map<number, any[]>(); // userId -> messages
const batchTimers = new Map<number, NodeJS.Timeout>();

function startMessageBatching(userId: number, message: any) {
  if (!messageQueues.has(userId)) {
    messageQueues.set(userId, []);
  }
  messageQueues.get(userId)!.push(message);

  // Clear existing timer if any
  if (batchTimers.has(userId)) {
    clearTimeout(batchTimers.get(userId)!);
  }

  // Set new timer to flush batch
  const timer = setTimeout(() => {
    flushMessageBatch(userId);
  }, config.MESSAGE_BATCH_INTERVAL);
  batchTimers.set(userId, timer);
}

async function flushMessageBatch(userId: number) {
  const messages = messageQueues.get(userId);
  if (!messages || messages.length === 0) return;

  messageQueues.delete(userId);
  batchTimers.delete(userId);

  // Process messages in batch
  for (const message of messages) {
    // Find the client for this user
    for (const [ws, client] of connectedClients.entries()) {
      if (client.userId === userId) {
        await handleSendMessage(client, message);
        break;
      }
    }
  }
}

async function getLoungeIdFromRoomId(roomId: string): Promise<number | null> {
  if (roomId.startsWith('dm_')) {
    return await getOrCreateDMLounge(roomId);
  }
  const [targetLounge] = await executeWithRetry(() => 
    db.select().from(lounges).where(eq(lounges.slug, roomId)).limit(1)
  );
  if (targetLounge) {
    return targetLounge.id;
  }
  const numericId = parseInt(roomId, 10);
  if (!isNaN(numericId)) {
    const [loungeById] = await executeWithRetry(() =>
      db.select().from(lounges).where(eq(lounges.id, numericId)).limit(1)
    );
    if (loungeById) return loungeById.id;
  }
  return null;
}

// PostgreSQL + Redis durable unread counter functions
async function incrementUnread(userId: number, roomId: string) {
  try {
    const redis = await getRedisClient();
    if (redis) {
      const key = `unread:${userId}:${roomId}`;
      await redis.incr(key);
      await redis.expire(key, 86400); // Expire after 24 hours
    }

    const loungeId = await getLoungeIdFromRoomId(roomId);
    if (loungeId !== null) {
      await db.insert(userUnreadCounts)
        .values({ userId, loungeId, unreadCount: 1 })
        .onConflictDoUpdate({
          target: [userUnreadCounts.userId, userUnreadCounts.loungeId],
          set: { 
            unreadCount: sql`${userUnreadCounts.unreadCount} + 1`,
            updatedAt: new Date()
          }
        });
    }
  } catch (err) {
    console.error('[WS] Failed to increment unread count:', err);
  }
}

async function resetUnread(userId: number, roomId: string) {
  try {
    const redis = await getRedisClient();
    if (redis) {
      const key = `unread:${userId}:${roomId}`;
      await redis.del(key);
    }

    const loungeId = await getLoungeIdFromRoomId(roomId);
    if (loungeId !== null) {
      await db.insert(userUnreadCounts)
        .values({ userId, loungeId, unreadCount: 0 })
        .onConflictDoUpdate({
          target: [userUnreadCounts.userId, userUnreadCounts.loungeId],
          set: { 
            unreadCount: 0,
            updatedAt: new Date()
          }
        });
    }
  } catch (err) {
    console.error('[WS] Failed to reset unread count:', err);
  }
}

async function markAllMessagesRead(userId: number, roomId: string) {
  try {
    const loungeId = await getLoungeIdFromRoomId(roomId);
    if (!loungeId) return;

    // Get all unread messages for this user in this lounge
    const unreadMessages = await db.select({ id: dbMessages.id, readBy: dbMessages.readBy })
      .from(dbMessages)
      .where(and(eq(dbMessages.loungeId, loungeId), ne(dbMessages.senderId, userId)));

    // Bulk update them
    for (const msg of unreadMessages) {
      const readBy = msg.readBy ? msg.readBy.split(',').map(Number).filter(id => !isNaN(id)) : [];
      if (!readBy.includes(userId)) {
        readBy.push(userId);
        await db.update(dbMessages)
          .set({ readBy: readBy.join(',') })
          .where(eq(dbMessages.id, msg.id));
      }
    }

    // Reset the cached counter
    await resetUnread(userId, roomId);
  } catch (err) {
    console.error('[WS] Failed to mark all messages read:', err);
  }
}

async function getUnreadCount(userId: number, roomId: string): Promise<number> {
  try {
    const redis = await getRedisClient();
    if (redis) {
      const key = `unread:${userId}:${roomId}`;
      const count = await redis.get(key);
      if (count && typeof count === 'string') {
        return parseInt(count, 10);
      }
    }

    const loungeId = await getLoungeIdFromRoomId(roomId);
    if (loungeId !== null) {
      const [dbCount] = await executeWithRetry(() =>
        db.select()
          .from(userUnreadCounts)
          .where(and(eq(userUnreadCounts.userId, userId), eq(userUnreadCounts.loungeId, loungeId)))
          .limit(1)
      );
      return dbCount ? dbCount.unreadCount : 0;
    }
  } catch (err) {
    console.error('[WS] Failed to get unread count:', err);
  }
  return 0;
}

async function getAllUnreadCounts(userId: number): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  try {
    const redis = await getRedisClient();
    if (redis) {
      const pattern = `unread:${userId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        for (const key of keys) {
          const roomId = key.split(':')[2];
          const count = await redis.get(key);
          if (count && typeof count === 'string') {
            counts[roomId] = parseInt(count, 10);
          }
        }
        return counts;
      }
    }

    // Cache-aside: Recover from Postgres if Redis cache is cold
    const dbCounts = await executeWithRetry(() =>
      db.select({
        loungeId: userUnreadCounts.loungeId,
        unreadCount: userUnreadCounts.unreadCount,
        slug: lounges.slug
      })
      .from(userUnreadCounts)
      .innerJoin(lounges, eq(userUnreadCounts.loungeId, lounges.id))
      .where(and(eq(userUnreadCounts.userId, userId), sql`${userUnreadCounts.unreadCount} > 0`))
    );

    for (const row of dbCounts) {
      const roomId = row.slug || String(row.loungeId);
      counts[roomId] = row.unreadCount;
      if (redis) {
        const key = `unread:${userId}:${roomId}`;
        await redis.set(key, String(row.unreadCount));
        await redis.expire(key, 86400);
      }
    }
  } catch (err) {
    console.error('[WS] Failed to get all unread counts:', err);
  }
  return counts;
}

export function setupWebSocketServer(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const userId = parseInt(url.searchParams.get('userId') || '0', 10);
      const sessionId = url.searchParams.get('sessionId') || '';

      if (!userId || !sessionId) {
        ws.close(1008, 'Missing userId or sessionId');
        return;
      }

      // Verify session
      const sessionHash = hashSessionToken(sessionId);
      let sessionResult: any[] = [];
      try {
        sessionResult = await executeWithRetry(() => db.select({
          session: sessions,
          user: users
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.tokenHash, sessionHash))
        .limit(1));
      } catch (dbErr: any) {
        console.error('[WS] Session verification temporary connection error:', dbErr?.message || dbErr);
        ws.close(1011, 'Database connection error');
        return;
      }

      if (sessionResult.length === 0) {
        ws.close(1008, 'Invalid session');
        return;
      }

      // Check session expiration
      if (sessionResult[0].session.expiresAt && new Date(sessionResult[0].session.expiresAt) < new Date()) {
        ws.close(1008, 'Session expired');
        return;
      }

      // Enforce connection limit per user (max 5)
      const existingConnsCount = Array.from(connectedClients.values())
        .filter(c => c.userId === userId).length;
      if (existingConnsCount >= 5) {
        ws.close(1008, 'Connection limit exceeded (max 5 concurrent sessions)');
        return;
      }
      
      try {
        await executeWithRetry(() => db.update(users).set({ updatedAt: new Date() }).where(eq(users.id, userId)));
      } catch (dbErr) {
        console.error('[WS] Failed to update user last active timestamp:', dbErr);
      }

      const client: ClientConnection = {
        ws,
        userId,
        username: sessionResult[0].user.username,
        avatarUrl:sessionResult[0].user.avatarUrl ||'',
        sessionId,
        rooms: new Set()
      };

      connectedClients.set(ws, client);

      // Cache active user session in Redis
      getRedisClient().then(redis => {
        if (redis) {
          redis.set(`user:${userId}:active`, sessionId, { EX: 300 }).catch(() => {});
        }
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          handleClientMessage(client, message);
        } catch (err) {
          console.error('WebSocket message parse error:', err);
        }
      });

      ws.on('close', () => {
        // Remove from all rooms
        client.rooms.forEach(roomId => {
          const members = roomMembers.get(roomId);
          if (members) {
            members.delete(ws);
            if (members.size === 0) {
              roomMembers.delete(roomId);
            }
          }
        });
        connectedClients.delete(ws);

        // Remove active user session from Redis
        getRedisClient().then(redis => {
          if (redis) {
            redis.del(`user:${client.userId}:active`).catch(() => {});
          }
        });

        // Clean up message batching for this user
        if (batchTimers.has(client.userId)) {
          clearTimeout(batchTimers.get(client.userId)!);
          batchTimers.delete(client.userId);
        }
        messageQueues.delete(client.userId);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      // Send initial pong
      ws.send(JSON.stringify({ type: 'pong', sentAt: Date.now() }));

    } catch (error) {
      console.error('WebSocket connection error:', error);
      ws.close(1011, 'Internal server error');
    }
  });

  return wss;
}

async function checkRateLimit(userId: number): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    if (!redis) return true; // Fail-open if Redis is not available
    const key = `ratelimit:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60); // 1 minute window
    }
    return count <= 30; // Max 30 messages per minute
  } catch (err) {
    console.error('[WS] Rate limit check error:', err);
    return true;
  }
}

async function handleAddReaction(client: ClientConnection, message: any) {
  try {
    const messageId = parseInt(message.message_id, 10);
    const emoji = message.emoji;
    const roomId = message.room_id;
    if (isNaN(messageId) || !emoji || !roomId) return;
    
    const [existing] = await executeWithRetry(() =>
      db.select()
        .from(messageReactions)
        .where(and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.userId, client.userId),
          eq(messageReactions.emoji, emoji)
        ))
        .limit(1)
    );
    
    if (existing) {
      // Toggle delete reaction
      await executeWithRetry(() =>
        db.delete(messageReactions)
          .where(eq(messageReactions.id, existing.id))
      );
    } else {
      // Add reaction
      await executeWithRetry(() =>
        db.insert(messageReactions)
          .values({
            messageId,
            userId: client.userId,
            emoji
          })
      );
    }
    
    // Get updated reactions mapping for the message
    const allReactions = await executeWithRetry(() =>
      db.select({
        emoji: messageReactions.emoji,
        username: users.username
      })
      .from(messageReactions)
      .innerJoin(users, eq(messageReactions.userId, users.id))
      .where(eq(messageReactions.messageId, messageId))
    );
    
    const reactionsMap: Record<string, string[]> = {};
    for (const react of allReactions) {
      if (!reactionsMap[react.emoji]) {
        reactionsMap[react.emoji] = [];
      }
      reactionsMap[react.emoji].push(react.username);
    }
    
    // Evict messages cache for this room
    const loungeId = await getLoungeIdFromRoomId(roomId);
    if (loungeId) {
      const redis = await getRedisClient();
      if (redis) {
        await redis.del(`room:${loungeId}:messages`);
      }
    }
    
    // Broadcast update to the room
    broadcastToRoom(roomId, {
      type: 'reaction_update',
      message_id: String(messageId),
      reactions: reactionsMap
    });
  } catch (err) {
    console.error('[WS] Failed to handle add reaction:', err);
  }
}

async function handleEditMessage(client: ClientConnection, message: any) {
  try {
    const messageId = parseInt(message.message_id, 10);
    const content = message.content;
    const roomId = message.room_id;
    if (isNaN(messageId) || !content || !roomId) return;

    // Fetch the original message to verify ownership and edit window
    const [originalMsg] = await executeWithRetry(() =>
      db.select()
        .from(dbMessages)
        .where(eq(dbMessages.id, messageId))
        .limit(1)
    );

    if (!originalMsg) {
      client.ws.send(JSON.stringify({ type: 'error', message: 'Message not found.' }));
      return;
    }

    if (originalMsg.senderId !== client.userId) {
      client.ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized. You can only edit your own messages.' }));
      return;
    }

    // Verify 15-minute edit window
    const timeDiffMinutes = (Date.now() - new Date(originalMsg.createdAt).getTime()) / (1000 * 60);
    if (timeDiffMinutes > 15) {
      client.ws.send(JSON.stringify({ type: 'error', message: 'Message editing window (15 minutes) has expired.' }));
      return;
    }

    // Update message in PostgreSQL
    await executeWithRetry(() =>
      db.update(dbMessages)
        .set({
          content,
          isEdited: true,
          editedAt: new Date()
        })
        .where(eq(dbMessages.id, messageId))
    );

    // Evict messages cache for this room
    const loungeId = await getLoungeIdFromRoomId(roomId);
    if (loungeId) {
      const redis = await getRedisClient();
      if (redis) {
        await redis.del(`room:${loungeId}:messages`);
      }
    }

    // Broadcast the edit update to the room
    broadcastToRoom(roomId, {
      type: 'message_edit',
      message_id: String(messageId),
      room_id: roomId,
      content,
      is_edited: true,
      edited_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('[WS] Failed to edit message:', err);
  }
}

async function handleClientMessage(client: ClientConnection, message: any) {
  // Refresh active user session TTL in Redis
  getRedisClient().then(redis => {
    if (redis) {
      redis.expire(`user:${client.userId}:active`, 300).catch(() => {});
    }
  });

  switch (message.type) {
    case 'join_room':
      handleJoinRoom(client, message.room_id);
      break;
    case 'leave':
      handleLeaveRoom(client, message.room_id);
      break;
    case 'send_message':
      // Rate limiting: max 30 messages per minute
      checkRateLimit(client.userId).then(isAllowed => {
        if (!isAllowed) {
          client.ws.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded. Max 30 messages per minute.'
          }));
          return;
        }
        startMessageBatching(client.userId, message);
      }).catch(err => {
        console.error('Rate limit error:', err);
        startMessageBatching(client.userId, message);
      });
      break;
    case 'add_reaction':
      handleAddReaction(client, message);
      break;
    case 'edit_message':
      handleEditMessage(client, message);
      break;
    case 'mark_read':
      handleMarkRead(client, message);
      break;
    case 'mark_all_read':
      await markAllMessagesRead(client.userId, message.room_id);
      break;
    case 'mark_delivered':
      handleMarkDelivered(client, message);
      break;
    case 'ping':
      client.ws.send(JSON.stringify({ type: 'pong', sentAt: message.sentAt || Date.now() }));
      break;
    case 'typing_start':
    case 'typing_stop':
      message.userId = client.userId;
      message.username = client.username;
      broadcastToRoom(message.room_id, message, client.ws);
      
      // Global DM broadcast for typing so sidebars update
      if (message.room_id && message.room_id.startsWith('dm_')) {
        const parts = message.room_id.replace('dm_', '').split('_');
        if (parts.length >= 2) {
          const uid1 = parseInt(parts[0], 10);
          const uid2 = parseInt(parts[1], 10);
          const targetId = client.userId === uid1 ? uid2 : uid1;
          const members = roomMembers.get(message.room_id);
          const broadcastStr = JSON.stringify(message);
          
          for (const c of connectedClients.keys()) {
            const clientData = connectedClients.get(c);
            if (clientData && clientData.userId === targetId && c.readyState === WebSocket.OPEN) {
              if (!members || !members.has(c)) {
                c.send(broadcastStr);
              }
            }
          }
        }
      }
      break;
    default:
      console.log('Unknown message type:', message.type);
  }
}

export async function getOrCreateDMLounge(roomId: string): Promise<number | null> {
  try {
    return await executeWithRetry(async () => {
      const [existing] = await db.select().from(lounges).where(eq(lounges.slug, roomId)).limit(1);
      if (existing) {
        return existing.id;
      }
      const [inserted] = await db.insert(lounges).values({
        slug: roomId,
        name: 'Direct Message',
        type: 'dm',
        isPrivate: true,
        isOfficial: false,
        isSystem: false
      }).returning();
      return inserted.id;
    });
  } catch (err) {
    console.error('getOrCreateDMLounge error:', err);
    return null;
  }
}

async function handleJoinRoom(client: ClientConnection, roomId: string) {
  client.rooms.add(roomId);
  
  let members = roomMembers.get(roomId);
  if (!members) {
    members = new Set();
    roomMembers.set(roomId, members);
  }
  members.add(client.ws);

  client.ws.send(JSON.stringify({ type: 'joined_room', room_id: roomId }));

  // Joining/opening a room counts as reading it — this was previously only
  // reset client-side (cosmetic), never persisted, so refresh always pulled
  // back the stale, never-reset server-side count.
  await markAllMessagesRead(client.userId, roomId);

  try {
    let targetLoungeId: number | null = null;
    let isDM = false;
    if (roomId.startsWith('dm_')) {
      targetLoungeId = await getOrCreateDMLounge(roomId);
      isDM = true;
    } else {
      const loungeList = await executeWithRetry(() => db.select().from(lounges));
      const targetLounge = loungeList.find(l => l.slug === roomId || l.id.toString() === roomId);
      if (targetLounge) {
        targetLoungeId = targetLounge.id;
        isDM = targetLounge.type === 'dm';
      }
    }

    if (targetLoungeId) {
      const cacheKey = `room:${targetLoungeId}:messages`;
      const redis = await getRedisClient();
      let msgList: any[] = [];
      let isCached = false;
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached && typeof cached === 'string') {
          try {
            msgList = JSON.parse(cached);
            isCached = true;
          } catch (e) {
            console.error('[WS] Failed to parse cached room messages:', e);
          }
        }
      }

      if (!isCached) {
        const rawDbMsgs = await executeWithRetry(() => db.select({
          message_id: dbMessages.id,
          lounge_id: dbMessages.loungeId,
          room_id: dbMessages.loungeId,
          user_id: dbMessages.senderId,
          content: dbMessages.content,
          is_encrypted: dbMessages.encrypted,
          delivered_to: dbMessages.deliveredTo,
          read_by: dbMessages.readBy,
          is_edited: dbMessages.isEdited,
          edited_at: dbMessages.editedAt,
          timestamp: dbMessages.createdAt,
          username: users.username,
          avatar: users.avatarUrl,
        })
        .from(dbMessages)
        .leftJoin(users, eq(dbMessages.senderId, users.id))
        .where(eq(dbMessages.loungeId, targetLoungeId))
        .orderBy(desc(dbMessages.createdAt))
        .limit(100));

        // Fetch reactions for all messages in the batch (N+1 avoidance)
        const messageIds = rawDbMsgs.map(m => m.message_id);
        const reactionsMap: Record<number, Record<string, string[]>> = {};
        if (messageIds.length > 0) {
          const reactionsList = await executeWithRetry(() =>
            db.select({
              messageId: messageReactions.messageId,
              emoji: messageReactions.emoji,
              username: users.username
            })
            .from(messageReactions)
            .innerJoin(users, eq(messageReactions.userId, users.id))
            .where(inArray(messageReactions.messageId, messageIds))
          );
          for (const react of reactionsList) {
            if (!reactionsMap[react.messageId]) {
              reactionsMap[react.messageId] = {};
            }
            if (!reactionsMap[react.messageId][react.emoji]) {
              reactionsMap[react.messageId][react.emoji] = [];
            }
            reactionsMap[react.messageId][react.emoji].push(react.username);
          }
        }

        msgList = rawDbMsgs.map(m => ({
          ...m,
          reactions: reactionsMap[m.message_id] || {}
        }));

        if (redis && msgList.length > 0) {
          await redis.set(cacheKey, JSON.stringify(msgList), { EX: 300 });
        }
      }

      client.ws.send(JSON.stringify({
        type: 'history',
        room_id: roomId,
        messages: msgList.reverse().map(m => {
          const deliveredTo = m.delivered_to ? m.delivered_to.split(',').map(Number).filter(id => !isNaN(id)) : [];
          const readBy = m.read_by ? m.read_by.split(',').map(Number).filter(id => !isNaN(id)) : [];
          let status = 'sent';
          if (isDM) {
            if (m.user_id === client.userId) {
              // Current user is sender - check if receiver has read/delivered
              // For DMs, the receiver is the other user in the conversation
              const receiverId = deliveredTo.find(id => id !== client.userId) || readBy.find(id => id !== client.userId);
              if (receiverId && readBy.includes(receiverId)) {
                status = 'read';
              } else if (receiverId && deliveredTo.includes(receiverId)) {
                status = 'delivered';
              }
            } else {
              // Current user is receiver
              if (readBy.includes(client.userId)) {
                status = 'read';
              } else if (deliveredTo.includes(client.userId)) {
                status = 'delivered';
              }
            }
          }
          
          return {
            ...m,
            message_id: String(m.message_id),
            room_id: roomId,
            lounge_id: targetLoungeId!.toString(),
            is_encrypted: !!m.is_encrypted,
            is_edited: !!m.is_edited,
            edited_at: m.edited_at,
            reactions: m.reactions || {},
            status: isDM ? status : undefined,
            db_message_id: m.message_id
          };
        })
      }));
    }
  } catch (err) {
    console.error('Failed to send room history:', err);
  }
}

function handleLeaveRoom(client: ClientConnection, roomId: string) {
  client.rooms.delete(roomId);
  
  const members = roomMembers.get(roomId);
  if (members) {
    members.delete(client.ws);
    if (members.size === 0) {
      roomMembers.delete(roomId);
    }
  }
}

async function handleMarkRead(client: ClientConnection, message: any) {
  const roomId = message.room_id ? message.room_id.toString() : '';

  // Reset unread counter for this user and room
  await resetUnread(client.userId, roomId);

  try {
    let targetLoungeId: number | null = null;
    let isDM = false;
    if (roomId.startsWith('dm_')) {
      targetLoungeId = await getOrCreateDMLounge(roomId);
      isDM = true;
    } else {
      const loungeList = await executeWithRetry(() => db.select().from(lounges));
      const targetLounge = loungeList.find(l => l.slug === roomId || l.id.toString() === roomId);
      if (targetLounge) {
        targetLoungeId = targetLounge.id;
        isDM = targetLounge.type === 'dm';
      }
    }

    if (targetLoungeId && isDM) {
      const dbMessageId = message.db_message_id ? parseInt(message.db_message_id.toString()) : null;
      if (dbMessageId) {
        const [existingMessage] = await executeWithRetry(() => db.select({
          readBy: dbMessages.readBy
        }).from(dbMessages).where(eq(dbMessages.id, dbMessageId)).limit(1));

        if (existingMessage) {
          const readBy = existingMessage.readBy ? existingMessage.readBy.split(',').map(Number).filter(id => !isNaN(id)) : [];
          if (!readBy.includes(client.userId)) {
            readBy.push(client.userId);
            await executeWithRetry(() => db.update(dbMessages)
              .set({ readBy: readBy.join(',') })
              .where(eq(dbMessages.id, dbMessageId)));
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to mark message as read:', err);
  }

  // Broadcast to others in the room that this message was read
  broadcastToRoom(roomId, {
    type: 'message_read',
    message_id: message.message_id,
    reader_id: client.userId
  }, client.ws);
}

async function handleMarkDelivered(client: ClientConnection, message: any) {
  const roomId = message.room_id ? message.room_id.toString() : '';
  
  try {
    let targetLoungeId: number | null = null;
    let isDM = false;
    if (roomId.startsWith('dm_')) {
      targetLoungeId = await getOrCreateDMLounge(roomId);
      isDM = true;
    } else {
      const loungeList = await executeWithRetry(() => db.select().from(lounges));
      const targetLounge = loungeList.find(l => l.slug === roomId || l.id.toString() === roomId);
      if (targetLounge) {
        targetLoungeId = targetLounge.id;
        isDM = targetLounge.type === 'dm';
      }
    }

    if (targetLoungeId && isDM) {
      const dbMessageId = message.db_message_id ? parseInt(message.db_message_id.toString()) : null;
      if (dbMessageId) {
        const [existingMessage] = await executeWithRetry(() => db.select({
          deliveredTo: dbMessages.deliveredTo
        }).from(dbMessages).where(eq(dbMessages.id, dbMessageId)).limit(1));
        
        if (existingMessage) {
          const deliveredTo = existingMessage.deliveredTo ? existingMessage.deliveredTo.split(',').map(Number).filter(id => !isNaN(id)) : [];
          if (!deliveredTo.includes(client.userId)) {
            deliveredTo.push(client.userId);
            await executeWithRetry(() => db.update(dbMessages)
              .set({ deliveredTo: deliveredTo.join(',') })
              .where(eq(dbMessages.id, dbMessageId)));
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to mark message as delivered:', err);
  }
  
  // Broadcast to others in the room that this message was delivered
  broadcastToRoom(roomId, {
    type: 'message_delivered',
    message_id: message.message_id,
    receiver_id: client.userId
  }, client.ws);
}

async function handleSendMessage(client: ClientConnection, message: any) {
  const roomId = message.room_id ? message.room_id.toString() : '';
  // Relax check for DMs to ensure messages can still be sent
  if (!client.rooms.has(roomId) && !roomId.startsWith('dm_')) {
    console.warn('[WS] User is not in room:', roomId, 'User rooms:', Array.from(client.rooms));
    return;
  }

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const enrichedMessage = {
    ...message,
    message_id: messageId,
    user_id: client.userId,
    username: client.username,
    avatar: client.avatarUrl,
    timestamp: new Date().toISOString()
  };

  try {
    let targetLoungeId: number | null = null;
    let isDM = false;
    if (roomId.startsWith('dm_')) {
      targetLoungeId = await getOrCreateDMLounge(roomId);
      isDM = true;
    } else {
      const loungeList = await executeWithRetry(() => db.select().from(lounges));
      const targetLounge = loungeList.find(l => l.slug === roomId || l.id.toString() === roomId);
      if (targetLounge) {
        targetLoungeId = targetLounge.id;
        isDM = targetLounge.type === 'dm';
      }
    }

    if (targetLoungeId) {
      // Check if receiver is online for DMs
      let deliveredTo: number[] = [];
      if (isDM) {
        const members = roomMembers.get(roomId);
        if (members && members.size > 1) {
          // Receiver is online (other members in room)
          members.forEach(ws => {
            const memberClient = connectedClients.get(ws);
            if (memberClient && memberClient.userId !== client.userId) {
              deliveredTo.push(memberClient.userId);
            }
          });
        }
      }

      const [insertedMessage] = await executeWithRetry(async () => {
        return await db.transaction(async (tx) => {
          const [msg] = await tx.insert(dbMessages).values({
            loungeId: targetLoungeId!,
            senderId: client.userId,
            content: message.content || '',
            encrypted: !!message.is_encrypted,
            deliveredTo: deliveredTo.length > 0 ? deliveredTo.join(',') : ''
          }).returning();
          
          await tx.update(lounges)
            .set({
              lastMessageAt: msg.createdAt,
              lastMessageText: msg.content,
              lastMessageSenderId: msg.senderId,
              updatedAt: msg.createdAt
            })
            .where(eq(lounges.id, targetLoungeId!));
            
          return [msg];
        });
      });

      // Invalidate message history cache
      getRedisClient().then(redis => {
        if (redis) {
          redis.del(`room:${targetLoungeId}:messages`).catch(() => {});
        }
      });

      // Include database ID in message for status tracking
      enrichedMessage.db_message_id = insertedMessage.id;

      if (isDM && targetLoungeId) {
        try {
          const redis = await getRedisClient();
          if (redis) {
            const lastMsgPayload = {
              id: String(insertedMessage.id),
              message_id: String(insertedMessage.id),
              content: insertedMessage.content,
              senderId: insertedMessage.senderId,
              user_id: insertedMessage.senderId,
              is_encrypted: insertedMessage.encrypted,
              deliveredTo: insertedMessage.deliveredTo,
              createdAt: insertedMessage.createdAt?.toISOString() || new Date().toISOString()
            };
            await redis.set(`dm:last_msg:${targetLoungeId}`, JSON.stringify(lastMsgPayload));
          }
        } catch (e) {}
      }

      // Set initial status for message
      if (isDM) {
        if (deliveredTo.length > 0) {
          enrichedMessage.status = 'delivered';
        } else {
          enrichedMessage.status = 'sent';
        }

        // Increment unread counter for recipient
        const parts = roomId.replace('dm_', '').split('_');
        if (parts.length >= 2) {
          const uid1 = parseInt(parts[0], 10);
          const uid2 = parseInt(parts[1], 10);
          const recipientId = client.userId === uid1 ? uid2 : uid1;
          await incrementUnread(recipientId, roomId);
        }
      }

      // Announcements bot broadcast - if message sent to Announcements lounge, broadcast to VELUM bot
      if (roomId.includes('announce') || roomId.includes('ANNOUNCE')) {
        const loungeList = await executeWithRetry(() => db.select().from(lounges));
        const currentLounge = loungeList.find(l => l.id === targetLoungeId);
        if (currentLounge && (currentLounge.accessLevel === 'ANNOUNCE' || currentLounge.name.toLowerCase().includes('announce'))) {
          // Broadcast to VELUM bot (user 999) DMs for all users
          // Decrypt if E2E encrypted for broadcast
          let broadcastContent = message.content || '';
          if (message.is_encrypted) {
            // Simple XOR decryption for broadcast (same key as client encryption)
            const roomIdKey = 'VELUM_E2EE_' + roomId;
            try {
              let decoded = '';
              const cleanCipher = broadcastContent.startsWith('VEL_E2EE[') 
                ? broadcastContent.substring(9, broadcastContent.length - 1) 
                : broadcastContent;
              const cipherBase64 = decodeURIComponent(escape(atob(cleanCipher)));
              for (let i = 0; i < cipherBase64.length; i++) {
                const charCode = cipherBase64.charCodeAt(i) ^ roomIdKey.charCodeAt(i % roomIdKey.length);
                decoded += String.fromCharCode(charCode);
              }
              broadcastContent = decoded;
            } catch (err) {
              console.error('[WS Broadcast] Failed to decrypt message for broadcast:', err);
              broadcastContent = message.content || '';
            }
          }

          const allUsers = await executeWithRetry(() => db.select().from(users));
          for (const user of allUsers) {
            const botDMRoomId = `dm_velum_${user.id}`;
            const botLoungeId = await getOrCreateDMLounge(botDMRoomId);
            if (botLoungeId) {
              await executeWithRetry(() => db.insert(dbMessages).values({
                loungeId: botLoungeId,
                senderId: 999,
                content: broadcastContent,
                encrypted: false,
                deliveredTo: ''
              }));
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to persist WebSocket message:', err);
  }

  broadcastToRoom(roomId, enrichedMessage);

  // If this is a DM, we also need to deliver it to the other user globally
  // so their sidebar can update (if they aren't actively in this DM room).
  if (roomId.startsWith('dm_')) {
    const parts = roomId.replace('dm_', '').split('_');
    if (parts.length >= 2) {
      const uid1 = parseInt(parts[0], 10);
      const uid2 = parseInt(parts[1], 10);
      const targetId = client.userId === uid1 ? uid2 : uid1;
      
      const members = roomMembers.get(roomId);
      for (const c of connectedClients.keys()) {
        const clientData = connectedClients.get(c);
        if (clientData && clientData.userId === targetId && c.readyState === WebSocket.OPEN) {
          // Only send if they aren't already in the room (prevent duplicate)
          if (!members || !members.has(c)) {
            c.send(JSON.stringify(enrichedMessage));
          }
        }
      }
    }
  }
}

function broadcastToRoom(roomId: string, message: any, excludeWs?: WebSocket) {
  const members = roomMembers.get(roomId);
  if (!members) return;

  members.forEach(ws => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
}

export { connectedClients, roomMembers, broadcastToRoom };
