import React, { useState, useEffect } from 'react';
import ChatArea from '../ChatArea';
import { useResponsive } from '../../hooks/useResponsive';
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

export default function LoungeWorkspace(props: LoungeWorkspaceProps) {
  const { isMobile: _isMobile, isTablet } = useResponsive();
  const isMobile = _isMobile || isTablet;
  const [isSubloungeCollapsed, setIsSubloungeCollapsed] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'rooms' | 'members' | 'about'>('rooms');
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [showLoungeProfile, setShowLoungeProfile] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const loungeData = useLoungeData({
    loungeId: props.loungeId,
    currentUserId: props.currentUserId,
    currentUserRole: props.currentUserRole,
    activeRoomId: props.activeRoomId,
    isMobile,
    onRoomSelect: props.onRoomSelect,
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const targetId = selectedMember?.user_id || selectedMember?.userId;
      if (targetId && !selectedMember.isDetailsLoaded) {
        try {
          const sId = sessionStorage.getItem('velum-sessionId') || '';
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
    const currentUserId = props.currentUserId;
    const targetUserId = member.userId || member.user_id;
    if (currentUserId && targetUserId) {
      const dmRoomId = `dm_${Math.min(currentUserId, targetUserId)}_${Math.max(currentUserId, targetUserId)}`;
      props.onRoomSelect(dmRoomId);
      setSelectedMember(null);
    }
  };

  const handleProfileMute = async (member: any) => {
    try {
      const sId = sessionStorage.getItem('velum-sessionId') || '';
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
      const sId = sessionStorage.getItem('velum-sessionId') || '';
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
      const sId = sessionStorage.getItem('velum-sessionId') || '';
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
      const sId = sessionStorage.getItem('velum-sessionId') || '';
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

  const activeRoom = displayRooms.find(r => getRoomId(r) === props.activeRoomId);
  const activeRoomName = activeRoom ? activeRoom.name : '';
  const isPrivateSublounge = activeRoom ? (activeRoom.is_locked || activeRoom.visibility === 'private' || activeRoom.is_private === 1 || activeRoom.is_private === true) : false;

  const isSubloungeCreator = activeRoom ? (
    String(activeRoom.owner_id || activeRoom.created_by) === String(props.currentUserId) || isLoungeCreator
  ) : false;

  const isOfficialLounge = loungeData.loungeDetails?.is_official || loungeData.loungeDetails?.is_system || props.loungeId === 'velum_master_lounge';
  const canCreateSublounge = !isOfficialLounge && (loungeData.isParentAdmin || isLoungeCreator);

  const handleMarkAsRead = (messageId: string, roomId: string) => {
    props.onMarkAsRead?.(messageId, roomId);
  };

  const handleMarkAllAsRead = (roomId: string) => {
    props.onMarkAllAsRead?.(roomId);
  };

  // Desktop Split View
  if (!isMobile) {
    if (loungeData.isLoadingLounge && loungeData.rooms.length === 0) {
      return (
        <div className="flex-1 flex w-full h-full items-center justify-center bg-transparent">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <div className="text-text-secondary font-mono text-xs uppercase tracking-widest">
              Initializing Lounge Workspace...
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="flex-1 flex w-full h-full overflow-hidden min-h-0 bg-transparent">
          {/* Persistent Sidebar Directory Column */}
          <div className={`flex-shrink-0 flex flex-col h-full min-h-0 border-r border-white-5 bg-black/10 transition-all duration-300 ${
            isSubloungeCollapsed ? 'w-14 min-w-[56px]' : 'w-64 min-w-[256px]'
          }`}>
            <div className="flex-1 flex flex-col h-full min-h-0 bg-transparent overflow-hidden">
              <div className="p-3 border-b border-white-5 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <button
                    onClick={props.onBackToDirectory}
                    className="p-2 -ml-1 rounded-lg text-text-secondary hover:text-white hover:bg-white-10 transition-colors cursor-pointer shrink-0"
                    title="Back to Directory"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  {!isSubloungeCollapsed && (
                    <span 
                      onClick={() => setShowLoungeProfile(true)}
                      className={`text-xs font-bold uppercase tracking-wider truncate cursor-pointer hover:underline ${props.isDark ? 'text-white' : 'text-gray-900'}`}
                    >
                      {props.loungeName}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!isSubloungeCollapsed && loungeData.isParentAdmin && (
                    <button
                      onClick={() => loungeData.setShowManageModal(true)}
                      className="p-1.5 rounded-lg hover:bg-white-10 text-text-secondary hover:text-white transition-colors cursor-pointer"
                      title="Manage Lounge"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  )}
                  {!isSubloungeCollapsed && canCreateSublounge && (
                    <button
                      onClick={() => {
                        loungeData.setStatusMessage('');
                        loungeData.setShowCreateModal(true);
                      }}
                      className="p-1.5 rounded-lg hover:bg-white-10 text-text-secondary hover:text-white transition-colors cursor-pointer"
                      title="Create Room / Sublounge"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsSubloungeCollapsed(prev => !prev)}
                    className="p-1.5 rounded-lg hover:bg-white-10 text-text-secondary hover:text-white transition-colors cursor-pointer"
                    title={isSubloungeCollapsed ? "Expand Directory" : "Collapse Directory"}
                  >
                    {isSubloungeCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {!isSubloungeCollapsed && (
                <div className="flex-1 overflow-y-auto">
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
                </div>
              )}

              {!isSubloungeCollapsed && isLoungeCreator && loungeData.loungeDetails?.invite_code && (
                <div className="p-4 border-t border-white-5 bg-transparent">
                  <div className="p-3 bg-velum-800 border border-white-5 rounded-xl flex flex-col gap-1.5 shadow-lg shadow-black/20">
                    <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-secondary select-none">Lounge Invite</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-accent tracking-wider select-all truncate">{loungeData.loungeDetails.invite_code}</span>
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
          <div className="flex-1 min-w-0 relative min-h-0 flex flex-col h-full bg-velum-900 overflow-hidden">
            <PrivateSubloungeBanner
              activeRoom={activeRoom}
              isPrivateSublounge={isPrivateSublounge}
              isSubloungeCreator={isSubloungeCreator}
              isLoungeOwnerNotCreator={isLoungeCreator && !isSubloungeCreator}
            />
            {props.activeRoomId ? (
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
                isMobile={false}
                onToggleSidebar={props.onToggleSidebar}
                roomName={activeRoomName}
                isPrivateSublounge={isPrivateSublounge}
              />
            ) : (
              <LoungeOverview
                loungeName={effectiveLoungeName}
                loungeDetails={loungeData.loungeDetails}
                memberCount={loungeData.members.length}
                isDark={props.isDark}
                isLoungeCreator={isLoungeCreator}
                handleCopyInvite={handleCopyInvite}
                copiedInvite={copiedInvite}
              />
            )}
          </div>
          
          {/* Members Sidebar (Desktop) */}
          <div className="w-60 flex-shrink-0 flex flex-col min-h-0 border-l border-white-5 bg-black/10 overflow-y-auto hidden lg:flex select-none">
            <div className="p-4 border-b border-white-5">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Lounge Roster</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-4">
              {['owner', 'admin', 'moderator', 'member'].map(role => {
                const roleMembers = loungeData.members.filter(m => m.role === role);
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
            variant={isMobile ? 'mobile' : 'popover'}
            onClose={() => setSelectedMember(null)}
            onMessage={() => handleProfileMessage(selectedMember)}
            onMute={() => handleProfileMute(selectedMember)}
            onBlock={() => handleProfileBlock(selectedMember)}
            onDeleteChat={() => handleProfileDeleteChat(selectedMember)}
            onReport={() => handleProfileReport(selectedMember)}
          />
        )}
      </>
    );
  }

  // Mobile View
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
            <div className="flex items-center gap-2 min-w-0">
              {props.onToggleSidebar && (
                <button 
                  onClick={props.onToggleSidebar} 
                  className="p-2 rounded-full bg-white-5 text-text-secondary hover:text-white shrink-0 cursor-pointer" 
                  aria-label="Open sidebar menu"
                  title="Open Navigation"
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}
              <button onClick={props.onBackToDirectory} className="p-2 rounded-full bg-white-5 text-text-secondary shrink-0" aria-label="Back to directory">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h1 
                onClick={() => setShowLoungeProfile(true)}
                className="text-lg font-black uppercase tracking-widest text-accent truncate cursor-pointer hover:underline"
              >
                {effectiveLoungeName}
              </h1>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {loungeData.isParentAdmin && (
                <button
                  onClick={() => loungeData.setShowManageModal(true)}
                  className="p-2.5 bg-white-5 border border-white-5 hover:bg-white-10 text-text-secondary hover:text-white rounded-xl transition cursor-pointer"
                  title="Manage Lounge"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
              {canCreateSublounge && (
              <button
                onClick={() => {
                  loungeData.setStatusMessage('');
                  loungeData.setShowCreateModal(true);
                }}
                className="p-2.5 bg-white-5 border border-white-5 hover:bg-white-10 text-text-secondary hover:text-white rounded-xl transition cursor-pointer"
                title="Create Room"
              >
                <Plus className="w-4 h-4" />
              </button>
              )}
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
              loungeName={effectiveLoungeName}
              loungeDetails={loungeData.loungeDetails}
              memberCount={loungeData.members.length}
              isDark={props.isDark}
              isLoungeCreator={isLoungeCreator}
              handleCopyInvite={handleCopyInvite}
              copiedInvite={copiedInvite}
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
              variant={isMobile ? 'mobile' : 'popover'}
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
              variant={isMobile ? 'mobile' : 'expanded'}
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
