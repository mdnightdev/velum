import React, { useEffect, useState } from 'react';
import ChatArea from './ChatArea';
import MarketMainDashboard from './SidebarTabs/MarketMainDashboard';
import TicketsMainDashboard from './SidebarTabs/TicketsMainDashboard';
import SavedMainDashboard from './SidebarTabs/SavedMainDashboard';
import PeopleMainDashboard from './SidebarTabs/PeopleMainDashboard';
import NotificationsMainDashboard from './SidebarTabs/NotificationsMainDashboard';
import LoungeMainDashboard from './SidebarTabs/LoungeMainDashboard';
import LoungeWorkspace from './SidebarTabs/LoungeWorkspace';
import DirectMainDashboard from './SidebarTabs/DirectMainDashboard';
import WalletMainDashboard from './SidebarTabs/WalletMainDashboard';
import SettingsDrawer from '../views/UserWorkspace/SettingsDrawer';
import ProfileCard, { toUserProfileData } from './ProfileCard';
import PullToRefresh from './PullToRefresh';
import { MessageSquare, Globe, ShoppingBag, Bell, Menu, Users } from 'lucide-react';
import { statelessE2eeService } from '../services/statelessE2eeService';
import { getSessionId } from '../utils/auth';
import { getLocalKV, setLocalKV, flushLoungeCache, purgeDmMessages } from '../utils/indexedDb';
import { velumToast } from '../utils/toast';
import { mergeLastMessagesMap, getPrimaryDmRoomId, getDmRoomAliases } from '../utils/roomUtils';
import { stripAt } from '../types';
import { useChatStore } from '../stores/chatStore';
import { setPeerMutedLocal } from '../utils/dmPeerPrefs';
import { useDisappearingMessages } from './Chat/hooks/useDisappearingMessages';

interface DashboardLayoutProps {
  user: any;
  isDark: boolean;
  setIsDark: (v: boolean) => void;
  onLogout: () => void;
  activeRoomId: string;
  onRoomSelect: (roomId: string) => void;
  activeChatPeer?: { userId: number; username: string; avatar?: string } | null;
  onSelectPeer?: (peer: { userId: number; username: string; avatar?: string }) => void;
  onClearChatPeer?: () => void;
  onProfileUpdate?: (u: any) => void;
  wsConnected?: boolean;
  messages?: any[];
  lastMessages?: Record<string, any>;
  unreadCounts?: Record<string, number>;
  onSendMessage?: (text: string, burnSeconds: any, isEncrypted: boolean, targetRoomId?: string, replyTo?: string | number) => void;
  onSendTyping?: (isTyping: boolean) => void;
  onRoomKick: (targetUserId: number) => void;
  onRoomMute: (targetUserId: number, mute: boolean) => void;
  onSendReaction?: (messageId: string, roomId: string, emoji: string) => void;
  onEditMessage?: (messageId: string, roomId: string, content: string) => void;
  onDeleteMessage?: (messageId: string, roomId: string) => void;
  onPinMessage?: (messageId: string, roomId: string, pin: boolean) => void;
  onRetryMessage?: (clientMsgId: string) => void;
  onMarkAsRead?: (messageId: string, roomId: string, dbMessageId?: number, sequenceId?: number) => void;
  onMarkAllAsRead?: (roomId: string) => void;
}

