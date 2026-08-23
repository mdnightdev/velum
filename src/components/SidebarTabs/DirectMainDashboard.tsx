import React from 'react';
import { MessageSquare, Bot, Menu, Check, CheckCheck } from 'lucide-react';
import { decryptMessage, decryptMessageSync } from '../../services/encryptionService';
import { stripAt } from '../../types';
import logoSvg from '../../assets/logo.svg?raw';
import { useLanguage } from '../../i18n/LanguageContext';
import { getCleanPreview, parseAttachment, formatVoiceNotePreview } from '../../utils/messageParser';
import { formatMessageTimestamp } from '../../utils/time';

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
    if (Array.isArray(friendRelationships)) {
      return friendRelationships;
    }
    if (friendRelationships && typeof friendRelationships === 'object' && 'relationships' in friendRelationships) {
      return (friendRelationships as any).relationships;
    }
    return [];
  })();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [decryptedPreviews, setDecryptedPreviews] = React.useState<Record<number, string>>({});

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
          // Own outgoing e2ee:v1 messages can never be decrypted here - they
          // were sealed with the PEER's identity key, not ours. Only the
          // recipient can reverse that. Use the plaintext we already know
          // locally (set at send time) instead of attempting a decrypt that
          // is structurally guaranteed to fail.
          if (isMe && isStatelessDmEnvelope(raw)) {
            const known = last.plaintext || last.client_plaintext || '';
            if (isMounted && known) {
              setDecryptedPreviews(prev => ({ ...prev, [friendId]: known }));
            }
            continue;
          }
          if (raw) {
            try {
              const decrypted = isStatelessDmEnvelope(raw)
                ? await decryptMessage(raw, { type: 'direct', peerUserId: friendId })
                : decryptMessageSync(raw, dmRoomId, !!(last.is_encrypted || last.isEncrypted));
              if (isMounted && decrypted) {
                setDecryptedPreviews(prev => ({ ...prev, [friendId]: decrypted }));
              }
            } catch (e) {}
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
      {/* Header */}
      <div className="p-2.5 border-b border-velum-600 bg-velum-850 flex-shrink-0 flex items-center gap-2">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer shrink-0"
            aria-label="Open sidebar menu"
            title="Open Navigation"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <div className="relative flex-1 flex items-center h-8 px-2.5 rounded-lg border border-velum-600 bg-velum-750 focus-within:border-accent/40">
          <input
            type="text"
            placeholder={t('chats.search', 'Search messages...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-xs text-text-primary placeholder-text-disabled"
          />
        </div>
      </div>

      {/* Directory List */}
      <div className="flex-1 overflow-y-auto w-full flex flex-col">
        {/* Default Secure VELUM System Contact */}
        <div
          onClick={() => {
            if (onSelectPeer) onSelectPeer({ userId: 999, username: 'VELUM', avatar: undefined });
            if (onSectionView) onSectionView('chat');
            if (onMarkAsRead) onMarkAsRead('', velumRoomId);
          }}
          className="w-full px-3.5 py-2.5 border-b border-velum-600 flex items-center justify-between gap-3 cursor-pointer hover:bg-velum-750 transition-colors"
        >
          <div className="min-w-0 flex items-center gap-3 flex-1">
            <div 
              className="w-9 h-9 rounded-lg bg-velum-800 border border-accent/20 flex items-center justify-center font-bold text-xs text-accent overflow-hidden flex-shrink-0"
              title="Velum"
            >
              <div className="w-4.5 h-4.5 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: logoSvg }} />
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

        {/* Other friends/contacts */}
        {filteredFriends.sort((a, b) => {
          const dmA = `dm_${Math.min(currentUserId, a.friendId)}_${Math.max(currentUserId, a.friendId)}`;
          const dmB = `dm_${Math.min(currentUserId, b.friendId)}_${Math.max(currentUserId, b.friendId)}`;
          const lm = lastMessages || {};
          const lastA = lm[dmA] || a.last_message;
          const lastB = lm[dmB] || b.last_message;
          
          const timeA = lastA ? new Date(lastA.createdAt || lastA.created_at || lastA.timestamp || 0).getTime() : 0;
          const timeB = lastB ? new Date(lastB.createdAt || lastB.created_at || lastB.timestamp || 0).getTime() : 0;
          
          return timeB - timeA;
        }).map(r => {
          const friendId = r.friendId;
          const friendName = stripAt(r.username || r.displayName);
          const friendAvatar = r.avatarUrl;
          const dmRoomId = `dm_${Math.min(currentUserId, friendId)}_${Math.max(currentUserId, friendId)}`;
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
              // Own outgoing e2ee:v1 messages can't be decrypted here - only
              // the recipient holds the key. If no plaintext was cached
              // locally at send time (e.g. after a reload), show a neutral
              // placeholder instead of raw ciphertext or attempting a
              // guaranteed-to-fail decrypt.
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
                try {
                  const lastId = last ? (last.message_id || last.id || last.messageId) : undefined;
                  if (onMarkAsRead) onMarkAsRead(lastId, dmRoomId);
                } catch (e) {}

                if (onSelectPeer) onSelectPeer({ userId: friendId, username: friendName, avatar: friendAvatar });
                if (onSectionView) onSectionView('chat');
              }}
              className="w-full px-3.5 py-2.5 border-b border-velum-600 flex items-center justify-between gap-3 cursor-pointer hover:bg-velum-750 transition-colors"
            >
              <div className="min-w-0 flex items-center gap-3 flex-1">
                <div className="w-9 h-9 rounded-lg bg-velum-750 border border-velum-600 flex items-center justify-center font-bold text-xs text-text-secondary overflow-hidden flex-shrink-0 relative">
                  {friendAvatar ? (
                    <img src={friendAvatar} alt={friendName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="uppercase text-xs font-semibold text-text-primary">{friendName.slice(0, 2)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs ${unread > 0 ? 'font-bold text-text-primary' : 'font-medium text-text-primary'} truncate`}>
                      {friendName}
                    </p>
                    {lastTimeStr && (
                      <span className={`text-[10px] shrink-0 ${unread > 0 ? 'text-accent font-semibold' : 'text-text-secondary'}`}>
                        {lastTimeStr}
                      </span>
                    )}
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
    </div>
  );
}
