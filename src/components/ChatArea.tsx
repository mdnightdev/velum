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
import { streamFileDirectToCloudStorage, generateAnonymousFilename } from '../utils/mediaPipeline';
import { stripAttachmentTokens, getCleanPreview } from '../utils/messageParser';
import { useLanguage } from '../i18n/LanguageContext';
import { requestNotificationPermission, dismissDeliveredNotification } from '../utils/notifications';
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
  onMarkAsRead?: (messageId: string, roomId: string, dbMessageId?: number, sequenceId?: number) => void;
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
  roomName,
  isPrivateSublounge,
  roomAccessLevel,
  isMember,
  onJoinLounge,
  avatarUrl,
  onSelectProfileUser,
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
        if (activePeerId === 999) {
          return m.room_id === `dm_velum_${currentUserId}` || m.room_id === 'dm_999';
        }
        const dmRoomId = `dm_${activePeerId}`;
        const isMatchRoom = m.room_id === dmRoomId || m.lounge_id === dmRoomId || m.room_id === `dm_${Math.min(currentUserId, activePeerId)}_${Math.max(currentUserId, activePeerId)}`;
        const isPeerToMe = Number(m.user_id) === Number(activePeerId);
        const isPeerFromMe = Number(m.user_id) === Number(currentUserId) && (isMatchRoom || (m as any).to === activePeerId);
        return isMatchRoom || isPeerToMe || isPeerFromMe;
      } else {
        const cleanRoom = roomId.replace(/^#\s*/, '');
        const mRoom = String(m.room_id || '').replace(/^#\s*/, '');
        const mLounge = String(m.lounge_id || '').replace(/^#\s*/, '');
        return mRoom === cleanRoom || mLounge === cleanRoom || (!mRoom && mLounge === cleanRoom) || (mRoom.includes(cleanRoom) && cleanRoom.length > 3);
      }
    });

    const seen = new Set<string>();
    const deduplicated: Message[] = [];
    // Process in reverse so confirmed sent status and permanent server id override temporary optimistic drafts
    for (let i = raw.length - 1; i >= 0; i--) {
      const m = raw[i];
      const primaryKey = String(m.id ?? m.client_msg_id ?? m.message_id);
      const clientKey = m.client_msg_id ? String(m.client_msg_id) : null;
      const isDuplicate = seen.has(primaryKey) || (clientKey && seen.has(clientKey));
      if (!isDuplicate) {
        seen.add(primaryKey);
        if (clientKey) seen.add(clientKey);
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
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [croppingImage, setCroppingImage] = useState<{ src: string; fileName: string; file: File } | null>(null);
  const [fileErrorAlert, setFileErrorAlert] = useState<string | null>(null);

  const {
    handleTriggerPhotoInput,
    handleTriggerVideoInput,
    handleTriggerAudioInput,
    handleTriggerDocInput,
    handleDismissAttachment,
    handleFileSelect
  } = useAttachmentActions({
    photoInputRef,
    videoInputRef,
    audioInputRef,
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
      stopRecording(async (audioBlob, durationSeconds) => {
        try {
          const ext = audioBlob.type.split('/')[1] || 'webm';
          const url = await streamFileDirectToCloudStorage(audioBlob, 'media', ext);
          const voicePayload = `[Voice Note duration:${durationSeconds}s url:${url}]`;
          const targetRoom = activeChatPeer ? `dm_${activeChatPeer.userId}` : roomId;
          const isEnc = Boolean(activeChatPeer && activeChatPeer.userId !== 999);
          onSendMessage(voicePayload, null, isEnc, targetRoom, undefined, voicePayload);
        } catch (err) {
          log.error('Audio upload failed', { error: (err as Error).message });
          alert('Voice note upload failed. Please try again.');
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
            String(originalMsg?.id || editingMessageId),
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
          
          const ext = blob.type.split('/')[1] || selectedAttachment.name.split('.').pop() || 'webp';
          const anonymousName = generateAnonymousFilename(ext, selectedAttachment.type || blob.type);
          const url = await streamFileDirectToCloudStorage(blob, 'media', ext);
          textToSend = `[Attachment: ${anonymousName} size:${selectedAttachment.size} type:${selectedAttachment.type || blob.type || 'image/webp'} url:${url}] ${inputText.trim()}`.trim();
        } catch (err) {
          log.error('Attachment upload failed', { error: (err as Error).message });
          alert('Attachment upload failed. Please try again.');
          return;
        }
      }

      const replyMsgId = replyingToMessage 
        ? (replyingToMessage.id ? String(replyingToMessage.id) : undefined)
        : undefined;

      const targetRoom = activeChatPeer ? `dm_${activeChatPeer.userId}` : roomId;
      const isEnc = Boolean(activeChatPeer && activeChatPeer.userId !== 999);
      onSendMessage(textToSend, null, isEnc, targetRoom, replyMsgId, textToSend);
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

  const onMarkAsReadRef = useRef(onMarkAsRead);
  const markAllAsReadRef = useRef(onMarkAllAsRead);
  useEffect(() => {
    onMarkAsReadRef.current = onMarkAsRead;
    markAllAsReadRef.current = onMarkAllAsRead;
  }, [onMarkAsRead, onMarkAllAsRead]);

  useEffect(() => {
    if (!roomId) return;
    markAllAsReadRef.current?.(roomId);
    dismissDeliveredNotification(roomId).catch(() => {});
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
      const canonicalKey = String(m.id || m.message_id || '');
      return isRelevant && m.user_id !== currentUserId && m.status !== 'read' && !markedMessageIdsRef.current.has(canonicalKey);
    });
    
    unreadMessages.forEach(m => {
      const canonicalKey = String(m.id || m.message_id || '');
      if (document.hasFocus() && canonicalKey) {
        markedMessageIdsRef.current.add(canonicalKey);
        if (m.message_id) markedMessageIdsRef.current.add(m.message_id);
        const dbId = typeof m.id === 'number' ? m.id : (m.db_message_id || undefined);
        onMarkAsReadRef.current?.(canonicalKey, m.room_id || roomId, dbId, m.sequence_id);
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
        onViewProfile={() => {
          if (activeChatPeer && onSelectProfileUser) {
            onSelectProfileUser({
              userId: activeChatPeer.userId,
              username: activeChatPeer.username,
              avatar: activeChatPeer.avatar
            });
          }
        }}
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
          const textToCopy = stripAttachmentTokens(plainText) || getCleanPreview(plainText);
          navigator.clipboard.writeText(textToCopy);
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
        accept="image/*"
        multiple
        ref={photoInputRef}
        onChange={handleFileSelect}
        className="hidden"
      />

      <input
        type="file"
        accept="video/*"
        multiple
        ref={videoInputRef}
        onChange={handleFileSelect}
        className="hidden"
      />

      <input
        type="file"
        accept="audio/*"
        multiple
        ref={audioInputRef}
        onChange={handleFileSelect}
        className="hidden"
      />

      <input
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.tar,.gz,.json,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/zip"
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
        onSendVoiceNote={(voiceContent) => {
          const targetRoom = activeChatPeer ? `dm_${activeChatPeer.userId}` : roomId;
          const isEnc = Boolean(activeChatPeer && activeChatPeer.userId !== 999);
          onSendMessage(voiceContent, null, isEnc, targetRoom, undefined, voiceContent);
        }}
        onTriggerPhotoInput={handleTriggerPhotoInput}
        onTriggerVideoInput={handleTriggerVideoInput}
        onTriggerAudioInput={handleTriggerAudioInput}
        onTriggerDocInput={handleTriggerDocInput}
        isPrivateSublounge={isPrivateSublounge}
        isMember={isMember}
        onJoinLounge={onJoinLounge}
      />
    </div>
  );
}
