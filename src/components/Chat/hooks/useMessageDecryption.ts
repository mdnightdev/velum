import { useState, useEffect, useRef } from 'react';
import { Message } from '../../../types';
import { decryptMessage, encryptMessage, EncryptionContext } from '../../../services/encryptionService';
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

    const processDecryption = async () => {
      const pending: Array<{
        id: string;
        ciphertext: string;
        context: EncryptionContext;
      }> = [];

      const syncDecrypted: Record<string, string> = {};

      for (const m of messages) {
        const msgKey = m.message_id || m.client_msg_id || m.nonce;
        if (!m.content || !msgKey) continue;

        const isOutgoing = !!(currentUserId && m.user_id === currentUserId);

        // 1. If plaintext already attached or cached, use it immediately
        if (m.plaintext) {
          cacheRef.current[msgKey] = { ciphertext: m.content, plaintext: m.plaintext };
          syncDecrypted[msgKey] = m.plaintext;
          continue;
        }

        const cached = cacheRef.current[msgKey];
        if (cached && cached.ciphertext === m.content) {
          syncDecrypted[msgKey] = cached.plaintext;
          continue;
        }

        // 2. Do not attempt to run inbound ratchet decryption on our own outgoing messages
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
          id: msgKey,
          ciphertext: m.content,
          context
        });
      }

      // Bound cache size to max 2000 items to prevent memory leaks
      const cacheKeys = Object.keys(cacheRef.current);
      if (cacheKeys.length > 2000) {
        const keysToRemove = cacheKeys.slice(0, cacheKeys.length - 1500);
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
          cacheRef.current[item.id] = { ciphertext: item.ciphertext, plaintext: decrypted };
          if (isMounted) {
            setDecryptedMap((prev) => ({ ...prev, [item.id]: decrypted }));
          }
          // Persist to local storage so page refresh retains plaintext
          saveLocalMessages([{
            id: item.id,
            message_id: item.id,
            room_id: item.context.roomId,
            loungeId: item.context.roomId,
            plaintext: decrypted,
            content: item.ciphertext
          }], currentUserId).catch(() => {});
        } catch {
          cacheRef.current[item.id] = { ciphertext: item.ciphertext, plaintext: '[Decryption Error]' };
          if (isMounted) {
            setDecryptedMap((prev) => ({ ...prev, [item.id]: '[Decryption Error]' }));
          }
        }
      }
    };

    processDecryption();

    return () => {
      isMounted = false;
    };
  }, [messages, activeChatPeer?.userId, roomId, currentUserId]);

  const getDecryptedText = (msg: Message) => {
    const msgKey = msg.message_id || msg.client_msg_id || msg.nonce || '';
    const cached = decryptedMap[msgKey];
      const val = msg.plaintext || (msg as any).client_plaintext || cached;
    if (val) {
      if (val.startsWith('[Voice Note')) return 'Voice Note';
      if (val.includes('[Attachment:')) {
        const parsed = parseAttachment(val);
        return parsed && parsed.length > 0 ? parsed[0].name || 'Attachment' : 'Attachment';
      }
      return val;
    }
    const isCiphertext = msg.content?.startsWith('ratchet:v2:') || msg.content?.startsWith('VEL_E2EE[');
    if (isCiphertext) return '···';
    return msg.content || 'Empty message';
  };

  const encryptOutgoingMessage = async (text: string, context: EncryptionContext) => {
    return await encryptMessage(text, context);
  };

  const preCachePlaintext = (msgKey: string, plaintext: string) => {
    cacheRef.current[msgKey] = { ciphertext: '', plaintext };
    setDecryptedMap((prev) => ({ ...prev, [msgKey]: plaintext }));
  };

  return {
    decryptedMap,
    getDecryptedText,
    encryptOutgoingMessage,
    preCachePlaintext,
  };
}
