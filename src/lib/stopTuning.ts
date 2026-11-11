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

// ---- per profile -------------------------------------------------------------
// Decaid has one look-ahead for every shot, so the skin keeps one per profile
// (by lineage root) and sets Decaid's whenever a profile goes on the machine.
// `base` is the look-ahead for profiles without their own (the Settings stepper).

export interface ProfileTune {
  /** Newest first, at most KEEP_READS. */
  reads: StopRead[];
  /** This profile's own look-ahead (tuned or chosen); missing = use base. */
  lookAhead?: number;
}

export interface TuneDoc {
  auto: boolean;
  base?: number;
  profiles: Record<string, ProfileTune>;
}

export function parseTune(raw: unknown): TuneDoc {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const profiles: Record<string, ProfileTune> = {};
  const p = r.profiles && typeof r.profiles === 'object' ? (r.profiles as Record<string, unknown>) : {};
  for (const [root, v] of Object.entries(p)) {
    const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
    const t: ProfileTune = { reads: parseReads(o.reads) };
    if (typeof o.lookAhead === 'number' && Number.isFinite(o.lookAhead)) t.lookAhead = clampLookAhead(o.lookAhead);
    profiles[root] = t;
  }
  const doc: TuneDoc = { auto: r.auto === true, profiles };
  if (typeof r.base === 'number' && Number.isFinite(r.base)) doc.base = clampLookAhead(r.base);
  return doc;
}

export const clampLookAhead = (v: number) => Math.round(Math.min(5, Math.max(0, v)) * 10) / 10;

/** Records a shot under its profile; with auto on, the profile's look-ahead follows its suggestion. */
export function withRead(doc: TuneDoc, root: string, read: StopRead): TuneDoc {
  const prev = doc.profiles[root] ?? { reads: [] };
  const reads = addRead(prev.reads, read);
  const next: ProfileTune = { ...prev, reads };
  if (doc.auto) {
    const s = suggestLookAhead(reads);
    if (s) next.lookAhead = s.lookAhead;
  }
  return { ...doc, profiles: { ...doc.profiles, [root]: next } };
}

/** Sets (or with null clears) one profile's own look-ahead. */
export function withLookAhead(doc: TuneDoc, root: string, value: number | null): TuneDoc {
  const prev = doc.profiles[root] ?? { reads: [] };
  const next: ProfileTune = { reads: prev.reads };
  if (value !== null) next.lookAhead = clampLookAhead(value);
  return { ...doc, profiles: { ...doc.profiles, [root]: next } };
}

/** Turning auto on puts every profile with enough shots on its suggestion. */
export function withAuto(doc: TuneDoc, auto: boolean): TuneDoc {
  if (!auto) return { ...doc, auto };
  const profiles: Record<string, ProfileTune> = {};
  for (const [root, t] of Object.entries(doc.profiles)) {
    const s = suggestLookAhead(t.reads);
    profiles[root] = s ? { ...t, lookAhead: s.lookAhead } : t;
  }
  return { ...doc, auto, profiles };
}

/** The look-ahead Decaid should use for this profile, or null to leave Decaid's as it is. */
export function lookAheadFor(doc: TuneDoc, root: string): number | null {
  return doc.profiles[root]?.lookAhead ?? doc.base ?? null;
}
