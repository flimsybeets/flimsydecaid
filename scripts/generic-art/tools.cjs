// Portafilter, basket and the hand tools (all generic shapes, modelled in mm).
const G = require('./geo.cjs');
const { convexLathe, stackLathe, ellD, lathe, f, pt, crD, polyD, hull, revolve, tube, circ3, add3, norm3 } = G;
const { PAPER } = require('./style.cjs');
const O = require('./objects.cjs');
const { circle, groundShadow, aboveClip, clipTo, wallStreak, rAt } = O;

// ------------------------------------------------------------------ basket
// Straight-walled 58 mm basket, 21 mm deep, with a small flared lip and a
// flat perforated floor. y0 = top of the lip.
const basketProf = (y0) => [
  [y0 + 0.8, 31], [y0, 31.6, 1], [y0 - 1.2, 30.2, 1], [y0 - 2.4, 29.4, 1],
  [y0 - 11, 29.1], [y0 - 20, 29.0], [y0 - 21, 28.2, 1], [y0 - 21.8, 27],
];
function basketWall(S, cam, cx, y0, cz, yTop = y0 + 0.8) {
  const prof = basketProf(y0).filter(([y]) => y <= yTop + 1e-6);
  const w = stackLathe(cam, cx, cz, prof, 4);
  S.solid(w.sil, 'brushed');
  S.raw(`<path d="${w.front(y0 - 2.8, 30)}" fill="none" stroke="rgb(255 255 255 / .5)" stroke-width="1"/>`);
  wallStreak(S, cam, cx, cz, prof, Math.min(yTop, y0 - 3.5), y0 - 19, 146, 0.75, 2.2);
  wallStreak(S, cam, cx, cz, prof, Math.min(yTop, y0 - 3.5), y0 - 19, 40, 0.28, 1.4);
  S.raw(`<path d="${w.front(y0 - 21, 28.4)}" fill="none" stroke="rgb(255 255 255 / .3)" stroke-width="1"/>`);
  return w;
}
function holes(S, cam, cx, y, cz, rMax, dx = 0, cls = '') {
  let hd = '';
  for (const [rk, n] of [[0, 1], [5, 7], [10, 13], [15, 19], [20, 25]]) {
    if (rk > rMax) break;
    for (let i = 0; i < n; i++) { const a = (i + (rk % 10 ? 0.5 : 0)) / n * 2 * Math.PI; const p = cam.P(cx + rk * Math.cos(a), y, cz + rk * Math.sin(a)); hd += `M${f(p[0] - 0.35)} ${f(p[1])}h.7`; }
  }
  S.raw(`<path d="${hd}" stroke="rgb(10 18 20 / .75)" stroke-width="${f(Math.max(1, cam.s * 0.55))}" stroke-linecap="round" fill="none"${cls ? ` class="${cls}"` : ''}/>`);
}
// the whole basket on its own (the Basket scene)
function basket(S, cam, cx, y0, cz) {
  const w = basketWall(S, cam, cx, y0, cz);
  S.face(w.ring(y0 + 0.8, 31), `rgb(${PAPER} / .22)`);
  S.face(w.ring(y0 + 0.8, 28.8), 'rgb(14 24 26 / .9)');
  clipTo(S, w.ring(y0 + 0.8, 28.8));
  const inner = stackLathe(cam, cx, cz, [[y0 + 0.8, 28.8], [y0 - 20, 28.2]], 4);
  S.fill(inner.sil, `url(#${S.id}brushed)`, ' fill-opacity=".5"');
  S.fill(ellD(cam.ell(cx, y0 - 20, cz, 28.2)), 'rgb(70 84 86)');
  holes(S, cam, cx, y0 - 20, cz, 22);
  S.raw(`<path d="${w.back(y0 - 20, 28.2)}" fill="none" stroke="rgb(0 0 0 / .4)" stroke-width="1"/>`);
  S.raw('</g>');
  S.line(w.ring(y0 + 0.8, 31), 's');
  S.line(w.ring(y0 + 0.8, 28.8), 's');
  S.hl(w.front(y0 + 0.8, 30.8), 0.45);
  return w;
}

