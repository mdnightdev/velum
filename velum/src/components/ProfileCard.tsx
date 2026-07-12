import React from 'react';
import { 
  Globe, Calendar, MessageSquare, MoreVertical, Search, ShieldAlert, Ban, Trash2, 
  ChevronRight, X, ArrowLeft, AlertCircle, Bell, BellOff, ShieldCheck, Users, 
  Lock, Unlock, Settings, LogIn, LogOut, ShieldAlert as AlertIcon
} from 'lucide-react';
import logoSvg from '../assets/logo.svg?raw';

export type UserProfileData = {
  userId: number;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  joinedDate?: string;
  status?: string;
  role?: 'USER' | 'LOGIN_ADMIN' | 'SUPPORT_OPERATOR';
  isMuted?: boolean;
  isBlocked?: boolean;
  stats?: {
    loungesCount: number;
    connectionsCount: number;
  };
};

export type LoungeProfileData = {
  loungeId: string;
  name: string;
  description: string;
  ownerId: number;
  ownerUsername: string;
  memberCount: number;
  avatarUrl?: string;
  createdAt?: string;
  isPrivate?: boolean;
  isReadOnly?: boolean;
  is_minimal_view?: boolean;
  type?: 'official' | 'user_created' | 'private_sublounge';
  visibility?: 'public' | 'private' | 'invite_only';
  status?: string;
  parent_lounge_id?: string | null;
  created_at?: string | number;
};

type ProfileCardProps = {
  type?: 'user' | 'admin' | 'lounge';
  user?: UserProfileData;
  lounge?: LoungeProfileData;
  variant: 'mobile' | 'expanded' | 'popover';
  onClose: () => void;
  // User/Admin actions
  onMessage?: () => void;
  onMute?: () => void;
  onBlock?: () => void;
  onDeleteChat?: () => void;
  onReport?: () => void;
  onViewProfile?: () => void;
  onSearchMessages?: () => void;
  // Lounge actions
  onJoinLeaveLounge?: () => void;
  onLoungeSettings?: () => void;
  isJoinedLounge?: boolean;
};

