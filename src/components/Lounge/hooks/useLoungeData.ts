import { useState, useEffect } from 'react';
import { useLoungeSettings } from './useLoungeSettings';
import { getSessionId } from '../../../utils/auth';
import { storage } from '../../../services/storageService';
import { velumToast } from '../../../utils/toast';
import { normalizeLoungeMembersPayload, sortMembersAdminsFirst } from '../utils/memberRoster';

interface UseLoungeDataOptions {
  loungeId: string;
  currentUserId: number;
  currentUserRole: string;
  activeRoomId: string;
  onRoomSelect: (roomId: string) => void;
}

export function useLoungeData({
  loungeId,
  currentUserId,
  currentUserRole,
  activeRoomId,
  onRoomSelect,
}: UseLoungeDataOptions) {
  const getLoungeCache = (id: string) => {
    try {
      return storage.getItem<any>(`velum_cache_lounge_${id}`) || storage.getCache<any>(id);
    } catch {}
    return null;
  };

  const initialCache = getLoungeCache(loungeId);

  const [rooms, setRooms] = useState<any[]>(() => initialCache?.rooms || []);
  const [members, setMembers] = useState<any[]>(() =>
    sortMembersAdminsFirst(initialCache?.members || [])
  );
  const [loungeDetails, setLoungeDetails] = useState<any | null>(() => initialCache?.details || null);
  const [loungeList, setLoungeList] = useState<any[]>([]);
  const [isLoadingLounge, setIsLoadingLounge] = useState<boolean>(!initialCache);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomLocked, setNewRoomLocked] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const [showManageModal, setShowManageModal] = useState(false);
  // manageTab lives in useLoungeSettings (LoungeSettingsPageId)
  const [manageRequests, setManageRequests] = useState<any[]>([]);
  const [manageInvites, setManageInvites] = useState<any[]>([]);
  const [directAddUsername, setDirectAddUsername] = useState('');
  const [directAddError, setDirectAddError] = useState('');
  const [directAddSuccess, setDirectAddSuccess] = useState('');
  const [sanctionReason, setSanctionReason] = useState('');
  const [activeSanctionUserId, setActiveSanctionUserId] = useState<number | null>(null);
  const [showSanctionDialog, setShowSanctionDialog] = useState<'mute' | 'kick' | 'ban' | null>(null);

  const [typingRooms, setTypingRooms] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    const handleStart = (e: any) => {
      const { room_id, username, userId } = e.detail || {};
      if (room_id && userId !== currentUserId) {
        setTypingRooms(prev => {
          const roomTypers = new Set(prev[room_id] || []);
          roomTypers.add(username);
          return { ...prev, [room_id]: roomTypers };
        });
      }
    };
    const handleStop = (e: any) => {
      const { room_id, username, userId } = e.detail || {};
      if (room_id && userId !== currentUserId) {
        setTypingRooms(prev => {
          const roomTypers = new Set(prev[room_id] || []);
          roomTypers.delete(username);
          return { ...prev, [room_id]: roomTypers };
        });
      }
    };
    window.addEventListener('velum-typing-start', handleStart);
    window.addEventListener('velum-typing-stop', handleStop);
    return () => {
      window.removeEventListener('velum-typing-start', handleStart);
      window.removeEventListener('velum-typing-stop', handleStop);
    };
  }, [currentUserId]);

  const getRoomId = (room: any): string | null => {
    if (!room) return null;
    return room.id || room.room_id || null;
  };

  const fetchRooms = async () => {
    try {
      const sid = getSessionId();
      const res = await fetch(`/v2/lounges/${loungeId}/rooms`, {
        headers: { 'Authorization': `Bearer ${sid}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
        if (!activeRoomId && data.length > 0) {
          const firstRoomId = getRoomId(data[0]);
          if (firstRoomId) onRoomSelect(firstRoomId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch rooms', err);
    }
  };

  const fetchJoinRequests = async () => {
    try {
      const sid = getSessionId();
      const res = await fetch(`/v2/lounges/${loungeId}/requests`, {
        headers: { 'Authorization': `Bearer ${sid}` }
      });
      if (res.ok) {
        const data = await res.json();
        setManageRequests(Array.isArray(data) ? data : (data.requests || []));
      } else {
        setManageRequests([]);
      }
    } catch (err) {
      console.error('Failed to fetch join requests:', err);
      setManageRequests([]);
    }
  };

  const fetchInvites = async () => {
    try {
      const sid = getSessionId();
      const res = await fetch(`/v2/lounges/${loungeId}/invites`, {
        headers: { 'Authorization': `Bearer ${sid}` }
      });
      if (res.ok) {
        const data = await res.json();
        setManageInvites(Array.isArray(data) ? data : (data.invites || []));
      } else {
        setManageInvites([]);
      }
    } catch (err) {
      console.error('Failed to fetch invites:', err);
      setManageInvites([]);
    }
  };

  const handleReviewRequest = async (requestId: string, approve: boolean) => {
    try {
      const sid = getSessionId();
      const res = await fetch('/v2/lounges/apply/review', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sid}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requestId, approve })
      });
      if (res.ok) {
        fetchJoinRequests();
        const memRes = await fetch(`/v2/lounges/${loungeId}/members`, {
          headers: { 'Authorization': `Bearer ${sid}` }
        });
        if (memRes.ok) {
          setMembers(normalizeLoungeMembersPayload(await memRes.json()));
        }
      }
    } catch (err) {
      console.error('Error reviewing request:', err);
    }
  };

  const handleUpdateRole = async (targetUserId: number, newRole: string) => {
    try {
      const sid = getSessionId();
      const res = await fetch(`/v2/lounges/${loungeId}/members/${targetUserId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sid}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        const memRes = await fetch(`/v2/lounges/${loungeId}/members`, {
          headers: { 'Authorization': `Bearer ${sid}` }
        });
        if (memRes.ok) {
          setMembers(normalizeLoungeMembersPayload(await memRes.json()));
        }
      }
    } catch (err) {
      console.error('Error updating role:', err);
    }
  };

  const handleApplySanction = async () => {
    if (!activeSanctionUserId || !showSanctionDialog) return;
    try {
      const sid = getSessionId();
      const res = await fetch('/v2/lounges/sanction', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sid}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          loungeId,
          targetUserId: activeSanctionUserId,
          type: showSanctionDialog,
          reason: sanctionReason || 'Administrative decision.'
        })
      });
      if (res.ok) {
        setShowSanctionDialog(null);
        setActiveSanctionUserId(null);
        setSanctionReason('');
        const memRes = await fetch(`/v2/lounges/${loungeId}/members`, {
          headers: { 'Authorization': `Bearer ${sid}` }
        });
        if (memRes.ok) {
          setMembers(normalizeLoungeMembersPayload(await memRes.json()));
        }
      } else {
        const err = await res.json();
        velumToast.error(err.error || 'Failed to apply sanction.');
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
      const sid = getSessionId();
      const res = await fetch(`/v2/lounges/${loungeId}/members/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sid}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: directAddUsername.trim() })
      });
      if (res.ok) {
        setDirectAddError('');
        setDirectAddSuccess(`Added @${directAddUsername.trim()} successfully!`);
        setDirectAddUsername('');
        const memRes = await fetch(`/v2/lounges/${loungeId}/members`, {
          headers: { 'Authorization': `Bearer ${sid}` }
        });
        if (memRes.ok) {
          setMembers(normalizeLoungeMembersPayload(await memRes.json()));
        }
      } else {
        const err = await res.json();
        setDirectAddSuccess('');
        setDirectAddError(err.error || 'Failed to add member.');
      }
    } catch (err) {
      console.error('Error adding member:', err);
      setDirectAddSuccess('');
      setDirectAddError('Error adding member.');
    }
  };

  const handleCreateInviteCode = async () => {
    try {
      const sid = getSessionId();
      const res = await fetch(`/v2/lounges/${loungeId}/invites`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sid}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ max_uses: 999, expires_in_days: 7 })
      });
      if (res.ok) {
        fetchInvites();
        const detailsRes = await fetch(`/v2/lounges/${loungeId}`, {
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
      const sid = getSessionId();
      const res = await fetch(`/v2/lounges/${loungeId}/invites/${inviteId}`, {
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

  const handleCreateRoom = async () => {
    if (isCreatingRoom) return;
    if (!newRoomName.trim()) {
      setStatusMessage('Room name is required.');
      return;
    }
    setIsCreatingRoom(true);
    setStatusMessage('');
    try {
      const sid = getSessionId();
      const res = await fetch(`/v2/lounges/${loungeId}/sublounges`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sid}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newRoomName.trim(),
          is_private: newRoomLocked
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
    } finally {
      setIsCreatingRoom(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const cache = getLoungeCache(loungeId);
    
    if (cache) {
      if (cache.rooms) setRooms(cache.rooms);
      if (cache.members) setMembers(sortMembersAdminsFirst(cache.members));
      if (cache.details) setLoungeDetails(cache.details);
      setIsLoadingLounge(false);
    } else {
      setIsLoadingLounge(true);
    }

    const loadWorkspace = async () => {
      try {
        const sid = getSessionId();
        const headers = { 'Authorization': `Bearer ${sid}` };

        const [roomsRes, membersRes, detailsRes, listRes] = await Promise.allSettled([
          fetch(`/v2/lounges/${loungeId}/rooms`, { headers }),
          fetch(`/v2/lounges/${loungeId}/members`, { headers }),
          fetch(`/v2/lounges/${loungeId}`, { headers }),
          fetch('/v2/lounges', { headers })
        ]);

        if (!isMounted) return;

        let fetchedRooms: any[] = rooms;
        let fetchedMembers: any[] = members;
        let fetchedDetails: any = loungeDetails;

        if (roomsRes.status === 'fulfilled' && roomsRes.value.ok) {
          const rData = await roomsRes.value.json();
          fetchedRooms = rData.rooms || rData || [];
          setRooms(fetchedRooms);
          if (!activeRoomId && fetchedRooms.length > 0) {
            const firstRoomId = getRoomId(fetchedRooms[0]);
            if (firstRoomId) onRoomSelect(firstRoomId);
          }
        }

        if (membersRes.status === 'fulfilled' && membersRes.value.ok) {
          const mData = await membersRes.value.json();
          const realMembers = normalizeLoungeMembersPayload(mData);
          fetchedMembers = realMembers;
          setMembers(realMembers);
        }

        if (detailsRes.status === 'fulfilled' && detailsRes.value.ok) {
          const dData = await detailsRes.value.json();
          fetchedDetails = dData.lounge || dData;
          setLoungeDetails(fetchedDetails);
        }

        if (listRes.status === 'fulfilled' && listRes.value.ok) {
          const lData = await listRes.value.json();
          const loungesArr = Array.isArray(lData) ? lData : (lData.lounges || []);
          setLoungeList(loungesArr);
        }

        try {
          storage.setItem(`velum_cache_lounge_${loungeId}`, {
            rooms: fetchedRooms,
            members: fetchedMembers,
            details: fetchedDetails
          });
        } catch {}

      } catch (err) {
        console.error('Error loading lounge workspace:', err);
      } finally {
        if (isMounted) {
          setIsLoadingLounge(false);
        }
      }
    };

    loadWorkspace();

    return () => {
      isMounted = false;
    };
  }, [loungeId, currentUserId]);

  const sysAdminRoles = ['ADMIN', 'CLI_ADMIN', 'LOGIN_ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN'];
  const storedUser = (() => {
    try {
      return storage.getItem<any>('velum-user') || storage.getItem<any>('velum_user');
    } catch {
      return null;
    }
  })();
  const isSystemAdmin = sysAdminRoles.includes(currentUserRole) ||
    ['lexie', 'midnight'].includes((storedUser?.username || '').toLowerCase());

  const isParentAdmin = isSystemAdmin || members.some(m => String(m.user_id) === String(currentUserId) && (m.role === 'admin' || m.role === 'owner'));

  const loungeSettings = useLoungeSettings({
    loungeId,
    loungeDetails,
    isParentAdmin,
    onDetailsUpdated: (details) => {
      setLoungeDetails((prev: any) => ({ ...(prev || {}), ...(details || {}) }));
    },
  });

  useEffect(() => {
    if (showManageModal && isParentAdmin) {
      fetchJoinRequests();
      fetchInvites();
    }
  }, [showManageModal, loungeId, isParentAdmin]);

  const handleTransferOwnership = async (newOwnerUserId: number): Promise<boolean> => {
    try {
      const sid = getSessionId();
      const res = await fetch(`/v2/lounges/${loungeId}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sid}`,
        },
        body: JSON.stringify({ new_owner_user_id: newOwnerUserId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to transfer ownership.');
      }
      const memRes = await fetch(`/v2/lounges/${loungeId}/members`, {
        headers: { Authorization: `Bearer ${sid}` },
      });
      if (memRes.ok) {
        const mData = await memRes.json();
        setMembers(normalizeLoungeMembersPayload(mData));
      }
      const detailsRes = await fetch(`/v2/lounges/${loungeId}`, {
        headers: { Authorization: `Bearer ${sid}` },
      });
      if (detailsRes.ok) {
        const d = await detailsRes.json();
        setLoungeDetails(d.lounge || d);
      }
      velumToast.success('Ownership transferred.');
      return true;
    } catch (err: any) {
      velumToast.error(err.message || 'Failed to transfer ownership.');
      return false;
    }
  };

  const handleDeleteLounge = async (targetId?: string | number): Promise<boolean> => {
    const idToDelete = targetId || loungeId;
    try {
      const sid = getSessionId();
      const res = await fetch(`/v2/lounges/${idToDelete}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sid}`
        }
      });
      if (res.ok) {
        const listRes = await fetch('/v2/lounges', {
          headers: { 'Authorization': `Bearer ${sid}` }
        });
        if (listRes.ok) {
          const lData = await listRes.json();
          setLoungeList(Array.isArray(lData) ? lData : (lData.lounges || []));
        }
        return true;
      } else {
        const err = await res.json();
        velumToast.error(err.error || 'Failed to delete lounge.');
        return false;
      }
    } catch (err) {
      console.error('Error deleting lounge:', err);
      velumToast.error('Error deleting lounge.');
      return false;
    }
  };

  const handleDeleteRoom = async (roomId: string | number): Promise<boolean> => {
    try {
      const sid = getSessionId();
      const res = await fetch(`/v2/lounges/${roomId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sid}`
        }
      });
      if (res.ok) {
        const roomsRes = await fetch(`/v2/lounges/${loungeId}/rooms`, {
          headers: { 'Authorization': `Bearer ${sid}` }
        });
        if (roomsRes.ok) {
          const rData = await roomsRes.json();
          setRooms(rData.rooms || rData || []);
        }
        return true;
      } else {
        const err = await res.json();
        velumToast.error(err.error || 'Failed to delete room.');
        return false;
      }
    } catch (err) {
      console.error('Error deleting room:', err);
      velumToast.error('Error deleting room.');
      return false;
    }
  };

  return {
    rooms,
    members,
    setMembers,
    loungeDetails,
    loungeList,
    isLoadingLounge,
    showCreateModal,
    setShowCreateModal,
    newRoomName,
    setNewRoomName,
    newRoomLocked,
    setNewRoomLocked,
    statusMessage,
    setStatusMessage,
    isCreatingRoom,
    showManageModal,
    setShowManageModal,
    manageTab: loungeSettings.manageTab,
    setManageTab: loungeSettings.setManageTab,
    manageRequests,
    manageInvites,
    directAddUsername,
    setDirectAddUsername,
    directAddError,
    setDirectAddError,
    directAddSuccess,
    setDirectAddSuccess,
    sanctionReason,
    setSanctionReason,
    activeSanctionUserId,
    setActiveSanctionUserId,
    showSanctionDialog,
    setShowSanctionDialog,
    editName: loungeSettings.editName,
    setEditName: loungeSettings.setEditName,
    editDescription: loungeSettings.editDescription,
    setEditDescription: loungeSettings.setEditDescription,
    editIconUrl: loungeSettings.editIconUrl,
    setEditIconUrl: loungeSettings.setEditIconUrl,
    editIsPrivate: loungeSettings.editIsPrivate,
    setEditIsPrivate: loungeSettings.setEditIsPrivate,
    settingsError: loungeSettings.settingsError,
    settingsSuccess: loungeSettings.settingsSuccess,
    isSavingSettings: loungeSettings.isSavingSettings,
    uploadError: loungeSettings.uploadError,
    setUploadError: loungeSettings.setUploadError,
    typingRooms,
    isParentAdmin,
    isSystemAdmin,
    handleSaveSettings: loungeSettings.handleSaveSettings,
    handleReviewRequest,
    handleUpdateRole,
    handleApplySanction,
    handleDirectAddMember,
    handleCreateInviteCode,
    handleRevokeInviteCode,
    handleCreateRoom,
    handleDeleteLounge,
    handleTransferOwnership,
    handleDeleteRoom,
  };
}
