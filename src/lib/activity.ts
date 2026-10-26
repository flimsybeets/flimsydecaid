// Full-screen views for what the machine is doing besides pouring a shot:
// getting ready for one (the group-head brew button was pressed, the shot is
// not pouring yet), flushing, and steaming. They follow the machine's own
// state, so they appear when the group head or machine buttons are used and
// close by themselves when the machine leaves the state.

import type { MachineState } from '../api/types';

export type ActivityKind = 'flush' | 'steam';

/**
 * Which flush / steam view to show. While Guide me is open its rinse step
 * has its own screen and follows the flush, so only steam is shown over it.
 */
export function activityKind(state: MachineState | undefined, guiding: boolean): ActivityKind | null {
  if (state === 'steam') return 'steam';
  if (state === 'flush' && !guiding) return 'flush';
  return null;
}

/**
 * Espresso state, but the shot is not pouring yet (substate preparingForShot,
 * or any substate before preinfusion). The shot recorder is not running then.
 */
export function isPreparing(state: MachineState | undefined, shotActive: boolean): boolean {
  return state === 'espresso' && !shotActive;
}

/** Substates where the machine has finished heating and the shot is under way. */
const STARTING = new Set(['preinfusion', 'pouring']);

/** Within this of the target the puck counts as up to temperature. */
export const NEAR_TARGET = 1.5;

/**
 * The big line while the machine gets ready to pour: how far the puck still
 * has to heat, then "Almost there", then "Starting" once it moves on.
 */
export function preheatText(group: number | undefined, target: number | undefined, substate?: string): string {
  if (substate && STARTING.has(substate)) return 'Starting';
  if (group === undefined || !target) return 'Heating up';
  const gap = target - group;
  return gap > NEAR_TARGET ? `Heating up · ${gap.toFixed(1)}° to go` : 'Almost there';
}

/** Puck reading is at temperature (shown green). */
export function atTemp(value: number | undefined, target: number | undefined): boolean {
  return value !== undefined && !!target && Math.abs(target - value) <= NEAR_TARGET;
}

/** m:ss for an elapsed or planned time. */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 0–1 of the planned duration used, or null when no duration is known. */
export function progress(elapsed: number, duration: number | undefined | null): number | null {
  if (!duration || duration <= 0) return null;
  return Math.min(1, Math.max(0, elapsed / duration));
}
