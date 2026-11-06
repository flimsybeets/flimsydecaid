import { describe, expect, it } from 'vitest';
import type { Grinder } from '../src/api/types';
import { currentGrinder, DEFAULT_GRIND, grindControl } from '../src/lib/grinder';

const g = (over: Partial<Grinder> = {}): Grinder => ({ id: 'g1', model: 'Test', archived: false, settingType: 'numeric', ...over });

describe('grindControl', () => {
  it('keeps today\'s stepper without a grinder', () => {
    expect(grindControl(null)).toEqual(DEFAULT_GRIND);
    expect(DEFAULT_GRIND).toMatchObject({ step: 0.5, min: 0, max: 100, decimals: 1 });
  });
  it('uses the grinder\'s small step and name', () => {
    expect(grindControl(g({ settingSmallStep: 0.25 }))).toMatchObject({ step: 0.25, decimals: 2, min: 0, max: 100, name: 'Test' });
    expect(grindControl(g({ settingSmallStep: 1 }))).toMatchObject({ step: 1, decimals: 0 });
  });
  it('falls back for a dial with no step', () => {
    expect(grindControl(g({ settingSmallStep: null }))).toMatchObject({ step: 0.5, name: 'Test' });
    expect(grindControl(g({ settingSmallStep: 0 }))).toMatchObject({ step: 0.5 });
  });
  it('takes the range of numeric presets', () => {
    expect(grindControl(g({ settingType: 'preset', settingValues: ['1', '5', '10', '40'] }))).toMatchObject({ min: 1, max: 40, step: 4 });
  });
  it('ignores named presets', () => {
    expect(grindControl(g({ settingType: 'preset', settingValues: ['Fine', 'Coarse'] }))).toMatchObject({ step: 0.5, min: 0, max: 100, name: 'Test' });
  });
});

describe('currentGrinder', () => {
  it('prefers the one the workflow names', () => {
    expect(currentGrinder([g({ id: 'a' }), g({ id: 'b' })], 'b')?.id).toBe('b');
    expect(currentGrinder([g({ id: 'a' })], 'zzz')).toBeNull();
  });
  it('takes the only open grinder', () => {
    expect(currentGrinder([g({ id: 'a' }), g({ id: 'b', archived: true })])?.id).toBe('a');
  });
  it('does not guess between several', () => {
    expect(currentGrinder([g({ id: 'a' }), g({ id: 'b' })])).toBeNull();
    expect(currentGrinder([])).toBeNull();
  });
});
