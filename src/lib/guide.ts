// "Guide me": a step-by-step routine for one profile + one coffee, from
// weighing beans to rinsing the group. Pure parts live here; the wizard is
// features/guide/Guide.svelte.

import type { BeanBatch, ProfileRecord } from '../api/types';
import { resolveDialIn, type DialIn, type DialInSource } from './dialIn';

export const GUIDE_KEY = 'guide';

/** Stored in the KV store. A coffee (bean), not a bag, so it survives finishing bags. */
export interface GuideSetup {
  profileRoot: string;
  beanId: string;
}

export function parseGuideSetup(raw: unknown): GuideSetup | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return typeof r.profileRoot === 'string' && typeof r.beanId === 'string' && r.profileRoot && r.beanId
    ? { profileRoot: r.profileRoot, beanId: r.beanId }
    : null;
}

/** The bag to use: the newest open bag of the coffee. */
export function pickBag(beanId: string, batches: readonly BeanBatch[]): BeanBatch | null {
  return batches
    .filter((b) => b.beanId === beanId && !b.archived)
    .sort((a, b) => (b.roastDate ?? b.createdAt).localeCompare(a.roastDate ?? a.createdAt))[0] ?? null;
}

export interface BrewPlan {
  dose: number;
  /** Target yield in g, or null when stop-at-weight is off. */
  yield: number | null;
  /** As you'd read it on the grinder, or null if nothing's been dialled in yet. */
  grind: string | null;
  tempOffset: number;
  source: DialInSource;
  dialIn: DialIn;
}

/** The numbers for this bag + profile, by the same rules as the brew panel. */
export function planBrew(record: ProfileRecord, profileRoot: string, batch: BeanBatch | null, batches: readonly BeanBatch[], fallbackDose = 18): BrewPlan {
  const resolved = batch ? resolveDialIn(batch, profileRoot, batches) : { dialIn: {}, source: 'profile-default' as const };
  const d = resolved.dialIn;
  const dose = d.dose ?? fallbackDose;
  const yieldG = d.yield ?? (record.profile.target_weight || null);
  const grind = d.grind !== undefined && d.grind.trim() !== '' ? d.grind.trim() : null;
  return {
    dose,
    yield: yieldG,
    grind,
    tempOffset: d.tempOffset ?? 0,
    source: resolved.source,
    dialIn: { grind: grind ?? undefined, dose, yield: yieldG ?? undefined, tempOffset: d.tempOffset ?? 0 },
  };
}

/** How close a dose has to be to count as right. */
export const DOSE_TOLERANCE_G = 0.1;

export type WeighState = 'empty' | 'under' | 'ok' | 'over';

/**
 * Where the weighed beans are against the target. Rounded to the scale's
 * 0.1 g so "17.95" doesn't flicker between under and ok.
 */
export function weighState(weight: number | null | undefined, target: number, tolerance = DOSE_TOLERANCE_G): { state: WeighState; delta: number } {
  if (weight == null || !Number.isFinite(weight) || weight < 0.3) return { state: 'empty', delta: target };
  const w = Math.round(weight * 10) / 10;
  const delta = Math.round((target - w) * 10) / 10;
  if (Math.abs(delta) <= tolerance + 1e-9) return { state: 'ok', delta };
  return { state: delta > 0 ? 'under' : 'over', delta };
}

export type GuideStepId =
  | 'weigh' | 'spray' | 'dial' | 'grind' | 'funnel' | 'tamp' | 'paper' | 'start' | 'knock' | 'rinse' | 'done';

export const GUIDE_STEPS: readonly GuideStepId[] = ['weigh', 'spray', 'dial', 'grind', 'funnel', 'tamp', 'paper', 'start', 'knock', 'rinse', 'done'];

/** Short labels for the progress rail. */
export const STEP_LABELS: Record<GuideStepId, string> = {
  weigh: 'Weigh', spray: 'Spray', dial: 'Grinder', grind: 'Grind', funnel: 'Funnel', tamp: 'Tamp',
  paper: 'Paper', start: 'Pull', knock: 'Knock', rinse: 'Rinse', done: 'Enjoy',
};

/** Steps before the shot can be stepped through freely; after it, the order follows the machine. */
export function canGoBack(step: GuideStepId): boolean {
  const i = GUIDE_STEPS.indexOf(step);
  return i > 0 && i <= GUIDE_STEPS.indexOf('start');
}

/** Rinse progresses on the machine's own state: started flushing, then back out of it. */
export function rinseProgress(seenFlush: boolean, state: string | undefined): 'waiting' | 'rinsing' | 'finished' {
  if (state === 'flush') return 'rinsing';
  return seenFlush ? 'finished' : 'waiting';
}

/**
 * Weighing beans against the dose outside the guide (the brew panel), from
 * whatever is on the scale. null when the reading doesn't look like a dose
 * being weighed: nothing on it, or something much heavier, like a cup, so
 * it never says "take out 180 g".
 */
export function doseCheck(weight: number | null | undefined, dose: number | null | undefined): { state: Exclude<WeighState, 'empty'>; delta: number } | null {
  if (!dose || dose <= 0 || weight == null || !Number.isFinite(weight) || weight > dose * 1.5) return null;
  const r = weighState(weight, dose);
  return r.state === 'empty' ? null : { state: r.state, delta: r.delta };
}
