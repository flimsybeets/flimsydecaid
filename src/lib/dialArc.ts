// Grinder dial in the Guide me "dial" scene: 0 (fine) to 90 (coarse) over 300
// degrees, starting at -150 degrees. The generator (scripts/guide-art/objects.cjs
// dialFace) draws the glowing arc with pathLength="90" from 0 to 90 in the ring's
// own frame, so the dash length is simply the setting in dial units.
export const DIAL_MAX = 90;
export const DIAL_START = -150;
export const DIAL_SWEEP = 300;
export const DIAL_PER = DIAL_SWEEP / DIAL_MAX;

export interface DialArc {
  /** Setting, clamped to 0-90. */
  value: number;
  /** Angle of the setting on the ring, degrees from the dial's 12 o'clock. */
  angle: number;
  /** Ring rotation that puts the setting under the fixed pointer. */
  rotate: number;
  /** Arc length in dial units (path length 90), 0 to value. */
  dash: number;
}

/** Parses a grind setting ("14", "14.5", "Medium" is not a number). null = nothing to draw. */
export function parseGrind(grind: string | null | undefined): number | null {
  if (grind == null) return null;
  const n = parseFloat(grind);
  return Number.isFinite(n) ? n : null;
}

/** Arc geometry for a grind setting; null when there is no numeric setting. Values outside 0-90 are clamped. */
export function dialArc(grind: string | number | null | undefined): DialArc | null {
  const raw = typeof grind === 'number' ? grind : parseGrind(grind);
  if (raw == null || !Number.isFinite(raw)) return null;
  const value = Math.min(DIAL_MAX, Math.max(0, raw));
  const angle = DIAL_START + DIAL_PER * value;
  return { value, angle, rotate: -DIAL_START - DIAL_PER * value, dash: value };
}
