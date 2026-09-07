import React, { RefObject } from 'react';
import { streamFileDirectToCloudStorage, stripImageMetadataAndCompress, generateAnonymousFilename } from '../../../utils/mediaPipeline';
import { Attachment } from './useMessageInput';
import { velumToast } from '../../../utils/toast';

export const MAX_ATTACHMENT_BATCH = 5;
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export function compressImageToBlob(file: File): Promise<Blob> {
  return stripImageMetadataAndCompress(file, 1200, 0.85);
}

export function useAttachmentActions({
  photoInputRef,
  videoInputRef,
  audioInputRef,
  docInputRef,
  setSelectedAttachment,
  setCroppingImage,
  setFileErrorAlert,
  onSendMessage,
}: {
  photoInputRef?: RefObject<HTMLInputElement | null>;
  videoInputRef?: RefObject<HTMLInputElement | null>;
  audioInputRef?: RefObject<HTMLInputElement | null>;
  docInputRef?: RefObject<HTMLInputElement | null>;
  setSelectedAttachment: (att: Attachment | null) => void;
  setCroppingImage?: (data: { src: string; fileName: string; file: File } | null) => void;
  setFileErrorAlert?: (msg: string | null) => void;
  onSendMessage: (content: string, peerUserId?: number | null, isVoice?: boolean, messageType?: string, replyToMessageId?: string | null) => void;
}) {
  const handleTriggerPhotoInput = () => {
    photoInputRef?.current?.click();
  };

  const handleTriggerVideoInput = () => {
    videoInputRef?.current?.click();
  };

  const handleTriggerAudioInput = () => {
    audioInputRef?.current?.click();
  };

  const handleTriggerDocInput = () => {
    docInputRef?.current?.click();
  };

  const handleDismissAttachment = () => {
    setSelectedAttachment(null);
    if (photoInputRef?.current) photoInputRef.current.value = '';
    if (videoInputRef?.current) videoInputRef.current.value = '';
    if (audioInputRef?.current) audioInputRef.current.value = '';
    if (docInputRef?.current) docInputRef.current.value = '';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let fileList = Array.from(files);

    // 1. Enforce 5-attachment maximum & drop excess with Velum-styled toast
    if (fileList.length > MAX_ATTACHMENT_BATCH) {
      velumToast.error('Attachment limit exceeded. Keeping first 5 items.');
      fileList = fileList.slice(0, MAX_ATTACHMENT_BATCH);
    }

    // 2. Instant pre-flight file size check (<25MB)
    const validFiles: File[] = [];
    for (const file of fileList) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        velumToast.error(`'${file.name}' exceeds 25 MB limit.`);
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      e.target.value = '';
      return;
    }

    // 3. Single attachment -> stage directly into input preview bar without mandatory cropper
    if (validFiles.length === 1) {
      const file = validFiles[0];
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');
      const sizeStr = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${(file.size / 1024).toFixed(0)} KB`;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const src = evt.target?.result as string;
        if (src) {
          setSelectedAttachment({
            name: file.name,
            size: sizeStr,
            type: file.type || (isImg ? 'image/webp' : isVid ? 'video/mp4' : 'application/octet-stream'),
            data: src
          });
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
      return;
    }

    // 4. Multiple attachments (2 to 5 items) -> process and dispatch safely
    const payloadParts: string[] = [];
    let failureCount = 0;

    for (const file of validFiles) {
      try {
        if (file.type.startsWith('image/')) {
          const blob = await compressImageToBlob(file);
          const ext = blob.type.split('/')[1] || 'webp';
          const anonymousName = generateAnonymousFilename(ext, blob.type || 'image/webp');
          const url = await streamFileDirectToCloudStorage(blob, 'media', ext);
          const sizeStr = `${(blob.size / 1024).toFixed(0)} KB`;
          payloadParts.push(`[Attachment: ${anonymousName} size:${sizeStr} type:${blob.type || 'image/webp'} url:${url}]`);
        } else {
          const rawExt = file.type.split('/')[1] || file.name.split('.').pop() || 'bin';
          const anonymousName = generateAnonymousFilename(rawExt, file.type || 'application/octet-stream');
          const url = await streamFileDirectToCloudStorage(file, 'media', rawExt);
          const sizeStr = file.size > 1024 * 1024
            ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
            : `${(file.size / 1024).toFixed(0)} KB`;
          payloadParts.push(`[Attachment: ${anonymousName} size:${sizeStr} type:${file.type || 'application/octet-stream'} url:${url}]`);
        }
      } catch (err) {
        console.error('Upload failed for attachment:', err);
        failureCount++;
      }
    }

    if (failureCount > 0) {
      velumToast.error(`${failureCount} attachment(s) failed to upload.`);
    }

    if (payloadParts.length > 0) {
      onSendMessage(payloadParts.join(' '), null, false);
    }

    e.target.value = '';
  };

  return {
    handleTriggerPhotoInput,
    handleTriggerVideoInput,
    handleTriggerAudioInput,
    handleTriggerDocInput,
    handleDismissAttachment,
    handleFileSelect,
  };
}
