import axios from 'axios';
import { getSessionId } from './auth';

interface UploadConfig {
  uploadUrl: string;
  relativeDbPath: string;
}

/**
 * Generates an anonymous, compact collision-resistant filename.
 * Formats: img_[id10].[ext], aud_[id10].[ext], vid_[id10].[ext], doc_[id10].[ext]
 * Guarantees zero leakage of client device timestamps, camera models, app names, or phone numbers.
 */
export function generateAnonymousFilename(fileExtension: string, mimeTypeOrCategory?: string): string {
  const cleanExt = (fileExtension || 'bin').replace(/^\./, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  let prefix = 'doc';
  const hint = (mimeTypeOrCategory || cleanExt).toLowerCase();
  if (hint.includes('image') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(cleanExt)) {
    prefix = 'img';
  } else if (hint.includes('audio') || hint.includes('voice') || ['webm', 'ogg', 'mp3', 'm4a', 'wav'].includes(cleanExt)) {
    prefix = 'aud';
  } else if (hint.includes('video') || ['mp4', 'mov', 'mkv'].includes(cleanExt)) {
    prefix = 'vid';
  }

  let randomHex = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(5);
    crypto.getRandomValues(bytes);
    randomHex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  } else {
    randomHex = Math.random().toString(16).substring(2, 12);
  }

  return `${prefix}_${randomHex}.${cleanExt || 'bin'}`;
}

/**
 * Strips EXIF, GPS, and hardware device metadata from image files by re-rendering
 * through an HTML5 Canvas into a clean WebP/JPEG blob.
 */
export function stripImageMetadataAndCompress(file: File | Blob, maxDimension = 1400, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let targetWidth = img.naturalWidth || img.width;
          let targetHeight = img.naturalHeight || img.height;

          if (targetWidth > maxDimension || targetHeight > maxDimension) {
            if (targetWidth >= targetHeight) {
              targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
              targetWidth = maxDimension;
            } else {
              targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
              targetHeight = maxDimension;
            }
          }

          canvas.width = targetWidth;
          canvas.height = targetHeight;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return reject(new Error("Canvas 2D context unavailable"));
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // Re-encode to clean image/webp without EXIF/metadata header blocks
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Image re-encoding failed to generate blob"));
            }
          }, "image/webp", quality);
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => reject(new Error("Failed to decode image data into Image element"));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error("FileReader failed to read raw image"));
    reader.readAsDataURL(file);
  });
}

/**
 * PHASE A: INSTANT HARDWARE PHOTO PROCESSING & METADATA STRIPPING
 */
export const captureAndCompressPhoto = (inputEvent: any): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const target = inputEvent.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) {
      return reject(new Error("No asset target selected"));
    }
    const rawFile = target.files[0];
    stripImageMetadataAndCompress(rawFile, 1200, 0.80)
      .then(resolve)
      .catch(reject);
  });
};

/**
 * PHASE B: MIC STREAM PERMISSION AND RECORDING CAPTURE
 */
let nativeRecorder: MediaRecorder | null = null;
let collectedAudioBuffers: Blob[] = [];

export const initiateMicrophoneStream = async (): Promise<MediaStream> => {
  // Triggers the native permission popup on the screen
  const liveStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  collectedAudioBuffers = [];

  // Automatically check for mobile format codec support configurations (iOS compat fallback)
  const supportsWebm = typeof MediaRecorder !== 'undefined' && 
                        typeof MediaRecorder.isTypeSupported === 'function' && 
                        MediaRecorder.isTypeSupported("audio/webm");
  const encodingOptions = supportsWebm
    ? { mimeType: "audio/webm" }
    : { mimeType: "audio/mp4" };

  nativeRecorder = new MediaRecorder(liveStream, encodingOptions);
  nativeRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) collectedAudioBuffers.push(event.data);
  };
  nativeRecorder.start();
  return liveStream;
};

export const terminateMicrophoneStream = (): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    if (!nativeRecorder) {
      return reject(new Error("No active recording stream"));
    }
    nativeRecorder.onstop = () => {
      const mimeType = nativeRecorder ? nativeRecorder.mimeType : "audio/webm";
      const cleanAudioBlob = new Blob(collectedAudioBuffers, { type: mimeType });
      // Drop hardware connection lines instantly to turn off the recording light indicator
      if (nativeRecorder && nativeRecorder.stream) {
        nativeRecorder.stream.getTracks().forEach(track => track.stop());
      }
      nativeRecorder = null;
      resolve(cleanAudioBlob);
    };
    nativeRecorder.stop();
  });
};

