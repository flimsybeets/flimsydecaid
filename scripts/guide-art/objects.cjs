// Shared objects for the Guide me scenes, modelled in millimetres.
const G = require('./geo.cjs');
const { Cam, ellD, frontArcD, backArcD, rbox, rrectTop, lathe, f, pt, crD, polyD, smoothClosedD, hull, revolve, tube, circ3, add3, norm3 } = G;
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
  S.raw(`<rect x="-34" y="23" width="25" height="11" rx="1.6" fill="rgb(0 0 0 / .62)"/><rect x="9" y="23" width="25" height="11" rx="1.6" fill="rgb(0 0 0 / .62)"/>`);
  if (o.right !== false) S.raw(dots('0.0', 21.5, 28.5, 0.9, `rgb(${PAPER} / .55)`));
  if (o.left) S.raw(dots(o.left, -21.5, 28.5, 0.9, 'var(--acc)'));
  S.raw('</g>');
  S.line(panel, 's');
  return { top, lcd: cam.top(cx, top, cz), lcdAt: [-21.5, 28.5] };
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
  const w = (cols.length - 1) * pitch, x0 = cx - w / 2, y0 = cy - 3 * pitch, r = pitch * 0.36;
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
  S.line(DOSE.lip, 'p');
  S.line(DOSE.back, 's');
  S.hl('M14 26C15 48 26 72 46 92');
  S.raw('</g>');
  return T;
}


// ------------------------------------------------------------------ espresso cup
// 60 mm across, 56 mm tall, handle to the right. Foot at (cx, y0, cz).
const CUP_H = 56;
function espressoCup(S, cam, cx, y0, cz, o = {}) {
  const ht = cam.plane([cx + 26, y0 + 30, cz + 6], [1, 0, -0.35], [0, -1, 0]);
  S.raw(`<g transform="${ht}">`);
  S.solid('M0 -17C9 -19 17 -15 17 -7C17 1 9 6 0 6L0 1C6 1 11 -2 11 -7C11 -12 6 -13 0 -12Z', 'ceramic');
  S.raw('</g>');
  const cup = lathe(cam, cx, cz, [[y0 + 56, 30], [y0 + 54.4, 30.4, 1], [y0 + 44, 29.4], [y0 + 26, 25], [y0 + 10, 20.5], [y0 + 2, 17.8], [y0, 16.4]]);
  S.solid(cup.sil, 'ceramic');
  S.face(cup.ring(y0 + 56, 30), 'top');
  S.face(cup.ring(y0 + 55.6, 27.4), 'hole');
  if (o.inside) { const id = S.uid('ci'); S.raw(`<clipPath id="${id}"><path d="${cup.ring(y0 + 55.6, 27.4)}"/></clipPath><g clip-path="url(#${id})">`); o.inside(cup); S.raw('</g>'); }
  S.line(cup.ring(y0 + 56, 30), 'p');
  S.line(cup.ring(y0 + 55.6, 27.4), 's');
  S.hl(cup.streak(y0 + 48, y0 + 20, 26, 150), 0.5);
  return cup;
}