// ------------------------------------------------------------------ portafilter
// Generic bottomless portafilter: round holder with two ears, steel stem and
// a plain glossy black handle (130 long).
const HANDLE = [[0, 9], [8, 9.6], [22, 11.4], [44, 13.6], [70, 14.6], [96, 14], [114, 12.2], [126, 9.6], [133, 6.2], [137.5, 3], [139, 1]];
function handleBlack(S, cam, a, dir, prof) {
  const rv = revolve(cam, a, dir, prof, 6);
  S.solid(rv.d, 'black', { under: false, rim: 0.9 });
  const n = rv.C.length;
  const at = (t, w) => { const x = Math.max(0, Math.min(1, t)) * (n - 1), i = Math.min(n - 2, Math.floor(x)), u = x - i; const c = (k, j) => rv.L[k][j] + (rv.R[k][j] - rv.L[k][j]) * (w + 1) / 2; return [c(i, 0) * (1 - u) + c(i + 1, 0) * u, c(i, 1) * (1 - u) + c(i + 1, 1) * u]; };
  const sw = (pts) => crD(pts.map(([t, w]) => at(t, w)));
  // a finger groove ring near each end, a long specular streak, a hot spot
  for (const t of [0.12, 0.88]) S.raw(`<path d="${sw([[t, -0.92], [t, 0], [t, 0.92]])}" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="1.2"/>`);
  S.raw(`<path d="${sw([[0.08, -0.55], [0.3, -0.6], [0.5, -0.62], [0.7, -0.58], [0.86, -0.45]])}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.6" stroke-linecap="round"/>`);
  S.raw(`<path d="${sw([[0.46, -0.5], [0.55, -0.52], [0.63, -0.49]])}" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2.4" stroke-linecap="round"/>`);
  S.raw(`<path d="${sw([[0.3, 0.7], [0.5, 0.75], [0.72, 0.65]])}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="1.2" stroke-linecap="round"/>`);
  return rv;
}
function moundD(cam, cx, y0, cz, r = 28.6, rise = 4.5) {
  const e = cam.ell(cx, y0 - 1.5, cz, r);
  const top = cam.P(cx - 2, y0 + rise, cz + 1);
  return `M${f(e.cx - e.rx)} ${f(e.cy)}C${f(e.cx - e.rx * 0.7)} ${f(top[1] - 1)} ${f(e.cx - e.rx * 0.2)} ${f(top[1] - 3)} ${f(top[0])} ${f(top[1] - 3)}C${f(e.cx + e.rx * 0.3)} ${f(top[1] - 3)} ${f(e.cx + e.rx * 0.75)} ${f(top[1])} ${f(e.cx + e.rx)} ${f(e.cy)}A${f(e.rx)} ${f(e.ry)} 0 0 1 ${f(e.cx - e.rx)} ${f(e.cy)}Z`;
}
function groundsMound(S, cam, cx, y0, cz, cls = '', o = {}) {
  const d = moundD(cam, cx, y0, cz, o.r, o.rise);
  S.raw(`<g${cls ? ` class="${cls}"` : ''}>`);
  S.fill(d, `url(#${S.id}coffee)`);
  S.fill(d, 'rgb(255 220 180 / .08)');
  let g = '';
  for (let i = 0; i < 30; i++) { const t = (i * 0.61803) % 1, r = Math.sqrt(t) * 24, a = i * 2.4; const p = cam.P(cx + r * Math.cos(a), y0 + 2.5 - r * 0.12, cz + r * Math.sin(a)); g += `M${f(p[0] - 0.7)} ${f(p[1])}h1.4`; }
  S.raw(`<path d="${g}" stroke="rgb(255 225 190 / .35)" stroke-width="1.1" stroke-linecap="round" fill="none"/>`);
  S.raw('</g>');
  return d;
}
// a flat bed of grounds at height y (leveled or tamped)
function groundsFlat(S, cam, cx, y, cz, cls = '', o = {}) {
  const e = cam.ell(cx, y, cz, o.r ?? 28.6);
  S.raw(`<g${cls ? ` class="${cls}"` : ''}>`);
  S.fill(ellD(e), `url(#${S.id}coffee)`);
  S.fill(ellD(e), o.tamped ? 'rgb(0 0 0 / .16)' : 'rgb(255 220 180 / .1)');
  let g = '';
  for (let i = 0; i < (o.tamped ? 8 : 24); i++) { const t = (i * 0.61803) % 1, r = Math.sqrt(t) * 24, a = i * 2.4; const p = cam.P(cx + r * Math.cos(a), y, cz + r * Math.sin(a)); g += `M${f(p[0] - 0.7)} ${f(p[1])}h1.4`; }
  S.raw(`<path d="${g}" stroke="rgb(255 225 190 / ${o.tamped ? 0.18 : 0.32})" stroke-width="1.1" stroke-linecap="round" fill="none"/>`);
  S.raw(`<path d="${ellD({ ...e, rx: e.rx * 0.98, ry: e.ry * 0.98 })}" fill="none" stroke="rgb(0 0 0 / .3)" stroke-width="1"/>`);
  S.raw('</g>');
}
function paperDisc(S, cam, cx, y, cz, cls = '') {
  const e = cam.ell(cx, y, cz, 28);
  S.raw(`<g${cls ? ` class="${cls}"` : ''}>`);
  S.fill(ellD(e), 'rgb(246 248 244 / .9)');
  S.fill(ellD({ ...e, rx: e.rx * 0.97, ry: e.ry * 0.93 }), 'none', ' stroke="rgb(255 255 255 / .9)" stroke-width=".8"');
  S.fill(ellD({ ...e, cx: e.cx - e.rx * 0.2, cy: e.cy - e.ry * 0.25, rx: e.rx * 0.45, ry: e.ry * 0.3 }), 'rgb(255 255 255 / .5)');
  S.raw('</g>');
}

