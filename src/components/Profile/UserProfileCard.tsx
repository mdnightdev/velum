import React from 'react';
import {
  Calendar,
  MessageSquare,
  MoreVertical,
  ShieldAlert,
  Ban,
  Eraser,
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  Eye,
  Pencil,
  Users,
  X,
  ChevronRight,
} from 'lucide-react';
import logoSvg from '../../assets/logo.svg?raw';
import { ContactAvatar, isAvatarImageSrc } from '../ContactAvatar';
import { formatLastSeen } from '../../utils/datetime';
import { getSessionId } from '../../utils/auth';
import { ChatMediaItem } from '../../utils/chatMedia';
import { ProfileCardProps } from './types';
import { useChatMedia } from './useChatMedia';
import ChatMediaSection from './ChatMediaSection';
import ProfileActionModals from './ProfileActionModals';
import {
  MUTE_DURATIONS,
  NOTIFICATION_SOUNDS,
  getSelectedNotificationSound,
  playNotificationSound,
  setSelectedNotificationSound,
  type MuteDurationId,
  type NotificationSoundId,
} from '../../constants/notificationSounds';
import { getDmMediaPrefs, setDmMediaPrefs, getPeerDisappearMode, setPeerDisappearMode } from '../../utils/dmPeerPrefs';
import { DISAPPEAR_MODES, type DisappearMode } from '../../utils/disappearModes';

const SYSTEM_IDS = new Set([1, 2, 999]);

