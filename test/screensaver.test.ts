import { describe, expect, it } from 'vitest';
import { clockText, fitDataUrl, SCREENSAVER_ATTEMPTS } from '../src/lib/screensaver';

describe('screensaver clock', () => {
  const evening = new Date(2026, 9, 25, 21, 7);

  it('shows hours and minutes without AM/PM', () => {
    expect(clockText(evening, 'en-US', true)).toBe('9:07');
    expect(clockText(new Date(2026, 9, 25, 9, 41), 'en-US', true)).toBe('9:41');
  });

  it('follows 24-hour time', () => {
    expect(clockText(evening, 'en-GB', false)).toBe('21:07');
  });
});

describe('fitting the photo in the store', () => {
  it('keeps the sharpest version that fits', async () => {
    const tried: number[][] = [];
    const url = await fitDataUrl(async (edge, q) => { tried.push([edge, q]); return 'x'.repeat(edge * q > 1300 ? 2000 : 500); }, 1000);
    expect(url).toHaveLength(500);
    expect(tried.length).toBeGreaterThan(1);
    expect(tried[0]).toEqual([...SCREENSAVER_ATTEMPTS[0]!]);
  });

  it('takes the first attempt when it already fits', async () => {
    let calls = 0;
    await fitDataUrl(async () => { calls++; return 'small'; }, 1000);
    expect(calls).toBe(1);
  });

  it('gives up with a plain message when nothing fits', async () => {
    await expect(fitDataUrl(async () => 'x'.repeat(5000), 1000)).rejects.toThrow('too large');
  });
});
