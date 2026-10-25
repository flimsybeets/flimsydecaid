// Geometry for the round dials on the shot view. Angles are degrees
// clockwise from 12 o'clock; a dial sweeps SWEEP degrees centred on the top,
// leaving the bottom open for the digital readout, like a car's gauges.

export const SWEEP = 240;

/** Angle for a value, clamped to the dial so a reading off the scale pins the needle. */
export function valueToAngle(value: number, min: number, max: number, sweep = SWEEP): number {
  const f = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  return -sweep / 2 + f * sweep;
}

export function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

/** SVG path for a clockwise arc from a0 to a1. Empty when there is nothing to draw. */
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  if (a1 - a0 < 0.01) return '';
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${p0.x.toFixed(2)},${p0.y.toFixed(2)} A${r},${r} 0 ${large} 1 ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
}

/** Tick marks from min to max: a major (numbered) tick every `major`, split into `minor` steps. */
export function ticks(min: number, max: number, major: number, minor: number): { value: number; major: boolean }[] {
  const step = major / minor;
  const count = Math.round((max - min) / step);
  return Array.from({ length: count + 1 }, (_, i) => {
    const value = Math.round((min + i * step) * 1000) / 1000;
    return { value, major: i % minor === 0 };
  });
}

/**
 * Temperature dial range for a profile: covers every step temperature with
 * room either side, in 5° steps, at least 20° wide. Fixed for the whole
 * shot so the scale doesn't jump when a step changes temperature.
 */
export function tempDialRange(stepTemps: readonly number[]): [number, number] {
  const temps = stepTemps.filter((t) => Number.isFinite(t) && t > 0);
  if (temps.length === 0) return [80, 100];
  const lo = Math.floor((Math.min(...temps) - 6) / 5) * 5;
  const hi = Math.ceil((Math.max(...temps) + 6) / 5) * 5;
  return [lo, Math.max(hi, lo + 20)];
}
