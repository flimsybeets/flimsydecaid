// Optional photo behind the whole app (Settings → Theme options), with one
// tone slider: below 0 lays black over it (darken), above 0 white (lighten),
// so the glass and text stay readable on any photo.

export const APP_BACKGROUND_KEY = 'appBackground';
/** A fresh background starts a little dark, which suits the cream text. */
export const DEFAULT_TONE = -45;

export function clampTone(n: number): number {
  return Number.isFinite(n) ? Math.max(-100, Math.min(100, Math.round(n))) : DEFAULT_TONE;
}

export function parseTone(raw: unknown): number {
  return typeof raw === 'number' ? clampTone(raw) : DEFAULT_TONE;
}

/** The layer over the photo for a tone: black or white at |tone| %. */
export function toneOverlay(tone: number): string {
  const t = clampTone(tone);
  const a = (Math.abs(t) / 100).toFixed(2);
  return t < 0 ? `rgb(0 0 0 / ${a})` : `rgb(255 255 255 / ${a})`;
}

export function toneLabel(tone: number): string {
  const t = clampTone(tone);
  return t === 0 ? 'As is' : t < 0 ? `Darker ${-t}%` : `Lighter ${t}%`;
}
