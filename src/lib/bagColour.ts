// A bag's colour: the most saturated prominent colour of its photo, nudged so
// it reads on the dark teal UI. The caller draws the photo small (e.g. 48x48)
// on a canvas and passes the RGBA pixels; this stays free of the DOM.
// Colours live in the KV store as one document { [batchId]: '#rrggbb' | null }
// (null = computed, nothing vivid in the photo).

export const BAG_COLOURS_KEY = 'bagColours';
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

const BINS = 24;
const MIN_SAT = 0.3;
const MIN_VAL = 0.25;
const MAX_VAL = 0.97;

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, max === 0 ? 0 : d / max, max / 255];
}

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
  const hex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** The photo's most vivid prominent colour as '#rrggbb', or null when nothing in it qualifies (grey, black or white bags). */
export function vividColour(rgba: Uint8ClampedArray): string | null {
  const weight = new Array<number>(BINS).fill(0);
  const sum = Array.from({ length: BINS }, () => [0, 0, 0, 0]); // r, g, b (weighted), weight
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3]! < 128) continue;
    const r = rgba[i]!, g = rgba[i + 1]!, b = rgba[i + 2]!;
    const [h, s, v] = rgbToHsv(r, g, b);
    if (s < MIN_SAT || v < MIN_VAL || v > MAX_VAL) continue;
    const bin = Math.min(BINS - 1, Math.floor((h / 360) * BINS));
    const w = s * v;
    weight[bin]! += w;
    const a = sum[bin]!;
    a[0]! += r * w; a[1]! += g * w; a[2]! += b * w; a[3]! += w;
  }
  // Smooth over neighbouring bins so a hue that straddles a bin edge isn't split.
  let best = -1;
  let bestW = 0;
  for (let k = 0; k < BINS; k++) {
    const w = weight[k]! + 0.5 * (weight[(k + 1) % BINS]! + weight[(k + BINS - 1) % BINS]!);
    if (w > bestW) { bestW = w; best = k; }
  }
  // Too few qualifying pixels (under ~1.5% of a 48x48 picture) is noise, not a colour.
  if (best < 0 || weight[best]! < (rgba.length / 4) * 0.015 * 0.3) return null;
  const a = sum[best]!;
  const [h, s, l] = rgbToHsl(a[0]! / a[3]!, a[1]! / a[3]!, a[2]! / a[3]!);
  return hslToHex(h, Math.max(s, 0.55), Math.min(0.68, Math.max(0.5, l)));
}
