import React from 'react';
import { 
  Globe, Calendar, MessageSquare, MoreVertical, Search, ShieldAlert, Ban, Trash2, 
  ChevronRight, X, ArrowLeft, AlertCircle, Bell, BellOff, ShieldCheck, Users, 
  Lock, Unlock, Settings, LogIn, LogOut, ShieldAlert as AlertIcon, Check,
  Paperclip, Image as ImageIcon, Loader2
} from 'lucide-react';
import logoSvg from '../assets/logo.svg?raw';
import { resolveMediaUrl, streamFileDirectToCloudStorage } from '../utils/mediaPipeline';
import { formatLastSeen } from '../utils/datetime';

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
  onReport?: (reason?: string, attachments?: string[]) => void;
  onViewProfile?: () => void;
  onSearchMessages?: () => void;
  onForceRekey?: () => void;
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
  onForceRekey,
  onJoinLeaveLounge,
  onLoungeSettings,
  isJoinedLounge = false
}: ProfileCardProps) {
  
  // Render Lounge Profile Card
  if (type === 'lounge' && lounge) {
    const isMinimal = !!lounge.is_minimal_view;
    const displayLoungeName = lounge.name;
    const loungeAvatarText = displayLoungeName.slice(0, 2).toUpperCase();

    const isOfficial = lounge.type === 'official';
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
              <div className="relative group mb-5">
                <div className="w-28 h-28 rounded-full overflow-hidden bg-accent border-4 border-velum-900 avatar-shadow-ring flex items-center justify-center font-bold text-black text-3xl">
                  {lounge.avatarUrl ? (
                    <img 
                      src={resolveMediaUrl(lounge.avatarUrl)} 
                      alt={displayLoungeName} 
                      className="w-full h-full object-cover" 
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    loungeAvatarText
                  )}
                </div>
                {onLoungeSettings && (
                  <button
                    onClick={onLoungeSettings}
                    className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer border-4 border-transparent"
                    title="Edit Lounge Settings & Avatar"
                  >
                    <Settings className="w-5 h-5 text-accent mb-1 animate-pulse" />
                    <span className="text-[9px] font-bold tracking-widest text-white uppercase font-mono">Edit Avatar</span>
                  </button>
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
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Profile</div>
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
                    <li>Information must remain confidential.</li>
                    <li>Parent lounge rules and cascades apply.</li>
                  </ul>
                </div>

                {onJoinLeaveLounge && (
                  <div className="mt-auto max-w-lg mx-auto w-full">
                    <button onClick={onJoinLeaveLounge} className={`w-full py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition shadow-lg ${isJoinedLounge ? 'bg-status-dnd-bg text-status-dnd' : 'bg-accent text-black hover:bg-accent-hover'}`}>
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
              <div className="mb-3 p-2 bg-status-away-bg rounded-xl text-[9px] text-status-away font-mono uppercase tracking-wider">
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
                    <ShieldCheck className="w-3 h-3 text-alert-success" />
                    <span>Host: {ownerLabel}</span>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {!isMinimal && (onJoinLeaveLounge || onLoungeSettings) && (
            <div className="p-2 border-b border-white-5 flex gap-2">
              {onJoinLeaveLounge && (
                <button onClick={onJoinLeaveLounge} className={`flex-1 py-2 rounded-lg text-xs font-semibold text-center transition ${isJoinedLounge ? 'bg-status-dnd-bg text-status-dnd' : 'bg-accent hover:bg-accent-hover text-black'}`}>
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
  }  // Render User / Admin Profile Card
  if ((type === 'user' || type === 'admin') && user) {
    const displayName = user.displayName || user.username;
    const avatarText = displayName.slice(0, 2).toUpperCase();
    const isAdminMode = type === 'admin' || user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_OPERATOR';

    const [isChatLocked, setIsChatLocked] = React.useState(false);
    const [isFavourite, setIsFavourite] = React.useState(false);
    const [isMutedLocal, setIsMutedLocal] = React.useState(!!user.isMuted);
    const [disappearingMode, setDisappearingMode] = React.useState('Off');

    const [showBlockModal, setShowBlockModal] = React.useState(false);
    const [showReportModal, setShowReportModal] = React.useState(false);
    const [showClearModal, setShowClearModal] = React.useState(false);
    const [selectedReportReason, setSelectedReportReason] = React.useState('Spam');
    const [reportDetails, setReportDetails] = React.useState('');
    const [reportAttachments, setReportAttachments] = React.useState<string[]>([]);
    const [isUploadingAttachment, setIsUploadingAttachment] = React.useState(false);
    const reportFileInputRef = React.useRef<HTMLInputElement | null>(null);
    const [actionFeedback, setActionFeedback] = React.useState<string | null>(null);

    const triggerFeedback = (msg: string) => {
      setActionFeedback(msg);
      setTimeout(() => setActionFeedback(null), 3000);
    };

    const resetReportModal = () => {
      setShowReportModal(false);
      setSelectedReportReason('Spam');
      setReportDetails('');
      setReportAttachments([]);
      setIsUploadingAttachment(false);
      if (reportFileInputRef.current) reportFileInputRef.current.value = '';
    };

    const handleReportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const file = files[0];
      try {
        setIsUploadingAttachment(true);
        const url = await streamFileDirectToCloudStorage(file, 'media', file.name.split('.').pop() || 'jpg');
        if (url) {
          setReportAttachments(prev => [...prev, url]);
        }
      } catch (err) {
        console.warn('Failed to upload report attachment:', err);
      } finally {
        setIsUploadingAttachment(false);
        if (reportFileInputRef.current) reportFileInputRef.current.value = '';
      }
    };

    const statusText = user.userId === 999 
      ? 'Official System Bot' 
      : formatLastSeen(user.status || (user as any).lastSeen || (user as any).peerPresence || (user as any).last_seen || null);

    return (
      <div className="fixed inset-0 z-[999999] bg-[#0D1117] flex flex-col text-white animate-in fade-in slide-in-from-right duration-200 font-sans overflow-y-auto select-none">
        {/* Toast feedback banner */}
        {actionFeedback && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000000] px-4 py-2 bg-velum-800 border border-accent/40 rounded-full shadow-2xl text-xs font-medium text-white flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
            <Check className="w-4 h-4 text-accent" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* Top App Bar with Solid Background */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0px)+0.625rem)] pb-3 bg-[#0D1117] border-b border-white-5 shrink-0">
          <button 
            type="button"
            onClick={onClose} 
            className="w-10 h-10 rounded-full flex items-center justify-center text-text-secondary hover:text-white hover:bg-white-5 active:bg-white-10 transition cursor-pointer shrink-0"
            title="Back"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <button 
              type="button"
              className="w-10 h-10 rounded-full flex items-center justify-center text-text-secondary hover:text-white hover:bg-white-5 active:bg-white-10 transition cursor-pointer"
              title="Options"
              aria-label="Options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 px-4 sm:px-6 pb-16 flex flex-col max-w-xl mx-auto w-full space-y-6">
          {/* Hero Section */}
          <div className="flex flex-col items-center pt-4 text-center">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-velum-800 border-4 border-velum-800 shadow-2xl flex items-center justify-center font-bold text-accent text-3xl sm:text-4xl mb-4 relative">
              {user.avatarUrl ? (
                <img 
                  src={resolveMediaUrl(user.avatarUrl)} 
                  alt={displayName} 
                  className="w-full h-full object-cover" 
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : user.userId === 999 ? (
                <div className="w-16 h-16 [&>svg]:w-full [&>svg]:h-full text-accent" dangerouslySetInnerHTML={{ __html: logoSvg }} />
              ) : (
                avatarText
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-white mb-1 flex items-center justify-center gap-2">
              {displayName}
              {isAdminMode && (
                <span className="px-1.5 py-0.5 bg-accent/15 text-accent text-[9px] font-mono font-bold uppercase rounded-md">
                  Staff
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm font-mono text-text-secondary mb-2">@{user.username}</p>
            {user.bio && (
              <p className="text-xs sm:text-sm text-text-primary italic max-w-md mx-auto mb-2 px-4 leading-relaxed">
                &quot;{user.bio}&quot;
              </p>
            )}
            <p className="text-xs text-text-secondary">{statusText}</p>

            {/* Quick Action Pills */}
            <div className="flex items-center justify-center gap-4 mt-5 w-full max-w-xs">
              {onMessage && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onMessage();
                  }}
                  className="flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-velum-800 border border-white-5 hover:bg-velum-750 active:scale-95 transition cursor-pointer group"
                >
                  <MessageSquare className="w-5 h-5 text-accent group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-medium text-text-primary">Chat</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (onMute) {
                    setIsMutedLocal(!isMutedLocal);
                    onMute();
                    triggerFeedback(isMutedLocal ? 'Unmuted notifications' : 'Muted notifications');
                  }
                }}
                className="flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-velum-800 border border-white-5 hover:bg-velum-750 active:scale-95 transition cursor-pointer group"
              >
                {isMutedLocal ? <BellOff className="w-5 h-5 text-text-secondary" /> : <Bell className="w-5 h-5 text-accent" />}
                <span className="text-[11px] font-medium text-text-primary">{isMutedLocal ? 'Unmute' : 'Mute'}</span>
              </button>
              {onSearchMessages && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSearchMessages();
                  }}
                  className="flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-velum-800 border border-white-5 hover:bg-velum-750 active:scale-95 transition cursor-pointer group"
                >
                  <Search className="w-5 h-5 text-accent group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-medium text-text-primary">Search</span>
                </button>
              )}
            </div>
          </div>

          {/* Media, links, and docs Strip */}
          <div className="rounded-2xl bg-velum-850 border border-velum-600/50 p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-semibold text-text-primary">Media, links, and docs</span>
              <div className="flex items-center gap-1 text-xs text-text-secondary">
                <span>0</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              <div className="w-16 h-16 rounded-xl bg-velum-750 border border-velum-600/50 flex flex-col items-center justify-center shrink-0 text-text-secondary">
                <Globe className="w-5 h-5 mb-1" />
                <span className="text-[9px]">Media</span>
              </div>
            </div>
          </div>

          {/* Chat Settings & Controls */}
          <div className="rounded-2xl bg-velum-850 border border-velum-600/50 divide-y divide-white-5 shadow-lg overflow-hidden">
            {/* Disappearing messages */}
            <div 
              onClick={() => {
                const modes = ['Off', '24 hours', '7 days', '90 days'];
                const curIdx = modes.indexOf(disappearingMode);
                const nextMode = modes[(curIdx + 1) % modes.length];
                setDisappearingMode(nextMode);
                triggerFeedback(`Disappearing messages set to ${nextMode}`);
              }}
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-white-5 transition"
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-text-secondary" />
                <div className="flex flex-col text-left">
                  <span className="text-sm font-medium text-text-primary">Disappearing messages</span>
                  <span className="text-xs text-text-secondary">{disappearingMode}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-disabled" />
            </div>

            {/* Chat lock */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <Lock className="w-5 h-5 text-text-secondary shrink-0" />
                <div className="flex flex-col text-left">
                  <span className="text-sm font-medium text-text-primary">Chat lock</span>
                  <span className="text-xs text-text-secondary">Lock and hide this chat on this device</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsChatLocked(!isChatLocked);
                  triggerFeedback(!isChatLocked ? 'Chat locked on this device' : 'Chat unlocked');
                }}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                  isChatLocked ? 'bg-accent justify-end' : 'bg-velum-700 justify-start'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${isChatLocked ? 'bg-velum-900' : 'bg-white'}`} />
              </button>
            </div>

            {/* Add to Favourites */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-text-secondary" />
                <span className="text-sm font-medium text-text-primary">Add to Favourites</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsFavourite(!isFavourite);
                  triggerFeedback(!isFavourite ? 'Added to favourites' : 'Removed from favourites');
                }}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                  isFavourite ? 'bg-accent justify-end' : 'bg-velum-700 justify-start'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${isFavourite ? 'bg-velum-900' : 'bg-white'}`} />
              </button>
            </div>
          </div>

          {/* Safety & Moderation Actions */}
          <div className="rounded-2xl bg-velum-850 border border-velum-600/50 divide-y divide-white-5 shadow-lg overflow-hidden">
            {/* Clear Chat */}
            {onDeleteChat && (
              <button
                type="button"
                onClick={() => setShowClearModal(true)}
                className="w-full flex items-center gap-3.5 p-4 text-left hover:bg-white-5 transition cursor-pointer text-text-primary"
              >
                <Trash2 className="w-5 h-5 text-text-secondary" />
                <span className="text-sm font-medium">Clear chat</span>
              </button>
            )}

            {/* Block Contact */}
            {onBlock && (
              <button
                type="button"
                onClick={() => {
                  if (user.isBlocked) {
                    onBlock();
                    triggerFeedback(`Unblocked ${displayName}`);
                  } else {
                    setShowBlockModal(true);
                  }
                }}
                className="w-full flex items-center gap-3.5 p-4 text-left hover:bg-white-5 transition cursor-pointer text-alert-error"
              >
                <Ban className="w-5 h-5 text-alert-error" />
                <span className="text-sm font-medium">{user.isBlocked ? `Unblock ${displayName}` : `Block ${displayName}`}</span>
              </button>
            )}

            {/* Report Contact */}
            {onReport && (
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                className="w-full flex items-center gap-3.5 p-4 text-left hover:bg-white-5 transition cursor-pointer text-alert-error"
              >
                <ShieldAlert className="w-5 h-5 text-alert-error" />
                <span className="text-sm font-medium">Report {displayName}</span>
              </button>
            )}
          </div>
        </div>

        {/* Block Confirmation Modal */}
        {showBlockModal && (
          <div 
            className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setShowBlockModal(false)}
          >
            <div 
              className="w-full max-w-sm bg-velum-850 border border-velum-600 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150 text-text-primary space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white">Block {displayName}?</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Blocked contacts will no longer be able to message you. You can unblock them at any time.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBlockModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-text-secondary hover:text-white hover:bg-white-5 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBlockModal(false);
                    if (onBlock) onBlock();
                    triggerFeedback(`Blocked ${displayName}`);
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-alert-error text-white hover:bg-alert-error/80 active:scale-95 transition cursor-pointer"
                >
                  Block
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Report Contact Modal */}
        {showReportModal && (
          <div 
            className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={resetReportModal}
          >
            <div 
              className="w-full max-w-sm bg-velum-850 border border-velum-600 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150 text-text-primary space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Report {displayName}</h3>
                <button 
                  type="button" 
                  onClick={resetReportModal}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-white hover:bg-white-5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Select a reason for reporting this contact. A confidential support review ticket will be created.
              </p>
              
              <div className="space-y-1.5 py-1">
                {['Spam', 'Harassment or bullying', 'Impersonation', 'Scam or fraud', 'Inappropriate content'].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelectedReportReason(reason)}
                    className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl border text-xs font-medium transition cursor-pointer text-left ${
                      selectedReportReason === reason 
                        ? 'bg-accent/15 border-accent text-accent' 
                        : 'bg-velum-800 border-velum-600/60 text-text-secondary hover:text-white'
                    }`}
                  >
                    <span>{reason}</span>
                    {selectedReportReason === reason && <Check className="w-4 h-4 text-accent shrink-0" />}
                  </button>
                ))}
              </div>

              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Additional details (optional)..."
                rows={2}
                className="w-full p-3 rounded-xl bg-velum-900 border border-velum-600/60 text-xs text-white placeholder-text-disabled focus:outline-none focus:border-accent resize-none"
              />

              {/* Photo attachments */}
              <div className="space-y-2">
                <input
                  ref={reportFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleReportFile}
                  className="hidden"
                />
                
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-text-secondary font-medium">Evidence / Screenshots</span>
                  <button
                    type="button"
                    disabled={isUploadingAttachment}
                    onClick={() => reportFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingAttachment ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>Attach photo</span>
                      </>
                    )}
                  </button>
                </div>

                {reportAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {reportAttachments.map((url, idx) => (
                      <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-velum-600 bg-velum-900 group">
                        <img src={resolveMediaUrl(url)} alt="evidence" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setReportAttachments(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-alert-error transition"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={resetReportModal}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-text-secondary hover:text-white hover:bg-white-5 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const reasonString = reportDetails.trim() ? `${selectedReportReason}: ${reportDetails.trim()}` : selectedReportReason;
                    const atts = [...reportAttachments];
                    resetReportModal();
                    if (onReport) onReport(reasonString, atts);
                    triggerFeedback('Report submitted. Thank you.');
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-alert-error text-white hover:bg-alert-error/80 active:scale-95 transition cursor-pointer"
                >
                  Submit Report
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clear Chat Confirmation Modal */}
        {showClearModal && (
          <div 
            className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setShowClearModal(false)}
          >
            <div 
              className="w-full max-w-sm bg-velum-850 border border-velum-600 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150 text-text-primary space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white">Clear chat?</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                This will delete all messages in this conversation from your device cache.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-text-secondary hover:text-white hover:bg-white-5 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowClearModal(false);
                    if (onDeleteChat) onDeleteChat();
                    onClose();
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-alert-error text-white hover:bg-alert-error/80 active:scale-95 transition cursor-pointer"
                >
                  Clear Chat
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