// (cx, y0, cz) = top of the basket rim. ang = handle direction in the ground
// plane (degrees from +x towards +z). content: 'none' (holder only), 'empty',
// 'grounds', 'level', 'tamped', 'paper'.
function portafilter(S, cam, cx, y0, cz, o = {}) {
  const R = Math.PI / 180, ang = (o.ang ?? 143) * R, tilt = (o.tilt ?? -4) * R;
  const content = o.content ?? 'empty';
  const dir = norm3([Math.cos(ang) * Math.cos(tilt), Math.sin(tilt), Math.sin(ang) * Math.cos(tilt)]);
  const toward = -dir[0] * cam.sa + dir[2] * cam.ca > -0.15;
  const parts = {};
  const drawHandle = () => {
    const a0 = [cx + dir[0] * 30, y0 - 7 + dir[1] * 30, cz + dir[2] * 30];
    const stem = tube(cam, [a0, add3(a0, dir, 14), add3(a0, dir, 30)], 5.5);
    S.solid(stem.d, 'metal', { under: false });
    const [u, v] = G.perp(dir);
    S.line(polyD(circ3(cam, add3(a0, dir, 27), u, v, 5.6, 24, 0, 360)), 's');
    parts.handle = handleBlack(S, cam, add3(a0, dir, 30), dir, HANDLE);
  };
  if (!toward && o.handle !== false) drawHandle();
  if (content !== 'none') parts.bot = basketWall(S, cam, cx, y0, cz, y0 - 11);
  for (const s of [-1, 1]) {
    const e = [Math.cos(ang + s * Math.PI / 2), 0, Math.sin(ang + s * Math.PI / 2)];
    const p0 = [cx + e[0] * 33, y0 - 6, cz + e[2] * 33];
    S.solid(tube(cam, [p0, add3(p0, e, 5), add3(p0, e, 9.5)], 3.4).d, 'metal', { under: false });
  }
  const holder = stackLathe(cam, cx, cz, [[y0 - 0.6, 36], [y0 - 1.4, 36.5], [y0 - 12, 36.2], [y0 - 13.6, 34.6]], 3);
  S.solid(holder.sil, 'metal');
  S.face(holder.ring(y0 - 0.6, 36), 'top');
  S.line(holder.ring(y0 - 0.6, 36), 's');
  S.hl(holder.streak(y0 - 3, y0 - 11, 36.3, 148), 0.55);
  parts.holder = holder;
  if (content !== 'none') {
    S.face(holder.ring(y0, 31.2), `rgb(${PAPER} / .16)`);
    S.line(holder.ring(y0, 31.2), 's');
    S.face(holder.ring(y0, 28.8), 'hole');
    clipTo(S, holder.ring(y0, 28.8));
    S.face(holder.ring(y0 - 6, 28.6), 'rgb(0 0 0 / .25)');
    if (content === 'empty' || o.floor) {
      S.face(holder.ring(y0 - 20, 28.2), `rgb(${PAPER} / .1)`);
      holes(S, cam, cx, y0 - 20, cz, 22);
    }
    if (content === 'grounds') parts.mound = groundsMound(S, cam, cx, y0, cz, o.groundsCls);
    if (content === 'level') groundsFlat(S, cam, cx, y0 - 3, cz, o.groundsCls);
    if (content === 'tamped' || content === 'paper' || o.tampedCls) groundsFlat(S, cam, cx, y0 - 7, cz, o.tampedCls || '', { tamped: true });
    if (content === 'paper') paperDisc(S, cam, cx, y0 - 6.6, cz);
    if (o.inside) o.inside(holder);
    S.raw('</g>');
    S.line(holder.front(y0, 28.8), 's');
  }
  if (toward && o.handle !== false) drawHandle();
  parts.dir = dir;
  return parts;
}
// The portafilter turned over (basket floor up) for the knock box.
function invertedPortafilter(S, cam, cx, y0, cz, ang0 = 150) {
  const ang = ang0 * Math.PI / 180;
  const dir = norm3([Math.cos(ang), 0.05, Math.sin(ang)]);
  const holder = stackLathe(cam, cx, cz, [[y0 + 13.6, 34.6], [y0 + 12, 36.2], [y0 + 1.4, 36.5], [y0 + 0.6, 36]], 3);
  S.solid(holder.sil, 'metal');
  S.hl(lathe(cam, cx, cz, [[y0 + 12, 36.3], [y0 + 2, 36.3]]).streak(y0 + 11, y0 + 3, 36.3, 148), 0.55);
  for (const s of [-1, 1]) {
    const e = [Math.cos(ang + s * Math.PI / 2), 0, Math.sin(ang + s * Math.PI / 2)];
    const p0 = [cx + e[0] * 33, y0 + 6, cz + e[2] * 33];
    S.solid(tube(cam, [p0, add3(p0, e, 5), add3(p0, e, 9.5)], 3.4).d, 'metal', { under: false });
  }
  S.face(holder.ring(y0 + 13.6, 34.6), 'rgb(0 0 0 / .4)');
  const prof = [[y0 + 13, 29.1], [y0 + 14, 29.1], [y0 + 24, 29.0], [y0 + 33, 29.0], [y0 + 33.8, 28.2]];
  const cyl = convexLathe(cam, cx, cz, prof);
  S.solid(cyl.sil, 'brushed');
  wallStreak(S, cam, cx, cz, prof, y0 + 32, y0 + 15, 146, 0.7, 2);
  wallStreak(S, cam, cx, cz, prof, y0 + 32, y0 + 15, 40, 0.28, 1.3);
  S.face(cyl.ring(y0 + 33.8, 28.2), 'rgb(150 162 162 / .55)');
  S.face(cyl.ring(y0 + 33.8, 28.2), 'top');
  S.line(cyl.ring(y0 + 33.8, 28.2), 's');
  holes(S, cam, cx, y0 + 33.8, cz, 22);
  const a0 = [cx + dir[0] * 30, y0 + 7, cz + dir[2] * 30];
  S.solid(tube(cam, [a0, add3(a0, dir, 14), add3(a0, dir, 30)], 5.5).d, 'metal', { under: false });
  handleBlack(S, cam, add3(a0, dir, 30), dir, HANDLE);
}

