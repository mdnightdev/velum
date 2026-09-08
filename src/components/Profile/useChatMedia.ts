import { useEffect, useState } from 'react';
import { getLocalMessages } from '../../utils/indexedDb';
import { getDmRoomAliases, getPrimaryDmRoomId } from '../../utils/roomUtils';
import { extractChatMediaFromMessages, ChatMediaItem } from '../../utils/chatMedia';

export function useChatMedia(peerUserId: number | undefined, currentUserId?: number) {
  const [chatMedia, setChatMedia] = useState<ChatMediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const peerId = peerUserId;
    if (!peerId) {
      setChatMedia([]);
      return;
    }

    setMediaLoading(true);
    (async () => {
      try {
        const roomIds = new Set<string>([`dm_${peerId}`, `dm_${peerId}_${peerId}`]);
        if (peerId === 999) roomIds.add('dm_999');
        if (currentUserId && Number.isFinite(currentUserId)) {
          for (const id of getDmRoomAliases(peerId, currentUserId)) roomIds.add(id);
          roomIds.add(getPrimaryDmRoomId(peerId, currentUserId));
        }
        const batches = await Promise.all(
          Array.from(roomIds).map((roomId) => getLocalMessages(roomId, 250).catch(() => []))
        );
        const merged = batches.flat();
        if (!cancelled) setChatMedia(extractChatMediaFromMessages(merged, 48));
      } catch {
        if (!cancelled) setChatMedia([]);
      } finally {
        if (!cancelled) setMediaLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [peerUserId, currentUserId]);

  return { chatMedia, mediaLoading, setChatMedia };
}
