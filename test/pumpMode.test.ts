import { describe, expect, it } from 'vitest';
import { PumpTracker, readPump, stepPump } from '../src/lib/pumpMode';

const steps = [{ pump: 'flow' as const }, { pump: 'pressure' as const }];

describe('pump mode', () => {
  it('reads the nonzero target', () => {
    expect(readPump({ targetPressure: 9, targetFlow: 0 }, null)).toBe('pressure');
    expect(readPump({ targetPressure: 0, targetFlow: 2 }, 'pressure')).toBe('flow');
  });
  it('falls back to the step when both or neither target shows', () => {
    expect(readPump({ targetPressure: 0, targetFlow: 0 }, 'flow')).toBe('flow');
    expect(readPump({ targetPressure: 6, targetFlow: 2 }, 'pressure')).toBe('pressure');
    expect(readPump({}, null)).toBeNull();
  });
  it('finds the step pump safely', () => {
    expect(stepPump(steps, 1)).toBe('pressure');
    expect(stepPump(steps, 5)).toBeNull();
    expect(stepPump(undefined, 0)).toBeNull();
    expect(stepPump(steps, null)).toBeNull();
  });
  it('holds through a gap and needs two frames to switch', () => {
    const t = new PumpTracker();
    expect(t.update({ targetFlow: 4 })).toBe('flow');
    expect(t.update({ targetPressure: 0, targetFlow: 0 })).toBe('flow'); // gap
    expect(t.update({ targetPressure: 9 })).toBe('flow'); // first frame of change
    expect(t.update({ targetPressure: 9 })).toBe('pressure');
  });
  it('one odd frame does not flip it', () => {
    const t = new PumpTracker();
    t.update({ targetPressure: 9 });
    t.update({ targetFlow: 3 });
    expect(t.update({ targetPressure: 9 })).toBe('pressure');
  });
  it('uses the step while both targets are zero at the start', () => {
    const t = new PumpTracker();
    expect(t.update({ profileFrame: 1 }, steps)).toBe('pressure');
    t.reset();
    expect(t.mode).toBeNull();
  });
});