// ------------------------------------------------------------------ portafilter
// Decent naked portafilter: bottomless holder ring with two ears, steel stem,
// teardrop handle (30042 drawing: 140 long, 23 at the stem, 33 at the belly)
// in glossy marbled purple and black resin. Convex (domed) basket.
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
  // naked bottom: the basket's lower wall and its domed floor show under the ring
  if (content !== 'none') {
    const bot = lathe(cam, cx, cz, [[y0 - 12, 28.6], [y0 - 19, 27.8], [y0 - 22.5, 25.6], [y0 - 25.4, 18], [y0 - 26.8, 8], [y0 - 27.2, 0.01]]);
    S.solid(bot.sil, 'metal');
    S.hl(bot.streak(y0 - 14, y0 - 21, 27.8, 140), 0.45);
    parts.bot = bot;
  }
  // ears
  for (const s of [-1, 1]) {
    const e = [Math.cos(ang + s * Math.PI / 2), 0, Math.sin(ang + s * Math.PI / 2)];
    const p0 = [cx + e[0] * 33, y0 - 6, cz + e[2] * 33];
    const ear = tube(cam, [p0, add3(p0, e, 5), add3(p0, e, 9.5)], 3.4);
    S.solid(ear.d, 'metal', { under: false });
  }
  const holder = lathe(cam, cx, cz, [[y0 - 0.6, 36], [y0 - 1.4, 36.5, 1], [y0 - 12, 36.2], [y0 - 13.6, 34.6]]);
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
      S.face(holder.ring(y0 - 20, 27.5), `rgb(${PAPER} / .08)`);
      for (let i = 0; i < 18; i++) { const a = i * 0.9, r = 4 + (i % 6) * 3.8; const p = cam.P(cx + r * Math.cos(a * 3.1), y0 - 20, cz + r * Math.sin(a * 3.1)); S.fill(circle(p, 0.5 * cam.s), `rgb(${PAPER} / .25)`); }
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
  S.solid(sil, 'cream');
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
  // body
  const body = lathe(cam, gx, gz, [[body1, r], [body0, r]]);
  S.solid(body.sil, 'cream');
  S.hl(body.streak(body1 - 10, body0 + 20, r, 150), 0.5);
  S.hl(body.streak(body1 - 30, body0 + 40, r, 128), 0.16);
  // power button with its light, on the front of the body
  const pb = cam.plane([gx + r * Math.cos(110 * Math.PI / 180), 120, gz + r * Math.sin(110 * Math.PI / 180)], [Math.cos(20 * Math.PI / 180), 0, -Math.sin(20 * Math.PI / 180)], [0, -1, 0]);
  S.raw(`<g transform="${pb}"><circle r="6" fill="rgb(0 0 0 / .45)" stroke="rgb(${PAPER} / .4)" stroke-width="1" vector-effect="non-scaling-stroke"/><circle r="3" fill="none" stroke="rgb(${PAPER} / .55)" stroke-width="1" vector-effect="non-scaling-stroke"/>${o.power ? `<g class="${o.power}"><circle r="11" fill="url(#${S.id}glow)"/><circle r="3" fill="none" stroke="#fff" stroke-width="1.4" vector-effect="non-scaling-stroke"/></g>` : ''}</g>`);
  // catch cup on the platform, then the chute over it
  if (o.cup !== false) catchCup(S, cam, ccx, 44, ccz, { bell: false, ...(o.cupOpts || {}) });
  if (o.beforeChute) o.beforeChute({ ccx, ccz });
  const c0 = [gx + cd[0] * (r - 12), 182, gz + cd[2] * (r - 12)];
  const ch = tube(cam, [c0, add3(c0, cd, 18), add3(c0, cd, 34), [ccx - cd[0] * 6, 172, ccz - cd[2] * 6], [ccx, 156, ccz], [ccx, 140, ccz]], 26, 10);
  S.solid(ch.d, 'cream');
  const cap = ch.cap(ch.smp.length - 1, 1);
  const chuteEnd = lathe(cam, ccx, ccz, [[150, 31], [128, 31], [126, 30]]);
  S.solid(chuteEnd.sil, 'cream');
  S.line(chuteEnd.front(150, 31), 's');
  S.hl(crD(ch.L.slice(4, -8).map((p, i, a) => [p[0] + (ch.R[i + 4][0] - p[0]) * 0.22, p[1] + (ch.R[i + 4][1] - p[1]) * 0.22])), 0.45);
  // top: dial ring, collar, bellows, lid
  const dial = lathe(cam, gx, gz, [[dial1, r + 3], [dial1 - 1, r + 4, 1], [body1 + 1, r + 4], [body1, r + 3]]);
  S.solid(dial.sil, 'cream');
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
// black rubber bellows: stacked rounded convolutions, bottom to top
function bellows(S, cam, gx, gz, y0, y1, n = 5) {
  const h = (y1 - y0) / n;
  const neck = lathe(cam, gx, gz, [[y1, 31], [y0, 31]]);
  S.solid(neck.sil, 'dark', { under: false, rim: 0.6 });
  for (let i = 0; i < n; i++) {
    const a = y0 + i * h;
    const c = lathe(cam, gx, gz, [[a + h, 31.5], [a + h * 0.82, 35.4], [a + h * 0.5, 37], [a + h * 0.18, 35.4], [a, 31.5]]);
    S.solid(c.sil, 'dark', { rim: 0.8 });
    S.hl(c.front(a + h * 0.62, 36.6), 0.16);
    S.hl(c.streak(a + h * 0.8, a + h * 0.25, 36, 150), 0.5);
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
    for (let v = 0; v <= 90; v += 10) S.raw(`<text transform="rotate(${f(a(v))}) translate(0 ${f(R0 - 13.5)})" text-anchor="middle" dominant-baseline="central" font-size="5.6" font-weight="700" fill="rgb(${PAPER} / .85)">${v}</text>`);
    S.raw(`<text transform="rotate(${f(a(-6))}) translate(0 ${f(R0 - 13.5)}) rotate(90)" text-anchor="middle" dominant-baseline="central" font-size="3.4" font-weight="700" letter-spacing=".4" fill="rgb(${PAPER} / .55)">FINE</text>`);
    S.raw(`<text transform="rotate(${f(a(97))}) translate(0 ${f(R0 - 13.5)}) rotate(-90)" text-anchor="middle" dominant-baseline="central" font-size="3.4" font-weight="700" letter-spacing=".4" fill="rgb(${PAPER} / .55)">COARSE</text>`);
  }
  S.raw('</g></g>');
}

