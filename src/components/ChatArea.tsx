import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Trash2, ArrowLeft, ChevronLeft, ShieldAlert, Smile, AlertCircle, 
  Paperclip, Mic, Square, Play, Pause, FileIcon, X, Check, CheckCheck, Menu, Copy, Plus, Flag, Bell, Lock, Pencil
} from 'lucide-react';
import { Message, stripAt } from '../types';
import { encryptMessage, decryptMessage, EncryptionContext } from '../services/encryptionService';
import ProfileCard from './ProfileCard';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { ChatHeader } from './Chat/ChatHeader';
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

interface ChatAreaProps {
  currentUserId: number;
  currentUsername: string;
  currentUserRole: string;
  roomId: string;
  wsConnected: boolean;
  messages: Message[];
  onSendMessage: (content: string, burnSeconds: number | null, isEncrypted: boolean) => void;
  onSendTyping?: (isTyping: boolean) => void;
  onRoomKick: (targetUserId: number) => void;
  onRoomMute: (targetUserId: number, mute: boolean) => void;
  onSendReaction?: (messageId: string, roomId: string, emoji: string) => void;
  onEditMessage?: (messageId: string, roomId: string, content: string) => void;
  onDeleteMessage?: (messageId: string, roomId: string) => void;
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
  const [inputText, setInputText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const rawContentsMap = useRef<Map<string, string>>(new Map());
  
  // Attachment states
  const [selectedAttachment, setSelectedAttachment] = useState<{ name: string; size: string; type: string; data: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Room-specific drafts tracking
  const currentKey = activeChatPeer ? `dm_${activeChatPeer.userId}` : `room_${roomId}`;
  const prevKeyRef = useRef(currentKey);
  const draftsRef = useRef<Record<string, { text: string; attachment: any }>>({});

  useEffect(() => {
    const prevKey = prevKeyRef.current;
    
    if (prevKey !== currentKey) {
      // Save draft for previous conversation
      draftsRef.current[prevKey] = {
        text: inputText,
        attachment: selectedAttachment
      };

      // Load draft for new conversation
      const currentDraft = draftsRef.current[currentKey] || { text: '', attachment: null };
      setInputText(currentDraft.text);
      setSelectedAttachment(currentDraft.attachment);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      prevKeyRef.current = currentKey;
    }
  }, [currentKey, inputText, selectedAttachment]);

  const [isTyping, setIsTyping] = useState(false);
  const [typingPeer, setTypingPeer] = useState<string | null>(null);
  const [showEmojisForMsg, setShowEmojisForMsg] = useState<string | null>(null);
  const [peerPresence, setPeerPresence] = useState<string>('offline');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [decryptedContents, setDecryptedContents] = useState<Map<string, string>>(new Map());
  const [hasPendingNomination, setHasPendingNomination] = useState(false);
  const [isSubmittingNominationAction, setIsSubmittingNominationAction] = useState(false);

  useEffect(() => {
    if (activeChatPeer?.userId === 999) {
      const sessionId = getSessionId();
      fetch('/v2/user/nomination/pending', {
        headers: { 'Authorization': `Bearer ${sessionId}` }
      })
        .then(res => res.json())
        .then(data => {
          setHasPendingNomination(!!data.hasPending);
        })
        .catch(() => {});
    } else {
      setHasPendingNomination(false);
    }
  }, [activeChatPeer]);

  // Audio recording hook
  const {
    isRecording,
    recordingSeconds,
    micError,
    startRecording,
    stopRecording,
    cancelRecording,
    setMicError
  } = useAudioRecorder();

  // Visual audio waveform playing states
  const [playingWaveforms, setPlayingWaveforms] = useState<Record<string, boolean>>({});
  const [waveformAudioProg, setWaveformAudioProg] = useState<Record<string, number>>({});
  const [popoverPeer, setPopoverPeer] = useState<{userId: number, username: string, messageId: string, displayName?: string, bio?: string, location?: string, joinedDate?: string, status?: string, isMuted?: boolean, isBlocked?: boolean, avatar?: string, stats?: { loungesCount: number, connectionsCount: number }} | null>(null);
  const [decryptedMap, setDecryptedMap] = useState<Record<string, string>>({});

  // Active playing audio ref
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioMsgIdRef = useRef<string | null>(null);

  // Keep track of messages we have already called onMarkAsRead for in this mount/session
  const markedMessageIdsRef = useRef<Set<string>>(new Set());

  // Reset marked messages registry when switching chat rooms/peers
  useEffect(() => {
    markedMessageIdsRef.current.clear();
  }, [roomId, activeChatPeer?.userId]);

  // Asynchronous decryption effect for incoming messages
  useEffect(() => {
    let isMounted = true;
    const processDecryption = async () => {
      for (const m of messages) {
        if (m.content && m.message_id && !decryptedMap[m.message_id]) {
          const peerId = activeChatPeer?.userId || m.user_id;
          try {
            const context: EncryptionContext = {
              type: activeChatPeer ? 'direct' : 'lounge',
              roomId: m.room_id || roomId,
              peerUserId: peerId,
              isEncrypted: !!(m.is_encrypted || (m as any).isEncrypted)
            };
            const decrypted = await decryptMessage(m.content, context);
            if (isMounted && decrypted && decrypted !== m.content) {
              setDecryptedMap(prev => ({ ...prev, [m.message_id]: decrypted }));
            }
          } catch (err) {
            console.error('[ChatArea] Decryption error:', err);
          }
        }
      }
    };
    processDecryption();
    return () => { isMounted = false; };
  }, [messages, activeChatPeer?.userId, roomId]);

  useEffect(() => {
    if (!activeChatPeer) return;

    // Fetch user status initially
    const sessionId = getSessionId();
    fetch(`/v2/user/${activeChatPeer.userId}/status`, {
      headers: {
        'Authorization': `Bearer ${sessionId}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data) {
          setPeerPresence(data.last_seen_at || 'offline');
        }
      })
      .catch((err) => {
        // Ignore abort errors to prevent crashes
        if (err && err.name === 'AbortError') {
          return;
        }
        log.warn('Failed to fetch peer status', { error: (err as Error).message });
      });

    const handlePresence = (e: any) => {
      const { user_id, last_seen_at } = e.detail || {};
      if (activeChatPeer && user_id === activeChatPeer.userId) {
        setPeerPresence(last_seen_at || 'offline');
      }
    };

    window.addEventListener('velum-presence-change', handlePresence);
    return () => window.removeEventListener('velum-presence-change', handlePresence);
  }, [activeChatPeer]);

  const handleDeleteConversation = async () => {
    if (!activeChatPeer) return;
    if (!window.confirm("Are you sure you want to delete all chat logs and history with this peer? This action cannot be undone.")) return;
    
    const otherId = activeChatPeer.userId;
    const sId = getSessionId();
    const headers = {
      'Authorization': `Bearer ${sId}`,
      'Content-Type': 'application/json'
    };

    try {
      const res = await fetch(`/v2/user/${otherId}/chat`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to delete direct message conversation.");
      }
    } catch {
      alert("Network handshake failure during delete.");
    }
  };

  const handleNominationAction = async (action: 'accept' | 'decline') => {
    if (isSubmittingNominationAction) return;
    setIsSubmittingNominationAction(true);
    
    try {
      const sessionId = getSessionId();
      const res = await fetch(`/v2/user/nomination/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionId}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (res.ok) {
        alert(`Successfully ${action === 'accept' ? 'accepted' : 'declined'} support admin nomination.`);
        setHasPendingNomination(false);
      } else {
        const data = await res.json();
        alert(data.error || `Failed to ${action} nomination.`);
      }
    } catch {
      alert("Network error.");
    } finally {
      setIsSubmittingNominationAction(false);
    }
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      setIsScrolledUp(scrollHeight - scrollTop - clientHeight > 100);
    }
  };

  // Auto scroll to bottom
  const scrollToBottom = () => {
    if (!isScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Only scroll on messages length change, not all the time, and respect manual scroll up
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, typingPeer]);


  // Handle typing status broadcast with timeout
  useEffect(() => {
    if (!onSendTyping) return;

    let timer: any = null;

    if (inputText.length > 0) {
      if (!isTyping) {
        setIsTyping(true);
        onSendTyping(true);
      }

      // Reset the timer every time a new character is typed
      timer = setTimeout(() => {
        setIsTyping(false);
        onSendTyping(false);
      }, 3000);
    } else if (inputText.length === 0 && isTyping) {
      setIsTyping(false);
      onSendTyping(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [inputText, onSendTyping, isTyping]);



  // Sync peer typing alerts
  useEffect(() => {
    const handleStart = (e: any) => {
      const { room_id, username, userId } = e.detail || {};
      
      // Only show typing if:
      // 1. Not the current user
      // 2. Room matches (or no room_id specified for global)
      // 3. In DM mode, must match the active chat peer
      if (userId !== currentUserId) {
        if (activeChatPeer) {
          // DM mode: only show typing if it's from the chat peer
          if (userId === activeChatPeer.userId) {
            setTypingPeer(username);
          }
        } else {
          // Room mode: show typing if room matches
          if (!room_id || room_id === roomId) {
            setTypingPeer(username);
          }
        }
      }
    };
    const handleStop = (e: any) => {
      const { room_id, username, userId } = e.detail || {};
      
      // Only clear typing if it's from the same user
      if (userId !== currentUserId) {
        if (activeChatPeer) {
          // DM mode: only clear if it's the chat peer
          if (userId === activeChatPeer.userId && typingPeer === username) {
            setTypingPeer(null);
          }
        } else {
          // Room mode: clear if room matches
          if ((!room_id || room_id === roomId) && typingPeer === username) {
            setTypingPeer(null);
          }
        }
      }
    };

    window.addEventListener('velum-typing-start', handleStart);
    window.addEventListener('velum-typing-stop', handleStop);

    return () => {
      window.removeEventListener('velum-typing-start', handleStart);
      window.removeEventListener('velum-typing-stop', handleStop);
    };
  }, [roomId, currentUserId, activeChatPeer, typingPeer]);

  // Attachment operations
  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const sizeStr = file.size > 1024 * 1024 
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
        : `${(file.size / 1024).toFixed(0)} KB`;
      
      // Check file size limit (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit. Please select a smaller file.');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setSelectedAttachment({
          name: file.name,
          size: sizeStr,
          type: file.type,
          data: base64
        });
      };
      reader.onerror = () => {
        alert('Failed to read file. Please try again.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDismissAttachment = () => {
    setSelectedAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
    const timestampMs = typeof msg.timestamp === 'number' ? msg.timestamp : new Date(msg.timestamp).getTime();
    const timeDiffMinutes = (Date.now() - timestampMs) / (1000 * 60);
    if (timeDiffMinutes > 15) {
      alert('Message editing window (15 minutes) has expired.');
      return;
    }
    setEditingMessageId(msg.message_id);
    const rawContent = (msg.message_id && decryptedMap[msg.message_id]) || msg.content || '';
    const activeContent = decryptedContents.get(msg.message_id) || rawContent;
    const attachment = activeContent.includes('[Attachment:') ? parseAttachment(activeContent) : null;
    const plainText = attachment ? (attachment.caption || '') : activeContent;
    setInputText(plainText);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setInputText('');
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedAttachment) return;

    if (editingMessageId) {
      if (onEditMessage) {
        const originalMsg = messages.find(m => m.message_id === editingMessageId);
        let finalEditContent = inputText.trim();
        if (originalMsg) {
          const rawContent = decryptedMap[editingMessageId] || originalMsg.content || '';
          const activeContent = decryptedContents.get(editingMessageId) || rawContent;
          if (activeContent.includes('[Attachment:')) {
            const attachmentPart = activeContent.split(']')[0] + ']';
            finalEditContent = `${attachmentPart} ${inputText.trim()}`.trim();
          }
        }
        onEditMessage(editingMessageId, roomId, finalEditContent);
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

    if (activeChatPeer && activeChatPeer.userId !== 999) {
      try {
        const context: EncryptionContext = { type: 'direct', peerUserId: activeChatPeer.userId };
        const encryptedEnvelope = await encryptMessage(textToSend, context);
        onSendMessage(encryptedEnvelope, null, true);
      } catch (err) {
        onSendMessage(textToSend, null, false);
      }
    } else {
      onSendMessage(textToSend, null, false);
    }
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

  // Toggle waveform simulated audio playback
  const handleTogglePlayWave = (msgId: string, durationStr: string, audioData: string, audioType: string = 'audio/webm') => {
    const isPlaying = !!playingWaveforms[msgId];
    
    // Always stop the currently playing audio first if any
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
      } catch (e) {}
      currentAudioRef.current = null;
    }
    
    // Stop all other playing states if starting a new one
    setPlayingWaveforms(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        next[k] = false;
      });
      return next;
    });

    if (isPlaying) {
      setPlayingWaveforms(prev => ({ ...prev, [msgId]: false }));
      setWaveformAudioProg(prev => ({ ...prev, [msgId]: 0 }));
      currentAudioMsgIdRef.current = null;
    } else {
      setPlayingWaveforms(prev => ({ ...prev, [msgId]: true }));
      currentAudioMsgIdRef.current = msgId;
      
      if (audioData) {
        // Play actual audio dynamically via memory instantiation to avoid pre-mounting DOM nodes
        try {
          const audioSrc = audioData.startsWith('/') ? audioData : `data:${audioType};base64,${audioData}`;
          const audio = new Audio();
          audio.preload = 'none'; // Absolutely do not preload unless explicitly playing
          audio.src = audioSrc;
          currentAudioRef.current = audio;
          
          audio.onended = () => {
            setPlayingWaveforms(prev => ({ ...prev, [msgId]: false }));
            setWaveformAudioProg(prev => ({ ...prev, [msgId]: 0 }));
            if (currentAudioMsgIdRef.current === msgId) {
              currentAudioRef.current = null;
              currentAudioMsgIdRef.current = null;
            }
          };
          
          audio.ontimeupdate = () => {
            if (audio.duration) {
              const progress = (audio.currentTime / audio.duration) * 100;
              setWaveformAudioProg(prev => ({ ...prev, [msgId]: progress }));
            }
          };

          audio.onerror = (e) => {
            log.warn('Audio playback error, falling back to simulated playback', { error: String(e) });
            audio.onended = null;
            audio.ontimeupdate = null;
            runSimulatedPlayback(msgId, durationStr);
          };

          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(err => {
              log.warn('Playback interrupted', { error: String(err) });
              audio.onended = null;
              audio.ontimeupdate = null;
              runSimulatedPlayback(msgId, durationStr);
            });
          }
        } catch (err) {
          log.warn('Audio setup failed', { error: (err as Error).message });
          runSimulatedPlayback(msgId, durationStr);
        }
      } else {
        // Fallback to simulated playback if no audio data
        runSimulatedPlayback(msgId, durationStr);
      }
    }
  };

