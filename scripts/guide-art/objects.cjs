// Shared objects for the Guide me scenes, modelled in millimetres.
const G = require('./geo.cjs');
const { convexLathe, Cam, ellD, frontArcD, backArcD, rbox, rrectTop, lathe, f, pt, crD, polyD, smoothClosedD, hull, revolve, tube, circ3, add3, norm3 } = G;
const PAPER = '238 243 239';
const circle = (c, r) => `M${f(c[0] - r)} ${f(c[1])}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const ellipseD = (cx, cy, rx, ry) => `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
const groundShadow = (S, cam, cx, cz, r, y = 0, k = 1.12) => { const e = cam.ell(cx + r * 0.08, y, cz + r * 0.1, r); S.shadow(ellD({ ...e, rx: e.rx * k, ry: e.ry * k * 1.15 })); };
const drop = (x, y, r) => `M${f(x)} ${f(y - r * 2.1)}C${f(x + r * 0.35)} ${f(y - r * 1.2)} ${f(x + r)} ${f(y - r * 0.55)} ${f(x + r)} ${f(y)}A${f(r)} ${f(r)} 0 0 1 ${f(x - r)} ${f(y)}C${f(x - r)} ${f(y - r * 0.55)} ${f(x - r * 0.35)} ${f(y - r * 1.2)} ${f(x)} ${f(y - r * 2.1)}Z`;

// ------------------------------------------------------------------ shared objects

// Bookoo Themis Mini: 80 x 80 x 15 mm, glossy black bezel, smoked
// translucent top showing the load cell circle, a circuit patch and two
// buttons; two dot-matrix displays near the front edge. Returns the top
// height and the plane transform of the left display (live weight goes there).
function scale(S, cam, cx, cz, y0, o = {}) {
  const a = 40, h = 15, r = 11;
  S.shadow(rrectTop(cam, cx - a - 6, cx + a + 9, cz - a - 5, cz + a + 8, y0, r + 6));
  const b = rbox(cam, cx - a, cx + a, cz - a, cz + a, y0, y0 + h, r);
  S.solid(b.sil, 'dark', { rim: 1 });
  // side shading on the right face
  const c0 = cam.P(cx + a - r, y0 + h, cz + a), c1 = cam.P(cx + a, y0 + h, cz + a - r);
  const gid = S.uid('g');
  S.raw(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${f(c0[0])}" y1="0" x2="${f(c1[0])}" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>`);
  S.fill(b.sil, `url(#${gid})`);
  // glossy bezel highlight along the front edge
  S.hl(`M${pt(cam.P(cx - a + r, y0 + h - 1.2, cz + a))}L${pt(cam.P(cx + a - r, y0 + h - 1.2, cz + a))}`, 0.35);
  // smoked top panel
  const inset = 3.2, top = y0 + h;
  const panel = rrectTop(cam, cx - a + inset, cx + a - inset, cz - a + inset, cz + a - inset, top, r - inset);
  S.fill(panel, 'rgb(20 34 38 / .9)');
  S.fill(panel, `url(#${S.id}top)`, ' opacity=".55"');
  S.raw(`<g transform="${cam.top(cx, top, cz)}" class="scale-top">`);
  // load cell circle with its fine ring of text, circuit patch, buttons
  S.raw(`<circle r="17" fill="rgb(0 0 0 / .35)" stroke="rgb(${PAPER} / .22)" stroke-width=".9" vector-effect="non-scaling-stroke"/>`);
  S.raw(`<circle r="20.5" fill="none" stroke="rgb(${PAPER} / .2)" stroke-width="1.6" stroke-dasharray=".5 .7" vector-effect="non-scaling-stroke"/>`);
  S.raw(`<path d="M-33 -33h13v9h-5v6h-8z" fill="rgb(${PAPER} / .05)" stroke="rgb(${PAPER} / .18)" stroke-width=".7" vector-effect="non-scaling-stroke"/><path d="M-30 -30h4v3h-4zM-24 -30h2v2h-2zM-31 -25h3v2h-3z" fill="rgb(${PAPER} / .2)"/>`);
  S.raw(`<circle cx="24" cy="4" r="2.6" fill="rgb(0 0 0 / .5)" stroke="rgb(${PAPER} / .3)" stroke-width=".8" vector-effect="non-scaling-stroke"/><circle cx="24" cy="11" r="2.6" fill="rgb(0 0 0 / .5)" stroke="rgb(${PAPER} / .3)" stroke-width=".8" vector-effect="non-scaling-stroke"/>`);
  // display windows
  S.raw(`<rect x="-35" y="21.5" width="27" height="13" rx="1.8" fill="rgb(0 0 0 / .7)"/><rect x="8" y="21.5" width="27" height="13" rx="1.8" fill="rgb(0 0 0 / .7)"/>`);
  if (o.right !== false) S.raw(dots('0.0', 21.5, 28.4, 1.05, `rgb(${PAPER} / .5)`));
  if (o.left) S.raw(dots(o.left, -21.5, 28.4, 1.1, 'var(--acc)'));
  S.raw('</g>');
  S.line(panel, 's');
  return { top, lcd: cam.top(cx, top, cz), lcdAt: [-21.5, 28.4] };
}

// 5x7 dot-matrix glyphs (rows top to bottom, 5 bits each)
const FONT = {
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14],
  4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
  8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12], '-': [0, 0, 0, 31, 0, 0, 0],
};
function dots(text, cx, cy, pitch, fill) {
  const cols = [];
  for (const ch of text) {
    if (ch === '.') cols.push([[6]]);
    else { const g = FONT[ch]; if (!g) continue; for (let c = 0; c < 5; c++) cols.push(g.map((row, ri) => (row >> (4 - c)) & 1 ? ri : -1).filter((v) => v >= 0).map((v) => [v])); }
    cols.push([]);
  }
  cols.pop();
  const w = (cols.length - 1) * pitch, x0 = cx - w / 2, y0 = cy - 3 * pitch, r = pitch * 0.4;
  let d = '';
  cols.forEach((col, i) => col.forEach(([ri]) => { const x = x0 + i * pitch, y = y0 + ri * pitch; d += `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`; }));
  return `<path d="${d}" style="fill:${fill}"/>`;
}

// Hoffmann-style ceramic dosing cup, side view in its own 200 x 122 frame
// (photo 1): pebble bowl, wide mouth, rim sweeping up to a pointed spout.
const DOSE = {
  outer: 'M8 8C3 22 6 48 20 72C36 100 70 120 108 121C150 122 186 108 196 84C202 70 200 56 190 46C172 30 136 20 100 13C70 7 40 1 22 1C14 1 10 3 8 8Z',
  inner: 'M13 8C38 4 70 10 100 17C134 25 166 36 186 48C172 64 146 72 116 70C78 67 38 40 13 8Z',
  lip: 'M13 8C38 40 78 67 116 70C146 72 172 64 186 48',
  back: 'M13 8C38 4 70 10 100 17C134 25 166 36 186 48',
};
const BEANS = [[84, 44, -50, .92], [150, 46, 15, .92], [104, 50, 75, .95], [128, 52, -5, 1], [70, 50, 30, .95], [92, 60, -15, 1], [116, 65, 20, 1.03], [140, 63, -28, 1], [162, 56, 35, .97]];
const beanD = 'M-9 0a9 6.4 0 1 0 18 0a9 6.4 0 1 0 -18 0Z';
function bean(S, x, y, rot, sc = 1, cls = '') {
  S.raw(`<g${cls ? ` class="${cls}"` : ''} transform="translate(${f(x)} ${f(y)}) rotate(${rot}) scale(${sc})">`);
  S.raw(`<path d="${beanD}" fill="url(#${S.id}coffee)" stroke="rgb(255 225 190 / .35)" stroke-width=".9"/>`);
  S.raw('<path d="M-6.5 1.6C-3 -2.8 2.5 3.4 6.5 -1.4" fill="none" stroke="#1a0e06" stroke-opacity=".8" stroke-width="1.3" stroke-linecap="round"/>');
  S.raw('</g>');
}
// draws the cup with its foot at (x, y) (screen), k px per frame unit
function dosingCup(S, x, y, k, o = {}) {
  const T = `translate(${f(x - 110 * k)} ${f(y - 121 * k)}) scale(${f(k)})`;
  S.raw(`<g transform="${T}">`);
  S.solid(DOSE.outer, 'ceramic');
  S.face(DOSE.inner, 'hole');
  if (o.beans !== false) {
    const cid = S.uid('c');
    S.raw(`<clipPath id="${cid}"><path d="${DOSE.inner}"/></clipPath><g clip-path="url(#${cid})"${o.beansCls ? ` class="${o.beansCls}"` : ''}>`);
    for (const [bx, by, rot, sc] of BEANS) bean(S, bx, by, rot, sc);
    S.raw('</g>');
  }
  // things dropping into the cup: in front of the back wall, behind the
  // front lip (visible above the back rim edge and through the opening)
  if (o.fall) {
    const fid = S.uid('cf');
    S.raw(`<clipPath id="${fid}"><path d="M-400 -600H400V48L186 48C166 36 134 25 100 17C70 10 38 4 13 8L-400 8Z"/><path d="${DOSE.inner}"/></clipPath><g clip-path="url(#${fid})">`);
    o.fall();
    S.raw('</g>');
  }
  S.line(DOSE.lip, 'p');
  S.line(DOSE.back, 's');
  S.hl('M14 26C15 48 26 72 46 92');
  S.raw('</g>');
  return T;
}


// ------------------------------------------------------------------ espresso cup
// 60 mm across, 56 mm tall, handle to the right. Foot at (cx, y0, cz).
const CUP_H = 52;
function espressoCup(S, cam, cx, y0, cz, o = {}) {
  const H = CUP_H, R0 = 29;
  const ht = cam.plane([cx + 24.5, y0 + 28, cz + 6], [1, 0, -0.35], [0, -1, 0]);
  S.raw(`<g transform="${ht}">`);
  S.solid('M0 -16C8.5 -18 16 -14 16 -6.5C16 1 8.5 5.5 0 5.5L0 .8C5.5 .8 10.4 -2 10.4 -6.5C10.4 -11 5.5 -12 0 -11.2Z', 'ceramic');
  S.raw('</g>');
  const cup = G.stackLathe(cam, cx, cz, [[y0 + H, R0], [y0 + H - 1.4, R0 + 0.3], [y0 + 42, R0 - 0.6], [y0 + 28, R0 - 4], [y0 + 15, R0 - 8.6], [y0 + 6, R0 - 12], [y0 + 2, R0 - 13.2], [y0, R0 - 14]], 6);
  S.solid(cup.sil, 'ceramic');
  S.face(cup.ring(y0 + H, R0), 'top');
  S.face(cup.ring(y0 + H - 0.4, R0 - 2.4), 'hole');
  if (o.inside) { const id = S.uid('ci'); S.raw(`<clipPath id="${id}"><path d="${cup.ring(y0 + H - 0.4, R0 - 2.4)}"/></clipPath><g clip-path="url(#${id})">`); o.inside(cup); S.raw('</g>'); }
  S.line(cup.ring(y0 + H, R0), 'p');
  S.line(cup.ring(y0 + H - 0.4, R0 - 2.4), 's');
  S.hl(lathe(cam, cx, cz, [[y0 + 44, R0 - 1], [y0 + 20, R0 - 7]]).streak(y0 + 44, y0 + 22, R0 - 3, 150), 0.5);
  cup.rimR = R0 - 2.4; cup.rimY = y0 + H - 0.4;
  return cup;
}

