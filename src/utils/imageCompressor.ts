/**
 * Compresses an image data URL using Canvas API to a specified max dimension and quality.
 */
export async function compressImage(dataUrl: string, maxDimension: number = 512, quality: number = 0.85): Promise<Blob> {
  const img = document.createElement('img');
  img.src = dataUrl;
  
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Failed to load image for compression'));
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  let width = img.width;
  let height = img.height;
  
  if (width > height) {
    if (width > maxDimension) {
      height *= maxDimension / width;
      width = maxDimension;
    }
  } else {
    if (height > maxDimension) {
      width *= maxDimension / height;
      height = maxDimension;
    }
  }
  
  canvas.width = width;
  canvas.height = height;
  
  if (ctx) {
    ctx.drawImage(img, 0, 0, width, height);
  }
  
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
  });

  if (!blob) {
    throw new Error('Image compression failed to generate a blob');
  }

  return blob;
}
