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
import { useResponsive } from '../hooks/useResponsive';
import { BadgeCheck, Terminal, Radio, ShieldCheck, ShieldAlert, Menu } from 'lucide-react';
// @ts-ignore
import styles from './DashboardLayout.module.css';

interface DashboardLayoutProps {
  user: any;
  isDark: boolean;
  setIsDark: (v: boolean) => void;
  onLogout: () => void;
  activeRoomId: string;
  onRoomSelect: (roomId: string) => void;
  activeChatPeer?: { userId: number; username: string } | null;
  onSelectPeer?: (peer: { userId: number; username: string }) => void;
  onClearChatPeer?: () => void;
  onProfileUpdate?: (u: any) => void;
  wsConnected?: boolean;
  messages?: any[];
  onSendMessage?: (text: string, burnSeconds: any, isEncrypted: boolean) => void;
  onSendTyping?: (isTyping: boolean) => void;
  onRoomKick: (targetUserId: number) => void;
  onRoomMute: (targetUserId: number, mute: boolean) => void;
  onSendReaction?: (messageId: string, roomId: string, emoji: string) => void;
  onDeleteMessage?: (messageId: string, roomId: string) => void;
  onMarkAsRead?: (messageId: string, roomId: string) => void;
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
  onSendMessage = () => {},
  onSendTyping,
  onRoomKick,
  onRoomMute,
  onSendReaction,
  onDeleteMessage,
  onMarkAsRead
}: DashboardLayoutProps) {
  const { isMobile } = useResponsive();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(true);
  const toggleSidebarExpand = () => setIsSidebarExpanded(prev => !prev);
  
  const [activeLoungeId, setActiveLoungeId] = useState<string>('');
  const [activeLoungeName, setActiveLoungeName] = useState<string>('');

  // Dynamic navigation category
  const [activeCategory, setActiveCategory] = useState<string>('direct');
  
  // Handshake & peer networks
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [profileCardUser, setProfileCardUser] = useState<any | null>(null);

  const handleLoadProfileCard = async (profUser: any) => {
    try {
      const sId = fetchSessionId();
      const res = await fetch(`/api/user/${profUser.userId}/profile`, {
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfileCardUser({
          ...profUser,
          displayName: data.displayName,
          bio: data.bio || '',
          location: data.location || 'Earth',
          status: 'Online',
          isMuted: !!data.isMuted,
          isBlocked: !!data.isBlocked,
          created_at: data.created_at || null,
          stats: { loungesCount: 0, connectionsCount: 0 }
        });
      } else {
        setProfileCardUser(profUser);
      }
    } catch (e) {
      setProfileCardUser(profUser);
    }
  };

  // Notes persistence
  const [savedNotes, setSavedNotes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`velum-notes-${user?.userId || 0}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [newSavedNoteText, setNewSavedNoteText] = useState('');
  const [loungeRoomId, setLoungeRoomId] = useState<string>('');

  useEffect(() => {
    const fetchLoungeDefault = async () => {
      try {
        const sId = fetchSessionId();
        if (!sId) return;
        const headers = { 'Authorization': `Bearer ${sId}` };
        const commsRes = await fetch('/api/lounges', { headers });
        if (commsRes.ok) {
          const commsData = await commsRes.json();
          if (commsData && commsData.length > 0) {
            const firstComm = commsData[0];
            const chanRes = await fetch(`/api/lounges/${firstComm.lounge_id}/rooms`, { headers });
            if (chanRes.ok) {
              const chanData = await chanRes.json();
              if (chanData && chanData.length > 0) {
                setLoungeRoomId(chanData[0].id);
              } else {
                setLoungeRoomId(firstComm.lounge_id);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load default lounge channel:', err);
      }
    };
    if (user?.userId) {
      fetchLoungeDefault();
    }
  }, [user]);

  useEffect(() => {
    if (user?.userId) {
      localStorage.setItem(`velum-noteis-${user.userId}`, JSON.stringify(savedNotes));
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

  const fetchSessionId = () => sessionStorage.getItem('velum-sessionId') || '';

  const loadPeopleAndRequests = async () => {
    try {
      const sId = fetchSessionId();
      if (!sId) return;
      const headers = {
        'Authorization': `Bearer ${sId}`,
        'Content-Type': 'application/json'
      };
      const [reqRes, usersRes] = await Promise.all([
        fetch('/api/friends/requests', { headers }),
        fetch('/api/users', { headers })
      ]);
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setFriendRequests(reqData);
      }
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const normalized = usersData.map((u: any) => ({
          ...u,
          user_id: u.userId !== undefined ? u.userId : u.user_id,
          userId: u.userId !== undefined ? u.userId : u.user_id
        }));
        setRegisteredUsers(normalized);
      }
    } catch (err) {
      console.warn('Sync issue in relationship fetching:', err);
    }
  };

  useEffect(() => {
    if (user?.userId) {
      loadPeopleAndRequests();
      const interval = setInterval(loadPeopleAndRequests, 12000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());

  const handleRespondFriendRequest = async (requestId: string, action: 'accepted' | 'declined') => {
    if (processingRequests.has(requestId)) return;
    
    setProcessingRequests(prev => new Set(prev).add(requestId));
    try {
      const sId = fetchSessionId();
      const res = await fetch(`/api/friends/requests/${requestId}/respond`, {
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
      const res = await fetch(`/api/friends/requests`, {
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

  if (!user || !user.userId) {
    return (
      <div className="w-full h-full bg-velum-900 flex items-center justify-center font-sans">
        <div className="text-center space-y-4 p-6">
          <div className="text-text-secondary text-sm font-mono animate-pulse">Initializing Interface...</div>
        </div>
      </div>
    );
  }
  const computedUnreadCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    const msgs = messages || [];
    msgs.forEach((m) => {
      if (!m || m.user_id === user?.userId || m.status === 'read') return;
      const rId = m.room_id || m.lounge_id;
      if (rId) {
        counts[rId] = (counts[rId] || 0) + 1;
      }
    });
    return counts;
  }, [messages, user?.userId]);

  try {
    return (
      <div className={`flex w-screen h-dvh ${styles.root} ${isDark ? styles.dark : styles.light} overflow-hidden`}>
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
        <aside className={`${styles.sidebar} bg-velum-850 border-r border-white-5 transition-all duration-300 relative z-30 shrink-0 ${
          isSidebarExpanded ? 'w-64 min-w-[256px]' : 'w-20 min-w-[80px]'
        }`}>
          <UserSidebar
            friendRequests={friendRequests}
            currentUserId={user?.userId || 0}
            currentUsername={user?.username || 'Guest'}
            currentUserRole={user?.role || 'USER'}
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
            isMobile={isMobile}
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

        <main className={`${styles.main} glass-panel border-y-0 border-r-0 rounded-none`}>
          <PullToRefresh disabled={(activeCategory === 'rooms' && !!activeLoungeId) || (activeCategory === 'direct' && !!activeChatPeer)}>
          {activeCategory === 'wallet' ? (
            <div className="flex-1 overflow-y-auto relative flex flex-col">

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
            <div className="flex-1 overflow-y-auto relative flex flex-col">

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
            <div className="flex-grow flex-shrink flex-1 min-h-0 overflow-hidden relative flex flex-col">
              
              {activeLoungeId ? (
                <LoungeWorkspace
                  loungeId={activeLoungeId}
                  loungeName={activeLoungeName}
                  currentUserId={user?.userId || 0}
                  currentUsername={user?.username || 'Guest'}
                  currentUserRole={user?.role || 'USER'}
                  activeRoomId={activeRoomId}
                  onRoomSelect={onRoomSelect}
                  onLoungeSelect={(lid, lname) => {
                    setActiveLoungeId(lid);
                    setActiveLoungeName(lname);
                    onRoomSelect('');
                  }}
                  onBackToDirectory={() => {
                    setActiveLoungeId('');
                    setActiveLoungeName('');
                    onRoomSelect('');
                  }}
                  isDark={isDark}
                  messages={messages || []}
                  wsConnected={!!wsConnected}
                  onSendMessage={onSendMessage}
                  onSendTyping={onSendTyping}
                  onRoomKick={onRoomKick}
                  onRoomMute={onRoomMute}
                  onSendReaction={onSendReaction}
                  onDeleteMessage={onDeleteMessage}
                  onMarkAsRead={onMarkAsRead}
                  onToggleSidebar={toggleSidebar}
                />
              ) : (
                <div className="flex-grow flex-shrink flex-1 min-h-0 overflow-hidden relative flex flex-col">

                  <LoungeMainDashboard
                    currentUserId={user?.userId || 0}
                    isDark={isDark}
                    onLoungeSelect={(loungeId, loungeName) => {
                      setActiveLoungeId(loungeId);
                      setActiveLoungeName(loungeName);
                    }}
                  />
                </div>
              )}
            </div>
          ) : activeCategory === 'direct' && !activeChatPeer ? (
            <div className="flex-grow flex-shrink flex-1 min-h-0 overflow-hidden relative flex flex-col">

              <DirectMainDashboard
                friendRequests={friendRequests}
                currentUserId={user?.userId || 0}
                isDark={isDark}
                onSelectPeer={(peer) => {
                  if (onSelectPeer) onSelectPeer(peer);
                }}
                unreadCounts={computedUnreadCounts}
                loadAndShowProfileCard={handleLoadProfileCard}
                getCountryOnly={(loc) => {
                  if (!loc) return 'Poland';
                  const parts = loc.split(',');
                  return parts[parts.length - 1].trim();
                }}
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
              onDeleteMessage={onDeleteMessage}
              onMarkAsRead={onMarkAsRead}
              isDark={isDark}
              activeChatPeer={activeChatPeer}
              onToggleSidebar={toggleSidebar}
              isMobile={isMobile}
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
                username: profileCardUser.username || "Peer",
                displayName: profileCardUser.displayName || profileCardUser.username || "Peer",
                avatarUrl: profileCardUser.avatar,
                bio: profileCardUser.bio || "Secure Node Operator. Communication established via E2EE protocols.",
                location: profileCardUser.location || "Earth",
                joinedDate: profileCardUser.created_at ? new Date(profileCardUser.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : "May 2026",
                status: profileCardUser.status || "Active now",
                isMuted: !!profileCardUser.isMuted,
                isBlocked: !!profileCardUser.isBlocked,
                stats: {
                  loungesCount: profileCardUser.loungesCount || 1,
                  connectionsCount: profileCardUser.connectionsCount || 0
                }
              }}
              variant={isMobile ? 'mobile' : 'expanded'}
              onClose={() => setProfileCardUser(null)}
              onMessage={() => {
                if (onSelectPeer) onSelectPeer({ userId: profileCardUser.userId, username: profileCardUser.username });
                setActiveCategory('direct');
                setProfileCardUser(null);
              }}
              onMute={async () => {
                try {
                  const sId = fetchSessionId();
                  const res = await fetch(`/api/user/${profileCardUser.userId}/mute`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${sId}` }
                  });
                  if (res.ok) {
                    const willBeMuted = !profileCardUser.isMuted;
                    setProfileCardUser({...profileCardUser, isMuted: willBeMuted});
                    if (willBeMuted) {
                      alert(`Muted ${profileCardUser.username}. They can no longer disturb you.`);
                    } else {
                      alert(`Unmuted ${profileCardUser.username}.`);
                    }
                  }
                } catch(e) {}
              }}
              onBlock={async () => {
                try {
                  const sId = fetchSessionId();
                  const res = await fetch(`/api/user/${profileCardUser.userId}/block`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${sId}` }
                  });
                  if (res.ok) {
                    const willBeBlocked = !profileCardUser.isBlocked;
                    setProfileCardUser({...profileCardUser, isBlocked: willBeBlocked});
                    if (willBeBlocked) {
                      alert(`Blocked ${profileCardUser.username}. This peer is now permanently purged from your view.`);
                      if (onRoomSelect) onRoomSelect('');
                      if (onClearChatPeer) onClearChatPeer();
                      setActiveCategory('direct');
                    } else {
                      alert(`Unblocked ${profileCardUser.username}.`);
                    }
                  }
                } catch(e) {}
              }}
              onDeleteChat={async () => {
                try {
                  const sId = fetchSessionId();
                  const res = await fetch(`/api/user/${profileCardUser.userId}/chat`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${sId}` }
                  });
                  if (res.ok) {
                    alert(`Chat with ${profileCardUser.username} securely deleted and purged.`);
                    if (onRoomSelect) onRoomSelect('');
                    if (onClearChatPeer) onClearChatPeer();
                    setActiveCategory('direct');
                  }
                } catch(e) {}
                setProfileCardUser(null);
              }}
              onReport={async () => {
                try {
                  const sId = fetchSessionId();
                  const res = await fetch(`/api/user/${profileCardUser.userId}/report`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${sId}` }
                  });
                  if (res.ok) alert(`Dossier submitted. ${profileCardUser.username} reported to network security.`);
                } catch(e) {}
                setProfileCardUser(null);
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
          <h3 className="text-red-500 font-bold mb-2 text-lg">Interface Error</h3>
          <p className="text-text-secondary text-xs break-all font-mono">{String(error)}</p>
        </div>
      </div>
    );
  }
}

