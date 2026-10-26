import { describe, expect, it } from 'vitest';
import type { BeanBatch, Profile, ProfileRecord } from '../src/api/types';
import { hideOrder, latestPerLineage, lineageRoot, indexProfiles, shiftTemperature } from '../src/lib/profiles';
import { readDialIn, resolveDialIn, withDialIn } from '../src/lib/dialIn';
import { parseCategories, toggleProfile } from '../src/lib/categories';
import { backoffDelay } from '../src/api/socket';
import { ShotRecorder } from '../src/lib/shot';
import { heaterOn } from '../src/lib/steam';

const profile = (title: string, temps: number[]): Profile => ({
  title,
  steps: temps.map((t, i) => ({ name: `s${i}`, pump: 'flow', transition: 'fast', volume: 0, seconds: 10, temperature: t, sensor: 'coffee', flow: 2 })),
  target_volume_count_start: 0,
  tank_temperature: 0,
});

const rec = (id: string, parentId: string | null, updatedAt: string): ProfileRecord => ({
  id, parentId, updatedAt, createdAt: updatedAt, visibility: 'visible', isDefault: false, profile: profile(id, [93]),
});

const bag = (id: string, beanId: string, roastDate: string, extras?: BeanBatch['extras']): BeanBatch => ({
  id, beanId, roastDate, frozen: false, archived: false, createdAt: roastDate, updatedAt: roastDate, extras,
});

describe('profile lineage', () => {
  const records = [rec('a', null, '2026-01-01'), rec('b', 'a', '2026-02-01'), rec('c', 'b', '2026-03-01'), rec('x', null, '2026-01-05')];
  const byId = indexProfiles(records);

  it('walks edits back to the original', () => {
    expect(lineageRoot('c', byId)).toBe('a');
    expect(lineageRoot('a', byId)).toBe('a');
  });

  it('stops at an ancestor it cannot see', () => {
    const partial = indexProfiles([rec('c', 'b', '2026-03-01')]);
    expect(lineageRoot('c', partial)).toBe('c');
  });

  it('survives a parent cycle', () => {
    const loop = indexProfiles([rec('p', 'q', '1'), rec('q', 'p', '2')]);
    expect(['p', 'q']).toContain(lineageRoot('p', loop));
  });

  it('shows only the newest version of each lineage', () => {
    const latest = latestPerLineage(records);
    expect([...latest.keys()].sort()).toEqual(['a', 'x']);
    expect(latest.get('a')!.id).toBe('c');
  });
});

describe('temperature offset', () => {
  it('shifts every step and leaves the original untouched', () => {
    const p = profile('t', [93, 92, 90.5]);
    const shifted = shiftTemperature(p, 1.5);
    expect(shifted.steps.map((s) => s.temperature)).toEqual([94.5, 93.5, 92]);
    expect(p.steps.map((s) => s.temperature)).toEqual([93, 92, 90.5]);
    expect(shifted.tank_temperature).toBe(0);
  });

  it('returns the same profile for a zero offset', () => {
    const p = profile('t', [93]);
    expect(shiftTemperature(p, 0)).toBe(p);
  });
});

describe('dial-in per bag + profile', () => {
  const old = bag('old', 'bean', '2026-09-01', { flimsydecaid: { dialIn: { prof: { grind: '11', dose: 18, updatedAt: '2026-09-10' } } } });
  const older = bag('older', 'bean', '2026-08-01', { flimsydecaid: { dialIn: { prof: { grind: '9', updatedAt: '2026-08-10' } } } });
  const other = bag('other', 'otherBean', '2026-10-01', { flimsydecaid: { dialIn: { prof: { grind: '20', updatedAt: '2026-10-10' } } } });
  const fresh = bag('fresh', 'bean', '2026-10-15');

  it('prefers this bag', () => {
    const own = bag('fresh', 'bean', '2026-10-15', { flimsydecaid: { dialIn: { prof: { grind: '12' } } } });
    expect(resolveDialIn(own, 'prof', [own, old])).toMatchObject({ source: 'this-bag', dialIn: { grind: '12' } });
  });

  it('carries over from the latest previous bag of the same bean', () => {
    const r = resolveDialIn(fresh, 'prof', [fresh, older, old, other]);
    expect(r).toMatchObject({ source: 'previous-bag', fromBatchId: 'old', dialIn: { grind: '11' } });
  });

  it('never borrows from a different bean or profile', () => {
    expect(resolveDialIn(fresh, 'otherProfile', [fresh, old, other]).source).toBe('profile-default');
    expect(resolveDialIn(bag('lonely', 'newBean', '2026-10-20'), 'prof', [old, other]).source).toBe('profile-default');
  });

  it('writes into its own namespace and keeps other keys', () => {
    const b = bag('b', 'bean', '2026-10-01', { someOtherSkin: { keep: true }, flimsydecaid: { dialIn: { p1: { grind: '1' } } } });
    const extras = withDialIn(b, 'p2', { grind: '2', tempOffset: -1 });
    expect(extras.someOtherSkin).toEqual({ keep: true });
    const updated = { ...b, extras };
    expect(readDialIn(updated, 'p1')?.grind).toBe('1');
    expect(readDialIn(updated, 'p2')).toMatchObject({ grind: '2', tempOffset: -1 });
  });
});

