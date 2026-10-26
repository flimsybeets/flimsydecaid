import { describe, expect, it } from 'vitest';
import { clampRefill, REFILL_MAX_MM, waterFill, waterState } from '../src/lib/water';

describe('water level', () => {
  it('is unknown until Decaid reports', () => {
    expect(waterState(null, false)).toBe('unknown');
  });
  it('is ok above the refill level, low at or below it', () => {
    expect(waterState({ currentLevel: 30, refillLevel: 10 }, false)).toBe('ok');
    expect(waterState({ currentLevel: 10, refillLevel: 10 }, false)).toBe('low');
    expect(waterState({ currentLevel: 4, refillLevel: 10 }, false)).toBe('low');
  });
  it('is empty whenever the machine says it needs water', () => {
    expect(waterState({ currentLevel: 30, refillLevel: 10 }, true)).toBe('empty');
    expect(waterState(null, true)).toBe('empty');
  });
  it('fills the glyph between 0 and 1', () => {
    expect(waterFill(25, 50)).toBe(0.5);
    expect(waterFill(80, 50)).toBe(1);
    expect(waterFill(-3, 50)).toBe(0);
    expect(waterFill(undefined)).toBe(0);
  });
  it('clamps and rounds the refill level', () => {
    expect(clampRefill(12.6)).toBe(13);
    expect(clampRefill(-5)).toBe(0);
    expect(clampRefill(999)).toBe(REFILL_MAX_MM);
  });
});
