import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { SystemBot } from '../v2/services/systemBot.js';
import { db, executeWithRetry } from '../v2/db/client.js';
import { sessions, users } from '../v2/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { hashSessionToken } from '../v2/middleware/auth.js';
import { getRedisClient } from '../v2/db/redis.js';
import { config } from '../v2/config.js';
import { typingDebouncer } from '../v2/services/messaging/typingDebouncer.js';
import type { ClientConnection } from './types.js';
import {
  connectedClients,
  roomMembers,
  broadcastToRoom,
  broadcastToUserDevices,
  recordServerEventTimestamp,
  incrementReconnectCount,
  getWebSocketDiagnostics
} from './connectionManager.js';
import { handleClientMessage, handleSendMessage } from './handlers/messageHandler.js';
import { getOrCreateDMLounge } from './unreadManager.js';

export { SystemBot };
export {
  connectedClients,
  roomMembers,
  broadcastToRoom,
  broadcastToUserDevices,
  recordServerEventTimestamp,
  incrementReconnectCount,
  getWebSocketDiagnostics,
  getOrCreateDMLounge
};

// Message batching for performance
const messageQueues = new Map<number, any[]>(); // userId -> messages
const batchTimers = new Map<number, NodeJS.Timeout>();

export function startMessageBatching(userId: number, message: any) {
  if (!messageQueues.has(userId)) {
    messageQueues.set(userId, []);
  }
  messageQueues.get(userId)!.push(message);

  if (batchTimers.has(userId)) {
    clearTimeout(batchTimers.get(userId)!);
  }

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

  for (const message of messages) {
    for (const [ws, client] of connectedClients.entries()) {
      if (client.userId === userId) {
        await handleSendMessage(client, message);
        break;
      }
    }
  }
}

export function setupWebSocketServer(httpServer: Server) {
  typingDebouncer.setExpirationCallback((roomId, userId, username) => {
    broadcastToRoom(roomId, {
      type: 'typing_stop',
      room_id: roomId,
      userId,
      username
    });
  });

  const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: 50 * 1024 * 1024 });

  wss.on('connection', async (ws, req) => {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const userId = parseInt(url.searchParams.get('userId') || '0', 10);
      const sessionId = url.searchParams.get('sessionId') || '';

      if (!userId || !sessionId) {
        ws.close(1008, 'Missing userId or sessionId');
        return;
      }

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

      if (sessionResult[0].session.expiresAt && new Date(sessionResult[0].session.expiresAt) < new Date()) {
        ws.close(1008, 'Session expired');
        return;
      }

      const userConns = Array.from(connectedClients.entries())
        .filter(([_, c]) => c.userId === userId);
      if (userConns.length >= 50) {
        const toRemoveCount = userConns.length - 49;
        for (let i = 0; i < toRemoveCount; i++) {
          const [id, conn] = userConns[i];
          try {
            conn.ws.close(1000, 'Session superseded by newer connection');
          } catch (e) {}
          connectedClients.delete(id);
        }
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
        avatarUrl: sessionResult[0].user.avatarUrl || '',
        sessionId,
        rooms: new Set()
      };

      connectedClients.set(ws, client);

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
        const expiredTypers = typingDebouncer.handleUserDisconnect(client.userId);
        for (const exp of expiredTypers) {
          broadcastToRoom(exp.roomId, {
            type: 'typing_stop',
            room_id: exp.roomId,
            userId: client.userId,
            username: exp.username
          });
        }

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

        getRedisClient().then(redis => {
          if (redis) {
            redis.del(`user:${client.userId}:active`).catch(() => {});
          }
        });

        if (batchTimers.has(client.userId)) {
          clearTimeout(batchTimers.get(client.userId)!);
          batchTimers.delete(client.userId);
        }
        messageQueues.delete(client.userId);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      ws.send(JSON.stringify({ type: 'pong', sentAt: Date.now() }));

    } catch (error) {
      console.error('WebSocket connection error:', error);
      ws.close(1011, 'Internal server error');
    }
  });

  return wss;
}
