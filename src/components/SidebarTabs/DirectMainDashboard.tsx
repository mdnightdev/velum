import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Bot, Check, CheckCheck, Archive, ArchiveRestore, Trash2, MoreVertical, X, MessageSquarePlus, Search, Info, LogOut } from 'lucide-react';
import { stripAt } from '../../types';
import logoSvg from '../../assets/logo.svg?raw';
import { useLanguage } from '../../i18n/LanguageContext';
import { getCleanPreview, formatVoiceNotePreview } from '../../utils/messageParser';
import { formatMessageTimestamp } from '../../utils/time';
import { flushLoungeCache, purgeDmMessages } from '../../utils/indexedDb';
import { resolveMediaUrl } from '../../utils/mediaPipeline';
import { getSessionId } from '../../utils/auth';
import { getDmRoomAliases, resolveDmUnreadCount, selectLatestDmMessage, messageTimestamp, shouldHideDeletedDm, getPrimaryDmRoomId } from '../../utils/roomUtils';
import { getMessagePreviewPlaintext } from '../../utils/messagePlaintext';
import { useChatStore } from '../../stores/chatStore';
import { ContactAvatar, isAvatarImageSrc } from '../ContactAvatar';
import { resolveContactName, writeStoredNickname } from '../../utils/contactName';

function dedupeRelationshipsByPeerId(raw: any[]): any[] {
  const SYSTEM_IDS = new Set([1, 2, 999]);
  const byPeer = new Map<number, any>();

  for (const r of raw) {
    const fId = Number(r.friendId || r.userId || r.user_id || r.id);
    if (!Number.isFinite(fId) || SYSTEM_IDS.has(fId)) continue;
    const uname = (r.username || r.displayName || '').toLowerCase();
    if (uname === 'velum') continue;

    const existing = byPeer.get(fId);
    if (!existing) {
      byPeer.set(fId, r);
      continue;
    }
    const newerLast =
      messageTimestamp(r.last_message) >= messageTimestamp(existing.last_message)
        ? r.last_message
        : existing.last_message;
    byPeer.set(fId, {
      ...existing,
      ...r,
      friendId: fId,
      avatarUrl: r.avatarUrl || r.avatar || existing.avatarUrl || existing.avatar || null,
      unread_count: Math.max(
        typeof existing.unread_count === 'number' ? existing.unread_count : 0,
        typeof r.unread_count === 'number' ? r.unread_count : 0
      ),
      last_message: newerLast || existing.last_message || r.last_message || null
    });
  }

  return Array.from(byPeer.values());
}

function renderPreviewWithIcons(content: string) {
  if (!content) return null;
  if (content.startsWith('[Voice Note') || content.startsWith('Voice message')) {
    const text = content.startsWith('[Voice Note') ? formatVoiceNotePreview(content) : content;
    return (
      <span className="inline-flex items-center gap-1 truncate">
        <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        <span className="truncate">{text}</span>
      </span>
    );
  }
  if (content.includes('[Attachment:')) {
    const label = getCleanPreview(content);
    return renderPreviewWithIcons(label);
  }
  if (/^\d+\s+videos?\b/i.test(content) || content.startsWith('Video')) {
    return (
      <span className="inline-flex items-center gap-1 truncate">
        <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
        <span className="truncate">{content}</span>
      </span>
    );
  }
  if (/^\d+\s+photos?\b/i.test(content) || content.startsWith('Photo')) {
    return (
      <span className="inline-flex items-center gap-1 truncate">
        <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2.5" y="2.5" width="19" height="19" rx="4" />
          <circle cx="8.5" cy="8.5" r="2" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <span className="truncate">{content}</span>
      </span>
    );
  }
  if (/^\d+\s+media\b/i.test(content) || content.startsWith('Album')) {
    return (
      <span className="inline-flex items-center gap-1 truncate">
        <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <span className="truncate">{content}</span>
      </span>
    );
  }
  return <span className="truncate">{content}</span>;
}

