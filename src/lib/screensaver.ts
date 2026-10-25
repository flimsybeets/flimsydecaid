// Screensaver: a photo picked from the tablet, shown while the machine
// sleeps, with a clock floating over it. The photo lives in Decaid's
// key-value store so it survives skin reloads.

export const SCREENSAVER_KEY = 'screensaver';

/** Screen brightness (0–100) while the screensaver shows: dim, but the clock still reads across the room. */
export const SCREENSAVER_BRIGHTNESS = 12;

/**
 * Decaid caps a key-value store request body at 1 MiB, and the photo goes
 * up as a JSON string, so keep the data URL comfortably under that.
 */
export const SCREENSAVER_MAX_CHARS = 950_000;

/** Encoder settings to try in order: sharpest first, then smaller until it fits. */
export const SCREENSAVER_ATTEMPTS: readonly (readonly [maxEdge: number, quality: number])[] = [
  [1920, 0.85],
  [1920, 0.75],
  [1600, 0.75],
  [1280, 0.72],
  [1024, 0.68],
];

/** Encode at the best settings that fit under the store's size limit. */
export async function fitDataUrl(
  encode: (maxEdge: number, quality: number) => Promise<string>,
  limit = SCREENSAVER_MAX_CHARS,
): Promise<string> {
  for (const [edge, quality] of SCREENSAVER_ATTEMPTS) {
    const url = await encode(edge, quality);
    if (url.length <= limit) return url;
  }
  throw new Error('That image is too large to save, even shrunk down');
}

/** "9:41" or "21:41": hours and minutes only, no AM/PM, in the tablet's own 12/24-hour style. */
export function clockText(date: Date, locale?: string, hour12?: boolean): string {
  const parts = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12 }).formatToParts(date);
  return parts
    .filter((p) => p.type === 'hour' || p.type === 'minute' || (p.type === 'literal' && p.value.trim() !== ''))
    .map((p) => p.value)
    .join('')
    .trim();
}
