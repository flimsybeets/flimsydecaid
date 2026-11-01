import { describe, expect, it } from 'vitest';
import { clampTone, parseTone, toneLabel, toneOverlay, DEFAULT_TONE } from '../src/lib/background';

describe('app background tone', () => {
  it('darkens with black below zero and lightens with white above', () => {
    expect(toneOverlay(-40)).toBe('rgb(0 0 0 / 0.40)');
    expect(toneOverlay(25)).toBe('rgb(255 255 255 / 0.25)');
    expect(toneOverlay(0)).toBe('rgb(255 255 255 / 0.00)');
  });
  it('clamps and parses', () => {
    expect(clampTone(-250)).toBe(-100);
    expect(clampTone(12.6)).toBe(13);
    expect(parseTone('x')).toBe(DEFAULT_TONE);
    expect(parseTone(30)).toBe(30);
  });
  it('labels the slider', () => {
    expect(toneLabel(0)).toBe('As is');
    expect(toneLabel(-30)).toBe('Darker 30%');
    expect(toneLabel(20)).toBe('Lighter 20%');
  });
});
