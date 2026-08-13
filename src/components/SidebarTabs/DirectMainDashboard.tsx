import React from 'react';
import { MessageSquare, Bot, Menu, Check, CheckCheck } from 'lucide-react';
import { decryptMessageSync } from '../../services/encryptionService';
import { stripAt } from '../../types';
import logoSvg from '../../assets/logo.svg?raw';
import { useLanguage } from '../../i18n/LanguageContext';
import { getCleanPreview } from '../../utils/messageParser';
import { formatMessageTimestamp } from '../../utils/time';
import { Mic, Image as ImageIcon } from 'lucide-react';

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
          if (raw) {
            try {
              const decrypted = decryptMessageSync(raw, dmRoomId, !!(last.is_encrypted || last.isEncrypted));
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
    const actualRoomId = velumLast.room_id || velumRoomId;
    try {
      velumTxt = decryptMessageSync(raw, actualRoomId, !!(velumLast.is_encrypted || velumLast.isEncrypted)) || raw || '';
    } catch (e) {
      velumTxt = raw || '';
    }
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
    <div className="flex-1 flex flex-col w-full h-full select-none font-sans bg-transparent">
      {/* Header */}
      <div className="px-6 py-3 border-b flex-shrink-0 border-white-5 bg-transparent flex items-center gap-2">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-white-5 transition cursor-pointer shrink-0"
            aria-label="Open sidebar menu"
            title="Open Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="relative flex-1 flex items-center h-9 px-3 rounded-full border bg-transparent border-white-5 focus-within:border-accent">
          <input
            type="text"
            placeholder={t('chats.search', 'Search chats...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-xs ml-1 text-text-primary"
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
          className={`w-full px-5 py-3.5 border-b flex items-center justify-between gap-3 cursor-pointer transition-colors ${
            isDark ? 'border-white-5 hover:bg-text-primary/[0.03]' : 'border-gray-100 hover:bg-gray-50'
          }`}
        >
          <div className="min-w-0 flex items-center gap-3 flex-1">
            <div 
              className="w-11 h-11 rounded-full bg-velum-800 border border-accent/20 flex items-center justify-center font-black text-xs text-accent overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80"
              title="VELUM System"
            >
              <div className="w-5 h-5 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: logoSvg }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm font-bold capitalize flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Velum
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-accent/10 text-accent uppercase tracking-wider">System</span>
                </p>
                {velumTimeStr && (
                  <span className={`text-[11px] font-mono shrink-0 ${velumUnread > 0 ? 'text-accent font-semibold' : 'text-text-secondary'}`}>
                    {velumTimeStr}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className={`text-xs flex items-center gap-1 truncate ${velumUnread > 0 ? 'font-semibold text-white' : 'text-text-secondary'}`}>
                  {velumIsMe && velumMsgStatus === 'sent' && <Check className="w-3.5 h-3.5 text-text-secondary shrink-0" />}
                  {velumIsMe && velumMsgStatus === 'delivered' && <CheckCheck className="w-3.5 h-3.5 text-text-secondary shrink-0" />}
                  {velumIsMe && velumMsgStatus === 'read' && <CheckCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                  {velumTxt && <span className="truncate">{velumTxt}</span>}
                </p>
                {velumUnread > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded-full bg-unread-badge text-white shadow-sm shrink-0 min-w-[20px] text-center">
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
              className={`w-full px-5 py-3.5 border-b flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                isDark ? 'border-white-5 hover:bg-text-primary/[0.03]' : 'border-gray-100 hover:bg-gray-50'
              }`}
            >
              <div className="min-w-0 flex items-center gap-3 flex-1">
                <div className="w-11 h-11 rounded-full bg-velum-800 border border-white-10 flex items-center justify-center font-black text-xs text-text-secondary overflow-hidden flex-shrink-0 relative">
                  {friendAvatar ? (
                    <img src={friendAvatar} alt={friendName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="uppercase text-xs font-bold text-white/80">{friendName.slice(0, 2)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm ${unread > 0 ? 'font-bold text-white' : 'font-semibold text-white/90'} capitalize truncate`}>
                      {friendName}
                    </p>
                    {lastTimeStr && (
                      <span className={`text-[11px] font-mono shrink-0 ${unread > 0 ? 'text-accent font-semibold' : 'text-text-secondary'}`}>
                        {lastTimeStr}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={`text-xs flex items-center gap-1 truncate ${unread > 0 ? 'font-semibold text-white' : 'text-text-secondary'}`}>
                      {isMe && !isFailed && lastMsgStatus === 'sent' && <Check className="w-3.5 h-3.5 text-text-secondary shrink-0" />}
                      {isMe && !isFailed && lastMsgStatus === 'delivered' && <CheckCheck className="w-3.5 h-3.5 text-text-secondary shrink-0" />}
                      {isMe && !isFailed && lastMsgStatus === 'read' && <CheckCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                    {lastTxt && (
                        <span className="truncate inline-flex items-center gap-1">
                          {lastTxt.startsWith('Voice message') && <Mic className="w-3.5 h-3.5 text-accent shrink-0" />}
                          {(lastTxt.toLowerCase().includes('photo') || lastTxt.toLowerCase().includes('attachment')) && (
                            <ImageIcon className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                          )}
                          <span>{lastTxt}</span>
                        </span>
                      )}
                      
                      
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isFailed ? (
                        <span className="text-[10px] font-mono font-bold text-status-dnd uppercase tracking-wider">
                          Failed
                        </span>
                      ) : unread > 0 ? (
                        <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded-full bg-unread-badge text-white shadow-sm shrink-0 min-w-[20px] text-center">
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
