import React from 'react';
import { ChevronLeft, Search, X, Reply, Pencil, Forward, Pin, Trash2, Flag, Copy } from 'lucide-react';
import { Message } from '../../types';
import { formatLastSeen } from '../../utils/datetime';

interface ChatHeaderProps {
  wsConnected: boolean;
  isMobile?: boolean;
  onBackToDeck?: () => void;
  activeChatPeer: any | null;
  chatTitle: string;
  peerPresence: string;
  conversationMessages: Message[];
  onSearchToggle?: () => void;
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
  currentUserId
}: ChatHeaderProps) {
  const initials = (activeChatPeer?.displayName || activeChatPeer?.username || chatTitle || '?').slice(0, 2).toUpperCase();
  const isOwnSelectedMessage = selectedMessage && currentUserId && selectedMessage.user_id === currentUserId;

  // Render Selection Mode Action Header when a message is selected
  if (selectedMessage) {
    let rawText = getDecryptedText ? getDecryptedText(selectedMessage) : selectedMessage.content;
    if (!rawText || rawText.includes('VEL_E2EE') || rawText.includes('d%/dr/') || rawText.startsWith('m.')) {
      rawText = selectedMessage.content && !selectedMessage.content.includes('VEL_E2EE') ? selectedMessage.content : 'Encrypted Message';
    }
    // Clean up residual [Attachment: ...] tags
    const cleanSnippet = rawText.replace(/^\[Attachment:\s*[^\]]+\]\s*/i, '').trim() || 'Attachment';

    return (
      <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0 bg-velum-800/95 border-accent/20 transition-all select-none z-20 shadow-md">
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClearSelection}
            className="w-10 h-10 rounded-full text-text-secondary hover:text-white hover:bg-white-10 cursor-pointer flex items-center justify-center transition-colors shrink-0"
            title="Cancel selection"
          >
            <X className="w-5 h-5 text-accent" />
          </button>
        </div>

        {/* Action Icons Toolbar (Remapped to Header) */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {onReplySelected && (
            <button
              type="button"
              onClick={() => onReplySelected(selectedMessage)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full text-text-secondary hover:text-accent hover:bg-accent-10 cursor-pointer flex items-center justify-center transition-colors shrink-0"
              title="Reply"
            >
              <Reply className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {onCopySelected && (
            <button
              type="button"
              onClick={() => onCopySelected(selectedMessage)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full text-text-secondary hover:text-accent hover:bg-accent-10 cursor-pointer flex items-center justify-center transition-colors shrink-0"
              title="Copy message"
            >
              <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {isOwnSelectedMessage && onEditSelected && (
            <button
              type="button"
              onClick={() => onEditSelected(selectedMessage)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full text-text-secondary hover:text-accent hover:bg-accent-10 cursor-pointer flex items-center justify-center transition-colors shrink-0"
              title="Edit message"
            >
              <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {onForwardSelected && (
            <button
              type="button"
              onClick={() => onForwardSelected(selectedMessage)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full text-text-secondary hover:text-accent hover:bg-accent-10 cursor-pointer flex items-center justify-center transition-colors shrink-0"
              title="Forward"
            >
              <Forward className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {onPinSelected && (
            <button
              type="button"
              onClick={() => onPinSelected(selectedMessage)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full text-text-secondary hover:text-accent hover:bg-accent-10 cursor-pointer flex items-center justify-center transition-colors shrink-0"
              title={selectedMessage.is_pinned ? "Unpin message" : "Pin message"}
            >
              <Pin className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {!isOwnSelectedMessage && onReportSelected && (
            <button
              type="button"
              onClick={() => onReportSelected(selectedMessage)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full text-text-secondary hover:text-alert-error hover:bg-alert-error-bg cursor-pointer flex items-center justify-center transition-colors shrink-0"
              title="Report message"
            >
              <Flag className="w-4 h-4 sm:w-5 sm:h-5 text-alert-error" />
            </button>
          )}

          {onDeleteSelected && (
            <button
              type="button"
              onClick={() => onDeleteSelected(selectedMessage)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full text-text-secondary hover:text-alert-error hover:bg-alert-error-bg cursor-pointer flex items-center justify-center transition-colors shrink-0"
              title="Delete message"
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-alert-error" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Standard Header Mode
  return (
    <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0 bg-black/10 border-white-5 select-none z-20">
      {!wsConnected && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 bg-accent/10 border border-accent/20 text-accent text-[9px] font-mono font-bold uppercase rounded-lg animate-pulse tracking-widest pointer-events-none z-50">
          reconnecting...
        </div>
      )}
      <div className="flex items-center gap-3">
        {isMobile && onBackToDeck && (
          <button
            type="button"
            onClick={onBackToDeck}
            className="w-11 h-11 rounded-full text-text-secondary hover:text-white hover:bg-text-primary/5 cursor-pointer flex items-center justify-center transition-colors shrink-0"
            title="Back to directory"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          {activeChatPeer ? (
            <div 
              className="w-10 h-10 rounded-full bg-velum-800 border border-white-5 flex items-center justify-center font-bold text-accent overflow-hidden shrink-0"
            >
              {activeChatPeer.avatar ? (
                <img src={activeChatPeer.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-xs font-mono font-bold uppercase text-accent">{initials}</span>
              )}
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-velum-800 border border-white-5 flex items-center justify-center font-bold text-accent shrink-0">
              <span className="text-xs font-mono font-bold uppercase text-accent">{initials}</span>
            </div>
          )}
          
          {/* Title & Status */}
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">{chatTitle}</span>
            {activeChatPeer && activeChatPeer.userId !== 999 && (
              <span className="text-[11px] text-text-secondary">
                {formatLastSeen(peerPresence)}
              </span>
            )}
          </div>
        </div>
      </div>
      {onSearchToggle && (
        <button
          type="button"
          onClick={onSearchToggle}
          className="w-11 h-11 rounded-full text-text-secondary hover:text-white hover:bg-white-5 cursor-pointer flex items-center justify-center transition-colors shrink-0"
          title="Search messages"
        >
          <Search className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