  const runSimulatedPlayback = (msgId: string, durationStr: string) => {
    const durationS = parseInt(durationStr, 10) || 5;
    let p = 0;
    const interval = setInterval(() => {
      // Check if we are still supposed to be playing this waveform
      setPlayingWaveforms(prev => {
        if (!prev[msgId]) {
          clearInterval(interval);
          return prev;
        }
        
        p += 5;
        if (p > 100) {
          clearInterval(interval);
          setWaveformAudioProg(v => ({ ...v, [msgId]: 0 }));
          return { ...prev, [msgId]: false };
        } else {
          setWaveformAudioProg(v => ({ ...v, [msgId]: p }));
          return prev;
        }
      });
    }, (durationS * 1000) / 20);
  };

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

  // Request browser notification permissions on chat mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Decrypt messages when conversation changes (and re-decrypt if edited)
  useEffect(() => {
    const decryptMessages = async () => {
      const updates = new Map<string, string>();
      for (const msg of conversationMessages) {
        const rawContent = (msg.message_id && decryptedMap[msg.message_id]) || msg.content || '';
        const hasDecrypted = decryptedContents.has(msg.message_id);
        const prevRaw = rawContentsMap.current.get(msg.message_id);
        
        if (rawContent && (!hasDecrypted || prevRaw !== rawContent)) {
          try {
            const context: EncryptionContext = {
              type: activeChatPeer ? 'direct' : 'lounge',
              roomId: msg.room_id || roomId,
              peerUserId: activeChatPeer?.userId,
              isEncrypted: msg.is_encrypted || (msg as any).isEncrypted
            };
            const decrypted = await decryptMessage(rawContent, context);
            updates.set(msg.message_id, decrypted);
            rawContentsMap.current.set(msg.message_id, rawContent);
          } catch (err) {
            console.error('[ChatArea] Decryption error for message', msg.message_id, err);
          }
        }
      }
      if (updates.size > 0) {
        setDecryptedContents(prev => new Map([...prev, ...updates]));
      }
    };
    decryptMessages();
  }, [conversationMessages, activeChatPeer?.userId, roomId]);

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

