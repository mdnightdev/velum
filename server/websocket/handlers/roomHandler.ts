import { WebSocket } from 'ws';
import type { ClientConnection } from '../types.js';
import { roomMembers } from '../connectionManager.js';
import { markAllMessagesRead, getOrCreateDMLounge, getLoungeIdFromRoomId } from '../unreadManager.js';
import { db, executeWithRetry } from '../../v2/db/client.js';
import { lounges, messages as dbMessages } from '../../v2/db/schema/lounges.js';
import { users, messageReactions } from '../../v2/db/schema/index.js';
import { eq, desc, inArray } from 'drizzle-orm';
import { getRedisClient } from '../../v2/db/redis.js';

export async function handleJoinRoom(client: ClientConnection, roomId: string) {
  client.rooms.add(roomId);
  
  let members = roomMembers.get(roomId);
  if (!members) {
    members = new Set();
    roomMembers.set(roomId, members);
  }
  members.add(client.ws);

  client.ws.send(JSON.stringify({ type: 'joined_room', room_id: roomId }));

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
          client_msg_id: dbMessages.clientMsgId,
          sequence_id: dbMessages.sequenceId,
          is_encrypted: dbMessages.encrypted,
          delivered_to: dbMessages.deliveredTo,
          read_by: dbMessages.readBy,
          is_edited: dbMessages.isEdited,
          edited_at: dbMessages.editedAt,
          is_pinned: dbMessages.isPinned,
          reply_to: dbMessages.replyTo,
          timestamp: dbMessages.createdAt,
          username: users.username,
          avatar: users.avatarUrl,
        })
        .from(dbMessages)
        .leftJoin(users, eq(dbMessages.senderId, users.id))
        .where(eq(dbMessages.loungeId, targetLoungeId))
        .orderBy(desc(dbMessages.createdAt))
        .limit(100));

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
              const receiverId = deliveredTo.find(id => id !== client.userId) || readBy.find(id => id !== client.userId);
              if (receiverId && readBy.includes(receiverId)) {
                status = 'read';
              } else if (receiverId && deliveredTo.includes(receiverId)) {
                status = 'delivered';
              }
            } else {
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
            sequence_id: m.sequence_id,
            client_msg_id: m.client_msg_id,
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

export function handleLeaveRoom(client: ClientConnection, roomId: string) {
  client.rooms.delete(roomId);
  
  const members = roomMembers.get(roomId);
  if (members) {
    members.delete(client.ws);
    if (members.size === 0) {
      roomMembers.delete(roomId);
    }
  }
}
