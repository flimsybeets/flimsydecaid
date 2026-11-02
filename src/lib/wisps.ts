// Steam / fog puffs for the screensaver's sleep / wake transition: a
// deterministic layout (no Math.random, so frames are reproducible and tests
// stable). Each puff is one big soft radial-gradient ellipse.

export type WispMode = 'rise' | 'clear';

export interface Puff {
  /** Centre, % of the width. */
  x: number;
  /** Starting centre, % of the height (below 100 = off the bottom edge). */
  y: number;
  /** Width, % of the screen width. */
  size: number;
  /** Height as a fraction of the width (0.6 wide, 1.4 tall). */
  aspect: number;
  /** Start delay in ms. */
  delay: number;
  /** Rise time in ms. */
  duration: number;
  /** Sideways drift, % of the puff's own width, signed. */
  drift: number;
  /** Rise, in puff heights (positive = up). */
  rise: number;
  /** Scale at the start and at the end. */
  s0: number;
  s1: number;
  /** Peak alpha of the gradient centre, 0–1. */
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

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * `count` puffs spread across the width (one per slot, jittered inside it),
 * with uneven sizes, delays and drift. 'rise' billows up from below the
 * bottom edge; 'clear' lifts from the middle and goes up and out.
 */
export function puffLayout(count: number, mode: WispMode, seed = 11): Puff[] {
  const r = rng(seed + (mode === 'clear' ? 101 : 0));
  const rise = mode === 'rise';
  const out: Puff[] = [];
  let step = Math.max(1, Math.round(count * 0.38));
  while (gcd(step, count) !== 1) step++;
  for (let i = 0; i < count; i++) {
    const slot = 100 / count;
    // Visit slots in a scrambled order so neighbours don't start together.
    const s = (i * step) % count;
    const size = 26 + r() * 34;
    const duration = Math.round((rise ? 950 : 900) + r() * (rise ? 450 : 400));
    out.push({
      x: r1(slot * (s + 0.1 + r() * 0.8)),
      y: r1(rise ? 62 + r() * 48 : 35 + r() * 55),
      size: r1(size),
      aspect: r1(0.6 + r() * 0.8),
      delay: Math.round(r() * (rise ? 380 : 260)),
      duration,
      drift: Math.round((r() * 40 + 8) * (r() < 0.5 ? -1 : 1)),
      rise: r1(0.5 + r() * 0.9),
      s0: r1(0.55 + r() * 0.25),
      s1: r1(1.5 + r() * 0.5),
      peak: Math.round((0.12 + r() * 0.16) * 100) / 100,
    });
  }
  return out;
}

/** When the last puff is done, ms. */
export function wispsEnd(w: Puff[]): number {
  return w.reduce((m, x) => Math.max(m, x.delay + x.duration), 0);
}
