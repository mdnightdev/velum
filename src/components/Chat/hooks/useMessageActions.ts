import { useState, useRef, useEffect } from 'react';
import { Message } from '../../../types';
import { parseAttachment } from '../../../utils/messageParser';

export function useMessageActions() {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [longPressedMsgId, setLongPressedMsgId] = useState<string | null>(null);
  const [showEmojisForMsg, setShowEmojisForMsg] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const handleTouchStart = (msgId: string) => {
    longPressFiredRef.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setLongPressedMsgId((prev) => (prev === msgId ? null : msgId));
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

  const handleCopyMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleStartEdit = (msg: Message, activeContent: string, setInputText: (text: string) => void) => {
    const timestampMs = typeof msg.timestamp === 'number' ? msg.timestamp : new Date(msg.timestamp).getTime();
    const timeDiffMinutes = (Date.now() - timestampMs) / (1000 * 60);
    if (timeDiffMinutes > 15) {
      alert('Message editing window (15 minutes) has expired.');
      return;
    }
    setEditingMessageId(msg.message_id);
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
    handleStartEdit,
    handleCancelEdit,
  };
}
