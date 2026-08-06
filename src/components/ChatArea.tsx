import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Trash2, ArrowLeft, ChevronLeft, ShieldAlert, Smile, AlertCircle, 
  Paperclip, Mic, Square, Play, Pause, FileIcon, X, Check, CheckCheck, Menu, Copy, Plus, Flag, Bell, Lock, Pencil, Pin, Forward, Reply,Search
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
  const [inputText, setInputText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  // Hover-based toolboxes never trigger on touch devices — this tracks which
  // message's toolbox should be forced visible after a long-press instead.
  const [longPressedMsgId, setLongPressedMsgId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const handleTouchStart = (msgId: string) => {
    longPressFiredRef.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setLongPressedMsgId((prev) => (prev === msgId ? null : msgId));
      if (navigator.vibrate) navigator.vibrate(15);
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Dismiss an open long-press toolbox when tapping elsewhere on the screen —
  // but not when the tap lands inside the toolbox that's currently open,
  // otherwise the toolbox closes before the button tap (edit/react) registers.
  useEffect(() => {
    if (!longPressedMsgId) return;
    const dismiss = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const container = target.closest('[data-message-id]') as HTMLElement | null;
      if (container && container.dataset.messageId === longPressedMsgId) return;
      setLongPressedMsgId(null);
    };
    document.addEventListener('touchstart', dismiss);
    return () => document.removeEventListener('touchstart', dismiss);
  }, [longPressedMsgId]);
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputText]);

  const [hasPendingNomination, setHasPendingNomination] = useState(false);
  const [isSubmittingNominationAction, setIsSubmittingNominationAction] = useState(false);
  const [activePinIndex, setActivePinIndex] = useState<number>(0);
  const [showAllPins, setShowAllPins] = useState<boolean>(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchIndex, setSearchIndex] = useState(-1);

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

  useEffect(() => {
    if (forwardingMessage) {
      setIsLoadingFriends(true);
      const sId = getSessionId();
      fetch('/v2/friends/relationships', {
        headers: { 'Authorization': `Bearer ${sId}` }
      })
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          const list = Array.isArray(data) ? data : (data?.relationships || []);
          const activeFriends = list.filter((r: any) => r.status === 'accepted').map((r: any) => {
            const peer = r.userId === currentUserId ? r.friend : r.user;
            if (!peer) return null;
            return {
              userId: peer.id || peer.user_id || peer.userId,
              username: peer.username,
              displayName: peer.displayName || peer.username,
              avatar: peer.avatarUrl || peer.avatar || ''
            };
          }).filter(Boolean);
          setFriendsList(activeFriends);
        })
        .catch(() => {})
        .finally(() => setIsLoadingFriends(false));
    }
  }, [forwardingMessage, currentUserId]);

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

  // Visual audio waveform playing states
  const [playingWaveforms, setPlayingWaveforms] = useState<Record<string, boolean>>({});
  const [waveformAudioProg, setWaveformAudioProg] = useState<Record<string, number>>({});
  const [popoverPeer, setPopoverPeer] = useState<{userId: number, username: string, messageId: string, displayName?: string, bio?: string, location?: string, joinedDate?: string, status?: string, isMuted?: boolean, isBlocked?: boolean, avatar?: string, stats?: { loungesCount: number, connectionsCount: number }} | null>(null);
  const [decryptedMap, setDecryptedMap] = useState<Record<string, string>>({});
  const [decryptedCiphertexts, setDecryptedCiphertexts] = useState<Record<string, string>>({});

  // Active playing audio ref
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioMsgIdRef = useRef<string | null>(null);

  // Keep track of messages we have already called onMarkAsRead for in this mount/session
  const markedMessageIdsRef = useRef<Set<string>>(new Set());

  // Reset marked messages registry when switching chat rooms/peers
  useEffect(() => {
    markedMessageIdsRef.current.clear();
  }, [roomId, activeChatPeer?.userId]);

  // Asynchronous decryption effect for incoming and edited messages
  useEffect(() => {
    let isMounted = true;
    const processDecryption = async () => {
      const newDecrypted: Record<string, string> = {};
      const newCiphertexts: Record<string, string> = {};
      let changed = false;

      for (const m of messages) {
        if (!m.content || !m.message_id) continue;

        if (decryptedCiphertexts[m.message_id] !== m.content) {
          const peerId = activeChatPeer?.userId || m.user_id;
          try {
            const context: EncryptionContext = {
              type: activeChatPeer ? 'direct' : 'lounge',
              roomId: m.room_id || roomId,
              peerUserId: peerId,
              isEncrypted: !!(m.is_encrypted || (m as any).isEncrypted)
            };
            const decrypted = await decryptMessage(m.content, context);
            if (decrypted) {
              newDecrypted[m.message_id] = decrypted;
              newCiphertexts[m.message_id] = m.content;
              changed = true;
            }
          } catch (err) {
            console.error('[ChatArea] Decryption error:', m.message_id, err);
          }
        }
      }

      if (isMounted && changed) {
        setDecryptedMap(prev => ({ ...prev, ...newDecrypted }));
        setDecryptedCiphertexts(prev => ({ ...prev, ...newCiphertexts }));
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

  const getDecryptedText = (msg: Message) => {
    const val = (msg.message_id && decryptedMap[msg.message_id]) || msg.content || '';
    if (!val) return 'Empty message';
    if (val.startsWith('[Voice Note')) return 'Voice Note';
    if (val.includes('[Attachment:')) {
      const parsed = parseAttachment(val);
      return (parsed && parsed.length > 0) ? (parsed[0].name || 'Attachment') : 'Attachment';
    }
    return val;
  };

  const handleScrollToMessage = (msgId: string) => {
    const element = document.getElementById(`msg-${msgId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('animate-pulse', 'bg-accent/10');
      setTimeout(() => {
        element.classList.remove('animate-pulse', 'bg-accent/10');
      }, 1500);
    }
  };

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

  const handleDismissAttachment = () => {
    setSelectedAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const compressImageToBlob = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas compression failed'));
        }, 'image/jpeg', 0.8);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  const payloadParts: string[] = [];

  for (const file of Array.from(files)) {
    try {
      const blob = await compressImageToBlob(file);
      const url = await streamFileDirectToCloudStorage(blob, 'media', 'jpg');
      const sizeStr = `${(blob.size / 1024).toFixed(0)} KB`;
      payloadParts.push(`[Attachment: ${file.name} size:${sizeStr} type:image/jpeg url:${url}]`);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  }

  if (payloadParts.length > 0) {
    onSendMessage(payloadParts.join(' '), null, false);
  }

  if (fileInputRef.current) {
    fileInputRef.current.value = '';
  }
};

const handleSearch = async (e?: React.FormEvent) => {
  if (e) e.preventDefault();
  if (!searchQuery.trim()) {
    setSearchResults([]);
    setSearchIndex(-1);
    return;
  }
  setIsSearching(true);
  try {
    const sId = getSessionId();
    const res = await fetch(`/v2/lounges/${roomId}/search?q=${encodeURIComponent(searchQuery)}`, {
      headers: { 'Authorization': `Bearer ${sId}` }
    });
    const data = await res.json();
    const dbMatches = data.messages || [];

    const queryLower = searchQuery.toLowerCase();
    const localMatches = conversationMessages.filter(m => {
      if (m.deleted) return false;
      const plainText = decryptedMap[m.message_id] || m.content || '';
      return plainText.toLowerCase().includes(queryLower);
    });

    const seenKeys = new Set<string>();
    const merged: any[] = [];

    for (const m of localMatches) {
      const key = String(m.db_message_id || m.message_id);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        merged.push({
          id: m.db_message_id || m.message_id,
          message_id: m.message_id,
          db_message_id: m.db_message_id,
          senderName: m.username,
          content: decryptedMap[m.message_id] || m.content,
          createdAt: m.timestamp
        });
      }
    }

    for (const m of dbMatches) {
      const key = String(m.id || m.message_id);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        merged.push({
          id: m.id,
          message_id: String(m.id),
          db_message_id: m.id,
          senderName: m.senderName || m.username,
          content: m.content,
          createdAt: m.createdAt
        });
      }
    }

    setSearchResults(merged);
    setSearchIndex(merged.length > 0 ? 0 : -1);
    if (merged.length > 0) {
      const firstMatch = merged[0];
      handleScrollToMessage(String(firstMatch.db_message_id || firstMatch.message_id));
    }
  } catch (err) {
    console.error('[Search] Failed:', err);
  } finally {
    setIsSearching(false);
  }
};

const handleNavigateSearch = (direction: 'next' | 'prev') => {
  if (searchResults.length === 0) return;
  let nextIdx = searchIndex;
  if (direction === 'next') {
    nextIdx = (searchIndex + 1) % searchResults.length;
  } else {
    nextIdx = (searchIndex - 1 + searchResults.length) % searchResults.length;
  }
  setSearchIndex(nextIdx);
  const target = searchResults[nextIdx];
  handleScrollToMessage(String(target.db_message_id || target.message_id));
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
    const activeContent = (msg.message_id && decryptedMap[msg.message_id]) || msg.content || '';
    const attachment = activeContent.includes('[Attachment:') ? parseAttachment(activeContent) : null;
    const plainText = attachment && attachment.length > 0 ? (attachment[0].caption || '') : activeContent;
    
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
        const encryptedEnvelope = await encryptMessage(textToSend, context);
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
      {showSearch && (
        <div className="bg-bg-search-bar border-b border-white-5 p-3 px-4 flex flex-col md:flex-row items-center gap-3 backdrop-blur-[var(--blur-backdrop-md)] relative z-30 select-none">
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 w-full">
            <Search className="w-4 h-4 text-text-secondary shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversation..."
              className="bg-transparent border-none text-[13px] text-white outline-none flex-1 font-sans placeholder-text-secondary"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setSearchIndex(-1);
                }}
                className="text-text-secondary hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>
          {searchResults.length > 0 && (
            <div className="flex items-center gap-3 text-xs shrink-0 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-white-5 pt-2 md:pt-0">
              <span className="text-text-secondary font-mono">
                {searchIndex + 1} of {searchResults.length} matches
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleNavigateSearch('prev')}
                  className="p-1 px-2 rounded bg-velum-700 border border-white-10 hover:border-white-20 hover:bg-velum-600 transition text-white font-mono text-[10px] uppercase font-bold"
                  title="Previous match"
                >
                  Prev
                </button>
                <button
                  onClick={() => handleNavigateSearch('next')}
                  className="p-1 px-2 rounded bg-velum-700 border border-white-10 hover:border-white-20 hover:bg-velum-600 transition text-white font-mono text-[10px] uppercase font-bold"
                  title="Next match"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          {searchQuery && searchResults.length === 0 && !isSearching && (
            <span className="text-[11px] text-alert-error font-mono tracking-wide uppercase shrink-0">
              No matches found
            </span>
          )}
          {isSearching && (
            <span className="text-[11px] text-accent font-mono tracking-wide uppercase shrink-0 animate-pulse">
              Searching...
            </span>
          )}
          <button
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
              setSearchResults([]);
              setSearchIndex(-1);
            }}
            className="text-text-secondary hover:text-white p-1 ml-2 shrink-0 hidden md:block"
            title="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {pinnedMessages.length > 0 && activePinnedMsg && (
        <div className="bg-bg-pinned-bar border-b border-white-5 p-2.5 px-4 flex items-center justify-between gap-3 text-xs backdrop-blur-[var(--blur-backdrop-md)] relative z-30 select-none">
          <div className="flex items-center gap-3 min-w-0 cursor-pointer flex-1" onClick={() => handleScrollToMessage(activePinnedMsg.message_id)}>
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
                onClick={() => setActivePinIndex(prev => (prev + 1) % pinnedMessages.length)}
                className="p-1 px-2 rounded-lg bg-white-5 hover:bg-white-10 text-[9px] font-mono font-bold uppercase text-text-secondary hover:text-white transition"
                title="Next pinned message"
              >
                Next
              </button>
            )}
            {onPinMessage && (
              <button 
                onClick={() => onPinMessage(activePinnedMsg.db_message_id ? String(activePinnedMsg.db_message_id) : activePinnedMsg.message_id, activePinnedMsg.room_id || roomId, false)}
                className="p-1.5 rounded-lg hover:bg-alert-error-bg text-text-secondary hover:text-alert-error transition"
                title="Unpin message"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
      {/* Primary Message Log area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 chat-wallpaper"
      >
        {conversationMessages.map((msg,index) => {
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
                      ? "relative font-sans text-[13px]"
                      : `px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed break-words font-sans relative ${
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
  accept="image/*"
  multiple
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
          <div className="mb-3 p-3 rounded-xl bg-alert-error-bg flex items-start justify-between gap-4 font-mono text-[10px] text-alert-error">
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
                className="absolute -top-1.5 -right-1.5 p-1 bg-alert-error text-white rounded-full transition shadow-md cursor-pointer border border-velum-800 z-10 flex items-center justify-center"
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
                className="text-text-secondary hover:text-alert-error transition p-1 cursor-pointer"
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
     {/* Voice Recording Overlay Bar */}
        {isRecording ? (
          <div className="bg-velum-850 p-4 border-t border-white-5 text-text-primary flex flex-col gap-3 rounded-2xl">
            {/* Live Audio Track / Waveform preview */}
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-alert-error animate-pulse" />
                <span className="text-white font-semibold">
                  {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
        
             {/* Dynamic Dots Visualizer */}
<div className="flex flex-1 items-center justify-between gap-[3px] overflow-hidden px-3 h-6">
  {audioLevels.map((level, i) => (
    <span
      key={i}
      className="w-1 rounded-full bg-accent transition-all duration-75 opacity-90"
     style={{ height: `${Math.max(4, (level / 100) * 24)}px` }}
    />
  ))}
</div>
            </div>
        
           {/* Controls Row */}
          <div className="flex items-center justify-between gap-3">
            {/* Trash / Cancel */}
            <button
              type="button"
              onClick={cancelRecording}
              className="w-11 h-11 rounded-full bg-status-dnd-bg hover:bg-status-dnd-bg/85 text-status-dnd flex items-center justify-center transition cursor-pointer"
              title="Discard recording"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          
            {/* Pause / Resume Pill */}
            <button
              type="button"
              onClick={isPaused ? resumeRecording : pauseRecording}
              className="flex-1 h-11 rounded-full bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 font-mono text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {isPaused ? (
                <>
                  <Mic className="w-4 h-4" />
                  <span>RESUME</span>
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>PAUSE</span>
                </>
              )}
            </button>
          
            {/* Send Button */}
            <button
              type="button"
              onClick={() => {
                stopRecording(async (audioBase64, durationSeconds) => {
                  try {
                    const response = await fetch(`data:audio/webm;base64,${audioBase64}`);
                    const blob = await response.blob();
                    const url = await streamFileDirectToCloudStorage(blob, 'media', 'webm');
                    onSendMessage(`[Voice Note  duration:${durationSeconds}s url:${url}]`, null, false);
                  } catch (err) {
                    onSendMessage(`[Voice Note  duration:${durationSeconds}s data:audio/webm;base64,${audioBase64}]`, null, false);
                  }
                });
              }}
              className="w-11 h-11 rounded-full bg-accent text-velum-950 hover:bg-accent-light flex items-center justify-center transition shadow-md cursor-pointer"
              title="Send voice note"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>
          </div>
        ) : 
         roomId === `dm_velum_${currentUserId}` || activeChatPeer?.userId === 999 ? (
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
                  className="px-3.5 py-1.5 bg-status-dnd-bg text-status-dnd hover:bg-status-dnd-bg/80 font-bold rounded-lg uppercase text-[9px] cursor-pointer transition disabled:opacity-50"
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
                className="text-status-dnd hover:text-status-dnd/80 font-bold uppercase text-[9px] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
          {replyingToMessage && (
            <div className="flex items-center justify-between py-2 px-4 bg-accent/10 border-b border-accent/20 text-[10px] font-mono font-bold text-accent tracking-wider uppercase">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Reply className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="text-[9px] text-text-secondary uppercase">Replying to {stripAt(replyingToMessage.username || 'User')}:</span>
                <span className="text-white normal-case truncate max-w-xs font-medium font-sans">
                  {getDecryptedText(replyingToMessage)}
                </span>
              </div>
              <button 
                type="button"
                onClick={() => setReplyingToMessage(null)}
                className="text-status-dnd hover:text-status-dnd/80 font-bold uppercase text-[9px] cursor-pointer shrink-0 ml-2"
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

            <div className="flex-1 relative flex items-end">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                placeholder={chatTitle ? t('chat.message_peer', 'Message {name}').replace('{name}', chatTitle) : t('chat.message_placeholder', 'Message...')}
                className="w-full bg-velum-800 border border-white-5 rounded-2xl pl-5 pr-24 py-[11px] text-[13px] text-white outline-none focus:border-accent/50 font-sans resize-none max-h-32 overflow-y-auto leading-relaxed"
                style={{ height: 'auto', minHeight: '42px' }}
              />
              <div className="absolute right-2 bottom-[3px] flex items-center gap-1">
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
