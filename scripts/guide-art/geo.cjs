// Tiny orthographic 3/4 toolkit: everything is built in millimetres in 3D
// and projected exactly, so ellipses, cylinders and boxes all agree.
const R = Math.PI / 180;
const K = 0.5523;
const f = (n) => Math.round(n * 10) / 10;
const pt = (p) => `${f(p[0])} ${f(p[1])}`;

function Cam(yaw, pitch, s, ox, oy) {
  const ca = Math.cos(yaw * R), sa = Math.sin(yaw * R);
  const cp = Math.cos(pitch * R), sp = Math.sin(pitch * R);
  const P = (x, y, z) => {
    const xr = x * ca + z * sa, zr = -x * sa + z * ca;
    return [ox + s * xr, oy + s * (-y * cp + zr * sp)];
  };
  const cam = { P, s, sp, cp, ca, sa, tp: sp / cp };
  // SVG matrix for a plane: local (u,v) -> o + u*eu + v*ev (3D)
  cam.plane = (o, eu, ev) => {
    const p0 = P(...o);
    const pu = P(o[0] + eu[0], o[1] + eu[1], o[2] + eu[2]);
    const pv = P(o[0] + ev[0], o[1] + ev[1], o[2] + ev[2]);
    return `matrix(${[pu[0] - p0[0], pu[1] - p0[1], pv[0] - p0[0], pv[1] - p0[1], p0[0], p0[1]].map((n) => +n.toFixed(4)).join(' ')})`;
  };
  // top-facing plane at height y, centred on (x,z): u = +x, v = +z (towards viewer)
  cam.top = (x, y, z) => cam.plane([x, y, z], [1, 0, 0], [0, 0, 1]);
  // front-facing plane (normal +z): u = +x, v = down
  cam.front = (x, y, z) => cam.plane([x, y, z], [1, 0, 0], [0, -1, 0]);
  // right-facing plane (normal +x): u = -z (towards back), v = down
  cam.right = (x, y, z) => cam.plane([x, y, z], [0, 0, -1], [0, -1, 0]);
  // horizontal ellipse
  cam.ell = (x, y, z, r) => { const c = P(x, y, z); return { cx: c[0], cy: c[1], rx: r * s, ry: r * s * sp }; };
  return cam;
}

const ellD = (e) => `M${f(e.cx - e.rx)} ${f(e.cy)}A${f(e.rx)} ${f(e.ry)} 0 1 0 ${f(e.cx + e.rx)} ${f(e.cy)}A${f(e.rx)} ${f(e.ry)} 0 1 0 ${f(e.cx - e.rx)} ${f(e.cy)}Z`;
const frontArcD = (e) => `M${f(e.cx - e.rx)} ${f(e.cy)}A${f(e.rx)} ${f(e.ry)} 0 0 0 ${f(e.cx + e.rx)} ${f(e.cy)}`;
const backArcD = (e) => `M${f(e.cx - e.rx)} ${f(e.cy)}A${f(e.rx)} ${f(e.ry)} 0 0 1 ${f(e.cx + e.rx)} ${f(e.cy)}`;