// ------------------------------------------------------------------ catch cup (Weber style)
// Straight black cylinder with a foot ring, the bell inside: a disc with a
// slender stem and ball knob.
function catchCup(S, cam, cx, y0, cz, o = {}) {
  const h = 64, r = 31;
  if (o.shadow !== false) groundShadow(S, cam, cx, cz, r + 4, y0, 1.1);
  const cup = lathe(cam, cx, cz, [[y0 + h, r], [y0 + h - 1, r + 0.4, 1], [y0 + 12, r + 0.4, 1], [y0 + 10.5, r - 1.6, 1], [y0 + 1.5, r - 1.6], [y0, r - 2.6]]);
  S.solid(cup.sil, 'dark');
  S.line(cup.front(y0 + 11.5, r + 0.3), 's');
  S.hl(cup.streak(y0 + h - 5, y0 + 16, r, 150), 0.5);
  S.face(cup.ring(y0 + h, r), `rgb(${PAPER} / .1)`);
  S.face(cup.ring(y0 + h, r - 2.2), o.full ? `url(#${S.id}coffee)` : 'hole');
  S.line(cup.ring(y0 + h, r), 's');
  return { cup, top: y0 + h, r };
}
function bell(S, cam, cx, yDisc, cz, cls = '') {
  S.open(cls);
  const stem = lathe(cam, cx, cz, [[yDisc + 62, 2.2], [yDisc + 2, 2.2]]);
  S.solid(stem.sil, 'dark', { under: false });
  const knob = lathe(cam, cx, cz, [[yDisc + 74, 0.01], [yDisc + 72, 4.6], [yDisc + 68, 6.4], [yDisc + 64, 4.6], [yDisc + 62, 0.01]]);
  S.solid(knob.sil, 'dark', { under: false });
  S.hl(knob.streak(yDisc + 71, yDisc + 66, 5, 140), 0.7);
  const disc = lathe(cam, cx, cz, [[yDisc + 4, 3], [yDisc + 1, 26.5], [yDisc, 28.4]]);
  S.solid(disc.sil, 'dark', { under: false });
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
  const base = lathe(cam, cx, cz, [[y0 + 5, 34], [y0 + 4, 35, 1], [y0 + 1, 35], [y0, 34]]);
  const face = lathe(cam, cx, cz, [[y0 + 1, 28.6], [y0 - 7, 28.6]]);
  S.solid(face.sil, 'metal', { under: false });
  S.solid(base.sil, 'dark');
  S.face(base.ring(y0 + 5, 34), `rgb(${PAPER} / .08)`);
  const body = lathe(cam, cx, cz, [[y0 + 34, 24], [y0 + 33, 25, 1], [y0 + 5, 25]]);
  S.solid(body.sil, 'dark');
  const ring = lathe(cam, cx, cz, [[y0 + 30, 25.4], [y0 + 27, 25.4]]);
  S.solid(ring.sil, 'metal', { under: false });
  S.hl(body.streak(y0 + 25, y0 + 8, 25, 150), 0.5);
  S.face(body.ring(y0 + 34, 24), `rgb(${PAPER} / .08)`);
  S.open(o.pressCls || '');
  const neck = lathe(cam, cx, cz, [[y0 + 52, 12.5], [y0 + 30, 12.5]]);
  S.solid(neck.sil, 'dark');
  S.hl(neck.streak(y0 + 50, y0 + 36, 12.5, 150), 0.4);
  const cap = lathe(cam, cx, cz, [[y0 + 84, 14], [y0 + 83, 17.5], [y0 + 79, 19.5], [y0 + 70, 20], [y0 + 54, 19.5], [y0 + 51, 18]]);
  S.solid(cap.sil, 'dark');
  S.face(cap.ring(y0 + 84, 14), `rgb(${PAPER} / .1)`);
  S.hl(cap.streak(y0 + 79, y0 + 56, 19.6, 148), 0.55);
  S.close();
  S.close();
}

