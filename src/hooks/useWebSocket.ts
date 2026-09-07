import { useEffect, useRef } from 'react';
import { Message } from '../types';
import { encryptMessage, decryptMessage, EncryptionContext } from '../services/encryptionService';
import { statelessE2eeService } from '../services/statelessE2eeService';
import { flushLoungeCache, deleteLocalMessage, purgeDmMessages, getLocalMessages } from '../utils/indexedDb';
import { LocalVaultEncryption } from '../services/localVaultEncryption';
import { enqueueOutboxMessage, removeOutboxMessage, drainOutboxQueue } from '../services/outboxEngine';
import { storage } from '../services/storageService';
import { handleInboundMessageNotification, updateAppBadge, dismissDeliveredNotification } from '../utils/notifications';
import { useChatStore } from '../stores/chatStore';

interface UseWebSocketParams {
  userId: number | null;
  sessionId: string | null;
  isAuthenticated: boolean;
  activeRoomId: string;
  onMessageReceived?: (message: Message) => void;
  onSessionCompromised?: () => void;
}

export function useWebSocket({
  userId,
  sessionId,
  isAuthenticated,
  activeRoomId,
  onMessageReceived,
  onSessionCompromised
}: UseWebSocketParams) {
  const messages = useChatStore((state) => state.messages);
  const setMessages = useChatStore((state) => state.setMessages);
  const appendMessage = useChatStore((state) => state.appendMessage);
  const mergeMessages = useChatStore((state) => state.mergeMessages);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const removeMessage = useChatStore((state) => state.removeMessage);
  const clearRoomMessages = useChatStore((state) => state.clearRoomMessages);
  const lastMessages = useChatStore((state) => state.lastMessages);
  const setLastMessage = useChatStore((state) => state.setLastMessage);
  const setLastMessages = useChatStore((state) => state.setLastMessages);
  const unreadCounts = useChatStore((state) => state.unreadCounts);
  const setUnreadCount = useChatStore((state) => state.setUnreadCount);
  const setUnreadCounts = useChatStore((state) => state.setUnreadCounts);
  const wsConnected = useChatStore((state) => state.wsConnected);
  const setWsConnected = useChatStore((state) => state.setWsConnected);

  const roomMaxSeqRef = useRef<Map<string, number>>(new Map());

  // Background Periodic Key Rotation for Message History Forward Secrecy
  useEffect(() => {
    if (!isAuthenticated) return;
    
    let isMounted = true;
    const runRotationCheck = async () => {
      try {
        const needsRotation = await LocalVaultEncryption.checkAndRotatePeriodically();
        if (needsRotation && isMounted) {
          console.log('[useWebSocket] Triggering periodic message history key rotation...');
          await LocalVaultEncryption.rotateVaultKey();
        }
      } catch (err) {
        console.error('[useWebSocket] Rotation check failed:', err);
      }
    };

    runRotationCheck();
  }, [isAuthenticated]);

  // Delta synchronization when switching rooms or reconnecting
  useEffect(() => {
    if (!activeRoomId) return;

    let isCurrentRoom = true;

    // Immediately hydrate local cached messages with existing plaintexts for instant render
    getLocalMessages(activeRoomId, 100, userId || 0).then((localMsgs) => {
      if (localMsgs && localMsgs.length > 0 && isCurrentRoom) {
        mergeMessages(localMsgs);
      }
    }).catch(() => {});

    const syncRoom = async () => {
      const sessionToken = storage.getItem('velum-sessionId') || '';
      
      try {
        const isDm = activeRoomId.startsWith('dm_') && !activeRoomId.startsWith('dm_velum_');
        let url = `/v2/lounges/${activeRoomId}/messages`;
        if (isDm) {
          const parts = activeRoomId.replace('dm_', '').split('_');
          const peerId = parts.length === 2
            ? (Number(parts[0]) === userId ? parts[1] : parts[0])
            : parts[0];
          url = `/v2/dm/${peerId}`;
        }

        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'x-session-id': sessionToken,
            'x-session-token': sessionToken
          }
        });
        const data = await res.json();

        if (data.messages && Array.isArray(data.messages) && isCurrentRoom) {
          const normalized: Message[] = isDm ? data.messages.map((d: any) => ({
            id: d.id,
            message_id: String(d.id),
            db_message_id: d.id,
            room_id: activeRoomId,
            lounge_id: activeRoomId,
            user_id: d.sender,
            username: d.sender === userId ? 'You' : `User #${d.sender}`,
            content: d.body,
            sequence_id: d.id,
            is_encrypted: !!d.encrypted,
            reply_to: d.replyTo || null,
            timestamp: d.created,
            status: d.readAt ? 'read' : (d.deliveredAt ? 'delivered' : 'sent')
          })) : data.messages;

          let maxSeq = roomMaxSeqRef.current.get(activeRoomId) || 0;
          normalized.forEach((m: any) => {
            const seq = m.sequence_id || (typeof m.id === 'number' ? m.id : 0);
            if (seq > maxSeq) maxSeq = seq;
          });
          if (maxSeq > 0) {
            roomMaxSeqRef.current.set(activeRoomId, maxSeq);
          }

          mergeMessages(normalized);
        }
      } catch (err) {
        console.warn('[Sync] Failed to sync messages:', err);
      }
    };

    const highestSeq = roomMaxSeqRef.current.get(activeRoomId) || 0;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && highestSeq > 0) {
      wsRef.current.send(JSON.stringify({
        type: 'sync',
        room_id: activeRoomId,
        since_seq: highestSeq
      }));
    } else {
      syncRoom();
    }

    return () => {
      isCurrentRoom = false;
    };
  }, [activeRoomId, userId]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const activeRoomIdRef = useRef(activeRoomId);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const reconnectTimeoutRef = useRef<any>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  const fetchConversationsSummary = async () => {
    try {
      const sessionToken = storage.getItem('velum-sessionId');
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['x-session-token'] = sessionToken;
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      const res = await fetch('/v2/lounges/conversations/summary', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.summary) {
          setLastMessages(prev => ({ ...prev, ...data.summary }));
        }
        if (data.unreadCounts) {
          setUnreadCounts(prev => ({ ...prev, ...data.unreadCounts }));
        }
      }
    } catch (err) {
      // Silently handle transient network fetch errors during initialization
    }

    // Fetch Redis-based unread counts
    try {
      const sessionToken = storage.getItem('velum-sessionId');
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['x-session-token'] = sessionToken;
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      const res = await fetch('/v2/user/unread-counts', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.unreadCounts) {
          setUnreadCounts(prev => ({ ...prev, ...data.unreadCounts }));
        }
      }
    } catch (err) {
      // Silently handle transient network fetch errors during initialization
    }
  };

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // Silent background revalidation on visibility change and network online events
  useEffect(() => {
    if (!userId || !isAuthenticated) return;

    const handleSilentRevalidate = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED || wsRef.current.readyState === WebSocket.CLOSING) {
          connectWebSocket(userId);
        } else if (wsRef.current.readyState === WebSocket.OPEN) {
          const currentRoom = activeRoomIdRef.current;
          if (currentRoom) {
            const highestSeq = roomMaxSeqRef.current.get(currentRoom) || 0;
            if (highestSeq > 0) {
              wsRef.current.send(JSON.stringify({
                type: 'sync',
                room_id: currentRoom,
                since_seq: highestSeq
              }));
            }
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleSilentRevalidate);
    window.addEventListener('online', handleSilentRevalidate);

    return () => {
      document.removeEventListener('visibilitychange', handleSilentRevalidate);
      window.removeEventListener('online', handleSilentRevalidate);
    };
  }, [userId, isAuthenticated]);

  const connectWebSocket = (uid: number) => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      const oldWs = wsRef.current;
      oldWs.onclose = null;
      oldWs.onerror = null;
      oldWs.close();
    }

    let host = window.location.host;
    const isCapacitorOrLocalApk =
      (window as any).Capacitor?.isNativePlatform?.() ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:' ||
      !host ||
      host === 'localhost' ||
      (window.location.hostname === 'localhost' && window.location.port !== '3000' && window.location.port !== '5173');

    if (isCapacitorOrLocalApk) {
      host = '127.0.0.1:3000';
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const currentSessionId = storage.getItem('velum-sessionId') || storage.getItem('velum_sessionId') || sessionId;
    const wsUrl = `${protocol}//${host}/ws?userId=${uid}&sessionId=${encodeURIComponent(currentSessionId || '')}`;

    console.log('Connecting socket: ', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    let pingInterval: any = null;

    ws.onopen = () => {
      console.log('Central Socket Live.');
      setWsConnected(true);
      reconnectAttemptsRef.current = 0;
      if (window.velumDebug) {
        window.velumDebug.wsConnected = true;
      }
      
      ws.send(JSON.stringify({ type: 'join_room', room_id: `dm_velum_${uid}` }));
      
      if (activeRoomIdRef.current) {
        ws.send(JSON.stringify({ type: 'join_room', room_id: activeRoomIdRef.current }));
        const highestSeq = roomMaxSeqRef.current.get(activeRoomIdRef.current) || 0;
        if (highestSeq > 0) {
          ws.send(JSON.stringify({
            type: 'sync',
            room_id: activeRoomIdRef.current,
            since_seq: highestSeq
          }));
        }
      }

      // Automatically drain persistent IndexedDB outbox queue upon socket restoration
      drainOutboxQueue(
        (item) => {
          if (ws.readyState === WebSocket.OPEN) {
            const isDm = item.room_id.startsWith('dm_') && !item.room_id.startsWith('dm_velum_');
            if (isDm) {
              const peerId = parseInt(item.room_id.replace('dm_', ''), 10);
              if (!isNaN(peerId)) {
                ws.send(JSON.stringify({
                  type: 'dm',
                  to: peerId,
                  body: item.content,
                  enc: item.is_encrypted,
                  reply_to: item.reply_to || null,
                  client_msg_id: item.client_msg_id
                }));
                return true;
              }
            }
            ws.send(JSON.stringify({
              type: 'send_message',
              room_id: item.room_id,
              content: item.content,
              is_encrypted: item.is_encrypted,
              expires_in: item.expires_in,
              reply_to: item.reply_to,
              client_msg_id: item.client_msg_id,
              nonce: item.client_msg_id
            }));
            return true;
          }
          return false;
        },
        userId || undefined,
        (failedClientId) => {
          updateMessage(
            (m) => Boolean(m.client_msg_id === failedClientId || String(m.id) === failedClientId || m.nonce === failedClientId),
            (m) => ({ ...m, status: 'failed' })
          );
        }
      );

      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', sentAt: Date.now() }));
        }
      }, 15000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (window.velumDebug) {
          window.velumDebug.lastMessageTimestamp = new Date().toISOString();
        }

        if (data.type === 'pong') {
          const rtt = Date.now() - parseInt(data.sentAt, 10);
          if (window.velumDebug) {
            const currentPing = window.velumDebug.averagePing ?? 0;
            window.velumDebug.averagePing = currentPing === 0
              ? rtt
              : Math.round((currentPing * 0.8) + (rtt * 0.2));
          }
          return;
        }

        if (data.type === 'multi_device_sync') {
          if (data.action === 'read_cursor_update' || data.action === 'mark_all_read') {
            if (data.room_id) {
              setUnreadCount(data.room_id, 0);
              if (data.action === 'read_cursor_update' && data.last_read_seq && data.room_id === activeRoomIdRef.current) {
                updateMessage(
                  (m) => Boolean(m.sequence_id && m.sequence_id <= data.last_read_seq),
                  (m) => ({ ...m, status: 'read' })
                );
              }
            }
          }
          return;
        }

        if (data.type === 'broadcast') {
          const broadcastId = `broadcast_${Date.now()}`;
          const broadcastMsg: Message = {
            id: broadcastId,
            message_id: broadcastId,
            lounge_id: 'system',
            room_id: activeRoomIdRef.current,
            user_id: 999,
            username: 'System Broadcast',
            content: `[Broadcast from ${data.sender}]: ${data.message}`,
            is_encrypted: false,
            reply_to: null,
            timestamp: new Date().toISOString(),
            expires_in: null
          };
          appendMessage(broadcastMsg);
          return;
        }
        
        if (data.type === 'system_alert') {
          if (!data.room_id || data.room_id === activeRoomIdRef.current) {
            const sysId = `sys_${Date.now()}`;
            const systemMsg: Message = {
              id: sysId,
              message_id: sysId,
              lounge_id: 'system',
              room_id: data.room_id || activeRoomIdRef.current,
              user_id: 0,
              username: 'System Alert',
              content: data.message,
              is_encrypted: false,
              reply_to: null,
              timestamp: new Date().toISOString(),
              expires_in: null
            };
            appendMessage(systemMsg);
          }
        } else if (data.type === 'kicked_alert') {
          alert('You have been kicked from this room.');
        } else if (data.type === 'banned_alert') {
          alert(`Account suspended. Reason: ${data.reason}`);
        } else if (data.type === 'compromised_alert' || data.type === 'panic_triggered') {
          alert('Your session has ended. Please log in again.');
          if (onSessionCompromised) {
            onSessionCompromised();
          }
        } else if (data.type === 'presence_update') {
          window.dispatchEvent(new CustomEvent('velum-presence-change'));
        } else if (data.type === 'typing_start') {
          window.dispatchEvent(new CustomEvent('velum-typing-start', { detail: data }));
        } else if (data.type === 'typing_stop') {
          window.dispatchEvent(new CustomEvent('velum-typing-stop', { detail: data }));
        } else if (data.type === 'error') {
          if (data.message && (
            data.message.includes('WebSocket closed without opened') || 
            data.message.includes('closed without opened')
          )) {
            console.warn('Suppressed socket connection payload alert:', data.message);
          } else {
            alert(`Error: ${data.message}`);
          }
        } else if (data.type === 'message_ack' || data.type === 'dm_ack') {
          const ackClientId = data.client_msg_id || data.nonce;
          if (ackClientId) {
            removeOutboxMessage(String(ackClientId), userId || undefined);
          }
          const canonicalId = data.id || data.db_message_id || data.message_id;
          if (data.room_id) {
            const seq = data.sequence_id || (typeof canonicalId === 'number' ? canonicalId : 0);
            if (seq) {
              const cur = roomMaxSeqRef.current.get(data.room_id) || 0;
              if (seq > cur) roomMaxSeqRef.current.set(data.room_id, seq);
            }
          }
          updateMessage(
            (m) => Boolean(ackClientId && (m.client_msg_id === ackClientId || String(m.id) === String(ackClientId) || m.message_id === ackClientId || m.nonce === ackClientId)),
            (m) => ({
              ...m,
              id: canonicalId || m.id,
              message_id: String(canonicalId || m.id),
              db_message_id: typeof canonicalId === 'number' ? canonicalId : m.db_message_id,
              sequence_id: data.sequence_id ?? m.sequence_id,
              client_msg_id: ackClientId,
              status: 'sent'
            })
          );
        } else if (data.type === 'dm') {
          const isFromMe = uid && String(data.from) === String(uid);
          const peerId = isFromMe ? data.to : data.from;
          const dmRoomId = `dm_${peerId}`;
          const canonicalId = data.id || data.db_message_id || data.message_id;
          const clientMsgId = data.client_msg_id || data.nonce;
          if (dmRoomId) {
            const seq = typeof canonicalId === 'number' ? canonicalId : 0;
            if (seq) {
              const cur = roomMaxSeqRef.current.get(dmRoomId) || 0;
              if (seq > cur) roomMaxSeqRef.current.set(dmRoomId, seq);
            }
          }
          const dmMsg: Message = {
            id: canonicalId,
            client_msg_id: clientMsgId,
            message_id: String(canonicalId),
            db_message_id: typeof canonicalId === 'number' ? canonicalId : undefined,
            room_id: dmRoomId,
            lounge_id: dmRoomId,
            user_id: data.from,
            username: data.sender_username || (isFromMe ? 'You' : `User #${data.from}`),
            content: data.body,
            is_encrypted: !!data.enc,
            reply_to: data.reply_to || null,
            timestamp: data.created,
            status: 'sent'
          };

          if (!isFromMe) {
            const senderName = (data.sender_username || dmMsg.username || `User #${data.from}`).replace(/^@/, '');
            
            const notifyDm = (bodyText: string) => {
              handleInboundMessageNotification({
                senderName,
                content: bodyText,
                isFromMe: false,
                roomId: dmRoomId,
                activeRoomId: activeRoomIdRef.current,
                timestamp: data.created ? new Date(data.created).getTime() : Date.now()
              });
            };

            if (dmMsg.is_encrypted || (dmMsg.content && (dmMsg.content.startsWith('e2ee:') || dmMsg.content.startsWith('VEL_E2EE[')))) {
              decryptMessage(dmMsg.content, { type: 'direct', peerUserId: data.from })
                .then(notifyDm)
                .catch(() => notifyDm('Sent a message'));
            } else {
              notifyDm(dmMsg.content);
            }

            if (dmRoomId !== activeRoomIdRef.current) {
              setUnreadCounts(prev => ({
                ...prev,
                [dmRoomId]: (prev[dmRoomId] || 0) + 1
              }));
            }
          }

          setLastMessage(dmRoomId, dmMsg);
          appendMessage(dmMsg);
          window.dispatchEvent(new CustomEvent('velum-dm-received', { detail: dmMsg }));
        } else if (data.type === 'sync_response') {
          if (data.room_id === activeRoomIdRef.current && Array.isArray(data.messages)) {
            const newMsgs = data.messages;
            if (newMsgs.length > 0) {
              mergeMessages(newMsgs);
            }
            if (data.max_seq) {
              const currentMax = roomMaxSeqRef.current.get(data.room_id) || 0;
              if (data.max_seq > currentMax) {
                roomMaxSeqRef.current.set(data.room_id, data.max_seq);
              }
            }
          }
        } else if (data.type === 'reaction_update') {
          updateMessage(
            (m) => String(m.message_id) === String(data.message_id) || String(m.db_message_id) === String(data.message_id) || String(m.id) === String(data.message_id),
            (m) => ({ ...m, reactions: data.reactions })
          );
        } else if (data.type === 'message_edit') {
          updateMessage(
            (m) => String(m.message_id) === String(data.message_id) || String(m.db_message_id) === String(data.message_id) || String(m.id) === String(data.message_id),
            (m) => ({
              ...m,
              content: data.content,
              is_edited: true,
              edited_at: data.edited_at
            })
          );
        } else if (data.type === 'message_deleted') {
          const targetId = String(data.message_id);
          removeMessage(targetId);
          deleteLocalMessage(targetId, userId || undefined);
          removeOutboxMessage(targetId, userId || undefined);
          if (data.room_id) {
            setLastMessages(prev => {
              const current = prev[data.room_id];
              if (current && (String(current.id) === targetId || String(current.message_id) === targetId || String(current.db_message_id) === targetId || String(current.client_msg_id) === targetId)) {
                const next = { ...prev };
                delete next[data.room_id];
                return next;
              }
              return prev;
            });
          }
        } else if (data.type === 'message_pinned') {
          updateMessage(
            (m) => String(m.message_id) === String(data.message_id) || String(m.db_message_id) === String(data.message_id) || String(m.id) === String(data.message_id),
            (m) => ({ ...m, is_pinned: !!data.is_pinned })
          );
        } else if (data.type === 'message_read') {
          const readerId = data.reader_id || data.user_id;
          const lastReadSeq = data.last_read_seq;
          const targetMsgId = data.last_read_msg_id || data.message_id;

          updateMessage(
            (m) => {
              if (lastReadSeq && m.sequence_id) return m.sequence_id <= lastReadSeq;
              if (targetMsgId) return String(m.message_id) === String(targetMsgId) || String(m.id) === String(targetMsgId) || String(m.db_message_id) === String(targetMsgId);
              return false;
            },
            (m) => {
              const currentReadBy = typeof m.read_by === 'string' ? m.read_by.split(',') : (Array.isArray(m.read_by) ? m.read_by : []);
              if (readerId && !currentReadBy.map(String).includes(String(readerId))) {
                currentReadBy.push(String(readerId));
              }
              return {
                ...m,
                read_by: currentReadBy.join(','),
                status: 'read' as 'sent' | 'delivered' | 'read'
              };
            }
          );
        } else if (data.type === 'message_delivered') {
          const receiverId = data.receiver_id || data.user_id;
          updateMessage(
            (m) => Boolean(String(m.message_id) === String(data.message_id) || String(m.db_message_id) === String(data.message_id) || String(m.id) === String(data.message_id)),
            (m) => {
              const currentDel = typeof m.delivered_to === 'string' ? m.delivered_to.split(',') : (Array.isArray(m.delivered_to) ? m.delivered_to : []);
              if (receiverId && !currentDel.map(String).includes(String(receiverId))) {
                currentDel.push(String(receiverId));
              }
              return {
                ...m,
                delivered_to: currentDel.join(','),
                status: m.status === 'read' ? 'read' : ('delivered' as 'sent' | 'delivered' | 'read')
              };
            }
          );
        } else if (data.type === 'lounge_cleaned' || data.type === 'room_cleared' || data.type === 'chat_cleared') {
          const targetRoom = data.roomId || data.room_id || data.loungeId;
          if (targetRoom) {
            clearRoomMessages(targetRoom);
            flushLoungeCache(targetRoom, userId || undefined);
            if (targetRoom.startsWith('dm_') && !targetRoom.startsWith('dm_velum_')) {
              const parts = targetRoom.replace('dm_', '').split('_');
              const peerId = parts.length === 2
                ? (Number(parts[0]) === userId ? Number(parts[1]) : Number(parts[0]))
                : Number(parts[0]);
              if (!isNaN(peerId) && peerId > 0) {
                purgeDmMessages(peerId, userId || undefined);
              }
            }
            setLastMessages(prev => {
              const next = { ...prev };
              delete next[targetRoom];
              return next;
            });
          }
        } else if (data.type === 'history') {
          const historyMessages: Message[] = data.messages || [];
          if (data.room_id === activeRoomIdRef.current && historyMessages.length > 0) {
            mergeMessages(historyMessages);
          }
          if (data.messages && data.messages.length > 0 && data.room_id) {
            const latest = data.messages[data.messages.length - 1];
            setLastMessage(data.room_id, latest);
          }
        } else if (data.type === 'friend_request_received' || data.type === 'friend_request_accepted' || data.type === 'friend_request_rejected' || data.type === 'friend_request_sent') {
          window.dispatchEvent(new CustomEvent('velum-social-update', { detail: data }));
          if (data.type === 'friend_request_received') {
            handleInboundMessageNotification({
              senderName: data.sender_name || 'Contact',
              content: 'Sent you a friend request',
              isFromMe: false,
              roomId: 'notifications',
              activeRoomId: activeRoomIdRef.current
            });
          }
        } else if (data.type === 'wallet_updated') {
          window.dispatchEvent(new CustomEvent('velum-wallet-update', { detail: data }));
        } else if (data.type === 'notification_received') {
          window.dispatchEvent(new CustomEvent('velum-notifications-update', { detail: data }));
        } else if (data.type === 'user_profile_updated') {
          window.dispatchEvent(new CustomEvent('velum-profile-update', { detail: data }));
        } else {
          window.dispatchEvent(new CustomEvent('velum-message-received', { detail: data }));
          
          const rawAckId = data.client_msg_id || data.nonce;
          if (rawAckId) {
            removeOutboxMessage(String(rawAckId), userId || undefined);
          }

          if (data.room_id) {
            const canonicalId = data.id || data.db_message_id || data.message_id;
            const seq = data.sequence_id || (typeof canonicalId === 'number' ? canonicalId : 0);
            if (seq) {
              const cur = roomMaxSeqRef.current.get(data.room_id) || 0;
              if (seq > cur) roomMaxSeqRef.current.set(data.room_id, seq);
            }
            const newMessage = data as Message;
            const isFromMe = Boolean(uid && String(newMessage.user_id) === String(uid));

            if (!isFromMe && newMessage.user_id) {
              const senderDisplayName = (newMessage.username || (newMessage as any).sender_name || 'Velum').replace(/^@/, '');
              const rawContent = newMessage.plaintext || newMessage.content || '';
              
              const notifyLounge = (bodyText: string) => {
                handleInboundMessageNotification({
                  senderName: `#${data.room_id}`,
                  content: senderDisplayName ? `${senderDisplayName}: ${bodyText}` : bodyText,
                  isFromMe: false,
                  roomId: data.room_id,
                  activeRoomId: activeRoomIdRef.current,
                  timestamp: newMessage.timestamp ? new Date(newMessage.timestamp).getTime() : Date.now()
                });
              };

              if (rawContent && (rawContent.startsWith('VEL_E2EE[') || rawContent.startsWith('e2ee:'))) {
                decryptMessage(rawContent, { type: 'lounge', roomId: data.room_id })
                  .then(notifyLounge)
                  .catch(() => notifyLounge('Sent a message'));
              } else {
                notifyLounge(rawContent);
              }
            }

            // Increment unread counter for incoming messages not in active room
            if (!isFromMe && data.room_id !== activeRoomIdRef.current) {
              setUnreadCounts(prev => ({
                ...prev,
                [data.room_id]: (prev[data.room_id] || 0) + 1
              }));
            }

            setLastMessage(data.room_id, newMessage);
          }

          if (data.room_id === activeRoomIdRef.current) {
            const canonicalId = data.id || data.db_message_id || data.message_id;
            const clientMsgId = data.client_msg_id || data.nonce;
            const newMessage: Message = {
              ...data,
              id: canonicalId,
              client_msg_id: clientMsgId,
              message_id: String(canonicalId),
              db_message_id: typeof canonicalId === 'number' ? canonicalId : data.db_message_id
            };

            appendMessage(newMessage);

            if (onMessageReceived) {
              onMessageReceived(newMessage);
            }
            // Automatically mark as delivered when received (DMs only)
            if (newMessage.id && newMessage.user_id !== uid && newMessage.room_id?.startsWith('dm_')) {
              markDelivered(String(newMessage.id), newMessage.room_id);
            }
          }
        }
      } catch (err) {
        console.error('WebSocket parse error', err);
      }
    };

    const handleCloseOrError = () => {
      setWsConnected(false);
      if (window.velumDebug) {
        window.velumDebug.wsConnected = false;
      }
      if (pingInterval) clearInterval(pingInterval);

      if (isAuthenticatedRef.current) {
        reconnectAttemptsRef.current += 1;
        if (window.velumDebug) {
          window.velumDebug.reconnectCount = reconnectAttemptsRef.current;
        }
        // Full random jitter backoff: t = min(max_backoff, base * 1.5^attempt + jitter)
        const base = 1000;
        const max = 15000;
        const jitter = Math.random() * 1000;
        const delay = Math.min(max, base * Math.pow(1.5, reconnectAttemptsRef.current) + jitter);

        console.log(`Socket closed or errored. Reconnecting in ${Math.round(delay)}ms... (Attempt ${reconnectAttemptsRef.current}, jitter: ${Math.round(jitter)}ms)`);
        
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket(uid);
        }, delay);
      }
    };

    ws.onclose = (event) => {
      console.log('Socket closed. Code: ', event.code, 'Reason: ', event.reason);
      handleCloseOrError();
    };

    ws.onerror = () => {
      console.log('Socket error.');
      handleCloseOrError();
    };
  };

  const sendMessage = async (text: string, burnSeconds: number | null, isEncrypted: boolean, targetRoomId?: string, replyTo?: string | number, clientPlaintext?: string) => {
    const destRoomId = targetRoomId || activeRoomId;
    const isDm = destRoomId.startsWith('dm_') && !destRoomId.startsWith('dm_velum_');
    const isAlreadyEncrypted = text.startsWith('e2ee:') || text.startsWith('ratchet:v2:') || text.startsWith('ratchet:v1:') || text.startsWith('VEL_E2EE[');
    let finalContent = text;
    let shouldEncrypt = isEncrypted;

    if (isDm) {
      const peerId = parseInt(destRoomId.replace('dm_', ''), 10);
      if (!isAlreadyEncrypted && !isNaN(peerId)) {
        try {
          finalContent = await statelessE2eeService.encryptDirectMessage(text, peerId);
          shouldEncrypt = true;
        } catch (err) {
          console.error('[WS Send DM] Encryption failed, sending plaintext fallback:', err);
          finalContent = text;
          shouldEncrypt = false;
        }
      }
    } else {
      const isOfficialChannel = [
        'general',
        'off-topic',
        'announcements',
        'resources',
        'introduce-yourself',
        'events',
        'media',
        'voice-room',
        'support',
        'feedback'
      ].includes(destRoomId);
      shouldEncrypt = isAlreadyEncrypted || isEncrypted || !isOfficialChannel;
      if (!isAlreadyEncrypted && shouldEncrypt) {
        const context: EncryptionContext = { type: 'lounge', roomId: destRoomId, isEncrypted: shouldEncrypt };
        finalContent = await encryptMessage(text, context);
      }
    }
    
    const clientMsgId = crypto.randomUUID();
    const optMessage: Message = {
      id: clientMsgId,
      client_msg_id: clientMsgId,
      message_id: clientMsgId,
      nonce: clientMsgId,
      room_id: destRoomId,
      user_id: userId || 0,
      username: 'You',
      content: finalContent,
      plaintext: clientPlaintext || text,
      is_encrypted: shouldEncrypt,
      status: 'sending',
      reply_to: replyTo ? String(replyTo) : null,
      timestamp: new Date().toISOString()
    };
    
    const isDirectMatch = destRoomId === activeRoomId;
    let isDmMatch = false;
    let dmPeerId: number | undefined = undefined;
    if (isDm) {
      dmPeerId = parseInt(destRoomId.replace('dm_', ''), 10);
      if (!isNaN(dmPeerId) && userId) {
        const pairwiseRoom = `dm_${Math.min(userId, dmPeerId)}_${Math.max(userId, dmPeerId)}`;
        isDmMatch = activeRoomId === destRoomId || activeRoomId === pairwiseRoom;
      }
    }

    if (isDirectMatch || isDmMatch) {
      appendMessage({ ...optMessage, to: dmPeerId } as any);
    }

    setLastMessage(destRoomId, optMessage);
    if (isDm && dmPeerId && userId) {
      const pairwise = `dm_${Math.min(userId, dmPeerId)}_${Math.max(userId, dmPeerId)}`;
      setLastMessage(pairwise, optMessage);
      setLastMessage(`dm_${dmPeerId}`, optMessage);
    }

    const outboxPayload = {
      client_msg_id: clientMsgId,
      room_id: destRoomId,
      content: finalContent,
      is_encrypted: shouldEncrypt,
      expires_in: burnSeconds,
      reply_to: replyTo ? String(replyTo) : null,
      timestamp: optMessage.timestamp,
      retryCount: 0
    };

    // Enqueue in IndexedDB outbox queue
    await enqueueOutboxMessage(outboxPayload, userId || undefined);

    // If socket is open, send frame immediately
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (isDm) {
        const peerId = parseInt(destRoomId.replace('dm_', ''), 10);
        wsRef.current.send(JSON.stringify({
          type: 'dm',
          to: peerId,
          body: finalContent,
          enc: shouldEncrypt,
          reply_to: replyTo || null,
          client_msg_id: clientMsgId
        }));
      } else {
        wsRef.current.send(JSON.stringify({
          type: 'send_message',
          room_id: destRoomId,
          content: finalContent,
          is_encrypted: shouldEncrypt,
          expires_in: burnSeconds,
          reply_to: replyTo || null,
          client_msg_id: clientMsgId,
          nonce: clientMsgId
        }));
      }
    }
    
    // Add a timeout to transition 'sending' to 'failed' if no ACK after 10s
    setTimeout(() => {
      updateMessage(
        (m) => Boolean((m.client_msg_id === clientMsgId || String(m.id) === clientMsgId) && m.status === 'sending'),
        (m) => ({ ...m, status: 'failed' })
      );
    }, 10000);
  };

  const retryMessage = async (clientMsgId: string) => {
    let targetMsg: Message | undefined;
    updateMessage(
      (m) => {
        const matches = Boolean(
          (m.client_msg_id && m.client_msg_id === clientMsgId) ||
          (m.nonce && m.nonce === clientMsgId) ||
          (m.message_id && m.message_id === clientMsgId) ||
          (m.id && String(m.id) === clientMsgId)
        );
        if (matches) {
          targetMsg = m;
        }
        return matches;
      },
      (m) => ({ ...m, status: 'sending' })
    );

    if (!targetMsg) return;

    const destRoomId = (targetMsg as Message).room_id || activeRoomId;
    const finalContent = (targetMsg as Message).content;
    const shouldEncrypt = !!((targetMsg as Message).is_encrypted || (targetMsg as any).isEncrypted);
    const nonce = (targetMsg as Message).client_msg_id || (targetMsg as Message).nonce || clientMsgId;
    const rawExpires = (targetMsg as Message).expires_in;
    const expiresIn: number | null = rawExpires ? Number(rawExpires) : null;

    // Re-enqueue in outbox for reliable delivery
    await enqueueOutboxMessage({
      client_msg_id: nonce,
      room_id: destRoomId,
      content: finalContent,
      is_encrypted: shouldEncrypt,
      expires_in: expiresIn,
      reply_to: (targetMsg as Message).reply_to || null,
      timestamp: (targetMsg as Message).timestamp || new Date().toISOString(),
      retryCount: 0
    }, userId || undefined);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const isDm = destRoomId.startsWith('dm_') && !destRoomId.startsWith('dm_velum_');
      if (isDm) {
        const peerId = parseInt(destRoomId.replace('dm_', ''), 10);
        if (!isNaN(peerId)) {
          wsRef.current.send(JSON.stringify({
            type: 'dm',
            to: peerId,
            body: finalContent,
            enc: shouldEncrypt,
            reply_to: (targetMsg as Message).reply_to || null,
            client_msg_id: nonce
          }));
        }
      } else {
        wsRef.current.send(JSON.stringify({
          type: 'send_message',
          room_id: destRoomId,
          content: finalContent,
          is_encrypted: shouldEncrypt,
          expires_in: (targetMsg as Message).expires_in || null,
          reply_to: (targetMsg as Message).reply_to || null,
          client_msg_id: nonce,
          nonce: nonce
        }));
      }
    }

    setTimeout(() => {
      updateMessage(
        (m) => Boolean((m.nonce === nonce || m.client_msg_id === nonce || m.message_id === nonce) && m.status === 'sending'),
        (m) => ({ ...m, status: 'failed' })
      );
    }, 10000);
  };

  const sendTyping = (isTyping: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: isTyping ? 'typing_start' : 'typing_stop',
      room_id: activeRoomId
    }));
  };

  const kickMember = (targetId: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'room_kick_user',
      room_id: activeRoomId,
      user_id: targetId
    }));
  };

  const muteMember = (targetId: number, mute: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'room_mute_user',
      room_id: activeRoomId,
      user_id: targetId,
      mute: mute
    }));
  };

  const sendReaction = (messageId: string, roomId: string, emoji: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'add_reaction',
      message_id: messageId,
      room_id: roomId,
      emoji: emoji
    }));
  };

  const editMessage = (messageId: string, roomId: string, content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'edit_message',
      message_id: messageId,
      room_id: roomId,
      content: content
    }));
  };

  const deleteMessage = (messageId: string, roomId: string) => {
    deleteLocalMessage(messageId, userId || undefined);
    removeOutboxMessage(messageId, userId || undefined);
    setMessages(prev => prev.filter(m => String(m.id) !== String(messageId) && String(m.message_id) !== String(messageId) && String(m.db_message_id) !== String(messageId) && String(m.client_msg_id) !== String(messageId)));
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'delete_message',
      message_id: messageId,
      room_id: roomId
    }));
  };

  const pinMessage = (messageId: string, roomId: string, pin: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'pin_message',
      message_id: messageId,
      room_id: roomId,
      pin
    }));
  };

  const markAsRead = (messageId: string, roomId: string, dbMessageId?: number, sequenceId?: number) => {
    if (!roomId) return;
    setUnreadCounts(prev => {
      const current = prev[roomId] || 0;
      if (current <= 1) {
        if (!prev[roomId]) return prev;
        const next = { ...prev };
        delete next[roomId];
        return next;
      }
      return { ...prev, [roomId]: current - 1 };
    });
    dismissDeliveredNotification(roomId).catch(() => {});
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'mark_read',
      message_id: messageId,
      room_id: roomId,
      db_message_id: dbMessageId,
      sequence_id: sequenceId
    }));
  };

  const markAllAsRead = (roomId: string) => {
    if (!roomId) return;
    setUnreadCounts(prev => {
      if (!prev[roomId]) return prev;
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
    dismissDeliveredNotification(roomId).catch(() => {});
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'mark_all_read',
      room_id: roomId
    }));
  };

  const markDelivered = (messageId: string, roomId: string, dbMessageId?: number) => {
    if (!roomId?.startsWith('dm_')) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'mark_delivered',
      message_id: messageId,
      room_id: roomId,
      db_message_id: dbMessageId
    }));
  };

  const joinRoom = (roomId: string, inviteCode?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'join_room', room_id: roomId, invite_code: inviteCode }));

    // Reset unread counter when joining a room and dismiss its delivered notifications
    setUnreadCounts(prev => ({ ...prev, [roomId]: 0 }));
    dismissDeliveredNotification(roomId).catch(() => {});
  };

  const leaveRoom = (roomId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'leave', room_id: roomId }));
  };

  const requestSync = (roomId: string, sinceSeq: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'sync',
      room_id: roomId,
      since_seq: sinceSeq
    }));
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  // Sync app badge and document title with total unread counts
  useEffect(() => {
    let totalUnread = 0;
    Object.values(unreadCounts || {}).forEach(cnt => {
      totalUnread += Math.max(0, Number(cnt) || 0);
    });
    updateAppBadge(totalUnread);
  }, [unreadCounts]);

  useEffect(() => {
    if (isAuthenticated && userId) {
      fetchConversationsSummary();
      connectWebSocket(userId);
    }
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [isAuthenticated, userId]);

  useEffect(() => {
    if (activeRoomId && wsConnected) {
      joinRoom(activeRoomId);
    }
    return () => {
      if (activeRoomId && wsConnected) {
        leaveRoom(activeRoomId);
      }
    };
  }, [activeRoomId, wsConnected]);

  return {
    messages,
    setMessages,
    lastMessages,
    unreadCounts,
    wsConnected,
    sendMessage,
    retryMessage,
    sendTyping,
    kickMember,
    muteMember,
    sendReaction,
    editMessage,
    deleteMessage,
    pinMessage,
    markAsRead,
    markAllAsRead,
    markDelivered,
    requestSync,
    disconnect,
    connectWebSocket,
    refetchSummary: fetchConversationsSummary
  };
}
