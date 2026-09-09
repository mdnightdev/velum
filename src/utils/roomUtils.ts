import { isMessageExpired } from './disappearModes';

/**
 * Resolves the target peer user ID from a DM roomId (e.g., 'dm_1022', 'dm_1001_1022', 'dm_velum_123').
 */
export function parseDmPeerId(roomId?: string | null, currentUserId?: number | null): number | null {
  if (!roomId || typeof roomId !== 'string' || !roomId.startsWith('dm_')) return null;
  if (roomId.startsWith('dm_velum_') || roomId === 'dm_999') return 999;
  const parts = roomId.replace('dm_', '').split('_').map(Number).filter(n => !isNaN(n));
  if (parts.length === 1) return parts[0];
  if (parts.length >= 2) {
    if (currentUserId !== undefined && currentUserId !== null && parts[0] === currentUserId) {
      return parts[1];
    }
    // Prefer the peer that is not the current user when both IDs are present
    if (currentUserId !== undefined && currentUserId !== null) {
      if (parts[0] === currentUserId) return parts[1];
      if (parts[1] === currentUserId) return parts[0];
    }
    return parts[0];
  }
  return null;
}

/** All room-id aliases used for a DM pair (WS, pairwise, and legacy orderings). */
export function getDmRoomAliases(peerId: number, currentUserId: number): string[] {
  if (!Number.isFinite(peerId)) return [];
  if (peerId === 999) {
    return [`dm_velum_${currentUserId}`, 'dm_999'];
  }
  const a = Math.min(currentUserId, peerId);
  const b = Math.max(currentUserId, peerId);
  return Array.from(new Set([
    `dm_${peerId}`,
    `dm_${a}_${b}`,
    `dm_${currentUserId}_${peerId}`,
    `dm_${peerId}_${currentUserId}`
  ]));
}

/** Primary room id used for DM previews / unread bumps. */
export function getPrimaryDmRoomId(peerId: number, currentUserId: number): string {
  if (peerId === 999) return `dm_velum_${currentUserId}`;
  return `dm_${peerId}`;
}

/** Whether the open chat is this DM (any alias). */
export function isActiveDmRoom(
  activeRoomId: string | null | undefined,
  peerId: number,
  currentUserId: number
): boolean {
  if (!activeRoomId) return false;
  return getDmRoomAliases(peerId, currentUserId).includes(activeRoomId);
}

export function resolveDmUnreadCount(
  peerId: number,
  currentUserId: number,
  unreadCounts: Record<string, number> | undefined,
  serverUnread?: number
): number {
  const aliases = getDmRoomAliases(peerId, currentUserId);
  const peerKey = peerId === 999 ? `dm_velum_${currentUserId}` : `dm_${peerId}`;

  // Live peer-scoped key is authoritative for WS increments / mark-as-read
  if (unreadCounts && typeof unreadCounts[peerKey] === 'number') {
    return Math.max(0, unreadCounts[peerKey]);
  }

  // Then canonical pairwise / other aliases
  for (const k of aliases) {
    if (k === peerKey) continue;
    if (unreadCounts && typeof unreadCounts[k] === 'number') {
      return Math.max(0, unreadCounts[k]);
    }
  }

  return Math.max(0, typeof serverUnread === 'number' ? serverUnread : 0);
}

