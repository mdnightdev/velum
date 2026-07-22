import React, { useState, useEffect, useMemo } from 'react';
import { Search, Sliders, UserPlus, MessageSquare, MoreHorizontal, Unlock, UserCheck, Check, X, Shield, Globe } from 'lucide-react';
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
  onSelectPeer: (peer: { userId: number; username: string }) => void;
  onSectionView: (view: string) => void;
  getCountryOnly: (loc: string | null) => string;
}

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'offline';
  if (lastSeenAt === 'online') return 'online';
  if (lastSeenAt === 'dnd') return 'dnd';
  if (lastSeenAt === 'idle') return 'idle';
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
  getCountryOnly
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
        const sId = sessionStorage.getItem('velum-sessionId') || '';
        const res = await fetch('/api/friends/relationships', {
          headers: { 'Authorization': `Bearer ${sId}` }
        });
        if (res.ok) {
          const data = await res.json();
          setRelationships(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchRelationships();
    const intv = setInterval(fetchRelationships, 15000);
    return () => clearInterval(intv);
  }, []);

  const handleUnblock = async (targetId: number) => {
    try {
      const sId = sessionStorage.getItem('velum-sessionId') || '';
      await fetch('/api/friends/unblock', {
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
             <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
             <span className="text-[10px] font-bold text-status-away bg-amber-500/10 px-1.5 py-0.5 rounded-sm border border-amber-500/20">
               {activeLounge}
             </span>
          </div>
        );
     }
     
     if (lastSeen === 'online') {
        return (
          <div className="flex items-center gap-1.5 mt-1">
             <span className="w-2.5 h-2.5 rounded-full bg-status-online" />
             <span className="text-[11px] font-medium text-text-secondary">Online</span>
          </div>
        );
     }

     if (lastSeen === 'dnd') {
        return (
          <div className="flex items-center gap-1.5 mt-1">
             <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
             <span className="text-[11px] font-medium text-text-secondary">Do Not Disturb</span>
          </div>
        );
     }

     if (lastSeen === 'idle') {
        return (
          <div className="flex items-center gap-1.5 mt-1">
             <span className="w-2.5 h-2.5 rounded-full border-[2.5px] border-amber-500 bg-transparent" />
             <span className="text-[11px] font-medium text-text-secondary">Idle</span>
          </div>
        );
     }

     return (
        <div className="flex items-center gap-1.5 mt-1">
           <span className="w-2.5 h-2.5 rounded-full border-[2.5px] border-velum-600 bg-transparent" />
           <span className="text-[11px] font-medium text-text-secondary">Offline • {formatLastSeen(lastSeen)}</span>
        </div>
     );
  };

  const pendingIncoming = useMemo(() => {
    return friendRequests.filter(r => Number(r.receiver_id) === currentUserId && r.status === 'pending');
  }, [friendRequests, currentUserId]);

  const activeFriends = useMemo(() => {
    const seen = new Set();
    return relationships.filter(r => {
      if (r.status !== 'accepted') return false;
      if (seen.has(r.friendId)) return false;
      seen.add(r.friendId);
      return true;
    });
  }, [relationships]);

  
  const blockedUsers = useMemo(() => {
    return relationships.filter(r => r.status === 'blocked');
  }, [relationships]);

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
    <div className="flex-1 flex flex-col w-full h-full font-sans overflow-hidden bg-transparent text-text-primary">
      
      {/* Search & Header Section */}
      <div className={`px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b ${isDark ? 'border-white-5' : 'border-gray-200'}`}>
          <div className="flex items-center justify-center md:justify-end gap-2 w-full md:w-auto">
          <div className={`relative flex items-center w-full md:w-64 h-9 px-3 rounded-full border ${isDark ? 'bg-velum-800 border-white-5 focus-within:border-accent' : 'bg-gray-100 border-gray-200 focus-within:border-accent'}`}>
            <Search className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-text-secondary' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder={t('people.search', 'Search friends...')}
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-xs ml-2 text-inherit"
              style={{ color: isDark ? 'white' : 'black' }}
            />
          </div>
          <button className={`w-9 h-9 flex items-center justify-center rounded-full border flex-shrink-0 transition-colors ${isDark ? 'bg-velum-800 border-white-5 text-text-secondary hover:text-white hover:bg-text-primary/5' : 'bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}>
            <Sliders className="w-4 h-4" />
          </button>
          <button onClick={() => setShowAddModal(true)} className="h-9 px-4 flex items-center gap-1.5 rounded-full bg-accent hover:bg-accent-hover text-velum-900 text-xs font-bold transition-colors flex-shrink-0 cursor-pointer">
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('people.add_friend', 'Add Friend')}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={`px-6 flex items-center gap-6 border-b ${isDark ? 'border-white-5' : 'border-gray-200'}`}>
        {(['all', 'online', 'pending', 'blocked'] as const).map(tab => {
          let label = tab === 'all' ? t('people.tab_all', 'All Friends') : tab === 'online' ? t('people.tab_online', 'Online') : tab === 'pending' ? t('people.tab_pending', 'Pending') : t('people.tab_blocked', 'Blocked');
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
              className={`py-4 text-xs font-semibold relative flex items-center gap-1.5 transition-colors ${
                isActive 
                  ? (isDark ? 'text-white' : 'text-gray-900') 
                  : (isDark ? 'text-text-secondary hover:text-text-primary' : 'text-gray-500 hover:text-gray-700')
              }`}
            >
              <span>{label}</span>
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  isActive 
                    ? 'bg-accent text-velum-900' 
                    : (isDark ? 'bg-text-primary/10 text-text-secondary' : 'bg-gray-200 text-gray-600')
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
      <div className="flex-1 overflow-y-auto p-6">
        {displayData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isDark ? 'bg-text-primary/5' : 'bg-gray-100'}`}>
              <Search className={`w-6 h-6 ${isDark ? 'text-text-secondary' : 'text-gray-400'}`} />
            </div>
            <div className="space-y-1">
              <p className={`text-sm font-semibold ${isDark ? 'text-text-primary' : 'text-gray-700'}`}>
                {activeTab === 'pending' ? 'No pending requests' : 'No friends found'}
              </p>
              <p className={`text-xs ${isDark ? 'text-text-secondary' : 'text-gray-500'}`}>
                {activeTab === 'pending' 
                  ? "When someone adds you, it'll show up here." 
                  : "Try searching for a different name."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-w-4xl mx-auto">
            {displayData.map((item, idx) => {
              const isPending = activeTab === 'pending';
              const isBlocked = activeTab === 'blocked';
              
              const displayName = isPending ? item.sender_name : item.username;
              const userId = isPending ? item.sender_id : item.friendId;
              const handle = `@${stripAt(displayName)}`;
              const avatarLetter = displayName ? displayName.charAt(0).toUpperCase() : '?';
              const lastSeen = item.last_seen_at || null;
              const activeLounge = item.active_lounge || undefined;

              return (
                <div 
                  key={idx}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                    isDark 
                      ? 'bg-velum-800 border-white-5 hover:border-white-10 hover:bg-velum-800' 
                      : 'bg-text-primary border-gray-100 hover:border-gray-200 shadow-sm hover:shadow'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${
                      isDark ? 'bg-velum-800 text-text-primary border border-white-10' : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}>
                      {avatarLetter}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {displayName}
                        </span>
                        <span className={`text-xs truncate ${isDark ? 'text-text-secondary' : 'text-gray-500'}`}>
                          {handle}
                        </span>
                      </div>
                      {!isPending && getStatusNode(lastSeen, activeLounge)}
                      {isPending && (
                        <div className="text-[10px] text-text-secondary mt-1">Incoming Friend Request</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => {
                            setProcessingRequests(prev => new Set(prev).add(item.request_id));
                            handleRespondFriendRequest(item.request_id, 'accepted');
                          }}
                          disabled={processingRequests.has(item.request_id)}
                          className="w-9 h-9 rounded-full bg-status-online/10 text-status-online hover:bg-status-online hover:text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Accept Request"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setProcessingRequests(prev => new Set(prev).add(item.request_id));
                            handleRespondFriendRequest(item.request_id, 'declined');
                          }}
                          disabled={processingRequests.has(item.request_id)}
                          className="w-9 h-9 rounded-full bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Decline Request"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : isBlocked ? (
                      <button
                        onClick={() => handleUnblock(userId)}
                        className={`px-4 h-9 rounded-full flex items-center gap-2 text-xs font-bold transition-colors ${
                          isDark ? 'bg-text-primary/5 text-text-primary hover:bg-text-primary/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Unblock</span>
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            onSelectPeer({ userId: userId, username: displayName });
                            onSectionView('chat');
                          }}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                            isDark ? 'bg-text-primary/5 text-text-secondary hover:bg-text-primary/10 hover:text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900'
                          }`}
                          title="Message"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                            isDark ? 'text-text-secondary hover:bg-text-primary/5 hover:text-white' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                          title="More Options"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Friend Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black-60 backdrop-blur-sm p-4">
          <div className={`p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl ${isDark ? 'bg-velum-800 border border-white-10' : 'bg-text-primary border border-gray-200'}`}>
            <div className="flex justify-between items-center mb-2">
              <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-gray-900'}`}>Add a Friend</h3>
              <button onClick={() => setShowAddModal(false)} className={`transition cursor-pointer ${isDark ? 'text-text-secondary hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className={`text-xs font-mono ${isDark ? 'text-text-secondary' : 'text-gray-500'}`}>Enter your friend's exact username handle.</p>
            
            <input 
              type="text" 
              placeholder="@username" 
              value={addUsernameInput}
              onChange={e => setAddUsernameInput(e.target.value)}
              className={`w-full rounded-lg p-3 text-xs font-mono focus:outline-none transition ${isDark ? 'bg-velum-900 border border-white-10 text-white focus:border-accent' : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-accent'}`}
            />
            
            <button 
              onClick={() => {
                if (addUsernameInput.trim()) {
                  handleSendFriendRequest(addUsernameInput.replace('@', '').trim());
                  setShowAddModal(false);
                  setAddUsernameInput('');
                }
              }}
              className="w-full bg-accent hover:bg-accent-hover text-velum-900 p-3 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer"
            >
              Send Request
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
