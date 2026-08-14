import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, UserCheck, Flame, BookOpen, AlertOctagon, HelpCircle,
  Send, Ban, Plus, FileText, CheckCircle, ShieldCheck, RefreshCw, Key,
  UserPlus, Lock, Unlock, Shield, Users, Search,
  Sliders, ChevronRight, ChevronLeft, Activity, Trash2, Megaphone, Info, MessageSquare, Globe, AlertTriangle,
  BadgeCheck, LogOut, Menu, X, Landmark, User
} from 'lucide-react';
import AdminDiagnosticsView from './AdminDiagnosticsView';
import AdminUsersView from './AdminUsersView';
import AdminVerificationView from './AdminVerificationView';
import PullToRefresh from './PullToRefresh';
import { useResponsiveLayout } from '../hooks/useResponsive';

// Modular Subcomponents
import AdminOverview from './Admin/AdminOverview';
import AdminUsers from './Admin/AdminUsers';
import AdminTickets from './Admin/AdminTickets';
import AdminReports from './Admin/AdminReports';
import AdminSystem from './Admin/AdminSystem';
import AdminBank from './Admin/AdminBank';
import AdminProfile from './Admin/AdminProfile';
import LoungeWorkspace from './SidebarTabs/LoungeWorkspace';
import SystemHealthTab from '../views/AdminControlDesk/SystemHealthTab';

import logoSvg from '../assets/logo.svg?raw';
import { Ticket, AuditLog, SuspiciousEvent, Invite, stripAt, Report, ClientDiagnosticLog } from '../types';

interface AdminPanelProps {
  adminId: number;
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN' | 'CLI_ADMIN' | 'ADMIN' | string;
  activeTab: 'overview' | 'users' | 'tickets' | 'reports' | 'moderation' | 'system' | 'logs' | 'profile' | any;
  onTabChange?: (tab: any) => void;
  isDark?: boolean;
  onLogout?: () => void;
  user?: any;
  wsConnected?: boolean;
  messages?: any[];
  onSendMessage?: any;
  onSendTyping?: any;
  onRoomKick?: any;
  onRoomMute?: any;
  activeRoomId?: string;
  setActiveRoomId?: any;
}

