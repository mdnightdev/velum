import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, UserPlus, Check, X, Loader2 } from 'lucide-react';
import { FriendRequest, stripAt } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { getSessionId } from '../../utils/auth';
import { unDeleteContact, isHiddenFromUserContacts } from '../../utils/deletedDms';
import { ContactAvatar } from '../ContactAvatar';
import { resolveContactName } from '../../utils/contactName';

type DirectoryHit = {
  id: number;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
};

interface PeopleMainDashboardProps {
  friendRequests: FriendRequest[];
  currentUserId: number;
  isDark?: boolean;
  userSearchTerm: string;
  setUserSearchTerm: (v: string) => void;
  handleRespondFriendRequest: (requestId: string, action: 'accepted' | 'declined') => void;
  handleSendFriendRequest: (username: string) => void;
  onSelectPeer: (peer: {
    userId: number;
    username: string;
    displayName?: string;
    nickname?: string;
    avatar?: string;
  }) => void;
  onSectionView: (view: string) => void;
  loadAndShowProfileCard?: (user: any) => void;
  forwardMode?: boolean;
  onCancelForward?: () => void;
}

export default function PeopleMainDashboard({
  friendRequests,
  currentUserId,
  userSearchTerm,
  setUserSearchTerm,
  handleRespondFriendRequest,
  handleSendFriendRequest,
  onSelectPeer,
  onSectionView,
  loadAndShowProfileCard,
  forwardMode = false,
  onCancelForward,
}: PeopleMainDashboardProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
  const [relationships, setRelationships] = useState<any[]>([]);
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());
  const [directoryHits, setDirectoryHits] = useState<DirectoryHit[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const fetchRelationships = async () => {
      try {
        const sId = getSessionId();
        const res = await fetch('/v2/friends/relationships', {
          headers: { Authorization: `Bearer ${sId}` },
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

  const safeRequests = Array.isArray(friendRequests) ? friendRequests : [];
  const safeRelationships = Array.isArray(relationships) ? relationships : [];

  const pendingIncoming = useMemo(() => {
    return safeRequests.filter(
      (r) =>
        Number(r.receiver_id) === currentUserId &&
        r.status === 'pending' &&
        !isHiddenFromUserContacts({
          sender_id: r.sender_id,
          sender_name: r.sender_name,
          role: (r as { sender_role?: string }).sender_role,
        })
    );
  }, [safeRequests, currentUserId]);

  const friendIdSet = useMemo(() => {
    const ids = new Set<number>();
    for (const r of safeRelationships) {
      if (r.status !== 'accepted') continue;
      const id = Number(r.friendId);
      if (Number.isFinite(id)) ids.add(id);
    }
    return ids;
  }, [safeRelationships]);

  const pendingOutgoingUsernames = useMemo(() => {
    const names = new Set<string>();
    for (const r of safeRequests) {
      if (r.status !== 'pending') continue;
      if (Number(r.sender_id) !== currentUserId) continue;
      const uname = stripAt(String(r.receiver_username || r.receiver_name || '')).toLowerCase();
      if (uname) names.add(uname);
    }
    for (const r of safeRelationships) {
      if (r.status !== 'pending') continue;
      const uname = stripAt(String(r.username || '')).toLowerCase();
      if (uname) names.add(uname);
      const id = Number(r.friendId);
      if (Number.isFinite(id)) names.add(String(id));
    }
    return names;
  }, [safeRequests, safeRelationships, currentUserId]);

  const activeFriends = useMemo(() => {
    const seen = new Set<number>();
    return safeRelationships.filter((r) => {
      if (r.status !== 'accepted') return false;
      const id = Number(r.friendId);
      if (!Number.isFinite(id) || seen.has(id)) return false;
      if (
        isHiddenFromUserContacts({
          friendId: id,
          username: r.username,
          role: r.role,
        })
      ) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }, [safeRelationships]);

  const rawTerm = userSearchTerm.trim();
  const isAtLookup = rawTerm.startsWith('@');
  const lookupQuery = stripAt(rawTerm).toLowerCase();
  const term = lookupQuery;

  const displayData = useMemo(() => {
    if (activeTab === 'pending') {
      return pendingIncoming.filter(
        (f) => !term || (f.sender_name && f.sender_name.toLowerCase().includes(term))
      );
    }
    return activeFriends.filter(
      (f) =>
        !term ||
        f.username?.toLowerCase().includes(term) ||
        (f.displayName && f.displayName.toLowerCase().includes(term))
    );
  }, [activeTab, pendingIncoming, activeFriends, term]);

  // Directory lookup only when user types @username
  useEffect(() => {
    if (activeTab !== 'all' || !isAtLookup || lookupQuery.length < 1) {
      setDirectoryHits([]);
      setDirectoryLoading(false);
      return;
    }

    let cancelled = false;
    setDirectoryLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const sId = getSessionId();
        const res = await fetch(`/v2/user/directory/search?q=${encodeURIComponent(lookupQuery)}`, {
          headers: { Authorization: `Bearer ${sId}` },
        });
        if (!res.ok) {
          if (!cancelled) setDirectoryHits([]);
          return;
        }
        const data = await res.json();
        const users: DirectoryHit[] = Array.isArray(data?.users) ? data.users : [];
        if (!cancelled) {
          setDirectoryHits(
            users.filter(
              (u) =>
                Number(u.id) !== currentUserId &&
                !isHiddenFromUserContacts({
                  userId: u.id,
                  username: u.username,
                  role: u.role,
                })
            )
          );
        }
      } catch {
        if (!cancelled) setDirectoryHits([]);
      } finally {
        if (!cancelled) setDirectoryLoading(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [activeTab, isAtLookup, lookupQuery, currentUserId]);

  const directoryToShow = useMemo(() => {
    if (!isAtLookup) return [];
    // Prefer exact / prefix matches; hide people already in All list (accepted friends)
    return directoryHits.filter((u) => !friendIdSet.has(Number(u.id)));
  }, [directoryHits, friendIdSet, isAtLookup]);

  const focusAddSearch = () => {
    setActiveTab('all');
    if (!userSearchTerm.startsWith('@')) {
      setUserSearchTerm('@');
    }
    window.setTimeout(() => {
      searchInputRef.current?.focus();
      const el = searchInputRef.current;
      if (el) {
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    }, 0);
  };

  const openDm = (peer: {
    userId: number;
    username: string;
    displayName?: string;
    nickname?: string;
    avatar?: string;
  }) => {
    unDeleteContact(currentUserId, peer.userId);
    onSelectPeer(peer);
    onSectionView('chat');
  };

  const openProfile = (
    e: React.MouseEvent,
    peer: {
      userId: number;
      username: string;
      displayName?: string;
      nickname?: string;
      avatar?: string;
    }
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (!loadAndShowProfileCard) return;
    loadAndShowProfileCard({
      userId: peer.userId,
      username: peer.username,
      displayName: peer.displayName || peer.username,
      nickname: peer.nickname || '',
      avatarUrl: peer.avatar,
      avatar: peer.avatar,
    });
  };

  const sendAdd = async (username: string) => {
    const name = stripAt(username);
    if (!name || sendingTo) return;
    setSendingTo(name.toLowerCase());
    try {
      await handleSendFriendRequest(name);
    } finally {
      setSendingTo(null);
    }
  };

  const showDirectoryBlock = activeTab === 'all' && isAtLookup;
  const listEmpty = displayData.length === 0 && (!showDirectoryBlock || (!directoryLoading && directoryToShow.length === 0));

  return (
    <div className="flex-1 flex flex-col w-full h-full font-sans overflow-hidden bg-transparent text-text-primary select-none">
      {forwardMode && (
        <div className="px-3 py-2.5 flex items-center justify-between gap-2 border-b border-velum-600 shrink-0 bg-black/20">
          <span className="text-sm font-semibold text-white">Forward to</span>
          {onCancelForward && (
            <button
              type="button"
              onClick={onCancelForward}
              className="text-xs font-medium text-text-secondary hover:text-white cursor-pointer px-2 py-1"
            >
              Close
            </button>
          )}
        </div>
      )}
      <div className="px-3 py-3 flex items-center justify-between gap-2 border-b border-velum-600 shrink-0">
        <div className="relative flex items-center flex-1 h-10 px-3.5 rounded-full border border-velum-600 bg-velum-750 focus-within:border-accent/40">
          <Search className="w-4 h-4 flex-shrink-0 text-text-secondary" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={t('people.search', 'Search or @username')}
            value={userSearchTerm}
            onChange={(e) => setUserSearchTerm(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="w-full bg-transparent border-none outline-none text-sm ml-2.5 text-text-primary placeholder-text-disabled"
          />
          {userSearchTerm.length > 0 && (
            <button
              type="button"
              onClick={() => setUserSearchTerm('')}
              className="p-1 rounded-full text-text-secondary hover:text-text-primary cursor-pointer"
              aria-label="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={focusAddSearch}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-accent hover:bg-accent-hover text-black transition-colors flex-shrink-0 cursor-pointer"
          title="Add contact"
          aria-label="Add contact"
        >
          <UserPlus className="w-5 h-5" />
        </button>
      </div>

      <div className="px-3 flex items-center gap-4 border-b border-velum-600 shrink-0">
        {(['all', 'pending'] as const).map((tab) => {
          const label =
            tab === 'all' ? t('people.tab_all', 'All') : t('people.tab_pending', 'Pending');
          const count = tab === 'all' ? activeFriends.length : pendingIncoming.length;
          const isActive = activeTab === tab;

          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 text-xs font-medium relative flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                isActive ? 'text-text-primary font-semibold' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>{label}</span>
              {count > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-accent text-black'
                      : 'bg-velum-750 text-text-secondary border border-velum-600'
                  }`}
                >
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

      <div className="flex-1 overflow-y-auto py-1">
        {listEmpty ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 px-4">
            {activeTab === 'pending' ? (
              <>
                <p className="text-sm font-semibold text-text-primary">No pending requests</p>
                <p className="text-xs text-text-secondary max-w-xs">Incoming requests will appear here.</p>
              </>
            ) : showDirectoryBlock && !directoryLoading ? (
              <>
                <p className="text-sm font-semibold text-text-primary">No user found</p>
                <p className="text-xs text-text-secondary max-w-[240px]">Check the username and try again.</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-velum-800 border border-velum-600 flex items-center justify-center mb-1">
                  <UserPlus className="w-6 h-6 text-accent" />
                </div>
                <p className="text-sm font-semibold text-text-primary">No contacts yet</p>
                <p className="text-xs text-text-secondary max-w-[240px]">
                  Tap + and type @username to find someone.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {displayData.map((item, idx) => {
              const isPending = activeTab === 'pending';
              const username = isPending ? item.sender_name : item.username;
              const displayName = isPending
                ? item.sender_display_name || item.sender_name
                : item.displayName || item.username;
              const nickname = isPending ? '' : item.nickname || '';
              const contactName = resolveContactName({
                nickname,
                displayName,
                username,
                fallback: `User #${Number(isPending ? item.sender_id : item.friendId) || 0}`,
              });
              const userId = Number(isPending ? item.sender_id : item.friendId);
              const avatarUrl = isPending ? item.sender_avatar : item.avatarUrl || item.avatar;
              const peerUsername = stripAt(username || displayName || `User #${userId}`);

              const avatarNode = (
                <ContactAvatar
                  name={String(contactName || peerUsername || '?')}
                  avatar={avatarUrl}
                  className="w-10 h-10 rounded-xl"
                  title="Profile"
                  onClick={(e) =>
                    openProfile(e, {
                      userId,
                      username: peerUsername,
                      displayName: displayName || peerUsername,
                      nickname,
                      avatar: avatarUrl || undefined,
                    })
                  }
                />
              );

              if (isPending) {
                return (
                  <div
                    key={item.request_id || idx}
                    className="w-full px-3 py-2.5 flex items-center gap-3"
                  >
                    {avatarNode}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-semibold text-text-primary truncate">{displayName}</span>
                      <span className="text-[11px] text-text-secondary">Incoming request</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setProcessingRequests((prev) => new Set(prev).add(item.request_id));
                          handleRespondFriendRequest(item.request_id, 'accepted');
                        }}
                        disabled={processingRequests.has(item.request_id)}
                        className="px-2.5 py-1 rounded-lg bg-status-online/15 text-status-online hover:bg-status-online hover:text-white text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProcessingRequests((prev) => new Set(prev).add(item.request_id));
                          handleRespondFriendRequest(item.request_id, 'declined');
                        }}
                        disabled={processingRequests.has(item.request_id)}
                        className="px-2.5 py-1 rounded-lg bg-status-dnd/15 text-status-dnd hover:bg-status-dnd hover:text-white text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={userId || idx}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    openDm({
                      userId,
                      username: peerUsername,
                      displayName: displayName || peerUsername,
                      nickname,
                      avatar: avatarUrl || undefined,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openDm({
                        userId,
                        username: peerUsername,
                        displayName: displayName || peerUsername,
                        nickname,
                        avatar: avatarUrl || undefined,
                      });
                    }
                  }}
                  className="w-full px-3 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-velum-750 active:bg-velum-700 transition text-left"
                >
                  {avatarNode}
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-text-primary truncate">{contactName}</span>
                  </div>
                </div>
              );
            })}

            {showDirectoryBlock && (
              <>
                {(directoryLoading || directoryToShow.length > 0) && displayData.length > 0 && (
                  <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                    Find people
                  </div>
                )}
                {directoryLoading && directoryToShow.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-text-secondary">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                )}
                {directoryToShow.map((u) => {
                  const uname = stripAt(u.username);
                  const displayName = u.displayName || uname;
                  const alreadyPending =
                    pendingOutgoingUsernames.has(uname.toLowerCase()) ||
                    pendingOutgoingUsernames.has(String(u.id));
                  const busy = sendingTo === uname.toLowerCase();

                  return (
                    <div
                      key={u.id}
                      className="w-full px-3 py-2.5 flex items-center gap-3"
                    >
                      <ContactAvatar
                        name={displayName}
                        avatar={u.avatarUrl}
                        className="w-10 h-10 rounded-xl"
                        title="Profile"
                        onClick={(e) =>
                          openProfile(e, {
                            userId: u.id,
                            username: uname,
                            displayName,
                            avatar: u.avatarUrl || undefined,
                          })
                        }
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-semibold text-text-primary truncate">{displayName}</span>
                      </div>
                      {alreadyPending ? (
                        <span className="text-[11px] font-medium text-text-secondary px-2.5 py-1 rounded-lg bg-velum-750 border border-velum-600">
                          Pending
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => sendAdd(uname)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-black text-xs font-semibold hover:bg-accent-hover active:scale-95 transition disabled:opacity-50 cursor-pointer"
                        >
                          {busy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <UserPlus className="w-3.5 h-3.5" />
                          )}
                          <span>Add</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
