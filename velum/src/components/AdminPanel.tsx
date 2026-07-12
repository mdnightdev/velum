import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, UserCheck, Flame, BookOpen, AlertOctagon, HelpCircle, 
  Send, Ban, Plus, FileText, CheckCircle, ShieldCheck, RefreshCw, Key, 
  UserPlus, Lock, Unlock, Shield, Users, Search, MessageSquare, 
  Sliders, ChevronRight, ChevronLeft, Activity, Trash2, Megaphone, Info, Globe, AlertTriangle,
  BadgeCheck, LogOut, Menu, X
} from 'lucide-react';
import PasswordInput from './PasswordInput';
import AdminDiagnosticsView from './AdminDiagnosticsView';
import AdminUsersView from './AdminUsersView';
import logoSvg from '../assets/logo.svg?raw';
import { Ticket, AuditLog, SuspiciousEvent, Invite, stripAt, decryptE2E } from '../types';

interface AdminPanelProps {
  adminId: number;
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN';
  activeTab: 'overview' | 'users' | 'tickets' | 'reports' | 'announcements' | 'moderation' | 'system' | 'logs' | 'settings' | any;
  onTabChange?: (tab: any) => void;
  isDark?: boolean;
  onLogout?: () => void;
  user?: any;
}

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

export default function AdminPanel({ 
  adminId, 
  adminRole, 
  activeTab, 
  onTabChange, 
  isDark = true,
  onLogout,
  user
}: AdminPanelProps) {

  // Design theme variables
  const c = {
    bgPanel: "bg-velum-800 border border-white-5",
    bgSubPanel: "bg-velum-850 border border-white-5",
    bgInput: "bg-velum-750 border border-velum-600 text-text-primary focus:border-accent-40 placeholder:text-text-disabled",
    border: "border-velum-600",
    textMain: "text-text-primary",
    textMuted: "text-text-secondary",
    statusResolved: "bg-accent-secondary-10 text-accent-secondary border border-accent-secondary-20",
    statusOpen: "bg-status-dnd/10 text-status-dnd border border-status-dnd/20",
    statusPending: "bg-status-away/10 text-status-away border border-status-away/20",
    statusEscalated: "bg-accent-10 text-accent border border-accent-20"
  };

  // State Management
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const selectTab = (tab: any) => {
    if (onTabChange) {
      onTabChange(tab);
    }
    setIsSidebarOpen(false);
  };
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'pending' | 'escalated' | 'resolved'>('all');

  // Diagnostics lists
  const [suspicious, setSuspicious] = useState<SuspiciousEvent[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [activeSanctions, setActiveSanctions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);

  // Users Directory State
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'CLI_ADMIN' | 'LOGIN_ADMIN' | 'SUPPORT_ADMIN' | 'member'>('all');

  // Reports tab state (separating complaints, bugs, suggests)
  const [reportFilter, setReportFilter] = useState<'all' | 'complaints' | 'bugs' | 'suggestions'>('all');

  // System States
  const [quarantineTargetId, setQuarantineTargetId] = useState('');
  const [restoreCode, setRestoreCode] = useState<string | null>(null);
  const [invDays, setInvDays] = useState(7);
  const [newCodeInfo, setNewCodeInfo] = useState<string | null>(null);
  const [isGatewayLocked, setIsGatewayLocked] = useState(false);

  // Operator nominate state
  const [nomineeUsername, setNomineeUsername] = useState('');
  const [nominationResult, setNominationResult] = useState<string | null>(null);
  const [nominationError, setNominationError] = useState<string | null>(null);

  // Key Rotations
  const [rotatedUsername, setRotatedUsername] = useState('');
  const [rotatedPassword, setRotatedPassword] = useState('');
  const [rotationResult, setRotationResult] = useState<string | null>(null);
  const [rotationError, setRotationError] = useState<string | null>(null);

  // Announcements drafting
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementMsg, setAnnouncementMsg] = useState<string | null>(null);
  const [pastAnnouncements, setPastAnnouncements] = useState<any[]>([
    { id: '1', title: 'System Security Protocol Updated', date: '2026-06-09', content: 'All servers synchronized to TLS v1.3 with emergency panic triggers enabled.' },
    { id: '2', title: 'central lobby migration', date: '2026-06-05', content: 'Velum central chat engine migrated to highly sandboxed SQLite instances.' }
  ]);

  // Channel States (Redesigned replacement for announcements)
  const [selectedChannel, setSelectedChannel] = useState<string>('velum_lounge');
  const [channelMessages, setChannelMessages] = useState<any[]>([]);
  const [newChannelMsg, setNewChannelMsg] = useState('');
  const [isPostingMsg, setIsPostingMsg] = useState(false);
  const [broadcastAlert, setBroadcastAlert] = useState(false);
  const [isVelumExpanded, setIsVelumExpanded] = useState(true);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [announcementsMobileView, setAnnouncementsMobileView] = useState<'list' | 'chat'>('list');

  // Settings state
  const [safeWord, setSafeWord] = useState('');
  const [panicPhrase, setPanicPhrase] = useState('');
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);

  const getSessionId = (): string => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem('velum-sessionId') || '';
  };

  const adminFetch = async (url: string, options: RequestInit = {}) => {
    const sId = getSessionId();
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${sId}`,
      'x-session-id': sId
    };
    return fetch(url, { ...options, headers });
  };

  // Refresh data
  const fetchData = async () => {
    try {
      const ticketRes = await adminFetch(`/api/admin/tickets?adminId=${adminId}`);
      if (ticketRes.status === 401 || ticketRes.status === 403) {
        if (onLogout) onLogout();
        return;
      }
      if (ticketRes.ok) {
        const ticketData = await ticketRes.json();
        setTickets(ticketData);
        // Sync active ticket details if selected
        if (activeTicket) {
          const fresh = ticketData.find((t: any) => t.ticket_id === activeTicket.ticket_id);
          if (fresh) {
            setActiveTicket(fresh);
          }
        }
      }

      const diagRes = await adminFetch(`/api/admin/diagnostics?adminId=${adminId}`);
      if (diagRes.status === 401 || diagRes.status === 403) {
        if (onLogout) onLogout();
        return;
      }
      if (diagRes.ok) {
        const diagData = await diagRes.json();
        setSuspicious(diagData.suspicious || []);
        setLogs(diagData.logs || []);
        setInvites(diagData.invites || []);
        setActiveSanctions(diagData.sanctions || []);
        setUsers(diagData.users || []);
        setSessions(diagData.sessions || []);
        setDevices(diagData.devices || []);
        if (diagData.metrics) {
          setMetrics(diagData.metrics);
        }
      }
    } catch (err) {
      console.warn('Failed admin sync fetch', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [adminId]);

  // Handle support ticket reply
  const handleTicketReply = async (close: boolean, escalate: boolean) => {
    if (!activeTicket || !replyText.trim()) return;

    try {
      const res = await adminFetch(`/api/admin/tickets/${activeTicket.ticket_id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId,
          content: replyText,
          closeTicket: close,
          escalate: escalate
        })
      });

      if (res.ok) {
        setReplyText('');
        const updatedTicket = await res.json();
        setActiveTicket(updatedTicket);
        fetchData();
      }
    } catch {
      alert('Failed to send reply.');
    }
  };

  // User sanction trigger (lock / unlock / mute / ban)
  const applyQuickSanction = async (userName: string, type: 'ban' | 'mute', duration: number, reason: string) => {
    try {
      const res = await adminFetch(`/api/admin/sanction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUsername: userName,
          type,
          minutes: duration,
          reason
        })
      });

      const message = await res.json();
      if (res.ok) {
        fetchData();
        return { success: true, text: `Successfully applied: ${type.toUpperCase()}` };
      } else {
        return { success: false, text: message.error || 'Failed to complete sanction.' };
      }
    } catch {
      return { success: false, text: 'Network connection failure.' };
    }
  };

  // Quarantine Restore
  const approveQuarantineAccess = async (targetUserId: string, action: 'approve' | 'deny') => {
    try {
      const res = await adminFetch(`/api/admin/recover-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: parseInt(targetUserId, 10),
          action
        })
      });

      const data = await res.json();
      if (res.ok) {
        if (action === 'approve') {
          setRestoreCode(data.tempCode);
        } else {
          alert('Ticket denied.');
        }
        fetchData();
      } else {
        alert(data.error || 'Operation denied.');
      }
    } catch {
      alert('Connection lost.');
    }
  };

  // Invite Generator
  const generateNewInvite = async () => {
    setNewCodeInfo(null);
    try {
      const res = await adminFetch(`/api/admin/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId,
          expiresInDays: invDays
        })
      });
      const data = await res.json();
      if (res.ok) {
        setNewCodeInfo(data.code);
        fetchData();
      } else {
        alert(data.error || 'Failed key creation.');
      }
    } catch {
      alert('Connection timeout.');
    }
  };

  // Security Nominate Support
  const nominateSupportAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setNominationResult(null);
    setNominationError(null);

    if (!nomineeUsername.trim()) {
      setNominationError('Username is required.');
      return;
    }

    try {
      const res = await adminFetch(`/api/admin/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: nomineeUsername,
          targetUsername: nomineeUsername
        })
      });
      const data = await res.json();
      if (res.ok) {
        setNominationResult(`NOMINATION SECURED: @${nomineeUsername} promoted to SUPPORT_ADMIN.`);
        setNomineeUsername('');
        fetchData();
      } else {
        setNominationError(data.error || 'Nomination failed.');
      }
    } catch {
      setNominationError('Connection lost with nominee registry.');
    }
  };

  // Rotate credentials
  const rotateExecutiveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setRotationResult(null);
    setRotationError(null);

    if (!rotatedUsername.trim() || !rotatedPassword.trim()) {
      setRotationError('Both username and secret key values are required.');
      return;
    }

    try {
      const res = await adminFetch(`/api/admin/rename-executive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newUsername: rotatedUsername,
          newPassword: rotatedPassword
        })
      });

      const data = await res.json();
      if (res.ok) {
        setRotationResult('CREDENTIAL ROTATION SECURED: Administrative identity modified successfully.');
        setRotatedUsername('');
        setRotatedPassword('');
      } else {
        setRotationError(data.error || 'Identity credentials rotation rejected.');
      }
    } catch {
      setRotationError('Connection lost with credentials daemon.');
    }
  };

  // Dispatch Announcements
  const handleAnnounceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnnouncementMsg(null);
    if (!announcementText.trim()) return;

    try {
      const res = await adminFetch(`/api/admin/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: announcementText })
      });

      if (res.ok) {
        setPastAnnouncements(p => [
          { id: String(Date.now()), title: 'Broadcast Dispatch Logs', date: new Date().toLocaleDateString(), content: announcementText },
          ...p
        ]);
        setAnnouncementMsg('Broadcast successfully dispatched to all active connections!');
        setAnnouncementText('');
      } else {
        alert('Failed announcement broadcast.');
      }
    } catch {
      alert('Network error.');
    }
  };

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
    if (activeTab === 'announcements') {
      fetchChannelMessages(selectedChannel);
      fetchAvailableRooms();
      const interval = setInterval(() => {
        fetchChannelMessages(selectedChannel);
        fetchAvailableRooms();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTab, selectedChannel]);

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
          body: JSON.stringify({ content: newChannelMsg })
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
            is_encrypted: false
          })
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

  // Save Settings
  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsStatus('SECURITY SETTINGS SECURED: Changes applied to admin profile memory.');
    setTimeout(() => setSettingsStatus(null), 4000);
  };

  // Filter calculations
  const statsOverview = {
    totalUsers: metrics?.totalUsers ?? (users.length > 0 ? users.length : 12),
    totalRooms: metrics?.totalRooms ?? 0,
    activeSessionsCount: metrics?.activeSessionsCount ?? sessions.filter(s => s.status === 'active').length,
    openTicketsCount: metrics?.openTicketsCount ?? tickets.filter(t => t.status !== 'resolved').length,
    totalMessages: metrics?.totalMessages ?? 0,
    messages24hCount: metrics?.messages24hCount ?? 18729
  };

  // Dynamic ticket filtering
  const filteredTickets = tickets.filter(t => {
    // Exclude mock report ticket types from central support queue, let's keep standard tickets here
    const isReportType = t.issue_type === 'compromise_report' || t.issue_type === 'report_user' || t.issue_type === 'system_bug' || t.issue_type === 'suggestion';
    
    // Switch to tickets filter
    if (activeTab === 'tickets' && isReportType) return false;
    if (activeTab === 'reports' && !isReportType) return false;

    // Filter by category selection
    if (ticketFilter !== 'all' && t.status !== ticketFilter) return false;

    // Filter by search bar
    if (ticketSearch.trim() !== '') {
      const q = ticketSearch.toLowerCase();
      const matchText = (t.username || '').toLowerCase() + ' ' + (t.issue_type || '').toLowerCase();
      return matchText.includes(q);
    }
    return true;
  });

  // Dynamic reports list (under reports tab)
  const reportsList = tickets.filter(t => {
    const isReport = t.issue_type === 'compromise_report' || t.issue_type === 'report_user' || t.issue_type === 'system_bug' || t.issue_type === 'suggestion';
    if (!isReport) return false;

    if (reportFilter === 'complaints' && t.issue_type !== 'report_user') return false;
    if (reportFilter === 'bugs' && t.issue_type !== 'system_bug') return false;
    if (reportFilter === 'suggestions' && t.issue_type !== 'suggestion') return false;

    return true;
  });

  return (
    <div className="flex h-full w-full bg-velum-900 overflow-hidden text-text-primary">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)} 
          className="fixed inset-0 bg-black-60 backdrop-blur-sm z-45 lg:hidden"
        />
      )}

      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className={`fixed lg:static lg:translate-x-0 top-0 left-0 h-full z-50 flex flex-col justify-between transition-all duration-300 ease-in-out border-r border-white-5 bg-velum-850 p-5 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:w-0 lg:p-0 lg:border-none lg:overflow-hidden'} w-64 shrink-0`}>
        <div className={`space-y-7 w-full transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:opacity-100'}`}>
          {/* Brand/Logo Area */}
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: logoSvg }} />
              <div>
                <span className="text-sm font-sans font-black tracking-widest text-accent uppercase">VELUM</span>
                <span className="text-[9px] font-mono font-bold block text-text-secondary uppercase tracking-widest">CONTROL CENTER</span>
              </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="text-text-secondary hover:text-text-primary p-1 rounded-md hover:bg-text-primary-5 transition-colors" title="Close Sidebar">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Connected User Identity Badge */}
          <div className="p-3 bg-text-primary-2 border border-white-5 rounded-xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-10 border border-accent-20 flex items-center justify-center font-bold text-accent font-mono text-xs shrink-0">
              {(user?.username || 'AD').substring(0,2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-text-primary block truncate">@{user?.username || 'Executive'}</span>
              <span className="text-[8.5px] font-mono text-text-secondary block truncate">{adminRole === 'SUPPORT_ADMIN' ? 'SUPPORT OPERATIONS' : 'EXECUTIVE CONTROLS'}</span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1.5">
            <span className="text-[8.5px] font-mono font-black text-text-secondary uppercase tracking-widest block mb-2 px-1">CORE COMMANDS</span>
            
            {/* Tab: Overview (Only if LOGIN_ADMIN) */}
            {adminRole === 'LOGIN_ADMIN' && (
              <button
                onClick={() => selectTab('overview')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left font-sans font-bold transition-all border text-xs cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-accent-10 border-accent-20 text-accent'
                    : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Overview Desk</span>
              </button>
            )}

            {/* Tab: Users (Only if LOGIN_ADMIN) */}
            {adminRole === 'LOGIN_ADMIN' && (
              <button
                onClick={() => selectTab('users')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left font-sans font-bold transition-all border text-xs cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-accent-10 border-accent-20 text-accent'
                    : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>User Directory</span>
              </button>
            )}

            {/* Tab: Dispute Support Tickets */}
            <button
              onClick={() => selectTab('tickets')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left font-sans font-bold transition-all border text-xs cursor-pointer ${
                activeTab === 'tickets'
                  ? 'bg-accent-10 border-accent-20 text-accent'
                  : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>Dispute Cases</span>
            </button>

            {/* Tab: Escalated Reports */}
            <button
              onClick={() => selectTab('reports')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left font-sans font-bold transition-all border text-xs cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-accent-10 border-accent-20 text-accent'
                  : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Escalated Reports</span>
            </button>

            {/* Tab: Lounge Feed (Announcements) */}
            {adminRole === 'LOGIN_ADMIN' && (
              <button
                onClick={() => selectTab('announcements')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left font-sans font-bold transition-all border text-xs cursor-pointer ${
                  activeTab === 'announcements'
                    ? 'bg-accent-10 border-accent-20 text-accent'
                    : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
                }`}
              >
                <Megaphone className="w-4 h-4" />
                <span>Feed Broadcasts</span>
              </button>
            )}

            {/* Tab: Moderation Controls */}
            <button
              onClick={() => selectTab('moderation')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left font-sans font-bold transition-all border text-xs cursor-pointer ${
                activeTab === 'moderation'
                  ? 'bg-accent-10 border-accent-20 text-accent'
                  : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
              }`}
            >
              <Ban className="w-4 h-4" />
              <span>Moderation Sanctions</span>
            </button>

            {/* Tab: System Health (Only if LOGIN_ADMIN) */}
            {adminRole === 'LOGIN_ADMIN' && (
              <button
                onClick={() => selectTab('system')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left font-sans font-bold transition-all border text-xs cursor-pointer ${
                  activeTab === 'system'
                    ? 'bg-accent-10 border-accent-20 text-accent'
                    : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>System Sentinel</span>
              </button>
            )}

            {/* Tab: Audit Registry (Only if LOGIN_ADMIN) */}
            {adminRole === 'LOGIN_ADMIN' && (
              <button
                onClick={() => selectTab('logs')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left font-sans font-bold transition-all border text-xs cursor-pointer ${
                  activeTab === 'logs'
                    ? 'bg-accent-10 border-accent-20 text-accent'
                    : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Audit Logs</span>
              </button>
            )}

            {/* Tab: Profile Profile & Credentials */}
            <button
              onClick={() => selectTab('settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left font-sans font-bold transition-all border text-xs cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-accent-10 border-accent-20 text-accent'
                  : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
              }`}
            >
              <Key className="w-4 h-4" />
              <span>Security Settings</span>
            </button>
          </nav>
        </div>

        {/* Footer Area with Logout */}
        <div className="pt-4 border-t border-white-5">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2.5 bg-status-dnd/20 border border-red-900/30 hover:bg-red-900 hover:text-text-primary text-red-400 px-4 py-3 rounded-xl text-xs font-sans font-bold transition uppercase tracking-wider cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Signout Panel</span>
          </button>
        </div>
      </aside>

      {/* Hamburger trigger for main area when sidebar is closed */}
      {!isSidebarOpen && (
        <button onClick={() => setIsSidebarOpen(true)} className="fixed top-5 left-5 z-40 p-2 bg-velum-850/75 border border-white-5 rounded-md text-text-primary hover:text-text-primary hover:bg-text-primary-5">
          <Menu className="w-6 h-6" />
        </button>
      )}

      {/* Main Action desk view area */}
      <main className={`flex-1 overflow-y-auto p-8 relative min-w-0 space-y-6 max-w-7xl mx-auto w-full transition-all duration-300 ${!isSidebarOpen ? 'pt-20 lg:pt-6' : ''}`}>
      
      {/* 1. OVERVIEW VIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          {/* 4 Bento Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1: Total Users */}
            <div 
              onClick={() => onTabChange && onTabChange('users')}
              className={`p-5 rounded-2xl border ${c.bgPanel} transition hover:border-accent-40 flex flex-col justify-between h-[135px] relative overflow-hidden cursor-pointer group select-none`}
            >
              <div>
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary font-sans">Total Users</span>
                  <Users className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-2xl font-black text-text-primary font-sans">{statsOverview.totalUsers.toLocaleString()}</span>
                  <span className="text-[9.5px] text-accent font-bold font-sans flex items-center gap-0.5">
                    <span>Active Directory</span>
                  </span>
                </div>
              </div>
              {/* Glowing Sparkline SVG */}
              <div className="absolute bottom-0 left-0 right-0 h-10 w-full opacity-65 pointer-events-none">
                <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                  <path d="M0 30 Q10 15, 25 25 T50 12 T75 28 T100 15 L100 40 L0 40 Z" fill="url(#sparkline-grad-2)" stroke="currentColor" className="text-accent" strokeWidth="1.3" />
                  <defs>
                    <linearGradient id="sparkline-grad-2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            {/* Card 2: Active Rooms */}
            <div 
              onClick={() => onTabChange && onTabChange('announcements')}
              className={`p-5 rounded-2xl border ${c.bgPanel} transition hover:border-accent-secondary-20 flex flex-col justify-between h-[135px] relative overflow-hidden cursor-pointer group select-none`}
            >
              <div>
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary font-sans">Active Rooms</span>
                  <BookOpen className="w-4 h-4 text-accent-secondary group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-2xl font-black text-accent-secondary font-sans">{statsOverview.totalRooms}</span>
                  <span className="text-[9.5px] text-accent-secondary font-bold font-sans flex items-center gap-0.5">
                    <span>Sync Live</span>
                  </span>
                </div>
              </div>
              {/* Glowing Sparkline SVG */}
              <div className="absolute bottom-0 left-0 right-0 h-10 w-full opacity-65 pointer-events-none">
                <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                  <path d="M0 38 Q15 20, 40 32 T70 12 T100 18 L100 40 L0 40 Z" fill="url(#sparkline-grad-4)" stroke="currentColor" className="text-accent-secondary" strokeWidth="1.3" />
                  <defs>
                    <linearGradient id="sparkline-grad-4" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent-secondary)" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="var(--color-accent-secondary)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            {/* Card 3: Messages (24h) */}
            <div className={`p-5 rounded-2xl border ${c.bgPanel} transition hover:border-velum-500 flex flex-col justify-between h-[135px] relative overflow-hidden group select-none`}>
              <div>
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary font-sans">Messages (24h)</span>
                  <MessageSquare className="w-4 h-4 text-text-secondary group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-2xl font-black text-text-primary font-sans">{statsOverview.messages24hCount.toLocaleString()}</span>
                  <span className="text-[9.5px] text-text-secondary font-bold font-sans flex items-center gap-0.5">
                    <span>Rolling Stream</span>
                  </span>
                </div>
              </div>
              {/* Glowing Sparkline SVG */}
              <div className="absolute bottom-0 left-0 right-0 h-10 w-full opacity-65 pointer-events-none">
                <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                  <path d="M0 25 Q20 35, 40 18 T70 30 T100 8 L100 40 L0 40 Z" fill="url(#sparkline-grad-3)" stroke="currentColor" className="text-text-secondary" strokeWidth="1.3" />
                  <defs>
                    <linearGradient id="sparkline-grad-3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-text-secondary)" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="var(--color-text-secondary)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            {/* Card 4: Open Incidents */}
            <div 
              onClick={() => onTabChange && onTabChange('tickets')}
              className={`p-5 rounded-2xl border ${c.bgPanel} transition hover:border-accent-40 flex flex-col justify-between h-[135px] relative overflow-hidden cursor-pointer group select-none`}
            >
              <div>
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary font-sans">Open Incidents</span>
                  <ShieldAlert className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-2xl font-black text-text-primary font-sans">{statsOverview.openTicketsCount}</span>
                  <span className="text-[9.5px] text-accent font-bold font-sans flex items-center gap-0.5">
                    <span>Active Cases</span>
                  </span>
                </div>
              </div>
              {/* Glowing Sparkline SVG */}
              <div className="absolute bottom-0 left-0 right-0 h-10 w-full opacity-65 pointer-events-none">
                <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                  <path d="M0 35 Q15 20, 30 28 T60 10 T90 22 T100 5 L100 40 L0 40 Z" fill="url(#sparkline-grad-1)" stroke="currentColor" className="text-accent" strokeWidth="1.3" />
                  <defs>
                    <linearGradient id="sparkline-grad-1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </div>

          {/* Main bento body grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Recent Tickets List table */}
            <div 
              onClick={() => onTabChange && onTabChange('tickets')}
              className={`lg:col-span-7 p-6 rounded-2xl border ${c.bgPanel} shadow-xl cursor-pointer hover:border-accent-40 transition duration-200 select-none`}
            >
              <div className="flex items-center justify-between border-b border-white-5 pb-4 mb-4">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-accent font-mono flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Recent System Incidents
                </h3>
                <span className="text-[9px] font-mono text-text-secondary/45 px-2 py-0.5 rounded bg-text-primary-5 uppercase">ACTIVE QUEUE</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="text-text-secondary text-[9px] font-black uppercase tracking-wider border-b border-white-5">
                      <th className="pb-3">ID</th>
                      <th className="pb-3">Client Handle</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03] text-text-primary">
                    {tickets.slice(0, 5).map((t, idx) => {
                      const statusColor = t.status === 'open' ? 'bg-status-dnd' : t.status === 'resolved' ? 'bg-status-online' : 'bg-status-away';
                      return (
                        <tr key={idx} className="hover:bg-text-primary-2 transition duration-150">
                          <td className="py-3 font-mono text-[10.5px] font-bold text-accent">#{t.ticket_id}</td>
                          <td className="py-3 font-bold text-text-primary">{t.username || `User #${t.user_id}`}</td>
                          <td className="py-3 text-text-secondary text-[11px] font-normal uppercase max-w-[150px] truncate">{(t.issue_type || '').replace(/_/g, ' ')}</td>
                          <td className="py-3">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8.5px] font-black font-mono bg-text-primary-5 border border-white-10 uppercase">
                              <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
                              {t.status}
                            </span>
                          </td>
                          <td className="py-3 text-right text-text-secondary text-[10px] font-mono">{new Date(t.created_at).toLocaleTimeString()}</td>
                        </tr>
                      );
                    })}
                    {tickets.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-text-secondary font-mono text-[10px] uppercase">// System operational queue 100% idle //</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column: System Status + SVG Area wave line chart */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Health Status Block */}
              <div className={`p-6 rounded-2xl border ${c.bgPanel} shadow-xl`}>
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-accent-hover font-sans border-b border-white-5 pb-3.5 mb-3.5 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-hover inline-block animate-ping" />
                  System Health
                </h3>
                
                <div className="space-y-3.5 text-xs">
                  {[
                    { lbl: "System Engine", status: "Active Operational", color: "text-status-online bg-emerald-400/5 border-emerald-500/10" },
                    { lbl: "E2E Datastore Index", status: "Healthy Synchronized", color: "text-status-online bg-emerald-400/5 border-emerald-500/10" },
                    { lbl: "Secure API Gateway", status: "Healthy Online", color: "text-status-online bg-emerald-400/5 border-emerald-500/10" },
                    { lbl: "Active Connections", status: "Active Connected", color: "text-status-online bg-emerald-400/5 border-emerald-500/10" }
                  ].map((srv, idx) => (
                    <div key={idx} className="flex justify-between items-center py-0.5 font-sans">
                      <span className="font-semibold text-text-secondary/80">{srv.lbl}</span>
                      <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase font-mono ${srv.color}`}>
                        {srv.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Highly stylized glowing wave area chart of traffic (past 24h) */}
              <div className={`p-6 rounded-2xl border ${c.bgPanel} flex-grow flex flex-col justify-between shadow-xl`}>
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-accent font-mono">Channel Traffic (24h)</h3>
                </div>

                {/* Line/Area Vector Wave Graphic */}
                <div className="py-4 relative h-32 flex items-end">
                  <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="waveAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="var(--color-accent-secondary)" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="var(--color-accent)" />
                        <stop offset="50%" stopColor="var(--color-accent-hover)" />
                        <stop offset="100%" stopColor="var(--color-accent)" />
                      </linearGradient>
                    </defs>
                    <path 
                      d="M 0 80 Q 30 20, 60 50 T 120 30 T 180 75 T 240 15 T 300 45 L 300 100 L 0 100 Z" 
                      fill="url(#waveAreaGrad)" 
                    />
                    <path 
                      d="M 0 80 Q 30 20, 60 50 T 120 30 T 180 75 T 240 15 T 300 45" 
                      fill="none" 
                      stroke="url(#lineGrad)" 
                      strokeWidth="2.5" 
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div className="flex justify-between items-center text-[9px] text-text-secondary font-mono uppercase tracking-wider border-t border-white-5 pt-2">
                  <span>00:00 AM</span>
                  <span>12:00 PM</span>
                  <span>11:59 PM</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. USERS DIRECTORY VIEW */}
      {activeTab === 'users' && (
        <div className={`p-6 rounded-2xl border ${c.bgPanel} shadow-xl animate-fadeIn`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white-5 pb-5 mb-6">
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-accent" />
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider">Registered Entity Directory</h3>
              </div>
            </div>

            {/* Directory Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:flex-initial">
                <Search className="w-4 h-4 text-text-disabled absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder=""
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className={`pl-9 pr-4 py-2 text-xs rounded-xl w-full md:w-56 outline-none font-mono ${c.bgInput}`}
                />
              </div>

              <div className="relative">
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value as any)}
                  className={`pl-3 pr-8 py-2 text-xs rounded-xl outline-none font-mono cursor-pointer appearance-none ${c.bgInput}`}
                >
                  <option value="all">ALL ROLES</option>
                  <option value="CLI_ADMIN">CLI_ADMIN</option>
                  <option value="LOGIN_ADMIN">LOGIN_ADMIN</option>
                  <option value="SUPPORT_ADMIN">SUPPORT_ADMIN</option>
                  <option value="USER">MEMBER</option>
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-45">
                  <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs font-sans">
              <thead>
                <tr className="text-text-secondary text-[9px] font-black uppercase tracking-widest border-b border-white-5 text-left">
                  <th className="pb-4 pl-2">USER IDENTIFIER</th>
                  <th className="pb-4">USERNAME</th>
                  <th className="pb-4">PRIVILEGE ROLE</th>
                  <th className="pb-4">STATE STATUS</th>
                  <th className="pb-4 text-right pr-2">OPERATIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {users
                  .filter(u => {
                    if (!u) return false;
                    if (userRoleFilter !== 'all') {
                      const filterUpper = userRoleFilter.toUpperCase();
                      const roleUpper = (u.role || '').toUpperCase();
                      // Robust check: both MEMBER and USER option selects query all active standard users
                      if (filterUpper === 'MEMBER' || filterUpper === 'USER') {
                        if (roleUpper !== 'USER' && roleUpper !== 'MEMBER') return false;
                      } else {
                        if (roleUpper !== filterUpper) return false;
                      }
                    }
                    if (userSearch.trim() !== '') {
                      return u.username.toLowerCase().includes(userSearch.toLowerCase());
                    }
                    return true;
                  })
                  .map(u => {
                    const isSystemProtected = 
                      u.role === 'CLI_ADMIN' || 
                      u.role === 'LOGIN_ADMIN' || 
                      u.role?.toUpperCase() === 'SYSTEM' || 
                      u.username.toLowerCase() === 'cli_admin' || 
                      u.username.toLowerCase() === 'admin' || 
                      u.username === 'Velum' || u.username === '@Velum' || u.username === '@@Velum';
                    return (
                      <tr key={u.user_id} className="hover:bg-text-primary-2 transition duration-150">
                        <td className="py-4 pl-2 font-mono text-text-secondary">#{u.user_id}</td>
                        <td className="py-4 font-bold text-text-primary flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-text-primary-5 border border-white-10 flex items-center justify-center font-black text-[10px] text-accent">
                            {u.username.substring(0,2).toUpperCase()}
                          </div>
                          {u.username}
                        </td>
                        <td className="py-4 font-mono">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${
                            u.role === 'CLI_ADMIN' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                            u.role === 'LOGIN_ADMIN' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                            u.role === 'SUPPORT_ADMIN' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            'bg-velum-800/10 text-text-secondary border-white-5'
                          }`}>
                            {u.role || 'USER'}
                          </span>
                        </td>
                        <td className="py-4 font-mono">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8.5px] font-black border uppercase ${
                            u.status === 'active' ? 'bg-status-online/10 text-status-online border-status-online/20' : 'bg-status-dnd/10 text-status-dnd border-status-dnd/20'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-status-online' : 'bg-status-dnd'}`} />
                            {u.status}
                          </span>
                        </td>
                        <td className="py-4 text-right pr-2">
                          {isSystemProtected ? (
                            <span className="text-[10px] font-mono font-bold text-status-away/80 uppercase tracking-widest bg-amber-500/5 px-2.5 py-1 rounded-md border border-amber-500/10 inline-block font-black select-none">[ SYSTEM PROTECTED ]</span>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              {u.status === 'active' ? (
                                <button
                                  onClick={async () => {
                                    const actionRes = await applyQuickSanction(u.username, 'ban', 60, 'Suspended by Direct Directory Override');
                                    if (actionRes.success) alert(`Deactivated @${u.username}`);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg border border-rose-500/10 bg-status-dnd/5 hover:bg-status-dnd hover:text-text-primary transition cursor-pointer text-status-dnd text-[10px] font-semibold uppercase font-mono"
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  onClick={async () => {
                                    try {
                                      const res = await adminFetch(`/api/admin/sanction/revoke`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ targetUserId: u.user_id, type: 'unban' })
                                      });
                                      const data = await res.json();
                                      if (res.ok) {
                                        alert(`Reactivated @${u.username} successfully.`);
                                        fetchData();
                                      } else {
                                        alert(data.error || 'Could not reactivate user.');
                                      }
                                    } catch {
                                      alert('Connection error.');
                                    }
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg border border-emerald-500/10 bg-status-online/5 hover:bg-status-online hover:text-text-primary transition cursor-pointer text-status-online text-[10px] font-semibold uppercase font-mono"
                                >
                                  Reactivate
                                </button>
                              )}
                              
                              {(u.role === 'member' || u.role === 'USER' || u.role === 'user') && (
                                <button
                                  onClick={async () => {
                                    try {
                                      const res = await adminFetch(`/api/admin/nominate`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ 
                                          username: u.username,
                                          targetUsername: u.username
                                        })
                                      });
                                      if (res.ok) {
                                        alert(`Nominated @${u.username} to Operator!`);
                                        fetchData();
                                      } else {
                                        const errData = await res.json();
                                        alert(errData.error || 'Nomination rejected.');
                                      }
                                    } catch {
                                      alert('Server unreachable.');
                                    }
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg border border-accent-20 bg-accent-10 hover:bg-accent text-accent hover:text-text-primary transition cursor-pointer text-[10px] font-semibold uppercase font-mono"
                                >
                                  Promote
                                </button>
                              )}

                              {(adminRole === 'LOGIN_ADMIN' || user?.role === 'CLI_ADMIN') && (
                                <button
                                  onClick={async () => {
                                    if (confirm(`Are you sure you want to permanently delete user @${u.username}?\n\nThis will delete all their messages, tickets, profile, and active sessions permanently with zero recovery backup.`)) {
                                      try {
                                        const res = await adminFetch(`/api/admin/users/${u.user_id}/delete`, {
                                          method: 'POST'
                                        });
                                        if (res.ok) {
                                          alert(`Successfully deleted @${u.username}.`);
                                          fetchData();
                                        } else {
                                          const errData = await res.json();
                                          alert(errData.error || 'Failed to delete user.');
                                        }
                                      } catch {
                                        alert('Error deleting user.');
                                      }
                                    }
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg border border-red-500/20 bg-status-dnd/10 hover:bg-red-500 hover:text-text-primary transition cursor-pointer text-red-400 text-[10px] font-semibold uppercase font-mono"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-text-secondary font-mono text-xs uppercase">// Directory catalog empty //</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. SUPPORT TICKETS QUEUE & THREADS (REDESIGNED AUDIT DESK) */}
      {activeTab === 'tickets' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Top Level Audit KPI Oversight Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`p-4 rounded-xl border ${c.bgPanel} flex flex-col justify-between shadow-md`}>
              <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest font-mono">Total Cases Logged</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black font-mono text-text-primary">{tickets.length}</span>
                <span className="text-[10px] text-text-disabled">dossiers</span>
              </div>
              <div className="h-1 bg-text-primary/[0.04] mt-3 rounded-full overflow-hidden">
                <div className="h-full bg-accent-secondary rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${c.bgPanel} flex flex-col justify-between shadow-md`}>
              <span className="text-[9px] font-bold text-rose-500/80 uppercase tracking-widest font-mono">Active Investigation State</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black font-mono text-status-dnd">
                  {tickets.filter(t => t.status === 'open' || t.status === 'escalated').length}
                </span>
                <span className="text-[10px] text-text-disabled">requires review</span>
              </div>
              <div className="h-1 bg-text-primary/[0.04] mt-3 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-status-dnd rounded-full" 
                  style={{ 
                    width: `${tickets.length ? (tickets.filter(t => t.status === 'open' || t.status === 'escalated').length / tickets.length) * 100 : 0}%` 
                  }}
                ></div>
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${c.bgPanel} flex flex-col justify-between shadow-md`}>
              <span className="text-[9px] font-bold text-status-away/80 uppercase tracking-widest font-mono">Pending Decisions Queue</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black font-mono text-status-away">
                  {tickets.filter(t => t.status === 'pending').length}
                </span>
                <span className="text-[10px] text-text-disabled">hold locks</span>
              </div>
              <div className="h-1 bg-text-primary/[0.04] mt-3 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full" 
                  style={{ 
                    width: `${tickets.length ? (tickets.filter(t => t.status === 'pending').length / tickets.length) * 100 : 0}%` 
                  }}
                ></div>
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${c.bgPanel} flex flex-col justify-between shadow-md`}>
              <span className="text-[9px] font-bold text-status-online/80 uppercase tracking-widest font-mono">Resolved Case Files</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black font-mono text-status-online">
                  {tickets.filter(t => t.status === 'resolved' || t.status === 'approved').length}
                </span>
                <span className="text-[10px] text-status-online/60 font-medium">secured dockets</span>
              </div>
              <div className="h-1 bg-text-primary/[0.04] mt-3 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-status-online rounded-full" 
                  style={{ 
                    width: `${tickets.length ? (tickets.filter(t => t.status === 'resolved' || t.status === 'approved').length / tickets.length) * 100 : 0}%` 
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Central Auditing Controls & Registry Workspace */}
          <div className={`p-5 rounded-2xl border ${c.bgPanel} flex flex-col shadow-xl`}>
            
            {/* Header and Live Search Filters Panel */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white-5 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-accent" />
                <div>
                  <h3 className="font-extrabold text-[12px] uppercase tracking-wider text-text-primary">Case Docket Registry</h3>
                </div>
              </div>

              {/* Filtering Controllers */}
              <div className="flex items-center gap-2.5 w-full md:w-auto">
                <div className="relative flex-grow md:w-64">
                  <Search className="w-3.5 h-3.5 text-text-disabled absolute left-3 w-5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder=""
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                    className={`pl-8 pr-3 py-1.5 text-[11px] rounded-xl w-full outline-none font-mono ${c.bgInput}`}
                  />
                </div>

                <div className="relative">
                  <select
                    value={ticketFilter}
                    onChange={(e) => setTicketFilter(e.target.value as any)}
                    className={`pl-3 pr-8 py-1.5 text-[11px] rounded-xl outline-none font-mono cursor-pointer appearance-none ${c.bgInput} border border-white-5`}
                  >
                    <option value="all">ALL STATUSES</option>
                    <option value="open">OPEN CASES</option>
                    <option value="pending">PENDING</option>
                    <option value="escalated">ESCALATED</option>
                    <option value="resolved">RESOLVED</option>
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                    <svg className="w-3 h-3 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Audit Registry Main Data Table */}
            <div className="overflow-x-auto rounded-xl border border-white-5 bg-velum-850/40">
              <table className="w-full text-xs font-sans text-left border-collapse">
                <thead>
                  <tr className="text-text-secondary/30 text-[9px] font-black uppercase tracking-widest border-b border-white-5">
                    <th className="py-3.5 pl-4">CASE INDICATOR index</th>
                    <th className="py-3.5">SUBMITTER ACCOUNT</th>
                    <th className="py-3.5">CLASSIFICATION MODULE</th>
                    <th className="py-3.5">SECURITY TRUST SCORE</th>
                    <th className="py-3.5">REGISTERED TIMEFRAME</th>
                    <th className="py-3.5">INCIDENT STATE STATUS</th>
                    <th className="py-3.5 text-right pr-4">OVERSIGHT HANDLER</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {filteredTickets.map(ticket => {
                    const cleanType = (ticket.issue_type || '').replace(/_/g, ' ');
                    let trustBadge = '';
                    if (ticket.credibility_score !== undefined) {
                      trustBadge = ticket.credibility_score >= 85 
                        ? 'text-status-online bg-status-online/5 border-emerald-500/10 hover:bg-status-online/10' 
                        : 'text-status-dnd bg-status-dnd/5 border-rose-500/10 hover:bg-status-dnd/10';
                    } else {
                      trustBadge = 'text-text-secondary bg-text-secondary/5 border-white-5';
                    }

                    return (
                      <tr key={ticket.ticket_id} className="hover:bg-text-primary-2 transition-all duration-150 group">
                        <td className="py-3.5 pl-4 font-mono text-[10.5px] font-bold text-accent">
                          <button 
                            onClick={() => {
                              setActiveTicket(ticket);
                              setReplyText('');
                            }}
                            className="hover:underline cursor-pointer text-left block"
                          >
                            #{ticket.ticket_id.slice(0, 12).toUpperCase()}...
                          </button>
                        </td>
                        <td className="py-3.5">
                          <div className="flex flex-col">
                            <span className="text-text-primary font-bold">@{ticket.username || 'Anonymous'}</span>
                            <span className="text-[9px] font-mono text-text-secondary">ID: {ticket.user_id}</span>
                          </div>
                        </td>
                        <td className="py-3.5">
                          <span className="font-extrabold text-[9px] uppercase tracking-wide px-2 py-0.5 rounded-md bg-text-primary-5 border border-white-10 font-mono text-text-primary">
                            {cleanType}
                          </span>
                        </td>
                        <td className="py-3.5 font-mono text-[10px]">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[8.5px] font-black uppercase ${trustBadge}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                            {ticket.credibility_score !== undefined ? `${ticket.credibility_score}% TRUST` : 'UNRATED'}
                          </span>
                        </td>
                        <td className="py-3.5 font-mono text-text-secondary/50 text-[10.5px]">
                          {new Date(ticket.created_at).toLocaleString()}
                        </td>
                        <td className="py-3.5">
                          <span className={`text-[9px] uppercase px-2.5 py-0.5 rounded-full font-mono font-black ${
                            ticket.status === 'open' ? c.statusOpen :
                            ticket.status === 'pending' ? c.statusPending :
                            ticket.status === 'escalated' ? c.statusEscalated :
                            ticket.status === 'resolved' ? c.statusResolved : 'bg-gray-800'
                          }`}>
                            {ticket.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-right pr-4">
                          <button
                            onClick={() => {
                              setActiveTicket(ticket);
                              setReplyText('');
                            }}
                            className="inline-flex items-center gap-1 bg-accent-10 text-accent hover:bg-accent hover:text-text-primary px-3 py-1.5 rounded-lg text-[9.5px] font-black uppercase font-mono tracking-wider border border-accent-20 transition duration-150 cursor-pointer"
                          >
                            <span>Inspect Case</span>
                            <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredTickets.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-20 text-center text-text-disabled font-mono text-[10px] uppercase font-bold tracking-widest bg-black/10">
                        // No dispute tickets detected matching filter queries //
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* S_SHEET WORKSPACE: Modern Flying Sidebar/Panel sliding from the RIGHT (NOT BOTTOM) */}
          {activeTicket && (
            <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
              
              {/* Backing Blur Overlay */}
              <div 
                className="absolute inset-0 bg-black-60 backdrop-blur-sm transition-opacity duration-300"
                onClick={() => {
                  setActiveTicket(null);
                  setReplyText('');
                }}
              />

              {/* Sliding Flying Panel Container */}
              <div className="relative w-full max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl bg-velum-850 border-l border-white-5 h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-slideLeft">
                
                {/* Fixed Panel Header */}
                <div className="p-5 border-b border-white-5 bg-velum-850 flex items-center justify-between flex-shrink-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-black text-accent uppercase tracking-wider bg-accent-10 px-2.5 py-0.5 rounded-full">
                        {(activeTicket.issue_type || '').replace(/_/g, ' ')}
                      </span>
                      <span className={`text-[8.5px] uppercase px-2 py-0.5 rounded font-mono font-bold border ${
                        activeTicket.status === 'open' ? c.statusOpen :
                        activeTicket.status === 'pending' ? c.statusPending :
                        activeTicket.status === 'escalated' ? c.statusEscalated :
                        activeTicket.status === 'resolved' ? c.statusResolved : 'bg-gray-800'
                      }`}>
                        {activeTicket.status}
                      </span>
                    </div>
                    <h2 className="text-sm font-black tracking-widest text-text-primary font-mono mt-1">
                      AUDIT INTERACTION DISPATCH // CASE-ID: #{activeTicket.ticket_id}
                    </h2>
                  </div>
                  <button 
                    onClick={() => {
                      setActiveTicket(null);
                      setReplyText('');
                    }}
                    className="p-2.5 rounded-lg border border-white-5 text-text-secondary hover:text-text-primary hover:bg-text-primary-5 transition cursor-pointer"
                    title="Close Audit Workspace"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Main Content Area (Split into Correspondence History Timeline, logs & details) */}
                <div className="flex-1 overflow-y-auto space-y-4 p-6 min-h-0 divide-y divide-white/[0.03]">
                  
                  {/* Metadata and Threat level scorecard logs layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                    <div className="space-y-2">
                      <span className="text-[8.5px] uppercase font-bold text-text-secondary tracking-wider font-mono block">Dossier Audit Coordinates</span>
                      <div className="bg-velum-750 border border-white-5 p-3 rounded-lg space-y-1.5 font-mono text-[10px]">
                        <div className="flex justify-between"><span className="text-text-secondary">CLIENT USER SYSTEM ID:</span> <span className="text-text-primary font-bold">{activeTicket.user_id}</span></div>
                        <div className="flex justify-between"><span className="text-text-secondary">IDENTITY HANDLE:</span> <span className="text-accent font-black">@{activeTicket.username || 'Anonymous'}</span></div>
                        <div className="flex justify-between"><span className="text-text-secondary">REGISTRATION TIMEFRAME:</span> <span className="text-text-secondary">{new Date(activeTicket.created_at).toLocaleString()}</span></div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[8.5px] uppercase font-bold text-text-secondary tracking-wider font-mono block">System Trust Credibility Meter</span>
                      <div className="bg-velum-750 border border-white-5 p-3 rounded-lg flex flex-col justify-between h-[64px]">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-mono text-text-secondary">CVP INTEGRITY MATRIX:</span>
                          <span className={`text-[10px] font-mono font-bold ${
                            activeTicket.credibility_score !== undefined && activeTicket.credibility_score >= 85 ? 'text-status-online' : 'text-status-dnd'
                          }`}>
                            {activeTicket.credibility_score !== undefined ? `${activeTicket.credibility_score}% TRUST SCORE` : 'UNKNOWN'}
                          </span>
                        </div>
                        <div className="h-1.5 bg-text-primary-2 rounded-full overflow-hidden mt-1.5">
                          <div 
                            className={`h-full rounded-full ${
                              activeTicket.credibility_score !== undefined && activeTicket.credibility_score >= 85 ? 'bg-status-online' : 'bg-status-dnd'
                            }`}
                            style={{ width: `${activeTicket.credibility_score !== undefined ? activeTicket.credibility_score : 40}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Operational Timeline / Interactive Chat Log Stream */}
                  <div className="pt-4 space-y-3">
                    <span className="text-[8.5px] uppercase font-bold text-text-secondary tracking-wider font-mono block mb-1">
                      Case Tracking Correspondence Timeline
                    </span>

                    <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1.5 scrollbar-thin">
                      {(activeTicket.messages || []).map((m, idx) => {
                        const isAdminSender = m.sender_name.includes('ADMIN') || m.sender_name.includes('SUPPORT') || m.sender_id === adminId;
                        return (
                          <div 
                            key={idx} 
                            className={`p-3.5 rounded-xl border text-[11px] leading-relaxed transition-all ${
                              isAdminSender 
                                ? 'bg-velum-800 border-accent-20 text-text-primary ml-6 relative before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-accent before:rounded-l-xl' 
                                : 'bg-velum-850 border-white-5 text-text-primary mr-6'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1.5 font-mono text-[9px] tracking-wide">
                              <span className={`font-black ${isAdminSender ? 'text-accent' : 'text-text-secondary'}`}>
                                {isAdminSender ? '📢 CENTRAL OVERSIGHT' : '👤 END-USER SENDER'} &bull; {m.sender_name}
                              </span>
                              <span className="opacity-45 text-text-secondary">{new Date(m.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className="font-normal whitespace-pre-wrap font-sans text-xs">{m.content}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active administrative restoration panel */}
                  {activeTicket.status !== 'resolved' && activeTicket.issue_type === 'recovery_request' && (
                    <div className="pt-4">
                      <div className="p-4 bg-accent/5 border border-accent-20 rounded-xl space-y-2.5">
                        <div className="flex items-center gap-1.5">
                          <Key className="w-4 h-4 text-accent animate-pulse" />
                          <span className="text-[10px] font-mono font-black text-accent uppercase tracking-wider">
                            Quarantine Access Controls Gate
                          </span>
                        </div>
                        <p className="text-[10px] text-text-secondary leading-relaxed">
                          Verify request authenticity, transaction metadata logs, and credibility matrix. Restoring accounts grants instant recovery tokens bypass.
                        </p>

                        {adminRole !== 'LOGIN_ADMIN' ? (
                          <div className="bg-orange-500/10 text-orange-400 p-3 rounded-lg text-[9px] font-mono text-center font-bold tracking-wide uppercase">
                            APPROVAL LOCKED: INSUFFICIENT ACCESS PRIVILEGES (LOGIN_ADMIN NEEDED).
                          </div>
                        ) : activeTicket.credibility_score !== undefined && activeTicket.credibility_score < 85 ? (
                          <div className="bg-status-dnd/10 text-status-dnd p-3 rounded-lg text-[9px] font-mono text-center font-bold tracking-wide uppercase">
                            AUTHORIZATION BLOCKED: HIGH SYSTEM RISK (TRUST METER UNDER REGULATORY MINIMUM).
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => approveQuarantineAccess(activeTicket.user_id.toString(), 'approve')}
                            className="w-full bg-accent hover:bg-accent-hover text-text-primary font-extrabold py-2.5 px-4 rounded-xl text-[10px] uppercase tracking-wider cursor-pointer text-center transition-all border-0 shadow-lg shadow-accent-20"
                          >
                            RESTORE SYSTEM COMPROMISED ACCOUNT
                          </button>
                        )}

                        {restoreCode && (
                          <div className="p-3 bg-status-online/10 border border-emerald-500/20 text-status-online font-mono text-[10px] text-center rounded-xl animate-pulse">
                            AUTHENTICATED RECOVERY CREDENTIAL CODE GENERATED: 
                            <span className="text-text-primary font-mono font-extrabold select-all ml-1.5 bg-velum-900/60 px-2 py-1 rounded border border-status-online/30">
                              {restoreCode}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Operations Base: Fixed Decision Response Input form */}
                <div className="p-5 border-t border-white-5 bg-velum-850 flex-shrink-0 space-y-4">
                  {activeTicket.status !== 'resolved' ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[9px] uppercase font-bold text-text-secondary font-mono tracking-widest">
                          Type Case Reply Notes or Dispatch correspondence
                        </label>
                        <span className="text-[9px] text-text-secondary font-mono font-bold">
                          {activeTicket.status} &bull; action state
                        </span>
                      </div>

                      <textarea
                        rows={3}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder=""
                        className={`w-full text-xs rounded-xl p-3 outline-none resize-none transition-all font-mono ${c.bgInput} border border-white-5 focus:border-accent-40`}
                      />

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex gap-2.5">
                          <button
                            onClick={() => handleTicketReply(false, false)}
                            className="bg-accent hover:bg-accent-hover text-text-primary font-extrabold px-5 py-2.5 rounded-xl cursor-pointer text-xs uppercase tracking-wider transition-all shadow-md border-0"
                          >
                            Respond
                          </button>
                          
                          {adminRole === 'SUPPORT_ADMIN' ? (
                            <button
                              onClick={() => handleTicketReply(false, true)}
                              className="bg-violet-600 hover:bg-violet-750 text-text-primary font-extrabold px-5 py-2.5 rounded-xl cursor-pointer text-xs uppercase tracking-wider transition-all shadow-md border-0"
                            >
                              Escalate
                            </button>
                          ) : (
                            <div className="font-extrabold px-3 py-2.5 rounded-xl border text-center flex items-center justify-center text-text-disabled border-white-5 text-[10px] uppercase font-mono tracking-wider">
                              Executive Desk Level
                            </div>
                          )}

                          <button
                            onClick={() => handleTicketReply(true, false)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-text-primary font-extrabold px-4 py-2.5 rounded-xl cursor-pointer text-xs uppercase tracking-wider transition-all shadow-md border-0"
                          >
                            Close Case
                          </button>
                        </div>

                        {(adminRole === 'LOGIN_ADMIN' || user?.role === 'CLI_ADMIN') && (
                          <button
                            onClick={async () => {
                              if (confirm(`Are you sure you want to permanently delete ticket case #${activeTicket.ticket_id}?\n\nThis will delete all correspondence and activity logs with zero option of rollback.`)) {
                                try {
                                  const res = await adminFetch(`/api/admin/tickets/${activeTicket.ticket_id}/delete`, {
                                    method: 'POST'
                                  });
                                  if (res.ok) {
                                    alert(`Ticket Case #${activeTicket.ticket_id} successfully deleted.`);
                                    setActiveTicket(null);
                                    fetchData();
                                  } else {
                                    const errData = await res.json();
                                    alert(errData.error || 'Failed to delete ticket.');
                                  }
                                } catch {
                                  alert('Network error.');
                                }
                              }
                            }}
                            className="p-2.5 rounded-xl bg-status-dnd/10 hover:bg-rose-600 text-status-dnd hover:text-text-primary transition duration-150 cursor-pointer border border-status-dnd/10"
                            title="Delete Case Dossier File"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-status-online/10 text-status-online text-center py-4 px-6 rounded-xl border border-emerald-500/15 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>[ Case Containment Secured Successfully ]</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. USER REPORTS COMPLAINTS & SYSTEM BUG VIEW */}
      {activeTab === 'reports' && (
        <div className={`p-6 rounded-2xl border ${c.bgPanel} shadow-xl animate-fadeIn`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white-5 pb-5 mb-6">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-status-away" />
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider">Reports &amp; Disputes</h3>
              </div>
            </div>

            {/* Custom categorizer */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setReportFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase border transition cursor-pointer ${
                  reportFilter === 'all' ? 'bg-accent-20 text-text-primary border-accent-40' : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                All Reports
              </button>
              <button
                onClick={() => setReportFilter('complaints')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase border transition cursor-pointer ${
                  reportFilter === 'complaints' ? 'bg-status-dnd/20 text-status-dnd border-rose-500/30' : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                User Disputes
              </button>
              <button
                onClick={() => setReportFilter('bugs')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase border transition cursor-pointer ${
                  reportFilter === 'bugs' ? 'bg-amber-500/20 text-status-away border-amber-500/30' : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                System Bugs
              </button>
              <button
                onClick={() => setReportFilter('suggestions')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase border transition cursor-pointer ${
                  reportFilter === 'suggestions' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                Suggestions
              </button>
            </div>
          </div>

          {/* Redesigned highly structured table display */}
          <div className={`overflow-x-auto rounded-xl border ${c.border} bg-velum-850`}>
            <table className="w-full text-xs font-sans text-left border-collapse">
              <thead>
                <tr className="text-text-secondary text-[9px] font-black uppercase tracking-widest border-b border-white-5">
                  <th className="py-4 pl-4">CASE ID</th>
                  <th className="py-4">REPORT TYPE</th>
                  <th className="py-4">SUBMITTER</th>
                  <th className="py-4 max-w-sm">STATEMENT / COMPLAINT LOGS</th>
                  <th className="py-4">DATE SUBMITTED</th>
                  <th className="py-4 text-right pr-4">OPERATIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {reportsList.map((rep) => (
                  <tr key={rep.ticket_id} className="hover:bg-text-primary-2 transition duration-150">
                    <td className="py-4 pl-4 font-mono text-accent font-black">#{rep.ticket_id}</td>
                    <td className="py-4">
                      <span className="font-bold text-text-primary uppercase text-[9.5px] px-2 py-0.5 rounded bg-text-primary-5 border border-white-10 font-mono">
                        {(rep.issue_type || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-4 text-text-primary font-bold">{rep.username || 'Anonymous'}</td>
                    <td className="py-4 text-text-secondary font-medium max-w-sm truncate leading-snug">
                      <span className="italic">"{(rep.messages || [])[0]?.content || 'Empty dispute content.'}"</span>
                    </td>
                    <td className="py-4 font-mono text-text-secondary text-[10px]">
                      {new Date(rep.created_at).toLocaleString()}
                    </td>
                    <td className="py-4 text-right pr-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setActiveTicket(rep);
                            onTabChange?.('tickets');
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-accent-20 bg-accent-10 hover:bg-accent text-accent hover:text-text-primary text-[10px] font-bold font-mono uppercase transition cursor-pointer"
                        >
                          Investigate
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const res = await adminFetch(`/api/admin/tickets/${rep.ticket_id}/reply`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ adminId, content: 'Case closed by central oversight catalog.', closeTicket: true })
                              });
                              if (res.ok) {
                                alert(`Case closed successfully.`);
                                fetchData();
                              }
                            } catch {
                              alert('Operation failed.');
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-red-500/10 bg-status-dnd/5 hover:bg-red-500 text-red-105 hover:text-text-primary text-[10px] font-bold font-mono uppercase transition cursor-pointer"
                        >
                          Close
                        </button>
                        {(adminRole === 'LOGIN_ADMIN' || user?.role === 'CLI_ADMIN') && (
                          <button
                            onClick={async () => {
                              if (confirm(`ALERT: Are you absolutely sure you want to permanently delete ticket case #${rep.ticket_id}?`)) {
                                try {
                                  const res = await adminFetch(`/api/admin/tickets/${rep.ticket_id}/delete`, {
                                    method: 'POST'
                                  });
                                  if (res.ok) {
                                    alert(`Case #${rep.ticket_id} successfully deleted.`);
                                    fetchData();
                                  } else {
                                    alert('Failed to delete case.');
                                  }
                                } catch {
                                  alert('Server unreachable.');
                                }
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-red-500/20 bg-status-dnd/10 hover:bg-red-500 hover:text-text-primary text-red-400 text-[10px] font-bold font-mono uppercase transition cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reportsList.length === 0 && (
              <div className="text-center py-20 text-text-disabled font-mono text-xs uppercase">// Zero reporting catalogs filed in databases //</div>
            )}
          </div>
        </div>
      )}

      {/* 5. REDESIGNED CHANNEL AND COMMUNICATIONS WORKSPACE */}
      {activeTab === 'announcements' && (() => {
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
          ? 'Active broadcasting and peer lounge communication'
          : selectedChannel === 'secops'
          ? 'Confidential coordination with fellow active operations administrators'
          : currentRoom?.permissions?.isPrivate
          ? 'Privately encrypted secure user discussion room'
          : 'Public user communication lounge';

        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn font-sans h-full">
            {/* Left Column: Coordinates / Channels Directory list */}
            <div className={`lg:col-span-4 space-y-4 ${announcementsMobileView === 'list' ? 'block w-full' : 'hidden lg:block'}`}>
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
                        selectedChannel === 'velum_lounge' || SUBLOUNGES.some(s => s.id === selectedChannel)
                          ? 'bg-accent-10 text-text-primary border-accent-40 shadow-[0_4px_12px_rgba(212,131,106,0.05)]' 
                          : 'bg-transparent border-transparent hover:bg-text-primary-2 text-text-secondary'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`p-2.5 rounded-xl ${(selectedChannel === 'velum_lounge' || SUBLOUNGES.some(s => s.id === selectedChannel)) ? 'bg-accent-20 text-accent-hover' : 'bg-text-primary-2 text-text-secondary'} transition shrink-0`}>
                          <Globe className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold tracking-wide text-text-primary truncate">Velum Lounge</span>
                            <span className="text-[8px] font-mono px-2 py-0.5 rounded-md bg-status-online/10 text-status-online font-extrabold uppercase tracking-wide shrink-0">Lobby</span>
                          </div>
                          <span className="text-[10px] text-text-secondary block leading-normal mt-1 font-medium font-sans truncate">
                            Standard network-wide communication coordinate.
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isVelumExpanded ? 'rotate-90' : ''} text-text-secondary shrink-0`} />
                    </button>

                    {/* Sublounges list under Velum Lounge */}
                    {isVelumExpanded && (
                      <div className="pl-6 pt-1.5 space-y-1 border-l border-white-5 ml-5">
                        {SUBLOUNGES.map(sub => (
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
                    <div className={`p-2.5 rounded-xl ${selectedChannel === 'secops' ? 'bg-accent-20 text-status-dnd' : 'bg-text-primary-2 text-text-secondary'} mt-0.5 transition`}>
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold tracking-wide text-text-primary truncate">Admins SecOps</span>
                        <span className="text-[8px] font-mono px-2 py-0.5 rounded-md bg-status-dnd/10 text-status-dnd font-extrabold uppercase tracking-wide">Secret</span>
                      </div>
                      <span className="text-[10px] text-text-secondary block leading-normal mt-1 font-medium font-sans">
                        Restricted administrative war-room workspace.
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
                  {availableRooms.filter(r => r.room_id !== 'velum_lounge' && r.room_id !== 'secops' && !r.room_id.startsWith('dm_')).length === 0 ? (
                    <div className="text-center py-8 text-text-secondary font-mono text-[9px] uppercase leading-relaxed font-bold border border-dashed border-white-5 rounded-xl select-none">
                      // No user channels launched //
                    </div>
                  ) : (
                    availableRooms
                      .filter(r => r.room_id !== 'velum_lounge' && r.room_id !== 'secops' && !r.room_id.startsWith('dm_'))
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
                            <div className={`p-2 rounded-lg mt-0.5 transition ${isCurrent ? 'bg-accent-20 text-accent-hover' : 'bg-text-primary-2 text-text-secondary'}`}>
                              <MessageSquare className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-xs font-bold truncate text-text-primary leading-none">{room.name}</span>
                                <span className={`text-[7px] font-mono px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider ${isPrivate ? 'bg-status-dnd/10 text-status-dnd border border-rose-500/15' : 'bg-status-online/10 text-status-online'}`}>
                                  {isPrivate ? 'Private' : 'Public'}
                                </span>
                              </div>
                              <span className="text-[9px] text-text-secondary block truncate mt-1.5 font-mono">ID: {room.room_id}</span>
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
                  Administrative audit trails track room operations. You can monitor user-spawned rooms dynamically and post replies as administrator. All operations are signed securely.
                </p>
              </div>

              {/* Active Profile & Signout */}
              <div className="bg-velum-800 border border-white-5 rounded-2xl p-4 shadow-xl flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8.5 h-8.5 rounded-xl bg-velum-800 flex items-center justify-center text-xs font-mono font-bold text-text-primary shrink-0">
                    {user?.username?.replace('@', '').charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div className="min-w-0 leading-tight">
                    <span className="text-xs font-bold block text-text-primary truncate">@{stripAt(user?.username || 'Admin')}</span>
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
            <div className={`lg:col-span-8 flex flex-col h-[560px] rounded-2xl border border-white-5 bg-velum-800 overflow-hidden shadow-2xl ${announcementsMobileView === 'chat' ? 'flex w-full' : 'hidden lg:flex'}`}>
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
                    <p className="text-[10px] text-text-secondary font-medium mt-0.5">
                      {displayHeaderDesc}
                    </p>
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
                    <p className="text-[9px] font-mono text-text-secondary uppercase select-none tracking-widest">// No active records synchronized in local stream //</p>
                  </div>
                ) : (
                  channelMessages.map((msg, index) => {
                    const isSystemBroadcast = msg.user_id === 999;
                    const broadcastMatch = isSystemBroadcast ? msg.content.match(/^\[BROADCAST FROM ([^\]]+)\]:\s*/i) : null;
                    const senderSignature = broadcastMatch ? broadcastMatch[1] : null;
                    
                    let activeContent = msg.content || '';
                    if (activeContent && (msg.is_encrypted || msg.isEncrypted || activeContent.startsWith('VEL_E2EE['))) {
                      let cleanCipher = activeContent;
                      if (cleanCipher.startsWith('VEL_E2EE[')) {
                        cleanCipher = cleanCipher.substring(9, cleanCipher.length - 1);
                      }
                      activeContent = decryptE2E(cleanCipher, 'VELUM_E2EE_' + (msg.room_id || selectedChannel));
                    }

                    const cleanedContent = isSystemBroadcast 
                      ? activeContent.replace(/^\[BROADCAST FROM [^\]]+\]:\s*/i, '').replace(/^\[DIRECT SECURITY WIRE\]\s*/i, '')
                      : activeContent;

                    // Resolve custom profiles & colors for distinct personas
                    let isSpecialProfile = false;
                    let displayProfileName = msg.username ? stripAt(msg.username) : `User #${msg.user_id}`;
                    let roleBadgeText = "";
                    let customBadgeClass = "";
                    let customBubbleClass = "";

                    const lowercaseUsername = msg.username?.toLowerCase() || '';

                    const isSupportAdmin = lowercaseUsername.startsWith('sa-') || lowercaseUsername.startsWith('@sa-');

                    if (msg.user_id === 1 || lowercaseUsername === 'midnight' || lowercaseUsername === 'cli-exec' || displayProfileName === 'Midnight' || displayProfileName === 'cli-exec') {
                      isSpecialProfile = true;
                      displayProfileName = "MIDNIGHT (executive)";
                      roleBadgeText = "Executive";
                      customBadgeClass = "text-accent bg-accent-10 border-l border-accent-40";
                      customBubbleClass = "bg-accent-20 border border-accent-40 text-text-primary rounded-2xl rounded-tl-none shadow-md";
                    } else if (msg.user_id === 999 || lowercaseUsername === 'velum' || lowercaseUsername === 'velum-msg' || displayProfileName === 'Velum' || displayProfileName === 'velum-msg') {
                      isSpecialProfile = true;
                      displayProfileName = "VELUM";
                      roleBadgeText = "System";
                      customBadgeClass = "text-status-online bg-status-online/10 border-l border-emerald-500/45";
                      customBubbleClass = "bg-emerald-950/45 border border-emerald-500/35 text-emerald-100 rounded-2xl rounded-tl-none shadow-[0_4px_12px_rgba(16,185,129,0.03)]";
                    } else if (isSupportAdmin) {
                      isSpecialProfile = true;
                      displayProfileName = displayProfileName.includes('(') ? displayProfileName : `${displayProfileName} (Support)`;
                      roleBadgeText = "Ops Support";
                      customBadgeClass = "text-accent-secondary bg-accent-secondary-10 border-l border-accent-secondary-20";
                      customBubbleClass = "bg-accent-secondary-10 border border-accent-secondary-20 border-l-[3px] border-l-accent-secondary text-text-primary shadow-md";
                    }

                    return (
                      <div key={msg.message_id || index} className="w-full">
                        {isSystemBroadcast ? (
                          // Premium official secure broadcast design
                          <div className="mx-auto max-w-xl bg-velum-800 border border-white-5 border-l-[4px] border-l-accent rounded-xl p-4 shadow-xl select-none transition hover:border-white-10">
                            <div className="flex items-center justify-between gap-3 border-b border-white-5 pb-2.5 mb-2.5">
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-accent-20 border border-accent-20 text-[8.5px] font-mono font-black text-accent uppercase tracking-wider">
                                <Megaphone className="w-2.5 h-2.5 text-accent" /> OFFICIAL DISPATCH
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-mono text-text-secondary uppercase tracking-widest font-extrabold flex items-center gap-1">
                                  Operator: <span className="text-text-primary font-bold">@{senderSignature || 'System Admin'}</span>
                                  <BadgeCheck className="w-3.5 h-3.5 text-sky-400 fill-sky-400 ml-0.5 shrink-0" />
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-text-primary leading-relaxed font-sans font-medium whitespace-pre-wrap">{cleanedContent}</p>
                            <div className="flex items-center justify-between border-t border-white-5 pt-2 mt-2.5">
                              <span className="text-[8px] font-mono text-accent/60 font-bold uppercase tracking-wider">SECURE BROADCAST ENVELOPE</span>
                              <span className="text-[8.5px] font-mono text-text-secondary font-medium">{new Date(msg.timestamp).toLocaleString()}</span>
                            </div>
                          </div>
                        ) : (
                          // Standard & Verified administrative messages inside control console
                          <div className={`flex flex-col max-w-[85%] ${msg.username === user?.username ? 'ml-auto text-right items-end' : 'mr-auto text-left items-start'}`}>
                            {/* Message Sender Header */}
                            <div className="flex items-center gap-1.5 mb-1.5 text-[9.5px] font-mono text-text-secondary select-none">
                              {msg.username === user?.username ? (
                                <>
                                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  <span className="font-extrabold text-accent">@you</span>
                                </>
                              ) : (
                                <>
                                  <span className="font-extrabold text-text-secondary">@{displayProfileName}</span>
                                  {isSpecialProfile && (
                                    <>
                                      <span className={`text-[7px] font-mono px-1.5 py-0.2 rounded font-black uppercase ${customBadgeClass}`}>
                                        {roleBadgeText}
                                      </span>
                                      <BadgeCheck className="w-4 h-4 text-sky-400 fill-sky-400 shrink-0 inline-block align-middle ml-0.5" />
                                    </>
                                  )}
                                  <span>•</span>
                                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </>
                              )}
                            </div>

                            {/* Chat bubble element */}
                            <div className={`p-3.5 rounded-2xl text-[11.5px] font-sans leading-relaxed whitespace-pre-wrap ${
                              isSpecialProfile 
                                ? customBubbleClass 
                                : msg.username === user?.username 
                                ? 'bg-accent-10 border border-accent-20 border-r-[3px] border-r-accent text-text-primary shadow-lg shadow-black/10' 
                                : 'bg-velum-800 border border-white-5 text-text-primary shadow-md'
                            }`}>
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
              <form onSubmit={handleSendChannelMessage} className="p-4 bg-velum-850 border-t border-white-5 space-y-3">
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
                          ? (broadcastAlert ? "/📢 Write system broadcast bulletin to dispatch..." : "/🔒 Send secure executive coordination log entry...") 
                          : selectedChannel === 'velum_lounge'
                          ? "/✍️ Compose global lounge message..."
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
      })()}



      {/* 7. SYSTEM CONFIG & GATEWAY LOCKS */}
      {activeTab === 'system' && (
        <div className="space-y-6 animate-fadeIn">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Entry code creation layout */}
            <div className={`p-6 rounded-2xl border ${c.bgPanel} shadow-xl flex flex-col justify-between`}>
              <div>
                <div className="flex items-center gap-2 border-b border-white-5 pb-3 mb-4">
                  <UserPlus className="w-4.5 h-4.5 text-accent-hover" />
                  <h4 className="font-extrabold text-[12px] uppercase tracking-wider text-text-primary">Issue Entry Code Key</h4>
                </div>
                <div className="space-y-4 font-sans text-xs">
                  <div>
                    <label className="block text-[9px] text-text-secondary font-black uppercase mb-2 tracking-widest font-mono">Expiry Days limit</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={invDays}
                        onChange={(e) => setInvDays(parseInt(e.target.value, 10))}
                        className={`p-3 rounded-xl w-24 outline-none text-center font-mono ${c.bgInput}`}
                      />
                      <span className="text-text-secondary text-[10px] font-mono uppercase font-bold">Days Active</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-5 space-y-3">
                {adminRole !== 'LOGIN_ADMIN' ? (
                  <div className="bg-orange-500/10 text-orange-400 p-3.5 rounded-xl text-[9px] font-mono text-center font-bold tracking-wide uppercase leading-normal border border-orange-500/20">
                    ACCESS LOCKED: ONLY EXECUTIVE LOGIN_ADMIN LEVEL PRIVILEGE GATES PERMIT GENERATING ENTRY ENROLLMENT SCHEMAS.
                  </div>
                ) : (
                  <>
                    <button
                      onClick={generateNewInvite}
                      className="w-full bg-accent-hover hover:bg-accent text-black font-extrabold py-3 rounded-xl transition border-0 cursor-pointer shadow-md uppercase font-mono tracking-wider text-[10px]"
                    >
                      Issue New Entry Validation Key
                    </button>
                    {newCodeInfo && (
                      <div className="p-3.5 bg-accent-hover/10 border border-accent-hover/15 text-accent-hover rounded-xl font-mono text-xs font-black tracking-wider block text-center uppercase">
                        Verification Key: <strong className="text-red-500 select-all font-black ml-1 font-sans">{newCodeInfo}</strong>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Gateway Lockdown emergency triggers */}
            <div className={`p-6 rounded-2xl border ${c.bgPanel} shadow-xl flex flex-col justify-between`}>
              <div>
                <div className="flex items-center gap-2 border-b border-white-5 pb-3 mb-4">
                  <Unlock className="w-4.5 h-4.5 text-orange-400" />
                  <h4 className="font-extrabold text-[12px] uppercase tracking-wider text-text-primary">Security Containment System</h4>
                </div>
                
                <p className="text-xs text-text-secondary leading-relaxed font-sans mb-4">
                  In case of compromise alerts, emergency lockdown forces immediate token revokes, blocks registrations, and freezes socket connections.
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {adminRole !== 'LOGIN_ADMIN' ? (
                  <div className="bg-status-dnd/10 text-status-dnd p-3.5 rounded-xl text-[9px] font-mono text-center font-bold tracking-wide uppercase leading-normal border border-rose-500/20">
                    ACCESS LOCKED: DISPATCHING CENTRAL CONTAINER LOCKDOWNS RESTRICTED TO EXECUTIVE OVERWATCH LEVEL.
                  </div>
                ) : (
                  <>
                    {isGatewayLocked ? (
                      <button
                        onClick={() => {
                          setIsGatewayLocked(false);
                          alert('Gateway lockdown lifted.');
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-text-primary font-extrabold py-3 rounded-xl transition border-0 cursor-pointer shadow-md uppercase font-mono tracking-wider text-[10px]"
                      >
                        Lift Gateway Lockdown
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setIsGatewayLocked(true);
                          alert('Emergency lockdown activated.');
                        }}
                        className="w-full bg-red-650 hover:bg-red-700 text-text-primary font-extrabold py-3 rounded-xl transition border-0 cursor-pointer shadow-md uppercase font-mono tracking-wider text-[10px]"
                      >
                        Deploy Gateway Lockdown Override
                      </button>
                    )}
                    <div className="p-3 text-[9.5px] font-mono text-text-disabled uppercase tracking-wide leading-relaxed">
                      Status: {isGatewayLocked ? <span className="text-red-500 font-black">LOCKED DOWN</span> : <span className="text-status-online font-bold">SECURED OPEN</span>}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Admin Rotations panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className={`p-6 rounded-2xl border ${c.bgPanel} shadow-xl flex flex-col justify-between`}>
              <div>
                <div className="flex items-center gap-2 border-b border-white-5 pb-3 mb-4">
                  <RefreshCw className="w-4.5 h-4.5 text-purple-400" />
                  <h4 className="font-extrabold text-[12px] uppercase tracking-wider text-text-primary">Rotate Admin Credentials</h4>
                </div>
                <form onSubmit={rotateExecutiveCredentials} className="space-y-4 font-sans text-xs">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono">New Handle</label>
                      <input
                        type="text"
                        value={rotatedUsername}
                        onChange={(e) => setRotatedUsername(e.target.value)}
                        placeholder=""
                        className={`w-full p-3 rounded-xl outline-none ${c.bgInput}`}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono">New Secret Key</label>
                      <PasswordInput
                       value={rotatedPassword}
                       onChange={(e) => setRotatedPassword(e.target.value)}
                       placeholder=""
                       className={`w-full p-3 rounded-xl outline-none ${c.bgInput}`}
                      />
                    </div>
                  </div>
                </form>
              </div>

              <div className="mt-5 space-y-3">
                {adminRole !== 'LOGIN_ADMIN' ? (
                  <div className="bg-orange-500/10 text-orange-400 p-3.5 rounded-xl text-[9px] font-mono text-center font-bold tracking-wide uppercase leading-normal border border-orange-500/20">
                    ACCESS LOCKED: CREDENTIAL ROTATIONS FOR EXECUTIVE TERMINALS FORBIDDEN FOR STANDARD OPERATIONS DEPUTY.
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={rotateExecutiveCredentials}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-text-primary font-extrabold py-3 rounded-xl text-[10px] uppercase tracking-wider transition border-0 cursor-pointer shadow-md font-mono"
                    >
                      Commit System Rotate
                    </button>
                    {rotationResult && (
                      <div className="p-3 bg-purple-500/10 border border-purple-500/15 text-purple-400 rounded-xl text-xs font-mono font-bold leading-normal text-center">
                        {rotationResult}
                      </div>
                    )}
                    {rotationError && (
                      <div className="p-3 bg-status-dnd/10 border border-rose-500/15 text-status-dnd rounded-xl text-xs font-mono font-bold leading-normal text-center">
                        {rotationError}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* quarantine checking tool */}
            <div className={`p-6 rounded-2xl border ${c.bgPanel} shadow-xl flex flex-col justify-between`}>
              <div>
                <div className="flex items-center gap-2 border-b border-white-5 pb-3 mb-4">
                  <Sliders className="w-4.5 h-4.5 text-accent-hover" />
                  <h4 className="font-extrabold text-[12px] uppercase tracking-wider text-text-primary">Manual Account Restore</h4>
                </div>
                <div className="space-y-4 font-sans text-xs">
                  <div>
                    <label className="block text-[9px] text-text-secondary font-black uppercase mb-2 tracking-widest font-mono font-bold">Client Target Numeric Database ID</label>
                    <input
                      type="text"
                      className={`w-full p-3 rounded-xl outline-none font-mono ${c.bgInput}`}
                      placeholder=""
                      value={quarantineTargetId}
                      onChange={(e) => setQuarantineTargetId(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {adminRole !== 'LOGIN_ADMIN' ? (
                  <div className="bg-orange-500/10 text-orange-400 p-3.5 rounded-xl text-[9px] font-mono text-center font-bold tracking-wide uppercase leading-normal border border-orange-500/20">
                    ACCESS LOCKED: SECURE ARCHIVE RESTORATION REQUIRES CENTRAL COMPLIANCE MATRIX CLEARANCE.
                  </div>
                ) : (
                  <button
                    onClick={() => approveQuarantineAccess(quarantineTargetId, 'approve')}
                    className="w-full bg-accent-20 hover:bg-accent text-accent hover:text-text-primary font-extrabold py-3 rounded-xl text-[10px] uppercase tracking-wider cursor-pointer border border-accent-40 transition"
                  >
                    Manually Unlock Target
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. AUDIT SECURITY SURVEILLANCE LOGS */}
      {activeTab === 'logs' && (
        <AdminDiagnosticsView
          suspicious={suspicious}
          logs={logs}
          c={c}
        />
      )}

      {/* 8. MODERATION DESK */}
      {activeTab === 'moderation' && (
        <AdminUsersView
          adminRole={adminRole}
          activeSanctions={activeSanctions}
          users={users}
          applyQuickSanction={applyQuickSanction}
          adminFetch={adminFetch}
          fetchData={fetchData}
          c={c}
        />
      )}

      {/* 9. SETTINGS CONTROL VIEW */}
      {activeTab === 'settings' && (
        <div className={`p-6 rounded-2xl border ${c.bgPanel} shadow-xl animate-fadeIn`}>
          <div className="border-b border-white-5 pb-4 mb-5">
            <h4 className="font-extrabold text-sm uppercase tracking-wider">Executive Admin Settings</h4>
          </div>

          <form onSubmit={handleSettingsSubmit} className="space-y-6 max-w-2xl font-sans text-xs">
            
            {/* Identity details info block */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono">Assigned Identifier</label>
                <input
                  type="text"
                  disabled
                  value={`ID: ${adminId}`}
                  className={`w-full p-3 rounded-xl font-mono text-text-secondary cursor-not-allowed ${c.bgInput}`}
                />
              </div>
              <div>
                <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono">Current Privilege Level</label>
                <input
                  type="text"
                  disabled
                  value={adminRole === 'SUPPORT_ADMIN' ? "SUPPORT_ADMIN (SUPPORT OPERATIONS)" : "LOGIN_ADMIN (EXECUTIVE CONTROLS)"}
                  className={`w-full p-3 rounded-xl font-mono text-text-secondary cursor-not-allowed ${c.bgInput}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono">Personal Safe Word Key</label>
                <input
                  type="text"
                  value={safeWord}
                  onChange={(e) => setSafeWord(e.target.value)}
                  placeholder=""
                  className={`w-full p-3 rounded-xl font-mono ${c.bgInput}`}
                />
              </div>
              <div>
                <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono">Secure Panic Phrase Trigger</label>
                <input
                  type="text"
                  value={panicPhrase}
                  onChange={(e) => setPanicPhrase(e.target.value)}
                  placeholder=""
                  className={`w-full p-3 rounded-xl font-slate ${c.bgInput}`}
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-3 bg-accent hover:bg-accent-hover text-text-primary font-extrabold rounded-xl uppercase tracking-wider font-mono text-[10px] transition border-0 cursor-pointer shadow-md"
            >
              Save Settings
            </button>
            {settingsStatus && (
              <div className="p-3 bg-status-online/10 border border-emerald-500/15 text-status-online text-xs rounded font-mono font-bold">
                {settingsStatus}
              </div>
            )}
          </form>
        </div>
      )}
      </main>
    </div>
  );
}
