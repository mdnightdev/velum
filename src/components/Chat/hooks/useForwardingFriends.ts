import { useState, useEffect } from 'react';
import { getSessionId } from '../../../utils/auth';
import { stripAt } from '../../../types';
import { isHiddenFromUserContacts } from '../../../utils/deletedDms';

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
    if (!forwardingMessage) {
      setFriendsList([]);
      return;
    }
    setIsLoadingFriends(true);
    const sId = getSessionId();
    fetch('/v2/friends/relationships', {
      headers: { Authorization: `Bearer ${sId}` }
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.relationships || [];
        const activeFriends = list
          .filter((r: any) => r.status === 'accepted')
          .map((r: any) => {
            const userId = Number(r.friendId || r.userId || r.user_id || r.id);
            if (!Number.isFinite(userId) || userId === currentUserId) return null;
            if (isHiddenFromUserContacts({ friendId: userId, username: r.username, role: r.role })) {
              return null;
            }
            return {
              userId,
              username: stripAt(r.username || r.displayName || `User #${userId}`),
              displayName: r.displayName || r.username,
              avatar: r.avatarUrl || r.avatar || r.avatar_url || ''
            };
          })
          .filter(Boolean);
        setFriendsList(activeFriends);
      })
      .catch(() => setFriendsList([]))
      .finally(() => setIsLoadingFriends(false));
  }, [forwardingMessage, currentUserId]);

  return {
    friendsList,
    isLoadingFriends
  };
}
