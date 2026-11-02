import { describe, expect, it } from 'vitest';
import { wispLayout, wispsEnd } from '../src/lib/wisps';

describe('wispLayout', () => {
  it('is deterministic and spread across the width', () => {
    const a = wispLayout(6, 'rise');
    expect(wispLayout(6, 'rise')).toEqual(a);
    expect(a).toHaveLength(6);
    const xs = a.map((w) => w.x);
    expect([...xs].sort((p, q) => p - q)).toEqual(xs);
    expect(xs[0]).toBeLessThan(25);
    expect(xs[5]).toBeGreaterThan(75);
  });
  it('staggers starts within 0-400 ms and ends inside the sleep animation', () => {
    const a = wispLayout(6, 'rise');
    for (const w of a) { expect(w.delay).toBeGreaterThanOrEqual(0); expect(w.delay).toBeLessThanOrEqual(400); }
    expect(wispsEnd(a)).toBeLessThanOrEqual(1500);
  });
  it('differs between modes', () => {
    expect(wispLayout(4, 'clear')).not.toEqual(wispLayout(4, 'rise'));
  });
});
