import type { ShotSummary } from '../api/types';
import type { ShotSample } from './shot';

/** "1:2.0", or null when either side is missing. */
export function ratioText(dose: number | null | undefined, out: number | null | undefined): string | null {
  if (!dose || !out || dose <= 0 || out <= 0) return null;
  return `1:${(out / dose).toFixed(1)}`;
}

const DAY_MS = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today", "Yesterday", a weekday for the last week, otherwise a date. Local time. */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/** Consecutive shots grouped under their day label. Expects newest first. */
export function groupByDay<T extends Pick<ShotSummary, 'timestamp'>>(shots: readonly T[], now = new Date()): { label: string; shots: T[] }[] {
  const groups: { label: string; shots: T[] }[] = [];
  for (const shot of shots) {
    const label = dayLabel(shot.timestamp, now);
    const last = groups.at(-1);
    if (last?.label === label) last.shots.push(shot);
    else groups.push({ label, shots: [shot] });
  }
  return groups;
}

const STOP_REASONS: Record<string, string> = {
  targetWeight: 'Stopped at weight',
  targetVolume: 'Stopped at volume',
  apiStop: 'Stopped by hand',
  appStop: 'Stopped by hand',
  machineEnded: 'Profile finished',
  error: 'Stopped by an error',
};

/** Plain words for Decaid's stopReason. Unknown reasons (it's an open set) give null. */
export function stopReasonText(reason: string | null | undefined): string | null {
  return reason ? STOP_REASONS[reason] ?? null : null;
}

export interface ShotStats {
  seconds: number;
  /** Final cup weight, or null without a scale. */
  weight: number | null;
  peakPressure: number | null;
}

export function shotStats(samples: readonly ShotSample[]): ShotStats {
  let weight: number | null = null;
  let peakPressure: number | null = null;
  for (const s of samples) {
    if (s.weight !== undefined) weight = s.weight;
    if (s.pressure !== undefined) peakPressure = Math.max(peakPressure ?? 0, s.pressure);
  }
  return { seconds: samples.at(-1)?.t ?? 0, weight, peakPressure };
}