// ------------------------------------------------------------------ funnel
// Plain dosing funnel: a conical ring that sits on the holder; you look
// through it into the basket.
function funnelRing(S, cam, cx, y0, cz, cls = '') {
  S.open(cls);
  const H = 15;
  const fn = stackLathe(cam, cx, cz, [[y0 + H, 42], [y0 + H - 1, 42.5], [y0 + 4, 38.2], [y0 + 1, 37.4], [y0 - 1, 36.2]], 4);
  const top = fn.ell(y0 + H, 37), bot = fn.ell(y0 - 1, 30);
  const ellPts = (e, n = 96) => Array.from({ length: n }, (_, i) => { const a = i / n * 2 * Math.PI; return [e.cx + e.rx * Math.cos(a), e.cy + e.ry * Math.sin(a)]; });
  const inEll = (e, p) => ((p[0] - e.cx) / e.rx) ** 2 + ((p[1] - e.cy) / e.ry) ** 2 <= 1.0001;
  const l = polyD(hull(ellPts(top).filter((p) => inEll(bot, p)).concat(ellPts(bot).filter((p) => inEll(top, p)))));
  const k = S.uid('fr');
  S.defs.push(`<path id="${k}" d="${fn.sil}${l}" fill-rule="evenodd"/>`);
  S.raw(`<use href="#${k}" fill="url(#${S.id}bg)" fill-opacity="1" fill-rule="evenodd"/><use href="#${k}" fill="url(#${S.id}metal)" fill-rule="evenodd"/><use href="#${k}" fill="url(#${S.id}under)" fill-rule="evenodd"/><use href="#${k}" fill="none" stroke="url(#${S.id}rim)" stroke-width="1.1"/>`);
  S.fill(ellD(top) + l, 'rgb(0 0 0 / .3)', ' fill-rule="evenodd"');
  S.fill(fn.ring(y0 + H, 42) + fn.ring(y0 + H, 37), `rgb(${PAPER} / .16)`, ' fill-rule="evenodd"');
  S.line(fn.ring(y0 + H, 42), 's');
  S.line(fn.ring(y0 + H, 37), 's');
  wallStreak(S, cam, cx, cz, [[y0 + H, 42], [y0 + 4, 38.2]], y0 + H - 3, y0 + 4, 148, 0.6, 1.5);
  S.close();
  return fn;
}

