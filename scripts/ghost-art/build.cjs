// Generates src/components/ghostFrames.ts: one low-poly ghost modelled in 3D,
// flat-shaded from a fixed light and projected orthographically at N yaw
// angles. No runtime 3D: the screensaver just shows one frame at a time.
//   node scripts/ghost-art/build.cjs            (npm run art:ghost)
const fs = require('fs');
const path = require('path');

const N = Number(process.env.GHOST_FRAMES || 24); // yaw frames around 360 degrees
const PITCH = 12; // camera looks slightly down
const S = 70; // px per model unit
const R = Math.PI / 180;

// ---------- vector helpers ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const centroid = (p) => [(p[0][0] + p[1][0] + p[2][0]) / 3, (p[0][1] + p[1][1] + p[2][1]) / 3, (p[0][2] + p[1][2] + p[2][2]) / 3];

// ---------- the model (+z is the way it faces) ----------
// Rings along a spine: [y, z, rx, rz]. The tail tapers back and curls up.
const SPINE = [
  [1.02, 0.1, 0.0, 0.0],
  [0.94, 0.1, 0.42, 0.4],
  [0.72, 0.12, 0.76, 0.72],
  [0.38, 0.1, 0.94, 0.86],
  [0.02, 0.02, 0.94, 0.8],
  [-0.34, -0.12, 0.8, 0.68],
  [-0.64, -0.42, 0.54, 0.48],
  [-0.88, -0.8, 0.32, 0.3],
  [-1.0, -1.2, 0.17, 0.17],
  [-0.95, -1.56, 0.08, 0.08],
  [-0.78, -1.86, 0, 0],
];
const SIDES = 10;
const ZSHIFT = 0.3; // spin about the body's middle, not its nose

// deterministic wobble so the facets are not a perfect lathe
const wob = (i, j) => 1 + 0.055 * Math.sin(i * 12.9898 + j * 78.233) * Math.cos(i * 3.7 + j * 1.3);

function bodyMesh() {
  const V = [];
  const rings = [];
  SPINE.forEach(([y, z, rx, rz], i) => {
    if (rx === 0) { rings.push([V.push([0, y, z - ZSHIFT]) - 1]); return; }
    const ring = [];
    for (let j = 0; j < SIDES; j++) {
      const a = ((j + 0.5) / SIDES) * 2 * Math.PI; // 0 = +z (front)
      const w = wob(i, j);
      ring.push(V.push([Math.sin(a) * rx * w, y + 0.03 * Math.sin(j * 2.1 + i), z - ZSHIFT + Math.cos(a) * rz * w]) - 1);
    }
    rings.push(ring);
  });
  const T = [];
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i], B = rings[i + 1];
    for (let j = 0; j < SIDES; j++) {
      const j2 = (j + 1) % SIDES;
      if (A.length === 1) T.push([A[0], B[j2], B[j]]);
      else if (B.length === 1) T.push([A[j], A[j2], B[0]]);
      else { T.push([A[j], A[j2], B[j2]]); T.push([A[j], B[j2], B[j]]); }
    }
  }
  return { V, T: T.map((t) => orient(V, t)) };
}
// face every triangle away from the spine
function orient(V, t) {
  const c = t.map((k) => V[k]);
  const n = cross(sub(c[1], c[0]), sub(c[2], c[0]));
  const m = centroid(c);
  let best = SPINE[0], bd = 1e9;
  for (const s of SPINE) { const d = Math.hypot(m[1] - s[0], m[2] + ZSHIFT - s[1]); if (d < bd) { bd = d; best = s; } }
  const o = [m[0], m[1] - best[0], m[2] - (best[1] - ZSHIFT)];
  return dot(n, o) >= 0 ? t : [t[0], t[2], t[1]];
}

// stubby pointed arm flap: base around the shoulder (inside the body), pointed tip
function armMesh(sx) {
  const base = [
    [sx * 0.74, 0.3, 0.15 - ZSHIFT],
    [sx * 0.8, -0.36, 0.3 - ZSHIFT],
    [sx * 0.74, -0.1, -0.35 - ZSHIFT],
    [sx * 0.82, 0.1, 0.7 - ZSHIFT],
  ];
  const tip = [sx * 1.45, -0.72, 0.45 - ZSHIFT];
  const V = [...base, tip];
  const c = [sx * 0.8, 0, 0.1 - ZSHIFT];
  const T = [[0, 3, 4], [3, 1, 4], [1, 2, 4], [2, 0, 4]].map((t) => {
    const p = t.map((k) => V[k]);
    return dot(cross(sub(p[1], p[0]), sub(p[2], p[0])), sub(centroid(p), c)) >= 0 ? t : [t[0], t[2], t[1]];
  });
  return { V, T };
}

