import { useState, useEffect } from 'react';
import { getSessionId } from '../../../utils/auth';
import { createLogger } from '../../../utils/logger';

const log = createLogger('usePeerPresence');

interface UsePeerPresenceProps {
  activeChatPeer?: { userId: number; username: string } | null;
}

export function usePeerPresence({ activeChatPeer }: UsePeerPresenceProps) {
  const [peerPresence, setPeerPresence] = useState<string>('offline');

  useEffect(() => {
    if (!activeChatPeer) return;

    const sessionId = getSessionId();
    fetch(`/v2/user/${activeChatPeer.userId}/status`, {
      headers: {
        'Authorization': `Bearer ${sessionId}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data) {
          setPeerPresence(data.last_seen_at || 'offline');
        }
      })
      .catch((err) => {
        if (err && err.name === 'AbortError') {
          return;
        }
        log.warn('Failed to fetch peer status', { error: (err as Error).message });
      });

    const handlePresence = (e: any) => {
      const { user_id, last_seen_at } = e.detail || {};
      if (activeChatPeer && user_id === activeChatPeer.userId) {
        setPeerPresence(last_seen_at || 'offline');
      }
    };

    window.addEventListener('velum-presence-change', handlePresence);
    return () => window.removeEventListener('velum-presence-change', handlePresence);
  }, [activeChatPeer]);

  return { peerPresence };
}
