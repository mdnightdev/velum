import { useEffect } from 'react';
import { useChatStore } from '../../../stores/chatStore';
import { deleteLocalMessage, getLocalMessages } from '../../../utils/indexedDb';
import { isMessageExpired } from '../../../utils/disappearModes';
import {
  collectRoomKeysForMessage,
  messageIdentityKeys,
  pickNewestMessage,
} from '../../../utils/roomPreview';
import { parseDmPeerId } from '../../../utils/roomUtils';

/** Purge expired disappearing messages from store + IndexedDB; refresh sidebar preview. */
export function useDisappearingMessages(currentUserId?: number | null) {
  useEffect(() => {
    const refillPreviewFromIdb = async (
      roomKeys: string[],
      purgedIds: Set<string>
    ) => {
      if (!roomKeys.length) return;
      const { lastMessages, setLastMessages } = useChatStore.getState();
      const stillMissing = roomKeys.every((k) => !lastMessages[k]);
      if (!stillMissing) return;

      const primary = roomKeys[0];
      const local = await getLocalMessages(primary, 50, currentUserId || undefined).catch(() => []);
      const candidates = (local || []).filter((m: any) => {
        if (!m) return false;
        if (isMessageExpired(m)) return false;
        const ids = messageIdentityKeys(m);
        if (ids.some((id) => purgedIds.has(id))) return false;
        return true;
      });
      const newest = pickNewestMessage(candidates);
      if (!newest) return;

      setLastMessages((prev) => {
        const next = { ...prev };
        for (const k of roomKeys) {
          next[k] = { ...newest, room_id: k, lounge_id: k };
        }
        return next;
      });
    };

    const tick = () => {
      const purged = useChatStore.getState().purgeExpired(Date.now(), currentUserId);
      if (purged.length === 0) return;

      const purgedIds = new Set<string>();
      const roomsToRefill = new Map<string, string[]>();

      for (const msg of purged) {
        for (const id of messageIdentityKeys(msg)) purgedIds.add(id);
        const id = msg.db_message_id ?? msg.id ?? msg.message_id ?? msg.client_msg_id;
        if (id != null) {
          void deleteLocalMessage(id, currentUserId || undefined);
        }
        const keys = collectRoomKeysForMessage(msg, currentUserId);
        if (keys[0]) roomsToRefill.set(keys[0], keys);
      }

      for (const keys of roomsToRefill.values()) {
        void refillPreviewFromIdb(keys, purgedIds);
      }

      // Notify list UIs that may cache decrypted preview by peer
      if (currentUserId != null) {
        for (const keys of roomsToRefill.values()) {
          const peer = parseDmPeerId(keys[0], currentUserId);
          if (peer != null) {
            window.dispatchEvent(
              new CustomEvent('velum-dm-preview-changed', { detail: { peerId: peer } })
            );
          }
        }
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [currentUserId]);
}
