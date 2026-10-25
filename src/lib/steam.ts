import type { SteamSettings } from '../api/types';

// The steam heater is switched by temperature: 0 turns it off, any value in
// the supported range turns it on. `duration` is only the maximum run time.

export const STEAM_MIN_C = 135;
export const STEAM_MAX_C = 160; // DE1. Bengle allows 165.
export const STEAM_DEFAULT_C = 150;
export const STEAM_FLOW_MIN = 0.4;
export const STEAM_FLOW_MAX = 2.5;

export const LAST_STEAM_TEMP_KEY = 'lastSteamTemp';

export function heaterOn(s: SteamSettings | undefined): boolean {
  return !!s && s.targetTemperature >= STEAM_MIN_C;
}

export function clampSteamTemp(c: number): number {
  return Math.min(STEAM_MAX_C, Math.max(STEAM_MIN_C, Math.round(c)));
}

export function clampSteamFlow(f: number): number {
  return Math.round(Math.min(STEAM_FLOW_MAX, Math.max(STEAM_FLOW_MIN, f)) * 10) / 10;
}
