import { describe, expect, it } from 'vitest';
import { parseTheme } from '../src/lib/theme';

describe('parseTheme', () => {
  it('treats a missing key as off', () => {
    expect(parseTheme(null)).toEqual({ halloween: false, clock: true });
    expect(parseTheme(undefined)).toEqual({ halloween: false, clock: true });
  });
  it('reads halloween only when exactly true', () => {
    expect(parseTheme({ halloween: true })).toEqual({ halloween: true, clock: true });
    expect(parseTheme({ halloween: 'yes' })).toEqual({ halloween: false, clock: true });
    expect(parseTheme({})).toEqual({ halloween: false, clock: true });
  });
  it('keeps the clock on unless it was turned off', () => {
    expect(parseTheme({ clock: false }).clock).toBe(false);
    expect(parseTheme({ clock: 'no' }).clock).toBe(true);
  });
  it('ignores non-objects', () => {
    expect(parseTheme(true)).toEqual({ halloween: false, clock: true });
    expect(parseTheme([true])).toEqual({ halloween: false, clock: true });
  });
});
