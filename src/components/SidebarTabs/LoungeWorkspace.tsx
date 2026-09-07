import React, { useState, useEffect } from 'react';
import ChatArea from '../ChatArea';
import { ChevronLeft, ChevronRight, Plus, Settings, Menu } from 'lucide-react';
import ProfileCard from '../ProfileCard';
import { LoungeWorkspaceProps } from '../Lounge/types';
import LoungeOverview from '../Lounge/LoungeOverview';
import { useLoungeData } from '../Lounge/hooks/useLoungeData';
import RoomsList from '../Lounge/RoomsList';
import MembersList from '../Lounge/MembersList';
import CreateRoomModal from '../Lounge/CreateRoomModal';
import ManageLoungeModal from '../Lounge/ManageLoungeModal';
import SanctionDialog from '../Lounge/SanctionDialog';
import PrivateSubloungeBanner from '../Lounge/PrivateSubloungeBanner';
import { getSessionId } from '../../utils/auth';

export default function LoungeWorkspace(props: LoungeWorkspaceProps) {
  const [mobileTab, setMobileTab] = useState<'rooms' | 'members' | 'about'>('rooms');
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [showLoungeProfile, setShowLoungeProfile] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const loungeData = useLoungeData({
    loungeId: props.loungeId,
    currentUserId: props.currentUserId,
    currentUserRole: props.currentUserRole,
    activeRoomId: props.activeRoomId,
    isMobile: true,
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
    try {
      const sId = getSessionId();
      const targetId = member.userId || member.user_id;
      const res = await fetch(`/v2/user/${targetId}/mute`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.isMuted ? 'Muted user. They can no longer disturb you.' : 'Unmuted user.');
        setSelectedMember((prev: any) => {
          const prevId = prev?.user_id || prev?.userId;
          if (prev && String(prevId) === String(targetId)) {
            return { ...prev, isMuted: !!data.isMuted };
          }
          return prev;
        });
      }
    } catch(e) {}
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
        alert(data.isBlocked ? 'Blocked user. User Blocked!' : 'Unblocked user.');
        if (data.isBlocked && props.onRoomSelect) {
          props.onRoomSelect('');
        }
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
        alert(`Chat deleted.`);
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
      if (res.ok) alert(`Report submitted.`);
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

  const getRoomLastMessageTime = (room: any) => {
    const roomId = getRoomId(room);
    if (!roomId || !props.lastMessages || !props.lastMessages[roomId]) return 0;
    const lm = props.lastMessages[roomId];
    if (!lm) return 0;
    const ts = lm.timestamp || lm.created_at || lm.createdAt;
    if (!ts) return 0;
    return new Date(ts).getTime();
  };

  const sortedVisibleRooms = visibleRooms.sort((a, b) => getRoomLastMessageTime(b) - getRoomLastMessageTime(a));

  const publicRooms = isMasterLounge 
    ? sortedVisibleRooms.filter(room => room.accessLevel !== 'EXEC_ONLY' && room.accessLevel !== 'ANNOUNCE')
    : sortedVisibleRooms.filter(room => !(room.is_locked || room.visibility === 'private' || room.is_private === 1));
  const privateRooms = isMasterLounge
    ? sortedVisibleRooms.filter(room => room.accessLevel === 'EXEC_ONLY' || room.accessLevel === 'ANNOUNCE')
    : sortedVisibleRooms.filter(room => room.is_locked || room.visibility === 'private' || room.is_private === 1);

  const isLoungeCreator = 
    String(loungeData.loungeDetails?.owner_id) === String(props.currentUserId) ||
    String(loungeData.loungeDetails?.owner_user_id) === String(props.currentUserId) ||
    props.currentUserRole === 'owner' ||
    loungeData.isParentAdmin;

  const isMember = isLoungeCreator || isSystemExecutive || loungeData.members.some(
    m => String(m.user_id) === String(props.currentUserId) && (m.status === 'active' || m.status === 'approved' || !m.status)
  );

  const [isJoiningLounge, setIsJoiningLounge] = useState(false);
  const [isApplyingLounge, setIsApplyingLounge] = useState(false);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  const handleJoinLounge = async () => {
    setIsJoiningLounge(true);
    try {
      const sId = getSessionId();
      const res = await fetch('/v2/lounges/join', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lounge_id: props.loungeId })
      });
      if (res.ok) {
        const memRes = await fetch(`/v2/lounges/${props.loungeId}/members`, { headers: { 'Authorization': `Bearer ${sId}` } });
        if (memRes.ok) {
          const data = await memRes.json();
          loungeData.setMembers(data.filter((u: any) => u.user_id !== 999 && !(u.username?.toLowerCase() === 'members' || u.username?.toLowerCase() === 'velum-msg')));
        }
      }
    } catch (e) {
      console.error('Failed to join lounge', e);
    } finally {
      setIsJoiningLounge(false);
    }
  };

  const handleApplyLounge = async () => {
    setIsApplyingLounge(true);
    try {
      const sId = getSessionId();
      const res = await fetch(`/v2/lounges/${props.loungeId}/apply`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setAppliedSuccess(true);
      }
    } catch (e) {
      console.error('Failed to apply to lounge', e);
    } finally {
      setIsApplyingLounge(false);
    }
  };

  const handleCopyInviteLink = () => {
    const code = loungeData.loungeDetails?.invite_code;
    const link = code 
      ? `${window.location.origin}/?invite=${code}` 
      : `${window.location.origin}/?lounge=${props.loungeId}`;
    navigator.clipboard.writeText(link);
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

  if (props.activeRoomId) {
    return (
      <div className="w-full h-full relative flex flex-col min-h-0 min-w-0 overflow-hidden">
        <PrivateSubloungeBanner
          activeRoom={activeRoom}
          isPrivateSublounge={isPrivateSublounge}
          isSubloungeCreator={isSubloungeCreator}
          isLoungeOwnerNotCreator={isLoungeCreator && !isSubloungeCreator}
          isMobile={true}
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
          avatarUrl={loungeAvatar}
        />
      </div>
    );
  }

  // Lounge Home View on Mobile
  return (
    <>
      <div className="w-full h-full flex flex-col min-h-0 bg-transparent text-text-primary">
        <div className="p-3 border-b border-velum-600 bg-velum-850">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {props.onToggleSidebar && (
                <button 
                  onClick={props.onToggleSidebar} 
                  className="p-1.5 rounded-lg border border-velum-600 text-text-secondary hover:text-text-primary hover:bg-velum-750 shrink-0 cursor-pointer" 
                  aria-label="Open sidebar menu"
                  title="Open Navigation"
                >
                  <Menu className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={props.onBackToDirectory} 
                className="p-1.5 rounded-lg border border-velum-600 text-text-secondary hover:text-text-primary hover:bg-velum-750 shrink-0 cursor-pointer" 
                aria-label="Back to directory"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div 
                onClick={() => setShowLoungeProfile(true)}
                className="flex items-center gap-2 min-w-0 cursor-pointer group"
              >
                <div className="w-5 h-5 rounded-md bg-velum-750 border border-velum-600 flex items-center justify-center overflow-hidden shrink-0">
                  {loungeAvatar ? (
                    <img src={loungeAvatar} alt={props.loungeName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[9px] font-bold text-accent font-mono">
                      {(effectiveLoungeName || 'L').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <h1 className="text-xs font-bold uppercase tracking-wider text-text-primary truncate group-hover:underline">
                  {effectiveLoungeName}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {loungeData.isParentAdmin && (
                <button
                  onClick={() => loungeData.setShowManageModal(true)}
                  className="p-1.5 bg-velum-800 border border-velum-600 hover:border-accent/40 text-text-secondary hover:text-text-primary rounded-lg transition cursor-pointer"
                  title="Manage Lounge"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}
              {canCreateSublounge && (
                <button
                  onClick={() => {
                    loungeData.setStatusMessage('');
                    loungeData.setShowCreateModal(true);
                  }}
                  className="p-1.5 bg-velum-800 border border-velum-600 hover:border-accent/40 text-text-secondary hover:text-text-primary rounded-lg transition cursor-pointer"
                  title="Create Room"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex border-b border-velum-600 bg-velum-850">
          {(['rooms', 'members', 'about'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                mobileTab === tab 
                  ? 'text-text-primary border-b-2 border-accent' 
                  : 'text-text-secondary border-b-2 border-transparent hover:text-text-primary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {mobileTab === 'rooms' && (
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
          )}
          {mobileTab === 'members' && (
            <MembersList
              members={loungeData.members}
              isDark={props.isDark}
              onSelectMember={setSelectedMember}
            />
          )}
          {mobileTab === 'about' && (
            <LoungeOverview
              loungeId={props.loungeId}
              loungeName={effectiveLoungeName}
              loungeDetails={loungeData.loungeDetails}
              memberCount={loungeData.members.length}
              isDark={props.isDark}
              isMember={isMember}
              isLoungeCreator={isLoungeCreator}
              handleCopyInvite={handleCopyInvite}
              copiedInvite={copiedInvite}
              handleCopyInviteLink={handleCopyInviteLink}
              copiedInviteLink={copiedInviteLink}
              onJoinLounge={handleJoinLounge}
              onApplyLounge={handleApplyLounge}
              isJoining={isJoiningLounge}
              isApplying={isApplyingLounge}
              appliedSuccess={appliedSuccess}
            />
          )}
        </div>
      </div>

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

      <ManageLoungeModal
        show={loungeData.showManageModal}
        isDark={props.isDark}
        loungeName={props.loungeName}
        loungeId={props.loungeId}
        manageTab={loungeData.manageTab}
        setManageTab={loungeData.setManageTab}
        manageRequests={loungeData.manageRequests}
        manageInvites={loungeData.manageInvites}
        members={loungeData.members}
        currentUserId={props.currentUserId}
        editName={loungeData.editName}
        setEditName={loungeData.setEditName}
        editDescription={loungeData.editDescription}
        setEditDescription={loungeData.setEditDescription}
        editIconUrl={loungeData.editIconUrl}
        setEditIconUrl={loungeData.setEditIconUrl}
        settingsError={loungeData.settingsError}
        settingsSuccess={loungeData.settingsSuccess}
        directAddUsername={loungeData.directAddUsername}
        setDirectAddUsername={loungeData.setDirectAddUsername}
        directAddError={loungeData.directAddError}
        directAddSuccess={loungeData.directAddSuccess}
        onClose={() => {
          loungeData.setShowManageModal(false);
          loungeData.setDirectAddError('');
          loungeData.setDirectAddSuccess('');
        }}
        onSaveSettings={loungeData.handleSaveSettings}
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

      {/* Selected Member Profile Card Overlay */}
      {selectedMember && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center modal-backdrop p-4"
          onClick={() => setSelectedMember(null)}
        >
          <div onClick={e => e.stopPropagation()} className="relative">
            <ProfileCard
              type={selectedMember.role === 'LOGIN_ADMIN' || selectedMember.role === 'SUPPORT_OPERATOR' ? 'admin' : 'user'}
              user={{
                userId: selectedMember.user_id,
                username: selectedMember.username,
                displayName: selectedMember.displayName || selectedMember.username.replace('@', ''),
                bio: selectedMember.bio || 'Velum Member.',
                location: selectedMember.location || 'Unknown location',
                joinedDate: selectedMember.created_at ? new Date(selectedMember.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'May 2026',
                status: selectedMember.status || 'offline',
                role: selectedMember.role,
                avatarUrl: selectedMember.avatar,
                isMuted: !!selectedMember.isMuted,
                isBlocked: !!selectedMember.isBlocked,
                stats: selectedMember.stats || {
                  loungesCount: 4,
                  connectionsCount: 18
                }
              }}
              variant="mobile"
              onClose={() => setSelectedMember(null)}
              onMessage={() => handleProfileMessage(selectedMember)}
              onMute={() => handleProfileMute(selectedMember)}
              onBlock={() => handleProfileBlock(selectedMember)}
              onDeleteChat={() => handleProfileDeleteChat(selectedMember)}
              onReport={() => handleProfileReport(selectedMember)}
            />
          </div>
        </div>
      )}

      {/* Lounge Profile Card Overlay */}
      {showLoungeProfile && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center modal-backdrop p-4"
          onClick={() => setShowLoungeProfile(false)}
        >
          <div onClick={e => e.stopPropagation()} className="relative">
            <ProfileCard
              type="lounge"
              lounge={{
                loungeId: loungeData.loungeDetails?.lounge_id || props.loungeId,
                name: effectiveLoungeName,
                description: loungeData.loungeDetails?.description || 'Operational hub and workspace.',
                ownerId: Number(loungeData.loungeDetails?.owner_id || 999),
                ownerUsername: loungeData.loungeDetails?.owner_username || 'velum',
                memberCount: loungeData.members.length || 1,
                avatarUrl: loungeData.loungeDetails?.icon_url || '',
                createdAt: 'May 2026',
                isPrivate: !!loungeData.loungeDetails?.is_private,
              }}
              variant="mobile"
              onClose={() => setShowLoungeProfile(false)}
              onLoungeSettings={loungeData.isParentAdmin ? () => {
                setShowLoungeProfile(false);
                loungeData.setShowManageModal(true);
                loungeData.setManageTab('settings');
              } : undefined}
            />
          </div>
        </div>
      )}
    </>
  );
}
