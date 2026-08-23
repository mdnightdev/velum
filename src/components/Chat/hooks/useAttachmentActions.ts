import React, { RefObject } from 'react';
import { streamFileDirectToCloudStorage } from '../../../utils/mediaPipeline';
import { Attachment } from './useMessageInput';

export const MAX_ATTACHMENT_BATCH = 5;
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

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
  photoInputRef,
  docInputRef,
  setSelectedAttachment,
  setCroppingImage,
  setFileErrorAlert,
  onSendMessage,
}: {
  photoInputRef?: RefObject<HTMLInputElement | null>;
  docInputRef?: RefObject<HTMLInputElement | null>;
  setSelectedAttachment: (att: Attachment | null) => void;
  setCroppingImage?: (data: { src: string; fileName: string; file: File } | null) => void;
  setFileErrorAlert?: (msg: string | null) => void;
  onSendMessage: (content: string, peerUserId?: number | null, isVoice?: boolean, messageType?: string, replyToMessageId?: string | null) => void;
}) {
  const handleTriggerPhotoInput = () => {
    if (setFileErrorAlert) setFileErrorAlert(null);
    photoInputRef?.current?.click();
  };

  const handleTriggerDocInput = () => {
    if (setFileErrorAlert) setFileErrorAlert(null);
    docInputRef?.current?.click();
  };

  const handleDismissAttachment = () => {
    setSelectedAttachment(null);
    if (photoInputRef?.current) photoInputRef.current.value = '';
    if (docInputRef?.current) docInputRef.current.value = '';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (setFileErrorAlert) setFileErrorAlert(null);

    // 1. Check batch count limit
    if (files.length > MAX_ATTACHMENT_BATCH) {
      if (setFileErrorAlert) {
        setFileErrorAlert(
          `Batch limit exceeded: You can select a maximum of ${MAX_ATTACHMENT_BATCH} attachments per message (selected ${files.length}). Please select fewer items.`
        );
      }
      e.target.value = '';
      return;
    }

    const fileList = Array.from(files);

    // 2. Check file size limits
    for (const file of fileList) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        if (setFileErrorAlert) {
          setFileErrorAlert(
            `File too large: '${file.name}' (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 25 MB limit.`
          );
        }
        e.target.value = '';
        return;
      }
    }

    // 3. If single image -> open ImageCropperModal
    if (fileList.length === 1 && fileList[0].type.startsWith('image/')) {
      const file = fileList[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        const src = evt.target?.result as string;
        if (src && setCroppingImage) {
          setCroppingImage({
            src,
            fileName: file.name,
            file,
          });
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
      return;
    }

    // 4. Multiple files or documents (up to 5) -> process safely
    const payloadParts: string[] = [];

    for (const file of fileList) {
      try {
        if (file.type.startsWith('image/')) {
          const blob = await compressImageToBlob(file);
          const url = await streamFileDirectToCloudStorage(blob, 'media', blob.type.split('/')[1] || 'jpg');
          const sizeStr = `${(blob.size / 1024).toFixed(0)} KB`;
          payloadParts.push(`[Attachment: ${file.name} size:${sizeStr} type:${blob.type || 'image/jpeg'} url:${url}]`);
        } else {
          // Document / non-image attachment
          const url = await streamFileDirectToCloudStorage(file, 'media', file.type.split('/')[1] || file.name.split('.').pop() || 'bin');
          const sizeStr = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${(file.size / 1024).toFixed(0)} KB`;
          payloadParts.push(`[Attachment: ${file.name} size:${sizeStr} type:${file.type || 'application/octet-stream'} url:${url}]`);
        }
      } catch (err) {
        console.error('Upload failed for file:', file.name, err);
      }
    }

    if (payloadParts.length > 0) {
      onSendMessage(payloadParts.join(' '), null, false);
    }

    e.target.value = '';
  };

  return {
    handleTriggerPhotoInput,
    handleTriggerDocInput,
    handleDismissAttachment,
    handleFileSelect,
  };
}
