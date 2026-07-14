import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, UserCheck, Flame, BookOpen, AlertOctagon, HelpCircle, 
  Send, Ban, Plus, FileText, CheckCircle, ShieldCheck, RefreshCw, Key, 
  UserPlus, Lock, Unlock, Shield, Users, Search, 
  Sliders, ChevronRight, ChevronLeft, Activity, Trash2, Megaphone, Info, Globe, AlertTriangle,
  BadgeCheck, LogOut, Menu, X, Landmark, User, Terminal
} from 'lucide-react';
import AdminDiagnosticsView from './AdminDiagnosticsView';
import AdminUsersView from './AdminUsersView';
import AdminVerificationView from './AdminVerificationView';

// Modular Subcomponents
import AdminOverview from './Admin/AdminOverview';
import AdminUsers from './Admin/AdminUsers';
import AdminTickets from './Admin/AdminTickets';
import AdminReports from './Admin/AdminReports';
import AdminBroadcasts from './Admin/AdminBroadcasts';
import AdminSystem from './Admin/AdminSystem';
import AdminBank from './Admin/AdminBank';
import AdminProfile from './Admin/AdminProfile';

import logoSvg from '../assets/logo.svg?raw';
import { Ticket, AuditLog, SuspiciousEvent, Invite, stripAt, Report } from '../types';

interface AdminPanelProps {
  adminId: number;
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN' | 'CLI_ADMIN';
  activeTab: 'overview' | 'users' | 'tickets' | 'reports' | 'announcements' | 'moderation' | 'system' | 'logs' | 'profile' | any;
  onTabChange?: (tab: any) => void;
  isDark?: boolean;
  onLogout?: () => void;
  user?: any;
  onSwitchToCli?: () => void;
}

