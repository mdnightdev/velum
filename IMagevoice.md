To handle multi-megabyte smartphone photos and voice notes cleanly on a phone-hosted node or low-tier VPS, you need a resilient client-side media pipeline. This architecture ensures that large binary streams skip your single-threaded Node.js server entirely.
Here is the complete blueprint, including Client-Side Permission Capture, On-the-Fly Image Compression, and Automated Cloudflare R2 Lifecycle Cleanup Rules to automatically purge aborted uploads.
------------------------------
## 1. Cloudflare R2 Lifecycle Rules: Deleting Abandoned Uploads Automatically
When your frontend requests a presigned URL, Cloudflare R2 reserves an Multipart Upload or expects a file at that key destination. If a user closes the app, kills the process, or cancels the upload halfway, those stranded partial file bytes sit in your bucket storage forever, running up a bill.
You do not need to write server code to clean this up. Cloudflare R2 has a built-in automated garbage collection routine called Lifecycle Policies.
## How to configure it inside your Cloudflare Dashboard:

   1. Log into your Cloudflare Dashboard and select R2 Object Storage.
   2. Click into your active bucket, navigate to the Settings tab, and find Lifecycle Policies.
   3. Click Add Rule and apply these parameters:
   * Rule Name: Auto-Abort-Incomplete-Multipart-Uploads
      * Scope: Apply to all objects in the bucket.
      * Action: Check Delete incomplete multipart uploads.
      * Age Duration: Set to 1 Day.
   
What this does: If an image upload fails or cancels halfway, Cloudflare will track the incomplete fragment stream on its edge servers and delete it automatically after 24 hours, charging you $0.00 for storage.
------------------------------
## 2. Full Client-Side Implementation (src/utils/mediaPipeline.ts)
This single, production-ready utility script handles:

   1. Triggering smartphone hardware permissions.
   2. Compressing huge smartphone camera images down to lightweight .webp profiles instantly using a browser canvas.
   3. Capturing real-time microphone voice notes into highly compressed mobile-native formats.
   4. Uploading the resulting clean data directly to Cloudflare R2.

interface UploadConfig {
    uploadUrl: string;
    relativeDbPath: string;
}
/**
 * PHASE A: INSTANT HARDWARE PHOTO PROCESSING & COMPRESSION
 */export const captureAndCompressPhoto = (inputEvent: Event): Promise<Blob> => {
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
            imgElement.src = event.target?.result as string;
        };
        imageReader.readAsDataURL(rawFile);
    });
};
/**
 * PHASE B: MIC STREAM PERMISSION AND RECORDING CAPTURE
 */let nativeRecorder: MediaRecorder | null = null;let collectedAudioBuffers: Blob[] = [];
