import { useState, useEffect, useRef } from 'react';
import { Message } from '../types';
import { encryptMessage, EncryptionContext } from '../services/encryptionService';
import { getLocalMessages, saveLocalMessages, flushLoungeCache, deleteLocalMessage } from '../utils/indexedDb';
import { LocalVaultEncryption } from '../services/localVaultEncryption';
import { enqueueOutboxMessage, removeOutboxMessage, drainOutboxQueue } from '../services/outboxEngine';
import { storage } from '../services/storageService';
import { handleInboundMessageNotification, updateAppBadge } from '../utils/notifications';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

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

  // 1. Instantly render cached messages when switching rooms or reconnecting
  useEffect(() => {
    if (!activeRoomId) return;

    // Clear old room state immediately so rooms don't bleed into each other
    setMessages([]);

    const syncRoom = async () => {
      const sessionToken = storage.getItem('velum-sessionId') || '';
      
      try {
        const isDm = activeRoomId.startsWith('dm_') && !activeRoomId.startsWith('dm_velum_');
        let url = `/v2/lounges/${activeRoomId}/messages`;
        if (isDm) {
          const peerId = activeRoomId.replace('dm_', '');
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

        if (data.messages && Array.isArray(data.messages)) {
          const normalized: Message[] = isDm ? data.messages.map((d: any) => ({
            id: d.id,
            message_id: String(d.id),
            db_message_id: d.id,
            room_id: activeRoomId,
            lounge_id: activeRoomId,
            user_id: d.sender,
            username: d.sender === userId ? 'You' : `User #${d.sender}`,
            content: d.body,
            is_encrypted: !!d.encrypted,
            reply_to: d.replyTo || null,
            timestamp: d.created,
            status: d.readAt ? 'read' : (d.deliveredAt ? 'delivered' : 'sent')
          })) : data.messages;

          setMessages(prev => {
            if (normalized.length === 0) return prev;
            const map = new Map<string, Message>();
            // Keep in-flight messages from WebSocket
            prev.forEach(m => map.set(String(m.id || m.message_id || m.client_msg_id), m));
            // Add server verified messages
            normalized.forEach(m => map.set(String(m.id || m.message_id), m));
            return Array.from(map.values()).sort((a, b) => {
              const tA = new Date(a.timestamp || 0).getTime();
              const tB = new Date(b.timestamp || 0).getTime();
              return tA - tB;
            });
          });

          if (normalized.length > 0) {
            await saveLocalMessages(normalized, userId || undefined);
          }
        }
      } catch (err) {
        console.warn('[Sync] Failed to sync messages:', err);
        const cached = await getLocalMessages(activeRoomId, 100, userId || undefined);
        if (cached && cached.length > 0) {
          setMessages(cached);
        }
      }
    };

    syncRoom();
  }, [activeRoomId, wsConnected, userId]);

  // 2. Persist message state changes to local storage
  useEffect(() => {
    if (activeRoomId && messages.length > 0) {
      saveLocalMessages(messages, userId || undefined);
    }
  }, [activeRoomId, messages, userId]);
  
  const [lastMessages, setLastMessages] = useState<Record<string, Message>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
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
      }

      // Automatically drain persistent IndexedDB outbox queue upon socket restoration
      drainOutboxQueue((item) => {
        if (ws.readyState === WebSocket.OPEN) {
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
      }, userId || undefined);

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
              setUnreadCounts(prev => ({ ...prev, [data.room_id]: 0 }));
            }
          }
          return;
        }

        if (data.type === 'broadcast') {
          const broadcastMsg: Message = {
            message_id: `broadcast_${Date.now()}`,
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
          setMessages(prev => [...prev, broadcastMsg]);
          return;
        }
        
        if (data.type === 'system_alert') {
          if (!data.room_id || data.room_id === activeRoomIdRef.current) {
            const systemMsg: Message = {
              message_id: `sys_${Date.now()}`,
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
            setMessages(prev => [...prev, systemMsg]);
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
          const ackNonce = data.client_msg_id || data.nonce;
          if (ackNonce) {
            removeOutboxMessage(ackNonce, userId || undefined);
          }
          setMessages(prev => prev.map(m => {
            if (m.nonce === ackNonce || m.client_msg_id === ackNonce || m.message_id === ackNonce) {
              return {
                ...m,
                message_id: data.id ? String(data.id) : (data.message_id ? String(data.message_id) : m.message_id),
                db_message_id: data.id || data.db_message_id,
                sequence_id: data.sequence_id,
                client_msg_id: ackNonce,
                status: 'sent'
              };
            }
            return m;
          }));
        } else if (data.type === 'dm') {
          const isFromMe = uid && String(data.from) === String(uid);
          const peerId = isFromMe ? data.to : data.from;
          const dmRoomId = `dm_${peerId}`;
          const dmMsg: Message = {
            message_id: String(data.id),
            db_message_id: data.id,
            id: data.id,
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
            handleInboundMessageNotification({
              senderName: dmMsg.username,
              content: dmMsg.content,
              isFromMe: false,
              roomId: dmRoomId,
              activeRoomId: activeRoomIdRef.current
            });
          }

          setLastMessages(prev => ({ ...prev, [dmRoomId]: dmMsg }));
          window.dispatchEvent(new CustomEvent('velum-dm-received', { detail: dmMsg }));

          if (activeRoomIdRef.current === dmRoomId) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => String(m.id || m.message_id || m.db_message_id)));
              if (existingIds.has(String(dmMsg.id))) return prev;
              return [...prev, dmMsg];
            });
          }
        } else if (data.type === 'sync_response') {
          if (data.room_id === activeRoomIdRef.current && Array.isArray(data.messages)) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => String(m.db_message_id || m.message_id)));
              const newMsgs = data.messages.filter((m: Message) => !existingIds.has(String(m.db_message_id || m.message_id)));
              if (newMsgs.length === 0) return prev;
              const merged = [...prev, ...newMsgs];
              return merged.sort((a, b) => (a.sequence_id || 0) - (b.sequence_id || 0));
            });
          }
        } else if (data.type === 'reaction_update') {
          setMessages(prev => prev.map(m => {
            if (String(m.message_id) === String(data.message_id) || String(m.db_message_id) === String(data.message_id)) {
              return { ...m, reactions: data.reactions };
            }
            return m;
          }));
        } else if (data.type === 'message_edit') {
          setMessages(prev => prev.map(m => {
            if (String(m.message_id) === String(data.message_id) || String(m.db_message_id) === String(data.message_id)) {
              return {
                ...m,
                content: data.content,
                is_edited: true,
                edited_at: data.edited_at
              };
            }
            return m;
          }));
        } else if (data.type === 'message_deleted') {
          setMessages(prev => prev.filter(m => String(m.message_id) !== String(data.message_id) && String(m.db_message_id) !== String(data.message_id)));
          deleteLocalMessage(data.message_id, userId || undefined);
        } else if (data.type === 'message_pinned') {
          setMessages(prev => prev.map(m => {
            if (String(m.message_id) === String(data.message_id) || String(m.db_message_id) === String(data.message_id)) {
              return { ...m, is_pinned: !!data.is_pinned };
            }
            return m;
          }));
        } else if (data.type === 'message_read') {
          const readerId = data.reader_id || data.user_id;
          const lastReadSeq = data.last_read_seq;
          const targetMsgId = data.last_read_msg_id || data.message_id;

          setMessages(prev => prev.map(m => {
            let isReadTarget = false;
            if (lastReadSeq && m.sequence_id) {
              isReadTarget = m.sequence_id <= lastReadSeq;
            } else if (targetMsgId) {
              isReadTarget = String(m.message_id) === String(targetMsgId) || String(m.db_message_id) === String(targetMsgId);
            }

            if (isReadTarget) {
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
            return m;
          }));
        } else if (data.type === 'message_delivered') {
          const receiverId = data.receiver_id || data.user_id;
          setMessages(prev => prev.map(m => {
            if ((String(m.message_id) === String(data.message_id) || String(m.db_message_id) === String(data.message_id))) {
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
            return m;
          }));
        } else if (data.type === 'lounge_cleaned') {
          if (activeRoomIdRef.current === data.roomId) {
            setMessages([]);
          }
        } else if (data.type === 'history') {
          const historyMessages: Message[] = data.messages || [];
          if (data.room_id === activeRoomIdRef.current) {
            // Silently merge with local known plaintexts in background
            getLocalMessages(data.room_id, 200, uid).then((localMsgs) => {
              const localMap = new Map<string, string>();
              localMsgs.forEach(lm => {
                if (lm.plaintext) {
                  const lk = [lm.message_id, lm.id, lm.client_msg_id, lm.nonce, lm.db_message_id].filter(Boolean).map(String);
                  for (const k of lk) {
                    localMap.set(k, lm.plaintext);
                  }
                  if (lm.content) localMap.set(lm.content, lm.plaintext);
                }
              });

              setMessages(prev => {
                const prevMap = new Map<string, Message>();
                prev.forEach(p => {
                  const pk = [p.message_id, p.id, p.client_msg_id, p.nonce, p.db_message_id].filter(Boolean).map(String);
                  for (const k of pk) {
                    prevMap.set(k, p);
                  }
                });

                return historyMessages.map(hm => {
                  const keys = [hm.message_id, hm.id, hm.client_msg_id, hm.nonce, (hm as any).db_message_id].filter(Boolean).map(String);
                  let plaintext = hm.plaintext;
                  if (!plaintext) {
                    for (const k of keys) {
                      if (prevMap.has(k) && prevMap.get(k)!.plaintext) {
                        plaintext = prevMap.get(k)!.plaintext;
                        break;
                      }
                      if (localMap.has(k)) {
                        plaintext = localMap.get(k);
                        break;
                      }
                    }
                    if (!plaintext && localMap.has(hm.content)) {
                      plaintext = localMap.get(hm.content);
                    }
                  }
                  return plaintext ? { ...hm, plaintext } : hm;
                });
              });
            }).catch(() => {
              setMessages(historyMessages);
            });
          }
          if (data.messages && data.messages.length > 0 && data.room_id) {
            const latest = data.messages[data.messages.length - 1];
            setLastMessages(prev => ({ ...prev, [data.room_id]: latest }));
          }
        } else {
          window.dispatchEvent(new CustomEvent('velum-message-received', { detail: data }));
          
          const rawAckId = data.client_msg_id || data.nonce;
          if (rawAckId) {
            removeOutboxMessage(String(rawAckId), userId || undefined);
          }

          if (data.room_id) {
            const newMessage = data as Message;
            const isFromMe = Boolean(uid && String(newMessage.user_id) === String(uid));

            // Trigger notification alert (sound chime, desktop banner) for incoming messages
            if (!isFromMe && newMessage.user_id) {
              handleInboundMessageNotification({
                senderName: newMessage.username || (newMessage as any).sender_name || 'Velum',
                content: newMessage.plaintext || newMessage.content,
                isFromMe: false,
                roomId: data.room_id,
                activeRoomId: activeRoomIdRef.current
              });
            }

            setLastMessages(prev => {
              const existing = prev[data.room_id];
              const sameMessage = existing && (
                (existing.message_id && String(existing.message_id) === String(newMessage.message_id)) ||
                (existing.client_msg_id && String(existing.client_msg_id) === String(newMessage.client_msg_id)) ||
                (existing.nonce && existing.nonce === newMessage.nonce)
              );
              // The server echo never carries plaintext. If this update is
              // just the ack for a message we already know the plaintext of
              // (via optimistic send), keep our known plaintext instead of
              // letting the server's ciphertext-only version clobber it.
              const mergedPlaintext = sameMessage
                ? (existing.plaintext || newMessage.plaintext)
                : newMessage.plaintext;
              return {
                ...prev,
                [data.room_id]: { ...newMessage, plaintext: mergedPlaintext }
              };
            });
          }

          if (data.room_id === activeRoomIdRef.current) {
            setMessages(prev => {
              const newMessage = data as Message;
              const isFromMe = Boolean(uid && String(newMessage.user_id) === String(uid));

              // Check if we have an optimistic message to replace by nonce ONLY for our own outgoing messages
              if (isFromMe || !newMessage.user_id) {
                const targetKey = newMessage.client_msg_id || newMessage.nonce || newMessage.message_id;
                const optIdx = prev.findIndex(m => {
                  const mIsMe = !m.user_id || String(m.user_id) === String(uid);
                  if (!mIsMe) return false;
                  return (
                    (targetKey && (m.client_msg_id === targetKey || m.nonce === targetKey || m.message_id === targetKey)) ||
                    (newMessage.client_msg_id && (m.client_msg_id === newMessage.client_msg_id || m.nonce === newMessage.client_msg_id || m.message_id === newMessage.client_msg_id)) ||
                    (newMessage.nonce && (m.client_msg_id === newMessage.nonce || m.nonce === newMessage.nonce || m.message_id === newMessage.nonce))
                  );
                });

                if (optIdx !== -1) {
                  const originalPlaintext = prev[optIdx].plaintext;
                  const newArr = [...prev];
                  newArr[optIdx] = {
                    ...newMessage,
                    plaintext: originalPlaintext || newMessage.plaintext,
                    status: newMessage.status || 'sent'
                  };
                  if (onMessageReceived) {
                    onMessageReceived(newArr[optIdx]);
                  }
                  return newArr;
                }
              }

              const exists = prev.some(m => 
                (data.message_id && String(m.message_id) === String(data.message_id)) ||
                (data.db_message_id && String(m.db_message_id) === String(data.db_message_id)) ||
                (data.nonce && m.nonce && String(m.nonce) === String(data.nonce)) ||
                (data.client_msg_id && m.client_msg_id && String(m.client_msg_id) === String(data.client_msg_id))
              );
              if (exists) return prev;
              if (onMessageReceived) {
                onMessageReceived(newMessage);
              }
              // Automatically mark as delivered when received
              if (newMessage.message_id && newMessage.user_id !== uid) {
                markDelivered(newMessage.message_id, newMessage.room_id);
              }
              // Increment unread counter for incoming messages not in active room
              if (newMessage.user_id !== uid && newMessage.room_id && newMessage.room_id !== activeRoomIdRef.current) {
                setUnreadCounts(prev => ({
                  ...prev,
                  [newMessage.room_id]: (prev[newMessage.room_id] || 0) + 1
                }));
              }
              return [...prev, newMessage];
            });
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
    const isAlreadyEncrypted = text.startsWith('e2ee:v1:') || text.startsWith('ratchet:v2:') || text.startsWith('ratchet:v1:') || text.startsWith('VEL_E2EE[');
    const shouldEncrypt = isAlreadyEncrypted || isEncrypted || !isOfficialChannel;
    let finalContent = text;
    if (!isAlreadyEncrypted && shouldEncrypt) {
      const context: EncryptionContext = { type: 'lounge', roomId: destRoomId, isEncrypted: shouldEncrypt };
      finalContent = await encryptMessage(text, context);
    }
    
    const nonce = crypto.randomUUID();
    const optMessage: Message = {
      message_id: nonce,
      nonce: nonce,
      client_msg_id: nonce,
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
    
    if (destRoomId === activeRoomId) {
      setMessages(prev => [...prev, optMessage]);
    }

    // The server never sees plaintext, so any lastMessages update sourced
    // from server data (summary fetch, history load, WS broadcast echo)
    // can never carry our own sent text. Update lastMessages here, from the
    // optimistic message we just built locally, so the sidebar preview has
    // the real text immediately instead of falling back to a placeholder.
    setLastMessages(prev => ({ ...prev, [destRoomId]: optMessage }));

    const outboxPayload = {
      client_msg_id: nonce,
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
      wsRef.current.send(JSON.stringify({
        type: 'send_message',
        room_id: destRoomId,
        content: finalContent,
        is_encrypted: shouldEncrypt,
        expires_in: burnSeconds,
        reply_to: replyTo || null,
        client_msg_id: nonce,
        nonce: nonce
      }));
    }
    
    // Add a timeout to transition 'sending' to 'failed' if no ACK after 10s
    setTimeout(() => {
      setMessages(prev => prev.map(m => {
        if (m.nonce === nonce && m.status === 'sending') {
          return { ...m, status: 'failed' };
        }
        return m;
      }));
    }, 10000);
  };

  const retryMessage = async (clientMsgId: string) => {
    let targetMsg: Message | undefined;
    setMessages(prev => {
      return prev.map(m => {
        const matches = (m.client_msg_id && m.client_msg_id === clientMsgId) ||
          (m.nonce && m.nonce === clientMsgId) ||
          (m.message_id && m.message_id === clientMsgId) ||
          (m.id && String(m.id) === clientMsgId);
        if (matches) {
          targetMsg = m;
          return { ...m, status: 'sending' };
        }
        return m;
      });
    });

    if (!targetMsg) return;

    const destRoomId = (targetMsg as Message).room_id || activeRoomId;
    const finalContent = (targetMsg as Message).content;
    const shouldEncrypt = !!((targetMsg as Message).is_encrypted || (targetMsg as any).isEncrypted);
    const nonce = (targetMsg as Message).client_msg_id || (targetMsg as Message).nonce || clientMsgId;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
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

    setTimeout(() => {
      setMessages(prev => prev.map(m => {
        if ((m.nonce === nonce || m.client_msg_id === nonce || m.message_id === nonce) && m.status === 'sending') {
          return { ...m, status: 'failed' };
        }
        return m;
      }));
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

  const markAsRead = (messageId: string, roomId: string, dbMessageId?: number) => {
    // Note: Counter reset is now handled server-side in handleMarkRead
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'mark_read',
      message_id: messageId,
      room_id: roomId,
      db_message_id: dbMessageId
    }));
  };

  const markAllAsRead = (roomId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'mark_all_read',
      room_id: roomId
    }));
  };

  const markDelivered = (messageId: string, roomId: string, dbMessageId?: number) => {
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

    // Reset unread counter when joining a room
    setUnreadCounts(prev => ({ ...prev, [roomId]: 0 }));
  };

  const leaveRoom = (roomId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'leave', room_id: roomId }));
  };

  const requestSync = (roomId: string, sinceSeq: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'sync_request',
      room_id: roomId,
      since_seq: sinceSeq
    }));
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

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
