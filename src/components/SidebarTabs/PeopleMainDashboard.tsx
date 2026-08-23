import React, { useState, useEffect, useMemo } from 'react';
import { Search, Sliders, UserPlus, MessageSquare, MoreHorizontal, Unlock, UserCheck, Check, X, Shield, Globe, Menu } from 'lucide-react';
import { FriendRequest, stripAt } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';

interface PeopleMainDashboardProps {
  friendRequests: FriendRequest[];
  registeredUsers: any[];
  currentUserId: number;
  isDark?: boolean;
  userSearchTerm: string;
  setUserSearchTerm: (v: string) => void;
  handleRespondFriendRequest: (requestId: string, action: 'accepted' | 'declined') => void;
  handleSendFriendRequest: (username: string) => void;
  loadAndShowProfileCard: (user: any) => void;
  onSelectPeer: (peer: { userId: number; username: string; avatar?: string }) => void;
  onSectionView: (view: string) => void;
  getCountryOnly: (loc: string | null) => string;
  onToggleSidebar?: () => void;
}

import { formatLastSeen } from '../../utils/datetime';
import { parsePresence } from '../../utils/presence';
import { getSessionId } from '../../utils/auth';

export default function PeopleMainDashboard({
  friendRequests,
  registeredUsers,
  currentUserId,
  isDark = true,
  userSearchTerm,
  setUserSearchTerm,
  handleRespondFriendRequest,
  handleSendFriendRequest,
  loadAndShowProfileCard,
  onSelectPeer,
  onSectionView,
  getCountryOnly,
  onToggleSidebar
}: PeopleMainDashboardProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'all' | 'online' | 'pending' | 'blocked'>('all');
  const [relationships, setRelationships] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUsernameInput, setAddUsernameInput] = useState('');
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchRelationships = async () => {
      try {
        const sId = getSessionId();
        const res = await fetch('/v2/friends/relationships', {
          headers: { 'Authorization': `Bearer ${sId}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setRelationships(data);
          } else if (data && Array.isArray(data.relationships)) {
            setRelationships(data.relationships);
          } else {
            setRelationships([]);
          }
        }
      } catch (err) {
        console.error(err);
        setRelationships([]);
      }
    };
    fetchRelationships();
    const intv = setInterval(fetchRelationships, 15000);
    return () => clearInterval(intv);
  }, []);

  const handleUnblock = async (targetId: number) => {
    try {
      const sId = getSessionId();
      await fetch('/v2/friends/unblock', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: targetId })
      });
      setRelationships(prev => prev.filter(r => !(r.friendId === targetId && r.status === 'blocked')));
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusNode = (lastSeen: string | null, activeLounge?: string) => {
    if (activeLounge) {
      return (
        <div className="flex items-center gap-1.5 mt-1">
          <span className="w-2.5 h-2.5 rounded-full bg-bank-accent" />
          <span className="text-[10px] font-bold text-status-away bg-status-away-bg px-1.5 py-0.5 rounded-sm">
            {activeLounge}
          </span>
        </div>
      );
    }

    const presence = parsePresence(lastSeen);
    const isRing = presence.dotStyle === 'ring';
    const label = presence.status === 'offline' ? `Offline • ${formatLastSeen(lastSeen)}` : presence.label;

    return (
      <div className="flex items-center gap-1.5 mt-1">
        <span className={`w-2.5 h-2.5 rounded-full ${isRing ? 'border-[2.5px] bg-transparent' : ''} ${presence.colorClass}`} />
        <span className="text-[11px] font-medium text-text-secondary">{label}</span>
      </div>
    );
  };

  const safeRequests = Array.isArray(friendRequests) ? friendRequests : [];
  const safeRelationships = Array.isArray(relationships) ? relationships : [];

  const pendingIncoming = useMemo(() => {
    return safeRequests.filter(r => Number(r.receiver_id) === currentUserId && r.status === 'pending');
  }, [safeRequests, currentUserId]);

  const activeFriends = useMemo(() => {
    const seen = new Set();
    return safeRelationships.filter(r => {
      if (r.status !== 'accepted') return false;
      if (seen.has(r.friendId)) return false;
      seen.add(r.friendId);
      return true;
    });
  }, [safeRelationships]);

  
  const blockedUsers = useMemo(() => {
    return safeRelationships.filter(r => r.status === 'blocked');
  }, [safeRelationships]);

  const onlineFriends = useMemo(() => {
    return activeFriends.filter(r => r.last_seen_at === 'online' || r.last_seen_at === 'idle' || r.last_seen_at === 'dnd');
  }, [activeFriends]);

  let displayData: any[] = [];
  if (activeTab === 'all') {
    displayData = activeFriends.filter(f => !userSearchTerm || f.username.toLowerCase().includes(userSearchTerm.toLowerCase()));
  } else if (activeTab === 'online') {
    displayData = onlineFriends.filter(f => !userSearchTerm || f.username.toLowerCase().includes(userSearchTerm.toLowerCase()));
  } else if (activeTab === 'pending') {
    displayData = pendingIncoming.filter(f => !userSearchTerm || (f.sender_name && f.sender_name.toLowerCase().includes(userSearchTerm.toLowerCase())));
  } else if (activeTab === 'blocked') {
    displayData = blockedUsers.filter(f => !userSearchTerm || f.username.toLowerCase().includes(userSearchTerm.toLowerCase()));
  }

  return (
    <div className="flex-1 flex flex-col w-full h-full font-sans overflow-hidden bg-transparent text-text-primary select-none">
      
      {/* Search & Header Section */}
      <div className="p-3 sm:p-4 flex items-center justify-between gap-2 border-b border-velum-600 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="md:hidden p-1.5 rounded-lg border border-velum-600 text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer shrink-0"
              aria-label="Open sidebar menu"
              title="Open Navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <div className="relative flex items-center flex-1 max-w-sm h-8 px-2.5 rounded-lg border border-velum-600 bg-velum-750 focus-within:border-accent/40">
            <Search className="w-3.5 h-3.5 flex-shrink-0 text-text-disabled" />
            <input
              type="text"
              placeholder={t('people.search', 'Search users...')}
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-xs ml-2 text-text-primary placeholder-text-disabled"
            />
          </div>
        </div>

        <button 
          onClick={() => setShowAddModal(true)} 
          className="h-8 px-3 flex items-center gap-1.5 rounded-lg bg-accent hover:bg-accent-hover text-black text-xs font-semibold transition-colors flex-shrink-0 cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('people.add_friend', 'Add Contact')}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="px-3 sm:px-4 flex items-center gap-4 border-b border-velum-600 overflow-x-auto scrollbar-none shrink-0">
        {(['all', 'online', 'pending', 'blocked'] as const).map(tab => {
          let label = tab === 'all' ? t('people.tab_all', 'All') : tab === 'online' ? t('people.tab_online', 'Online') : tab === 'pending' ? t('people.tab_pending', 'Pending') : t('people.tab_blocked', 'Blocked');
          let count = 0;
          if (tab === 'all') count = activeFriends.length;
          if (tab === 'online') count = onlineFriends.length;
          if (tab === 'pending') count = pendingIncoming.length;
          if (tab === 'blocked') count = blockedUsers.length;
          
          const isActive = activeTab === tab;
          
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 text-xs font-medium relative flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                isActive ? 'text-text-primary font-semibold' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>{label}</span>
              {count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-accent text-black' : 'bg-velum-750 text-text-secondary border border-velum-600'
                }`}>
                  {count}
                </span>
              )}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {displayData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-velum-800 border border-velum-600">
              <Search className="w-5 h-5 text-text-secondary opacity-50" />
            </div>
            <p className="text-xs font-semibold text-text-primary">
              {activeTab === 'pending' ? 'No pending requests' : 'No contacts found'}
            </p>
            <p className="text-xs text-text-secondary max-w-xs">
              {activeTab === 'pending' 
                ? "Incoming requests will appear here." 
                : "No users match your filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-w-4xl mx-auto">
            {displayData.map((item, idx) => {
              const isPending = activeTab === 'pending';
              const isBlocked = activeTab === 'blocked';
              
              const username = isPending ? item.sender_name : item.username;
              const displayName = isPending ? (item.sender_display_name || item.sender_name) : (item.displayName || item.username);
              const userId = isPending ? item.sender_id : item.friendId;
              const avatarUrl = isPending ? item.sender_avatar : item.avatarUrl;
              const handle = `@${stripAt(username)}`;
              const showHandle = displayName && username && displayName.toLowerCase() !== username.toLowerCase();
              const avatarLetter = displayName ? displayName.charAt(0).toUpperCase() : '?';
              const lastSeen = item.last_seen_at || null;
              const activeLounge = item.active_lounge || undefined;

              return (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl border border-velum-600 bg-velum-800 hover:bg-velum-750 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold overflow-hidden bg-velum-750 border border-velum-600 text-text-primary">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        avatarLetter
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-text-primary truncate">
                          {displayName}
                        </span>
                        {showHandle && (
                          <span className="text-[11px] text-text-secondary truncate">
                            {handle}
                          </span>
                        )}
                      </div>
                      {!isPending && getStatusNode(lastSeen, activeLounge)}
                      {isPending && (
                        <div className="text-[10px] text-text-secondary mt-0.5">Incoming Request</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => {
                            setProcessingRequests(prev => new Set(prev).add(item.request_id));
                            handleRespondFriendRequest(item.request_id, 'accepted');
                          }}
                          disabled={processingRequests.has(item.request_id)}
                          className="px-2.5 py-1 rounded-lg bg-status-online/15 text-status-online hover:bg-status-online hover:text-white text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept</span>
                        </button>
                        <button
                          onClick={() => {
                            setProcessingRequests(prev => new Set(prev).add(item.request_id));
                            handleRespondFriendRequest(item.request_id, 'declined');
                          }}
                          disabled={processingRequests.has(item.request_id)}
                          className="px-2.5 py-1 rounded-lg bg-status-dnd/15 text-status-dnd hover:bg-status-dnd hover:text-white text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                      </>
                    ) : isBlocked ? (
                      <button
                        onClick={() => handleUnblock(userId)}
                        className="px-3 py-1 rounded-lg bg-velum-750 border border-velum-600 text-text-primary hover:border-accent/40 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Unblock</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          onSelectPeer({ userId: userId, username: displayName, avatar: avatarUrl });
                          onSectionView('chat');
                        }}
                        className="px-3 py-1 rounded-lg bg-accent text-black hover:bg-accent-hover text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Message</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Contact Drawer */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex justify-end modal-backdrop animate-fade-in" onClick={() => setShowAddModal(false)}>
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm h-full bg-velum-850 border-l border-velum-600 p-5 flex flex-col justify-between shadow-2xl text-text-primary select-none animate-slide-left"
          >
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-velum-600">
                <h3 className="text-sm font-semibold text-text-primary">Add Contact</h3>
                <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-3">
                <label className="block text-xs font-medium text-text-secondary mb-1">Username</label>
                <input 
                  type="text" 
                  value={addUsernameInput}
                  onChange={e => setAddUsernameInput(e.target.value)}
                  className="w-full rounded-lg p-2.5 text-xs bg-velum-750 border border-velum-600 text-text-primary outline-none focus:border-accent/40 transition"
                />
              </div>
            </div>
            
            <div className="pt-4 border-t border-velum-600 flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 rounded-lg border border-velum-600 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (addUsernameInput.trim()) {
                    handleSendFriendRequest(addUsernameInput.replace('@', '').trim());
                    setShowAddModal(false);
                    setAddUsernameInput('');
                  }
                }}
                disabled={!addUsernameInput.trim()}
                className="flex-1 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-black rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
