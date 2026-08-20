import { useState, useEffect, useRef } from 'react';
import { Message } from '../../../types';
import { decryptMessage, encryptMessage, EncryptionContext } from '../../../services/encryptionService';
import { statelessE2eeService } from '../../../services/statelessE2eeService';
import { parseAttachment } from '../../../utils/messageParser';
import { saveLocalMessages } from '../../../utils/indexedDb';

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

        const isOutgoing = !!(currentUserId && m.user_id === currentUserId);

        // 1. If plaintext already attached in memory, map to all key aliases immediately
        if (m.plaintext) {
          for (const k of keys) {
            cacheRef.current[k] = { ciphertext: m.content, plaintext: m.plaintext };
            syncDecrypted[k] = m.plaintext;
          }
          continue;
        }

        // 2. Check if cached under any alias
        let cachedPlaintext: string | null = null;
        for (const k of keys) {
          const cached = cacheRef.current[k];
          if (cached && cached.ciphertext === m.content) {
            cachedPlaintext = cached.plaintext;
            break;
          }
        }

        if (cachedPlaintext) {
          for (const k of keys) {
            cacheRef.current[k] = { ciphertext: m.content, plaintext: cachedPlaintext };
            syncDecrypted[k] = cachedPlaintext;
          }
          continue;
        }

        // 3. Outgoing ratchet messages cannot be decrypted with receiver ratchet
        if (isOutgoing && activeChatPeer) {
          continue;
        }

        const peerId = activeChatPeer?.userId || m.user_id;
        const context: EncryptionContext = {
          type: activeChatPeer ? 'direct' : 'lounge',
          roomId: m.room_id || roomId,
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
      for (const item of pending) {
        if (!isMounted) return;

        try {
          const decrypted = await decryptMessage(item.ciphertext, item.context);
          const newMapEntries: Record<string, string> = {};

          for (const k of item.keys) {
            cacheRef.current[k] = { ciphertext: item.ciphertext, plaintext: decrypted };
            newMapEntries[k] = decrypted;
          }

          if (isMounted) {
            setDecryptedMap((prev) => ({ ...prev, ...newMapEntries }));
          }

          // Persist to local storage so page refresh retains plaintext
          saveLocalMessages([{
            id: item.keys[0],
            message_id: item.keys[0],
            room_id: item.context.roomId,
            loungeId: item.context.roomId,
            plaintext: decrypted,
            content: item.ciphertext
          }], currentUserId).catch(() => {});
        } catch {
          const errorEntries: Record<string, string> = {};
          for (const k of item.keys) {
            cacheRef.current[k] = { ciphertext: item.ciphertext, plaintext: '[Decryption Error]' };
            errorEntries[k] = '[Decryption Error]';
          }
          if (isMounted) {
            setDecryptedMap((prev) => ({ ...prev, ...errorEntries }));
          }
        }
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
