export interface MediaMetadata {
  mime_type: string;
  file_size_bytes: number;
  width?: number;
  height?: number;
  blurhash?: string;
  duration_ms?: number;
  sha256_checksum?: string;
}

/**
  Generates a 32-char compact blurhash canvas placeholder string (DataURL) or compact hash
 */
export async function generateCanvasBlurhash(imgElement: HTMLImageElement): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(imgElement, 0, 0, 16, 16);
    return canvas.toDataURL('image/jpeg', 0.2);
  } catch {
    return '';
  }
}

/**
 * Computes SHA-256 checksum of a Blob/File
 */
export async function computeSha256(file: Blob): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}

/**
 * Extracts comprehensive media metadata (dimensions, mime, size, blurhash, duration, sha256)
 */
export async function extractMediaMetadata(file: File | Blob, mimeType?: string): Promise<MediaMetadata> {
  const mime = mimeType || file.type || 'application/octet-stream';
  const size = file.size;

  const metadata: MediaMetadata = {
    mime_type: mime,
    file_size_bytes: size
  };

  // Compute SHA-256
  metadata.sha256_checksum = await computeSha256(file);

  // Process Images
  if (mime.startsWith('image/')) {
    await new Promise<void>((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = async () => {
        metadata.width = img.naturalWidth;
        metadata.height = img.naturalHeight;
        metadata.blurhash = await generateCanvasBlurhash(img);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      img.src = url;
    });
  }

  // Process Audio/Video
  if (mime.startsWith('audio/') || mime.startsWith('video/')) {
    await new Promise<void>((resolve) => {
      const url = URL.createObjectURL(file);
      const mediaEl = document.createElement(mime.startsWith('video/') ? 'video' : 'audio');
      mediaEl.preload = 'metadata';
      mediaEl.onloadedmetadata = () => {
        if (isFinite(mediaEl.duration)) {
          metadata.duration_ms = Math.round(mediaEl.duration * 1000);
        }
        if (mime.startsWith('video/') && 'videoWidth' in mediaEl) {
          const video = mediaEl as HTMLVideoElement;
          metadata.width = video.videoWidth;
          metadata.height = video.videoHeight;
        }
        URL.revokeObjectURL(url);
        resolve();
      };
      mediaEl.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      mediaEl.src = url;
    });
  }

  return metadata;
}
