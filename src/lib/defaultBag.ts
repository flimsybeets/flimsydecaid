// Which bag the brew panel starts on for a profile. In order:
//   1. the bag a "Brew this again" asked for,
//   2. the bag set as this profile's default (Set as default),
//   3. the bag last used with this profile (newest dial-in for it),
//   4. the bag on the machine,
//   5. the newest open bag.
// Only open bags count at every step. Defaults live in the KV store as
// { [profileRoot]: batchId }.
import type { BeanBatch } from '../api/types';
import { readDialIn } from './dialIn';

export const DEFAULT_BAGS_KEY = 'defaultBags';
export type DefaultBags = Record<string, string>;

export function parseDefaultBags(raw: unknown): DefaultBags {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: DefaultBags = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === 'string' && v) out[k] = v;
  return out;
}

/** The open bag last used with this profile: the newest dial-in written for it. */
export function lastUsedBag(open: readonly BeanBatch[], profileRoot: string): string | null {
  let best: { id: string; at: string } | null = null;
  for (const b of open) {
    const at = readDialIn(b, profileRoot)?.updatedAt;
    if (at && (!best || at > best.at)) best = { id: b.id, at };
  }
  return best?.id ?? null;
}

export function startBag(opts: {
  open: readonly BeanBatch[];
  profileRoot: string;
  requested?: string | null;
  defaults: DefaultBags;
  onMachine?: string | null;
}): string | null {
  const isOpen = (id: string | null | undefined): id is string => !!id && opts.open.some((b) => b.id === id);
  if (isOpen(opts.requested)) return opts.requested;
  const def = opts.defaults[opts.profileRoot];
  if (isOpen(def)) return def;
  const last = lastUsedBag(opts.open, opts.profileRoot);
  if (last) return last;
  if (isOpen(opts.onMachine)) return opts.onMachine;
  return opts.open[0]?.id ?? null;
}
