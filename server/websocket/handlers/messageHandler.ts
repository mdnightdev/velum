import { WebSocket } from 'ws';
import type { ClientConnection } from '../types.js';
import { connectedClients, roomMembers, broadcastToRoom, broadcastToUserDevices } from '../connectionManager.js';
import { checkRateLimit } from '../rateLimiter.js';
import {
  getLoungeIdFromRoomId,
  getOrCreateDMLounge,
  resetUnread,
  incrementUnread,
  markAllMessagesRead
} from '../unreadManager.js';
import { db, executeWithRetry } from '../../v2/db/client.js';
import { users, messageReactions } from '../../v2/db/schema/index.js';
import { lounges, messages as dbMessages, loungeMembers } from '../../v2/db/schema/lounges.js';
import { eq, and, gt, sql } from 'drizzle-orm';
import { getRedisClient } from '../../v2/db/redis.js';
import { processReadReceipt } from '../../v2/services/messaging/readReceiptService.js';
import { processDeliveryReceipt } from '../../v2/services/messaging/deliveryReceiptService.js';
import { dispatchPushNotification } from '../../v2/services/notifications/pushGateway.js';
import { typingDebouncer } from '../../v2/services/messaging/typingDebouncer.js';
import { handleJoinRoom, handleLeaveRoom } from './roomHandler.js';

export async function handleAddReaction(client: ClientConnection, message: any) {
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
      await executeWithRetry(() =>
        db.delete(messageReactions)
          .where(eq(messageReactions.id, existing.id))
      );
    } else {
      await executeWithRetry(() =>
        db.insert(messageReactions)
          .values({
            messageId,
            userId: client.userId,
            emoji
          })
      );
    }
    
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
    
    const loungeId = await getLoungeIdFromRoomId(roomId);
    if (loungeId) {
      const redis = await getRedisClient();
      if (redis) {
        await redis.del(`room:${loungeId}:messages`);
      }
    }
    
    broadcastToRoom(roomId, {
      type: 'reaction_update',
      message_id: String(messageId),
      reactions: reactionsMap
    });
  } catch (err) {
    console.error('[WS] Failed to handle add reaction:', err);
  }
}

