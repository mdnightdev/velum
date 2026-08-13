import { useState, useRef, useEffect } from 'react';

export interface Attachment {
  name: string;
  size: string;
  type: string;
  data: string;
}

export interface UseMessageInputOptions {
  roomId: string;
  activeChatPeer?: { userId: number } | null;
}

export function useMessageInput({ roomId, activeChatPeer }: UseMessageInputOptions) {
  const [inputText, setInputText] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentKey = activeChatPeer ? `dm_${activeChatPeer.userId}` : `room_${roomId}`;
  const prevKeyRef = useRef(currentKey);
  const draftsRef = useRef<Record<string, { text: string; attachment: Attachment | null }>>({});

  useEffect(() => {
    const prevKey = prevKeyRef.current;
    if (prevKey !== currentKey) {
      draftsRef.current[prevKey] = {
        text: inputText,
        attachment: selectedAttachment,
      };

      const currentDraft = draftsRef.current[currentKey] || { text: '', attachment: null };
      setInputText(currentDraft.text);
      setSelectedAttachment(currentDraft.attachment);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      prevKeyRef.current = currentKey;
    }
  }, [currentKey, inputText, selectedAttachment]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputText]);

  const clearInput = () => {
    setInputText('');
    setSelectedAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return {
    inputText,
    setInputText,
    selectedAttachment,
    setSelectedAttachment,
    fileInputRef,
    textareaRef,
    clearInput,
  };
}
