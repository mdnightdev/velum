import { useEffect, useRef, useState } from 'react';
import { getLocalMessages } from '../../utils/indexedDb';
import { getDmRoomAliases, getPrimaryDmRoomId, parseDmPeerId } from '../../utils/roomUtils';
import { extractChatMediaFromMessages, ChatMediaItem } from '../../utils/chatMedia';
import { useChatStore } from '../../stores/chatStore';

function messageDedupeKey(m: Record<string, unknown>): string {
  return String(
    m.client_msg_id ||
      m.nonce ||
      m.message_id ||
      m.db_message_id ||
      m.id ||
      `${m.room_id || m.loungeId || ''}_${m.content || m.plaintext || ''}`.slice(0, 160)
  );
}

function buildRoomIds(peerId: number, me: number): Set<string> {
  const roomIds = new Set<string>([`dm_${peerId}`]);
  if (peerId === 999) {
    roomIds.add('dm_999');
    if (me > 0) roomIds.add(`dm_velum_${me}`);
  }
  if (me > 0) {
    for (const id of getDmRoomAliases(peerId, me)) roomIds.add(id);
    roomIds.add(getPrimaryDmRoomId(peerId, me));
  }
  return roomIds;
}

/** Stable fingerprint for this peer's live transcript — avoids remount storms. */
function usePeerLiveFingerprint(peerId: number, me: number): string {
  return useChatStore((s) => {
    if (!peerId) return '';
    const roomIds = buildRoomIds(peerId, me);
    let count = 0;
    let lastKey = '';
    for (const m of s.messages) {
      const room = String(m.room_id || m.lounge_id || '').replace(/^#\s*/, '');
      let match = roomIds.has(room);
      if (!match && me > 0) match = parseDmPeerId(room, me) === peerId;
      if (!match) continue;
      count += 1;
      lastKey = String(m.client_msg_id || m.message_id || m.id || '');
    }
    return `${count}:${lastKey}`;
  });
}

export function useChatMedia(peerUserId: number | undefined, currentUserId?: number) {
  const [chatMedia, setChatMedia] = useState<ChatMediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const peerId = Number(peerUserId);
  const me = Number(currentUserId) || 0;
  const fingerprint = usePeerLiveFingerprint(
    Number.isFinite(peerId) && peerId > 0 ? peerId : 0,
    me
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedPeerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!Number.isFinite(peerId) || peerId <= 0) {
      setChatMedia([]);
      loadedPeerRef.current = null;
      return;
    }

    const roomIds = buildRoomIds(peerId, me);
    const isInitial = loadedPeerRef.current !== peerId;
    if (isInitial) {
      setMediaLoading(true);
      loadedPeerRef.current = peerId;
    }

    const run = async () => {
      try {
        const uidForDb = me > 0 ? me : undefined;
        const batches = await Promise.all(
          Array.from(roomIds).map((roomId) =>
            getLocalMessages(roomId, 500, uidForDb).catch(() => [])
          )
        );

        const live = useChatStore.getState().messages;
        const liveForPeer = live.filter((m) => {
          const room = String(m.room_id || m.lounge_id || '').replace(/^#\s*/, '');
          if (roomIds.has(room)) return true;
          if (me > 0) return parseDmPeerId(room, me) === peerId;
          return false;
        });

        const byKey = new Map<string, Record<string, unknown>>();
        for (const m of [...batches.flat(), ...liveForPeer]) {
          const key = messageDedupeKey(m as Record<string, unknown>);
          const prev = byKey.get(key);
          const next = { ...(prev || {}), ...(m as Record<string, unknown>) };
          if (!(next.plaintext || next.client_plaintext) && prev?.plaintext) {
            next.plaintext = prev.plaintext;
          }
          byKey.set(key, next);
        }

        const merged = Array.from(byKey.values()).map((m) => ({
          ...m,
          plaintext: String(m.plaintext || m.client_plaintext || ''),
          content: String(m.content || m.body || ''),
        }));

        const nextItems = extractChatMediaFromMessages(merged, 0);
        if (!cancelled) {
          setChatMedia((prev) => {
            if (
              prev.length === nextItems.length &&
              prev.every((p, i) => p.id === nextItems[i].id && p.url === nextItems[i].url)
            ) {
              return prev;
            }
            return nextItems;
          });
        }
      } catch {
        if (!cancelled && isInitial) setChatMedia([]);
      } finally {
        if (!cancelled) setMediaLoading(false);
      }
    };

    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Debounce live fingerprint updates; run immediately on peer switch
    if (isInitial) {
      void run();
    } else {
      debounceRef.current = setTimeout(() => void run(), 350);
    }

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [peerId, me, fingerprint]);

  return { chatMedia, mediaLoading, setChatMedia };
}
