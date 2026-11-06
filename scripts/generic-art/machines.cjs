// Bigger objects: spray bottle, grinder, DE1, knock box, milk jug, dropper bottle.
const G = require('./geo.cjs');
const { convexLathe, stackLathe, ellD, rbox, rrectTop, lathe, f, pt, crD, polyD, hull, tube, add3 } = G;
const { PAPER } = require('./style.cjs');
const O = require('./objects.cjs');
const { circle, groundShadow, clipTo, wallStreak, rAt, bean } = O;
const R = Math.PI / 180;
const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ------------------------------------------------------------------ spray bottle
// Plain trigger sprayer: clear bottle with water, white collar and head, side
// nozzle towards +x. The trigger (k-trigger) squeezes.
function sprayBottle(S, cam, cx, cz, o = {}) {
  groundShadow(S, cam, cx, cz, 28);
  const prof = [[112, 11], [110.5, 12.6], [106, 19.5], [100, 24.6], [94, 26.4], [6, 26.4], [1.5, 25.4], [0, 23.6]];
  const bt = stackLathe(cam, cx, cz, prof, 6);
  const lq = stackLathe(cam, cx, cz, [[64, 25.4], [5, 25.4], [1.8, 24.6], [1, 23.4]], 4);
  S.raw(`<path d="${lq.sil}" style="fill:var(--acc)" fill-opacity=".2"/>`);
  S.raw(`<path d="${lq.ring(64, 25.4)}" style="fill:var(--acc)" fill-opacity=".12"/><path d="${lq.ring(64, 25.4)}" fill="none" style="stroke:var(--acc)" stroke-opacity=".55" stroke-width="1"/>`);
  const tubeP = [[cx, 124, cz], [cx + 0.5, 90, cz], [cx + 4, 44, cz + 2], [cx + 12, 14, cz + 6], [cx + 16, 3, cz + 8]].map((p) => cam.P(...p));
  S.raw(`<path d="${crD(tubeP)}" stroke="rgb(${PAPER} / .42)" stroke-width="${f(Math.max(1.2, 2.6 * cam.s))}" fill="none"/>`);
  S.solid(bt.sil, 'glass');
  S.face(bt.ring(112, 11), 'rgb(255 255 255 / .06)');
  wallStreak(S, cam, cx, cz, prof, 100, 10, 150, 0.7, 2);
  wallStreak(S, cam, cx, cz, prof, 96, 22, 120, 0.18, 1.6);
  wallStreak(S, cam, cx, cz, prof, 90, 16, 50, 0.22, 1.6);
  S.raw(`<path d="${bt.front(2.4, 24.8)}" fill="none" stroke="rgb(255 255 255 / .3)" stroke-width="1"/>`);
  // white screw collar
  const collar = stackLathe(cam, cx, cz, [[126, 13], [125.2, 13.8], [112, 13.8], [111.4, 13.2]], 3);
  S.solid(collar.sil, 'white', { rim: 0.8 });
  S.line(lathe(cam, cx, cz, [[125, 13.8], [113, 13.8]]).ribs(113.5, 124.5, 13.8, 16), 'rgb(0 0 0 / .14)');
  S.face(collar.ring(126, 13), 'rgb(255 255 255 / .35)');
  // trigger (behind the head's front edge): a curved finger lever
  const piv = cam.P(cx + 20, 140, cz);
  S.raw(`<g class="${o.triggerCls || ''}" style="transform-origin:${f(piv[0])}px ${f(piv[1])}px">`);
  const trg = tube(cam, [[cx + 22, 138, cz], [cx + 32, 128, cz], [cx + 36, 112, cz], [cx + 32, 98, cz]], 4.4, 6);
  S.solid(trg.d, 'white', { under: false, rim: 0.8 });
  S.close();
  // head: rounded block over the collar, then the nozzle
  const head = rbox(cam, cx - 15, cx + 31, cz - 11.5, cz + 11.5, 126, 152, 9);
  S.solid(head.sil, 'white', { rim: 0.9 });
  S.face(head.top, 'rgb(255 255 255 / .5)');
  S.hl(`M${pt(cam.P(cx - 8, 150, cz + 11.5))}L${pt(cam.P(cx + 24, 150, cz + 11.5))}`, 0.7);
  const nz = tube(cam, [[cx + 30, 142, cz], [cx + 38, 142, cz], [cx + 43, 142, cz]], 5.6, 3);
  S.solid(nz.d, 'white', { rim: 0.8 });
  S.raw(`<g transform="${cam.right(cx + 43.2, 142, cz)}"><circle r="4.2" fill="rgb(0 0 0 / .12)"/><circle r="1.7" fill="#26383c"/></g>`);
  return { nozzle: cam.P(cx + 44, 142, cz) };
}

