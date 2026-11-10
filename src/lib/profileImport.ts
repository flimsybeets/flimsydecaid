// New profile → From Visualizer / From a file.
//
// Visualizer: Decaid's bundled plugin has an `import` endpoint that takes a
// share code (POST /plugins/visualizer.reaplugin/import { shareCode }); it
// looks the shot up on visualizer.coffee, fetches its profile and saves it in
// Decaid itself. It needs the Visualizer sign-in from Settings.
//
// File: a profile in the JSON format the DE1 app, Visualizer ("Download
// profile JSON") and Decaid's own export use. Numbers in those files are often
// strings ("9.0"), so they are turned into numbers for the editor. The old DE1
// app .tcl format is not read.

import type { Profile, ProfileStep } from '../api/types';

/** A share code as typed or pasted: letters and digits only, upper case. Null unless it is 4 of them. */
export function shareCode(input: string): string | null {
  const code = input.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return /^[A-Z0-9]{4}$/.test(code) ? code : null;
}

/** Plain-language reason a Visualizer import failed. */
export function importErrorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  if (/not configured|credentials|401/i.test(msg)) return 'Sign in to Visualizer in Settings first, then try again.';
  if (/not loaded|404/i.test(msg)) return 'Turn on Visualizer in Settings first.';
  if (/no shared shots|missing shot id|share code/i.test(msg)) return 'No shot found for that code. Codes expire, so make a new one and try again.';
  if (/fetch|network|failed to fetch/i.test(msg)) return 'Couldn’t reach Visualizer. Check the tablet’s internet connection.';
  return 'The import didn’t work. Check the code and try again.';
}

const num = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
};

function cleanStep(raw: unknown, i: number): ProfileStep | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = { ...(raw as Record<string, unknown>) };
  const pump = s.pump === 'flow' ? 'flow' : s.pump === 'pressure' ? 'pressure' : null;
  if (!pump) return null;
  for (const k of ['volume', 'seconds', 'temperature', 'pressure', 'flow', 'weight']) {
    if (k in s) { const n = num(s[k]); if (n === undefined) delete s[k]; else s[k] = n; }
  }
  for (const k of ['exit', 'limiter']) {
    const o = s[k];
    if (o && typeof o === 'object') {
      const c = { ...(o as Record<string, unknown>) };
      for (const f of ['value', 'range']) if (f in c) { const n = num(c[f]); if (n === undefined) delete c[f]; else c[f] = n; }
      s[k] = c;
    }
  }
  return {
    ...s,
    name: typeof s.name === 'string' && s.name.trim() ? s.name : `step ${i + 1}`,
    pump,
    transition: s.transition === 'smooth' ? 'smooth' : 'fast',
    sensor: s.sensor === 'water' ? 'water' : 'coffee',
    volume: (s.volume as number | undefined) ?? 0,
    seconds: (s.seconds as number | undefined) ?? 0,
    temperature: (s.temperature as number | undefined) ?? 93,
  } as ProfileStep;
}

export type FileImport =
  | { ok: true; profile: Profile; others: number }
  | { ok: false; error: string };

/** Reads a profile file's text. `others` = how many more profiles the file held (only the first is opened). */
export function profileFromFile(text: string): FileImport {
  const t = text.trim();
  if (!t) return { ok: false, error: 'That file is empty.' };
  if (!t.startsWith('{') && !t.startsWith('[')) {
    if (/advanced_shot|profile_title|settings_profile_type/.test(t)) {
      return { ok: false, error: 'That’s an old DE1 app .tcl profile. Use the JSON version instead (Visualizer’s “Download profile JSON”, or the DE1 app’s profiles_v2 folder).' };
    }
    return { ok: false, error: 'That isn’t a profile file. Pick a .json profile.' };
  }
  let data: unknown;
  try { data = JSON.parse(t); } catch { return { ok: false, error: 'That file isn’t valid JSON.' }; }
  let list: unknown[] = Array.isArray(data) ? data : [data];
  // Decaid's export wraps each profile in a record: { id, profile, ... }
  list = list.map((x) => (x && typeof x === 'object' && 'profile' in x && typeof (x as { profile: unknown }).profile === 'object' ? (x as { profile: unknown }).profile : x));
  const first = list[0];
  if (!first || typeof first !== 'object') return { ok: false, error: 'No profile found in that file.' };
  const p = { ...(first as Record<string, unknown>) };
  const steps = Array.isArray(p.steps) ? p.steps.map(cleanStep) : [];
  if (!steps.length || steps.some((s) => s === null)) return { ok: false, error: 'No steps found in that profile, so it can’t be opened.' };
  for (const k of ['target_volume', 'target_weight', 'target_volume_count_start', 'tank_temperature']) {
    if (k in p) { const n = num(p[k]); p[k] = n ?? 0; }
  }
  const profile: Profile = {
    ...p,
    version: '2',
    title: typeof p.title === 'string' && p.title.trim() ? p.title.trim() : 'Imported profile',
    author: typeof p.author === 'string' ? p.author : '',
    notes: typeof p.notes === 'string' ? p.notes : '',
    steps: steps as ProfileStep[],
    target_volume_count_start: (p.target_volume_count_start as number | undefined) ?? 0,
    tank_temperature: (p.tank_temperature as number | undefined) ?? 0,
  };
  return { ok: true, profile, others: list.length - 1 };
}
