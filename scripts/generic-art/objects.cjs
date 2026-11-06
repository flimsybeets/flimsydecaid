// Brand-neutral objects for the generic Guide me art, modelled in millimetres
// and projected with geo.cjs (same projection as every other scene).
const G = require('./geo.cjs');
const { convexLathe, stackLathe, ellD, rbox, rrectTop, lathe, f, pt, crD, polyD, hull, revolve, tube, circ3, add3, norm3 } = G;
const { PAPER } = require('./style.cjs');

const circle = (c, r) => `M${f(c[0] - r)} ${f(c[1])}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const drop = (x, y, r) => `M${f(x)} ${f(y - r * 2.1)}C${f(x + r * 0.35)} ${f(y - r * 1.2)} ${f(x + r)} ${f(y - r * 0.55)} ${f(x + r)} ${f(y)}A${f(r)} ${f(r)} 0 0 1 ${f(x - r)} ${f(y)}C${f(x - r)} ${f(y - r * 0.55)} ${f(x - r * 0.35)} ${f(y - r * 1.2)} ${f(x)} ${f(y - r * 2.1)}Z`;
const groundShadow = (S, cam, cx, cz, r, y = 0, k = 1.12) => { const e = cam.ell(cx + r * 0.08, y, cz + r * 0.1, r); S.shadow(ellD({ ...e, rx: e.rx * k, ry: e.ry * k * 1.15 })); };
// the part of the plane above an ellipse's centre line plus the ellipse:
// where something dropping into an opening stays visible
const aboveClip = (S, e) => { const id = S.uid('ac'); S.raw(`<clipPath id="${id}"><path d="M-2000 -2000H2000V${f(e.cy)}H-2000Z"/><path d="${ellD(e)}"/></clipPath>`); return id; };
const clipTo = (S, d, cls = '') => { const id = S.uid('cl'); S.raw(`<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})"${cls ? ` class="${cls}"` : ''}>`); return id; };
const px = (v) => `${f(v)}px`;
// radius at height y along a profile [[y, r], ...] (any order)
function rAt(prof, y) {
  const p = prof.slice().sort((a, b) => b[0] - a[0]);
  if (y >= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) if (y >= p[i][0]) { const t = (y - p[i][0]) / (p[i - 1][0] - p[i][0]); return p[i][1] + (p[i - 1][1] - p[i][1]) * t; }
  return p[p.length - 1][1];
}
// a highlight that follows a (tapered) wall: angle in degrees (0 = right, 90 = front)
function wallStreak(S, cam, cx, cz, prof, ya, yb, ang, op = 0.6, w = 1.6, col = '#fff') {
  const pts = [];
  for (let i = 0; i <= 8; i++) { const y = ya + (yb - ya) * i / 8, r = rAt(prof, y), a = ang * Math.PI / 180; pts.push(cam.P(cx + r * Math.cos(a), y, cz + r * Math.sin(a))); }
  S.raw(`<path d="${crD(pts)}" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round"/>`);
}

// ------------------------------------------------------------------ beans
// A bean is drawn flat in screen space (rx 9, ry 6.4 at scale 1).
const beanD = 'M-9 0a9 6.4 0 1 0 18 0a9 6.4 0 1 0 -18 0Z';
function bean(S, x, y, rot, sc = 1, cls = '') {
  S.raw(`<g${cls ? ` class="${cls}"` : ''} transform="translate(${f(x)} ${f(y)}) rotate(${rot}) scale(${f(sc)})">`);
  S.raw(`<path d="${beanD}" fill="url(#${S.id}coffee)" stroke="rgb(255 225 190 / .35)" stroke-width=".9"/>`);
  S.raw('<path d="M-6.5 1.6C-3 -2.8 2.5 3.4 6.5 -1.4" fill="none" stroke="#1a0e06" stroke-opacity=".8" stroke-width="1.3" stroke-linecap="round"/>');
  S.raw('</g>');
}
// a heap of beans on a dome inside a round opening (centre cx,cz, radius r at height y)
function beanHeap(S, cam, cx, y, cz, r, n = 15, bs = 1) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, rr = r * Math.sqrt(t), a = i * 2.39996;
    const h = 7 * (1 - (rr / r) ** 2);
    const p = cam.P(cx + rr * Math.cos(a), y + h, cz + rr * Math.sin(a));
    list.push({ p, rot: (i * 67) % 180 - 60, sc: bs * (0.94 + ((i * 37) % 7) / 60) });
  }
  list.sort((a, b) => a.p[1] - b.p[1]);
  for (const b of list) bean(S, b.p[0], b.p[1], b.rot, b.sc);
}

