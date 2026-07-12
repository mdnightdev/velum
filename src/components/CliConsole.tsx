import React, { useState, useRef, useEffect } from 'react';
import { 
  Terminal, RefreshCw, Layers, BadgeCheck, LogOut
} from 'lucide-react';
import logoSvg from '../assets/logo.svg?raw';

interface CliConsoleProps {
  adminId: number;
  onLogout?: () => void;
  onSwitchToGui?: () => void;
}

export default function CliConsole({ adminId, onLogout, onSwitchToGui }: CliConsoleProps) {
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

  // Scroll to bottom helper for terminal
  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminalLogs]);

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

  return (
    <div className="flex flex-col flex-1 h-full bg-velum-900 border border-white-5 rounded-2xl overflow-hidden font-sans shadow-2xl max-w-7xl mx-auto w-full">
      {/* Root Operational Control Desk Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-white-5 bg-velum-800">
        <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
          <div className="p-2 md:p-2.5 rounded-xl bg-accent/15 text-accent border border-accent/20 shrink-0">
            <Layers className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs md:text-sm font-semibold text-text-primary uppercase tracking-[0.1em] md:tracking-[0.15em] font-sans truncate">Velum Console</h2>
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

          {onSwitchToGui && (
            <button
              type="button"
              onClick={onSwitchToGui}
              className="ml-2 md:ml-3 p-1.5 md:px-3 md:py-1.5 text-[9px] font-sans font-bold uppercase tracking-wider rounded-lg border border-accent/20 bg-accent/5 hover:bg-accent/15 text-accent transition cursor-pointer flex items-center justify-center gap-1.5"
              title="Switch to GUI Control Panel"
            >
              <span>Control Panel</span>
            </button>
          )}

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

      {/* Main Workspace layout */}
      <div className="flex-1 flex flex-col overflow-hidden bg-velum-900">
        {/* Workspace: Interactive Keyboard Terminal */}
        <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
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