export function messageTimestamp(m: any): number {
  if (!m) return 0;
  const t = m.createdAt ?? m.created_at ?? m.timestamp ?? m.created ?? 0;
  if (typeof t === 'number' && Number.isFinite(t)) return t;
  const parsed = new Date(t).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function previewIdentityKeys(msg: any): string[] {
  if (!msg) return [];
  return [msg.db_message_id, msg.id, msg.message_id, msg.client_msg_id]
    .filter((v) => v != null && v !== '')
    .map(String);
}

function isPreviewIgnored(
  msg: any,
  ignoredIds?: ReadonlySet<string> | Record<string, true> | null
): boolean {
  if (!msg || !ignoredIds) return false;
  const keys = previewIdentityKeys(msg);
  if (keys.length === 0) return false;
  if (ignoredIds instanceof Set) return keys.some((id) => ignoredIds.has(id));
  return keys.some((id) => Boolean((ignoredIds as Record<string, true>)[id]));
}

/**
 * True latest DM preview. Live store lastMessages win over relationships payload
 * (server last_message often lacks expires_at and would resurrect purged previews).
 */
export function selectLatestDmMessage(
  friendId: number,
  currentUserId: number,
  lastMessages: Record<string, any> | undefined,
  relationshipLast?: any,
  ignoredIds?: ReadonlySet<string> | Record<string, true> | null,
  nowMs: number = Date.now()
): any | null {
  const storeCandidates: any[] = [];
  for (const k of getDmRoomAliases(friendId, currentUserId)) {
    const msg = lastMessages?.[k];
    if (msg && !isMessageExpired(msg, nowMs) && !isPreviewIgnored(msg, ignoredIds)) {
      storeCandidates.push(msg);
    }
  }
  if (storeCandidates.length > 0) {
    return storeCandidates.reduce((best, cur) =>
      messageTimestamp(cur) >= messageTimestamp(best) ? cur : best
    );
  }

  if (
    relationshipLast &&
    !isMessageExpired(relationshipLast, nowMs) &&
    !isPreviewIgnored(relationshipLast, ignoredIds)
  ) {
    return relationshipLast;
  }
  return null;
}

/**
 * Merge store lastMessages with in-memory message list, keeping the newer
 * message per room key (fixes stale preview when store already has a key).
 */
export function mergeLastMessagesMap(
  external: Record<string, any> | undefined,
  messages: any[] | undefined,
  nowMs: number = Date.now()
): Record<string, any> {
  const map: Record<string, any> = {};
  for (const [k, m] of Object.entries(external || {})) {
    if (m && !isMessageExpired(m, nowMs)) map[k] = m;
  }
  for (const m of messages || []) {
    if (!m || isMessageExpired(m, nowMs)) continue;
    const rId = m.room_id || m.lounge_id;
    if (!rId) continue;
    const existing = map[rId];
    if (!existing || messageTimestamp(m) >= messageTimestamp(existing)) {
      map[rId] = m;
    }
  }
  return map;
}

/**
 * Authoritative unread reconcile: DM keys come only from server map;
 * non-DM keys keep prev then overlay server positives.
 */
export function reconcileUnreadCounts(
  prev: Record<string, number>,
  server: Record<string, number>
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(prev || {})) {
    if (!k.startsWith('dm_') && typeof v === 'number' && v > 0) {
      next[k] = v;
    }
  }
  for (const [k, v] of Object.entries(server || {})) {
    if (typeof v === 'number' && v > 0) {
      next[k] = v;
    }
  }
  return next;
}

/** Mirror Velum / peer unread onto all aliases so UI keys stay consistent. */
export function expandDmUnreadAliases(
  counts: Record<string, number>,
  userId: number
): Record<string, number> {
  const out = { ...counts };
  if (!Number.isFinite(userId)) return out;

  const velumKey = `dm_velum_${userId}`;
  const velumCount = Math.max(out[velumKey] || 0, out['dm_999'] || 0);
  if (velumCount > 0) {
    out[velumKey] = velumCount;
    out['dm_999'] = velumCount;
  }

  for (const [k, v] of Object.entries(counts)) {
    if (!k.startsWith('dm_') || typeof v !== 'number' || v <= 0) continue;
    const peerId = parseDmPeerId(k, userId);
    if (peerId == null || peerId === 999) continue;
    for (const alias of getDmRoomAliases(peerId, userId)) {
      out[alias] = Math.max(out[alias] || 0, v);
    }
  }
  return out;
}

/** Hide deleted chat unless a strictly newer message arrived after delete time. */
export function shouldHideDeletedDm(delTime: number | undefined, lastMessage: any): boolean {
  if (!delTime) return false;
  const msgTime = messageTimestamp(lastMessage);
  return !msgTime || msgTime <= delTime;
}
