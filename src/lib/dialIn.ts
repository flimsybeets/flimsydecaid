import type { BeanBatch } from '../api/types';
import { STORE_NS } from '../api/gateway';

/**
 * What you dialled in for one bag with one profile.
 * Stored on the bag: BeanBatch.extras.flimsydecaid.dialIn[profileRootId].
 * Decaid has no official field for this; extras is its sanctioned custom-data slot.
 */
export interface DialIn {
  grind?: string;
  dose?: number;
  yield?: number;
  /** °C added to every step of the profile. */
  tempOffset?: number;
  updatedAt?: string;
}

export type DialInSource = 'this-bag' | 'previous-bag' | 'profile-default';

export interface ResolvedDialIn {
  dialIn: DialIn;
  source: DialInSource;
  /** The bag the values came from, when source is previous-bag. */
  fromBatchId?: string;
}

interface OurExtras { dialIn?: Record<string, DialIn> }

function ours(batch: BeanBatch): OurExtras {
  const raw = batch.extras?.[STORE_NS];
  return raw && typeof raw === 'object' ? (raw as OurExtras) : {};
}

export function readDialIn(batch: BeanBatch, profileRoot: string): DialIn | undefined {
  return ours(batch).dialIn?.[profileRoot];
}

/**
 * Lookup order:
 *   1. this bag + this profile
 *   2. the most recent other bag of the same bean + this profile
 *   3. the profile's own defaults (empty dial-in)
 */
export function resolveDialIn(
  batch: BeanBatch,
  profileRoot: string,
  allBatches: readonly BeanBatch[],
): ResolvedDialIn {
  const own = readDialIn(batch, profileRoot);
  if (own) return { dialIn: own, source: 'this-bag' };

  const siblings = allBatches
    .filter((b) => b.beanId === batch.beanId && b.id !== batch.id)
    .map((b) => ({ b, d: readDialIn(b, profileRoot) }))
    .filter((x): x is { b: BeanBatch; d: DialIn } => !!x.d)
    .sort((x, y) => bagOrder(y.b, y.d).localeCompare(bagOrder(x.b, x.d)));

  const best = siblings[0];
  if (best) return { dialIn: best.d, source: 'previous-bag', fromBatchId: best.b.id };
  return { dialIn: {}, source: 'profile-default' };
}

function bagOrder(b: BeanBatch, d: DialIn): string {
  return d.updatedAt ?? b.roastDate ?? b.createdAt;
}

/** The extras object to PUT back onto the bag, preserving everyone else's keys. */
export function withDialIn(batch: BeanBatch, profileRoot: string, dialIn: DialIn): Record<string, unknown> {
  const extras = { ...(batch.extras ?? {}) };
  const mine = ours(batch);
  extras[STORE_NS] = {
    ...mine,
    dialIn: { ...(mine.dialIn ?? {}), [profileRoot]: { ...dialIn, updatedAt: new Date().toISOString() } },
  };
  return extras;
}
