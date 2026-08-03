import React, { useState, useEffect } from 'react';
import { 
  Plus, LogOut, Users, Settings, Sun, Moon, 
  HelpCircle, Trash, Search, MessageSquare, Compass, Globe,
  Mic, Paperclip, Bell, Bookmark, ShoppingCart, FileText, Home, Wallet,
  ArrowLeft, AtSign, Terminal, X, Menu
} from 'lucide-react';
import { stripAt } from '../../types';
import { decryptMessage } from '../../services/encryptionService';
import logoSvg from '../../assets/logo.svg?raw';
import LoadingFallback from '../../components/LoadingFallback';
import { useLanguage } from '../../i18n/LanguageContext';

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
  activeCategory?: 'rooms' | 'direct' | 'market' | 'tickets' | 'people' | 'notifications' | 'settings' | 'saved';
  onCategoryChange?: (category: 'rooms' | 'direct' | 'market' | 'tickets' | 'people' | 'notifications' | 'settings' | 'saved') => void;
  onOpenSettings?: () => void;
  onCloseSidebar?: () => void;
  friendRequests?: any[];
  isSidebarExpanded?: boolean;
  onToggleExpand?: () => void;
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
  friendRequests = [],
  isSidebarExpanded = true,
  onToggleExpand
}: UserSidebarProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>('rooms');

  // Database states

  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [lounges, setLounges] = useState<any[]>([]);
  const [selectedLoungeId, setSelectedLoungeId] = useState<string>('');
  const [peerSearchTerm, setPeerSearchTerm] = useState('');





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
      if (profileData) {
        const avatarVal = profileData.avatar || '';
        if (avatarVal.startsWith('http') || avatarVal.startsWith('data:') || avatarVal.startsWith('/')) {
          setCurrentUserAvatarUrl(avatarVal);
          setCurrentUserAvatar('custom');
        } else {
          setCurrentUserAvatarUrl('');
          setCurrentUserAvatar(avatarVal || 'charcoal');
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
    return <LoadingFallback />;
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
    <div className={`h-full max-h-dvh flex flex-col ${isDark ? 'bg-transparent text-text-primary' : 'bg-transparent text-velum-900'} select-none font-sans relative`}>
      
      {/* Toggle Collapse button (Desktop only) */}
      

      {/* Brand Header with Custom V Logo & Spaced V E L U M */}
      <div className={`py-4 flex-shrink-0 transition-all ${isSidebarExpanded ? 'px-6' : 'px-0 text-center flex justify-center'}`}>
        {isSidebarExpanded ? (
          <div>
          
                      {/* 1. ADD THE HAMBURGER BUTTON RIGHT HERE */}
                      <button 
                          onClick={onToggleExpand} 
                          className="mb-4 text-text-secondary hover:text-accent transition-colors"
                      >
                          <Menu className="w-5 h-5" />
                      </button>
          
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 shrink-0 [&>svg]:w-full [&>svg]:h-full text-accent" dangerouslySetInnerHTML={{ __html: logoSvg }} />
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-[0.4em] text-text-primary font-display uppercase leading-none">VELUM</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3">
            <button
                onClick={onToggleExpand}
                className="text-text-secondary hover:text-accent transition-colors"
            >
                <Menu className="w-5 h-5" />
            </button>
            <div className="w-6 h-6 shrink-0 [&>svg]:w-full [&>svg]:h-full text-accent" dangerouslySetInnerHTML={{ __html: logoSvg }} />
            
          </div>
        )}
      </div>

      {/* Navigation - Mockup layout (Spacious and Premium) */}
      <div className="px-4 pt-2 pb-2 flex-shrink-0">
        <nav className="space-y-1.5">
          {[
            { id: 'directs', label: t('nav.directs', 'Directs'), icon: <MessageSquare className="w-4.5 h-4.5" /> },
            { id: 'lounge', label: t('nav.lounge', 'Lounge'), icon: <Globe className="w-4.5 h-4.5" /> },
            { id: 'market', label: t('nav.market', 'Market'), icon: <ShoppingCart className="w-4.5 h-4.5" /> },
            { id: 'wallet', label: t('nav.wallet', 'Wallet'), icon: <Wallet className="w-4.5 h-4.5" /> },
            { id: 'tickets', label: t('nav.tickets', 'Tickets'), icon: <FileText className="w-4.5 h-4.5" /> },
            { id: 'friends', label: t('nav.friends', 'Friends'), icon: <Users className="w-4.5 h-4.5" /> },
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
                className={`w-full text-left flex items-center transition duration-150 cursor-pointer select-none ${
                  isSidebarExpanded 
                    ? 'px-4 py-3 justify-between rounded-2xl' 
                    : 'w-11 h-11 mx-auto justify-center rounded-xl'
                } ${
                  isSelected
                    ? 'bg-white-10 text-white font-medium shadow-sm' 
                    : 'text-text-secondary hover:bg-white-5 hover:text-white'
                }`}
                title={!isSidebarExpanded ? it.label : undefined}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${isSelected ? 'text-accent' : 'text-text-secondary'}`}>
                    {it.icon}
                  </div>
                  {isSidebarExpanded && <span className="text-sm font-semibold">{it.label}</span>}
                </div>

                {isSidebarExpanded && it.id === 'friends' && pendingRequestsCount > 0 && (
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
        

      </div>

      {/* Solid Minimalist Footer matching figma mockup layout */}
      <div className={`p-4 bg-transparent flex-shrink-0 transition-all ${isSidebarExpanded ? 'px-4' : 'px-0 text-center flex justify-center'}`}>
        <div className={`glass-card p-3 shadow-lg flex items-center justify-between transition-all ${
          isSidebarExpanded ? 'rounded-3xl w-full' : 'rounded-2xl flex-col gap-3 justify-center w-12 mx-auto px-1'
        }`}>
          
          {/* Profile icon avatar bottom-left */}
          <div className="flex items-center justify-center">
            <button 
              type="button"
              onClick={onOpenSettings}
              className={`flex items-center text-left group cursor-pointer ${isSidebarExpanded ? 'gap-3' : 'justify-center'}`}
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
              <div className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 transition ${
                currentUserAvatar === 'blue' ? 'bg-velum-800 text-accent border-velum-600 group-hover:border-accent' :
                currentUserAvatar === 'emerald' ? 'bg-velum-800 text-status-online border-velum-600 group-hover:border-accent' :
                currentUserAvatar === 'amber' ? 'bg-velum-800 text-status-away border-velum-600 group-hover:border-accent' :
                currentUserAvatar === 'purple' ? 'bg-velum-800 text-accent-secondary border-velum-600 group-hover:border-accent' :
                'bg-velum-850 text-accent border-velum-600 group-hover:border-accent'
              }`}>
                <div className="w-5 h-5 [&>svg]:w-full [&>svg]:h-full text-current" dangerouslySetInnerHTML={{ __html: logoSvg }} />
              </div>
            )}

            {isSidebarExpanded && (
              <div className="min-w-0">
                <span className="text-sm font-bold block text-white group-hover:text-accent transition-colors truncate max-w-[85px]">
                  {stripAt(currentUsername)}
                </span>
              </div>
            )}
            </button>
          </div>

          {/* Settings and Logout icons beside it */}
          <div className={`flex items-center gap-1.5 ${isSidebarExpanded ? '' : 'flex-col gap-3'}`}>
            {isSidebarExpanded && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-2.5 bg-white-2 hover:bg-white-5 text-text-secondary hover:text-white rounded-2xl transition cursor-pointer"
                title="Profile & Application Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
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
