import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Message, stripAt } from '../types';
import { EncryptionContext } from '../services/encryptionService';
import { useAudioRecorder } from './Chat/hooks/useAudioRecorder';
import { useMessageInput } from './Chat/hooks/useMessageInput';
import { useMessageScroll } from './Chat/hooks/useMessageScroll';
import { useMessageActions } from './Chat/hooks/useMessageActions';
import { useSupportNomination } from './Chat/hooks/useSupportNomination';
import { useAttachmentActions } from './Chat/hooks/useAttachmentActions';
import { useAudioPlayback } from './Chat/hooks/useAudioPlayback';
import { useMessageDecryption } from './Chat/hooks/useMessageDecryption';
import { useTypingStatus } from './Chat/hooks/useTypingStatus';
import { useMessageSearch } from './Chat/hooks/useMessageSearch';
import { useForwardingFriends } from './Chat/hooks/useForwardingFriends';
import { usePeerPresence } from './Chat/hooks/usePeerPresence';
import { ChatHeader } from './Chat/ChatHeader';
import { ChatInput } from './Chat/ChatInput';
import { SearchDrawer } from './Chat/SearchDrawer';
import { PinnedMessageBar } from './Chat/PinnedMessageBar';
import { MessageList } from './Chat/MessageList';
import { ImageCropperModal } from './ImageCropperModal';
import { streamFileDirectToCloudStorage } from '../utils/mediaPipeline';
import { useLanguage } from '../i18n/LanguageContext';
import { requestNotificationPermission, sendDesktopNotification } from '../utils/notifications';
import { createLogger } from '../utils/logger';
import { getSessionId } from '../utils/auth';

const log = createLogger('ChatArea');

export interface ChatAreaProps {
  currentUserId: number;
  currentUsername: string;
  currentUserRole: string;
  roomId: string;
  wsConnected: boolean;
  messages: Message[];
  onSendMessage: (content: string, burnSeconds: number | null, isEncrypted: boolean, targetRoomId?: string, replyTo?: string | number, clientPlaintext?: string) => void;
  onSendTyping?: (isTyping: boolean) => void;
  onRoomKick: (targetUserId: number) => void;
  onRoomMute: (targetUserId: number, mute: boolean) => void;
  onSendReaction?: (messageId: string, roomId: string, emoji: string) => void;
  onEditMessage?: (messageId: string, roomId: string, content: string) => void;
  onDeleteMessage?: (messageId: string, roomId: string) => void;
  onPinMessage?: (messageId: string, roomId: string, pin: boolean) => void;
  onRetryMessage?: (clientMsgId: string) => void;
  onMarkAsRead?: (messageId: string, roomId: string, dbMessageId?: number) => void;
  onMarkAllAsRead?: (roomId: string) => void;
  onMarkDelivered?: (messageId: string, roomId: string) => void;
  activeChatPeer?: { userId: number; username: string; avatar?: string } | null;
  isDark?: boolean;
  roomAccessLevel?: string;
  onBackToDeck?: () => void;
  onSelectProfileUser?: (user: any) => void;
  onToggleSidebar?: () => void;
  isMobile?: boolean;
  roomName?: string;
  isPrivateSublounge?: boolean;
  isMember?: boolean;
  onJoinLounge?: () => void;
  avatarUrl?: string;
}

function dataURItoBlob(dataURI: string): Blob {
  try {
    const parts = dataURI.split(',');
    const byteString = atob(parts[1] || parts[0]);
    const mimeString = parts[0]?.split(':')[1]?.split(';')[0] || 'application/octet-stream';
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  } catch (err) {
    return new Blob([dataURI], { type: 'application/octet-stream' });
  }
}

