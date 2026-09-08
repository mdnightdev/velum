import React, { RefObject, UIEvent } from 'react';
import { Message } from '../../types';
import { MessageItem } from './MessageItem';

export interface MessageListProps {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onScroll: (e: UIEvent<HTMLDivElement>) => void;
  conversationMessages: Message[];
  currentUserId: number;
  currentUsername?: string;
  roomId: string;
  decryptedMap: Record<string, string>;
  getDecryptedText: (msg: Message) => string;
  copiedMessageId: string | null;
  setCopiedMessageId: (id: string | null) => void;
  handleTouchStart: (msg: Message) => void;
  handleTouchEnd: () => void;
  onSendReaction?: (messageId: string, roomId: string, emoji: string) => void;
  onRetryMessage?: (clientMsgId: string) => void;
  onScrollToMessage: (messageId: string) => void;
  typingPeer: string | null;
  showReactionsForKey?: string | null;
  onReactSelect?: (msg: Message, emoji: string) => void;
  activeChatPeer?: { userId: number; username: string; displayName?: string } | null;
}

export function MessageList({
  scrollContainerRef,
  messagesEndRef,
  onScroll,
  conversationMessages,
  currentUserId,
  currentUsername,
  roomId,
  decryptedMap,
  getDecryptedText,
  copiedMessageId,
  setCopiedMessageId,
  handleTouchStart,
  handleTouchEnd,
  onSendReaction,
  onRetryMessage,
  onScrollToMessage,
  typingPeer,
  showReactionsForKey,
  onReactSelect,
  activeChatPeer,
}: MessageListProps) {
  return (
    <>
      <div
        ref={scrollContainerRef}
        onScroll={onScroll}
        style={{ overflowAnchor: 'auto', scrollBehavior: 'auto' }}
        className="flex-1 overflow-y-auto overscroll-contain p-3 pt-6 space-y-1 chat-wallpaper select-none w-full max-w-[1050px] mx-auto"
      >
        {conversationMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center select-none">
            <div className="max-w-md bg-white/[0.03] backdrop-blur-md rounded-2xl p-6 border border-white-5 text-center">
              <p className="text-xs text-text-secondary font-medium font-sans">
               Quiet in here... break the ice.
              </p>
            </div>
          </div>
        ) : (
          conversationMessages.map((msg, index) => (
            <MessageItem
              key={msg.message_id || msg.id || msg.nonce || (msg.created_at ? `${msg.user_id}-${msg.created_at}` : undefined) || `msg-${index}`}
              msg={msg}
              index={index}
              currentUserId={currentUserId}
              currentUsername={currentUsername}
              roomId={roomId}
              conversationMessages={conversationMessages}
              decryptedMap={decryptedMap}
              getDecryptedText={getDecryptedText}
              copiedMessageId={copiedMessageId}
              setCopiedMessageId={setCopiedMessageId}
              handleTouchStart={handleTouchStart}
              handleTouchEnd={handleTouchEnd}
              onSendReaction={onSendReaction}
              onRetryMessage={onRetryMessage}
              onScrollToMessage={onScrollToMessage}
              showReactionsForKey={showReactionsForKey}
              onReactSelect={onReactSelect}
              activeChatPeer={activeChatPeer}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {typingPeer && (
        <div className="px-6 py-2 flex items-center gap-2 text-[9px] font-mono text-accent uppercase animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-accent block" />
          <span>{typingPeer} is typing...</span>
        </div>
      )}
    </>
  );
}