// ------------------------------------------------------------------ portafilter
// Decent naked portafilter: bottomless holder ring with two ears, steel stem,
// teardrop handle (30042 drawing: 140 long, 23 at the stem, 33 at the belly)
// in glossy marbled purple and black resin. IKAPE tapered basket (BK).
// (cx, y0, cz) = top of the basket rim. ang = handle direction in the
// ground plane, degrees from +x towards +z. content: 'none' (holder only),
// 'empty', 'grounds', 'tamped', 'paper'.
const HANDLE = [[0, 11.5], [12, 11.4], [26, 11.9], [42, 13.6], [60, 15.8], [78, 16.5], [96, 16], [112, 14.1], [124, 11.4], [131, 8.6], [135.5, 6], [138.4, 3.6], [139.6, 1.8], [140, 0.2]];
function handleMarble(S, cam, a, dir, prof, uid) {
  const rv = revolve(cam, a, dir, prof, 6);
  const cid = S.uid('hc');
  S.raw(`<clipPath id="${cid}"><path d="${rv.d}"/></clipPath>`);
  S.solid(rv.d, 'resin', { under: false, rim: 0.9 });
  // marbling: irregular ribbons of purple (filled, varying width) and fine
  // veins along their edges, mapped onto the body in (t along, w across)
  const n = rv.C.length;
  const at = (t, w) => { const x = Math.max(0, Math.min(1, t)) * (n - 1), i = Math.min(n - 2, Math.floor(x)), u = x - i; const c = (k, j) => rv.L[k][j] + (rv.R[k][j] - rv.L[k][j]) * (w + 1) / 2; return [c(i, 0) * (1 - u) + c(i + 1, 0) * u, c(i, 1) * (1 - u) + c(i + 1, 1) * u]; };
  const sw = (pts) => crD(pts.map(([t, w]) => at(t, w)));
  const ribbon = (pts) => { const up = pts.map(([t, w, h]) => [t, w - h]), dn = pts.map(([t, w, h]) => [t, w + h]).reverse(); return crD(up.map(([t, w]) => at(t, w))) + crD(dn.map(([t, w]) => at(t, w)), false) + 'Z'; };
  S.raw(`<g clip-path="url(#${cid})">`);
  const R1 = [[-0.05, 0.3, 0.1], [0.12, -0.15, 0.22], [0.27, 0.05, 0.12], [0.4, 0.55, 0.3], [0.55, 0.2, 0.08], [0.68, -0.35, 0.2], [0.83, -0.1, 0.34], [1.05, 0.5, 0.15]];
  const R2 = [[0.05, -0.9, 0.08], [0.2, -0.7, 0.16], [0.33, -0.55, 0.05], [0.47, -0.2, 0.1], [0.6, 0.6, 0.06], [0.74, 0.75, 0.18], [0.9, 0.3, 0.06], [1.05, -0.4, 0.1]];
  const R3 = [[0.15, 0.9, 0.12], [0.3, 0.75, 0.06], [0.5, 0.95, 0.2], [0.62, 0.0, 0.05], [0.78, 0.3, 0.12], [0.95, 0.95, 0.2]];
  S.raw(`<path d="${ribbon(R1)}" fill="#6a3a9e" fill-opacity=".62"/>`);
  S.raw(`<path d="${ribbon(R2)}" fill="#8d5cc6" fill-opacity=".42"/>`);
  S.raw(`<path d="${ribbon(R3)}" fill="#4a2475" fill-opacity=".7"/>`);
  S.raw(`<path d="${ribbon([[0.3, -0.2, 0.05], [0.42, 0.25, 0.14], [0.52, -0.1, 0.06], [0.64, -0.75, 0.16], [0.76, -0.6, 0.04]])}" fill="#05030a" fill-opacity=".75"/>`);
  S.raw(`<path d="${sw(R1.map(([t, w, h]) => [t, w - h]))}" fill="none" stroke="#c7a2ee" stroke-opacity=".45" stroke-width=".7"/>`);
  S.raw(`<path d="${sw(R2.map(([t, w, h]) => [t + 0.02, w + h * 0.8]))}" fill="none" stroke="#d9bdf5" stroke-opacity=".35" stroke-width=".55"/>`);
  S.raw(`<path d="${sw([[0.05, 0.1], [0.18, 0.45], [0.36, 0.3], [0.5, 0.42], [0.7, 0.15], [0.88, 0.55]])}" fill="none" stroke="#b48ae6" stroke-opacity=".3" stroke-width=".5"/>`);
  S.raw('</g>');
  // gloss: a long specular streak along the top and a small hot spot
  S.raw(`<path d="${sw([[0.08, -0.55], [0.3, -0.6], [0.5, -0.62], [0.7, -0.58], [0.86, -0.45]])}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round"/>`);
  S.raw(`<path d="${sw([[0.5, -0.5], [0.6, -0.52], [0.68, -0.48]])}" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2.6" stroke-linecap="round"/>`);
  S.raw(`<path d="${sw([[0.35, 0.72], [0.55, 0.78], [0.75, 0.66]])}" fill="none" stroke="#b58ae0" stroke-opacity=".35" stroke-width="1.2" stroke-linecap="round"/>`);
  return rv;
}
// IKAPE 58 mm precision basket (photo 13): a tapered cone, 58 mm across the
// top and 33 mm deep, with a flared lip, two raised rings just under it and
// walls sloping in to a flat 39 mm floor. y = 0 is the top of the lip.
const BK = { lip: 32.6, top: 29.2, depth: 33, floor: 19.5 };
const basketProf = (y0) => [
  [y0 + 0.8, 32.2], [y0, 32.6, 1], [y0 - 0.6, 31, 1], [y0 - 1.2, 29.4, 1],
  [y0 - 2.6, 29.4, 1], [y0 - 3.4, 30, 1], [y0 - 4.6, 30, 1], [y0 - 5.4, 29.4, 1],
  [y0 - 6.6, 29.4, 1], [y0 - 7.4, 30, 1], [y0 - 8.6, 30, 1], [y0 - 9.4, 29.2, 1],
  [y0 - 11, 28.6], [y0 - 20, 24.6], [y0 - 28, 21.2], [y0 - 32.2, 19.8, 1], [y0 - 33, 19.2, 1],
];
// the cone's outer wall below height yTop: brushed steel, its rings, a sheen
function basketWall(S, cam, cx, y0, cz, yTop = y0 + 0.8) {
  const prof = basketProf(y0).filter(([y]) => y <= yTop + 1e-6);
  const w = G.stackLathe(cam, cx, cz, prof, 4);
  S.solid(w.sil, 'brushed');
  // the raised rings catch a line of light on their upper edge
  for (const yr of [y0 - 3.4, y0 - 7.4]) if (yr < yTop) { S.raw(`<path d="${w.front(yr, 30)}" fill="none" stroke="rgb(255 255 255 / .55)" stroke-width="1"/>`); S.raw(`<path d="${w.front(yr - 1.2, 30)}" fill="none" stroke="rgb(0 0 0 / .35)" stroke-width="1"/>`); }
  // a crease where the cone starts, then a long specular streak down the cone
  if (y0 - 11 < yTop) S.raw(`<path d="${w.front(y0 - 11, 28.6)}" fill="none" stroke="rgb(0 0 0 / .25)" stroke-width="1"/>`);
  const k = (y) => { const p = prof; for (let i = 1; i < p.length; i++) if (y >= p[i][0]) { const t = (y - p[i][0]) / (p[i - 1][0] - p[i][0]); return p[i][1] + (p[i - 1][1] - p[i][1]) * t; } return p[p.length - 1][1]; };
  for (const [a, op, wd] of [[146, 0.75, 2.2], [40, 0.3, 1.4]]) {
    const ya = Math.min(yTop, y0 - 12), yb = y0 - 31;
    const pts = []; for (let i = 0; i <= 10; i++) { const y = ya + (yb - ya) * i / 10, r = k(y); pts.push(cam.P(cx + r * Math.cos(a * Math.PI / 180), y, cz + r * Math.sin(a * Math.PI / 180))); }
    S.raw(`<path d="${crD(pts)}" fill="none" stroke="#fff" stroke-opacity="${op}" stroke-width="${wd}" stroke-linecap="round"/>`);
  }
  // the flat floor's front edge
  S.raw(`<path d="${w.front(y0 - 33, 19.2)}" fill="none" stroke="rgb(255 255 255 / .3)" stroke-width="1"/>`);
  return w;
}
// the whole basket on its own (the Basket scene): wall, lip, a look inside
// down the sloped inner wall to the flat perforated floor
function basket(S, cam, cx, y0, cz) {
  const w = basketWall(S, cam, cx, y0, cz);
  S.face(w.ring(y0 + 0.8, 32.2), `rgb(${PAPER} / .22)`);
  S.face(w.ring(y0 + 0.8, 29), 'rgb(14 24 26 / .9)');
  const ic = S.uid('bi');
  S.raw(`<clipPath id="${ic}"><path d="${w.ring(y0 + 0.8, 29)}"/></clipPath><g clip-path="url(#${ic})">`);
  // far inner wall: lit brushed steel sloping down to the floor
  const inner = G.stackLathe(cam, cx, cz, [[y0 + 0.8, 29], [y0 - 11, 28], [y0 - 32, 18.8]], 4);
  S.fill(inner.sil, `url(#${S.id}brushed)`, ' fill-opacity=".55"');
  S.fill(ellD(cam.ell(cx, y0 - 32, cz, 18.8)), 'rgb(70 84 86)');
  let hd = '';
  for (const [rk, n] of [[0, 1], [4, 7], [8, 13], [12, 19], [16, 25]]) for (let i = 0; i < n; i++) { const a = (i + (rk % 8 ? 0.5 : 0)) / n * 2 * Math.PI; const p = cam.P(cx + rk * Math.cos(a), y0 - 32, cz + rk * Math.sin(a)); hd += `M${f(p[0] - 0.35)} ${f(p[1])}h.7`; }
  S.raw(`<path d="${hd}" stroke="rgb(10 18 20 / .75)" stroke-width="${f(Math.max(1, cam.s * 0.6))}" stroke-linecap="round"/>`);
  S.raw(`<path d="${w.back(y0 - 32, 18.8)}" fill="none" stroke="rgb(0 0 0 / .4)" stroke-width="1"/>`);
  S.raw('</g>');
  S.line(w.ring(y0 + 0.8, 32.2), 's');
  S.line(w.ring(y0 + 0.8, 29), 's');
  S.hl(w.front(y0 + 0.8, 32), 0.45);
  return w;
}
function portafilter(S, cam, cx, y0, cz, o = {}) {
  const R = Math.PI / 180, ang = (o.ang ?? 143) * R, tilt = (o.tilt ?? -4) * R;
  const content = o.content ?? 'empty';
  const dir = norm3([Math.cos(ang) * Math.cos(tilt), Math.sin(tilt), Math.sin(ang) * Math.cos(tilt)]);
  // is the handle on the viewer's side? (depth towards the camera)
  const toward = -dir[0] * cam.sa + dir[2] * cam.ca > -0.15;
  const parts = {};
  const drawHandle = () => {
    const a0 = [cx + dir[0] * 30, y0 - 7 + dir[1] * 30, cz + dir[2] * 30];
    const stem = tube(cam, [a0, add3(a0, dir, 14), add3(a0, dir, 30)], 5.5);
    S.solid(stem.d, 'metal', { under: false });
    const ring = add3(a0, dir, 27);
    const [u, v] = G.perp(dir);
    S.line(polyD(circ3(cam, ring, u, v, 5.6, 24, 0, 360)), 's');
    parts.handle = handleMarble(S, cam, add3(a0, dir, 30), dir, HANDLE);
  };
  if (!toward && o.handle !== false) drawHandle();
  // naked bottom: the basket's tapered cone hangs out under the ring
  if (content !== 'none') parts.bot = basketWall(S, cam, cx, y0, cz, y0 - 11);
  // ears
  for (const s of [-1, 1]) {
    const e = [Math.cos(ang + s * Math.PI / 2), 0, Math.sin(ang + s * Math.PI / 2)];
    const p0 = [cx + e[0] * 33, y0 - 6, cz + e[2] * 33];
    const ear = tube(cam, [p0, add3(p0, e, 5), add3(p0, e, 9.5)], 3.4);
    S.solid(ear.d, 'metal', { under: false });
  }
  const holder = G.stackLathe(cam, cx, cz, [[y0 - 0.6, 36], [y0 - 1.4, 36.5], [y0 - 12, 36.2], [y0 - 13.6, 34.6]], 3);
  S.solid(holder.sil, 'metal');
  S.face(holder.ring(y0 - 0.6, 36), 'top');
  S.line(holder.ring(y0 - 0.6, 36), 's');
  S.hl(holder.streak(y0 - 3, y0 - 11, 36.3, 148), 0.55);
  parts.holder = holder;
  if (content !== 'none') {
    // basket lip and the inside
    S.face(holder.ring(y0, 31.6), `rgb(${PAPER} / .16)`);
    S.line(holder.ring(y0, 31.6), 's');
    S.face(holder.ring(y0, 29), 'hole');
    const cid = S.uid('bk');
    S.raw(`<clipPath id="${cid}"><path d="${holder.ring(y0, 29)}"/></clipPath><g clip-path="url(#${cid})">`);
    // far inner wall catches light
    S.face(holder.ring(y0 - 6, 28.6), 'rgb(0 0 0 / .25)');
    if (content === 'empty') {
      // deep tapered basket: the sloped far wall, then the flat floor
      S.face(holder.ring(y0 - 14, 26.8), `rgb(${PAPER} / .06)`);
      S.face(holder.ring(y0 - 32, 18.8), `rgb(${PAPER} / .1)`);
      for (let i = 0; i < 14; i++) { const a = i * 0.9, r = 3 + (i % 5) * 3.6; const p = cam.P(cx + r * Math.cos(a * 3.1), y0 - 32, cz + r * Math.sin(a * 3.1)); S.fill(circle(p, 0.5 * cam.s), `rgb(${PAPER} / .25)`); }
    }
    if (content === 'grounds') {
      parts.mound = groundsMound(S, cam, cx, y0, cz, o.groundsCls);
    }
    if (content === 'tamped' || content === 'paper' || o.tampedCls) {
      S.open(o.tampedCls || '');
      S.face(holder.ring(y0 - 8, 28.4), `url(#${S.id}coffee)`);
      S.face(holder.ring(y0 - 8, 28.4), 'rgb(0 0 0 / .18)');
      S.line(holder.ring(y0 - 8, 28.4), 's');
      S.close();
    }
    if (content === 'paper') paperDisc(S, cam, cx, y0 - 7.6, cz);
    if (o.inside) o.inside(holder);
    S.raw('</g>');
    S.line(holder.front(y0, 29), 's');
  }
  if (toward && o.handle !== false) drawHandle();
  parts.dir = dir;
  return parts;
}
function groundsMound(S, cam, cx, y0, cz, cls = '') {
  const e = cam.ell(cx, y0 - 1.5, cz, 28.6);
  const top = cam.P(cx - 2, y0 + 4.5, cz + 1);
  const d = `M${f(e.cx - e.rx)} ${f(e.cy)}C${f(e.cx - e.rx * 0.7)} ${f(top[1] - 1)} ${f(e.cx - e.rx * 0.2)} ${f(top[1] - 3)} ${f(top[0])} ${f(top[1] - 3)}C${f(e.cx + e.rx * 0.3)} ${f(top[1] - 3)} ${f(e.cx + e.rx * 0.75)} ${f(top[1])} ${f(e.cx + e.rx)} ${f(e.cy)}A${f(e.rx)} ${f(e.ry)} 0 0 1 ${f(e.cx - e.rx)} ${f(e.cy)}Z`;
  S.raw(`<g${cls ? ` class="${cls}"` : ''}>`);
  S.fill(d, `url(#${S.id}coffee)`);
  S.fill(d, 'rgb(255 220 180 / .08)');
  // a little texture
  let g = '';
  for (let i = 0; i < 26; i++) { const t = (i * 0.61803) % 1, r = Math.sqrt(t) * 24, a = i * 2.4; const p = cam.P(cx + r * Math.cos(a), y0 + 2.5 - r * 0.12, cz + r * Math.sin(a)); g += `M${f(p[0] - 0.7)} ${f(p[1])}h1.4`; }
  S.raw(`<path d="${g}" stroke="rgb(255 225 190 / .35)" stroke-width="1.1" stroke-linecap="round"/>`);
  S.raw('</g>');
  return d;
}
function paperDisc(S, cam, cx, y, cz, cls = '') {
  const e = cam.ell(cx, y, cz, 27.6);
  S.raw(`<g${cls ? ` class="${cls}"` : ''}>`);
  S.fill(ellD(e), 'rgb(246 248 244 / .86)');
  S.fill(ellD({ ...e, rx: e.rx * 0.98, ry: e.ry * 0.94 }), 'none', ` stroke="rgb(255 255 255 / .9)" stroke-width=".8"`);
  S.fill(ellD({ ...e, cx: e.cx - e.rx * 0.2, cy: e.cy - e.ry * 0.25, rx: e.rx * 0.45, ry: e.ry * 0.3 }), 'rgb(255 255 255 / .5)');
  S.raw('</g>');
}