export default function ChatArea({
  currentUserId,
  currentUsername,
  currentUserRole,
  roomId,
  wsConnected,
  messages,
  onSendMessage,
  onSendTyping,
  onRoomKick,
  onRoomMute,
  onSendReaction,
  onEditMessage,
  onDeleteMessage,
  onPinMessage,
  onRetryMessage,
  onMarkAsRead,
  onMarkAllAsRead,
  activeChatPeer,
  isDark,
  onBackToDeck,
  isMobile,
  onToggleSidebar,
  roomName,
  isPrivateSublounge,
  roomAccessLevel,
  isMember,
  onJoinLounge,
  avatarUrl,
}: ChatAreaProps) {
  const { t } = useLanguage();

  const {
    inputText,
    setInputText,
    selectedAttachment,
    setSelectedAttachment,
    fileInputRef,
    textareaRef,
  } = useMessageInput({ roomId, activeChatPeer });

  const {
    editingMessageId,
    setEditingMessageId,
    longPressedMsgId,
    selectedMessage,
    setSelectedMessage,
    showEmojisForMsg,
    setShowEmojisForMsg,
    copiedMessageId,
    setCopiedMessageId,
    replyingToMessage,
    setReplyingToMessage,
    forwardingMessage,
    setForwardingMessage,
    handleTouchStart,
    handleTouchEnd,
    handleStartEdit: actionStartEdit,
    handleCancelEdit: actionCancelEdit
  } = useMessageActions();

  const { isTyping, setIsTyping, typingPeer } = useTypingStatus({
    inputText,
    onSendTyping,
    roomId,
    currentUserId,
    activeChatPeer
  });

  const { peerPresence } = usePeerPresence({ activeChatPeer });

  const chatKey = activeChatPeer ? `dm-${activeChatPeer.userId}` : `room-${roomId}`;

  const {
    messagesEndRef,
    scrollContainerRef,
    handleScroll,
    handleScrollToMessage
  } = useMessageScroll({ messagesLength: messages.length, typingPeer, chatKey });

  const {
    hasPendingNomination,
    isSubmittingNominationAction,
    handleNominationAction
  } = useSupportNomination({ activeChatPeer });

  const [activePinIndex, setActivePinIndex] = useState<number>(0);

  const { friendsList, isLoadingFriends } = useForwardingFriends({
    forwardingMessage,
    currentUserId
  });

  // Audio recording hook
  const {
    isRecording,
    isPaused,
    recordingSeconds,
    micError,
    audioLevels,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    setMicError
  } = useAudioRecorder();

  const [popoverPeer, setPopoverPeer] = useState<{
    userId: number;
    username: string;
    messageId: string;
    displayName?: string;
    bio?: string;
    location?: string;
    joinedDate?: string;
    status?: string;
    isMuted?: boolean;
    isBlocked?: boolean;
    avatar?: string;
    stats?: { loungesCount: number; connectionsCount: number };
  } | null>(null);

  const markedMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    markedMessageIdsRef.current.clear();
  }, [roomId, activeChatPeer?.userId]);

  // Message decryption hook
  const {
    decryptedMap,
    getDecryptedText,
    encryptOutgoingMessage
  } = useMessageDecryption({
    messages,
    activeChatPeer,
    roomId,
    currentUserId
  });

  const chatTitle = activeChatPeer
    ? stripAt(activeChatPeer.username)
    : roomName
      ? roomName.replace(/^#\s*/, '')
      : (roomId.startsWith('#') ? roomId.slice(1) : roomId);

  const activePeerId = activeChatPeer?.userId;

  const conversationMessages = useMemo(() => {
    const raw = messages.filter(m => {
      if (activePeerId) {
        const otherId = activePeerId;
        if (otherId === 999) {
          return m.room_id === `dm_velum_${currentUserId}`;
        }
        const isPeerFromMe = String(m.user_id) === String(currentUserId) && (m.room_id === `dm_${otherId}` || m.room_id === `dm_${currentUserId}_${otherId}` || (m as any)._dm_target === otherId);
        const isPeerToMe = String(m.user_id) === String(otherId) && (m.room_id === `dm_${currentUserId}` || m.room_id === `dm_${otherId}_${currentUserId}` || (m as any)._dm_target === currentUserId);
        return isPeerFromMe || isPeerToMe || m.room_id?.includes(`dm_${Math.min(currentUserId, otherId)}_${Math.max(currentUserId, otherId)}`);
      } else {
        return m.room_id === roomId || (!m.room_id && m.lounge_id === roomId);
      }
    });

    const seen = new Set<string>();
    const deduplicated: Message[] = [];
    // Process in reverse so confirmed sent status and permanent db_message_id override temporary optimistic drafts
    for (let i = raw.length - 1; i >= 0; i--) {
      const m = raw[i];
      const keys = [m.db_message_id, m.id, m.message_id, m.client_msg_id, m.nonce]
        .filter(Boolean)
        .map(String);
      const isDuplicate = keys.some(k => seen.has(k));
      if (!isDuplicate) {
        keys.forEach(k => seen.add(k));
        deduplicated.unshift(m);
      }
    }
    return deduplicated;
  }, [messages, activePeerId, currentUserId, roomId]);

  const {
    showSearch,
    setShowSearch,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    isSearching,
    searchIndex,
    setSearchIndex,
    handleSearch,
    handleNavigateSearch
  } = useMessageSearch({
    roomId,
    conversationMessages,
    decryptedMap,
    handleScrollToMessage
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [croppingImage, setCroppingImage] = useState<{ src: string; fileName: string; file: File } | null>(null);
  const [fileErrorAlert, setFileErrorAlert] = useState<string | null>(null);

  const {
    handleTriggerPhotoInput,
    handleTriggerDocInput,
    handleDismissAttachment,
    handleFileSelect
  } = useAttachmentActions({
    photoInputRef,
    docInputRef,
    setSelectedAttachment,
    setCroppingImage,
    setFileErrorAlert,
    onSendMessage
  });

  const isSubmittingRef = useRef(false);
  const [isSending, setIsSending] = useState(false);

  const handleToggleRecording = async () => {
    if (!isRecording) {
      await startRecording();
    } else {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setIsSending(true);
      stopRecording(async (audioBase64, durationSeconds) => {
        try {
          const response = await fetch(`data:audio/webm;base64,${audioBase64}`);
          const blob = await response.blob();
          
          const url = await streamFileDirectToCloudStorage(blob, 'media', 'webm');
          onSendMessage(`[Voice Note  duration:${durationSeconds}s url:${url}]`, null, false);
        } catch (err) {
          log.error('Audio upload failed', { error: (err as Error).message });
          onSendMessage(`[Voice Note  duration:${durationSeconds}s data:audio/webm;base64,${audioBase64}]`, null, false);
        } finally {
          isSubmittingRef.current = false;
          setIsSending(false);
        }
      });
    }
  };

  const handleStartEdit = (msg: Message) => {
    const isCipher = msg.content?.startsWith('ratchet:v2:') || msg.content?.startsWith('VEL_E2EE[');
    const activeContent = (msg.message_id && decryptedMap[msg.message_id]) || (isCipher ? '···' : (msg.content || ''));
    actionStartEdit(msg, activeContent, setInputText);
  };

  const handleCancelEdit = () => {
    actionCancelEdit(setInputText);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    if (!inputText.trim() && !selectedAttachment) return;

    isSubmittingRef.current = true;
    setIsSending(true);

    try {
      if (editingMessageId) {
        if (onEditMessage) {
          const originalMsg = messages.find(m => m.message_id === editingMessageId);
          let finalEditContent = inputText.trim();
          if (originalMsg) {
            const isCipher = originalMsg.content?.startsWith('ratchet:v2:') || originalMsg.content?.startsWith('VEL_E2EE[');
            const activeContent = decryptedMap[editingMessageId] || (isCipher ? '···' : (originalMsg.content || ''));
            if (activeContent.includes('[Attachment:')) {
              const attachmentPart = activeContent.split(']')[0] + ']';
              finalEditContent = `${attachmentPart} ${inputText.trim()}`.trim();
            }
          }
          onEditMessage(
            originalMsg?.db_message_id ? String(originalMsg.db_message_id) : editingMessageId,
            roomId,
            finalEditContent
          );
        }
        setEditingMessageId(null);
        setInputText('');
        return;
      }
      
      let textToSend = inputText.trim();
      if (selectedAttachment) {
        try {
          const blob = selectedAttachment.data.startsWith('data:')
            ? dataURItoBlob(selectedAttachment.data)
            : await (await fetch(selectedAttachment.data)).blob();
          
          const ext = selectedAttachment.name.split('.').pop() || 'bin';
          const url = await streamFileDirectToCloudStorage(blob, 'media', ext);
          textToSend = `[Attachment: ${selectedAttachment.name} size:${selectedAttachment.size} type:${selectedAttachment.type} url:${url}] ${inputText.trim()}`.trim();
        } catch (err) {
          log.error('Attachment upload failed', { error: (err as Error).message });
          textToSend = `[Attachment: ${selectedAttachment.name} size:${selectedAttachment.size} type:${selectedAttachment.type} data:${selectedAttachment.data}] ${inputText.trim()}`.trim();
        }
      }

      const replyMsgId = replyingToMessage 
        ? (replyingToMessage.db_message_id || parseInt(replyingToMessage.message_id || '0', 10) || undefined)
        : undefined;

      if (activeChatPeer && activeChatPeer.userId !== 999) {
        try {
          const context: EncryptionContext = { type: 'direct', peerUserId: activeChatPeer.userId };
          const encryptedEnvelope = await encryptOutgoingMessage(textToSend, context);
          onSendMessage(encryptedEnvelope, null, true, undefined, replyMsgId, textToSend);
        } catch (err) {
          onSendMessage(textToSend, null, false, undefined, replyMsgId, textToSend);
        }
      } else {
        onSendMessage(textToSend, null, false, undefined, replyMsgId, textToSend);
      }
      setReplyingToMessage(null);
      setInputText('');
      setSelectedAttachment(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (onSendTyping && isTyping) {
        setIsTyping(false);
        onSendTyping(false);
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSending(false);
    }
  };

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const prevMessagesLengthRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.user_id !== currentUserId) {
        const senderName = lastMsg.username || activeChatPeer?.username || 'Velum Member';
        sendDesktopNotification(`New message from ${senderName}`, { body: 'New message' });
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, currentUserId, activeChatPeer?.username]);

  const onMarkAsReadRef = useRef(onMarkAsRead);
  const markAllAsReadRef = useRef(onMarkAllAsRead);
  useEffect(() => {
    onMarkAsReadRef.current = onMarkAsRead;
    markAllAsReadRef.current = onMarkAllAsRead;
  }, [onMarkAsRead, onMarkAllAsRead]);

  useEffect(() => {
    if (!roomId) return;
    markAllAsReadRef.current?.(roomId);
  }, [roomId]);

  useEffect(() => {
    if (!onMarkAsReadRef.current) return;
    if (!activeChatPeer) return;
    
    const unreadMessages = messages.filter(m => {
      let isRelevant = false;
      const otherId = activeChatPeer.userId;
      if (otherId === 999) {
        isRelevant = m.room_id === `dm_velum_${currentUserId}`;
      } else {
        const isPeerFromMe = m.user_id === currentUserId && (m.room_id === `dm_${otherId}` || m.room_id === `dm_${currentUserId}_${otherId}` || (m as any)._dm_target === otherId);
        const isPeerToMe = m.user_id === otherId && (m.room_id === `dm_${currentUserId}` || m.room_id === `dm_${otherId}_${currentUserId}` || (m as any)._dm_target === currentUserId);
        isRelevant = isPeerFromMe || isPeerToMe || !!(m.room_id?.includes(`dm_${Math.min(currentUserId, otherId)}_${Math.max(currentUserId, otherId)}`));
      }
      return isRelevant && m.user_id !== currentUserId && m.status !== 'read' && !markedMessageIdsRef.current.has(m.message_id);
    });
    
    unreadMessages.forEach(m => {
      if (document.hasFocus() && m.message_id) {
        markedMessageIdsRef.current.add(m.message_id);
        onMarkAsReadRef.current?.(m.message_id, m.room_id || roomId);
      }
    });
  }, [messages, currentUserId, roomId, activeChatPeer?.userId]);

  if (!currentUserId || !roomId) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-12 text-center font-mono text-[9px] ${isDark ? 'text-text-secondary bg-velum-900' : 'text-text-disabled bg-text-primary'} tracking-widest`}>
        <p className={`font-bold uppercase mb-1 ${isDark ? 'text-white' : 'text-text-primary'}`}>Initializing Chat Canvas</p>
      </div>
    );
  }

  const pinnedMessages = conversationMessages.filter(m => m.is_pinned && !m.deleted);
  const validPinIndex = Math.min(activePinIndex, Math.max(0, pinnedMessages.length - 1));
  const activePinnedMsg = pinnedMessages[validPinIndex];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent text-text-primary min-w-0 select-none w-full max-w-[1150px] mx-auto">
      <ChatHeader
        wsConnected={wsConnected}
        isMobile={isMobile}
        onBackToDeck={onBackToDeck}
        activeChatPeer={activeChatPeer}
        avatarUrl={avatarUrl}
        chatTitle={chatTitle}
        peerPresence={peerPresence}
        conversationMessages={conversationMessages}
        onSearchToggle={() => setShowSearch(!showSearch)}
        selectedMessage={selectedMessage}
        getDecryptedText={getDecryptedText}
        onClearSelection={() => setSelectedMessage(null)}
        onReplySelected={(msg) => {
          setReplyingToMessage(msg);
          setSelectedMessage(null);
        }}
        onCopySelected={(msg) => {
          const plainText = getDecryptedText(msg);
          navigator.clipboard.writeText(plainText);
          setCopiedMessageId(msg.message_id);
          setTimeout(() => setCopiedMessageId(null), 2000);
          setSelectedMessage(null);
        }}
        onEditSelected={(msg) => {
          const activeText = getDecryptedText(msg);
          actionStartEdit(msg, activeText, setInputText);
          setSelectedMessage(null);
        }}
        onForwardSelected={(msg) => {
          setForwardingMessage(msg);
          setSelectedMessage(null);
        }}
        onPinSelected={(msg) => {
          if (onPinMessage) {
            onPinMessage(msg.message_id, roomId, !msg.is_pinned);
          }
          setSelectedMessage(null);
        }}
        onDeleteSelected={(msg) => {
          if (onDeleteMessage) {
            onDeleteMessage(msg.message_id, roomId);
          }
          setSelectedMessage(null);
        }}
        onReportSelected={async (msg) => {
          const reason = prompt("Enter the reason for reporting :");
          if (reason === null) return;
          if (!reason.trim()) {
            alert("reason is required.");
            return;
          }
          try {
            const sId = getSessionId();
            const res = await fetch('/v2/user/report', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${sId}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ targetUserId: msg.user_id, reason: reason.trim() })
            });
            if (res.ok) {
              alert(" reported submitted.");
            } else {
              const errData = await res.json();
              alert(errData.error || "Failed to submit report.");
            }
          } catch {
            alert("Network error reporting message.");
          }
          setSelectedMessage(null);
        }}
        currentUserId={currentUserId}
      />
      <SearchDrawer
        showSearch={showSearch}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchResults={searchResults}
        searchIndex={searchIndex}
        isSearching={isSearching}
        onSearchSubmit={handleSearch}
        onNavigateSearch={handleNavigateSearch}
        onCloseSearch={() => {
          setShowSearch(false);
          setSearchQuery('');
          setSearchResults([]);
          setSearchIndex(-1);
        }}
      />
      <PinnedMessageBar
        pinnedMessages={pinnedMessages}
        activePinnedMsg={activePinnedMsg}
        onScrollToMessage={handleScrollToMessage}
        onNextPin={() => setActivePinIndex((prev) => (prev + 1) % pinnedMessages.length)}
        onPinMessage={onPinMessage}
        roomId={roomId}
        getDecryptedText={getDecryptedText}
      />
      <MessageList
        scrollContainerRef={scrollContainerRef}
        messagesEndRef={messagesEndRef}
        onScroll={handleScroll}
        conversationMessages={conversationMessages}
        currentUserId={currentUserId}
        currentUsername={currentUsername}
        currentUserRole={currentUserRole}
        roomId={roomId}
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
        onRetryMessage={onRetryMessage}
        onScrollToMessage={handleScrollToMessage}
        popoverPeer={popoverPeer}
        setPopoverPeer={setPopoverPeer}
        onBackToDeck={onBackToDeck}
        onRoomKick={onRoomKick}
        onRoomMute={onRoomMute}
        typingPeer={typingPeer}
      />

      <input
        type="file"
        accept="image/*,video/*"
        multiple
        ref={photoInputRef}
        onChange={handleFileSelect}
        className="hidden"
      />

      <input
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.tar,.gz,.json,.csv,*/*"
        multiple
        ref={docInputRef}
        onChange={handleFileSelect}
        className="hidden"
      />

      {croppingImage && (
        <ImageCropperModal
          imageSrc={croppingImage.src}
          fileName={croppingImage.fileName}
          aspectRatio="free"
          onCancel={() => setCroppingImage(null)}
          onCropComplete={(croppedDataUrl, croppedFile) => {
            const sizeStr = `${(croppedFile.size / 1024).toFixed(0)} KB`;
            setSelectedAttachment({
              name: croppedFile.name,
              size: sizeStr,
              type: croppedFile.type || 'image/png',
              data: croppedDataUrl,
            });
            setCroppingImage(null);
          }}
        />
      )}

      <ChatInput
        inputText={inputText}
        setInputText={setInputText}
        selectedAttachment={selectedAttachment}
        onDismissAttachment={handleDismissAttachment}
        textareaRef={textareaRef}
        isRecording={isRecording}
        recordingSeconds={recordingSeconds}
        isPaused={isPaused}
        audioLevels={audioLevels}
        cancelRecording={cancelRecording}
        pauseRecording={pauseRecording}
        resumeRecording={resumeRecording}
        stopRecording={stopRecording}
        onToggleRecording={handleToggleRecording}
        micError={micError}
        setMicError={setMicError}
        fileErrorAlert={fileErrorAlert}
        setFileErrorAlert={setFileErrorAlert}
        roomId={roomId}
        currentUserId={currentUserId}
        activeChatPeer={activeChatPeer}
        hasPendingNomination={hasPendingNomination}
        isSubmittingNominationAction={isSubmittingNominationAction}
        onNominationAction={handleNominationAction}
        editingMessageId={editingMessageId}
        onCancelEdit={handleCancelEdit}
        replyingToMessage={replyingToMessage}
        onCancelReply={() => setReplyingToMessage(null)}
        getDecryptedText={getDecryptedText}
        roomAccessLevel={roomAccessLevel}
        currentUserRole={currentUserRole}
        chatTitle={chatTitle}
        t={t}
        isSending={isSending}
        onSend={handleSend}
        onSendVoiceNote={(voiceContent) => onSendMessage(voiceContent, null, false)}
        onTriggerPhotoInput={handleTriggerPhotoInput}
        onTriggerDocInput={handleTriggerDocInput}
        isPrivateSublounge={isPrivateSublounge}
        isMember={isMember}
        onJoinLounge={onJoinLounge}
      />
    </div>
  );
}