  const availableReactions = ['Like', 'Love', 'Fire', 'Wow', 'Clap', 'Bot'];

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
      />
      {/* Primary Message Log area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto p-4 md:p-6 space-y-4 ${isDark ? 'bg-transparent' : 'bg-velum-900'}`}
      >
        {conversationMessages.map((msg,index) => {
          const isMe = msg.user_id === currentUserId;
            const { cleanName, isSpecialTheme, customBubbleClass } = getSenderIdentity(msg);

          const rawContent = (msg.message_id && decryptedMap[msg.message_id]) || msg.content || '';

          // Use decrypted content from state, fall back to raw content
          const activeContent = decryptedContents.get(msg.message_id) || rawContent;

          // Check for voice note payload
          const isVoiceNote = !msg.deleted && activeContent && activeContent.startsWith('[Voice Note');

          // Check for attachments
          const isAttachment = !msg.deleted && activeContent && activeContent.includes('[Attachment:');
            
          const attachment = isAttachment ? parseAttachment(activeContent) : null;
          const parsedAttachmentName = attachment?.name || '';
          const parsedAttachmentSize = attachment?.size || '';
          const parsedAttachmentType = attachment?.type || '';
          const parsedAttachmentData = attachment?.data || '';
          const parsedMsgContent = attachment ? (attachment.caption || '') : activeContent;

          const isImageCard = isAttachment && !!parsedAttachmentData && (
            parsedAttachmentType.startsWith('image/') ||
            parsedAttachmentData.startsWith('data:image/') ||
            parsedAttachmentData.startsWith('http') ||
            /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(parsedAttachmentName) ||
            /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(parsedAttachmentData)
          );

            return (
              <div
              	 key={msg.message_id || msg.id || msg.nonce || (msg.created_at ? `${msg.user_id}-${msg.created_at}` : undefined) || `msg-${index}`}
                 className={`flex max-w-[85%] group relative gap-2 ${isMe ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
              >
                {/* Message Hover Actions Bar */}
                {!msg.deleted && (
                  <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1.5 z-45 bg-velum-850/90 border border-white-5 p-1 rounded-lg backdrop-blur-sm ${
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
                          const res = await fetch(`/v2/user/${msg.user_id}/report`, {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${sId}`,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ reason: reason.trim(), messageId: msg.message_id })
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
                      className="p-1 rounded hover:bg-white-5 text-text-secondary hover:text-red-400 transition cursor-pointer"
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
                            setPopoverPeer(null);
                          }}
                          onReport={async () => {
                            try {
                              const sId = getSessionId();
                              const res = await fetch(`/v2/user/${popoverPeer.userId}/report`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${sId}` }
                              });
                              if (res.ok) alert(`Dossier submitted. ${popoverPeer.username} reported to network security.`);
                            } catch(e) {}
                            setPopoverPeer(null);
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
                      ? "relative font-sans text-[13px]"
                      : `px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed break-words font-sans relative ${
                          isSpecialTheme && customBubbleClass
                            ? customBubbleClass
                            : isMe 
                              ? 'bg-velum-800 text-white rounded-br-sm' 
                              : 'bg-velum-800 text-text-primary rounded-bl-sm border border-white-5'
                        } ${msg.deleted ? 'italic text-text-secondary opacity-60 font-mono text-[10px]' : ''}`
                  }>
                  
