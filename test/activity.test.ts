import { describe, expect, it } from 'vitest';
import { activityKind, atTemp, clockText, isPreparing, preheatText, progress } from '../src/lib/activity';

describe('activity views', () => {
  it('shows flush and steam from the machine state', () => {
    expect(activityKind('steam', false)).toBe('steam');
    expect(activityKind('flush', false)).toBe('flush');
    expect(activityKind('idle', false)).toBeNull();
    expect(activityKind(undefined, false)).toBeNull();
  });
  it('leaves flush to Guide me while it is open, but not steam', () => {
    expect(activityKind('flush', true)).toBeNull();
    expect(activityKind('steam', true)).toBe('steam');
  });
  it('is preparing in espresso until the shot records', () => {
    expect(isPreparing('espresso', false)).toBe(true);
    expect(isPreparing('espresso', true)).toBe(false);
    expect(isPreparing('idle', false)).toBe(false);
  });
  it('says preheating while the group is well under target', () => {
    expect(preheatText(90.4, 93)).toBe('Heating up · 2.6° to go');
    expect(preheatText(92.5, 93)).toBe('Almost there');
    expect(preheatText(undefined, 93)).toBe('Heating up');
    expect(preheatText(85, 93, 'preinfusion')).toBe('Starting');
    expect(atTemp(91.6, 93)).toBe(true);
    expect(atTemp(91.4, 93)).toBe(false);
    expect(atTemp(undefined, 93)).toBe(false);
  });
  it('formats time and progress', () => {
    expect(clockText(0)).toBe('0:00');
    expect(clockText(75.9)).toBe('1:15');
    expect(progress(5, 20)).toBe(0.25);
    expect(progress(30, 20)).toBe(1);
    expect(progress(5, 0)).toBeNull();
    expect(progress(5, undefined)).toBeNull();
  });
});
