import { describe, expect, it } from 'vitest';
import type { ShotMeasurement } from '../src/api/types';
import { samplesFromMeasurements } from '../src/lib/shot';
import { dayLabel, groupByDay, ratioText, shotStats, stopReasonText } from '../src/lib/history';

const m = (ms: number, substate: string | undefined, extra: Partial<ShotMeasurement['machine']> = {}, weight?: number): ShotMeasurement => ({
  machine: {
    timestamp: new Date(Date.UTC(2026, 9, 25, 9, 0, 0, ms)).toISOString(),
    state: { state: 'espresso', substate: substate as never },
    pressure: 6, flow: 2, targetPressure: 0, targetFlow: 2, ...extra,
  },
  scale: weight === undefined ? null : { weight },
});

describe('saved shot measurements', () => {
  it('keeps preinfusion and pouring, timed from the first of them', () => {
    const samples = samplesFromMeasurements([
      m(0, 'preparingForShot'),
      m(500, 'preinfusion', {}, 0),
      m(1500, 'pouring', {}, 4.2),
      m(2000, 'pouringDone', {}, 5),
    ]);
    expect(samples.map((s) => s.t)).toEqual([0, 1]);
    expect(samples[1]).toMatchObject({ weight: 4.2, targetPressure: undefined, targetFlow: 2 });
  });

  it('keeps everything when there are no substates, and falls back to 10 Hz without timestamps', () => {
    const plain = (w: number): ShotMeasurement => ({ machine: { pressure: 1 }, scale: { weight: w } });
    const samples = samplesFromMeasurements([plain(0), plain(1), plain(2)]);
    expect(samples.map((s) => s.t)).toEqual([0, 0.1, 0.2]);
  });

  it('handles an empty recording', () => {
    expect(samplesFromMeasurements([])).toEqual([]);
  });
});

describe('history display', () => {
  it('formats a brew ratio', () => {
    expect(ratioText(18, 36)).toBe('1:2.0');
    expect(ratioText(18, 45.5)).toBe('1:2.5');
    expect(ratioText(null, 36)).toBeNull();
    expect(ratioText(18, 0)).toBeNull();
  });

  it('labels recent days in plain words', () => {
    const now = new Date(2026, 9, 25, 9, 0);
    expect(dayLabel(new Date(2026, 9, 25, 7, 0).toISOString(), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 9, 24, 23, 30).toISOString(), now)).toBe('Yesterday');
    expect(dayLabel('not a date', now)).toBe('Unknown date');
  });

  it('groups consecutive shots by day', () => {
    const now = new Date(2026, 9, 25, 12, 0);
    const at = (d: number, h: number) => ({ timestamp: new Date(2026, 9, d, h).toISOString() });
    const groups = groupByDay([at(25, 9), at(25, 8), at(24, 9)], now);
    expect(groups.map((g) => [g.label, g.shots.length])).toEqual([['Today', 2], ['Yesterday', 1]]);
  });

  it('only names stop reasons it knows', () => {
    expect(stopReasonText('targetWeight')).toBe('Stopped at weight');
    expect(stopReasonText('somethingNew')).toBeNull();
    expect(stopReasonText(null)).toBeNull();
  });

  it('summarises a shot from its samples', () => {
    expect(shotStats([{ t: 0, pressure: 2, weight: 0 }, { t: 28.4, pressure: 8.9, weight: 36.1 }, { t: 29, pressure: 3 }]))
      .toEqual({ seconds: 29, weight: 36.1, peakPressure: 8.9 });
    expect(shotStats([])).toEqual({ seconds: 0, weight: null, peakPressure: null });
  });
});
