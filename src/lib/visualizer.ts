// Visualizer upload goes through Decaid's bundled plugin, `visualizer.reaplugin`.
// The plugin uploads shots itself once it is enabled, signed in and
// AutoUpload is on; the skin only configures it and can upload one shot on
// request (POST /plugins/visualizer.reaplugin/upload { shotId }).
//
// Settings come back from GET /plugins/{id}/settings with the password
// redacted to { isSet: boolean }. A POST patch leaves omitted fields alone
// and `null` clears one, so the stored password is never read or echoed.

import type { PluginInfo, ShotSummary } from '../api/types';

export const VISUALIZER_ID = 'visualizer.reaplugin';

/** missing: not installed. off: installed but disabled. on: enabled and loaded. */
export type PluginState = 'missing' | 'off' | 'on';

export function pluginState(plugins: readonly PluginInfo[], id = VISUALIZER_ID): PluginState {
  const p = plugins.find((x) => x.id === id);
  if (!p) return 'missing';
  return p.loaded ? 'on' : 'off';
}

export interface VisualizerSettings {
  username: string;
  /** Whether a password is stored. The password itself never comes back. */
  passwordSet: boolean;
  autoUpload: boolean;
}

export function parseSettings(raw: unknown): VisualizerSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pw = r.Password as { isSet?: unknown } | string | null | undefined;
  return {
    username: typeof r.Username === 'string' ? r.Username : '',
    passwordSet: typeof pw === 'object' && pw !== null ? pw.isSet === true : false,
    // The manifest's default is on.
    autoUpload: typeof r.AutoUpload === 'boolean' ? r.AutoUpload : true,
  };
}

/** Patch for the credentials form. A blank password field means "keep the stored one" (omitted). */
export function credentialsPatch(username: string, password: string): Record<string, string> {
  const patch: Record<string, string> = { Username: username.trim() };
  if (password !== '') patch.Password = password;
  return patch;
}

/** The Visualizer id the plugin stamped on a shot after uploading it, or null. */
export function visualizerIdOf(shot: Pick<ShotSummary, 'annotations'> | null | undefined): string | null {
  const extras = shot?.annotations?.extras;
  if (!extras) return null;
  if (extras.visualizerId != null && extras.visualizerId !== '') return String(extras.visualizerId);
  const nested = extras.visualizer as { shot_id?: unknown } | undefined;
  if (nested?.shot_id != null && nested.shot_id !== '') return String(nested.shot_id);
  return null;
}

export const visualizerUrl = (id: string) => `https://visualizer.coffee/shots/${encodeURIComponent(id)}`;
