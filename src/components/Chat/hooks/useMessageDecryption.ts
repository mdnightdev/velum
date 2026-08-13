import { useState, useEffect, useRef } from 'react';
import { Message } from '../../../types';
import { decryptMessage, encryptMessage, EncryptionContext } from '../../../services/encryptionService';
import { parseAttachment } from '../../../utils/messageParser';

export function useMessageDecryption({
  messages,
  activeChatPeer,
  roomId,
}: {
  messages: Message[];
  activeChatPeer?: { userId: number } | null;
  roomId: string;
}) {
  const [decryptedMap, setDecryptedMap] = useState<Record<string, string>>({});
  const cacheRef = useRef<Record<string, { ciphertext: string; plaintext: string }>>({});

  useEffect(() => {
    let isMounted = true;

    const processDecryption = async () => {
      const pending: Array<{
        id: string;
        ciphertext: string;
        promise: Promise<string>;
      }> = [];

      const syncDecrypted: Record<string, string> = {};

      for (const m of messages) {
        const msgKey = m.message_id || m.client_msg_id || m.nonce;
        if (!m.content || !msgKey) continue;

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
          promise: decryptMessage(m.content, context).catch(() => '[Decryption Error]'),
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

      const results = await Promise.all(
        pending.map(async (item) => ({
          id: item.id,
          ciphertext: item.ciphertext,
          plaintext: await item.promise,
        }))
      );

      if (!isMounted) return;

      const asyncDecrypted: Record<string, string> = {};
      for (const res of results) {
        cacheRef.current[res.id] = { ciphertext: res.ciphertext, plaintext: res.plaintext };
        asyncDecrypted[res.id] = res.plaintext;
      }

      setDecryptedMap((prev) => ({ ...prev, ...asyncDecrypted }));
    };

    processDecryption();

    return () => {
      isMounted = false;
    };
  }, [messages, activeChatPeer?.userId, roomId]);

  const getDecryptedText = (msg: Message) => {
    const msgKey = msg.message_id || msg.client_msg_id || msg.nonce || '';
    const cached = decryptedMap[msgKey];
    const val = msg.plaintext || cached;
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
