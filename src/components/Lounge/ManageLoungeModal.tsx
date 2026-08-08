import React from 'react';
import { Settings, X } from 'lucide-react';

interface ManageLoungeModalProps {
  show: boolean;
  isDark: boolean;
  loungeName: string;
  manageTab: 'members' | 'requests' | 'invites' | 'settings';
  setManageTab: (tab: 'members' | 'requests' | 'invites' | 'settings') => void;
  manageRequests: any[];
  manageInvites: any[];
  members: any[];
  currentUserId: number;
  editName: string;
  setEditName: (val: string) => void;
  editDescription: string;
  setEditDescription: (val: string) => void;
  editIconUrl: string;
  setEditIconUrl: (val: string) => void;
  settingsError: string;
  settingsSuccess: string;
  directAddUsername: string;
  setDirectAddUsername: (val: string) => void;
  directAddError: string;
  directAddSuccess: string;
  onClose: () => void;
  onSaveSettings: () => void;
  onUpdateRole: (targetUserId: number, newRole: string) => void;
  onSanctionClick: (userId: number, type: 'mute' | 'kick' | 'ban') => void;
  onReviewRequest: (requestId: string, approve: boolean) => void;
  onDirectAddMember: () => void;
  onCreateInviteCode: () => void;
  onRevokeInviteCode: (inviteId: string) => void;
}

