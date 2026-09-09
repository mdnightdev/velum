import { useState, useEffect, useRef } from 'react';
import { Message } from '../../../types';
import { decryptMessage, encryptMessage, EncryptionContext } from '../../../services/encryptionService';
import { statelessE2eeService } from '../../../services/statelessE2eeService';
import { parseAttachment } from '../../../utils/messageParser';
import { putPlaintextByCiphertext, saveLocalMessages } from '../../../utils/indexedDb';
import { useChatStore } from '../../../stores/chatStore';
import { parseDmPeerId } from '../../../utils/roomUtils';
import { isUsablePlaintext } from '../../../utils/messagePlaintext';
import { getMemoryPlaintext, setMemoryPlaintext } from '../../../utils/plaintextCache';

/** @deprecated Prefer getMemoryPlaintext — kept for existing imports. */
export const globalDecryptionCache = {
  has: (ciphertext: string) => getMemoryPlaintext(ciphertext) != null,
  get: (ciphertext: string) => getMemoryPlaintext(ciphertext),
  set: (ciphertext: string, plaintext: string) => setMemoryPlaintext(ciphertext, plaintext),
  delete: (_ciphertext: string) => {
    /* memory cache is write-through; no public delete needed for poison — overwritten by usable pt */
  },
};

export function cachePlaintext(ciphertext: string, plaintext: string, userId?: number) {
  if (ciphertext && isUsablePlaintext(plaintext)) {
    setMemoryPlaintext(ciphertext, plaintext);
    const uid = userId ?? statelessE2eeService.getLocalUserId() ?? undefined;
    void putPlaintextByCiphertext(ciphertext, plaintext, uid ?? undefined);
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
          syncDecrypted[m.content] = m.content;
          continue;
        }

        // 2. If plaintext already attached in memory, map to all key aliases immediately
        if (isUsablePlaintext(m.plaintext)) {
          globalDecryptionCache.set(m.content, m.plaintext!);
          for (const k of keys) {
            cacheRef.current[k] = { ciphertext: m.content, plaintext: m.plaintext! };
            syncDecrypted[k] = m.plaintext!;
          }
          syncDecrypted[m.content] = m.plaintext!;
          continue;
        }

        // Ignore poisoned placeholders left by older builds
        if (m.plaintext && !isUsablePlaintext(m.plaintext)) {
          m.plaintext = undefined;
        }

        // 3. Check global session cache first
        if (globalDecryptionCache.has(m.content)) {
          const cached = globalDecryptionCache.get(m.content)!;
          if (!isUsablePlaintext(cached)) {
            globalDecryptionCache.delete(m.content);
          } else {
            m.plaintext = cached;
            for (const k of keys) {
              cacheRef.current[k] = { ciphertext: m.content, plaintext: cached };
              syncDecrypted[k] = cached;
            }
            syncDecrypted[m.content] = cached;
            continue;
          }
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
          if (!isUsablePlaintext(cachedPlaintext)) {
            cachedPlaintext = null;
          } else {
            m.plaintext = cachedPlaintext;
            globalDecryptionCache.set(m.content, cachedPlaintext);
            for (const k of keys) {
              cacheRef.current[k] = { ciphertext: m.content, plaintext: cachedPlaintext };
              syncDecrypted[k] = cachedPlaintext;
            }
            syncDecrypted[m.content] = cachedPlaintext;
            continue;
          }
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
        // Stamp store even if effect re-runs; UI map update is mount-scoped.
        useChatStore.getState().updatePlaintexts(syncDecrypted);
        if (isMounted) {
          setDecryptedMap((prev) => ({ ...prev, ...syncDecrypted }));
        }
      }

      if (pending.length === 0) return;

      // Parallel chunked decryption for high-throughput zero-lag rendering
      const CHUNK_SIZE = 20;
      const batchMapEntries: Record<string, string> = {};
      const messagesToPersist: any[] = [];
      const store = useChatStore.getState();

      for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
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
              });
              return { item, decrypted: '' };
            }
          })
        );

        for (const { item, decrypted } of results) {
          if (!isUsablePlaintext(decrypted)) {
            continue;
          }
          globalDecryptionCache.set(item.ciphertext, decrypted);
          for (const k of item.keys) {
            cacheRef.current[k] = { ciphertext: item.ciphertext, plaintext: decrypted };
            batchMapEntries[k] = decrypted;
          }
          batchMapEntries[item.ciphertext] = decrypted;
          void putPlaintextByCiphertext(item.ciphertext, decrypted, currentUserId);

          messagesToPersist.push({
            ...item.rawMsg,
            plaintext: decrypted,
          });
        }

        // Persist each chunk immediately so a remount cannot drop completed work.
        if (Object.keys(batchMapEntries).length > 0) {
          store.updatePlaintexts({ ...batchMapEntries });
          if (isMounted) {
            setDecryptedMap((prev) => ({ ...prev, ...batchMapEntries }));
          }
        }
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
    if (isUsablePlaintext(msg.plaintext)) return msg.plaintext!;
    if (msg.content && globalDecryptionCache.has(msg.content)) {
      const cached = globalDecryptionCache.get(msg.content)!;
      if (isUsablePlaintext(cached)) return cached;
    }
    const keys = [msg.message_id, msg.id, msg.client_msg_id, msg.nonce, (msg as any).db_message_id]
      .filter(Boolean)
      .map(String);
    for (const k of keys) {
      if (isUsablePlaintext(decryptedMap[k])) return decryptedMap[k];
      if (cacheRef.current[k] && isUsablePlaintext(cacheRef.current[k].plaintext)) {
        return cacheRef.current[k].plaintext;
      }
    }
    // If not an encrypted token, content is plaintext
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
