import { describe, expect, it } from 'vitest';
import { parseTheme } from '../src/lib/theme';

describe('parseTheme', () => {
  it('treats a missing key as off', () => {
    expect(parseTheme(null)).toEqual({ halloween: false });
    expect(parseTheme(undefined)).toEqual({ halloween: false });
  });
  it('reads halloween only when exactly true', () => {
    expect(parseTheme({ halloween: true })).toEqual({ halloween: true });
    expect(parseTheme({ halloween: 'yes' })).toEqual({ halloween: false });
    expect(parseTheme({})).toEqual({ halloween: false });
  });
  it('ignores non-objects', () => {
    expect(parseTheme(true)).toEqual({ halloween: false });
    expect(parseTheme([true])).toEqual({ halloween: false });
  });
});
