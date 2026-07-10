import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Trash2, ArrowLeft, ChevronLeft, ShieldAlert, Smile, AlertCircle, 
  Paperclip, Mic, Square, Play, Pause, FileIcon, X, Check, CheckCheck, Menu, Copy, Plus
} from 'lucide-react';
import { Message, stripAt } from '../types';
import { decryptMessage } from '../services/encryptionService';
import ProfileCard from './ProfileCard';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import logoSvg from '../assets/logo.svg?raw';

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
  onDeleteMessage?: (messageId: string, roomId: string) => void;
  onMarkAsRead?: (messageId: string, roomId: string) => void;
  activeChatPeer?: { userId: number; username: string; avatar?: string } | null;
  isDark?: boolean;
  onBackToDeck?: () => void;
  onSelectProfileUser?: (user: any) => void;
  onToggleSidebar?: () => void;
  isMobile?: boolean;
  roomName?: string;
  isPrivateSublounge?: boolean;
}

function formatLastSeen(lastSeenVal: string | null): string {
  if (!lastSeenVal || lastSeenVal === 'offline') return 'Offline';
  if (lastSeenVal === 'online') return 'Online';
  
  const date = new Date(lastSeenVal);
  if (isNaN(date.getTime())) return 'Offline';

  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const seenDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = todayDate.getTime() - seenDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

  if (diffDays === 0) {
    return `Last seen at ${timeStr}`;
  } else if (diffDays === 1) {
    return `Last seen yesterday, ${timeStr}`;
  } else if (diffDays < 7 && diffDays > 0) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `Last seen ${days[date.getDay()]}, ${timeStr}`;
  } else {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `Last seen ${pad(date.getDate())} ${months[date.getMonth()]}`;
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
  onDeleteMessage,
  onMarkAsRead,
  activeChatPeer,
  isDark,
  onBackToDeck,
  isMobile,
  onToggleSidebar,
  roomName,
  isPrivateSublounge,
}: ChatAreaProps) {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingPeer, setTypingPeer] = useState<string | null>(null);
  const [showEmojisForMsg, setShowEmojisForMsg] = useState<string | null>(null);
  const [peerPresence, setPeerPresence] = useState<string>('offline');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Attachment states
  const [selectedAttachment, setSelectedAttachment] = useState<{ name: string; size: string; type: string; data: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [popoverPeer, setPopoverPeer] = useState<{userId: number, username: string, messageId: string, displayName?: string, bio?: string, location?: string, joinedDate?: string, isMuted?: boolean, isBlocked?: boolean} | null>(null);

  // Active playing audio ref
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioMsgIdRef = useRef<string | null>(null);

  // Keep track of messages we have already called onMarkAsRead for in this mount/session
  const markedMessageIdsRef = useRef<Set<string>>(new Set());

  // Reset marked messages registry when switching chat rooms/peers
  useEffect(() => {
    markedMessageIdsRef.current.clear();
  }, [roomId, activeChatPeer?.userId]);

  useEffect(() => {
    if (!activeChatPeer) return;

    // Fetch user status initially
    const sessionId = sessionStorage.getItem('velum-sessionId') || sessionStorage.getItem('velum_sessionId') || '';
    fetch(`/api/users/${activeChatPeer.userId}/status`, {
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
        console.warn('Failed to fetch peer status:', err);
      });

    // Listen to live presence updates
    const handlePresence = (e: any) => {
      const { user_id, last_seen_at } = e.detail || {};
      if (user_id === activeChatPeer.userId) {
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
    const sId = sessionStorage.getItem('velum-sessionId') || sessionStorage.getItem('velum_sessionId');
    const headers = {
      'Authorization': `Bearer ${sId}`,
      'Content-Type': 'application/json'
    };

    try {
      const res = await fetch(`/api/user/${otherId}/chat`, {
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

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingPeer]);


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
          
          const sid = sessionStorage.getItem('velum-sessionId') || '';
          const uploadRes = await fetch('/api/user/upload-media', {
            method: 'POST',
            headers: {
              'Content-Type': 'audio/webm',
              'Authorization': `Bearer ${sid}`
            },
            body: blob
          });
          
          if (uploadRes.ok) {
            const data = await uploadRes.json();
            onSendMessage(`[Voice Note 🔊 duration:${durationSeconds}s url:${data.url}]`, null, false);
          } else {
            onSendMessage(`[Voice Note 🔊 duration:${durationSeconds}s data:audio/webm;base64,${audioBase64}]`, null, false);
          }
        } catch (err) {
          console.error('Audio upload failed:', err);
          onSendMessage(`[Voice Note 🔊 duration:${durationSeconds}s data:audio/webm;base64,${audioBase64}]`, null, false);
        }
      });
    }
  };

  const handleCancelRecording = () => {
    cancelRecording();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedAttachment) return;
    
    let textToSend = inputText.trim();
    if (selectedAttachment) {
      try {
        const response = await fetch(selectedAttachment.data);
        const blob = await response.blob();
        
        const sid = sessionStorage.getItem('velum-sessionId') || '';
        const uploadRes = await fetch('/api/user/upload-media', {
          method: 'POST',
          headers: {
            'Content-Type': selectedAttachment.type,
            'Authorization': `Bearer ${sid}`
          },
          body: blob
        });
        
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          textToSend = `[Attachment: ${selectedAttachment.name} size:${selectedAttachment.size} type:${selectedAttachment.type} url:${data.url}] ${inputText.trim()}`.trim();
        } else {
          textToSend = `[Attachment: ${selectedAttachment.name} size:${selectedAttachment.size} type:${selectedAttachment.type} data:${selectedAttachment.data}] ${inputText.trim()}`.trim();
        }
      } catch (err) {
        console.error('Upload failed:', err);
        textToSend = `[Attachment: ${selectedAttachment.name} size:${selectedAttachment.size} type:${selectedAttachment.type} data:${selectedAttachment.data}] ${inputText.trim()}`.trim();
      }
    }

    onSendMessage(textToSend, null, false);
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
            console.warn('Audio element error or unsupported format, falling back to simulated playback:', e);
            audio.onended = null;
            audio.ontimeupdate = null;
            runSimulatedPlayback(msgId, durationStr);
          };

          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(err => {
              console.warn('Playback error or interruption catch:', err);
              audio.onended = null;
              audio.ontimeupdate = null;
              runSimulatedPlayback(msgId, durationStr);
            });
          }
        } catch (err) {
          console.warn('Error setting up or playing dynamic Audio object, falling back:', err);
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
    : roomId === 'velum_lounge'
      ? 'Velum Lounge'
      : roomName
        ? roomName.replace(/^#\s*/, '')
        : (roomId.startsWith('#') ? roomId.slice(1) : roomId);

  // Filter messages based on chat context
  const conversationMessages = messages.filter(m => {
    if (activeChatPeer) {
      const otherId = activeChatPeer.userId;
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

  // Mark messages as read when chat becomes visible
  const onMarkAsReadRef = useRef(onMarkAsRead);
  useEffect(() => {
    onMarkAsReadRef.current = onMarkAsRead;
  }, [onMarkAsRead]);

  useEffect(() => {
    if (!onMarkAsReadRef.current) return;
    
    const unreadMessages = messages.filter(m => {
      let isRelevant = false;
      if (activeChatPeer) {
        const otherId = activeChatPeer.userId;
        if (otherId === 999) {
          isRelevant = m.room_id === `dm_velum_${currentUserId}`;
        } else {
          const isPeerFromMe = m.user_id === currentUserId && (m.room_id === `dm_${otherId}` || m.room_id === `dm_${currentUserId}_${otherId}` || (m as any)._dm_target === otherId);
          const isPeerToMe = m.user_id === otherId && (m.room_id === `dm_${currentUserId}` || m.room_id === `dm_${otherId}_${currentUserId}` || (m as any)._dm_target === currentUserId);
          isRelevant = isPeerFromMe || isPeerToMe || !!(m.room_id?.includes(`dm_${Math.min(currentUserId, otherId)}_${Math.max(currentUserId, otherId)}`));
        }
      } else {
        isRelevant = m.room_id === roomId || (!m.room_id && m.lounge_id === roomId);
      }
      return isRelevant && m.user_id !== currentUserId && m.status !== 'read' && !markedMessageIdsRef.current.has(m.message_id);
    });
    
    unreadMessages.forEach(m => {
      markedMessageIdsRef.current.add(m.message_id);
      onMarkAsReadRef.current?.(m.message_id, m.room_id || roomId);
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
          {/* Upper Navigation Bar */}
      <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0 bg-black/10 border-white-5">
        {!wsConnected && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 bg-accent/10 border border-accent/20 text-accent text-[9px] font-mono font-bold uppercase rounded-lg animate-pulse tracking-widest pointer-events-none z-50">
            reconnecting...
          </div>
        )}
        <div className="flex items-center gap-3">
          {onBackToDeck && (
            <button
              onClick={onBackToDeck}
              className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-text-primary/5 cursor-pointer flex items-center justify-center transition-colors"
              title="Back to directory"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-3">
            {/* Avatar */}
            {activeChatPeer ? (
              <div 
                className="w-10 h-10 rounded-full bg-velum-800 border border-white-5 flex items-center justify-center font-bold text-accent overflow-hidden"
              >
                {activeChatPeer.avatar && (activeChatPeer.avatar.startsWith('data:image/') || activeChatPeer.avatar.startsWith('http')) ? (
                  <img src={activeChatPeer.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  activeChatPeer.username.slice(0, 2).toUpperCase()
                )}
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-velum-800 border border-white-5 flex items-center justify-center font-bold text-accent">
                {chatTitle.slice(0, 2).toUpperCase()}
              </div>
            )}

            {/* Title & Status */}
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white">{chatTitle}</span>
              <span className="text-[11px] text-text-secondary">
                {activeChatPeer ? formatLastSeen(peerPresence) : `${conversationMessages.length} Messages`}
              </span>
            </div>
          </div>
        </div>

        {/* Video and Phone call buttons removed - calling features not implemented */}
      </div>

      {/* Primary Message Log area */}
      <div className={`flex-1 overflow-y-auto p-4 md:p-6 space-y-4 ${isDark ? 'bg-transparent' : 'bg-velum-900'}`}>
        {conversationMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-text-secondary uppercase tracking-wider font-mono text-[9px] space-y-2">
            <AlertCircle className="w-6 h-6 text-text-disabled animate-pulse" />
            <p>Verification Secure handshake ready. No message logs found.</p>
          </div>
        ) : (
          conversationMessages.map((msg) => {
            const isMe = msg.user_id === currentUserId;
            let cleanName = stripAt(msg.username || 'Client');
            let isSpecialTheme = false;
            let customBubbleClass = '';
            
            const lowerUsername = (msg.username || '').toLowerCase();
            const msgUserId = msg.user_id;

            if (msgUserId === 1 || lowerUsername.includes('midnight') || lowerUsername.includes('cli-exec') || lowerUsername.includes('cli_admin')) {
              cleanName = 'MIDNIGHT (executive)';
              isSpecialTheme = true;
              customBubbleClass = 'bg-accent/15 border border-accent/35 text-text-primary rounded-2xl rounded-tl-none';
            } else if (msgUserId === 2 || lowerUsername.includes('lexie') || lowerUsername.includes('login-admin') || lowerUsername.includes('admin')) {
              cleanName = 'Lexie (Administrator)';
              isSpecialTheme = true;
              customBubbleClass = 'bg-indigo-950/45 border border-indigo-500/35 text-indigo-100 rounded-2xl rounded-tl-none';
            } else if (msgUserId === 999 || lowerUsername.includes('velum') || lowerUsername.includes('system')) {
              cleanName = 'VELUM';
              isSpecialTheme = true;
              customBubbleClass = 'bg-emerald-950/45 border border-emerald-500/35 text-emerald-100 rounded-2xl rounded-tl-none';
            }
            
            // Decrypt E2EE content first before running any parsing on it
            const activeContent = decryptMessage(msg.content || '', msg.room_id || roomId, msg.is_encrypted || (msg as any).isEncrypted);
            
            // Check for voice note payload
            const isVoiceNote = !msg.deleted && activeContent && activeContent.startsWith('[Voice Note ');
            
            // Check for attachments
            const isAttachment = !msg.deleted && activeContent && activeContent.includes('[Attachment: ');
            
            // Parse attachment details: [Attachment: name size:12KB type:image/jpeg data:base64...]
            let parsedAttachmentName = '';
            let parsedAttachmentSize = '';
            let parsedAttachmentType = '';
            let parsedAttachmentData = '';
            let parsedMsgContent = activeContent;
            
            if (isAttachment) {
              const match = activeContent.match(/\[Attachment:\s*(.*?)\s+size:(.*?)\s+type:(.*?)\s+(data|url):(.*?)\](?:\s*(.*))?/);
              if (match) {
                parsedAttachmentName = match[1];
                parsedAttachmentSize = match[2];
                parsedAttachmentType = match[3];
                parsedAttachmentData = match[5];
                parsedMsgContent = match[6] || '';
              }
              // Fallback for old format without data
              const oldMatch = activeContent.match(/\[Attachment:\s*(.*?)\s+size:(.*?)\](?:\s*(.*))?/);
              if (oldMatch && !match) {
                parsedAttachmentName = oldMatch[1];
                parsedAttachmentSize = oldMatch[2];
                parsedMsgContent = oldMatch[3] || '';
              }
            }

            return (
              <div
                key={msg.message_id}
                className={`flex max-w-[85%] group relative gap-2 ${isMe ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
              >
                {!isMe && (
                  <div className="flex-shrink-0 mt-auto mb-5 relative z-[60]">
                    <div className="cursor-pointer w-7 h-7 rounded-full bg-velum-800 border border-accent/30 flex items-center justify-center font-bold text-accent text-[10px] overflow-hidden hover:bg-text-primary/5 transition-colors" onClick={async (e) => {
                       e.stopPropagation();
                       setPopoverPeer({
                         userId: msg.user_id,
                         username: cleanName,
                         messageId: msg.message_id,
                         displayName: cleanName,
                         bio: "Secure Node Operator. Communication established via E2EE protocols.",
                         location: "Earth",
                         joinedDate: "May 2026",
                         isMuted: false,
                         isBlocked: false
                       });
                       try {
                         const sId = sessionStorage.getItem('velum-sessionId') || '';
                         const res = await fetch(`/api/user/${msg.user_id}/profile`, {
                           headers: { 'Authorization': `Bearer ${sId}` }
                         });
                         if (res.ok) {
                           const data = await res.json();
                           setPopoverPeer((prev: any) => {
                             if (prev && prev.userId === msg.user_id && prev.messageId === msg.message_id) {
                               return {
                                 ...prev,
                                 displayName: data.displayName || cleanName,
                                 bio: data.bio || "Secure Node Operator. Communication established via E2EE protocols.",
                                 location: data.location || "Earth",
                                 joinedDate: data.created_at ? new Date(data.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : "May 2026",
                                 isMuted: !!data.isMuted,
                                 isBlocked: !!data.isBlocked
                               };
                             }
                             return prev;
                           });
                         }
                       } catch (err) {}
                    }}>
                      {msgUserId === 999 || msgUserId === 0 || lowerUsername.includes('velum') || lowerUsername.includes('system') ? (
                        <div className="w-4 h-4 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: logoSvg }} />
                      ) : (
                        cleanName.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    {popoverPeer?.messageId === msg.message_id && (
                      <div className="absolute top-1/2 left-full -translate-y-1/2 ml-3" onClick={(e) => e.stopPropagation()}>
                        <ProfileCard
                          user={{
                            userId: popoverPeer.userId,
                            username: popoverPeer.username,
                            displayName: popoverPeer.displayName || popoverPeer.username,
                            bio: popoverPeer.bio || "Secure Node Operator. Communication established via E2EE protocols.",
                            location: popoverPeer.location || "Earth",
                            joinedDate: popoverPeer.joinedDate || "May 2026",
                            status: "Active now",
                            isMuted: !!popoverPeer.isMuted,
                            isBlocked: !!popoverPeer.isBlocked,
                            stats: {
                              loungesCount: 12,
                              connectionsCount: 45
                            }
                          }}
                          variant="popover"
                          onClose={() => setPopoverPeer(null)}
                          onMessage={() => {
                            setPopoverPeer(null);
                          }}
                          onMute={async () => {
                            try {
                              const sId = sessionStorage.getItem('velum-sessionId') || '';
                              const res = await fetch(`/api/user/${popoverPeer.userId}/mute`, {
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
                              const sId = sessionStorage.getItem('velum-sessionId') || '';
                              const res = await fetch(`/api/user/${popoverPeer.userId}/block`, {
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
                              const sId = sessionStorage.getItem('velum-sessionId') || '';
                              const res = await fetch(`/api/user/${popoverPeer.userId}/chat`, {
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
                              const sId = sessionStorage.getItem('velum-sessionId') || '';
                              const res = await fetch(`/api/user/${popoverPeer.userId}/report`, {
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
                  <div className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed break-words font-sans relative ${
                  isSpecialTheme && customBubbleClass
                    ? customBubbleClass
                    : isMe 
                      ? 'bg-velum-800 text-white rounded-br-sm' 
                      : 'bg-velum-800 text-text-primary rounded-bl-sm border border-white-5'
                } ${msg.deleted ? 'italic text-text-secondary opacity-60 font-mono text-[10px]' : ''}`}>
                  
                  {msg.deleted ? (
                    'Message deleted by sender'
                  ) : isVoiceNote ? (
                    /* Waveform playback UI */
                    (() => {
                      const durMatch = msg.content.match(/duration:(\d+)s/);
                      const urlMatch = msg.content.match(/url:([^\]\s]+)/);
                      const audioMatch = msg.content.match(/data:([^,]+),(.+)/);
                      const durPrefix = durMatch ? durMatch[1] : '4';
                      const audioData = urlMatch ? urlMatch[1] : (audioMatch ? audioMatch[2] : null);
                      const audioType = audioMatch ? audioMatch[1] : 'audio/webm';
                      const isPlaying = !!playingWaveforms[msg.message_id];
                      const barsArr = [8, 18, 12, 22, 6, 14, 20, 10, 24, 16, 11, 26, 8, 17, 21, 13, 23, 7, 13, 19, 10, 15, 24, 9];

                      return (
                        <div className="flex items-center gap-3.5 max-w-full py-1">
                          <button
                            type="button"
                            onClick={() => handleTogglePlayWave(msg.message_id, durPrefix, audioData || '', audioType)}
                            className="w-8 h-8 rounded-full bg-accent hover:bg-accent-hover text-zinc-950 flex items-center justify-center transition shrink-0 shadow"
                          >
                            {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
                          </button>

                          <div className="flex-1 min-w-[140px]">
                            {/* Waveforms oscillatings */}
                            <div className="flex items-end gap-0.5 h-6">
                              {barsArr.map((hCode, ix) => {
                                const progLimit = (ix / barsArr.length) * 100;
                                const activeProg = isPlaying && (waveformAudioProg[msg.message_id] || 0) > progLimit;
                                return (
                                  <span
                                    key={ix}
                                    style={{ height: `${hCode}px` }}
                                    className={`w-0.5 rounded-full transition-colors duration-150 ${
                                      activeProg ? 'bg-accent' : 'bg-velum-500'
                                    }`}
                                  />
                                );
                              })}
                            </div>
                            <div className="flex items-center justify-between text-[7px] font-mono text-text-secondary mt-1 uppercase">
                              <span>Audio Message</span>
                              <span>0:{durPrefix.padStart(2, '0')}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <>
                      {/* Attachment Badge capsule if present */}
                      {isAttachment && (
                        <div className="mb-2.5">
                          {parsedAttachmentData && parsedAttachmentType.startsWith('image/') ? (
                            <div className="rounded-xl overflow-hidden border border-white-5">
                              <img
                                src={parsedAttachmentData}
                                alt={parsedAttachmentName}
                                className="max-w-full h-auto max-h-64 object-contain cursor-pointer"
                                onClick={() => window.open(parsedAttachmentData, '_blank')}
                              />
                            </div>
                          ) : parsedAttachmentData ? (
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
                          <p className="whitespace-pre-wrap">{parsedMsgContent}</p>
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
                      isMe ? '-left-20' : '-right-20'
                    }`}>
                      <button
                        onClick={() => setShowEmojisForMsg(showEmojisForMsg === msg.message_id ? null : msg.message_id)}
                        className="text-text-secondary hover:text-white p-1 rounded"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>
                      {isMe && onDeleteMessage && (
                        <button
                          onClick={() => onDeleteMessage(msg.message_id, msg.room_id || roomId)}
                          className="text-red-400 hover:text-red-350 p-1 rounded"
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
                  
                  {isMe && (
                    <span className={msg.status === 'read' ? 'text-accent' : 'text-text-disabled'}>
                      {msg.status === 'sent' ? (
                        <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                      ) : (msg.status === 'delivered' || msg.status === 'read') ? (
                        <CheckCheck className="w-3.5 h-3.5" strokeWidth={2.5} />
                      ) : null}
                    </span>
                  )}

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
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
      />

      {/* Footer Text area form */}
      <div className={`px-4 pb-4 pt-2 flex-shrink-0 bg-velum-850`}>
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
        )}

        {isPrivateSublounge && (
          <div className="mb-2 px-2 text-[10px] font-mono text-text-disabled uppercase tracking-wider select-none">
            🛡️ Sanctions in the parent lounge apply here automatically
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
                placeholder={chatTitle ? `Message ${chatTitle}` : "Message..."}
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

      </div>
    </div>
  );
}
