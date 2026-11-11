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
  const last = s.shots === 1 ? 'Your last shot' : `Your last ${s.shots} shots`;
  if (off < 0.2) return `${last} landed right on target.`;
  return `${last} landed ${off.toFixed(1)} g ${s.averageOff > 0 ? 'heavy' : 'light'}${s.shots === 1 ? '' : ' on average'}.`;
}

// ---- by flow -----------------------------------------------------------------
// Decaid assumes the drip is flow × lookAhead, but part of it doesn't depend on
// the flow (what's left in the basket, the scale catching up). Across all shots
// the drip fits  drip ≈ fixed + perFlow × flow,  so the look-ahead that suits a
// shot stopping at flow f is  fixed / f + perFlow. Decaid reads its look-ahead
// once when the shot starts, so the skin uses the flow a profile usually stops at.

export interface FlowModel {
  /** Grams that drip in whatever the flow. */
  fixed: number;
  /** Seconds of flow that drip in on top. */
  perFlow: number;
  shots: number;
}

export const MIN_MODEL_READS = 5;
/** The flows at the stop must spread at least this much (g/s) to tell the two parts apart. */
export const MIN_FLOW_SPREAD = 0.6;

const median = (xs: number[]) => {
  const v = [...xs].sort((a, b) => a - b);
  const m = v.length / 2;
  return v.length % 2 ? v[Math.floor(m)]! : (v[m - 1]! + v[m]!) / 2;
};

/** Theil–Sen line through (flow, drip): the median of pairwise slopes, so an odd shot can't drag it. */
export function flowModel(reads: readonly StopRead[]): FlowModel | null {
  if (reads.length < MIN_MODEL_READS) return null;
  const flows = reads.map((r) => r.flow);
  if (Math.max(...flows) - Math.min(...flows) < MIN_FLOW_SPREAD) return null;
  const slopes: number[] = [];
  for (let i = 0; i < reads.length; i++)
    for (let j = i + 1; j < reads.length; j++) {
      const df = reads[j]!.flow - reads[i]!.flow;
      if (Math.abs(df) >= 0.2) slopes.push((reads[j]!.drip - reads[i]!.drip) / df);
    }
  if (slopes.length === 0) return null;
  const perFlow = Math.max(0, median(slopes));
  const fixed = Math.max(0, median(reads.map((r) => r.drip - perFlow * r.flow)));
  return { fixed: Math.round(fixed * 100) / 100, perFlow: Math.round(perFlow * 100) / 100, shots: reads.length };
}

/** The look-ahead the model gives for a shot stopping at this flow. */
export const lookAheadAt = (m: FlowModel, flow: number) => clampLookAhead(m.fixed / Math.max(0.5, flow) + m.perFlow);

/** The flow a set of shots usually stopped at. */
export const typicalFlow = (reads: readonly StopRead[]) => median(reads.map((r) => r.flow));

/** Plain words for the model. */
export function modelText(m: FlowModel): string {
  return `From ${m.shots} shots: about ${m.fixed.toFixed(1)} g still drips in, plus ${m.perFlow.toFixed(1)} s of the flow.`;
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
  const next: TuneDoc = { ...doc, profiles: { ...doc.profiles, [root]: { ...prev, reads: addRead(prev.reads, read) } } };
  // A new shot can move the flow model, so every profile is re-tuned, not just this one.
  return doc.auto ? withAuto(next, true) : next;
}

export const allReads = (doc: TuneDoc) => Object.values(doc.profiles).flatMap((t) => t.reads);

/**
 * Best look-ahead for one profile: from the flow model (all shots) at the flow
 * this profile usually stops at, else the median of its own shots (3 or more).
 */
export function suggestFor(doc: TuneDoc, root: string): Suggestion | null {
  const reads = doc.profiles[root]?.reads ?? [];
  const m = flowModel(allReads(doc));
  if (m && reads.length > 0) {
    const averageOff = Math.round((reads.reduce((a, r) => a + (r.landed - r.target), 0) / reads.length) * 10) / 10;
    return { lookAhead: lookAheadAt(m, typicalFlow(reads)), averageOff, shots: reads.length };
  }
  return suggestLookAhead(reads);
}

/** With the flow model, the default for profiles with no shots yet: the model at the usual flow of all shots. */
export function suggestBase(doc: TuneDoc): number | null {
  const all = allReads(doc);
  const m = flowModel(all);
  return m ? lookAheadAt(m, typicalFlow(all)) : null;
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
    const s = suggestFor(doc, root);
    profiles[root] = s ? { ...t, lookAhead: s.lookAhead } : t;
  }
  const out: TuneDoc = { ...doc, auto, profiles };
  const base = suggestBase(doc);
  if (base !== null) out.base = base;
  return out;
}

/** The look-ahead Decaid should use for this profile, or null to leave Decaid's as it is. */
export function lookAheadFor(doc: TuneDoc, root: string): number | null {
  return doc.profiles[root]?.lookAhead ?? doc.base ?? null;
}
