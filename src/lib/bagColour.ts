// A bag's colour: the boldest colour patch in its photo that is big enough to
// matter, kept close to how it really looks (only lifted if too dark to see on
// the dark UI). The caller draws the photo small (64x64) on a canvas and
// passes the RGBA pixels; this stays free of the DOM.
//
// How: k-means groups the pixels into up to 10 colour patches (seeded from the
// busiest cells of a coarse colour histogram, so it's deterministic); pixels
// near the centre count more, since the crop puts the bag there. Each patch
// scores chroma (how far from grey, which, unlike HSV/HSL saturation, doesn't
// call dark browns or near-whites "saturated") × how usable its lightness is ×
// how big it is (square root up to 30% of the picture, so a big bag beats a
// small bright thing in the corner). Kraft paper, wood and hands are
// low-chroma, so a printed label beats them; a plain kraft bag gets its tan.
// Colours live in the KV store as one document { [batchId]: '#rrggbb' | null }
// (null = computed, nothing vivid in the photo).

/** v2: the first picker's colours were poor, so they are recomputed under a new key. */
export const BAG_COLOURS_KEY = 'bagColours2';
export type BagColours = Record<string, string | null>;

export function parseBagColours(raw: unknown): BagColours {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: BagColours = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === null) out[k] = null;
    else if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) out[k] = v.toLowerCase();
  }
  return out;
}

const K = 10;
const ITERATIONS = 8;
/** Patches smaller than this share of the (weighted) picture are ignored. */
const MIN_SHARE = 0.015;
/** A patch at least this big gets full credit for size (credit grows with the square root below it). */
const FULL_SHARE = 0.3;
/** A patch is grey, black or white (not a colour) below this chroma, or when its
 *  chroma is under this share of its brightness (so dark muted greens count). */
const MIN_CHROMA = 0.05;
const MIN_HSV_SAT = 0.15;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d + 6) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v: number) => Math.round(Math.min(1, Math.max(0, v + m)) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export interface Swatch { r: number; g: number; b: number; share: number }

/** The photo's main colour patches (k-means), biggest first. Pixels near the centre weigh more. */
export function swatches(rgba: Uint8ClampedArray): Swatch[] {
  const n = rgba.length / 4;
  const side = Math.round(Math.sqrt(n));
  const px: number[] = [];
  const wt: number[] = [];
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3]! < 128) continue;
    px.push(rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!);
    // Centre weighting: 1 in the middle, 0.35 in the corners.
    const x = side > 1 ? ((i % side) / (side - 1)) * 2 - 1 : 0;
    const y = side > 1 ? (Math.floor(i / side) / (side - 1)) * 2 - 1 : 0;
    wt.push(1 - 0.65 * Math.min(1, Math.hypot(x, y) / Math.SQRT2));
  }
  const m = wt.length;
  if (m === 0) return [];
  // Seeds: centres of the busiest cells of a 4x4x4 colour histogram.
  const cells = new Map<number, { w: number; r: number; g: number; b: number }>();
  for (let j = 0; j < m; j++) {
    const r = px[j * 3]!, g = px[j * 3 + 1]!, b = px[j * 3 + 2]!;
    const key = (r >> 6) * 16 + (g >> 6) * 4 + (b >> 6);
    const c = cells.get(key) ?? { w: 0, r: 0, g: 0, b: 0 };
    c.w += wt[j]!; c.r += r * wt[j]!; c.g += g * wt[j]!; c.b += b * wt[j]!;
    cells.set(key, c);
  }
  const seeds = [...cells.entries()].sort((a, b) => b[1].w - a[1].w || a[0] - b[0]).slice(0, K);
  let centres = seeds.map(([, c]) => [c.r / c.w, c.g / c.w, c.b / c.w]);
  const assign = new Int32Array(m);
  for (let it = 0; it < ITERATIONS; it++) {
    const acc = centres.map(() => [0, 0, 0, 0]);
    for (let j = 0; j < m; j++) {
      const r = px[j * 3]!, g = px[j * 3 + 1]!, b = px[j * 3 + 2]!;
      let best = 0, bestD = Infinity;
      for (let k = 0; k < centres.length; k++) {
        const c = centres[k]!;
        const d = (r - c[0]!) ** 2 + (g - c[1]!) ** 2 + (b - c[2]!) ** 2;
        if (d < bestD) { bestD = d; best = k; }
      }
      assign[j] = best;
      const a = acc[best]!;
      a[0]! += r * wt[j]!; a[1]! += g * wt[j]!; a[2]! += b * wt[j]!; a[3]! += wt[j]!;
    }
    centres = acc.map((a, k) => (a[3]! > 0 ? [a[0]! / a[3]!, a[1]! / a[3]!, a[2]! / a[3]!] : centres[k]!));
    if (it === ITERATIONS - 1) {
      const total = wt.reduce((s, w) => s + w, 0);
      return acc
        .map((a, k) => ({ r: centres[k]![0]!, g: centres[k]![1]!, b: centres[k]![2]!, share: a[3]! / total }))
        .filter((s) => s.share > 0)
        .sort((a, b) => b.share - a.share);
    }
  }
  return [];
}

/** How good a patch is as the bag's colour (0 = not a colour). */
export function swatchScore(s: Swatch): number {
  if (s.share < MIN_SHARE) return 0;
  const max = Math.max(s.r, s.g, s.b);
  const chroma = (max - Math.min(s.r, s.g, s.b)) / 255;
  if (chroma < MIN_CHROMA || chroma * 255 < MIN_HSV_SAT * max) return 0;
  const l = rgbToHsl(s.r, s.g, s.b)[2];
  const light = Math.max(0, 1 - Math.abs(l - 0.5) * 1.6);
  const size = Math.min(1, Math.sqrt(s.share / FULL_SHARE));
  return chroma * (0.4 + 0.6 * light) * (0.35 + 0.65 * size);
}

/** The colour to show for a swatch: true to the photo, lifted only if too dark (or dimmed if glaring) for the dark UI. */
export function displayColour(s: Swatch): string {
  const [h, sat, l] = rgbToHsl(s.r, s.g, s.b);
  return hslToHex(h, Math.min(1, Math.max(sat, 0.25)), Math.min(0.72, Math.max(0.48, l)));
}

/** The photo's bag colour as '#rrggbb', or null when nothing in it is a real colour (grey, black or white bags). */
export function vividColour(rgba: Uint8ClampedArray): string | null {
  let best: Swatch | null = null;
  let bestScore = 0;
  for (const s of swatches(rgba)) {
    const score = swatchScore(s);
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best ? displayColour(best) : null;
}

/** Colours to offer when picking a bag's colour by hand: the photo's real
 *  colour patches, best first (the first is what vividColour picks), with
 *  near-duplicates dropped. */
export function colourChoices(rgba: Uint8ClampedArray, max = 6): string[] {
  const ranked = swatches(rgba)
    .filter((s) => s.share >= MIN_SHARE / 2 && swatchScore({ ...s, share: Math.max(s.share, MIN_SHARE) }) > 0)
    .sort((a, b) => swatchScore(b) - swatchScore(a));
  const out: string[] = [];
  const seen: number[][] = [];
  for (const s of ranked) {
    if (seen.some((c) => Math.hypot(c[0]! - s.r, c[1]! - s.g, c[2]! - s.b) < 40)) continue;
    seen.push([s.r, s.g, s.b]);
    out.push(displayColour(s));
    if (out.length >= max) break;
  }
  return out;
}
