import type { ShotSample } from './shot';

type NumKey = Exclude<keyof ShotSample, 't' | 'frame'>;
const KEYS: NumKey[] = [
  'pressure', 'flow', 'weight', 'waterTemp', 'puckTemp',
  'targetPressure', 'targetFlow', 'targetWaterTemp', 'targetPuckTemp',
];

/** Index of the last sample with t <= time (binary search); -1 if none. */
function floorIndex(samples: ShotSample[], time: number): number {
  let lo = 0, hi = samples.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid]!.t <= time) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

/** Index of the sample nearest in time to `time`; -1 for an empty list. */
export function nearestIndex(samples: ShotSample[], time: number): number {
  if (samples.length === 0) return -1;
  const i = floorIndex(samples, time);
  if (i < 0) return 0;
  if (i === samples.length - 1) return i;
  return time - samples[i]!.t <= samples[i + 1]!.t - time ? i : i + 1;
}

export interface ScrubValues extends Partial<Record<NumKey, number>> {
  /** The requested time, clamped to the shot. */
  t: number;
}

/**
 * Every series at `time`, linearly interpolated between the two samples
 * around it. If either neighbour lacks a value (e.g. a target the machine
 * zeroed) the nearest sample's value is used when it has one, else the
 * series is left out.
 */
export function valuesAt(samples: ShotSample[], time: number): ScrubValues | null {
  if (samples.length === 0) return null;
  const first = samples[0]!.t, lastT = samples[samples.length - 1]!.t;
  const t = Math.min(lastT, Math.max(first, time));
  const i = floorIndex(samples, t);
  const a = samples[Math.max(0, i)]!;
  const b = samples[Math.min(samples.length - 1, i + 1)]!;
  const near = samples[nearestIndex(samples, t)]!;
  const out: ScrubValues = { t };
  const span = b.t - a.t;
  const f = span > 0 ? (t - a.t) / span : 0;
  for (const k of KEYS) {
    const va = a[k], vb = b[k];
    if (va !== undefined && vb !== undefined) out[k] = va + (vb - va) * f;
    else if (near[k] !== undefined) out[k] = near[k];
  }
  return out;
}