export default function ProfileCard({
  type = 'user',
  user,
  lounge,
  variant,
  onClose,
  onMessage,
  onMute,
  onBlock,
  onDeleteChat,
  onReport,
  onViewProfile,
  onSearchMessages,
  onJoinLeaveLounge,
  onLoungeSettings,
  isJoinedLounge = false
}: ProfileCardProps) {
  
  // Render Lounge Profile Card
  if (type === 'lounge' && lounge) {
    const isMinimal = !!lounge.is_minimal_view;
    const displayLoungeName = lounge.name;
    const loungeAvatarText = displayLoungeName.slice(0, 2).toUpperCase();

    const isOfficial = lounge.loungeId === 'velum_lounge' || lounge.type === 'official';
    const isPrivate = lounge.isPrivate || lounge.visibility === 'private' || lounge.type === 'private_sublounge';
    
    // Visibility Badge (Section 15)
    const visibilityLabel = isOfficial ? 'Official' : isPrivate ? 'Private' : 'Public';
    
    // Join method (Section 15)
    const joinMethod = isOfficial ? 'Open' : isPrivate ? 'Invite-only' : 'Open';

    // Owner label (Section 15)
    const ownerLabel = isOfficial ? 'Managed by Velum Staff' : lounge.ownerUsername ? `@${lounge.ownerUsername}` : 'Unknown Host';

    const isMuted = lounge.status === 'muted';

    if (variant === 'mobile' || variant === 'expanded') {
      return (
        <div className="fixed inset-0 z-[999999] bg-velum-900 flex flex-col text-white animate-fadeIn font-sans overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-transparent shrink-0">
            <button onClick={onClose} className="p-2.5 rounded-full border border-white-10 text-text-primary hover:text-white hover:bg-text-primary/5 transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 px-6 pb-12 flex flex-col max-w-2xl mx-auto w-full">
            {/* Muted status banner (Section 15) */}
            {isMuted && (
              <div className="mb-6 p-3.5 bg-status-away/15 border border-status-away/25 rounded-2xl flex items-center gap-2.5 text-xs text-status-away font-mono uppercase tracking-wider animate-pulse">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>This lounge is temporarily muted by administrators</span>
              </div>
            )}

            <div className="flex flex-col items-center mt-6 mb-8 text-center">
              <div className="w-28 h-28 rounded-full overflow-hidden bg-accent border-4 border-velum-900 shadow-[0_0_0_1px_rgba(255,255,255,0.1)] flex items-center justify-center font-bold text-black text-3xl mb-5">
                {lounge.avatarUrl ? (
                  <img src={lounge.avatarUrl} alt={displayLoungeName} className="w-full h-full object-cover" />
                ) : (
                  loungeAvatarText
                )}
              </div>
              
              {/* Breadcrumb for sublounges */}
              {lounge.parent_lounge_id && (
                <div className="text-[9px] font-mono uppercase tracking-widest text-text-secondary mb-1">
                  Lounge Directory → {displayLoungeName}
                </div>
              )}

              <h1 className="text-2xl font-black uppercase tracking-wider mb-1">{displayLoungeName}</h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-0.5 bg-accent/15 text-accent border border-accent/25 text-[9px] font-mono font-bold uppercase rounded-md tracking-wider">
                  {visibilityLabel}
                </span>
                <span className="px-2 py-0.5 bg-white-5 text-text-secondary border border-white-5 text-[9px] font-mono font-bold uppercase rounded-md tracking-wider">
                  Method: {joinMethod}
                </span>
              </div>
            </div>

            {/* Minimal card details vs Full card details */}
            {isMinimal ? (
              <div className="bg-velum-800/40 p-5 rounded-2xl border border-white-5 space-y-4 max-w-md mx-auto w-full text-center">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Minimal Secure Profile</div>
                <div className="text-xs text-text-secondary leading-relaxed">
                  You are viewing a minimal identity card for this private sublounge. Content, messages, and rules are restricted.
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white-5">
                  <div>
                    <div className="text-[10px] text-text-secondary uppercase font-mono tracking-wider">Host</div>
                    <div className="text-xs font-bold text-white mt-1">{ownerLabel}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-secondary uppercase font-mono tracking-wider">Members</div>
                    <div className="text-xs font-bold text-white mt-1">{lounge.memberCount}</div>
                  </div>
                </div>
                <div className="pt-2 border-t border-white-5">
                  <div className="text-[10px] text-text-secondary uppercase font-mono tracking-wider">Created At</div>
                  <div className="text-xs font-bold text-white mt-1">{lounge.createdAt || lounge.created_at || 'Unknown'}</div>
                </div>
              </div>
            ) : (
              <>
                {/* Full Profile View */}
                {lounge.description && (
                  <div className="mb-6 p-4 bg-velum-800/30 border border-white-5 rounded-2xl text-center italic text-sm text-text-primary leading-relaxed">
                    &quot;{lounge.description}&quot;
                  </div>
                )}

                <div className="grid grid-cols-2 bg-velum-800/50 rounded-2xl border border-white-5 p-4 mb-6 text-center max-w-md mx-auto w-full shadow-inner">
                  <div className="flex flex-col border-r border-white-5 items-center justify-center">
                    <span className="text-xl font-bold text-white">{lounge.memberCount}</span>
                    <span className="text-[10px] text-text-secondary uppercase font-mono tracking-widest mt-1">Members</span>
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-xs font-bold text-white truncate max-w-full px-2">
                      {ownerLabel}
                    </span>
                    <span className="text-[10px] text-text-secondary uppercase font-mono tracking-widest mt-1">Lounge Host</span>
                  </div>
                </div>

                {/* Rules Section */}
                <div className="mb-8 p-5 bg-velum-800 border border-white-5 rounded-2xl max-w-lg mx-auto w-full">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary mb-3">Lounge Guidelines</div>
                  <ul className="text-xs text-text-primary space-y-2.5 list-disc pl-4 leading-relaxed">
                    <li>Be respectful to all workspace operators.</li>
                    <li>Ensure all shared assets match local compliance standards.</li>
                    <li>Secure-tunneling information must remain confidential.</li>
                    <li>Parent community rules and cascades apply.</li>
                  </ul>
                </div>

                {onJoinLeaveLounge && (
                  <div className="mt-auto max-w-lg mx-auto w-full">
                    <button onClick={onJoinLeaveLounge} className={`w-full py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition shadow-lg ${isJoinedLounge ? 'bg-status-dnd/20 text-red-500 border border-red-900/30' : 'bg-accent text-black hover:bg-accent-hover'}`}>
                      {isJoinedLounge ? 'Leave Lounge' : 'Join Lounge'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      );
    }

    if (variant === 'popover') {
      return (
        <div className="absolute top-0 left-0 w-[280px] bg-velum-800 border border-white-10 rounded-2xl shadow-2xl z-50 overflow-hidden text-white font-sans animate-fadeIn">
          <div className="p-4 bg-gradient-to-b from-white/[0.04] to-transparent border-b border-white-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-accent border-2 border-zinc-900 shadow-sm flex items-center justify-center font-bold text-black text-sm overflow-hidden shrink-0">
                {lounge.avatarUrl ? (
                  <img src={lounge.avatarUrl} alt={displayLoungeName} className="w-full h-full object-cover" />
                ) : (
                  loungeAvatarText
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[13px] truncate uppercase tracking-wider">{displayLoungeName}</h3>
                <div className="text-[9px] text-text-secondary mt-0.5">{lounge.memberCount} Members</div>
              </div>
              <button onClick={onClose} className="p-1.5 self-start text-text-secondary hover:text-white rounded-md hover:bg-text-primary/10">
                <X className="w-4 h-4" />
              </button>
            </div>

            {isMuted && (
              <div className="mb-3 p-2 bg-status-away/10 border border-status-away/20 rounded-xl text-[9px] text-status-away font-mono uppercase tracking-wider">
                Muted by administrators
              </div>
            )}

            {isMinimal ? (
              <div className="mb-3 p-3 bg-black/35 rounded-xl border border-white-5 text-[10px] text-text-secondary space-y-2">
                <div className="font-bold text-accent uppercase tracking-wider">Minimal Profile</div>
                <div>Lounge: {visibilityLabel}</div>
                <div>Host: {ownerLabel}</div>
              </div>
            ) : (
              <>
                {lounge.description && (
                  <div className="mb-3 border-l-2 border-accent pl-2">
                    <p className="text-xs text-text-primary italic line-clamp-2">&quot;{lounge.description}&quot;</p>
                  </div>
                )}
                <div className="flex flex-col gap-1.5 text-[9px] font-mono text-text-secondary uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-accent" />
                    <span>Type: {visibilityLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 text-emerald-450" />
                    <span>Host: {ownerLabel}</span>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {!isMinimal && (onJoinLeaveLounge || onLoungeSettings) && (
            <div className="p-2 border-b border-white-5 flex gap-2">
              {onJoinLeaveLounge && (
                <button onClick={onJoinLeaveLounge} className={`flex-1 py-2 rounded-lg text-xs font-semibold text-center transition ${isJoinedLounge ? 'bg-status-dnd/20 text-red-400 border border-red-900/30' : 'bg-accent hover:bg-accent-hover text-black'}`}>
                  {isJoinedLounge ? 'Leave Lounge' : 'Join Lounge'}
                </button>
              )}
              {onLoungeSettings && (
                <button onClick={onLoungeSettings} className="px-3 py-2 bg-velum-800 hover:bg-velum-800 rounded-lg text-xs font-semibold text-center transition border border-white-5 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-text-secondary" />
                </button>
              )}
            </div>
          )}
        </div>
      );
    }
  }

  // Render User / Admin Profile Card
  if ((type === 'user' || type === 'admin') && user) {
    const displayName = user.displayName || user.username;
    const avatarText = displayName.slice(0, 2).toUpperCase();
    const isAdminMode = type === 'admin' || user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_OPERATOR';

    if (variant === 'mobile') {
      return (
        <div className="fixed inset-0 z-[99999] flex flex-col justify-end bg-black-60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full bg-velum-800 border-t border-white-10 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.8)] translate-y-0 transition-transform duration-300">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-text-primary/10 rounded-full" />
            </div>
            
            <div className="px-6 pb-8 pt-2">
              {/* Header */}
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-accent border border-white-10 shrink-0 flex items-center justify-center font-bold text-black text-xl">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : user.userId === 999 || user.username.toLowerCase().includes('velum') || user.username.toLowerCase().includes('system') ? (
                    <div className="w-10 h-10 [&>svg]:w-full [&>svg]:h-full [&_path]:stroke-current text-velum-900" dangerouslySetInnerHTML={{ __html: logoSvg }} />
                  ) : (
                    avatarText
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-xl font-bold text-white truncate">{displayName}</h2>
                    {isAdminMode && (
                      <span className="px-1.5 py-0.5 bg-red-950 text-red-400 border border-red-900/30 text-[8px] font-mono font-bold uppercase rounded">
                        {user.role || 'ADMIN'}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-accent font-mono truncate">@{user.username}</div>
                  <div className="text-xs text-text-secondary mt-0.5">{user.status || 'Active now'}</div>
                </div>
                <button onClick={onClose} className="p-2 -mr-2 text-text-secondary hover:text-white rounded-full bg-text-primary/5">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Sub-Header */}
              {user.bio && (
                <div className="mb-4 border-l-2 border-accent pl-3">
                  <p className="text-sm text-text-primary italic">&quot;{user.bio}&quot;</p>
                </div>
              )}
              <div className="flex items-center gap-4 text-xs font-mono text-text-secondary uppercase tracking-wider mb-6">
                {user.location && (
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-text-secondary" />
                    <span>{user.location}</span>
                  </div>
                )}
                {user.joinedDate && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-text-secondary" />
                    <span>Joined {user.joinedDate}</span>
                  </div>
                )}
              </div>
              
              {/* Stats Bar */}
              {user.stats && (
                <div className="grid grid-cols-2 gap-3 mb-6 bg-black/40 p-3 rounded-2xl border border-white-5">
                  <div className="flex flex-col items-center justify-center py-2">
                    <MessageSquare className="w-4 h-4 text-text-secondary mb-2" />
                    <div className="text-lg font-bold text-white mb-1">{user.stats.loungesCount}</div>
                    <div className="text-[10px] text-text-secondary uppercase font-mono tracking-wider">Lounges</div>
                  </div>
                  <div className="flex flex-col items-center justify-center py-2 border-l border-white-5">
                    <Users className="w-4 h-4 text-text-secondary mb-2" />
                    <div className="text-lg font-bold text-white mb-1">{user.stats.connectionsCount}</div>
                    <div className="text-[10px] text-text-secondary uppercase font-mono tracking-wider">Connections</div>
                  </div>
                </div>
              )}
              
              {/* Action List */}
              <div className="flex flex-col gap-1 mb-6">
                {onViewProfile && (
                  <button onClick={onViewProfile} className="w-full flex items-center justify-between p-3.5 bg-text-primary/[0.02] hover:bg-text-primary/[0.06] rounded-xl transition text-text-primary hover:text-white">
                    <div className="flex items-center gap-3">
                      <Search className="w-5 h-5 text-text-secondary" />
                      <span className="text-sm font-medium">View Profile</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-secondary" />
                  </button>
                )}
                {onSearchMessages && (
                  <button onClick={onSearchMessages} className="w-full flex items-center justify-between p-3.5 bg-text-primary/[0.02] hover:bg-text-primary/[0.06] rounded-xl transition text-text-primary hover:text-white">
                    <div className="flex items-center gap-3">
                      <Search className="w-5 h-5 text-text-secondary" />
                      <span className="text-sm font-medium">Search Messages</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-secondary" />
                  </button>
                )}
              </div>
              
              {/* Footer Utilities */}
              <div className="grid grid-cols-4 gap-2">
                {onMute && (
                  <button onClick={onMute} className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-velum-800 border border-white-5 hover:bg-velum-800 transition text-text-secondary hover:text-white">
                    {user.isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                    <span className="text-[9px] uppercase font-mono font-semibold">{user.isMuted ? 'Unmute' : 'Mute'}</span>
                  </button>
                )}
                {onBlock && (
                  <button onClick={onBlock} className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition ${user.isBlocked ? 'bg-velum-800 border-white-5 hover:bg-velum-800 text-text-secondary hover:text-white' : 'bg-status-dnd/20 border-red-900/30 hover:bg-red-950/40 text-red-500'}`}>
                    {user.isBlocked ? <ShieldAlert className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                    <span className="text-[9px] uppercase font-mono font-semibold">{user.isBlocked ? 'Unblock' : 'Block'}</span>
                  </button>
                )}
                {onDeleteChat && (
                  <button onClick={onDeleteChat} className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-velum-800 border border-white-5 hover:bg-red-950/30 hover:text-red-400 transition text-text-secondary">
                    <Trash2 className="w-4 h-4" />
                    <span className="text-[9px] uppercase font-mono font-semibold">Delete</span>
                  </button>
                )}
                {onReport && (
                  <button onClick={onReport} className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-velum-800 border border-white-5 hover:bg-red-950/30 hover:text-red-400 transition text-text-secondary">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-[9px] uppercase font-mono font-semibold">Report</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (variant === 'popover') {
      return (
        <div className="absolute top-0 left-0 w-[280px] bg-velum-800 border border-white-10 rounded-2xl shadow-2xl z-50 overflow-hidden text-white font-sans animate-fadeIn">
          <div className="p-4 bg-gradient-to-b from-white/[0.04] to-transparent border-b border-white-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-accent border-2 border-zinc-900 shadow-sm flex items-center justify-center font-bold text-black text-sm overflow-hidden shrink-0">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : user.userId === 999 || user.username.toLowerCase().includes('velum') || user.username.toLowerCase().includes('system') ? (
                  <div className="w-8 h-8 [&>svg]:w-full [&>svg]:h-full [&_path]:stroke-current text-velum-900" dangerouslySetInnerHTML={{ __html: logoSvg }} />
                ) : (
                  avatarText
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <h3 className="font-bold text-[14px] truncate">{displayName}</h3>
                  {isAdminMode && (
                    <span className="px-1 py-0.2 bg-red-950 text-red-400 border border-red-900/30 text-[7px] font-mono font-bold uppercase rounded">
                      ADMIN
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-accent font-mono truncate">@{user.username}</div>
                <div className="text-[10px] text-text-secondary mt-0.5">{user.status || 'Active now'}</div>
              </div>
              <button onClick={onClose} className="p-1.5 self-start text-text-secondary hover:text-white rounded-md hover:bg-text-primary/10">
                <X className="w-4 h-4" />
              </button>
            </div>
            {user.bio && (
              <div className="mb-3 border-l-2 border-accent pl-2">
                <p className="text-xs text-text-primary italic line-clamp-2">&quot;{user.bio}&quot;</p>
              </div>
            )}
            <div className="flex flex-col gap-1.5 text-[10px] font-mono text-text-secondary uppercase tracking-wider">
              {user.location && (
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-text-secondary" />
                  <span>{user.location}</span>
                </div>
              )}
              {user.joinedDate && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-text-secondary" />
                  <span>Joined {user.joinedDate}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-2 border-b border-white-5 flex gap-2">
            {onViewProfile && (
              <button onClick={onViewProfile} className="flex-1 py-2 bg-velum-800 hover:bg-velum-800 rounded-lg text-xs font-semibold text-center transition border border-white-5">
                View Profile
              </button>
            )}
            {onMessage && (
              <button onClick={onMessage} className="flex-1 py-2 bg-accent hover:bg-accent-hover text-black rounded-lg text-xs font-semibold text-center transition">
                Message
              </button>
            )}
          </div>
           
          <div className="p-1.5 flex flex-col">
            {onMute && (
              <button onClick={onMute} className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-text-primary/5 transition text-left text-text-primary hover:text-white">
                {user.isMuted ? <BellOff className="w-4 h-4 text-text-secondary" /> : <Bell className="w-4 h-4 text-text-secondary" />}
                <span className="text-xs font-medium">{user.isMuted ? 'Unmute' : 'Mute'}</span>
              </button>
            )}
            {onBlock && (
              <button onClick={onBlock} className={`flex items-center gap-3 w-full p-2.5 rounded-lg transition text-left ${user.isBlocked ? 'hover:bg-text-primary/5 text-text-primary hover:text-white' : 'hover:bg-status-dnd/10 text-red-400 hover:text-red-300'}`}>
                {user.isBlocked ? <ShieldAlert className={`w-4 h-4 ${user.isBlocked ? 'text-text-secondary' : ''}`} /> : <Ban className="w-4 h-4" />}
                <span className="text-xs font-medium">{user.isBlocked ? 'Unblock' : 'Block'}</span>
              </button>
            )}
            {onDeleteChat && (
              <button onClick={onDeleteChat} className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-status-dnd/10 transition text-left text-red-400 hover:text-red-300">
                <Trash2 className="w-4 h-4" />
                <span className="text-xs font-medium">Delete Chat</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    // Expanded Variant (Full Screen View)
    return (
      <div className="fixed inset-0 z-[999999] bg-velum-900 flex flex-col text-white animate-fadeIn font-sans overflow-y-auto">
        <div className="flex items-center justify-between p-4 bg-transparent shrink-0">
          <button onClick={onClose} className="p-2.5 rounded-full border border-white-10 text-text-primary hover:text-white hover:bg-text-primary/5 transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button className="p-2.5 rounded-full text-text-secondary hover:text-white hover:bg-text-primary/5 transition">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 px-6 pb-12 flex flex-col max-w-2xl mx-auto w-full">
          <div className="flex flex-col items-center mt-6 mb-8 text-center">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-accent border-4 border-velum-900 shadow-[0_0_0_1px_rgba(255,255,255,0.1)] flex items-center justify-center font-bold text-black text-4xl mb-5">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : user.userId === 999 || user.username.toLowerCase().includes('velum') || user.username.toLowerCase().includes('system') ? (
                <div className="w-20 h-20 [&>svg]:w-full [&>svg]:h-full [&_path]:stroke-current text-velum-900" dangerouslySetInnerHTML={{ __html: logoSvg }} />
              ) : (
                avatarText
              )}
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold mb-1">{displayName}</h1>
              {isAdminMode && (
                <span className="px-2 py-0.5 bg-red-950 text-red-400 border border-red-900/30 text-[10px] font-mono font-bold uppercase rounded">
                  {user.role || 'ADMIN'}
                </span>
              )}
            </div>
            <div className="text-base text-accent font-mono mb-2">@{user.username}</div>
            <div className="text-sm text-text-secondary">{user.status || 'Active now'}</div>
            
            <div className="flex items-center justify-center gap-4 text-xs font-mono text-text-secondary uppercase tracking-wider mt-4">
              {user.location && (
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-text-secondary" />
                  <span>{user.location}</span>
                </div>
              )}
              {user.joinedDate && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-text-secondary" />
                  <span>Joined {user.joinedDate}</span>
                </div>
              )}
            </div>
          </div>
          
          {user.stats && (
            <div className="grid grid-cols-2 bg-velum-800/50 rounded-2xl border border-white-5 p-4 mb-8 text-center max-w-md mx-auto w-full shadow-inner">
              <div className="flex flex-col border-r border-white-5">
                <span className="text-2xl font-bold text-white">{user.stats.loungesCount}</span>
                <span className="text-[10px] text-text-secondary uppercase font-mono tracking-widest mt-1">Lounges</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-white">{user.stats.connectionsCount}</span>
                <span className="text-[10px] text-text-secondary uppercase font-mono tracking-widest mt-1">Connections</span>
              </div>
            </div>
          )}

          {isAdminMode && (
            <div className="bg-red-950/10 border border-red-900/20 rounded-2xl p-4 mb-8 max-w-md mx-auto w-full text-center">
              <div className="flex items-center justify-center gap-2 text-red-400 text-xs font-mono font-bold uppercase tracking-wider">
                <AlertIcon className="w-4 h-4" />
                <span>Security Diagnostics Console Active</span>
              </div>
              <p className="text-[10px] text-text-secondary mt-1 font-mono uppercase">
                Authorized operator session linked to secure communications layer.
              </p>
            </div>
          )}
          
          {user.bio && (
            <div className="mb-10 max-w-lg mx-auto w-full">
              <blockquote className="border-l-2 border-accent pl-5 py-1">
                <p className="text-sm md:text-base text-text-primary leading-relaxed italic">
                  &quot;{user.bio}&quot;
                </p>
              </blockquote>
            </div>
          )}
          
          <div className="mt-auto flex flex-col gap-3 max-w-lg mx-auto w-full">
            {onMessage && (
              <div className="grid grid-cols-1 gap-3">
                <button onClick={onMessage} className="py-3.5 px-2 bg-accent hover:bg-accent-hover text-black font-semibold rounded-xl transition flex flex-col items-center justify-center gap-1.5 text-xs shadow-lg">
                  <MessageSquare className="w-4 h-4" />
                  <span>Message</span>
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-3 gap-3">
              {onMute && (
                <button onClick={onMute} className="py-3 px-2 bg-velum-900/50 border border-white-5 hover:bg-velum-800 text-text-secondary hover:text-white font-semibold rounded-xl transition flex flex-col items-center justify-center gap-1 text-[11px] uppercase font-mono">
                  {user.isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                  <span>{user.isMuted ? 'Unmute' : 'Mute'}</span>
                </button>
              )}
              {onBlock && (
                <button onClick={onBlock} className={`py-3 px-2 rounded-xl border transition flex flex-col items-center justify-center gap-1 text-[11px] uppercase font-mono font-semibold ${user.isBlocked ? 'bg-velum-900/50 border-white-5 hover:bg-velum-800 text-text-secondary hover:text-white' : 'bg-red-950/10 border-red-900/20 hover:bg-red-950/30 text-red-500 hover:text-red-400'}`}>
                  {user.isBlocked ? <ShieldAlert className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                  <span>{user.isBlocked ? 'Unblock' : 'Block'}</span>
                </button>
              )}
              {onDeleteChat && (
                <button onClick={onDeleteChat} className="py-3 px-2 bg-velum-900/50 border border-red-900/20 hover:bg-red-950/30 text-red-500 font-semibold rounded-xl transition flex flex-col items-center justify-center gap-1 text-[11px] uppercase font-mono">
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Chat</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
