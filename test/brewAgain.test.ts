import { describe, expect, it } from 'vitest';
import type { Bean, BeanBatch, Profile, ProfileRecord } from '../src/api/types';
import { findProfileRoot, planBrewAgain } from '../src/lib/brewAgain';

const step = (temperature: number, flow = 2) => ({ name: 's', pump: 'flow' as const, transition: 'fast' as const, volume: 0, seconds: 30, temperature, sensor: 'coffee' as const, flow });
const prof = (title: string, temp = 93, flow = 2): Profile => ({ title, steps: [step(temp, flow)], target_volume_count_start: 0, tank_temperature: 0 });
const rec = (id: string, p: Profile, updatedAt = '2026-01-01'): ProfileRecord => ({ id, profile: p, visibility: 'visible', isDefault: false, createdAt: updatedAt, updatedAt });
const bean = (id: string, name: string): Bean => ({ id, roaster: 'R', name, decaf: false, archived: false } as Bean);
const bag = (id: string, beanId: string, archived = false, roast = '2026-01-01'): BeanBatch => ({ id, beanId, frozen: false, archived, roastDate: roast, createdAt: roast, updatedAt: roast });

const lineages = new Map([['root-a', rec('a2', prof('Classic', 93), '2026-02-01')], ['root-b', rec('b', prof('Other'))]]);
const beans = [bean('bean-1', 'Hambela')];
const shot = (over: Record<string, unknown> = {}) => ({
  workflow: { profile: prof('Classic', 94), context: { beanBatchId: 'b1', coffeeName: 'Hambela', coffeeRoaster: 'R', grinderSetting: '11', targetDoseWeight: 18, targetYield: 45, ...over } },
});

describe('findProfileRoot', () => {
  it('matches by title and returns the lineage root', () => expect(findProfileRoot(prof('Classic'), lineages)).toBe('root-a'));
  it('prefers a lineage with the same shape when titles repeat', () => {
    const two = new Map([['x', rec('x', prof('Same', 93, 2))], ['y', rec('y', prof('Same', 93, 4))]]);
    expect(findProfileRoot(prof('Same', 95, 4), two)).toBe('y');
  });
  it('is null for a profile that is gone', () => expect(findProfileRoot(prof('Nope'), lineages)).toBeNull());
});

describe('planBrewAgain', () => {
  it('uses the shot numbers, bag and a temperature offset', () => {
    const p = planBrewAgain(shot(), lineages, [bag('b1', 'bean-1')], beans);
    expect(p).toEqual({ profileRoot: 'root-a', batchId: 'b1', note: null, dialIn: { grind: '11', dose: 18, yield: 45, tempOffset: 1 } });
  });
  it('falls back to the newest open bag of the coffee, with a note', () => {
    const p = planBrewAgain(shot(), lineages, [bag('b1', 'bean-1', true), bag('b2', 'bean-1', false, '2026-03-01'), bag('b3', 'bean-1', false, '2026-02-01')], beans);
    expect(p.batchId).toBe('b2');
    expect(p.note).toMatch(/finished/);
  });
  it('finds the coffee by name when the bag was deleted', () => {
    const p = planBrewAgain(shot(), lineages, [bag('b9', 'bean-1')], beans);
    expect(p.batchId).toBe('b9');
    expect(p.note).not.toBeNull();
  });
  it('says so when no bag is open', () => {
    const p = planBrewAgain(shot(), lineages, [bag('b1', 'bean-1', true)], beans);
    expect(p.batchId).toBeNull();
    expect(p.note).toMatch(/no open bag/i);
  });
  it('leaves out what the shot did not record', () => {
    const p = planBrewAgain(shot({ grinderSetting: null, targetYield: 0, targetDoseWeight: null }), lineages, [bag('b1', 'bean-1')], beans);
    expect(p.dialIn).toEqual({ tempOffset: 1 });
  });
});
