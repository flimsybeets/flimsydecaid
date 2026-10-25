import { describe, expect, it } from 'vitest';
import { arcPath, polar, tempDialRange, ticks, valueToAngle } from '../src/lib/gauge';

describe('gauge geometry', () => {
  it('maps values onto a 240° sweep and pins out-of-range readings', () => {
    expect(valueToAngle(0, 0, 12)).toBe(-120);
    expect(valueToAngle(6, 0, 12)).toBe(0);
    expect(valueToAngle(12, 0, 12)).toBe(120);
    expect(valueToAngle(20, 0, 12)).toBe(120);
    expect(valueToAngle(-3, 0, 12)).toBe(-120);
  });

  it('measures angles clockwise from 12 o\'clock', () => {
    const top = polar(100, 100, 50, 0);
    const right = polar(100, 100, 50, 90);
    expect(top.x).toBeCloseTo(100); expect(top.y).toBeCloseTo(50);
    expect(right.x).toBeCloseTo(150); expect(right.y).toBeCloseTo(100);
  });

  it('flags the large arc only past 180°', () => {
    expect(arcPath(100, 100, 50, -120, 0)).toContain(' 0 0 1 ');
    expect(arcPath(100, 100, 50, -120, 120)).toContain(' 0 1 1 ');
    expect(arcPath(100, 100, 50, 10, 10)).toBe('');
  });

  it('numbers every major tick', () => {
    const t = ticks(0, 12, 2, 4);
    expect(t).toHaveLength(25);
    expect(t.filter((x) => x.major).map((x) => x.value)).toEqual([0, 2, 4, 6, 8, 10, 12]);
    expect(t[1]).toEqual({ value: 0.5, major: false });
  });

  it('sizes the temperature dial around the profile', () => {
    expect(tempDialRange([93])).toEqual([85, 105]);
    expect(tempDialRange([88, 94])).toEqual([80, 100]);
    expect(tempDialRange([70, 95])).toEqual([60, 105]);
    expect(tempDialRange([])).toEqual([80, 100]);
    for (const temps of [[93], [88, 94], [70, 95], [90.5], [100]]) {
      const [lo, hi] = tempDialRange(temps);
      expect(hi - lo).toBeGreaterThanOrEqual(20);
      expect(lo).toBeLessThanOrEqual(Math.min(...temps) - 5);
      expect(hi).toBeGreaterThanOrEqual(Math.max(...temps) + 5);
    }
  });
});
