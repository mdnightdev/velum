import { useState, useEffect } from 'react';
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
  const [decryptedCiphertexts, setDecryptedCiphertexts] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;
    const processDecryption = async () => {
      const newDecrypted: Record<string, string> = {};
      const newCiphertexts: Record<string, string> = {};
      let changed = false;

      for (const m of messages) {
        if (!m.content || !m.message_id) continue;

        if (decryptedCiphertexts[m.message_id] !== m.content) {
          const peerId = activeChatPeer?.userId || m.user_id;
          try {
            const context: EncryptionContext = {
              type: activeChatPeer ? 'direct' : 'lounge',
              roomId: m.room_id || roomId,
              peerUserId: peerId,
              isEncrypted: !!(m.is_encrypted || (m as any).isEncrypted),
            };
            const decrypted = await decryptMessage(m.content, context);
            if (decrypted) {
              newDecrypted[m.message_id] = decrypted;
              newCiphertexts[m.message_id] = m.content;
              changed = true;
            }
          } catch (err) {
            console.error('[useMessageDecryption] Decryption error:', m.message_id, err);
          }
        }
      }

      if (isMounted && changed) {
        setDecryptedMap((prev) => ({ ...prev, ...newDecrypted }));
        setDecryptedCiphertexts((prev) => ({ ...prev, ...newCiphertexts }));
      }
    };
    processDecryption();
    return () => {
      isMounted = false;
    };
  }, [messages, activeChatPeer?.userId, roomId]);

  const getDecryptedText = (msg: Message) => {
    const val = (msg.message_id && decryptedMap[msg.message_id]) || msg.content || '';
    if (!val) return 'Empty message';
    if (val.startsWith('[Voice Note')) return 'Voice Note';
    if (val.includes('[Attachment:')) {
      const parsed = parseAttachment(val);
      return parsed && parsed.length > 0 ? parsed[0].name || 'Attachment' : 'Attachment';
    }
    return val;
  };

  const encryptOutgoingMessage = async (text: string, context: EncryptionContext) => {
    return await encryptMessage(text, context);
  };

  return {
    decryptedMap,
    getDecryptedText,
    encryptOutgoingMessage,
  };
}
