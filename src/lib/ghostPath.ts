// Halloween screensaver ghosts: where each one is, which way it faces and how
// visible it is at time t. Pure maths; the component only applies the result
// (a transform, an opacity and which pre-rendered yaw frame to show).
//
// Yaw is degrees, 0 = facing the viewer, 90 = facing right, 270 = facing left.

export type GhostEventKind = 'spin' | 'face';

export interface GhostEvent {
  kind: GhostEventKind;
  /** Start, as a fraction of the ghost's cycle. */
  at: number;
  /** Seconds. */
  dur: number;
}

export interface GhostSpec {
  /** Width in px. */
  size: number;
  /** Home position, % of the screen. */
  left: number;
  top: number;
  /** One fade in / wander / fade out cycle, seconds. */
  cycle: number;
  /** Time offset so the ghosts are not in step, seconds. */
  offset: number;
  /** Wander: amplitude (vw / vh), period (s) and phase (radians), per axis. */
  ax: number;
  ay: number;
  px: number;
  py: number;
  phx: number;
  phy: number;
  /** Gentle vertical bob, period in seconds. */
  bob: number;
  events: GhostEvent[];
}

export interface GhostPose {
  /** Offset from home in vw / vh. */
  x: number;
  y: number;
  /** Bob in -1..1 (bigger swing while it faces the viewer). */
  bob: number;
  /** Degrees, 0 to 360. */
  yaw: number;
  /** Which pre-rendered frame shows this yaw. */
  frame: number;
  /** Lean into the direction of travel, degrees. */
  roll: number;
  opacity: number;
}

export const MAX_OPACITY = 0.92;

const TAU = Math.PI * 2;
const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/** 0 to 1 over the cycle: fade in, hold, fade out, then unseen for the rest. */
export function ghostOpacity(phase: number): number {
  const p = phase - Math.floor(phase);
  if (p < 0.1) return MAX_OPACITY * smooth(p / 0.1);
  if (p < 0.62) return MAX_OPACITY;
  if (p < 0.74) return MAX_OPACITY * (1 - smooth((p - 0.62) / 0.12));
  return 0;
}

/** Frame index for a yaw in degrees, with `frames` frames around 360. */
export function yawFrame(yaw: number, frames: number): number {
  const f = Math.round((((yaw % 360) + 360) % 360) / (360 / frames));
  return f % frames;
}

export function ghostPose(g: GhostSpec, t: number, frames: number): GhostPose {
  const tt = t + g.offset;
  const wx = (TAU * tt) / g.px + g.phx;
  const x = g.ax * Math.sin(wx);
  const y = g.ay * Math.sin((TAU * tt) / g.py + g.phy);
  const vx = ((g.ax * TAU) / g.px) * Math.cos(wx); // vw per second
  const vmax = (g.ax * TAU) / g.px;

  // Side-on while moving, swinging through the front as it reverses.
  let yaw = vmax ? 90 * Math.tanh(vx / (0.3 * vmax)) : 0;

  const cyc = tt / g.cycle;
  const phase = cyc - Math.floor(cyc);
  const sec = phase * g.cycle;
  let faceW = 0;
  for (const e of g.events) {
    const s = e.at * g.cycle;
    const k = sec - s;
    if (k < 0 || k > e.dur) continue;
    if (e.kind === 'spin') yaw += 360 * smooth(k / e.dur);
    else {
      // ease round to the viewer, hold with a bob, then ease away
      const ramp = Math.min(1.4, e.dur / 3);
      faceW = Math.max(faceW, smooth(k / ramp) * smooth((e.dur - k) / ramp));
    }
  }
  if (faceW > 0) {
    const base = ((yaw % 360) + 360) % 360;
    const signed = base > 180 ? base - 360 : base; // -180..180, so we turn the short way
    yaw = signed * (1 - faceW);
  }
  yaw = ((yaw % 360) + 360) % 360;

  const bob = Math.sin((TAU * tt) / g.bob) * (1 + 1.2 * faceW);
  return {
    x,
    y,
    bob,
    yaw,
    frame: yawFrame(yaw, frames),
    roll: vmax ? (vx / vmax) * 4 * (1 - faceW) : 0,
    opacity: ghostOpacity(phase),
  };
}

/** Four ghosts: different sizes, speeds and turns, so one or two show at a time. */
export const GHOSTS: GhostSpec[] = [
  { size: 300, left: 14, top: 18, cycle: 40, offset: 6, ax: 16, ay: 7, px: 15, py: 22, phx: 0, phy: 0.6, bob: 4.8, events: [{ kind: 'spin', at: 0.2, dur: 6 }, { kind: 'face', at: 0.45, dur: 5 }] },
  { size: 210, left: 60, top: 46, cycle: 34, offset: 20, ax: 18, ay: 6, px: 13, py: 19, phx: 2, phy: 1.9, bob: 4.1, events: [{ kind: 'face', at: 0.2, dur: 5 }, { kind: 'spin', at: 0.42, dur: 5.5 }] },
  { size: 360, left: 36, top: 30, cycle: 46, offset: 31, ax: 14, ay: 8, px: 18, py: 25, phx: 4, phy: 3.1, bob: 5.6, events: [{ kind: 'face', at: 0.18, dur: 6 }, { kind: 'face', at: 0.46, dur: 4 }] },
  { size: 170, left: 60, top: 10, cycle: 31, offset: 11, ax: 16, ay: 9, px: 12, py: 17, phx: 5, phy: 4.4, bob: 3.6, events: [{ kind: 'spin', at: 0.3, dur: 5 }] },
];