// ------------------------------------------------------------------ hand tools
// Flat tamper: steel base, short neck, a pear-shaped black handle.
function tamper(S, cam, cx, y0, cz, o = {}) {
  S.open(o.cls || '');
  const base = stackLathe(cam, cx, cz, [[y0 + 11, 28], [y0 + 10, 29.4, 1], [y0 + 1.6, 29.4, 1], [y0, 28.4]], 3);
  S.solid(base.sil, 'steel', { rim: 0.9 });
  S.face(base.ring(y0 + 11, 28), `rgb(${PAPER} / .2)`);
  S.hl(base.front(y0 + 6, 29.4), 0.25);
  S.open(o.pressCls || '');
  const neck = stackLathe(cam, cx, cz, [[y0 + 36, 7], [y0 + 22, 8], [y0 + 14, 12], [y0 + 11, 17]], 4);
  S.solid(neck.sil, 'steel', { under: false, rim: 0.8 });
  const hp = [[y0 + 88, 10], [y0 + 86, 17], [y0 + 80, 23], [y0 + 68, 27], [y0 + 54, 26], [y0 + 44, 20], [y0 + 38, 12], [y0 + 36, 8]];
  const hd = stackLathe(cam, cx, cz, hp, 5);
  S.solid(hd.sil, 'black', { rim: 0.9 });
  S.face(hd.ring(y0 + 88, 10), `rgb(${PAPER} / .08)`);
  wallStreak(S, cam, cx, cz, hp, y0 + 82, y0 + 52, 150, 0.55, 2);
  wallStreak(S, cam, cx, cz, hp, y0 + 74, y0 + 58, 40, 0.18, 1.4);
  S.close();
  S.close();
}
// Metal mesh puck screen (thin perforated disc). cls on the group.
function puckScreen(S, cam, cx, y, cz, cls = '') {
  S.open(cls);
  const d = stackLathe(cam, cx, cz, [[y + 1.8, 27.6], [y + 1.4, 27.8], [y + 0.4, 27.8], [y, 27.2]], 3);
  S.solid(d.sil, 'brushed', { under: false, rim: 0.9 });
  S.face(d.ring(y + 1.8, 27.6), 'rgb(150 162 162 / .6)');
  S.face(d.ring(y + 1.8, 27.6), 'top');
  S.raw(`<g transform="${cam.top(cx, y + 1.8, cz)}">`);
  let dots = '';
  for (const [r, n] of [[0, 1], [4.5, 6], [9, 12], [13.5, 18], [18, 24], [22.5, 30]]) for (let i = 0; i < n; i++) { const a = (i + (r % 9 ? 0.5 : 0)) / n * 2 * Math.PI; dots += `M${f(r * Math.cos(a))} ${f(r * Math.sin(a))}h.01`; }
  S.raw(`<path d="${dots}" stroke="rgb(8 16 18 / .78)" stroke-width="1.7" stroke-linecap="round" fill="none"/>`);
  S.raw(`<circle r="25" fill="none" stroke="rgb(255 255 255 / .35)" stroke-width=".8" vector-effect="non-scaling-stroke"/>`);
  S.raw('</g>');
  S.line(d.ring(y + 1.8, 27.6), 's');
  S.close();
}
// WDT tool: black grip, steel collar and a holder with a ring of fine needles.
// (cx, yb, cz): bottom of the needle holder.
function wdtTool(S, cam, cx, yb, cz, o = {}) {
  S.open(o.cls || '');
  const needles = [[0, 0]];
  for (let i = 0; i < 9; i++) { const a = i / 9 * 2 * Math.PI; needles.push([9 * Math.cos(a), 9 * Math.sin(a)]); }
  for (let i = 0; i < 5; i++) { const a = (i + 0.5) / 5 * 2 * Math.PI; needles.push([4.4 * Math.cos(a + 0.6), 4.4 * Math.sin(a + 0.6)]); }
  let nd = '';
  for (const [dx, dz] of needles) { const a = cam.P(cx + dx, yb, cz + dz), b = cam.P(cx + dx, yb - 25, cz + dz); nd += `M${pt(a)}L${pt(b)}`; }
  S.raw(`<path d="${nd}" stroke="rgb(214 226 224 / .92)" stroke-width="1.15" stroke-linecap="round" fill="none"/>`);
  S.raw(`<path d="${nd}" stroke="rgb(0 0 0 / .25)" stroke-width="2.4" stroke-linecap="round" fill="none" transform="translate(1.2 0.8)" opacity=".5"/>`);
  const hd = stackLathe(cam, cx, cz, [[yb + 5, 15], [yb + 4, 15.8], [yb + 1, 15.8], [yb, 15]], 3);
  S.solid(hd.sil, 'steel', { rim: 0.9 });
  S.face(hd.ring(yb + 5, 15), `rgb(${PAPER} / .2)`);
  const col = stackLathe(cam, cx, cz, [[yb + 14, 7.4], [yb + 5, 8.4]], 3);
  S.solid(col.sil, 'steel', { under: false, rim: 0.8 });
  const gp = [[yb + 96, 12], [yb + 94, 16], [yb + 88, 17.4], [yb + 40, 15.6], [yb + 24, 12.4], [yb + 16, 9.6], [yb + 14, 8]];
  const grip = stackLathe(cam, cx, cz, gp, 5);
  S.solid(grip.sil, 'black', { rim: 0.9 });
  S.face(grip.ring(yb + 96, 12), `rgb(${PAPER} / .1)`);
  wallStreak(S, cam, cx, cz, gp, yb + 90, yb + 30, 150, 0.55, 2);
  for (const y of [yb + 56, yb + 62, yb + 68, yb + 74]) S.raw(`<path d="${grip.front(y, rAt(gp, y))}" fill="none" stroke="rgb(255 255 255 / .12)" stroke-width="1"/>`);
  S.close();
}
// Distribution tool: wide steel disc with spoked face, a stem and a black knob.
// (cx, y0, cz) = bottom of the disc. Marks on the face and knob turn (k-spin).
function distributor(S, cam, cx, y0, cz, o = {}) {
  S.open(o.cls || '');
  const dh = 9;
  const disc = stackLathe(cam, cx, cz, [[y0 + dh, 28], [y0 + dh - 1, 29.2, 1], [y0 + 1.6, 29.2, 1], [y0, 27.6]], 3);
  S.solid(disc.sil, 'steel', { rim: 0.9 });
  S.face(disc.ring(y0 + dh, 28), `rgb(${PAPER} / .2)`);
  S.hl(disc.front(y0 + 5, 29.2), 0.25);
  S.raw(`<g transform="${cam.top(cx, y0 + dh, cz)}"><g class="${o.spin || 'k-spin'}">`);
  let sp = '';
  for (let i = 0; i < 3; i++) { const a = i * 2 * Math.PI / 3; sp += `M${f(7 * Math.cos(a))} ${f(7 * Math.sin(a))}Q${f(17 * Math.cos(a + 0.35))} ${f(17 * Math.sin(a + 0.35))} ${f(26 * Math.cos(a + 0.2))} ${f(26 * Math.sin(a + 0.2))}`; }
  S.raw(`<path d="${sp}" stroke="rgb(8 16 18 / .6)" stroke-width="3" stroke-linecap="round" fill="none"/><path d="${sp}" stroke="rgb(255 255 255 / .5)" stroke-width="1" stroke-linecap="round" fill="none" transform="translate(-.8 -.8)"/>`);
  S.raw('</g></g>');
  S.line(disc.ring(y0 + dh, 28), 's');
  const stem = stackLathe(cam, cx, cz, [[y0 + dh + 24, 5.6], [y0 + dh + 6, 6.2], [y0 + dh, 9]], 3);
  S.solid(stem.sil, 'steel', { under: false, rim: 0.8 });
  const kp = [[y0 + dh + 52, 12], [y0 + dh + 50, 19], [y0 + dh + 43, 23], [y0 + dh + 32, 24], [y0 + dh + 24, 18], [y0 + dh + 22, 8]];
  const knob = stackLathe(cam, cx, cz, kp, 5);
  S.solid(knob.sil, 'black', { rim: 0.9 });
  S.face(knob.ring(y0 + dh + 52, 12), `rgb(${PAPER} / .09)`);
  wallStreak(S, cam, cx, cz, kp, y0 + dh + 46, y0 + dh + 28, 150, 0.55, 2);
  S.raw(`<g transform="${cam.top(cx, y0 + dh + 52, cz)}"><g class="${o.spin || 'k-spin'}"><path d="M-5.6 0H5.6" stroke="var(--acc)" stroke-width="2.4" stroke-linecap="round"/></g></g>`);
  S.close();
}

module.exports = { basketProf, basketWall, basket, holes, portafilter, invertedPortafilter, groundsMound, groundsFlat, paperDisc, funnelRing, tamper, puckScreen, wdtTool, distributor, handleBlack, HANDLE };
