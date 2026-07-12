import React, { useState, useEffect } from 'react';
import ChatArea from '../ChatArea';
import { useResponsive } from '../../hooks/useResponsive';
import { Hash, Users, Info, ChevronLeft, Plus, X } from 'lucide-react';
import ProfileCard from '../ProfileCard';

// Seal System Icons (Section 16)
const OutlinedSeal = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 text-text-secondary shrink-0">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const FilledSeal = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="1.5" fill="currentColor" strokeLinecap="round" strokeLinejoin="round" className="text-accent shrink-0">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const LockedSeal = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="opacity-45 text-text-disabled shrink-0">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <rect x="9" y="11" width="6" height="5" rx="1" strokeWidth="1" />
    <path d="M10 11V9a2 2 0 0 1 4 0v2" strokeWidth="1" />
  </svg>
);

const cleanRoomName = (name: string): string => {
  return name.replace(/^#\s*/, '').trim();
};

interface LoungeWorkspaceProps {
  loungeId: string;
  loungeName: string;
  currentUserId: number;
  currentUsername: string;
  currentUserRole: string;
  activeRoomId: string;
  onRoomSelect: (roomId: string) => void;
  onLoungeSelect: (loungeId: string, loungeName: string) => void;
  onBackToDirectory: () => void;
  isDark: boolean;
  messages: any[];
  wsConnected: boolean;
  onSendMessage?: (text: string, burnSeconds: number | null, isEncrypted: boolean) => void;
  onSendTyping?: (isTyping: boolean) => void;
  onRoomKick?: (userId: number) => void;
  onRoomMute?: (userId: number, mute: boolean) => void;
  onSendReaction?: (messageId: string, roomId: string, emoji: string) => void;
  onDeleteMessage?: (messageId: string, roomId: string) => void;
  onMarkAsRead?: (messageId: string, roomId: string) => void;
  onToggleSidebar?: () => void;
}

export default function LoungeWorkspace(props: LoungeWorkspaceProps) {
  const { isMobile } = useResponsive();
  const [rooms, setRooms] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [mobileTab, setMobileTab] = useState<'rooms' | 'members' | 'about'>('rooms');
  const [readMessages, setReadMessages] = useState<Set<string>>(new Set());
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [loungeDetails, setLoungeDetails] = useState<any | null>(null);
  const [loungeList, setLoungeList] = useState<any[]>([]);
  const [showLoungeProfile, setShowLoungeProfile] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const getRoomId = (room: any): string | null => {
    if (!room) return null;
    return room.id || room.room_id || null;
  };

  const handleMarkAsRead = (messageId: string, roomId: string) => {
    setReadMessages(prev => {
      const updated = new Set(prev);
      updated.add(messageId);
      return updated;
    });
    props.onMarkAsRead?.(messageId, roomId);
  };

  const getUnreadCount = (roomId: string): number => {
    if (!props.messages || props.messages.length === 0) return 0;
    
    return (props.messages || []).filter(msg => {
      if (msg.room_id !== roomId) return false;
      if (msg.user_id === props.currentUserId) return false;
      return msg.status !== 'read' && !readMessages.has(msg.message_id);
    }).length;
  };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomLocked, setNewRoomLocked] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const fetchRooms = async () => {
    try {
      const sid = sessionStorage.getItem('velum-sessionId') || '';
      const res = await fetch(`/api/lounges/${props.loungeId}/rooms`, {
        headers: { 'Authorization': `Bearer ${sid}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
        const displayList = data.length > 0 ? data : [
          { id: 'general', name: 'general' }, { id: 'off-topic', name: 'off-topic' }
        ];
        if (!isMobile && !props.activeRoomId && displayList.length > 0) {
          const firstRoomId = getRoomId(displayList[0]);
          if (firstRoomId) {
            props.onRoomSelect(firstRoomId);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch rooms', err);
    }
  };

  const fetchLoungeList = async () => {
    try {
      const sid = sessionStorage.getItem('velum-sessionId') || '';
      const res = await fetch('/api/lounges', {
        headers: { 'Authorization': `Bearer ${sid}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLoungeList(data);
      }
    } catch (err) {
      console.error('Failed to fetch lounges list', err);
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      setStatusMessage('Room name is required.');
      return;
    }
    try {
      const sid = sessionStorage.getItem('velum-sessionId') || '';
      const res = await fetch(`/api/lounges/${props.loungeId}/rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sid}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newRoomName.trim(),
          is_locked: newRoomLocked
        })
      });
      if (res.ok) {
        setNewRoomName('');
        setNewRoomLocked(false);
        setShowCreateModal(false);
        setStatusMessage('');
        fetchRooms();
      } else {
        const err = await res.json();
        setStatusMessage(err.error || 'Failed to create room.');
      }
    } catch (err) {
      console.error('Error creating room:', err);
      setStatusMessage('Error creating room.');
    }
  };

  const handleCopyInvite = () => {
    const code = loungeDetails?.invite_code;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  useEffect(() => {
    const fetchLoungeDetails = async () => {
      try {
        const sid = sessionStorage.getItem('velum-sessionId') || '';
        const res = await fetch(`/api/lounges/${props.loungeId}`, {
          headers: { 'Authorization': `Bearer ${sid}` }
        });
        if (res.ok) {
          const data = await res.json();
          setLoungeDetails(data);
        }
      } catch (err) {
        console.error('Failed to fetch lounge details:', err);
      }
    };

    const fetchMembers = async () => {
      try {
        const sid = sessionStorage.getItem('velum-sessionId') || '';
        const res = await fetch(`/api/lounges/${props.loungeId}/members`, {
          headers: { 'Authorization': `Bearer ${sid}` }
        });
        if (res.ok) {
          const data = await res.json();
          const realMembers = data.filter((u: any) => {
            if (u.user_id === 999) return false;
            return !(u.username.toLowerCase() === 'velum' || u.username.toLowerCase() === 'velum-msg');
          });
          setMembers(realMembers);
        }
      } catch (err) {
        console.error('Failed to fetch members', err);
      }
    };

    fetchRooms();
    fetchMembers();
    fetchLoungeDetails();
    fetchLoungeList();
  }, [props.loungeId, isMobile, props.currentUserId]);

  const fallbackRooms = [
    { id: 'general', name: 'general', description: 'General discussions', iconUrl: '/assets/icons/general.png' },
    { id: 'off-topic', name: 'off-topic', description: 'Chat about anything', iconUrl: '/assets/icons/off-topic.png' }
  ];

  const displayRooms = (props.loungeId === 'velum_lounge' && rooms.length === 0) ? fallbackRooms : rooms;

  const isParentAdmin = members.some(m => String(m.user_id) === String(props.currentUserId) && (m.role === 'admin' || m.role === 'owner'));

  // Section 16 Sidebar directory visibility check
  const visibleRooms = displayRooms.filter(room => {
    const isPrivate = room.is_locked || room.visibility === 'private' || room.is_private === 1;
    if (!isPrivate) return true;

    const isCreator = String(room.created_by || room.owner_id || room.owner_user_id) === String(props.currentUserId);
    const isSubMember = members.some(m => String(m.user_id) === String(props.currentUserId) && m.status === 'active');
    
    if (isCreator || isSubMember || isParentAdmin) return true;
    return false;
  });

  const publicRooms = visibleRooms.filter(room => !(room.is_locked || room.visibility === 'private' || room.is_private === 1));
  const privateRooms = visibleRooms.filter(room => room.is_locked || room.visibility === 'private' || room.is_private === 1);

  const renderRoomRow = (room: any, type: 'public' | 'private_owned' | 'private_locked') => {
    const roomId = getRoomId(room);
    if (!roomId) return null;
    const unread = getUnreadCount(roomId);
    const isActive = props.activeRoomId === roomId;
    const isLockedCard = type === 'private_locked';
    const cleanName = cleanRoomName(room.name);

    return (
      <div
        key={roomId}
        onClick={isLockedCard ? undefined : () => props.onRoomSelect(roomId)}
        className={`flex items-center gap-3 p-3 rounded-2xl transition-all duration-150 ${
          isLockedCard
            ? 'opacity-50 cursor-not-allowed border border-white-5 bg-velum-800'
            : isActive
              ? (props.isDark ? 'bg-text-primary/10 text-white shadow-inner scale-[0.99]' : 'bg-gray-200 text-gray-900 shadow-inner scale-[0.99]')
              : (props.isDark ? 'hover:bg-text-primary/5 text-text-secondary hover:text-text-primary hover:scale-[1.01]' : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900 hover:scale-[1.01]')
        }`}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-black/25 border border-white-5 overflow-hidden shrink-0">
          {type === 'public' && <OutlinedSeal />}
          {type === 'private_owned' && <FilledSeal />}
          {type === 'private_locked' && <LockedSeal />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold truncate uppercase tracking-wider">{cleanName}</div>
          {isLockedCard ? (
            <div className="text-[9px] text-text-disabled truncate uppercase tracking-wider">Locked Sublounge</div>
          ) : (
            room.description && <div className="text-[9px] opacity-60 truncate">{room.description}</div>
          )}
        </div>
        {!isLockedCard && unread > 0 && (
          <div className="px-2 py-0.5 rounded-full bg-accent text-velum-900 text-[9px] font-bold shadow-md shadow-accent-10 shrink-0">
            {unread}
          </div>
        )}
      </div>
    );
  };

  const renderRoomsList = () => (
    <div className="space-y-4 p-4 font-sans">
      {publicRooms.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-text-secondary px-3 mb-2">Rooms</div>
          {publicRooms.map(room => renderRoomRow(room, 'public'))}
        </div>
      )}
      {privateRooms.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-white-5">
          <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-text-secondary px-3 mb-2">Private</div>
          {privateRooms.map(room => {
            const isCreator = String(room.created_by || room.owner_id || room.owner_user_id) === String(props.currentUserId);
            return renderRoomRow(room, isCreator ? 'private_owned' : 'private_locked');
          })}
        </div>
      )}
    </div>
  );

  const renderMembersList = () => (
    <div className="flex flex-col p-2 space-y-1">
      <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
        Members — {members.length}
      </div>
      {members.map(member => (
        <div 
          key={member.user_id}
          onClick={() => setSelectedMember(member)}
          className={`flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer ${
            props.isDark ? 'hover:bg-text-primary/5 text-text-secondary hover:text-text-primary' : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="relative shrink-0">
            {member.avatar ? (
              <img src={member.avatar} alt={member.username} className="w-8 h-8 rounded-full object-cover border border-white-10" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 rounded-full border flex items-center justify-center text-xs font-mono font-bold uppercase shrink-0 transition bg-velum-800 text-text-secondary border-velum-600">
                {member.username.replace('@', '').charAt(0) || 'U'}
              </div>
            )}
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${props.isDark ? 'border-velum-600' : 'border-white'} ${member.status === 'online' ? 'bg-status-online' : 'bg-status-invisible'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-bold truncate ${props.isDark ? 'text-text-primary' : 'text-gray-800'}`}>
              {member.displayName || member.username.replace('@', '')}
            </div>
            <div className="text-[10px] opacity-60 truncate">
              {member.role || 'Member'}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCreateModal = () => {
    if (!showCreateModal) return null;
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black-60 backdrop-blur-sm p-4 animate-fade-in">
        <div className={`w-full max-w-sm rounded-2xl p-6 border shadow-2xl ${props.isDark ? 'bg-velum-850 border-white-10 text-white' : 'bg-text-primary border-gray-200 text-gray-900'}`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider">Create Lounge Room</h3>
            <button 
              onClick={() => setShowCreateModal(false)} 
              className="text-text-secondary hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-widest mb-1.5 opacity-60">Room Name</label>
              <input 
                type="text" 
                placeholder="e.g. general-chat" 
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                className={`w-full p-2.5 rounded-lg border text-xs outline-none transition uppercase ${
                  props.isDark 
                    ? 'bg-velum-900 border-white-5 text-white focus:border-accent/50' 
                    : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-gray-400'
                }`}
              />
            </div>
            
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                id="isLocked"
                checked={newRoomLocked}
                onChange={e => setNewRoomLocked(e.target.checked)}
                className="w-4 h-4 rounded border-velum-600 bg-velum-800 text-accent focus:ring-0 cursor-pointer"
              />
              <label htmlFor="isLocked" className="text-[10px] font-bold uppercase tracking-wider text-text-secondary cursor-pointer select-none">Locked VIP Room</label>
            </div>

            {statusMessage && (
              <div className="text-accent text-[9.5px] font-mono uppercase bg-accent/5 border border-accent/10 p-2.5 rounded-xl">
                {statusMessage}
              </div>
            )}

            <button 
              onClick={handleCreateRoom}
              className="w-full bg-accent hover:bg-accent-hover text-velum-900 p-3 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer"
            >
              Create Room
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderLoungeRail = () => {
    return (
      <div className={`w-16 flex-shrink-0 flex flex-col items-center gap-3.5 pt-4 border-r ${props.isDark ? 'border-white-5 bg-velum-850' : 'border-gray-200 bg-gray-100'}`}>
        {/* Back/Exit button to main dashboard */}
        <button
          onClick={props.onBackToDirectory}
          className="w-10 h-10 rounded-2xl flex items-center justify-center bg-velum-800 border border-white-5 text-text-secondary hover:text-white transition-all hover:scale-105 active:scale-95 cursor-pointer hover:bg-velum-700"
          title="Back to Directory"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="w-8 border-t border-white-5 my-1" />
        
        {/* Lounge switcher circle list */}
        <div className="flex-grow flex flex-col gap-3 overflow-y-auto w-full items-center scrollbar-none pb-4">
          {loungeList.map(lounge => {
            const isActive = lounge.lounge_id === props.loungeId;
            const initials = lounge.name.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).map((w: string) => w.charAt(0)).join('').substring(0, 2).toUpperCase() || lounge.name.charAt(0).toUpperCase();
            
            return (
              <div key={lounge.lounge_id} className="relative group flex items-center justify-center w-full">
                {/* Active Indicator pill on left */}
                <div className={`absolute left-0 w-1 rounded-r-full bg-accent transition-all duration-200 ${
                  isActive ? 'h-6' : 'h-0 group-hover:h-3'
                }`} />
                
                {/* Lounge Circle Icon */}
                <button
                  onClick={() => props.onLoungeSelect(lounge.lounge_id, lounge.name)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 relative cursor-pointer ${
                    isActive
                      ? 'bg-accent text-velum-900 font-black scale-105 shadow-md shadow-accent/20 ring-2 ring-accent/20'
                      : 'bg-velum-800 border border-white-5 text-text-secondary hover:text-white hover:scale-105 hover:border-white-10 hover:bg-velum-700'
                  }`}
                  title={lounge.name}
                >
                  <span>{initials}</span>
                  {lounge.pinned && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-accent rounded-full border border-velum-900" title="Pinned Lounge" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const activeRoom = displayRooms.find(r => getRoomId(r) === props.activeRoomId);
  const activeRoomName = activeRoom ? activeRoom.name : '';
  const isPrivateSublounge = activeRoom ? (activeRoom.is_locked || activeRoom.visibility === 'private' || activeRoom.is_private === 1) : false;

  // Desktop Split View
  if (!isMobile) {
    return (
      <>
        <div className="flex-1 flex w-full h-full overflow-hidden min-h-0">
          
          {/* Section 16 Persistent Sidebar Directory Column */}
          <div className="w-80 flex-shrink-0 flex min-h-0 border-r border-white-5">
            {/* Left element: Top-level lounge switcher rail */}
            {renderLoungeRail()}

            {/* Right element: Sublounge rooms directory */}
            <div className={`flex-1 flex flex-col min-h-0 ${props.isDark ? 'bg-velum-850' : 'bg-gray-50'}`}>
              <div className="p-4 border-b border-white-5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span 
                    onClick={() => setShowLoungeProfile(true)}
                    className={`text-xs font-bold uppercase tracking-wider truncate cursor-pointer hover:underline ${props.isDark ? 'text-white' : 'text-gray-900'}`}
                  >
                    {props.loungeName}
                  </span>
                </div>
                {props.loungeId !== 'velum_lounge' && props.loungeId !== 'secops' && (
                  <button
                    onClick={() => {
                      setStatusMessage('');
                      setShowCreateModal(true);
                    }}
                    className="p-1.5 rounded-lg hover:bg-text-primary/10 text-text-secondary hover:text-white transition-colors cursor-pointer"
                    title="Create Room"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {renderRoomsList()}
              </div>
              {/* Dedicated Invite Code Display Card (Section 16) */}
              {loungeDetails?.invite_code && (
                <div className="p-4 border-t border-white-5 bg-transparent">
                  <div className="p-3 bg-velum-800 border border-white-5 rounded-xl flex flex-col gap-1.5 shadow-lg shadow-black/20">
                    <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-secondary select-none">Lounge Invite</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-accent tracking-wider select-all truncate">{loungeDetails.invite_code}</span>
                      <button
                        onClick={handleCopyInvite}
                        className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest bg-accent-10 hover:bg-accent-20 text-accent rounded transition active:scale-95 cursor-pointer shrink-0"
                      >
                        {copiedInvite ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Content Panel (Chat Area) */}
          <div className="flex-1 min-w-0 relative min-h-0">
            {props.activeRoomId ? (
              <ChatArea
                currentUserId={props.currentUserId}
                currentUsername={props.currentUsername}
                currentUserRole={props.currentUserRole}
                roomId={props.activeRoomId}
                wsConnected={props.wsConnected}
                messages={props.messages}
                onSendMessage={props.onSendMessage || (() => {})}
                onSendTyping={props.onSendTyping || (() => {})}
                onRoomKick={props.onRoomKick || (() => {})}
                onRoomMute={props.onRoomMute || (() => {})}
                onSendReaction={props.onSendReaction}
                onDeleteMessage={props.onDeleteMessage}
                onMarkAsRead={handleMarkAsRead}
                isDark={props.isDark}
                isMobile={false}
                onToggleSidebar={props.onToggleSidebar}
                roomName={activeRoomName}
                isPrivateSublounge={isPrivateSublounge}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-text-secondary text-xs uppercase tracking-widest min-h-0 select-none">
                Select a room to join the conversation
              </div>
            )}
          </div>
        </div>
        {renderCreateModal()}
      </>
    );
  }

  // Mobile View
  if (props.activeRoomId) {
    return (
      <div className="w-full h-full relative flex flex-col min-h-0">
        <ChatArea
          currentUserId={props.currentUserId}
          currentUsername={props.currentUsername}
          currentUserRole={props.currentUserRole}
          roomId={props.activeRoomId}
          wsConnected={props.wsConnected}
          messages={props.messages}
          onSendMessage={props.onSendMessage || (() => {})}
          onSendTyping={props.onSendTyping || (() => {})}
          onRoomKick={props.onRoomKick || (() => {})}
          onRoomMute={props.onRoomMute || (() => {})}
          onSendReaction={props.onSendReaction}
          onDeleteMessage={props.onDeleteMessage}
          onMarkAsRead={handleMarkAsRead}
          isDark={props.isDark}
          isMobile={true}
          onBackToDeck={() => props.onRoomSelect('')}
          onToggleSidebar={props.onToggleSidebar}
          roomName={activeRoomName}
          isPrivateSublounge={isPrivateSublounge}
        />
      </div>
    );
  }

  // Lounge Home View on Mobile
  return (
    <>
      <div className={`w-full h-full flex flex-col min-h-0 ${props.isDark ? 'bg-velum-900' : 'bg-velum-900'}`}>
        <div className={`p-4 border-b ${props.isDark ? 'border-white-5 bg-velum-850' : 'border-gray-200 bg-text-primary'}`}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={props.onBackToDirectory} className="p-2 rounded-full bg-text-primary/5 text-text-secondary shrink-0">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h1 
                onClick={() => setShowLoungeProfile(true)}
                className="text-lg font-black uppercase tracking-widest text-accent truncate cursor-pointer hover:underline"
              >
                {props.loungeName}
              </h1>
            </div>
            {props.loungeId !== 'velum_lounge' && props.loungeId !== 'secops' && (
              <button
                onClick={() => {
                  setStatusMessage('');
                  setShowCreateModal(true);
                }}
                className="p-2.5 bg-text-primary/5 border border-white-5 hover:bg-text-primary/10 text-text-secondary hover:text-white rounded-xl transition cursor-pointer shrink-0"
                title="Create Room"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className={`flex border-b ${props.isDark ? 'border-white-5 bg-velum-850' : 'border-gray-200 bg-text-primary'}`}>
          {['rooms', 'members', 'about'].map(tab => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab as any)}
              className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                mobileTab === tab 
                  ? (props.isDark ? 'text-white border-b-2 border-accent' : 'text-gray-900 border-b-2 border-accent')
                  : 'text-text-secondary border-b-2 border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {mobileTab === 'rooms' && renderRoomsList()}
          {mobileTab === 'members' && renderMembersList()}
          {mobileTab === 'about' && (
            <div className="p-6 flex flex-col gap-6">
              <div className="text-center text-text-secondary text-xs uppercase tracking-widest">About {props.loungeName}</div>
              
              {/* Mobile Dedicated Invite Card (Section 16) */}
              {loungeDetails?.invite_code && (
                <div className="p-4 bg-velum-800 border border-white-5 rounded-2xl flex flex-col gap-2 max-w-sm mx-auto w-full shadow-lg">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary select-none">Lounge Invite Code</div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm font-bold text-accent tracking-widest select-all">{loungeDetails.invite_code}</span>
                    <button
                      onClick={handleCopyInvite}
                      className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-accent-10 hover:bg-accent-20 text-accent rounded-xl transition active:scale-95 cursor-pointer shrink-0"
                    >
                      {copiedInvite ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {renderCreateModal()}
      
      {/* Selected Member Profile Card Overlay */}
      {selectedMember && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedMember(null)}
        >
          <div onClick={e => e.stopPropagation()} className="relative">
            <ProfileCard
              type={selectedMember.role === 'LOGIN_ADMIN' || selectedMember.role === 'SUPPORT_OPERATOR' ? 'admin' : 'user'}
              user={{
                userId: selectedMember.user_id,
                username: selectedMember.username,
                displayName: selectedMember.displayName || selectedMember.username.replace('@', ''),
                bio: selectedMember.bio || 'Secure Node Operator.',
                location: selectedMember.location || 'Unknown location',
                joinedDate: selectedMember.joined_date || 'May 2026',
                status: selectedMember.status || 'offline',
                role: selectedMember.role,
                avatarUrl: selectedMember.avatar,
                stats: {
                  loungesCount: 4,
                  connectionsCount: 18
                }
              }}
              variant={isMobile ? 'mobile' : 'popover'}
              onClose={() => setSelectedMember(null)}
            />
          </div>
        </div>
      )}

      {/* Lounge Profile Card Overlay */}
      {showLoungeProfile && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowLoungeProfile(false)}
        >
          <div onClick={e => e.stopPropagation()} className="relative">
            <ProfileCard
              type="lounge"
              lounge={{
                loungeId: loungeDetails?.lounge_id || props.loungeId,
                name: loungeDetails?.name || props.loungeName,
                description: loungeDetails?.description || 'Operational hub and workspace.',
                ownerId: Number(loungeDetails?.owner_id || 999),
                ownerUsername: loungeDetails?.owner_username || 'velum',
                memberCount: members.length || 1,
                createdAt: 'May 2026',
                isPrivate: !!loungeDetails?.is_private,
              }}
              variant={isMobile ? 'mobile' : 'expanded'}
              onClose={() => setShowLoungeProfile(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
