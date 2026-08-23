import React from 'react';
import { Flag, Smile, Reply, Pin, Forward, Pencil, Trash2, Check, Copy, ShieldCheck } from 'lucide-react';
import { Message, stripAt } from '../../types';
import ProfileCard from '../ProfileCard';
import { AudioMessagePlayer } from '../AudioMessagePlayer';
import { SecureImageCard } from '../SecureImageCard';
import { MessageStatusTicks } from '../MessageStatusTicks';
import { parseAttachment } from '../../utils/messageParser';
import { getSessionId } from '../../utils/auth';
import { safeFormatTimeOnly, formatMessageTimestamp } from '../../utils/time';
import { LinkPreviewCard } from './LinkPreviewCard';
import { ReactionPicker } from './ReactionPicker';
import { resolveMediaUrl } from '../../utils/mediaPipeline';

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
  const { cleanName, isSpecialTheme, customBubbleClass } = getSenderIdentity(msg, isMe ? currentUsername : undefined);
  const isCipher = msg.content?.startsWith('e2ee:v1:') || msg.content?.startsWith('ratchet:v2:') || msg.content?.startsWith('ratchet:v1:') || msg.content?.startsWith('VEL_E2EE[');
  const msgKey = String(msg.message_id || msg.id || msg.client_msg_id || msg.nonce || '');
    const decryptedFallback = (getDecryptedText ? getDecryptedText(msg) : '') || (msgKey ? decryptedMap[msgKey] : '');
  const activeContent = msg.plaintext || (msg as any).client_plaintext || decryptedFallback || (isCipher ? '...' : (msg.content || ''));

  const isVoiceNote = !msg.deleted && activeContent && activeContent.startsWith('[Voice Note');
  const isAttachment = !msg.deleted && activeContent && activeContent.includes('[Attachment:');

  const attachments = isAttachment ? parseAttachment(activeContent) : [];
  const firstAttachment = attachments[0];

  const parsedAttachmentName = firstAttachment?.name || '';
  const parsedAttachmentSize = firstAttachment?.size || '';
  const parsedAttachmentType = firstAttachment?.type || '';
  const parsedAttachmentData = firstAttachment?.data || '';
  const parsedMsgContent = firstAttachment ? (firstAttachment.caption || '') : activeContent;

  if (!msg.deleted && !activeContent && attachments.length === 0 && !msg.content) {
    return null;
  }

  const isVideo = attachments.length > 0 && attachments.some((att) =>
    att.type.startsWith('video/') ||
    att.data.startsWith('data:video/') ||
    /\.(mp4|webm|mov|mkv|ogg|m4v)($|\?)/i.test(att.name) ||
    /\.(mp4|webm|mov|mkv|ogg|m4v)($|\?)/i.test(att.data)
  );

  const isImageCard = !isVideo && attachments.length > 0 && attachments.every((att) => 
    att.type.startsWith('image/') ||
    att.data.startsWith('data:image/') ||
    /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(att.name) ||
    /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(att.data)
  );

  return (
    <div
      key={msg.message_id || msg.id || msg.nonce || (msg.created_at ? `${msg.user_id}-${msg.created_at}` : undefined) || `msg-${index}`}
      id={`msg-${msg.message_id}`}
      className={`flex message-bubble-container group relative select-none ${isMe ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
      data-message-id={msg.message_id}
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
                  m => String(m.db_message_id) === String(msg.reply_to) || String(m.message_id) === String(msg.reply_to)
                );
                let replyName = '';
                let replyText = '';
                if (repliedMsg) {
                  replyName = getSenderIdentity(repliedMsg).cleanName;
                  replyText = getDecryptedText(repliedMsg);
                } else if (msg.reply_preview) {
                  replyName = stripAt(msg.reply_preview.username || '');
                  replyText = msg.reply_preview.content;
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
                    <div key={idx} className="relative rounded-2xl overflow-hidden bg-black border border-white-5 shadow-sm min-h-[180px] aspect-video">
                      <video
                        src={att.data}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-contain rounded-2xl bg-black block"
                      />
                      {att.caption && (
                        <p className="px-3 py-1.5 text-[12px] text-white whitespace-pre-wrap">{att.caption}</p>
                      )}
                    </div>
                  ))}
                  {parsedMsgContent && parsedMsgContent !== firstAttachment?.caption && (
                    <p className="px-1 text-[13px] text-white whitespace-pre-wrap">{parsedMsgContent}</p>
                  )}
                  <div className={`flex items-center gap-1 mt-0.5 text-[9.5px] select-none opacity-60 font-sans ${isMe ? 'justify-end ml-auto' : 'justify-start mr-auto'}`}>
                    <span>{safeFormatTimeOnly(msg.timestamp || msg.created_at || (msg as any).createdAt || Date.now())}</span>
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
                  </div>
                </div>
              ) : isImageCard ? (
                <div className={`grid gap-1.5 ${attachments.length > 1 ? 'grid-cols-2 max-w-[280px]' : 'grid-cols-1'}`}>
                  {attachments.map((att, idx) => (
                    <SecureImageCard
                      key={idx}
                      src={att.data}
                      name={att.name}
                      size={att.size}
                      caption={idx === attachments.length - 1 ? (att.caption || parsedMsgContent) : ''}
                      isMe={isMe}
                      timestamp={safeFormatTimeOnly(msg.timestamp || msg.created_at || (msg as any).createdAt || Date.now())}
                    >
                      <span>{safeFormatTimeOnly(msg.timestamp || msg.created_at || (msg as any).createdAt || Date.now())}</span>
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
                    </SecureImageCard>
                  ))}
                </div>
              ) : (
                <>
                  {/* Attachment Badge capsule if present */}
                  {isAttachment && (
                    <div className="mb-2.5">
                      {parsedAttachmentData ? (
                        <div
                          className="flex items-center gap-3 p-3 bg-velum-900/40 border border-white-5 rounded-xl mb-2.5 select-none text-left cursor-pointer hover:bg-velum-900/60 transition"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = parsedAttachmentData;
                            link.download = parsedAttachmentName;
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
                            <span className="text-[11px] font-bold text-white block truncate">{parsedAttachmentName}</span>
                            <span className="text-[8.5px] font-mono text-text-secondary block uppercase">{parsedAttachmentSize} • Click to download</span>
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
                            <span className="text-[11px] font-bold text-white block truncate">{parsedAttachmentName}</span>
                            <span className="text-[8.5px] font-mono text-text-secondary block uppercase">{parsedAttachmentSize} • attachment</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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
                    onClick={() => onSendReaction?.(msg.db_message_id ? String(msg.db_message_id) : msg.message_id, msg.room_id || roomId, emoji)}
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
          {showEmojisForMsg === msg.message_id && (
            <ReactionPicker
              isMe={isMe}
              onSelectReaction={(reaction) => {
                if (onSendReaction) onSendReaction(msg.db_message_id ? String(msg.db_message_id) : msg.message_id, msg.room_id || roomId, reaction);
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
