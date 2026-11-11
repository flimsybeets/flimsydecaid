// Stop-at-weight look-ahead, tuned from real shots.
//
// Decaid stops a shot when  weight + weightFlow × lookAhead ≥ target
// (shot_sequencer.dart), so lookAhead is the seconds of flow still to land
// after the stop. Each shot that stopped at weight tells us what that really
// was: the drip after the stop divided by the flow at the moment it stopped.
// The suggestion is the median over recent shots, so one odd shot can't swing it.

import type { ShotMeasurement } from '../api/types';

export interface StopRead {
  id: string;
  /** Final weight in the cup. */
  landed: number;
  target: number;
  /** Grams that landed after the stop. */
  drip: number;
  /** Weight flow (g/s) when the shot stopped. */
  flow: number;
}

const POURING = new Set(['preinfusion', 'pouring']);
export const KEEP_READS = 8;
export const MIN_READS = 3;

/** What one stored shot says about the look-ahead, or null if it can't say (not stopped at weight, no scale, barely flowing). */
export function stopRead(shot: {
  id: string;
  stopReason?: string | null;
  workflow?: { context?: { targetYield?: number | null } | null } | null;
  measurements?: readonly ShotMeasurement[] | null;
}): StopRead | null {
  if (shot.stopReason !== 'targetWeight') return null;
  const target = shot.workflow?.context?.targetYield ?? 0;
  const ms = shot.measurements ?? [];
  if (!(target > 0) || ms.length < 3) return null;
  let stopAt = -1;
  for (let i = 0; i < ms.length; i++) if (POURING.has(ms[i]!.machine?.state?.substate ?? '')) stopAt = i;
  if (stopAt < 1) return null;
  // Weight and flow at the stop: the last pouring frame with a scale reading.
  let w: number | undefined, f: number | undefined;
  for (let i = stopAt; i >= 0 && w === undefined; i--) {
    const s = ms[i]!.scale;
    if (s && Number.isFinite(s.weight)) { w = s.weight; f = s.weightFlow; }
  }
  let landed: number | undefined;
  for (let i = ms.length - 1; i > stopAt && landed === undefined; i--) {
    const s = ms[i]!.scale;
    if (s && Number.isFinite(s.weight)) landed = s.weight;
  }
  if (w === undefined || landed === undefined || f === undefined || !(f >= 0.3)) return null;
  return { id: shot.id, landed, target, drip: Math.max(0, landed - w), flow: f };
}

/** Newest first, no repeats, at most KEEP_READS. */
export function addRead(reads: readonly StopRead[], read: StopRead): StopRead[] {
  return [read, ...reads.filter((r) => r.id !== read.id)].slice(0, KEEP_READS);
}

export function parseReads(raw: unknown): StopRead[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is StopRead =>
    !!r && typeof r === 'object' && typeof r.id === 'string' &&
    ['landed', 'target', 'drip', 'flow'].every((k) => typeof (r as Record<string, unknown>)[k] === 'number')).slice(0, KEEP_READS);
}

export interface Suggestion {
  /** Look-ahead to use (seconds of flow), 0–5 in 0.1 steps. */
  lookAhead: number;
  /** Average grams over (+) or under (−) the target. */
  averageOff: number;
  shots: number;
}

export function suggestLookAhead(reads: readonly StopRead[]): Suggestion | null {
  if (reads.length < MIN_READS) return null;
  const seconds = reads.map((r) => r.drip / r.flow).sort((a, b) => a - b);
  const mid = seconds.length / 2;
  const median = seconds.length % 2 ? seconds[Math.floor(mid)]! : (seconds[mid - 1]! + seconds[mid]!) / 2;
  const lookAhead = Math.round(Math.min(5, Math.max(0, median)) * 10) / 10;
  const averageOff = Math.round((reads.reduce((a, r) => a + (r.landed - r.target), 0) / reads.length) * 10) / 10;
  return { lookAhead, averageOff, shots: reads.length };
}

/** Plain words for how shots have been landing. */
export function landingText(s: Suggestion): string {
  const off = Math.abs(s.averageOff);
  if (off < 0.2) return `Your last ${s.shots} shots landed right on target.`;
  return `Your last ${s.shots} shots landed ${off.toFixed(1)} g ${s.averageOff > 0 ? 'heavy' : 'light'} on average.`;
}
