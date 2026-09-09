import { Message } from '../../types';

/** Canonical id for reactions, pin, edit, selection match. */
export function getMessageKey(msg: Pick<Message, 'id' | 'message_id' | 'client_msg_id' | 'db_message_id'> | null | undefined): string {
  if (!msg) return '';
  const raw =
    msg.db_message_id ??
    msg.id ??
    msg.message_id ??
    msg.client_msg_id ??
    '';
  return String(raw);
}

/**
 * Stable React list key — prefer client nonce so optimistic → acked does not remount media/previews.
 */
export function getMessageListKey(
  msg:
    | (Pick<Message, 'id' | 'message_id' | 'client_msg_id' | 'db_message_id' | 'user_id' | 'created_at'> & {
        nonce?: string;
      })
    | null
    | undefined,
  index?: number
): string {
  if (!msg) return `msg-${index ?? 0}`;
  const stable = msg.client_msg_id || msg.nonce || msg.db_message_id || msg.message_id || msg.id;
  if (stable != null && String(stable) !== '') return String(stable);
  if (msg.created_at && msg.user_id != null) return `${msg.user_id}-${msg.created_at}`;
  return `msg-${index ?? 0}`;
}

export function messagesMatch(a: Message | null | undefined, b: Message | null | undefined): boolean {
  if (!a || !b) return false;
  const ka = getMessageKey(a);
  const kb = getMessageKey(b);
  if (ka && kb && ka === kb) return true;
  if (a.message_id && b.message_id && String(a.message_id) === String(b.message_id)) return true;
  if (a.client_msg_id && b.client_msg_id && String(a.client_msg_id) === String(b.client_msg_id)) return true;
  return false;
}
