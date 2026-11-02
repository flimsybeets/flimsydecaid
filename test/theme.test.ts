import { describe, expect, it } from 'vitest';
import { parseTheme } from '../src/lib/theme';

describe('parseTheme', () => {
  it('treats a missing key as off', () => {
    expect(parseTheme(null)).toEqual({ halloween: false, clock: true, tilePreview: 'shot', bgTone: -45, panelTint: 'dark' });
    expect(parseTheme(undefined)).toEqual({ halloween: false, clock: true, tilePreview: 'shot', bgTone: -45, panelTint: 'dark' });
  });
  it('reads halloween only when exactly true', () => {
    expect(parseTheme({ halloween: true })).toEqual({ halloween: true, clock: true, tilePreview: 'shot', bgTone: -45, panelTint: 'dark' });
    expect(parseTheme({ halloween: 'yes' })).toEqual({ halloween: false, clock: true, tilePreview: 'shot', bgTone: -45, panelTint: 'dark' });
    expect(parseTheme({})).toEqual({ halloween: false, clock: true, tilePreview: 'shot', bgTone: -45, panelTint: 'dark' });
  });
  it('keeps the clock on unless it was turned off', () => {
    expect(parseTheme({ clock: false }).clock).toBe(false);
    expect(parseTheme({ clock: 'no' }).clock).toBe(true);
  });
  it('reads the panel tint, defaulting to dark', () => {
    expect(parseTheme({ panelTint: 'plum' }).panelTint).toBe('plum');
    expect(parseTheme({ panelTint: 'pink' }).panelTint).toBe('dark');
  });
  it('ignores non-objects', () => {
    expect(parseTheme(true)).toEqual({ halloween: false, clock: true, tilePreview: 'shot', bgTone: -45, panelTint: 'dark' });
    expect(parseTheme([true])).toEqual({ halloween: false, clock: true, tilePreview: 'shot', bgTone: -45, panelTint: 'dark' });
  });
});