interface DirectMainDashboardProps {
  friendRequests: any[];
  friendRelationships: any;
  currentUserId: number;
  isDark: boolean;
  onSelectPeer?: (peer: {
    userId: number;
    username: string;
    displayName?: string;
    nickname?: string;
    avatar?: string;
  }) => void;
  onSectionView?: (view: any) => void;
  onMarkAsRead?: (messageId: string | undefined, roomId: string) => void;
  unreadCounts: Record<string, number>;
  lastMessages?: Record<string, any>;
  loadAndShowProfileCard: (user: any) => void;
  getCountryOnly: (location: string) => string;
  onOpenContacts?: () => void;
  onOpenSettings?: () => void;
  onOpenWallet?: () => void;
  onOpenSaved?: () => void;
  onLogout?: () => void;
}



function DirectMainDashboard({
  friendRequests,
  friendRelationships,
  currentUserId,
  isDark,
  onSelectPeer,
  onSectionView,
  onMarkAsRead,
  unreadCounts,
  lastMessages = {},
  loadAndShowProfileCard,
  getCountryOnly,
  onOpenContacts,
  onOpenSettings,
  onOpenWallet,
  onOpenSaved,
  onLogout
}: DirectMainDashboardProps) {
  const { t } = useLanguage();
  const forgottenPreviewIds = useChatStore((s) => s.forgottenPreviewIds);

  const relationshipsArray: any[] = (() => {
    let raw: any[] = [];
    if (Array.isArray(friendRelationships)) {
      raw = friendRelationships;
    } else if (friendRelationships && typeof friendRelationships === 'object' && 'relationships' in friendRelationships) {
      raw = (friendRelationships as any).relationships || [];
    }
    return dedupeRelationshipsByPeerId(raw);
  })();

  const [nicknameOverrides, setNicknameOverrides] = useState<Record<number, string>>({});

  useEffect(() => {
    for (const r of relationshipsArray) {
      const friendId = Number(r.friendId || r.userId || r.user_id || r.id);
      if (!Number.isFinite(friendId)) continue;
      if (typeof r.nickname === 'string') {
        writeStoredNickname(currentUserId, friendId, r.nickname);
      }
    }
  }, [relationshipsArray, currentUserId]);

  useEffect(() => {
    const onNicknameUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const targetUserId = Number(detail.targetUserId);
      if (!Number.isFinite(targetUserId)) return;
      const nickname = typeof detail.nickname === 'string' ? detail.nickname : '';
      writeStoredNickname(currentUserId, targetUserId, nickname);
      setNicknameOverrides((prev) => ({ ...prev, [targetUserId]: nickname }));
    };
    window.addEventListener('velum-nickname-updated', onNicknameUpdated);
    return () => window.removeEventListener('velum-nickname-updated', onNicknameUpdated);
  }, [currentUserId]);

  const resolveFriendName = (r: any, friendId: number) =>
    resolveContactName({
      nickname: nicknameOverrides[friendId] ?? r.nickname,
      displayName: r.displayName,
      username: r.username,
      fallback: `User #${friendId}`,
    });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'active' | 'archived'>('active');
  const [archivedUserIds, setArchivedUserIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(`velum_archived_dms_${currentUserId}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [deletedDms, setDeletedDms] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem(`velum_deleted_dms_${currentUserId}`);
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const map: Record<number, number> = {};
        parsed.forEach(id => { map[id] = Date.now(); });
        return map;
      }
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
  });
  const [contextPeer, setContextPeer] = useState<{ userId: number; username: string; dmRoomId: string; isArchived: boolean } | null>(null);
  const [quickAvatarPeer, setQuickAvatarPeer] = useState<{
    userId: number;
    username: string;
    displayName?: string;
    nickname?: string;
    avatarUrl?: string;
    bio?: string;
    anchor: { top: number; left: number };
  } | null>(null);

  const openQuickAvatar = (
    e: React.MouseEvent,
    peer: {
      userId: number;
      username: string;
      displayName?: string;
      nickname?: string;
      avatarUrl?: string;
      bio?: string;
    }
  ) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cardW = 288; // w-72
    const cardH = 280;
    const gap = 8;
    const left = Math.min(
      Math.max(12, rect.left),
      window.innerWidth - cardW - 12
    );
    let top = rect.bottom + gap;
    if (top + cardH > window.innerHeight - 12) {
      top = Math.max(12, rect.top - cardH - gap);
    }
    setQuickAvatarPeer({ ...peer, anchor: { top, left } });
  };
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setIsHeaderMenuOpen(false);
      }
    };
    if (isHeaderMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isHeaderMenuOpen]);

  // Helper to un-delete a contact
  const unDeleteContact = (peerId: number) => {
    setDeletedDms(prev => {
      if (!prev[peerId]) return prev;
      const next = { ...prev };
      delete next[peerId];
      try {
        localStorage.setItem(`velum_deleted_dms_${currentUserId}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Auto-un-delete if a new message arrives from/to peer after deletion timestamp
  useEffect(() => {
    if (!lastMessages || Object.keys(deletedDms).length === 0) return;
    let changed = false;
    const nextMap = { ...deletedDms };

    for (const [peerIdStr, delTime] of Object.entries(deletedDms)) {
      const peerId = parseInt(peerIdStr, 10);
      if (!Number.isFinite(peerId)) continue;
      const last = selectLatestDmMessage(peerId, currentUserId, lastMessages, undefined, forgottenPreviewIds);
      if (last && messageTimestamp(last) > delTime) {
        delete nextMap[peerId];
        changed = true;
      }
    }

    if (changed) {
      setDeletedDms(nextMap);
      try {
        localStorage.setItem(`velum_deleted_dms_${currentUserId}`, JSON.stringify(nextMap));
      } catch {}
    }
  }, [lastMessages, currentUserId, deletedDms]);

  // Profile/clear path updates localStorage without React state — sync via events
  useEffect(() => {
    const applyDeleted = (peerId: number, deletedAt: number) => {
      setDeletedDms(prev => {
        const next = { ...prev, [peerId]: deletedAt };
        try {
          localStorage.setItem(`velum_deleted_dms_${currentUserId}`, JSON.stringify(next));
        } catch {}
        return next;
      });
    };

    const onDeleted = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const peerId = Number(detail.peerId);
      if (!Number.isFinite(peerId)) return;
      applyDeleted(peerId, Number(detail.deletedAt) || Date.now());
    };

    const onCleared = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const peerId = Number(detail.peerId);
      if (!Number.isFinite(peerId)) return;
    };

    window.addEventListener('velum-dm-deleted', onDeleted);
    window.addEventListener('velum-dm-cleared', onCleared);
    return () => {
      window.removeEventListener('velum-dm-deleted', onDeleted);
      window.removeEventListener('velum-dm-cleared', onCleared);
    };
  }, [currentUserId]);

  const touchTimerRef = useRef<any>(null);
  const isLongPressRef = useRef(false);

  const startLongPress = (peerInfo: { userId: number; username: string; dmRoomId: string; isArchived: boolean }) => {
    isLongPressRef.current = false;
    touchTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setContextPeer(peerInfo);
      if (typeof window !== 'undefined' && window.navigator && 'vibrate' in window.navigator) {
        try { window.navigator.vibrate(40); } catch {}
      }
    }, 450);
  };

  const cancelLongPress = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const toggleArchive = (peerId: number) => {
    setArchivedUserIds(prev => {
      const next = prev.includes(peerId) ? prev.filter(id => id !== peerId) : [...prev, peerId];
      try {
        localStorage.setItem(`velum_archived_dms_${currentUserId}`, JSON.stringify(next));
      } catch {}
      return next;
    });
    setContextPeer(null);
  };

  React.useEffect(() => {
    if (archivedUserIds.length === 0 && filterTab === 'archived') {
      setFilterTab('active');
    }
  }, [archivedUserIds.length, filterTab]);

  const handleDeleteConversation = async (peerId: number, peerName: string, dmRoomId: string) => {
    try {
      const now = Date.now();
      const aliases = getDmRoomAliases(peerId, currentUserId);

      setDeletedDms(prev => {
        const next = { ...prev, [peerId]: now };
        try {
          localStorage.setItem(`velum_deleted_dms_${currentUserId}`, JSON.stringify(next));
        } catch {}
        return next;
      });

      await purgeDmMessages(peerId, currentUserId);
      for (const alias of aliases) {
        await flushLoungeCache(alias, currentUserId);
      }

      const store = useChatStore.getState();
      store.setLastMessages(prev => {
        const next = { ...prev };
        for (const alias of aliases) delete next[alias];
        return next;
      });
      store.setUnreadCounts(prev => {
        const next = { ...prev };
        for (const alias of aliases) next[alias] = 0;
        return next;
      });
      for (const alias of aliases) {
        store.clearRoomMessages(alias);
      }

      try {
        const sId = getSessionId();
        await fetch(`/v2/dm/${peerId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${sId}` }
        });
      } catch (err) {
        console.warn('Server chat deletion call failed:', err);
      }

      window.dispatchEvent(new CustomEvent('velum-dm-deleted', { detail: { peerId, deletedAt: now } }));
      setContextPeer(null);
    } catch (e) {
      console.warn('Failed to delete conversation:', e);
    }
  };

  const filteredFriends = relationshipsArray.filter(r => {
    const friendId = Number(r.friendId || r.userId || r.user_id || r.id);
    const name = resolveFriendName(r, friendId);
    const q = searchQuery.toLowerCase();
    return (
      name.toLowerCase().includes(q) ||
      String(r.username || '').toLowerCase().includes(q) ||
      String(r.displayName || '').toLowerCase().includes(q) ||
      String(r.nickname || nicknameOverrides[friendId] || '').toLowerCase().includes(q)
    );
  });
  const velumUnread = unreadCounts[`dm_velum_${currentUserId}`] || 0;

  const velumRoomId = `dm_velum_${currentUserId}`;
  const velumLast = selectLatestDmMessage(999, currentUserId, lastMessages, undefined, forgottenPreviewIds);
  let velumTxt = '';
  let velumTimeStr = '';
  let velumMsgStatus = '';
  let velumIsMe = false;
  if (velumLast) {
    velumIsMe = (velumLast.user_id === currentUserId) || (velumLast.senderId === currentUserId);
    velumTxt = getCleanPreview(getMessagePreviewPlaintext(velumLast)) || '';
    if (velumIsMe) {
      if (velumLast.status) {
        velumMsgStatus = velumLast.status;
      } else {
        velumMsgStatus = 'sent';
        const readArr = velumLast.readBy ? velumLast.readBy.split(',').map(Number).filter((id: number) => !isNaN(id)) : [];
        const delArr = velumLast.deliveredTo ? velumLast.deliveredTo.split(',').map(Number).filter((id: number) => !isNaN(id)) : [];
        if (readArr.includes(999)) {
          velumMsgStatus = 'read';
        } else if (delArr.includes(999)) {
          velumMsgStatus = 'delivered';
        }
      }
    }
    const ts = velumLast.created_at || velumLast.timestamp || velumLast.createdAt;
    if (ts) velumTimeStr = formatMessageTimestamp(ts);
  }

  return (
    <div className="flex-1 flex flex-col w-full h-full select-none font-sans bg-transparent text-text-primary">
      {/* Header / Selection Action Bar */}
      {contextPeer ? (
        <div className="p-3 pt-[calc(env(safe-area-inset-top,0px)+0.875rem)] px-4 border-b border-velum-600 bg-velum-850 flex-shrink-0 flex items-center justify-between gap-2.5 animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setContextPeer(null)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer"
              title="Cancel Selection"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="text-xs font-bold text-accent uppercase tracking-wider">1 selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleArchive(contextPeer.userId)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-text-secondary hover:text-accent hover:bg-velum-750 active:bg-velum-700 transition cursor-pointer"
              title={contextPeer.isArchived ? "Unarchive Chat" : "Archive Chat"}
              aria-label={contextPeer.isArchived ? "Unarchive Chat" : "Archive Chat"}
            >
              {contextPeer.isArchived ? <ArchiveRestore className="w-5 h-5 text-accent" /> : <Archive className="w-5 h-5 text-text-primary" />}
            </button>
            <button
              type="button"
              onClick={() => handleDeleteConversation(contextPeer.userId, contextPeer.username, contextPeer.dmRoomId)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-alert-error hover:bg-alert-error/15 active:bg-alert-error/20 transition cursor-pointer"
              title="Delete Conversation"
              aria-label="Delete Conversation"
            >
              <Trash2 className="w-5 h-5 text-alert-error" />
            </button>
          </div>
        </div>
      ) : (
        <div className="pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] px-4 pb-3 border-b border-velum-600 bg-velum-850 flex-shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-semibold text-text-primary tracking-tight">Chats</h1>
            <div className="relative shrink-0" ref={headerMenuRef}>
              <button
                type="button"
                onClick={() => setIsHeaderMenuOpen(prev => !prev)}
                className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer"
                title="More options"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {isHeaderMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-44 bg-velum-850 border border-velum-600 rounded-xl shadow-lg py-1.5 z-50 flex flex-col animate-in fade-in duration-100">
                  {onOpenWallet && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        onOpenWallet();
                      }}
                      className="w-full px-3.5 py-2.5 text-xs text-text-primary hover:bg-white-5 text-left transition cursor-pointer"
                    >
                      Wallet
                    </button>
                  )}
                  {onOpenSaved && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        onOpenSaved();
                      }}
                      className="w-full px-3.5 py-2.5 text-xs text-text-primary hover:bg-white-5 text-left transition cursor-pointer"
                    >
                      Saved
                    </button>
                  )}
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        onOpenSettings();
                      }}
                      className="w-full px-3.5 py-2.5 text-xs text-text-primary hover:bg-white-5 text-left transition cursor-pointer"
                    >
                      Settings
                    </button>
                  )}
                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full px-3.5 py-2.5 flex items-center gap-2.5 text-xs text-alert-error hover:bg-alert-error/10 text-left transition cursor-pointer border-t border-velum-600/50 mt-1 pt-2"
                    >
                      <LogOut className="w-4 h-4 text-alert-error" />
                      <span>Log Out</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="relative flex items-center h-11 px-3.5 rounded-full border border-velum-600 bg-velum-750 focus-within:border-accent/40">
            <Search className="w-4 h-4 text-text-secondary mr-2.5 shrink-0" />
            <input
              type="text"
              placeholder={t('chats.search', 'Search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-sm text-text-primary placeholder-text-disabled"
            />
          </div>
        </div>
      )}

      {/* Archived filter — only when something is archived */}
      {archivedUserIds.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-velum-600 bg-velum-850 shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setFilterTab('active')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              filterTab === 'active'
                ? 'bg-accent/15 text-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Chats
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('archived')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              filterTab === 'archived'
                ? 'bg-accent/15 text-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Archived</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-velum-750 border border-velum-600">
              {archivedUserIds.length}
            </span>
          </button>
        </div>
      )}

      {/* Directory List */}
      <div className="flex-1 overflow-y-auto w-full flex flex-col relative">
        {/* Default Secure VELUM System Contact (only in active tab) */}
        {filterTab === 'active' && !shouldHideDeletedDm(deletedDms[999], selectLatestDmMessage(999, currentUserId, lastMessages, undefined, forgottenPreviewIds)) && (
          <div
            onClick={() => {
              if (contextPeer?.userId === 999) return;
              unDeleteContact(999);
              if (onSelectPeer) onSelectPeer({ userId: 999, username: 'VELUM', avatar: undefined });
              if (onSectionView) onSectionView('chat');
              if (onMarkAsRead) onMarkAsRead('', velumRoomId);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextPeer({
                userId: 999,
                username: 'VELUM',
                dmRoomId: getPrimaryDmRoomId(999, currentUserId),
                isArchived: archivedUserIds.includes(999)
              });
            }}
            onTouchStart={() => startLongPress({
              userId: 999,
              username: 'VELUM',
              dmRoomId: getPrimaryDmRoomId(999, currentUserId),
              isArchived: archivedUserIds.includes(999)
            })}
            onTouchEnd={cancelLongPress}
            onTouchMove={cancelLongPress}
            className={`w-full px-4 py-3 border-b border-velum-600 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
              contextPeer?.userId === 999 ? 'bg-accent/10' : 'hover:bg-velum-750'
            }`}
          >
            <div className="min-w-0 flex items-center gap-3 flex-1">
              <div 
                onClick={(e) => {
                  openQuickAvatar(e, {
                    userId: 999,
                    username: 'VELUM',
                    displayName: 'Velum',
                    bio: 'Official Velum Platform Bot'
                  });
                }}
                className="w-10 h-10 rounded-xl bg-velum-800 border border-accent/20 flex items-center justify-center font-bold text-xs text-accent overflow-hidden flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
                title="Velum"
              >
                <div className="w-5 h-5 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: logoSvg }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-text-primary truncate">
                    Velum
                  </p>
                  {velumTimeStr && (
                    <span className={`text-[10px] shrink-0 ${velumUnread > 0 ? 'text-accent font-semibold' : 'text-text-secondary'}`}>
                      {velumTimeStr}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className={`text-xs flex items-center gap-1 truncate ${velumUnread > 0 ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
                    {velumIsMe && velumMsgStatus === 'sent' && <Check className="w-3.5 h-3.5 text-text-secondary shrink-0" />}
                    {velumIsMe && velumMsgStatus === 'delivered' && <CheckCheck className="w-3.5 h-3.5 text-text-secondary shrink-0" />}
                    {velumIsMe && velumMsgStatus === 'read' && <CheckCheck className="w-3.5 h-3.5 text-accent shrink-0" />}
                    {velumTxt && renderPreviewWithIcons(velumTxt)}
                  </p>
                  {velumUnread > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-accent text-black shrink-0 min-w-[18px] text-center">
                      {velumUnread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Other friends/contacts */}
        {filteredFriends
          .filter(r => {
            const friendId = Number(r.friendId || r.userId || r.user_id || r.id);
            if (!Number.isFinite(friendId)) return false;
            const delTime = deletedDms[friendId];
            if (delTime) {
              const last = selectLatestDmMessage(friendId, currentUserId, lastMessages, r.last_message, forgottenPreviewIds);
              if (shouldHideDeletedDm(delTime, last)) return false;
            }
            const isArchived = archivedUserIds.includes(friendId);
            return filterTab === 'archived' ? isArchived : !isArchived;
          })
          .sort((a, b) => {
            const idA = Number(a.friendId || a.userId || a.user_id || a.id);
            const idB = Number(b.friendId || b.userId || b.user_id || b.id);
            const lastA = selectLatestDmMessage(idA, currentUserId, lastMessages, a.last_message, forgottenPreviewIds);
            const lastB = selectLatestDmMessage(idB, currentUserId, lastMessages, b.last_message, forgottenPreviewIds);
            return messageTimestamp(lastB) - messageTimestamp(lastA);
          })
          .map(r => {
            const friendId = Number(r.friendId || r.userId || r.user_id || r.id);
            if (!Number.isFinite(friendId)) return null;
            const friendName = resolveFriendName(r, friendId);
            const friendUsername = stripAt(r.username || `User #${friendId}`);
            const friendAvatar = r.avatarUrl || r.avatar || r.avatar_url || null;
            const dmRoomId = `dm_${friendId}`;
            const isArchived = archivedUserIds.includes(friendId);

            const unread = resolveDmUnreadCount(
              friendId,
              currentUserId,
              unreadCounts,
              typeof r.unread_count === 'number' ? r.unread_count : 0
            );

            const last = selectLatestDmMessage(friendId, currentUserId, lastMessages, r.last_message, forgottenPreviewIds);

            let lastTxt = '';
            let lastTimeStr = '';
            let isFailed = false;
            let lastMsgStatus = '';
            let isMe = false;

            if (last) {
              isMe = (last.user_id === currentUserId) || (last.senderId === currentUserId);
              lastTxt = getCleanPreview(getMessagePreviewPlaintext(last)) || '';
              if (last.status === 'failed' || last.delivery_status === 'failed') {
                isFailed = true;
              } else if (isMe) {
                if (last.status) {
                  lastMsgStatus = last.status;
                } else {
                  lastMsgStatus = 'sent';
                  const readArr = last.readBy ? last.readBy.split(',').map(Number).filter((id: number) => !isNaN(id)) : [];
                  const delArr = last.deliveredTo ? last.deliveredTo.split(',').map(Number).filter((id: number) => !isNaN(id)) : [];
                  if (readArr.includes(friendId)) {
                    lastMsgStatus = 'read';
                  } else if (delArr.includes(friendId)) {
                    lastMsgStatus = 'delivered';
                  }
                }
              }
              const ts = last.created_at || last.timestamp || last.createdAt;
              if (ts) {
                lastTimeStr = formatMessageTimestamp(ts);
              }
            }

            return (
              <div
                key={friendId}
                onClick={() => {
                  if (isLongPressRef.current) {
                    isLongPressRef.current = false;
                    return;
                  }
                  unDeleteContact(friendId);
                  try {
                    const lastId = last ? (last.message_id || last.id || last.messageId) : undefined;
                    if (onMarkAsRead) onMarkAsRead(lastId, dmRoomId);
                  } catch (e) {}

                  if (onSelectPeer) {
                    onSelectPeer({
                      userId: friendId,
                      username: friendUsername,
                      displayName: r.displayName || friendUsername,
                      nickname: nicknameOverrides[friendId] ?? r.nickname ?? '',
                      avatar: friendAvatar,
                    });
                  }
                  if (onSectionView) onSectionView('chat');
                }}
                onTouchStart={() => startLongPress({ userId: friendId, username: friendName, dmRoomId, isArchived })}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
                onTouchCancel={cancelLongPress}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextPeer({ userId: friendId, username: friendName, dmRoomId, isArchived });
                }}
                className={`w-full px-4 py-3 border-b border-velum-600 flex items-center justify-between gap-3 cursor-pointer transition-colors group relative ${
                  contextPeer?.userId === friendId 
                    ? 'bg-accent/15 border-l-4 border-l-accent' 
                    : 'hover:bg-velum-750 active:bg-velum-700'
                }`}
              >
                <div className="min-w-0 flex items-center gap-3 flex-1">
                  <div 
                    onClick={(e) => {
                      openQuickAvatar(e, {
                        userId: friendId,
                        username: friendUsername,
                        displayName: friendName,
                        nickname: nicknameOverrides[friendId] ?? r.nickname ?? '',
                        avatarUrl: friendAvatar || undefined,
                        bio: r.bio
                      });
                    }}
                    className="cursor-pointer active:scale-95 transition-transform"
                    title="View Photo"
                  >
                    <ContactAvatar name={friendName} avatar={friendAvatar} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs ${unread > 0 ? 'font-bold text-text-primary' : 'font-medium text-text-primary'} truncate`}>
                        {friendName}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {lastTimeStr && (
                          <span className={`text-[10px] shrink-0 ${unread > 0 ? 'text-accent font-semibold' : 'text-text-secondary'}`}>
                            {lastTimeStr}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setContextPeer(contextPeer?.userId === friendId ? null : { userId: friendId, username: friendName, dmRoomId, isArchived });
                          }}
                          className="w-8 h-8 -mr-1 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-velum-700 active:bg-velum-600 transition cursor-pointer shrink-0"
                          title="Chat Options"
                          aria-label="Chat Options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={`text-xs flex items-center gap-1 min-w-0 flex-1 truncate ${unread > 0 ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
                        {isMe && !isFailed && lastMsgStatus === 'sent' && <Check className="w-3.5 h-3.5 text-text-secondary shrink-0" />}
                        {isMe && !isFailed && lastMsgStatus === 'delivered' && <CheckCheck className="w-3.5 h-3.5 text-text-secondary shrink-0" />}
                        {isMe && !isFailed && lastMsgStatus === 'read' && <CheckCheck className="w-3.5 h-3.5 text-accent shrink-0" />}
                        <span className="truncate min-w-0">
                          {lastTxt ? renderPreviewWithIcons(lastTxt) : ''}
                        </span>
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isFailed ? (
                          <span className="text-[10px] font-semibold text-status-dnd">
                            Failed
                          </span>
                        ) : unread > 0 ? (
                          <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-accent text-black shrink-0 min-w-[18px] text-center">
                            {unread}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Floating Action Button → Contacts */}
      <button
        type="button"
        onClick={() => {
          if (onOpenContacts) onOpenContacts();
        }}
        className="fixed bottom-[calc(1.75rem+env(safe-area-inset-bottom,0px))] right-5 z-30 w-14 h-14 rounded-2xl bg-accent hover:bg-accent-hover active:scale-95 text-velum-900 flex items-center justify-center cursor-pointer transition-all group shadow-lg shadow-accent/20"
        title="Contacts"
        aria-label="Open contacts"
      >
        <MessageSquarePlus className="w-7 h-7 text-velum-900 group-hover:scale-105 transition-transform" />
      </button>

      {/* Quick Avatar Preview — popover anchored to the clicked avatar */}
      {quickAvatarPeer && (
        <div
          className="fixed inset-0 z-[99999] bg-black/40 animate-in fade-in duration-100 select-none"
          onClick={() => setQuickAvatarPeer(null)}
        >
          <div
            className="fixed w-72 max-w-[calc(100vw-1.5rem)] bg-velum-850 border border-velum-600 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-100 text-text-primary flex flex-col"
            style={{ top: quickAvatarPeer.anchor.top, left: quickAvatarPeer.anchor.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar with Name */}
            <div className="p-3 bg-velum-800 border-b border-velum-600/60 flex items-center justify-between">
              <span className="text-sm font-bold text-white truncate">
                {resolveContactName({
                  nickname: quickAvatarPeer.nickname,
                  displayName: quickAvatarPeer.displayName,
                  username: quickAvatarPeer.username,
                })}
              </span>
            </div>

            {/* Large avatar preview — fixed height, full-bleed (no floating center circle) */}
            <div className="w-full h-48 min-h-[12rem] bg-velum-900 overflow-hidden relative shrink-0">
              {quickAvatarPeer.userId === 999 && !quickAvatarPeer.avatarUrl ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 [&>svg]:w-full [&>svg]:h-full text-accent opacity-90" dangerouslySetInnerHTML={{ __html: logoSvg }} />
                </div>
              ) : isAvatarImageSrc(quickAvatarPeer.avatarUrl) ? (
                <img
                  src={resolveMediaUrl(quickAvatarPeer.avatarUrl)}
                  alt={quickAvatarPeer.username}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    const img = e.currentTarget;
                    img.style.display = 'none';
                    const fallback = img.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div
                className={`absolute inset-0 flex items-end p-4 bg-velum-800 ${
                  isAvatarImageSrc(quickAvatarPeer.avatarUrl) ? 'hidden' : ''
                } ${quickAvatarPeer.userId === 999 && !quickAvatarPeer.avatarUrl ? 'hidden' : ''}`}
              >
                <span className="text-5xl font-bold text-accent/80 uppercase leading-none">
                  {(
                    resolveContactName({
                      nickname: quickAvatarPeer.nickname,
                      displayName: quickAvatarPeer.displayName,
                      username: quickAvatarPeer.username,
                      fallback: 'U',
                    }) || 'U'
                  )
                    .trim()
                    .slice(0, 1)
                    .toUpperCase() || 'U'}
                </span>
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="p-2.5 bg-velum-800 border-t border-velum-600/60 flex items-center justify-around">
              <button
                type="button"
                onClick={() => {
                  unDeleteContact(quickAvatarPeer.userId);
                  if (onSelectPeer) {
                    onSelectPeer({
                      userId: quickAvatarPeer.userId,
                      username: quickAvatarPeer.username,
                      displayName: quickAvatarPeer.displayName,
                      nickname: quickAvatarPeer.nickname,
                      avatar: quickAvatarPeer.avatarUrl,
                    });
                  }
                  if (onSectionView) onSectionView('chat');
                  setQuickAvatarPeer(null);
                }}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-accent hover:bg-accent/15 active:bg-accent/20 transition cursor-pointer"
                title="Chat"
                aria-label="Chat"
              >
                <MessageSquare className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const peer = quickAvatarPeer;
                  setQuickAvatarPeer(null);
                  if (loadAndShowProfileCard) {
                    loadAndShowProfileCard({
                      userId: peer.userId,
                      username: peer.username,
                      displayName: peer.displayName || peer.username,
                      nickname: peer.nickname || '',
                      avatarUrl: peer.avatarUrl,
                      avatar: peer.avatarUrl,
                      bio: peer.bio
                    });
                  }
                }}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-accent hover:bg-accent/15 active:bg-accent/20 transition cursor-pointer"
                title="Profile Info"
                aria-label="Profile Info"
              >
                <Info className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DirectMainDashboard;
