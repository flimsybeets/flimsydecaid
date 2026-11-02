import { describe, expect, it } from 'vitest';
import { parseBagColours, vividColour } from '../src/lib/bagColour';

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
  it('ignores a few stray pixels', () => {
    expect(vividColour(image(2304, (i) => (i < 5 ? [230, 110, 30] : [120, 120, 120])))).toBeNull();
  });
});

describe('parseBagColours', () => {
  it('keeps hex strings and nulls, drops junk', () => {
    expect(parseBagColours({ a: '#D9653B', b: null, c: 'red', d: 4 })).toEqual({ a: '#d9653b', b: null });
    expect(parseBagColours(null)).toEqual({});
    expect(parseBagColours([1])).toEqual({});
  });
});