// ------------------------------------------------------------------ knock box
// Rounded tub (photo 8) with a deep U scoop in the front and a bar across.
function knockBox(S, cam, cx, cz, o = {}) {
  const a = 76, d = 60, h = 128, r = 26, t = 6;
  S.shadow(rrectTop(cam, cx - a - 8, cx + a + 14, cz - d - 6, cz + d + 12, 0, r + 8));
  const box = rbox(cam, cx - a, cx + a, cz - d, cz + d, 0, h, r);
  S.solid(box.sil, 'dark');
  // right face a touch darker
  S.face(polyD([cam.P(cx + a, h, cz + d - r), cam.P(cx + a, h, cz - d + r), cam.P(cx + a, 0, cz - d + r), cam.P(cx + a, 0, cz + d - r)]), 'rgb(0 0 0 / .22)');
  // rim (wall thickness) and the dark inside
  const outer = rrectTop(cam, cx - a, cx + a, cz - d, cz + d, h, r);
  const inner = rrectTop(cam, cx - a + t, cx + a - t, cz - d + t, cz + d - t, h, r - t);
  S.fill(outer + inner, `rgb(${PAPER} / .13)`, ' fill-rule="evenodd"');
  S.fill(inner, '#030809');
  // far inside walls catch a little light
  S.fill(rrectTop(cam, cx - a + t, cx + a - t, cz - d + t, cz + d - t, h - 34, r - t), 'rgb(255 255 255 / .03)');
  // U scoop through the front wall: front plane and inner plane, joined
  const U = []; for (let i = 0; i <= 24; i++) { const th = Math.PI * i / 24; U.push([-46 * Math.cos(th), 70 * Math.sin(th) ** 0.9]); }
  const Upts = (zz) => U.map(([x, y]) => cam.P(cx + x, h - y, zz));
  const uf = Upts(cz + d), ui = Upts(cz + d - t);
  const cut = polyD(hull(uf.concat(ui)));
  S.fill(cut, '#030809');
  if (o.inside) o.inside({ cut, inner });
  // edges
  S.raw(`<path d="${polyD(uf, false)}" fill="none" stroke="url(#${S.id}rim)" stroke-width="1.1"/>`);
  S.raw(`<path d="${polyD(ui, false)}" fill="none" stroke="rgb(${PAPER} / .18)" stroke-width=".8"/>`);
  S.line(inner, 's');
  // glossy highlights
  S.hl(crD([cam.P(cx - a + 9, h - 14, cz + d - 2.5), cam.P(cx - a + 9, 14, cz + d - 2.5)]), 0.45);
  S.hl(crD([cam.P(cx + a - 2.5, h - 14, cz + d - 9), cam.P(cx + a - 2.5, 14, cz + d - 9)]), 0.28);
  // the knock bar across the middle, round end caps through the sides
  const by = h + 3, bz = cz - 2;
  const bar = tube(cam, [[cx - a - 2, by, bz], [cx, by, bz], [cx + a + 2, by, bz]], 8);
  S.solid(bar.d, 'dark', { under: false });
  S.hl(crD([cam.P(cx - a + 6, by + 5.5, bz + 3), cam.P(cx + a - 6, by + 5.5, bz + 3)]), 0.45);
  const capT = cam.plane([cx + a + 2, by, bz], [0, 0, -1], [0, -1, 0]);
  S.raw(`<g transform="${capT}"><circle r="12" fill="#0a1214" stroke="url(#${S.id}rim)" stroke-width="1" vector-effect="non-scaling-stroke"/><circle r="4.5" fill="none" stroke="rgb(${PAPER} / .3)" vector-effect="non-scaling-stroke"/></g>`);
  return { top: h, by, bz, inner, cut };
}