// ------------------------------------------------------------------ DE1
// Decent DE1 from the dimension drawing: 232 wide, body 230 tall on a 92 mm
// frame (321 to the top), body 237 deep with a big radius on the top-back
// edge and rounded front corners; frame 369 deep with legs, drip tray in
// front; group head housing on the front-left with the controller disc on
// top (centre 84 from the left, 80 in front of the body); steam wand on the
// right; tablet on its stand behind the group.
const DE = { W: 232, FY: 92, TOP: 322, D: 237, FZ: 132, gx: 84, gz: 80, gTop: 318, gBot: 262, gR: 68, pf: 238 };
function clipBand(poly, ylo, yhi) {
  const clip = (pts, keep, cut) => {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ia = keep(a), ib = keep(b);
      if (ia) out.push(a);
      if (ia !== ib) { const t = (cut - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * t, cut]); }
    }
    return out;
  };
  return clip(clip(poly, (p) => p[1] <= yhi, yhi), (p) => p[1] >= ylo, ylo);
}
function roundedOutline(pts, radii, per = 10) {
  // sample a rounded polygon (2D) as points
  const segs = G.roundedPoly(pts, radii, (p) => p);
  const out = [];
  for (const s of segs) for (let k = 0; k < per; k++) { const t = k / per, u = 1 - t; out.push([0, 1].map((i) => u * u * u * s[0][i] + 3 * u * u * t * s[1][i] + 3 * u * t * t * s[2][i] + t * t * t * s[3][i])); }
  return out;
}
function de1(S, cam, o = {}) {
  const { W: BW, FY, TOP, D, FZ, gx, gz, gTop, gBot, gR } = DE;
  // ---- shadow
  S.shadow(rrectTop(cam, -16, BW + 22, -D - 14, FZ + 16, 0, 30));
  // ---- frame rails (side profile with legs and an arch)
  const railProf = (x) => G.roundedPoly([[-D, FY], [FZ, FY], [FZ, 6], [FZ - 30, 6], [FZ - 34, 52], [-D + 38, 52], [-D + 34, 6], [-D, 6]], [3, 4, 3, 2, 14, 14, 2, 3], (p) => [x, p[1], p[0]]);
  const rail = (x) => G.prism(cam, railProf(x), [18, 0, 0]);
  const feet = (x) => { for (const z of [-D + 16, FZ - 16]) { const ft = lathe(cam, x + 9, z, [[6, 7], [0, 8]]); S.solid(ft.sil, 'dark', { under: false }); } };
  feet(0);
  const rl = rail(0); S.solid(rl.sil, 'dark'); S.face(rl.capB, `url(#${S.id}side)`);
  // water drawer under the body, seen through the arch
  const dr = rbox(cam, 20, BW - 20, -D + 30, -14, 10, FY - 4, 6);
  S.solid(dr.sil, 'smoke', { under: false });
  // drip tray with its grate (bars run front to back)
  const ty = FY - 2;
  const tray = rbox(cam, 20, BW - 20, 4, FZ - 6, 50, ty, 8);
  S.solid(tray.sil, 'metal');
  S.face(rrectTop(cam, 26, BW - 26, 10, FZ - 12, ty, 4), 'deep');
  let g = '';
  for (let x = 30; x <= BW - 30; x += 6.5) g += `M${pt(cam.P(x, ty, 12))}L${pt(cam.P(x, ty, FZ - 14))}`;
  S.raw(`<path d="${g}" stroke="rgb(${PAPER} / .34)" stroke-width="1.1"/>`);
  S.line(tray.top, 's');
  feet(BW - 18);
  const rr = rail(BW - 18); S.solid(rr.sil, 'dark'); S.face(rr.capB, `url(#${S.id}side)`); S.line(rr.capB, 's');
  // ---- body: front outline F (x,y) intersected with side profile Sd (z,y)
  const F = roundedOutline([[0, FY], [0, TOP], [BW, TOP], [BW, FY]], [3, 26, 26, 3], 10);
  const Sd = roundedOutline([[0, FY], [0, TOP], [-D, TOP], [-D, FY]], [3, 12, 95, 3], 10);
  const band = (z) => { let lo = 1e9, hi = -1e9; for (let i = 0; i < Sd.length; i++) { const a = Sd[i], b = Sd[(i + 1) % Sd.length]; if ((a[0] - z) * (b[0] - z) <= 0 && a[0] !== b[0]) { const t = (z - a[0]) / (b[0] - a[0]); const y = a[1] + (b[1] - a[1]) * t; lo = Math.min(lo, y); hi = Math.max(hi, y); } } return [lo, hi]; };
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const z = -D + 0.01 + (D - 0.02) * i / 48;
    const [lo, hi] = band(z);
    for (const p of clipBand(F, lo, hi)) pts.push(cam.P(p[0], p[1], z));
  }
  const sil = polyD(hull(pts));
  S.solid(sil, 'cream', { back: 1 });
  const [lo0, hi0] = band(-0.01);
  const front = clipBand(F, lo0, hi0).map((p) => cam.P(p[0], p[1], 0));
  S.face(polyD(front), 'rgb(0 0 0 / .1)');
  S.line(polyD(front), 'p');
  // right face: side profile clipped to where F reaches x = BW
  const right = clipBand(Sd, FY + 3, TOP - 26).map((p) => cam.P(BW, p[1], p[0]));
  S.face(polyD(right), `url(#${S.id}side)`);
  S.line(polyD(right), 's');
  // rounded edge highlights
  S.hl(crD([cam.P(BW - 26 * 0.3, TOP - 26 * 0.3, -14), cam.P(BW - 26 * 0.3, TOP - 26 * 0.3, -D + 60)]), 0.35);
  S.hl(crD(Sd.filter((p) => p[0] < -D + 96 && p[1] > TOP - 96).map((p) => cam.P(BW - 8, p[1] - 2, p[0] + 2))), 0.3);
  // logo, lower right of the front face
  S.raw(`<g transform="${cam.front(BW - 44, FY + 30, 0)}"><text x="0" y="0" font-size="17" font-weight="700" fill="rgb(${PAPER} / .45)" text-anchor="middle" letter-spacing="-.4">decent</text><text x="0" y="7" font-size="4.6" font-weight="700" fill="rgb(${PAPER} / .3)" text-anchor="middle" letter-spacing="1.2">ESPRESSO</text></g>`);
  // ---- tablet on its stand, behind the group, tilted back
  if (o.tablet !== false) {
    const tb = [0, Math.sin(58 * Math.PI / 180), -Math.cos(58 * Math.PI / 180)];
    const o0 = [13, TOP + 6, 14];
    const stand = rbox(cam, 98, 134, -24, 6, TOP - 2, TOP + 8, 4);
    S.solid(stand.sil, 'dark', { under: false });
    const T = cam.plane(o0, [1, 0, 0], tb.map((v) => -v));
    const back = cam.plane(add3(o0, [0, -0.4, -1.6]), [1, 0, 0], tb.map((v) => -v));
    S.raw(`<g transform="${back}"><rect x="0" y="-118" width="206" height="118" rx="9" fill="#05090a" fill-opacity=".9" stroke="rgb(255 255 255 / .2)" stroke-width="1" vector-effect="non-scaling-stroke"/></g>`);
    S.raw(`<g transform="${T}"><rect x="0" y="-118" width="206" height="118" rx="9" fill="#071012" stroke="rgb(255 255 255 / .35)" stroke-width="1" vector-effect="non-scaling-stroke"/>
      <rect x="9" y="-109" width="188" height="100" rx="3" fill="#0d1d22"/>
      <path d="M18 -96h20l8 -9h40l60 4h40" fill="none" stroke="#4ce68c" stroke-opacity=".75" stroke-width="1.4" vector-effect="non-scaling-stroke"/>
      <path d="M18 -62h6c4 -22 8 -22 12 -6c2 6 4 6 8 6h140" fill="none" stroke="#63aef5" stroke-opacity=".75" stroke-width="1.4" vector-effect="non-scaling-stroke"/>
      <path d="M18 -30h168" fill="none" stroke="#ff6b5e" stroke-opacity=".6" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
      <path d="M9 -109h188v38C120 -84 60 -102 9 -90Z" fill="#fff" fill-opacity=".05"/></g>`);
  }
  if (o.under) o.under();
  // ---- steam wand, right: out of the front face near the top, knuckle, down
  const wx = 201;
  const arm = tube(cam, [[wx, 296, 0], [wx, 296, 30], [wx, 296, 58]], 7);
  S.solid(arm.d, 'metal', { under: false });
  const knuckle = lathe(cam, wx, 64, [[305, 0.01], [303, 7], [296, 10], [289, 7], [287, 0.01]]);
  S.solid(knuckle.sil, 'metal', { under: false });
  const wand = tube(cam, [[wx, 292, 66], [wx, 270, 76], [wx, 250, 78], [wx, 205, 78]], 6.4);
  S.solid(wand.d, 'dark', { under: false });
  const tip = tube(cam, [[wx, 208, 78], [wx, 180, 78], [wx, 158, 78]], 3.6);
  S.solid(tip.d, 'metal', { under: false });
  S.hl(crD([cam.P(wx - 2.5, 202, 78), cam.P(wx - 2.5, 162, 78)]), 0.6);
  // ---- group: neck block, then whatever hangs under it, then the housing
  const neck = rbox(cam, gx - 46, gx + 46, -2, gz - 20, gBot + 4, gTop - 4, 10);
  S.solid(neck.sil, 'dark');
  if (o.pf) o.pf();
  const collar = lathe(cam, gx, gz, [[gBot, 44], [gBot - 9, 44, 1], [gBot - 10, 39], [DE.pf + 1, 39], [DE.pf, 37.5]]);
  S.solid(collar.sil, 'metal', { under: false });
  S.line(collar.front(gBot - 9.5, 44), 's');
  S.hl(collar.streak(gBot - 11, DE.pf + 2, 39, 150), 0.6);
  if (o.water) o.water();
  const grp = lathe(cam, gx, gz, [[gTop, gR - 1], [gTop - 1.2, gR, 1], [gBot + 5, gR], [gBot + 1, gR - 3], [gBot, gR - 6]]);
  S.solid(grp.sil, 'dark');
  S.hl(grp.streak(gTop - 8, gBot + 8, gR, 152), 0.55);
  S.hl(grp.streak(gTop - 10, gBot + 14, gR, 118), 0.18);
  ghc(S, cam, gx, gTop, gz, gR, o.lit);
  S.line(grp.ring(gTop, gR - 1), 'p');
  return { tray: ty, gx, gz };
}
// Group head controller, top-facing (icons from GH_ICONS_PRODUCTION):
// hot water at 12, steam at 3, espresso at 6, flush at 9, stop in the middle.
function ghc(S, cam, gx, y, gz, R0, lit) {
  const T = cam.top(gx, y, gz);
  S.raw(`<g transform="${T}">`);
  S.raw(`<circle r="${R0 - 1}" fill="rgb(255 255 255 / .06)"/><circle r="${R0 - 7}" fill="rgb(2 7 9 / .78)"/>`);
  S.raw(`<circle r="${R0 - 7}" fill="none" stroke="rgb(${PAPER} / .18)" stroke-width="5" vector-effect="non-scaling-stroke"/><circle r="${R0 - 7}" fill="none" stroke="rgb(${PAPER} / .85)" stroke-width="1.3" vector-effect="non-scaling-stroke"/>`);
  let ticks = '';
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 - 90) * Math.PI / 180, r0 = R0 - 15, r1 = R0 - 11;
    if (i % 3 === 0) continue;
    ticks += `M${f(Math.cos(a) * r0)} ${f(Math.sin(a) * r0)}L${f(Math.cos(a) * r1)} ${f(Math.sin(a) * r1)}`;
  }
  // the 12/3/6/9 ticks sit outside their icons
  for (const [x, y2] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) ticks += `M${f(x * (R0 - 15))} ${f(y2 * (R0 - 15))}L${f(x * (R0 - 11))} ${f(y2 * (R0 - 11))}`;
  S.raw(`<path d="${ticks}" class="ic" stroke-opacity=".6"/>`);
  const ri = R0 - 30;
  const ic = (x, y2, d, cls = '') => `<g transform="translate(${f(x)} ${f(y2)}) scale(1.45)"${cls ? ` class="${cls}"` : ''}><path class="ic" d="${d}"/></g>`;
  const ICON = {
    water: 'M0 -7.2c-2.6 3.2 -3.8 4.8 -3.8 6.4a3.8 3.8 0 0 0 7.6 0c0 -1.6 -1.2 -3.2 -3.8 -6.4zM-4.4 3.6q1.1 -1.4 2.2 0t2.2 0t2.2 0t2.2 0M-4.4 6.6q1.1 -1.4 2.2 0t2.2 0t2.2 0t2.2 0',
    steam: 'M-4.2 -2.2c-2.6 1 -3.6 3 -2.6 5.2c.8 1.6 2.6 2 3.8 1.4c.8 1.8 4.4 1.8 6 0c1.2 .6 3 .2 3.8 -1.4c1 -2.2 0 -4.2 -2.6 -5.2M-1.8 2.2l-1.2 -7M0 2.6v-8M1.8 2.2l1.2 -7',
    espresso: 'M-6 -4.6h10v3.4a3.6 3.6 0 0 1 -3.6 3.6h-2.8a3.6 3.6 0 0 1 -3.6 -3.6zM4 -3.2a1.9 1.9 0 1 1 0 3M-7.6 4.6h12.6',
    flush: 'M-6 -6.2h12v4a1.6 1.6 0 0 1 -1.6 1.6h-8.8a1.6 1.6 0 0 1 -1.6 -1.6zM-4.8 1.4h9.6M0 3.4c-1.4 1.8 -2 2.6 -2 3.4a2 2 0 0 0 4 0c0 -.8 -.6 -1.6 -2 -3.4z',
    stop: 'M-1.6 -6.6a6.8 6.8 0 0 0 -5 5M-6.6 1.6a6.8 6.8 0 0 0 5 5M1.6 6.6a6.8 6.8 0 0 0 5 -5M6.6 -1.6a6.8 6.8 0 0 0 -5 -5M-2.4 2.4v-5.4M-.8 1.4v-6M.8 1.4v-6M2.4 2v-4.6M-2.4 2.4c0 1.6 1 2.4 2.4 2.4s2.4 -.8 3.2 -2l1.2 -2.2',
  };
  const pos = { water: [0, -ri], steam: [ri, 0], espresso: [0, ri], flush: [-ri, 0], stop: [0, 0] };
  const litKey = lit === 'brew' ? 'espresso' : lit;
  for (const k of Object.keys(ICON)) if (k !== litKey) S.raw(ic(...pos[k], ICON[k]));
  S.raw('</g>');
  if (litKey) {
    const [lx, ly] = pos[litKey];
    S.raw(`<g transform="${T}"><g class="k-lit" style="transform-origin:${f(lx)}px ${f(ly)}px"><circle cx="${f(lx)}" cy="${f(ly)}" r="36" fill="url(#${S.id}glow)"/></g>`);
    S.raw(`<circle class="k-ring fx" style="transform-origin:${f(lx)}px ${f(ly)}px" cx="${f(lx)}" cy="${f(ly)}" r="12" fill="none" stroke="var(--acc)" stroke-width="1.4" vector-effect="non-scaling-stroke"/>`);
    S.raw(`<g transform="translate(${f(lx)} ${f(ly)}) scale(1.45)"><path d="${ICON[litKey]}" fill="none" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/></g></g>`);
  }
}

