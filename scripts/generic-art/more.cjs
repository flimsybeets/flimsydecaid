// More generic objects: mineral dropper bottle, dropper, knock box, milk jug.
const G = require('./geo.cjs');
const { stackLathe, ellD, rbox, rrectTop, lathe, f, pt, crD, polyD, tube } = G;
const { PAPER } = require('./style.cjs');
const O = require('./objects.cjs');
const { groundShadow, clipTo, wallStreak } = O;

// Clear glass dropper bottle (60 mL style): accent-tinted liquid, white cap
// ring. The dropper is drawn by o.dropper() so a scene can animate it.
function dropperBottle(S, cam, cx, cz, o = {}) {
  groundShadow(S, cam, cx, cz, 26);
  const prof = [[64, 9.5], [62.6, 11], [58, 17.5], [52, 21.4], [46, 22.4], [6, 22.4], [1.6, 21.4], [0, 19.6]];
  const bt = stackLathe(cam, cx, cz, prof, 6);
  const lq = stackLathe(cam, cx, cz, [[34, 21.4], [4, 21.4], [1.8, 20.6], [1, 19.4]], 4);
  S.raw(`<path d="${lq.sil}" style="fill:var(--acc)" fill-opacity=".26"/>`);
  S.raw(`<path d="${lq.ring(34, 21.4)}" style="fill:var(--acc)" fill-opacity=".14"/><path d="${lq.ring(34, 21.4)}" fill="none" style="stroke:var(--acc)" stroke-opacity=".6" stroke-width="1"/>`);
  S.solid(bt.sil, 'glass');
  S.face(bt.ring(64, 9.5), 'rgb(255 255 255 / .08)');
  wallStreak(S, cam, cx, cz, prof, 54, 8, 150, 0.7, 2);
  wallStreak(S, cam, cx, cz, prof, 50, 16, 52, 0.2, 1.6);
  S.raw(`<path d="${bt.front(2.4, 21)}" fill="none" stroke="rgb(255 255 255 / .3)" stroke-width="1"/>`);
  // label band
  const lb = stackLathe(cam, cx, cz, [[30, 22.6], [12, 22.6]], 2);
  S.raw(`<path d="${lb.sil}" fill="rgb(${PAPER} / .1)"/><path d="${lb.front(30, 22.6)}" class="bs"/><path d="${lb.front(12, 22.6)}" class="bs"/>`);
  // white screw collar
  const cp = stackLathe(cam, cx, cz, [[72, 11.4], [71.4, 12.2], [64.4, 12.2], [64, 11.4]], 3);
  S.solid(cp.sil, 'white', { rim: 0.8 });
  S.line(lathe(cam, cx, cz, [[71, 12.2], [65, 12.2]]).ribs(65.5, 70.5, 12.2, 10), 'rgb(0 0 0 / .14)');
  S.face(cp.ring(72, 11.4), 'rgb(255 255 255 / .3)');
  if (o.dropper) o.dropper();
}
// The dropper: glass pipette, white collar, soft dark bulb. (x, y, z) = the tip.
function dropper(S, cam, x, y, z, o = {}) {
  const pip = stackLathe(cam, x, z, [[y + 58, 3.4], [y + 20, 3.4], [y + 8, 2.8], [y + 1.5, 1.4], [y, 0.8]], 4);
  S.solid(pip.sil, 'glass', { rim: 0.8 });
  S.raw(`<path d="${pip.sil}" style="fill:var(--acc)" fill-opacity=".3" transform="translate(0 0)" clip-path="none"/>`);
  wallStreak(S, cam, x, z, [[y + 58, 3.4], [y + 20, 3.4], [y + 8, 2.8]], y + 54, y + 10, 150, 0.6, 1);
  const col = stackLathe(cam, x, z, [[y + 66, 10.6], [y + 65, 11.2], [y + 58, 11.2], [y + 57, 10.6]], 3);
  S.solid(col.sil, 'white', { rim: 0.8 });
  S.face(col.ring(y + 66, 10.6), 'rgb(255 255 255 / .3)');
  const bo = cam.P(x, y + 66, z);
  S.raw(`<g class="${o.bulbCls || ''}" style="transform-origin:${f(bo[0])}px ${f(bo[1])}px">`);
  const bulb = stackLathe(cam, x, z, [[y + 104, 3], [y + 102, 8], [y + 96, 12.4], [y + 84, 13.4], [y + 72, 11.4], [y + 66, 9]], 5);
  S.solid(bulb.sil, 'black', { rim: 0.9 });
  wallStreak(S, cam, x, z, [[y + 104, 3], [y + 96, 12.4], [y + 84, 13.4], [y + 72, 11.4]], y + 98, y + 76, 148, 0.5, 2);
  S.raw('</g>');
  return { tip: cam.P(x, y, z) };
}

