import React, { useEffect, useRef, useState } from 'react';
import { Flag, Smile, Reply, Pin, Forward, Pencil, Trash2, Check, Copy, ShieldCheck, Download, Maximize2, Pause, X } from 'lucide-react';
import { Message, stripAt } from '../../types';
import { AudioMessagePlayer } from '../AudioMessagePlayer';
import { SecureImageCard } from '../SecureImageCard';
import { MessageStatusTicks } from '../MessageStatusTicks';
import { parseAttachment, getCleanPreview, stripAttachmentTokens } from '../../utils/messageParser';
import { getSessionId } from '../../utils/auth';
import { safeFormatTimeOnly, formatMessageTimestamp } from '../../utils/time';
import { LinkPreviewCard } from './LinkPreviewCard';
import { ReactionPicker } from './ReactionPicker';
import { resolveMediaUrl, getFormattedDownloadFilename } from '../../utils/mediaPipeline';

function formatVideoClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function VideoCard({
  src,
  caption,
}: {
  src: string;
  caption?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showChrome, setShowChrome] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hideChromeTimerRef = useRef<number | null>(null);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = getFormattedDownloadFilename(src, 'mp4');
    link.click();
  };

  const clearHideChromeTimer = () => {
    if (hideChromeTimerRef.current !== null) {
      window.clearTimeout(hideChromeTimerRef.current);
      hideChromeTimerRef.current = null;
    }
  };

  const bumpChrome = () => {
    setShowChrome(true);
    clearHideChromeTimer();
    hideChromeTimerRef.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowChrome(false);
      }
    }, 2500);
  };

  useEffect(() => {
    if (!isExpanded) {
      clearHideChromeTimer();
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setShowChrome(true);
      return;
    }
    bumpChrome();
    const el = videoRef.current;
    if (!el) return;
    const playPromise = el.play();
    if (playPromise !== undefined) {
      playPromise.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
    return () => clearHideChromeTimer();
  }, [isExpanded]);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    bumpChrome();
    if (el.paused) {
      el.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      el.pause();
      setIsPlaying(false);
      setShowChrome(true);
      clearHideChromeTimer();
    }
  };

  const seekTo = (ratio: number) => {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
    el.currentTime = Math.max(0, Math.min(el.duration, ratio * el.duration));
    setCurrentTime(el.currentTime);
    bumpChrome();
  };

  return (
    <>
      <div
        className="relative rounded-2xl overflow-hidden shadow-md bg-black w-full max-w-[320px] max-h-[420px] border border-white-5 group cursor-pointer"
        onClick={() => setIsExpanded(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(true);
          }
        }}
        aria-label="Open video"
      >
        <video
          src={src}
          playsInline
          preload="metadata"
          muted
          className="w-full max-h-[420px] object-contain rounded-2xl bg-black block pointer-events-none"
        />

        <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/35 transition-colors">
          <div className="w-14 h-14 rounded-full bg-black/55 border border-white/20 flex items-center justify-center backdrop-blur-[var(--blur-backdrop-sm)]">
            <svg className="w-7 h-7 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>

        <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className="p-1.5 bg-black/60 hover:bg-black/85 rounded-lg text-white transition backdrop-blur-[var(--blur-backdrop-sm)] cursor-pointer border-0"
            title="Download"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
            }}
            className="p-1.5 bg-black/60 hover:bg-black/85 rounded-lg text-white transition backdrop-blur-[var(--blur-backdrop-sm)] cursor-pointer border-0"
            title="Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {caption && (
        <p className="px-2 py-1 text-xs text-text-primary whitespace-pre-wrap break-words">
          {caption}
        </p>
      )}

      {isExpanded && (
        <div
          className="fixed inset-0 z-[999] flex flex-col bg-black select-none"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className={`absolute top-0 inset-x-0 z-20 flex items-center justify-end gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity ${
              showChrome ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleDownload}
              className="p-2.5 bg-white/10 border border-white/15 rounded-full text-white hover:bg-white/15 transition cursor-pointer"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="p-2.5 bg-white/10 border border-white/15 rounded-full text-white hover:bg-white/15 transition cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            className="relative flex-1 min-h-0 flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
          >
            <video
              ref={videoRef}
              src={src}
              playsInline
              preload="auto"
              className="w-full h-full max-w-full max-h-full object-contain"
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              onPlay={() => {
                setIsPlaying(true);
                bumpChrome();
              }}
              onPause={() => {
                setIsPlaying(false);
                setShowChrome(true);
                clearHideChromeTimer();
              }}
              onEnded={() => {
                setIsPlaying(false);
                setShowChrome(true);
                clearHideChromeTimer();
              }}
            />

            {showChrome && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-black/45 border border-white/20 flex items-center justify-center">
                  {isPlaying ? (
                    <Pause className="w-7 h-7 text-white fill-current" />
                  ) : (
                    <svg className="w-8 h-8 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )}
                </div>
              </div>
            )}
          </div>

          <div
            className={`absolute bottom-0 inset-x-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 bg-gradient-to-t from-black/85 to-transparent transition-opacity ${
              showChrome ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[12px] text-white/90 font-mono tabular-nums mb-2">
              {formatVideoClock(currentTime)} / {formatVideoClock(duration)}
            </div>
            <input
              type="range"
              min={0}
              max={1000}
              value={duration > 0 ? Math.round((currentTime / duration) * 1000) : 0}
              onChange={(e) => seekTo(Number(e.target.value) / 1000)}
              className="w-full h-1.5 appearance-none bg-white/25 rounded-full cursor-pointer accent-accent"
              aria-label="Seek"
            />
          </div>
        </div>
      )}
    </>
  );
}

