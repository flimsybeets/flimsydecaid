import { describe, expect, it } from 'vitest';
import { parseTilePreview, planLines, shotLines } from '../src/lib/miniGraph';
import type { ProfileStep } from '../src/api/types';

const step = (pump: 'pressure' | 'flow', v: number, seconds: number): ProfileStep => ({
  name: 's', pump, transition: 'fast', seconds, temperature: 93, sensor: 'coffee',
  pressure: pump === 'pressure' ? v : 0, flow: pump === 'flow' ? v : 0, volume: 0, exit: null, limiter: null,
} as unknown as ProfileStep);

describe('tile mini graphs', () => {
  it('draws planned targets per pump, spanning the box', () => {
    const l = planLines([step('flow', 4, 10), step('pressure', 9, 20)]);
    expect(l.flow.startsWith('M0.0,')).toBe(true);
    expect(l.pressure).toMatch(/L100\.0,10\.0$/); // 9 bar of 12 → 10 from the top of 40
  });
  it('thins a shot and scales weight into the box', () => {
    const samples = Array.from({ length: 300 }, (_, i) => ({ t: i / 10, pressure: 9, flow: 2, weight: i / 10 }));
    const l = shotLines(samples, 60);
    expect((l.pressure.match(/[ML]/g) ?? []).length).toBeLessThanOrEqual(61);
    expect(l.weight).toMatch(/,0\.0$/); // heaviest point at the top
  });
  it('handles an empty shot and odd stored values', () => {
    expect(shotLines([])).toEqual({ pressure: '', flow: '' });
    expect(parseTilePreview('plan')).toBe('plan');
    expect(parseTilePreview(undefined)).toBe('shot');
  });
});
