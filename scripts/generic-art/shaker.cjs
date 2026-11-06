// Generic objects for the "shake it" scene: a three-piece cobbler shaker (tapered
// steel cup, strainer cap, small top cap) and a tumbler with ice. Modelled in
// millimetres like every other object here (geo.cjs projection); no brands.
const G = require('./geo.cjs');
const { stackLathe, f, pt, ellD } = G;
const O = require('./objects.cjs');
const { groundShadow, wallStreak } = O;

// Shaker profile pieces, heights above its foot (mm). Total 192.
const BODY = [[128, 42], [126.8, 42.6, 1], [118, 41.2], [64, 35.2], [12, 29.4], [3.4, 27.4, 1], [0, 26.2]];
const CAP = [[172, 18.4], [168, 20.8], [160, 28], [150, 35.6], [138, 40.8], [130.6, 42.6], [128, 42.6, 1]];
const TOP = [[191, 11.4], [189.6, 14.4], [187.4, 16], [183, 16.6, 1], [174, 17], [172, 17.6, 1]];

// Upright at (cx, y0, cz): the caller turns and animates it as a whole.
function shaker(S, cam, cx, y0, cz) {
  const at = (p) => p.map(([y, r, c]) => (c ? [y0 + y, r, 1] : [y0 + y, r]));
  const body = stackLathe(cam, cx, cz, at(BODY), 6);
  S.solid(body.sil, 'metal');
  // soft frost on the lower half: a pale veil that fades out upwards
  const gid = S.uid('fr');
  const a = cam.P(cx, y0 + 110, cz), b = cam.P(cx, y0 + 6, cz);
  S.raw(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="${f(a[1])}" x2="0" y2="${f(b[1])}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".2"/></linearGradient>`);
  S.fill(body.sil, `url(#${gid})`);
  S.face(body.ring(y0 + 128, 42), 'top');
  S.line(body.front(y0 + 126.6, 42.4), 's');
  // a band round the cup, and its highlight
  S.line(body.front(y0 + 100, 38.6), 's');
  wallStreak(S, cam, cx, cz, at(BODY), y0 + 118, y0 + 14, 150, 0.7, 2.2);
  wallStreak(S, cam, cx, cz, at(BODY), y0 + 112, y0 + 30, 52, 0.22, 1.6);
  // condensation beads on the front
  const beads = [[70, 62, 1.5], [52, 100, 1.1], [86, 118, 1.3], [38, 128, 1.6], [64, 140, 1], [28, 78, 1.2], [92, 84, 1], [46, 56, 1.2]];
  for (const [y, ang, r] of beads) {
    const rr = 29 + (y / 128) * 12.2, an = ang * Math.PI / 180;
    const p = cam.P(cx + rr * Math.cos(an), y0 + y, cz + rr * Math.sin(an));
    S.raw(`<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${r}" fill="rgb(255 255 255 / .22)" stroke="rgb(255 255 255 / .6)" stroke-width=".7"/>`);
    S.raw(`<circle cx="${f(p[0] - r * 0.3)}" cy="${f(p[1] - r * 0.3)}" r="${f(r * 0.32)}" fill="#fff" fill-opacity=".85"/>`);
  }
  // strainer cap
  const cap = stackLathe(cam, cx, cz, at(CAP), 6);
  S.solid(cap.sil, 'metal');
  S.line(cap.front(y0 + 130.2, 42.6), 'p');
  S.line(cap.front(y0 + 159, 28.6), 's');
  // strainer slots across the shoulder
  for (let k = 0; k < 7; k++) {
    const an = (36 + k * 18) * Math.PI / 180;
    const p = cam.P(cx + 37.6 * Math.cos(an), y0 + 146.4, cz + 37.6 * Math.sin(an));
    S.raw(`<ellipse cx="${f(p[0])}" cy="${f(p[1])}" rx="${f(1.5 + 0.9 * Math.abs(Math.cos(an)))}" ry="1.7" fill="rgb(2 8 10 / .6)" stroke="rgb(255 255 255 / .3)" stroke-width=".5"/>`);
  }
  wallStreak(S, cam, cx, cz, at(CAP), y0 + 166, y0 + 134, 150, 0.7, 2);
  // small top cap
  const top = stackLathe(cam, cx, cz, at(TOP), 6);
  S.solid(top.sil, 'metal');
  S.line(top.front(y0 + 172.4, 17.6), 'p');
  S.line(top.front(y0 + 183.2, 16.6), 's');
  wallStreak(S, cam, cx, cz, at(TOP), y0 + 188, y0 + 175, 150, 0.7, 1.8);
  return { body, cap, top, topP: cam.P(cx, y0 + 191, cz), footP: cam.P(cx, y0, cz), midP: cam.P(cx, y0 + 96, cz) };
}

// A little ice cube: three faces, soft light.
function cube(S, x, y, a, rot = 0, cls = '') {
  const d = (pts) => 'M' + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
  const t = [[0, -a], [a * 0.9, -a * 0.5], [0, 0], [-a * 0.9, -a * 0.5]];
  const l = [[-a * 0.9, -a * 0.5], [0, 0], [0, a * 0.95], [-a * 0.9, a * 0.45]];
  const r = [[a * 0.9, -a * 0.5], [a * 0.9, a * 0.45], [0, a * 0.95], [0, 0]];
  S.raw(`<g${cls ? ` class="${cls}"` : ''} transform="translate(${f(x)} ${f(y)}) rotate(${rot})" stroke-linejoin="round">`);
  S.raw(`<path d="${d(l)}" fill="rgb(190 225 235 / .26)"/><path d="${d(r)}" fill="rgb(120 170 190 / .3)"/><path d="${d(t)}" fill="rgb(255 255 255 / .5)"/>`);
  S.raw(`<path d="${d([t[0], t[1], r[1], r[2], l[2], l[3]])}" fill="none" stroke="rgb(255 255 255 / .75)" stroke-width="1.1"/>`);
  S.raw(`<path d="M${f(-a * 0.5)} ${f(-a * 0.55)}L${f(-a * 0.08)} ${f(-a * 0.78)}" stroke="#fff" stroke-opacity=".9" stroke-width="1.2" stroke-linecap="round" fill="none"/>`);
  S.raw('</g>');
}

// Tall clear tumbler with ice. Foot at (cx, y0, cz).
function iceGlass(S, cam, cx, y0, cz, o = {}) {
  const h = 96, R = 34;
  if (o.shadow !== false) groundShadow(S, cam, cx, cz, R + 6, y0, 1.1);
  const prof = [[y0 + h, R], [y0 + h - 1.2, R + 0.4, 1], [y0 + 60, R - 1.6], [y0 + 12, R - 5.4], [y0 + 3, R - 6.8, 1], [y0, R - 7.2]];
  const g = stackLathe(cam, cx, cz, prof, 6);
  S.solid(g.sil, 'glass', { back: 0.35 });
  S.face(g.ring(y0 + h - 0.6, R - 2.4), 'hole');
  // espresso at the bottom, ice floating in it and piled above
  const lv = y0 + 26;
  const e = g.ell(lv, R - 5.6);
  const clip = S.uid('ig');
  const bot = cam.P(cx, y0, cz);
  S.raw(`<clipPath id="${clip}"><path d="${g.sil}"/></clipPath><g clip-path="url(#${clip})">`);
  S.raw(`<path d="M${f(e.cx - e.rx)} ${f(e.cy)}V${f(bot[1] + 20)}H${f(e.cx + e.rx)}V${f(e.cy)}Z" fill="url(#${S.id}coffee)" fill-opacity=".85"/>`);
  S.raw(`<path d="${g.ring(lv, R - 5.6)}" fill="url(#${S.id}crema)" fill-opacity=".9"/>`);
  const A = cam.s * 9;
  const cubes = [[-12, 14, 8, 14], [12, 18, 4, -10], [0, 32, -4, 28], [-10, 48, 6, 6], [11, 52, 0, -16], [-1, 66, 2, 20]];
  for (const [dx, dy, dz, rot] of cubes) {
    const p = cam.P(cx + dx, y0 + dy + 8, cz + dz);
    cube(S, p[0], p[1], A, rot);
  }
  S.raw('</g>');
  S.face(g.ring(y0 + h, R), 'top');
  S.line(g.ring(y0 + h, R), 'p');
  S.line(g.ring(y0 + h - 0.6, R - 2.4), 's');
  S.line(g.front(lv, R - 5.2), 's');
  wallStreak(S, cam, cx, cz, prof, y0 + h - 6, y0 + 16, 150, 0.7, 2);
  return { ...g, e };
}

module.exports = { shaker, iceGlass, cube };