export async function handleEditMessage(client: ClientConnection, message: any) {
  try {
    const messageId = parseInt(message.message_id, 10);
    const content = message.content;
    const roomId = message.room_id;
    if (isNaN(messageId) || !content || !roomId) return;

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

    const timeDiffMinutes = (Date.now() - new Date(originalMsg.createdAt).getTime()) / (1000 * 60);
    if (timeDiffMinutes > 15) {
      client.ws.send(JSON.stringify({ type: 'error', message: 'Message editing window (15 minutes) has expired.' }));
      return;
    }

    await executeWithRetry(() =>
      db.update(dbMessages)
        .set({
          content,
          isEdited: true,
          editedAt: new Date()
        })
        .where(eq(dbMessages.id, messageId))
    );

    const loungeId = await getLoungeIdFromRoomId(roomId);
    if (loungeId) {
      const redis = await getRedisClient();
      if (redis) {
        await redis.del(`room:${loungeId}:messages`);
      }
    }

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

export async function handleDeleteMessage(client: ClientConnection, message: any) {
  try {
    const messageId = parseInt(message.message_id, 10);
    const roomId = message.room_id;
    if (isNaN(messageId) || !roomId) return;

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
      client.ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized. You can only delete your own messages.' }));
      return;
    }

    await executeWithRetry(() =>
      db.delete(dbMessages)
        .where(eq(dbMessages.id, messageId))
    );

    const loungeId = await getLoungeIdFromRoomId(roomId);
    if (loungeId) {
      const redis = await getRedisClient();
      if (redis) {
        await redis.del(`room:${loungeId}:messages`);
      }
    }

    broadcastToRoom(roomId, {
      type: 'message_deleted',
      message_id: String(messageId),
      room_id: roomId
    });
  } catch (err) {
    console.error('[WS] Failed to delete message:', err);
  }
}

export async function handlePinMessage(client: ClientConnection, message: any) {
  try {
    const messageId = parseInt(message.message_id, 10);
    const roomId = message.room_id;
    const pin = !!message.pin;
    if (isNaN(messageId) || !roomId) return;

    const loungeId = await getLoungeIdFromRoomId(roomId);
    if (!loungeId) return;

    await executeWithRetry(() =>
      db.update(dbMessages)
        .set({ isPinned: pin })
        .where(eq(dbMessages.id, messageId))
    );

    const redis = await getRedisClient();
    if (redis) {
      await redis.del(`room:${loungeId}:messages`);
    }

    broadcastToRoom(roomId, {
      type: 'message_pinned',
      message_id: String(messageId),
      room_id: roomId,
      is_pinned: pin
    });
  } catch (err) {
    console.error('[WS] Failed to pin message:', err);
  }
}

export async function handleSyncRequest(client: ClientConnection, message: any) {
  const roomId = message.room_id ? message.room_id.toString() : '';
  const sinceSeqParam = message.since_seq !== undefined ? message.since_seq : (message.sinceSeq || 0);
  const sinceSeq = typeof sinceSeqParam === 'number' ? sinceSeqParam : parseInt(String(sinceSeqParam || '0'), 10);
  const limit = Math.min(parseInt(String(message.limit || '100'), 10), 500);

  if (!roomId) return;

  try {
    const loungeId = await getLoungeIdFromRoomId(roomId);
    if (!loungeId) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({ type: 'sync_response', room_id: roomId, messages: [], max_seq: 0 }));
      }
      return;
    }

    const [targetLounge] = await executeWithRetry(() =>
      db.select().from(lounges).where(eq(lounges.id, loungeId)).limit(1)
    );

    const syncMsgs = await executeWithRetry(() =>
      db.select({
        id: dbMessages.id,
        loungeId: dbMessages.loungeId,
        senderId: dbMessages.senderId,
        content: dbMessages.content,
        clientMsgId: dbMessages.clientMsgId,
        sequenceId: dbMessages.sequenceId,
        createdAt: dbMessages.createdAt,
        avatar: users.avatarUrl,
        username: users.username,
        deliveredTo: dbMessages.deliveredTo,
        readBy: dbMessages.readBy,
        encrypted: dbMessages.encrypted,
        isEdited: dbMessages.isEdited,
        editedAt: dbMessages.editedAt
      })
      .from(dbMessages)
      .leftJoin(users, eq(dbMessages.senderId, users.id))
      .where(and(eq(dbMessages.loungeId, loungeId), gt(dbMessages.sequenceId, isNaN(sinceSeq) ? 0 : sinceSeq)))
      .orderBy(dbMessages.sequenceId)
      .limit(limit)
    );

    const formattedMessages = syncMsgs.map(m => ({
      message_id: String(m.id),
      db_message_id: m.id,
      room_id: roomId,
      lounge_id: String(loungeId),
      user_id: m.senderId,
      username: m.username || `User_${m.senderId}`,
      avatar: m.avatar || '',
      content: m.content,
      sequence_id: m.sequenceId,
      client_msg_id: m.clientMsgId,
      is_encrypted: !!m.encrypted,
      is_edited: !!m.isEdited,
      edited_at: m.editedAt,
      timestamp: m.createdAt ? m.createdAt.toISOString() : new Date().toISOString()
    }));

    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        type: 'sync_response',
        room_id: roomId,
        messages: formattedMessages,
        max_seq: targetLounge ? targetLounge.currentSequenceId : 0
      }));
    }
  } catch (err) {
    console.error('[WS] Failed to execute sync_request:', err);
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({ type: 'error', message: 'Failed to process sync request' }));
    }
  }
}

