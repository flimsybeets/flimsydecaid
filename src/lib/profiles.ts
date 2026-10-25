import type { Profile, ProfileRecord } from '../api/types';

/**
 * Stable identity for a profile across edits.
 *
 * Decaid profile ids are content hashes, so editing a profile produces a new
 * record whose parentId points at the old one. Categories and dial-ins are
 * keyed by the oldest ancestor we can see, so tweaking a profile doesn't
 * orphan them. Ancestors missing from `records` end the walk.
 */
export function lineageRoot(id: string, byId: ReadonlyMap<string, ProfileRecord>): string {
  let current = id;
  const seen = new Set<string>();
  for (;;) {
    seen.add(current);
    const parent = byId.get(current)?.parentId;
    if (!parent || seen.has(parent) || !byId.has(parent)) return current;
    current = parent;
  }
}

export function indexProfiles(records: readonly ProfileRecord[]): Map<string, ProfileRecord> {
  return new Map(records.map((r) => [r.id, r]));
}

/**
 * When several visible profiles share a lineage root, show only the newest.
 * Returns root id → the record to use.
 */
export function latestPerLineage(records: readonly ProfileRecord[]): Map<string, ProfileRecord> {
  const byId = indexProfiles(records);
  const out = new Map<string, ProfileRecord>();
  for (const r of records) {
    const root = lineageRoot(r.id, byId);
    const prev = out.get(root);
    if (!prev || r.updatedAt > prev.updatedAt) out.set(root, r);
  }
  return out;
}

/**
 * A copy of the profile with every step's temperature shifted by `delta` °C.
 * Brew temperature lives in the profile steps, not the workflow. The shifted
 * copy is sent inline with PUT /workflow and never saved as a new profile.
 * tank_temperature (water tank preheat) is left alone.
 */
export function shiftTemperature(profile: Profile, delta: number): Profile {
  if (!delta) return profile;
  return {
    ...profile,
    steps: profile.steps.map((s) => ({ ...s, temperature: round1(s.temperature + delta) })),
  };
}

/** The temperature a profile starts at, for display. */
export function baseTemperature(profile: Profile): number | null {
  return profile.steps[0]?.temperature ?? null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * The order to hide a lineage's versions in: newest edits first, the root
 * last. Lineage roots are found by walking visible parents, so if hiding
 * stops partway, what's still visible is an unbroken chain from the root
 * and keeps the same root id (categories and dial-ins stay attached).
 */
export function hideOrder(versions: readonly ProfileRecord[], byId: ReadonlyMap<string, ProfileRecord>): ProfileRecord[] {
  const depth = (r: ProfileRecord) => {
    let d = 0;
    let cur: ProfileRecord | undefined = r;
    const seen = new Set<string>();
    while (cur?.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.parentId);
      d++;
    }
    return d;
  };
  return [...versions].sort((a, b) => depth(b) - depth(a));
}