const SYSTEM_ROLES: Record<number, { name: string; style: string }> = {
  1: { name: 'MIDNIGHT (executive)', style: 'bg-velum-700 border border-velum-600 text-text-primary rounded-2xl rounded-tl-none' },
  2: { name: 'Lexie (Administrator)', style: 'bg-velum-750 border border-velum-600 text-text-primary rounded-2xl rounded-tl-none' },
  999: { name: 'VELUM', style: 'bg-velum-800 border border-velum-600 text-text-primary rounded-2xl rounded-tl-none' },
};

export function getSenderIdentity(msg: Message, fallbackUsername?: string) {
  if (SYSTEM_ROLES[msg.user_id]) {
    return { cleanName: SYSTEM_ROLES[msg.user_id].name, isSpecialTheme: true, customBubbleClass: SYSTEM_ROLES[msg.user_id].style };
  }
  let name = msg.username || (msg as any).sender_name || fallbackUsername || '';
  if (name === 'Client' || name === 'client' || name.toLowerCase() === 'you') {
    name = fallbackUsername || msg.username || '';
  }
  return { cleanName: stripAt(name), isSpecialTheme: false, customBubbleClass: '' };
}

export interface MessageItemProps {
  msg: Message;
  index: number;
  currentUserId: number;
  currentUsername?: string;
  currentUserRole: string;
  roomId: string;
  conversationMessages: Message[];
  decryptedMap: Record<string, string>;
  getDecryptedText: (msg: Message) => string;
  longPressedMsgId: string | null;
  showEmojisForMsg: string | null;
  setShowEmojisForMsg: (id: string | null) => void;
  copiedMessageId: string | null;
  setCopiedMessageId: (id: string | null) => void;
  setReplyingToMessage: (msg: Message) => void;
  setForwardingMessage: (msg: Message) => void;
  handleTouchStart: (msg: Message) => void;
  handleTouchEnd: () => void;
  handleStartEdit: (msg: Message) => void;
  onSendReaction?: (messageId: string, roomId: string, emoji: string) => void;
  onEditMessage?: (messageId: string, roomId: string, content: string) => void;
  onDeleteMessage?: (messageId: string, roomId: string) => void;
  onPinMessage?: (messageId: string, roomId: string, pin: boolean) => void;
  onSendMessage: (content: string, burnSeconds: number | null, isEncrypted: boolean) => void;
  onRetryMessage?: (clientMsgId: string) => void;
  onScrollToMessage: (messageId: string) => void;
  popoverPeer: any;
  setPopoverPeer: React.Dispatch<React.SetStateAction<any>>;
  onBackToDeck?: () => void;
  onRoomKick?: (targetUserId: number) => void;
  onRoomMute?: (targetUserId: number, mute: boolean) => void;
}