export async function handleMarkRead(client: ClientConnection, message: any) {
  const roomId = message.room_id ? message.room_id.toString() : '';

  await resetUnread(client.userId, roomId);

  try {
    const loungeId = await getLoungeIdFromRoomId(roomId);
    if (loungeId) {
      const dbMessageId = message.db_message_id ? parseInt(message.db_message_id.toString(), 10) : message.last_read_msg_id;
      const lastReadSeq = message.last_read_seq ? parseInt(message.last_read_seq.toString(), 10) : undefined;

      if (dbMessageId || lastReadSeq) {
        await processReadReceipt(
          client.userId,
          loungeId,
          dbMessageId || 0,
          lastReadSeq
        );
      }
    }
  } catch (err) {
    console.error('Failed to mark message as read:', err);
  }

  broadcastToRoom(roomId, {
    type: 'message_read',
    message_id: message.message_id || message.db_message_id,
    last_read_msg_id: message.db_message_id || message.last_read_msg_id,
    last_read_seq: message.last_read_seq,
    reader_id: client.userId,
    user_id: client.userId,
    room_id: roomId
  }, client.ws);

  broadcastToUserDevices(client.userId, {
    type: 'multi_device_sync',
    action: 'read_cursor_update',
    room_id: roomId,
    last_read_msg_id: message.db_message_id || message.last_read_msg_id,
    last_read_seq: message.last_read_seq,
    user_id: client.userId
  }, client.ws);
}

export async function handleMarkDelivered(client: ClientConnection, message: any) {
  const roomId = message.room_id ? message.room_id.toString() : '';
  const dbMessageId = message.db_message_id ? parseInt(message.db_message_id.toString(), 10) : parseInt(message.message_id, 10);

  if (!isNaN(dbMessageId)) {
    try {
      await processDeliveryReceipt(dbMessageId, client.userId);
    } catch (err) {
      console.error('Failed to mark message as delivered:', err);
    }
  }
  
  broadcastToRoom(roomId, {
    type: 'message_delivered',
    message_id: message.message_id || dbMessageId,
    db_message_id: dbMessageId,
    receiver_id: client.userId,
    user_id: client.userId,
    room_id: roomId,
    timestamp: new Date().toISOString()
  }, client.ws);
}

