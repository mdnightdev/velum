import React, { useState, useEffect } from 'react';
import { 
  Plus, LogOut, Users, Settings, Sun, Moon, 
  HelpCircle, Trash, Search, MessageSquare, Compass, Globe,
  Mic, Paperclip, Bell, Bookmark, ShoppingCart, FileText, Home, Wallet,
  ArrowLeft, AtSign, Terminal, X
} from 'lucide-react';
import { stripAt } from '../../types';
import { decryptMessage } from '../../services/encryptionService';
import logoSvg from '../../assets/logo.svg?raw';

interface UserSidebarProps {
  currentUserId: number;
  currentUsername: string;
  currentUserRole: string;
  activeRoomId: string;
  onRoomSelect: (roomId: string) => void;
  onLogout: () => void;
  onSectionView: (view: any) => void;
  activeView: string;
  activeChatPeer: { userId: number; username: string } | null;
  onSelectPeer?: (peer: { userId: number; username: string }) => void;
  onClearChatPeer?: () => void;
  onProfileUpdate?: (updatedUser: any) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  wsConnected: boolean;
  messages: any[];
  onSendMessage: (text: string, burn: any, encrypt: boolean) => void;
  onSendTyping?: (isTyping: boolean) => void;
  onRoomKick?: (uid: number) => void;
  onRoomMute?: (uid: number, mute: boolean) => void;
  onSendReaction?: (msgId: string, room: string, emoji: string) => void;
  onDeleteMessage?: (msgId: string, room: string) => void;
  isMobile?: boolean;
  activePanel?: 'navigation' | 'directory' | 'workspace';
  onPanelChange?: (panel: 'navigation' | 'directory' | 'workspace') => void;
  activeCategory?: 'rooms' | 'direct' | 'market' | 'tickets' | 'saved' | 'people' | 'notifications' | 'settings';
  onCategoryChange?: (category: 'rooms' | 'direct' | 'market' | 'tickets' | 'saved' | 'people' | 'notifications' | 'settings') => void;
  onOpenSettings?: () => void;
  onCloseSidebar?: () => void;
  friendRequests?: any[];
}

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'offline';
  if (lastSeenAt === 'online') return 'online';

  try {
    const lastSeenDate = new Date(lastSeenAt);
    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    if (isNaN(diffMs) || diffMs < 0) return 'offline';

    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch (e) {
    return 'offline';
  }
}

