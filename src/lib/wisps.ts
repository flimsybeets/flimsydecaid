// Steam wisps for the screensaver's sleep / wake transition: a deterministic
// layout (no Math.random, so frames are reproducible and tests stable).

export type WispMode = 'rise' | 'clear';

export interface Wisp {
  /** Centre, % of the width. */
  x: number;
  /** Start delay in ms. */
  delay: number;
  /** Rise time in ms. */
  duration: number;
  /** Sideways sway in % of the wisp's own width, signed (also sets the sway phase). */
  sway: number;
  /** Width of the ribbon, % of the screen width. */
  width: number;
  /** Mirror the S-curve. */
  flip: boolean;
  /** Peak opacity 0–1. */
  peak: number;
}

/** Small seeded generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `count` wisps spread across the width (one per slot, jittered inside it),
 * starting between 0 and `spread` ms apart.
 */
export function wispLayout(count: number, mode: WispMode, seed = 7): Wisp[] {
  const r = rng(seed + (mode === 'clear' ? 101 : 0));
  const rise = mode === 'rise';
  const spread = rise ? 400 : 250;
  const out: Wisp[] = [];
  for (let i = 0; i < count; i++) {
    const slot = 100 / count;
    out.push({
      x: Math.round((slot * (i + 0.15 + r() * 0.7)) * 10) / 10,
      delay: Math.round(count > 1 ? (((i * 5) % count) / (count - 1)) * spread * (0.7 + r() * 0.3) : 0),
      duration: Math.round((rise ? 900 : 750) + r() * 200),
      sway: Math.round((r() * 18 + 6) * (r() < 0.5 ? -1 : 1)),
      width: Math.round((rise ? 16 : 13) + r() * 6),
      flip: r() < 0.5,
      peak: Math.round((0.7 + r() * 0.3) * 100) / 100,
    });
  }
  return out;
}

/** When the last wisp is done, ms. */
export function wispsEnd(w: Wisp[]): number {
  return w.reduce((m, x) => Math.max(m, x.delay + x.duration), 0);
}