// ---------- cubic segments ----------
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lineSeg = (a, b) => [a, lerp(a, b, 1 / 3), lerp(a, b, 2 / 3), b];
function bez(s, t) {
  const u = 1 - t;
  return s[0].map((_, i) => u * u * u * s[0][i] + 3 * u * u * t * s[1][i] + 3 * u * t * t * s[2][i] + t * t * t * s[3][i]);
}
function split(s, t) {
  const a = lerp(s[0], s[1], t), b = lerp(s[1], s[2], t), c = lerp(s[2], s[3], t);
  const d = lerp(a, b, t), e = lerp(b, c, t), m = lerp(d, e, t);
  return [[s[0], a, d, m], [m, e, c, s[3]]];
}
function sub(s, t0, t1) {
  let r = t0 > 0 ? split(s, t0)[1] : s;
  const tt = t0 < 1 ? (t1 - t0) / (1 - t0) : 0;
  return tt < 1 ? split(r, tt)[0] : r;
}
// rounded polygon in local 2D -> 3D cubic segments
function roundedPoly(pts, radii, to3) {
  const n = pts.length, segs = [];
  const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [dx / l, dy / l]; };
  const A = [], B = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], prev = pts[(i + n - 1) % n], next = pts[(i + 1) % n], r = radii[i] || 0;
    const u1 = unit(p, prev), u2 = unit(p, next);
    A[i] = [p[0] + u1[0] * r, p[1] + u1[1] * r];
    B[i] = [p[0] + u2[0] * r, p[1] + u2[1] * r];
  }
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (radii[i]) segs.push([A[i], lerp(A[i], p, K), lerp(B[i], p, K), B[i]].map(to3));
    const j = (i + 1) % n;
    segs.push(lineSeg(B[i], A[j]).map(to3));
  }
  return segs;
}
const proj = (cam, segs) => segs.map((s) => s.map((p) => cam.P(...p)));
const segsD = (segs, close = true) => {
  let d = `M${pt(segs[0][0])}`;
  for (const s of segs) d += `C${pt(s[1])} ${pt(s[2])} ${pt(s[3])}`;
  return d + (close ? 'Z' : '');
};
const segsC = (segs) => segs.map((s) => `C${pt(s[1])} ${pt(s[2])} ${pt(s[3])}`).join('');

function extreme(segs, n, sign) {
  let best = null;
  segs.forEach((s, i) => {
    for (let k = 0; k <= 200; k++) {
      const t = k / 200, p = bez(s, t), v = sign * (p[0] * n[0] + p[1] * n[1]);
      if (!best || v > best.v + 1e-9) best = { i, t, v };
    }
  });
  return best;
}
function walk(segs, from, to) {
  const out = [], n = segs.length;
  if (from.i === to.i && to.t > from.t) return [sub(segs[from.i], from.t, to.t)];
  if (from.t < 1) out.push(sub(segs[from.i], from.t, 1));
  for (let i = (from.i + 1) % n; i !== to.i; i = (i + 1) % n) out.push(segs[i]);
  if (to.t > 0) out.push(sub(segs[to.i], 0, to.t));
  return out;
}
const mv = (segs, e) => segs.map((s) => s.map((p) => [p[0] + e[0], p[1] + e[1]]));
const rev = (segs) => segs.slice().reverse().map((s) => s.slice().reverse());
const mid = (segs) => bez(segs[Math.floor(segs.length / 2)], 0.5);

// Prism: closed profile (3D segments) swept by vector E.
function prism(cam, prof3, E) {
  const a = proj(cam, prof3);
  const o = cam.P(0, 0, 0), q = cam.P(...E);
  const e = [q[0] - o[0], q[1] - o[1]];
  const n = [-e[1], e[0]];
  const hi = extreme(a, n, 1), lo = extreme(a, n, -1);
  const c1 = walk(a, hi, lo), c2 = walk(a, lo, hi);
  const dot = (p) => p[0] * e[0] + p[1] * e[1];
  let sil;
  if (dot(mid(c1)) < dot(mid(c2))) {
    const B = mv(c2, e);
    sil = segsD(c1, false) + `L${pt(B[0][0])}` + segsC(B) + 'Z';
  } else {
    const B = mv(c1, e);
    sil = segsD(c2, false) + `L${pt(B[0][0])}` + segsC(B) + 'Z';
  }
  return { sil, capA: segsD(a), capB: segsD(mv(a, e)), a, e };
}

