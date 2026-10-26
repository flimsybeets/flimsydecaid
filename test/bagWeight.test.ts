import { describe, expect, it } from 'vitest';
import type { BeanBatch } from '../src/api/types';
import { applyDecrement, applyGiveback, doseOf, givebackFor, ledgerOf, LEDGER_SIZE, pouredEnough, shouldDecrement } from '../src/lib/bagWeight';

const bag = (over: Partial<BeanBatch> = {}): BeanBatch => ({
  id: 'b1', beanId: 'x', frozen: false, archived: false, createdAt: '', updatedAt: '', weight: 250, weightRemaining: 100, ...over,
});
const shot = (id = 's1', dose = 18, batchId = 'b1') => ({ id, workflow: { context: { beanBatchId: batchId, targetDoseWeight: dose } } });
const poured = { seconds: 28, weight: 36 };

describe('doseOf', () => {
  it('prefers the weighed dose, then the target', () => {
    expect(doseOf(shot())).toBe(18);
    expect(doseOf({ ...shot(), annotations: { actualDoseWeight: 17.6 } })).toBe(17.6);
    expect(doseOf({ workflow: { context: { targetDoseWeight: 0 } } })).toBeNull();
    expect(doseOf({})).toBeNull();
  });
});

describe('pouredEnough', () => {
  it('needs 5 s of pouring or 5 g out', () => {
    expect(pouredEnough({ seconds: 2, weight: 0 })).toBe(false);
    expect(pouredEnough({ seconds: 0, weight: null })).toBe(false);
    expect(pouredEnough({ seconds: 5, weight: null })).toBe(true);
    expect(pouredEnough({ seconds: 2, weight: 5 })).toBe(true);
  });
});

describe('shouldDecrement', () => {
  it('accepts a real shot on its bag', () => expect(shouldDecrement(shot(), poured, bag())).toBe(true));
  it('skips shots that did not pour', () => expect(shouldDecrement(shot(), { seconds: 1, weight: 0.4 }, bag())).toBe(false));
  it('skips without a bag, an id, a dose or a remaining weight', () => {
    expect(shouldDecrement(shot(), poured, undefined)).toBe(false);
    expect(shouldDecrement(shot('', 18), poured, bag())).toBe(false);
    expect(shouldDecrement(shot('s', 0), poured, bag())).toBe(false);
    expect(shouldDecrement(shot(), poured, bag({ weightRemaining: null }))).toBe(false);
    expect(shouldDecrement(shot('s', 18, 'other'), poured, bag())).toBe(false);
  });
  it('never counts a shot twice', () => {
    const once = { ...bag(), ...applyDecrement(bag(), 's1', 18) };
    expect(shouldDecrement(shot(), poured, once)).toBe(false);
    expect(shouldDecrement(shot('s2'), poured, once)).toBe(true);
  });
});

describe('applyDecrement', () => {
  it('subtracts the dose and records it', () => {
    const u = applyDecrement(bag(), 's1', 18);
    expect(u.weightRemaining).toBe(82);
    expect(ledgerOf({ ...bag(), extras: u.extras })).toEqual([{ id: 's1', g: 18 }]);
  });
  it('clamps at 0 and records only what was there', () => {
    const u = applyDecrement(bag({ weightRemaining: 10 }), 's1', 18);
    expect(u.weightRemaining).toBe(0);
    expect(ledgerOf({ ...bag(), extras: u.extras })[0]!.g).toBe(10);
  });
  it('keeps other extras and dial-in, newest first, capped', () => {
    let b = bag({ extras: { other: 1, flimsydecaid: { dialIn: { p: { dose: 18 } } } } });
    for (let i = 0; i < LEDGER_SIZE + 5; i++) b = { ...b, ...applyDecrement(b, `s${i}`, 0.5) };
    expect(b.extras!.other).toBe(1);
    expect((b.extras!.flimsydecaid as { dialIn: unknown }).dialIn).toEqual({ p: { dose: 18 } });
    const l = ledgerOf(b);
    expect(l).toHaveLength(LEDGER_SIZE);
    expect(l[0]!.id).toBe(`s${LEDGER_SIZE + 4}`);
  });
  it('does not mutate the bag', () => {
    const b = bag();
    applyDecrement(b, 's1', 18);
    expect(b.weightRemaining).toBe(100);
    expect(b.extras).toBeUndefined();
  });
});

describe('give back', () => {
  const after = (() => { const b = bag(); return { ...b, ...applyDecrement(b, 's1', 18) }; })();
  it('offers what was taken', () => {
    expect(givebackFor(after, 's1')).toBe(18);
    expect(givebackFor(after, 'nope')).toBeNull();
    expect(givebackFor(undefined, 's1')).toBeNull();
  });
  it('adds it back once', () => {
    const u = applyGiveback(after, 's1')!;
    expect(u.weightRemaining).toBe(100);
    expect(applyGiveback({ ...after, ...u }, 's1')).toBeNull();
  });
  it('never goes over the bag size', () => {
    const full = { ...after, weightRemaining: 249 };
    expect(applyGiveback(full, 's1')!.weightRemaining).toBe(250);
  });
  it('gives back only what a clamped shot really took', () => {
    const b = bag({ weightRemaining: 10 });
    const empty = { ...b, ...applyDecrement(b, 's1', 18) };
    expect(applyGiveback(empty, 's1')!.weightRemaining).toBe(10);
  });
});