// Knock box: an open bin with a rubber bar across the top. Faces drawn so a
// falling puck (cls k-puck, drawn by o.inside) disappears behind the front.
const KB = { x0: -62, x1: 62, z0: -44, z1: 44, h: 72, by: 78, br: 8, bz: -2 };
function knockBox(S, cam, o = {}) {
  const { x0, x1, z0, z1, h } = KB;
  S.shadow(rrectTop(cam, x0 - 8, x1 + 12, z0 - 6, z1 + 12, 0, 20));
  // back wall, left wall, floor seen through the opening
  const body = rbox(cam, x0, x1, z0, z1, 0, h, 12);
  S.solid(body.sil, 'dark', { back: 1 });
  const inset = 7;
  const open = rrectTop(cam, x0 + inset, x1 - inset, z0 + inset, z1 - inset, h, 8);
  S.face(rrectTop(cam, x0, x1, z0, z1, h, 12), 'top');
  S.face(open, 'rgb(0 0 0 / .78)');
  S.line(rrectTop(cam, x0, x1, z0, z1, h, 12), 'p');
  S.line(open, 's');
  // soft vertical light on the front faces
  const fr = [cam.P(x0, h - 4, z1), cam.P(x0, 6, z1)];
  S.hl(`M${pt(cam.P(x0 + 10, h - 8, z1))}L${pt(cam.P(x0 + 10, 12, z1))}`, 0.3);
  S.hl(`M${pt(cam.P(x1, h - 8, z1 - 10))}L${pt(cam.P(x1, 12, z1 - 10))}`, 0.2);
  // rubber bar across the opening, resting on the side walls
  const bar = rbox(cam, x0 + 2, x1 - 2, KB.bz - KB.br, KB.bz + KB.br, h, KB.by + KB.br, KB.br - 1);
  S.solid(bar.sil, 'black', { rim: 0.9 });
  S.hl(`M${pt(cam.P(x0 + 10, KB.by + KB.br - 2.4, KB.bz + KB.br - 2))}L${pt(cam.P(x1 - 10, KB.by + KB.br - 2.4, KB.bz + KB.br - 2))}`, 0.5);
  // the puck falls inside: visible above the front rim and through the opening
  if (o.inside) {
    const id = S.uid('kb');
    const a = cam.P(x0 + inset, h, z1 - inset), b = cam.P(x1 - inset, h, z1 - inset);
    S.raw(`<clipPath id="${id}"><path d="${open}"/><path d="M${pt(a)}L${pt(b)}L${f(b[0])} -2000L${f(a[0])} -2000Z"/></clipPath>`);
    S.raw(`<g clip-path="url(#${id})">`);
    o.inside();
    S.raw('</g>');
  }
  return KB;
}

// Milk jug: polished steel pitcher, near-straight sides that narrow a little
// towards the rim, a soft rounded base, a tall pointed pouring spout on the -x
// side and an angular flat-strip handle on the +x side (out along the top,
// then a straight run back down to the lower body).
// Opening centre (cx, topY, cz). o.inside(clip) draws milk in the opening.
// o.flip: spout to the right, handle to the left. o.shadow false: no ground shadow.
function milkJug(S, cam, cx, y0, cz, o = {}) {
  const h = 92, sg = o.flip ? -1 : 1;
  if (o.shadow !== false) groundShadow(S, cam, cx, cz, 46, y0, 1.1);
  // handle: a flat strip with sharp-ish corners (straight runs, short bends)
  const seg = (a, b, n) => Array.from({ length: n }, (_, i) => a.map((v, k) => v + (b[k] - v) * (i / n)));
  const H0 = [cx + 37 * sg, y0 + h - 7, cz], H1 = [cx + 64 * sg, y0 + h - 8, cz], H2 = [cx + 68 * sg, y0 + h - 15, cz], H3 = [cx + 41 * sg, y0 + 26, cz];
  const hp = [...seg(H0, H1, 4), ...seg(H1, H2, 2), ...seg(H2, H3, 6), H3];
  const hd = tube(cam, hp, 4.2, 6);
  S.solid(hd.d, 'metal', { under: false, rim: 0.9 });
  S.raw(`<path d="${crD(hp.map((p) => cam.P(p[0], p[1] + 2.2, p[2] + 2)))}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.1"/>`);
  const prof = [[y0 + h, 38.6], [y0 + h - 1.2, 39.4, 1], [y0 + h - 8, 39.2], [y0 + 46, 41.6], [y0 + 16, 43], [y0 + 7, 41.6], [y0 + 2, 37.4], [y0, 34]];
  const body = stackLathe(cam, cx, cz, prof, 6);
  S.solid(body.sil, 'metal');
  // spout: the rim on the -x side rises to a point and leans out; its crease
  // runs down the wall
  const P = (dx, dy, dz = 0) => cam.P(cx + dx * sg * -1, y0 + h + dy, cz + dz);
  const spd = `M${pt(P(36, -2, -16))}Q${pt(P(44, 6, -7))} ${pt(P(55, 18, 0))}Q${pt(P(44, 7, 7))} ${pt(P(36, -2, 16))}L${pt(P(38.8, -30, 10))}Q${pt(P(43, -14, 0))} ${pt(P(38.8, -30, -10))}Z`;
  S.solid(spd, 'metal', { rim: 0.9, under: false });
  S.raw(`<path d="M${pt(P(39.5, -28, 0))}Q${pt(P(43, -8, 0))} ${pt(P(54, 16, 0))}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.1"/>`);
  S.face(body.ring(y0 + h, 38.6), 'top');
  S.face(body.ring(y0 + h - 0.6, 36.4), 'hole');
  if (o.inside) { clipTo(S, body.ring(y0 + h - 0.6, 36.4)); o.inside({ body, y0, h }); S.raw('</g>'); }
  S.line(body.ring(y0 + h, 38.6), 'p');
  S.line(body.ring(y0 + h - 0.6, 36.4), 's');
  wallStreak(S, cam, cx, cz, prof, y0 + h - 8, y0 + 10, 150, 0.75, 2.4);
  wallStreak(S, cam, cx, cz, prof, y0 + h - 10, y0 + 14, 128, 0.22, 4);
  wallStreak(S, cam, cx, cz, prof, y0 + h - 14, y0 + 24, 50, 0.22, 1.6);
  return { ...body, topY: y0 + h, rimR: 36.4, h };
}

module.exports = { dropperBottle, dropper, knockBox, KB, milkJug };
