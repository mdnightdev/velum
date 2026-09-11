import React, { useState, useEffect } from 'react';
import ChatArea from '../ChatArea';
import { ChevronLeft, Plus, Settings, Menu, LogOut } from 'lucide-react';
import ProfileCard, { toUserProfileData } from '../ProfileCard';
import { LoungeWorkspaceProps } from '../Lounge/types';
import { useLoungeData } from '../Lounge/hooks/useLoungeData';
import RoomsList from '../Lounge/RoomsList';
import CreateRoomModal from '../Lounge/CreateRoomModal';
import LoungeSettingsModal from '../Lounge/LoungeSettingsModal';
import SanctionDialog from '../Lounge/SanctionDialog';
import PrivateSubloungeBanner from '../Lounge/PrivateSubloungeBanner';
import { getSessionId } from '../../utils/auth';
import { velumToast } from '../../utils/toast';
import { setPeerMutedLocal } from '../../utils/dmPeerPrefs';
import { normalizeLoungeMembersPayload } from '../Lounge/utils/memberRoster';
import {
  defaultLoungeSettingsPage,
  resolveLoungeSettingsRole,
  isVelumOfficialLounge,
} from '../Lounge/loungeSettingsRoles';

export default function LoungeWorkspace(props: LoungeWorkspaceProps) {
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const loungeData = useLoungeData({
    loungeId: props.loungeId,
    currentUserId: props.currentUserId,
    currentUserRole: props.currentUserRole,
    activeRoomId: props.activeRoomId,
    onRoomSelect: props.onRoomSelect,
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const targetId = selectedMember?.user_id || selectedMember?.userId;
      if (targetId && !selectedMember.isDetailsLoaded) {
        try {
          const sId = getSessionId();
          const res = await fetch(`/v2/user/${targetId}/profile`, {
            headers: { 'Authorization': `Bearer ${sId}` }
          });
          if (res.ok) {
            const data = await res.json();
            setSelectedMember((prev: any) => {
              const prevId = prev?.user_id || prev?.userId;
              if (prev && String(prevId) === String(targetId)) {
                return {
                  ...prev,
                  displayName: data.displayName || prev.displayName || prev.username,
                  bio: data.bio || prev.bio || 'Velum Member.',
                  location: data.location || prev.location || 'Unknown location',
                  status: data.status || prev.status || 'Active',
                  isMuted: !!data.isMuted,
                  isBlocked: !!data.isBlocked,
                  created_at: data.createdAt || prev.created_at,
                  isDetailsLoaded: true,
                  stats: data.stats || { loungesCount: 4, connectionsCount: 18 }
                };
              }
              return prev;
            });
          }
        } catch (e) {
          console.error('[LoungeWorkspace] Error loading member profile:', e);
        }
      }
    };
    fetchProfile();
  }, [selectedMember]);

  const handleProfileMessage = (member: any) => {
    const targetUserId = member.userId || member.user_id;
    const targetUsername = member.username || `User #${targetUserId}`;
    if (targetUserId) {
      if (props.onSelectPeer) {
        props.onSelectPeer({ userId: targetUserId, username: targetUsername, avatar: member.avatarUrl || member.avatar });
      }
      props.onRoomSelect(`dm_${targetUserId}`);
      setSelectedMember(null);
    }
  };

  const handleProfileMute = async (member: any) => {
    const targetId = member.userId || member.user_id;
    const peerId = Number(targetId);
    const currentlyMuted = !!member.isMuted;
    const nextMuted = !currentlyMuted;
    setPeerMutedLocal(peerId, nextMuted, null, nextMuted ? '24h' : null);
    setSelectedMember((prev: any) => {
      const prevId = prev?.user_id || prev?.userId;
      if (prev && String(prevId) === String(targetId)) {
        return { ...prev, isMuted: nextMuted };
      }
      return prev;
    });
    try {
      const sId = getSessionId();
      const res = await fetch(`/v2/user/${targetId}/mute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sId}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ duration: nextMuted ? '24h' : 'off' }),
      });
      if (res.ok) {
        const data = await res.json();
        setPeerMutedLocal(
          peerId,
          !!data.isMuted,
          data.mutedUntil || null,
          data.duration || null
        );
        velumToast.info(data.isMuted ? 'Muted' : 'Unmuted');
        setSelectedMember((prev: any) => {
          const prevId = prev?.user_id || prev?.userId;
          if (prev && String(prevId) === String(targetId)) {
            return { ...prev, isMuted: !!data.isMuted };
          }
          return prev;
        });
      }
    } catch (e) {}
  };

  const handleProfileBlock = async (member: any) => {
    try {
      const sId = getSessionId();
      const targetId = member.userId || member.user_id;
      const res = await fetch(`/v2/user/${targetId}/block`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) {
        const data = await res.json();
        velumToast.info(data.isBlocked ? 'Blocked user. User Blocked!' : 'Unblocked user.');
        setSelectedMember((prev: any) => {
          const prevId = prev?.user_id || prev?.userId;
          if (prev && String(prevId) === String(targetId)) {
            return { ...prev, isBlocked: !!data.isBlocked };
          }
          return prev;
        });
      }
    } catch(e) {}
  };

  const handleProfileDeleteChat = async (member: any) => {
    try {
      const sId = getSessionId();
      const targetId = member.userId || member.user_id;
      const res = await fetch(`/v2/user/${targetId}/chat`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) {
        velumToast.success(`Chat deleted.`);
        if (props.onRoomSelect) props.onRoomSelect('');
      }
    } catch(e) {}
    setSelectedMember(null);
  };

  const handleProfileReport = async (member: any) => {
    const targetId = member.userId || member.user_id;
    const reason = prompt(`Reason for reporting:`);
    if (!reason || !reason.trim()) return;
    try {
      const sId = getSessionId();
      const res = await fetch('/v2/user/report', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: targetId, reason: reason.trim() })
      });
      if (res.ok) velumToast.success(`Report submitted.`);
    } catch(e) {}
    setSelectedMember(null);
  };

  const handleCopyInvite = () => {
    const code = loungeData.loungeDetails?.invite_code;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const getRoomId = (room: any): string | null => {
    if (!room) return null;
    return room.id || room.room_id || null;
  };

  const displayRooms = Array.isArray(loungeData.rooms) ? loungeData.rooms : [];
  const isSystemExecutive = ['CLI_ADMIN', 'LOGIN_ADMIN', 'SUPPORT_ADMIN'].includes(props.currentUserRole);

  const visibleRooms = displayRooms.filter(room => {
    const isPrivate = room.is_locked || room.visibility === 'private' || room.is_private === 1;
    const isAnnounce = room.accessLevel === 'ANNOUNCE';
    const isExecOnly = room.accessLevel === 'EXEC_ONLY';
    
    if (isSystemExecutive) return true;
    if (isAnnounce || isExecOnly) return false;
    
    if (isPrivate) {
      const isCreator = String(room.created_by || room.owner_id || room.owner_user_id) === String(props.currentUserId);
      const isSubMember = loungeData.members.some(m => String(m.user_id) === String(props.currentUserId) && m.status === 'active');
      
      if (isCreator || isSubMember || loungeData.isParentAdmin) return true;
      return false;
    }
    
    return true;
  });

  const isMasterLounge = props.loungeId === 'velum_master_lounge';
  const rawLoungeTitle = loungeData.loungeDetails?.name || props.loungeName;
  const effectiveLoungeName = (!rawLoungeTitle || rawLoungeTitle.toUpperCase() === 'TEST') ? 'Velum Lounge' : rawLoungeTitle;

  const OFFICIAL_ROOM_ORDER = [
    'velum_general',
    'velum_market',
    'velum_escrow',
    'velum_offtopic',
    'velum_bugs',
    'velum_support',
    'velum_suggestions',
    'velum_events',
    'velum_announcements',
    'velum_executives',
  ];

  const roomOrderKey = (room: any): string =>
    String(room.slug || room.lounge_id || room.id || '');

  const sortedVisibleRooms = [...visibleRooms].sort((a, b) => {
    if (isMasterLounge) {
      const ia = OFFICIAL_ROOM_ORDER.indexOf(roomOrderKey(a));
      const ib = OFFICIAL_ROOM_ORDER.indexOf(roomOrderKey(b));
      const pa = ia === -1 ? 999 : ia;
      const pb = ib === -1 ? 999 : ib;
      if (pa !== pb) return pa - pb;
    }
    const ida = Number(a.id ?? a.lounge_id ?? 0);
    const idb = Number(b.id ?? b.lounge_id ?? 0);
    if (Number.isFinite(ida) && Number.isFinite(idb) && ida !== idb) return ida - idb;
    return roomOrderKey(a).localeCompare(roomOrderKey(b));
  });

  const publicRooms = isMasterLounge 
    ? sortedVisibleRooms.filter(room => room.accessLevel !== 'EXEC_ONLY' && room.accessLevel !== 'ANNOUNCE')
    : sortedVisibleRooms.filter(room => !(room.is_locked || room.visibility === 'private' || room.is_private === 1));
  const privateRooms = isMasterLounge
    ? sortedVisibleRooms.filter(room => room.accessLevel === 'EXEC_ONLY' || room.accessLevel === 'ANNOUNCE')
    : sortedVisibleRooms.filter(room => room.is_locked || room.visibility === 'private' || room.is_private === 1);

  const isLoungeOwner =
    String(loungeData.loungeDetails?.ownerId ?? loungeData.loungeDetails?.owner_id ?? '') === String(props.currentUserId) ||
    loungeData.members.some(
      (m) => String(m.user_id) === String(props.currentUserId) && String(m.role || '').toLowerCase() === 'owner'
    );

  const isLoungeCreator =
    isLoungeOwner ||
    String(loungeData.loungeDetails?.owner_user_id) === String(props.currentUserId) ||
    props.currentUserRole === 'owner' ||
    loungeData.isParentAdmin;

  const isMember =
    isMasterLounge ||
    isLoungeCreator ||
    isSystemExecutive ||
    loungeData.members.some(
      m => String(m.user_id) === String(props.currentUserId) && (m.status === 'active' || m.status === 'approved' || !m.status)
    );

  const memberDirectory = React.useMemo(() => {
    const map: Record<string, { username?: string; avatar?: string | null; displayName?: string | null }> = {};
    for (const m of loungeData.members || []) {
      const id = String(m.user_id ?? m.id ?? '');
      if (!id) continue;
      map[id] = {
        username: m.username,
        avatar: m.avatarUrl || m.avatar || null,
        displayName: m.displayName || m.display_name || null,
      };
    }
    return map;
  }, [loungeData.members]);

  /** Open ProfileCard with roster role so mute/kick/promote work from chat or settings. */
  const openLoungeProfile = (user: {
    userId: number;
    username?: string;
    avatar?: string;
    displayName?: string;
    role?: string;
  }) => {
    const roster = (loungeData.members || []).find(
      (m: any) => String(m.user_id) === String(user.userId)
    );
    setSelectedMember({
      ...(roster || {}),
      user_id: user.userId,
      userId: user.userId,
      username: user.username || roster?.username,
      avatar: user.avatar || roster?.avatarUrl || roster?.avatar,
      displayName:
        user.displayName || roster?.displayName || roster?.display_name || user.username,
      role: roster?.role || user.role || 'member',
      isDetailsLoaded: false,
    });
  };

  const [isJoiningLounge, setIsJoiningLounge] = useState(false);
  const [isApplyingLounge, setIsApplyingLounge] = useState(false);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);
  const [isLeavingLounge, setIsLeavingLounge] = useState(false);

  const handleJoinLounge = async () => {
    if (isJoiningLounge || isApplyingLounge) return;
    setIsJoiningLounge(true);
    try {
      const sId = getSessionId();
      const res = await fetch('/v2/lounges/join', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lounge_id: props.loungeId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        velumToast.error(data.error || 'Could not join lounge');
        return;
      }
      const memRes = await fetch(`/v2/lounges/${props.loungeId}/members`, {
        headers: { 'Authorization': `Bearer ${sId}` },
      });
      if (memRes.ok) {
        loungeData.setMembers(normalizeLoungeMembersPayload(await memRes.json()));
      }
      velumToast.info(data.message || 'Joined lounge');
    } catch (e) {
      console.error('Failed to join lounge', e);
      velumToast.error('Could not join lounge');
    } finally {
      setIsJoiningLounge(false);
    }
  };

  const handleApplyLounge = async () => {
    if (isApplyingLounge || isJoiningLounge || appliedSuccess) return;
    setIsApplyingLounge(true);
    try {
      const sId = getSessionId();
      const res = await fetch(`/v2/lounges/${props.loungeId}/apply`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        velumToast.error(data.error || 'Could not submit application');
        return;
      }
      setAppliedSuccess(true);
      velumToast.info(data.message || 'Application sent');
    } catch (e) {
      console.error('Failed to apply to lounge', e);
      velumToast.error('Could not submit application');
    } finally {
      setIsApplyingLounge(false);
    }
  };

  const handleLeaveLounge = async () => {
    if (isLeavingLounge || isMasterLounge || isOfficialLounge) return;
    if (!confirm(`Leave ${effectiveLoungeName}?`)) return;
    setIsLeavingLounge(true);
    try {
      const sId = getSessionId();
      const res = await fetch(`/v2/lounges/${props.loungeId}/members/${props.currentUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sId}` },
      });
      if (res.ok) {
        velumToast.info('Left lounge');
        props.onBackToDirectory();
      } else {
        const data = await res.json().catch(() => ({}));
        velumToast.error(data.error || 'Could not leave lounge');
      }
    } catch (e) {
      console.error('Failed to leave lounge', e);
      velumToast.error('Could not leave lounge');
    } finally {
      setIsLeavingLounge(false);
    }
  };

  const handleCopyInviteLink = () => {
    const code = loungeData.loungeDetails?.invite_code;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedInviteLink(true);
    setTimeout(() => setCopiedInviteLink(false), 2000);
  };

  const activeRoom = displayRooms.find(r => getRoomId(r) === props.activeRoomId);
  const activeRoomName = activeRoom ? activeRoom.name : '';
  const isPrivateSublounge = activeRoom ? (activeRoom.is_locked || activeRoom.visibility === 'private' || activeRoom.is_private === 1 || activeRoom.is_private === true) : false;

  const isSubloungeCreator = activeRoom ? (
    String(activeRoom.owner_id || activeRoom.created_by) === String(props.currentUserId) || isLoungeCreator
  ) : false;

  const isOfficialLounge = loungeData.loungeDetails?.is_official || loungeData.loungeDetails?.is_system || props.loungeId === 'velum_master_lounge';
  const isPrivateLounge = !!(
    loungeData.loungeDetails?.is_private ||
    loungeData.loungeDetails?.isPrivate
  );
  const canCreateSublounge = !isOfficialLounge && (loungeData.isParentAdmin || isLoungeCreator);
  const loungeAvatar = loungeData.loungeDetails?.avatar_url || loungeData.loungeDetails?.avatarUrl || loungeData.loungeDetails?.icon_url || loungeData.loungeDetails?.iconUrl;

  const handleMarkAsRead = (messageId: string, roomId: string, dbMessageId?: number, sequenceId?: number) => {
    props.onMarkAsRead?.(messageId, roomId, dbMessageId, sequenceId);
  };

  const handleMarkAllAsRead = (roomId: string) => {
    props.onMarkAllAsRead?.(roomId);
  };

  if (loungeData.isLoadingLounge && !props.activeRoomId) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary font-mono text-xs animate-pulse">
        Loading lounge workspace...
      </div>
    );
  }

  const loungeHeader = (
    <div className="px-2 py-2.5 border-b border-velum-600 bg-velum-850 shrink-0">
      <div className="flex items-center gap-1 min-w-0">
        {props.onToggleSidebar && (
          <button
            onClick={props.onToggleSidebar}
            className="p-1.5 text-text-secondary hover:text-text-primary shrink-0 cursor-pointer"
            aria-label="Open sidebar menu"
            title="Open Navigation"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={props.onBackToDirectory}
          className="p-1.5 text-text-secondary hover:text-text-primary shrink-0 cursor-pointer"
          aria-label="Back to directory"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xs font-bold uppercase tracking-wider text-text-primary truncate min-w-0 flex-1">
          {effectiveLoungeName}
        </h1>
        {canCreateSublounge && (
          <button
            onClick={() => {
              loungeData.setStatusMessage('');
              loungeData.setShowCreateModal(true);
            }}
            className="p-1.5 text-text-secondary hover:text-text-primary shrink-0 cursor-pointer"
            title="Create Room"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  const roomsPane = (
    <RoomsList
      publicRooms={publicRooms}
      privateRooms={privateRooms}
      activeRoomId={props.activeRoomId}
      isDark={props.isDark}
      isMasterLounge={isMasterLounge}
      currentUserId={props.currentUserId}
      unreadCounts={props.unreadCounts}
      lastMessages={props.lastMessages}
      typingRooms={loungeData.typingRooms}
      isParentAdmin={loungeData.isParentAdmin}
      onRoomSelect={props.onRoomSelect}
      onDeleteRoom={loungeData.handleDeleteRoom}
    />
  );

  const chatPane = props.activeRoomId ? (
    <div className="w-full h-full relative flex flex-col min-h-0 min-w-0 overflow-hidden">
      <PrivateSubloungeBanner
        activeRoom={activeRoom}
        isPrivateSublounge={isPrivateSublounge}
        isSubloungeCreator={isSubloungeCreator}
        isLoungeOwnerNotCreator={isLoungeCreator && !isSubloungeCreator}
      />
      <ChatArea
        currentUserId={props.currentUserId}
        currentUsername={props.currentUsername}
        currentUserRole={props.currentUserRole}
        roomId={props.activeRoomId}
        roomAccessLevel={loungeData.rooms.find(r => r.id === props.activeRoomId)?.accessLevel || 'ALL'}
        wsConnected={props.wsConnected}
        messages={props.messages}
        onSendMessage={props.onSendMessage || (() => {})}
        onSendTyping={props.onSendTyping || (() => {})}
        onRoomKick={props.onRoomKick || (() => {})}
        onRoomMute={props.onRoomMute || (() => {})}
        onSendReaction={props.onSendReaction}
        onEditMessage={props.onEditMessage}
        onDeleteMessage={props.onDeleteMessage}
        onPinMessage={props.onPinMessage}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        isDark={props.isDark}
        isMobile={true}
        onBackToDeck={() => props.onRoomSelect('')}
        onToggleSidebar={props.onToggleSidebar}
        roomName={activeRoomName}
        isPrivateSublounge={isPrivateSublounge}
        isMember={isMember}
        onJoinLounge={handleJoinLounge}
        onApplyLounge={handleApplyLounge}
        isJoiningLounge={isJoiningLounge}
        isApplyingLounge={isApplyingLounge}
        appliedSuccess={appliedSuccess}
        isPrivateLounge={isPrivateLounge}
        onRequestForward={props.onRequestForward}
        memberDirectory={memberDirectory}
        onSelectProfileUser={openLoungeProfile}
      />
    </div>
  ) : (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center bg-velum-800 min-h-0">
      <p className="text-sm font-semibold text-text-primary">Pick a room</p>
      <p className="text-xs text-text-secondary max-w-xs">
        Choose a room on the left to open the chat.
      </p>
    </div>
  );

  const sharedModals = (
    <>
      <CreateRoomModal
        show={loungeData.showCreateModal}
        isDark={props.isDark}
        newRoomName={loungeData.newRoomName}
        setNewRoomName={loungeData.setNewRoomName}
        newRoomLocked={loungeData.newRoomLocked}
        setNewRoomLocked={loungeData.setNewRoomLocked}
        statusMessage={loungeData.statusMessage}
        isCreatingRoom={loungeData.isCreatingRoom}
        onClose={() => loungeData.setShowCreateModal(false)}
        onCreateRoom={loungeData.handleCreateRoom}
      />

      <LoungeSettingsModal
        show={loungeData.showManageModal}
        isDark={props.isDark}
        loungeName={props.loungeName}
        loungeId={props.loungeId}
        loungeDetails={loungeData.loungeDetails}
        members={loungeData.members}
        currentUserId={props.currentUserId}
        currentUserRole={props.currentUserRole}
        inviteCode={
          loungeData.loungeDetails?.invite_code ||
          loungeData.loungeDetails?.inviteCode ||
          null
        }
        activePage={loungeData.manageTab}
        setActivePage={loungeData.setManageTab}
        onClose={() => {
          loungeData.setShowManageModal(false);
          loungeData.setDirectAddError('');
          loungeData.setDirectAddSuccess('');
        }}
        editName={loungeData.editName}
        setEditName={loungeData.setEditName}
        editDescription={loungeData.editDescription}
        setEditDescription={loungeData.setEditDescription}
        editIconUrl={loungeData.editIconUrl}
        setEditIconUrl={loungeData.setEditIconUrl}
        editIsPrivate={loungeData.editIsPrivate}
        setEditIsPrivate={loungeData.setEditIsPrivate}
        uploadError={loungeData.uploadError || ''}
        setUploadError={loungeData.setUploadError}
        isSavingSettings={!!loungeData.isSavingSettings}
        onSaveLoungeInfo={loungeData.handleSaveSettings}
        manageRequests={loungeData.manageRequests}
        manageInvites={loungeData.manageInvites}
        directAddUsername={loungeData.directAddUsername}
        setDirectAddUsername={loungeData.setDirectAddUsername}
        directAddError={loungeData.directAddError}
        directAddSuccess={loungeData.directAddSuccess}
        onUpdateRole={loungeData.handleUpdateRole}
        onSanctionClick={(userId, type) => {
          loungeData.setActiveSanctionUserId(userId);
          loungeData.setShowSanctionDialog(type);
        }}
        onReviewRequest={loungeData.handleReviewRequest}
        onDirectAddMember={loungeData.handleDirectAddMember}
        onCreateInviteCode={loungeData.handleCreateInviteCode}
        onRevokeInviteCode={loungeData.handleRevokeInviteCode}
        onDeleteLounge={loungeData.handleDeleteLounge}
        onTransferOwnership={loungeData.handleTransferOwnership}
        onSelectMember={(member) =>
          openLoungeProfile({
            userId: Number(member.user_id || member.userId),
            username: member.username,
            avatar: member.avatarUrl || member.avatar,
            displayName: member.displayName || member.display_name,
            role: member.role,
          })
        }
      />

      <SanctionDialog
        showSanctionDialog={loungeData.showSanctionDialog}
        activeSanctionUserId={loungeData.activeSanctionUserId}
        isDark={props.isDark}
        sanctionReason={loungeData.sanctionReason}
        setSanctionReason={loungeData.setSanctionReason}
        onCancel={() => {
          loungeData.setShowSanctionDialog(null);
          loungeData.setActiveSanctionUserId(null);
          loungeData.setSanctionReason('');
        }}
        onConfirm={loungeData.handleApplySanction}
      />

      {selectedMember && (() => {
        const targetId = Number(selectedMember.user_id || selectedMember.userId);
        const isSelf = String(targetId) === String(props.currentUserId);
        const targetLoungeRole = String(selectedMember.role || 'member').toLowerCase();
        const isOwnerTarget = targetLoungeRole === 'owner';
        const velumLounge = isVelumOfficialLounge({
          loungeId: props.loungeId,
          slug: loungeData.loungeDetails?.slug,
          isOfficial: loungeData.loungeDetails?.is_official ?? loungeData.loungeDetails?.isOfficial,
          isSystem: loungeData.loungeDetails?.is_system ?? loungeData.loungeDetails?.isSystem,
        });
        const myMembership = (loungeData.members || []).find(
          (m: any) => String(m.user_id) === String(props.currentUserId)
        );
        const viewerStaff = resolveLoungeSettingsRole({
          currentUserId: props.currentUserId,
          ownerId:
            loungeData.loungeDetails?.ownerId ??
            loungeData.loungeDetails?.owner_id ??
            loungeData.loungeDetails?.owner_user_id,
          membershipRole: myMembership?.role,
          systemUserRole: props.currentUserRole,
          isVelumLounge: velumLounge,
        });
        const canMute =
          !isSelf &&
          !isOwnerTarget &&
          (viewerStaff === 'moderator' || viewerStaff === 'admin' || viewerStaff === 'owner');
        const canKick =
          !isSelf &&
          !isOwnerTarget &&
          (viewerStaff === 'admin' || viewerStaff === 'owner');
        const canChangeRole = canKick && targetLoungeRole !== 'owner';

        return (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center modal-backdrop p-4"
          onClick={() => setSelectedMember(null)}
        >
          <div onClick={e => e.stopPropagation()} className="relative">
            <ProfileCard
              type={selectedMember.role === 'LOGIN_ADMIN' || selectedMember.role === 'SUPPORT_OPERATOR' ? 'admin' : 'user'}
              user={toUserProfileData({
                ...selectedMember,
                userId: selectedMember.user_id,
                bio: selectedMember.bio || 'Velum Member.',
                location: selectedMember.location || 'Unknown location',
                joinedDate: selectedMember.created_at
                  ? new Date(selectedMember.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : 'May 2026',
                stats: selectedMember.stats || { loungesCount: 4, connectionsCount: 18 },
              })}
              variant="mobile"
              onClose={() => setSelectedMember(null)}
              onMessage={() => handleProfileMessage(selectedMember)}
              onReport={() => handleProfileReport(selectedMember)}
              loungeActions={
                canMute || canKick || canChangeRole
                  ? {
                      memberRole: targetLoungeRole,
                      canMute,
                      canKick,
                      canChangeRole,
                      onLoungeMute: () => {
                        loungeData.setActiveSanctionUserId(targetId);
                        loungeData.setShowSanctionDialog('mute');
                        setSelectedMember(null);
                      },
                      onLoungeKick: () => {
                        // Kick = ban + block rejoin (server maps kick → banned)
                        loungeData.setActiveSanctionUserId(targetId);
                        loungeData.setShowSanctionDialog('kick');
                        setSelectedMember(null);
                      },
                      onSetRole: (role) => {
                        loungeData.handleUpdateRole(targetId, role);
                        setSelectedMember((prev: any) =>
                          prev ? { ...prev, role } : prev
                        );
                      },
                    }
                  : undefined
              }
            />
          </div>
        </div>
        );
      })()}
    </>
  );

  // Mobile-first: always 2-column inside a lounge (left rooms, right chat).
  return (
    <>
      <div className="w-full h-full min-h-0 flex flex-1 overflow-hidden bg-transparent text-text-primary">
        <aside className="w-[32%] max-w-[200px] min-w-[128px] h-full shrink-0 flex flex-col min-h-0 border-r border-velum-600 bg-velum-850">
          {loungeHeader}
          <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">{roomsPane}</div>
          <div className="mt-auto sticky bottom-0 shrink-0 z-10 border-t border-velum-600 bg-velum-850 px-1.5 py-2 flex items-center justify-around gap-0.5">
            <button
              type="button"
              onClick={() => {
                const membership = loungeData.members.find(
                  (m: any) => String(m.user_id) === String(props.currentUserId)
                );
                const role = resolveLoungeSettingsRole({
                  currentUserId: props.currentUserId,
                  ownerId:
                    loungeData.loungeDetails?.ownerId ??
                    loungeData.loungeDetails?.owner_id ??
                    null,
                  membershipRole: membership?.role,
                  systemUserRole: props.currentUserRole,
                  isVelumLounge: isVelumOfficialLounge({
                    loungeId: props.loungeId,
                    slug: loungeData.loungeDetails?.slug,
                    isOfficial:
                      loungeData.loungeDetails?.is_official ??
                      loungeData.loungeDetails?.isOfficial,
                    isSystem:
                      loungeData.loungeDetails?.is_system ??
                      loungeData.loungeDetails?.isSystem,
                  }),
                });
                loungeData.setManageTab(defaultLoungeSettingsPage(role));
                loungeData.setShowManageModal(true);
              }}
              className="flex-1 flex items-center justify-center p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer"
              title="Lounge settings"
              aria-label="Lounge settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <div
              className="w-9 h-9 rounded-xl bg-velum-750 border border-velum-600 flex items-center justify-center overflow-hidden shrink-0"
              title={effectiveLoungeName}
            >
              {loungeAvatar ? (
                <img
                  src={loungeAvatar}
                  alt={effectiveLoungeName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-[10px] font-bold text-accent font-mono">
                  {(effectiveLoungeName || 'L').slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            {!isMasterLounge && !isOfficialLounge ? (
              <button
                type="button"
                onClick={handleLeaveLounge}
                disabled={isLeavingLounge}
                className="flex-1 flex items-center justify-center p-2 rounded-lg text-text-secondary hover:text-alert-error hover:bg-alert-error/10 transition cursor-pointer disabled:opacity-50"
                title="Leave lounge"
                aria-label="Leave lounge"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex-1" aria-hidden />
            )}
          </div>
        </aside>
        <main className="flex-1 flex flex-col min-h-0 min-w-0 h-full overflow-hidden">{chatPane}</main>
      </div>
      {sharedModals}
    </>
  );
}
