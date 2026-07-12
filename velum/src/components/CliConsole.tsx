import React, { useState, useRef, useEffect } from 'react';
import { 
  Terminal, MessageSquare, Globe, ShieldAlert, Send, 
  Megaphone, RefreshCw, Info, CheckCircle, Layers, Radio,
  ShieldCheck, Crown, Bot, BadgeCheck, ChevronRight, LogOut
} from 'lucide-react';

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
  { id: 'feedback', name: '# feedback', description: 'Share your feedback' }
];
import { decryptE2E } from '../types';
import logoSvg from '../assets/logo.svg?raw';

interface CliConsoleProps {
  adminId: number;
  onLogout?: () => void;
}

export default function CliConsole({ adminId, onLogout }: CliConsoleProps) {
  // Admin profiles with professional styling
  const adminProfiles = {
    1: {
      username: 'cli-exec',
      displayName: '[System] CLI Executive',
      role: 'CLI_ADMIN',
      roleDisplay: 'System Execution Runner',
      bio: "Purpose: Automated system environment for command-line script executions and deployments.\nPrivileges: Root / Low-level runtime access.\nOrchestration: Automated via pipeline hooks and scheduled CRON instances.\nAdministrative Contact: DevOps Core Platform Architecture Team.",
      avatar: null,
      bubbleColor: 'bg-accent/10 border-white-5',
      textColor: 'text-white',
      verified: true,
      badgeColor: 'text-accent'
    },
    2: {
      username: 'login-admin',
      displayName: '[Security] Login Administrator',
      role: 'LOGIN_ADMIN',
      roleDisplay: 'IAM Guard Service',
      bio: "Purpose: Oversees authentication layers, multi-factor tokens, and account isolation events.\nPrivileges: Directory write-access and identity scope moderation.\nBehavior: Broadcasts secure authentication payloads and anomalies.\nAdministrative Contact: SecOps Identity & Access Management.",
      avatar: null,
      bubbleColor: 'bg-accent-secondary-10 border-white-5',
      textColor: 'text-white',
      verified: true,
      badgeColor: 'text-accent'
    },
    999: {
      username: 'velum-msg',
      displayName: '[Broadcast] Velum Message Bot',
      role: 'SYSTEM',
      roleDisplay: 'Global System Broadcast',
      bio: "Purpose: Dedicated engine for system-wide notices, critical updates, and platform health.\nPrivileges: Inbound pipeline-only. Discards direct individual messages.\nBehavior: Outbound multi-channel broadcast layer.\nAdministrative Contact: Platform Infrastructure & Systems Communications.",
      avatar: null,
      bubbleColor: 'bg-status-online/10 border-white-5',
      textColor: 'text-white',
      verified: true,
      badgeColor: 'text-sky-400'
    }
  };

  // Mobile tab switcher state
  const [activeTab, setActiveTab] = useState<'terminal' | 'communications'>('terminal');

  // Executive Avatar upload state
  const [avatar, setAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch administrator profile avatar on mount
  useEffect(() => {
    if (adminId) {
      const sId = sessionStorage.getItem('velum-sessionId') || '';
      fetch(`/api/user/${adminId}/profile`, {
        headers: {
          'Authorization': `Bearer ${sId}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.avatar && data.avatar !== 'emerald' && data.avatar !== 'user') {
            setAvatar(data.avatar);
          }
        })
        .catch(() => {});
    }
  }, [adminId]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Failed: Avatar must be an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Failed: Avatar file size exceeds 2 MB.');
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binaryStr = '';
      for (let i = 0; i < bytes.length; i++) {
        binaryStr += String.fromCharCode(bytes[i]);
      }
      const rawDataUrl = `data:${file.type};base64,${btoa(binaryStr)}`;
      
      const img = new Image();
      img.src = rawDataUrl;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 128, 128);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

          const sId = sessionStorage.getItem('velum-sessionId') || '';
          const res = await fetch('/api/user/profile', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sId}`
            },
            body: JSON.stringify({
              userId: adminId,
              avatar: dataUrl
            })
          });
          if (res.ok) {
            setAvatar(dataUrl);
            alert('Executive avatar uploaded successfully.');
          } else {
            alert('Failed to save avatar.');
          }
        }
      };
    } catch {
      alert('Upload failed.');
    }
  };

  // Terminal Console State
  const [inputVal, setInputVal] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<Array<{ text: string; type: 'cmd' | 'resp' | 'error' }>>([
    { text: 'VELUM ADMIN INTERACTIVE CONSOLE\nInitialize command gateway...\nType "help" to display admin commands.', type: 'resp' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const terminalScrollRef = useRef<HTMLDivElement>(null);

  // Communications Workspace State (Announcements & Channels Monitor)
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('velum_lounge');
  const [channelMessages, setChannelMessages] = useState<any[]>([]);
  const [newChannelMsg, setNewChannelMsg] = useState('');
  const [isPostingMsg, setIsPostingMsg] = useState(false);
  const [broadcastAlert, setBroadcastAlert] = useState(false);
  const [isVelumExpanded, setIsVelumExpanded] = useState(true);
  const [chanMobileView, setChanMobileView] = useState<'list' | 'chat'>('list');
  const communicationsScrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom helper for terminal
  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  // Scroll to bottom helper for selected room chat feed
  useEffect(() => {
    if (communicationsScrollRef.current) {
      communicationsScrollRef.current.scrollTop = communicationsScrollRef.current.scrollHeight;
    }
  }, [channelMessages]);

  const getSessionId = (): string => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem('velum-sessionId') || '';
  };

  const getAuthHeaders = () => {
    const token = getSessionId();
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'x-session-id': token
    };
  };

  // Fetch Available Rooms
  const fetchAvailableRooms = async () => {
    try {
      const res = await fetch('/api/rooms', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableRooms(data || []);
      }
    } catch (err) {
      console.error('Error fetching rooms:', err);
    }
  };

  // Fetch Channel Messages
  const fetchChannelMessages = async (roomId: string) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/messages`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setChannelMessages(data || []);
      }
    } catch (err) {
      console.error('Error fetching channel messages:', err);
    }
  };

  // Synchronized pooling for rooms and channel logs
  useEffect(() => {
    fetchAvailableRooms();
    fetchChannelMessages(selectedChannel);

    const interval = setInterval(() => {
      fetchAvailableRooms();
      fetchChannelMessages(selectedChannel);
    }, 4000);

    return () => clearInterval(interval);
  }, [selectedChannel]);

  useEffect(() => {
    setBroadcastAlert(false);
  }, [selectedChannel]);

  // Execute terminal CLI command
  const executeCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const command = inputVal.trim();
    if (!command) return;

    if (command === 'clear' || command === 'cls') {
      setTerminalLogs([]);
      setInputVal('');
      return;
    }

    setTerminalLogs(prev => [...prev, { text: `admin@velum:~$ ${command}`, type: 'cmd' }]);
    setInputVal('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/cli/exec', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ adminId, command })
      });

      if (res.status === 401 || res.status === 403) {
        setTerminalLogs(prev => [...prev, { text: 'FAIL: Terminal authority credentials invalid or expired. Re-authenticate.', type: 'error' }]);
        setTimeout(() => {
          sessionStorage.clear();
          window.location.reload();
        }, 1500);
        return;
      }

      const data = await res.json();
      if (res.ok) {
        if (data.output === 'CLEAR_TERMINAL_SCREEN') {
          setTerminalLogs([]);
        } else {
          setTerminalLogs(prev => [...prev, { text: data.output, type: 'resp' }]);
        }
      } else {
        setTerminalLogs(prev => [...prev, { text: `FAIL: ${data.error}`, type: 'error' }]);
      }
    } catch (err) {
      setTerminalLogs(prev => [...prev, { text: 'FAIL: Server-link connection terminated.', type: 'error' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Send Direct administrative channel message / broadcast
  const handleSendChannelMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelMsg.trim()) return;

    setIsPostingMsg(true);
    try {
      if (selectedChannel === 'secops' && broadcastAlert) {
        const res = await fetch('/api/admin/broadcast', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ content: newChannelMsg })
        });
        if (res.ok) {
          setNewChannelMsg('');
          setBroadcastAlert(false);
          fetchChannelMessages(selectedChannel);
        } else {
          const err = await res.json();
          setTerminalLogs(prev => [...prev, { text: `Dispatch error: ${err.error || 'Failed broadcast'}`, type: 'error' }]);
        }
      } else {
        const res = await fetch(`/api/rooms/${selectedChannel}/messages`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            content: newChannelMsg,
            is_encrypted: false
          })
        });
        if (res.ok) {
          setNewChannelMsg('');
          fetchChannelMessages(selectedChannel);
        } else {
          const err = await res.json();
          setTerminalLogs(prev => [...prev, { text: `Dispatch error: ${err.error || 'Failed message dispatch'}`, type: 'error' }]);
        }
      }
    } catch (err) {
      console.error('Communication failure sending message:', err);
    } finally {
      setIsPostingMsg(false);
    }
  };

  // Active channel context
  const currentRoom = availableRooms.find(r => r.room_id === selectedChannel);
  const subRoom = SUBLOUNGES.find(s => s.id === selectedChannel);
  const displayHeaderTitle = subRoom
    ? `Velum Lounge ${subRoom.name}`
    : currentRoom 
    ? (currentRoom.name === 'velum_lounge' || currentRoom.room_id === 'velum_lounge' ? 'Velum Lounge' : currentRoom.name)
    : selectedChannel === 'secops' 
    ? 'Admins SecOps Lounge' 
    : `Room #${selectedChannel}`;

  const displayHeaderDesc = subRoom
    ? subRoom.description
    : selectedChannel === 'velum_lounge'
    ? 'Standard network-wide communication coordinate'
    : selectedChannel === 'secops'
    ? 'Restricted administrative SecOps coordinate'
    : currentRoom?.permissions?.isPrivate
    ? 'Encrypted dynamic private secure room'
    : 'Public dynamic team room channel';

  return (
    <div className="flex flex-col flex-1 h-full bg-velum-900 border border-white-5 rounded-2xl overflow-hidden font-sans shadow-2xl max-w-7xl mx-auto w-full">
      {/* Root Operational Control Desk Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-white-5 bg-velum-800">
        <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
          <div className="p-2 md:p-2.5 rounded-xl bg-accent/15 text-accent border border-accent/20 shrink-0">
            <Layers className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs md:text-sm font-semibold text-text-primary uppercase tracking-[0.1em] md:tracking-[0.15em] font-sans truncate">Velum Ops</h2>
            <span className="text-[9px] md:text-[10px] font-sans text-text-secondary font-medium uppercase tracking-wider mt-0.5 block truncate">
              Role: <span className="text-accent font-semibold">{adminProfiles[adminId as keyof typeof adminProfiles]?.roleDisplay || 'Operator'}</span>
            </span>
          </div>
        </div>

        {/* Current Admin Profile Badge */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {adminId === 999 ? (
            <div className="w-8 h-8 rounded-lg bg-velum-850/80 border border-accent/30 flex items-center justify-center">
              <div className="w-5 h-5 [&>svg]:w-full [&>svg]:h-full [&_path:first-child]:stroke-[2.5] [&_path:last-child]:stroke-[1.5]" dangerouslySetInnerHTML={{ __html: logoSvg }} />
            </div>
          ) : (
            <div 
              className="relative group cursor-pointer shrink-0" 
              onClick={() => fileInputRef.current?.click()}
              title="Upload custom executive avatar"
            >
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarUpload}
                accept="image/*"
                className="hidden"
              />
              {avatar ? (
                <img 
                  src={avatar} 
                  alt="Executive avatar" 
                  className="w-8 h-8 rounded-lg object-cover border border-white-10 group-hover:border-accent transition duration-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-[10px] font-black text-velum-900 uppercase group-hover:bg-accent-hover transition duration-200">
                  {adminProfiles[adminId as keyof typeof adminProfiles]?.username?.slice(0, 2).toUpperCase() || 'OP'}
                </div>
              )}
              {/* Interactive prompt overlay */}
              <div className="absolute inset-0 bg-black/75 rounded-lg opacity-0 group-hover:opacity-100 transition duration-200 flex items-center justify-center">
                <span className="text-[7.5px] font-bold text-white uppercase tracking-widest leading-none text-center">UP</span>
              </div>
            </div>
          )}
          <div className="hidden sm:block text-right font-sans">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-[10px] font-bold text-white">{adminProfiles[adminId as keyof typeof adminProfiles]?.displayName || 'Admin'}</span>
              {adminProfiles[adminId as keyof typeof adminProfiles]?.verified && (
                <BadgeCheck className="w-4 h-4 text-sky-400 fill-sky-400 shrink-0" />
              )}
            </div>
            <span className={`text-[8px] uppercase tracking-wider font-semibold ${adminProfiles[adminId as keyof typeof adminProfiles]?.badgeColor || 'text-text-secondary'}`}>
              {adminProfiles[adminId as keyof typeof adminProfiles]?.roleDisplay || 'Administrator'}
            </span>
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="ml-2 md:ml-3 p-1.5 md:px-3 md:py-1.5 text-[9px] font-sans font-semibold uppercase tracking-wider rounded-lg border border-red-500/20 bg-status-dnd/5 hover:bg-status-dnd/10 text-red-400 hover:text-red-300 transition cursor-pointer flex items-center justify-center"
              title="Logout Session"
            >
              <span className="hidden md:inline">Logout</span>
              <LogOut className="w-3.5 h-3.5 md:hidden" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs configuration for mobile screens */}
      <div className="flex border-b border-white-5 bg-velum-800 lg:hidden">
        <button
          type="button"
          onClick={() => setActiveTab('terminal')}
          className={`flex-1 py-3 text-center text-xs font-semibold font-sans uppercase tracking-wider border-b-2 transition ${
            activeTab === 'terminal' 
              ? 'border-accent text-accent bg-accent/5' 
              : 'border-transparent text-text-secondary hover:text-white'
          }`}
        >
          Terminal Console (CLI)
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('communications');
            setChanMobileView('list');
          }}
          className={`flex-1 py-3 text-center text-xs font-semibold font-sans uppercase tracking-wider border-b-2 transition ${
            activeTab === 'communications' 
              ? 'border-accent text-accent bg-accent/5' 
              : 'border-transparent text-text-secondary hover:text-white'
          }`}
        >
          Channels Monitor
        </button>
      </div>

      {/* Main Workspace layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-velum-900">
        
        {/* Workspace A: Announcements & Channels Monitor (Left-pane layout on desktop) */}
        <div className={`lg:col-span-6 min-w-0 flex flex-col border-r border-white-5 h-full overflow-hidden ${
          activeTab === 'communications' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Header block with channels summary */}
          <div className="p-4 bg-velum-800 border-b border-white-5 flex items-center justify-between">
            <span className="text-[11px] font-sans font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-accent" /> Operational Directory ({availableRooms.filter((room: any) => room.room_id === 'velum_lounge' || room.room_id === 'secops').length})
            </span>
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden bg-velum-900">
            {/* Column A1: Channels list */}
            <div className={`lg:col-span-1 border-r border-white-5 overflow-y-auto p-2 space-y-2 bg-velum-900 ${chanMobileView === 'list' ? 'block' : 'hidden lg:block'}`}>
              {/* Velum Lounge Collapsible Container */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChannel('velum_lounge');
                    setIsVelumExpanded(!isVelumExpanded);
                    setChanMobileView('chat');
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded text-left transition select-none tracking-wide text-xs ${
                    selectedChannel === 'velum_lounge' || SUBLOUNGES.some(s => s.id === selectedChannel)
                      ? 'bg-accent/10 text-text-primary border border-accent/30 font-semibold' 
                      : 'text-text-secondary hover:bg-text-primary/[0.02] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-accent" />
                    <span className="font-bold">Velum Lounge</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isVelumExpanded ? 'rotate-90' : ''}`} />
                </button>

                {isVelumExpanded && (
                  <div className="pl-3 space-y-0.5 border-l border-white-5 ml-4">
                    {SUBLOUNGES.map(sub => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          setSelectedChannel(sub.id);
                          setChanMobileView('chat');
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition text-[10px] font-mono select-none border border-transparent ${
                          selectedChannel === sub.id
                            ? 'bg-text-primary/10 text-white font-bold'
                            : 'text-text-secondary hover:text-text-primary hover:bg-text-primary/[0.01]'
                        }`}
                      >
                        <span>{sub.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* SecOps Coordinator */}
              <button
                type="button"
                onClick={() => {
                  setSelectedChannel('secops');
                  setChanMobileView('chat');
                }}
                className={`w-full flex flex-col p-2.5 rounded text-left transition select-none tracking-wide text-xs ${
                  selectedChannel === 'secops' 
                    ? 'bg-accent/10 text-text-primary border border-accent/30 font-semibold' 
                    : 'text-text-secondary hover:bg-text-primary/[0.02] border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between w-full gap-1">
                  <span className="truncate max-w-[80px] block font-bold">Admins SecOps</span>
                  <span className="text-[7px] font-sans px-1 py-0.2 rounded uppercase bg-accent/10 text-accent border border-accent/20">
                    sec
                  </span>
                </div>
                <span className="text-[8.5px] font-mono text-text-secondary/40 block mt-1 truncate">ID: secops</span>
              </button>
            </div>

            {/* Column A2: Selected Channel Stream */}
            <div className={`lg:col-span-2 flex flex-col h-full bg-velum-900 overflow-hidden ${chanMobileView === 'chat' ? 'flex' : 'hidden lg:flex'}`}>
              {/* Channel thread header details */}
              <div className="p-3 bg-velum-800/40 border-b border-white-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setChanMobileView('list')}
                  className="lg:hidden p-1 rounded hover:bg-white/5 text-text-secondary hover:text-white transition"
                  title="Back to channels"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                <div className="min-w-0 flex-1 leading-tight">
                  <span className="text-[11px] font-semibold text-text-primary block truncate uppercase tracking-widest">{displayHeaderTitle}</span>
                  <span className="text-[9.5px] text-text-secondary/60 block truncate mt-0.5">{displayHeaderDesc}</span>
                </div>
              </div>

              {/* Chat flow message display */}
              <div 
                ref={communicationsScrollRef}
                className="flex-1 p-3 overflow-y-auto space-y-4 min-h-[160px] bg-black/10"
              >
                {channelMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <MessageSquare className="w-7 h-7 text-text-secondary/20 mb-2 stroke-[1.2]" />
                    <p className="text-[10px] font-sans text-text-secondary/40 uppercase tracking-widest block leading-normal">// Thread empty //</p>
                  </div>
                ) : (
                  channelMessages.map((msg, index) => {
                    const adminProfile = adminProfiles[msg.user_id as keyof typeof adminProfiles];
                    const isAdmin = adminProfile && adminProfile.role !== 'SYSTEM';
                    const isOwnMessage = msg.user_id === adminId;

                    return (
                      <div 
                        key={msg.message_id || index} 
                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-xs md:max-w-md rounded-2xl p-3 md:p-4 space-y-2 border ${
                          adminProfile 
                            ? adminProfile.bubbleColor 
                            : 'bg-text-primary/[0.015] border-white-5'
                        } ${adminProfile?.role === 'SYSTEM' ? 'mx-auto w-full' : ''}`}>
                          {/* Profile Header */}
                          {adminProfile && (
                            <div className="flex items-center gap-2 border-b border-white/20 pb-2">
                              {adminProfile.username === 'velum-msg' ? (
                                <div className="w-6 h-6 rounded-lg bg-velum-850 border border-accent/30 flex items-center justify-center shrink-0">
                                  <div className="w-3.5 h-3.5 [&>svg]:w-full [&>svg]:h-full [&_path:first-child]:stroke-[2.5] [&_path:last-child]:stroke-[1.5]" dangerouslySetInnerHTML={{ __html: logoSvg }} />
                                </div>
                              ) : adminProfile.avatar ? (
                                <img 
                                  src={adminProfile.avatar} 
                                  alt="" 
                                  className="w-6 h-6 rounded-lg object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-lg bg-text-primary/20 flex items-center justify-center shrink-0">
                                  <div className="w-3.5 h-3.5 [&>svg]:w-full [&>svg]:h-full [&_path]:stroke-current text-white" dangerouslySetInnerHTML={{ __html: logoSvg }} />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-white truncate">
                                    {adminProfile.displayName}
                                  </span>
                                  {adminProfile.verified && (
                                    <BadgeCheck className="w-4 h-4 text-sky-400 fill-sky-400 shrink-0" />
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[8px] uppercase tracking-wider font-semibold text-white/80">
                                    {adminProfile.roleDisplay}
                                  </span>
                                  {adminProfile.role === 'CLI_ADMIN' && (
                                    <Crown className="w-2.5 h-2.5 text-white" />
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Message Content */}
                          <p className="text-[11px] leading-relaxed font-sans break-words text-white">
                            {msg.content && (msg.is_encrypted || msg.isEncrypted || msg.content.startsWith('VEL_E2EE[')) 
                              ? decryptE2E(
                                  msg.content.startsWith('VEL_E2EE[') ? msg.content.substring(9, msg.content.length - 1) : msg.content, 
                                  'VELUM_E2EE_' + (msg.room_id || selectedChannel)
                                ) 
                              : msg.content}
                          </p>
                          
                          {/* Timestamp */}
                          <div className="flex justify-between items-center text-[8px] uppercase tracking-wider text-white/60 font-mono font-black">
                            <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                            {adminProfile && <span>{adminProfile.role}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Secure message composer */}
              <form onSubmit={handleSendChannelMessage} className="p-3 bg-velum-800 border-t border-white-5">
                {selectedChannel === 'secops' && (
                  <div className="flex items-center gap-2 mb-2 px-1.5 py-1 bg-text-primary/[0.01] rounded border border-white-5">
                    <input
                      type="checkbox"
                      id="cliBroadcastCheckbox"
                      checked={broadcastAlert}
                      onChange={(e) => setBroadcastAlert(e.target.checked)}
                      className="w-3 h-3 rounded border-velum-600 bg-velum-800 text-accent focus:ring-0"
                    />
                    <label htmlFor="cliBroadcastCheckbox" className="text-[9px] font-semibold text-accent select-none cursor-pointer uppercase tracking-wider">
                      Transmit as Announcement Broadcast
                    </label>
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newChannelMsg}
                    onChange={(e) => setNewChannelMsg(e.target.value)}
                    placeholder={
                      selectedChannel === 'secops' 
                        ? (broadcastAlert ? "Enter announcement dispatch..." : "Post response to Admins SecOps...")
                        : `Post response to #${displayHeaderTitle}...`
                    }
                    disabled={isPostingMsg}
                    className="flex-1 text-[11px] bg-velum-900 text-text-primary border border-white-10 rounded px-2.5 py-1.5 focus:outline-none focus:border-accent/60 font-sans"
                  />
                  
                  <button
                    type="submit"
                    disabled={isPostingMsg || !newChannelMsg.trim()}
                    className="px-3 bg-accent hover:bg-accent-hover disabled:opacity-40 text-velum-900 flex items-center justify-center rounded transition border-0 cursor-pointer font-semibold"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Workspace B: Interactive Keyboard Terminal (Right-pane layout on desktop) */}
        <div className={`lg:col-span-6 min-w-0 flex flex-col h-full overflow-hidden ${
          activeTab === 'terminal' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Console layout header info */}
          <div className="p-4 bg-velum-800 border-b border-white-5 flex items-center justify-between">
            <span className="text-[11px] font-sans font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-accent" /> Dynamic Command Console
            </span>
            <div className="flex items-center gap-2 select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-status-online animate-pulse" />
              <span className="text-[9.5px] font-sans text-emerald-400 font-semibold uppercase tracking-widest">GATEWAY STABLE</span>
            </div>
          </div>

          {/* Guidelines info card for the operator */}
          <div className="p-3 bg-velum-900/20 border-b border-white-5 text-[10.5px] text-text-secondary/70 font-sans leading-relaxed select-none">
            Type <span className="text-accent hover:underline cursor-pointer font-medium" onClick={() => setInputVal('help')}>"help"</span> for the complete direct operation indexes or <span className="text-accent hover:underline cursor-pointer font-medium" onClick={() => setInputVal('status')}>"status"</span> to read system metrics.
          </div>

          {/* Terminal stream log output */}
          <div 
            ref={terminalScrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs text-text-primary bg-black/10 min-h-[300px]"
          >
            {terminalLogs.map((log, idx) => (
              <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                {log.type === 'cmd' ? (
                  <span className="text-accent font-semibold">{log.text}</span>
                ) : log.type === 'error' ? (
                  <span className="text-rose-450 font-bold block bg-rose-950/25 p-2 rounded border border-rose-900/10">{log.text}</span>
                ) : (
                  <span className="text-text-primary opacity-95">{log.text}</span>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex items-center gap-2 text-accent text-[11px] font-mono animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing administrative dispatch signal...</span>
              </div>
            )}
          </div>

          {/* Interactive keyboard input */}
          <form onSubmit={executeCommand} className="p-3 bg-velum-800 border-t border-white-5 flex items-center gap-2.5 pb-4">
            <label htmlFor="terminal-input" className="text-accent font-medium font-mono text-xs select-none">
              admin@velum-server:~#
            </label>
            <input
              id="terminal-input"
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder=""
              disabled={isLoading}
              className="flex-1 bg-transparent text-text-primary font-mono text-xs border-none outline-none focus:ring-0"
              autoFocus
              autoComplete="off"
            />
          </form>
        </div>

      </div>
    </div>
  );
}
