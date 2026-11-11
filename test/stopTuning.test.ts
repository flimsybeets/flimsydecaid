import { describe, expect, it } from 'vitest';
import { addRead, landingText, parseReads, stopRead, suggestLookAhead, type StopRead } from '../src/lib/stopTuning';
import type { ShotMeasurement } from '../src/api/types';

const m = (substate: string, weight?: number, weightFlow?: number) =>
  ({ machine: { state: { state: 'espresso', substate } }, scale: weight === undefined ? null : { weight, weightFlow } }) as unknown as ShotMeasurement;

const shot = (over: object = {}) => ({
  id: 's1', stopReason: 'targetWeight', workflow: { context: { targetYield: 36 } },
  measurements: [m('preinfusion', 0, 0), m('pouring', 20, 2), m('pouring', 34.5, 2.5), m('pouringDone', 36.5, 1), m('idle', 37.0, 0)],
  ...over,
});

describe('stopRead', () => {
  it('reads drip after the stop and the flow at the stop', () => {
    expect(stopRead(shot())).toEqual({ id: 's1', landed: 37, target: 36, drip: 2.5, flow: 2.5 });
  });
  it('ignores shots that did not stop at weight, have no target or barely flowed', () => {
    expect(stopRead(shot({ stopReason: 'machineEnded' }))).toBeNull();
    expect(stopRead(shot({ workflow: { context: { targetYield: 0 } } }))).toBeNull();
    expect(stopRead(shot({ measurements: [m('preinfusion', 0, 0), m('pouring', 30, 0.1), m('idle', 30.2, 0)] }))).toBeNull();
    expect(stopRead(shot({ measurements: [m('preinfusion'), m('pouring'), m('idle')] }))).toBeNull();
  });
});

const read = (id: string, drip: number, flow: number, landed = 36.5): StopRead => ({ id, landed, target: 36, drip, flow });

describe('suggestLookAhead', () => {
  it('needs three shots', () => {
    expect(suggestLookAhead([read('a', 2, 2), read('b', 2, 2)])).toBeNull();
  });
  it('takes the median drip time, so one odd shot is ignored', () => {
    const s = suggestLookAhead([read('a', 2.4, 2), read('b', 2.6, 2), read('c', 9, 2)]);
    expect(s).toEqual({ lookAhead: 1.3, averageOff: 0.5, shots: 3 });
  });
  it('clamps to 0–5', () => {
    expect(suggestLookAhead([read('a', 30, 1), read('b', 30, 1), read('c', 30, 1)])!.lookAhead).toBe(5);
  });
  it('words', () => {
    expect(landingText({ lookAhead: 1, averageOff: 0.1, shots: 4 })).toMatch(/right on target/);
    expect(landingText({ lookAhead: 1, averageOff: -0.8, shots: 4 })).toBe('Your last 4 shots landed 0.8 g light on average.');
  });
});

describe('reads list', () => {
  it('keeps newest first, no repeats, at most 8', () => {
    let list: StopRead[] = [];
    for (let i = 0; i < 10; i++) list = addRead(list, read(`s${i}`, 1, 1));
    list = addRead(list, read('s9', 2, 1));
    expect(list.length).toBe(8);
    expect(list[0]).toMatchObject({ id: 's9', drip: 2 });
    expect(list.filter((r) => r.id === 's9').length).toBe(1);
  });
  it('parses junk safely', () => {
    expect(parseReads(null)).toEqual([]);
    expect(parseReads([{ id: 'x', landed: 1, target: 1, drip: 1, flow: 1 }, { id: 2 }])).toHaveLength(1);
  });
});
