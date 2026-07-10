import React, { useState } from 'react';
import { Ban, MessageSquare, ShieldCheck, Activity } from 'lucide-react';
import { stripAt } from '../types';
import ProfileCard from './ProfileCard';

interface AdminUsersViewProps {
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN';
  activeSanctions: any[];
  users: any[];
  applyQuickSanction: (userName: string, type: 'ban' | 'mute', duration: number, reason: string) => Promise<{ success: boolean; text: string }>;
  adminFetch: (url: string, init?: RequestInit) => Promise<Response>;
  fetchData: () => Promise<void>;
  c: {
    bgPanel: string;
    border: string;
    bgInput: string;
    textMuted: string;
  };
}

export default function AdminUsersView({
  adminRole,
  activeSanctions,
  users,
  applyQuickSanction,
  adminFetch,
  fetchData,
  c
}: AdminUsersViewProps) {
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [targetUser, setTargetUser] = useState('');
  const [sanctionType, setSanctionType] = useState<'mute' | 'ban'>('mute');
  const [sanctionMinutes, setSanctionMinutes] = useState(60);
  const [sanctionReason, setSanctionReason] = useState('');
  const [sanctionResult, setSanctionResult] = useState<string | null>(null);
  const [sanctionError, setSanctionError] = useState<string | null>(null);

  const handleSanctionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSanctionResult(null);
    setSanctionError(null);

    if (!targetUser.trim()) {
      setSanctionError('Target account username is required.');
      return;
    }

    const res = await applyQuickSanction(targetUser, sanctionType, sanctionMinutes, sanctionReason);
    if (res.success) {
      setSanctionResult(res.text);
      setSanctionReason('');
      setTargetUser('');
      fetchData();
    } else {
      setSanctionError(res.text);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h3 className="text-lg font-black text-text-primary uppercase tracking-wider flex items-center gap-2">
          <Ban className="w-5 h-5 text-red-400" />
          <span>Moderation & Sanctions Desk</span>
        </h3>
        <p className={c.textMuted + " text-[10px] mt-1 uppercase tracking-wider font-semibold"}>
          Manage active sanctions, mute rogue conversations, and enforce matrix security policies.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left side: Apply Sanction Form */}
        <div className={`p-6 rounded-2xl border ${c.bgPanel} shadow-xl lg:col-span-4 h-fit`}>
          <div className="flex items-center gap-2 border-b border-white-5 pb-3 mb-4">
            <ShieldCheck className="w-4.5 h-4.5 text-accent" />
            <h4 className="font-extrabold text-[12px] uppercase tracking-wider text-text-primary">Apply New Sanction</h4>
          </div>

          <form onSubmit={handleSanctionSubmit} className="space-y-4 font-sans text-xs">
            <div>
              <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono">Target Account Username</label>
              <input
                type="text"
                placeholder="e.g. janesmith"
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
                className={`w-full p-3 rounded-xl font-mono ${c.bgInput}`}
              />
            </div>

            <div>
              <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono">Sanction Enforcement Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSanctionType('mute')}
                  className={`py-2 px-3 rounded-xl font-bold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer text-[10px] sm:text-xs ${
                    sanctionType === 'mute'
                      ? "bg-amber-500/10 text-status-away border border-amber-500/30"
                      : "bg-velum-850 text-text-secondary border border-white-5 hover:bg-text-primary-2"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Mute dialogue</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSanctionType('ban')}
                  disabled={adminRole !== 'LOGIN_ADMIN'}
                  className={`py-2 px-3 rounded-xl font-bold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer text-[10px] sm:text-xs ${
                    sanctionType === 'ban'
                      ? "bg-status-dnd/10 text-status-dnd border border-rose-500/30"
                      : adminRole !== 'LOGIN_ADMIN'
                      ? "bg-velum-900/20 text-accent/20 border border-velum-600 opacity-40 cursor-not-allowed"
                      : "bg-velum-850 text-text-secondary border border-white-5 hover:bg-text-primary-2"
                  }`}
                  title={adminRole !== 'LOGIN_ADMIN' ? "Only Executive LOGIN_ADMIN role holds the security permissions to enforce central bans keys" : ""}
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Ban access</span>
                </button>
              </div>
              {adminRole !== 'LOGIN_ADMIN' && (
                <p className="text-[7.5px] font-bold text-status-away/70 uppercase tracking-wider mt-1.5 font-sans">
                  * Global Ban requires LOGIN_ADMIN privileges.
                </p>
              )}
            </div>

            <div>
              <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono">Duration (Minutes)</label>
              <input
                type="number"
                min="1"
                value={sanctionMinutes}
                onChange={(e) => setSanctionMinutes(parseInt(e.target.value, 10) || 60)}
                className={`w-full p-3 rounded-xl font-mono ${c.bgInput}`}
              />
            </div>

            <div>
              <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono">Reason for Sanction</label>
              <textarea
                rows={3}
                placeholder="Detail specific security policy violation..."
                value={sanctionReason}
                onChange={(e) => setSanctionReason(e.target.value)}
                className={`w-full p-3 rounded-xl font-sans resize-none ${c.bgInput}`}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-accent hover:bg-accent-hover text-text-primary font-extrabold py-3 rounded-xl transition border-0 cursor-pointer shadow-md uppercase font-mono tracking-wider text-[10px] flex items-center justify-center gap-2 mt-2"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Enforce Active Sanction</span>
            </button>

            {sanctionResult && (
              <div className="p-3 bg-status-online/10 border border-emerald-500/15 text-status-online text-[10px] rounded-xl font-mono font-bold uppercase tracking-wider">
                {sanctionResult}
              </div>
            )}
            {sanctionError && (
              <div className="p-3 bg-status-dnd/10 border border-rose-500/15 text-status-dnd text-[10px] rounded-xl font-mono font-bold uppercase tracking-wider">
                {sanctionError}
              </div>
            )}
          </form>
        </div>

        {/* Right side: Active Sanctions List */}
        <div className={`p-6 rounded-2xl border ${c.bgPanel} shadow-xl lg:col-span-8 overflow-hidden flex flex-col`}>
          <div className="flex items-center justify-between border-b border-white-5 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4.5 h-4.5 text-accent" />
              <h4 className="font-extrabold text-[12px] uppercase tracking-wider text-text-primary">Active Operational Sanctions</h4>
            </div>
            <span className="px-2 py-0.5 rounded bg-text-primary-5 border border-white-5 font-mono text-[9px] font-black text-text-secondary">
              {activeSanctions.length} ACTIVE
            </span>
          </div>

          <div className="overflow-x-auto">
            {activeSanctions.length === 0 ? (
              <div className="py-24 text-center">
                <ShieldCheck className="w-10 h-10 text-status-online/30 mx-auto mb-3" />
                <h5 className="text-xs font-black text-text-secondary uppercase tracking-wider">Zero Security Anomalies</h5>
                <p className="text-[10px] text-text-secondary mt-1 max-w-sm mx-auto uppercase tracking-wide">
                  No active bans or communication blockades are currently registered across the system.
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
                          @{stripAt(targetAccountName)}
                        </td>
                        <td className="py-4 px-2 whitespace-nowrap">
                          {sanction.type === 'ban' ? (
                            <span className="px-2 py-0.5 rounded text-[8.5px] font-black tracking-wider uppercase font-mono bg-status-dnd/10 text-status-dnd border border-rose-500/20">
                              BAN
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[8.5px] font-black tracking-wider uppercase font-mono bg-amber-500/10 text-status-away border border-amber-500/20">
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
                                const res = await adminFetch(`/api/admin/sanction/revoke`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ targetUserId: sanction.user_id, type: actionType })
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  alert(`Enforcement credentials lifted matching @${stripAt(targetAccountName)}.`);
                                  fetchData();
                                } else {
                                  alert(data.error || 'Failed to lift operational bounds.');
                                }
                              } catch {
                                alert('Communication error.');
                              }
                            }}
                            className="px-2.5 py-1 text-[9px] font-extrabold uppercase font-mono tracking-wider rounded-lg border border-emerald-500/20 bg-status-online/5 hover:bg-status-online hover:text-text-primary text-status-online cursor-pointer transition whitespace-nowrap"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    
      {/* Selected User/Admin Profile Card Overlay */}
      {selectedUser && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div onClick={e => e.stopPropagation()} className="relative">
            <ProfileCard
              type={selectedUser.role === 'LOGIN_ADMIN' || selectedUser.role === 'SUPPORT_OPERATOR' ? 'admin' : 'user'}
              user={{
                userId: selectedUser.user_id || selectedUser.userId,
                username: selectedUser.username,
                displayName: selectedUser.displayName || selectedUser.username.replace('@', ''),
                bio: selectedUser.bio || 'Secure Node Operator.',
                location: selectedUser.location || 'Unknown location',
                joinedDate: selectedUser.joined_date || 'May 2026',
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
            />
          </div>
        </div>
      )}
    </div>
  );
}
