import React from 'react';
import {
  Calendar, MessageSquare, MoreVertical, Search, ShieldAlert, Ban, Trash2,
  ChevronRight, ArrowLeft, Bell, BellOff, Users, Lock, Check,
} from 'lucide-react';
import logoSvg from '../../assets/logo.svg?raw';
import { resolveMediaUrl } from '../../utils/mediaPipeline';
import { formatLastSeen } from '../../utils/datetime';
import { ChatMediaItem } from '../../utils/chatMedia';
import { ProfileCardProps } from './types';
import { useChatMedia } from './useChatMedia';
import ChatMediaSection from './ChatMediaSection';
import ProfileActionModals from './ProfileActionModals';

export default function UserProfileCard({
  type = 'user',
  user,
  onClose,
  onMessage,
  onMute,
  onBlock,
  onDeleteChat,
  onReport,
  onSearchMessages,
  currentUserId,
}: ProfileCardProps) {
  const [isChatLocked, setIsChatLocked] = React.useState(false);
  const [isFavourite, setIsFavourite] = React.useState(false);
  const [isMutedLocal, setIsMutedLocal] = React.useState(!!user?.isMuted);
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
  const [viewerItem, setViewerItem] = React.useState<ChatMediaItem | null>(null);
  const [galleryOpen, setGalleryOpen] = React.useState(false);

  const { chatMedia, mediaLoading } = useChatMedia(user?.userId, currentUserId);

  React.useEffect(() => {
    setIsMutedLocal(!!user?.isMuted);
  }, [user?.isMuted, user?.userId]);

  if (!user || (type !== 'user' && type !== 'admin')) {
    return null;
  }

  const displayName = user.displayName || user.username;
  const avatarText = displayName.slice(0, 2).toUpperCase();
  const isAdminMode = type === 'admin' || user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_OPERATOR';

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

  const statusText =
    user.userId === 999
      ? 'Official System Bot'
      : formatLastSeen(
          user.status ||
            (user as { lastSeen?: string }).lastSeen ||
            (user as { peerPresence?: string }).peerPresence ||
            (user as { last_seen?: string }).last_seen ||
            null
        );

  return (
    <div className="fixed inset-0 z-[999999] bg-[#0D1117] flex flex-col text-white animate-in fade-in slide-in-from-right duration-200 font-sans overflow-y-auto select-none">
      {actionFeedback && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000000] px-4 py-2 bg-velum-800 border border-accent/40 rounded-full shadow-2xl text-xs font-medium text-white flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
          <Check className="w-4 h-4 text-accent" />
          <span>{actionFeedback}</span>
        </div>
      )}

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

        <ChatMediaSection
          chatMedia={chatMedia}
          mediaLoading={mediaLoading}
          viewerItem={viewerItem}
          setViewerItem={setViewerItem}
          galleryOpen={galleryOpen}
          setGalleryOpen={setGalleryOpen}
        />

        <div className="rounded-2xl bg-velum-850 border border-velum-600/50 divide-y divide-white-5 shadow-lg overflow-hidden">
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

        <div className="rounded-2xl bg-velum-850 border border-velum-600/50 divide-y divide-white-5 shadow-lg overflow-hidden">
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

          {onReport &&
            ![1, 2, 999].includes(user.userId || 0) &&
            user.username?.toLowerCase() !== 'velum' && (
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

      <ProfileActionModals
        displayName={displayName}
        showBlockModal={showBlockModal}
        setShowBlockModal={setShowBlockModal}
        showReportModal={showReportModal}
        showClearModal={showClearModal}
        setShowClearModal={setShowClearModal}
        selectedReportReason={selectedReportReason}
        setSelectedReportReason={setSelectedReportReason}
        reportDetails={reportDetails}
        setReportDetails={setReportDetails}
        reportAttachments={reportAttachments}
        setReportAttachments={setReportAttachments}
        isUploadingAttachment={isUploadingAttachment}
        setIsUploadingAttachment={setIsUploadingAttachment}
        reportFileInputRef={reportFileInputRef}
        resetReportModal={resetReportModal}
        onBlock={onBlock}
        onReport={onReport}
        onDeleteChat={onDeleteChat}
        onClose={onClose}
        triggerFeedback={triggerFeedback}
      />
    </div>
  );
}
