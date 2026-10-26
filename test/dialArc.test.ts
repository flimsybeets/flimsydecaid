import { describe, expect, it } from 'vitest';
import { dialArc, parseGrind } from '../src/lib/dialArc';

describe('dial arc', () => {
  it('runs from 0 to exactly the setting', () => {
    for (const v of [0, 5, 14, 30, 60, 90]) {
      const a = dialArc(String(v))!;
      expect(a.dash).toBe(v);
      expect(a.angle).toBeCloseTo(-150 + (v * 300) / 90);
      // the ring turns until the setting sits at the pointer (angle 0 after rotating)
      expect(a.angle + a.rotate).toBeCloseTo(0);
    }
  });
  it('clamps outside 0-90 and handles decimals', () => {
    expect(dialArc('120')!.dash).toBe(90);
    expect(dialArc(-4)!.dash).toBe(0);
    expect(dialArc('14.5')!.dash).toBe(14.5);
  });
  it('has no arc without a number', () => {
    expect(dialArc(null)).toBeNull();
    expect(dialArc('')).toBeNull();
    expect(dialArc('medium')).toBeNull();
    expect(parseGrind(undefined)).toBeNull();
  });
});
