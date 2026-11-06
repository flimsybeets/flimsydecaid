// What the grind Stepper needs from Decaid's grinder record: its step, range
// and name. Decaid has no min/max for a dial, so a dial keeps the default
// range; a preset grinder with numeric positions takes the range of those.

import type { Grinder } from '../api/types';

export interface GrindControl {
  step: number;
  min: number;
  max: number;
  decimals: number;
  /** The grinder's model, when one is known. */
  name: string | null;
}

export const DEFAULT_GRIND: GrindControl = { step: 0.5, min: 0, max: 100, decimals: 1, name: null };

const decimalsOf = (n: number) => {
  const s = String(n);
  if (/e-/.test(s)) return Math.min(4, Number(s.split('e-')[1]));
  return Math.min(4, (s.split('.')[1] ?? '').length);
};

/**
 * The grinder the workflow is linked to (`grinderId`); with none linked, the
 * only grinder on record. null when it can't be told.
 */
export function currentGrinder(grinders: readonly Grinder[], linkedId?: string | null): Grinder | null {
  const open = grinders.filter((g) => !g.archived);
  if (linkedId) return grinders.find((g) => g.id === linkedId) ?? null;
  return open.length === 1 ? open[0]! : null;
}

export function grindControl(grinder: Grinder | null | undefined): GrindControl {
  if (!grinder) return DEFAULT_GRIND;
  const name = grinder.model?.trim() || null;
  const small = grinder.settingSmallStep;
  if (grinder.settingType === 'preset') {
    const nums = (grinder.settingValues ?? []).map((v) => Number(v)).filter((n) => Number.isFinite(n));
    if (nums.length < 2 || nums.length !== (grinder.settingValues ?? []).length) return { ...DEFAULT_GRIND, name };
    const sorted = [...new Set(nums)].sort((a, b) => a - b);
    const gaps = sorted.slice(1).map((n, i) => n - sorted[i]!);
    const step = small && small > 0 ? small : Math.min(...gaps);
    return { step, min: sorted[0]!, max: sorted[sorted.length - 1]!, decimals: decimalsOf(step), name };
  }
  if (!small || small <= 0 || !Number.isFinite(small)) return { ...DEFAULT_GRIND, name };
  return { ...DEFAULT_GRIND, step: small, decimals: decimalsOf(small), name };
}
