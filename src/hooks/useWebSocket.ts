import { useState, useEffect, useRef } from 'react';
import { Message } from '../types';
import { encryptMessage, EncryptionContext } from '../services/encryptionService';

interface UseWebSocketParams {
  userId: number | null;
  sessionId: string | null;
  isAuthenticated: boolean;
  activeRoomId: string;
  onMessageReceived?: (message: Message) => void;
}

export function useWebSocket({
  userId,
  sessionId,
  isAuthenticated,
  activeRoomId,
  onMessageReceived
}: UseWebSocketParams) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, Message>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const activeRoomIdRef = useRef(activeRoomId);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const reconnectTimeoutRef = useRef<any>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  const fetchConversationsSummary = async () => {
    try {
      const sessionToken = sessionStorage.getItem('velum-sessionId');
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
      console.error('Failed to fetch conversations summary:', err);
    }

    // Fetch Redis-based unread counts
    try {
      const sessionToken = sessionStorage.getItem('velum-sessionId');
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
      console.error('Failed to fetch Redis unread counts:', err);
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

    const host = window.location.host;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const currentSessionId = sessionStorage.getItem('velum-sessionId') || sessionId;
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
        } else if (data.type === 'reaction_update') {
          setMessages(prev => prev.map(m => {
            if (m.message_id === data.message_id) {
              return { ...m, reactions: data.reactions };
            }
            return m;
          }));
        } else if (data.type === 'message_deleted') {
          setMessages(prev => prev.filter(m => m.message_id !== data.message_id));
        } else if (data.type === 'message_read') {
          setMessages(prev => prev.map(m => {
            if (m.message_id === data.message_id) {
              return { ...m, status: 'read' as 'sent' | 'delivered' | 'read' };
            }
            return m;
          }));
        } else if (data.type === 'message_delivered') {
          setMessages(prev => prev.map(m => {
            if (m.message_id === data.message_id && m.status !== 'read') {
              return { ...m, status: 'delivered' as 'sent' | 'delivered' | 'read' };
            }
            return m;
          }));
        } else if (data.type === 'lounge_cleaned') {
          if (activeRoomIdRef.current === data.roomId) {
            setMessages([]);
          }
        } else if (data.type === 'history') {
          if (data.room_id === activeRoomIdRef.current) {
            setMessages(data.messages || []);
          }
          if (data.messages && data.messages.length > 0 && data.room_id) {
            const latest = data.messages[data.messages.length - 1];
            setLastMessages(prev => ({ ...prev, [data.room_id]: latest }));
          }
        } else {
          window.dispatchEvent(new CustomEvent('velum-message-received', { detail: data }));
          
          if (data.room_id) {
            const newMessage = data as Message;
            setLastMessages(prev => ({ ...prev, [data.room_id]: newMessage }));
          }

          if (data.room_id === activeRoomIdRef.current) {
            setMessages(prev => {
              const newMessage = data as Message;
              // Check if we have an optimistic message to replace
              if (newMessage.nonce) {
                const optIdx = prev.findIndex(m => m.nonce === newMessage.nonce && m.status === 'sending');
                if (optIdx !== -1) {
                  const newArr = [...prev];
                  newArr[optIdx] = newMessage;
                  if (onMessageReceived) {
                    onMessageReceived(newMessage);
                  }
                  return newArr;
                }
              }
              const exists = prev.some(m => m.message_id === data.message_id);
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
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 15000);
        console.log(`Socket closed or errored. Reconnecting in ${Math.round(delay)}ms... (Attempt ${reconnectAttemptsRef.current})`);
        
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

  const sendMessage = async (text: string, burnSeconds: number | null, isEncrypted: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
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
    ].includes(activeRoomId);
    const shouldEncrypt = !isOfficialChannel;
    const context: EncryptionContext = { type: 'lounge', roomId: activeRoomId, isEncrypted: shouldEncrypt };
    const finalContent = shouldEncrypt ? await encryptMessage(text, context) : text;
    
    const nonce = `nonce_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const optMessage: Message = {
      message_id: nonce,
      nonce: nonce,
      room_id: activeRoomId,
      user_id: userId || 0, // Note: using userId from params
      username: 'You', // This will be overwritten by server, just a placeholder
      content: finalContent,
      is_encrypted: shouldEncrypt,
      status: 'sending',
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, optMessage]);

    wsRef.current.send(JSON.stringify({
      type: 'send_message',
      room_id: activeRoomId,
      content: finalContent,
      is_encrypted: shouldEncrypt,
      expires_in: burnSeconds,
      reply_to: null,
      nonce: nonce
    }));
    
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

  const deleteMessage = (messageId: string, roomId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'delete_message',
      message_id: messageId,
      room_id: roomId
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
    if (activeRoomId) {
      joinRoom(activeRoomId);
    }
    return () => {
      if (activeRoomId) {
        leaveRoom(activeRoomId);
      }
    };
  }, [activeRoomId]);

  return {
    messages,
    setMessages,
    lastMessages,
    unreadCounts,
    wsConnected,
    sendMessage,
    sendTyping,
    kickMember,
    muteMember,
    sendReaction,
    deleteMessage,
    markAsRead,
    markDelivered,
    disconnect,
    connectWebSocket,
    refetchSummary: fetchConversationsSummary
  };
}
