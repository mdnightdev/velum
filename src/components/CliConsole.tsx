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
      bio: "Purpose: Oversees authentication layers, multi-factor tokens, and account isolation events.\nPrivileges: Directory write-access and identity scope moderation.\nBehavior: Broadcasts secure authentication payloads and anomalies.\nAdministrative Contact: Security Operations Identity & Access Management.",
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
  const [currentDir, setCurrentDir] = useState('/');
  const [inputVal, setInputVal] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<Array<{ text: string; type: 'cmd' | 'resp' | 'error' }>>([]);
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

  const ALLOWED_DIRECTORIES: Record<string, Record<string, { desc: string; args: string[]; flags: string[] }>> = {
    identities: {
      list: { desc: 'List registered operatives', args: [], flags: ['--status <status>'] },
      cat: { desc: 'View profile dossier of an identity', args: ['<uid/username>'], flags: [] },
      'pending-deletions': { desc: 'List accounts scheduled for purge', args: [], flags: [] }
    },
    comms: {
      list: { desc: 'List active comms channels', args: [], flags: [] },
      cat: { desc: 'View detailed metadata of a channel', args: ['<lounge_id>'], flags: [] },
      kick: { desc: 'Force sever connection from comms', args: ['<uid>'], flags: [] },
      bcast: { desc: 'Broadcast system alert to a channel', args: ['<lounge_id>', '<msg>'], flags: [] }
    },
    enforcement: {
      ban: { desc: 'Ban an operative', args: ['<uid>'], flags: [] },
      mute: { desc: 'Mute an operative globally', args: ['<uid>'], flags: [] },
      jail: { desc: 'Restrict an operative to read-only', args: ['<uid>'], flags: [] },
      sanctions: { desc: 'List all active sanctions for an identity', args: ['<uid/username>'], flags: [] }
    },
    dispatch: {
      pending: { desc: 'List open support or promotion dispatch tickets', args: [], flags: [] },
      token: { desc: 'Generate a support recovery secure token', args: ['<ticket_id>'], flags: [] }
    },
    datastore: {
      integrity: { desc: 'Validate datastore structures & indices', args: [], flags: [] },
      'orphans-scan': { desc: 'Scan relational tables for orphaned nodes', args: [], flags: [] },
      export: { desc: 'Export raw table records with masked PII', args: ['<table>'], flags: [] },
      fsync: { desc: 'Force write sync memory to durable storage', args: [], flags: [] }
    },
    daemon: {
      status: { desc: 'Check core daemon and network health', args: [], flags: [] },
      top: { desc: 'Display active load and resource metrics', args: [], flags: [] },
      risk: { desc: 'Scan active logs for security threats', args: [], flags: [] },
      activest: { desc: 'View active web socket connections and online users', args: [], flags: [] },
      ccache: { desc: 'Clear system volatile memory cache', args: [], flags: [] }
    },
    forensics: {
      user: { desc: 'Trace administrative audit logs for operative', args: ['<uid/username>'], flags: [] },
      grep: { desc: 'Search global active log stream', args: ['<pattern>'], flags: [] },
      history: { desc: 'Trace account state mutations for operative', args: ['<uid/username>'], flags: [] },
      'ledger-verify': { desc: 'Verify transaction ledger cryptographic hashes', args: [], flags: [] },
      hijacks: { desc: 'Evaluate active sessions for hijacked footprints', args: [], flags: [] },
      ip: { desc: 'Cross-correlate accounts sharing identical subnets/profiles', args: [], flags: [] },
      nodes: { desc: 'Scan fractal categories for RBAC inheritance leaks', args: [], flags: [] }
    },
    threat_intel: {
      risklog: { desc: 'View recent fraud and risk analysis logs', args: [], flags: [] }
    },
    treasury: {
      txlog: { desc: 'Tail recent treasury transactions', args: [], flags: [] },
      staff: { desc: 'List all authorized financial staff personnel', args: [], flags: [] }
    }
  };

  const getPromptLabel = () => {
    return `admin@velum:${currentDir === '/' ? '~' : currentDir}$`;
  };

  // Execute terminal CLI command
  const executeCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCommand = inputVal.trim();
    if (!rawCommand) return;

    setTerminalLogs(prev => [...prev, { text: `${getPromptLabel()} ${rawCommand}`, type: 'cmd' }]);
    setInputVal('');

    const parts = rawCommand.split(/\s+/);
    const verb = parts[0].toLowerCase();
    const args = parts.slice(1);

    // 1. handle 'clear' / 'cls'
    if (verb === 'clear' || verb === 'cls') {
      setTerminalLogs([]);
      return;
    }

    // 2. handle 'pwd'
    if (verb === 'pwd') {
      setTerminalLogs(prev => [...prev, { text: currentDir, type: 'resp' }]);
      return;
    }

    // 3. handle 'cd'
    if (verb === 'cd') {
      const target = args[0] || '/';
      if (target === '/' || target === '~') {
        setCurrentDir('/');
      } else if (target === '..') {
        setCurrentDir('/');
      } else {
        const cleanTarget = target.replace(/^\//, '').replace(/\/$/, '').toLowerCase();
        if (ALLOWED_DIRECTORIES[cleanTarget]) {
          setCurrentDir(`/${cleanTarget}`);
        } else {
          setTerminalLogs(prev => [...prev, { text: `cd: no such file or directory: ${target}`, type: 'error' }]);
        }
      }
      return;
    }

    // 4. handle 'ls'
    if (verb === 'ls') {
      if (currentDir === '/') {
        let out = `AVAILABLE NAMESPACES\n--------------------\n`;
        Object.entries(ALLOWED_DIRECTORIES).forEach(([dir, cmds]) => {
          out += `  ${(dir + '/').padEnd(16)} ${Object.keys(cmds).length} directives\n`;
        });
        setTerminalLogs(prev => [...prev, { text: out.trimEnd(), type: 'resp' }]);
      } else {
        const dirName = currentDir.replace('/', '');
        let out = `DIRECTIVES IN /${dirName}\n--------------------\n`;
        Object.entries(ALLOWED_DIRECTORIES[dirName] || {}).forEach(([cmd, meta]) => {
           out += `  ${cmd.padEnd(16)} ${meta.desc}\n`;
        });
        setTerminalLogs(prev => [...prev, { text: out.trimEnd(), type: 'resp' }]);
      }
      return;
    }

    const hasHelpFlag = args.includes('-h') || args.includes('--help') || args.includes('help');

    // 5. handle help or help flags
    if (verb === 'help' || verb === '?') {
      const helpMsg = `VELUM INTERACTIVE WEB CLI

You can navigate the CLI like a Linux terminal:
  ls            List directories (at root) or commands (inside a directory)
  cd <dir>      Change directory (e.g., cd identities, cd daemon, cd ..)
  pwd           Show current working directory
  clear         Clear the terminal screen

Available namespaces:
  identities/   Operative personnel moderation commands
  comms/        Nexus communications channels monitoring
  enforcement/  Sanctions and punitive actions
  dispatch/     Support and promotion operational dispatch
  datastore/    Core node database systems
  daemon/       System diagnostics and resource metrics
  forensics/    Subnet correlation, log search, and ledger tracing
  threat_intel/ Risk scanning and fraud detection
  treasury/     Financial oversight and bank auditing

To run a command:
  1) Run directly: e.g., /identities list
  2) Navigate first: e.g., cd identities, then type: list

For help on a directory or command, use: <name> -h`;
      setTerminalLogs(prev => [...prev, { text: helpMsg, type: 'resp' }]);
      return;
    }

    // Check directory help (e.g. users -h)
    const cleanVerb = verb.replace(/^\//, '').replace(/\/$/, '');
    if (ALLOWED_DIRECTORIES[cleanVerb] && hasHelpFlag) {
      let helpMsg = `Directory: ${cleanVerb}/\n------------------`;
      const cmdsObj = ALLOWED_DIRECTORIES[cleanVerb];
      Object.entries(cmdsObj).forEach(([cmdName, cmdMeta]) => {
        const usageArgs = cmdMeta.args.join(' ');
        const usageFlags = cmdMeta.flags.join(' ');
        helpMsg += `\n${cmdName.padEnd(10)} - ${cmdMeta.desc}\n           Usage: ${cmdName} ${usageArgs} ${usageFlags}`.trimEnd();
      });
      setTerminalLogs(prev => [...prev, { text: helpMsg, type: 'resp' }]);
      return;
    }

    // 6. Map and validate commands
    let targetDir = '';
    let targetCmd = '';
    let cmdArgs = [...args];

    if (verb.startsWith('/')) {
      const splitPath = verb.split('/').filter(Boolean);
      if (splitPath[0]) {
        targetDir = splitPath[0].toLowerCase();
      }
      if (splitPath[1]) {
        targetCmd = splitPath[1].toLowerCase();
      } else if (args[0]) {
        targetCmd = args[0].toLowerCase();
        cmdArgs = args.slice(1);
      }
    } else if (ALLOWED_DIRECTORIES[verb]) {
      targetDir = verb;
      if (args[0]) {
        targetCmd = args[0].toLowerCase();
        cmdArgs = args.slice(1);
      }
    } else {
      if (currentDir !== '/') {
        targetDir = currentDir.replace('/', '');
        targetCmd = verb;
      } else {
        const aliases: Record<string, { dir: string; cmd: string }> = {
          status: { dir: 'daemon', cmd: 'status' },
          info: { dir: 'daemon', cmd: 'status' },
          diagnostics: { dir: 'daemon', cmd: 'status' },
          pending: { dir: 'dispatch', cmd: 'pending' },
          comms: { dir: 'comms', cmd: 'list' },
          risk: { dir: 'daemon', cmd: 'risk' }
        };
        if (aliases[verb]) {
          targetDir = aliases[verb].dir;
          targetCmd = aliases[verb].cmd;
        }
      }
    }

    if (!targetDir || !targetCmd || !ALLOWED_DIRECTORIES[targetDir] || !ALLOWED_DIRECTORIES[targetDir][targetCmd]) {
      const blockReason = "FAIL: This command is restricted to the Terminal CLI.";
      setTerminalLogs(prev => [...prev, { text: blockReason, type: 'error' }]);
      return;
    }

    if (hasHelpFlag) {
      const cmdMeta = ALLOWED_DIRECTORIES[targetDir][targetCmd];
      const usageArgs = cmdMeta.args.join(' ');
      const usageFlags = cmdMeta.flags.join(' ');
      const helpMsg = `Command: ${targetCmd}
Description: ${cmdMeta.desc}
Usage: ${targetCmd} ${usageArgs} ${usageFlags}`.trim();
      setTerminalLogs(prev => [...prev, { text: helpMsg, type: 'resp' }]);
      return;
    }

    const apiCommand = `/${targetDir} ${targetCmd} ${cmdArgs.join(' ')}`.trim();

    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/cli/exec', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ adminId, command: apiCommand })
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
            <Terminal className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs md:text-sm font-semibold text-text-primary uppercase tracking-[0.1em] md:tracking-[0.15em] font-sans truncate">Velum Console</h2>
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
          {/* Terminal stream log output */}
          <div 
            ref={terminalScrollRef}
            className="flex-1 overflow-y-auto p-5 space-y-2.5 font-mono text-xs sm:text-[13px] text-text-primary bg-[#0d1117] min-h-[300px]"
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
              {getPromptLabel()}&nbsp;
            </label>
            <input
              id="terminal-input"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              autoComplete="off"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder=""
              disabled={isLoading}
              className="flex-1 bg-transparent text-text-primary font-mono text-xs sm:text-[13px] font-medium border-none outline-none focus:ring-0 placeholder:text-white/20"
              autoFocus
              />
          </form>
        </div>
      </div>
    </div>
  );
}
