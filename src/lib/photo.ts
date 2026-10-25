// Bag photos: Decaid has no image API, so photos are shrunk to a small JPEG
// and saved as a data URL in the key-value store under photo:<batchId>.
// Kept out of BeanBatch.extras so listing beans stays light.

export const photoKey = (batchId: string) => `photo:${batchId}`;

/** Downscale an image file or camera frame to a JPEG data URL (~50–120 KB). */
export async function toJpegDataUrl(source: Blob | HTMLVideoElement, maxEdge = 900, quality = 0.78): Promise<string> {
  let width: number;
  let height: number;
  let drawable: CanvasImageSource;
  let bitmap: ImageBitmap | null = null;

  if (source instanceof Blob) {
    bitmap = await createImageBitmap(source);
    drawable = bitmap;
    width = bitmap.width;
    height = bitmap.height;
  } else {
    drawable = source;
    width = source.videoWidth;
    height = source.videoHeight;
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(drawable, 0, 0, canvas.width, canvas.height);
  bitmap?.close();
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Live camera via getUserMedia. Decaid only allows this for the installed
 * skin on its own http://localhost:<port> origin, with per-skin consent, so
 * it fails on the dev server and whenever the user says no. Callers must
 * fall back to <input type="file" accept="image/*" capture="user">.
 * Front camera: the tablet is mounted facing you, so the back one faces the wall.
 */
export async function openFrontCamera(): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'user' } },
      audio: false,
    });
  } catch {
    return null;
  }
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}
