import type { Bean, BeanBatch, Profile, ProfileRecord, ShotSummary } from '../api/types';
import type { DialIn } from './dialIn';
import { baseTemperature } from './profiles';

/** What BrewPanel opens with when started from a past shot: its bag and numbers go in instead of what the bag remembers. */
export interface BrewStart { batchId: string | null; dialIn: DialIn; note: string | null }

/**
 * "Brew this again" on a History shot: which profile, which bag and which
 * dial-in to open the brew panel with.
 *
 * A shot stores the profile inline (no id), so it is matched to a profile
 * lineage by title and by shape (the steps without their temperatures, since
 * the bag's temperature offset was applied to them). The newest version of
 * that lineage is used, so an edited profile still resolves.
 */
export interface BrewAgainPlan {
  /** Lineage root of the profile to brew, or null when it no longer exists. */
  profileRoot: string | null;
  /** The bag to preselect: the shot's own if still open, else the coffee's newest open bag. */
  batchId: string | null;
  /** What the shot used, as far as it is known. Temperature is an offset from the profile's current first-step temperature. */
  dialIn: DialIn;
  /** Said under the brew panel when the bag isn't the one from the shot. */
  note: string | null;
}

const shape = (p: Profile) => JSON.stringify(p.steps.map(({ temperature: _t, ...rest }) => rest));

export function findProfileRoot(shotProfile: Profile | undefined, lineages: ReadonlyMap<string, ProfileRecord>): string | null {
  if (!shotProfile) return null;
  const sameTitle = [...lineages.entries()].filter(([, r]) => r.profile.title === shotProfile.title);
  if (sameTitle.length === 0) return null;
  const want = shape(shotProfile);
  const exact = sameTitle.find(([, r]) => shape(r.profile) === want);
  return (exact ?? sameTitle.sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))[0]!)[0];
}

const roastOrder = (b: BeanBatch) => b.roastDate ?? b.createdAt;

export function planBrewAgain(
  shot: Pick<ShotSummary, 'workflow' | 'annotations'>,
  lineages: ReadonlyMap<string, ProfileRecord>,
  batches: readonly BeanBatch[],
  beans: readonly Bean[],
): BrewAgainPlan {
  const ctx = shot.workflow?.context;
  const profileRoot = findProfileRoot(shot.workflow?.profile, lineages);

  // Bag: the shot's own if it's still open, else the newest open bag of the same coffee.
  const own = ctx?.beanBatchId ? batches.find((b) => b.id === ctx.beanBatchId) : undefined;
  let batchId: string | null = null;
  let note: string | null = null;
  if (own && !own.archived) {
    batchId = own.id;
  } else {
    const bean = own
      ? beans.find((b) => b.id === own.beanId)
      : beans.find((b) => b.name === ctx?.coffeeName && (!ctx?.coffeeRoaster || b.roaster === ctx.coffeeRoaster));
    const name = bean?.name ?? ctx?.coffeeName ?? 'this coffee';
    const newest = bean
      ? batches.filter((b) => b.beanId === bean.id && !b.archived).sort((a, b) => roastOrder(b).localeCompare(roastOrder(a)))[0]
      : undefined;
    if (newest) {
      batchId = newest.id;
      note = `The bag from this shot is finished, so this is your newest bag of ${name}.`;
    } else if (ctx?.beanBatchId || ctx?.coffeeName) {
      note = `There's no open bag of ${name}. Pick a bag.`;
    }
  }

  const dialIn: DialIn = {};
  if (ctx?.grinderSetting) dialIn.grind = ctx.grinderSetting;
  const dose = ctx?.targetDoseWeight ?? shot.annotations?.actualDoseWeight;
  if (typeof dose === 'number' && dose > 0) dialIn.dose = dose;
  if (typeof ctx?.targetYield === 'number' && ctx.targetYield > 0) dialIn.yield = ctx.targetYield;
  const record = profileRoot ? lineages.get(profileRoot) : undefined;
  const shotTemp = shot.workflow?.profile ? baseTemperature(shot.workflow.profile) : null;
  const baseTemp = record ? baseTemperature(record.profile) : null;
  if (shotTemp !== null && baseTemp !== null) dialIn.tempOffset = Math.round((shotTemp - baseTemp) * 10) / 10;

  return { profileRoot, batchId, dialIn, note };
}
