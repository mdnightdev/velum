import React, { useState, useEffect } from 'react';
import { ChevronLeft, Search, X, Reply, Pencil, Forward, Pin, Trash2, ShieldAlert, Copy } from 'lucide-react';
import { Message } from '../../types';
import { formatLastSeen } from '../../utils/datetime';
import { resolveMediaUrl } from '../../utils/mediaPipeline';

interface ChatHeaderProps {
  wsConnected: boolean;
  isMobile?: boolean;
  onBackToDeck?: () => void;
  activeChatPeer: any | null;
  chatTitle: string;
  peerPresence: string;
  conversationMessages: Message[];
  onSearchToggle?: () => void;
  onForceRekey?: () => void;
  onViewProfile?: () => void;
  // Selection Mode Props
  selectedMessage?: Message | null;
  getDecryptedText?: (msg: Message) => string;
  onClearSelection?: () => void;
  onReplySelected?: (msg: Message) => void;
  onCopySelected?: (msg: Message) => void;
  onEditSelected?: (msg: Message) => void;
  onForwardSelected?: (msg: Message) => void;
  onPinSelected?: (msg: Message) => void;
  onDeleteSelected?: (msg: Message) => void;
  onReportSelected?: (msg: Message) => void;
  currentUserId?: number;
  avatarUrl?: string;
}

export function ChatHeader({
  wsConnected,
  isMobile,
  onBackToDeck,
  activeChatPeer,
  chatTitle,
  peerPresence,
  conversationMessages,
  onSearchToggle,
  onForceRekey,
  onViewProfile,
  selectedMessage,
  getDecryptedText,
  onClearSelection,
  onReplySelected,
  onCopySelected,
  onEditSelected,
  onForwardSelected,
  onPinSelected,
  onDeleteSelected,
  onReportSelected,
  currentUserId,
  avatarUrl
}: ChatHeaderProps) {
  const [avatarErr, setAvatarErr] = useState(false);

  useEffect(() => {
    setAvatarErr(false);
  }, [activeChatPeer?.avatar, avatarUrl]);
  const initials = (activeChatPeer?.displayName || activeChatPeer?.username || chatTitle || '?').slice(0, 2).toUpperCase();
  const isOwnSelectedMessage = Boolean(selectedMessage && currentUserId && selectedMessage.user_id === currentUserId);
  const canEdit = Boolean(isOwnSelectedMessage && !selectedMessage?.deleted && (Date.now() - new Date(selectedMessage?.created_at || Date.now()).getTime() < 15 * 60 * 1000));
  const canDelete = Boolean(isOwnSelectedMessage);

  // Render Selection Mode Action Header when a message is selected
  if (selectedMessage) {
    let rawText = getDecryptedText ? getDecryptedText(selectedMessage) : selectedMessage.content;
    if (!rawText || rawText.includes('VEL_E2EE') || rawText.includes('d%/dr/') || rawText.startsWith('m.')) {
      rawText = selectedMessage.content && !selectedMessage.content.includes('VEL_E2EE') ? selectedMessage.content : 'Encrypted Message';
    }
    return (
      <div className="px-3 pt-[calc(env(safe-area-inset-top,0px)+0.25rem)] pb-1.5 border-b flex items-center justify-between flex-shrink-0 bg-black/40 border-white-5 select-none z-20">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={onClearSelection}
            className="w-8 h-8 rounded-full text-text-secondary hover:text-white hover:bg-white-5 cursor-pointer flex items-center justify-center transition-colors shrink-0"
            title="Cancel selection"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">1 selected</span>
            <span className="text-[10px] text-text-secondary truncate max-w-xs sm:max-w-md">
              {rawText}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onReplySelected && (
            <button
              type="button"
              onClick={() => onReplySelected(selectedMessage)}
              className="p-1.5 rounded-full text-text-secondary hover:text-accent hover:bg-white-5 cursor-pointer flex items-center justify-center transition-colors"
              title="Reply to message"
            >
              <Reply className="w-4 h-4" />
            </button>
          )}
          {canEdit && onEditSelected && (
            <button
              type="button"
              onClick={() => onEditSelected(selectedMessage)}
              className="p-1.5 rounded-full text-text-secondary hover:text-accent hover:bg-white-5 cursor-pointer flex items-center justify-center transition-colors"
              title="Edit message"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {onPinSelected && (
            <button
              type="button"
              onClick={() => onPinSelected(selectedMessage)}
              className="p-1.5 rounded-full text-text-secondary hover:text-accent hover:bg-white-5 cursor-pointer flex items-center justify-center transition-colors"
              title={selectedMessage.is_pinned ? "Unpin message" : "Pin message"}
            >
              <Pin className={`w-4 h-4 ${selectedMessage.is_pinned ? 'text-accent fill-accent' : ''}`} />
            </button>
          )}
          {onReportSelected && !isOwnSelectedMessage && (
            <button
              type="button"
              onClick={() => onReportSelected(selectedMessage)}
              className="p-1.5 rounded-full text-text-secondary hover:text-alert-warning hover:bg-white-5 cursor-pointer flex items-center justify-center transition-colors"
              title="Report message"
            >
              <ShieldAlert className="w-4 h-4" />
            </button>
          )}
          {canDelete && onDeleteSelected && (
            <button
              type="button"
              onClick={() => onDeleteSelected(selectedMessage)}
              className="p-1.5 rounded-full text-text-secondary hover:text-alert-error hover:bg-white-5 cursor-pointer flex items-center justify-center transition-colors"
              title="Delete message"
            >
              <Trash2 className="w-4 h-4 text-alert-error" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const headerAvatar = activeChatPeer?.avatar || avatarUrl;

  // Standard Header Mode
  return (
    <div className="px-4 pt-[calc(env(safe-area-inset-top,0px)+0.625rem)] pb-2 border-b flex items-center justify-between flex-shrink-0 bg-black/10 border-white-5 select-none z-20">
      <div className="flex items-center gap-2 min-w-0">
        {isMobile && onBackToDeck && (
          <button
            type="button"
            onClick={onBackToDeck}
            className="w-9 h-9 rounded-full text-text-secondary hover:text-white hover:bg-white-5 cursor-pointer flex items-center justify-center transition-colors shrink-0"
            title="Back to directory"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div 
          onClick={onViewProfile}
          className={`flex items-center gap-3 min-w-0 ${onViewProfile ? 'cursor-pointer active:opacity-80 transition' : ''}`}
          title={onViewProfile ? "View Profile" : undefined}
        >
          {/* Avatar */}
          {headerAvatar && !avatarErr ? (
            <div 
              className="w-9 h-9 rounded-full bg-velum-800 border border-white-5 flex items-center justify-center font-bold text-accent overflow-hidden shrink-0"
            >
              <img 
                src={resolveMediaUrl(headerAvatar)} 
                alt="" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
                onError={() => setAvatarErr(true)}
              />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-velum-800 border border-white-5 flex items-center justify-center font-bold text-accent shrink-0">
              <span className="text-xs font-mono font-bold uppercase text-accent">{initials}</span>
            </div>
          )}
          
          {/* Title & Status */}
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-white leading-tight truncate">{chatTitle}</span>
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
      <div className="flex items-center gap-1 shrink-0">
        {onSearchToggle && (
          <button
            type="button"
            onClick={onSearchToggle}
            className="w-9 h-9 rounded-full text-text-secondary hover:text-white hover:bg-white-5 cursor-pointer flex items-center justify-center transition-colors shrink-0"
            title="Search messages"
          >
            <Search className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