// ------------------------------------------------------------------ grinder
// Single-dose grinder (photos 2, 3): cylinder body, a slightly wider top dial
// ring (0 fine to 90 coarse), aluminium collar, black ribbed bellows with a
// flat lid, elbow chute into a black catch cup on a round platform, wide
// stadium base tray. Body axis at (gx, gz); chute leaves towards `cd`.
const GR = { r: 55, base: 26, body0: 30, body1: 214, dial1: 228, col1: 252, bel1: 302, lid1: 310, cd: [0.97, 0, -0.243], reach: 102 };
function grinder(S, cam, gx, gz, o = {}) {
  const { r, base, body0, body1, dial1, col1, bel1, lid1, cd, reach } = GR;
  const ccx = gx + cd[0] * reach, ccz = gz + cd[2] * reach;
  // base: hull of two discs, tray recess on top
  const plan = []; for (let i = 0; i < 64; i++) { const a = i / 64 * 2 * Math.PI; plan.push([gx + 64 * Math.cos(a), gz + 64 * Math.sin(a)]); plan.push([ccx + 56 * Math.cos(a), ccz + 56 * Math.sin(a)]); }
  const ph = hull(plan);
  S.shadow(polyD(ph.map(([x, z]) => cam.P(x + 4, 0, z + 5))));
  const basePts = []; for (const [x, z] of ph) { basePts.push(cam.P(x, 0, z)); basePts.push(cam.P(x, base, z)); }
  S.solid(polyD(hull(basePts)), 'cream');
  S.face(polyD(ph.map(([x, z]) => cam.P(x, base, z))), 'top');
  S.line(polyD(ph.map(([x, z]) => cam.P(x, base, z))), 's');
  const inner = hull(plan.map(([x, z]) => [x + (x - (gx + ccx) / 2) * -0.1, z + (z - (gz + ccz) / 2) * -0.1]));
  S.face(polyD(inner.map(([x, z]) => cam.P(x, base - 3, z))), 'rgb(0 0 0 / .14)');
  // platform under the cup
  const plat = lathe(cam, ccx, ccz, [[44, 47], [40, 47]]);
  S.solid(plat.sil, 'cream', { under: false });
  S.face(plat.ring(44, 47), 'top');
  // body (near opaque: the tray behind it must not show through)
  const body = lathe(cam, gx, gz, [[body1, r], [body0, r]]);
  S.solid(body.sil, 'cream', { back: 1 });
  S.hl(body.streak(body1 - 10, body0 + 20, r, 150), 0.5);
  S.hl(body.streak(body1 - 30, body0 + 40, r, 128), 0.16);
  // (the power button is at the back of the base, out of view: the Grind
  // scene shows it in a callout)
  // the chute (photo 2): a mounting plate on the body, an elbow straight out
  // and down, and a wider collar the catch cup tucks under
  const cy = 180, tr = 25, cT = 44 + CC.h; // cup top
  const tang = [-cd[2], 0, cd[0]];
  // mounting block on the body
  const bw = 28, bt = 7, byT = cy + 30, byB = cy - 34;
  const at = (u, w, y) => cam.P(gx + cd[0] * u + tang[0] * w, y, gz + cd[2] * u + tang[2] * w);
  const u0 = r - 14, u1 = r + bt;
  const faceOut = polyD([at(u1, -bw, byT), at(u1, bw, byT), at(u1, bw, byB), at(u1, -bw, byB)]);
  const faceTop = polyD([at(u0, -bw, byT), at(u0, bw, byT), at(u1, bw, byT), at(u1, -bw, byT)]);
  const faceSide = polyD([at(u0, bw, byT), at(u1, bw, byT), at(u1, bw, byB), at(u0, bw, byB)]);
  S.solid(faceOut, 'cream', { back: 1, under: false, rim: 0.8 });
  S.face(faceOut, 'rgb(0 0 0 / .1)');
  S.solid(faceSide, 'cream', { back: 1, under: false, rim: 0.8 });
  S.face(faceSide, 'rgb(0 0 0 / .22)');
  S.solid(faceTop, 'cream', { back: 1, under: false, rim: 0.8 });
  S.face(faceTop, 'rgb(255 255 255 / .1)');
  if (o.cup !== false) catchCup(S, cam, ccx, 44, ccz, { bell: false, ...(o.cupOpts || {}) });
  if (o.beforeChute) o.beforeChute({ ccx, ccz });
  const c0 = [gx + cd[0] * u1, cy, gz + cd[2] * u1];
  const RB = Math.min(32, GR.reach - (r + bt) - 2), bx = [ccx - cd[0] * RB, ccz - cd[2] * RB];
  const bend = []; for (let k = 0; k <= 8; k++) { const t = k / 8 * Math.PI / 2; bend.push([bx[0] + cd[0] * RB * Math.sin(t), cy - RB + RB * Math.cos(t), bx[1] + cd[2] * RB * Math.sin(t)]); }
  // collar first, then the elbow drops into it
  const chuteEnd = G.stackLathe(cam, ccx, ccz, [[cT + 17, tr + 4.4], [cT + 15.5, tr + 5.3], [cT, tr + 5.5], [cT - 1.5, tr + 5], [cT - 2, tr + 4.4]], 4);
  S.solid(chuteEnd.sil, 'cream', { back: 1, rim: 0.9 });
  S.face(chuteEnd.ring(cT + 17, tr + 4.4), 'rgb(255 255 255 / .07)');
  S.raw(`<path d="${chuteEnd.front(cT - 1, tr + 5.2)}" fill="none" stroke="rgb(0 0 0 / .3)" stroke-width="1"/>`);
  S.hl(lathe(cam, ccx, ccz, [[cT + 15, tr + 5.5], [cT, tr + 5.5]]).streak(cT + 14, cT + 1, tr + 5.5, 150), 0.5);
  const ch = tube(cam, [c0, ...bend, [ccx, cT + 17, ccz]], tr, 6);
  // the far half of the start ring is tube wall too: fill it with the tube
  const sc = ch.cap(0, -1), ec = ch.cap(ch.smp.length - 1, 1);
  S.solid(polyD(sc.pts), 'cream', { back: 1, under: false, rim: 0 });
  S.solid(polyD(ec.pts), 'cream', { back: 1, under: false, rim: 0 });
  S.solid(ch.d, 'cream', { back: 1, rim: 0 });
  S.raw(`<path d="${crD(ch.L)}M${pt(ch.R[0])}${crD(ch.R, false).slice(1).replace(/^/, 'L')}" fill="none" stroke="url(#${S.id}rim)" stroke-width="1"/>`);
  const ee = ec.pts, lo = ee.reduce((m, p, i) => (p[0] < ee[m][0] ? i : m), 0), hi = ee.reduce((m, p, i) => (p[0] > ee[m][0] ? i : m), 0);
  const half = (a, b) => { const out = []; for (let i = a; ; i = (i + 1) % ee.length) { out.push(ee[i]); if (i === b) break; } return out; };
  const h1 = half(lo, hi), h2 = half(hi, lo), frontHalf = (h1.reduce((t, p) => t + p[1], 0) / h1.length > h2.reduce((t, p) => t + p[1], 0) / h2.length) ? h1 : h2;
  S.raw(`<path d="${polyD(frontHalf, false)}" fill="none" stroke="rgb(0 0 0 / .3)" stroke-width="1"/>`);
  S.hl(crD(ch.L.slice(1, -3).map((p, i) => [p[0] + (ch.R[i + 1][0] - p[0]) * 0.78, p[1] + (ch.R[i + 1][1] - p[1]) * 0.78])), 0.35);
  const cap = sc;
  // top: dial ring, collar, bellows, lid
  const dial = G.stackLathe(cam, gx, gz, [[dial1, r + 3], [dial1 - 1, r + 4], [body1 + 1, r + 4], [body1, r + 3]], 3);
  S.solid(dial.sil, 'cream', { back: 1 });
  S.face(dial.ring(dial1, r + 3), 'top');
  dialFace(S, cam, gx, dial1, gz, r + 3, o.ringCls);
  S.line(dial.ring(dial1, r + 3), 's');
  S.open(o.topCls || '');
  const col = lathe(cam, gx, gz, [[col1, 31], [dial1, 33]]);
  S.solid(col.sil, 'metal');
  S.hl(col.streak(col1 - 3, dial1 + 3, 32, 148), 0.7);
  S.open(o.bellowsCls || '', o.bellowsCls ? ` style="transform-origin:${f(cam.P(gx, col1, gz)[0])}px ${f(cam.P(gx, col1, gz)[1])}px"` : '');
  bellows(S, cam, gx, gz, col1, bel1);
  S.close();
  S.open(o.lidCls || '');
  const lid = lathe(cam, gx, gz, [[lid1, 37.5], [lid1 - 1.2, 38.5, 1], [bel1, 38.5]]);
  S.solid(lid.sil, 'dark');
  S.face(lid.ring(lid1, 37.5), `rgb(${PAPER} / .08)`);
  S.hl(lid.front(lid1 - 0.6, 38.4), 0.25);
  S.close();
  S.close();
  return { ccx, ccz, chuteEnd, body, top: lid1, cap };
}
// black rubber bellows (photos 2, 3): one continuous ribbed sleeve, folds
// a touch wider at the bottom. One outline (envelope of the surface of
// revolution), then each fold's upward flank catches the light and each
// crease is a dark line, so it reads as rubber, not stacked discs.
function bellows(S, cam, gx, gz, y0, y1, n = 4) {
  const h = (y1 - y0) / n;
  const peak = (i) => 36.6 - i * 0.5, valley = (i) => 32 - i * 0.4;
  const prof = [[0, 31.5], [h * 0.12, 32]];
  for (let i = 0; i < n; i++) {
    const a = h * i;
    prof.push([a + h * 0.3, peak(i) - 1.2], [a + h * 0.5, peak(i)], [a + h * 0.72, peak(i) - 1.4], [a + h, valley(i)]);
  }
  prof[prof.length - 1] = [y1 - y0, 33];
  const rv = G.stackLathe(cam, gx, gz, prof.map(([d, r]) => [y0 + d, r]), 8);
  S.solid(rv.sil, 'black', { under: false, rim: 0.8 });
  const E = (y, r) => cam.ell(gx, y, gz, r);
  const band = (ya, ra, yb, rb) => { const a = E(ya, ra), b = E(yb, rb); return `M${f(a.cx - a.rx)} ${f(a.cy)}A${f(a.rx)} ${f(a.ry)} 0 0 0 ${f(a.cx + a.rx)} ${f(a.cy)}L${f(b.cx + b.rx)} ${f(b.cy)}A${f(b.rx)} ${f(b.ry)} 0 0 1 ${f(b.cx - b.rx)} ${f(b.cy)}Z`; };
  const gid = S.uid('bw');
  const l = cam.P(gx - 37, 0, gz), r = cam.P(gx + 37, 0, gz);
  S.raw(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${f(l[0])}" y1="0" x2="${f(r[0])}" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".05"/><stop offset=".3" stop-color="#fff" stop-opacity=".2"/><stop offset=".55" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity=".02"/></linearGradient>`);
  for (let i = 0; i < n; i++) {
    const a = y0 + h * i;
    // upper flank of the fold: from its crest up into the crease above
    S.fill(band(a + h * 0.5, peak(i), a + h * 0.95, valley(i) + 0.6), `url(#${gid})`);
    // lower flank in shadow, crease line
    S.fill(band(a + h * 0.05, valley(i) + 0.5, a + h * 0.45, peak(i) - 0.2), 'rgb(0 0 0 / .35)');
    if (i < n - 1) S.raw(`<path d="${frontArcD(E(a + h, valley(i)))}" fill="none" stroke="#000" stroke-opacity=".7" stroke-width="1.2"/>`);
    S.hl(frontArcD(E(a + h * 0.56, peak(i) - 0.1)), 0.1);
  }
  // crest highlights on the lit side of each fold
  for (let i = 0; i < n; i++) {
    const e = E(y0 + h * (i + 0.52), peak(i) - 0.15), A = (d) => [e.cx + e.rx * Math.cos(d * Math.PI / 180), e.cy + e.ry * Math.sin(d * Math.PI / 180)];
    S.raw(`<path d="M${pt(A(168))}A${f(e.rx)} ${f(e.ry)} 0 0 0 ${pt(A(118))}" fill="none" stroke="#fff" stroke-opacity=".42" stroke-width="${f(Math.max(1.3, cam.s * 1.2))}"/>`);
  }
}
// dial markings on the top ring (rotating group in the ring's plane)
function dialFace(S, cam, gx, y, gz, R0, cls = '', big = false) {
  S.raw(`<g transform="${cam.top(gx, y, gz)}"><g${cls ? ` class="${cls}"` : ''}>`);
  const a = (v) => (-150 + v * 300 / 90);
  let t1 = '', t2 = '';
  for (let v = 0; v <= 90; v += 1) {
    const r0 = R0 - 2, r1 = R0 - (v % 10 === 0 ? 7 : v % 5 === 0 ? 5 : 3.6);
    const an = (a(v) + 90) * Math.PI / 180;
    const seg = `M${f(Math.cos(an) * r0)} ${f(Math.sin(an) * r0)}L${f(Math.cos(an) * r1)} ${f(Math.sin(an) * r1)}`;
    if (v % 5 === 0) t1 += seg; else if (big) t2 += seg;
  }
  S.raw(`<path d="${t1}" class="ic" stroke-opacity=".75"/>${t2 ? `<path d="${t2}" class="ic" stroke-opacity=".4" style="stroke-width:.7px"/>` : ''}`);
  // espresso zone 10-20
  const z0 = (a(10) + 90) * Math.PI / 180, z1 = (a(20) + 90) * Math.PI / 180, rz = R0 - 9.5;
  S.raw(`<path d="M${f(Math.cos(z0) * rz)} ${f(Math.sin(z0) * rz)}A${rz} ${rz} 0 0 1 ${f(Math.cos(z1) * rz)} ${f(Math.sin(z1) * rz)}" fill="none" stroke="var(--acc)" stroke-opacity=".8" stroke-width="${big ? 2.6 : 1.6}" vector-effect="non-scaling-stroke"/>`);
  if (big) {
    // setting arc: the whole 0-90 sweep with pathLength 90, so GuideArt can draw
    // the first `grind` units at runtime (stroke-dasharray). Same constants as lib/dialArc.ts.
    const ra = R0 - 1.6, s0 = (a(0) + 90) * Math.PI / 180, s1 = (a(90) + 90) * Math.PI / 180;
    const arc = `M${f(Math.cos(s0) * ra)} ${f(Math.sin(s0) * ra)}A${f(ra)} ${f(ra)} 0 1 1 ${f(Math.cos(s1) * ra)} ${f(Math.sin(s1) * ra)}`;
    S.raw(`<path class="dial-arc glow" pathLength="90" d="${arc}"/><path class="dial-arc" pathLength="90" d="${arc}"/>`);
    for (let v = 0; v <= 90; v += 10) S.raw(`<text transform="rotate(${f(a(v))}) translate(0 ${f(R0 - 13.5)})" text-anchor="middle" dominant-baseline="central" font-size="5.6" font-weight="700" fill="rgb(${PAPER} / .85)">${v}</text>`);
    S.raw(`<text transform="rotate(${f(a(-6))}) translate(0 ${f(R0 - 13.5)}) rotate(90)" text-anchor="middle" dominant-baseline="central" font-size="3.4" font-weight="700" letter-spacing=".4" fill="rgb(${PAPER} / .55)">FINE</text>`);
    S.raw(`<text transform="rotate(${f(a(97))}) translate(0 ${f(R0 - 13.5)}) rotate(-90)" text-anchor="middle" dominant-baseline="central" font-size="3.4" font-weight="700" letter-spacing=".4" fill="rgb(${PAPER} / .55)">COARSE</text>`);
  }
  S.raw('</g></g>');
}

// ------------------------------------------------------------------ catch cup (Weber style)
// Photo 7: matte black anodised cylinder, straight sides, a shallow waist
// groove near the bottom over a foot ring. Opaque. The bell plugs its bottom:
// a flared disc, a slender stem that thickens towards the disc, a ball knob.
const CC = { h: 62, r: 31 };
function catchCup(S, cam, cx, y0, cz, o = {}) {
  const { h, r } = CC;
  if (o.shadow !== false) groundShadow(S, cam, cx, cz, r + 4, y0, 1.1);
  const cup = G.stackLathe(cam, cx, cz, [[y0 + h, r], [y0 + 15, r], [y0 + 12, r - 1.2], [y0 + 9.5, r - 2.4], [y0 + 7, r - 1], [y0 + 4.5, r - 0.2], [y0 + 1, r - 0.4], [y0, r - 1.6]], 6);
  S.solid(cup.sil, 'black', { rim: 0.9 });
  // waist groove: shadowed above the foot, a light lip on the foot
  S.raw(`<path d="${cup.front(y0 + 11, r - 1.4)}" fill="none" stroke="#000" stroke-opacity=".8" stroke-width="1.4"/>`);
  S.hl(cup.front(y0 + 6.2, r - 0.6), 0.22);
  const lc = lathe(cam, cx, cz, [[y0 + h, r], [y0 + 16, r]]);
  S.hl(lc.streak(y0 + h - 5, y0 + 18, r, 150), 0.38);
  S.hl(lc.streak(y0 + h - 8, y0 + 22, r, 132), 0.1);
  // rim, then the dark inside (inner wall catches a little light at the back)
  S.face(cup.ring(y0 + h, r), 'rgb(70 78 80)');
  S.face(cup.ring(y0 + h, r - 1.8), o.full ? `url(#${S.id}coffee)` : '#050708');
  if (!o.full) S.face(cup.back(y0 + h, r - 1.8) + `A${f(cup.ell(y0 + h - 14, r - 1.8).rx)} ${f(cup.ell(y0 + h - 14, r - 1.8).ry)} 0 0 0 ${pt([cup.ell(y0 + h - 14, r - 1.8).cx - cup.ell(y0 + h - 14, r - 1.8).rx, cup.ell(y0 + h - 14, r - 1.8).cy])}Z`, 'rgb(255 255 255 / .05)');
  S.line(cup.ring(y0 + h, r), 's');
  return { cup, top: y0 + h, r };
}
function bell(S, cam, cx, yDisc, cz, cls = '') {
  S.open(cls);
  const disc = convexLathe(cam, cx, cz, [[yDisc + 6, 7], [yDisc + 3, 20], [yDisc + 1.4, 28], [yDisc, 28.6]]);
  S.solid(disc.sil, 'black', { under: false, rim: 0.8 });
  S.hl(disc.front(yDisc + 2.6, 22), 0.25);
  const stem = G.stackLathe(cam, cx, cz, [[yDisc + 66, 2], [yDisc + 30, 2.2], [yDisc + 12, 3.2], [yDisc + 6, 5.5], [yDisc + 4, 9]], 6);
  S.solid(stem.sil, 'black', { under: false, rim: 0.7 });
  S.raw(`<path d="${lathe(cam, cx, cz, [[yDisc + 64, 2.1], [yDisc + 10, 2.1]]).streak(yDisc + 63, yDisc + 10, 1.6, 150)}" stroke="#fff" stroke-opacity=".5" stroke-width="1"/>`);
  const knob = convexLathe(cam, cx, cz, [[yDisc + 75.5, 0.01], [yDisc + 75, 2.4], [yDisc + 73.5, 4.2], [yDisc + 71, 5.2], [yDisc + 68.5, 4.2], [yDisc + 67, 2.4], [yDisc + 66.5, 0.01]]);
  S.solid(knob.sil, 'black', { under: false, rim: 0.7 });
  const kc = cam.P(cx - 1.8, yDisc + 72.8, cz + 2);
  S.fill(circle(kc, 1.3 * cam.s), 'rgb(255 255 255 / .75)');
  S.close();
}

// ------------------------------------------------------------------ funnel
function funnel(S, cam, cx, y0, cz, cls = '') {
  S.open(cls);
  const fn = lathe(cam, cx, cz, [[y0 + 20, 40], [y0 + 19, 40.5, 1], [y0 + 6, 37.5, 1], [y0 + 1, 37.5], [y0 - 4, 33]]);
  S.solid(fn.sil, 'metal');
  S.face(fn.ring(y0 + 20, 40), `rgb(${PAPER} / .12)`);
  S.face(fn.ring(y0 + 20, 38), 'hole');
  S.line(fn.ring(y0 + 20, 40), 's');
  S.hl(fn.streak(y0 + 17, y0 + 4, 39, 148), 0.6);
  S.close();
  return fn;
}

// ------------------------------------------------------------------ impact tamper
// Stacked cylinders (photo 6): flat base flange, collar with a steel ring,
// narrow neck, rounded cap. The neck + cap is the part you press.
function tamper(S, cam, cx, y0, cz, o = {}) {
  S.open(o.cls || '');
  const face = G.stackLathe(cam, cx, cz, [[y0 + 1, 28.6], [y0 - 7, 28.6], [y0 - 7.6, 28]], 2);
  S.solid(face.sil, 'steel', { under: false, rim: 0.8 });
  const base = G.stackLathe(cam, cx, cz, [[y0 + 5, 34], [y0 + 4.2, 35], [y0 + 0.8, 35], [y0, 34.2]], 3);
  S.solid(base.sil, 'black');
  S.face(base.ring(y0 + 5, 34), `rgb(${PAPER} / .1)`);
  S.hl(base.front(y0 + 2.5, 35), 0.25);
  const body = G.stackLathe(cam, cx, cz, [[y0 + 30, 25], [y0 + 5, 25]], 2);
  S.solid(body.sil, 'black');
  S.hl(body.streak(y0 + 27, y0 + 8, 25, 150), 0.45);
  // thin steel ring where the neck slides into the collar
  const ring = G.stackLathe(cam, cx, cz, [[y0 + 33, 24.4], [y0 + 30, 25.2]], 2);
  S.solid(ring.sil, 'steel', { under: false, rim: 0.6 });
  S.face(ring.ring(y0 + 33, 24.4), 'rgb(255 255 255 / .12)');
  S.open(o.pressCls || '');
  const neck = G.stackLathe(cam, cx, cz, [[y0 + 54, 15.5], [y0 + 32, 15.5]], 2);
  S.solid(neck.sil, 'black');
  S.hl(neck.streak(y0 + 50, y0 + 36, 15.5, 150), 0.4);
  const cap = G.stackLathe(cam, cx, cz, [[y0 + 88, 16], [y0 + 87.4, 19], [y0 + 86, 21.6], [y0 + 83.5, 23.2], [y0 + 80, 23.8], [y0 + 56, 23.8], [y0 + 54, 23]], 6);
  S.solid(cap.sil, 'black');
  S.face(cap.ring(y0 + 88, 16), `rgb(${PAPER} / .07)`);
  S.hl(cap.streak(y0 + 80, y0 + 58, 23.8, 150), 0.55);
  const ct = cam.ell(cx, y0 + 86.5, cz, 20.5);
  S.raw(`<path d="M${pt([ct.cx + ct.rx * Math.cos(2.5), ct.cy + ct.ry * Math.sin(2.5)])}A${f(ct.rx)} ${f(ct.ry)} 0 0 1 ${pt([ct.cx + ct.rx * Math.cos(-2.2), ct.cy + ct.ry * Math.sin(-2.2)])}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.4"/>`);
  S.close();
  S.close();
}

// ------------------------------------------------------------------ knock box
// Photo 8: glossy black rounded tub; the front wall is cut by a deep, wide U
// scoop that sweeps up to the top at the corners; a rubber knock bar runs
// side to side just under the rim, its round end caps through the side walls.
const KB = { a: 74, d: 58, h: 124, r: 30, t: 5, by: 113, bz: -6, br: 9 };
function knockBox(S, cam, cx, cz, o = {}) {
  const { a, d, h, r, t, by, br } = KB, bz = cz + KB.bz;
  S.shadow(rrectTop(cam, cx - a - 8, cx + a + 14, cz - d - 6, cz + d + 12, 0, r + 8));
  const capDisc = (x, sgn) => { const T = cam.plane([x, by, bz], [0, 0, -1], [0, -1, 0]); return `<g transform="${T}"><circle r="12.5" fill="#0b1214" stroke="url(#${S.id}rim)" stroke-width="1" vector-effect="non-scaling-stroke"/><circle r="12.5" fill="url(#${S.id}black)" fill-opacity=".9"/><circle r="5" fill="none" stroke="rgb(${PAPER} / .28)" vector-effect="non-scaling-stroke"/><path d="M${-9 * sgn} -6a11 11 0 0 1 6 -4" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.4" vector-effect="non-scaling-stroke"/></g>`; };
  // the far end cap sticks out past the left wall
  S.raw(capDisc(cx - a - 5, -1));
  const box = rbox(cam, cx - a, cx + a, cz - d, cz + d, 0, h, r);
  S.solid(box.sil, 'black', { rim: 1 });
  // right face a touch darker
  S.face(polyD([cam.P(cx + a, h, cz + d - r), cam.P(cx + a, h, cz - d + r), cam.P(cx + a, 0, cz - d + r), cam.P(cx + a, 0, cz + d - r)]), 'rgb(0 0 0 / .25)');
  // the opening and the U scoop through the front wall
  const inner = rrectTop(cam, cx - a + t, cx + a - t, cz - d + t, cz + d - t, h, r - t);
  const U = []; const uw = a - 12, ud = 74;
  for (let i = 0; i <= 32; i++) { const th = Math.PI * i / 32, c = Math.cos(th); U.push([-uw * c, h - ud * Math.pow(Math.sin(th), 1.6) * (1 - 0.0 * c)]); }
  const Upts = (zz) => U.map(([x, y]) => cam.P(cx + x, y, zz));
  const uf = Upts(cz + d), ui = Upts(cz + d - t);
  const cut = polyD(hull(uf.concat(ui)));
  // rim band, dark inside
  S.fill(box.top + inner, `rgb(${PAPER} / .16)`, ' fill-rule="evenodd"');
  S.fill(inner, '#040809');
  S.fill(cut, '#040809');
  const cid = S.uid('kin');
  S.raw(`<clipPath id="${cid}"><path d="${inner}"/><path d="${cut}"/></clipPath><g clip-path="url(#${cid})">`);
  // back inner wall catches a soft light from above
  const gk = S.uid('kg'), gt = cam.P(cx, h, cz - d), gb = cam.P(cx, 30, cz - d);
  S.raw(`<linearGradient id="${gk}" gradientUnits="userSpaceOnUse" x1="0" y1="${f(gt[1])}" x2="0" y2="${f(gb[1])}"><stop offset="0" stop-color="#fff" stop-opacity=".09"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
  S.fill(polyD([cam.P(cx - a, h, cz - d + t), cam.P(cx + a, h, cz - d + t), cam.P(cx + a, 0, cz - d + t), cam.P(cx - a, 0, cz - d + t)]), `url(#${gk})`);
  S.raw('</g>');
  if (o.inside) o.inside({ cut, inner, sil: box.sil });
  // the knock bar, seen through the opening and the scoop
  S.raw(`<g clip-path="url(#${cid})">`);
  const bar = tube(cam, [[cx - a, by, bz], [cx, by, bz], [cx + a, by, bz]], br);
  S.solid(bar.d, 'black', { under: false, rim: 0.8 });
  S.raw(`<path d="${crD([cam.P(cx - a, by - br * 0.55, bz + br * 0.8), cam.P(cx + a, by - br * 0.55, bz + br * 0.8)])}" stroke="#000" stroke-opacity=".6" stroke-width="${f(br * cam.s * 0.5)}" fill="none"/>`);
  S.hl(crD([cam.P(cx - a, by + br * 0.7, bz + br * 0.5), cam.P(cx + a, by + br * 0.7, bz + br * 0.5)]), 0.5);
  S.raw('</g>');
  if (o.front) o.front({ cut, inner, sil: box.sil });
  // scoop edges: outer lip and the wall thickness
  S.raw(`<path d="${polyD(uf, false)}" fill="none" stroke="url(#${S.id}rim)" stroke-width="1.2"/>`);
  S.raw(`<path d="${polyD(ui, false)}" fill="none" stroke="rgb(${PAPER} / .2)" stroke-width=".8"/>`);
  S.line(inner, 's');
  // glossy highlights on the front corners and the right face
  S.hl(crD([cam.P(cx - a + 10, h - 16, cz + d - 3), cam.P(cx - a + 10, 16, cz + d - 3)]), 0.45);
  S.hl(crD([cam.P(cx + a - 3, h - 16, cz + d - 10), cam.P(cx + a - 3, 16, cz + d - 10)]), 0.3);
  S.hl(crD([cam.P(cx + a - 0.5, h - 12, cz - 10), cam.P(cx + a - 0.5, 20, cz - 10)]), 0.12);
  // near end cap on the right wall
  S.raw(capDisc(cx + a + 5, 1));
  return { top: h, by, bz, br, inner, cut, sil: box.sil };
}

// ------------------------------------------------------------------ bottles
// Photo 9: slim clear bottle with round shoulders, white ribbed screw collar,
// white pump head with a side nozzle, a clear dip tube curving to the bottom.
function sprayBottle(S, cam, cx, cz, o = {}) {
  groundShadow(S, cam, cx, cz, 18);
  const bt = G.stackLathe(cam, cx, cz, [[117, 8.6], [114, 8.9], [111, 10.4], [107.5, 13.2], [104, 15.4], [100.5, 16.6], [97, 17], [4, 17], [1.5, 16.6], [0, 15.4]], 6);
  // water, then the dip tube, seen through the bottle
  const lq = G.stackLathe(cam, cx, cz, [[62, 16], [4, 16], [1.5, 15.6], [0.8, 14.6]], 4);
  S.raw(`<path d="${lq.sil}" style="fill:var(--acc)" fill-opacity=".18"/>`);
  S.raw(`<path d="${lq.ring(62, 16)}" style="fill:var(--acc)" fill-opacity=".12"/><path d="${lq.ring(62, 16)}" fill="none" style="stroke:var(--acc)" stroke-opacity=".5" stroke-width="1"/>`);
  const tubeP = [[cx, 116, cz], [cx + 0.5, 80, cz], [cx + 3, 40, cz + 2], [cx + 9, 12, cz + 6], [cx + 12, 3, cz + 8]].map((p) => cam.P(...p));
  S.raw(`<path d="${crD(tubeP)}" stroke="rgb(${PAPER} / .42)" stroke-width="${f(Math.max(1.2, 2.6 * cam.s))}" fill="none"/><path d="${crD(tubeP)}" stroke="rgb(20 40 44 / .6)" stroke-width="${f(Math.max(0.5, 1.2 * cam.s))}" fill="none"/>`);
  S.solid(bt.sil, 'glass');
  S.face(bt.ring(117, 8.6), 'rgb(255 255 255 / .06)');
  const sl = lathe(cam, cx, cz, [[96, 17], [4, 17]]);
  S.hl(sl.streak(94, 8, 17, 150), 0.7);
  S.hl(sl.streak(92, 20, 17, 120), 0.18);
  S.hl(sl.streak(88, 14, 17, 50), 0.22);
  S.raw(`<path d="${bt.front(2.5, 16.4)}" fill="none" stroke="rgb(255 255 255 / .3)" stroke-width="1"/>`);
  // white ribbed collar
  const collar = G.stackLathe(cam, cx, cz, [[128, 11.4], [127.2, 12.1], [114.6, 12.1], [114, 11.6]], 3);
  S.solid(collar.sil, 'white', { rim: 0.8 });
  S.line(lathe(cam, cx, cz, [[127, 12.1], [115, 12.1]]).ribs(115.5, 126.5, 12.1, 16), 'rgb(0 0 0 / .14)');
  S.face(collar.ring(128, 11.4), 'rgb(255 255 255 / .35)');
  S.open(o.pumpCls || '');
  const stem = lathe(cam, cx, cz, [[131, 3.2], [127.5, 3.2]]);
  S.solid(stem.sil, 'white', { under: false });
  const head = G.stackLathe(cam, cx, cz, [[147, 7.4], [146, 8.6], [144, 9], [132, 9], [131, 8.4]], 3);
  S.solid(head.sil, 'white', { rim: 0.8 });
  S.face(head.ring(147, 7.4), 'rgb(255 255 255 / .6)');
  S.hl(lathe(cam, cx, cz, [[144, 9], [132, 9]]).streak(143, 133, 9, 140), 0.8);
  // nozzle on the side facing the beans (+x)
  const nz = cam.right(cx + 9.05, 140, cz);
  S.raw(`<g transform="${nz}"><circle r="2.6" fill="rgb(0 0 0 / .15)"/><circle r="1.3" fill="#26383c"/></g>`);
  S.close();
  return { nozzle: cam.P(cx + 10, 140, cz) };
}
// Photo 10: amber glass, straight body, round shoulders, short neck with a
// lip the cap screws onto.
function mineralBottle(S, cam, bx, bz, o = {}) {
  groundShadow(S, cam, bx, bz, 20);
  // neck (behind the dropper)
  const neck = G.stackLathe(cam, bx, bz, [[86, 8.2], [84.5, 8.8], [80.5, 8.8], [79.6, 8]], 3);
  S.solid(neck.sil, 'amber', { under: false });
  S.face(neck.ring(86, 6.2), 'deep');
  S.line(neck.front(80.2, 8.6), 's');
  if (o.dropper) o.dropper();
  const bottle = G.stackLathe(cam, bx, bz, [[79.6, 7.8], [76, 8], [74.5, 9.2], [72.5, 12.4], [70, 15.4], [66.5, 17.6], [62, 18.8], [57, 19.2], [5, 19.2], [2, 18.7], [0, 17.4]], 6);
  S.solid(bottle.sil, 'amber');
  const liq = G.stackLathe(cam, bx, bz, [[38, 17.8], [5, 17.8], [2.4, 17.2], [1.4, 16]], 4);
  S.fill(liq.sil, 'rgb(242 179 61 / .26)');
  S.raw(`<path d="${liq.ring(38, 17.8)}" fill="rgb(255 210 120 / .08)" stroke="rgb(255 210 120 / .45)" stroke-width=".9"/>`);
  const st = lathe(cam, bx, bz, [[57, 19.2], [5, 19.2]]);
  S.hl(st.streak(54, 10, 19.2, 152), 0.75);
  S.hl(st.streak(50, 28, 19.2, 58), 0.2);
  // shoulder catches a curved highlight
  const sh = [[70, 15.2], [67, 17.2], [63.5, 18.4]].map(([y, r]) => { const e = cam.ell(bx, y, bz, r); return [e.cx + e.rx * Math.cos(150 * Math.PI / 180), e.cy + e.ry * Math.sin(150 * Math.PI / 180)]; });
  S.raw(`<path d="${crD(sh)}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.6"/>`);
  return bottle;
}
// eyedropper: glass pipette, black ribbed screw cap, rubber bulb. (x, y, z) = cap bottom
function dropper(S, cam, x, y, z, o = {}) {
  const pip = G.stackLathe(cam, x, z, [[y + 1, 3.1], [y - 54, 3.1], [y - 60, 1.8], [y - 64, 1.1]], 4);
  S.solid(pip.sil, 'glass', { rim: 0.8 });
  S.raw(`<path d="${lathe(cam, x, z, [[y, 2.6], [y - 50, 2.6]]).streak(y - 4, y - 50, 2.6, 150)}" stroke="rgb(255 255 255 / .45)" stroke-width="1"/>`);
  // ribbed screw cap over a thin tamper ring
  const ring = G.stackLathe(cam, x, z, [[y + 3, 10.4], [y, 10.4]], 2);
  S.solid(ring.sil, 'black', { rim: 0.6 });
  const cap = G.stackLathe(cam, x, z, [[y + 17, 9.6], [y + 16.2, 10.4], [y + 3.6, 10.4], [y + 3, 10]], 3);
  S.solid(cap.sil, 'black', { rim: 0.8 });
  S.raw(`<path d="${lathe(cam, x, z, [[y + 16, 10.4], [y + 4, 10.4]]).ribs(y + 4, y + 15.6, 10.4, 15)}" stroke="rgb(255 255 255 / .16)" stroke-width="1"/>`);
  S.face(cap.ring(y + 17, 9.6), 'rgb(255 255 255 / .06)');
  S.open(o.bulbCls || '', o.bulbCls ? ` style="transform-origin:${f(cam.P(x, y + 17, z)[0])}px ${f(cam.P(x, y + 17, z)[1])}px"` : '');
  const bulb = G.stackLathe(cam, x, z, [[y + 44, 0.01], [y + 43.4, 3], [y + 41.5, 5.6], [y + 37, 7.2], [y + 29, 7.2], [y + 22, 6.4], [y + 19.5, 6.6], [y + 18, 8], [y + 17, 8.2]], 6);
  S.solid(bulb.sil, 'black', { rim: 0.8 });
  S.raw(`<path d="${bulb.front(y + 19, 7)}" fill="none" stroke="rgb(255 255 255 / .18)" stroke-width="1"/>`);
  S.hl(lathe(cam, x, z, [[y + 40, 6.4], [y + 23, 6.4]]).streak(y + 39, y + 24, 6.6, 145), 0.5);
  S.close();
  return { tip: cam.P(x, y - 64, z) };
}

// ------------------------------------------------------------------ shaker + glass
// Three-piece cobbler shaker: tapered body, strainer top, small cap.
function polish(S, L, y0, y1, r) {
  // mirror steel: a few vertical reflection bands
  for (const [ang, w, c, op] of [[160, 5, '#fff', 0.55], [140, 2, '#fff', 0.8], [112, 7, '#000', 0.28], [70, 3, '#fff', 0.22], [40, 6, '#000', 0.35], [18, 2, '#fff', 0.4]]) S.raw(`<path d="${L.streak(y0, y1, r, ang)}" stroke="${c}" stroke-opacity="${op}" stroke-width="${w}" fill="none"/>`);
}
function shaker(S, cam, cx, cz, o = {}) {
  // body 130 tall, 66 across the foot flaring to 88 at the mouth
  const body = lathe(cam, cx, cz, [[130, 44], [129, 44.6, 1], [122, 44], [8, 34], [2, 33.2], [0, 31.6]]);
  S.solid(body.sil, 'metal');
  const id = S.uid('sb'); S.raw(`<clipPath id="${id}"><path d="${body.sil}"/></clipPath><g clip-path="url(#${id})">`);
  polish(S, body, 128, 1, 39);
  S.raw('</g>');
  S.open(o.topCls || '');
  const top = lathe(cam, cx, cz, [[192, 14.2], [188, 15.6], [178, 20], [164, 31], [150, 40.6], [140, 44.6, 1], [129, 44.8]]);
  S.solid(top.sil, 'metal');
  const id2 = S.uid('st'); S.raw(`<clipPath id="${id2}"><path d="${top.sil}"/></clipPath><g clip-path="url(#${id2})">`);
  polish(S, top, 190, 128, 30);
  S.raw('</g>');
  S.line(top.front(140, 44.6), 's');
  S.close();
  S.open(o.capCls || '');
  const cap = lathe(cam, cx, cz, [[210, 11.6], [208.4, 13.6, 1], [193, 14.6], [190.5, 14.2]]);
  S.solid(cap.sil, 'metal');
  S.face(cap.ring(210, 11.6), `rgb(${PAPER} / .3)`);
  S.hl(cap.streak(207, 194, 14, 148), 0.8);
  S.close();
  return { body, top, cap, spoutY: 192 };
}
function glass(S, cam, cx, cz, o = {}) {
  groundShadow(S, cam, cx, cz, 34, 0, 1.05);
  const prof = [[84, 34], [6, 30, 1], [0, 30]];
  const gl = lathe(cam, cx, cz, prof);
  if (o.inside) o.inside(gl);
  S.solid(gl.sil, 'glass');
  S.face(gl.ring(84, 34), `rgb(${PAPER} / .05)`);
  S.line(gl.ring(84, 34), 'p');
  S.raw(`<path d="${lathe(cam, cx, cz, [[6, 28.5], [5.9, 28.5]]).front(6, 28.5)}" stroke="rgb(${PAPER} / .3)" fill="none"/>`);
  S.hl(gl.streak(78, 12, 33, 150), 0.7);
  S.hl(gl.streak(74, 20, 33, 60), 0.3);
  return gl;
}

module.exports = { BK, basketProf, basketWall, basket, KB, CC, bellows, handleMarble, espressoCup, CUP_H, portafilter, groundsMound, paperDisc, de1, DE, ghc, grinder, GR, dialFace, catchCup, bell, funnel, tamper, knockBox, sprayBottle, mineralBottle, dropper, shaker, glass, circle, ellipseD, groundShadow, drop, scale, dots, FONT, DOSE, BEANS, bean, dosingCup, PAPER };
