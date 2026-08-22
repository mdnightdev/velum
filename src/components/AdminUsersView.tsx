import React, { useState } from 'react';
import { Ban, MessageSquare, ShieldCheck, Activity } from 'lucide-react';
import { stripAt } from '../types';
import ProfileCard from './ProfileCard';
import { getSessionId } from '../utils/auth';

interface AdminUsersViewProps {
  adminRole: any;
  activeSanctions: any[];
  users: any[];
  applyQuickSanction: (userName: string, type: 'ban' | 'mute', duration: number, reason: string) => Promise<{ success: boolean; text: string }>;
  adminFetch: (url: string, init?: RequestInit) => Promise<Response>;
  fetchData: () => Promise<void>;
}

export default function AdminUsersView({
  adminRole,
  activeSanctions,
  users,
  applyQuickSanction,
  adminFetch,
  fetchData,
}: AdminUsersViewProps) {
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [targetUser, setTargetUser] = useState('');
  const [sanctionType, setSanctionType] = useState<'mute' | 'ban' | 'purge' | 'restore'>('mute');
  const [sanctionMinutes, setSanctionMinutes] = useState<number | ''>('');
  const [sanctionReason, setSanctionReason] = useState('');
  const [sanctionResult, setSanctionResult] = useState<string | null>(null);
  const [sanctionError, setSanctionError] = useState<string | null>(null);

  const handleProfileMute = async (u: any) => {
    try {
      const sId = getSessionId();
      const res = await adminFetch(`/v2/admin/sanctions/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sId}` },
        body: JSON.stringify({ userId: u.id, durationMinutes: 60, reason: 'Manual moderation action' })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (_) {}
  };

  const handleProfileBan = async (u: any) => {
    try {
      const sId = getSessionId();
      const res = await adminFetch(`/v2/admin/sanctions/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sId}` },
        body: JSON.stringify({ userId: u.id, durationMinutes: 1440, reason: 'Manual moderation action' })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (_) {}
  };

  const handleProfilePurge = async (u: any) => {
    try {
      const sId = getSessionId();
      const res = await adminFetch(`/v2/admin/sanctions/purge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sId}` },
        body: JSON.stringify({ userId: u.id, reason: 'Manual moderation action' })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (_) {}
  };

  const handleProfileBlock = async (u: any) => {
    try {
      const sId = getSessionId();
      const targetId = u.user_id || u.userId || u.id;
      const res = await adminFetch(`/v2/user/${targetId}/block`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (_) {}
    setSelectedUser(null);
  };

  const handleProfileDeleteChat = async (u: any) => {
    try {
      const sId = getSessionId();
      const targetId = u.user_id || u.userId || u.id;
      const res = await adminFetch(`/v2/user/${targetId}/chat`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (_) {}
    setSelectedUser(null);
  };

  const handleProfileReport = async (u: any) => {
    const targetId = u.user_id || u.userId || u.id;
    const reason = window.prompt('Reason for reporting:');
    if (!reason || !reason.trim()) return;
    try {
      const sId = getSessionId();
      const res = await adminFetch('/v2/user/report', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: targetId, reason: reason.trim() })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (_) {}
    setSelectedUser(null);
  };

  const handleSanctionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSanctionResult(null);
    setSanctionError(null);

    if (!targetUser.trim()) {
      setSanctionError('Enter a valid username.');
      return;
    }

    if (sanctionType === 'restore') {
      try {
        const sId = getSessionId();
        const res = await adminFetch(`/v2/admin/sanctions/restore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sId}` },
          body: JSON.stringify({ username: targetUser.trim() })
        });
        const data = await res.json();
        if (res.ok) {
          setSanctionResult(data.message || 'Account restored successfully.');
          setTargetUser('');
          fetchData();
        } else {
          setSanctionError(data.error || 'Failed to restore account.');
        }
      } catch {
        setSanctionError('Connection error.');
      }
      return;
    }

    if (sanctionType === 'purge') {
      try {
        const sId = getSessionId();
        const res = await adminFetch(`/v2/admin/sanctions/purge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sId}` },
          body: JSON.stringify({ username: targetUser.trim(), reason: sanctionReason })
        });
        const data = await res.json();
        if (res.ok) {
          setSanctionResult(data.message || 'Account purged successfully.');
          setTargetUser('');
          setSanctionReason('');
          fetchData();
        } else {
          setSanctionError(data.error || 'Failed to purge account.');
        }
      } catch {
        setSanctionError('Connection error.');
      }
      return;
    }

    const mins = sanctionMinutes === '' ? 60 : Number(sanctionMinutes);
    const res = await applyQuickSanction(targetUser.trim(), sanctionType, mins, sanctionReason);
    if (res.success) {
      setSanctionResult(res.text);
      setTargetUser('');
      fetchData();
    } else {
      setSanctionError(res.text);
    }
  };

  const purgedUsers = adminRole === 'CLI_ADMIN' ? users.filter(u => u.status === 'purged') : [];
  const hasItems = activeSanctions.length > 0 || purgedUsers.length > 0;

  return (
    <div className="space-y-4">
      {/* Top Section: Apply Sanction Form */}
      <div className="p-4 rounded-xl border border-velum-600 bg-velum-800 w-full">
        <div className="flex items-center gap-2 border-b border-velum-600 pb-2.5 mb-3">
          <ShieldCheck className="w-4 h-4 text-accent" />
          <h4 className="font-semibold text-xs text-text-primary">User Restrictions</h4>
        </div>

        <form onSubmit={handleSanctionSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Target Username</label>
            <input
              type="text"
              placeholder="Username"
              value={targetUser}
              onChange={(e) => setTargetUser(e.target.value)}
              className="w-full p-2 rounded-lg bg-velum-750 border border-velum-600 text-text-primary placeholder:text-text-disabled text-xs"
            />
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">Action</label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSanctionType('mute')}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  sanctionType === 'mute'
                    ? "bg-status-away/15 text-status-away border border-status-away/30"
                    : "bg-velum-750 text-text-secondary border border-velum-600 hover:bg-velum-700"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Mute</span>
              </button>
              <button
                type="button"
                onClick={() => setSanctionType('ban')}
                disabled={adminRole !== 'LOGIN_ADMIN' && adminRole !== 'CLI_ADMIN'}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  sanctionType === 'ban'
                    ? "bg-status-dnd/15 text-status-dnd border border-status-dnd/30"
                    : (adminRole !== 'LOGIN_ADMIN' && adminRole !== 'CLI_ADMIN')
                    ? "bg-velum-750 text-text-disabled border border-velum-600 opacity-40 cursor-not-allowed"
                    : "bg-velum-750 text-text-secondary border border-velum-600 hover:bg-velum-700"
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Deactivate</span>
              </button>
              <button
                type="button"
                onClick={() => setSanctionType('purge')}
                disabled={adminRole !== 'LOGIN_ADMIN' && adminRole !== 'CLI_ADMIN'}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  sanctionType === 'purge'
                    ? "bg-status-dnd/15 text-status-dnd border border-status-dnd/30"
                    : (adminRole !== 'LOGIN_ADMIN' && adminRole !== 'CLI_ADMIN')
                    ? "bg-velum-750 text-text-disabled border border-velum-600 opacity-40 cursor-not-allowed"
                    : "bg-velum-750 text-text-secondary border border-velum-600 hover:bg-velum-700"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Purge</span>
              </button>
              {adminRole === 'CLI_ADMIN' && (
                <button
                  type="button"
                  onClick={() => setSanctionType('restore')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    sanctionType === 'restore'
                      ? "bg-status-online/15 text-status-online border border-status-online/30"
                      : "bg-velum-750 text-text-secondary border border-velum-600 hover:bg-velum-700"
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </button>
              )}
            </div>
          </div>

          {(sanctionType === 'mute' || sanctionType === 'ban') && (
            <div>
              <label className="block text-xs text-text-secondary mb-1">Duration (Minutes)</label>
              <input
                type="number"
                min="1"
                value={sanctionMinutes}
                onChange={(e) => setSanctionMinutes(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="w-full p-2 rounded-lg bg-velum-750 border border-velum-600 text-text-primary text-xs"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-text-secondary mb-1">Reason</label>
            <textarea
              rows={2}
              placeholder="Reason for restriction..."
              value={sanctionReason}
              onChange={(e) => setSanctionReason(e.target.value)}
              className="w-full p-2 rounded-lg bg-velum-750 border border-velum-600 text-text-primary text-xs resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-accent hover:bg-accent-hover text-black font-semibold py-2 rounded-lg transition cursor-pointer text-xs flex items-center justify-center gap-2 mt-1"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Apply Restriction</span>
          </button>

          {sanctionResult && (
            <div className="p-2 bg-status-online/10 text-status-online text-xs rounded-lg">
              {sanctionResult}
            </div>
          )}
          {sanctionError && (
            <div className="p-2 bg-status-dnd/10 text-status-dnd text-xs rounded-lg">
              {sanctionError}
            </div>
          )}
        </form>
      </div>

      {/* Bottom Section: Active Sanctions Log */}
      <div className="p-4 rounded-xl border border-velum-600 bg-velum-800 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-velum-600 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" />
            <h4 className="font-semibold text-xs text-text-primary">Active Restrictions</h4>
          </div>
          <span className="px-2 py-0.5 rounded bg-velum-750 border border-velum-600 text-xs text-text-secondary">
            {activeSanctions.length + purgedUsers.length} Active
          </span>
        </div>

        <div className="overflow-x-auto">
          {!hasItems ? (
            <div className="py-12 text-center">
              <ShieldCheck className="w-8 h-8 text-status-online/30 mx-auto mb-2" />
              <h5 className="text-xs font-semibold text-text-secondary">No Active Restrictions</h5>
              <p className="text-xs text-text-disabled mt-1 max-w-sm mx-auto">
                No active mutes, bans, or account restrictions found.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse select-none">
              <thead>
                <tr className="border-b border-white-5 text-[8.5px] uppercase font-mono font-black text-text-secondary tracking-widest">
                  <th className="py-3 px-2">Target Account</th>
                  <th className="py-3 px-2">Sanction Class</th>
                  <th className="py-3 px-2">Reason For Verdict</th>
                  <th className="py-3 px-2">Enforcement Expiry</th>
                  <th className="py-3 px-2 text-right">Administrative Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03] text-xs">
                {activeSanctions.map((sanction: any) => {
                  const targetAccount = users.find(u => u.user_id === sanction.user_id);
                  const targetAccountName = targetAccount ? targetAccount.username : `User ID: ${sanction.user_id}`;
                  const isExpired = new Date(sanction.expires_at).getTime() < Date.now();
                  
                  return (
                    <tr key={sanction.sanction_id} className="hover:bg-text-primary-2 transition-all">
                      <td 
                        onClick={() => targetAccount && setSelectedUser(targetAccount)}
                        className={`py-3 px-2 font-bold text-text-primary whitespace-nowrap ${targetAccount ? 'cursor-pointer hover:underline' : ''}`}
                      >
                        {stripAt(targetAccountName)}
                      </td>
                      <td className="py-4 px-2 whitespace-nowrap">
                        {sanction.type === 'ban' ? (
                          <span className="px-2 py-0.5 rounded text-[8.5px] font-black tracking-wider uppercase font-mono bg-status-dnd-bg text-status-dnd">
                            BAN
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[8.5px] font-black tracking-wider uppercase font-mono bg-status-away-bg text-status-away">
                            MUTE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 max-w-[200px] truncate text-text-primary font-sans" title={sanction.reason}>
                        {sanction.reason}
                      </td>
                      <td className="py-3 px-2 text-[10.5px] font-mono text-text-secondary whitespace-nowrap">
                        {isExpired ? (
                          <span className="text-text-disabled italic">Expired</span>
                        ) : (
                          new Date(sanction.expires_at).toLocaleString()
                        )}
                      </td>
                      <td className="py-3 px-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const actionType = sanction.type === 'ban' ? 'unban' : 'unmute';
                              const res = await adminFetch(`/v2/admin/sanction/revoke`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ targetUserId: sanction.user_id, type: actionType })
                              });
                              const data = await res.json();
                              if (res.ok) {
                                alert(`Enforcement credentials lifted matching ${stripAt(targetAccountName)}.`);
                                fetchData();
                              } else {
                                alert(data.error || 'Failed to lift operational bounds.');
                              }
                            } catch {
                              alert('Communication error.');
                            }
                          }}
                          className="px-2.5 py-1 text-[9px] font-extrabold uppercase font-mono tracking-wider rounded-lg bg-status-online-bg hover:bg-status-online hover:text-text-primary text-status-online cursor-pointer transition whitespace-nowrap"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {purgedUsers.map((u: any) => (
                  <tr key={`purged-${u.user_id}`} className="hover:bg-text-primary-2 transition-all">
                    <td 
                      onClick={() => setSelectedUser(u)}
                      className="py-3 px-2 font-bold text-text-primary whitespace-nowrap cursor-pointer hover:underline"
                    >
                      {u.username}
                    </td>
                    <td className="py-4 px-2 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[8.5px] font-black tracking-wider uppercase font-mono bg-status-dnd-bg text-status-dnd">
                        PURGED
                      </span>
                    </td>
                    <td className="py-3 px-2 max-w-[200px] truncate text-text-primary font-sans">
                      Soft-purged account database row
                    </td>
                    <td className="py-3 px-2 text-[10.5px] font-mono text-text-secondary whitespace-nowrap">
                      Permanent Retained
                    </td>
                    <td className="py-3 px-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`Are you sure you want to restore purged user ${u.username}?`)) {
                            try {
                              const res = await adminFetch(`/v2/admin/users/${u.user_id}/restore`, {
                                method: 'POST'
                              });
                              if (res.ok) {
                                alert(`Successfully restored ${u.username}.`);
                                fetchData();
                              } else {
                                const errData = await res.json();
                                alert(errData.error || 'Failed to restore user.');
                              }
                            } catch {
                              alert('Error restoring user.');
                            }
                          }
                        }}
                        className="px-2.5 py-1 text-[9px] font-extrabold uppercase font-mono tracking-wider rounded-lg bg-status-online-bg hover:bg-status-online hover:text-text-primary text-status-online cursor-pointer transition whitespace-nowrap"
                      >
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    
      {/* Selected User/Admin Profile Card Overlay */}
      {selectedUser && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center modal-backdrop p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div onClick={e => e.stopPropagation()} className="relative">
            <ProfileCard
              type={selectedUser.role === 'LOGIN_ADMIN' || selectedUser.role === 'SUPPORT_OPERATOR' ? 'admin' : 'user'}
              user={{
                userId: selectedUser.user_id || selectedUser.userId,
                username: selectedUser.username,
                displayName: selectedUser.displayName || selectedUser.username.replace('@', ''),
                bio: selectedUser.bio || '',
                location: selectedUser.location || '',
                joinedDate: selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '',
                status: selectedUser.status || 'offline',
                role: selectedUser.role,
                avatarUrl: selectedUser.avatar,
                stats: {
                  loungesCount: 4,
                  connectionsCount: 18
                }
              }}
              variant="popover"
              onClose={() => setSelectedUser(null)}
              onMute={() => handleProfileMute(selectedUser)}
              onBlock={() => handleProfileBlock(selectedUser)}
              onDeleteChat={() => handleProfileDeleteChat(selectedUser)}
              onReport={() => handleProfileReport(selectedUser)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
