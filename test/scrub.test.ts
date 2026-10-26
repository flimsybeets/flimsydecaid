import { describe, expect, it } from 'vitest';
import type { ShotSample } from '../src/lib/shot';
import { nearestIndex, valuesAt } from '../src/lib/scrub';

const s: ShotSample[] = [
  { t: 0, pressure: 0, flow: 0, weight: 0, waterTemp: 90, targetPressure: 2 },
  { t: 2, pressure: 4, flow: 2, weight: 1, waterTemp: 92 },
  { t: 6, pressure: 8, flow: 4, weight: 9, waterTemp: 94, targetPressure: 8 },
];

describe('nearestIndex', () => {
  it('picks the closest sample by time', () => {
    expect(nearestIndex(s, 0.9)).toBe(0);
    expect(nearestIndex(s, 1.1)).toBe(1);
    expect(nearestIndex(s, 3.9)).toBe(1);
    expect(nearestIndex(s, 4.1)).toBe(2);
    expect(nearestIndex(s, -5)).toBe(0);
    expect(nearestIndex(s, 99)).toBe(2);
    expect(nearestIndex([], 1)).toBe(-1);
  });
});

describe('valuesAt', () => {
  it('returns sample values exactly on a sample', () => {
    expect(valuesAt(s, 2)).toMatchObject({ t: 2, pressure: 4, weight: 1 });
  });
  it('interpolates between samples', () => {
    const v = valuesAt(s, 4)!;
    expect(v.pressure).toBeCloseTo(6);
    expect(v.weight).toBeCloseTo(5);
    expect(v.waterTemp).toBeCloseTo(93);
  });
  it('clamps outside the shot', () => {
    expect(valuesAt(s, -3)).toMatchObject({ t: 0, pressure: 0 });
    expect(valuesAt(s, 50)).toMatchObject({ t: 6, pressure: 8 });
  });
  it('omits a series nobody has, and falls back to the nearest sample for a gap', () => {
    const v = valuesAt(s, 3)!;
    expect(v.targetFlow).toBeUndefined();
    expect(v.targetPressure).toBeUndefined();
    expect(valuesAt(s, 5.5)!.targetPressure).toBe(8);
  });
  it('is null for no samples', () => {
    expect(valuesAt([], 1)).toBeNull();
  });
});
