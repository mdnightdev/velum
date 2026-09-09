import { isMessageExpired } from './disappearModes';
import { getDmRoomAliases, messageTimestamp, parseDmPeerId } from './roomUtils';

export function messageRefEquals(msg: any, idOrKey: string | number | null | undefined): boolean {
  if (!msg || idOrKey == null || idOrKey === '') return false;
  const t = String(idOrKey);
  return [msg.id, msg.message_id, msg.db_message_id, msg.client_msg_id]
    .filter((v) => v != null && v !== '')
    .some((v) => String(v) === t);
}

export function messageIdentityKeys(msg: any): string[] {
  if (!msg) return [];
  return [msg.db_message_id, msg.id, msg.message_id, msg.client_msg_id]
    .filter((v) => v != null && v !== '')
    .map(String);
}

export function normalizeRoomKey(roomId?: string | null): string {
  return String(roomId || '').replace(/^#\s*/, '');
}

/** All room keys that should share the same DM/lounge preview. */
export function collectRoomKeysForMessage(
  msg: { room_id?: string | null; lounge_id?: string | null },
  currentUserId?: number | null,
  hintRoomId?: string | null
): string[] {
  const roomId = normalizeRoomKey(msg.room_id || msg.lounge_id || hintRoomId);
  if (!roomId) return [];
  if (roomId.startsWith('dm_') && currentUserId != null && Number.isFinite(Number(currentUserId))) {
    const peer = parseDmPeerId(roomId, Number(currentUserId));
    if (peer != null) return getDmRoomAliases(peer, Number(currentUserId));
  }
  return [roomId];
}

export function pickNewestMessage<T>(candidates: T[]): T | null {
  if (!candidates.length) return null;
  return candidates.reduce((best, cur) =>
    messageTimestamp(cur) >= messageTimestamp(best) ? cur : best
  );
}

export function isUnreadIncoming(msg: any, currentUserId?: number | null): boolean {
  if (currentUserId == null || !Number.isFinite(Number(currentUserId))) return false;
  const sender = Number(msg?.user_id ?? msg?.senderId ?? msg?.sender);
  if (!Number.isFinite(sender) || sender === Number(currentUserId)) return false;
  if (msg?.status === 'read') return false;
  if (msg?.read_at || msg?.readAt) return false;
  return true;
}

/** Decrement unread on all aliases for a room, keeping aliases aligned. */
export function decrementUnreadForAliases(
  unreadCounts: Record<string, number>,
  roomKeys: string[],
  by = 1
): Record<string, number> {
  if (by <= 0 || roomKeys.length === 0) return unreadCounts;
  let max = 0;
  for (const k of roomKeys) {
    if (typeof unreadCounts[k] === 'number') max = Math.max(max, unreadCounts[k]);
  }
  if (max <= 0) return unreadCounts;

  const next = { ...unreadCounts };
  const newCount = Math.max(0, max - by);
  for (const k of roomKeys) {
    if (newCount === 0) {
      delete next[k];
    } else {
      next[k] = newCount;
    }
  }
  return next;
}

/**
 * After removing a message, set lastMessages for its room aliases to the newest
 * remaining candidate (in-list + other alias previews), or clear them.
 */
export function recomputeLastMessagesAfterRemoval(
  lastMessages: Record<string, any>,
  remainingMessages: any[],
  removed: any,
  currentUserId?: number | null,
  hintRoomId?: string | null
): Record<string, any> {
  const removedIds = new Set(messageIdentityKeys(removed));
  const keys = new Set<string>(collectRoomKeysForMessage(removed, currentUserId, hintRoomId));

  for (const [k, m] of Object.entries(lastMessages || {})) {
    if (!m) continue;
    const pointsAtRemoved = [...removedIds].some((id) => messageRefEquals(m, id));
    if (!pointsAtRemoved) continue;
    keys.add(k);
    for (const a of collectRoomKeysForMessage(m, currentUserId, k)) keys.add(a);
  }

  if (keys.size === 0) return lastMessages;

  const keyList = [...keys];
  const keySet = new Set(keyList);
  const candidates: any[] = [];

  for (const m of remainingMessages || []) {
    if (!m) continue;
    const r = normalizeRoomKey(m.room_id || m.lounge_id);
    if (r && keySet.has(r)) candidates.push(m);
  }

  for (const k of keyList) {
    const m = lastMessages[k];
    if (!m) continue;
    if ([...removedIds].some((id) => messageRefEquals(m, id))) continue;
    candidates.push(m);
  }

  const next = { ...lastMessages };
  const newest = pickNewestMessage(candidates);
  if (!newest) {
    for (const k of keyList) delete next[k];
  } else {
    for (const k of keyList) {
      next[k] = { ...newest, room_id: k, lounge_id: k };
    }
  }
  return next;
}

export type ChatPreviewSlice = {
  messages: any[];
  lastMessages: Record<string, any>;
  unreadCounts: Record<string, number>;
};

/**
 * Drop expired messages from the active list and lastMessages map;
 * recompute previews and decrement unread for purged unread-incoming.
 */
export function purgeExpiredChatState(
  state: ChatPreviewSlice,
  nowMs: number,
  currentUserId?: number | null
): ChatPreviewSlice & { purged: any[] } {
  const purged: any[] = [];
  const seen = new Set<string>();

  const remember = (msg: any, hintRoomId?: string) => {
    if (!msg || !isMessageExpired(msg, nowMs)) return;
    const ids = messageIdentityKeys(msg);
    const dedupeKey = ids[0] || `${hintRoomId || ''}:${messageTimestamp(msg)}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    purged.push({
      ...msg,
      room_id: msg.room_id || msg.lounge_id || hintRoomId,
    });
  };

  for (const m of state.messages || []) remember(m);
  for (const [k, m] of Object.entries(state.lastMessages || {})) remember(m, k);

  if (purged.length === 0) {
    return { ...state, purged };
  }

  let messages = [...(state.messages || [])];
  let lastMessages = { ...(state.lastMessages || {}) };
  let unreadCounts = { ...(state.unreadCounts || {}) };

  for (const removed of purged) {
    const ids = messageIdentityKeys(removed);
    messages = messages.filter(
      (m) => !ids.some((id) => messageRefEquals(m, id))
    );
    lastMessages = recomputeLastMessagesAfterRemoval(
      lastMessages,
      messages,
      removed,
      currentUserId
    );
    if (isUnreadIncoming(removed, currentUserId)) {
      unreadCounts = decrementUnreadForAliases(
        unreadCounts,
        collectRoomKeysForMessage(removed, currentUserId),
        1
      );
    }
  }

  return { messages, lastMessages, unreadCounts, purged };
}