export async function handleSendMessage(client: ClientConnection, message: any) {
  const roomId = message.room_id ? message.room_id.toString() : '';
  const loungeId = await getLoungeIdFromRoomId(roomId);
  const clientMsgId = message.client_msg_id || message.nonce || null;
  
  client.rooms.add(roomId);
  if (loungeId) client.rooms.add(String(loungeId));
  let members = roomMembers.get(roomId);
  if (!members) {
    members = new Set();
    roomMembers.set(roomId, members);
  }
  members.add(client.ws);

  let targetLoungeId: number | null = null;
  let isDM = false;
  if (roomId.startsWith('dm_')) {
    targetLoungeId = await getOrCreateDMLounge(roomId);
    isDM = true;
  } else {
    targetLoungeId = loungeId;
    isDM = false;
  }

  if (clientMsgId && targetLoungeId) {
    try {
      const [existing] = await executeWithRetry(() =>
        db.select()
          .from(dbMessages)
          .where(and(eq(dbMessages.senderId, client.userId), eq(dbMessages.clientMsgId, clientMsgId)))
          .limit(1)
      );
      if (existing) {
        const ackPayload = {
          type: 'message_ack',
          client_msg_id: clientMsgId,
          nonce: message.nonce || clientMsgId,
          message_id: String(existing.id),
          db_message_id: existing.id,
          sequence_id: existing.sequenceId,
          room_id: roomId,
          timestamp: existing.createdAt ? existing.createdAt.toISOString() : new Date().toISOString()
        };
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify(ackPayload));
        }
        return;
      }
    } catch (err) {
      console.error('[WS] Idempotency check failed:', err);
    }
  }

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const enrichedMessage = {
    ...message,
    message_id: messageId,
    client_msg_id: clientMsgId,
    user_id: client.userId,
    username: client.username,
    avatar: client.avatarUrl,
    timestamp: new Date().toISOString()
  };

  try {
    if (targetLoungeId) {
      let deliveredTo: number[] = [];
      if (isDM) {
        const roomSockets = roomMembers.get(roomId);
        if (roomSockets && roomSockets.size > 1) {
          roomSockets.forEach(ws => {
            const memberClient = connectedClients.get(ws);
            if (memberClient && memberClient.userId !== client.userId) {
              deliveredTo.push(memberClient.userId);
            }
          });
        }
      }

      const replyToVal = message.reply_to ? parseInt(message.reply_to.toString(), 10) : null;
      const validReplyTo = (replyToVal !== null && !isNaN(replyToVal)) ? replyToVal : null;

      let replyPreview: { username: string; content: string } | null = null;
      if (validReplyTo) {
        try {
          const [repliedMsg] = await executeWithRetry(() =>
            db.select({ content: dbMessages.content, username: users.username })
              .from(dbMessages)
              .leftJoin(users, eq(dbMessages.senderId, users.id))
              .where(eq(dbMessages.id, validReplyTo))
              .limit(1)
          );
          if (repliedMsg) {
            replyPreview = {
              username: repliedMsg.username || 'User',
              content: repliedMsg.content
            };
          }
        } catch (e) {
          console.error('[WS] Failed to fetch reply preview:', e);
        }
      }

      const [insertedMessage] = await executeWithRetry(async () => {
        return await db.transaction(async (tx) => {
          const [updatedLounge] = await tx.update(lounges)
            .set({
              currentSequenceId: sql`${lounges.currentSequenceId} + 1`,
              lastMessageAt: new Date(),
              lastMessageText: message.content || '',
              lastMessageSenderId: client.userId,
              updatedAt: new Date()
            })
            .where(eq(lounges.id, targetLoungeId!))
            .returning({ currentSequenceId: lounges.currentSequenceId });

          const nextSeq = updatedLounge ? updatedLounge.currentSequenceId : 1;

          const [msg] = await tx.insert(dbMessages).values({
            loungeId: targetLoungeId!,
            senderId: client.userId,
            content: message.content || '',
            clientMsgId: clientMsgId,
            sequenceId: nextSeq,
            encrypted: !!message.is_encrypted,
            deliveredTo: deliveredTo.length > 0 ? deliveredTo.join(',') : '',
            replyTo: validReplyTo
          }).returning();
            
          return [msg];
        });
      });

      getRedisClient().then(redis => {
        if (redis) {
          redis.del(`room:${targetLoungeId}:messages`).catch(() => {});
        }
      });

      enrichedMessage.db_message_id = insertedMessage.id;
      enrichedMessage.sequence_id = insertedMessage.sequenceId;
      enrichedMessage.reply_to = validReplyTo;
      enrichedMessage.reply_preview = replyPreview;

      const ackPayload = {
        type: 'message_ack',
        client_msg_id: clientMsgId,
        nonce: message.nonce || clientMsgId,
        message_id: messageId,
        db_message_id: insertedMessage.id,
        sequence_id: insertedMessage.sequenceId,
        room_id: roomId,
        timestamp: insertedMessage.createdAt ? insertedMessage.createdAt.toISOString() : new Date().toISOString()
      };
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(ackPayload));
      }

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

      if (isDM) {
        if (deliveredTo.length > 0) {
          enrichedMessage.status = 'delivered';
        } else {
          enrichedMessage.status = 'sent';
        }

        const parts = roomId.replace('dm_', '').split('_');
        if (parts.length >= 2) {
          const uid1 = parseInt(parts[0], 10);
          const uid2 = parseInt(parts[1], 10);
          const recipientId = client.userId === uid1 ? uid2 : uid1;
          await incrementUnread(recipientId, roomId);
        }
      }

      if (roomId.includes('announce') || roomId.includes('ANNOUNCE')) {
        (async () => {
          const loungeList = await executeWithRetry(() => db.select().from(lounges));
          const currentLounge = loungeList.find(l => l.id === targetLoungeId);
          if (currentLounge && (currentLounge.accessLevel === 'ANNOUNCE' || currentLounge.name.toLowerCase().includes('announce'))) {
            let broadcastContent = message.content || '';
            if (message.is_encrypted) {
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
        })().catch(err => console.error('[WS Broadcast Error]:', err));
      }
    }
  } catch (err) {
    console.error('Failed to persist WebSocket message:', err);
  }

  broadcastToRoom(roomId, enrichedMessage);

  if (client.ws.readyState === WebSocket.OPEN) {
    const roomSockets = roomMembers.get(roomId);
    if (!roomSockets || !roomSockets.has(client.ws)) {
      client.ws.send(JSON.stringify(enrichedMessage));
    }
  }

  if (roomId.startsWith('dm_')) {
    const parts = roomId.replace('dm_', '').split('_');
    if (parts.length >= 2) {
      const uid1 = parseInt(parts[0], 10);
      const uid2 = parseInt(parts[1], 10);
      const targetId = client.userId === uid1 ? uid2 : uid1;
      
      const roomSockets = roomMembers.get(roomId);
      for (const [c, clientData] of connectedClients.entries()) {
        if (clientData && clientData.userId === targetId && c.readyState === WebSocket.OPEN) {
          if (!roomSockets || !roomSockets.has(c)) {
            c.send(JSON.stringify(enrichedMessage));
          }
        }
      }
    }
  }

  (async () => {
    try {
      if (isDM && targetLoungeId) {
        const parts = roomId.replace('dm_', '').split('_');
        if (parts.length >= 2) {
          const uid1 = parseInt(parts[0], 10);
          const uid2 = parseInt(parts[1], 10);
          const recipientId = client.userId === uid1 ? uid2 : uid1;

          await dispatchPushNotification(recipientId, targetLoungeId, {
            title: `Direct Message from @${client.username}`,
            body: message.content ? (message.content.length > 80 ? message.content.slice(0, 80) + '...' : message.content) : 'Sent a message',
            roomId,
            senderId: client.userId
          }, message.content || '');
        }
      } else if (targetLoungeId) {
        const members = await executeWithRetry(() =>
          db.select({ userId: loungeMembers.userId })
            .from(loungeMembers)
            .where(and(eq(loungeMembers.loungeId, targetLoungeId!), eq(loungeMembers.status, 'active')))
        );

        for (const m of members) {
          if (m.userId !== client.userId) {
            await dispatchPushNotification(m.userId, targetLoungeId, {
              title: `#${roomId} - @${client.username}`,
              body: message.content ? (message.content.length > 80 ? message.content.slice(0, 80) + '...' : message.content) : 'Sent a message',
              roomId,
              senderId: client.userId
            }, message.content || '');
          }
        }
      }
    } catch (err) {
      console.error('[WS Push] Notification dispatch error:', err);
    }
  })();
}