export const pauseMicrophoneStream = (): void => {
  if (nativeRecorder && nativeRecorder.state === 'recording') {
    try {
      nativeRecorder.requestData();
      nativeRecorder.pause();
    } catch (e) {}
  }
};

export const resumeMicrophoneStream = (): void => {
  if (nativeRecorder && nativeRecorder.state === 'paused') {
    try {
      nativeRecorder.resume();
    } catch (e) {}
  }
};

export const getDraftAudioBlob = (): Blob | null => {
  if (collectedAudioBuffers.length === 0) return null;
  const mimeType = nativeRecorder ? nativeRecorder.mimeType : "audio/webm";
  return new Blob(collectedAudioBuffers, { type: mimeType });
};

export const cancelMicrophoneStream = (): void => {
  if (nativeRecorder) {
    nativeRecorder.onstop = null;
    if (nativeRecorder.state === 'recording' || nativeRecorder.state === 'paused') {
      try {
        nativeRecorder.stop();
      } catch (e) {}
    }
    if (nativeRecorder.stream) {
      nativeRecorder.stream.getTracks().forEach(track => track.stop());
    }
    nativeRecorder = null;
  }
  collectedAudioBuffers = [];
};

/**
 * DIRECT FAST-PATH MEDIA STREAMING
 * Uploads directly to /v2/media/upload using axios with instant progress and zero timeout cascading.
 */
export const streamFileDirectToCloudStorage = async (
  processedBlob: Blob,
  folderDestination: "avatars" | "media",
  fileExtension: string
): Promise<string> => {
  const sid = getSessionId();
  const mimeType = processedBlob.type || 'image/webp';
  const cleanExt = mimeType.split('/')[1] || fileExtension.replace(/^\./, '') || 'webp';
  const anonymousFilename = generateAnonymousFilename(cleanExt, mimeType);
  const folder = folderDestination === 'avatars' ? 'avatars' : 'chat';

  const response = await axios.post(
    `/v2/media/upload?filename=${encodeURIComponent(anonymousFilename)}&folder=${encodeURIComponent(folder)}`,
    processedBlob,
    {
      headers: {
        'Content-Type': mimeType,
        'Authorization': `Bearer ${sid}`,
        'x-session-id': sid,
        'x-session-token': sid
      },
      timeout: 30000
    }
  );

  if (response.data && (response.data.url || response.data.relative_path)) {
    return response.data.url || response.data.relative_path;
  }

  throw new Error('Upload completed but server returned no storage URL');
};

/**
 * Resolves media/avatar URLs to ensure valid absolute/relative resolution across Web, PWA, and Capacitor APKs.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const isCapacitorOrLocalApk = typeof window !== 'undefined' && (
    (window as any).Capacitor?.isNativePlatform?.() ||
    window.location.protocol === 'capacitor:' || 
    window.location.protocol === 'ionic:' ||
    (window.location.hostname === 'localhost' && window.location.port !== '3000' && window.location.port !== '5173')
  );

  if (isCapacitorOrLocalApk) {
    const backendBase = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');
    return backendBase ? `${backendBase}${url.startsWith('/') ? '' : '/'}${url}` : url;
  }

  return url;
}

/**
 * Formats a clean download filename with timestamp instead of exposing internal storage keys.
 * Format: IMG_YYYYMMDD_HHMMSS.[ext], VID_YYYYMMDD_HHMMSS.[ext], AUD_YYYYMMDD_HHMMSS.[ext]
 */
export function getFormattedDownloadFilename(urlOrName?: string, defaultExt = 'bin'): string {
  const target = (urlOrName || '').split('?')[0];
  const ext = (target.split('.').pop() || defaultExt).toLowerCase().replace(/[^a-z0-9]/g, '') || defaultExt;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  let prefix = 'DOC';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
    prefix = 'IMG';
  } else if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) {
    prefix = 'VID';
  } else if (['ogg', 'mp3', 'm4a', 'wav'].includes(ext)) {
    prefix = 'AUD';
  }
  return `${prefix}_${timestamp}.${ext}`;
}
