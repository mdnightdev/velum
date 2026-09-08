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

export function messagesMatch(a: Message | null | undefined, b: Message | null | undefined): boolean {
  if (!a || !b) return false;
  const ka = getMessageKey(a);
  const kb = getMessageKey(b);
  if (ka && kb && ka === kb) return true;
  if (a.message_id && b.message_id && String(a.message_id) === String(b.message_id)) return true;
  if (a.client_msg_id && b.client_msg_id && String(a.client_msg_id) === String(b.client_msg_id)) return true;
  return false;
}
