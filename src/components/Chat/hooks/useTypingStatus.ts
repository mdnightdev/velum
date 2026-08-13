import { useState, useEffect } from 'react';

interface UseTypingStatusProps {
  inputText: string;
  onSendTyping?: (isTyping: boolean) => void;
  roomId: string;
  currentUserId: number;
  activeChatPeer?: { userId: number; username: string } | null;
}

export function useTypingStatus({
  inputText,
  onSendTyping,
  roomId,
  currentUserId,
  activeChatPeer
}: UseTypingStatusProps) {
  const [isTyping, setIsTyping] = useState(false);
  const [typingPeer, setTypingPeer] = useState<string | null>(null);

  // Handle typing status broadcast with timeout
  useEffect(() => {
    if (!onSendTyping) return;

    let timer: NodeJS.Timeout | null = null;

    if (inputText.length > 0) {
      if (!isTyping) {
        setIsTyping(true);
        onSendTyping(true);
      }

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

      if (userId !== currentUserId) {
        if (activeChatPeer) {
          if (userId === activeChatPeer.userId) {
            setTypingPeer(username);
          }
        } else {
          if (!room_id || room_id === roomId) {
            setTypingPeer(username);
          }
        }
      }
    };

    const handleStop = (e: any) => {
      const { room_id, username, userId } = e.detail || {};

      if (userId !== currentUserId) {
        if (activeChatPeer) {
          if (userId === activeChatPeer.userId && typingPeer === username) {
            setTypingPeer(null);
          }
        } else {
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

  return {
    isTyping,
    setIsTyping,
    typingPeer
  };
}