describe('categories', () => {
  it('ignores junk from the store', () => {
    expect(parseCategories(null).categories).toEqual([]);
    expect(parseCategories({ categories: [{ id: 'a', name: 'A', profiles: ['p', 3] }, { nope: 1 }] }).categories)
      .toEqual([{ id: 'a', name: 'A', profiles: ['p'] }]);
  });

  it('toggles a profile in and out', () => {
    const doc = parseCategories({ categories: [{ id: 'a', name: 'A', profiles: [] }] });
    const added = toggleProfile(doc, 'a', 'p');
    expect(added.categories[0]!.profiles).toEqual(['p']);
    expect(toggleProfile(added, 'a', 'p').categories[0]!.profiles).toEqual([]);
  });
});

describe('socket backoff', () => {
  it('grows, caps, and jitters', () => {
    expect(backoffDelay(0, 500, 15000, () => 0)).toBe(250);
    expect(backoffDelay(0, 500, 15000, () => 1)).toBe(500);
    expect(backoffDelay(3, 500, 15000, () => 0.5)).toBe(3000);
    expect(backoffDelay(20, 500, 15000, () => 1)).toBe(15000);
  });
});

describe('shot recorder', () => {
  it('records preinfusion and pouring only, and breaks zeroed pump targets', () => {
    const r = new ShotRecorder();
    const frame = (substate: string, extra = {}) => ({ state: { state: 'espresso' as const, substate: substate as never }, pressure: 2, targetPressure: 0, targetFlow: 4, mixTemperature: 92, groupTemperature: 93, ...extra });
    expect(r.onMachine(frame('preparingForShot'), 0)).toBe(false);
    expect(r.onMachine(frame('preinfusion'), 1000)).toBe(true);
    expect(r.onMachine(frame('pouring'), 2000)).toBe(true);
    expect(r.onMachine(frame('pouringDone'), 3000)).toBe(false);
    expect(r.samples.map((s) => s.t)).toEqual([0, 1]);
    expect(r.samples[0]).toMatchObject({ targetPressure: undefined, targetFlow: 4, waterTemp: 92, puckTemp: 93 });
  });
});

describe('shot recorder with scale frames', () => {
  it('moves the newest sample to the latest weight, only while recording', () => {
    const r = new ShotRecorder();
    const f = (substate: string) => ({ state: { state: 'espresso' as const, substate: substate as never }, pressure: 6 });
    expect(r.onScale({ weight: 1, weightFlow: 0 } as never)).toBe(false);
    r.onMachine(f('pouring'), 0);
    r.onMachine(f('pouring'), 100);
    expect(r.onScale({ weight: 3.5, weightFlow: 1.2 } as never)).toBe(true);
    expect(r.samples.map((s) => s.weight)).toEqual([1, 3.5]);
    expect(r.samples[1]).toMatchObject({ weightFlow: 1.2, pressure: 6, t: 0.1 });
    r.onMachine(f('pouringDone'), 200);
    expect(r.onScale({ weight: 40, weightFlow: 0 } as never)).toBe(false);
    expect(r.samples[1]!.weight).toBe(3.5);
  });
});

describe('steam heater', () => {
  it('is on only within the supported range', () => {
    expect(heaterOn({ targetTemperature: 0, duration: 60, flow: 1 })).toBe(false);
    expect(heaterOn({ targetTemperature: 150, duration: 60, flow: 1 })).toBe(true);
    expect(heaterOn(undefined)).toBe(false);
  });
});

describe('hiding a profile lineage', () => {
  it('hides newest versions first so a partial failure keeps the root', () => {
    const records = [rec('a', null, '1'), rec('c', 'b', '3'), rec('b', 'a', '2')];
    const order = hideOrder(records, indexProfiles(records)).map((r) => r.id);
    expect(order).toEqual(['c', 'b', 'a']);
    // Stop after the first: the remaining versions still resolve to root 'a'.
    const left = indexProfiles(records.filter((r) => r.id !== order[0]));
    expect(lineageRoot('b', left)).toBe('a');
  });
});
