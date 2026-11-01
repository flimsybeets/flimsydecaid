// Tiny graphs for the profile tiles on Home: either the profile's planned
// pressure/flow targets (like the editor's chart) or its last real shot.
// Everything is drawn in a fixed 100 × 40 box, values 0–12 on the y axis
// (bar or ml/s), so the tile just scales the SVG.
import type { ProfileStep } from '../api/types';
import { profileCurve } from './profileEdit';
import type { ShotSample } from './shot';

export type TilePreview = 'none' | 'plan' | 'shot';
export const W = 100;
export const H = 40;
const MAX = 12;

const x = (t: number, tMax: number) => (tMax > 0 ? (t / tMax) * W : 0);
const y = (v: number) => H - (Math.min(MAX, Math.max(0, v)) / MAX) * H;
const pt = (t: number, v: number, tMax: number) => `${x(t, tMax).toFixed(1)},${y(v).toFixed(1)}`;

export interface MiniLines { pressure: string; flow: string; weight?: string }

/** Planned targets, one path per pump; the line breaks where control switches. */
export function planLines(steps: readonly ProfileStep[]): MiniLines {
  const { segments, total } = profileCurve(steps);
  const tMax = Math.max(1, total);
  const path = (pump: 'pressure' | 'flow') => {
    let d = '';
    let joined = false;
    for (const s of segments) {
      if (s.pump !== pump) { joined = false; continue; }
      d += `${joined ? 'L' : 'M'}${pt(s.t0, s.from, tMax)}L${pt(s.t1, s.to, tMax)}`;
      joined = true;
    }
    return d;
  };
  return { pressure: path('pressure'), flow: path('flow') };
}

/** A real shot, thinned to at most `points` per line. Weight is scaled to fit the box. */
export function shotLines(samples: readonly ShotSample[], points = 60): MiniLines {
  if (!samples.length) return { pressure: '', flow: '' };
  const tMax = Math.max(1, samples.at(-1)!.t);
  const step = Math.max(1, Math.ceil(samples.length / points));
  const thin = samples.filter((_, i) => i % step === 0 || i === samples.length - 1);
  const wMax = Math.max(1, ...samples.map((s) => s.weight ?? 0));
  const path = (pick: (s: ShotSample) => number | undefined) => {
    let d = '';
    let pen = false;
    for (const s of thin) {
      const v = pick(s);
      if (v === undefined || !Number.isFinite(v)) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${pt(s.t, v, tMax)}`;
      pen = true;
    }
    return d;
  };
  return {
    pressure: path((s) => s.pressure),
    flow: path((s) => s.flow),
    weight: path((s) => (s.weight === undefined ? undefined : (s.weight / wMax) * MAX)),
  };
}

export function parseTilePreview(raw: unknown): TilePreview {
  return raw === 'none' || raw === 'plan' || raw === 'shot' ? raw : 'shot';
}
