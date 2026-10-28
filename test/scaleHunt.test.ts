import { describe, expect, it } from 'vitest';
import { HUNT_FIRST_MS, HUNT_MAX_MS, huntDelay, shouldHunt } from '../src/lib/scaleHunt';

describe('scale hunt', () => {
  it('backs off from 5 s, doubling, then keeps trying every 5 minutes', () => {
    expect(huntDelay(0)).toBe(HUNT_FIRST_MS);
    expect(huntDelay(1)).toBe(10_000);
    expect(huntDelay(2)).toBe(20_000);
    expect(huntDelay(10)).toBe(HUNT_MAX_MS);
    expect(huntDelay(1000)).toBe(HUNT_MAX_MS);
  });
  it('only looks while the machine is up, awake and has no scale', () => {
    const base = { machineConnected: true, asleep: false, scaleConnected: false, shotActive: false };
    expect(shouldHunt(base)).toBe(true);
    expect(shouldHunt({ ...base, scaleConnected: true })).toBe(false);
    expect(shouldHunt({ ...base, asleep: true })).toBe(false);
    expect(shouldHunt({ ...base, machineConnected: false })).toBe(false);
    expect(shouldHunt({ ...base, shotActive: true })).toBe(false);
  });
});
