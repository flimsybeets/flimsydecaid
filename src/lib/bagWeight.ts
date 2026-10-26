import type { BeanBatch, ShotSummary } from '../api/types';
import { STORE_NS } from '../api/gateway';

/**
 * Keeping a bag's weightRemaining honest. Decaid never subtracts the dose
 * after a shot, so the skin does.
 *
 * The ledger lives on the bag itself, in BeanBatch.extras.flimsydecaid.used:
 * the last few shots already taken off this bag, each with the grams taken.
 * Weight and ledger go out in the same PUT, so they can't disagree. Two
 * tablets (or a reload) that both see the same shot find its id in the ledger
 * and skip it. Newest first, capped, so extras stays small.
 */

export interface UsedShot { id: string; g: number }

export const LEDGER_SIZE = 20;
/** A shot counts when it poured this long, or put this much into the cup. */
export const MIN_POUR_SECONDS = 5;
export const MIN_YIELD_G = 5;

interface OurExtras { used?: UsedShot[] }

function ours(batch: BeanBatch): OurExtras {
  const raw = batch.extras?.[STORE_NS];
  return raw && typeof raw === 'object' ? (raw as OurExtras) : {};
}

export function ledgerOf(batch: BeanBatch): UsedShot[] {
  const used = ours(batch).used;
  if (!Array.isArray(used)) return [];
  return used.filter((u): u is UsedShot => !!u && typeof u.id === 'string' && Number.isFinite(u.g));
}

/** The dose a shot used: what was weighed if recorded, else the workflow's target. */
export function doseOf(shot: Pick<ShotSummary, 'workflow' | 'annotations'>): number | null {
  const d = shot.annotations?.actualDoseWeight ?? shot.workflow?.context?.targetDoseWeight;
  return typeof d === 'number' && Number.isFinite(d) && d > 0 ? d : null;
}

export interface PourStats { seconds: number; weight: number | null }

/** Did this shot really pour? Stopped during preheat, or a few grams, doesn't count. */
export function pouredEnough(stats: PourStats): boolean {
  return stats.seconds >= MIN_POUR_SECONDS || (stats.weight ?? 0) >= MIN_YIELD_G;
}

/** Should this finished shot come off its bag? Needs an id, a bag, a dose, a real pour, and not be in the ledger already. */
export function shouldDecrement(shot: Pick<ShotSummary, 'id' | 'workflow' | 'annotations'>, stats: PourStats, batch: BeanBatch | undefined): boolean {
  if (!shot.id || !batch || !shot.workflow?.context?.beanBatchId) return false;
  if (batch.id !== shot.workflow.context.beanBatchId) return false;
  if (batch.weightRemaining == null) return false; // nothing to count down from
  if (doseOf(shot) === null) return false;
  if (!pouredEnough(stats)) return false;
  return !ledgerOf(batch).some((u) => u.id === shot.id);
}

export interface BagUpdate { weightRemaining: number; extras: Record<string, unknown> }

function withUsed(batch: BeanBatch, used: UsedShot[], weightRemaining: number): BagUpdate {
  const extras = { ...(batch.extras ?? {}) };
  extras[STORE_NS] = { ...ours(batch), used: used.slice(0, LEDGER_SIZE) };
  return { weightRemaining, extras };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Take a shot's dose off the bag (never below 0) and note it in the ledger. The ledger records what was really taken. */
export function applyDecrement(batch: BeanBatch, shotId: string, dose: number): BagUpdate {
  const before = batch.weightRemaining ?? 0;
  const after = Math.max(0, round1(before - dose));
  const taken = round1(before - after);
  return withUsed(batch, [{ id: shotId, g: taken }, ...ledgerOf(batch).filter((u) => u.id !== shotId)], after);
}

/** What deleting this shot can give back to the bag, or null when it was never taken off (or has aged out of the ledger). */
export function givebackFor(batch: BeanBatch | undefined, shotId: string): number | null {
  const entry = batch ? ledgerOf(batch).find((u) => u.id === shotId) : undefined;
  return entry && entry.g > 0 ? entry.g : null;
}

/** Put the grams back (up to the bag's size) and drop the shot from the ledger. Null when there's nothing to give back. */
export function applyGiveback(batch: BeanBatch, shotId: string): BagUpdate | null {
  const g = givebackFor(batch, shotId);
  if (g === null) return null;
  const cap = batch.weight ?? Infinity;
  const after = Math.min(cap, round1((batch.weightRemaining ?? 0) + g));
  return withUsed(batch, ledgerOf(batch).filter((u) => u.id !== shotId), after);
}
