// Which pump control the machine is using right now: pressure or flow.
// The machine zeroes the target of the pump it isn't using, so the snapshot's
// nonzero target is the primary source. The profile step's pump (from
// profileFrame) is the tiebreaker when both or neither target shows, and the
// last answer is held through brief gaps (step changes where both read 0).
// A change needs two agreeing frames so one odd frame can't flip the ring.
import type { ProfileStep } from '../api/types';

export type PumpMode = 'pressure' | 'flow';

export interface PumpInput {
  targetPressure?: number | null;
  targetFlow?: number | null;
  profileFrame?: number | null;
}

/** The pump of the profile step at `frame`, if that step exists. */
export function stepPump(steps: Pick<ProfileStep, 'pump'>[] | undefined, frame: number | null | undefined): PumpMode | null {
  if (!steps || frame == null || !Number.isInteger(frame) || frame < 0 || frame >= steps.length) return null;
  const p = steps[frame]!.pump;
  return p === 'pressure' || p === 'flow' ? p : null;
}

/** One frame's reading, before hysteresis: null = can't tell. */
export function readPump(i: PumpInput, step: PumpMode | null): PumpMode | null {
  const p = (i.targetPressure ?? 0) > 0, f = (i.targetFlow ?? 0) > 0;
  if (p && !f) return 'pressure';
  if (f && !p) return 'flow';
  return step; // both or neither: trust the profile step, else unknown
}

export class PumpTracker {
  mode: PumpMode | null = null;
  private pending: PumpMode | null = null;
  private seen = 0;

  constructor(private readonly confirm = 2) {}

  reset(): void { this.mode = null; this.pending = null; this.seen = 0; }

  update(i: PumpInput, steps?: Pick<ProfileStep, 'pump'>[]): PumpMode | null {
    const r = readPump(i, stepPump(steps, i.profileFrame));
    if (r === null || r === this.mode) { this.pending = null; this.seen = 0; return this.mode; }
    if (this.mode === null) { this.mode = r; return r; }
    if (r === this.pending) this.seen++; else { this.pending = r; this.seen = 1; }
    if (this.seen >= this.confirm) { this.mode = r; this.pending = null; this.seen = 0; }
    return this.mode;
  }
}