export default function AdminPanel({ 
  adminId, 
  adminRole, 
  activeTab, 
  onTabChange, 
  isDark = true,
  onLogout,
  user,
  onSwitchToCli
}: AdminPanelProps) {
  // Design theme variables
  const c = {
    bgPanel: "bg-white/[0.03] backdrop-blur-xl border border-white-10 rounded-2xl shadow-xl",
    bgSubPanel: "bg-white/[0.01] backdrop-blur-md border border-white-5 rounded-xl shadow-md",
    bgInput: "bg-white/[0.04] border border-white-10 text-text-primary focus:border-accent/40 placeholder:text-text-disabled rounded-lg p-2.5 outline-none transition-all",
    border: "border-white-10",
    textMain: "text-text-primary",
    textMuted: "text-text-secondary",
    statusResolved: "bg-accent-secondary-10 text-accent-secondary border border-accent-secondary-20",
    statusOpen: "bg-status-dnd/10 text-status-dnd border border-status-dnd/20",
    statusPending: "bg-status-away/10 text-status-away border border-status-away/20",
    statusEscalated: "bg-accent-10 text-accent border border-accent-20"
  };

  // Sidebar controls
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const selectTab = (tab: any) => {
    if (onTabChange) {
      onTabChange(tab);
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
  const [invites, setInvites] = useState<Invite[]>([]);
  const [activeSanctions, setActiveSanctions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);

  // Users Directory State
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'CLI_ADMIN' | 'LOGIN_ADMIN' | 'SUPPORT_ADMIN' | 'member'>('all');

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
    try {
      const ticketRes = await adminFetch(`/api/admin/tickets?adminId=${adminId}`);
      if (ticketRes.status === 401) {
        if (onLogout) onLogout();
        return;
      }
      if (ticketRes.ok) {
        const ticketData = await ticketRes.json();
        setTickets(ticketData);
        if (activeTicket) {
          const fresh = ticketData.find((t: any) => t.ticket_id === activeTicket.ticket_id);
          if (fresh) {
            setActiveTicket(fresh);
          }
        }
      }

      const diagRes = await adminFetch(`/api/admin/diagnostics?adminId=${adminId}`);
      if (diagRes.status === 401) {
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

      const profileRes = await adminFetch(`/api/user/${adminId}/profile`);
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setAdminProfile(profileData);
      }

      const reportsRes = await adminFetch(`/api/admin/reports`);
      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setReports(reportsData);
      }
    } catch (err) {
      console.warn('Failed admin sync fetch', err);
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
      const res = await adminFetch(`/api/admin/sanction`, {
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
      const res = await adminFetch(`/api/admin/recover-approve`, {
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
    { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" />, roles: ['SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'] },
    { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" />, roles: ['LOGIN_ADMIN', 'CLI_ADMIN'] },
    { id: 'tickets', label: 'Tickets', icon: <HelpCircle className="w-4 h-4" />, roles: ['SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'] },
    { id: 'reports', label: 'Reports', icon: <FileText className="w-4 h-4" />, roles: ['SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'] },
    { id: 'announcements', label: 'Broadcasts', icon: <Megaphone className="w-4 h-4" />, roles: ['SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'] },
    { id: 'moderation', label: 'Sanctions', icon: <Ban className="w-4 h-4" />, roles: ['SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'] },
    { id: 'verifications', label: 'Verifications', icon: <ShieldCheck className="w-4 h-4" />, roles: ['LOGIN_ADMIN', 'CLI_ADMIN'] },
  ];

  const systemGates = [
    { id: 'system', label: 'System Config', icon: <Sliders className="w-4 h-4" />, roles: ['LOGIN_ADMIN', 'CLI_ADMIN'] },
    { id: 'logs', label: 'Audit Logs', icon: <BookOpen className="w-4 h-4" />, roles: ['LOGIN_ADMIN', 'CLI_ADMIN'] },
    { id: 'bank', label: 'Central Bank', icon: <Landmark className="w-4 h-4" />, roles: ['LOGIN_ADMIN', 'CLI_ADMIN'] },
    { id: 'profile', label: 'Profile Settings', icon: <User className="w-4 h-4" />, roles: ['SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'] },
  ];

  const displayName = user?.username ? stripAt(user.username) : 'Executive';
  const roleLabel = adminRole === 'SUPPORT_ADMIN' ? 'Support' : 'Executive';
  const avatarSrc = adminProfile?.avatar || user?.avatar || '';

  return (
    <div className="flex h-screen bg-velum-900 text-text-primary overflow-hidden font-sans">
      {/* Sidebar Navigation Panel */}
      <aside
        className={`bg-velum-850 border-r border-white-5 flex flex-col justify-between p-5 transition-all duration-300 relative z-30 shrink-0 ${
          isSidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="space-y-6">
          {/* Logo Brand Header with top Hamburger toggle */}
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`text-text-secondary hover:text-accent transition cursor-pointer self-start p-1.5 ${
                isSidebarOpen ? '' : 'mx-auto'
              }`}
              title={isSidebarOpen ? 'Collapse menu' : 'Expand menu'}
            >
              <Menu className="w-5 h-5" />
            </button>

            {isSidebarOpen ? (
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

          {/* Profile Card design */}
          {isSidebarOpen ? (
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

          {/* Navigation Links grouped by categories */}
          <div className="space-y-4">
            {/* 1. Core Commands */}
            <div>
              {isSidebarOpen && (
                <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block px-3.5 mb-2 font-mono">
                  Core Commands
                </span>
              )}
              <nav className="space-y-1">
                {coreCommands
                  .filter((item) => item.roles.includes(adminRole))
                  .map((item) => {
                    const isSelected = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => selectTab(item.id)}
                        className={`flex items-center rounded-xl transition duration-150 cursor-pointer ${
                          isSidebarOpen ? 'w-full gap-3 px-3.5 py-2 text-left' : 'w-11 h-11 mx-auto justify-center'
                        } ${
                          isSelected
                            ? 'bg-white-10 text-white font-medium shadow-sm'
                            : 'text-text-secondary hover:bg-white-5 hover:text-white'
                        }`}
                        title={!isSidebarOpen ? item.label : undefined}
                      >
                        <span className={isSelected ? 'text-accent' : 'text-text-secondary'}>
                          {item.icon}
                        </span>
                        {isSidebarOpen && <span className="text-xs font-semibold">{item.label}</span>}
                      </button>
                    );
                  })}
              </nav>
            </div>

            {/* Divider when collapsed */}
            {!isSidebarOpen && <hr className="border-white-5 my-2" />}

            {/* 2. System Gates */}
            <div>
              {isSidebarOpen && (
                <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block px-3.5 mb-2 font-mono">
                  System Gates
                </span>
              )}
              <nav className="space-y-1">
                {systemGates
                  .filter((item) => item.roles.includes(adminRole))
                  .map((item) => {
                    const isSelected = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => selectTab(item.id)}
                        className={`flex items-center rounded-xl transition duration-150 cursor-pointer ${
                          isSidebarOpen ? 'w-full gap-3 px-3.5 py-2 text-left' : 'w-11 h-11 mx-auto justify-center'
                        } ${
                          isSelected
                            ? 'bg-white-10 text-white font-medium shadow-sm'
                            : 'text-text-secondary hover:bg-white-5 hover:text-white'
                        }`}
                        title={!isSidebarOpen ? item.label : undefined}
                      >
                        <span className={isSelected ? 'text-accent' : 'text-text-secondary'}>
                          {item.icon}
                        </span>
                        {isSidebarOpen && <span className="text-xs font-semibold">{item.label}</span>}
                      </button>
                    );
                  })}
              </nav>
            </div>
          </div>
        </div>

        {/* Footer Area */}
        <div className="space-y-3.5">
          {onSwitchToCli && (
            <button
              onClick={onSwitchToCli}
              className={`flex items-center text-status-away hover:text-white transition duration-150 cursor-pointer ${
                isSidebarOpen ? 'w-full gap-3 px-3.5 py-2' : 'w-11 h-11 mx-auto justify-center rounded-xl hover:bg-white-5'
              }`}
              title={!isSidebarOpen ? 'Terminal Console' : undefined}
            >
              <Terminal className="w-4.5 h-4.5" />
              {isSidebarOpen && <span className="text-xs font-bold uppercase tracking-wider font-mono">Terminal Console</span>}
            </button>
          )}

          <button
            onClick={onLogout}
            className={`flex items-center text-status-dnd hover:text-white transition duration-150 cursor-pointer ${
              isSidebarOpen ? 'w-full gap-3 px-3.5 py-2' : 'w-11 h-11 mx-auto justify-center rounded-xl hover:bg-white-5'
            }`}
            title={!isSidebarOpen ? 'Exit Session' : undefined}
          >
            <LogOut className="w-4.5 h-4.5" />
            {isSidebarOpen && <span className="text-xs font-bold uppercase tracking-wider font-mono">Exit Session</span>}
          </button>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <main className="flex-1 min-w-0 min-h-0 bg-velum-900 flex flex-col overflow-hidden p-6 relative">
        <div className="flex-1 w-full overflow-x-hidden overflow-y-auto scrollbar-none pr-1">
          {activeTab === 'overview' && (
            <AdminOverview
              metrics={metrics}
              tickets={tickets}
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
              adminRole={adminRole}
              adminFetch={adminFetch}
              fetchData={fetchData}
              c={c}
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
              adminRole={adminRole}
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
              adminRole={adminRole}
              user={user}
              adminFetch={adminFetch}
              fetchData={fetchData}
            />
          )}

          {activeTab === 'announcements' && (
            <AdminBroadcasts
              adminRole={adminRole}
              user={user}
              onLogout={onLogout}
              adminFetch={adminFetch}
            />
          )}

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

          {activeTab === 'verifications' && (
            <AdminVerificationView
              adminRole={adminRole as any}
              c={c}
            />
          )}

          {activeTab === 'system' && (
            <AdminSystem
              adminId={adminId}
              adminRole={adminRole}
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
              c={c}
            />
          )}

          {activeTab === 'bank' && adminRole !== 'SUPPORT_ADMIN' && (
            <AdminBank
              adminRole={adminRole}
              user={user}
              adminFetch={adminFetch}
            />
          )}

          {activeTab === 'profile' && (
            <AdminProfile
              adminId={adminId}
              adminRole={adminRole}
              user={user}
              adminProfile={adminProfile}
              adminFetch={adminFetch}
              fetchData={fetchData}
              c={c}
            />
          )}
        </div>
      </main>
    </div>
  );
}
