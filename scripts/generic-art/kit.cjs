// Kit shared with the original look: a small square scale with two dot-matrix
// displays, a pebble-shaped ceramic dosing cup (drawn side-on in its own
// frame), a slim pump sprayer, a rounded tub knock box with a scoop and a
// rubber bar, and the portafilter turned over (tapered basket, black handle).
const G = require('./geo.cjs');
const { convexLathe, stackLathe, ellD, rbox, rrectTop, lathe, f, pt, crD, polyD, hull, tube, add3, norm3 } = G;
const { PAPER } = require('./style.cjs');
const O = require('./objects.cjs');
const T = require('./tools.cjs');
const { groundShadow, bean } = O;

// ------------------------------------------------------------------ scale
// 80 x 80 x 15: glossy dark bezel, smoked top showing the load cell circle, a
// circuit patch and two buttons; two dot-matrix displays near the front edge.
// Returns the top height and the plane transform of the left display (live
// weight goes there).
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

// ------------------------------------------------------------------ dosing cup
// Ceramic dosing cup, side view in its own 200 x 122 frame: pebble bowl, wide
// mouth, rim sweeping up to a pointed spout.
const DOSE = {
  outer: 'M8 8C3 22 6 48 20 72C36 100 70 120 108 121C150 122 186 108 196 84C202 70 200 56 190 46C172 30 136 20 100 13C70 7 40 1 22 1C14 1 10 3 8 8Z',
  inner: 'M13 8C38 4 70 10 100 17C134 25 166 36 186 48C172 64 146 72 116 70C78 67 38 40 13 8Z',
  lip: 'M13 8C38 40 78 67 116 70C146 72 172 64 186 48',
  back: 'M13 8C38 4 70 10 100 17C134 25 166 36 186 48',
};
const BEANS = [[84, 44, -50, .92], [150, 46, 15, .92], [104, 50, 75, .95], [128, 52, -5, 1], [70, 50, 30, .95], [92, 60, -15, 1], [116, 65, 20, 1.03], [140, 63, -28, 1], [162, 56, 35, .97]];
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

// ------------------------------------------------------------------ spray bottle
// Slim clear bottle with round shoulders, white ribbed screw collar, white
// pump head with a side nozzle, a clear dip tube curving to the bottom.
function sprayBottle(S, cam, cx, cz, o = {}) {
  groundShadow(S, cam, cx, cz, 18);
  const bt = stackLathe(cam, cx, cz, [[117, 8.6], [114, 8.9], [111, 10.4], [107.5, 13.2], [104, 15.4], [100.5, 16.6], [97, 17], [4, 17], [1.5, 16.6], [0, 15.4]], 6);
  // water, then the dip tube, seen through the bottle
  const lq = stackLathe(cam, cx, cz, [[62, 16], [4, 16], [1.5, 15.6], [0.8, 14.6]], 4);
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
  const collar = stackLathe(cam, cx, cz, [[128, 11.4], [127.2, 12.1], [114.6, 12.1], [114, 11.6]], 3);
  S.solid(collar.sil, 'white', { rim: 0.8 });
  S.line(lathe(cam, cx, cz, [[127, 12.1], [115, 12.1]]).ribs(115.5, 126.5, 12.1, 16), 'rgb(0 0 0 / .14)');
  S.face(collar.ring(128, 11.4), 'rgb(255 255 255 / .35)');
  S.open(o.pumpCls || '');
  const stem = lathe(cam, cx, cz, [[131, 3.2], [127.5, 3.2]]);
  S.solid(stem.sil, 'white', { under: false });
  const head = stackLathe(cam, cx, cz, [[147, 7.4], [146, 8.6], [144, 9], [132, 9], [131, 8.4]], 3);
  S.solid(head.sil, 'white', { rim: 0.8 });
  S.face(head.ring(147, 7.4), 'rgb(255 255 255 / .6)');
  S.hl(lathe(cam, cx, cz, [[144, 9], [132, 9]]).streak(143, 133, 9, 140), 0.8);
  // nozzle on the side facing the beans (+x)
  const nz = cam.right(cx + 9.05, 140, cz);
  S.raw(`<g transform="${nz}"><circle r="2.6" fill="rgb(0 0 0 / .15)"/><circle r="1.3" fill="#26383c"/></g>`);
  S.close();
  return { nozzle: cam.P(cx + 10, 140, cz) };
}

// ------------------------------------------------------------------ knock box
// Glossy black rounded tub; the front wall is cut by a deep, wide U scoop that
// sweeps up to the top at the corners; a rubber knock bar runs side to side
// just under the rim, its round end caps through the side walls.
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

// The portafilter turned over (basket floor up) for the knock box.
function invertedPortafilter(S, cam, cx, y0, cz) {
  const ang = 150 * Math.PI / 180;
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
  // the tapered basket upside down: cone narrowing to its flat floor
  const cone = convexLathe(cam, cx, cz, [[y0 + 13, 28.6], [y0 + 20, 25.5], [y0 + 28, 21.6], [y0 + 32.2, 19.8], [y0 + 33, 19.2]]);
  S.solid(cone.sil, 'brushed');
  for (const [a, op, w] of [[146, 0.7, 2], [58, 0.3, 1.3]]) S.raw(`<path d="M${pt(cam.P(cx + 28 * Math.cos(a * Math.PI / 180), y0 + 14.5, cz + 28 * Math.sin(a * Math.PI / 180)))}L${pt(cam.P(cx + 20 * Math.cos(a * Math.PI / 180), y0 + 31.5, cz + 20 * Math.sin(a * Math.PI / 180)))}" stroke="#fff" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`);
  S.face(cone.ring(y0 + 33, 19.2), 'rgb(150 162 162 / .55)');
  S.face(cone.ring(y0 + 33, 19.2), 'top');
  S.line(cone.ring(y0 + 33, 19.2), 's');
  let hd = '';
  for (let i = 0; i < 26; i++) { const t = (i * 0.618) % 1, r = Math.sqrt(t) * 16.5, a = i * 2.4; const p = cam.P(cx + r * Math.cos(a), y0 + 33, cz + r * Math.sin(a)); hd += `M${f(p[0] - 0.4)} ${f(p[1])}h.8`; }
  S.raw(`<path d="${hd}" stroke="rgb(0 0 0 / .45)" stroke-width="1.2" stroke-linecap="round"/>`);
  const a0 = [cx + dir[0] * 30, y0 + 7, cz + dir[2] * 30];
  S.solid(tube(cam, [a0, add3(a0, dir, 14), add3(a0, dir, 30)], 5.5).d, 'metal', { under: false });
  T.handleBlack(S, cam, add3(a0, dir, 30), dir, T.HANDLE);
}

module.exports = { scale, dots, FONT, DOSE, BEANS, dosingCup, sprayBottle, knockBox, KB, invertedPortafilter };
