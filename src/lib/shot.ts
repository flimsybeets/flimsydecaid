import type { MachineSnapshot, ScaleWeightFrame } from '../api/types';

/** One point on the shot graph. Seconds since the shot started. */
export interface ShotSample {
  t: number;
  pressure?: number;
  flow?: number;
  targetPressure?: number;
  targetFlow?: number;
  /** Water as it enters the group. */
  waterTemp?: number;
  /** Group head, the closest reading to the puck. */
  puckTemp?: number;
  targetWaterTemp?: number;
  targetPuckTemp?: number;
  weight?: number;
  weightFlow?: number;
  frame?: number;
}

const RECORDING = new Set(['preinfusion', 'pouring']);
const MAX_SAMPLES = 2400; // 4 minutes at 10 Hz

/**
 * Collects samples during an espresso pull. Only preinfusion and pouring are
 * graphed; recording stops at pouringDone so the post-shot drip doesn't
 * smear the end of the graph. Gateways without substates fall back to
 * recording for the whole espresso state.
 */
export class ShotRecorder {
  samples: ShotSample[] = [];
  private startMs: number | null = null;
  private lastWeight: ScaleWeightFrame | null = null;

  get active(): boolean { return this.startMs !== null; }

  reset(): void {
    this.samples = [];
    this.startMs = null;
  }

  onScale(frame: ScaleWeightFrame): void {
    this.lastWeight = frame;
  }

  /** Returns true when a sample was added. */
  onMachine(frame: MachineSnapshot, nowMs = Date.now()): boolean {
    const state = frame.state?.state;
    const sub = frame.state?.substate;
    const recording = state === 'espresso' && (sub === undefined ? true : RECORDING.has(sub));
    if (!recording) {
      if (state !== 'espresso') this.startMs = null;
      return false;
    }
    if (this.startMs === null) {
      this.samples = [];
      this.startMs = nowMs;
    }
    if (this.samples.length >= MAX_SAMPLES) return false;

    const disconnectedTarget = (pump: number | undefined) => (pump === 0 ? undefined : pump);
    this.samples.push({
      t: (nowMs - this.startMs) / 1000,
      pressure: frame.pressure,
      flow: frame.flow,
      // The machine zeroes the inactive pump target; break the line instead of drawing 0.
      targetPressure: disconnectedTarget(frame.targetPressure),
      targetFlow: disconnectedTarget(frame.targetFlow),
      waterTemp: frame.mixTemperature,
      puckTemp: frame.groupTemperature,
      targetWaterTemp: frame.targetMixTemperature,
      targetPuckTemp: frame.targetGroupTemperature,
      weight: this.lastWeight?.weight,
      weightFlow: this.lastWeight?.weightFlow,
      frame: frame.profileFrame,
    });
    return true;
  }
}
