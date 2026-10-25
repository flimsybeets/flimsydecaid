import { describe, expect, it } from 'vitest';
import type { Profile, ProfileRecord, ProfileStep } from '../src/api/types';
import {
  blankProfile, duplicateStep, EditHistory, moveStep, newStep, normalizeProfile, profileCurve,
  removeStep, saveProfile, setPump, stepTarget, validateProfile, type ProfileApi,
} from '../src/lib/profileEdit';

const flow = (v: number, seconds: number, extra: Partial<ProfileStep> = {}): ProfileStep => ({ ...newStep(undefined, 'flow'), flow: v, seconds, ...extra });
const pres = (v: number, seconds: number, extra: Partial<ProfileStep> = {}): ProfileStep => ({ ...newStep(undefined, 'pressure'), pressure: v, seconds, ...extra });

describe('step editing', () => {
  it('switches pump without losing the other value', () => {
    const s = pres(9, 10);
    const f = setPump(s, 'flow');
    expect(f.pump).toBe('flow');
    expect(stepTarget(f)).toBe(2);
    const back = setPump({ ...f, flow: 3.5 }, 'pressure');
    expect(stepTarget(back)).toBe(9);
    expect(back.flow).toBe(3.5);
  });

  it('duplicates, moves and removes steps, keeping at least one', () => {
    const steps = [flow(4, 8, { name: 'a' }), pres(9, 20, { name: 'b' })];
    const dup = duplicateStep(steps, 0);
    expect(dup.map((s) => s.name)).toEqual(['a', 'a', 'b']);
    dup[1]!.name = 'copy';
    expect(steps[0]!.name).toBe('a');
    expect(moveStep(steps, 1, 0).map((s) => s.name)).toEqual(['b', 'a']);
    expect(moveStep(steps, 1, 5).map((s) => s.name)).toEqual(['a', 'b']);
    expect(removeStep([steps[0]!], 0)).toHaveLength(1);
  });

  it('new steps carry the previous temperature and sensor', () => {
    const s = newStep({ ...pres(9, 1), temperature: 88, sensor: 'water' });
    expect([s.temperature, s.sensor]).toEqual([88, 'water']);
  });
});

describe('normalizing for save', () => {
  it('keeps only the pump\'s own target, rounds, and clears an off exit', () => {
    const p = { ...blankProfile(), steps: [{ ...pres(9.04, 10.04), flow: 3, exit: { type: 'flow' as const, condition: 'over' as const, value: 0 } }] };
    const n = normalizeProfile(p).steps[0]!;
    expect(n.pressure).toBe(9);
    expect(n.flow).toBeUndefined();
    expect(n.seconds).toBe(10);
    expect(n.exit).toBeNull();
  });

  it('passes unknown fields through', () => {
    const p = { ...blankProfile(), legacy_field: 'keep', steps: [{ ...pres(9, 10), mystery: 1 }] } as Profile;
    const n = normalizeProfile(p);
    expect(n.legacy_field).toBe('keep');
    expect(n.steps[0]!.mystery).toBe(1);
  });
});

describe('planned curve', () => {
  it('lays steps end to end', () => {
    const { segments, total } = profileCurve([flow(4, 8), pres(9, 20)]);
    expect(total).toBe(28);
    expect(segments.map((s) => [s.t0, s.t1])).toEqual([[0, 8], [8, 28]]);
  });

  it('ramps smooth steps from the previous target, or the exit threshold that handed over', () => {
    const same = profileCurve([pres(3, 5), pres(9, 5, { transition: 'smooth' })]).segments[1]!;
    expect([same.from, same.to]).toEqual([3, 9]);
    const handover = profileCurve([flow(4, 8, { exit: { type: 'pressure', condition: 'over', value: 4 } }), pres(9, 5, { transition: 'smooth' })]).segments[1]!;
    expect(handover.from).toBe(4);
    const cold = profileCurve([flow(4, 8), pres(9, 5, { transition: 'smooth' })]).segments[1]!;
    expect(cold.from).toBe(0);
    const fast = profileCurve([pres(3, 5), pres(9, 5)]).segments[1]!;
    expect(fast.from).toBe(9);
  });
});

