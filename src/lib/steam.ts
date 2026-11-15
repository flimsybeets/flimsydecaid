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

/** Within this of the target the boiler counts as hot enough to steam (the bottom bar's "ready"). */
export const STEAM_READY_MARGIN_C = 5;

export type SteamReadiness = 'off' | 'heating' | 'ready';

/** Whether steam can usefully start now: the heater must be on (as saved) and the boiler near its target. */
export function steamReadiness(s: SteamSettings | undefined, boilerC: number | undefined): SteamReadiness {
  if (!heaterOn(s)) return 'off';
  return boilerC !== undefined && boilerC >= s!.targetTemperature - STEAM_READY_MARGIN_C ? 'ready' : 'heating';
}

/** Why Start steam isn't offered yet, in plain words, or null when it can start. */
export function steamBlockedText(r: SteamReadiness, s: SteamSettings | undefined, boilerC: number | undefined): string | null {
  if (r === 'off') return 'Turn the steam heater on first.';
  if (r === 'heating') return `The steam heater is warming up${boilerC !== undefined ? `: ${Math.round(boilerC)}° of ${s!.targetTemperature}°` : ''}.`;
  return null;
}
