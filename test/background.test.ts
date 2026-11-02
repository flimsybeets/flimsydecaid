import { describe, expect, it } from 'vitest';
import { clampTone, parseTone, toneLabel, toneOverlay, DEFAULT_TONE } from '../src/lib/background';

describe('app background tone', () => {
  it('darkens with black; old lighten values read as no darkening', () => {
    expect(toneOverlay(-40)).toBe('rgb(0 0 0 / 0.40)');
    expect(toneOverlay(25)).toBe('rgb(0 0 0 / 0.00)');
    expect(toneOverlay(0)).toBe('rgb(0 0 0 / 0.00)');
  });
  it('clamps and parses', () => {
    expect(clampTone(-250)).toBe(-100);
    expect(clampTone(-12.6)).toBe(-13);
    expect(clampTone(12)).toBe(0);
    expect(parseTone('x')).toBe(DEFAULT_TONE);
    expect(parseTone(30)).toBe(0);
    expect(parseTone(-30)).toBe(-30);
  });
  it('labels the slider', () => {
    expect(toneLabel(0)).toBe('Not darkened');
    expect(toneLabel(-30)).toBe('30%');
  });
});
