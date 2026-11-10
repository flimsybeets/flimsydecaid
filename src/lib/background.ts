// Optional photo behind the whole app (Settings → Look), with one
// darken slider: black laid over it at |tone| %, so the glass and the light
// text stay readable on any photo. Tone is 0 (as is) … −100 (black); older
// saved values above 0 (there used to be a lighten side) read as 0.

export const APP_BACKGROUND_KEY = 'appBackground';
/** A fresh background starts a little dark, which suits the cream text. */
export const DEFAULT_TONE = -45;

export function clampTone(n: number): number {
  return Number.isFinite(n) ? Math.max(-100, Math.min(0, Math.round(n))) : DEFAULT_TONE;
}

export function parseTone(raw: unknown): number {
  return typeof raw === 'number' ? clampTone(raw) : DEFAULT_TONE;
}

/** The layer over the photo for a tone: black at |tone| %. */
export function toneOverlay(tone: number): string {
  return `rgb(0 0 0 / ${(-clampTone(tone) / 100).toFixed(2)})`;
}

export function toneLabel(tone: number): string {
  const t = clampTone(tone);
  return t === 0 ? 'Not darkened' : `${-t}%`;
}
