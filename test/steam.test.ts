import { describe, expect, it } from 'vitest';

import { steamBlockedText, steamReadiness } from '../src/lib/steam';

describe('steam readiness', () => {
  const s = (t: number) => ({ targetTemperature: t, duration: 60, flow: 1.2 }) as never;
  it('is off, heating, then ready within 5° of the target', () => {
    expect(steamReadiness(undefined, 150)).toBe('off');
    expect(steamReadiness(s(0), 150)).toBe('off');
    expect(steamReadiness(s(150), undefined)).toBe('heating');
    expect(steamReadiness(s(150), 120)).toBe('heating');
    expect(steamReadiness(s(150), 145)).toBe('ready');
  });
  it('says why it cannot start', () => {
    expect(steamBlockedText('off', undefined, undefined)).toBe('Turn the steam heater on first.');
    expect(steamBlockedText('heating', s(150), 121.4)).toBe('The steam heater is warming up: 121° of 150°.');
    expect(steamBlockedText('ready', s(150), 150)).toBeNull();
  });
});
