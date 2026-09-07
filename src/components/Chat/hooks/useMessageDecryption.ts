import { useState, useEffect, useRef } from 'react';
import { Message } from '../../../types';
import { decryptMessage, encryptMessage, EncryptionContext } from '../../../services/encryptionService';
import { statelessE2eeService } from '../../../services/statelessE2eeService';
import { parseAttachment } from '../../../utils/messageParser';
import { saveLocalMessages } from '../../../utils/indexedDb';
import { useChatStore } from '../../../stores/chatStore';

export function useMessageDecryption({
  messages,
  activeChatPeer,
  roomId,
  currentUserId,
}: {
  messages: Message[];
  activeChatPeer?: { userId: number } | null;
  roomId: string;
  currentUserId?: number;
}) {
  const [decryptedMap, setDecryptedMap] = useState<Record<string, string>>({});
  const cacheRef = useRef<Record<string, { ciphertext: string; plaintext: string }>>({});

  useEffect(() => {
    let isMounted = true;
    if (currentUserId) {
      statelessE2eeService.setLocalUserId(currentUserId);
    }

    const processDecryption = async () => {
      const pending: Array<{
        keys: string[];
        ciphertext: string;
        context: EncryptionContext;
      }> = [];

      const syncDecrypted: Record<string, string> = {};

      for (const m of messages) {
        const keys = [m.message_id, m.id, m.client_msg_id, m.nonce, (m as any).db_message_id]
          .filter(Boolean)
          .map(String);

        if (!m.content || keys.length === 0) continue;

        const isEncryptedPayload = m.content.startsWith('e2ee:') || m.content.startsWith('VEL_E2EE[');

        // 1. If not an encrypted payload, content is already plaintext
        if (!isEncryptedPayload) {
          m.plaintext = m.content;
          for (const k of keys) {
            cacheRef.current[k] = { ciphertext: m.content, plaintext: m.content };
            syncDecrypted[k] = m.content;
          }
          continue;
        }

        // 2. If plaintext already attached in memory, map to all key aliases immediately
        if (m.plaintext) {
          for (const k of keys) {
            cacheRef.current[k] = { ciphertext: m.content, plaintext: m.plaintext };
            syncDecrypted[k] = m.plaintext;
          }
          continue;
        }

        // 3. Check if cached under any alias
        let cachedPlaintext: string | null = null;
        for (const k of keys) {
          const cached = cacheRef.current[k];
          if (cached && cached.ciphertext === m.content) {
            cachedPlaintext = cached.plaintext;
            break;
          }
        }

        if (cachedPlaintext) {
          m.plaintext = cachedPlaintext;
          for (const k of keys) {
            cacheRef.current[k] = { ciphertext: m.content, plaintext: cachedPlaintext };
            syncDecrypted[k] = cachedPlaintext;
          }
          continue;
        }

        const isOutgoing = Boolean(currentUserId && String(m.user_id) === String(currentUserId));
        const targetRoom = m.room_id || roomId || '';
        const isDmRoom = targetRoom.startsWith('dm_') && !targetRoom.startsWith('dm_velum_');
        let peerId = activeChatPeer?.userId;
        if (!peerId && isDmRoom) {
          const parsed = parseInt(targetRoom.replace('dm_', ''), 10);
          if (!isNaN(parsed) && parsed > 0) {
            peerId = parsed;
          }
        }
        if (!peerId && !isOutgoing && m.user_id) {
          peerId = Number(m.user_id);
        }

        const context: EncryptionContext = {
          type: (activeChatPeer || isDmRoom) ? 'direct' : 'lounge',
          roomId: targetRoom,
          peerUserId: peerId,
          isEncrypted: !!(m.is_encrypted || (m as any).isEncrypted),
        };

        pending.push({
          keys,
          ciphertext: m.content,
          context
        });
      }

      // Bound cache size to max 3000 items
      const cacheKeys = Object.keys(cacheRef.current);
      if (cacheKeys.length > 3000) {
        const keysToRemove = cacheKeys.slice(0, cacheKeys.length - 2000);
        for (const k of keysToRemove) {
          delete cacheRef.current[k];
        }
      }

      if (Object.keys(syncDecrypted).length > 0) {
        setDecryptedMap((prev) => ({ ...prev, ...syncDecrypted }));
      }

      if (pending.length === 0) return;

      // Decrypt inbound messages sequentially to maintain Double Ratchet state ordering
      const batchMapEntries: Record<string, string> = {};
      const messagesToPersist: any[] = [];
      const store = useChatStore.getState();

      for (const item of pending) {
        if (!isMounted) return;

        try {
          const decrypted = await decryptMessage(item.ciphertext, item.context);

          for (const k of item.keys) {
            cacheRef.current[k] = { ciphertext: item.ciphertext, plaintext: decrypted };
            batchMapEntries[k] = decrypted;
          }

          // Permanently store plaintext in Zustand memory
          store.updateMessage(
            (msg) => item.keys.some((k) => String(msg.id) === k || String(msg.client_msg_id) === k || String(msg.message_id) === k),
            (msg) => ({ ...msg, plaintext: decrypted })
          );

          // Queue for single batch persistence to user device IndexedDB
          messagesToPersist.push({
            id: item.keys[0],
            message_id: item.keys[0],
            room_id: item.context.roomId,
            loungeId: item.context.roomId,
            plaintext: decrypted,
            content: item.ciphertext,
            user_id: item.context.peerUserId
          });
        } catch (err) {
          console.error('[useMessageDecryption] Batch item decryption failed:', {
            error: err instanceof Error ? err.message : err,
            stack: err instanceof Error ? err.stack : undefined,
            keys: item.keys,
            context: item.context,
            ciphertext: item.ciphertext
          });
          for (const k of item.keys) {
            cacheRef.current[k] = { ciphertext: item.ciphertext, plaintext: '[Decryption Error]' };
            batchMapEntries[k] = '[Decryption Error]';
          }
        }
      }

      if (isMounted && Object.keys(batchMapEntries).length > 0) {
        setDecryptedMap((prev) => ({ ...prev, ...batchMapEntries }));
      }

      if (messagesToPersist.length > 0) {
        saveLocalMessages(messagesToPersist, currentUserId).catch(() => {});
      }
    };

    processDecryption();

    return () => {
      isMounted = false;
    };
  }, [messages, activeChatPeer?.userId, roomId, currentUserId]);

  const getDecryptedText = (msg: Message): string => {
    if (msg.plaintext) return msg.plaintext;
    const keys = [msg.message_id, msg.id, msg.client_msg_id, msg.nonce, (msg as any).db_message_id]
      .filter(Boolean)
      .map(String);
    for (const k of keys) {
      if (decryptedMap[k]) return decryptedMap[k];
      if (cacheRef.current[k]) return cacheRef.current[k].plaintext;
    }
    // If not an encrypted token, content is plaintext - never return empty string
    if (msg.content && !msg.content.startsWith('e2ee:') && !msg.content.startsWith('VEL_E2EE[')) {
      return msg.content;
    }
    return '';
  };

  const encryptOutgoingMessage = async (
    textToSend: string,
    context: EncryptionContext
  ): Promise<string> => {
    return await encryptMessage(textToSend, context);
  };

  return {
    decryptedMap,
    getDecryptedText,
    encryptOutgoingMessage,
  };
}
