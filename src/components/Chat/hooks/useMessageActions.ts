import { useState, useRef, useEffect } from 'react';
import { Message } from '../../../types';
import { parseAttachment } from '../../../utils/messageParser';
import { velumToast } from '../../../utils/toast';
import { getMessageKey, messagesMatch } from '../messageKey';

export function useMessageActions() {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const clearActionMessage = () => setActionMessage(null);

  const handleTouchStart = (msg: Message) => {
    longPressFiredRef.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setActionMessage((prev) => (messagesMatch(prev, msg) ? null : msg));
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => {
    if (!actionMessage) return;
    const dismiss = (e: TouchEvent | MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-message-action-sheet]')) return;
      if (target.closest('[data-forward-sheet]')) return;
      if (target.closest('[data-reaction-picker]')) return;
      if (target.closest('[data-chat-selection-header]')) return;
      if (target.closest('[data-image-lightbox]')) return;
      if (target.closest('[data-video-lightbox]')) return;
      if (longPressFiredRef.current) {
        longPressFiredRef.current = false;
        return;
      }
      setActionMessage(null);
    };
    const t = window.setTimeout(() => {
      document.addEventListener('touchstart', dismiss);
      document.addEventListener('mousedown', dismiss);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('touchstart', dismiss);
      document.removeEventListener('mousedown', dismiss);
    };
  }, [actionMessage]);

  const handleStartEdit = (msg: Message, activeContent: string, setInputText: (text: string) => void) => {
    const stamp = msg.timestamp ?? msg.created_at ?? Date.now();
    const timestampMs = typeof stamp === 'number' ? stamp : new Date(stamp).getTime();
    const timeDiffMinutes = (Date.now() - timestampMs) / (1000 * 60);
    if (timeDiffMinutes > 15) {
      velumToast.error('Message editing window (15 minutes) has expired.');
      return;
    }
    setEditingMessageId(getMessageKey(msg) || String(msg.message_id));
    const attachment = activeContent.includes('[Attachment:') ? parseAttachment(activeContent) : null;
    const plainText = attachment && attachment.length > 0 ? (attachment[0].caption || '') : activeContent;
    setInputText(plainText);
  };

  const handleCancelEdit = (setInputText: (text: string) => void) => {
    setEditingMessageId(null);
    setInputText('');
  };

  return {
    editingMessageId,
    setEditingMessageId,
    actionMessage,
    setActionMessage,
    clearActionMessage,
    copiedMessageId,
    setCopiedMessageId,
    replyingToMessage,
    setReplyingToMessage,
    forwardingMessage,
    setForwardingMessage,
    handleTouchStart,
    handleTouchEnd,
    handleStartEdit,
    handleCancelEdit,
  };
}
