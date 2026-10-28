import { describe, expect, it } from 'vitest';
import { HUNT_DELAYS, huntDelay, shouldHunt } from '../src/lib/scaleHunt';

describe('scale hunt', () => {
  it('spaces automatic scans out, then stops', () => {
    expect(huntDelay(0)).toBe(HUNT_DELAYS[0]);
    expect(huntDelay(HUNT_DELAYS.length)).toBeNull();
    for (let i = 1; i < HUNT_DELAYS.length; i++) expect(HUNT_DELAYS[i]).toBeGreaterThanOrEqual(30_000);
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
