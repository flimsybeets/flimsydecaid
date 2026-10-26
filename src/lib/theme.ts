// Theme options: small switches that change how the skin looks.
// Stored in Decaid's key-value store so they survive skin reloads.

export const THEME_KEY = 'theme';

export interface ThemeOptions {
  /** Ghosts instead of the clock on the screensaver. */
  halloween: boolean;
}

export const DEFAULT_THEME: ThemeOptions = { halloween: false };

/** A stored value → options; a missing or odd value means everything off. */
export function parseTheme(raw: unknown): ThemeOptions {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_THEME };
  return { halloween: (raw as { halloween?: unknown }).halloween === true };
}
