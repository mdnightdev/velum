import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, UserCheck, Flame, BookOpen, AlertOctagon, HelpCircle, 
  Send, Ban, Plus, FileText, CheckCircle, ShieldCheck, RefreshCw, Key, 
  UserPlus, Lock, Unlock, Shield, Users, Search, MessageSquare, 
  Sliders, ChevronRight, ChevronLeft, Activity, Trash2, Megaphone, Info, Globe, AlertTriangle,
  BadgeCheck, LogOut, Menu, X, Landmark, User
} from 'lucide-react';
import PasswordInput from './PasswordInput';
import AdminDiagnosticsView from './AdminDiagnosticsView';
import AdminUsersView from './AdminUsersView';
import AdminVerificationView from './AdminVerificationView';

import logoSvg from '../assets/logo.svg?raw';
import { Ticket, AuditLog, SuspiciousEvent, Invite, stripAt, Report } from '../types';
import { decryptMessage } from '../services/encryptionService';
import { compressImage } from '../utils/imageCompressor';

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

  // State Management
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const selectTab = (tab: any) => {
    if (onTabChange) {
      onTabChange(tab);
    }
    setIsSidebarOpen(false);
  };
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

  // Profile states & upload helpers
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [adminProfile, setAdminProfile] = useState<any>(null);

  // Bank Ledger states
  const [bankStatus, setBankStatus] = useState<any>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankTransactions, setBankTransactions] = useState<any[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState('');
  const [bankSuccess, setBankSuccess] = useState('');

  // Add bank account form
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccInst, setNewAccInst] = useState('');
  const [newAccNum, setNewAccNum] = useState('');
  const [newAccRout, setNewAccRout] = useState('');
  const [newAccOwner, setNewAccOwner] = useState('');
  const [newAccBal, setNewAccBal] = useState('');
  const [newAccCurr, setNewAccCurr] = useState('TWD');

  // Adjust balance form
  const [adjustingAccountId, setAdjustingAccountId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDesc, setAdjustDesc] = useState('');

  // Institutional FX Calculator
  const [calcAmount, setCalcAmount] = useState('');
  const [calcFrom, setCalcFrom] = useState('GBP');

  const fetchBankData = async () => {
    setBankLoading(true);
    setBankError('');
    try {
      const statusRes = await adminFetch('/api/bank/status');
      if (statusRes.ok) setBankStatus(await statusRes.json());

      const accountsRes = await adminFetch('/api/bank/accounts');
      if (accountsRes.ok) setBankAccounts(await accountsRes.json());

      const transactionsRes = await adminFetch('/api/bank/transactions');
      if (transactionsRes.ok) setBankTransactions(await transactionsRes.json());
    } catch (err) {
      console.warn('Failed to retrieve bank records', err);
    } finally {
      setBankLoading(false);
    }
  };

  const handleAddBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBankError(''); setBankSuccess('');
    try {
      const res = await adminFetch('/api/bank/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_name: newAccName,
          institution: newAccInst,
          account_number: newAccNum,
          routing_number: newAccRout,
          owner_name: newAccOwner,
          balance_cents: Math.floor(parseFloat(newAccBal) * 100),
          currency_code: newAccCurr
        })
      });

      if (!res.ok) {
        const d = await res.json();
        setBankError(d.error || 'Failed to register bank account.');
      } else {
        setBankSuccess('Registered financial asset account successfully.');
        setShowAddAccount(false);
        setNewAccName(''); setNewAccInst(''); setNewAccNum(''); setNewAccRout(''); setNewAccOwner(''); setNewAccBal('');
        fetchBankData();
      }
    } catch (e) {
      setBankError('Network communication failure.');
    }
  };

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingAccountId) return;
    setBankError(''); setBankSuccess('');
    try {
      const res = await adminFetch(`/api/bank/accounts/${adjustingAccountId}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_cents: Math.floor(parseFloat(adjustAmount) * 100),
          description: adjustDesc
        })
      });

      if (!res.ok) {
        const d = await res.json();
        setBankError(d.error || 'Failed to adjust account reserves.');
      } else {
        setBankSuccess('Adjusted account ledger balances.');
        setAdjustingAccountId(null);
        setAdjustAmount(''); setAdjustDesc('');
        fetchBankData();
      }
    } catch (e) {
      setBankError('Network communication failure.');
    }
  };

  const handleToggleFreeze = async (accountId: string, currentlyFrozen: boolean) => {
    setBankError(''); setBankSuccess('');
    try {
      const res = await adminFetch(`/api/bank/accounts/${accountId}/freeze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frozen: !currentlyFrozen })
      });

      if (!res.ok) {
        const d = await res.json();
        setBankError(d.error || 'Failed to update freeze status.');
      } else {
        setBankSuccess(currentlyFrozen ? 'Unfroze bank account.' : 'Froze bank account.');
        fetchBankData();
      }
    } catch (e) {
      setBankError('Network communication failure.');
    }
  };

  useEffect(() => {
    if (activeTab === 'bank') {
      fetchBankData();
    }
  }, [activeTab]);

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
      if (ticketRes.status === 401) {
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
    // Initial snapshot load on mount
    fetchData();

    // Listen to real-time administrative updates broadcasted over WebSocket
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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Security check: Validate file size (under 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds the 5MB security threshold.');
        return;
      }

      // Security check: Validate file type (must be image)
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('Invalid file format. Only JPEG, PNG, and WebP images are permitted.');
        return;
      }

      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAdminAvatar = async () => {
    if (!avatarFile || !avatarPreview) return null;
    setIsUploading(true);
    try {
      const sId = getSessionId();
      const blob = await compressImage(avatarPreview, 512, 0.85);
      const uploadRes = await fetch('/api/user/upload-avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'image/jpeg'
        },
        body: blob
      });
      if (uploadRes.ok) {
        const data = await uploadRes.json();
        return data.url;
      }
    } catch (err) {
      console.error('Error uploading avatar:', err);
    } finally {
      setIsUploading(false);
    }
    return null;
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsStatus(null);
    setIsUploading(true);

    try {
      let finalAvatar = adminProfile?.avatar || '';
      if (avatarFile && avatarPreview) {
        const uploadedUrl = await uploadAdminAvatar();
        if (uploadedUrl) {
          finalAvatar = uploadedUrl;
        }
      }

      const profileRes = await adminFetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: adminId,
          avatar: finalAvatar,
          displayName: user?.username || 'Executive',
          bio: adminProfile?.bio || 'Verified Executive Administrator.'
        })
      });

      let settingsOk = true;
      if (safeWord.trim() || panicPhrase.trim()) {
        const settingsRes = await adminFetch('/api/admin/update-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            safeWord: safeWord.trim() || undefined,
            panicPhrase: panicPhrase.trim() || undefined
          })
        });
        settingsOk = settingsRes.ok;
      }

      if (profileRes.ok && settingsOk) {
        setSettingsStatus('PROFILE SECURED: Identity avatar and security phrase credentials updated successfully.');
        setAvatarFile(null);
        setAvatarPreview(null);
        fetchData();
        setTimeout(() => setSettingsStatus(null), 4000);
      } else {
        alert('Failed to update settings database.');
      }
    } catch (err) {
      console.error('Profile save error:', err);
      alert('Network error while saving profile.');
    } finally {
      setIsUploading(false);
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

  // Note: handleSettingsSubmit has been replaced by handleProfileSubmit

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
  const reportsList = reports.filter(r => {
    if (reportFilter === 'complaints' && r.type !== 'user_misconduct') return false;
    if (reportFilter === 'bugs' && r.type !== 'bug_report') return false;
    if (reportFilter === 'suggestions' && r.type !== 'suggestion') return false;

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
      <aside className={`
        fixed lg:static top-0 left-0 h-full z-50 flex flex-col justify-between transition-all duration-300 ease-in-out border-r border-white-5 bg-black/60 glass-panel border-y-0 border-l-0 rounded-none
        ${isSidebarOpen 
          ? 'translate-x-0 w-64 p-5' 
          : '-translate-x-full lg:translate-x-0 lg:w-[76px] lg:p-3 w-64 p-5'
        } shrink-0
      `}>
        <div className="space-y-7 w-full">
          {/* Brand/Logo Area */}
          {isSidebarOpen ? (
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: logoSvg }} />
                <div>
                  <span className="text-sm font-sans font-black tracking-widest text-accent uppercase">VELUM</span>
                  <span className="text-[9px] font-mono font-bold block text-text-secondary uppercase tracking-widest">CONTROL CENTER</span>
                </div>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="text-text-secondary hover:text-text-primary p-1 rounded-md hover:bg-text-primary-5 transition-colors" title="Collapse Sidebar">
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(true)} 
                className="p-2.5 bg-velum-800 border border-white-5 rounded-xl text-text-primary hover:text-accent hover:bg-text-primary-5 transition-colors"
                title="Expand Navigation"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="w-6 h-6 [&>svg]:w-full [&>svg]:h-full opacity-80" dangerouslySetInnerHTML={{ __html: logoSvg }} />
            </div>
          )}

          {/* Connected User Identity Badge */}
          {isSidebarOpen ? (
            <div className="p-3 bg-text-primary-2 border border-white-5 rounded-xl flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-accent-20 flex items-center justify-center font-bold text-accent font-mono text-xs shrink-0 bg-accent-10">
                {adminProfile?.avatar ? (
                  <img src={adminProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  (user?.username || 'AD').substring(0,2).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-text-primary block truncate">@{user?.username || 'Executive'}</span>
                <span className="text-[8.5px] font-mono text-text-secondary block truncate">
                  {adminRole === 'SUPPORT_ADMIN' ? 'SUPPORT OPERATIONS' : adminRole === 'CLI_ADMIN' ? 'CLI SYSTEM EXECUTIVE' : 'EXECUTIVE CONTROLS'}
                </span>
              </div>
            </div>
          ) : (
            <div 
              className="w-10 h-10 mx-auto rounded-xl overflow-hidden border border-accent-20 flex items-center justify-center font-bold text-accent font-mono text-xs shrink-0 cursor-pointer hover:border-accent-40 transition-all bg-accent-10"
              title={`@${user?.username || 'Executive'} - ${adminRole === 'SUPPORT_ADMIN' ? 'Support Operations' : adminRole === 'CLI_ADMIN' ? 'CLI System Executive' : 'Executive Controls'}`}
              onClick={() => setIsSidebarOpen(true)}
            >
              {adminProfile?.avatar ? (
                <img src={adminProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                (user?.username || 'AD').substring(0,2).toUpperCase()
              )}
            </div>
          )}

          {/* Navigation Items */}
          <nav className="space-y-1.5">
            {isSidebarOpen && (
              <span className="text-[8.5px] font-mono font-black text-text-secondary uppercase tracking-widest block mb-2 px-1">CORE COMMANDS</span>
            )}
            
            {/* Tab: Overview (Only if LOGIN_ADMIN or CLI_ADMIN) */}
            {(adminRole === 'LOGIN_ADMIN' || adminRole === 'CLI_ADMIN') && (
              <button
                onClick={() => selectTab('overview')}
                title={!isSidebarOpen ? "Overview Desk" : undefined}
                className={`flex items-center rounded-xl font-sans font-bold transition-all border text-xs cursor-pointer ${
                  isSidebarOpen 
                    ? 'w-full gap-3 px-3.5 py-2.5 text-left' 
                    : 'w-11 h-11 mx-auto justify-center'
                } ${
                  activeTab === 'overview'
                    ? 'bg-accent-10 border-accent-20 text-accent'
                    : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
                }`}
              >
                <Activity className="w-4 h-4 shrink-0" />
                {isSidebarOpen && <span>Overview Desk</span>}
              </button>
            )}

            {/* Tab: Users (Only if LOGIN_ADMIN or CLI_ADMIN) */}
            {(adminRole === 'LOGIN_ADMIN' || adminRole === 'CLI_ADMIN') && (
              <button
                onClick={() => selectTab('users')}
                title={!isSidebarOpen ? "User Directory" : undefined}
                className={`flex items-center rounded-xl font-sans font-bold transition-all border text-xs cursor-pointer ${
                  isSidebarOpen 
                    ? 'w-full gap-3 px-3.5 py-2.5 text-left' 
                    : 'w-11 h-11 mx-auto justify-center'
                } ${
                  activeTab === 'users'
                    ? 'bg-accent-10 border-accent-20 text-accent'
                    : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                {isSidebarOpen && <span>User Directory</span>}
              </button>
            )}

            {/* Tab: Dispute Support Tickets */}
            <button
              onClick={() => selectTab('tickets')}
              title={!isSidebarOpen ? "Dispute Cases" : undefined}
              className={`flex items-center rounded-xl font-sans font-bold transition-all border text-xs cursor-pointer ${
                isSidebarOpen 
                  ? 'w-full gap-3 px-3.5 py-2.5 text-left' 
                  : 'w-11 h-11 mx-auto justify-center'
              } ${
                activeTab === 'tickets'
                  ? 'bg-accent-10 border-accent-20 text-accent'
                  : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
              }`}
            >
              <HelpCircle className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span>Dispute Cases</span>}
            </button>

            {/* Tab: Escalated Reports */}
            <button
              onClick={() => selectTab('reports')}
              title={!isSidebarOpen ? "Escalated Reports" : undefined}
              className={`flex items-center rounded-xl font-sans font-bold transition-all border text-xs cursor-pointer ${
                isSidebarOpen 
                  ? 'w-full gap-3 px-3.5 py-2.5 text-left' 
                  : 'w-11 h-11 mx-auto justify-center'
              } ${
                activeTab === 'reports'
                  ? 'bg-accent-10 border-accent-20 text-accent'
                  : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span>Escalated Reports</span>}
            </button>

            {/* Tab: Lounge Feed (Announcements) */}
            {(adminRole === 'LOGIN_ADMIN' || adminRole === 'CLI_ADMIN') && (
              <button
                onClick={() => selectTab('announcements')}
                title={!isSidebarOpen ? "Feed Broadcasts" : undefined}
                className={`flex items-center rounded-xl font-sans font-bold transition-all border text-xs cursor-pointer ${
                  isSidebarOpen 
                    ? 'w-full gap-3 px-3.5 py-2.5 text-left' 
                    : 'w-11 h-11 mx-auto justify-center'
                } ${
                  activeTab === 'announcements'
                    ? 'bg-accent-10 border-accent-20 text-accent'
                    : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
                }`}
              >
                <Megaphone className="w-4 h-4 shrink-0" />
                {isSidebarOpen && <span>Feed Broadcasts</span>}
              </button>
            )}

            {/* Tab: Moderation Controls */}
            <button
              onClick={() => selectTab('moderation')}
              title={!isSidebarOpen ? "Moderation Sanctions" : undefined}
              className={`flex items-center rounded-xl font-sans font-bold transition-all border text-xs cursor-pointer ${
                isSidebarOpen 
                  ? 'w-full gap-3 px-3.5 py-2.5 text-left' 
                  : 'w-11 h-11 mx-auto justify-center'
              } ${
                activeTab === 'moderation'
                  ? 'bg-accent-10 border-accent-20 text-accent'
                  : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
              }`}
            >
              <Ban className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span>Moderation Sanctions</span>}
            </button>

            {/* Tab: System Health (Only if LOGIN_ADMIN or CLI_ADMIN) */}
            {(adminRole === 'LOGIN_ADMIN' || adminRole === 'CLI_ADMIN') && (
              <button
                onClick={() => selectTab('system')}
                title={!isSidebarOpen ? "System Sentinel" : undefined}
                className={`flex items-center rounded-xl font-sans font-bold transition-all border text-xs cursor-pointer ${
                  isSidebarOpen 
                    ? 'w-full gap-3 px-3.5 py-2.5 text-left' 
                    : 'w-11 h-11 mx-auto justify-center'
                } ${
                  activeTab === 'system'
                    ? 'bg-accent-10 border-accent-20 text-accent'
                    : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
                }`}
              >
                <Sliders className="w-4 h-4 shrink-0" />
                {isSidebarOpen && <span>System Sentinel</span>}
              </button>
            )}

            {/* Tab: Audit Registry (Only if LOGIN_ADMIN or CLI_ADMIN) */}
            {(adminRole === 'LOGIN_ADMIN' || adminRole === 'CLI_ADMIN') && (
              <button
                onClick={() => selectTab('logs')}
                title={!isSidebarOpen ? "Audit Logs" : undefined}
                className={`flex items-center rounded-xl font-sans font-bold transition-all border text-xs cursor-pointer ${
                  isSidebarOpen 
                    ? 'w-full gap-3 px-3.5 py-2.5 text-left' 
                    : 'w-11 h-11 mx-auto justify-center'
                } ${
                  activeTab === 'logs'
                    ? 'bg-accent-10 border-accent-20 text-accent'
                    : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
                }`}
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                {isSidebarOpen && <span>Audit Logs</span>}
              </button>
            )}

            {/* Tab: Central Bank / Escrow Ledger */}
            <button
              onClick={() => selectTab('bank')}
              title={!isSidebarOpen ? (adminRole === 'SUPPORT_ADMIN' ? 'Escrow Ledger' : 'Central Bank') : undefined}
              className={`flex items-center rounded-xl font-sans font-bold transition-all border text-xs cursor-pointer ${
                isSidebarOpen 
                  ? 'w-full gap-3 px-3.5 py-2.5 text-left' 
                  : 'w-11 h-11 mx-auto justify-center'
              } ${
                activeTab === 'bank'
                  ? 'bg-bank-accent-10 border-bank-accent-20 text-bank-accent'
                  : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
              }`}
            >
              <Landmark className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span>{adminRole === 'SUPPORT_ADMIN' ? 'Escrow Ledger' : 'Central Bank'}</span>}
            </button>

            {/* Tab: Profile & Credentials */}
            <button
              onClick={() => selectTab('profile')}
              title={!isSidebarOpen ? "Profile" : undefined}
              className={`flex items-center rounded-xl font-sans font-bold transition-all border text-xs cursor-pointer ${
                isSidebarOpen 
                  ? 'w-full gap-3 px-3.5 py-2.5 text-left' 
                  : 'w-11 h-11 mx-auto justify-center'
              } ${
                activeTab === 'profile'
                  ? 'bg-accent-10 border-accent-20 text-accent'
                  : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary hover:bg-text-primary-2'
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span>Profile</span>}
            </button>

            {/* Switch to CLI Console (Only if onSwitchToCli callback is provided) */}
            {onSwitchToCli && (
              <button
                type="button"
                onClick={onSwitchToCli}
                title={!isSidebarOpen ? "Open CLI Console" : undefined}
                className={`flex items-center rounded-xl font-sans font-bold transition-all border border-accent/25 bg-accent/5 text-accent hover:bg-accent/15 hover:text-accent-hover text-xs cursor-pointer mt-4 ${
                  isSidebarOpen 
                    ? 'w-full gap-3 px-3.5 py-2.5 text-left' 
                    : 'w-11 h-11 mx-auto justify-center'
                }`}
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                {isSidebarOpen && <span>Open CLI Console</span>}
              </button>
            )}
          </nav>
        </div>

        {/* Footer Area with Logout */}
        <div className={`pt-4 border-t border-white-5 ${!isSidebarOpen ? 'flex justify-center' : ''}`}>
          <button
            type="button"
            onClick={onLogout}
            title={!isSidebarOpen ? "Signout Panel" : undefined}
            className={`flex items-center justify-center transition uppercase tracking-wider cursor-pointer ${
              isSidebarOpen 
                ? 'w-full gap-2.5 bg-status-dnd/20 border border-red-900/30 hover:bg-red-900 hover:text-text-primary text-red-400 px-4 py-3 rounded-xl text-xs font-sans font-bold' 
                : 'w-11 h-11 rounded-xl text-red-400 bg-status-dnd/20 border border-red-900/30 hover:bg-red-900 hover:text-text-primary'
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {isSidebarOpen && <span>Signout Panel</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Top Header - Only visible on mobile (lg:hidden) when sidebar is closed */}
      {!isSidebarOpen && (
        <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-velum-850 border-b border-white-5 z-40 px-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="p-2 bg-velum-800 border border-white-5 rounded-lg text-text-primary hover:bg-text-primary-5 transition-colors"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: logoSvg }} />
              <div>
                <span className="text-xs font-sans font-black tracking-widest text-accent uppercase block">VELUM</span>
                <span className="text-[8px] font-mono font-bold block text-text-secondary uppercase tracking-widest leading-none">CONTROL CENTER</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-status-online animate-pulse" />
            <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-widest">SECURE</span>
          </div>
        </header>
      )}

      {/* Main Action desk view area */}
      <main className={`
        flex-1 overflow-y-auto px-4 sm:px-8 pb-8 relative min-w-0 max-w-7xl mx-auto w-full transition-all duration-300 glass-panel border-y-0 border-r-0 rounded-none
        ${!isSidebarOpen ? 'pt-24 lg:pt-8' : 'pt-8'}
      `}>
      
      {/* 1. OVERVIEW VIEW */}
      {/* 1. OVERVIEW VIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          {/* 3 Bento Metrics Cards (Forced Single Row) */}
          <div className="grid grid-cols-3 gap-4">
            
            {/* Card 1: Total Users */}
            <div 
              onClick={() => onTabChange && onTabChange('users')}
              className={`p-3 sm:p-5 rounded-2xl border ${c.bgPanel} transition hover:border-accent-40 flex items-center justify-between cursor-pointer group select-none`}
            >
              <div>
                <span className="text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider text-text-secondary font-sans block mb-0.5 sm:mb-1">Total Users</span>
                <span className="text-base sm:text-2xl font-black text-text-primary font-sans">{statsOverview.totalUsers.toLocaleString()}</span>
                <span className="text-[7.5px] sm:text-[9.5px] text-accent font-bold font-sans block mt-0.5 sm:mt-1">Active Directory</span>
              </div>
              <div className="p-2 sm:p-3 rounded-xl bg-accent-10 text-accent group-hover:scale-110 transition-transform shrink-0">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>

            {/* Card 2: Active Rooms */}
            <div 
              onClick={() => onTabChange && onTabChange('announcements')}
              className={`p-3 sm:p-5 rounded-2xl border ${c.bgPanel} transition hover:border-accent-secondary-20 flex items-center justify-between cursor-pointer group select-none`}
            >
              <div>
                <span className="text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider text-text-secondary font-sans block mb-0.5 sm:mb-1">Active Rooms</span>
                <span className="text-base sm:text-2xl font-black text-accent-secondary font-sans">{statsOverview.totalRooms}</span>
                <span className="text-[7.5px] sm:text-[9.5px] text-accent-secondary font-bold font-sans block mt-0.5 sm:mt-1">Sync Live</span>
              </div>
              <div className="p-2 sm:p-3 rounded-xl bg-accent-secondary-10 text-accent-secondary group-hover:scale-110 transition-transform shrink-0">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>

            {/* Card 3: Open Incidents */}
            <div 
              onClick={() => onTabChange && onTabChange('tickets')}
              className={`p-3 sm:p-5 rounded-2xl border ${c.bgPanel} transition hover:border-accent-40 flex items-center justify-between cursor-pointer group select-none`}
            >
              <div>
                <span className="text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider text-text-secondary font-sans block mb-0.5 sm:mb-1">Open Incidents</span>
                <span className="text-base sm:text-2xl font-black text-text-primary font-sans">{statsOverview.openTicketsCount}</span>
                <span className="text-[7.5px] sm:text-[9.5px] text-accent font-bold font-sans block mt-0.5 sm:mt-1">Active Cases</span>
              </div>
              <div className="p-2 sm:p-3 rounded-xl bg-accent-10 text-accent group-hover:scale-110 transition-transform shrink-0">
                <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
          </div>

          {/* Recent System Incidents Table (Full Width) */}
          <div 
            onClick={() => onTabChange && onTabChange('tickets')}
            className="py-6 cursor-pointer hover:text-accent transition duration-200 select-none w-full border-t border-white-5 mt-6"
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
        </div>
      )}

      {/* 2. USERS DIRECTORY VIEW */}
      {activeTab === 'users' && (
        <div className="space-y-6 animate-fadeIn">
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
          <div className="flex flex-col border-t border-white-5 pt-6 mt-4">
            
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
        <div className="space-y-6 animate-fadeIn">
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
          <div className="overflow-x-auto rounded-xl border border-white-5 bg-white/[0.01]">
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
                  <tr 
                    key={rep.report_id} 
                    className={`transition duration-150 ${
                      rep.priority === 'HIGH' 
                        ? 'bg-rose-500/10 hover:bg-rose-500/15 border-l-2 border-rose-500' 
                        : 'hover:bg-text-primary-2'
                    }`}
                  >
                    <td className="py-4 pl-4 font-mono text-accent font-black">#{rep.report_id}</td>
                    <td className="py-4">
                      <span className="font-bold text-text-primary uppercase text-[9.5px] px-2 py-0.5 rounded bg-text-primary-5 border border-white-10 font-mono">
                        {(rep.type || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-4 text-text-primary font-bold">{rep.reporter_name || 'Anonymous'}</td>
                    <td className="py-4 text-text-secondary font-medium max-w-sm truncate leading-snug">
                      <span className="italic">"{rep.reason || 'Empty report details.'}"</span>
                    </td>
                    <td className="py-4 font-mono text-text-secondary text-[10px]">
                      {new Date(rep.created_at).toLocaleString()}
                    </td>
                    <td className="py-4 text-right pr-4">
                      <div className="flex items-center justify-end gap-2">
                        {rep.status !== 'closed' ? (
                          <button
                            onClick={async () => {
                              try {
                                const res = await adminFetch(`/api/admin/reports/${rep.report_id}/status`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'closed' })
                                });
                                if (res.ok) {
                                  alert(`Report marked as resolved/closed.`);
                                  fetchData();
                                }
                              } catch {
                                alert('Operation failed.');
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-accent-20 bg-accent-10 hover:bg-accent text-accent hover:text-text-primary text-[10px] font-bold font-mono uppercase transition cursor-pointer"
                          >
                            Resolve Case
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-400 font-mono uppercase mr-2">Resolved</span>
                        )}
                        {(adminRole === 'LOGIN_ADMIN' || user?.role === 'CLI_ADMIN') && (
                          <button
                            onClick={async () => {
                              if (confirm(`ALERT: Are you absolutely sure you want to permanently delete report case #${rep.report_id}?`)) {
                                try {
                                  const res = await adminFetch(`/api/admin/reports/${rep.report_id}/delete`, {
                                    method: 'POST'
                                  });
                                  if (res.ok) {
                                    alert(`Case #${rep.report_id} successfully deleted.`);
                                    fetchData();
                                  } else {
                                    alert('Failed to delete report.');
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
                    
                    const activeContent = decryptMessage(msg.content || '', msg.room_id || selectedChannel, msg.is_encrypted || msg.isEncrypted);

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
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Entry code creation layout */}
            <div className="glass-card p-6 shadow-lg flex flex-col justify-between">
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
            <div className="glass-card p-6 shadow-lg flex flex-col justify-between">
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

            {/* quarantine checking tool */}
            <div className="glass-card p-6 shadow-lg flex flex-col justify-between">
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
          adminRole={adminRole === 'SUPPORT_ADMIN' ? 'SUPPORT_ADMIN' : 'LOGIN_ADMIN'}
          activeSanctions={activeSanctions}
          users={users}
          applyQuickSanction={applyQuickSanction}
          adminFetch={adminFetch}
          fetchData={fetchData}
          c={c}
        />
      )}

      
      {/* 10. VERIFICATION VIEW */}
      {activeTab === 'verification' && (
        <AdminVerificationView
          adminRole={adminRole === 'SUPPORT_ADMIN' ? 'SUPPORT_ADMIN' : 'LOGIN_ADMIN'}
          c={c}
        />
      )}

      {/* CENTRAL BANK & ESCROW REGISTRY TAB */}
      {activeTab === 'bank' && (
        <div className="space-y-6 animate-fadeIn font-sans text-xs">
          
          {/* 1. Grand Sovereign Header & Welcome Card */}
          <div className="p-8 rounded-2xl bg-gradient-to-r from-velum-850 via-velum-800 to-velum-850 border border-bank-accent/30 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-bank-accent to-bank-accent-hover" />
            
            {/* Ambient visual glowing effect */}
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-bank-accent-10 rounded-full blur-3xl opacity-35 pointer-events-none" />
            
            <div className="space-y-2 max-w-2xl relative z-10">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-bank-accent-10 border border-bank-accent-20 text-[8.5px] font-mono font-black text-bank-accent uppercase tracking-[0.2em]">
                <Landmark className="w-2.5 h-2.5" /> VELUM SOVEREIGN CLEARING BOARD
              </div>
              <h3 className="font-display font-black text-xl text-text-primary tracking-tight">
                {user?.username === 'lexie' ? 'Governor Lexie' : user?.username === 'midnight' ? 'Governor Midnight' : 'Executive Officer'}
              </h3>
              <p className="text-[11px] text-text-secondary font-sans leading-relaxed">
                Central banking node authorized for clearing network settlement, sovereign asset custody auditing, policy target configurations, and E2E decentralized liquidity ledger maintenance.
              </p>
              
              {/* Central Bank Quick Policy Stats Bar */}
              <div className="pt-2 flex flex-wrap gap-x-6 gap-y-1.5 text-[9.5px] font-mono uppercase text-text-secondary/85">
                <span className="flex items-center gap-1">Policy Target Rate: <strong className="text-bank-accent font-bold">4.25%</strong></span>
                <span className="flex items-center gap-1">Liquidity Class: <strong className="text-text-primary font-bold">AAA Sovereign Backed</strong></span>
                <span className="flex items-center gap-1">Base Currency Peg: <strong className="text-emerald-400 font-bold">TWD / GBP</strong></span>
              </div>
            </div>

            {/* Real-time sync and status controls */}
            <div className="flex flex-wrap items-center gap-3 relative z-10 shrink-0">
              <span className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border font-mono text-[9.5px] font-extrabold ${
                bankStatus?.storage === 'CONNECTED' 
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' 
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${bankStatus?.storage === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
                {bankStatus?.storage === 'CONNECTED' ? 'REDIS LEDGER REPLICATED' : 'LOCAL CACHE SYNCHRONIZED'}
              </span>
              <button 
                type="button"
                onClick={fetchBankData}
                className="p-2.5 bg-velum-750 hover:bg-velum-700 border border-white-5 text-text-primary rounded-xl transition cursor-pointer flex items-center justify-center hover:border-bank-accent shadow-sm"
                title="Synchronize clearing networks"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Success / Error Messages */}
          {bankError && (
            <div className="p-4 bg-bank-rose/10 border border-bank-rose/25 text-bank-rose text-[11px] rounded-xl font-mono font-bold leading-normal flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-bank-rose animate-ping" />
              ERROR: {bankError}
            </div>
          )}
          {bankSuccess && (
            <div className="p-4 bg-bank-emerald/10 border border-bank-emerald/25 text-bank-emerald text-[11px] rounded-xl font-mono font-bold leading-normal flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-bank-emerald" />
              SUCCESS: {bankSuccess}
            </div>
          )}

          {/* 2. Institutional Reserve Analytics Metrics Bento Grid */}
          {(() => {
            const totalLiquidityTwd = bankAccounts.reduce((sum, acc) => {
              if (acc.currency_code === 'TWD') {
                return sum + (acc.balance_cents / 100);
              }
              return sum;
            }, 0);

            const centralReserveAcc = bankAccounts.find(a => a.account_name.toUpperCase().includes('CENTRAL'));
            const centralBalance = centralReserveAcc ? (centralReserveAcc.balance_cents / 100) : 18400000000;

            const escrowReserveAcc = bankAccounts.find(a => a.account_name.toUpperCase().includes('ESCROW'));
            const escrowBalance = escrowReserveAcc ? (escrowReserveAcc.balance_cents / 100) : 8500000000;

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Metric 1: Aggregate Base */}
                <div className="p-5 rounded-2xl bg-velum-800 border border-white-5 hover:border-bank-accent/20 shadow-md flex flex-col justify-between transition-all duration-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] font-mono font-black text-text-secondary uppercase tracking-wider block mb-1">AGGREGATE RESERVES Base</span>
                      <span className="text-[8.5px] font-mono font-black text-bank-emerald bg-bank-emerald/10 border border-bank-emerald/20 px-1.5 py-0.5 rounded uppercase">
                        100% Sovereign Backed
                      </span>
                    </div>
                    <Landmark className="w-4 h-4 text-text-disabled" />
                  </div>
                  <div className="mt-5">
                    <div className="text-xl font-mono font-black text-white tracking-tight leading-none">
                      NT$ {totalLiquidityTwd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] font-mono text-text-secondary font-medium mt-1.5 uppercase tracking-wide">
                      ≈ £ {(totalLiquidityTwd / 36.8).toLocaleString(undefined, { maximumFractionDigits: 0 })} GBP equivalent
                    </div>
                  </div>
                </div>

                {/* Metric 2: Central Reserve */}
                <div className="p-5 rounded-2xl bg-velum-800 border border-white-5 hover:border-bank-accent/20 shadow-md flex flex-col justify-between transition-all duration-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] font-mono font-black text-text-secondary uppercase tracking-wider block mb-1">CENTRAL BANK RESERVE</span>
                      <span className="text-[8.5px] font-mono font-black text-bank-accent bg-bank-accent-10 border border-bank-accent-20 px-1.5 py-0.5 rounded uppercase">
                        Seeded M0 Anchor
                      </span>
                    </div>
                    <ShieldCheck className="w-4 h-4 text-text-disabled" />
                  </div>
                  <div className="mt-5">
                    <div className="text-xl font-mono font-black text-text-primary tracking-tight leading-none">
                      NT$ {centralBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] font-sans text-text-secondary font-medium mt-1.5 uppercase tracking-wide">
                      M0 Primary Liquid Settlement Vault
                    </div>
                  </div>
                </div>

                {/* Metric 3: Escrow Trustee */}
                <div className="p-5 rounded-2xl bg-velum-800 border border-white-5 hover:border-bank-accent/20 shadow-md flex flex-col justify-between transition-all duration-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] font-mono font-black text-text-secondary uppercase tracking-wider block mb-1">ESCROW TRUSTEE HOLDINGS</span>
                      <span className="text-[8.5px] font-mono font-black text-orange-400 bg-orange-400/10 border border-orange-400/20 px-1.5 py-0.5 rounded uppercase">
                        Client Custody Hold
                      </span>
                    </div>
                    <Lock className="w-4 h-4 text-text-disabled" />
                  </div>
                  <div className="mt-5">
                    <div className="text-xl font-mono font-black text-text-primary tracking-tight leading-none">
                      NT$ {escrowBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] font-sans text-text-secondary font-medium mt-1.5 uppercase tracking-wide">
                      Active Multi-User Smart Escrows
                    </div>
                  </div>
                </div>

                {/* Metric 4: Clearing Network Status */}
                <div className="p-5 rounded-2xl bg-velum-800 border border-white-5 hover:border-bank-accent/20 shadow-md flex flex-col justify-between transition-all duration-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] font-mono font-black text-text-secondary uppercase tracking-wider block mb-1">SECURE CLEARING NODES</span>
                      <span className="text-[8.5px] font-mono font-black text-sky-400 bg-sky-400/10 border border-sky-400/20 px-1.5 py-0.5 rounded uppercase">
                        Sovereign Vault Network
                      </span>
                    </div>
                    <Globe className="w-4 h-4 text-text-disabled" />
                  </div>
                  <div className="mt-5">
                    <div className="text-lg font-mono font-black text-white tracking-tight flex items-center gap-1.5 leading-none">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      NETWORK ONLINE
                    </div>
                    <div className="text-[10px] font-mono text-text-secondary font-medium mt-1.5 uppercase tracking-wide">
                      {bankAccounts.length} Active Vault Nodes Synchronized
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 3. Live Exchange Rate Index Matrix & Interactive FX Converter */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Exchange Rate Matrix Display (Left 7 Columns) */}
            <div className="lg:col-span-7 p-6 rounded-2xl bg-velum-800 border border-white-5 shadow-xl space-y-4">
              <div className="border-b border-white-5 pb-3.5 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-bank-accent font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-bank-accent animate-pulse" />
                    Sovereign Exchange Board (FX Matrix)
                  </h3>
                  <p className="text-[10px] text-text-secondary font-sans mt-0.5">Sovereign valuation index pegs calibrated for national clearing accounts.</p>
                </div>
                <span className="text-[9px] font-mono text-text-secondary/60 bg-text-primary-5 px-2.5 py-1 rounded border border-white-5 uppercase tracking-wider">LIVE INDEX</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                
                {/* Peg 1: GBP to TWD */}
                <div className="p-4 rounded-xl bg-velum-850/50 border border-white-5 text-center space-y-1 hover:border-bank-accent/15 transition-all">
                  <span className="text-[8.5px] font-mono font-black text-text-secondary uppercase block">GBP / TWD peg</span>
                  <div className="text-sm font-mono font-black text-white">36.80</div>
                  <span className="text-[8px] font-sans text-text-secondary block">1.00 £ = NT$ 36.80</span>
                </div>

                {/* Peg 2: USD to TWD */}
                <div className="p-4 rounded-xl bg-velum-850/50 border border-white-5 text-center space-y-1 hover:border-bank-accent/15 transition-all">
                  <span className="text-[8.5px] font-mono font-black text-text-secondary uppercase block">USD / TWD peg</span>
                  <div className="text-sm font-mono font-black text-white">30.65</div>
                  <span className="text-[8px] font-sans text-text-secondary block">1.00 $ = NT$ 30.65</span>
                </div>

                {/* Peg 3: VLM to TWD */}
                <div className="p-4 rounded-xl bg-velum-850/50 border border-white-5 text-center space-y-1 hover:border-bank-accent/15 transition-all">
                  <span className="text-[8.5px] font-mono font-black text-text-secondary uppercase block">VLM / TWD index</span>
                  <div className="text-sm font-mono font-black text-bank-accent">36.80</div>
                  <span className="text-[8px] font-sans text-text-secondary block">1.00 VLM = NT$ 36.80</span>
                </div>

                {/* Peg 4: VLM to GBP */}
                <div className="p-4 rounded-xl bg-velum-850/50 border border-white-5 text-center space-y-1 hover:border-bank-accent/15 transition-all">
                  <span className="text-[8.5px] font-mono font-black text-text-secondary uppercase block">VLM / GBP peg</span>
                  <div className="text-sm font-mono font-black text-emerald-400">1.0000</div>
                  <span className="text-[8px] font-sans text-text-secondary block">1.00 VLM = 1.00 £ GBP</span>
                </div>
                
              </div>

              <div className="p-3.5 bg-velum-750 rounded-xl border border-white-5 text-[10px] font-mono text-text-secondary text-center uppercase tracking-wide leading-relaxed">
                ⚖️ <strong>Mathematical Alignment verified</strong>: Velum system capital seed of <span className="text-white">£ 500M</span> converts precisely to <span className="text-white">NT$ 18.40B</span> based on official clearing node ratio coordinates.
              </div>
            </div>

            {/* Interactive Institutional Converter (Right 5 Columns) */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-velum-800 border border-white-5 shadow-xl space-y-4">
              <div className="border-b border-white-5 pb-3.5">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-text-primary font-mono">
                  Institutional FX Cross-Converter
                </h3>
                <p className="text-[10px] text-text-secondary font-sans mt-0.5">Perform live cross-valuation arithmetic against sovereign pegs.</p>
              </div>

              <div className="space-y-3.5 font-mono text-xs">
                
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[8.5px] text-text-secondary uppercase mb-1 font-bold">Clearing Input Volume</label>
                    <input 
                      type="number" 
                      placeholder="Enter amount..."
                      value={calcAmount}
                      onChange={(e) => setCalcAmount(e.target.value)}
                      className="w-full p-3 bg-velum-750 border border-white-5 rounded-xl outline-none focus:border-bank-accent text-white font-mono text-xs font-bold"
                    />
                  </div>
                  <div className="w-28">
                    <label className="block text-[8.5px] text-text-secondary uppercase mb-1 font-bold">Source Asset</label>
                    <select
                      value={calcFrom}
                      onChange={(e) => setCalcFrom(e.target.value)}
                      className="w-full p-3 bg-velum-750 border border-white-5 rounded-xl text-white outline-none focus:border-bank-accent font-mono text-xs font-bold"
                    >
                      <option value="GBP">GBP (£)</option>
                      <option value="TWD">TWD (NT$)</option>
                      <option value="USD">USD ($)</option>
                      <option value="VLM">VLM (Velum)</option>
                    </select>
                  </div>
                </div>

                {/* Display calculated conversions */}
                {calcAmount && parseFloat(calcAmount) > 0 ? (() => {
                  const amt = parseFloat(calcAmount);
                  const rates: Record<string, number> = {
                    TWD: 1.00,
                    GBP: 36.80,
                    USD: 30.65,
                    VLM: 36.80
                  };
                  
                  // Convert to base TWD first
                  const amtInTwd = amt * rates[calcFrom];
                  
                  return (
                    <div className="p-4 bg-velum-850/85 rounded-xl border border-bank-accent-20 space-y-2 text-[11px]">
                      <span className="text-[8px] text-bank-accent uppercase tracking-widest font-black block mb-2">// CALCULATED VALUE EQUIVALENTS //</span>
                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <span className="text-[8px] text-text-secondary uppercase block font-bold">NEW TAIWAN DOLLAR</span>
                          <span className="text-white font-bold font-mono">NT$ {amtInTwd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TWD</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-text-secondary uppercase block font-bold">BRITISH POUND</span>
                          <span className="text-white font-bold font-mono">£ {(amtInTwd / rates.GBP).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GBP</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-text-secondary uppercase block font-bold">US DOLLAR</span>
                          <span className="text-white font-bold font-mono">$ {(amtInTwd / rates.USD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-text-secondary uppercase block font-bold">VELUM TOKEN</span>
                          <span className="text-bank-accent font-bold font-mono">{(amtInTwd / rates.VLM).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VLM</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-white-5 text-[8.5px] text-text-secondary/70 flex items-center gap-1.5">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        LIQUIDITY THRESHOLD CHECK: GREEN (E2E SETTLED)
                      </div>
                    </div>
                  );
                })() : (
                  <div className="p-4 bg-velum-850/30 rounded-xl border border-dashed border-white-5 text-center text-[10px] text-text-disabled uppercase">
                    Enter a transaction value above to simulate multi-peg conversions instantly.
                  </div>
                )}
                
              </div>
            </div>
            
          </div>

          {/* 4. Sovereign Reserve Accounts & Vaults Grid Section */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-white-5 pb-2">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-text-primary font-mono flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-bank-accent" />
                Sovereign Reserve Accounts & Clearing Coordinates
              </h3>
              <span className="text-[9px] font-mono text-text-secondary/75 uppercase font-bold tracking-wider">{bankAccounts.length} Connected Coordinate Points</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bankAccounts.map((acc) => {
                const isCentral = acc.account_name.toUpperCase().includes('CENTRAL');
                const isEscrow = acc.account_name.toUpperCase().includes('ESCROW');
                
                // Set custody grade based on account type
                const custodyGrade = isCentral ? "AAA Sovereign Backed" : isEscrow ? "AA Trustee Custody" : "A Correspondent Tier";
                const liquidityClass = isCentral ? "HQLA Tier-1 Asset" : isEscrow ? "Escrow Trustee Hold" : "Operational Clearing Reserve";

                const cardBorder = isCentral 
                  ? 'border-bank-accent-40 hover:border-bank-accent shadow-[0_4px_25px_rgba(85,133,226,0.03)]' 
                  : isEscrow 
                  ? 'border-orange-500/30 hover:border-orange-500/60' 
                  : 'border-white-5 hover:border-white-10';

                return (
                  <div 
                    key={acc.account_id} 
                    className={`p-6 rounded-2xl bg-velum-800 border ${cardBorder} flex flex-col justify-between min-h-[210px] relative overflow-hidden shadow-lg transition duration-200 group`}
                  >
                    {/* Digital Grid Accent Background */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-bank-accent-10 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-all pointer-events-none" />

                    <div className="space-y-4">
                      
                      {/* Account Institution & Header */}
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[8.5px] font-mono font-black text-bank-accent uppercase tracking-[0.1em] block">{acc.institution}</span>
                          <h4 className="text-[12px] font-extrabold text-text-primary mt-1 uppercase max-w-[190px] truncate leading-tight tracking-wide">{acc.account_name}</h4>
                        </div>
                        <span className={`text-[8.5px] font-mono font-black px-2.5 py-1 rounded border uppercase ${
                          acc.status === 'active' 
                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' 
                            : 'bg-red-500/10 border-red-500/25 text-red-400 animate-pulse'
                        }`}>
                          {acc.status === 'active' ? 'Active Clearing' : 'Frozen Hold'}
                        </span>
                      </div>

                      {/* Reserve Liquidity Balance */}
                      <div>
                        <span className="text-[8.5px] font-mono font-black text-text-secondary uppercase tracking-widest block">Available Reserve Balance</span>
                        <div className="text-xl font-mono font-black text-white mt-1.5 tracking-tight flex items-baseline">
                          {acc.currency_code === 'TWD' ? 'NT$ ' : ''}
                          {(acc.balance_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="text-[10px] text-text-secondary font-bold ml-1.5 uppercase">{acc.currency_code}</span>
                        </div>
                      </div>

                      {/* Metadata Labels specific to a real central bank */}
                      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white-5/80 text-[8px] font-mono uppercase text-text-secondary/80">
                        <div>
                          <span className="block text-text-disabled font-bold tracking-wider">Custody Grade</span>
                          <span className="text-text-primary font-bold mt-0.5 block">{custodyGrade}</span>
                        </div>
                        <div>
                          <span className="block text-text-disabled font-bold tracking-wider">Liquidity Class</span>
                          <span className="text-text-primary font-bold mt-0.5 block">{liquidityClass}</span>
                        </div>
                      </div>

                    </div>

                    <div className="flex justify-between items-center border-t border-white-5 pt-4 mt-5 text-[9px] text-text-secondary font-mono">
                      <div className="flex flex-col text-[8px] leading-relaxed">
                        <span className="tracking-wider">CODE: {acc.account_number}</span>
                        <span className="opacity-55 font-bold">BENEFICIARY: {acc.beneficiary_owner}</span>
                      </div>

                      {adminRole !== 'SUPPORT_ADMIN' && (
                        <div className="flex items-center gap-2 relative z-10 shrink-0">
                          <button 
                            type="button"
                            onClick={() => {
                              setAdjustingAccountId(acc.account_id);
                              setAdjustAmount(''); 
                              setAdjustDesc('');
                            }}
                            className="px-3 py-1.5 text-[9.5px] font-mono font-black bg-bank-accent-10 border border-bank-accent-20 hover:border-bank-accent hover:bg-bank-accent text-bank-accent hover:text-velum-900 rounded-lg transition uppercase cursor-pointer"
                          >
                            Adjust
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleToggleFreeze(acc.account_id, acc.status === 'frozen')}
                            className={`px-3 py-1.5 text-[9.5px] font-mono font-black border rounded-lg transition uppercase cursor-pointer ${
                              acc.status === 'frozen'
                                ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-velum-900'
                                : 'bg-red-500/10 border-red-500/20 hover:bg-red-500 text-red-400 hover:text-velum-900'
                            }`}
                          >
                            {acc.status === 'frozen' ? 'Unfreeze' : 'Freeze'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Register Reserve Vault Trigger Card */}
              {adminRole !== 'SUPPORT_ADMIN' && !showAddAccount && (
                <div 
                  onClick={() => setShowAddAccount(true)}
                  className="p-6 rounded-2xl border border-dashed border-bank-accent-40 hover:border-bank-accent bg-velum-800/30 hover:bg-velum-800/80 flex flex-col items-center justify-center min-h-[210px] cursor-pointer group transition duration-200"
                >
                  <div className="p-3 bg-bank-accent-10 border border-bank-accent-20 rounded-full text-bank-accent group-hover:bg-bank-accent group-hover:text-velum-900 transition-all duration-200">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold font-sans text-text-primary group-hover:text-bank-accent mt-3 transition-colors tracking-wide">Register New Reserve Vault</span>
                  <span className="text-[9.5px] font-mono text-text-secondary/60 uppercase mt-1 tracking-wider text-center max-w-[200px]">Add sovereign client reserves or external correspondent banks</span>
                </div>
              )}
            </div>
          </div>

          {/* 5. Adjust Balance Dialog Panel Overlay */}
          {adjustingAccountId && (() => {
            const currentAcc = bankAccounts.find(a => a.account_id === adjustingAccountId);
            if (!currentAcc) return null;

            return (
              <div className="p-6 rounded-2xl bg-velum-800 border border-bank-accent border-l-4 animate-fadeIn max-w-2xl space-y-4 shadow-xl">
                <div className="flex items-start justify-between border-b border-white-5 pb-3">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-widest font-mono text-bank-accent">Reserve Allocation Ledger Adjustment</h4>
                    <p className="text-[10px] text-text-secondary mt-1 font-mono uppercase">
                      RESERVE ARCHIVE ID: {currentAcc.account_number}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[8.5px] font-mono text-text-secondary uppercase block">Current Audited Balance</span>
                    <span className="text-[12px] font-mono font-black text-white block mt-0.5">
                      {currentAcc.currency_code === 'TWD' ? 'NT$ ' : ''}
                      {(currentAcc.balance_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currentAcc.currency_code}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleAdjustBalance} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9.5px] text-text-primary font-bold uppercase mb-1.5 font-mono tracking-wider">Adjustment Amount (Full Currency Units)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondary font-mono text-[11px]">
                          {currentAcc.currency_code}
                        </div>
                        <input 
                          type="number" 
                          step="0.01" 
                          required 
                          placeholder="e.g. 50000.00"
                          value={adjustAmount} 
                          onChange={e => setAdjustAmount(e.target.value)} 
                          className="w-full pl-14 pr-3.5 py-3 rounded-xl font-mono text-[12px] outline-none border border-white-5 focus:border-bank-accent bg-velum-750 text-white"
                          autoFocus
                        />
                      </div>
                      <span className="text-[9px] text-text-secondary font-mono mt-1.5 block uppercase leading-relaxed">
                        ⚠️ Input negative values (e.g. -100000) to withdraw, positive values (e.g. 250000) to credit.
                      </span>
                    </div>

                    <div>
                      <label className="block text-[9.5px] text-text-primary font-bold uppercase mb-1.5 font-mono tracking-wider">Administrative Clearance & Audit Reason</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. System Sovereign Liquidity Rebalancing"
                        value={adjustDesc} 
                        onChange={e => setAdjustDesc(e.target.value)} 
                        className="w-full p-3.5 rounded-xl border border-white-5 focus:border-bank-accent bg-velum-750 text-white text-[12px]"
                      />
                      <span className="text-[9px] text-text-secondary font-mono mt-1.5 block uppercase leading-relaxed">
                        Reason mandatory for compliance ledger. E.g. &quot;Sovereign liquidity injection&quot; or &quot;Escrow payout&quot;.
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-3 border-t border-white-5">
                    <button 
                      type="submit" 
                      className="px-5 py-3 bg-bank-accent hover:bg-bank-accent-hover text-velum-900 font-extrabold uppercase rounded-xl text-[10.5px] tracking-widest transition cursor-pointer"
                    >
                      Process Ledger Adjustment
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setAdjustingAccountId(null)} 
                      className="px-5 py-3 bg-velum-700 hover:bg-velum-600 text-text-primary border border-white-5 font-extrabold uppercase rounded-xl text-[10.5px] tracking-widest transition cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </form>
              </div>
            );
          })()}

          {/* 6. Add Reserve Vault Dialog Form */}
          {showAddAccount && (
            <div className="p-6 rounded-2xl bg-velum-800 border border-bank-accent/30 animate-fadeIn space-y-4 shadow-xl">
              <div className="border-b border-white-5 pb-3">
                <h4 className="text-xs font-extrabold uppercase tracking-widest font-mono text-bank-accent">Register New Reserve Account or External Vault</h4>
                <p className="text-[9.5px] text-text-secondary font-mono mt-1 uppercase">Enter verified compliance and routing data to configure institutional banking coordinate.</p>
              </div>

              <form onSubmit={handleAddBankAccount} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-[9px] text-text-secondary font-bold uppercase mb-1.5 font-mono">Account / Vault Name</label>
                  <input type="text" required value={newAccName} onChange={e => setNewAccName(e.target.value)} className="w-full p-3 rounded-xl border border-white-5 bg-velum-750 text-white" />
                </div>
                <div>
                  <label className="block text-[9px] text-text-secondary font-bold uppercase mb-1.5 font-mono">Institution / Bank Name</label>
                  <input type="text" required value={newAccInst} onChange={e => setNewAccInst(e.target.value)} className="w-full p-3 rounded-xl border border-white-5 bg-velum-750 text-white" />
                </div>
                <div>
                  <label className="block text-[9px] text-text-secondary font-bold uppercase mb-1.5 font-mono">Account / Card Number</label>
                  <input type="text" required value={newAccNum} onChange={e => setNewAccNum(e.target.value)} className="w-full p-3 rounded-xl border border-white-5 font-mono bg-velum-750 text-white" />
                </div>
                <div>
                  <label className="block text-[9px] text-text-secondary font-bold uppercase mb-1.5 font-mono">Routing / SWIFT Code</label>
                  <input type="text" required value={newAccRout} onChange={e => setNewAccRout(e.target.value)} className="w-full p-3 rounded-xl border border-white-5 font-mono bg-velum-750 text-white" />
                </div>
                <div>
                  <label className="block text-[9px] text-text-secondary font-bold uppercase mb-1.5 font-mono">Beneficiary Owner Name</label>
                  <input type="text" required value={newAccOwner} onChange={e => setNewAccOwner(e.target.value)} className="w-full p-3 rounded-xl border border-white-5 bg-velum-750 text-white" />
                </div>
                <div>
                  <label className="block text-[9px] text-text-secondary font-bold uppercase mb-1.5 font-mono">Initial Reserve Balance (Fiat Value)</label>
                  <input type="number" step="0.01" required value={newAccBal} onChange={e => setNewAccBal(e.target.value)} className="w-full p-3 rounded-xl border border-white-5 font-mono bg-velum-750 text-white" />
                </div>
                <div className="md:col-span-2 lg:col-span-1">
                  <label className="block text-[9px] text-text-secondary font-bold uppercase mb-1.5 font-mono">Currency Designation</label>
                  <select value={newAccCurr} onChange={e => setNewAccCurr(e.target.value)} className="w-full p-3 rounded-xl border border-white-5 bg-velum-750 text-white font-mono">
                    <option value="TWD">TWD (New Taiwan Dollar / NT$)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="VLM">VLM (Velum Token)</option>
                  </select>
                </div>
                
                <div className="md:col-span-2 lg:col-span-3 flex gap-2.5 pt-3 border-t border-white-5">
                  <button type="submit" className="px-5 py-2.5 bg-bank-accent hover:bg-bank-accent-hover text-velum-900 font-extrabold uppercase rounded-xl text-[10px] tracking-widest transition cursor-pointer">Register Bank Vault</button>
                  <button type="button" onClick={() => setShowAddAccount(false)} className="px-5 py-2.5 bg-velum-700 hover:bg-velum-600 text-text-primary border border-white-5 font-extrabold uppercase rounded-xl text-[10px] tracking-widest transition cursor-pointer">Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* 7. Central Bank Sovereign Ledger Statement */}
          <div className="p-6 rounded-2xl bg-velum-800 border border-white-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white-5 pb-4">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-bank-accent font-mono flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-bank-accent animate-pulse" />
                Sovereign Operations & Settlement Statement
              </h3>
              <span className="text-[9px] font-mono text-text-secondary/45 px-2.5 py-1 rounded-md bg-text-primary-5 uppercase border border-white-5 tracking-wide">E2E Sovereign Ledger</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white-5 bg-velum-850/40">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="text-text-secondary text-[9px] font-black uppercase tracking-wider border-b border-white-5 bg-velum-800 select-none">
                    <th className="p-4 font-mono">Transaction ID / Ledger Block Seal</th>
                    <th className="p-4">Clearing Account Coordinate</th>
                    <th className="p-4">Sovereign Class</th>
                    <th className="p-4">Fiscal Reserve Impact</th>
                    <th className="p-4">Administrative Clearance Note</th>
                    <th className="p-4 text-right">Settlement Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03] text-text-primary font-medium">
                  {bankTransactions.map((tx, idx) => {
                    const isDebit = tx.type === 'withdrawal' || tx.type === 'escrow_hold';
                    const amountSign = isDebit ? '-' : '+';
                    const amountColor = isDebit ? 'text-bank-rose' : 'text-bank-emerald';
                    const accObj = bankAccounts.find((a: any) => a.account_id === tx.account_id);
                    
                    // Generate a deterministic hash-like seal for central bank look-and-feel
                    const blockSeal = `SIG-SHA256:${Math.abs(tx.transaction_id * 314159).toString(16).padEnd(8, '0').slice(0, 8)}`;

                    return (
                      <tr key={idx} className="hover:bg-text-primary-2 transition duration-150">
                        <td className="p-4 font-mono text-[10.5px]">
                          <div className="font-bold text-bank-accent">#{tx.transaction_id}</div>
                          <div className="text-[7.5px] text-text-disabled mt-0.5 tracking-wider">{blockSeal}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-text-primary uppercase">{accObj?.account_name || 'System Escrow Agent'}</div>
                          <div className="text-[8px] font-mono text-text-secondary uppercase mt-0.5">{accObj?.institution || 'Velum Central Clearing'}</div>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[8.5px] font-bold font-mono bg-text-primary-5 border border-white-5 uppercase tracking-wide">
                            {tx.type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className={`p-4 font-mono font-black text-sm ${amountColor}`}>
                          {amountSign}{tx.currency_code === 'TWD' ? 'NT$ ' : ''}{(tx.amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[9px] text-text-secondary font-bold">{tx.currency_code}</span>
                        </td>
                        <td className="p-4 text-text-secondary font-sans text-[11px] max-w-[200px] truncate leading-normal">
                          {tx.description}
                        </td>
                        <td className="p-4 text-right text-text-secondary text-[10.5px] font-mono">{new Date(tx.timestamp).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {bankTransactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-text-secondary font-mono text-[10px] uppercase tracking-widest leading-normal">
                        // Ledger operational queue 100% idle //
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 9. PROFILE & SECURITY DESK */}
      {activeTab === 'profile' && (
        <div className="space-y-6 animate-fadeIn">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Card: Admin Identity & Custom Avatar */}
            <div className="glass-card p-6 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-white-5 pb-3 mb-5">
                  <User className="w-4.5 h-4.5 text-accent-hover" />
                  <h4 className="font-extrabold text-[12px] uppercase tracking-wider text-text-primary">Executive Identity</h4>
                </div>

                <div className="flex flex-col items-center justify-center py-6 space-y-4">
                  {/* Circular Avatar Frame */}
                  <div className="relative group cursor-pointer">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-accent/40 bg-accent-10 flex items-center justify-center text-accent text-3xl font-black font-mono shadow-lg shadow-accent/10 group-hover:border-accent transition-colors">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : adminProfile?.avatar ? (
                        <img src={adminProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        (user?.username || 'AD').substring(0, 2).toUpperCase()
                      )}
                    </div>
                    {/* Hover upload overlay */}
                    <label 
                      htmlFor="admin-avatar-input" 
                      className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[9px] font-bold text-text-primary uppercase tracking-widest font-mono"
                    >
                      <Plus className="w-4 h-4 mb-1 text-accent" />
                      Upload
                    </label>
                    <input 
                      type="file" 
                      id="admin-avatar-input" 
                      accept="image/jpeg,image/png,image/webp" 
                      className="hidden" 
                      onChange={handleAvatarChange} 
                    />
                  </div>

                  <div className="text-center space-y-1">
                    <span className="text-sm font-extrabold text-text-primary">@{user?.username || 'Executive'}</span>
                    <span className="text-[10px] text-text-secondary font-mono block">Clearance: {adminRole}</span>
                  </div>
                </div>

                <form onSubmit={handleProfileSubmit} className="space-y-4 font-sans text-xs">
                  <div className="grid grid-cols-2 gap-3.5">
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
                      <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono">Clearance Status</label>
                      <input
                        type="text"
                        disabled
                        value={adminRole === 'SUPPORT_ADMIN' ? "SUPPORT OPERATIONS" : "EXECUTIVE CONTROLS"}
                        className={`w-full p-3 rounded-xl font-mono text-text-secondary cursor-not-allowed ${c.bgInput}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
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
                        className={`w-full p-3 rounded-xl font-mono ${c.bgInput}`}
                      />
                    </div>
                  </div>
                </form>
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleProfileSubmit}
                  disabled={isUploading}
                  className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-text-primary font-extrabold py-3 rounded-xl text-[10px] uppercase tracking-wider transition border-0 cursor-pointer shadow-md font-mono"
                >
                  {isUploading ? 'Securing Profile...' : 'Save Profile Settings'}
                </button>
                {settingsStatus && (
                  <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/15 text-status-online text-xs rounded font-mono font-bold text-center">
                    {settingsStatus}
                  </div>
                )}
              </div>
            </div>

            {/* Right Card: Credential Rotation */}
            <div className="glass-card p-6 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-white-5 pb-3 mb-5">
                  <RefreshCw className="w-4.5 h-4.5 text-purple-400" />
                  <h4 className="font-extrabold text-[12px] uppercase tracking-wider text-text-primary">Rotate Credentials</h4>
                </div>

                <form onSubmit={rotateExecutiveCredentials} className="space-y-4 font-sans text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
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

              <div className="mt-6 space-y-3">
                {adminRole !== 'LOGIN_ADMIN' && adminRole !== 'CLI_ADMIN' ? (
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

          </div>
        </div>
      )}
      </main>
    </div>
  );
}