// ------------------------------------------------------------------ bottles
function sprayBottle(S, cam, cx, cz, o = {}) {
  groundShadow(S, cam, cx, cz, 18);
  const bt = lathe(cam, cx, cz, [[116, 10.5], [113, 11.5], [107, 15.5, 1], [101, 16.5], [4, 16.5], [1, 15.8], [0, 14.4]]);
  const lq = lathe(cam, cx, cz, [[66, 15.4], [5, 15.4], [2, 14.6]]);
  S.raw(`<path d="${lq.sil}" style="fill:var(--acc)" fill-opacity=".2"/>`);
  S.raw(`<path d="${lq.ring(66, 15.4)}" fill="none" style="stroke:var(--acc)" stroke-opacity=".55" stroke-width="1"/>`);
  S.raw(`<path d="M${pt(cam.P(cx + 1.5, 116, cz))}L${pt(cam.P(cx + 3.5, 4, cz))}" stroke="rgb(${PAPER} / .35)" stroke-width="1.4" fill="none"/>`);
  S.solid(bt.sil, 'glass');
  S.hl(bt.streak(98, 10, 16.5, 150), 0.7);
  S.hl(bt.streak(92, 24, 16.5, 58), 0.22);
  const collar = lathe(cam, cx, cz, [[128, 11.6], [127, 12.2, 1], [114, 12.2]]);
  S.solid(collar.sil, 'white');
  S.line(collar.ribs(115, 126.5, 12.2, 10), 'rgb(0 0 0 / .16)');
  S.open(o.pumpCls || '');
  const stem = lathe(cam, cx, cz, [[131, 3], [127, 3]]);
  S.solid(stem.sil, 'white', { under: false });
  const head = lathe(cam, cx, cz, [[146, 8.4], [145, 9.2, 1], [132, 9.2], [131, 8.8]]);
  S.solid(head.sil, 'white');
  S.face(head.ring(146, 8.4), 'rgb(255 255 255 / .55)');
  // nozzle hole on the side facing the beans (+x)
  const nz = cam.right(cx + 9.2, 140, cz);
  S.raw(`<g transform="${nz}"><ellipse rx="2.4" ry="2.4" fill="#33464a"/></g>`);
  S.close();
  return { nozzle: cam.P(cx + 10, 140, cz) };
}
function mineralBottle(S, cam, bx, bz, o = {}) {
  groundShadow(S, cam, bx, bz, 20);
  // neck (behind the dropper)
  const neck = lathe(cam, bx, bz, [[86, 8.4], [76, 8.4]]);
  S.solid(neck.sil, 'amber', { under: false });
  S.face(neck.ring(86, 6.4), 'deep');
  S.line(neck.front(83, 8.5) + neck.front(80, 8.5), 's');
  if (o.dropper) o.dropper();
  const bottle = lathe(cam, bx, bz, [[78, 8.4], [76, 9.2], [73, 12.6], [68, 16.6], [62, 18.6], [56, 19.2, 1], [6, 19.2, 1], [2, 18.4], [0, 16.6]]);
  S.solid(bottle.sil, 'amber');
  const liq = lathe(cam, bx, bz, [[36, 17.6], [6, 17.6], [2.6, 16.6], [1.6, 15]]);
  S.fill(liq.sil, 'rgb(242 179 61 / .28)');
  S.raw(`<path d="${liq.ring(36, 17.6)}" fill="none" stroke="rgb(255 210 120 / .45)" stroke-width=".9"/>`);
  S.hl(bottle.streak(52, 12, 19.2, 152), 0.75);
  S.hl(bottle.streak(64, 58, 18, 150), 0.55);
  S.hl(bottle.streak(50, 28, 19.2, 58), 0.2);
  return bottle;
}
// eyedropper: glass pipette, black ribbed screw cap, rubber bulb. (x, y, z) = cap bottom
function dropper(S, cam, x, y, z, o = {}) {
  const pip = lathe(cam, x, z, [[y + 1, 3.1], [y - 52, 3.1], [y - 60, 1.6], [y - 64, 1]]);
  S.solid(pip.sil, 'glass', { rim: 0.8 });
  S.raw(`<path d="${pip.streak(y - 4, y - 50, 2.6, 150)}" stroke="rgb(255 255 255 / .45)" stroke-width="1"/>`);
  const cap = lathe(cam, x, z, [[y + 15, 9.4], [y + 14.2, 10.2, 1], [y + 0.8, 10.2], [y, 9.6]]);
  S.solid(cap.sil, 'dark');
  S.line(cap.ribs(y + 1, y + 14, 10.2, 13), 's');
  S.open(o.bulbCls || '', o.bulbCls ? ` style="transform-origin:${f(cam.P(x, y + 15, z)[0])}px ${f(cam.P(x, y + 15, z)[1])}px"` : '');
  const bulb = lathe(cam, x, z, [[y + 40, 0.01], [y + 39, 3.8], [y + 36.5, 6.4], [y + 31, 7.6], [y + 23, 7.2], [y + 18.5, 6], [y + 17, 7, 1], [y + 15, 8]]);
  S.solid(bulb.sil, 'dark');
  S.line(bulb.front(y + 17, 7), 's');
  S.hl(bulb.streak(y + 36, y + 22, 7, 145), 0.55);
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
  S.line(body.front(122, 44), 's');
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

module.exports = { bellows, handleMarble, espressoCup, CUP_H, portafilter, groundsMound, paperDisc, de1, DE, ghc, grinder, GR, dialFace, catchCup, bell, funnel, tamper, knockBox, sprayBottle, mineralBottle, dropper, shaker, glass, circle, ellipseD, groundShadow, drop, scale, dots, FONT, DOSE, BEANS, bean, dosingCup, PAPER };
