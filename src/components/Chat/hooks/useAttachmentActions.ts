import React, { RefObject } from 'react';
import { streamFileDirectToCloudStorage } from '../../../utils/mediaPipeline';
import { Attachment } from './useMessageInput';

export function compressImageToBlob(file: File): Promise<Blob> {
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
}

export function useAttachmentActions({
  fileInputRef,
  setSelectedAttachment,
  onSendMessage,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  setSelectedAttachment: (att: Attachment | null) => void;
  onSendMessage: (content: string, peerUserId?: number | null, isVoice?: boolean, messageType?: string, replyToMessageId?: string | null) => void;
}) {
  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleDismissAttachment = () => {
    setSelectedAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

  return {
    handleTriggerFileInput,
    handleDismissAttachment,
    handleFileSelect,
  };
}
