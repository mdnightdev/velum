import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Trash2, ArrowLeft, ChevronLeft, ShieldAlert, Smile, AlertCircle, 
  Paperclip, Mic, Square, Play, Pause, FileIcon, X, Check, CheckCheck, Menu, Copy, Plus, Flag, Bell, Lock, Pencil, Pin, Forward, Reply,Search
} from 'lucide-react';
import { Message, stripAt } from '../types';
import { EncryptionContext } from '../services/encryptionService';
import ProfileCard from './ProfileCard';
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
import { streamFileDirectToCloudStorage } from '../utils/mediaPipeline';
import logoSvg from '../assets/logo.svg?raw';
import { useLanguage } from '../i18n/LanguageContext';
import { AudioMessagePlayer } from './AudioMessagePlayer';
import { SecureImageCard } from './SecureImageCard';
import { parseAttachment, parseVoiceNote } from '../utils/messageParser';
import { getSessionId } from '../utils/auth';
import { MessageStatusTicks } from './MessageStatusTicks';
import { requestNotificationPermission, sendDesktopNotification } from '../utils/notifications';
import { createLogger } from '../utils/logger';

const log = createLogger('ChatArea');

interface LinkPreviewData {
  url: string;
  title: string;
  description?: string;
  image?: string;
}

function LinkPreviewCard({ url }: { url: string }) {
  const [data, setData] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchPreview = async () => {
      try {
        setLoading(true);
        const sId = getSessionId();
        const res = await fetch(`/v2/lounges/link-preview?url=${encodeURIComponent(url)}`, {
          headers: { 'Authorization': `Bearer ${sId}` }
        });
        if (!res.ok) throw new Error('Preview fetch failed');
        const json = await res.json();
        if (active) {
          setData(json);
          if (!json.title && !json.image) {
            setFailed(true);
          }
        }
      } catch (e) {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchPreview();
    return () => {
      active = false;
    };
  }, [url]);

  if (failed) return null;

  if (loading) {
    return (
      <div className="mt-2.5 max-w-sm rounded-xl border border-white-5 bg-white-5/20 p-3 animate-pulse flex flex-col gap-2">
        <div className="w-full h-32 bg-white-5 rounded-lg" />
        <div className="h-4 bg-white-10 rounded w-3/4" />
        <div className="h-3 bg-white-5 rounded w-5/6" />
      </div>
    );
  }

  if (!data) return null;

  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch (e) {
    hostname = 'link';
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2.5 max-w-sm rounded-xl border border-white-5 bg-velum-900/40 hover:bg-velum-900/60 hover:border-accent/30 transition duration-200 block overflow-hidden text-left select-none group shadow-lg cursor-pointer"
    >
      {data.image && (
        <div className="w-full h-36 overflow-hidden bg-black/20 border-b border-white-5 relative">
          <img 
            src={data.image} 
            alt="" 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      )}
      <div className="p-3 flex flex-col gap-1">
        <span className="text-[9px] font-mono text-accent uppercase tracking-wider font-bold">
          {hostname}
        </span>
        <h4 className="text-[12px] font-bold text-white leading-snug line-clamp-2">
          {data.title}
        </h4>
        {data.description && (
          <p className="text-[10.5px] text-text-secondary leading-normal line-clamp-2">
            {data.description}
          </p>
        )}
      </div>
    </a>
  );
}

interface ChatAreaProps {
  currentUserId: number;
  currentUsername: string;
  currentUserRole: string;
  roomId: string;
  wsConnected: boolean;
  messages: Message[];
  onSendMessage: (content: string, burnSeconds: number | null, isEncrypted: boolean, targetRoomId?: string, replyTo?: string | number) => void;
  onSendTyping?: (isTyping: boolean) => void;
  onRoomKick: (targetUserId: number) => void;
  onRoomMute: (targetUserId: number, mute: boolean) => void;
  onSendReaction?: (messageId: string, roomId: string, emoji: string) => void;
  onEditMessage?: (messageId: string, roomId: string, content: string) => void;
  onDeleteMessage?: (messageId: string, roomId: string) => void;
  onPinMessage?: (messageId: string, roomId: string, pin: boolean) => void;
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
}
const SYSTEM_ROLES: Record<number, { name: string; style: string }> = {
  1: { name: 'MIDNIGHT (executive)', style: 'bg-velum-700 border border-velum-600 text-text-primary rounded-2xl rounded-tl-none' },
  2: { name: 'Lexie (Administrator)', style: 'bg-velum-750 border border-velum-600 text-text-primary rounded-2xl rounded-tl-none' },
  999: { name: 'VELUM', style: 'bg-velum-800 border border-velum-600 text-text-primary rounded-2xl rounded-tl-none' },
};

