import { describe, expect, it } from 'vitest';
import { colourChoices, parseBagColours, vividColour } from '../src/lib/bagColour';

function image(n: number, fill: (i: number) => [number, number, number]): Uint8ClampedArray {
  const px = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) px.set([...fill(i), 255], i * 4);
  return px;
}
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

describe('vividColour', () => {
  it('finds red in a solid red picture', () => {
    const [r, g, b] = rgb(vividColour(image(2304, () => [200, 20, 20]))!);
    expect(r).toBeGreaterThan(180);
    expect(g).toBeLessThan(100);
    expect(b).toBeLessThan(100);
  });
  it('is null for grey, black and white', () => {
    expect(vividColour(image(2304, () => [128, 128, 128]))).toBeNull();
    expect(vividColour(image(2304, () => [10, 10, 10]))).toBeNull();
    expect(vividColour(image(2304, () => [250, 250, 250]))).toBeNull();
  });
  it('picks the vivid orange patch out of a mostly grey picture', () => {
    const [r, g, b] = rgb(vividColour(image(2304, (i) => (i % 12 < 3 ? [230, 110, 30] : [120, 120, 120])))!);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(r).toBeGreaterThan(200);
  });
  it('lifts a dark colour so it reads on a dark UI', () => {
    const [r, g, b] = rgb(vividColour(image(2304, () => [60, 10, 90]))!);
    expect(Math.max(r, g, b)).toBeGreaterThan(150);
  });
  it('prefers a printed label over a bigger plain kraft bag', () => {
    // 64x64: kraft paper everywhere, a red label block in the middle (~9%).
    const [r, g, b] = rgb(vividColour(image(4096, (i) => {
      const x = i % 64, y = Math.floor(i / 64);
      return x >= 26 && x < 38 && y >= 26 && y < 56 ? [190, 35, 40] : [188, 152, 112];
    }))!);
    expect(r).toBeGreaterThan(150);
    expect(g).toBeLessThan(80);
    expect(b).toBeLessThan(80);
  });
  it('gives a plain kraft bag its tan, not a bright orange', () => {
    const [r, g, b] = rgb(vividColour(image(4096, (i) => (i % 64 < 12 ? [120, 85, 55] : [188, 152, 112])))!);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(r - b).toBeLessThan(110);
  });
  it('keeps a muted colour close to how it looks', () => {
    // A sage green bag: should stay sage, not turn neon.
    const [r, g, b] = rgb(vividColour(image(4096, () => [120, 150, 110]))!);
    expect(g).toBeGreaterThan(r);
    expect(g - Math.min(r, b)).toBeLessThan(90);
  });
  it('picks the big bag over a small bright thing in the corner', () => {
    // A blue bag in the middle, a small bright orange thing in a corner, grey around.
    const [r, , b] = rgb(vividColour(image(4096, (i) => {
      const x = i % 64, y = Math.floor(i / 64);
      if (Math.abs(x - 32) < 20 && Math.abs(y - 32) < 22) return [40, 90, 200];
      return x < 14 && y < 14 ? [235, 120, 30] : [110, 110, 110];
    }))!);
    expect(b).toBeGreaterThan(r);
  });
  it('ignores a few stray pixels', () => {
    expect(vividColour(image(2304, (i) => (i < 5 ? [230, 110, 30] : [120, 120, 120])))).toBeNull();
  });
});

describe('colourChoices', () => {
  it('offers the photo colours, the automatic pick first, no greys or near-duplicates', () => {
    const px = image(4096, (i) => {
      const x = i % 64, y = Math.floor(i / 64);
      if (x >= 26 && x < 38 && y >= 26 && y < 56) return [190, 35, 40];
      if (y < 8) return [40, 90, 200];
      if (y < 9) return [42, 92, 198];
      return x < 10 ? [120, 120, 120] : [188, 152, 112];
    });
    const c = colourChoices(px);
    expect(c[0]).toBe(vividColour(px));
    expect(c.length).toBeGreaterThanOrEqual(3);
    expect(c.length).toBeLessThanOrEqual(6);
    expect(new Set(c).size).toBe(c.length);
  });
  it('is empty for a grey picture', () => {
    expect(colourChoices(image(4096, () => [128, 128, 128]))).toEqual([]);
  });
});

describe('parseBagColours', () => {
  it('keeps hex strings and nulls, drops junk', () => {
    expect(parseBagColours({ a: '#D9653B', b: null, c: 'red', d: 4 })).toEqual({ a: '#d9653b', b: null });
    expect(parseBagColours(null)).toEqual({});
    expect(parseBagColours([1])).toEqual({});
  });
});
