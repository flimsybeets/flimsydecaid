// Tank water level. Decaid streams `ws/v1/machine/waterLevels` as
// { currentLevel, refillLevel } in millimetres of water height, and
// POST /machine/waterLevels { refillLevel } sets the warning threshold
// (truncated to an integer by Decaid). Decaid gives no tank height, so the
// glyph scales against a nominal full tank; the number shown is always mm.

import type { WaterLevels } from '../api/types';

export type WaterState = 'unknown' | 'ok' | 'low' | 'empty';

/** Nominal full-tank height (mm) for the glyph's fill only. A guess: the DE1 tank reads in the 40s when full. */
export const WATER_FULL_MM = 50;
export const REFILL_MIN_MM = 0;
export const REFILL_MAX_MM = 40;

/** Machine state `needsWater` is red; at or below the refill level is amber. */
export function waterState(levels: WaterLevels | null, needsWater: boolean): WaterState {
  if (needsWater) return 'empty';
  if (!levels || !Number.isFinite(levels.currentLevel)) return 'unknown';
  if (Number.isFinite(levels.refillLevel) && levels.currentLevel <= levels.refillLevel) return 'low';
  return 'ok';
}

/** 0–1 fill for the tank glyph. */
export function waterFill(currentMm: number | undefined, fullMm = WATER_FULL_MM): number {
  if (currentMm === undefined || !Number.isFinite(currentMm)) return 0;
  return Math.min(1, Math.max(0, currentMm / fullMm));
}

export function clampRefill(mm: number): number {
  return Math.min(REFILL_MAX_MM, Math.max(REFILL_MIN_MM, Math.round(mm)));
}