// ------------------------------------------------------------------ cups
// Wide dosing cup / catch cup: straight-ish ceramic tumbler, opaque enough to
// hide what is behind it. Foot at (cx, y0, cz).
const CUP = { h: 46, r: 34 };
function dosingCup(S, cam, cx, y0, cz, o = {}) {
  const h = o.h ?? CUP.h, R = o.r ?? CUP.r;
  if (o.shadow !== false) groundShadow(S, cam, cx, cz, R + 4, y0, 1.1);
  const prof = [[y0 + h, R], [y0 + h - 1.2, R + 0.5, 1], [y0 + h * 0.7, R - 2.6], [y0 + 8, R - 7.4], [y0 + 2.4, R - 9.6, 1], [y0, R - 10.4]];
  const body = stackLathe(cam, cx, cz, prof, 6);
  S.solid(body.sil, o.tone ?? 'ceramic');
  S.face(body.ring(y0 + h, R), 'top');
  S.face(body.ring(y0 + h - 0.6, R - 2.8), 'hole');
  const inner = cam.ell(cx, y0 + h - 0.6, cz, R - 2.8);
  if (o.inside) {
    clipTo(S, body.ring(y0 + h - 0.6, R - 2.8));
    o.inside({ body, y0, h, R, inner });
    S.raw('</g>');
  }
  S.line(body.ring(y0 + h, R), 'p');
  S.line(body.ring(y0 + h - 0.6, R - 2.8), 's');
  wallStreak(S, cam, cx, cz, prof, y0 + h - 5, y0 + 12, 150, 0.6, 1.8);
  return { ...body, top: y0 + h, rimY: y0 + h - 0.6, rimR: R - 2.8, inner, h, R, y0 };
}

// Espresso cup with a handle on the right (60 mm across, 52 tall).
function espressoCup(S, cam, cx, y0, cz, o = {}) {
  const H = 52, R0 = 30;
  const ht = cam.plane([cx + R0 - 5, y0 + 31, cz + 4], [1, 0, -0.35], [0, -1, 0]);
  S.raw(`<g transform="${ht}">`);
  S.solid('M0 -17C9.5 -19.5 18 -15 18 -7C18 1.4 9.5 6 0 6L0 .8C6 .8 11.6 -2.2 11.6 -7C11.6 -11.8 6 -12.4 0 -11.6Z', 'ceramic');
  S.raw('</g>');
  const prof = [[y0 + H, R0], [y0 + H - 1.4, R0 + 0.4, 1], [y0 + 40, R0 - 1.2], [y0 + 24, R0 - 5.6], [y0 + 12, R0 - 10.4], [y0 + 4, R0 - 14], [y0 + 1.2, R0 - 15.4, 1], [y0, R0 - 16]];
  const cup = stackLathe(cam, cx, cz, prof, 6);
  S.solid(cup.sil, 'ceramic');
  S.face(cup.ring(y0 + H, R0), 'top');
  const li = o.level ?? 2.4;
  S.face(cup.ring(y0 + H - 0.4, R0 - 2.4), 'hole');
  if (o.inside) { clipTo(S, cup.ring(y0 + H - 0.4, R0 - 2.4)); o.inside(cup); S.raw('</g>'); }
  S.line(cup.ring(y0 + H, R0), 'p');
  S.line(cup.ring(y0 + H - 0.4, R0 - 2.4), 's');
  wallStreak(S, cam, cx, cz, prof, y0 + 46, y0 + 20, 150, 0.55, 1.8);
  cup.rimR = R0 - 2.4; cup.rimY = y0 + H - 0.4; cup.H = H; cup.R0 = R0;
  return cup;
}
// saucer under an espresso cup
function saucer(S, cam, cx, y0, cz) {
  groundShadow(S, cam, cx, cz, 52, y0, 1.08);
  const sc = stackLathe(cam, cx, cz, [[y0 + 5, 52], [y0 + 4.2, 52.4, 1], [y0 + 2, 46], [y0 + 1.4, 38], [y0, 36]], 4);
  S.solid(sc.sil, 'ceramic');
  S.face(sc.ring(y0 + 5, 52), 'top');
  S.face(sc.ring(y0 + 3.6, 44), 'rgb(0 0 0 / .14)');
  S.line(sc.ring(y0 + 5, 52), 'p');
  S.line(sc.ring(y0 + 3.6, 44), 's');
  return sc;
}

