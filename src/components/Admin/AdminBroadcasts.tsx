import React, { useState, useEffect } from 'react';
import {
  Globe,
  ShieldAlert,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Info,
  LogOut,
  Megaphone,
  BadgeCheck,
  Send,
} from 'lucide-react';
import { decryptMessage } from '../../services/encryptionService';
import { stripAt } from '../../types';

const SUBLOUNGES = [
  { id: 'general', name: '# general', description: 'General discussions' },
  { id: 'off-topic', name: '# off-topic', description: 'Chat about anything' },
  { id: 'announcements', name: '# announcements', description: 'Official updates' },
  { id: 'resources', name: '# resources', description: 'Useful links & resources' },
  { id: 'introduce-yourself', name: '# introduce-yourself', description: 'Say hello to everyone' },
  { id: 'events', name: '# events', description: 'Events & hangouts' },
  { id: 'media', name: '# media', description: 'Share images & videos' },
  { id: 'voice-room', name: '# voice room', description: 'Join the voice conversation' },
  { id: 'support', name: '# support', description: 'Get help & support' },
  { id: 'feedback', name: '# feedback', description: 'Share your feedback' },
];

interface AdminBroadcastsProps {
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN' | 'CLI_ADMIN';
  user?: any;
  onLogout?: () => void;
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export default function AdminBroadcasts({
  adminRole,
  user,
  onLogout,
  adminFetch,
}: AdminBroadcastsProps) {
  // Local states
  const [selectedChannel, setSelectedChannel] = useState<string>('velum_lounge');
  const [channelMessages, setChannelMessages] = useState<any[]>([]);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [newChannelMsg, setNewChannelMsg] = useState('');
  const [broadcastAlert, setBroadcastAlert] = useState(false);
  const [isVelumExpanded, setIsVelumExpanded] = useState(true);
  const [isPostingMsg, setIsPostingMsg] = useState(false);
  const [announcementsMobileView, setAnnouncementsMobileView] = useState<'list' | 'chat'>('list');

  // Fetch functions
  const fetchChannelMessages = async (roomId: string) => {
    try {
      const res = await adminFetch(`/api/rooms/${roomId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setChannelMessages(data);
      }
    } catch (err) {
      console.error('Error fetching channel messages:', err);
    }
  };

  const fetchAvailableRooms = async () => {
    try {
      const res = await adminFetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setAvailableRooms(data || []);
      }
    } catch (err) {
      console.error('Error fetching dynamic rooms list:', err);
    }
  };

  useEffect(() => {
    fetchChannelMessages(selectedChannel);
    fetchAvailableRooms();
    const interval = setInterval(() => {
      fetchChannelMessages(selectedChannel);
      fetchAvailableRooms();
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedChannel]);

  useEffect(() => {
    setBroadcastAlert(false);
  }, [selectedChannel]);

  const handleSendChannelMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelMsg.trim()) return;

    setIsPostingMsg(true);
    try {
      if (selectedChannel === 'secops' && broadcastAlert) {
        const res = await adminFetch('/api/admin/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newChannelMsg }),
        });
        if (res.ok) {
          setNewChannelMsg('');
          setBroadcastAlert(false);
          fetchChannelMessages(selectedChannel);
        } else {
          const err = await res.json();
          alert(err.error || 'Failed to dispatch broadcast');
        }
      } else {
        const res = await adminFetch(`/api/rooms/${selectedChannel}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: newChannelMsg,
            is_encrypted: false,
          }),
        });
        if (res.ok) {
          setNewChannelMsg('');
          fetchChannelMessages(selectedChannel);
        } else {
          const err = await res.json();
          alert(err.error || 'Failed to dispatch message');
        }
      }
    } catch (err) {
      alert('Gateway error.');
    } finally {
      setIsPostingMsg(false);
    }
  };

  const currentRoom = availableRooms.find((r) => r.room_id === selectedChannel);
  const subRoom = SUBLOUNGES.find((s) => s.id === selectedChannel);
  const displayHeaderTitle = subRoom
    ? `Velum Lounge ${subRoom.name}`
    : currentRoom
    ? currentRoom.name === 'velum_lounge' || currentRoom.room_id === 'velum_lounge'
      ? 'Velum Lounge'
      : currentRoom.name
    : selectedChannel === 'secops'
    ? 'Admins SecOps Group'
    : `Room #${selectedChannel}`;

  const displayHeaderDesc = subRoom
    ? subRoom.description
    : selectedChannel === 'velum_lounge'
    ? 'Active broadcasting and peer lounge communication'
    : selectedChannel === 'secops'
    ? 'Confidential coordination with fellow active operations administrators group'
    : currentRoom?.permissions?.isPrivate
    ? 'Privately encrypted secure user discussion room'
    : 'Public user communication lounge';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn font-sans h-full">
      {/* Left Column: Coordinates / Channels Directory list */}
      <div
        className={`lg:col-span-4 space-y-4 ${
          announcementsMobileView === 'list' ? 'block w-full' : 'hidden lg:block'
        }`}
      >
        {/* Block 1: Executive coordinates */}
        <div className="bg-velum-800 border border-white-5 rounded-2xl p-4 shadow-xl">
          <span className="text-[9px] font-mono font-black text-accent uppercase tracking-widest block mb-4 border-b border-white-5 pb-2">
            // Executive Coordinates
          </span>

          <div className="space-y-2.5">
            {/* Lobby - Velum Lounge */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedChannel('velum_lounge');
                  setIsVelumExpanded(!isVelumExpanded);
                  setAnnouncementsMobileView('chat');
                }}
                className={`w-full flex items-center justify-between p-3.5 text-left rounded-xl transition cursor-pointer select-none border ${
                  selectedChannel === 'velum_lounge' ||
                  SUBLOUNGES.some((s) => s.id === selectedChannel)
                    ? 'bg-accent-10 text-text-primary border-accent-40 shadow-[0_4px_12px_rgba(212,131,106,0.05)]'
                    : 'bg-transparent border-transparent hover:bg-text-primary-2 text-text-secondary'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`p-2.5 rounded-xl ${
                      selectedChannel === 'velum_lounge' ||
                      SUBLOUNGES.some((s) => s.id === selectedChannel)
                        ? 'bg-accent-20 text-accent-hover'
                        : 'bg-text-primary-2 text-text-secondary'
                    } transition shrink-0`}
                  >
                    <Globe className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold tracking-wide text-text-primary truncate">
                        Velum Lounge
                      </span>
                      <span className="text-[8px] font-mono px-2 py-0.5 rounded-md bg-status-online/10 text-status-online font-extrabold uppercase tracking-wide shrink-0">
                        Lobby
                      </span>
                    </div>
                    <span className="text-[10px] text-text-secondary block leading-normal mt-1 font-medium font-sans truncate">
                      Standard network-wide communication coordinate.
                    </span>
                  </div>
                </div>
                <ChevronRight
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isVelumExpanded ? 'rotate-90' : ''
                  } text-text-secondary shrink-0`}
                />
              </button>

              {/* Sublounges list under Velum Lounge */}
              {isVelumExpanded && (
                <div className="pl-6 pt-1.5 space-y-1 border-l border-white-5 ml-5">
                  {SUBLOUNGES.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        setSelectedChannel(sub.id);
                        setAnnouncementsMobileView('chat');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-[11px] font-mono transition cursor-pointer select-none border border-transparent ${
                        selectedChannel === sub.id
                          ? 'bg-text-primary/10 text-text-primary font-bold'
                          : 'text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
                      }`}
                    >
                      <span>{sub.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* SecOps Coordinates */}
            <button
              type="button"
              onClick={() => {
                setSelectedChannel('secops');
                setAnnouncementsMobileView('chat');
              }}
              className={`w-full flex items-start gap-3.5 p-3.5 text-left rounded-xl transition cursor-pointer select-none border ${
                selectedChannel === 'secops'
                  ? 'bg-accent-10 text-text-primary border-accent-40 shadow-[0_4px_12px_rgba(212,131,106,0.05)]'
                  : 'bg-transparent border-transparent hover:bg-text-primary-2 text-text-secondary'
              }`}
            >
              <div
                className={`p-2.5 rounded-xl ${
                  selectedChannel === 'secops'
                    ? 'bg-accent-20 text-status-dnd'
                    : 'bg-text-primary-2 text-text-secondary'
                } mt-0.5 transition`}
              >
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-bold tracking-wide text-text-primary truncate">
                    Admins SecOps
                  </span>
                  <span className="text-[8px] font-mono px-2 py-0.5 rounded-md bg-status-dnd/10 text-status-dnd font-extrabold uppercase tracking-wide">
                    Group
                  </span>
                </div>
                <span className="text-[10px] text-text-secondary block leading-normal mt-1 font-medium font-sans">
                  Strictly restricted administrative group for Executives and SAs.
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Block 2: User Discussion Channels */}
        <div className="bg-velum-800 border border-white-5 rounded-2xl p-4 shadow-xl flex flex-col">
          <span className="text-[9px] font-mono font-black text-text-secondary uppercase tracking-widest block mb-4 border-b border-white-5 pb-2">
            // User Discussions
          </span>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {availableRooms.filter(
              (r) => r.room_id !== 'velum_lounge' && r.room_id !== 'secops' && !r.room_id.startsWith('dm_')
            ).length === 0 ? (
              <div className="text-center py-8 text-text-secondary font-mono text-[9px] uppercase leading-relaxed font-bold border border-dashed border-white-5 rounded-xl select-none">
                // No user channels launched //
              </div>
            ) : (
              availableRooms
                .filter(
                  (r) =>
                    r.room_id !== 'velum_lounge' && r.room_id !== 'secops' && !r.room_id.startsWith('dm_')
                )
                .map((room) => {
                  const isPrivate = room.permissions?.isPrivate;
                  const isCurrent = selectedChannel === room.room_id;
                  return (
                    <button
                      key={room.room_id}
                      type="button"
                      onClick={() => {
                        setSelectedChannel(room.room_id);
                        setAnnouncementsMobileView('chat');
                      }}
                      className={`w-full flex items-start gap-3 p-3 text-left rounded-xl transition cursor-pointer select-none border ${
                        isCurrent
                          ? 'bg-accent-10 text-text-primary border-accent-40'
                          : 'bg-transparent border-transparent hover:bg-text-primary-2 text-text-secondary'
                      }`}
                    >
                      <div
                        className={`p-2 rounded-lg mt-0.5 transition ${
                          isCurrent ? 'bg-accent-20 text-accent-hover' : 'bg-text-primary-2 text-text-secondary'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-bold truncate text-text-primary leading-none">
                            {room.name}
                          </span>
                          <span
                            className={`text-[7px] font-mono px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider ${
                              isPrivate
                                ? 'bg-status-dnd/10 text-status-dnd border border-rose-500/15'
                                : 'bg-status-online/10 text-status-online'
                            }`}
                          >
                            {isPrivate ? 'Private' : 'Public'}
                          </span>
                        </div>
                        <span className="text-[9px] text-text-secondary block truncate mt-1.5 font-mono">
                          ID: {room.room_id}
                        </span>
                      </div>
                    </button>
                  );
                })
            )}
          </div>
        </div>

        {/* Help guidelines */}
        <div className="bg-velum-800/40 border border-white-5 rounded-2xl p-4 text-xs leading-relaxed text-text-secondary font-sans space-y-2">
          <div className="flex items-center gap-2 text-text-primary font-black text-[9px] uppercase font-mono tracking-wider">
            <Info className="w-3.5 h-3.5 text-accent-hover flex-shrink-0" /> Rules of Engagement
          </div>
          <p className="text-[11px] text-text-secondary leading-normal">
            Administrative audit trails track room operations. You can monitor user-spawned rooms dynamically
            and post replies as administrator. All operations are signed securely.
          </p>
        </div>

        {/* Active Profile & Signout */}
        <div className="bg-velum-800 border border-white-5 rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8.5 h-8.5 rounded-xl bg-velum-800 flex items-center justify-center text-xs font-mono font-bold text-text-primary shrink-0">
              {user?.username?.replace('@', '').charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="min-w-0 leading-tight">
              <span className="text-xs font-bold block text-text-primary truncate">
                @{stripAt(user?.username || 'Admin')}
              </span>
              <span className="text-[8.5px] text-text-disabled block font-mono uppercase truncate">
                {adminRole === 'SUPPORT_ADMIN' ? 'SUPPORT OPERATIONS' : 'EXECUTIVE CONTROLS'}
              </span>
            </div>
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="p-2 border border-red-500/20 bg-status-dnd/5 hover:bg-status-dnd/10 text-red-400 hover:text-red-300 rounded-xl transition cursor-pointer"
              title="Logout Session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Right Column: Live Chat Desk */}
      <div
        className={`lg:col-span-8 flex flex-col h-[560px] rounded-2xl border border-white-5 bg-velum-800 overflow-hidden shadow-2xl ${
          announcementsMobileView === 'chat' ? 'flex w-full' : 'hidden lg:flex'
        }`}
      >
        {/* Thread Header */}
        <div className="px-5 py-4 bg-velum-850 border-b border-white-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back button on mobile */}
            <button
              type="button"
              onClick={() => setAnnouncementsMobileView('list')}
              className="lg:hidden p-2 rounded-xl bg-text-primary-2 border border-white-5 text-text-secondary hover:text-text-primary transition cursor-pointer flex items-center justify-center active:scale-95"
              title="Back to channels"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div>
              <h4 className="text-xs font-black uppercase text-text-primary tracking-wider flex items-center gap-1.5">
                {displayHeaderTitle}
                <span className="w-1.5 h-1.5 rounded-full bg-status-online animate-pulse ml-0.5" />
              </h4>
              <p className="text-[10px] text-text-secondary font-medium mt-0.5">{displayHeaderDesc}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[8.5px] font-mono bg-velum-750 border border-white-5 rounded-lg px-2.5 py-1 text-text-secondary uppercase tracking-widest font-black flex items-center gap-1.5 select-all">
              ADDR: <span className="text-accent-hover">{selectedChannel}</span>
            </span>
          </div>
        </div>

        {/* Message Feed Scroll Area */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-velum-900/20 scrollbar-thin">
          {channelMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="p-3 bg-text-primary-2 border border-white-5 rounded-2xl mb-3">
                <MessageSquare className="w-6 h-6 text-text-secondary stroke-[1.5]" />
              </div>
              <p className="text-[9px] font-mono text-text-secondary uppercase select-none tracking-widest text-center">
                // No active records synchronized in local stream //
              </p>
            </div>
          ) : (
            channelMessages.map((msg, index) => {
              const isSystemBroadcast = msg.user_id === 999;
              const broadcastMatch = isSystemBroadcast
                ? msg.content.match(/^\[BROADCAST FROM ([^\]]+)\]:\s*/i)
                : null;
              const senderSignature = broadcastMatch ? broadcastMatch[1] : null;

              const activeContent = decryptMessage(
                msg.content || '',
                msg.room_id || selectedChannel,
                msg.is_encrypted || msg.isEncrypted
              );

              const cleanedContent = isSystemBroadcast
                ? activeContent
                    .replace(/^\[BROADCAST FROM [^\]]+\]:\s*/i, '')
                    .replace(/^\[DIRECT SECURITY WIRE\]\s*/i, '')
                : activeContent;

              let isSpecialProfile = false;
              let displayProfileName = msg.username ? stripAt(msg.username) : `User #${msg.user_id}`;
              let roleBadgeText = '';
              let customBadgeClass = '';
              let customBubbleClass = '';

              const lowercaseUsername = msg.username?.toLowerCase() || '';
              const isSupportAdmin =
                lowercaseUsername.startsWith('sa-') || lowercaseUsername.startsWith('@sa-');

              if (
                msg.user_id === 1 ||
                lowercaseUsername === 'midnight' ||
                lowercaseUsername === 'cli-exec' ||
                displayProfileName === 'Midnight' ||
                displayProfileName === 'cli-exec'
              ) {
                isSpecialProfile = true;
                displayProfileName = 'MIDNIGHT (executive)';
                roleBadgeText = 'Executive';
                customBadgeClass = 'text-accent bg-accent-10 border-l border-accent-40';
                customBubbleClass =
                  'bg-accent-20 border border-accent-40 text-text-primary rounded-2xl rounded-tl-none shadow-md';
              } else if (
                msg.user_id === 999 ||
                lowercaseUsername === 'velum' ||
                lowercaseUsername === 'velum-msg' ||
                displayProfileName === 'Velum' ||
                displayProfileName === 'velum-msg'
              ) {
                isSpecialProfile = true;
                displayProfileName = 'VELUM';
                roleBadgeText = 'System';
                customBadgeClass = 'text-status-online bg-status-online/10 border-l border-emerald-500/45';
                customBubbleClass =
                  'bg-emerald-950/45 border border-emerald-500/35 text-emerald-100 rounded-2xl rounded-tl-none shadow-[0_4px_12px_rgba(16,185,129,0.03)]';
              } else if (isSupportAdmin) {
                isSpecialProfile = true;
                displayProfileName = displayProfileName.includes('(')
                  ? displayProfileName
                  : `${displayProfileName} (Support)`;
                roleBadgeText = 'Support Admin';
                customBadgeClass =
                  'text-accent-secondary bg-accent-secondary-10 border-l border-accent-secondary-20';
                customBubbleClass =
                  'bg-accent-secondary-10 border border-accent-secondary-20 border-l-[3px] border-l-accent-secondary text-text-primary shadow-md';
              }

              return (
                <div key={msg.message_id || index} className="w-full">
                  {isSystemBroadcast ? (
                    <div className="mx-auto max-w-xl bg-velum-800 border border-white-5 border-l-[4px] border-l-accent rounded-xl p-4 shadow-xl select-none transition hover:border-white-10">
                      <div className="flex items-center justify-between gap-3 border-b border-white-5 pb-2.5 mb-2.5">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-accent-20 border border-accent-20 text-[8.5px] font-mono font-black text-accent uppercase tracking-wider">
                          <Megaphone className="w-2.5 h-2.5 text-accent" /> OFFICIAL DISPATCH
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-mono text-text-secondary uppercase tracking-widest font-extrabold flex items-center gap-1">
                            Operator:{' '}
                            <span className="text-text-primary font-bold">
                              @{senderSignature || 'System Admin'}
                            </span>
                            <BadgeCheck className="w-3.5 h-3.5 text-sky-400 fill-sky-400 ml-0.5 shrink-0" />
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-text-primary leading-relaxed font-sans font-medium whitespace-pre-wrap">
                        {cleanedContent}
                      </p>
                      <div className="flex items-center justify-between border-t border-white-5 pt-2 mt-2.5">
                        <span className="text-[8px] font-mono text-accent/60 font-bold uppercase tracking-wider">
                          SECURE BROADCAST ENVELOPE
                        </span>
                        <span className="text-[8.5px] font-mono text-text-secondary font-medium">
                          {new Date(msg.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`flex flex-col max-w-[85%] ${
                        msg.username === user?.username
                          ? 'ml-auto text-right items-end'
                          : 'mr-auto text-left items-start'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5 text-[9.5px] font-mono text-text-secondary select-none">
                        {msg.username === user?.username ? (
                          <>
                            <span>
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span className="font-extrabold text-accent">@you</span>
                          </>
                        ) : (
                          <>
                            <span className="font-extrabold text-text-secondary">@{displayProfileName}</span>
                            {isSpecialProfile && (
                              <>
                                <span
                                  className={`text-[7px] font-mono px-1.5 py-0.2 rounded font-black uppercase ${customBadgeClass}`}
                                >
                                  {roleBadgeText}
                                </span>
                                <BadgeCheck className="w-4 h-4 text-sky-400 fill-sky-400 shrink-0 inline-block align-middle ml-0.5" />
                              </>
                            )}
                            <span>•</span>
                            <span>
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </>
                        )}
                      </div>

                      <div
                        className={`p-3.5 rounded-2xl text-[11.5px] font-sans leading-relaxed whitespace-pre-wrap ${
                          isSpecialProfile
                            ? customBubbleClass
                            : msg.username === user?.username
                            ? 'bg-accent-10 border border-accent-20 border-r-[3px] border-r-accent text-text-primary shadow-lg shadow-black/10'
                            : 'bg-velum-800 border border-white-5 text-text-primary shadow-md'
                        }`}
                      >
                        <p className="select-text">{cleanedContent}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Input Form base with Segmented Transmission Selector */}
        <form
          onSubmit={handleSendChannelMessage}
          className="p-4 bg-velum-850 border-t border-white-5 space-y-3"
        >
          {selectedChannel === 'secops' && (
            <div className="bg-velum-800 border border-white-5 p-1.5 rounded-xl flex items-center justify-between max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setBroadcastAlert(false)}
                className={`flex-1 py-2 text-[9px] font-mono font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                  !broadcastAlert
                    ? 'bg-velum-700 text-text-primary border-white-5 shadow'
                    : 'bg-transparent text-text-secondary border-transparent hover:text-text-primary'
                }`}
              >
                <MessageSquare className="w-3 h-3" />
                Standard Message
              </button>
              <button
                type="button"
                onClick={() => setBroadcastAlert(true)}
                className={`flex-1 py-2 text-[9px] font-mono font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                  broadcastAlert
                    ? 'bg-status-dnd/15 border-status-dnd/30 text-status-dnd'
                    : 'bg-transparent text-text-secondary border-transparent hover:text-text-secondary'
                }`}
              >
                <Megaphone className="w-3 h-3" />
                Hot Broadcast Alert
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={newChannelMsg}
                onChange={(e) => setNewChannelMsg(e.target.value)}
                placeholder={
                  selectedChannel === 'secops'
                    ? broadcastAlert
                      ? '/📢 Write system broadcast bulletin to dispatch...'
                      : '/🔒 Send secure executive coordination log entry...'
                    : selectedChannel === 'velum_lounge'
                    ? '/✍️ Compose global lounge message...'
                    : `/🔐 Respond to #${currentRoom?.name || selectedChannel} as administrator...`
                }
                disabled={isPostingMsg}
                className="w-full text-xs font-mono rounded-xl pl-4 pr-10 py-3.5 outline-none transition bg-velum-800 border border-white-5 text-text-primary focus:border-accent-40 focus:ring-1 focus:ring-accent-20 placeholder:text-text-disabled"
              />
              {broadcastAlert && (
                <span className="absolute right-3.5 top-3.5 flex h-2 w-2 select-none">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isPostingMsg || !newChannelMsg.trim()}
              className="px-5 bg-accent hover:bg-accent disabled:opacity-40 disabled:hover:bg-accent text-text-primary flex items-center justify-center rounded-xl transition border-0 cursor-pointer active:scale-95 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
