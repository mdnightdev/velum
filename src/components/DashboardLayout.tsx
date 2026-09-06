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
import ProfileCard from './ProfileCard';
import PullToRefresh from './PullToRefresh';
import { MessageSquare, Compass, ShoppingBag, Bell, Menu } from 'lucide-react';
import { statelessE2eeService } from '../services/statelessE2eeService';
import { getSessionId } from '../utils/auth';
import { getLocalKV, setLocalKV, flushLoungeCache, purgeDmMessages } from '../utils/indexedDb';

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
  
  // Handshake & peer networks
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [friendRelationships, setFriendRelationships] = useState<any[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [profileCardUser, setProfileCardUser] = useState<any | null>(null);

  const handleLoadProfileCard = async (profUser: any) => {
    try {
      const targetUserId = profUser?.userId || profUser?.id || profUser?.user_id;
      const sId = fetchSessionId();
      const res = await fetch(`/v2/user/${targetUserId}/profile`, {
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) {
        const data = await res.json();
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
      setFriendRelationships(relData);
    }

    } catch (err) {
      console.warn('Sync issue in relationship fetching:', err);
    }
  };

  useEffect(() => {
    if (user?.userId) {
      statelessE2eeService.setLocalUserId(Number(user.userId));
      statelessE2eeService.initLocalIdentityKeys(Number(user.userId)).catch(console.error);
      loadPeopleAndRequests();
      const interval = setInterval(loadPeopleAndRequests, 45000);
      return () => clearInterval(interval);
    }
  }, [user]);

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
      } else {
        const err = await res.json();
        // Ignore "already accepted" duplicate errors silently
        if (!err.error?.includes('already')) {
          window.alert(err.error || 'Response error');
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
        window.alert('Friend request sent.');
      } else {
        const err = await res.json();
        window.alert(err.error || 'Failed to send request.');
      }
    } catch (err) {
      console.error('Failed to send request:', err);
    }
  };

  const stripAt = (username: string) => username ? username.replace('@', '') : '';

  const computedUnreadCounts = React.useMemo(() => {
    return { ...(externalUnreadCounts || {}) };
  }, [externalUnreadCounts]);

  // Compute last message preview per room (DMs and lounges)
  const computedLastMessages = React.useMemo(() => {
    const map: Record<string, any> = { ...(externalLastMessages || {}) };
    const msgs = (messages || []).slice();
    // sort by timestamp/created_at if present
    msgs.sort((a: any, b: any) => {
      const ta = a.timestamp || a.created_at || 0;
      const tb = b.timestamp || b.created_at || 0;
      return (ta > tb) ? -1 : (ta < tb ? 1 : 0);
    });
    msgs.forEach((m: any) => {
      const rId = m.room_id || m.lounge_id;
      if (!rId) return;
      if (!map[rId]) {
        map[rId] = m;
      }
    });
    return map;
  }, [messages, externalLastMessages]);

  const totalDmUnread = React.useMemo(() => {
    let sum = 0;
    Object.entries(computedUnreadCounts || {}).forEach(([key, val]) => {
      if (key.startsWith('dm_')) sum += Math.max(0, Number(val) || 0);
    });
    return sum;
  }, [computedUnreadCounts]);

  const totalLoungeUnread = React.useMemo(() => {
    let sum = 0;
    Object.entries(computedUnreadCounts || {}).forEach(([key, val]) => {
      if (!key.startsWith('dm_')) sum += Math.max(0, Number(val) || 0);
    });
    return sum;
  }, [computedUnreadCounts]);

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
                registeredUsers={registeredUsers}
                currentUserId={user?.userId || 0}
                isDark={isDark}
                userSearchTerm={userSearchTerm}
                setUserSearchTerm={setUserSearchTerm}
                handleRespondFriendRequest={handleRespondFriendRequest}
                handleSendFriendRequest={handleSendFriendRequest}
                loadAndShowProfileCard={handleLoadProfileCard}
                onSelectPeer={(peer) => {
                  if (onSelectPeer) onSelectPeer(peer);
                  setActiveCategory('direct');
                }}
                onSectionView={(view) => {
                  if (view === 'chat') {
                    setActiveCategory('direct');
                  }
                }}
                getCountryOnly={(loc) => {
                  if (!loc) return 'Poland';
                  const parts = loc.split(',');
                  return parts[parts.length - 1].trim();
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
            />
          )}



          {profileCardUser && (
            <ProfileCard
                      user={{
          userId: profileCardUser.userId,
          username: profileCardUser.username || '',
          displayName: profileCardUser.displayName || profileCardUser.username || '',
          avatarUrl: profileCardUser.avatar,
          bio: profileCardUser.bio || '',
          location: profileCardUser.location || '',
          joinedDate: profileCardUser.created_at 
            ? new Date(profileCardUser.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) 
            : 'Recently',
          status: profileCardUser.status || 'Offline',
          isMuted: !!profileCardUser.isMuted,
          isBlocked: !!profileCardUser.isBlocked,
          stats: {
            loungesCount: profileCardUser.loungesCount ?? 0,
            connectionsCount: profileCardUser.connectionsCount ?? 0,
          },
        }}
              variant={isMobile ? 'mobile' : 'expanded'}
              onClose={() => setProfileCardUser(null)}
              onMessage={() => {
                const targetUid = profileCardUser.userId || profileCardUser.id || profileCardUser.user_id;
                if (onSelectPeer && targetUid) {
                  onSelectPeer({ userId: targetUid, username: profileCardUser.username, avatar: profileCardUser.avatar || profileCardUser.avatarUrl });
                }
                setActiveCategory('direct');
                setProfileCardUser(null);
              }}
              onMute={async () => {
                try {
                  const sId = fetchSessionId();
                  const res = await fetch(`/v2/user/${profileCardUser.userId}/mute`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${sId}` }
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setProfileCardUser((prev: any) => prev ? { ...prev, isMuted: data.isMuted } : null);
                  }
                } catch(e) {}
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
                    if (data.isBlocked) {
                      if (onRoomSelect) onRoomSelect('');
                      if (onClearChatPeer) onClearChatPeer();
                    }
                  }
                } catch(e) {}
              }}
              onDeleteChat={async () => {
                const targetId = profileCardUser.userId;
                const dmRoomId = targetId === 999 
                  ? `dm_velum_${user.userId}`
                  : `dm_${Math.min(user.userId, targetId)}_${Math.max(user.userId, targetId)}`;

                try {
                  const sId = fetchSessionId();
                  // 1. Hard purge from server database
                  await fetch(`/v2/user/${targetId}/chat`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${sId}` }
                  });

                  // 2. Wipe local device cache for this DM room
                  await purgeDmMessages(targetId, user.userId);
                  await flushLoungeCache(dmRoomId, user.userId);

                  // 3. Mark deletion timestamp in localStorage
                  try {
                    const saved = localStorage.getItem(`velum_deleted_dms_${user.userId}`);
                    const map = saved ? JSON.parse(saved) : {};
                    map[targetId] = Date.now();
                    localStorage.setItem(`velum_deleted_dms_${user.userId}`, JSON.stringify(map));
                  } catch {}

                  if (onRoomSelect) onRoomSelect('');
                  if (onClearChatPeer) onClearChatPeer();
                  setActiveCategory('direct');
                } catch(e) {}
                setProfileCardUser(null);
              }}
              onReport={async (reason?: string, attachments?: string[]) => {
                if (!reason || !reason.trim()) return;
                try {
                  const sId = fetchSessionId();
                  await fetch('/v2/user/report', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${sId}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetUserId: profileCardUser.userId, reason: reason.trim(), attachments: attachments || [] })
                  });
                } catch(e) {}
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
                  setActiveCategory('rooms');
                  onRoomSelect('');
                  if (onClearChatPeer) onClearChatPeer();
                }}
                className={`flex-1 flex flex-col items-center justify-center py-1 relative transition cursor-pointer ${
                  activeCategory === 'rooms' ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <div className="relative">
                  <Compass className="w-6 h-6" />
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
                  {friendRequests.length > 0 && (
                    <span className="absolute -top-1 -right-2 bg-alert-error text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                      {friendRequests.length}
                    </span>
                  )}
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

