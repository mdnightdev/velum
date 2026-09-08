import { useState, useEffect, useRef } from 'react';
import { Message } from '../../../types';
import { decryptMessage, encryptMessage, EncryptionContext } from '../../../services/encryptionService';
import { statelessE2eeService } from '../../../services/statelessE2eeService';
import { parseAttachment } from '../../../utils/messageParser';
import { saveLocalMessages } from '../../../utils/indexedDb';
import { useChatStore } from '../../../stores/chatStore';
import { parseDmPeerId } from '../../../utils/roomUtils';

// Global session plaintext cache keyed by ciphertext (content)
export const globalDecryptionCache = new Map<string, string>();

export function cachePlaintext(ciphertext: string, plaintext: string) {
  if (ciphertext && plaintext) {
    globalDecryptionCache.set(ciphertext, plaintext);
  }
}

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
        rawMsg?: any;
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
          globalDecryptionCache.set(m.content, m.content);
          for (const k of keys) {
            cacheRef.current[k] = { ciphertext: m.content, plaintext: m.content };
            syncDecrypted[k] = m.content;
          }
          continue;
        }

        // 2. If plaintext already attached in memory, map to all key aliases immediately
        if (m.plaintext) {
          globalDecryptionCache.set(m.content, m.plaintext);
          for (const k of keys) {
            cacheRef.current[k] = { ciphertext: m.content, plaintext: m.plaintext };
            syncDecrypted[k] = m.plaintext;
          }
          continue;
        }

        // 3. Check global session cache first
        if (globalDecryptionCache.has(m.content)) {
          const cached = globalDecryptionCache.get(m.content)!;
          m.plaintext = cached;
          for (const k of keys) {
            cacheRef.current[k] = { ciphertext: m.content, plaintext: cached };
            syncDecrypted[k] = cached;
          }
          continue;
        }

        // 4. Check component cache under any alias
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
          globalDecryptionCache.set(m.content, cachedPlaintext);
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
          peerId = parseDmPeerId(targetRoom, currentUserId) || undefined;
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
        context,
        rawMsg: m
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

      // Parallel chunked decryption for high-throughput zero-lag rendering
      const CHUNK_SIZE = 20;
      const batchMapEntries: Record<string, string> = {};
      const messagesToPersist: any[] = [];
      const store = useChatStore.getState();

      for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
        if (!isMounted) return;
        const chunk = pending.slice(i, i + CHUNK_SIZE);
        const results = await Promise.all(
          chunk.map(async (item) => {
            try {
              const decrypted = await decryptMessage(item.ciphertext, item.context);
              return { item, decrypted };
            } catch (err) {
              console.error('[useMessageDecryption] Batch item decryption failed:', {
                error: err instanceof Error ? err.message : err,
                stack: err instanceof Error ? err.stack : undefined,
                keys: item.keys,
                context: item.context,
                ciphertext: item.ciphertext
              });
              return { item, decrypted: '[Decryption Error]' };
            }
          })
        );

        for (const { item, decrypted } of results) {
          globalDecryptionCache.set(item.ciphertext, decrypted);
          for (const k of item.keys) {
            cacheRef.current[k] = { ciphertext: item.ciphertext, plaintext: decrypted };
            batchMapEntries[k] = decrypted;
          }

          messagesToPersist.push({
          ...item.rawMsg,
          plaintext: decrypted
        });
        }
      }

      if (isMounted && Object.keys(batchMapEntries).length > 0) {
        store.updatePlaintexts(batchMapEntries);
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
    if (msg.content && globalDecryptionCache.has(msg.content)) {
      return globalDecryptionCache.get(msg.content)!;
    }
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
    const cipher = await encryptMessage(textToSend, context);
    if (cipher && textToSend) {
      globalDecryptionCache.set(cipher, textToSend);
    }
    return cipher;
  };

  return {
    decryptedMap,
    getDecryptedText,
    encryptOutgoingMessage,
  };
}
