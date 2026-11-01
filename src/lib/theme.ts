// Theme options: small switches that change how the skin looks.
// Stored in Decaid's key-value store so they survive skin reloads.

import { parseTilePreview, type TilePreview } from './miniGraph';
import { DEFAULT_TONE, parseTone } from './background';

export const THEME_KEY = 'theme';

export interface ThemeOptions {
  /** Ghosts instead of the clock on the screensaver. */
  halloween: boolean;
  /** The big clock on the screensaver (on unless turned off). */
  clock: boolean;
  /** Little graph on each profile tile on Home: none, the planned shape, or the last shot. */
  tilePreview: TilePreview;
  /** App background tone, −100 (black) … 100 (white); see lib/background. */
  bgTone: number;
}

export const DEFAULT_THEME: ThemeOptions = { halloween: false, clock: true, tilePreview: 'shot', bgTone: DEFAULT_TONE };

/** A stored value → options; a missing or odd value means the defaults (Halloween off, clock on). */
export function parseTheme(raw: unknown): ThemeOptions {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_THEME };
  const r = raw as { halloween?: unknown; clock?: unknown; tilePreview?: unknown; bgTone?: unknown };
  return { halloween: r.halloween === true, clock: r.clock !== false, tilePreview: parseTilePreview(r.tilePreview), bgTone: parseTone(r.bgTone) };
}
