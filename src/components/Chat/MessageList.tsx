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
  currentUserRole: string;
  roomId: string;
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
  onScrollToMessage: (messageId: string) => void;
  popoverPeer: any;
  setPopoverPeer: React.Dispatch<React.SetStateAction<any>>;
  onBackToDeck?: () => void;
  onRoomKick?: (targetUserId: number) => void;
  onRoomMute?: (targetUserId: number, mute: boolean) => void;
  typingPeer: string | null;
}

export function MessageList({
  scrollContainerRef,
  messagesEndRef,
  onScroll,
  conversationMessages,
  currentUserId,
  currentUsername,
  currentUserRole,
  roomId,
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
  onScrollToMessage,
  popoverPeer,
  setPopoverPeer,
  onBackToDeck,
  onRoomKick,
  onRoomMute,
  typingPeer,
}: MessageListProps) {
  return (
    <>
      <div
        ref={scrollContainerRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto p-3 pt-6 md:p-4 md:pt-8 space-y-2 chat-wallpaper select-none w-full max-w-[1050px] mx-auto"
      >
        {conversationMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center select-none">
            <div className="max-w-md bg-white/[0.03] backdrop-blur-md rounded-2xl p-6 border border-white-5 text-center">
              <p className="text-xs text-text-secondary font-medium font-sans">
                No messages in this workspace yet. Write the first message below to start the conversation.
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
              currentUserRole={currentUserRole}
              roomId={roomId}
              conversationMessages={conversationMessages}
              decryptedMap={decryptedMap}
              getDecryptedText={getDecryptedText}
              longPressedMsgId={longPressedMsgId}
              showEmojisForMsg={showEmojisForMsg}
              setShowEmojisForMsg={setShowEmojisForMsg}
              copiedMessageId={copiedMessageId}
              setCopiedMessageId={setCopiedMessageId}
              setReplyingToMessage={setReplyingToMessage}
              setForwardingMessage={setForwardingMessage}
              handleTouchStart={handleTouchStart}
              handleTouchEnd={handleTouchEnd}
              handleStartEdit={handleStartEdit}
              onSendReaction={onSendReaction}
              onEditMessage={onEditMessage}
              onDeleteMessage={onDeleteMessage}
              onPinMessage={onPinMessage}
              onSendMessage={onSendMessage}
              onScrollToMessage={onScrollToMessage}
              popoverPeer={popoverPeer}
              setPopoverPeer={setPopoverPeer}
              onBackToDeck={onBackToDeck}
              onRoomKick={onRoomKick}
              onRoomMute={onRoomMute}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicators */}
      {typingPeer && (
        <div className="px-6 py-2 flex items-center gap-2 text-[9px] font-mono text-accent uppercase animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-accent block" />
          <span>{typingPeer} is typing...</span>
        </div>
      )}
    </>
  );
}