export default function ManageLoungeModal({
  show,
  isDark,
  loungeName,
  manageTab,
  setManageTab,
  manageRequests,
  manageInvites,
  members,
  currentUserId,
  editName,
  setEditName,
  editDescription,
  setEditDescription,
  editIconUrl,
  setEditIconUrl,
  settingsError,
  settingsSuccess,
  directAddUsername,
  setDirectAddUsername,
  directAddError,
  directAddSuccess,
  onClose,
  onSaveSettings,
  onUpdateRole,
  onSanctionClick,
  onReviewRequest,
  onDirectAddMember,
  onCreateInviteCode,
  onRevokeInviteCode,
}: ManageLoungeModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center modal-backdrop p-4 animate-fade-in">
      <div 
        className={`w-full max-w-2xl h-[550px] flex flex-col rounded-3xl border shadow-2xl overflow-hidden backdrop-blur-[var(--blur-glass-panel)] transition-all duration-300 ${
          isDark 
            ? 'bg-velum-900 border-white-10 text-white shadow-black-60' 
            : 'bg-white-10 border-velum-600 text-velum-900 shadow-xl'
        }`}
      >
        {/* Modal Header */}
        <div className={`p-5 border-b flex justify-between items-center ${isDark ? 'border-white/10' : 'border-velum-600'}`}>
          <div className="flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-widest text-accent flex items-center gap-2">
              <Settings className="w-4 h-4 animate-spin-slow" />
              Lounge Administration Desk
            </h3>
            <span className={`text-[10px] uppercase tracking-wider font-mono opacity-60 ${isDark ? 'text-text-secondary' : 'text-text-secondary'}`}>
              Hub // {loungeName}
            </span>
          </div>
          <button 
            onClick={onClose} 
            className={`p-1.5 rounded-full hover:bg-white-10 transition cursor-pointer ${isDark ? 'text-text-secondary hover:text-white' : 'text-text-secondary hover:text-velum-900'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className={`flex border-b text-xs ${isDark ? 'border-white-5 bg-velum-850' : 'border-velum-600 bg-white-10'}`}>
          {[
            { id: 'settings', label: 'General Settings' },
            { id: 'members', label: 'Members & Roles' },
            { id: 'requests', label: `Join Applications (${manageRequests.length})` },
            { id: 'invites', label: 'Invites & Direct Add' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setManageTab(tab.id as any)}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                manageTab === tab.id 
                  ? 'text-accent border-b-2 border-accent bg-white-2' 
                  : `text-text-secondary border-b-2 border-transparent hover:text-white`
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body / Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 scrollbar-none">
          {/* Tab 0: General Settings */}
          {manageTab === 'settings' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Lounge Node Parameters</span>
              </div>

              {settingsError && (
                <p className="text-alert-error text-[10.5px] font-mono bg-alert-error-bg p-2.5 rounded-xl uppercase tracking-wide">
                  {settingsError}
                </p>
              )}
              {settingsSuccess && (
                <p className="text-alert-success text-[10.5px] font-mono bg-alert-success-bg p-2.5 rounded-xl uppercase tracking-wide">
                  {settingsSuccess}
                </p>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[9.5px] font-bold uppercase tracking-widest mb-1.5 opacity-60">Lounge Name *</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs outline-none transition font-mono ${
                      isDark 
                        ? 'bg-velum-900 border-white-10 text-white focus:border-accent-20' 
                        : 'bg-white-10 border-velum-600 text-velum-900 focus:border-accent'
                    }`}
                    placeholder="e.g. general-lounge"
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-bold uppercase tracking-widest mb-1.5 opacity-60">Overview / Topic</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs outline-none resize-none h-20 transition ${
                      isDark 
                        ? 'bg-velum-900 border-white-10 text-white focus:border-accent-20' 
                        : 'bg-white-10 border-velum-600 text-velum-900 focus:border-accent'
                    }`}
                    placeholder="Describe lounge topic or community rules..."
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-bold uppercase tracking-widest mb-1.5 opacity-60">Lounge Avatar / Icon URL</label>
                  <input
                    type="text"
                    value={editIconUrl}
                    onChange={(e) => setEditIconUrl(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs outline-none transition font-mono ${
                      isDark 
                        ? 'bg-velum-900 border-white-10 text-white focus:border-accent-20' 
                        : 'bg-white-10 border-velum-600 text-velum-900 focus:border-accent'
                    }`}
                    placeholder="https://example.com/lounge-icon.png"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={onSaveSettings}
                  className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-velum-900 text-[10px] font-bold uppercase tracking-wider rounded-xl cursor-pointer transition"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          )}

          {/* Tab 1: Members & Roles Management */}
          {manageTab === 'members' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Lounge Node Operators</span>
                <span className="text-[10px] font-mono text-accent">{members.length} Active Nodes</span>
              </div>
              
              <div className="space-y-2">
                {members.map((member, index) => {
                  const isSelf = String(member.user_id) === String(currentUserId);
                  return (
                    <div 
                      key={member.user_id || `manage-member-${member.username || index}`} 
                      className={`p-3 rounded-2xl flex items-center justify-between gap-4 border transition-all ${
                        isDark 
                          ? 'bg-white/[0.02] border-white-5 hover:bg-white/[0.04]' 
                          : 'bg-text-primary border-velum-600 hover:bg-text-primary-5'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.username} className="w-9 h-9 rounded-full object-cover border border-white-10" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-velum-900 border border-white-10 flex items-center justify-center text-xs font-bold uppercase text-accent font-mono">
                            {member.username.replace('@', '').charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate flex items-center gap-1.5">
                            {member.displayName || member.username.replace('@', '')}
                            {isSelf && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-accent/20 text-accent border border-accent/20">YOU</span>}
                          </div>
                          <div className="text-[9.5px] opacity-60 font-mono uppercase tracking-wider">{member.role || 'Member'}</div>
                        </div>
                      </div>

                      {/* Controls */}
                      {!isSelf && member.role !== 'owner' && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <select
                            value={member.role || 'member'}
                            onChange={(e) => onUpdateRole(member.user_id, e.target.value)}
                            className={`text-[10px] font-bold uppercase tracking-wider p-1.5 rounded-lg border outline-none cursor-pointer transition ${
                              isDark 
                                ? 'bg-velum-800 border-white-10 text-text-secondary focus:border-accent' 
                                : 'bg-text-primary border-velum-600 text-text-secondary'
                            }`}
                          >
                            <option value="member">Member</option>
                            <option value="moderator">Moderator</option>
                            <option value="admin">Admin</option>
                          </select>

                          <button
                            onClick={() => onSanctionClick(member.user_id, 'mute')}
                            className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest bg-status-away-bg hover:bg-status-away-bg text-status-away rounded-lg transition active:scale-95 cursor-pointer"
                            title="Mute user inside lounge"
                          >
                            Mute
                          </button>
                          <button
                            onClick={() => onSanctionClick(member.user_id, 'kick')}
                            className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest bg-status-away-bg hover:bg-status-away-bg text-status-away rounded-lg transition active:scale-95 cursor-pointer"
                            title="Kick user from lounge"
                          >
                            Kick
                          </button>
                          <button
                            onClick={() => onSanctionClick(member.user_id, 'ban')}
                            className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest bg-status-dnd-bg hover:bg-status-dnd-bg text-status-dnd rounded-lg transition active:scale-95 cursor-pointer"
                            title="Ban user from lounge"
                          >
                            Ban
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: Join Applications */}
          {manageTab === 'requests' && (
            <div className="space-y-4">
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">Pending Admission Logs</div>
              
              {manageRequests.length === 0 ? (
                <div className={`p-8 rounded-2xl text-center border font-mono text-[10px] uppercase tracking-widest ${isDark ? 'bg-white/[0.01] border-white-5 text-text-secondary' : 'bg-text-primary border-velum-600 text-text-disabled'}`}>
                  // No active admission requests pending //
                </div>
              ) : (
                <div className="space-y-2">
                  {manageRequests.map((req, index) => (
                    <div 
                      key={req.request_id || `req-${index}`} 
                      className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
                        isDark ? 'bg-white/[0.02] border-white-5' : 'bg-text-primary border-velum-600'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-accent">@{req.username}</div>
                        <div className="text-[10px] opacity-60 mt-1 font-mono uppercase tracking-wider">Applied: {new Date(req.created_at).toLocaleDateString()}</div>
                        {req.reason && (
                          <p className={`text-xs mt-2 italic p-2 rounded-lg ${isDark ? 'bg-velum-900' : 'bg-text-primary border border-velum-600'}`}>
                            "{req.reason}"
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onReviewRequest(req.request_id, false)}
                          className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-status-dnd-bg hover:bg-status-dnd-bg text-status-dnd rounded-lg transition active:scale-95 cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => onReviewRequest(req.request_id, true)}
                          className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-status-online-bg hover:bg-status-online-bg text-status-online rounded-lg transition active:scale-95 cursor-pointer"
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Invites & Direct Add User */}
          {manageTab === 'invites' && (
            <div className="space-y-6">
              {/* Direct Add User */}
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-white/[0.01] border-white-5' : 'bg-text-primary border-velum-600'}`}>
                <h4 className="text-[10px] font-bold uppercase tracking-widest mb-3 text-accent">Add Member Directly</h4>
                <p className={`text-[10.5px] opacity-75 mb-4 ${isDark ? 'text-text-secondary' : 'text-text-secondary'}`}>
                  Add a registered user directly to this lounge by typing their username below.
                </p>
                
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Enter username (e.g. alice)"
                    value={directAddUsername}
                    onChange={(e) => setDirectAddUsername(e.target.value)}
                    className={`flex-1 p-2.5 rounded-xl text-xs outline-none border font-mono transition ${
                      isDark 
                        ? 'bg-velum-900 border-white-10 text-white focus:border-accent/40' 
                        : 'bg-text-primary border-velum-600 text-velum-900 focus:border-accent'
                    }`}
                  />
                  <button
                    onClick={onDirectAddMember}
                    className="px-4 py-2.5 bg-accent hover:bg-accent/90 text-velum-900 text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer shrink-0"
                  >
                    Add Member
                  </button>
                </div>

                {directAddError && (
                  <p className="text-alert-error text-[10.5px] font-mono mt-2 uppercase">{directAddError}</p>
                )}
                {directAddSuccess && (
                  <p className="text-alert-success text-[10.5px] font-mono mt-2 uppercase">{directAddSuccess}</p>
                )}
              </div>

              {/* Lounge Invites */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-accent">Invite Codes Desk</h4>
                  <button
                    onClick={onCreateInviteCode}
                    className="px-3 py-1.5 bg-white-5 hover:bg-white-10 text-white text-[9.5px] font-bold uppercase tracking-widest rounded-lg border border-white-5 transition active:scale-95 cursor-pointer"
                  >
                    Generate Invite Code
                  </button>
                </div>

                {manageInvites.length === 0 ? (
                  <div className={`p-6 rounded-2xl text-center border font-mono text-[9.5px] uppercase tracking-widest ${isDark ? 'bg-white/[0.01] border-white-5 text-text-secondary' : 'bg-text-primary border-velum-600 text-text-disabled'}`}>
                    // No custom invite links generated //
                  </div>
                ) : (
                  <div className="space-y-2">
                    {manageInvites.map((inv, index) => (
                      <div 
                        key={inv.invite_id || `inv-${index}`} 
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
                          isDark ? 'bg-white/[0.01] border-white-5' : 'bg-text-primary border-velum-600'
                        }`}
                      >
                        <div className="font-mono">
                          <span className="text-xs font-bold text-accent tracking-widest select-all">{inv.invite_code}</span>
                          <div className="text-[9px] opacity-65 mt-1 uppercase">
                            Uses: {inv.uses || 0} // Created: {new Date(inv.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={() => onRevokeInviteCode(inv.invite_id)}
                          className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest bg-status-dnd-bg hover:bg-status-dnd-bg text-status-dnd rounded-lg transition active:scale-95 cursor-pointer"
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