export async function handleClientMessage(client: ClientConnection, message: any) {
  getRedisClient().then(redis => {
    if (redis) {
      redis.expire(`user:${client.userId}:active`, 300).catch(() => {});
    }
  });

  switch (message.type) {
    case 'sync_request':
      await handleSyncRequest(client, message);
      break;
    case 'join_room':
      handleJoinRoom(client, message.room_id);
      break;
    case 'leave':
      handleLeaveRoom(client, message.room_id);
      break;
    case 'send_message':
      checkRateLimit(client.userId).then(isAllowed => {
        if (!isAllowed) {
          client.ws.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded: 5 msgs burst, 1 msg/sec sustained.'
          }));
          return;
        }
        handleSendMessage(client, message);
      }).catch(err => {
        console.error('Rate limit error:', err);
        handleSendMessage(client, message);
      });
      break;
    case 'add_reaction':
      handleAddReaction(client, message);
      break;
    case 'edit_message':
      handleEditMessage(client, message);
      break;
    case 'delete_message':
      await handleDeleteMessage(client, message);
      break;
    case 'pin_message':
      await handlePinMessage(client, message);
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
      typingDebouncer.registerTyping(message.room_id, client.userId, client.username);
      message.userId = client.userId;
      message.username = client.username;
      broadcastToRoom(message.room_id, message, client.ws);
      break;
    case 'typing_stop':
      typingDebouncer.clearTyping(message.room_id, client.userId);
      message.userId = client.userId;
      message.username = client.username;
      broadcastToRoom(message.room_id, message, client.ws);
      
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