describe('validation', () => {
  it('blocks only what cannot be saved and warns past machine limits', () => {
    expect(validateProfile(blankProfile())).toEqual([]);
    const issues = validateProfile({ ...blankProfile(), title: ' ', steps: [pres(13, 200), flow(-1, 5)] });
    expect(issues.filter((i) => i.level === 'error').map((i) => i.message)).toEqual(['Give it a title', 'Step 2: values must be zero or more']);
    expect(issues.filter((i) => i.level === 'warn').length).toBe(2);
  });

  it('flags an exit the step can never reach', () => {
    const issues = validateProfile({ ...blankProfile(), steps: [pres(6, 10, { exit: { type: 'pressure', condition: 'over', value: 8 } })] });
    expect(issues.some((i) => i.message.includes('exits at P > 8'))).toBe(true);
  });
});

describe('undo history', () => {
  it('undoes and redoes, and a new edit clears redo', () => {
    const h = EditHistory.of({ v: 1 });
    h.push({ v: 2 }, 'a', 0);
    h.push({ v: 3 }, 'b', 10_000);
    expect(h.undo()).toEqual({ v: 2 });
    expect(h.undo()).toEqual({ v: 1 });
    expect(h.undo()).toBeNull();
    expect(h.redo()).toEqual({ v: 2 });
    h.push({ v: 9 }, 'c', 20_000);
    expect(h.canRedo).toBe(false);
  });

  it('coalesces a held stepper into one undo step', () => {
    const h = EditHistory.of({ v: 0 });
    for (let i = 1; i <= 10; i++) h.push({ v: i }, 'step0.pressure', i * 100);
    expect(h.undo()).toEqual({ v: 0 });
  });

  it('ignores pushes that change nothing', () => {
    const h = EditHistory.of({ v: 0 });
    h.push({ v: 0 }, 'x');
    expect(h.canUndo).toBe(false);
  });
});

describe('saving onto content-hashed profiles', () => {
  // A fake Decaid: ids hash steps only; creating an existing hash returns it unchanged.
  function fakeApi(existing: ProfileRecord[] = []) {
    const store = new Map(existing.map((r) => [r.id, r]));
    const calls: string[] = [];
    const id = (p: Profile) => 'profile:' + JSON.stringify(p.steps).length + ':' + p.steps.map((s) => stepTarget(s)).join(',');
    const api: ProfileApi = {
      async create(profile, parentId) {
        calls.push(`create ${parentId}`);
        const key = id(profile);
        const found = store.get(key);
        if (found) return found;
        const r: ProfileRecord = { id: key, profile, parentId, visibility: 'visible', isDefault: false, createdAt: 'now', updatedAt: 'now' };
        store.set(key, r);
        return r;
      },
      async update(rid, profile) {
        calls.push(`update ${rid}`);
        const r = { ...store.get(rid)!, profile };
        store.set(rid, r);
        return r;
      },
    };
    return { api, calls, id };
  }

  const base = blankProfile();

  it('saves changed steps as a new version of the original', async () => {
    const { api, id } = fakeApi();
    const original = await api.create(normalizeProfile(base), null);
    const draft = { ...base, steps: [base.steps[0]!, { ...base.steps[1]!, pressure: 8 }] };
    const res = await saveProfile(api, draft, original);
    expect(res.kind).toBe('version');
    expect(res.record.parentId).toBe(original.id);
    expect(res.record.id).toBe(id(normalizeProfile(draft)));
  });

  it('renames in place when only the title changed', async () => {
    const { api, calls } = fakeApi();
    const original = await api.create(normalizeProfile(base), null);
    const res = await saveProfile(api, { ...base, title: 'Renamed' }, original);
    expect(res.kind).toBe('renamed');
    expect(res.record.id).toBe(original.id);
    expect(res.record.profile.title).toBe('Renamed');
    expect(calls.at(-1)).toBe(`update ${original.id}`);
  });

  it('reports a copy that is identical to an existing profile', async () => {
    const { api } = fakeApi();
    const original = await api.create(normalizeProfile(base), null);
    const res = await saveProfile(api, { ...base, title: 'Copy' }, original, true);
    expect(res.kind).toBe('same-as');
    expect(res.record.id).toBe(original.id);
  });

  it('creates a brand new profile', async () => {
    const { api } = fakeApi();
    const res = await saveProfile(api, base, null);
    expect(res.kind).toBe('created');
    expect(res.record.parentId).toBeNull();
  });

  it('does nothing visible when nothing changed', async () => {
    const { api, calls } = fakeApi();
    const original = await api.create(normalizeProfile(base), null);
    const res = await saveProfile(api, base, original);
    expect(res.kind).toBe('unchanged');
    expect(calls.filter((c) => c.startsWith('update'))).toEqual([]);
  });
});