export default function AdminPanel({
  adminId,
  adminRole,
  activeTab,
  onTabChange,
  isDark = true,
  onLogout,
  user,
  wsConnected,
  messages,
  onSendMessage,
  onSendTyping,
  onRoomKick,
  onRoomMute,
  activeRoomId,
  setActiveRoomId
}: AdminPanelProps) {
  // Design theme variables
  const c = {
    bgPanel: "bg-white/[0.03] backdrop-blur-[var(--blur-backdrop-xl)] border border-white-10 rounded-2xl shadow-xl",
    bgSubPanel: "bg-white/[0.01] backdrop-blur-[var(--blur-backdrop-md)] border border-white-5 rounded-xl shadow-md",
    bgInput: "bg-white/[0.04] border border-white-10 text-text-primary focus:border-accent/40 placeholder:text-text-disabled rounded-lg p-2.5 outline-none transition-all",
    border: "border-white-10",
    textMain: "text-text-primary",
    textMuted: "text-text-secondary",
    statusResolved: "bg-status-online-bg text-status-online",
    statusOpen: "bg-status-dnd-bg text-status-dnd",
    statusPending: "bg-status-away-bg text-status-away",
    statusEscalated: "bg-accent-10 text-accent border border-accent-20"
  };

  // Sidebar controls
  const { isMobile: _isMobile, isTablet } = useResponsiveLayout();
  const isMobile = _isMobile || isTablet;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const selectTab = (tab: any) => {
    if (onTabChange) {
      onTabChange(tab);
    }
    if (isMobile) {
      setIsMobileDrawerOpen(false);
    }
  };

  // State Management
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'pending' | 'escalated' | 'resolved'>('all');

  // Diagnostics lists
  const [suspicious, setSuspicious] = useState<SuspiciousEvent[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [diagnosticLogs, setDiagnosticLogs] = useState<ClientDiagnosticLog[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [activeSanctions, setActiveSanctions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

  // Users Directory State
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'CLI_ADMIN' | 'LOGIN_ADMIN' | 'SUPPORT_ADMIN' | 'USER' | 'BLOCKED'>('all');

  // Reports Filter state
  const [reportFilter, setReportFilter] = useState<'all' | 'complaints' | 'bugs' | 'suggestions'>('all');

  // Recovery code state
  const [restoreCode, setRestoreCode] = useState<string | null>(null);

  // Profile status
  const [adminProfile, setAdminProfile] = useState<any>(null);

  const getSessionId = (): string => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem('velum-sessionId') || '';
  };

  const adminFetch = async (url: string, options: RequestInit = {}) => {
    const sId = getSessionId();
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${sId}`,
      'x-session-id': sId,
    };
    return fetch(url, { ...options, headers });
  };

  // Refresh data
  const fetchData = async () => {
    setIsLoadingData(true);
    try {
      const ticketRes = await adminFetch(`/v2/admin/tickets?adminId=${adminId}`);
      if (ticketRes.status === 401) {
        if (onLogout) onLogout();
        return;
      }
      if (ticketRes.ok) {
        const ticketData = await ticketRes.json();
        const safeTickets = Array.isArray(ticketData) ? ticketData : [];
        setTickets(safeTickets);
        if (activeTicket) {
          const fresh = safeTickets.find((t: any) => t.ticket_id === activeTicket.ticket_id);
          if (fresh) {
            setActiveTicket(fresh);
          }
        }
      }

      // Fetch real user data
      const usersRes = await adminFetch(`/v2/user/admin/all`);
      if (usersRes.status === 401) {
        if (onLogout) onLogout();
        return;
      }
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData || []);
      }

      const diagRes = await adminFetch(`/v2/admin/diagnostics?adminId=${adminId}`);
      if (diagRes.status === 401) {
        if (onLogout) onLogout();
        return;
      }
      if (diagRes.ok) {
        const diagData = await diagRes.json();
        setSuspicious(diagData.suspicious || []);
        setLogs(diagData.logs || []);
        setDiagnosticLogs(diagData.diagnostic_logs || []);
        setInvites(diagData.invites || []);
        setActiveSanctions(diagData.sanctions || []);
        setSessions(diagData.sessions || []);
        setDevices(diagData.devices || []);
        if (diagData.metrics) {
          // metrics setter not defined — log for diagnostics
          console.warn('AdminPanel metrics received but no setMetrics available:', diagData.metrics);
        }
      }

      const profileRes = await adminFetch(`/v2/user/${adminId}/profile`);
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setAdminProfile(profileData);
      }

      const reportsRes = await adminFetch(`/v2/admin/reports`);
      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setReports(Array.isArray(reportsData) ? reportsData : []);
      }
    } catch (err) {
      console.warn('Failed admin sync fetch', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleAdminWsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const data = customEvent.detail;
      if (data && data.type === 'admin_update') {
        console.log('[Real-Time Admin WebSocket]: Received state update trigger:', data.subType);
        fetchData();
      }
    };

    window.addEventListener('velum-message-received', handleAdminWsUpdate);
    return () => {
      window.removeEventListener('velum-message-received', handleAdminWsUpdate);
    };
  }, [adminId]);

  // Refetch data when switching to users tab to ensure fresh data
  useEffect(() => {
    if (activeTab === 'users') {
      fetchData();
    }
  }, [activeTab]);

  const handleTicketReply = async (close: boolean, escalate: boolean) => {
    if (!activeTicket) return;
    if (!close && !escalate && !replyText.trim()) return;

    try {
      const res = await adminFetch(`/v2/admin/tickets/${activeTicket.ticket_id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId,
          content: replyText,
          closeTicket: close,
          escalate: escalate,
        }),
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

  const applyQuickSanction = async (userName: string, type: 'ban' | 'mute', duration: number, reason: string) => {
    try {
      const res = await adminFetch(`/v2/admin/sanction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUsername: userName,
          type,
          minutes: duration,
          reason,
        }),
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

  const approveQuarantineAccess = async (targetUserId: string, action: 'approve' | 'deny') => {
    try {
      const res = await adminFetch(`/v2/admin/recover-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: parseInt(targetUserId, 10),
          action,
        }),
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

  const coreCommands = [
    { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" />, roles: ['ADMIN', 'SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'] },
    { id: 'velum_lounge', label: 'Velum Lounge', icon: <MessageSquare className="w-4 h-4" />, roles: ['ADMIN', 'SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'] },
    { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" />, roles: ['ADMIN', 'LOGIN_ADMIN', 'SUPPORT_ADMIN', 'CLI_ADMIN'] },
    { id: 'tickets', label: 'Tickets', icon: <HelpCircle className="w-4 h-4" />, roles: ['ADMIN', 'SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'] },
    { id: 'reports', label: 'Reports', icon: <FileText className="w-4 h-4" />, roles: ['ADMIN', 'SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'] },
    { id: 'moderation', label: 'Sanctions', icon: <Ban className="w-4 h-4" />, roles: ['ADMIN', 'SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'] },
    { id: 'verifications', label: 'Verifications', icon: <ShieldCheck className="w-4 h-4" />, roles: ['ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'] },
  ];

  const systemGates = [
    { id: 'health', label: 'System Health', icon: <Activity className="w-4 h-4 text-accent" />, roles: ['ADMIN', 'SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'] },
    { id: 'system', label: 'System Config', icon: <Sliders className="w-4 h-4" />, roles: ['ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'] },
    { id: 'logs', label: 'Diagnostics & Logs', icon: <Activity className="w-4 h-4" />, roles: ['ADMIN', 'SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'] },
    { id: 'bank', label: 'Central Bank', icon: <Landmark className="w-4 h-4" />, roles: ['ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'] },
    { id: 'profile', label: 'Profile Settings', icon: <User className="w-4 h-4" />, roles: ['ADMIN', 'SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'] },
  ];

  const [localAvatarUrl, setLocalAvatarUrl] = useState<string>('');

  useEffect(() => {
    if (user?.userId) {
      import('../utils/indexedDb').then(({ getLocalMedia }) => {
        getLocalMedia(`avatar_${user.userId}`).then((cachedBlob) => {
          if (cachedBlob) {
            setLocalAvatarUrl(URL.createObjectURL(cachedBlob));
          }
        }).catch(() => {});
      });
    }
  }, [user?.userId]);

  const displayName = user?.username ? stripAt(user.username) : 'Executive';
  const roleLabel = adminRole === 'SUPPORT_ADMIN' ? 'Support' : 'Executive';
  const avatarSrc = localAvatarUrl || adminProfile?.avatar || user?.avatar || '';

  const renderSidebarContent = (expanded: boolean) => (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto scrollbar-none p-4 space-y-6">
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          {!isMobile && (
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`text-text-secondary hover:text-accent transition cursor-pointer self-start p-1.5 ${expanded ? '' : 'mx-auto'}`}
              title={expanded ? 'Collapse menu' : 'Expand menu'}
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {expanded ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 [&>svg]:w-full [&>svg]:h-full text-accent" dangerouslySetInnerHTML={{ __html: logoSvg }} />
              <div>
                <h2 className="font-display font-black text-sm uppercase tracking-wider text-text-primary leading-none">
                  Velum
                </h2>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 [&>svg]:w-full [&>svg]:h-full text-accent mx-auto" dangerouslySetInnerHTML={{ __html: logoSvg }} />
          )}
        </div>

        {expanded ? (
          <div className="p-3 bg-white/[0.03] border border-white-5 rounded-2xl flex items-center gap-3 select-none">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt="Avatar"
                className="w-10 h-10 rounded-full object-cover border border-white-10"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-accent-10 border border-white-10 text-accent flex items-center justify-center font-bold text-sm uppercase">
                {displayName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-bold text-text-primary truncate">
                {displayName}
              </div>
              <div className="text-[10px] text-text-secondary uppercase font-semibold font-mono tracking-wider">
                {roleLabel}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center select-none">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt="Avatar"
                className="w-10 h-10 rounded-full object-cover border border-white-10"
                title={`${displayName} (${roleLabel})`}
              />
            ) : (
              <div
                className="w-10 h-10 rounded-full bg-accent-10 border border-white-10 text-accent flex items-center justify-center font-bold text-sm uppercase"
                title={`${displayName} (${roleLabel})`}
              >
                {displayName.charAt(0)}
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div>
            {expanded && (
              <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block px-3.5 mb-2 font-mono">
                Core Commands
              </span>
            )}
            <nav className="space-y-1">
              {coreCommands
                .filter((item) => !adminRole || item.roles.includes(adminRole) || adminRole === 'ADMIN' || adminRole === 'CLI_ADMIN' || adminRole === 'LOGIN_ADMIN' || adminRole === 'SUPPORT_ADMIN')
                .map((item) => {
                  const isSelected = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => selectTab(item.id)}
                      className={`flex items-center rounded-xl transition duration-150 cursor-pointer min-h-[40px] ${expanded ? 'w-full gap-3 px-3.5 py-2 text-left' : 'w-10 h-10 mx-auto justify-center'
                        } ${isSelected
                          ? 'bg-white-10 text-white font-medium shadow-sm'
                          : 'text-text-secondary hover:bg-white-5 hover:text-white'
                        }`}
                      title={!expanded ? item.label : undefined}
                    >
                      <span className={isSelected ? 'text-accent' : 'text-text-secondary'}>
                        {item.icon}
                      </span>
                      {expanded && <span className="text-xs font-semibold">{item.label}</span>}
                    </button>
                  );
                })}
            </nav>
          </div>

          {!expanded && <hr className="border-white-5 my-2" />}

          <div>
            {expanded && (
              <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block px-3.5 mb-2 font-mono">
                System Gates
              </span>
            )}
            <nav className="space-y-1">
              {systemGates
                .filter((item) => !adminRole || item.roles.includes(adminRole) || adminRole === 'ADMIN' || adminRole === 'CLI_ADMIN' || adminRole === 'LOGIN_ADMIN' || adminRole === 'SUPPORT_ADMIN')
                .map((item) => {
                  const isSelected = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => selectTab(item.id)}
                      className={`flex items-center rounded-xl transition duration-150 cursor-pointer min-h-[40px] ${expanded ? 'w-full gap-3 px-3.5 py-2 text-left' : 'w-10 h-10 mx-auto justify-center'
                        } ${isSelected
                          ? 'bg-white-10 text-white font-medium shadow-sm'
                          : 'text-text-secondary hover:bg-white-5 hover:text-white'
                        }`}
                      title={!expanded ? item.label : undefined}
                    >
                      <span className={isSelected ? 'text-accent' : 'text-text-secondary'}>
                        {item.icon}
                      </span>
                      {expanded && <span className="text-xs font-semibold">{item.label}</span>}
                    </button>
                  );
                })}
            </nav>
          </div>
        </div>
      </div>

      </div>
      <div className="p-4 shrink-0 border-t border-white-5 space-y-3.5">
        <button
          onClick={onLogout}
          className={`flex items-center text-status-dnd hover:text-white transition duration-150 cursor-pointer min-h-[40px] ${expanded ? 'w-full gap-3 px-3.5 py-2' : 'w-10 h-10 mx-auto justify-center rounded-xl hover:bg-white-5'
            }`}
          title={!expanded ? 'Exit Session' : undefined}
        >
          <LogOut className="w-4.5 h-4.5" />
          {expanded && <span className="text-xs font-bold uppercase tracking-wider font-mono">Exit Session</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-velum-900 text-text-primary overflow-hidden font-sans">


      {/* Mobile Slide-Over Off-Canvas Drawer */}
      {isMobile && isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 modal-backdrop transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div className="relative z-10 w-64 max-w-[80vw] h-full bg-velum-850 border-r border-white-5 shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}

      {/* Desktop / Tablet Sidebar Navigation Panel */}
      {!isMobile && (
        <aside
          className={`bg-velum-850 border-r border-white-5 flex flex-col transition-all duration-300 relative z-30 shrink-0 ${isSidebarOpen ? 'w-60 min-w-[240px]' : 'w-14 min-w-[56px]'
            }`}
        >
          {renderSidebarContent(isSidebarOpen)}
        </aside>
      )}

      {/* Main Workspace Frame */}
      <main className={`flex-1 min-w-0 min-h-0 h-full bg-velum-900 flex flex-col overflow-hidden relative ${activeTab === 'velum_lounge' ? 'p-0' : 'p-6'}`}>
        {activeTab === 'velum_lounge' ? (
          <LoungeWorkspace
            currentUserId={user?.userId}
            currentUsername={user?.username}
            currentUserRole={adminRole}
            loungeId="velum_master_lounge"
            loungeName="Velum Lounge"
            onLoungeSelect={() => { }}
            onBackToDirectory={() => { }}
            activeRoomId={activeRoomId || ''}
            onRoomSelect={setActiveRoomId}
            wsConnected={wsConnected || false}
            messages={messages || []}
            onSendMessage={onSendMessage}
            onSendTyping={onSendTyping}
            onRoomKick={onRoomKick}
            onRoomMute={onRoomMute}
            isDark={isDark}
            unreadCounts={{}}
            onToggleSidebar={() => setIsMobileDrawerOpen(true)}
          />
        ) : (
          <PullToRefresh>
            <div className="flex-grow w-full overflow-x-hidden overflow-y-auto scrollbar-none pr-1">
              <div className="lg:hidden flex items-center justify-between pb-4 mb-4 border-b border-white-5 shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsMobileDrawerOpen(true)}
                    className="p-2 rounded-xl bg-white-5 text-text-secondary hover:text-white hover:bg-white-10 transition cursor-pointer"
                    aria-label="Open admin sidebar menu"
                    title="Open Navigation"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-bold text-text-primary capitalize font-mono tracking-wider">
                    {activeTab?.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {activeTab === 'overview' && (
                <AdminOverview
                  adminRole={adminRole as any}
                  adminFetch={adminFetch}
                  onTabChange={selectTab}
                  c={c}
                />
              )}

              {activeTab === 'users' && (
              <AdminUsers
                userSearch={userSearch}
                setUserSearch={setUserSearch}
                userRoleFilter={userRoleFilter}
                setUserRoleFilter={setUserRoleFilter}
                users={users}
                sessions={sessions}
                adminRole={adminRole as any}
                adminFetch={adminFetch}
                fetchData={fetchData}
                c={c}
                isLoading={isLoadingData}
              />
            )}

            {activeTab === 'tickets' && (
              <AdminTickets
                tickets={tickets}
                activeTicket={activeTicket}
                setActiveTicket={setActiveTicket}
                replyText={replyText}
                setReplyText={setReplyText}
                ticketSearch={ticketSearch}
                setTicketSearch={setTicketSearch}
                ticketFilter={ticketFilter}
                setTicketFilter={setTicketFilter}
                adminId={adminId}
                adminRole={adminRole as any}
                adminFetch={adminFetch}
                fetchData={fetchData}
                approveQuarantineAccess={approveQuarantineAccess}
                handleTicketReply={handleTicketReply}
                restoreCode={restoreCode}
                user={user}
                c={c}
              />
            )}

            {activeTab === 'reports' && (
              <AdminReports
                reports={reports}
                reportFilter={reportFilter}
                setReportFilter={setReportFilter}
                adminRole={adminRole as any}
                user={user}
                adminFetch={adminFetch}
                fetchData={fetchData}
              />
            )}
            {activeTab === 'moderation' && (
              <AdminUsersView
                adminRole={adminRole as any}
                activeSanctions={activeSanctions}
                users={users}
                applyQuickSanction={applyQuickSanction}
                adminFetch={adminFetch}
                fetchData={fetchData}
                c={c}
              />
            )}

            {activeTab === 'verifications' && (
              <AdminVerificationView
                adminRole={adminRole as any}
                c={c}
              />
            )}

            {activeTab === 'health' && (
              <SystemHealthTab
                adminFetch={adminFetch}
                c={c}
              />
            )}

            {activeTab === 'system' && (
              <AdminSystem
                adminId={adminId}
                adminRole={adminRole as any}
                adminFetch={adminFetch}
                fetchData={fetchData}
                approveQuarantineAccess={approveQuarantineAccess}
                c={c}
              />
            )}

            {activeTab === 'logs' && (
              <AdminDiagnosticsView
                suspicious={suspicious}
                logs={logs}
                initialDiagLogs={diagnosticLogs}
                adminFetch={adminFetch}
                c={c}
              />
            )}

            {activeTab === 'bank' && adminRole !== 'SUPPORT_ADMIN' && (
              <AdminBank
                adminRole={adminRole as any}
                user={user}
                adminFetch={adminFetch}
              />
            )}

            {activeTab === 'profile' && (
              <AdminProfile
                adminId={adminId}
                adminRole={adminRole as any}
                user={user}
                adminProfile={adminProfile}
                adminFetch={adminFetch}
                fetchData={fetchData}
                c={c}
              />
            )}
          </div>
        </PullToRefresh>
        )}
      </main>
    </div>
  );
}
