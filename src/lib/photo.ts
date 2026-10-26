// Bag photos: Decaid has no image API, so photos are shrunk to a small JPEG
// and saved as a data URL in the key-value store under photo:<batchId>.
// Kept out of BeanBatch.extras so listing beans stays light.

import type { Rect } from './crop';

export const photoKey = (batchId: string) => `photo:${batchId}`;

/**
 * Downscale an image file or camera frame to a JPEG data URL (~50–120 KB).
 * With `crop` (pixels of the source image), only that part is kept, drawn
 * straight to the final size so it is resampled once.
 */
export async function toJpegDataUrl(source: Blob | HTMLVideoElement, maxEdge = 900, quality = 0.78, crop?: Rect): Promise<string> {
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

  const part = crop ?? { x: 0, y: 0, w: width, h: height };
  const scale = Math.min(1, maxEdge / Math.max(part.w, part.h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(part.w * scale));
  canvas.height = Math.max(1, Math.round(part.h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(drawable, part.x, part.y, part.w, part.h, 0, 0, canvas.width, canvas.height);
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

/** A camera frame at full resolution as a JPEG blob, so it can be cropped before it is downscaled. */
export function frameBlob(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas unavailable'));
  ctx.drawImage(video, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No frame'))), 'image/jpeg', 0.92));
}

/** A saved photo (data URL) back as a blob, for cropping again. */
export async function dataUrlBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}
