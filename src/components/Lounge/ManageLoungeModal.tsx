import React, { useState } from 'react';
import { Settings, X, Upload, Loader2 } from 'lucide-react';
import { captureAndCompressPhoto, streamFileDirectToCloudStorage } from '../../utils/mediaPipeline';
import { ImageCropperModal } from '../ImageCropperModal';

interface ManageLoungeModalProps {
  show: boolean;
  isDark: boolean;
  loungeName: string;
  loungeId: string;
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
  onSaveSettings: (iconFile?: Blob | null) => void | Promise<void>;
  onUpdateRole: (targetUserId: number, newRole: string) => void;
  onSanctionClick: (userId: number, type: 'mute' | 'kick' | 'ban') => void;
  onReviewRequest: (requestId: string, approve: boolean) => void;
  onDirectAddMember: () => void;
  onCreateInviteCode: () => void;
  onRevokeInviteCode: (inviteId: string) => void;
  onDeleteLounge?: () => void;
}

export default function ManageLoungeModal({
  show,
  isDark,
  loungeName,
  loungeId,
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
  onDeleteLounge,
}: ManageLoungeModalProps) {
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [loungeIconFile, setLoungeIconFile] = useState<Blob | null>(null);
  const [croppingIcon, setCroppingIcon] = useState<{ src: string; fileName: string } | null>(null);

  const handleIconFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setCroppingIcon({ src: reader.result as string, fileName: file.name });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 z-[9998] flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in transition-all duration-300"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl h-full flex flex-col border-l shadow-2xl overflow-hidden backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-right ${
          isDark 
            ? 'bg-velum-900/95 border-white-10 text-white shadow-black-60' 
            : 'bg-white/95 border-velum-600 text-velum-900 shadow-xl'
        }`}
      >
        {/* Modal Header */}
        <div className={`p-5 border-b flex justify-between items-center ${isDark ? 'border-white/10' : 'border-velum-600'}`}>
          <div className="flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-widest text-text-primary flex items-center gap-2"><Settings className="w-4 h-4" />Settings</h3>
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
            { id: 'settings', label: 'General' },
            { id: 'members', label: 'Members' },
            { id: 'requests', label: `Join Applications (${(manageRequests || []).length})` },
            { id: 'invites', label: 'Invites' }
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
            <div className="space-y-5 animate-fade-in">
              {/* Header Badge */}
              <div className="flex justify-between items-center pb-2 border-b border-white-5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-accent font-mono">
                  Lounge Settings
                </span>
                <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-white-5 text-text-secondary">
                  Live Sync Mode
                </span>
              </div>

              {/* Status Notifications */}
              {settingsError && (
                <div className="text-alert-error text-[10.5px] font-mono bg-alert-error-bg p-3 rounded-xl uppercase tracking-wide flex items-center gap-2 border border-alert-error/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-alert-error shrink-0 animate-ping" />
                  <span>{settingsError}</span>
                </div>
              )}
              {settingsSuccess && (
                <div className="text-alert-success text-[10.5px] font-mono bg-alert-success-bg p-3 rounded-xl uppercase tracking-wide flex items-center gap-2 border border-alert-success/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-alert-success shrink-0" />
                  <span>{settingsSuccess}</span>
                </div>
              )}

              {/* Premium Vetting Settings Layout */}
              <div className="relative rounded-2xl bg-velum-800 border border-white-10 overflow-hidden shadow-xl mb-6">
                {/* Banner Area */}
                <div className="h-28 relative bg-gradient-to-r from-accent/30 via-accent/10 to-transparent">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                  {/* Banner Image could go here if Lounge had one */}
                </div>
                
                {/* Profile Details Bar */}
                <div className="px-6 pb-5 pt-0 relative flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10">
                  <div className="flex items-end gap-4">
                    <div className="relative group shrink-0">
                      <div className="w-20 h-20 rounded-2xl border-4 border-velum-850 bg-velum-800 flex items-center justify-center font-bold text-3xl text-accent overflow-hidden shadow-2xl">
                        {(croppingIcon?.src || editIconUrl || loungeIconFile) ? (
                          <img
                            src={croppingIcon ? croppingIcon.src : (loungeIconFile ? URL.createObjectURL(loungeIconFile) : editIconUrl)}
                            alt="Lounge Icon"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{(editName || loungeName || 'L').slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      
                      <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity cursor-pointer">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          className="hidden"
                          onChange={handleIconFileSelect}
                          disabled={isUploadingIcon}
                        />
                        {isUploadingIcon ? (
                          <Loader2 className="w-5 h-5 animate-spin text-accent" />
                        ) : (
                          <Upload className="w-5 h-5 text-text-primary" />
                        )}
                      </label>
                    </div>
                    
                    <div className="mb-1">
                      <h4 className="text-lg font-bold text-text-primary leading-none tracking-widest uppercase">{editName || loungeName || 'Unnamed Lounge'}</h4>
                      <p className="text-xs font-mono text-accent mt-1">Workspace Configuration</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5 text-text-secondary">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-3 rounded-xl border text-xs outline-none transition font-mono bg-velum-900 border-white-10 text-text-primary focus:border-accent/60 shadow-inner"
                    placeholder="e.g. general-lounge"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5 text-text-secondary">
                    Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full p-3 rounded-xl border text-xs outline-none resize-none h-24 transition font-mono bg-velum-900 border-white-10 text-text-primary focus:border-accent/60 shadow-inner"
                    placeholder="Describe lounge topic or community rules..."
                  />
                </div>

                
                {uploadError && (
                  <div className="text-[10px] text-alert-error font-mono mt-1">{uploadError}</div>
                )}


                  {croppingIcon && (
                    <ImageCropperModal
                      imageSrc={croppingIcon.src}
                      fileName={croppingIcon.fileName}
                      aspectRatio="1:1"
                      onCancel={() => setCroppingIcon(null)}
                      onCropComplete={(croppedDataUrl, croppedFile) => {
                        setLoungeIconFile(croppedFile);
                        setEditIconUrl(croppedDataUrl);
                        setCroppingIcon(null);
                      }}
                    />
                  )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={async () => {
                    setIsUploadingIcon(true);
                    setUploadError('');
                    try {
                      await onSaveSettings(loungeIconFile);
                      setLoungeIconFile(null);
                    } catch (err: any) {
                      setUploadError(err.message || 'Failed to save configuration.');
                    } finally {
                      setIsUploadingIcon(false);
                    }
                  }}
                  disabled={isUploadingIcon}
                  className="px-6 py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 text-velum-950 text-xs font-mono font-bold uppercase tracking-wider rounded-xl cursor-pointer transition shadow-lg active:scale-95"
                >
                  {isUploadingIcon ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>

              {onDeleteLounge && (
                <div className="pt-6 mt-6 border-t border-alert-error/20 space-y-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-alert-error">
                    Danger Zone
                  </div>
                  <div className="p-4 rounded-2xl bg-alert-error/10 border border-alert-error/20 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold text-white">Delete Lounge</div>
                      <div className="text-[10px] text-text-secondary mt-0.5">
                        Permanently delete this lounge, all sublounges, and messages. This action cannot be undone.
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to permanently delete "${loungeName}" and all its sublounges?`)) {
                          onDeleteLounge();
                        }
                      }}
                      className="px-4 py-2 bg-alert-error hover:bg-alert-error/90 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl cursor-pointer transition shrink-0"
                    >
                      Delete Lounge
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 1: Members & Roles Management */}
          {manageTab === 'members' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Lounge Members</span>
                <span className="text-[10px] font-mono text-accent">{members.length} Active Members</span>
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
              
              {(!manageRequests || manageRequests.length === 0) ? (
                <div className={`p-8 rounded-2xl text-center border font-mono text-[10px] uppercase tracking-widest ${isDark ? 'bg-white/[0.01] border-white-5 text-text-secondary' : 'bg-text-primary border-velum-600 text-text-disabled'}`}>
                  // No active admission requests pending //
                </div>
              ) : (
                <div className="space-y-2">
                  {(manageRequests || []).map((req, index) => (
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

                {(!manageInvites || manageInvites.length === 0) ? (
                  <div className={`p-6 rounded-2xl text-center border font-mono text-[9.5px] uppercase tracking-widest ${isDark ? 'bg-white/[0.01] border-white-5 text-text-secondary' : 'bg-text-primary border-velum-600 text-text-disabled'}`}>
                    // No custom invite links generated //
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(manageInvites || []).map((inv, index) => (
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