const parts = [bodyMesh(), armMesh(1), armMesh(-1)];
const body = parts[0];

// ---------- dropping a point of the face onto the front facets ----------
function rayFront(x, y) {
  const o = [x, y, 6], d = [0, 0, -1];
  let best = null;
  for (const t of body.T) {
    const [a, b, c] = t.map((k) => body.V[k]);
    const e1 = sub(b, a), e2 = sub(c, a);
    const p = cross(d, e2);
    const det = dot(e1, p);
    if (Math.abs(det) < 1e-9) continue;
    const inv = 1 / det;
    const s = sub(o, a);
    const u = dot(s, p) * inv;
    if (u < 0 || u > 1) continue;
    const q = cross(s, e1);
    const v = dot(d, q) * inv;
    if (v < 0 || u + v > 1) continue;
    const tt = dot(e2, q) * inv;
    if (tt <= 0) continue;
    if (!best || tt < best.t) best = { t: tt, n: norm(cross(e1, e2)) };
  }
  if (!best) return null;
  const n = best.n[2] < 0 ? best.n.map((v) => -v) : best.n;
  const E = 0.02;
  return { p: [x + n[0] * E, y + n[1] * E, o[2] - best.t + n[2] * E], n };
}

// A decal is a 2D outline on the front plane; edges are subdivided so it follows the facets.
function decal(poly2, style, bias) {
  const pts = [];
  for (let i = 0; i < poly2.length; i++) {
    const a = poly2[i], b = poly2[(i + 1) % poly2.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.07));
    for (let k = 0; k < n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  const hits = pts.map(([x, y]) => rayFront(x, y)).filter(Boolean);
  if (hits.length < pts.length * 0.9) return null;
  const n = norm(hits.reduce((s, h) => [s[0] + h.n[0], s[1] + h.n[1], s[2] + h.n[2]], [0, 0, 0]));
  return { P: hits.map((h) => h.p), n, style, bias };
}

const ell = (cx, cy, rx, ry, n = 16) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * 2 * Math.PI;
  return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
});

function faceDecals() {
  const D = [];
  const EY = 0.3, EX = 0.3;
  for (const s of [-1, 1]) {
    // angry brow: outer end high, inner end low
    D.push(decal([[s * 0.7, 0.72], [s * 0.52, 0.76], [s * 0.1, 0.56], [s * 0.07, 0.46], [s * 0.3, 0.52], [s * 0.62, 0.6]], { fill: '#5f86b0', stroke: '#24385c', sw: 2.2 }, 0.34));
    D.push(decal(ell(s * EX, EY, 0.2, 0.285, 18), { fill: '#141b48' }, 0.32));
    D.push(decal(ell(s * EX, EY, 0.15, 0.235, 18), { fill: '#1a4bf5' }, 0.33));
    D.push(decal(ell(s * EX - 0.045, EY + 0.1, 0.048, 0.088, 10), { fill: '#d4e0ff' }, 0.35));
  }
  // wide grin with fangs
  const W = 0.62, top = [], bot = [];
  for (let i = 0; i <= 12; i++) {
    const x = -W + (2 * W * i) / 12, u = 1 - (x / W) ** 2;
    top.push([x, -0.04 - 0.12 * u]);
  }
  for (let i = 12; i >= 0; i--) {
    const x = -W + (2 * W * i) / 12, u = 1 - (x / W) ** 2;
    bot.push([x * 0.94, -0.06 - 0.36 * Math.pow(u, 0.75)]);
  }
  D.push(decal([...top, ...bot], { fill: '#b01c2e', stroke: '#46091a', sw: 2.6 }, 0.34));
  D.push(decal(ell(0.02, -0.33, 0.26, 0.07, 12), { fill: '#ee6f7e' }, 0.36));
  for (const fx of [-0.4, -0.19, 0.19, 0.4]) {
    const y0 = -0.04 - 0.12 * (1 - (fx / W) ** 2);
    D.push(decal([[fx - 0.06, y0], [fx + 0.06, y0 - 0.005], [fx, y0 - 0.16]], { fill: '#ffffff' }, 0.37));
  }
  return D.filter(Boolean);
}
const decals = faceDecals();