export default function UserProfileCard({
  type = 'user',
  user,
  onClose,
  onMessage,
  onMute,
  onBlock,
  onDeleteChat,
  onReport,
  currentUserId,
}: ProfileCardProps) {
  const [isMutedLocal, setIsMutedLocal] = React.useState(!!user?.isMuted);
  const [disappearingMode, setDisappearingMode] = React.useState<DisappearMode>(() =>
    user?.userId ? getPeerDisappearMode(user.userId) : 'Off'
  );
  const [showDisappearPicker, setShowDisappearPicker] = React.useState(false);
  const [showMediaVisibility, setShowMediaVisibility] = React.useState(false);
  const [showNotificationsSheet, setShowNotificationsSheet] = React.useState(false);
  const [muteDuration, setMuteDuration] = React.useState<MuteDurationId | null>(
    user?.isMuted ? '24h' : null
  );
  const [selectedSound, setSelectedSound] = React.useState<NotificationSoundId>(
    getSelectedNotificationSound()
  );
  const [autoDownload, setAutoDownload] = React.useState(() =>
    user?.userId ? getDmMediaPrefs(user.userId).autoDownload : true
  );
  const [saveToDevice, setSaveToDevice] = React.useState(() =>
    user?.userId ? getDmMediaPrefs(user.userId).saveToDevice : true
  );
  const [showNicknameModal, setShowNicknameModal] = React.useState(false);
  const [nicknameDraft, setNicknameDraft] = React.useState('');
  const [localNickname, setLocalNickname] = React.useState(user?.nickname || '');
  const [showAddToLounge, setShowAddToLounge] = React.useState(false);
  const [activityStatus, setActivityStatus] = React.useState<string | null>(null);

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

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [headerCollapsed, setHeaderCollapsed] = React.useState(false);

  const { chatMedia, mediaLoading } = useChatMedia(user?.userId, currentUserId);

  React.useEffect(() => {
    setIsMutedLocal(!!user?.isMuted);
    const d = user?.muteDuration;
    if (user?.isMuted && d && d !== 'off') setMuteDuration(d as MuteDurationId);
    else if (!user?.isMuted) setMuteDuration(null);
  }, [user?.isMuted, user?.userId, user?.muteDuration]);

  React.useEffect(() => {
    if (!user?.userId) return;
    const local = getDmMediaPrefs(user.userId);
    setAutoDownload(local.autoDownload);
    setSaveToDevice(local.saveToDevice);
    let cancelled = false;
    const sessionId = getSessionId();
    fetch(`/v2/user/${user.userId}/media-prefs`, {
      headers: { Authorization: `Bearer ${sessionId}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const next = setDmMediaPrefs(user.userId, {
          autoDownload: data.autoDownload !== false,
          saveToDevice: data.saveToDevice !== false,
        });
        setAutoDownload(next.autoDownload);
        setSaveToDevice(next.saveToDevice);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.userId]);

  const persistMediaPrefs = React.useCallback(
    (patch: { autoDownload?: boolean; saveToDevice?: boolean }) => {
      if (!user?.userId) return;
      const next = setDmMediaPrefs(user.userId, patch);
      setAutoDownload(next.autoDownload);
      setSaveToDevice(next.saveToDevice);
      const sessionId = getSessionId();
      void fetch(`/v2/user/${user.userId}/media-prefs`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${sessionId}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(next),
      }).catch(() => {});
    },
    [user?.userId]
  );

  React.useEffect(() => {
    setLocalNickname(user?.nickname || '');
  }, [user?.userId, user?.nickname]);

  React.useEffect(() => {
    if (user?.userId) {
      setDisappearingMode(getPeerDisappearMode(user.userId));
    } else {
      setDisappearingMode('Off');
    }
  }, [user?.userId]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setHeaderCollapsed(el.scrollTop > 72);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [user?.userId]);

  React.useEffect(() => {
    if (!user?.userId) return;
    if (user.userId === 999) {
      setActivityStatus(null);
      return;
    }

    let cancelled = false;
    const sessionId = getSessionId();
    fetch(`/v2/user/${user.userId}/status`, {
      headers: { Authorization: `Bearer ${sessionId}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setActivityStatus(data.last_seen_at || null);
      })
      .catch(() => {
        if (!cancelled) setActivityStatus(null);
      });

    const handlePresence = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (Number(detail.user_id) === user.userId) {
        setActivityStatus(detail.last_seen_at || null);
      }
    };
    window.addEventListener('velum-presence-change', handlePresence);
    return () => {
      cancelled = true;
      window.removeEventListener('velum-presence-change', handlePresence);
    };
  }, [user?.userId]);

  if (!user || (type !== 'user' && type !== 'admin')) {
    return null;
  }

  const baseName = user.displayName || user.username;
  const displayName = (localNickname.trim() || baseName).trim();
  const isAdminMode = type === 'admin' || user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_OPERATOR';
  const isSystemPeer = SYSTEM_IDS.has(user.userId || 0) || user.username?.toLowerCase() === 'velum';
  const bioText = (user.bio || '').trim();

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
      : formatLastSeen(activityStatus);

  const avatarNode =
    user.userId === 999 && !isAvatarImageSrc(user.avatarUrl) ? (
      <div className="w-full h-full flex items-center justify-center bg-velum-800">
        <div
          className="w-[55%] h-[55%] text-accent [&>svg]:w-full [&>svg]:h-full"
          dangerouslySetInnerHTML={{ __html: logoSvg }}
        />
      </div>
    ) : (
      <ContactAvatar name={displayName} avatar={user.avatarUrl} className="w-full h-full rounded-full border-0" />
    );

  return (
    <div className="fixed inset-0 z-[999999] bg-[#0D1117] flex flex-col text-white animate-in fade-in slide-in-from-right duration-200 font-sans select-none">
      {actionFeedback && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000000] px-4 py-2 bg-velum-800 border border-accent/40 rounded-full shadow-2xl text-xs font-medium text-white flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
          <Check className="w-4 h-4 text-accent" />
          <span>{actionFeedback}</span>
        </div>
      )}

      <div className="sticky top-0 z-30 flex items-center gap-2 px-3 pt-[calc(env(safe-area-inset-top,0px)+0.625rem)] pb-3 bg-[#0D1117]/border-b border-white-5 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center text-text-secondary hover:text-white hover:bg-white-5 active:bg-white-10 transition cursor-pointer shrink-0"
          title="Back"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div
          className={`flex items-center gap-2.5 min-w-0 flex-1 transition-all duration-200 ${
            headerCollapsed ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'
          }`}
          aria-hidden={!headerCollapsed}
        >
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-velum-600">{avatarNode}</div>
          <span className="text-sm font-semibold text-white truncate">{displayName}</span>
        </div>

        <button
          type="button"
          className="w-10 h-10 rounded-full flex items-center justify-center text-text-secondary hover:text-white hover:bg-white-5 active:bg-white-10 transition cursor-pointer shrink-0"
          title="Options"
          aria-label="Options"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="px-4 sm:px-6 pb-16 flex flex-col max-w-xl mx-auto w-full space-y-6">
          <div className="flex flex-col items-center pt-2 text-center">
            <div
              className={`rounded-full overflow-hidden bg-velum-800 border-4 border-velum-800 shadow-2xl flex items-center justify-center relative transition-all duration-200 ease-out ${
                headerCollapsed
                  ? 'w-10 h-10 opacity-0 scale-75 mb-0 pointer-events-none'
                  : 'w-28 h-28 sm:w-32 sm:h-32 opacity-100 scale-100 mb-4'
              }`}
            >
              {avatarNode}
            </div>

            <h1
              className={`font-bold text-white mb-1 flex items-center justify-center gap-2 transition-opacity duration-200 ${
                headerCollapsed ? 'opacity-0 h-0 mb-0 overflow-hidden' : 'opacity-100 text-xl sm:text-2xl'
              }`}
            >
              {displayName}
              {isAdminMode && (
                <span className="px-1.5 py-0.5 bg-accent/15 text-accent text-[9px] font-mono font-bold uppercase rounded-md">
                  Staff
                </span>
              )}
            </h1>

            {bioText ? (
              <p className="text-xs sm:text-sm text-text-primary max-w-md mx-auto mb-2 px-4 leading-relaxed">{bioText}</p>
            ) : null}

            <p className="text-xs text-text-secondary">{statusText}</p>

            <div className="flex items-center justify-center gap-3 mt-5 w-full max-w-xs">
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
              {onMute && (
                <button
                  type="button"
                  onClick={() => setShowNotificationsSheet(true)}
                  className="flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-velum-800 border border-white-5 hover:bg-velum-750 active:scale-95 transition cursor-pointer group"
                >
                  {isMutedLocal ? (
                    <BellOff className="w-5 h-5 text-text-secondary" />
                  ) : (
                    <Bell className="w-5 h-5 text-accent group-hover:scale-110 transition-transform" />
                  )}
                  <span className="text-[11px] font-medium text-text-primary">
                    {isMutedLocal ? 'Muted' : 'Mute'}
                  </span>
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
            <button
              type="button"
              onClick={() => setShowDisappearPicker(true)}
              className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-white-5 transition bg-transparent border-0 text-left"
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-text-secondary" />
                <div className="flex flex-col text-left">
                  <span className="text-sm font-medium text-text-primary">Disappearing messages</span>
                  <span className="text-xs text-text-secondary">{disappearingMode}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-disabled" />
            </button>

            <button
              type="button"
              onClick={() => setShowNotificationsSheet(true)}
              className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-white-5 transition bg-transparent border-0 text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                {isMutedLocal ? (
                  <BellOff className="w-5 h-5 text-text-secondary shrink-0" />
                ) : (
                  <Bell className="w-5 h-5 text-text-secondary shrink-0" />
                )}
                <div className="flex flex-col text-left">
                  <span className="text-sm font-medium text-text-primary">Notifications</span>
                  <span className="text-xs text-text-secondary">
                    {isMutedLocal
                      ? `Muted${muteDuration && muteDuration !== 'off' ? ` · ${MUTE_DURATIONS.find((d) => d.id === muteDuration)?.label || ''}` : ''}`
                      : NOTIFICATION_SOUNDS.find((s) => s.id === selectedSound)?.label || 'Attention'}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-disabled" />
            </button>

            <button
              type="button"
              onClick={() => setShowMediaVisibility(true)}
              className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-white-5 transition bg-transparent border-0 text-left"
            >
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-text-secondary" />
                <div className="flex flex-col text-left">
                  <span className="text-sm font-medium text-text-primary">Media visibility</span>
                  <span className="text-xs text-text-secondary">
                    {autoDownload && saveToDevice ? 'Auto' : 'Manual'}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-disabled" />
            </button>

            {!isSystemPeer && (
              <button
                type="button"
                onClick={() => {
                  setNicknameDraft(localNickname);
                  setShowNicknameModal(true);
                }}
                className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-white-5 transition bg-transparent border-0 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Pencil className="w-5 h-5 text-text-secondary shrink-0" />
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-sm font-medium text-text-primary">Nickname</span>
                    <span className="text-xs text-text-secondary truncate">
                      {localNickname.trim() || 'Not set'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-text-disabled shrink-0" />
              </button>
            )}

            {!isSystemPeer && (
              <button
                type="button"
                onClick={() => setShowAddToLounge(true)}
                className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-white-5 transition bg-transparent border-0 text-left"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-text-secondary" />
                  <span className="text-sm font-medium text-text-primary">Add to lounge</span>
                </div>
                <ChevronRight className="w-4 h-4 text-text-disabled" />
              </button>
            )}
          </div>

          <div className="rounded-2xl bg-velum-850 border border-velum-600/50 divide-y divide-white-5 shadow-lg overflow-hidden">
            {onDeleteChat && (
              <button
                type="button"
                onClick={() => setShowClearModal(true)}
                className="w-full flex items-center gap-3.5 p-4 text-left hover:bg-white-5 transition cursor-pointer text-text-primary"
              >
                <Eraser className="w-5 h-5 text-text-secondary" />
                <span className="text-sm font-medium">Clear chat</span>
              </button>
            )}

            {onBlock && !isSystemPeer && (
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
                <span className="text-sm font-medium">
                  {user.isBlocked ? `Unblock ${displayName}` : `Block ${displayName}`}
                </span>
              </button>
            )}

            {onReport && !isSystemPeer && (
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
      </div>

      {showDisappearPicker && (
        <div
          className="fixed inset-0 z-[1000000] flex items-end sm:items-center justify-center bg-black/70 p-4"
          onClick={() => setShowDisappearPicker(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-velum-850 border border-velum-600 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-white-5 text-sm font-semibold text-white">
              Disappearing messages
            </div>
            {DISAPPEAR_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                className={`w-full flex items-center justify-between px-4 py-3.5 text-sm text-left hover:bg-white-5 cursor-pointer ${
                  disappearingMode === mode ? 'text-accent' : 'text-text-primary'
                }`}
                onClick={() => {
                  setDisappearingMode(mode);
                  if (user?.userId) setPeerDisappearMode(user.userId, mode);
                  setShowDisappearPicker(false);
                  triggerFeedback(`Disappearing messages: ${mode}`);
                }}
              >
                <span>{mode}</span>
                {disappearingMode === mode && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {showNotificationsSheet && (
        <div
          className="fixed inset-0 z-[1000000] flex items-end sm:items-center justify-center bg-black/70 p-4"
          onClick={() => setShowNotificationsSheet(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-velum-850 border border-velum-600 overflow-hidden shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-white-5 flex items-center justify-between sticky top-0 bg-velum-850">
              <h3 className="text-sm font-semibold text-white">Notifications</h3>
              <button
                type="button"
                onClick={() => setShowNotificationsSheet(false)}
                className="p-1 text-text-secondary cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
              Mute
            </div>
            {MUTE_DURATIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-white-5 cursor-pointer ${
                  (d.id === 'off' && !isMutedLocal) || (isMutedLocal && muteDuration === d.id)
                    ? 'text-accent'
                    : 'text-text-primary'
                }`}
                onClick={() => {
                  if (!onMute) return;
                  onMute(d.id);
                  if (d.id === 'off') {
                    setIsMutedLocal(false);
                    setMuteDuration(null);
                    triggerFeedback('Notifications on');
                  } else {
                    setIsMutedLocal(true);
                    setMuteDuration(d.id);
                    triggerFeedback(`Muted for ${d.label}`);
                  }
                  setShowNotificationsSheet(false);
                }}
              >
                <span>{d.label}</span>
                {((d.id === 'off' && !isMutedLocal) || (isMutedLocal && muteDuration === d.id)) && (
                  <Check className="w-4 h-4" />
                )}
              </button>
            ))}

            <div className="px-4 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary border-t border-white-5">
              Sound
            </div>
            {NOTIFICATION_SOUNDS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-white-5 cursor-pointer ${
                  selectedSound === s.id ? 'text-accent' : 'text-text-primary'
                }`}
                onClick={() => {
                  setSelectedSound(s.id);
                  setSelectedNotificationSound(s.id);
                  playNotificationSound(s.id, true);
                  triggerFeedback(`Sound: ${s.label}`);
                }}
              >
                <span>{s.label}</span>
                {selectedSound === s.id && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {showMediaVisibility && (
        <div
          className="fixed inset-0 z-[1000000] flex items-end sm:items-center justify-center bg-black/70 p-4"
          onClick={() => setShowMediaVisibility(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-velum-850 border border-velum-600 overflow-hidden shadow-2xl p-4 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Media visibility</h3>
              <button
                type="button"
                onClick={() => setShowMediaVisibility(false)}
                className="p-1 text-text-secondary cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-text-primary">Auto download</span>
              <button
                type="button"
                role="switch"
                aria-checked={autoDownload}
                onClick={() => persistMediaPrefs({ autoDownload: !autoDownload })}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  autoDownload ? 'bg-accent justify-end' : 'bg-velum-700 justify-start'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow-md" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-text-primary">Save to device automatically</span>
              <button
                type="button"
                role="switch"
                aria-checked={saveToDevice}
                onClick={() => persistMediaPrefs({ saveToDevice: !saveToDevice })}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  saveToDevice ? 'bg-accent justify-end' : 'bg-velum-700 justify-start'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow-md" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showNicknameModal && (
        <div
          className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowNicknameModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-velum-850 border border-velum-600 p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-white">Nickname</h3>
            <input
              type="text"
              value={nicknameDraft}
              onChange={(e) => setNicknameDraft(e.target.value.slice(0, 48))}
              placeholder={baseName}
              className="w-full glass-input text-sm"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 text-xs text-text-secondary hover:text-white cursor-pointer"
                onClick={() => {
                  setLocalNickname('');
                  setShowNicknameModal(false);
                  triggerFeedback('Nickname cleared');
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-accent text-velum-900 cursor-pointer"
                onClick={() => {
                  setLocalNickname(nicknameDraft.trim());
                  setShowNicknameModal(false);
                  triggerFeedback(nicknameDraft.trim() ? 'Nickname saved' : 'Nickname cleared');
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddToLounge && (
        <div
          className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowAddToLounge(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-velum-850 border border-velum-600 p-5 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-white">Add to lounge</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Lounges you own or moderate will show here. Lounge permissions land in a later pass.
            </p>
            <button
              type="button"
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-velum-750 text-text-primary cursor-pointer"
              onClick={() => setShowAddToLounge(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

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