export function MessageItem({
  msg,
  index,
  currentUserId,
  currentUsername,
  currentUserRole,
  roomId,
  conversationMessages,
  decryptedMap,
  getDecryptedText,
  longPressedMsgId,
  showEmojisForMsg,
  setShowEmojisForMsg,
  copiedMessageId,
  setCopiedMessageId,
  setReplyingToMessage,
  setForwardingMessage,
  handleTouchStart,
  handleTouchEnd,
  handleStartEdit,
  onSendReaction,
  onEditMessage,
  onDeleteMessage,
  onPinMessage,
  onSendMessage,
  onRetryMessage,
  onScrollToMessage,
  popoverPeer,
  setPopoverPeer,
  onBackToDeck,
  onRoomKick,
  onRoomMute,
}: MessageItemProps) {
  const isMe = Boolean(currentUserId && msg.user_id && String(msg.user_id) === String(currentUserId));
  const isDm = Boolean(roomId && roomId.startsWith('dm_'));
  const { cleanName, isSpecialTheme, customBubbleClass } = getSenderIdentity(msg, isMe ? currentUsername : undefined);
  const isCipher = msg.content?.startsWith('e2ee:') || msg.content?.startsWith('ratchet:v2:') || msg.content?.startsWith('ratchet:v1:') || msg.content?.startsWith('VEL_E2EE[');
  const msgKey = String(msg.id ?? msg.client_msg_id ?? msg.message_id ?? '');
    const decryptedFallback = (getDecryptedText ? getDecryptedText(msg) : '') || (msgKey ? decryptedMap[msgKey] : '');
  const activeContent = (msgKey && decryptedMap[msgKey]) || decryptedFallback || (isCipher ? '···' : (msg.content || ''));
  const isVoiceNote = activeContent.startsWith('[Voice Note') || activeContent.startsWith('[Voice Message');
  const isAttachment = activeContent.includes('[Attachment:');

  const attachments = isAttachment ? parseAttachment(activeContent) : [];
  const firstAttachment = attachments[0];
  const albumCaption = stripAttachmentTokens(activeContent);

  const parsedAttachmentName = firstAttachment?.name || '';
  const parsedAttachmentSize = firstAttachment?.size || '';
  const parsedAttachmentType = firstAttachment?.type || '';
  const parsedAttachmentData = firstAttachment?.data || '';
  const parsedMsgContent = albumCaption || (firstAttachment ? (firstAttachment.caption || '') : activeContent);

  if (!msg.deleted && !activeContent && attachments.length === 0 && !msg.content && !msg.plaintext) {
    return null;
  }

  const isVideo = attachments.length > 0 && attachments.some((att) =>
    att.type?.startsWith('video/') ||
    att.data?.startsWith('data:video/') ||
    /\.(mp4|webm|mov|mkv|ogg|m4v)($|\?)/i.test(att.name) ||
    /\.(mp4|webm|mov|mkv|ogg|m4v)($|\?)/i.test(att.data) ||
    att.name?.startsWith('vid_')
  );

  const isImageCard = !isVideo && attachments.length > 0 && attachments.every((att) => 
    att.type?.startsWith('image/') ||
    att.data?.startsWith('data:image/') ||
    /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(att.name) ||
    /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(att.data) ||
    att.name?.startsWith('img_') ||
    (att.data?.includes('/uploads/media/') && !/\.(webm|ogg|mp3|m4a|wav|mp4|mov|pdf)($|\?)/i.test(att.data))
  );

  return (
    <div
      key={msg.id || msg.client_msg_id || msg.message_id || (msg.created_at ? `${msg.user_id}-${msg.created_at}` : undefined) || `msg-${index}`}
      id={`msg-${msg.id || msg.client_msg_id || msg.message_id}`}
      className={`flex message-bubble-container group relative select-none ${isMe ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
      data-message-id={String(msg.id || msg.client_msg_id || msg.message_id)}
      style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      onTouchStart={() => handleTouchStart(msg)}
      onClick={(e) => {
        // Toggle selection mode on desktop double-click or direct tap
        if (e.detail === 2) {
          handleTouchStart(msg);
        }
      }}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className={`flex flex-col max-w-full ${isMe ? 'items-end' : 'items-start'}`}>
        {/* Content Bubble Card */}
        <div className={
          isVoiceNote || isImageCard || isVideo
            ? "relative select-none"
            : `chat-bubble ${
                isSpecialTheme && customBubbleClass
                  ? customBubbleClass
                  : isMe 
                    ? 'chat-bubble-me' 
                    : 'chat-bubble-peer'
              } ${msg.deleted ? 'italic opacity-60 font-mono text-[10px]' : ''}`
        }>
          {msg.deleted ? (
            'Message deleted'
          ) : (
            <>
              {msg.reply_to && (() => {
                const repliedMsg = conversationMessages.find(
                  m => String(m.id) === String(msg.reply_to) || String(m.client_msg_id) === String(msg.reply_to) || String(m.message_id) === String(msg.reply_to)
                );
                let replyName = '';
                let replyText = '';
                if (repliedMsg) {
                  replyName = getSenderIdentity(repliedMsg).cleanName;
                  const raw = repliedMsg.plaintext || (repliedMsg as any).client_plaintext || getDecryptedText(repliedMsg);
                  replyText = getCleanPreview(raw);
                } else if (msg.reply_preview) {
                  replyName = stripAt(msg.reply_preview.username || '');
                  replyText = getCleanPreview(msg.reply_preview.content);
                }
                return (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      onScrollToMessage(String(msg.reply_to));
                    }}
                    className="bg-black/25 border-l-2 border-accent p-2 rounded-r-xl mb-2 text-[10px] text-text-secondary cursor-pointer hover:bg-black/35 transition max-w-full select-none"
                  >
                    <div className="font-bold text-[8.5px] uppercase tracking-wider text-accent mb-0.5">{replyName}</div>
                    <div className="truncate opacity-85">{replyText}</div>
                  </div>
                );
              })()}
              {isVoiceNote ? (
                <AudioMessagePlayer content={activeContent} isMe={isMe} />
              ) : isVideo ? (
                <div className="flex flex-col gap-1 w-full max-w-[320px]">
                  {attachments.map((att, idx) => (
                    <VideoCard
                      key={idx}
                      src={att.data}
                      caption={att.caption}
                    />
                  ))}
                  {parsedMsgContent && parsedMsgContent !== firstAttachment?.caption && (
                    <p className="px-1 text-[13px] text-white whitespace-pre-wrap">{parsedMsgContent}</p>
                  )}
                  <div className={`flex items-center gap-1 mt-0.5 text-[9.5px] select-none opacity-60 font-sans ${isMe ? 'justify-end ml-auto' : 'justify-start mr-auto'}`}>
                    <span>{safeFormatTimeOnly(msg.timestamp || msg.created_at || (msg as any).createdAt || Date.now())}</span>
                    {isDm && (
                      <MessageStatusTicks
                        status={msg.status}
                        isMe={isMe}
                        onRetry={() => {
                          if (msg.status === 'failed') {
                            const targetId = msg.client_msg_id || msg.nonce || msg.message_id || String(msg.id);
                            if (onRetryMessage) {
                              onRetryMessage(targetId);
                            } else {
                              onSendMessage(activeContent, null, !!(msg.is_encrypted || (msg as any).isEncrypted));
                            }
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
              ) : isImageCard ? (
                attachments.length === 1 ? (
                  <div className="w-full max-w-[280px]">
                    <SecureImageCard
                      src={attachments[0].data}
                      name={attachments[0].name}
                      size={attachments[0].size}
                      caption={attachments[0].caption || parsedMsgContent}
                      isMe={isMe}
                      timestamp={safeFormatTimeOnly(msg.timestamp || msg.created_at || (msg as any).createdAt || Date.now())}
                    >
                      <span>{safeFormatTimeOnly(msg.timestamp || msg.created_at || (msg as any).createdAt || Date.now())}</span>
                      {isDm && (
                        <MessageStatusTicks
                          status={msg.status}
                          isMe={isMe}
                          onRetry={() => {
                            if (msg.status === 'failed') {
                              const targetId = msg.client_msg_id || msg.nonce || msg.message_id || String(msg.id);
                              if (onRetryMessage) {
                                onRetryMessage(targetId);
                              } else {
                                onSendMessage(activeContent, null, !!(msg.is_encrypted || (msg as any).isEncrypted));
                              }
                            }
                          }}
                        />
                      )}
                    </SecureImageCard>
                  </div>
                ) : (
                  <div className="flex flex-col w-full max-w-[300px] rounded-2xl overflow-hidden bg-velum-800/40 border border-white-5 p-1">
                    <div className={`grid gap-1 ${
                      attachments.length === 2 ? 'grid-cols-2' :
                      attachments.length === 3 ? 'grid-cols-2' :
                      attachments.length === 4 ? 'grid-cols-2' :
                      'grid-cols-6'
                    }`}>
                      {attachments.map((att, idx) => {
                        let spanClass = 'col-span-1 aspect-square';
                        if (attachments.length === 3 && idx === 0) {
                          spanClass = 'col-span-2 aspect-[16/9]';
                        } else if (attachments.length === 5) {
                          spanClass = idx < 2 ? 'col-span-3 aspect-square' : 'col-span-2 aspect-square';
                        }

                        const isLast = idx === attachments.length - 1;

                        return (
                          <div key={idx} className={spanClass}>
                            <SecureImageCard
                              src={att.data}
                              name={att.name}
                              size={att.size}
                              containerClass="w-full h-full min-h-0 rounded-xl"
                              isMe={isMe}
                              timestamp={safeFormatTimeOnly(msg.timestamp || msg.created_at || (msg as any).createdAt || Date.now())}
                            >
                              {isLast ? (
                                <>
                                  <span>{safeFormatTimeOnly(msg.timestamp || msg.created_at || (msg as any).createdAt || Date.now())}</span>
                                  {isDm && (
                                    <MessageStatusTicks
                                      status={msg.status}
                                      isMe={isMe}
                                      onRetry={() => {
                                        if (msg.status === 'failed') {
                                          const targetId = msg.client_msg_id || msg.nonce || msg.message_id || String(msg.id);
                                          if (onRetryMessage) {
                                            onRetryMessage(targetId);
                                          } else {
                                            onSendMessage(activeContent, null, !!(msg.is_encrypted || (msg as any).isEncrypted));
                                          }
                                        }
                                      }}
                                    />
                                  )}
                                </>
                              ) : null}
                            </SecureImageCard>
                          </div>
                        );
                      })}
                    </div>
                    {parsedMsgContent && (
                      <div className="px-2.5 py-2 text-[13px] text-white whitespace-pre-wrap break-words">
                        {parsedMsgContent}
                      </div>
                    )}
                  </div>
                )
              ) : (
                <>
                  {/* Attachment Badge capsule if present */}
                  {isAttachment && (() => {
                    const isInternalSlug = parsedAttachmentName.startsWith('img_') ||
                      parsedAttachmentName.startsWith('aud_') ||
                      parsedAttachmentName.startsWith('vid_') ||
                      parsedAttachmentName.startsWith('doc_') ||
                      parsedAttachmentName.startsWith('upload_') ||
                      /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(parsedAttachmentName);
                    const cleanAttachmentLabel = isInternalSlug ? 'Document' : parsedAttachmentName;
                    const downloadFilename = getFormattedDownloadFilename(parsedAttachmentData || parsedAttachmentName, 'bin');

                    return (
                      <div className="mb-2.5">
                        {parsedAttachmentData ? (
                          <div
                            className="flex items-center gap-3 p-3 bg-velum-900/40 border border-white-5 rounded-xl mb-2.5 select-none text-left cursor-pointer hover:bg-velum-900/60 transition"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = parsedAttachmentData;
                              link.download = downloadFilename;
                              link.click();
                            }}
                          >
                            <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <line x1="10" y1="9" x2="8" y2="9" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[11px] font-bold text-white block truncate">{cleanAttachmentLabel}</span>
                              <span className="text-[8.5px] font-mono text-text-secondary block uppercase">Download file</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 p-3 bg-velum-900/40 border border-white-5 rounded-xl mb-2.5 select-none text-left">
                            <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <line x1="10" y1="9" x2="8" y2="9" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[11px] font-bold text-white block truncate">{cleanAttachmentLabel}</span>
                              <span className="text-[8.5px] font-mono text-text-secondary block uppercase">Document</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {parsedMsgContent && (
                    <div>
                      <p className="whitespace-pre-wrap message-content-wrap selectable-text">
                        {parsedMsgContent}
                        {msg.is_edited && (
                          <span className="text-[10px] opacity-45 ml-1.5 select-none font-sans lowercase" title={msg.edited_at ? `Edited at ${safeFormatTimeOnly(msg.edited_at)}` : 'Edited'}>
                            (edited)
                          </span>
                        )}
                      </p>
                      {(() => {
                        const urlRegex = /(https?:\/\/[^\s]+)/g;
                        const matchedUrls = parsedMsgContent.match(urlRegex) || [];
                        if (matchedUrls.length > 0) {
                          return (
                            <div className="flex flex-col gap-2 mt-1">
                              {matchedUrls.map((url, uIdx) => (
                                <LinkPreviewCard key={uIdx} url={url} />
                              ))}
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {(() => {
                        const keyMatch = parsedMsgContent.match(/`([a-f0-9A-F\-_\:]{12,})`/);
                        const keyString = keyMatch ? keyMatch[1] : null;
                        if (keyString) {
                          const isCopied = copiedMessageId === msg.message_id;
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(keyString);
                                setCopiedMessageId(msg.message_id);
                                setTimeout(() => setCopiedMessageId(null), 2000);
                              }}
                              className="mt-3.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-status-online-bg text-[10px] font-sans font-bold text-status-online hover:bg-status-online-bg hover:text-text-primary transition cursor-pointer uppercase tracking-wider"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3 h-3 text-alert-success" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-alert-success font-bold" />
                                  <span>Copy Recovery Key</span>
                                </>
                              )}
                            </button>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Timestamp and Read Receipts inside bubble (hidden for image/video cards to prevent duplicate overlay time) */}
          {!isImageCard && !isVideo && (
            <div className={`flex items-center gap-1 mt-1 -mb-0.5 text-[9.5px] select-none opacity-60 font-sans ${isMe ? 'justify-end ml-auto' : 'justify-start mr-auto'}`}>
              <span>{safeFormatTimeOnly(msg.timestamp || msg.created_at || (msg as any).createdAt || Date.now())}</span>
              {isDm && (
                <MessageStatusTicks 
                  status={msg.status} 
                  isMe={isMe} 
                  onRetry={() => {
                    if (msg.status === 'failed') {
                      const targetId = msg.client_msg_id || msg.nonce || msg.message_id || String(msg.id);
                      if (onRetryMessage) {
                        onRetryMessage(targetId);
                      } else {
                        onSendMessage(activeContent, null, !!(msg.is_encrypted || (msg as any).isEncrypted));
                      }
                    }
                  }}
                />
              )}
            </div>
          )}

          {/* Render Reactions */}
          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2.5">
              {Object.entries(msg.reactions).map(([emoji, users]) => (
                users.length > 0 && (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onSendReaction?.(String(msg.id || msg.message_id), msg.room_id || roomId, emoji)}
                    className="bg-text-primary/5 border border-white-5 hover:bg-text-primary/10 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-mono transition cursor-pointer"
                    title={users.join(', ')}
                  >
                    <span className="emoji-font">{emoji}</span>
                    <span className="text-[8px] opacity-70">{users.length}</span>
                  </button>
                )
              ))}
            </div>
          )}



          {/* Animated Emoji Reaction Drawer overlays */}
          {showEmojisForMsg === String(msg.id || msg.message_id) && (
            <ReactionPicker
              isMe={isMe}
              onSelectReaction={(reaction) => {
                if (onSendReaction) onSendReaction(String(msg.id || msg.message_id), msg.room_id || roomId, reaction);
                setShowEmojisForMsg(null);
              }}
            />
          )}
        </div>

        {/* Message Meta (Below Bubble - Pins & Admin actions) */}
        {(msg.is_pinned || (!isMe && (currentUserRole === 'LOGIN_ADMIN' || currentUserRole === 'SUPPORT_ADMIN'))) && (
          <div className={`flex items-center gap-1 mt-0.5 mb-1 text-[10px] font-medium text-text-secondary ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
            {msg.is_pinned && (
              <span title="Pinned message" className="flex items-center">
                <Pin className="w-2.5 h-2.5 text-accent shrink-0" />
              </span>
            )}

            {!isMe && (currentUserRole === 'LOGIN_ADMIN' || currentUserRole === 'SUPPORT_ADMIN') && (
              <div className="hidden group-hover:flex items-center gap-1 ml-2">
                <button
                  type="button"
                  onClick={() => onRoomMute?.(msg.user_id, true)}
                  className="text-alert-error hover:text-alert-error px-1 hover:underline text-[9px] cursor-pointer"
                >
                  Mute
                </button>
                <button
                  type="button"
                  onClick={() => onRoomKick?.(msg.user_id)}
                  className="text-alert-error hover:text-alert-error px-1 hover:underline text-[9px] cursor-pointer"
                >
                  Kick
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