export const initiateMicrophoneStream = async (): Promise<void> => {
    // 🌟 Triggers the native permission popup on the phone screen
    const liveStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    collectedAudioBuffers = [];

    // Automatically check for mobile format codec support configurations
    const encodingOptions = MediaRecorder.isTypeSupported("audio/webm")
        ? { mimeType: "audio/webm" }
        : { mimeType: "audio/mp4" }; // Standard iOS/iPhone container execution fallback

    nativeRecorder = new MediaRecorder(liveStream, encodingOptions);
    nativeRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) collectedAudioBuffers.push(event.data);
    };
    nativeRecorder.start();
};
export const terminateMicrophoneStream = (): Promise<Blob> => {
    return new Promise((resolve) => {
        if (!nativeRecorder) return;
        nativeRecorder.onstop = () => {
            const cleanAudioBlob = new Blob(collectedAudioBuffers, { type: nativeRecorder!.mimeType });
            // Drop hardware connection lines instantly to turn off the recording light indicator
            nativeRecorder!.stream.getTracks().forEach(track => track.stop());
            resolve(cleanAudioBlob);
        };
        nativeRecorder.stop();
    });
};
/**
 * PHASE C: SECURE PRESIGNED LEASE TOKEN DISPATCH TO CLOUDFLARE R2
 */export const streamFileDirectToCloudStorage = async (
    processedBlob: Blob,
    folderDestination: "avatars" | "media",
    fileExtension: string
): Promise<string> => {
    // 1. Fetch secure temporary upload link from Velum core node
    const tokenNegotiator = await fetch("https://velum.zone", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("velum_jwt_token")}`
        },
        body: JSON.stringify({ extension: fileExtension, type: folderDestination })
    });

    if (!tokenNegotiator.ok) throw new Error("Backend storage authorization denied");

    const { uploadUrl, relativeDbPath }: UploadConfig = await tokenNegotiator.json();

    // 2. Stream binary payload directly to Cloudflare edge server
    const httpPipe = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": processedBlob.type },
        body: processedBlob // Transmits pure binary stream data without heavy nested wrappers
    });

    if (!httpPipe.ok) throw new Error("Target object server streaming channel rejected bytes");

    // Return the clean string pointer to store inside your SQLite schema record
    return relativeDbPath; 
};

------------------------------
## 3. How to Wire This into Your UI Templates## Photographic Capture Element (Camera / Gallery Selection Input Hook)
Place this clean HTML block inside your component script template. The browser handles native permission execution loops directly:

<!-- Triggered configuration prioritizes launch profiles straight for mobile camera devices -->
<input 
  type="file" 
  accept="image/*" 
  capture="user" 
  id="velum-camera-node"
  style="display: none;" 
  onChange={async (e) => {
     try {
         // 1. Run raw asset through the canvas optimization compressor
         const optimizedImageFile = await captureAndCompressPhoto(e);
         
         // 2. Stream directly to Cloudflare bucket
         const databasePointer = await streamFileDirectToCloudStorage(optimizedImageFile, "avatars", "webp");
         
         // 3. Post databasePointer string to SQLite schema updating routines
         console.log("Database path link reference generated successfully:", databasePointer);
     } catch (err) {
         console.error("Camera transaction pipeline dropped processing:", err);
     }
  }}
/>

<button onClick={() => document.getElementById('velum-camera-node')?.click()}>
  Open Camera / Gallery
</button>

## Voice Note Interaction Flow (Microphone Action Hooks)
Wire these calls directly to your message console record action handlers:

// Call when user holds down or presses the "Record" UI widget nodeconst onStartVoiceWidgetPressed = async () => {
    try {
        await initiateMicrophoneStream();
        console.log("Audio pipeline capture sequence actively recording...");
    } catch (err) {
        alert("Microphone processing privileges are required to compile audio feeds.");
    }
};
// Call when user releases or presses the "Stop / Send" UI button widgetconst onStopVoiceWidgetReleased = async () => {
    try {
        const rawAudioBlob = await terminateMicrophoneStream();
        
        // Push raw binary stream directly to R2 cloud engine buckets
        const audioDatabasePointer = await streamFileDirectToCloudStorage(rawAudioBlob, "media", "m4a");
        
        // Broadcast string reference over active real-time WebSocket channel instances
        // ws.send(JSON.stringify({ type: "CHAT_VOICE_ATTACHMENT", uri: audioDatabasePointer }));
        console.log("Audio file permanently committed to cloud storage box:", audioDatabasePointer);
    } catch (err) {
        console.error("Audio recording stream failed to transmit properly:", err);
    }
};

------------------------------
## 4. Code Architecture Overview

+-----------------------+     1. Request Token      +--------------------------+

|  User's Mobile Phone  | ------------------------> | Velum Server Node (App)  |
|                       | <------------------------ | (Returns Presigned URL)  |
|  [Hardware Captured]  |     2. Presigned Link     +--------------------------+
|  [Image Compressed]   |
|                       |     3. Stream Raw Binary  +--------------------------+
|  (Bypasses Server)    | ------------------------> | Cloudflare R2 Bucket     |
|                       |                           | (Auto Cleans Aborts)     |
+-----------------------+                           +--------------------------+