// ------------------------------------------------------------------ grinder
// Generic conical-burr grinder: round body, a big setting ring around its top
// (0 fine to 90 coarse), a glass bean hopper with a dark lid, a chute to the
// right and a catch cup on the base plate.
const GR = { r: 46, base: 14, bodyTop: 150, ringR: 64, ringTop: 164, hopH: 58, cupX: 106 };
function dialFace(S, cam, cx, y, cz, R0, cls, big) {
  S.raw(`<g transform="${cam.top(cx, y, cz)}"><g${cls ? ` class="${cls}"` : ''}>`);
  const a = (v) => (-150 + v * 300 / 90);
  let t1 = '', t2 = '';
  for (let v = 0; v <= 90; v += 1) {
    const r0 = R0 - 2, r1 = R0 - (v % 10 === 0 ? 7 : v % 5 === 0 ? 5 : 3.6);
    const an = (a(v) + 90) * R;
    const seg = `M${f(Math.cos(an) * r0)} ${f(Math.sin(an) * r0)}L${f(Math.cos(an) * r1)} ${f(Math.sin(an) * r1)}`;
    if (v % 5 === 0) t1 += seg; else if (big) t2 += seg;
  }
  S.raw(`<path d="${t1}" class="ic" stroke-opacity=".75"/>${t2 ? `<path d="${t2}" class="ic" stroke-opacity=".4" style="stroke-width:.7px"/>` : ''}`);
  if (big) {
    // the setting arc: the whole 0-90 sweep with pathLength 90 (same constants as lib/dialArc.ts)
    const ra = R0 - 1.6, s0 = (a(0) + 90) * R, s1 = (a(90) + 90) * R;
    const arc = `M${f(Math.cos(s0) * ra)} ${f(Math.sin(s0) * ra)}A${f(ra)} ${f(ra)} 0 1 1 ${f(Math.cos(s1) * ra)} ${f(Math.sin(s1) * ra)}`;
    S.raw(`<path class="dial-arc glow" pathLength="90" d="${arc}"/><path class="dial-arc" pathLength="90" d="${arc}"/>`);
    for (let v = 0; v <= 90; v += 10) S.raw(`<text transform="rotate(${f(a(v))}) translate(0 ${f(R0 - 13.5)})" text-anchor="middle" dominant-baseline="central" font-size="5.6" font-weight="700" fill="rgb(${PAPER} / .85)">${v}</text>`);
    S.raw(`<text transform="rotate(${f(a(-6))}) translate(0 ${f(R0 - 13.5)}) rotate(90)" text-anchor="middle" dominant-baseline="central" font-size="3.4" font-weight="700" letter-spacing=".4" fill="rgb(${PAPER} / .55)">FINE</text>`);
    S.raw(`<text transform="rotate(${f(a(97))}) translate(0 ${f(R0 - 13.5)}) rotate(-90)" text-anchor="middle" dominant-baseline="central" font-size="3.4" font-weight="700" letter-spacing=".4" fill="rgb(${PAPER} / .55)">COARSE</text>`);
  }
  S.raw('</g></g>');
}
function grinder(S, cam, o = {}) {
  const { r, base, bodyTop, ringR, ringTop, hopH, cupX } = GR;
  const full = o.full !== false;
  const out = {};
  if (full) {
    // base plate under the body and the cup
    const bx0 = -66, bx1 = cupX + 42, bz = 58;
    S.shadow(rrectTop(cam, bx0 - 6, bx1 + 12, -bz - 4, bz + 12, 0, 22));
    const bp = rbox(cam, bx0, bx1, -bz, bz, 0, base, 16);
    S.solid(bp.sil, 'cream', { back: 1 });
    S.face(bp.top, 'top');
    S.line(bp.top, 's');
    S.face(rrectTop(cam, cupX - 40, cupX + 40, -40, 40, base, 14), 'rgb(0 0 0 / .16)');
  }
  // body
  const bprof = [[bodyTop, 45.5], [bodyTop - 1.5, 46], [base + 10, 47.2], [base, 48]];
  const body = stackLathe(cam, 0, 0, bprof, 4);
  const bodyBottom = full ? base : 70;
  if (!full) {
    const fid = S.uid('fd');
    const b0 = cam.P(0, bodyTop, 0), b1 = cam.P(0, bodyBottom, 0);
    S.raw(`<linearGradient id="${fid}" gradientUnits="userSpaceOnUse" x1="0" y1="${f(b0[1])}" x2="0" y2="${f(b1[1] + r * cam.s * cam.sp)}"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="${fid}m" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="4000" height="4000"><rect x="-2000" y="-2000" width="4000" height="4000" fill="url(#${fid})"/></mask>`);
    S.raw(`<g mask="url(#${fid}m)">`);
  }
  S.solid(full ? body.sil : stackLathe(cam, 0, 0, [[bodyTop, 45.5], [bodyTop - 1.5, 46], [70, 47.2]], 4).sil, 'cream', { back: 1 });
  wallStreak(S, cam, 0, 0, bprof, bodyTop - 8, Math.max(bodyBottom + 16, base + 16), 150, 0.5, 1.8);
  wallStreak(S, cam, 0, 0, bprof, bodyTop - 24, Math.max(bodyBottom + 30, base + 30), 126, 0.14, 1.4);
  if (full) {
    // round power button on the body (faces the viewer)
    const a = 58 * R, by = 88;
    const pl = cam.plane([47 * Math.cos(a), by, 47 * Math.sin(a)], [-Math.sin(a), 0, Math.cos(a)], [0, -1, 0]);
    S.raw(`<g transform="${pl}"><circle class="k-btnring fx" r="11" fill="none" stroke="var(--acc)" stroke-width="1.6" vector-effect="non-scaling-stroke"/><g class="${o.btnCls || ''}"><circle r="9" fill="rgb(0 0 0 / .45)" stroke="rgb(${PAPER} / .4)" stroke-width=".9" vector-effect="non-scaling-stroke"/><path d="M-3.4 -2.6A4.6 4.6 0 1 0 3.4 -2.6M0 -5.6V-.4" fill="none" stroke="rgb(${PAPER} / .8)" stroke-width="1.4" stroke-linecap="round"/></g></g>`);
    out.btn = cam.P(0.0 + 47 * Math.cos(a), by, 47 * Math.sin(a));
  } else S.raw('</g>');
  // setting ring
  const rprof = [[ringTop, ringR], [ringTop - 1.2, ringR + 1, 1], [bodyTop + 1, ringR + 1], [bodyTop, ringR - 1]];
  const ring = stackLathe(cam, 0, 0, rprof, 3);
  S.solid(ring.sil, 'dark');
  S.face(ring.ring(ringTop, ringR), 'top');
  S.face(ring.ring(ringTop, ringR), 'rgb(0 0 0 / .32)');
  dialFace(S, cam, 0, ringTop, 0, ringR, o.dialCls || '', !!o.big);
  S.line(ring.ring(ringTop, ringR), 's');
  S.raw(`<g transform="${cam.top(0, ringTop, 0)}"><path d="M0 ${ringR - 15}l-3.4 -6h6.8z" style="fill:var(--acc)"/></g>`);
  wallStreak(S, cam, 0, 0, rprof, ringTop - 2, bodyTop + 2, 148, 0.4, 1.4);
  // chute and catch cup (to the right)
  if (full) {
    const cy = base;
    const cup = O.dosingCup(S, cam, cupX, cy, 0, { h: 50, r: 34, shadow: false, ...(o.cup || {}) });
    out.cup = cup;
    out.cupTop = cy + 50;
    // the arm out of the body, then the spout over the cup
    const arm = rbox(cam, 30, cupX + 14, -13, 13, 92, 116, 9);
    S.solid(arm.sil, 'cream', { back: 1, rim: 0.9 });
    S.face(arm.top, 'rgb(255 255 255 / .08)');
    S.hl(`M${pt(cam.P(40, 114, 13))}L${pt(cam.P(cupX, 114, 13))}`, 0.5);
    const sp = stackLathe(cam, cupX, 0, [[94, 14], [92, 15], [84, 12], [79, 10.4]], 3);
    S.solid(sp.sil, 'dark', { rim: 0.9 });
    S.face(sp.ring(79, 10.4), 'rgb(0 0 0 / .6)');
    out.spout = cam.P(cupX, 78, 0);
  }
  if (o.hopper === false) {
    // hopper off: the burr carrier shows in the middle of the ring
    const col = stackLathe(cam, 0, 0, [[ringTop + 3, 30], [ringTop + 2, 31, 1], [ringTop, 31.4]], 3);
    S.solid(col.sil, 'metal', { under: false, rim: 0.9 });
    S.face(col.ring(ringTop + 3, 30), 'rgb(0 0 0 / .45)');
    const cone = stackLathe(cam, 0, 0, [[ringTop + 17, 5], [ringTop + 13, 11], [ringTop + 6, 19], [ringTop + 3, 24]], 4);
    S.solid(cone.sil, 'brushed', { rim: 0.8 });
    S.hl(cone.streak(ringTop + 14, ringTop + 6, 14, 150), 0.5);
  } else {
  // hopper: glass cone full of beans, dark lid
  const hprof = [[ringTop + hopH, 40], [ringTop + hopH - 2, 41.4, 1], [ringTop + 24, 37], [ringTop + 5, 33], [ringTop, 32]];
  const hop = stackLathe(cam, 0, 0, hprof, 5);
  S.solid(hop.sil, 'glass', { back: 0.5 });
  clipTo(S, hop.sil);
  const bl = [];
  for (let i = 0; i < 56; i++) {
    const yy = ringTop + 3 + rnd(i * 3 + 1) * 40;
    const rr = Math.max(0, rAt(hprof, yy) - 8) * Math.sqrt(rnd(i * 3 + 2)), a = rnd(i * 3 + 3) * 6.2832;
    const x = rr * Math.cos(a), z = rr * Math.sin(a);
    bl.push({ p: cam.P(x, yy, z), z: -x * cam.sa + z * cam.ca, rot: (i * 53) % 180 - 70 });
  }
  bl.sort((a, b) => a.z - b.z);
  S.open(o.hopCls || '');
  for (const b of bl) bean(S, b.p[0], b.p[1], b.rot, cam.s * 0.42);
  S.close();
  S.raw('</g>');
  S.face(hop.sil, 'rgb(255 255 255 / .04)');
  S.line(hop.sil, 's');
  wallStreak(S, cam, 0, 0, hprof, ringTop + hopH - 8, ringTop + 8, 150, 0.7, 2);
  wallStreak(S, cam, 0, 0, hprof, ringTop + hopH - 12, ringTop + 22, 50, 0.2, 1.5);
  S.line(hop.back(ringTop + 5, 35), 's');
  const lid = stackLathe(cam, 0, 0, [[ringTop + hopH + 9, 12], [ringTop + hopH + 8, 22], [ringTop + hopH + 4, 36], [ringTop + hopH + 1, 42], [ringTop + hopH, 42.2]], 5);
  S.open(o.lidCls || '');
  S.solid(lid.sil, 'dark', { rim: 0.9 });
  S.face(lid.ring(ringTop + hopH + 9, 12), `rgb(${PAPER} / .1)`);
  wallStreak(S, cam, 0, 0, [[ringTop + hopH + 9, 12], [ringTop + hopH + 8, 22], [ringTop + hopH + 4, 36], [ringTop + hopH, 42]], ringTop + hopH + 8, ringTop + hopH + 1, 150, 0.5, 1.8);
  S.close();
  }
  out.hopTop = ringTop + hopH + 9;
  return out;
}