function getSenderIdentity(msg: Message) {
  if (SYSTEM_ROLES[msg.user_id]) {
    return { cleanName: SYSTEM_ROLES[msg.user_id].name, isSpecialTheme: true, customBubbleClass: SYSTEM_ROLES[msg.user_id].style };
  }
  return { cleanName: stripAt(msg.username || 'Client'), isSpecialTheme: false, customBubbleClass: '' };
}

// formatLastSeen moved to ChatHeader.tsx

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
}: ChatAreaProps) {
  const { t } = useLanguage();

  const {
    inputText,
    setInputText,
    selectedAttachment,
    setSelectedAttachment,
    fileInputRef,
    textareaRef,
    clearInput
  } = useMessageInput({ roomId, activeChatPeer });

  const {
    editingMessageId,
    setEditingMessageId,
    longPressedMsgId,
    setLongPressedMsgId,
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
    handleCopyMessage,
    handleStartEdit: actionStartEdit,
    handleCancelEdit: actionCancelEdit
  } = useMessageActions();

  const rawContentsMap = useRef<Map<string, string>>(new Map());

  const { isTyping, setIsTyping, typingPeer } = useTypingStatus({
    inputText,
    onSendTyping,
    roomId,
    currentUserId,
    activeChatPeer
  });

  const { peerPresence } = usePeerPresence({ activeChatPeer });

  const {
    messagesEndRef,
    scrollContainerRef,
    isScrolledUp,
    handleScroll,
    scrollToBottom,
    handleScrollToMessage
  } = useMessageScroll({ messagesLength: messages.length, typingPeer });

  const {
    hasPendingNomination,
    isSubmittingNominationAction,
    handleNominationAction
  } = useSupportNomination({ activeChatPeer });

  const [activePinIndex, setActivePinIndex] = useState<number>(0);
  const [showAllPins, setShowAllPins] = useState<boolean>(false);

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

  // Audio playback hook
  const {
    playingWaveforms,
    waveformAudioProg,
    handleTogglePlayWave
  } = useAudioPlayback();

  const [popoverPeer, setPopoverPeer] = useState<{userId: number, username: string, messageId: string, displayName?: string, bio?: string, location?: string, joinedDate?: string, status?: string, isMuted?: boolean, isBlocked?: boolean, avatar?: string, stats?: { loungesCount: number, connectionsCount: number }} | null>(null);
  // Keep track of messages we have already called onMarkAsRead for in this mount/session
  const markedMessageIdsRef = useRef<Set<string>>(new Set());

  // Reset marked messages registry when switching chat rooms/peers
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
    roomId
  });

  // Channel details title helper (No '@' prefixes)
  const chatTitle = activeChatPeer
    ? stripAt(activeChatPeer.username)
    : roomName
      ? roomName.replace(/^#\s*/, '')
      : (roomId.startsWith('#') ? roomId.slice(1) : roomId);

  const activePeerId = activeChatPeer?.userId;

  // Filter messages based on chat context
  const conversationMessages = messages.filter(m => {
    if (activePeerId) {
      const otherId = activePeerId;
      if (otherId === 999) {
        return m.room_id === `dm_velum_${currentUserId}`;
      }
      const isPeerFromMe = m.user_id === currentUserId && (m.room_id === `dm_${otherId}` || m.room_id === `dm_${currentUserId}_${otherId}` || (m as any)._dm_target === otherId);
      const isPeerToMe = m.user_id === otherId && (m.room_id === `dm_${currentUserId}` || m.room_id === `dm_${otherId}_${currentUserId}` || (m as any)._dm_target === currentUserId);
      return isPeerFromMe || isPeerToMe || m.room_id?.includes(`dm_${Math.min(currentUserId, otherId)}_${Math.max(currentUserId, otherId)}`);
    } else {
      return m.room_id === roomId || (!m.room_id && m.lounge_id === roomId);
    }
  });

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

  // Attachment actions hook
  const {
    handleTriggerFileInput,
    handleDismissAttachment,
    handleFileSelect
  } = useAttachmentActions({
    fileInputRef,
    setSelectedAttachment,
    onSendMessage
  });

  // Recording operations
  const handleToggleRecording = async () => {
    if (!isRecording) {
      await startRecording();
    } else {
      stopRecording(async (audioBase64, durationSeconds) => {
        try {
          const response = await fetch(`data:audio/webm;base64,${audioBase64}`);
          const blob = await response.blob();
          
          const url = await streamFileDirectToCloudStorage(blob, 'media', 'webm');
          onSendMessage(`[Voice Note  duration:${durationSeconds}s url:${url}]`, null, false);
        } catch (err) {
          log.error('Audio upload failed', { error: (err as Error).message });
          onSendMessage(`[Voice Note  duration:${durationSeconds}s data:audio/webm;base64,${audioBase64}]`, null, false);
        }
      });
    }
  };

  const handleCancelRecording = () => {
    cancelRecording();
  };

  const handleStartEdit = (msg: Message) => {
    const activeContent = (msg.message_id && decryptedMap[msg.message_id]) || msg.content || '';
    actionStartEdit(msg, activeContent, setInputText);
  };

  const handleCancelEdit = () => {
    actionCancelEdit(setInputText);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedAttachment) return;

    if (editingMessageId) {
      if (onEditMessage) {
        const originalMsg = messages.find(m => m.message_id === editingMessageId);
        let finalEditContent = inputText.trim();
        if (originalMsg) {
          const activeContent = decryptedMap[editingMessageId] || originalMsg.content || '';
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
        const response = await fetch(selectedAttachment.data);
        const blob = await response.blob();
        
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
        onSendMessage(encryptedEnvelope, null, true, undefined, replyMsgId);
      } catch (err) {
        onSendMessage(textToSend, null, false, undefined, replyMsgId);
      }
    } else {
      onSendMessage(textToSend, null, false, undefined, replyMsgId);
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
  };

  // Request browser notification permissions on chat mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);



  // Dispatch desktop notification when new message arrives from peer
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

  // Mark messages as read when chat becomes visible
  const onMarkAsReadRef = useRef(onMarkAsRead);
  const markAllAsReadRef = useRef(onMarkAllAsRead);
  useEffect(() => {
    onMarkAsReadRef.current = onMarkAsRead;
    markAllAsReadRef.current = onMarkAllAsRead;
  }, [onMarkAsRead, onMarkAllAsRead]);

  useEffect(() => {
    if (!roomId) return;
    // When entering the chat, mark all messages as read
    markAllAsReadRef.current?.(roomId);
  }, [roomId]);

  useEffect(() => {
    if (!onMarkAsReadRef.current) return;
    
    // Only mark as read for DMs, not lounges/group chats
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
      // ONLY mark as read if the window is focused!
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

  const availableReactions = ['👍', '❤️', '🔥', '😮', '👏', '🤖'];

  const pinnedMessages = conversationMessages.filter(m => m.is_pinned && !m.deleted);
  const validPinIndex = Math.min(activePinIndex, Math.max(0, pinnedMessages.length - 1));
  const activePinnedMsg = pinnedMessages[validPinIndex];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent text-text-primary">
      <ChatHeader
        wsConnected={wsConnected}
        isMobile={isMobile}
        onBackToDeck={onBackToDeck}
        activeChatPeer={activeChatPeer}
        chatTitle={chatTitle}
        peerPresence={peerPresence}
        conversationMessages={conversationMessages}
        onSearchToggle={() => setShowSearch(!showSearch)}
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
      {/* Primary Message Log area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 chat-wallpaper"
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
          conversationMessages.map((msg,index) => {
            const isMe = msg.user_id === currentUserId;
            const { cleanName, isSpecialTheme, customBubbleClass } = getSenderIdentity(msg);

          const activeContent = (msg.message_id && decryptedMap[msg.message_id]) || msg.content || '';

          // Check for voice note payload
          const isVoiceNote = !msg.deleted && activeContent && activeContent.startsWith('[Voice Note');

          // Check for attachments
          const isAttachment = !msg.deleted && activeContent && activeContent.includes('[Attachment:');
            
         const attachments = isAttachment ? parseAttachment(activeContent) : [];
const firstAttachment = attachments[0];

const parsedAttachmentName = firstAttachment?.name || '';
const parsedAttachmentSize = firstAttachment?.size || '';
const parsedAttachmentType = firstAttachment?.type || '';
const parsedAttachmentData = firstAttachment?.data || '';
const parsedMsgContent = firstAttachment ? (firstAttachment.caption || '') : activeContent;

const isImageCard = attachments.length > 0 && attachments.every((att) => 
  att.type.startsWith('image/') ||
  att.data.startsWith('data:image/') ||
  att.data.startsWith('http') ||
  /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(att.name) ||
  /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(att.data)
);

            return (
              <div
              	 key={msg.message_id || msg.id || msg.nonce || (msg.created_at ? `${msg.user_id}-${msg.created_at}` : undefined) || `msg-${index}`}
                 id={`msg-${msg.message_id}`}
                 className={`flex max-w-[85%] group relative gap-2 select-none ${isMe ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
                 data-message-id={msg.message_id}
                 style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
                 onTouchStart={() => handleTouchStart(msg.message_id)}
                 onTouchEnd={handleTouchEnd}
                 onTouchMove={handleTouchEnd}
                 onContextMenu={(e) => e.preventDefault()}
              >
                {/* Message Hover Actions Bar */}
                {!msg.deleted && (
                  <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1.5 z-45 bg-bg-hover-actions border border-white-5 p-1 rounded-lg backdrop-blur-[var(--blur-backdrop-sm)] ${
                    longPressedMsgId === msg.message_id ? 'opacity-100' : ''
                  } ${
                    isMe ? 'right-full mr-2' : 'left-full ml-2'
                  }`}>
                    <button
                      onClick={async () => {
                        const reason = prompt("Enter the reason for reporting this message:");
                        if (reason === null) return;
                        if (!reason.trim()) {
                          alert("Reporting cancelled: A reason is mandatory.");
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
                            alert("Message reported successfully to system administrators.");
                          } else {
                            const errData = await res.json();
                            alert(errData.error || "Failed to submit report.");
                          }
                        } catch {
                          alert("Error reporting message.");
                        }
                      }}
                      className="p-1 rounded hover:bg-white-5 text-text-secondary hover:text-alert-error transition cursor-pointer"
                      title="Report Message"
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {!isMe && (
                  <div className="flex-shrink-0 mt-auto mb-5 relative z-[60]">
                    <div className="cursor-pointer w-7 h-7 rounded-full bg-velum-800 border border-accent/30 flex items-center justify-center font-bold text-accent text-[10px] overflow-hidden hover:bg-text-primary/5 transition-colors" onClick={async (e) => {
                       e.stopPropagation();
                       setPopoverPeer({
                         userId: msg.user_id,
                         username: cleanName,
                         messageId: msg.message_id,
                         displayName: cleanName,
                         avatar: msg.avatar || "", // <--- ADD THIS
                         bio: "",
                         location: "",
                         joinedDate: "",
                         isMuted: false,
                         isBlocked: false
                       });
                        try {
                          const sId = getSessionId();
                         const res = await fetch(`/v2/user/${msg.user_id}/profile`, {
                           headers: { 'Authorization': `Bearer ${sId}` }
                         });
                         if (res.ok) {
                           const data = await res.json();
                           setPopoverPeer((prev: any) => {
                             if (prev && prev.userId === msg.user_id && prev.messageId === msg.message_id) {
                               return {
                                 ...prev,
                                 displayName: data.displayName || cleanName,
                                 bio: data.bio || "",
                                 location: data.location || "",
                                 joinedDate: data.created_at ? new Date(data.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : "",
                                 status: data.status || "Active",
                                 isMuted: !!data.isMuted,
                                 isBlocked: !!data.isBlocked,
                                 avatar: data.avatar || "",
                                 stats: data.stats || { loungesCount: 0, connectionsCount: 0 }
                               };
                             }
                             return prev;
                           });
                         }
                       } catch (err) {}
                    }}>
{msg.avatar ? (
  <img src={msg.avatar} alt={cleanName} className="w-full h-full object-cover" />
) : (
  <span className="text-[10px] font-mono font-bold text-accent uppercase tracking-wider">{cleanName.slice(0, 2).toUpperCase()}</span>
)}
                    </div>
                    {popoverPeer && popoverPeer.messageId === msg.message_id && (
                      <div className="absolute top-1/2 left-full -translate-y-1/2 ml-3" onClick={(e) => e.stopPropagation()}>
                        <ProfileCard
                          user={{
                            userId: popoverPeer.userId,
                            username: popoverPeer.username, // keep username as identifier
                            displayName: popoverPeer.displayName, // display name as main name
                            avatarUrl: popoverPeer.avatar || "",
                            bio: popoverPeer.bio || "",
                            location: popoverPeer.location || "",
                            joinedDate: popoverPeer.joinedDate || "",
                            status: popoverPeer.status || "Active",
                            isMuted: !!popoverPeer.isMuted,
                            isBlocked: !!popoverPeer.isBlocked,
                            stats: popoverPeer.stats || {
                              loungesCount: 0,
                              connectionsCount: 0
                            }
                          }}
                          variant="popover"
                          onClose={() => setPopoverPeer(null)}
                          onReport={async () => {
                            const reason = prompt(`Specify the misconduct reason to report ${popoverPeer.username}:`);
                            if (reason === null) return;
                            if (!reason.trim()) {
                              alert("Reporting cancelled: A reason is mandatory.");
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
                                body: JSON.stringify({ targetUserId: popoverPeer.userId, reason: reason.trim() })
                              });
                              if (res.ok) {
                                alert("User reported successfully to system administrators.");
                              } else {
                                const errData = await res.json();
                                alert(errData.error || "Failed to submit report.");
                              }
                            } catch {
                              alert("Error reporting user.");
                            }
                            setPopoverPeer(null);
                          }}
                          onMessage={() => {
                            setPopoverPeer(null);
                          }}
                          onMute={async () => {
                            try {
                              const sId = getSessionId();
                              const res = await fetch(`/v2/user/${popoverPeer.userId}/mute`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${sId}` }
                              });
                              if (res.ok) {
                                const willBeMuted = !popoverPeer.isMuted;
                                setPopoverPeer({...popoverPeer, isMuted: willBeMuted});
                                if (willBeMuted) {
                                  alert(`Muted ${popoverPeer.username}. They can no longer disturb you.`);
                                } else {
                                  alert(`Unmuted ${popoverPeer.username}.`);
                                }
                              }
                            } catch(e) {}
                          }}
                          onBlock={async () => {
                            try {
                              const sId = getSessionId();
                              const res = await fetch(`/v2/user/${popoverPeer.userId}/block`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${sId}` }
                              });
                              if (res.ok) {
                                const willBeBlocked = !popoverPeer.isBlocked;
                                setPopoverPeer({...popoverPeer, isBlocked: willBeBlocked});
                                if (willBeBlocked) {
                                  alert(`Blocked ${popoverPeer.username}. This peer is now permanently purged from your view.`);
                                  if (onBackToDeck) onBackToDeck();
                                } else {
                                  alert(`Unblocked ${popoverPeer.username}.`);
                                }
                              }
                            } catch(e) {}
                          }}
                          onDeleteChat={async () => {
                            try {
                              const sId = getSessionId();
                              const res = await fetch(`/v2/user/${popoverPeer.userId}/chat`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${sId}` }
                              });
                              if (res.ok) {
                                alert(`Chat with ${popoverPeer.username} securely deleted and purged.`);
                                if (onBackToDeck) onBackToDeck();
                              }
                            } catch(e) {}
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
                <div className={`flex flex-col max-w-full ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Content Bubble Card */}
                  <div className={
                    isVoiceNote || isImageCard
                      ? "relative font-sans text-[13px] selectable-text"
                      : `px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed break-words font-sans relative selectable-text ${
                          isSpecialTheme && customBubbleClass
                            ? customBubbleClass
                            : isMe 
                              ? 'bg-bubble-me text-bubble-me-text rounded-br-sm' 
                              : 'bg-bubble-peer text-bubble-peer-text border border-bubble-peer-border rounded-bl-sm'
                        } ${msg.deleted ? 'italic text-text-secondary opacity-60 font-mono text-[10px]' : ''}`
                  }>
                  
                  {msg.deleted ? (
                    'Message deleted by sender'
                  ) : (
                    <>
                      {msg.reply_to && (() => {
                        const repliedMsg = conversationMessages.find(
                          m => String(m.db_message_id) === String(msg.reply_to) || String(m.message_id) === String(msg.reply_to)
                        );
                        let replyName = 'User';
                        let replyText = 'Original message';
                        if (repliedMsg) {
                          replyName = getSenderIdentity(repliedMsg).cleanName;
                          replyText = getDecryptedText(repliedMsg);
                        } else if (msg.reply_preview) {
                          replyName = stripAt(msg.reply_preview.username || 'User');
                          replyText = msg.reply_preview.content;
                        }
                        return (
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleScrollToMessage(String(msg.reply_to));
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
        timestamp={new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      >
        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <MessageStatusTicks
          status={msg.status}
          isMe={isMe}
          onRetry={() => {
            if (msg.status === 'failed') {
              onSendMessage(activeContent, null, !!(msg.is_encrypted || (msg as any).isEncrypted));
              onDeleteMessage?.(msg.message_id, msg.room_id || roomId);
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
                                <div className="flex items-center gap-3 p-3 bg-velum-900/40 border border-white-5 rounded-xl mb-2.5 select-none text-left cursor-pointer hover:bg-velum-900/60 transition"
                                     onClick={() => {
                                       const link = document.createElement('a');
                                       link.href = parsedAttachmentData;
                                       link.download = parsedAttachmentName;
                                       link.click();
                                     }}>
                                  <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                    <FileIcon className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[11px] font-bold text-white block truncate">{parsedAttachmentName}</span>
                                    <span className="text-[8.5px] font-mono text-text-secondary block uppercase">{parsedAttachmentSize} • Click to download</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3 p-3 bg-velum-900/40 border border-white-5 rounded-xl mb-2.5 select-none text-left">
                                  <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                    <FileIcon className="w-4 h-4" />
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
                              <p className="whitespace-pre-wrap">
                                {parsedMsgContent}
                                {msg.is_edited && (
                                  <span className="text-[10px] opacity-45 ml-1.5 select-none font-sans lowercase" title={msg.edited_at ? `Edited at ${new Date(msg.edited_at).toLocaleTimeString()}` : 'Edited'}>
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
                                          <span>Copied Secure Key</span>
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

                  {/* Render Reactions */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {Object.entries(msg.reactions).map(([emoji, users]) => (
                        users.length > 0 && (
                          <button
                            key={emoji}
                            onClick={() => onSendReaction?.(msg.db_message_id ? String(msg.db_message_id) : msg.message_id, msg.room_id || roomId, emoji)}
                            className="bg-text-primary/5 border border-white-5 hover:bg-text-primary/10 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-mono transition"
                            title={users.join(', ')}
                          >
                            <span>{emoji}</span>
                            <span className="text-[8px] opacity-70">{users.length}</span>
                          </button>
                        )
                      ))}
                    </div>
                  
)}
                  {/* Absolute positioning inline toolbox on hover */}
                  {!msg.deleted && (
                    <div className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 p-1 bg-velum-750 border border-white-10 rounded-lg shadow-xl z-20 ${
                      longPressedMsgId === msg.message_id ? 'opacity-100' : ''
                    } ${
                      isMe 
                        ? roomId.startsWith('dm_') ? '-left-[190px]' : '-left-[160px]'
                        : roomId.startsWith('dm_') ? '-right-[130px]' : '-right-[100px]'
                    }`}>
                      <button
                        onClick={() => setShowEmojisForMsg(showEmojisForMsg === msg.message_id ? null : msg.message_id)}
                        className="text-text-secondary hover:text-white p-1 rounded"
                        title="Add reaction"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setReplyingToMessage(msg)}
                        className="text-text-secondary hover:text-white p-1 rounded"
                        title="Reply to message"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                      {onPinMessage && (
                        <button
                          onClick={() => onPinMessage(msg.db_message_id ? String(msg.db_message_id) : msg.message_id, msg.room_id || roomId, !msg.is_pinned)}
                          className={`${msg.is_pinned ? 'text-accent' : 'text-text-secondary hover:text-white'} p-1 rounded`}
                          title={msg.is_pinned ? "Unpin message" : "Pin message"}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {roomId.startsWith('dm_') && (
                        <button
                          onClick={() => setForwardingMessage(msg)}
                          className="text-text-secondary hover:text-white p-1 rounded"
                          title="Forward message"
                        >
                          <Forward className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isMe && onEditMessage && (
                        <button
                          onClick={() => handleStartEdit(msg)}
                          className="text-text-secondary hover:text-white p-1 rounded"
                          title="Edit message"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isMe && onDeleteMessage && (
                        <button
                          onClick={() => onDeleteMessage(msg.message_id, msg.room_id || roomId)}
                          className="text-alert-error hover:text-alert-error p-1 rounded"
                          title="Delete message"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  
)}
                  {/* Animated Emoji Reaction Drawer overlays */}
                  {showEmojisForMsg === msg.message_id && (
                    <div className={`absolute top-8 bg-velum-750 border border-white-10 p-1.5 rounded-lg flex gap-1.5 shadow-2xl z-40 transition-all ${
                      isMe ? 'right-0' : 'left-0'
                    }`}>
                      {availableReactions.map((reaction) => (
                        <button
                          key={reaction}
                          onClick={() => {
                            if (onSendReaction) onSendReaction(msg.db_message_id ? String(msg.db_message_id) : msg.message_id, msg.room_id || roomId, reaction);
                            setShowEmojisForMsg(null);
                          }}
                          className="hover:scale-125 transition-transform p-1.5 text-sm"
                        >
                          {reaction}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Message Meta (Below Bubble) */}
                <div className={`flex items-center gap-1.5 mt-1 mb-2 text-[10px] font-medium text-text-secondary ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {msg.is_pinned && (
                    <span title="Pinned message" className="flex items-center">
                      <Pin className="w-2.5 h-2.5 text-accent shrink-0" />
                    </span>
                  )}
                  <MessageStatusTicks 
                    status={msg.status} 
                    isMe={isMe} 
                    onRetry={() => {
                      if (msg.status === 'failed') {
                        onSendMessage(activeContent, null, !!(msg.is_encrypted || (msg as any).isEncrypted));
                        onDeleteMessage?.(msg.message_id, msg.room_id || roomId);
                      }
                    }}
                  />

                  {!isMe && (currentUserRole === 'LOGIN_ADMIN' || currentUserRole === 'SUPPORT_ADMIN') && (
                    <div className="hidden group-hover:flex items-center gap-1 ml-2">
                      <button
                        onClick={() => onRoomMute?.(msg.user_id, true)}
                        className="text-alert-error hover:text-alert-error px-1 hover:underline text-[9px]"
                      >
                        Mute
                      </button>
                      <button
                        onClick={() => onRoomKick?.(msg.user_id)}
                        className="text-alert-error hover:text-alert-error px-1 hover:underline text-[9px]"
                      >
                        Kick
                      </button>
                    </div>
                  )}
                </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicators */}
      {typingPeer && (
        <div className="px-6 py-2 flex items-center gap-2 text-[9px] font-mono text-accent uppercase animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-accent block" />
          <span>{typingPeer} is typing secure signal...</span>
        </div>
      )}

      {/* Hidden Files Selectors */}
      <input
  type="file"
  accept="image/*"
  multiple
  ref={fileInputRef}
  onChange={handleFileSelect}
  className="hidden"
/>

      {/* Footer Text area form with safe-area inset bottom padding */}
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
        onSend={handleSend}
        onSendVoiceNote={(voiceContent) => onSendMessage(voiceContent, null, false)}
        onTriggerFileInput={handleTriggerFileInput}
        isPrivateSublounge={isPrivateSublounge}
      />
    </div>
  );
}
