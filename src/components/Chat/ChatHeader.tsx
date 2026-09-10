import React, { useState } from 'react';
import {
  ChevronLeft, X, Reply, Copy, Forward, Pin, Pencil, MoreVertical, Trash2, ShieldAlert,
} from 'lucide-react';
import { Message } from '../../types';
import { formatLastSeen } from '../../utils/datetime';
import { resolveMediaUrl } from '../../utils/mediaPipeline';
import { stripAttachmentTokens } from '../../utils/messageParser';
import { resolveContactName } from '../../utils/contactName';

interface ChatHeaderProps {
  wsConnected: boolean;
  isMobile?: boolean;
  onBackToDeck?: () => void;
  activeChatPeer: any | null;
  chatTitle: string;
  peerPresence: string;
  conversationMessages: Message[];
  onViewProfile?: () => void;
  currentUserId?: number;
  avatarUrl?: string;
  selectedMessage?: Message | null;
  getDecryptedText?: (msg: Message) => string;
  onClearSelection?: () => void;
  onReplySelected?: (msg: Message) => void;
  onCopySelected?: (msg: Message) => void;
  onForwardSelected?: (msg: Message) => void;
  onPinSelected?: (msg: Message) => void;
  onEditSelected?: (msg: Message) => void;
  onDeleteSelected?: (msg: Message) => void;
  onReportSelected?: (msg: Message) => void;
  onSearch?: () => void;
}

function isVelumBotMessage(msg: Message): boolean {
  return Number(msg.user_id) === 999;
}

function isMediaOnlyMessage(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  if (t.startsWith('[Voice Note')) return true;
  if (t.includes('[Attachment:')) {
    return !stripAttachmentTokens(t).trim();
  }
  return false;
}

