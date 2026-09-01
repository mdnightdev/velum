import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Bot, Menu, Check, CheckCheck, Archive, ArchiveRestore, Trash2, MoreVertical, X, MessageSquarePlus, Search, Info } from 'lucide-react';
import { decryptMessage, decryptMessageSync } from '../../services/encryptionService';
import { stripAt } from '../../types';
import logoSvg from '../../assets/logo.svg?raw';
import { useLanguage } from '../../i18n/LanguageContext';
import { getCleanPreview, parseAttachment, formatVoiceNotePreview } from '../../utils/messageParser';
import { formatMessageTimestamp } from '../../utils/time';
import { getLocalMessages, flushLoungeCache } from '../../utils/indexedDb';
import { resolveMediaUrl } from '../../utils/mediaPipeline';
import { getSessionId } from '../../utils/auth';

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
    const attachments = parseAttachment(content);
    const att = attachments[0];
    const isVid = att && (att.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|ogg|m4v)($|\?)/i.test(att.name) || /\.(mp4|webm|mov|mkv|ogg|m4v)($|\?)/i.test(att.data));
    const isImg = att && att.type.startsWith('image/');

    if (isVid) {
      return (
        <span className="inline-flex items-center gap-1 truncate">
          <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          <span className="truncate">{att ? (att.caption ? `Video ${att.caption}` : 'Video') : 'Video'}</span>
        </span>
      );
    }
    if (isImg) {
      return (
        <span className="inline-flex items-center gap-1 truncate">
          <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="2.5" width="19" height="19" rx="4" />
            <circle cx="8.5" cy="8.5" r="2" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span className="truncate">{att ? (att.caption ? `Photo ${att.caption}` : 'Photo') : 'Photo'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 truncate">
        <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span className="truncate">{att ? (att.caption ? `${att.name} ${att.caption}` : att.name) : 'Attachment'}</span>
      </span>
    );
  }
  if (content.startsWith('Photo')) {
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
  if (content.startsWith('Video')) {
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
  return <span className="truncate">{content}</span>;
}

// e2ee:v1: envelopes are stateless-ECDH DMs and can only be decrypted async
// (they hit IndexedDB for the local identity key). decryptMessageSync only
// understands the VEL_E2EE[...] lounge XOR format, so it must never be used
// as the terminal decryptor for DM content - only as a legacy/lounge fallback.
function isStatelessDmEnvelope(raw: string): boolean {
  return raw.startsWith('e2ee:v1:');
}

interface DirectMainDashboardProps {
  friendRequests: any[];
  friendRelationships: any[];
  currentUserId: number;
  isDark: boolean;
  onSelectPeer?: (peer: { userId: number; username: string; avatar?: string }) => void;
  onSectionView?: (view: any) => void;
  onMarkAsRead?: (messageId: string | undefined, roomId: string) => void;
  unreadCounts: Record<string, number>;
  lastMessages?: Record<string, any>;
  loadAndShowProfileCard: (user: any) => void;
  getCountryOnly: (location: string) => string;
  onToggleSidebar?: () => void;
}



export default function DirectMainDashboard({
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
  onToggleSidebar
}: DirectMainDashboardProps) {
  const { t } = useLanguage();

  const relationshipsArray: any[] = (() => {
    let raw: any[] = [];
    if (Array.isArray(friendRelationships)) {
      raw = friendRelationships;
    } else if (friendRelationships && typeof friendRelationships === 'object' && 'relationships' in friendRelationships) {
      raw = (friendRelationships as any).relationships || [];
    }
    const SYSTEM_IDS = new Set([1, 2, 999]);
    return raw.filter((r: any) => {
      const fId = r.friendId || r.userId || r.user_id;
      const uname = (r.username || r.displayName || '').toLowerCase();
      return !SYSTEM_IDS.has(fId) && uname !== 'velum';
    });
  })();
  const [searchQuery, setSearchQuery] = useState('');
  const [decryptedPreviews, setDecryptedPreviews] = useState<Record<number, string>>({});
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
  const [isNewChatPickerOpen, setIsNewChatPickerOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [quickAvatarPeer, setQuickAvatarPeer] = useState<{ userId: number; username: string; displayName?: string; avatarUrl?: string; bio?: string } | null>(null);

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
      const dmRoomId = `dm_${Math.min(currentUserId, peerId)}_${Math.max(currentUserId, peerId)}`;
      const candidateKeys = [dmRoomId, `dm_${peerId}`, `dm_${currentUserId}_${peerId}`, `dm_${peerId}_${currentUserId}`];
      let last: any = null;
      for (const k of candidateKeys) {
        if (k && lastMessages[k]) { last = lastMessages[k]; break; }
      }
      if (last) {
        const msgTime = last.createdAt ? new Date(last.createdAt).getTime() : last.created_at ? new Date(last.created_at).getTime() : (last.timestamp ? new Date(last.timestamp).getTime() : 0);
        if (msgTime > delTime) {
          delete nextMap[peerId];
          changed = true;
        }
      }
    }

    if (changed) {
      setDeletedDms(nextMap);
      try {
        localStorage.setItem(`velum_deleted_dms_${currentUserId}`, JSON.stringify(nextMap));
      } catch {}
    }
  }, [lastMessages, currentUserId, deletedDms]);

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

  const handleDeleteConversation = async (peerId: number, peerName: string, dmRoomId: string) => {
    try {
      const now = Date.now();
      setDeletedDms(prev => {
        const next = { ...prev, [peerId]: now };
        try {
          localStorage.setItem(`velum_deleted_dms_${currentUserId}`, JSON.stringify(next));
        } catch {}
        return next;
      });

      // 1. Wipe local cache for this DM room
      await flushLoungeCache(dmRoomId, currentUserId);

      // 2. Call server to purge messages from DB
      try {
        const sId = getSessionId();
        await fetch(`/v2/user/${peerId}/chat`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${sId}` }
        });
      } catch (err) {
        console.warn('Server chat deletion call failed:', err);
      }

      // 3. Clear preview cache
      setDecryptedPreviews(prev => {
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      });
      setContextPeer(null);
    } catch (e) {
      console.warn('Failed to delete conversation:', e);
    }
  };

  React.useEffect(() => {
    let isMounted = true;
    const processPreviews = async () => {
      for (const r of relationshipsArray) {
        const friendId = r.friendId;
        const dmRoomId = `dm_${Math.min(currentUserId, friendId)}_${Math.max(currentUserId, friendId)}`;
        const lm = lastMessages || {};
        const candidateKeys = [dmRoomId, `dm_${friendId}`, `dm_${currentUserId}_${friendId}`, `dm_${friendId}_${currentUserId}`];
        let last = r.last_message || null;
        for (const k of candidateKeys) {
          if (k && lm[k]) { last = lm[k]; break; }
        }
        if (last) {
          const raw = last.content || last.message || last.body || last.text || '';
          const isMe = (last.user_id === currentUserId) || (last.senderId === currentUserId);
          if (isMe && isStatelessDmEnvelope(raw)) {
            let known = last.plaintext || last.client_plaintext || '';
            if (!known) {
              const localStore = await getLocalMessages(dmRoomId, 10, currentUserId).catch(() => []);
              const match = localStore.find((lm: any) => lm.plaintext && (lm.content === raw || lm.id === last.message_id || lm.message_id === last.message_id));
              if (match?.plaintext) {
                known = match.plaintext;
              }
            }
            if (isMounted && known) {
              setDecryptedPreviews(prev => ({ ...prev, [friendId]: known }));
            }
            continue;
          }
          if (raw) {
            try {
              let decrypted = isStatelessDmEnvelope(raw)
                ? await decryptMessage(raw, { type: 'direct', peerUserId: friendId })
                : decryptMessageSync(raw, dmRoomId, !!(last.is_encrypted || last.isEncrypted));
              if (!decrypted || decrypted === '[Encrypted Message]') {
                const localStore = await getLocalMessages(dmRoomId, 10, currentUserId).catch(() => []);
                const match = localStore.find((lm: any) => lm.plaintext && (lm.content === raw || lm.id === last.message_id || lm.message_id === last.message_id));
                if (match?.plaintext) {
                  decrypted = match.plaintext;
                }
              }
              if (isMounted && decrypted) {
                setDecryptedPreviews(prev => ({ ...prev, [friendId]: decrypted }));
              }
            } catch (e) {}
          }
        } else {
          if (isMounted) {
            setDecryptedPreviews(prev => {
              if (!prev[friendId]) return prev;
              const copy = { ...prev };
              delete copy[friendId];
              return copy;
            });
          }
        }
      }
    };
    processPreviews();
    return () => { isMounted = false; };
  }, [relationshipsArray, lastMessages, currentUserId]);

  const velumRoomIdKey = `dm_velum_${currentUserId}`;
  const velumLastForEffect = lastMessages[velumRoomIdKey];
  const [velumDecrypted, setVelumDecrypted] = React.useState('');

  React.useEffect(() => {
    let isMounted = true;
    const processVelumPreview = async () => {
      if (!velumLastForEffect) {
        if (isMounted) setVelumDecrypted('');
        return;
      }
      const raw = velumLastForEffect.content || velumLastForEffect.message || velumLastForEffect.body || velumLastForEffect.text || '';
      const actualRoomId = velumLastForEffect.room_id || velumRoomIdKey;
      const isMe = (velumLastForEffect.user_id === currentUserId) || (velumLastForEffect.senderId === currentUserId);
      if (!raw) {
        if (isMounted) setVelumDecrypted('');
        return;
      }
      if (isMe && isStatelessDmEnvelope(raw)) {
        // Can't decrypt our own outgoing message here - only the recipient
        // can. Use the plaintext we already know locally, if it's still around.
        if (isMounted) setVelumDecrypted(velumLastForEffect.plaintext || velumLastForEffect.client_plaintext || '');
        return;
      }
      try {
        const decrypted = isStatelessDmEnvelope(raw)
          ? await decryptMessage(raw, { type: 'direct', peerUserId: 999 })
          : (decryptMessageSync(raw, actualRoomId, !!(velumLastForEffect.is_encrypted || velumLastForEffect.isEncrypted)) || raw);
        if (isMounted) setVelumDecrypted(decrypted || '');
      } catch (e) {
        if (isMounted) setVelumDecrypted('');
      }
    };
    processVelumPreview();
    return () => { isMounted = false; };
  }, [velumLastForEffect, currentUserId]);

  const filteredFriends = relationshipsArray.filter(r => {
    const name = r.username || r.displayName;
    return name?.toLowerCase().includes(searchQuery.toLowerCase());
  });
  const velumUnread = unreadCounts[`dm_velum_${currentUserId}`] || 0;

  const velumRoomId = `dm_velum_${currentUserId}`;
  const velumLast = lastMessages[velumRoomId];
  let velumTxt = '';
  let velumTimeStr = '';
  let velumMsgStatus = '';
  let velumIsMe = false;
  if (velumLast) {
    velumIsMe = (velumLast.user_id === currentUserId) || (velumLast.senderId === currentUserId);
    const raw = velumLast.content || velumLast.message || velumLast.body || velumLast.text || '';
    // Stateless e2ee:v1 envelopes are resolved async via the effect above and
    // land in velumDecrypted; never fall back to sync-decrypting them here.
    velumTxt = velumDecrypted || (isStatelessDmEnvelope(raw) ? (velumIsMe ? (velumLast.plaintext || velumLast.client_plaintext || 'Message sent') : '') : raw || '');
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
        <div className="p-3 pt-[calc(env(safe-area-inset-top,0px)+0.875rem)] px-4 border-b border-velum-600 bg-velum-850 flex-shrink-0 flex items-center gap-2.5">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="md:hidden p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer shrink-0"
              aria-label="Open sidebar menu"
              title="Open Navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <div className="relative flex-1 flex items-center h-9 px-3 rounded-xl border border-velum-600 bg-velum-750 focus-within:border-accent/40">
            <input
              type="text"
              placeholder={t('chats.search', 'Search messages...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-xs text-text-primary placeholder-text-disabled"
            />
          </div>
        </div>
      )}

      {/* Filter Tabs (All vs Archived) */}
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
          {archivedUserIds.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-velum-750 border border-velum-600">
              {archivedUserIds.length}
            </span>
          )}
        </button>
      </div>

      {/* Directory List */}
      <div className="flex-1 overflow-y-auto w-full flex flex-col relative">
        {/* Default Secure VELUM System Contact (only in active tab) */}
        {filterTab === 'active' && !deletedDms[999] && (
          <div
            onClick={() => {
              unDeleteContact(999);
              if (onSelectPeer) onSelectPeer({ userId: 999, username: 'VELUM', avatar: undefined });
              if (onSectionView) onSectionView('chat');
              if (onMarkAsRead) onMarkAsRead('', velumRoomId);
            }}
            className="w-full px-4 py-3 border-b border-velum-600 flex items-center justify-between gap-3 cursor-pointer hover:bg-velum-750 transition-colors"
          >
            <div className="min-w-0 flex items-center gap-3 flex-1">
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setQuickAvatarPeer({
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
                  <p className="text-xs font-semibold text-text-primary flex items-center gap-1.5 truncate">
                    Velum
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-accent/15 text-accent">System</span>
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
            const delTime = deletedDms[r.friendId];
            if (delTime) {
              const dmRoomId = `dm_${Math.min(currentUserId, r.friendId)}_${Math.max(currentUserId, r.friendId)}`;
              const candidateKeys = [dmRoomId, `dm_${r.friendId}`, `dm_${currentUserId}_${r.friendId}`, `dm_${r.friendId}_${currentUserId}`];
              let last: any = null;
              const lm = lastMessages || {};
              for (const k of candidateKeys) {
                if (k && lm[k]) { last = lm[k]; break; }
              }
              const msgTime = last ? (last.createdAt ? new Date(last.createdAt).getTime() : last.created_at ? new Date(last.created_at).getTime() : (last.timestamp ? new Date(last.timestamp).getTime() : 0)) : 0;
              if (msgTime <= delTime) return false;
            }
            const isArchived = archivedUserIds.includes(r.friendId);
            return filterTab === 'archived' ? isArchived : !isArchived;
          })
          .sort((a, b) => {
            const dmA = `dm_${Math.min(currentUserId, a.friendId)}_${Math.max(currentUserId, a.friendId)}`;
            const dmB = `dm_${Math.min(currentUserId, b.friendId)}_${Math.max(currentUserId, b.friendId)}`;
            const lm = lastMessages || {};
            const lastA = lm[dmA] || a.last_message;
            const lastB = lm[dmB] || b.last_message;
            
            const timeA = lastA ? new Date(lastA.createdAt || lastA.created_at || lastA.timestamp || 0).getTime() : 0;
            const timeB = lastB ? new Date(lastB.createdAt || lastB.created_at || lastB.timestamp || 0).getTime() : 0;
            
            return timeB - timeA;
          })
          .map(r => {
            const friendId = r.friendId;
            const friendName = stripAt(r.username || r.displayName);
            const friendAvatar = r.avatarUrl;
            const dmRoomId = `dm_${Math.min(currentUserId, friendId)}_${Math.max(currentUserId, friendId)}`;
            const isArchived = archivedUserIds.includes(friendId);
            const candidateKeys = [
              dmRoomId,
              `dm_${friendId}`,
              `dm_${currentUserId}_${friendId}`,
              `dm_${friendId}_${currentUserId}`
            ];

            let unread = typeof r.unread_count === 'number' ? r.unread_count : 0;
            for (const k of candidateKeys) {
              if (k && unreadCounts && typeof unreadCounts[k] === 'number') {
                unread = unreadCounts[k];
                break;
              }
            }

            const lm = lastMessages || {};
            let last = r.last_message || null as any;
            for (const k of candidateKeys) {
              if (k && lm[k]) { last = lm[k]; break; }
            }

            let lastTxt = '';
            let lastTimeStr = '';
            let isFailed = false;
            let lastMsgStatus = '';
            let isMe = false;

            if (last) {
              isMe = (last.user_id === currentUserId) || (last.senderId === currentUserId);
              const raw = last.content || last.message || last.body || last.text || '';
              const isEnc = !!(last.is_encrypted || last.isEncrypted);
              const actualRoomId = last.room_id || dmRoomId;
              const displayTxt = decryptedPreviews[friendId] || (function() {
                if (isStatelessDmEnvelope(raw)) {
                  if (isMe) return last.plaintext || last.client_plaintext || 'Message sent';
                  return '';
                }
                try {
                  return decryptMessageSync(raw, actualRoomId, isEnc) || raw || '';
                } catch (e) {
                  return raw || '';
                }
              })();
              lastTxt = getCleanPreview(displayTxt);
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

                  if (onSelectPeer) onSelectPeer({ userId: friendId, username: friendName, avatar: friendAvatar });
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
                      e.stopPropagation();
                      setQuickAvatarPeer({
                        userId: friendId,
                        username: friendName,
                        displayName: friendName,
                        avatarUrl: friendAvatar,
                        bio: r.bio
                      });
                    }}
                    className="w-10 h-10 rounded-xl bg-velum-750 border border-velum-600 flex items-center justify-center font-bold text-xs text-text-secondary overflow-hidden flex-shrink-0 relative cursor-pointer active:scale-95 transition-transform"
                    title="View Photo"
                  >
                    {friendAvatar ? (
                      <img 
                        src={resolveMediaUrl(friendAvatar)} 
                        alt={friendName} 
                        className="w-full h-full object-cover" 
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="uppercase text-xs font-semibold text-text-primary">{friendName.slice(0, 2)}</span>
                    )}
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
                      <p className={`text-xs flex items-center gap-1 truncate ${unread > 0 ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
                        {isMe && !isFailed && lastMsgStatus === 'sent' && <Check className="w-3.5 h-3.5 text-text-secondary shrink-0" />}
                        {isMe && !isFailed && lastMsgStatus === 'delivered' && <CheckCheck className="w-3.5 h-3.5 text-text-secondary shrink-0" />}
                        {isMe && !isFailed && lastMsgStatus === 'read' && <CheckCheck className="w-3.5 h-3.5 text-accent shrink-0" />}
                        {lastTxt && renderPreviewWithIcons(lastTxt)}
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

      {/* Floating Action Button (New Chat) */}
      <button
        type="button"
        onClick={() => {
          setNewChatSearch('');
          setIsNewChatPickerOpen(true);
        }}
        className="fixed bottom-8 right-6 z-30 w-15 h-15 rounded-2xl bg-accent hover:bg-accent-hover active:scale-95 text-velum-900 shadow-2xl shadow-accent/40 flex items-center justify-center cursor-pointer transition-all group"
        title="Start new conversation"
        aria-label="Start new conversation"
      >
        <MessageSquarePlus className="w-7 h-7 text-velum-900 group-hover:scale-110 transition-transform" />
      </button>

      {/* New Conversation Contact Selector Bottom Sheet */}
      {isNewChatPickerOpen && (
        <div
          className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center modal-backdrop bg-black/75 p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setIsNewChatPickerOpen(false)}
        >
          <div
            className="w-full max-w-md bg-velum-850 border-t sm:border border-velum-600 rounded-t-3xl sm:rounded-2xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200 text-text-primary max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto sm:hidden -mt-1" />
            <div className="flex items-center justify-between pb-2 border-b border-velum-600 shrink-0">
              <div className="flex flex-col">
                <span className="text-base font-bold text-text-primary">New Conversation</span>
                <span className="text-xs text-text-secondary">Select a contact to message</span>
              </div>
              <button
                type="button"
                onClick={() => setIsNewChatPickerOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search contacts input */}
            <div className="relative flex items-center h-10 px-3 rounded-xl border border-velum-600 bg-velum-750 focus-within:border-accent/40 shrink-0">
              <Search className="w-4 h-4 text-text-secondary mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search contacts by name..."
                value={newChatSearch}
                onChange={(e) => setNewChatSearch(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-xs text-text-primary placeholder-text-disabled"
                autoFocus
              />
            </div>

            {/* Contacts list */}
            <div className="flex-1 overflow-y-auto space-y-1 min-h-[160px] max-h-[50vh] pr-1">
              {/* Velum system contact */}
              {(!newChatSearch || 'velum'.includes(newChatSearch.toLowerCase())) && (
                <div
                  onClick={() => {
                    unDeleteContact(999);
                    if (onSelectPeer) onSelectPeer({ userId: 999, username: 'VELUM', avatar: undefined });
                    if (onMarkAsRead) onMarkAsRead('', velumRoomId);
                    setIsNewChatPickerOpen(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-velum-750 active:bg-velum-700 transition"
                >
                  <div className="w-10 h-10 rounded-xl bg-velum-800 border border-accent/20 flex items-center justify-center font-bold text-xs text-accent overflow-hidden shrink-0">
                    <div className="w-5 h-5 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: logoSvg }} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                      Velum <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-accent/15 text-accent">System</span>
                    </span>
                    <span className="text-[11px] text-text-secondary">Official System Bot</span>
                  </div>
                </div>
              )}

              {/* All contacts */}
              {relationshipsArray
                .filter(r => {
                  const name = stripAt(r.username || r.displayName || '');
                  return !newChatSearch || name.toLowerCase().includes(newChatSearch.toLowerCase());
                })
                .map(r => {
                  const fId = r.friendId;
                  const fName = stripAt(r.username || r.displayName || '');
                  const fAvatar = r.avatarUrl;
                  const dmSlug = `dm_${Math.min(currentUserId, fId)}_${Math.max(currentUserId, fId)}`;

                  return (
                    <div
                      key={fId}
                      onClick={() => {
                        // Un-delete this user so conversation card appears
                        unDeleteContact(fId);
                        if (onSelectPeer) onSelectPeer({ userId: fId, username: fName, avatar: fAvatar });
                        if (onMarkAsRead) onMarkAsRead(undefined, dmSlug);
                        setIsNewChatPickerOpen(false);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-velum-750 active:bg-velum-700 transition"
                    >
                      <div className="w-10 h-10 rounded-xl bg-velum-750 border border-velum-600 flex items-center justify-center font-bold text-xs text-text-secondary overflow-hidden shrink-0">
                        {fAvatar ? (
                          <img src={resolveMediaUrl(fAvatar)} alt={fName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="uppercase text-xs font-semibold text-text-primary">{fName.slice(0, 2)}</span>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-text-primary truncate">{fName}</span>
                        <span className="text-[11px] text-text-secondary">Tap to start encrypted conversation</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Quick Avatar Preview Modal */}
      {quickAvatarPeer && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center modal-backdrop bg-black/75 p-4 animate-in fade-in duration-150 select-none"
          onClick={() => setQuickAvatarPeer(null)}
        >
          <div
            className="w-72 max-w-[85vw] bg-velum-850 border border-velum-600 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 text-text-primary flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar with Name */}
            <div className="p-3 bg-velum-800 border-b border-velum-600/60 flex items-center justify-between">
              <span className="text-sm font-bold text-white truncate">{quickAvatarPeer.displayName || quickAvatarPeer.username}</span>
            </div>

            {/* Large Square Image Preview */}
            <div className="w-full aspect-square bg-velum-900 flex items-center justify-center overflow-hidden relative">
              {quickAvatarPeer.avatarUrl ? (
                <img
                  src={resolveMediaUrl(quickAvatarPeer.avatarUrl)}
                  alt={quickAvatarPeer.username}
                  className="w-full h-full object-cover"
                />
              ) : quickAvatarPeer.userId === 999 ? (
                <div className="w-24 h-24 [&>svg]:w-full [&>svg]:h-full text-accent" dangerouslySetInnerHTML={{ __html: logoSvg }} />
              ) : (
                <div className="w-24 h-24 rounded-full bg-velum-800 border border-accent/20 flex items-center justify-center font-bold text-3xl text-accent uppercase">
                  {(quickAvatarPeer.username || 'U').slice(0, 2)}
                </div>
              )}
            </div>

            {/* Bottom Action Bar */}
            <div className="p-2.5 bg-velum-800 border-t border-velum-600/60 flex items-center justify-around">
              <button
                type="button"
                onClick={() => {
                  unDeleteContact(quickAvatarPeer.userId);
                  if (onSelectPeer) onSelectPeer({ userId: quickAvatarPeer.userId, username: quickAvatarPeer.username, avatar: quickAvatarPeer.avatarUrl });
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
