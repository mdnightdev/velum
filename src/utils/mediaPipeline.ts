interface UploadConfig {
  uploadUrl: string;
  relativeDbPath: string;
}

/**
 * PHASE A: INSTANT HARDWARE PHOTO PROCESSING & COMPRESSION
 */
export const captureAndCompressPhoto = (inputEvent: any): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const target = inputEvent.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) {
      return reject(new Error("No asset target selected"));
    }

    const rawFile = target.files[0];
    const imageReader = new FileReader();

    imageReader.onload = (event) => {
      const imgElement = new Image();
      imgElement.onload = () => {
        const canvas = document.createElement("canvas");
        
        // Enforce maximum production image boundaries (1200px width limit)
        const MAX_WIDTH = 1200;
        let targetWidth = imgElement.width;
        let targetHeight = imgElement.height;

        if (targetWidth > MAX_WIDTH) {
          targetHeight = Math.round((targetHeight * MAX_WIDTH) / targetWidth);
          targetWidth = MAX_WIDTH;
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas generation failed"));
        
        // Redraw image onto sizing bounds
        ctx.drawImage(imgElement, 0, 0, targetWidth, targetHeight);

        // Compress asset to high-efficiency webp profile at 80% compression quality
        canvas.toBlob((compressedBlob) => {
          if (compressedBlob) {
            resolve(compressedBlob);
          } else {
            reject(new Error("Image compression logic dropped bytes"));
          }
        }, "image/webp", 0.80);
      };
      imgElement.onerror = () => reject(new Error("Failed to load image element"));
      imgElement.src = event.target?.result as string;
    };
    imageReader.onerror = () => reject(new Error("FileReader failed to parse raw file"));
    imageReader.readAsDataURL(rawFile);
  });
};

/**
 * PHASE B: MIC STREAM PERMISSION AND RECORDING CAPTURE
 */
let nativeRecorder: MediaRecorder | null = null;
let collectedAudioBuffers: Blob[] = [];

export const initiateMicrophoneStream = async (): Promise<void> => {
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

export const cancelMicrophoneStream = (): void => {
  if (nativeRecorder) {
    nativeRecorder.onstop = null;
    if (nativeRecorder.state === 'recording') {
      nativeRecorder.stop();
    }
    if (nativeRecorder.stream) {
      nativeRecorder.stream.getTracks().forEach(track => track.stop());
    }
    nativeRecorder = null;
  }
  collectedAudioBuffers = [];
};

/**
 * PHASE C: SECURE PRESIGNED LEASE TOKEN DISPATCH TO CLOUDFLARE R2
 */
export const streamFileDirectToCloudStorage = async (
  processedBlob: Blob,
  folderDestination: "avatars" | "media",
  fileExtension: string
): Promise<string> => {
  const sid = sessionStorage.getItem('velum-sessionId') || '';
  
  try {
    // 1. Fetch secure temporary upload link from Velum core node
    const tokenNegotiator = await fetch('/api/storage/upload-token', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sid}`
      },
      body: JSON.stringify({ extension: fileExtension, type: folderDestination })
    });

    if (tokenNegotiator.ok) {
      const { uploadUrl, relativeDbPath }: UploadConfig = await tokenNegotiator.json();

      // 2. Stream binary payload directly to Cloudflare edge server
      const httpPipe = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": processedBlob.type },
        body: processedBlob // Transmits pure binary stream data without heavy nested wrappers
      });

      if (httpPipe.ok) {
        return relativeDbPath;
      }
    }
  } catch (err) {
    console.warn('[STORAGE] Presigned S3 upload failed, falling back to local server upload:', err);
  }

  // Fallback to local server upload if presigned endpoint fails or is unconfigured
  const endpoint = folderDestination === 'avatars' ? '/api/user/upload-avatar' : '/api/user/upload-media';
  const uploadRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': processedBlob.type,
      'Authorization': `Bearer ${sid}`
    },
    body: processedBlob
  });

  if (!uploadRes.ok) {
    throw new Error("Target object server streaming channel rejected bytes");
  }

  const data = await uploadRes.json();
  return data.url; 
};