// ---------- shading: white (lit) to lavender (shade), flat per facet ----------
const LIGHT = norm([-0.45, 0.75, 0.55]); // view space: upper left, in front
const PAL = [[122, 116, 210], [186, 182, 243], [255, 255, 255]];
const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const LEVELS = 14;
const shade = (nv) => {
  const l = Math.max(0, dot(nv, LIGHT));
  const t = Math.min(1, 0.12 + 0.95 * l + 0.1 * Math.max(0, nv[2]));
  const q = Math.round(t * (LEVELS - 1));
  const tq = q / (LEVELS - 1);
  return { q, color: hex(tq < 0.55 ? mixc(PAL[0], PAL[1], tq / 0.55) : mixc(PAL[1], PAL[2], (tq - 0.55) / 0.45)) };
};

// ---------- projection: yaw about y, then pitch, orthographic ----------
function frame(k) {
  const yaw = (k / N) * 360 * R;
  const ca = Math.cos(yaw), sa = Math.sin(yaw), cp = Math.cos(PITCH * R), sp = Math.sin(PITCH * R);
  // view-space x right, y up, z towards the viewer
  const view = (p) => {
    const xr = p[0] * ca + p[2] * sa, zr = -p[0] * sa + p[2] * ca;
    return [xr, p[1] * cp - zr * sp, zr * cp + p[1] * sp];
  };
  const scr = (v) => [v[0] * S, -v[1] * S];
  const items = [];
  for (const m of parts) {
    const VV = m.V.map(view);
    for (const t of m.T) {
      const p = t.map((i) => VV[i]);
      const n = norm(cross(sub(p[1], p[0]), sub(p[2], p[0])));
      if (n[2] <= 0.0001) continue; // back-face
      items.push({ depth: centroid(p)[2], pts: p.map(scr), sh: shade(n) });
    }
  }
  for (const d of decals) {
    if (view(d.n)[2] < 0.12) continue; // facing away: the face is hidden
    const VV = d.P.map(view);
    items.push({ depth: VV.reduce((s, p) => s + p[2], 0) / VV.length + d.bias, pts: VV.map(scr), decal: d.style });
  }
  return items.sort((a, b) => a.depth - b.depth);
}

const all = Array.from({ length: N }, (_, k) => frame(k));
let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
for (const f of all) for (const it of f) for (const [x, y] of it.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
const PAD = 4;
const cx = Math.round((x0 + x1) / 2), cy = Math.round((y0 + y1) / 2);
const hw = Math.ceil(Math.max(x1 - cx, cx - x0)) + PAD, hh = Math.ceil(Math.max(y1 - cy, cy - y0)) + PAD;
const VB = `${cx - hw} ${cy - hh} ${hw * 2} ${hh * 2}`;

const f1 = (n) => (Math.round(n * 10) / 10).toString();
const pd = (pts) => 'M' + pts.map(([x, y]) => f1(x) + ' ' + f1(y)).join('L') + 'Z';

const used = new Map();
const symbols = all.map((items, k) => {
  let out = '', group = '', last = -1;
  const flush = () => { if (group) out += `<g class="gh${last}">${group}</g>`; group = ''; };
  for (const it of items) {
    if (it.decal) {
      flush(); last = -1;
      const s = it.decal;
      out += `<path d="${pd(it.pts)}" fill="${s.fill}"${s.stroke ? ` stroke="${s.stroke}" stroke-width="${s.sw}"` : ''}/>`;
    } else {
      if (it.sh.q !== last) { flush(); last = it.sh.q; }
      used.set(it.sh.q, it.sh.color);
      group += `<path d="${pd(it.pts)}"/>`;
    }
  }
  flush();
  return `<symbol id="gf${k}" viewBox="${VB}"><g stroke-linejoin="round" stroke-width="1.1">${out}</g></symbol>`;
});
const styles = [...used].sort((a, b) => a[0] - b[0]).map(([q, c]) => `.gh${q}{fill:${c};stroke:${c}}`).join('');

const [, , vw, vh] = VB.split(' ').map(Number);
const ts = `// Generated by scripts/ghost-art/build.cjs. Do not edit by hand.
// One low-poly ghost, flat-shaded and projected at ${N} yaw angles (frame 0 faces the viewer,
// then it turns towards its right). Show frame k with <use href="#gf{k}">.

export const GHOST_FRAMES = ${N};
/** Width / height of every frame. */
export const GHOST_ASPECT = ${(vw / vh).toFixed(4)};

/** Hidden-SVG markup: a <style> plus one <symbol id="gf{k}"> per frame. */
export const GHOST_DEFS = ${JSON.stringify(`<style>${styles}</style>` + symbols.join(''))};
`;
fs.writeFileSync(path.join(__dirname, '../../src/components/ghostFrames.ts'), ts);
console.log(`ghostFrames.ts: ${N} frames, ${(ts.length / 1024).toFixed(0)} KB, viewBox ${VB}`);