                  {msg.deleted ? (
                    'Message deleted by sender'
                  ) : isVoiceNote ? (
                    <AudioMessagePlayer content={activeContent} isMe={isMe} />
                  ) : isImageCard ? (
                    <SecureImageCard
                      src={parsedAttachmentData}
                      name={parsedAttachmentName}
                      size={parsedAttachmentSize}
                      caption={parsedMsgContent}
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
                                  className="mt-3.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-status-online/30 bg-status-online/20 text-[10px] font-sans font-bold text-status-online hover:bg-status-online/20 hover:text-text-primary transition cursor-pointer uppercase tracking-wider"
                                >
                                  {isCopied ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span>Copied Secure Key</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 text-emerald-400 font-bold" />
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

                  {/* Render Reactions */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {Object.entries(msg.reactions).map(([emoji, users]) => (
                        users.length > 0 && (
                          <button
                            key={emoji}
                            onClick={() => onSendReaction?.(msg.message_id, msg.room_id || roomId, emoji)}
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
                      isMe ? '-left-28' : '-right-28'
                    }`}>
                      <button
                        onClick={() => setShowEmojisForMsg(showEmojisForMsg === msg.message_id ? null : msg.message_id)}
                        className="text-text-secondary hover:text-white p-1 rounded"
                        title="Add reaction"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>
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
                          className="text-red-400 hover:text-red-350 p-1 rounded"
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
                            if (onSendReaction) onSendReaction(msg.message_id, msg.room_id || roomId, reaction);
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
                        className="text-red-400 hover:text-red-300 px-1 hover:underline text-[9px]"
                      >
                        Mute
                      </button>
                      <button
                        onClick={() => onRoomKick?.(msg.user_id)}
                        className="text-red-400 hover:text-red-300 px-1 hover:underline text-[9px]"
                      >
                        Kick
                      </button>
                    </div>
                  )}
                </div>
                </div>
              </div>
            );
          })}
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
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
      />

      {/* Footer Text area form with safe-area inset bottom padding */}
      <div 
        className="px-4 pt-2 flex-shrink-0 bg-velum-850"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        {micError && (
          <div className="mb-3 p-3 rounded-xl border border-red-500/20 bg-red-950/10 flex items-start justify-between gap-4 font-mono text-[10px] text-red-400">
            <span className="whitespace-normal break-words flex-1 leading-relaxed">{micError}</span>
            <button 
              type="button" 
              onClick={() => setMicError(null)} 
              className="text-text-secondary hover:text-white font-mono font-bold cursor-pointer transition uppercase mt-0.5 shrink-0"
            >
              Dismiss
            </button>
          </div>
        
)}
        {/* Attachment slots list preview bar if selected */}
        {selectedAttachment && (
          selectedAttachment.type.startsWith('image/') ? (
            <div className="mb-4 relative inline-block group">
              <div className="w-32 h-32 rounded-2xl overflow-hidden border border-white-10 bg-velum-800 shadow-lg relative">
                <img 
                  src={selectedAttachment.data} 
                  alt="Draft upload" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <span className="text-[9px] font-bold text-white uppercase tracking-widest font-mono">
                    {selectedAttachment.size}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismissAttachment}
                className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition shadow-md cursor-pointer border border-velum-800 z-10 flex items-center justify-center"
                title="Remove image"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="mb-3 p-2.5 rounded-xl border border-accent/20 bg-accent/5 flex items-center justify-between gap-3 font-mono text-[10px]">
              <div className="flex items-center gap-2 truncate">
                <Paperclip className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="text-white font-bold truncate">{selectedAttachment.name}</span>
                <span className="text-text-secondary uppercase font-mono">({selectedAttachment.size})</span>
              </div>
              <button
                onClick={handleDismissAttachment}
                className="text-text-secondary hover:text-red-400 transition p-1 cursor-pointer"
                title="Remove Attachment"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        )}
        {isPrivateSublounge && (
          <div className="mb-2 px-2 text-[10px] font-mono text-text-disabled uppercase tracking-wider select-none">
             Sanctions in the parent lounge apply here automatically
          </div>
        
)}
        {/* Recording active overlay panel bar */}
        {isRecording ? (
          <div className="flex items-center justify-between p-3.5 rounded-full border border-red-500/20 bg-velum-800 font-mono text-xs">
            <div className="flex items-center gap-2.5 px-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white font-bold uppercase tracking-wider">RECORDING</span>
              <span className="text-red-400">0:{recordingSeconds.toString().padStart(2, '0')}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelRecording}
                className="px-3 py-1.5 rounded-full text-text-secondary hover:text-white uppercase text-[9px] font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleRecording}
                className="px-4 py-1.5 bg-accent text-black rounded-full font-bold flex items-center gap-1.5 uppercase text-[9px] cursor-pointer"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Send</span>
              </button>
            </div>
          </div>
        ) : roomId === `dm_velum_${currentUserId}` || activeChatPeer?.userId === 999 ? (
          <div className="w-full flex flex-col gap-3">
            <div className="w-full bg-white-5 border border-white-10 rounded-xl p-3.5 text-center text-xs font-sans text-text-secondary select-none">
              This is a one-way system broadcast channel.
            </div>
            {hasPendingNomination && (
              <div className="flex gap-3 justify-center items-center p-3 bg-velum-850 border border-white-5 rounded-xl">
                <span className="text-[10px] text-text-secondary font-mono uppercase tracking-wider">Nomination pending:</span>
                <button
                  type="button"
                  onClick={() => handleNominationAction('accept')}
                  disabled={isSubmittingNominationAction}
                  className="px-3.5 py-1.5 bg-bank-accent text-white hover:bg-bank-accent/80 font-bold rounded-lg uppercase text-[9px] cursor-pointer transition disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => handleNominationAction('decline')}
                  disabled={isSubmittingNominationAction}
                  className="px-3.5 py-1.5 bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500/30 font-bold rounded-lg uppercase text-[9px] cursor-pointer transition disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
          {editingMessageId && (
            <div className="w-full bg-velum-800 border border-white-5 rounded-xl px-4 py-2.5 mb-2.5 flex justify-between items-center text-[10px] text-text-secondary select-none font-mono tracking-wider">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                <span>EDITING MESSAGE</span>
              </div>
              <button 
                type="button"
                onClick={handleCancelEdit}
                className="text-rose-400 hover:text-rose-300 font-bold uppercase text-[9px] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
          {roomAccessLevel === 'ANNOUNCE' && !['SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'].includes(currentUserRole) ? (
            <div className="w-full bg-velum-800 border border-white-5 rounded-xl p-3 text-center text-[11px] text-text-secondary font-mono tracking-widest uppercase">
              🔒 Admins Only
            </div>
          ) : (
          <form onSubmit={handleSend} className="flex gap-3 items-center">
            
            <button
              type="button"
              onClick={handleTriggerFileInput}
              className="w-10 h-10 rounded-full bg-velum-800 border border-white-5 text-text-secondary hover:text-white hover:bg-velum-800 transition flex items-center justify-center shrink-0 cursor-pointer"
              title="Attach File"
            >
              <Plus className="w-5 h-5" />
            </button>

            <div className="flex-1 relative flex items-center">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={chatTitle ? t('chat.message_peer', 'Message {name}').replace('{name}', chatTitle) : t('chat.message_placeholder', 'Message...')}
                className="w-full bg-velum-800 border border-white-5 rounded-full pl-5 pr-24 py-3 text-[13px] text-white outline-none focus:border-accent/50 font-sans"
              />
              <div className="absolute right-2 flex items-center gap-1">
                <div className="relative w-9 h-9 flex items-center justify-center">
                  <button 
                    type="button" 
                    onClick={handleToggleRecording} 
                    className={`absolute inset-0 flex items-center justify-center text-text-secondary hover:text-accent transition-all duration-200 cursor-pointer ${inputText.length > 0 ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-100 scale-100'}`}
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                  <button 
                    type="submit" 
                    className={`absolute inset-0 flex items-center justify-center bg-accent text-black rounded-full transition-all duration-200 shadow-md cursor-pointer ${inputText.length > 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'}`}
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </div>
              </div>
            </div>
          </form>
          )}
          </>
        )}
      </div>
    </div>
  );
}
