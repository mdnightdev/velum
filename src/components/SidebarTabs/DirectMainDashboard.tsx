import React from 'react';
import { MessageSquare, Bot } from 'lucide-react';
import { decryptMessage } from '../../services/encryptionService';
import { stripAt } from '../../types';
import logoSvg from '../../assets/logo.svg?raw';
import { useLanguage } from '../../i18n/LanguageContext';

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
}

export default function DirectMainDashboard({
  friendRequests,
  friendRelationships,
  currentUserId,
  isDark,
  onSelectPeer,
  onSectionView,
  unreadCounts,
  lastMessages = {},
  loadAndShowProfileCard,
  getCountryOnly
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

  const filteredFriends = relationshipsArray.filter(r => {
    const name = r.username || r.displayName;
    return name?.toLowerCase().includes(searchQuery.toLowerCase());
  });
  const velumUnread = unreadCounts[`dm_velum_${currentUserId}`] || 0;

  return (
    <div className="flex-1 flex flex-col w-full h-full select-none font-sans bg-transparent">
      {/* Header */}
      <div className="px-6 py-3 border-b flex-shrink-0 border-white-5 bg-transparent">
        <div className="relative flex items-center w-full h-9 px-3 rounded-full border bg-transparent border-white-5 focus-within:border-accent">
          <input
            type="text"
            placeholder={t('chats.search', 'Search chats...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-xs ml-1"
            style={{ color: isDark ? 'white' : 'black' }}
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
          }}
          className={`w-full px-6 py-4 border-b flex items-center justify-between gap-4 cursor-pointer transition-colors ${
            isDark ? 'border-white-5 hover:bg-text-primary/[0.02]' : 'border-gray-100 hover:bg-gray-50'
          }`}
        >
          <div className="min-w-0 flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl bg-velum-800 border border-accent/20 flex items-center justify-center font-black text-xs text-accent overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80"
              title="VELUM System"
            >
              <div className="w-5 h-5 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: logoSvg }} />
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-bold capitalize truncate flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Velum
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-accent/10 text-accent uppercase tracking-wider">System</span>
              </p>
            </div>
          </div>

          <div className="flex items-center flex-shrink-0">
            {velumUnread > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-mono font-black rounded-full bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)]">
                {velumUnread}
              </span>
            )}
          </div>
        </div>

        {/* Other friends/contacts */}
        {filteredFriends.map(r => {
          const friendId = r.friendId;
          const friendName = stripAt(r.username || r.displayName);
          const friendAvatar = r.avatarUrl;
          const dmRoomId = `dm_${Math.min(currentUserId, friendId)}_${Math.max(currentUserId, friendId)}`;
          const unread = unreadCounts[dmRoomId] || 0;

          return (
            <div
              key={friendId}
              onClick={() => {
              // Mark last message as read for this DM (if available)
              try {
                const lm = lastMessages || {};
                const candidateKeys = [
                  dmRoomId,
                  `dm_${currentUserId}_${friendId}`,
                  `dm_${friendId}_${currentUserId}`,
                  `dm_velum_${currentUserId}`
                ];
                let last = null as any;
                for (const k of candidateKeys) {
                  if (k && lm[k]) { last = lm[k]; break; }
                }
                const lastId = last ? (last.message_id || last.id || last.messageId) : undefined;
                if (onMarkAsRead) onMarkAsRead(lastId, dmRoomId);
              } catch (e) {
                // ignore
              }

              if (onSelectPeer) onSelectPeer({ userId: friendId, username: friendName, avatar: friendAvatar });
              if (onSectionView) onSectionView('chat');
            }}
              className={`w-full px-6 py-4 border-b flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                isDark ? 'border-white-5 hover:bg-text-primary/[0.02]' : 'border-gray-100 hover:bg-gray-50'
              }`}
            >
              <div className="min-w-0 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-velum-800 border border-white-10 flex items-center justify-center font-black text-xs text-text-secondary overflow-hidden flex-shrink-0">
                  {friendAvatar ? (
                    <img src={friendAvatar} alt={friendName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="uppercase">{friendName.slice(0, 2)}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm ${unread > 0 ? 'font-bold' : 'font-medium'} capitalize truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {friendName}
                  </p>
                  <p className={`text-[11px] mt-1 truncate ${unread > 0 ? (isDark ? 'text-white/90' : 'text-gray-900') : 'text-text-secondary'}`}>
                    {(() => {
                      const lm = lastMessages || {};
                      const candidateKeys = [
                        dmRoomId,
                        `dm_${currentUserId}_${friendId}`,
                        `dm_${friendId}_${currentUserId}`,
                        `dm_velum_${currentUserId}`
                      ];
                      let last = null as any;
                      for (const k of candidateKeys) {
                        if (k && lm[k]) { last = lm[k]; break; }
                      }

                      let txt = '';
                      if (last) {
                        const raw = last.content || last.message || last.body || last.text || '';
                        const isEnc = !!(last.is_encrypted || last.isEncrypted);
                        try {
                          txt = decryptMessage(raw, dmRoomId, isEnc) || raw || '';
                        } catch (e) {
                          txt = raw || '';
                        }
                      }

                      if (!txt) return 'No messages yet.';
                      return txt.length > 60 ? txt.slice(0, 60) + '…' : txt;
                    })()}
                  </p>
                </div>
              </div>

              <div className="flex items-center flex-shrink-0">
                {unread > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-mono font-black rounded-full bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)]">
                    {unread}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
