import React, { useState, useEffect } from 'react';
import ChatArea from '../ChatArea';
import { useResponsive } from '../../hooks/useResponsive';
import { Hash, Users, Info, ChevronLeft, Plus, X, Settings, Lock } from 'lucide-react';
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
  unreadCounts?: Record<string, number>;
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
  const [isLoadingLounge, setIsLoadingLounge] = useState<boolean>(true);

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

  // Lounge Management State
  const [showManageModal, setShowManageModal] = useState(false);
  const [manageTab, setManageTab] = useState<'members' | 'requests' | 'invites' | 'settings'>('members');
  const [manageRequests, setManageRequests] = useState<any[]>([]);
  const [manageInvites, setManageInvites] = useState<any[]>([]);
  const [directAddUsername, setDirectAddUsername] = useState('');
  const [directAddError, setDirectAddError] = useState('');
  const [directAddSuccess, setDirectAddSuccess] = useState('');
  const [sanctionReason, setSanctionReason] = useState('');
  const [activeSanctionUserId, setActiveSanctionUserId] = useState<number | null>(null);
  const [showSanctionDialog, setShowSanctionDialog] = useState<'mute' | 'kick' | 'ban' | null>(null);

  // General Settings States
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIconUrl, setEditIconUrl] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');

  useEffect(() => {
    if (loungeDetails) {
      setEditName(loungeDetails.name || '');
      setEditDescription(loungeDetails.description || '');
      setEditIconUrl(loungeDetails.icon_url || '');
    }
  }, [loungeDetails]);

  const handleSaveSettings = async () => {
    if (!editName.trim()) {
      setSettingsError('Lounge name is required.');
      return;
    }
    setSettingsError('');
    setSettingsSuccess('');
    try {
      const sid = sessionStorage.getItem('velum-sessionId') || '';
      const res = await fetch(`/api/lounges/${props.loungeId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sid}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          icon_url: editIconUrl
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update lounge settings.');
      }

      const updated = await res.json();
      setLoungeDetails(updated);
      setSettingsSuccess('Lounge settings updated successfully.');
    } catch (err: any) {
      setSettingsError(err.message || 'Something went wrong.');
    }
  };

  const fetchJoinRequests = async () => {
    try {
      const sid = sessionStorage.getItem('velum-sessionId') || '';
      const res = await fetch(`/api/lounges/${props.loungeId}/requests`, {
        headers: { 'Authorization': `Bearer ${sid}` }
      });
      if (res.ok) {
        const data = await res.json();
        setManageRequests(data);
      }
    } catch (err) {
      console.error('Failed to fetch join requests:', err);
    }
  };

  const fetchInvites = async () => {
    try {
      const sid = sessionStorage.getItem('velum-sessionId') || '';
      const res = await fetch(`/api/lounges/${props.loungeId}/invites`, {
        headers: { 'Authorization': `Bearer ${sid}` }
      });
      if (res.ok) {
        const data = await res.json();
        setManageInvites(data);
      }
    } catch (err) {
      console.error('Failed to fetch invites:', err);
    }
  };

  const handleReviewRequest = async (requestId: string, approve: boolean) => {
    try {
      const sid = sessionStorage.getItem('velum-sessionId') || '';
      const res = await fetch('/api/lounges/apply/review', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sid}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requestId, approve })
      });
      if (res.ok) {
        fetchJoinRequests();
        // Refetch members
        const memRes = await fetch(`/api/lounges/${props.loungeId}/members`, {
          headers: { 'Authorization': `Bearer ${sid}` }
        });
        if (memRes.ok) {
          const data = await memRes.json();
          setMembers(data.filter((u: any) => u.user_id !== 999 && !(u.username.toLowerCase() === 'velum' || u.username.toLowerCase() === 'velum-msg')));
        }
      }
    } catch (err) {
      console.error('Error reviewing request:', err);
    }
  };

  const handleUpdateRole = async (targetUserId: number, newRole: string) => {
    try {
      const sid = sessionStorage.getItem('velum-sessionId') || '';
      const res = await fetch(`/api/lounges/${props.loungeId}/members/${targetUserId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sid}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        const memRes = await fetch(`/api/lounges/${props.loungeId}/members`, {
          headers: { 'Authorization': `Bearer ${sid}` }
        });
        if (memRes.ok) {
          const data = await memRes.json();
          setMembers(data.filter((u: any) => u.user_id !== 999 && !(u.username.toLowerCase() === 'velum' || u.username.toLowerCase() === 'velum-msg')));
        }
      }
    } catch (err) {
      console.error('Error updating role:', err);
    }
  };

  const handleApplySanction = async () => {
    if (!activeSanctionUserId || !showSanctionDialog) return;
    try {
      const sid = sessionStorage.getItem('velum-sessionId') || '';
      const res = await fetch('/api/lounges/sanction', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sid}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          loungeId: props.loungeId,
          targetUserId: activeSanctionUserId,
          type: showSanctionDialog,
          reason: sanctionReason || 'Administrative decision.'
        })
      });
      if (res.ok) {
        setShowSanctionDialog(null);
        setActiveSanctionUserId(null);
        setSanctionReason('');
        const memRes = await fetch(`/api/lounges/${props.loungeId}/members`, {
          headers: { 'Authorization': `Bearer ${sid}` }
        });
        if (memRes.ok) {
          const data = await memRes.json();
          setMembers(data.filter((u: any) => u.user_id !== 999 && !(u.username.toLowerCase() === 'velum' || u.username.toLowerCase() === 'velum-msg')));
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to apply sanction.');
      }
    } catch (err) {
      console.error('Error sanctioning member:', err);
    }
  };

  const handleDirectAddMember = async () => {
    if (!directAddUsername.trim()) return;
    setDirectAddError('');
    setDirectAddSuccess('');
    try {
      const sid = sessionStorage.getItem('velum-sessionId') || '';
      const res = await fetch(`/api/lounges/${props.loungeId}/members/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sid}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: directAddUsername.trim() })
      });
      if (res.ok) {
        setDirectAddSuccess(`Added @${directAddUsername} successfully!`);
        setDirectAddUsername('');
        const memRes = await fetch(`/api/lounges/${props.loungeId}/members`, {
          headers: { 'Authorization': `Bearer ${sid}` }
        });
        if (memRes.ok) {
          const data = await memRes.json();
          setMembers(data.filter((u: any) => u.user_id !== 999 && !(u.username.toLowerCase() === 'velum' || u.username.toLowerCase() === 'velum-msg')));
        }
      } else {
        const err = await res.json();
        setDirectAddError(err.error || 'Failed to add member.');
      }
    } catch (err) {
      console.error('Error adding member:', err);
      setDirectAddError('Error adding member.');
    }
  };

  const handleCreateInviteCode = async () => {
    try {
      const sid = sessionStorage.getItem('velum-sessionId') || '';
      const res = await fetch(`/api/lounges/${props.loungeId}/invites`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sid}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ max_uses: 999, expires_in_days: 7 })
      });
      if (res.ok) {
        fetchInvites();
        const detailsRes = await fetch(`/api/lounges/${props.loungeId}`, {
          headers: { 'Authorization': `Bearer ${sid}` }
        });
        if (detailsRes.ok) {
          const d = await detailsRes.json();
          setLoungeDetails(d);
        }
      }
    } catch (err) {
      console.error('Error creating invite:', err);
    }
  };

  const handleRevokeInviteCode = async (inviteId: string) => {
    try {
      const sid = sessionStorage.getItem('velum-sessionId') || '';
      const res = await fetch(`/api/lounges/${props.loungeId}/invites/${inviteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sid}` }
      });
      if (res.ok) {
        fetchInvites();
      }
    } catch (err) {
      console.error('Error revoking invite:', err);
    }
  };

  const fetchRooms = async () => {
    try {
      const sid = sessionStorage.getItem('velum-sessionId') || '';
      const res = await fetch(`/api/lounges/${props.loungeId}/rooms`, {
        headers: { 'Authorization': `Bearer ${sid}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
        if (!isMobile && !props.activeRoomId && data.length > 0) {
          const firstRoomId = getRoomId(data[0]);
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
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const err = await res.json();
          setStatusMessage(err.error || 'Failed to create room.');
        } else {
          setStatusMessage(`Server error: ${res.status}. Action may have been blocked.`);
        }
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

    setIsLoadingLounge(true);
    Promise.all([
      fetchRooms(),
      fetchMembers(),
      fetchLoungeDetails(),
      fetchLoungeList()
    ]).finally(() => {
      setIsLoadingLounge(false);
    });
  }, [props.loungeId, isMobile, props.currentUserId]);

  const displayRooms = rooms;

  const isParentAdmin = members.some(m => String(m.user_id) === String(props.currentUserId) && (m.role === 'admin' || m.role === 'owner'));

  useEffect(() => {
    if (showManageModal && isParentAdmin) {
      fetchJoinRequests();
      fetchInvites();
    }
  }, [showManageModal, props.loungeId, isParentAdmin]);

  // Section 16 Sidebar directory visibility check
  const visibleRooms = displayRooms.filter(room => {
    const isPrivate = room.is_locked || room.visibility === 'private' || room.is_private === 1;
    if (!isPrivate) return true;

    const isCreator = String(room.created_by || room.owner_id || room.owner_user_id) === String(props.currentUserId);
    const isSubMember = members.some(m => String(m.user_id) === String(props.currentUserId) && m.status === 'active');
    
    if (isCreator || isSubMember || isParentAdmin) return true;
    return false;
  });

  const isMasterLounge = props.loungeId === 'velum_master_lounge';
  const publicRooms = isMasterLounge 
    ? visibleRooms.filter(room => room.accessLevel !== 'EXEC_ONLY')
    : visibleRooms.filter(room => !(room.is_locked || room.visibility === 'private' || room.is_private === 1));
  const privateRooms = isMasterLounge
    ? visibleRooms.filter(room => room.accessLevel === 'EXEC_ONLY')
    : visibleRooms.filter(room => room.is_locked || room.visibility === 'private' || room.is_private === 1);

  const renderRoomRow = (room: any, type: 'public' | 'private_owned' | 'private_locked' | 'exec') => {
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
              ? (props.isDark ? 'bg-white-10 text-white shadow-inner scale-[0.99]' : 'bg-gray-200 text-gray-900 shadow-inner scale-[0.99]')
              : (props.isDark ? 'hover:bg-white-5 text-text-secondary hover:text-text-primary hover:scale-[1.01]' : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900 hover:scale-[1.01]')
        }`}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-velum-900 border border-white-5 overflow-hidden shrink-0 text-text-secondary">
          {isMasterLounge ? (
            room.accessLevel === 'ANNOUNCE' ? <div className="text-[14px]">📢</div> : 
            room.accessLevel === 'EXEC_ONLY' ? <div className="text-[14px]">🤫</div> : 
            <Hash className="w-4 h-4 opacity-70" />
          ) : (
            <>
              {type === 'public' && <OutlinedSeal />}
              {type === 'private_owned' && <FilledSeal />}
              {type === 'private_locked' && <LockedSeal />}
              {type === 'exec' && <Lock className="w-4 h-4" />}
            </>
          )}
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
          {publicRooms.map((room, index) => {
            const rId = getRoomId(room) || `pub-room-${index}`;
            return (
              <React.Fragment key={rId}>
                {renderRoomRow(room, 'public')}
              </React.Fragment>
            );
          })}
        </div>
      )}
      {privateRooms.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-white-5">
          <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-text-secondary px-3 mb-2">Private</div>
          {privateRooms.map((room, index) => {
            const isCreator = String(room.created_by || room.owner_id || room.owner_user_id) === String(props.currentUserId);
            const rId = getRoomId(room) || `priv-room-${index}`;
            const roomType = isMasterLounge 
              ? 'exec' 
              : (isCreator ? 'private_owned' : 'private_locked');
            return (
              <React.Fragment key={rId}>
                {renderRoomRow(room, roomType)}
              </React.Fragment>
            );
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
      {members.map((member, index) => (
        <div 
          key={member.user_id || `member-${member.username || index}`}
          onClick={() => setSelectedMember(member)}
          className={`flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer ${
            props.isDark ? 'hover:bg-white-5 text-text-secondary hover:text-text-primary' : 'hover:bg-white-5 text-text-secondary hover:text-velum-900'
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
            <div className={`text-xs font-bold truncate ${props.isDark ? 'text-text-primary' : 'text-velum-900'}`}>
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
        <div className={`w-full max-w-sm rounded-2xl p-6 border shadow-2xl ${props.isDark ? 'bg-velum-850 border-white-10 text-white' : 'bg-text-primary border-velum-600 text-velum-900'}`}>
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
                    : 'bg-text-primary border-velum-600 text-velum-900 focus:border-accent'
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

  const activeRoom = displayRooms.find(r => getRoomId(r) === props.activeRoomId);
  const activeRoomName = activeRoom ? activeRoom.name : '';
  const isPrivateSublounge = activeRoom ? (activeRoom.is_locked || activeRoom.visibility === 'private' || activeRoom.is_private === 1) : false;

  // Desktop Split View
  if (!isMobile) {
    if (isLoadingLounge) {
      return (
        <div className="flex items-center justify-center h-full text-text-secondary font-mono text-xs animate-pulse">
          Loading lounge workspace...
        </div>
      );
    }

    return (
      <>
        <div className="flex-1 flex w-full h-full overflow-hidden min-h-0 bg-transparent">
          
          {/* Section 16 Persistent Sidebar Directory Column */}
          <div className="w-64 flex-shrink-0 flex min-h-0 border-r border-white-5 bg-black/10">
            {/* Right element: Sublounge rooms directory */}
            <div className="flex-1 flex flex-col min-h-0 bg-transparent">
              <div className="p-4 border-b border-white-5 flex items-center gap-2">
                <button
                  onClick={props.onBackToDirectory}
                  className="p-1 rounded-lg text-text-secondary hover:text-white hover:bg-white-10 transition-colors cursor-pointer"
                  title="Back to Directory"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span 
                    onClick={() => setShowLoungeProfile(true)}
                    className={`text-xs font-bold uppercase tracking-wider truncate cursor-pointer hover:underline ${props.isDark ? 'text-white' : 'text-gray-900'}`}
                  >
                    {props.loungeName}
                  </span>
                  <div className="flex items-center gap-1">
                    {isParentAdmin && (
                      <button
                        onClick={() => setShowManageModal(true)}
                        className="p-1.5 rounded-lg hover:bg-white-10 text-text-secondary hover:text-white transition-colors cursor-pointer shrink-0"
                        title="Manage Lounge"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    )}
                    {
                      <button
                        onClick={() => {
                          setStatusMessage('');
                          setShowCreateModal(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-white-10 text-text-secondary hover:text-white transition-colors cursor-pointer shrink-0"
                        title="Create Room"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    }
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {renderRoomsList()}
              </div>
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
          <div className="flex-1 min-w-0 relative min-h-0 flex flex-col h-full bg-velum-900">
            {props.activeRoomId ? (
              <ChatArea
                currentUserId={props.currentUserId}
                currentUsername={props.currentUsername}
                currentUserRole={props.currentUserRole}
                roomId={props.activeRoomId}
                roomAccessLevel={rooms.find(r => r.id === props.activeRoomId)?.accessLevel || 'ALL'}
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
          
          {/* Members Sidebar (Desktop) */}
          <div className="w-60 flex-shrink-0 flex flex-col min-h-0 border-l border-white-5 bg-black/10 overflow-y-auto hidden lg:flex select-none">
            <div className="p-4 border-b border-white-5">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Lounge Roster</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-4">
              {['owner', 'admin', 'moderator', 'member'].map(role => {
                const roleMembers = members.filter(m => m.role === role);
                if (roleMembers.length === 0) return null;
                return (
                  <div key={role} className="space-y-1">
                    <div className="px-2 text-[9px] font-bold uppercase tracking-widest text-text-secondary/60 mb-2">
                      {role} — {roleMembers.length}
                    </div>
                    {roleMembers.map((m: any) => (
                      <div 
                        key={m.user_id} 
                        className={`flex items-center gap-2 p-2 rounded-xl transition-colors cursor-pointer ${props.isDark ? 'hover:bg-white-5 text-text-primary' : 'hover:bg-black/5 text-velum-900'}`}
                        onClick={() => setSelectedMember(m)}
                      >
                        <div className="relative">
                          {m.avatar ? (
                            <img src={m.avatar} alt={m.username} className="w-8 h-8 rounded-full object-cover border border-white-10" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-velum-800 border border-white-10 flex items-center justify-center text-[10px] font-bold uppercase text-accent font-mono">
                              {m.username.replace('@', '').charAt(0)}
                            </div>
                          )}
                          <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-velum-900 ${
                            m.status === 'online' ? 'bg-status-online' :
                            m.status === 'away' ? 'bg-status-away' :
                            m.status === 'dnd' ? 'bg-status-dnd' : 'bg-status-invisible'
                          }`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-bold truncate">
                            {m.displayName || m.username.replace('@', '')}
                          </div>
                          {m.status_text && (
                            <div className="text-[9px] text-text-secondary truncate">
                              {m.status_text}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {renderCreateModal()}
        {/* Selected Member Profile Card Overlay */}
        {selectedMember && (
          <ProfileCard
            user={{ userId: selectedMember.user_id, username: selectedMember.username }}
            onClose={() => setSelectedMember(null)}
            variant={isMobile ? 'mobile' : 'popover'}
          />
        )}
      </>
    );
  }

  // Mobile View
  if (isLoadingLounge) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary font-mono text-xs animate-pulse">
        Loading lounge workspace...
      </div>
    );
  }

  if (props.activeRoomId) {
    return (
      <div className="w-full h-full relative flex flex-col min-h-0">
        <ChatArea
          currentUserId={props.currentUserId}
          currentUsername={props.currentUsername}
          currentUserRole={props.currentUserRole}
          roomId={props.activeRoomId}
                roomAccessLevel={rooms.find(r => r.id === props.activeRoomId)?.accessLevel || 'ALL'}
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
      <div className="w-full h-full flex flex-col min-h-0 bg-transparent">
        <div className="p-4 border-b border-white-5 bg-black/20">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={props.onBackToDirectory} className="p-2 rounded-full bg-white-5 text-text-secondary shrink-0">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h1 
                onClick={() => setShowLoungeProfile(true)}
                className="text-lg font-black uppercase tracking-widest text-accent truncate cursor-pointer hover:underline"
              >
                {props.loungeName}
              </h1>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isParentAdmin && (
                <button
                  onClick={() => setShowManageModal(true)}
                  className="p-2.5 bg-white-5 border border-white-5 hover:bg-white-10 text-text-secondary hover:text-white rounded-xl transition cursor-pointer"
                  title="Manage Lounge"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
              {
                <button
                  onClick={() => {
                    setStatusMessage('');
                    setShowCreateModal(true);
                  }}
                  className="p-2.5 bg-white-5 border border-white-5 hover:bg-white-10 text-text-secondary hover:text-white rounded-xl transition cursor-pointer"
                  title="Create Room"
                >
                  <Plus className="w-4 h-4" />
                </button>
              }
            </div>
          </div>
        </div>

        <div className="flex border-b border-white-5 bg-black/10">
          {['rooms', 'members', 'about'].map(tab => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab as any)}
              className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                mobileTab === tab 
                  ? (props.isDark ? 'text-white border-b-2 border-accent' : 'text-velum-900 border-b-2 border-accent')
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
                avatarUrl: loungeDetails?.icon_url || '',
                createdAt: 'May 2026',
                isPrivate: !!loungeDetails?.is_private,
              }}
              variant={isMobile ? 'mobile' : 'expanded'}
              onClose={() => setShowLoungeProfile(false)}
              onLoungeSettings={isParentAdmin ? () => {
                setShowLoungeProfile(false);
                setShowManageModal(true);
                setManageTab('settings');
              } : undefined}
            />
          </div>
        </div>
      )}

      {/* Glassmorphic Lounge Management Modal */}
      {showManageModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <div 
            className={`w-full max-w-2xl h-[550px] flex flex-col rounded-3xl border shadow-2xl overflow-hidden backdrop-blur-2xl transition-all duration-300 ${
              props.isDark 
                ? 'bg-velum-900 border-white-10 text-white shadow-black-60' 
                : 'bg-white-10 border-velum-600 text-velum-900 shadow-xl'
            }`}
          >
            {/* Modal Header */}
            <div className={`p-5 border-b flex justify-between items-center ${props.isDark ? 'border-white/10' : 'border-velum-600'}`}>
              <div className="flex flex-col">
                <h3 className="text-sm font-black uppercase tracking-widest text-accent flex items-center gap-2">
                  <Settings className="w-4 h-4 animate-spin-slow" />
                  Lounge Administration Desk
                </h3>
                <span className={`text-[10px] uppercase tracking-wider font-mono opacity-60 ${props.isDark ? 'text-text-secondary' : 'text-text-secondary'}`}>
                  Hub // {props.loungeName}
                </span>
              </div>
              <button 
                onClick={() => {
                  setShowManageModal(false);
                  setDirectAddError('');
                  setDirectAddSuccess('');
                }} 
                className={`p-1.5 rounded-full hover:bg-white-10 transition cursor-pointer ${props.isDark ? 'text-text-secondary hover:text-white' : 'text-text-secondary hover:text-velum-900'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className={`flex border-b text-xs ${props.isDark ? 'border-white-5 bg-velum-850' : 'border-velum-600 bg-white-10'}`}>
              {[
                { id: 'settings', label: 'General Settings' },
                { id: 'members', label: 'Members & Roles' },
                { id: 'requests', label: `Join Applications (${manageRequests.length})` },
                { id: 'invites', label: 'Invites & Direct Add' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setManageTab(tab.id as any)}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                    manageTab === tab.id 
                      ? 'text-accent border-b-2 border-accent bg-white-2' 
                      : `text-text-secondary border-b-2 border-transparent hover:text-white`
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body / Tab Content */}
            <div className="flex-1 overflow-y-auto p-5 scrollbar-none">
              
              {/* Tab 0: General Settings */}
              {manageTab === 'settings' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Lounge Node Parameters</span>
                  </div>

                  {settingsError && (
                    <p className="text-red-500 text-[10.5px] font-mono bg-red-500/10 p-2.5 rounded-xl border border-red-500/20 uppercase tracking-wide">
                      {settingsError}
                    </p>
                  )}
                  {settingsSuccess && (
                    <p className="text-green-500 text-[10.5px] font-mono bg-green-500/10 p-2.5 rounded-xl border border-green-500/20 uppercase tracking-wide">
                      {settingsSuccess}
                    </p>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[9.5px] font-bold uppercase tracking-widest mb-1.5 opacity-60">Lounge Name *</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={`w-full p-2.5 rounded-xl border text-xs outline-none transition font-mono ${
                          props.isDark 
                            ? 'bg-velum-900 border-white-10 text-white focus:border-accent-20' 
                            : 'bg-white-10 border-velum-600 text-velum-900 focus:border-accent'
                        }`}
                        placeholder="ENTER UNIQUE ALPHANUMERIC IDENTIFIER"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold uppercase tracking-widest mb-1.5 opacity-60">Overview / Topic</label>
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className={`w-full p-2.5 rounded-xl border text-xs outline-none resize-none h-20 transition ${
                          props.isDark 
                            ? 'bg-velum-900 border-white-10 text-white focus:border-accent-20' 
                            : 'bg-white-10 border-velum-600 text-velum-900 focus:border-accent'
                        }`}
                        placeholder="Describe your community node parameters..."
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold uppercase tracking-widest mb-1.5 opacity-60">Lounge Avatar / Icon URL</label>
                      <input
                        type="text"
                        value={editIconUrl}
                        onChange={(e) => setEditIconUrl(e.target.value)}
                        className={`w-full p-2.5 rounded-xl border text-xs outline-none transition font-mono ${
                          props.isDark 
                            ? 'bg-velum-900 border-white-10 text-white focus:border-accent-20' 
                            : 'bg-white-10 border-velum-600 text-velum-900 focus:border-accent'
                        }`}
                        placeholder="https://example.com/lounge-icon.png"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={handleSaveSettings}
                      className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-velum-900 text-[10px] font-bold uppercase tracking-wider rounded-xl cursor-pointer transition"
                    >
                      Save Configuration
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 1: Members & Roles Management */}
              {manageTab === 'members' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Lounge Node Operators</span>
                    <span className="text-[10px] font-mono text-accent">{members.length} Active Nodes</span>
                  </div>
                  
                  <div className="space-y-2">
                    {members.map((member, index) => {
                      const isSelf = String(member.user_id) === String(props.currentUserId);
                      return (
                        <div 
                          key={member.user_id || `manage-member-${member.username || index}`} 
                              className={`p-3 rounded-2xl flex items-center justify-between gap-4 border transition-all ${
                            props.isDark 
                              ? 'bg-white/[0.02] border-white-5 hover:bg-white/[0.04]' 
                              : 'bg-text-primary border-velum-600 hover:bg-text-primary-5'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {member.avatar ? (
                              <img src={member.avatar} alt={member.username} className="w-9 h-9 rounded-full object-cover border border-white-10" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-velum-900 border border-white-10 flex items-center justify-center text-xs font-bold uppercase text-accent font-mono">
                                {member.username.replace('@', '').charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-bold truncate flex items-center gap-1.5">
                                {member.displayName || member.username.replace('@', '')}
                                {isSelf && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-accent/20 text-accent border border-accent/20">YOU</span>}
                              </div>
                              <div className="text-[9.5px] opacity-60 font-mono uppercase tracking-wider">{member.role || 'Member'}</div>
                            </div>
                          </div>

                          {/* Controls */}
                          {!isSelf && member.role !== 'owner' && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Role selection dropdown */}
                              <select
                                value={member.role || 'member'}
                                onChange={(e) => handleUpdateRole(member.user_id, e.target.value)}
                                className={`text-[10px] font-bold uppercase tracking-wider p-1.5 rounded-lg border outline-none cursor-pointer transition ${
                                  props.isDark 
                                    ? 'bg-velum-800 border-white-10 text-text-secondary focus:border-accent' 
                                    : 'bg-text-primary border-velum-600 text-text-secondary'
                                }`}
                              >
                                <option value="member">Member</option>
                                <option value="moderator">Moderator</option>
                                <option value="admin">Admin</option>
                              </select>

                              {/* Direct Moderation sanctions */}
                              <button
                                onClick={() => {
                                  setActiveSanctionUserId(member.user_id);
                                  setShowSanctionDialog('mute');
                                }}
                                className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-lg transition active:scale-95 cursor-pointer"
                                title="Mute user inside lounge"
                              >
                                Mute
                              </button>
                              <button
                                onClick={() => {
                                  setActiveSanctionUserId(member.user_id);
                                  setShowSanctionDialog('kick');
                                }}
                                className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 rounded-lg transition active:scale-95 cursor-pointer"
                                title="Kick user from lounge"
                              >
                                Kick
                              </button>
                              <button
                                onClick={() => {
                                  setActiveSanctionUserId(member.user_id);
                                  setShowSanctionDialog('ban');
                                }}
                                className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition active:scale-95 cursor-pointer"
                                title="Ban user from lounge"
                              >
                                Ban
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 2: Join Applications (Review requests) */}
              {manageTab === 'requests' && (
                <div className="space-y-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">Pending Admission Logs</div>
                  
                  {manageRequests.length === 0 ? (
                    <div className={`p-8 rounded-2xl text-center border font-mono text-[10px] uppercase tracking-widest ${props.isDark ? 'bg-white/[0.01] border-white-5 text-text-secondary' : 'bg-text-primary border-velum-600 text-text-disabled'}`}>
                      // No active admission requests pending //
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {manageRequests.map((req, index) => (
                        <div 
                          key={req.request_id || `req-${index}`} 
                          className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
                            props.isDark ? 'bg-white/[0.02] border-white-5' : 'bg-text-primary border-velum-600'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-accent">@{req.username}</div>
                            <div className="text-[10px] opacity-60 mt-1 font-mono uppercase tracking-wider">Applied: {new Date(req.created_at).toLocaleDateString()}</div>
                            {req.reason && (
                              <p className={`text-xs mt-2 italic p-2 rounded-lg ${props.isDark ? 'bg-velum-900' : 'bg-text-primary border border-velum-600'}`}>
                                "{req.reason}"
                              </p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleReviewRequest(req.request_id, false)}
                              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition active:scale-95 cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleReviewRequest(req.request_id, true)}
                              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition active:scale-95 cursor-pointer"
                            >
                              Approve
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Invites & Direct Add User */}
              {manageTab === 'invites' && (
                <div className="space-y-6">
                  {/* Direct Add User */}
                  <div className={`p-4 rounded-2xl border ${props.isDark ? 'bg-white/[0.01] border-white-5' : 'bg-text-primary border-velum-600'}`}>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest mb-3 text-accent">Direct Node Admission</h4>
                    <p className={`text-[10.5px] opacity-75 mb-4 ${props.isDark ? 'text-text-secondary' : 'text-text-secondary'}`}>
                      Bypass join request reviews by typing any registered username below to add them directly into this lounge.
                    </p>
                    
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="ENTER USERNAME (e.g. alice)"
                        value={directAddUsername}
                        onChange={(e) => setDirectAddUsername(e.target.value)}
                        className={`flex-1 p-2.5 rounded-xl text-xs outline-none border font-mono transition ${
                          props.isDark 
                            ? 'bg-velum-900 border-white-10 text-white focus:border-accent/40' 
                            : 'bg-text-primary border-velum-600 text-velum-900 focus:border-accent'
                        }`}
                      />
                      <button
                        onClick={handleDirectAddMember}
                        className="px-4 py-2.5 bg-accent hover:bg-accent/90 text-velum-900 text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer shrink-0"
                      >
                        Add Member
                      </button>
                    </div>

                    {directAddError && (
                      <p className="text-red-400 text-[10.5px] font-mono mt-2 uppercase">{directAddError}</p>
                    )}
                    {directAddSuccess && (
                      <p className="text-emerald-400 text-[10.5px] font-mono mt-2 uppercase">{directAddSuccess}</p>
                    )}
                  </div>

                  {/* Lounge Invites */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-accent">Invite Codes Desk</h4>
                      <button
                        onClick={handleCreateInviteCode}
                        className="px-3 py-1.5 bg-white-5 hover:bg-white-10 text-white text-[9.5px] font-bold uppercase tracking-widest rounded-lg border border-white-5 transition active:scale-95 cursor-pointer"
                      >
                        Generate Invite Code
                      </button>
                    </div>

                    {manageInvites.length === 0 ? (
                      <div className={`p-6 rounded-2xl text-center border font-mono text-[9.5px] uppercase tracking-widest ${props.isDark ? 'bg-white/[0.01] border-white-5 text-text-secondary' : 'bg-text-primary border-velum-600 text-text-disabled'}`}>
                        // No custom invite links generated //
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {manageInvites.map((inv, index) => (
                          <div 
                            key={inv.invite_id || `inv-${index}`} 
                            className={`p-3 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
                              props.isDark ? 'bg-white/[0.01] border-white-5' : 'bg-text-primary border-velum-600'
                            }`}
                          >
                            <div className="font-mono">
                              <span className="text-xs font-bold text-accent tracking-widest select-all">{inv.invite_code}</span>
                              <div className="text-[9px] opacity-65 mt-1 uppercase">
                                Uses: {inv.uses || 0} // Created: {new Date(inv.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            <button
                              onClick={() => handleRevokeInviteCode(inv.invite_id)}
                              className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition active:scale-95 cursor-pointer"
                            >
                              Revoke
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Sanction Dialog Popup Overlay */}
      {showSanctionDialog && activeSanctionUserId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black-60 backdrop-blur-sm p-4">
          <div className={`w-full max-w-sm rounded-2xl p-5 border shadow-2xl space-y-4 animate-fade-in ${props.isDark ? 'bg-velum-850 border-white-10 text-white' : 'bg-text-primary border-velum-600 text-velum-900'}`}>
            <h4 className="text-xs font-black uppercase tracking-wider text-red-500">
              Confirm {showSanctionDialog} Command
            </h4>
            
            <p className="text-xs opacity-80">
              Please declare the official log reason for this sanction. This action cannot be undone.
            </p>
            
            <textarea 
              placeholder="DECLARE REASON (e.g. Terms of conduct violation)"
              value={sanctionReason}
              onChange={(e) => setSanctionReason(e.target.value)}
              className={`w-full p-2.5 rounded-lg border text-xs outline-none h-20 resize-none font-mono transition uppercase ${
                props.isDark 
                  ? 'bg-velum-900 border-white-10 text-white focus:border-red-500/50' 
                  : 'bg-white-10 border-velum-600 text-velum-900 focus:border-red-500/50'
              }`}
            />
            
            <div className="flex justify-end gap-2 text-[10px] font-bold uppercase tracking-wider">
              <button 
                onClick={() => {
                  setShowSanctionDialog(null);
                  setActiveSanctionUserId(null);
                  setSanctionReason('');
                }}
                className="px-3 py-2 rounded-lg hover:bg-white-5 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleApplySanction}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg cursor-pointer"
              >
                Confirm {showSanctionDialog}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