// Rounded box with vertical sides, plan rounded rect.
function rbox(cam, x0, x1, z0, z1, y0, y1, r) {
  const prof = roundedPoly([[x0, z1], [x1, z1], [x1, z0], [x0, z0]], [r, r, r, r], (p) => [p[0], y1, p[1]]);
  const pr = prism(cam, prof, [0, y0 - y1, 0]);
  return { sil: pr.sil, top: pr.capA };
}
const rrectTop = (cam, x0, x1, z0, z1, y, r) => segsD(proj(cam, roundedPoly([[x0, z1], [x1, z1], [x1, z0], [x0, z0]], [r, r, r, r], (p) => [p[0], y, p[1]])));

// ---------- splines ----------
function crD(pts, move = true) {
  let d = move ? `M${pt(pts[0])}` : `L${pt(pts[0])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d;
}
function crSample(pts, per = 8) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push(p1.map((_, j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// Lathe (vertical axis). prof: [[y, r, corner?], ...] top -> bottom.
function lathe(cam, cx, cz, prof) {
  const chains = [];
  let cur = [];
  prof.forEach((p, i) => {
    cur.push([p[0], p[1]]);
    if (p[2] && i > 0 && i < prof.length - 1) { chains.push(cur); cur = [[p[0], p[1]]]; }
  });
  chains.push(cur);
  const c = cam.P(cx, 0, cz);
  const L = [], Rr = [];
  let topSin = 0, botSin = 0;
  chains.forEach((ch, ci) => {
    const smp = ch.length > 2 ? crSample(ch, 5) : ch.length === 2 ? crSample(ch, 3) : ch;
    const l = [], r = [];
    smp.forEach((p, i) => {
      const a = smp[Math.max(0, i - 1)], b = smp[Math.min(smp.length - 1, i + 1)];
      const dy = b[0] - a[0];
      if (dy >= 0 && i > 0 && i < smp.length - 1) return; // spline overshoot
      const drdy = Math.abs(dy) < 1e-6 ? (b[1] > a[1] ? 1e3 : -1e3) * Math.sign(dy || -1) : (b[1] - a[1]) / dy;
      let sn = drdy * cam.tp;
      if (Math.abs(sn) > 0.97 && i > 0 && i < smp.length - 1) return; // surface faces the camera here: no silhouette
      const lim = i === 0 || i === smp.length - 1 ? 0.45 : 0.97;
      sn = Math.max(-lim, Math.min(lim, sn));
      const cs = Math.sqrt(1 - sn * sn);
      const X = cam.s * p[1] * cs, Y = c[1] - cam.s * p[0] * cam.cp + cam.s * p[1] * sn * cam.sp;
      l.push([c[0] - X, Y]); r.push([c[0] + X, Y]);
      if (ci === 0 && i === 0) topSin = sn;
      if (ci === chains.length - 1 && i === smp.length - 1) botSin = sn;
    });
    L.push(l); Rr.push(r);
  });
  const top = prof[0], bot = prof[prof.length - 1];
  const eT = cam.ell(cx, top[0], cz, top[1]), eB = cam.ell(cx, bot[0], cz, bot[1]);
  let d = '';
  L.forEach((l, i) => { d += crD(l, i === 0); });
  const lb = L[L.length - 1].at(-1), rb = Rr[Rr.length - 1].at(-1);
  if (bot[1] > 0.01) d += `A${f(eB.rx)} ${f(eB.ry)} 0 ${botSin < 0 ? 1 : 0} 0 ${pt(rb)}`;
  for (let i = Rr.length - 1; i >= 0; i--) d += crD(Rr[i].slice().reverse(), false);
  const lt = L[0][0];
  if (top[1] > 0.01) d += `A${f(eT.rx)} ${f(eT.ry)} 0 ${topSin > 0 ? 1 : 0} 0 ${pt(lt)}`;
  d += 'Z';
  const ell = (y, r) => cam.ell(cx, y, cz, r);
  return {
    sil: d, ell,
    ring: (y, r) => ellD(ell(y, r)),
    front: (y, r) => frontArcD(ell(y, r)),
    back: (y, r) => backArcD(ell(y, r)),
    // vertical lines on the front half at angles (deg, 0 = right, 90 = front)
    ribs: (y0, y1, r, n, a0 = 15, a1 = 165) => {
      let d = '';
      for (let k = 0; k < n; k++) {
        const a = (a0 + (a1 - a0) * (k + 0.5) / n) * R;
        const p0 = cam.P(cx + r * Math.cos(a) * cam.ca + 0, y0, cz), x = c[0] + cam.s * r * Math.cos(a);
        const yy0 = c[1] - cam.s * y0 * cam.cp + cam.s * r * Math.sin(a) * cam.sp;
        const yy1 = c[1] - cam.s * y1 * cam.cp + cam.s * r * Math.sin(a) * cam.sp;
        d += `M${f(x)} ${f(yy0)}V${f(yy1)}`;
      }
      return d;
    },
    // a vertical highlight line at angle a (deg) between heights
    streak: (y0, y1, r, a) => {
      const x = c[0] + cam.s * r * Math.cos(a * R);
      const yy0 = c[1] - cam.s * y0 * cam.cp + cam.s * r * Math.sin(a * R) * cam.sp;
      const yy1 = c[1] - cam.s * y1 * cam.cp + cam.s * r * Math.sin(a * R) * cam.sp;
      return `M${f(x)} ${f(yy0)}V${f(yy1)}`;
    },
  };
}


// ---------- extras for the guide scenes ----------
const polyD = (pts, close = true) => 'M' + pts.map(pt).join('L') + (close ? 'Z' : '');
// smooth closed curve through points (Catmull-Rom)
function smoothClosedD(pts) {
  const n = pts.length;
  let d = `M${pt(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d + 'Z';
}
function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  hi.pop(); lo.pop();
  return lo.concat(hi);
}
// thin out a polyline: drop points closer than tol to the previous kept point
function thin(pts, tol = 0.6) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) { const q = out[out.length - 1]; if (Math.hypot(pts[i][0] - q[0], pts[i][1] - q[1]) >= tol) out.push(pts[i]); }
  out.push(pts[pts.length - 1]);
  return out;
}
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const norm3 = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// a circle in 3D: centre c, plane spanned by unit u, v
function circ3(cam, c, u, v, r, n = 64, a0 = 0, a1 = 360) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * R; out.push(cam.P(...add3(add3(c, u, r * Math.cos(a)), v, r * Math.sin(a)))); }
  return out;
}
function perp(d) { const t = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const u = norm3(cross3(d, t)); return [u, cross3(d, u)]; }
// Body of revolution about an arbitrary axis, drawn as the envelope of
// spheres (exact for orthographic projection when the radius changes slowly).
// prof: [[d, r], ...] along the axis from a, unit dir.
function revolve(cam, a, dir, prof, per = 6) {
  // exact: a surface of revolution is the envelope of spheres centred on
  // the axis at d + r r' with radius r sqrt(1 + r'^2); orthographically
  // each projects to a circle, so the outline is the envelope of circles.
  const smp = crSample(prof, per);
  const m = smp.length;
  const sph = smp.map(([d, r], i) => {
    const i0 = Math.max(0, i - 1), i1 = Math.min(m - 1, i + 1);
    const rp = (smp[i1][1] - smp[i0][1]) / ((smp[i1][0] - smp[i0][0]) || 1e-6);
    const rpc = Math.max(-12, Math.min(12, rp));
    return { c: d + r * rpc, rho: Math.max(0.01, r * Math.sqrt(1 + rpc * rpc)) };
  });
  const C = sph.map((q) => cam.P(...add3(a, dir, q.c)));
  const L = [], Rr = [], keep = [];
  for (let i = 0; i < m; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(m - 1, i + 1);
    let tx = C[i1][0] - C[i0][0], ty = C[i1][1] - C[i0][1];
    const ds = Math.hypot(tx, ty);
    if (ds < 1e-6) continue;
    tx /= ds; ty /= ds;
    const sn = cam.s * (sph[i1].rho - sph[i0].rho) / ds;
    if (Math.abs(sn) >= 0.999) continue;
    const cs = Math.sqrt(1 - sn * sn), Rr0 = cam.s * sph[i].rho, nx = -ty, ny = tx;
    L.push([C[i][0] + Rr0 * (-sn * tx + cs * nx), C[i][1] + Rr0 * (-sn * ty + cs * ny)]);
    Rr.push([C[i][0] + Rr0 * (-sn * tx - cs * nx), C[i][1] + Rr0 * (-sn * ty - cs * ny)]);
    keep.push(i);
  }
  // round end cap: the far side of the last kept circle
  const li = keep[keep.length - 1], cc = C[li], rr = cam.s * sph[li].rho;
  const e1 = L[L.length - 1], e2 = Rr[Rr.length - 1];
  const a1 = Math.atan2(e1[1] - cc[1], e1[0] - cc[0]); let a2 = Math.atan2(e2[1] - cc[1], e2[0] - cc[0]);
  const ax = Math.atan2(C[Math.min(m - 1, li)][1] - C[Math.max(0, li - 2)][1], C[Math.min(m - 1, li)][0] - C[Math.max(0, li - 2)][0]);
  // go from a1 to a2 through the forward direction ax
  const norm = (v) => { while (v < 0) v += 2 * Math.PI; while (v >= 2 * Math.PI) v -= 2 * Math.PI; return v; };
  let span = norm(a2 - a1); const fw = norm(ax - a1);
  const dirn = fw <= span ? 1 : -1; if (dirn < 0) span = 2 * Math.PI - span;
  const cap = []; for (let k = 1; k < 12; k++) { const t = a1 + dirn * span * k / 12; cap.push([cc[0] + rr * Math.cos(t), cc[1] + rr * Math.sin(t)]); }
  const Lc = L.concat(cap);
  // the axis samples for mapping decorations (kept in step with L/R)
  const Ck = keep.map((i) => C[i]);
  return { L, R: Rr, C: Ck, smp, d: crD(Lc) + crD(Rr.slice().reverse(), false) + 'Z' };
}
// Tube along a 3D polyline (centreline sampled smooth); orthographic outline
// = projected centreline offset by r on both sides, capped with the end discs.
function tube(cam, pts3, r, per = 8) {
  const smp = crSample(pts3, per);
  const prof = []; let acc = 0;
  for (let i = 0; i < smp.length; i++) { if (i) acc += Math.hypot(smp[i][0] - smp[i - 1][0], smp[i][1] - smp[i - 1][1], smp[i][2] - smp[i - 1][2]); prof.push(acc); }
  const C = smp.map((p) => cam.P(...p)), Rs = r * cam.s;
  const L = [], Rr = [];
  for (let i = 0; i < C.length; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(C.length - 1, i + 1);
    let tx = C[i1][0] - C[i0][0], ty = C[i1][1] - C[i0][1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    L.push([C[i][0] - ty * Rs, C[i][1] + tx * Rs]); Rr.push([C[i][0] + ty * Rs, C[i][1] - tx * Rs]);
  }
  const cap = (i, sgn) => {
    const j = sgn > 0 ? i - 1 : i + 1;
    const d = norm3([smp[i][0] - smp[j][0], smp[i][1] - smp[j][1], smp[i][2] - smp[j][2]].map((v) => v * sgn));
    const [u, v] = perp(d);
    return { pts: circ3(cam, smp[i], u, v, r, 40), d };
  };
  return { L, R: Rr, C, smp, cap, d: polyD(thin(L.concat(Rr.slice().reverse()))) };
}

module.exports = { polyD, smoothClosedD, hull, thin, add3, norm3, cross3, circ3, perp, revolve, tube, crSample,  Cam, ellD, frontArcD, backArcD, roundedPoly, proj, segsD, prism, rbox, rrectTop, crD, lathe, f, pt, lineSeg, R };
