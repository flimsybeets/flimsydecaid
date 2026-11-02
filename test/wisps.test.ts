import { describe, expect, it } from 'vitest';
import { puffLayout, wispsEnd } from '../src/lib/wisps';

describe('puffLayout', () => {
  it('is deterministic and covers the width', () => {
    const a = puffLayout(15, 'rise');
    expect(puffLayout(15, 'rise')).toEqual(a);
    expect(a).toHaveLength(15);
    const xs = a.map((p) => p.x);
    expect(Math.min(...xs)).toBeLessThan(20);
    expect(Math.max(...xs)).toBeGreaterThan(80);
  });
  it('makes big, soft, varied puffs', () => {
    for (const mode of ['rise', 'clear'] as const) {
      const a = puffLayout(14, mode);
      for (const p of a) {
        expect(p.size).toBeGreaterThanOrEqual(25);
        expect(p.size).toBeLessThanOrEqual(60);
        expect(p.peak).toBeGreaterThanOrEqual(0.12);
        expect(p.peak).toBeLessThanOrEqual(0.28);
        expect(p.s1).toBeGreaterThanOrEqual(p.s0 + 0.8);
        expect(p.duration).toBeGreaterThanOrEqual(900);
      }
      expect(new Set(a.map((p) => p.duration)).size).toBeGreaterThan(5);
      expect(new Set(a.map((p) => p.delay)).size).toBeGreaterThan(5);
    }
  });
  it('ends inside the sleep animation', () => {
    expect(wispsEnd(puffLayout(15, 'rise'))).toBeLessThanOrEqual(1650);
    expect(wispsEnd(puffLayout(12, 'clear'))).toBeLessThanOrEqual(1400);
  });
  it('differs between modes', () => {
    expect(puffLayout(4, 'clear')).not.toEqual(puffLayout(4, 'rise'));
  });
});
