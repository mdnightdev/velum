import { useState, useEffect } from 'react';
import { getSessionId } from '../../../utils/auth';

interface UseForwardingFriendsProps {
  forwardingMessage: any;
  currentUserId: number;
}

export function useForwardingFriends({
  forwardingMessage,
  currentUserId
}: UseForwardingFriendsProps) {
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  useEffect(() => {
    if (forwardingMessage) {
      setIsLoadingFriends(true);
      const sId = getSessionId();
      fetch('/v2/friends/relationships', {
        headers: { 'Authorization': `Bearer ${sId}` }
      })
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          const list = Array.isArray(data) ? data : (data?.relationships || []);
          const activeFriends = list.filter((r: any) => r.status === 'accepted').map((r: any) => {
            const peer = r.userId === currentUserId ? r.friend : r.user;
            if (!peer) return null;
            return {
              userId: peer.id || peer.user_id || peer.userId,
              username: peer.username,
              displayName: peer.displayName || peer.username,
              avatar: peer.avatarUrl || peer.avatar || ''
            };
          }).filter(Boolean);
          setFriendsList(activeFriends);
        })
        .catch(() => {})
        .finally(() => setIsLoadingFriends(false));
    }
  }, [forwardingMessage, currentUserId]);

  return {
    friendsList,
    isLoadingFriends
  };
}