// ------------------------------------------------------------------ scale
// Plain square scale: 96 x 96 x 15, smoked top with a level platform line,
// an LCD window along the front edge and two round buttons.
// Returns the plane transform and centre of the display (live weight).
function scale(S, cam, cx, cz, y0, o = {}) {
  const a = 48, h = 15, r = 13;
  S.shadow(rrectTop(cam, cx - a - 6, cx + a + 9, cz - a - 5, cz + a + 8, y0, r + 6));
  const b = rbox(cam, cx - a, cx + a, cz - a, cz + a, y0, y0 + h, r);
  S.solid(b.sil, 'dark', { rim: 1 });
  const c0 = cam.P(cx + a - r, y0 + h, cz + a), c1 = cam.P(cx + a, y0 + h, cz + a - r);
  const gid = S.uid('g');
  S.raw(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${f(c0[0])}" y1="0" x2="${f(c1[0])}" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>`);
  S.fill(b.sil, `url(#${gid})`);
  S.hl(`M${pt(cam.P(cx - a + r, y0 + h - 1.2, cz + a))}L${pt(cam.P(cx + a - r, y0 + h - 1.2, cz + a))}`, 0.35);
  const inset = 3.6, top = y0 + h;
  const panel = rrectTop(cam, cx - a + inset, cx + a - inset, cz - a + inset, cz + a - inset, top, r - inset);
  S.fill(panel, 'rgb(20 34 38 / .9)');
  S.fill(panel, `url(#${S.id}top)`, ' opacity=".55"');
  S.raw(`<g transform="${cam.top(cx, top, cz)}">`);
  S.raw(`<rect x="-31" y="-38" width="62" height="54" rx="6" fill="rgb(0 0 0 / .28)" stroke="rgb(${PAPER} / .2)" stroke-width=".9" vector-effect="non-scaling-stroke"/>`);
  S.raw(`<rect x="-23" y="22.5" width="46" height="15" rx="2.4" fill="rgb(0 0 0 / .72)" stroke="rgb(${PAPER} / .18)" stroke-width=".8" vector-effect="non-scaling-stroke"/>`);
  for (const x of [-34.5, 34.5]) S.raw(`<circle cx="${x}" cy="30" r="3.5" fill="rgb(0 0 0 / .5)" stroke="rgb(${PAPER} / .32)" stroke-width=".8" vector-effect="non-scaling-stroke"/>`);
  S.raw(`<path d="M-34.5 28.6v2.8M-35.9 30h2.8M33.1 30h2.8" stroke="rgb(${PAPER} / .4)" stroke-width=".7" fill="none"/>`);
  S.raw('</g>');
  S.line(panel, 's');
  return { top, lcd: cam.top(cx, top, cz), lcdAt: [0, 30.2] };
}

module.exports = { rAt, wallStreak, circle, drop, groundShadow, aboveClip, clipTo, px, bean, beanHeap, dosingCup, CUP, espressoCup, saucer, scale };
