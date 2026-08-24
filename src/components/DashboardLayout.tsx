import React, { useEffect, useState } from 'react';
import UserSidebar from '../views/UserWorkspace/UserSidebar';
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
import { useResponsiveLayout } from '../hooks/useResponsive';
import { BadgeCheck, Terminal, Radio, ShieldCheck, ShieldAlert, Menu } from 'lucide-react';
import { statelessE2eeService } from '../services/statelessE2eeService';
import { getSessionId } from '../utils/auth';
import { getLocalKV, setLocalKV, flushLoungeCache } from '../utils/indexedDb';

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
  onMarkAsRead?: (messageId: string, roomId: string) => void;
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
  const { isMobile: _isMobile, isTablet, isDesktop } = useResponsiveLayout();
  const isMobile = _isMobile || isTablet;
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(!isTablet);
  const toggleSidebarExpand = () => setIsSidebarExpanded(prev => !prev);

  useEffect(() => {
    if (isTablet) {
      setIsSidebarExpanded(false);
    } else if (isDesktop) {
      setIsSidebarExpanded(true);
    }
  }, [isTablet, isDesktop]);
  
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
      const sId = fetchSessionId();
      const res = await fetch(`/v2/user/${profUser.userId}/profile`, {
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfileCardUser({
          ...profUser,
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
          avatarUrl: profUser.avatarUrl || profUser.avatar || ''
        });
      }
    } catch (e) {
      setProfileCardUser({
        ...profUser,
        avatarUrl: profUser.avatarUrl || profUser.avatar || ''
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

  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const closeSidebar = () => setSidebarOpen(false);
  const toggleSidebar = () => setSidebarOpen(s => !s);


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

  try {
    return (
      <div className="flex flex-col md:flex-row w-full h-[var(--viewport-height,100dvh)] bg-velum-900 text-text-primary overflow-hidden relative font-sans">
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



        {/* Mobile Slide-Over Off-Canvas Drawer */}
        {isMobile && sidebarOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div 
              className="fixed inset-0 modal-backdrop transition-opacity"
              onClick={closeSidebar}
            />
            <div className="relative z-10 w-64 max-w-[80vw] h-full bg-velum-850 border-r border-white-5 shadow-2xl flex flex-col overflow-x-hidden animate-in slide-in-from-left duration-200">
              <UserSidebar
                friendRequests={friendRequests}
                currentUserId={user?.userId || 0}
                currentUsername={user?.username || 'Guest'}
                currentUserRole={user?.role || 'USER'}
                currentUserAvatar={user?.avatar}
                activeRoomId={activeRoomId}
                onRoomSelect={(rid) => { 
                  onRoomSelect(rid); 
                  if (rid) {
                    setActiveCategory('rooms');
                    if (onClearChatPeer) onClearChatPeer();
                  }
                  closeSidebar();
                }}
                onLogout={onLogout}
                onSectionView={() => {}}
                activeView="chat"
                activeChatPeer={activeChatPeer || null}
                onSelectPeer={(p) => { 
                  onSelectPeer?.(p); 
                  if (p) {
                    setActiveCategory('direct');
                  }
                  closeSidebar();
                }}
                onClearChatPeer={onClearChatPeer}
                onProfileUpdate={onProfileUpdate}
                isDark={isDark}
                onToggleTheme={() => setIsDark(!isDark)}
                wsConnected={!!wsConnected}
                messages={messages || []}
                onSendMessage={onSendMessage}
                onSendTyping={onSendTyping}
                isMobile={true}
                activePanel={activeCategory === 'rooms' || activeCategory === 'direct' ? 'workspace' : 'directory'}
                onPanelChange={() => {}}
                activeCategory={activeCategory as any}
                onCategoryChange={(cat) => {
                  setActiveCategory(cat);
                  if (cat !== 'rooms' && cat !== 'direct') {
                    onRoomSelect('');
                    if (onClearChatPeer) onClearChatPeer();
                  }
                  closeSidebar();
                }}
                onOpenSettings={() => {
                  setIsSettingsOpen(true);
                  closeSidebar();
                }}
                onCloseSidebar={closeSidebar}
                isSidebarExpanded={true}
                onToggleExpand={closeSidebar}
              />
            </div>
          </div>
        )}

        {/* Desktop / Tablet Navigation Sidebar */}
        {!isMobile && (
          <aside className={`h-full flex flex-col transition-all duration-300 z-30 bg-velum-850 border-r border-velum-600 relative shrink-0 overflow-x-hidden ${
            isSidebarExpanded ? 'w-60 min-w-[240px]' : 'w-14 min-w-[56px]'
          }`}>
            <UserSidebar
              friendRequests={friendRequests}
              currentUserId={user?.userId || 0}
              currentUsername={user?.username || 'Guest'}
              currentUserRole={user?.role || 'USER'}
              currentUserAvatar={user?.avatar}
              activeRoomId={activeRoomId}
              onRoomSelect={(rid) => { 
                onRoomSelect(rid); 
                if (rid) {
                  setActiveCategory('rooms');
                  if (onClearChatPeer) onClearChatPeer();
                }
                closeSidebar();
              }}
              onLogout={onLogout}
              onSectionView={() => {}}
              activeView="chat"
              activeChatPeer={activeChatPeer || null}
              onSelectPeer={(p) => { 
                onSelectPeer?.(p); 
                if (p) {
                  setActiveCategory('direct');
                }
                closeSidebar();
              }}
              onClearChatPeer={onClearChatPeer}
              onProfileUpdate={onProfileUpdate}
              isDark={isDark}
              onToggleTheme={() => setIsDark(!isDark)}
              wsConnected={!!wsConnected}
              messages={messages || []}
              onSendMessage={onSendMessage}
              onSendTyping={onSendTyping}
              isMobile={false}
              activePanel={activeCategory === 'rooms' || activeCategory === 'direct' ? 'workspace' : 'directory'}
              onPanelChange={() => {}}
              activeCategory={activeCategory as any}
              onCategoryChange={(cat) => {
                setActiveCategory(cat);
                if (cat !== 'rooms' && cat !== 'direct') {
                  onRoomSelect('');
                  if (onClearChatPeer) onClearChatPeer();
                }
                closeSidebar();
              }}
              onOpenSettings={() => {
                setIsSettingsOpen(true);
                closeSidebar();
              }}
              onCloseSidebar={closeSidebar}
              isSidebarExpanded={isSidebarExpanded}
              onToggleExpand={toggleSidebarExpand}
            />
          </aside>
        )}

        <main className="flex-1 min-w-0 min-h-0 h-full relative flex flex-col overflow-hidden bg-velum-800 border-none rounded-none text-text-primary">
          <PullToRefresh disabled={(activeCategory === 'rooms' && !!activeLoungeId) || (activeCategory === 'direct' && !!activeChatPeer)}>
          {activeCategory === 'wallet' ? (
            <div className="flex-1 overflow-hidden relative flex flex-col">

              <WalletMainDashboard
                currentUserId={user ? user.userId : 0}
                isDark={isDark}
                onToggleSidebar={toggleSidebar}
              />
            </div>
          ) : activeCategory === 'market' ? (
            <div className="flex-1 overflow-y-auto relative flex flex-col">

              <MarketMainDashboard
                currentUserId={user?.userId || 0}
                currentUserRole={user?.role || 'USER'}
                isDark={isDark}
                onToggleSidebar={toggleSidebar}
              />
            </div>
          ) : activeCategory === 'tickets' ? (
            <div className="flex-1 overflow-hidden relative flex flex-col">

              <TicketsMainDashboard
                currentUserId={user?.userId || 0}
                isDark={isDark}
                onToggleSidebar={toggleSidebar}
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
                onToggleSidebar={toggleSidebar}
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
                onToggleSidebar={toggleSidebar}
              />
            </div>
          ) : activeCategory === 'notifications' ? (
            <div className="flex-grow flex-shrink flex-1 min-h-0 overflow-y-auto relative flex flex-col">

              <NotificationsMainDashboard
                friendRequests={friendRequests}
                currentUserId={user?.userId || 0}
                isDark={isDark}
                handleRespondFriendRequest={handleRespondFriendRequest}
                onToggleSidebar={toggleSidebar}
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
                  onToggleSidebar={toggleSidebar}
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
                    onToggleSidebar={toggleSidebar}
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
                onToggleSidebar={toggleSidebar}
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
              onToggleSidebar={toggleSidebar}
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
                if (onSelectPeer) onSelectPeer({ userId: profileCardUser.userId, username: profileCardUser.username, avatar: profileCardUser.avatar });
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

