import { useCallback } from 'react';
import { Message } from '../types';

export type MessageDeliveryState = 'pending' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export function normalizeMessageState(msg: Message, currentUserId: number): MessageDeliveryState {
  if (msg.status === 'failed') return 'failed';
  if (msg.status === 'sending' || msg.status === 'pending') return 'sending';

  const readByRaw = msg.read_by;
  const readByArr = typeof readByRaw === 'string' 
    ? readByRaw.split(',').map(Number).filter(id => !isNaN(id))
    : (Array.isArray(readByRaw) ? readByRaw.map(Number).filter(id => !isNaN(id)) : []);

  const otherRead = readByArr.some(id => id !== currentUserId);
  if (msg.status === 'read' || otherRead) return 'read';

  const delRaw = msg.delivered_to;
  const deliveredArr = typeof delRaw === 'string'
    ? delRaw.split(',').map(Number).filter(id => !isNaN(id))
    : (Array.isArray(delRaw) ? delRaw.map(Number).filter(id => !isNaN(id)) : []);

  const otherDelivered = deliveredArr.some(id => id !== currentUserId);
  if (msg.status === 'delivered' || otherDelivered) return 'delivered';

  if (msg.status === 'sent' || msg.db_message_id || msg.sequence_id) return 'sent';

  return 'sending';
}

export function useMessageLifecycle(
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  currentUserId: number
) {
  const handleAck = useCallback((ackData: {
    client_msg_id?: string;
    nonce?: string;
    message_id?: string;
    db_message_id?: number;
    sequence_id?: number;
  }) => {
    const targetKey = ackData.client_msg_id || ackData.nonce;
    if (!targetKey) return;

    setMessages(prev => prev.map(m => {
      if (m.nonce === targetKey || m.client_msg_id === targetKey || m.message_id === targetKey) {
        return {
          ...m,
          message_id: ackData.message_id ? String(ackData.message_id) : m.message_id,
          db_message_id: ackData.db_message_id ?? m.db_message_id,
          sequence_id: ackData.sequence_id ?? m.sequence_id,
          client_msg_id: targetKey,
          status: 'sent'
        };
      }
      return m;
    }));
  }, [setMessages]);

  const handleDelivered = useCallback((delData: {
    message_id?: string | number;
    db_message_id?: number;
    receiver_id?: number;
    user_id?: number;
  }) => {
    const targetMsgId = delData.db_message_id || delData.message_id;
    if (!targetMsgId) return;

    const recipient = delData.receiver_id || delData.user_id;

    setMessages(prev => prev.map(m => {
      if (String(m.db_message_id || m.message_id) === String(targetMsgId)) {
        const currentDel = m.delivered_to ? (typeof m.delivered_to === 'string' ? m.delivered_to.split(',') : m.delivered_to) : [];
        if (recipient && !currentDel.map(String).includes(String(recipient))) {
          currentDel.push(String(recipient));
        }
        return {
          ...m,
          delivered_to: currentDel.join(','),
          status: m.status === 'read' ? 'read' : 'delivered'
        };
      }
      return m;
    }));
  }, [setMessages]);

  const handleRead = useCallback((readData: {
    message_id?: string | number;
    last_read_msg_id?: number;
    last_read_seq?: number;
    reader_id?: number;
    user_id?: number;
  }) => {
    const reader = readData.reader_id || readData.user_id;
    const targetSeq = readData.last_read_seq;
    const targetMsgId = readData.last_read_msg_id || readData.message_id;

    setMessages(prev => prev.map(m => {
      let isTarget = false;
      if (targetSeq && m.sequence_id) {
        isTarget = m.sequence_id <= targetSeq;
      } else if (targetMsgId) {
        isTarget = String(m.db_message_id || m.message_id) === String(targetMsgId);
      }

      if (isTarget) {
        const currentRead = m.read_by ? (typeof m.read_by === 'string' ? m.read_by.split(',') : m.read_by) : [];
        if (reader && !currentRead.map(String).includes(String(reader))) {
          currentRead.push(String(reader));
        }
        return {
          ...m,
          read_by: currentRead.join(','),
          status: 'read'
        };
      }
      return m;
    }));
  }, [setMessages]);

  return {
    handleAck,
    handleDelivered,
    handleRead
  };
}