export default function UserSidebar({
  currentUserId,
  currentUsername,
  currentUserRole,
  activeRoomId,
  onRoomSelect,
  onLogout,
  activeChatPeer,
  onSelectPeer,
  onClearChatPeer,
  isDark,
  onToggleTheme,
  messages,
  onOpenSettings,
  onCloseSidebar,
  onCategoryChange,
  activeCategory,
  isMobile,
  activePanel,
  onPanelChange,
  friendRequests = []
}: UserSidebarProps) {

  const [activeTab, setActiveTab] = useState<string>('rooms');

  // Database states

  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [lounges, setLounges] = useState<any[]>([]);
  const [selectedLoungeId, setSelectedLoungeId] = useState<string>('');
  const [peerSearchTerm, setPeerSearchTerm] = useState('');

  interface RecentItem {
    id: string | number;
    name: string;
    type: 'room' | 'dm' | 'market' | 'ticket' | 'saved';
    timestamp: number;
  }

  const [recents, setRecents] = useState<RecentItem[]>(() => {
    try {
      const stored = localStorage.getItem(`velum-sidebar-recents-${currentUserId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.filter((item: any) => item && typeof item === 'object' && item.id && item.name);
        }
      }
    } catch (e) {
      console.warn('Error reading sidebar recents', e);
    }
    return [];
  });

  const [showAllChats, setShowAllChats] = useState<boolean>(false);

  // Track active interactions
  useEffect(() => {
    if (!currentUserId) return;

    let targetItem: RecentItem | null = null;

    if (activeChatPeer) {
      targetItem = {
        id: activeChatPeer.userId,
        name: stripAt(activeChatPeer.username),
        type: 'dm',
        timestamp: Date.now()
      };
    } else if (activeRoomId) {
        // Find lounge
        const lounge = lounges.find(c => c.lounge_id === activeRoomId);
        if (lounge) {
          targetItem = {
            id: activeRoomId,
            name: lounge.name,
            type: 'room',
            timestamp: Date.now()
          };
        }
    } else if (activeCategory && ['market', 'tickets', 'saved'].includes(activeCategory)) {
      const nameMap: Record<string, string> = {
        market: 'Marketplace',
        tickets: 'Support Desk',
        saved: 'Saved Notes'
      };
      targetItem = {
        id: activeCategory,
        name: nameMap[activeCategory],
        type: activeCategory as any,
        timestamp: Date.now()
      };
    }

    if (targetItem) {
      setRecents(prev => {
        const prevArray = Array.isArray(prev) ? prev : [];
        const filtered = prevArray.filter(item => item && !(item.id === targetItem!.id && item.type === targetItem!.type));
        const updated = [targetItem!, ...filtered].slice(0, 8);
        localStorage.setItem(`velum-sidebar-recents-${currentUserId}`, JSON.stringify(updated));
        return updated;
      });
    }
  }, [activeRoomId, activeChatPeer, activeCategory, lounges, currentUserId]);

  // Auto-promote items with unread messages
  useEffect(() => {
    if (!currentUserId || !messages || messages.length === 0) return;

    const newRecentsToAdd: RecentItem[] = [];

    

    // Check Lounges
    lounges.forEach(lounge => {
      const loungeMsgs = messages.filter(m => m && (m.room_id === lounge.lounge_id || (!m.room_id && m.lounge_id === lounge.lounge_id)));
      const loungeUnreads = loungeMsgs.filter(m => m.user_id !== currentUserId && m.status !== 'read').length;
      if (loungeUnreads > 0) {
        newRecentsToAdd.push({ id: lounge.lounge_id, name: lounge.name, type: 'room', timestamp: Date.now() });
      }
    });

    // Check Peers
    registeredUsers.forEach(regUser => {
      if (regUser.user_id === currentUserId) return;
      
      const peerId = Number(regUser.user_id);
      const dmRoomId = peerId === 999 
        ? `dm_velum_${currentUserId}`
        : `dm_${Math.min(currentUserId, peerId)}_${Math.max(currentUserId, peerId)}`;
      
      const peerMsgs = messages.filter(m => m && m.room_id === dmRoomId);
      const peerUnreads = peerMsgs.filter(m => m.user_id !== currentUserId && m.status !== 'read').length;
      
      if (peerUnreads > 0) {
        newRecentsToAdd.push({
          id: peerId,
          name: stripAt(regUser.username),
          type: 'dm',
          timestamp: Date.now()
        });
      }
    });

    if (newRecentsToAdd.length > 0) {
      setRecents(prev => {
        const prevArray = Array.isArray(prev) ? prev : [];
        let updated = [...prevArray];
        let changed = false;
        newRecentsToAdd.forEach(newItem => {
          const exists = updated.some(item => item && item.id === newItem.id && item.type === newItem.type);
          if (!exists) {
            updated = [newItem, ...updated];
            changed = true;
          }
        });
        if (changed) {
          const sliced = updated.slice(0, 10);
          localStorage.setItem(`velum-sidebar-recents-${currentUserId}`, JSON.stringify(sliced));
          return sliced;
        }
        return prevArray;
      });
    }
  }, [messages, lounges, registeredUsers, currentUserId]);

  const getRecentItemDetails = (item: RecentItem) => {
    let subtext = '';
    let previewIcon: React.ReactNode = null;
    let unreadCount = 0;
    let isOnline = false;
    let avatarUrl = '';
    let avatarColor = 'emerald';
    let label = item ? item.name : '';

    if (!item) return { subtext, previewIcon, unreadCount, isOnline, avatarUrl, avatarColor, label };

    if (item.type === 'room') {
      const chanMsgs = (messages || []).filter(m => m && (m.room_id === item.id || (!m.room_id && m.lounge_id === item.id)));
      const lastChanMsg = chanMsgs[chanMsgs.length - 1];
      unreadCount = chanMsgs.filter(m => m.user_id !== currentUserId && m.status !== 'read').length;
      subtext = '';
      if (lastChanMsg) {
        if (lastChanMsg.deleted) {
          subtext = 'deleted message';
        } else {
          let contentClean = decryptMessage(lastChanMsg.content || '', String(item.id), lastChanMsg.is_encrypted || lastChanMsg.isEncrypted).trim();
          subtext = contentClean.length > 25 ? contentClean.substring(0, 25) + '...' : contentClean;
        }
      }
    } else if (item.type === 'dm') {
      const peerId = Number(item.id);
      if (peerId === 999) {
        const dmRoomId = `dm_velum_${currentUserId}`;
        const velumMsgs = (messages || []).filter(m => m && m.room_id === dmRoomId);
        const lastVelumMsg = velumMsgs[velumMsgs.length - 1];
        unreadCount = velumMsgs.filter(m => m.user_id !== currentUserId && m.status !== 'read').length;
        subtext = '';
        isOnline = true;
        if (lastVelumMsg) {
          if (lastVelumMsg.deleted) {
            subtext = 'deleted message';
          } else {
            let contentClean = decryptMessage(lastVelumMsg.content || '', dmRoomId, lastVelumMsg.is_encrypted || lastVelumMsg.isEncrypted).trim();
            subtext = contentClean.length > 25 ? contentClean.substring(0, 25) + '...' : contentClean;
          }
        }
      } else {
        const regUser = registeredUsers.find(u => Number(u.user_id) === peerId);
        if (regUser) {
          label = stripAt(regUser.username);
          isOnline = regUser.last_seen_at === 'online';
          avatarColor = regUser.avatar || 'emerald';
          if (regUser.avatar && (regUser.avatar.startsWith('http') || regUser.avatar.startsWith('data:'))) {
            avatarUrl = regUser.avatar;
          }

          const dmRoomId = `dm_${Math.min(currentUserId, peerId)}_${Math.max(currentUserId, peerId)}`;
          const peerMsgs = (messages || []).filter(m => m && m.room_id === dmRoomId);
          const lastMsg = peerMsgs[peerMsgs.length - 1];
          unreadCount = peerMsgs.filter(m => m.user_id !== currentUserId && m.status !== 'read').length;
          
          subtext = '';
          if (lastMsg) {
            if (lastMsg.deleted) {
              subtext = 'deleted message';
            } else {
              const contentClean = decryptMessage(lastMsg.content || '', dmRoomId, lastMsg.is_encrypted || lastMsg.isEncrypted);
              
              if (contentClean.startsWith('[Voice Note')) {
                subtext = 'Voice Note';
                previewIcon = <Mic className="w-3 h-3 inline mr-1" />;
              } else if (contentClean.includes('[Attachment:')) {
                subtext = 'Attachment';
                previewIcon = <Paperclip className="w-3 h-3 inline mr-1" />;
              } else {
                const preview = contentClean
                  .replace(/\[Attachment:[^\]]+\]/g, '')
                  .replace(/\[Voice Note[^\]]+\]/g, '')
                  .trim();
                subtext = preview.length > 25 ? preview.substring(0, 25) + '...' : preview;
              }
            }
          }
        }
      }
    } else if (item.type === 'market') {
      subtext = '';
    } else if (item.type === 'ticket') {
      subtext = '';
    } else if (item.type === 'saved') {
      subtext = '';
    }

    return { label, subtext, previewIcon, unreadCount, isOnline, avatarUrl, avatarColor };
  };

  useEffect(() => {
    if (activeCategory) {
      setActiveTab(activeCategory);
    }
  }, [activeCategory]);
  
  // Creation forms
  const [newLoungeName, setNewLoungeName] = useState('');
  const [newLoungeDesc, setNewLoungeDesc] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [showCreateLounge, setShowCreateLounge] = useState(false);
  const [showJoinLoungeModal, setShowJoinLoungeModal] = useState(false);
  const [loungeInviteCodeInput, setLoungeInviteCodeInput] = useState('');
  const [loungeStatusMessage, setLoungeStatusMessage] = useState('');

  // User Profile details
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string>('emerald');
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState<string>('');

  const fetchSessionId = () => sessionStorage.getItem('velum-sessionId') || '';
  const headers = {
    'Authorization': `Bearer ${fetchSessionId()}`,
    'Content-Type': 'application/json'
  };

  const handleCreateLounge = async () => {
    if (!newLoungeName.trim()) {
      setStatusMessage('Lounge name is required.');
      return;
    }
    try {
      const sId = fetchSessionId();
      const res = await fetch('/api/lounges', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newLoungeName.trim(),
          description: newLoungeDesc.trim(),
          is_private: 0
        })
      });
      if (res.ok) {
        setNewLoungeName('');
        setNewLoungeDesc('');
        setStatusMessage('');
        setShowCreateLounge(false);
        await loadSidebarData();
      } else {
        const err = await res.json();
        setStatusMessage(err.error || 'Failed to create lounge.');
      }
    } catch (err) {
      console.error('Error creating lounge:', err);
      setStatusMessage('Error creating lounge.');
    }
  };

  const handleJoinLounge = async () => {
    if (!loungeInviteCodeInput.trim()) return;
    try {
      const sId = fetchSessionId();
      const res = await fetch(`/api/lounges/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invite_code: loungeInviteCodeInput })
      });
      
      if (res.ok) {
        setShowJoinLoungeModal(false);
        setLoungeInviteCodeInput('');
        setLoungeStatusMessage('');
        await loadSidebarData();
      } else {
        const err = await res.json();
        setLoungeStatusMessage(err.error || 'Failed to join lounge.');
      }
    } catch (err) {
      console.error('Error joining lounge:', err);
    }
  };

  const loadSidebarData = async () => {
    try {
      const sId = fetchSessionId();
      if (!sId) return;

      const [usersRes, loungesRes, profileRes] = await Promise.all([
        fetch('/api/users', { headers }),
        fetch('/api/lounges', { headers }),
        fetch(`/api/user/${currentUserId}/profile`, { headers })
      ]);

      const safeParseJson = async (res: Response) => {
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          try { return await res.json(); } catch { return null; }
        }
        return null;
      };


      const usersData = await safeParseJson(usersRes);
      if (usersData) {
        const normalized = usersData.map((u: any) => ({
          ...u,
          user_id: u.userId !== undefined ? u.userId : u.user_id,
          userId: u.userId !== undefined ? u.userId : u.user_id
        }));
        setRegisteredUsers(normalized);
      }

      const profileData = await safeParseJson(profileRes);
      if (profileData && profileData.avatar) {
        if (profileData.avatar.startsWith('http') || profileData.avatar.startsWith('data:') || profileData.avatar.startsWith('/')) {
          setCurrentUserAvatarUrl(profileData.avatar);
          setCurrentUserAvatar('custom');
        } else {
          setCurrentUserAvatar(profileData.avatar);
        }
      }

      const commsData = await safeParseJson(loungesRes);
      if (commsData) {
        setLounges(commsData);
        if (!selectedLoungeId && commsData.length > 0) {
          setSelectedLoungeId(commsData[0].lounge_id);
        }
      }
    } catch (e) {
      if (e && typeof e === 'object' && 'name' in e && e.name === 'AbortError') {
        console.log('Sidebar data fetch aborted (expected during rapid unmounts)');
        return;
      }
      console.warn('Error feeding sidebar logs:', e);
    }
  };

  useEffect(() => {
    if (currentUserId) {
      loadSidebarData();
    }
    const interval = setInterval(() => {
      if (currentUserId) {
        loadSidebarData();
      }
    }, 60000);

    const handleProfileUpdateEvent = () => {
      if (currentUserId) {
        loadSidebarData();
      }
    };
    window.addEventListener('velum-profile-updated', handleProfileUpdateEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('velum-profile-updated', handleProfileUpdateEvent);
    };
  }, [currentUserId, selectedLoungeId]);

  if (!currentUserId) {
    return (
      <div className="h-full flex flex-col justify-center items-center bg-velum-900 text-text-secondary font-sans p-4">
        <div className="text-center space-y-2">
          <div className="text-xs uppercase font-bold tracking-wider animate-pulse">Initializing Layout...</div>
        </div>
      </div>
    );
  }

  // Alphabetic Sorting helpers
  const sortedUsers = [...registeredUsers]
    .filter(u => {
      if (u.user_id === currentUserId) return false;
      if (u.user_id === 999 || u.username.toLowerCase() === 'velum' || u.username.toLowerCase() === 'velum-msg') return false;
      const r = u.role || '';
      const isUserAdmin = r === 'SUPPORT_ADMIN' || r === 'SYSTEM_ADMIN' || r === 'LOGIN_ADMIN' || r === 'ADMIN' || r.includes('ADMIN');
      return !isUserAdmin;
    })
    .sort((a, b) => stripAt(a.username).localeCompare(stripAt(b.username)));

  // Calculate pending incoming friend requests count for People badge
  const pendingRequestsCount = (friendRequests || []).filter(
    (r) => r && r.status === 'pending' && Number(r.receiver_id) === currentUserId
  ).length;

  return (
    <div className={`h-full max-h-dvh flex flex-col ${isDark ? 'bg-transparent text-text-primary' : 'bg-transparent text-velum-900'} select-none font-sans`}>
      
      {/* Brand Header with Custom V Logo & Spaced V E L U M */}
      <div className="py-3 px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 shrink-0 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: logoSvg }} />
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-[0.4em] text-text-primary font-display uppercase leading-none">VELUM</span>
            <span className="text-[8px] text-text-secondary font-mono tracking-wider mt-0.5 leading-none">vv2.0.0</span>
          </div>
        </div>
        <p className="text-[10px] text-text-secondary italic mt-1.5 font-sans">Conversations that flow like a veil.</p>
      </div>

      {/* Navigation - Mockup layout (Spacious and Premium) */}
      <div className="px-4 pt-2 pb-2 flex-shrink-0">
        <nav className="space-y-1.5">
          {[
            { id: 'directs', label: 'Directs', icon: <MessageSquare className="w-4.5 h-4.5" /> },
            { id: 'lounge', label: 'Lounge', icon: <Globe className="w-4.5 h-4.5" /> },
            { id: 'market', label: 'Market', icon: <ShoppingCart className="w-4.5 h-4.5" /> },
            { id: 'wallet', label: 'Wallet', icon: <Wallet className="w-4.5 h-4.5" /> },
            { id: 'tickets', label: 'Tickets', icon: <FileText className="w-4.5 h-4.5" /> },
            { id: 'friends', label: 'Friends', icon: <Users className="w-4.5 h-4.5" /> },
          ].map((it) => {
            let isSelected = false;
            if (it.id === 'directs') {
              isSelected = activeCategory === 'direct';
            } else if (it.id === 'lounge') {
              isSelected = activeCategory === 'rooms' && !activeChatPeer;
            } else if (it.id === 'friends') {
              isSelected = activeCategory === 'people';
            } else {
              isSelected = activeCategory === it.id;
            }

            return (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  if (it.id === 'directs') {
                    if (onCategoryChange) onCategoryChange('direct');
                    onRoomSelect('');
                    if (onClearChatPeer) onClearChatPeer();
                  } else if (it.id === 'lounge') {
                    if (onCategoryChange) onCategoryChange('rooms');
                    onRoomSelect('');
                    if (onClearChatPeer) onClearChatPeer();
                  } else if (it.id === 'friends') {
                    if (onCategoryChange) onCategoryChange('people');
                  } else {
                    if (onCategoryChange) onCategoryChange(it.id as any);
                  }
                  if (typeof onCloseSidebar !== 'undefined' && onCloseSidebar) onCloseSidebar();
                }}
                className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-2xl transition duration-150 cursor-pointer select-none ${
                  isSelected
                    ? 'bg-white-10 text-white font-medium shadow-sm' 
                    : 'text-text-secondary hover:bg-white-5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${isSelected ? 'text-accent' : 'text-text-secondary'}`}>
                    {it.icon}
                  </div>
                  <span className="text-sm font-semibold">{it.label}</span>
                </div>

                {it.id === 'friends' && pendingRequestsCount > 0 && (
                  <span className="bg-accent text-velum-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main interactive scroll region */}
      <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-none space-y-6">
        
        {/* RECENT SECTION - EXACT FIGMA MATCH (Max 4 items) */}
        <div className="space-y-3">
          <div className="px-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary font-mono">
              RECENT
            </span>
          </div>

          <div className="space-y-1.5">
            {(Array.isArray(recents) ? recents : []).slice(0, 4).filter(Boolean).map((item) => {
              const details = getRecentItemDetails(item);
              
              let isSelected = false;
              if (item.type === 'dm') {
                isSelected = activeChatPeer?.userId === Number(item.id);
              } else if (item.type === 'room') {
                isSelected = activeRoomId === item.id && !activeChatPeer && activeCategory === 'rooms';
              } else {
                isSelected = activeCategory === item.id;
              }

              return (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  onClick={() => {
                    if (item.type === 'room') {
                      onRoomSelect(item.id as string);
                      if (onClearChatPeer) onClearChatPeer();
                      if (onCategoryChange) onCategoryChange('rooms');
                    } else if (item.type === 'dm') {
                      if (onSelectPeer) onSelectPeer({ userId: Number(item.id), username: item.name });
                      if (onCategoryChange) onCategoryChange('direct');
                    } else {
                      if (onCategoryChange) onCategoryChange(item.type as any);
                      onRoomSelect('');
                      if (onClearChatPeer) onClearChatPeer();
                    }
                    if (isMobile && onCloseSidebar) onCloseSidebar();
                  }}
                  className={`w-full text-left px-4 py-3 rounded-2xl transition duration-150 flex items-center justify-between gap-3 group cursor-pointer ${
                    isSelected 
                      ? 'bg-white-10 text-white shadow-sm' 
                      : 'hover:bg-white-5 text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      {item.type === 'dm' && Number(item.id) === 999 ? (
                        <div className="w-10 h-10 rounded-full bg-black border border-accent/20 flex items-center justify-center shrink-0">
                          <div 
                            className="w-3.5 h-3.5 [&>svg]:w-full [&>svg]:h-full [&_path:first-child]:stroke-[2.5] [&_path:last-child]:stroke-[1.5]" 
                            dangerouslySetInnerHTML={{ __html: logoSvg }} 
                          />
                        </div>
                      ) : item.type === 'dm' ? (
                        details.avatarUrl ? (
                          <img 
                            src={details.avatarUrl} 
                            alt="" 
                            className="w-10 h-10 rounded-full object-cover border border-white-5" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-xs font-mono font-bold uppercase shrink-0 ${
                            details.avatarColor === 'blue' ? 'bg-velum-800 text-accent border-velum-600' :
                            details.avatarColor === 'emerald' ? 'bg-velum-800 text-status-online border-velum-600' :
                            details.avatarColor === 'amber' ? 'bg-velum-800 text-status-away border-velum-600' :
                            details.avatarColor === 'purple' ? 'bg-velum-800 text-accent-secondary border-velum-600' :
                            'bg-velum-850 text-text-secondary border-velum-600'
                          }`}>
                            {item.name.replace('@', '').charAt(0)}
                          </div>
                        )
                      ) : item.type === 'room' ? (
                        <div className="w-10 h-10 rounded-full bg-velum-850 border border-accent/20 flex items-center justify-center font-bold text-xs text-accent shrink-0">
                          Ω
                        </div>
                      ) : item.type === 'market' ? (
                        <div className="w-10 h-10 rounded-full bg-velum-800 border border-white-5 flex items-center justify-center text-text-secondary shrink-0">
                          <ShoppingCart className="w-4.5 h-4.5" />
                        </div>
                      ) : item.type === 'ticket' ? (
                        <div className="w-10 h-10 rounded-full bg-velum-800 border border-white-5 flex items-center justify-center text-text-secondary shrink-0">
                          <FileText className="w-4.5 h-4.5" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-velum-800 border border-white-5 flex items-center justify-center text-text-secondary shrink-0">
                          <Bookmark className="w-4.5 h-4.5" />
                        </div>
                      )}

                      {item.type === 'dm' && (
                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-velum-600 ${
                          details.isOnline ? 'bg-status-online' : 'bg-status-invisible'
                        }`} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 leading-snug">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-text-primary group-hover:text-white'}`}>
                          {details.label}
                        </span>
                        <span className="text-[10px] text-text-secondary font-mono tracking-tight shrink-0 pl-1">
                          {item.type === 'dm' && details.isOnline ? 'Active' : ''}
                        </span>
                      </div>
                      {(details.previewIcon || details.subtext) && (
                        <span className="text-xs text-text-secondary truncate block mt-0.5">
                          {details.previewIcon}
                          {details.subtext}
                        </span>
                      )}
                    </div>
                  </div>

                  {details.unreadCount > 0 && (
                    <span className="bg-accent text-velum-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                      {details.unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Solid Minimalist Footer matching figma mockup layout */}
      <div className="p-4 bg-transparent flex-shrink-0">
        <div className="glass-card p-3 shadow-lg flex items-center justify-between rounded-3xl">
          
          {/* Profile icon avatar bottom-left */}
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={onOpenSettings}
              className="flex items-center gap-3 text-left group cursor-pointer"
              title="Open Profile Settings"
            >
            {currentUserAvatar === 'custom' && currentUserAvatarUrl ? (
              <img 
                src={currentUserAvatarUrl} 
                alt="" 
                className="w-10 h-10 rounded-full object-cover border border-white-10 group-hover:border-accent transition shrink-0" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-mono font-bold uppercase shrink-0 transition ${
                currentUserAvatar === 'blue' ? 'bg-velum-800 text-accent border-velum-600 group-hover:border-accent' :
                currentUserAvatar === 'emerald' ? 'bg-velum-800 text-status-online border-velum-600 group-hover:border-accent' :
                currentUserAvatar === 'amber' ? 'bg-velum-800 text-status-away border-velum-600 group-hover:border-accent' :
                currentUserAvatar === 'purple' ? 'bg-velum-800 text-accent-secondary border-velum-600 group-hover:border-accent' :
                'bg-velum-850 text-text-secondary border-velum-600 group-hover:border-accent'
              }`}>
                {currentUsername.replace('@', '').charAt(0) || 'P'}
              </div>
            )}

            <div className="min-w-0">
              <span className="text-sm font-bold block text-white group-hover:text-accent transition-colors truncate max-w-[85px]">
                {stripAt(currentUsername)}
              </span>
            </div>
          </button>
          </div>

          {/* Settings and Logout icons beside it */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2.5 bg-white-2 hover:bg-white-5 text-text-secondary hover:text-white rounded-2xl transition cursor-pointer"
              title="Profile & Application Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="p-2.5 bg-status-dnd/5 hover:bg-red-500/15 text-red-400/80 hover:text-red-400 rounded-2xl transition cursor-pointer"
              title="Logout Session"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

        </div>
      </div>
      
      {showJoinLoungeModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black-60 backdrop-blur-sm p-4">
          <div className="bg-velum-850 border border-white-10 p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white text-sm font-bold uppercase tracking-wider">Join a Lounge</h3>
              <button onClick={() => setShowJoinLoungeModal(false)} className="text-text-secondary hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            
            <p className="text-xs text-text-secondary font-mono">Enter a valid lounge invite code.</p>
            
            <input 
              type="text" 
              placeholder="LOUNGE CODE" 
              value={loungeInviteCodeInput}
              onChange={e => setLoungeInviteCodeInput(e.target.value.toUpperCase())}
              className="w-full bg-velum-900 border border-white-10 rounded-lg p-3 text-xs text-white uppercase focus:border-accent focus:outline-none tracking-[0.2em] font-mono text-center"
            />
            
            {loungeStatusMessage && <div className="text-accent text-[10px] font-mono text-center">{loungeStatusMessage}</div>}
            
            <button 
              onClick={handleJoinLounge}
              className="w-full bg-accent hover:bg-accent-hover text-velum-900 p-3 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer"
            >
              Verify Code
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
