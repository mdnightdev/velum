import React from 'react';
import { Pin, X } from 'lucide-react';
import { Message } from '../../types';

export interface PinnedMessageBarProps {
  pinnedMessages: Message[];
  activePinnedMsg?: Message | null;
  onScrollToMessage: (msgId: string) => void;
  onNextPin: () => void;
  onPinMessage?: (msgId: string, roomId: string, pin: boolean) => void;
  roomId: string;
  getDecryptedText: (msg: Message) => string;
}

export function PinnedMessageBar({
  pinnedMessages,
  activePinnedMsg,
  onScrollToMessage,
  onNextPin,
  onPinMessage,
  roomId,
  getDecryptedText,
}: PinnedMessageBarProps) {
  if (pinnedMessages.length === 0 || !activePinnedMsg) return null;

  return (
    <div className="bg-bg-pinned-bar border-b border-white-5 p-2.5 px-4 flex items-center justify-between gap-3 text-xs backdrop-blur-[var(--blur-backdrop-md)] relative z-30 select-none">
      <div
        className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
        onClick={() => onScrollToMessage(activePinnedMsg.message_id)}
      >
        <Pin className="w-4 h-4 text-accent shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase font-bold text-accent tracking-wider font-mono">
            {pinnedMessages.length > 1 ? `Pinned Messages (${pinnedMessages.length})` : 'Pinned Message'}
          </div>
          <div className="text-text-primary/95 truncate font-medium max-w-full">
            {getDecryptedText(activePinnedMsg)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {pinnedMessages.length > 1 && (
          <button
            type="button"
            onClick={onNextPin}
            className="p-1 px-2 rounded-lg bg-white-5 hover:bg-white-10 text-[9px] font-mono font-bold uppercase text-text-secondary hover:text-white transition cursor-pointer"
            title="Next pinned message"
          >
            Next
          </button>
        )}
        {onPinMessage && (
          <button
            type="button"
            onClick={() =>
              onPinMessage(
                activePinnedMsg.db_message_id ? String(activePinnedMsg.db_message_id) : activePinnedMsg.message_id,
                activePinnedMsg.room_id || roomId,
                false
              )
            }
            className="p-1.5 rounded-lg hover:bg-alert-error-bg text-text-secondary hover:text-alert-error transition cursor-pointer"
            title="Unpin message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
