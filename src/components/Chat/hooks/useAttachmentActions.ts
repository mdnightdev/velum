import React, { RefObject } from 'react';
import { streamFileDirectToCloudStorage, stripImageMetadataAndCompress, generateAnonymousFilename, sanitizeMediaExtension } from '../../../utils/mediaPipeline';
import { Attachment } from './useMessageInput';
import { ComposeMediaItem } from '../MediaComposeModal';
import { velumToast } from '../../../utils/toast';

export const MAX_ATTACHMENT_BATCH = 5;
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const UPLOAD_CONCURRENCY = 3;

/** Still images that can open the chat cropper (not GIF/SVG). */
export function shouldOpenChatImageCropper(file: File): boolean {
  if (!file.type.startsWith('image/')) return false;
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return false;
  return true;
}

export function isComposeMediaFile(file: File): boolean {
  return file.type.startsWith('image/') || file.type.startsWith('video/');
}

export function compressImageToBlob(file: File): Promise<Blob> {
  return stripImageMetadataAndCompress(file, 1200, 0.85);
}

export function createComposeItemId(): string {
  return `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const src = evt.target?.result as string;
      if (src) resolve(src);
      else reject(new Error('Could not read file'));
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export async function fileToComposeItem(file: File): Promise<ComposeMediaItem> {
  const isImg = file.type.startsWith('image/');
  const isVid = file.type.startsWith('video/');
  const sizeStr = file.size > 1024 * 1024
    ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
    : `${(file.size / 1024).toFixed(0)} KB`;
  const data = URL.createObjectURL(file);
  return {
    id: createComposeItemId(),
    name: file.name,
    size: sizeStr,
    type: file.type || (isImg ? 'image/webp' : isVid ? 'video/mp4' : 'application/octet-stream'),
    data,
    file,
  };
}

export function revokeComposeItemUrls(items: ComposeMediaItem[] | null | undefined): void {
  if (!items?.length) return;
  for (const item of items) {
    if (item.data?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(item.data);
      } catch {
        /* ignore */
      }
    }
  }
}

export async function resolveComposeBlob(item: ComposeMediaItem): Promise<Blob> {
  if (item.file && item.file.size > 0) return item.file;
  if (item.data?.startsWith('data:')) return dataUriToBlob(item.data);
  if (item.data?.startsWith('blob:') || item.data?.startsWith('http')) {
    const res = await fetch(item.data);
    if (!res.ok) throw new Error(`Failed to read media (${res.status})`);
    return res.blob();
  }
  throw new Error('No media payload to upload');
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let completed = 0;
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index], index);
      completed += 1;
      onProgress?.(completed, items.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runWorker()));
  return results;
}

export function dataUriToBlob(dataURI: string): Blob {
  try {
    const parts = dataURI.split(',');
    const byteString = atob(parts[1] || parts[0]);
    const mimeString = parts[0]?.split(':')[1]?.split(';')[0] || 'application/octet-stream';
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  } catch {
    return new Blob([dataURI], { type: 'application/octet-stream' });
  }
}

export async function uploadComposeItems(
  items: ComposeMediaItem[],
  onProgress?: (done: number, total: number) => void
): Promise<string[]> {
  return mapWithConcurrency(items, UPLOAD_CONCURRENCY, async (item) => {
    const blob = await resolveComposeBlob(item);

    let uploadBlob: Blob = blob;
    if (item.type.startsWith('image/') && item.type !== 'image/gif' && item.type !== 'image/svg+xml') {
      try {
        uploadBlob = await stripImageMetadataAndCompress(blob, 1200, 0.85);
      } catch {
        uploadBlob = blob;
      }
    }

    const ext = sanitizeMediaExtension(
      uploadBlob.type || item.name.split('.').pop() || 'webp',
      item.type.startsWith('video/') ? 'mp4' : item.type.startsWith('audio/') ? 'webm' : 'webp'
    );
    const anonymousName = generateAnonymousFilename(ext, item.type || uploadBlob.type);
    const sizeStr = uploadBlob.size > 1024 * 1024
      ? `${(uploadBlob.size / (1024 * 1024)).toFixed(1)} MB`
      : `${(uploadBlob.size / 1024).toFixed(0)} KB`;
    const url = await streamFileDirectToCloudStorage(uploadBlob, 'media', ext);
    return `[Attachment: ${anonymousName} size:${sizeStr} type:${item.type || uploadBlob.type || 'image/webp'} url:${url}]`;
  }, onProgress);
}

function stageFileAsAttachment(file: File, setSelectedAttachment: (att: Attachment | null) => void): void {
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
}

export function useAttachmentActions({
  photoInputRef,
  videoInputRef,
  audioInputRef,
  docInputRef,
  setSelectedAttachment,
  setFileErrorAlert,
  onSendMessage,
  onOpenMediaCompose,
}: {
  photoInputRef?: RefObject<HTMLInputElement | null>;
  videoInputRef?: RefObject<HTMLInputElement | null>;
  audioInputRef?: RefObject<HTMLInputElement | null>;
  docInputRef?: RefObject<HTMLInputElement | null>;
  setSelectedAttachment: (att: Attachment | null) => void;
  setFileErrorAlert?: (msg: string | null) => void;
  onSendMessage: (content: string, peerUserId?: number | null, isVoice?: boolean, messageType?: string, replyToMessageId?: string | null) => void;
  onOpenMediaCompose?: (items: ComposeMediaItem[]) => void;
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

    if (fileList.length > MAX_ATTACHMENT_BATCH) {
      velumToast.error('Attachment limit exceeded. Keeping first 5 items.');
      fileList = fileList.slice(0, MAX_ATTACHMENT_BATCH);
    }

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

    const mediaFiles = validFiles.filter(isComposeMediaFile);
    const otherFiles = validFiles.filter((f) => !isComposeMediaFile(f));

    if (mediaFiles.length > 0 && onOpenMediaCompose) {
      try {
        const items = await Promise.all(mediaFiles.map(fileToComposeItem));
        onOpenMediaCompose(items);
      } catch {
        velumToast.error('Could not open media for preview.');
      }
      if (otherFiles.length > 0) {
        velumToast.error('Documents were skipped. Send them separately.');
      }
      e.target.value = '';
      return;
    }

    if (validFiles.length === 1) {
      stageFileAsAttachment(validFiles[0], setSelectedAttachment);
      e.target.value = '';
      return;
    }

    const payloadParts: string[] = [];
    let failureCount = 0;

    const tokens = await mapWithConcurrency(validFiles, UPLOAD_CONCURRENCY, async (file) => {
      try {
        if (file.type.startsWith('image/')) {
          const blob = await compressImageToBlob(file);
          const ext = sanitizeMediaExtension(blob.type, 'webp');
          const anonymousName = generateAnonymousFilename(ext, blob.type || 'image/webp');
          const url = await streamFileDirectToCloudStorage(blob, 'media', ext);
          const sizeStr = `${(blob.size / 1024).toFixed(0)} KB`;
          return `[Attachment: ${anonymousName} size:${sizeStr} type:${blob.type || 'image/webp'} url:${url}]`;
        }
        const rawExt = sanitizeMediaExtension(
          file.type || file.name.split('.').pop() || 'bin',
          'bin'
        );
        const anonymousName = generateAnonymousFilename(rawExt, file.type || 'application/octet-stream');
        const url = await streamFileDirectToCloudStorage(file, 'media', rawExt);
        const sizeStr = file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${(file.size / 1024).toFixed(0)} KB`;
        return `[Attachment: ${anonymousName} size:${sizeStr} type:${file.type || 'application/octet-stream'} url:${url}]`;
      } catch (err) {
        console.error('Upload failed for attachment:', err);
        failureCount++;
        return null;
      }
    });

    for (const token of tokens) {
      if (token) payloadParts.push(token);
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