export default function DashboardLayout({
  user,
  isDark,
  setIsDark,
  onLogout,
  activeRoomId,
  onRoomSelect,
  activeChatPeer,
  onSelectPeer,
  onClearChatPeer,
  onProfileUpdate,
  wsConnected,
  messages,
  lastMessages: externalLastMessages = {},
  unreadCounts: externalUnreadCounts = {},
  onSendMessage = () => {},
  onSendTyping,
  onRoomKick,
  onRoomMute,
  onSendReaction,
  onEditMessage,
  onDeleteMessage,
  onPinMessage,
  onRetryMessage,
  onMarkAsRead,
  onMarkAllAsRead
}: DashboardLayoutProps) {
  const isMobile = true;
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  
  const [activeLoungeId, setActiveLoungeId] = useState<string>('');
  const [activeLoungeName, setActiveLoungeName] = useState<string>('');

  // Dynamic navigation category
  const [activeCategory, setActiveCategory] = useState<string>('direct');
  const [pendingForwardContent, setPendingForwardContent] = useState<string | null>(null);
  
  // Handshake & peer networks
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [friendRelationships, setFriendRelationships] = useState<any[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [profileCardUser, setProfileCardUser] = useState<any | null>(null);
  const clearRoomMessages = useChatStore((s) => s.clearRoomMessages);
  const setLastMessages = useChatStore((s) => s.setLastMessages);
  const setUnreadCounts = useChatStore((s) => s.setUnreadCounts);

  // Runs even when ChatArea is unmounted (DM list / other tabs)
  useDisappearingMessages(user?.userId ?? null);

  useEffect(() => {
    if (!user?.userId) return;
    void import('../utils/localCacheMaintenance').then(({ scheduleLocalCacheMaintenance }) => {
      scheduleLocalCacheMaintenance(user.userId);
    });
  }, [user?.userId]);

  const handleLoadProfileCard = async (profUser: any) => {
    try {
      const targetUserId = profUser?.userId || profUser?.id || profUser?.user_id;
      const sId = fetchSessionId();
      const res = await fetch(`/v2/user/${targetUserId}/profile`, {
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPeerMutedLocal(
          Number(targetUserId),
          !!data.isMuted,
          data.mutedUntil || null,
          data.muteDuration || null
        );
        setProfileCardUser({
          ...profUser,
          userId: targetUserId,
          id: targetUserId,
          avatarUrl: data.avatarUrl || data.avatar || profUser.avatarUrl || profUser.avatar || '',
          displayName: data.displayName || profUser.displayName || profUser.username,
          bio: data.bio || '',
          location: data.location || '',
          status: data.status || 'Active',
          isMuted: !!data.isMuted,
          mutedUntil: data.mutedUntil || null,
          muteDuration: data.muteDuration || null,
          isBlocked: !!data.isBlocked,
          joinedDate: data.createdAt ? new Date(data.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '',
          stats: data.stats || { loungesCount: 0, connectionsCount: 0 }
        });
      } else {
        setProfileCardUser({
          ...profUser,
          userId: targetUserId,
          id: targetUserId,
          avatarUrl: profUser.avatarUrl || profUser.avatar || ''
        });
      }
    } catch (e) {
      const targetUserId = profUser?.userId || profUser?.id || profUser?.user_id;
      setProfileCardUser({
        ...profUser,
        userId: targetUserId,
        id: targetUserId,
        avatarUrl: profUser?.avatarUrl || profUser?.avatar || ''
      });
    }
  };

  // Notes persistence via user-isolated KV store
  const [savedNotes, setSavedNotes] = useState<string[]>([]);
  const [newSavedNoteText, setNewSavedNoteText] = useState('');
  const [loungeRoomId, setLoungeRoomId] = useState<string>('');

  useEffect(() => {
    if (user?.userId) {
      getLocalKV<string[]>('saved_notes', user.userId).then((notes) => {
        if (notes && Array.isArray(notes)) {
          setSavedNotes(notes);
        }
      }).catch(() => {});
    }
  }, [user?.userId]);

  useEffect(() => {
    if (user?.userId && savedNotes.length > 0) {
      setLocalKV('saved_notes', savedNotes, user.userId).catch(() => {});
    }
  }, [savedNotes, user?.userId]);

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSavedNoteText.trim()) return;
    setSavedNotes(prev => [...prev, newSavedNoteText.trim()]);
    setNewSavedNoteText('');
  };

  const handleDeleteNote = (idx: number) => {
    setSavedNotes(prev => prev.filter((_, i) => i !== idx));
  };

  const fetchSessionId = () => getSessionId();

  const loadPeopleAndRequests = async () => {
    try {
      const sId = fetchSessionId();
      if (!sId) return;
      const headers = {
        'Authorization': `Bearer ${sId}`,
        'Content-Type': 'application/json'
      };
          const [reqRes, relRes] = await Promise.allSettled([
      fetch('/v2/friends/requests', { headers }),
      fetch('/v2/friends/relationships', { headers }),
    ]);

    if (reqRes.status === 'fulfilled' && reqRes.value.ok) {
      const reqData = await reqRes.value.json();
      setFriendRequests(reqData.requests || reqData || []);
    }

    if (relRes.status === 'fulfilled' && relRes.value.ok) {
      const relData = await relRes.value.json();
      setFriendRelationships(relData.relationships || relData || []);
    }

    } catch (err) {
      console.warn('Sync issue in relationship fetching:', err);
    }
  };

  useEffect(() => {
    if (!user?.userId) return;
    statelessE2eeService.setLocalUserId(Number(user.userId));
    loadPeopleAndRequests();
    const ms = wsConnected ? 30000 : 8000;
    const interval = setInterval(loadPeopleAndRequests, ms);
    return () => clearInterval(interval);
  }, [user?.userId, wsConnected]);

  // Silent background revalidation on visibility change, online event, and socket reconnection
  useEffect(() => {
    if (!user?.userId) return;

    const handleSilentRevalidate = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        loadPeopleAndRequests();
      }
    };

    document.addEventListener('visibilitychange', handleSilentRevalidate);
    window.addEventListener('online', handleSilentRevalidate);

    return () => {
      document.removeEventListener('visibilitychange', handleSilentRevalidate);
      window.removeEventListener('online', handleSilentRevalidate);
    };
  }, [user?.userId]);

  useEffect(() => {
    if (wsConnected && user?.userId) {
      loadPeopleAndRequests();
    }
  }, [wsConnected, user?.userId]);

  useEffect(() => {
    if (!user?.userId) return;

    const handleSocialUpdate = () => {
      loadPeopleAndRequests();
    };

    window.addEventListener('velum-social-update', handleSocialUpdate);
    window.addEventListener('velum-profile-update', handleSocialUpdate);

    return () => {
      window.removeEventListener('velum-social-update', handleSocialUpdate);
      window.removeEventListener('velum-profile-update', handleSocialUpdate);
    };
  }, [user?.userId]);

  useEffect(() => {
    const handleOpenCategory = (e: any) => {
      const cat = e.detail?.category;
      if (cat) {
        setActiveCategory(cat);
      }
    };
    window.addEventListener('velum-open-category', handleOpenCategory);
    return () => window.removeEventListener('velum-open-category', handleOpenCategory);
  }, []);

  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());

  const handleRespondFriendRequest = async (requestId: string, action: 'accepted' | 'declined') => {
    if (processingRequests.has(requestId)) return;
    
    setProcessingRequests(prev => new Set(prev).add(requestId));
    try {
      const sId = fetchSessionId();
      const res = await fetch(`/v2/friends/requests/${requestId}/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ response: action })
      });
      if (res.ok) {
        loadPeopleAndRequests();
        const msg = action === 'accepted' ? 'Request accepted.' : 'Request declined.';
        velumToast.success(msg);
      } else {
        const err = await res.json();
        // Ignore "already accepted" duplicate errors silently
        if (!err.error?.includes('already')) {
          velumToast.error(err.error || 'Response error');
        }
      }
    } catch (err) {
      console.error('Failed to respond friend request:', err);
    } finally {
      setProcessingRequests(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const handleSendFriendRequest = async (username: string) => {
    try {
      const sId = fetchSessionId();
      const res = await fetch(`/v2/friends/requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ receiverUsername: username })
      });
      if (res.ok) {
        loadPeopleAndRequests();
        velumToast.success('Friend request sent.');
      } else {
        const err = await res.json();
        velumToast.error(err.error || 'Failed to send request.');
      }
    } catch (err) {
      console.error('Failed to send request:', err);
    }
  };

  const stripAt = (username: string) => username ? username.replace('@', '') : '';

  const computedUnreadCounts = React.useMemo(() => {
    return { ...(externalUnreadCounts || {}) };
  }, [externalUnreadCounts]);

  // Compute last message preview per room (DMs and lounges) — newer wins
  const computedLastMessages = React.useMemo(() => {
    return mergeLastMessagesMap(externalLastMessages, messages);
  }, [messages, externalLastMessages]);

  const totalDmUnread = React.useMemo(() => {
    let sum = 0;
    const countedPeers = new Set<number>();
    const myUid = Number(user?.userId);
    if (!Number.isFinite(myUid)) return 0;

    countedPeers.add(999);
    sum += Math.max(0, Number(computedUnreadCounts[`dm_velum_${myUid}`]) || 0);

    const rels = Array.isArray(friendRelationships) ? friendRelationships : ((friendRelationships as any)?.relationships || []);
    rels.forEach((r: any) => {
      const fid = Number(r.friendId || r.id || r.userId);
      if (!Number.isFinite(fid) || countedPeers.has(fid)) return;
      countedPeers.add(fid);
      const peerKey = `dm_${fid}`;
      const canonical = `dm_${Math.min(myUid, fid)}_${Math.max(myUid, fid)}`;
      if (typeof computedUnreadCounts[peerKey] === 'number') {
        sum += Math.max(0, computedUnreadCounts[peerKey]);
      } else if (typeof computedUnreadCounts[canonical] === 'number') {
        sum += Math.max(0, computedUnreadCounts[canonical]);
      } else if (typeof r.unread_count === 'number') {
        sum += Math.max(0, r.unread_count);
      }
    });

    return sum;
  }, [computedUnreadCounts, friendRelationships, user?.userId]);

  const totalLoungeUnread = React.useMemo(() => {
    let sum = 0;
    Object.entries(computedUnreadCounts || {}).forEach(([key, val]) => {
      if (!key.startsWith('dm_')) sum += Math.max(0, Number(val) || 0);
    });
    return sum;
  }, [computedUnreadCounts]);

  const pendingRequestsCount = React.useMemo(() => {
    return (friendRequests || []).filter(r => r.status === 'pending' && (Number(r.receiver_id) === Number(user?.userId) || !r.receiver_id)).length;
  }, [friendRequests, user?.userId]);

  try {
    return (
      <div className="flex flex-col w-full h-[var(--viewport-height,100dvh)] pt-[env(safe-area-inset-top,0px)] bg-velum-850 text-text-primary overflow-hidden relative font-sans">
        <SettingsDrawer
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentUserId={user ? user.userId : 0}
          currentUsername={user ? user.username : 'Guest'}
          currentUserRole={user ? user.role : 'USER'}
          isDark={isDark}
          onToggleTheme={() => setIsDark(!isDark)}
          onProfileUpdate={onProfileUpdate}
        />

        <main className="flex-1 min-w-0 min-h-0 h-full relative flex flex-col overflow-hidden bg-velum-850 border-none rounded-none text-text-primary">
          <PullToRefresh disabled={(activeCategory === 'rooms' && !!activeLoungeId) || (activeCategory === 'direct' && !!activeChatPeer)}>
          {activeCategory === 'wallet' ? (
            <div className="flex-1 overflow-hidden relative flex flex-col">

              <WalletMainDashboard
                currentUserId={user ? user.userId : 0}
                isDark={isDark}
              />
            </div>
          ) : activeCategory === 'market' ? (
            <div className="flex-1 overflow-y-auto relative flex flex-col">

              <MarketMainDashboard
                currentUserId={user?.userId || 0}
                currentUserRole={user?.role || 'USER'}
                isDark={isDark}
              />
            </div>
          ) : activeCategory === 'tickets' ? (
            <div className="flex-1 overflow-hidden relative flex flex-col">

              <TicketsMainDashboard
                currentUserId={user?.userId || 0}
                isDark={isDark}
              />
            </div>
          ) : activeCategory === 'saved' ? (
            <div className="flex-1 overflow-y-auto relative flex flex-col">

              <SavedMainDashboard
                savedNotes={savedNotes}
                newSavedNoteText={newSavedNoteText}
                setNewSavedNoteText={setNewSavedNoteText}
                isDark={isDark}
                onSaveNote={handleSaveNote}
                onDeleteNote={handleDeleteNote}
                onBack={() => setActiveCategory('direct')}
              />
            </div>
          ) : activeCategory === 'people' ? (
            <div className="flex-1 overflow-hidden relative flex flex-col">

              <PeopleMainDashboard
                friendRequests={friendRequests}
                currentUserId={user?.userId || 0}
                isDark={isDark}
                userSearchTerm={userSearchTerm}
                setUserSearchTerm={setUserSearchTerm}
                handleRespondFriendRequest={handleRespondFriendRequest}
                handleSendFriendRequest={handleSendFriendRequest}
                loadAndShowProfileCard={handleLoadProfileCard}
                forwardMode={Boolean(pendingForwardContent)}
                onCancelForward={() => setPendingForwardContent(null)}
                onSelectPeer={(peer) => {
                  if (pendingForwardContent) {
                    const uid = user?.userId || 0;
                    const dest = getPrimaryDmRoomId(peer.userId, uid);
                    const isEnc = peer.userId !== 999;
                    onSendMessage(pendingForwardContent, null, isEnc, dest);
                    setPendingForwardContent(null);
                    velumToast.success(`Forwarded to ${stripAt(peer.username)}`);
                  }
                  if (onSelectPeer) onSelectPeer(peer);
                  setActiveCategory('direct');
                }}
                onSectionView={(view) => {
                  if (view === 'chat') {
                    setActiveCategory('direct');
                  }
                }}
              />
            </div>
          ) : activeCategory === 'notifications' ? (
            <div className="flex-grow flex-shrink flex-1 min-h-0 overflow-y-auto relative flex flex-col">

              <NotificationsMainDashboard
                friendRequests={friendRequests}
                currentUserId={user?.userId || 0}
                isDark={isDark}
                handleRespondFriendRequest={handleRespondFriendRequest}
              />
            </div>
          ) : activeCategory === 'rooms' ? (
            <div className="flex-grow flex-shrink flex-1 min-h-0 overflow-hidden relative flex flex-col min-w-0">
              
              {activeLoungeId ? (
                <LoungeWorkspace
                  loungeId={activeLoungeId}
                  loungeName={(!activeLoungeName || activeLoungeName.toUpperCase() === 'TEST') ? 'Velum Lounge' : activeLoungeName}
                  currentUserId={user?.userId || 0}
                  currentUsername={user?.username || 'Guest'}
                  currentUserRole={user?.role || 'USER'}
                  activeRoomId={activeRoomId}
                  onRoomSelect={onRoomSelect}
                  onLoungeSelect={(lid, lname) => {
                    setActiveLoungeId(lid);
                    setActiveLoungeName((!lname || lname.toUpperCase() === 'TEST') ? 'Velum Lounge' : lname);
                    onRoomSelect('');
                  }}
                  onBackToDirectory={() => {
                    setActiveLoungeId('');
                    setActiveLoungeName('');
                    onRoomSelect('');
                  }}
                  isDark={isDark}
                  messages={messages || []}
                  lastMessages={(computedLastMessages as any) || {}}
                  unreadCounts={(computedUnreadCounts as any) || {}}
                  wsConnected={!!wsConnected}
                  onSendMessage={onSendMessage}
                  onSendTyping={onSendTyping}
                  onRoomKick={onRoomKick}
                  onRoomMute={onRoomMute}
                  onSendReaction={onSendReaction}
                  onEditMessage={onEditMessage}
                  onDeleteMessage={onDeleteMessage}
                  onPinMessage={onPinMessage}
                  onMarkAsRead={onMarkAsRead}
                  onMarkAllAsRead={onMarkAllAsRead}
                  onRequestForward={(content) => {
                    setPendingForwardContent(content);
                    onRoomSelect('');
                    if (onClearChatPeer) onClearChatPeer();
                    setActiveLoungeId('');
                    setActiveLoungeName('');
                    setActiveCategory('people');
                  }}
                />
              ) : (
                <div className="flex-grow flex-shrink flex-1 min-h-0 overflow-hidden relative flex flex-col">

                  <LoungeMainDashboard
                    currentUserId={user?.userId || 0}
                    isDark={isDark}
                    onLoungeSelect={(loungeId, loungeName) => {
                      setActiveLoungeId(loungeId);
                      setActiveLoungeName((!loungeName || loungeName.toUpperCase() === 'TEST') ? 'Velum Lounge' : loungeName);
                    }}
                    unreadCounts={(computedUnreadCounts as any) || {}}
                    lastMessages={(computedLastMessages as any) || {}}
                  />
                </div>
              )}
            </div>
          ) : activeCategory === 'direct' && !activeChatPeer ? (
            <div className="flex-grow flex-shrink flex-1 min-h-0 overflow-hidden relative flex flex-col min-w-0">

              <DirectMainDashboard
                friendRequests={friendRequests}
                friendRelationships={friendRelationships}
                currentUserId={user?.userId || 0}
                isDark={isDark}
                onSelectPeer={(peer) => {
                  if (onSelectPeer) onSelectPeer(peer);
                }}
                onMarkAsRead={onMarkAsRead}
                unreadCounts={(computedUnreadCounts as any) || {}}
                lastMessages={(computedLastMessages as any) || {}}
                loadAndShowProfileCard={handleLoadProfileCard}
                getCountryOnly={(loc) => {
                  if (!loc) return '';
                  const parts = loc.split(',');
                  return parts[parts.length - 1].trim();
                }}
                onOpenContacts={() => {
                  setActiveCategory('people');
                  onRoomSelect('');
                  if (onClearChatPeer) onClearChatPeer();
                }}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenWallet={() => setActiveCategory('wallet')}
                onOpenSaved={() => setActiveCategory('saved')}
                onLogout={onLogout}
              />
            </div>
          ) : (
            activeCategory === 'rooms' && activeLoungeId ? null :
            <ChatArea
              currentUserId={user?.userId || 0}
              currentUsername={user?.username || 'Guest'}
              currentUserRole={user?.role || 'USER'}
              roomId={activeRoomId}
              wsConnected={!!wsConnected}
              messages={messages || []}
              onSendMessage={onSendMessage}
              onSendTyping={onSendTyping}
              onRoomKick={onRoomKick}
              onRoomMute={onRoomMute}
              onSendReaction={onSendReaction}
              onEditMessage={onEditMessage}
              onDeleteMessage={onDeleteMessage}
              onPinMessage={onPinMessage}
              onRetryMessage={onRetryMessage}
              onMarkAsRead={onMarkAsRead}
              onMarkAllAsRead={onMarkAllAsRead}
              isDark={isDark}
              activeChatPeer={activeChatPeer}
              isMobile={isMobile}
              onSelectProfileUser={handleLoadProfileCard}
              onBackToDeck={() => {
                const wasRoom = activeRoomId && !activeRoomId.startsWith('dm_');
                onRoomSelect('');
                if (onClearChatPeer) onClearChatPeer();
                if (wasRoom) {
                  setActiveCategory('rooms');
                } else {
                  setActiveCategory('direct');
                }
              }}
              onRequestForward={(content) => {
                setPendingForwardContent(content);
                onRoomSelect('');
                if (onClearChatPeer) onClearChatPeer();
                setActiveCategory('people');
              }}
            />
          )}



          {profileCardUser && (
            <ProfileCard
              user={toUserProfileData({
                ...profileCardUser,
                status: profileCardUser.status,
                joinedDate:
                  profileCardUser.joinedDate ||
                  (profileCardUser.created_at
                    ? new Date(profileCardUser.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Recently'),
              })}
              variant={isMobile ? 'mobile' : 'expanded'}
              currentUserId={Number(user?.userId || user?.id || 0) || undefined}
              onClose={() => setProfileCardUser(null)}
              onMessage={() => {
                const targetUid = profileCardUser.userId || profileCardUser.id || profileCardUser.user_id;
                if (onSelectPeer && targetUid) {
                  onSelectPeer({ userId: targetUid, username: profileCardUser.username, avatar: profileCardUser.avatar || profileCardUser.avatarUrl });
                }
                setActiveCategory('direct');
                setProfileCardUser(null);
              }}
              onMute={async (duration?: '24h' | '72h' | '30d' | 'off') => {
                const peerId = Number(profileCardUser.userId);
                const dur = duration || '24h';
                const muted = dur !== 'off';
                // Optimistic — enforce notify suppress immediately
                setPeerMutedLocal(peerId, muted, null, muted ? dur : null);
                setProfileCardUser((prev: any) =>
                  prev
                    ? {
                        ...prev,
                        isMuted: muted,
                        mutedUntil: null,
                        muteDuration: muted ? dur : null,
                      }
                    : null
                );
                try {
                  const sId = fetchSessionId();
                  const res = await fetch(`/v2/user/${profileCardUser.userId}/mute`, {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${sId}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ duration: dur }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setPeerMutedLocal(
                      peerId,
                      !!data.isMuted,
                      data.mutedUntil || null,
                      data.duration || dur
                    );
                    setProfileCardUser((prev: any) =>
                      prev
                        ? {
                            ...prev,
                            isMuted: data.isMuted,
                            mutedUntil: data.mutedUntil || null,
                            muteDuration: data.duration || null,
                          }
                        : null
                    );
                  }
                } catch (e) {}
              }}
              onBlock={async () => {
                try {
                  const sId = fetchSessionId();
                  const res = await fetch(`/v2/user/${profileCardUser.userId}/block`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${sId}` }
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setProfileCardUser((prev: any) => prev ? { ...prev, isBlocked: data.isBlocked } : null);
                    // Keep chat mounted so Unblock remains available on the profile card
                  }
                } catch(e) {}
              }}
              onDeleteChat={async () => {
                const targetId = profileCardUser.userId;
                const aliases =
                  targetId === 999
                    ? getDmRoomAliases(999, user.userId)
                    : getDmRoomAliases(targetId, user.userId);

                try {
                  const sId = fetchSessionId();
                  await fetch(`/v2/user/${targetId}/chat`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${sId}` },
                  });

                  await purgeDmMessages(targetId, user.userId);
                  for (const alias of aliases) {
                    await flushLoungeCache(alias, user.userId);
                    clearRoomMessages(alias);
                  }

                  setLastMessages((prev) => {
                    const next = { ...prev };
                    for (const alias of aliases) delete next[alias];
                    return next;
                  });
                  setUnreadCounts((prev) => {
                    const next = { ...prev };
                    for (const alias of aliases) next[alias] = 0;
                    return next;
                  });

                  window.dispatchEvent(
                    new CustomEvent('velum-dm-cleared', {
                      detail: { peerId: targetId, aliases },
                    })
                  );
                } catch (e) {}
                setProfileCardUser(null);
              }}
              onReport={async (reason?: string, attachments?: string[]) => {
                if (!reason || !reason.trim()) return;
                try {
                  const sId = fetchSessionId();
                  await fetch('/v2/user/report', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${sId}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      targetUserId: profileCardUser.userId,
                      reason: reason.trim(),
                      attachments: attachments || [],
                    }),
                  });
                } catch (e) {}
              }}
            />
          )}
          </PullToRefresh>

          {/* Mobile Bottom Navigation Bar */}
          {!activeRoomId && !activeChatPeer && (
            <nav className="h-14 shrink-0 bg-velum-850 border-t border-white-5 flex items-center justify-around px-2 z-30 pb-[env(safe-area-inset-bottom,0px)]">
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('direct');
                  onRoomSelect('');
                  if (onClearChatPeer) onClearChatPeer();
                }}
                className={`flex-1 flex flex-col items-center justify-center py-1 relative transition cursor-pointer ${
                  activeCategory === 'direct' ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <div className="relative">
                  <MessageSquare className="w-6 h-6" />
                  {totalDmUnread > 0 && (
                    <span className="absolute -top-1 -right-2 bg-accent text-velum-900 text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                      {totalDmUnread > 99 ? '99+' : totalDmUnread}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium mt-0.5">Chats</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveCategory('people');
                  onRoomSelect('');
                  if (onClearChatPeer) onClearChatPeer();
                }}
                className={`flex-1 flex flex-col items-center justify-center py-1 relative transition cursor-pointer ${
                  activeCategory === 'people' ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <div className="relative">
                  <Users className="w-6 h-6" />
                  {pendingRequestsCount > 0 && (
                    <span className="absolute -top-1 -right-2 bg-accent text-velum-900 text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                      {pendingRequestsCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium mt-0.5">Contacts</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveCategory('rooms');
                  onRoomSelect('');
                  if (onClearChatPeer) onClearChatPeer();
                }}
                className={`flex-1 flex flex-col items-center justify-center py-1 relative transition cursor-pointer ${
                  activeCategory === 'rooms' ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <div className="relative">
                  <Globe className="w-6 h-6" />
                  {totalLoungeUnread > 0 && (
                    <span className="absolute -top-1 -right-2 bg-accent text-velum-900 text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                      {totalLoungeUnread > 99 ? '99+' : totalLoungeUnread}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium mt-0.5">Lounges</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveCategory('market');
                  onRoomSelect('');
                  if (onClearChatPeer) onClearChatPeer();
                }}
                className={`flex-1 flex flex-col items-center justify-center py-1 relative transition cursor-pointer ${
                  activeCategory === 'market' ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <ShoppingBag className="w-6 h-6" />
                <span className="text-[10px] font-medium mt-0.5">Market</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveCategory('notifications');
                  onRoomSelect('');
                  if (onClearChatPeer) onClearChatPeer();
                }}
                className={`flex-1 flex flex-col items-center justify-center py-1 relative transition cursor-pointer ${
                  activeCategory === 'notifications' ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <div className="relative">
                  <Bell className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-medium mt-0.5">Alerts</span>
              </button>
            </nav>
          )}
        </main>
      </div>
    );
  } catch (error) {
    console.error('[DashboardLayout] Rendering error:', error);
    return (
      <div className="w-full h-full bg-velum-900 flex items-center justify-center p-4 font-sans">
        <div className="bg-velum-800 border border-velum-600 p-6 rounded-xl max-w-md w-full text-center">
          <h3 className="text-alert-error font-bold mb-2 text-lg">Interface Error</h3>
          <p className="text-text-secondary text-xs break-all font-mono">{String(error)}</p>
        </div>
      </div>
    );
  }
}

