import React from 'react';
import { MessageSquare, Bot } from 'lucide-react';
import { stripAt } from '../../types';
import logoSvg from '../../assets/logo.svg?raw';

interface DirectMainDashboardProps {
  friendRequests: any[];
  currentUserId: number;
  isDark: boolean;
  onSelectPeer?: (peer: { userId: number; username: string }) => void;
  onSectionView?: (view: any) => void;
  unreadCounts: Record<string, number>;
  loadAndShowProfileCard: (user: any) => void;
  getCountryOnly: (location: string) => string;
}

export default function DirectMainDashboard({
  friendRequests,
  currentUserId,
  isDark,
  onSelectPeer,
  onSectionView,
  unreadCounts,
  loadAndShowProfileCard,
  getCountryOnly
}: DirectMainDashboardProps) {

  const seenFriendIds = new Set<number>();
  const acceptedFriends = friendRequests.filter(r => {
    if (r.status !== 'accepted') return false;
    const isSender = r.sender_id === currentUserId;
    const friendId = isSender ? r.receiver_id : r.sender_id;
    if (seenFriendIds.has(friendId)) return false;
    seenFriendIds.add(friendId);
    return true;
  });
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredFriends = acceptedFriends.filter(r => {
    const isSender = r.sender_id === currentUserId;
    const name = isSender ? r.receiver_name : r.sender_name;
    return name?.toLowerCase().includes(searchQuery.toLowerCase());
  });
        const velumUnread = unreadCounts[`dm_velum_${currentUserId}`] || 0;

        return (
          <div className={`flex-1 flex flex-col w-full h-full select-none font-sans ${isDark ? 'bg-velum-800' : 'bg-text-primary'}`}>
            {/* Header */}
            <div className={`px-6 py-3 border-b flex-shrink-0 ${isDark ? 'border-white-5 bg-velum-800' : 'border-gray-200 bg-text-primary'}`}>
              <div className={`relative flex items-center w-full h-9 px-3 rounded-full border ${isDark ? 'bg-velum-800 border-white-5 focus-within:border-accent' : 'bg-gray-100 border-gray-200 focus-within:border-accent'}`}>
                <input
                  type="text"
                  placeholder="Search chats..."
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
            if (onSelectPeer) onSelectPeer({ userId: 999, username: 'VELUM' });
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
              <p className={`text-sm font-bold uppercase truncate flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                VELUM
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
       	  const isSender = r.sender_id === currentUserId;
          const friendId = isSender ? r.receiver_id : r.sender_id;
          const friendName = stripAt(isSender ? r.receiver_name : r.sender_name);
          const friendAvatar = isSender ? r.receiver_avatar : r.sender_avatar;
          const dmRoomId = `dm_${Math.min(currentUserId, friendId)}_${Math.max(currentUserId, friendId)}`;
          const unread = unreadCounts[dmRoomId] || 0;

          return (
            <div
              key={r.request_id}
              onClick={() => {
                if (onSelectPeer) onSelectPeer({ userId: friendId, username: friendName });
                if (onSectionView) onSectionView('chat');
              }}
              className={`w-full px-6 py-4 border-b flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                isDark ? 'border-white-5 hover:bg-text-primary/[0.02]' : 'border-gray-100 hover:bg-gray-50'
              }`}
            >
              <div className="min-w-0 flex items-center gap-3">
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    loadAndShowProfileCard({ username: friendName, avatar: friendAvatar || '', userId: friendId, isSelf: false });
                  }}
                  className="w-10 h-10 rounded-xl bg-velum-800 border border-white-10 flex items-center justify-center font-black text-xs text-text-secondary overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80"
                  title="View profile"
                >
                  {friendAvatar && (friendAvatar.startsWith('data:image/') || friendAvatar.startsWith('http')) ? (
                    <img src={friendAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    friendName.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-bold uppercase truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{friendName}</p>
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