// ------------------------------------------------------------------ DE1
// Decent DE1 from its dimension drawing: 232 wide, body 230 tall on a 92 mm
// frame, 237 deep with a big radius on the top-back edge; group head on the
// front-left, steam wand on the right, drip tray in front. Drawn plain: no
// logo, no screen, a simple round cap on the group.
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
  const segs = G.roundedPoly(pts, radii, (p) => p);
  const out = [];
  for (const s of segs) for (let k = 0; k < per; k++) { const t = k / per, u = 1 - t; out.push([0, 1].map((i) => u * u * u * s[0][i] + 3 * u * u * t * s[1][i] + 3 * u * t * t * s[2][i] + t * t * t * s[3][i])); }
  return out;
}
function groupCap(S, cam, gx, y, gz, R0, lit) {
  const T = cam.top(gx, y, gz);
  S.raw(`<g transform="${T}">`);
  S.raw(`<circle r="${R0 - 1}" fill="rgb(255 255 255 / .06)"/><circle r="${R0 - 7}" fill="rgb(2 7 9 / .78)"/>`);
  S.raw(`<circle r="${R0 - 7}" fill="none" stroke="rgb(${PAPER} / .18)" stroke-width="5" vector-effect="non-scaling-stroke"/><circle r="${R0 - 7}" fill="none" stroke="rgb(${PAPER} / .8)" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`);
  S.raw(`<circle r="14" fill="none" stroke="rgb(${PAPER} / .3)" stroke-width="1" vector-effect="non-scaling-stroke"/>`);
  S.raw('</g>');
  if (lit) {
    S.raw(`<g transform="${T}"><g class="k-lit" style="transform-origin:0 0"><circle r="34" fill="url(#${S.id}glow)"/></g>`);
    S.raw(`<circle class="k-ring fx" r="14" fill="none" stroke="var(--acc)" stroke-width="1.4" vector-effect="non-scaling-stroke"/><circle r="6" fill="#fff" fill-opacity=".85"/></g>`);
  }
}
// the steam wand: arm out of the front, knuckle, wand and tip. clipLower: id of
// a clipPath the part below `yClip` is drawn through (to dip it into a jug).
function steamWand(S, cam, wx, o = {}) {
  const tipY = o.tipY ?? 158;
  const arm = tube(cam, [[wx, 296, 0], [wx, 296, 30], [wx, 296, 58]], 7);
  S.solid(arm.d, 'metal', { under: false });
  const knuckle = lathe(cam, wx, 64, [[305, 0.01], [303, 7], [296, 10], [289, 7], [287, 0.01]]);
  S.solid(knuckle.sil, 'metal', { under: false });
  const wand = tube(cam, [[wx, 292, 66], [wx, 270, 76], [wx, 250, 78], [wx, 205, 78]], 6.4);
  S.solid(wand.d, 'dark', { under: false });
  if (o.clipId) S.raw(`<g clip-path="url(#${o.clipId})">`);
  const tip = tube(cam, [[wx, 208, 78], [wx, tipY + 22, 78], [wx, tipY, 78]], 3.6);
  S.solid(tip.d, 'metal', { under: false });
  S.hl(crD([cam.P(wx - 2.5, 202, 78), cam.P(wx - 2.5, tipY + 4, 78)]), 0.6);
  if (o.clipId) S.raw('</g>');
}
function de1(S, cam, o = {}) {
  const { W: BW, FY, TOP, D, FZ, gx, gz, gTop, gBot, gR } = DE;
  const wx = o.wx ?? 201;
  S.shadow(rrectTop(cam, -16, BW + 22, -D - 14, FZ + 16, 0, 30));
  const railProf = (x) => G.roundedPoly([[-D, FY], [FZ, FY], [FZ, 6], [FZ - 30, 6], [FZ - 34, 52], [-D + 38, 52], [-D + 34, 6], [-D, 6]], [3, 4, 3, 2, 14, 14, 2, 3], (p) => [x, p[1], p[0]]);
  const rail = (x) => G.prism(cam, railProf(x), [18, 0, 0]);
  const feet = (x) => { for (const z of [-D + 16, FZ - 16]) { const ft = lathe(cam, x + 9, z, [[6, 7], [0, 8]]); S.solid(ft.sil, 'dark', { under: false }); } };
  feet(0);
  const rl = rail(0); S.solid(rl.sil, 'dark'); S.face(rl.capB, `url(#${S.id}side)`);
  const dr = rbox(cam, 20, BW - 20, -D + 30, -14, 10, FY - 4, 6);
  S.solid(dr.sil, 'smoke', { under: false });
  const ty = FY - 2;
  const tray = rbox(cam, 20, BW - 14, 4, FZ - 6, 50, ty, 8);
  S.solid(tray.sil, 'metal');
  S.face(rrectTop(cam, 26, BW - 20, 10, FZ - 12, ty, 4), 'deep');
  let g = '';
  for (let x = 30; x <= BW - 24; x += 6.5) g += `M${pt(cam.P(x, ty, 12))}L${pt(cam.P(x, ty, FZ - 14))}`;
  S.raw(`<path d="${g}" stroke="rgb(${PAPER} / .34)" stroke-width="1.1"/>`);
  S.line(tray.top, 's');
  feet(BW - 18);
  const rr = rail(BW - 18); S.solid(rr.sil, 'dark'); S.face(rr.capB, `url(#${S.id}side)`); S.line(rr.capB, 's');
  // body: front outline intersected with the side profile
  const F = roundedOutline([[0, FY], [0, TOP], [BW, TOP], [BW, FY]], [3, 26, 26, 3], 10);
  const Sd = roundedOutline([[0, FY], [0, TOP], [-D, TOP], [-D, FY]], [3, 12, 95, 3], 10);
  const band = (z) => { let lo = 1e9, hi = -1e9; for (let i = 0; i < Sd.length; i++) { const a = Sd[i], b = Sd[(i + 1) % Sd.length]; if ((a[0] - z) * (b[0] - z) <= 0 && a[0] !== b[0]) { const t = (z - a[0]) / (b[0] - a[0]); const y = a[1] + (b[1] - a[1]) * t; lo = Math.min(lo, y); hi = Math.max(hi, y); } } return [lo, hi]; };
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const z = -D + 0.01 + (D - 0.02) * i / 48;
    const [lo, hi] = band(z);
    for (const p of clipBand(F, lo, hi)) pts.push(cam.P(p[0], p[1], z));
  }
  S.solid(polyD(hull(pts)), 'cream', { back: 1 });
  const [lo0, hi0] = band(-0.01);
  const front = clipBand(F, lo0, hi0).map((p) => cam.P(p[0], p[1], 0));
  S.face(polyD(front), 'rgb(0 0 0 / .1)');
  S.line(polyD(front), 'p');
  const right = clipBand(Sd, FY + 3, TOP - 26).map((p) => cam.P(BW, p[1], p[0]));
  S.face(polyD(right), `url(#${S.id}side)`);
  S.line(polyD(right), 's');
  S.hl(crD([cam.P(BW - 26 * 0.3, TOP - 26 * 0.3, -14), cam.P(BW - 26 * 0.3, TOP - 26 * 0.3, -D + 60)]), 0.35);
  S.hl(crD(Sd.filter((p) => p[0] < -D + 96 && p[1] > TOP - 96).map((p) => cam.P(BW - 8, p[1] - 2, p[0] + 2))), 0.3);
  if (o.under) o.under();
  if (o.wand !== false) steamWand(S, cam, wx, { tipY: o.tipY });
  // group: neck block, whatever hangs under it, then the housing
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
  groupCap(S, cam, gx, gTop, gz, gR, o.lit);
  S.line(grp.ring(gTop, gR - 1), 'p');
  return { tray: ty, gx, gz };
}

module.exports = { sprayBottle, grinder, GR, dialFace, de1, DE, steamWand };
