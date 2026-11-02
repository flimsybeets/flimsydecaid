// Theme options: small switches that change how the skin looks.
// Stored in Decaid's key-value store so they survive skin reloads.

import { parseTilePreview, type TilePreview } from './miniGraph';
import { DEFAULT_TONE, parseTone } from './background';

export const THEME_KEY = 'theme';

/** The hue of the big glass sheets (brew panel, dialogs, graphs). */
export type PanelTint = 'dark' | 'teal' | 'coffee' | 'plum';
export const PANEL_TINTS: readonly PanelTint[] = ['dark', 'teal', 'coffee', 'plum'];
export function parsePanelTint(raw: unknown): PanelTint {
  return PANEL_TINTS.includes(raw as PanelTint) ? (raw as PanelTint) : 'dark';
}

export interface ThemeOptions {
  /** Ghosts instead of the clock on the screensaver. */
  halloween: boolean;
  /** The big clock on the screensaver (on unless turned off). */
  clock: boolean;
  /** Little graph on each profile tile on Home: none, the planned shape, or the last shot. */
  tilePreview: TilePreview;
  /** App background darkening, −100 (black) … 0 (as is); see lib/background. */
  bgTone: number;
  /** Sheet colour: neutral dark frosted glass unless a hue is picked. */
  panelTint: PanelTint;
}

export const DEFAULT_THEME: ThemeOptions = { halloween: false, clock: true, tilePreview: 'shot', bgTone: DEFAULT_TONE, panelTint: 'dark' };

/** A stored value → options; a missing or odd value means the defaults (Halloween off, clock on). */
export function parseTheme(raw: unknown): ThemeOptions {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_THEME };
  const r = raw as { halloween?: unknown; clock?: unknown; tilePreview?: unknown; bgTone?: unknown; panelTint?: unknown };
  return { halloween: r.halloween === true, clock: r.clock !== false, tilePreview: parseTilePreview(r.tilePreview), bgTone: parseTone(r.bgTone), panelTint: parsePanelTint(r.panelTint) };
}