export function ChatHeader({
  wsConnected,
  onBackToDeck,
  activeChatPeer,
  chatTitle,
  peerPresence,
  onViewProfile,
  avatarUrl,
  selectedMessage,
  getDecryptedText,
  onClearSelection,
  onReplySelected,
  onCopySelected,
  onForwardSelected,
  onPinSelected,
  onEditSelected,
  onDeleteSelected,
  onReportSelected,
  onSearch,
  currentUserId,
}: ChatHeaderProps) {
  const [avatarErr, setAvatarErr] = React.useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  React.useEffect(() => {
    setAvatarErr(false);
  }, [activeChatPeer?.avatar, avatarUrl]);

  React.useEffect(() => {
    setMoreOpen(false);
  }, [selectedMessage]);

  const headerName = resolveContactName({
    nickname: activeChatPeer?.nickname,
    displayName: activeChatPeer?.displayName,
    username: activeChatPeer?.username,
    fallback: chatTitle || 'Contact',
  });
  const initials = (headerName || '?').slice(0, 2).toUpperCase();
  const headerAvatar = activeChatPeer?.avatar || avatarUrl;

  if (selectedMessage) {
    const isBot = isVelumBotMessage(selectedMessage);
    const isOwn = Boolean(currentUserId && selectedMessage.user_id === currentUserId);
    const canEdit =
      !isBot &&
      isOwn &&
      !selectedMessage.deleted &&
      Date.now() - new Date(selectedMessage.created_at || selectedMessage.timestamp || Date.now()).getTime() <
        15 * 60 * 1000;
    const rawText = getDecryptedText
      ? getDecryptedText(selectedMessage)
      : selectedMessage.content || '';
    const canCopy = !isMediaOnlyMessage(rawText);

    return (
      <div
        data-chat-selection-header="true"
        className="px-3 pt-[calc(env(safe-area-inset-top,0px)+0.875rem)] pb-3 border-b flex items-center justify-between flex-shrink-0 bg-black/40 border-white-5 select-none z-20 relative min-h-[3.75rem]"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClearSelection}
            className="w-11 h-11 rounded-full text-text-secondary hover:text-white hover:bg-white-5 cursor-pointer flex items-center justify-center transition-colors shrink-0"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-accent tabular-nums">1</span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {!isBot && onForwardSelected && (
            <HeaderIconBtn title="Forward" onClick={() => onForwardSelected(selectedMessage)}>
              <Forward className="w-5 h-5" />
            </HeaderIconBtn>
          )}
          {canCopy && onCopySelected && (
            <HeaderIconBtn title="Copy" onClick={() => onCopySelected(selectedMessage)}>
              <Copy className="w-5 h-5" />
            </HeaderIconBtn>
          )}
          {!isBot && onReplySelected && (
            <HeaderIconBtn title="Reply" onClick={() => onReplySelected(selectedMessage)}>
              <Reply className="w-5 h-5" />
            </HeaderIconBtn>
          )}
          {!isBot && onPinSelected && (
            <HeaderIconBtn
              title={selectedMessage.is_pinned ? 'Unpin' : 'Pin'}
              onClick={() => onPinSelected(selectedMessage)}
              active={Boolean(selectedMessage.is_pinned)}
            >
              <Pin className="w-5 h-5" />
            </HeaderIconBtn>
          )}
          {!isBot && canEdit && onEditSelected && (
            <HeaderIconBtn title="Edit" onClick={() => onEditSelected(selectedMessage)}>
              <Pencil className="w-5 h-5" />
            </HeaderIconBtn>
          )}
          {!isBot && isOwn && onDeleteSelected && (
            <HeaderIconBtn title="Delete" onClick={() => onDeleteSelected(selectedMessage)}>
              <Trash2 className="w-5 h-5" />
            </HeaderIconBtn>
          )}
          {!isBot && !isOwn && onReportSelected && (
            <HeaderIconBtn title="Report" onClick={() => onReportSelected(selectedMessage)}>
              <ShieldAlert className="w-5 h-5" />
            </HeaderIconBtn>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-2.5 border-b flex items-center justify-between flex-shrink-0 bg-black/10 border-white-5 select-none z-20 relative min-h-[3.25rem]">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {onBackToDeck && (
          <button
            type="button"
            onClick={onBackToDeck}
            className="w-10 h-10 rounded-full text-text-secondary hover:text-white hover:bg-white-5 cursor-pointer flex items-center justify-center transition-colors shrink-0"
            title="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div
          onClick={onViewProfile}
          className={`flex items-center gap-3 min-w-0 ${onViewProfile ? 'cursor-pointer active:opacity-80 transition' : ''}`}
          title={onViewProfile ? 'View Profile' : undefined}
        >
          {headerAvatar && !avatarErr ? (
            <div className="w-10 h-10 rounded-full bg-velum-800 border border-white-5 flex items-center justify-center font-bold text-accent overflow-hidden shrink-0">
              <img
                src={resolveMediaUrl(headerAvatar)}
                alt=""
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={() => setAvatarErr(true)}
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-velum-800 border border-white-5 flex items-center justify-center font-bold text-accent shrink-0">
              <span className="text-xs font-mono font-bold uppercase text-accent">{initials}</span>
            </div>
          )}

          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-white leading-tight truncate">{headerName || chatTitle}</span>
            {!wsConnected ? (
              <span className="text-[9px] font-mono text-accent animate-pulse leading-none mt-0.5">
                connecting...
              </span>
            ) : activeChatPeer && activeChatPeer.userId !== 999 ? (
              <span className="text-[10px] text-text-secondary leading-none mt-0.5 truncate">
                {formatLastSeen(peerPresence)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative shrink-0">
        <HeaderIconBtn
          title="More"
          compact
          onClick={() => {
            setMoreOpen((v) => !v);
          }}
          active={moreOpen}
        >
          <MoreVertical className="w-5 h-5" />
        </HeaderIconBtn>
        {moreOpen && (
          <div
            data-chat-selection-header="true"
            className="absolute right-0 top-full mt-1 min-w-[8.5rem] border border-velum-600 bg-velum-850 shadow-2xl z-50 overflow-hidden rounded-[var(--radius-sm)] py-1"
          >
            {onSearch && (
              <MoreTextBtn
                label="Search"
                onClick={() => {
                  setMoreOpen(false);
                  onSearch();
                }}
              />
            )}
            {onReportSelected && activeChatPeer && activeChatPeer.userId !== 999 && (
              <MoreTextBtn
                label="Report"
                onClick={() => {
                  setMoreOpen(false);
                  onReportSelected({ user_id: activeChatPeer.userId } as Message);
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HeaderIconBtn({
  children,
  onClick,
  title,
  active,
  compact,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`${compact ? 'w-8 h-8' : 'w-11 h-11'} rounded-full cursor-pointer flex items-center justify-center transition-colors ${
        active ? 'text-accent bg-white-5' : 'text-text-secondary hover:text-accent hover:bg-white-5'
      }`}
    >
      {children}
    </button>
  );
}

function MoreTextBtn({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-3.5 py-2.5 text-left text-[12px] font-medium cursor-pointer transition-colors hover:bg-white-5 ${
        danger ? 'text-alert-error' : 'text-text-primary'
      }`}
    >
      {label}
    </button>
  );
}
