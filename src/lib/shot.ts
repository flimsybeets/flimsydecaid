import type { MachineSnapshot, ScaleWeightFrame, ShotMeasurement } from '../api/types';

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

const RECORDING = new Set<string>(['preinfusion', 'pouring']);
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

    this.samples.push(toSample(frame, this.lastWeight, (nowMs - this.startMs) / 1000));
    return true;
  }
}

// The machine zeroes the inactive pump target; break the line instead of drawing 0.
const activeTarget = (pump: number | undefined) => (pump === 0 ? undefined : pump);

function toSample(frame: MachineSnapshot, scale: ScaleWeightFrame | null | undefined, t: number): ShotSample {
  return {
    t,
    pressure: frame.pressure,
    flow: frame.flow,
    targetPressure: activeTarget(frame.targetPressure),
    targetFlow: activeTarget(frame.targetFlow),
    waterTemp: frame.mixTemperature,
    puckTemp: frame.groupTemperature,
    targetWaterTemp: frame.targetMixTemperature,
    targetPuckTemp: frame.targetGroupTemperature,
    weight: scale?.weight,
    weightFlow: scale?.weightFlow,
    frame: frame.profileFrame,
  };
}

/**
 * Turn a saved shot's measurements into graph samples, trimmed the same way
 * as the live graph: preinfusion and pouring only, time zero at the first of
 * those. Recordings without substates are kept whole. Time comes from the
 * machine timestamps, falling back to 10 Hz when they're missing or bad.
 */
export function samplesFromMeasurements(measurements: readonly ShotMeasurement[]): ShotSample[] {
  const hasSubstates = measurements.some((m) => m.machine?.state?.substate !== undefined);
  const kept = measurements.filter((m) => {
    if (!m.machine) return false;
    return !hasSubstates || RECORDING.has(m.machine.state?.substate ?? '');
  });
  const stamps = kept.map((m) => (m.machine.timestamp ? Date.parse(m.machine.timestamp) : NaN));
  const useStamps = stamps.length > 0 && stamps.every(Number.isFinite);
  const t0 = useStamps ? stamps[0]! : 0;
  return kept.slice(0, MAX_SAMPLES).map((m, i) =>
    toSample(m.machine, m.scale, useStamps ? (stamps[i]! - t0) / 1000 : i / 10),
  );
}
