// The thirteen Guide me scenes. Each gets a Style (S) and returns meta.
const G = require('./geo.cjs');
const { convexLathe, Cam, ellD, frontArcD, backArcD, rbox, rrectTop, lathe, f, pt, crD, polyD, smoothClosedD, hull, revolve, tube, circ3, add3, norm3 } = G;
const O = require('./objects.cjs');
const { circle, ellipseD, groundShadow, drop, scale, dosingCup, bean, espressoCup, portafilter, de1, DE, grinder, GR, dialFace, catchCup, bell, funnel, tamper, knockBox, sprayBottle, mineralBottle, dropper, shaker, glass, paperDisc, groundsMound, PAPER } = O;
const px = (v) => `${f(v)}px`;
const origin = (p) => ` style="transform-origin:${px(p[0])} ${px(p[1])}"`;
const YAW = -32;
const scenes = {};

scenes.weigh = (S) => {
  const cam = Cam(YAW, 40, 3.0, 212, 300);
  const sc = scale(S, cam, 0, 0, 0, { right: true });
  // cup shadow on the panel
  const e = cam.ell(3, sc.top, 4, 26);
  S.shadow(ellD({ ...e, rx: e.rx * 1.25, ry: e.ry * 1.1 }));
  const foot = cam.P(0, sc.top, 2);
  // beans dropping into the cup: drawn inside the cup (frame units), after
  // its back wall and pile, before its front lip; each lands on the pile
  dosingCup(S, foot[0], foot[1] + 20, 1.36, {
    beansCls: 'k-beans',
    fall: () => {
      S.open('k-fall fx');
      [[86, 47], [134, 51], [108, 56], [150, 50], [96, 58]].forEach(([x, land], i) => {
        const y0 = -28;
        S.raw(`<g style="--fall:${land - y0}px">`);
        bean(S, x, y0, i * 47 - 30, 0.95, `k-drop d${i}`);
        S.raw('</g>');
      });
      S.close();
    },
  });
  S.slot(); // live weight on the left display
  return { lcd: sc.lcd, lcdAt: sc.lcdAt, extra: { top: 26 } };
};


// ellipse as points / helpers
const ellPts = (e, n = 96) => Array.from({ length: n }, (_, i) => { const a = i / n * 2 * Math.PI; return [e.cx + e.rx * Math.cos(a), e.cy + e.ry * Math.sin(a)]; });
const inEll = (e, p) => ((p[0] - e.cx) / e.rx) ** 2 + ((p[1] - e.cy) / e.ry) ** 2 <= 1.0001;
const lens = (a, b) => hull(ellPts(a).filter((p) => inEll(b, p)).concat(ellPts(b).filter((p) => inEll(a, p))));
// region above an ellipse's centre line, plus the ellipse: where something
// rising out of (or settling into) an opening stays visible
// (two paths: a clipPath is the union of its children; one path with both
// would cancel where they overlap under nonzero winding)
const aboveClip = (S, e, cls = '') => { const id = S.uid('ac'); S.raw(`<clipPath id="${id}"><path d="M-2000 -2000H2000V${f(e.cy)}H-2000Z"/><path d="${ellD(e)}"/></clipPath>`); return id; };

// funnel drawn as a ring: you look through it into the basket
function funnelRing(S, cam, cx, y0, cz, cls = '') {
  S.open(cls);
  const fn = G.stackLathe(cam, cx, cz, [[y0 + 20, 40], [y0 + 19, 40.5], [y0 + 7, 38.4], [y0 + 5, 37.5], [y0 + 1, 37.5], [y0 - 1, 36]], 4);
  const top = fn.ell(y0 + 20, 38), bot = fn.ell(y0 - 1, 30);
  const l = polyD(lens(top, bot));
  const k = S.uid('fr');
  S.defs.push(`<path id="${k}" d="${fn.sil}${l}" fill-rule="evenodd"/>`);
  S.raw(`<use href="#${k}" fill="url(#${S.id}bg)" fill-opacity="1" fill-rule="evenodd"/><use href="#${k}" fill="url(#${S.id}metal)" fill-rule="evenodd"/><use href="#${k}" fill="url(#${S.id}under)" fill-rule="evenodd"/><use href="#${k}" fill="none" stroke="url(#${S.id}rim)" stroke-width="1.1"/>`);
  S.fill(ellD(top) + l, 'rgb(0 0 0 / .32)', ' fill-rule="evenodd"');
  S.face(fn.ring(y0 + 20, 40) + ellD(top), `rgb(${PAPER} / .14)`);
  S.line(fn.ring(y0 + 20, 40), 's');
  S.hl(fn.streak(y0 + 17, y0 + 4, 39, 148), 0.6);
  S.close();
  return fn;
}

scenes.spray = (S) => {
  // spray from a distance: the bottle stands well back, the mist drifts
  // across onto the beans
  const cam = Cam(YAW, 20, 1.75, 150, 300);
  const sp = sprayBottle(S, cam, -95, -50, { pumpCls: 'k-pump' });
  const foot = cam.P(80, 0, 40);
  groundShadow(S, cam, 76, 44, 34, 0, 1.1);
  dosingCup(S, foot[0], foot[1] + 2, 0.82);
  const tgt = [foot[0] - 4, foot[1] - 62];
  // mist: soft puffs fanning out from the nozzle and settling on the beans
  S.open('k-mist fx');
  for (let i = 0; i < 11; i++) {
    const t = (i % 4) / 3, spread = (i * 37 % 11) - 5;
    const dx = (tgt[0] - sp.nozzle[0]) * (0.55 + 0.45 * t) + spread * 2, dy = (tgt[1] - sp.nozzle[1]) * (0.5 + 0.5 * t) + spread * 2.5;
    const r = 6 + (i % 4) * 2.6;
    S.raw(`<circle class="m${i}" cx="${f(sp.nozzle[0])}" cy="${f(sp.nozzle[1])}" r="${f(r)}" fill="url(#${S.id}mist)" style="--dx:${px(dx)};--dy:${px(dy)};--i:${i}"/>`);
  }
  S.close();
  // a few droplets resting on the beans
  S.open('k-dew');
  for (const [x, y] of [[-12, -64], [8, -58], [24, -63], [-26, -58], [14, -68]]) S.fill(circle([foot[0] + x * 0.9, foot[1] + y], 1.6), 'rgb(220 240 255 / .85)');
  S.close();
};

scenes.dial = (S) => {
  const cam = Cam(YAW, 40, 2.15, 200, 330);
  const { r, body1, dial1, col1, bel1, lid1 } = GR;
  const gx = 0, gz = 0;
  // the body, fading out below
  const body = lathe(cam, gx, gz, [[body1, r], [150, r]]);
  const fid = S.uid('fd');
  const b0 = cam.P(0, body1, 0), b1 = cam.P(0, 150, 0);
  S.raw(`<linearGradient id="${fid}" gradientUnits="userSpaceOnUse" x1="0" y1="${f(b0[1])}" x2="0" y2="${f(b1[1] + r * cam.s * cam.sp)}"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="${fid}m" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="4000" height="4000"><rect x="-2000" y="-2000" width="4000" height="4000" fill="url(#${fid})"/></mask>`);
  S.raw(`<g mask="url(#${fid}m)">`);
  S.solid(body.sil, 'cream');
  S.hl(body.streak(body1 - 8, 160, r, 150), 0.5);
  S.raw('</g>');
  const dial = lathe(cam, gx, gz, [[dial1, r + 3], [dial1 - 1, r + 4, 1], [body1 + 1, r + 4], [body1, r + 3]]);
  S.solid(dial.sil, 'cream');
  S.face(dial.ring(dial1, r + 3), 'top');
  S.face(dial.ring(dial1, r + 3), 'rgb(0 0 0 / .35)');
  dialFace(S, cam, gx, dial1, gz, r + 3, 'k-dial', true);
  S.line(dial.ring(dial1, r + 3), 's');
  // fixed pointer at the front
  S.raw(`<g transform="${cam.top(gx, dial1, gz)}"><path d="M0 ${f(r - 16)}l-3.4 -6h6.8z" style="fill:var(--acc)"/></g>`);
  const col = lathe(cam, gx, gz, [[col1, 31], [dial1, 33]]);
  S.solid(col.sil, 'metal');
  S.hl(col.streak(col1 - 3, dial1 + 3, 32, 148), 0.7);
  O.bellows(S, cam, gx, gz, col1, bel1);
  const lid = lathe(cam, gx, gz, [[lid1, 37.5], [lid1 - 1.2, 38.5, 1], [bel1, 38.5]]);
  S.solid(lid.sil, 'dark');
  S.face(lid.ring(lid1, 37.5), `rgb(${PAPER} / .08)`);
  // readout tag, to the right of the dial; leader to the pointer
  const pin = cam.P(gx, dial1, gz + r - 14);
  const num = cam.P(gx + 92, dial1 - 6, gz + 40);
  S.raw(`<path d="M${pt(pin)}L${f(num[0] - 22)} ${f(num[1])}" stroke="var(--acc)" stroke-opacity=".6" stroke-width="1" stroke-dasharray="2 3" fill="none"/>`);
  return { num: [+f(num[0]), +f(num[1])], vb: undefined, extra: { right: 0 } };
};

scenes.grind = (S) => {
  const cam = Cam(YAW, 20, 0.95, 200, 380);
  const gr = grinder(S, cam, 0, 0, { topCls: '', bellowsCls: 'k-bellows', lidCls: 'k-lid' });
  // the bellows opening (lid off) and beans dropping in
  const op = cam.ell(0, GR.bel1, 0, 30);
  // grounds falling from the chute into the catch cup
  S.open('k-grains fx');
  for (let i = 0; i < 6; i++) { const p = cam.P(gr.ccx - 12 + (i % 3) * 12, 126, gr.ccz + (i % 2) * 6); S.raw(`<circle class="g${i}" cx="${f(p[0])}" cy="${f(p[1])}" r="1.3" fill="#b07a4c"/>`); }
  S.close();
  // vibration marks while running
  const vb = cam.P(-GR.r - 8, 150, 0);
  S.raw(`<path class="k-vib fx" d="M${f(vb[0])} ${f(vb[1] - 14)}q-5 14 0 28M${f(vb[0] - 7)} ${f(vb[1] - 20)}q-7 20 0 40" fill="none" stroke="var(--acc)" stroke-width="1.4" stroke-linecap="round"/>`);
  // tap puff out of the chute
  // dosing cup pouring beans into the bellows
  const top = cam.P(0, GR.lid1 + 6, 0);
  const k = 0.5;
  const spout = [top[0] - 4, top[1] - 34];
  S.raw(`<g class="k-pour fx"${origin(spout)}>`);
  dosingCup(S, spout[0] - 13 * k + 110 * k, spout[1] - 8 * k + 121 * k, k);
  S.raw('</g>');
  S.open('k-in fx');
  for (let i = 0; i < 5; i++) bean(S, spout[0] - 2 + (i % 2) * 5, spout[1] + 4, i * 60, 0.45, `b${i}`);
  S.close();
  powerCallout(S, cam);
  return { extra: { top: 30 } };
};

// The grinder's round power button sits low on the back of the base, out of
// view, so it gets a manual-style callout: an inset bubble with the button,
// a leader that runs behind the base (dashed where hidden). The button
// presses and its ring pulses at the "on" and "off" moments of the loop.
function powerCallout(S, cam) {
  const tgt = cam.P(-50, 7, -12); tgt[1] += 11; // into the base's side band
  const c = [tgt[0] - 112, tgt[1] - 92], R0 = 40;
  // leader: solid from the bubble to the base's edge, dashed behind it
  const edge = [tgt[0] - 32, tgt[1] - 2];
  const dx = edge[0] - c[0], dy = edge[1] - c[1], L = Math.hypot(dx, dy);
  const st = [c[0] + dx / L * (R0 + 2), c[1] + dy / L * (R0 + 2)];
  S.raw(`<path d="M${pt(st)}L${pt(edge)}" stroke="var(--acc)" stroke-width="1.6" stroke-linecap="round" fill="none"/>`);
  S.raw(`<path d="M${pt(edge)}L${pt(tgt)}" stroke="var(--acc)" stroke-opacity=".8" stroke-width="1.6" stroke-dasharray="3 3.5" stroke-linecap="round" fill="none"/>`);
  S.raw(`<circle cx="${f(tgt[0])}" cy="${f(tgt[1])}" r="3" fill="var(--acc)"/>`);
  // the bubble: a close-up of the back of the base
  const cid = S.uid('pc');
  S.raw(`<clipPath id="${cid}"><circle cx="${f(c[0])}" cy="${f(c[1])}" r="${R0}"/></clipPath>`);
  S.raw(`<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${R0}" fill="url(#${S.id}bg)"/>`);
  S.raw(`<g clip-path="url(#${cid})"><g transform="translate(${f(c[0])} ${f(c[1])})">`);
  // body above, the base band with the button, the bench below
  S.raw(`<rect x="-50" y="-50" width="100" height="36" fill="rgb(${PAPER} / .16)"/><rect x="-50" y="-50" width="100" height="36" fill="url(#${S.id}cream)"/><rect x="-50" y="-50" width="100" height="36" fill="url(#${S.id}side)"/>`);
  S.raw(`<path d="M-50 -14H50V26H-50Z" fill="rgb(${PAPER} / .2)"/><path d="M-50 -14H50V26H-50Z" fill="url(#${S.id}cream)"/><path d="M-50 -14H50V26H-50Z" fill="url(#${S.id}under)"/>`);
  S.raw(`<path d="M-50 -14H50" stroke="rgb(255 255 255 / .45)" stroke-width="1.2"/><path d="M-50 -12.6H50" stroke="rgb(0 0 0 / .25)" stroke-width="1"/>`);
  S.raw(`<rect x="-50" y="26" width="100" height="30" fill="rgb(0 0 0 / .35)"/><path d="M-50 26H50" stroke="rgb(255 255 255 / .2)" stroke-width="1"/>`);
  S.raw(`<ellipse cx="0" cy="28" rx="20" ry="3" fill="url(#${S.id}sh)"/>`);
  S.raw('</g></g>');
  // the button (round, chrome bezel, dark cap with the power symbol)
  const b = [c[0], c[1] + 6];
  S.raw(`<g class="k-btnring fx"${origin(b)}><circle cx="${f(b[0])}" cy="${f(b[1])}" r="17" fill="none" stroke="var(--acc)" stroke-width="2"/></g>`);
  S.raw(`<circle cx="${f(b[0])}" cy="${f(b[1])}" r="14" fill="url(#${S.id}brushed)" stroke="url(#${S.id}rim)" stroke-width="1"/>`);
  S.raw(`<g class="k-btn"${origin(b)}>`);
  S.raw(`<circle cx="${f(b[0])}" cy="${f(b[1])}" r="10.5" fill="url(#${S.id}black)" stroke="rgb(255 255 255 / .3)" stroke-width=".8"/>`);
  S.raw(`<path d="M${f(b[0] - 3.4)} ${f(b[1] - 6)}A9 9 0 0 0 ${f(b[0] - 7)} ${f(b[1] - 3.2)}" fill="none" stroke="rgb(255 255 255 / .35)" stroke-width="1.2" stroke-linecap="round"/>`);
  const pw = (col, cls = '') => S.raw(`<path${cls ? ` class="${cls}"` : ''} d="M${f(b[0] - 3.6)} ${f(b[1] - 3.2)}A5 5 0 1 0 ${f(b[0] + 3.6)} ${f(b[1] - 3.2)}M${f(b[0])} ${f(b[1] - 6)}V${f(b[1] - 0.6)}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round"/>`);
  pw(`rgb(${PAPER} / .7)`);
  pw('var(--acc)', 'k-power');
  S.raw('</g>');
  // rim, and an accent ring that brightens at the on/off moments
  S.raw(`<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${R0}" fill="none" stroke="url(#${S.id}rim)" stroke-width="1.2"/>`);
  S.raw(`<circle class="k-callout" cx="${f(c[0])}" cy="${f(c[1])}" r="${R0 + 1.5}" fill="none" stroke="var(--acc)" stroke-width="2"/>`);
}

// The IKAPE basket is a tapered cone: seen nearly side-on, it hangs above
// the holder long enough for the sloped walls to read, then drops in.
scenes.basket = (S) => {
  const cam = Cam(YAW, 24, 2.0, 210, 260);
  const cx = 0, cz = 0, y0 = 40;
  groundShadow(S, cam, cx, cz, 40, 0, 1.05);
  const pf = portafilter(S, cam, cx, y0, cz, { content: 'none', ang: 104 });
  // bench seen through the bottomless holder
  S.face(pf.holder.ring(y0 - 0.6, 31.4), 'rgb(4 12 14 / .85)');
  // the basket is hidden only by the holder's front wall: visible outside
  // the holder, above the rim's centre line, and through the opening
  const rim = pf.holder.ell(y0 - 0.6, 36);
  const cid = S.uid('bh');
  S.raw(`<clipPath id="${cid}"><path clip-rule="evenodd" d="M-2000 -2000H2000V2000H-2000Z${pf.holder.sil}"/><path d="M-2000 -2000H2000V${f(rim.cy)}H-2000Z"/><path d="${pf.holder.ring(y0 - 0.6, 31.4)}"/></clipPath>`);
  S.raw(`<g clip-path="url(#${cid})"><g class="k-basket">`);
  O.basket(S, cam, cx, y0, cz);
  S.raw('</g></g>');
  // the holder's front rim in front of the seated basket's wall
  S.line(pf.holder.front(y0 - 0.6, 36), 's');
  // check badge
  const c = cam.P(cx + 56, y0 + 20, cz - 4);
  S.raw(`<g class="k-check"${origin(c)}><circle cx="${f(c[0])}" cy="${f(c[1])}" r="15" fill="url(#${S.id}glow)"/><circle cx="${f(c[0])}" cy="${f(c[1])}" r="11" fill="rgb(4 14 17 / .6)" stroke="var(--acc)" stroke-width="1.6"/><path d="M${f(c[0] - 5)} ${f(c[1])}l3.4 3.6l6.4 -7" fill="none" stroke="var(--acc)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  // the lowered position is the static frame; leave room above for the lift
  return { extra: { top: 52 } };
};

scenes.funnel = (S) => {
  const cam = Cam(YAW, 24, 1.55, 210, 330);
  const cx = 0, cz = 0, y0 = 40;
  S.open('k-tapline fx');
  const tl = cam.P(cx, 0, cz + 40);
  S.raw(`<path d="M${f(tl[0] - 46)} ${f(tl[1] + 6)}l-10 4M${f(tl[0] + 50)} ${f(tl[1] + 4)}l10 4M${f(tl[0] - 40)} ${f(tl[1] + 14)}l-8 7M${f(tl[0] + 44)} ${f(tl[1] + 12)}l8 7" stroke="var(--acc)" stroke-width="1.6" stroke-linecap="round" fill="none"/>`);
  S.close();
  groundShadow(S, cam, cx, cz, 42, 0, 1.05);
  S.open('k-stack');
  portafilter(S, cam, cx, y0, cz, { content: 'empty', ang: 104, inside: () => groundsMound(S, cam, cx, y0, cz, 'k-mound') });
  funnelRing(S, cam, cx, y0, cz);
  S.close();
  // catch cup on the funnel, bell inside; the bell lifts out, then the cup
  const cy0 = y0 + 20;
  S.open('k-cup');
  const cc = catchCup(S, cam, cx, cy0, cz, { shadow: false });
  const clip = aboveClip(S, cc.cup.ell(cc.top, cc.r - 2.2));
  S.raw(`<g clip-path="url(#${clip})">`);
  bell(S, cam, cx, cy0 + 2, cz, 'k-bell');
  S.raw('</g>');
  S.close();
  return { extra: { top: 40 } };
};

scenes.tamp = (S) => {
  const cam = Cam(YAW, 24, 1.55, 210, 330);
  const cx = 0, cz = 0, y0 = 40;
  groundShadow(S, cam, cx, cz, 42, 0, 1.05);
  portafilter(S, cam, cx, y0, cz, { content: 'empty', ang: 104, inside: () => { groundsMound(S, cam, cx, y0, cz, 'k-loose'); S.open('k-tamped'); S.face(cam.ell && ellD(cam.ell(cx, y0 - 8, cz, 28.4)), `url(#${S.id}coffee)`); S.close(); } });
  funnelRing(S, cam, cx, y0, cz, 'k-funnel fx');
  // impact marks
  const h = cam.P(cx, y0 + 6, cz);
  S.raw(`<path class="k-hit fx" d="M${f(h[0] - 70)} ${f(h[1] - 4)}l-12 -4M${f(h[0] - 68)} ${f(h[1] + 8)}l-12 2M${f(h[0] + 70)} ${f(h[1] - 8)}l12 -4M${f(h[0] + 70)} ${f(h[1] + 4)}l12 2" stroke="var(--acc)" stroke-width="1.8" stroke-linecap="round" fill="none"/>`);
  tamper(S, cam, cx, y0, cz, { cls: 'k-tamper', pressCls: 'k-press' });
};

scenes.paper = (S) => {
  const cam = Cam(YAW, 30, 2.0, 210, 260);
  const cx = 0, cz = 0, y0 = 40;
  groundShadow(S, cam, cx, cz, 40, 0, 1.05);
  const pf = portafilter(S, cam, cx, y0, cz, { content: 'tamped', ang: 104 });
  const clip = aboveClip(S, pf.holder.ell(y0, 29));
  S.raw(`<g clip-path="url(#${clip})"><g class="k-paper">`);
  paperDisc(S, cam, cx, y0 - 7.6, cz);
  S.raw('</g></g>');
};

scenes.minerals = (S) => {
  const cam = Cam(YAW, 22, 1.5, 200, 300);
  const bx = -60, bz = -14, cx = 30, cz = 26;
  const capY = 78;
  // dropper rest pose: above the cup; the animation starts it in the bottle
  const restY = O.CUP_H + 64 + 12;
  const inB = cam.P(bx, capY, bz), atC = cam.P(cx - 4, restY, cz);
  S.open('k-shake', origin(cam.P(bx, 0, bz)));
  mineralBottle(S, cam, bx, bz, {
    dropper: () => {
      S.raw(`<g class="k-dropper" style="--dx:${px(inB[0] - atC[0])};--dy:${px(inB[1] - atC[1])}">`);
      const dp = dropper(S, cam, cx - 4, restY, cz, { bulbCls: 'k-bulb' });
      S.raw('</g>');
      S.tip = dp.tip;
    },
  });
  S.close();
  const cup = espressoCup(S, cam, cx, 0, cz);
  const t = S.tip;
  const dc = aboveClip(S, cup.ell(cup.rimY, cup.rimR));
  S.raw(`<g clip-path="url(#${dc})"><path class="k-drip" d="${drop(t[0], t[1] + 7, 2.6)}" style="fill:var(--acc)"/></g>`);
};

// Pull and Rinse are framed close on the group head: the top-facing
// controller disc, the portafilter, the cup and scale; the machine body runs
// off the panel edge.
const W = 420, H = 390;
function frameAround(pts, pad = 0.06) {
  let x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
  let y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
  let w = x1 - x0, h = y1 - y0; const p = Math.max(w, h) * pad;
  x0 -= p; y0 -= p; w += 2 * p; h += 2 * p;
  if (w / h > W / H) { const nh = w * H / W; y0 -= (nh - h) / 2; h = nh; } else { const nw = h * W / H; x0 -= (nw - w) / 2; w = nw; }
  return [x0, y0, w, h].map((v) => +v.toFixed(1)).join(' ');
}
const GH_CAM = () => Cam(YAW, 30, 1, 0, 0);
function groupFrame(cam, lowY) {
  const { gx, gz, gTop, gR } = DE;
  const e = cam.ell(gx, gTop, gz, gR);
  return frameAround([[e.cx - e.rx - 70, e.cy - e.ry - 6], [e.cx + e.rx + 62, e.cy - e.ry - 6], cam.P(gx - 10, lowY, gz + 70), cam.P(gx + 40, lowY, gz + 60)], 0.03);
}

scenes.start = (S) => {
  const cam = GH_CAM();
  const { gx, gz } = DE;
  let sc;
  de1(S, cam, {
    lit: 'brew', tablet: false,
    under: () => { sc = scale(S, cam, gx, gz + 4, DE.FY - 2, {}); espressoCup(S, cam, gx, sc.top, gz + 4); },
    pf: () => portafilter(S, cam, gx, DE.pf, gz, { content: 'tamped', ang: 150, tilt: -2 }),
  });
  return { vb: groupFrame(cam, DE.FY - 12) };
};

scenes.rinse = (S) => {
  const cam = GH_CAM();
  const { gx, gz } = DE;
  const y0 = 196;
  de1(S, cam, {
    lit: 'flush', tablet: false,
    pf: () => portafilter(S, cam, gx, y0, gz, { content: 'empty', ang: 150, tilt: 3, inside: (h) => { S.raw(`<path class="k-pool" d="${h.ring(y0 - 14, 27.5)}" style="fill:var(--acc)" fill-opacity=".3"/>`); } }),
    water: () => {
      let d = '';
      for (const [dx, dz] of [[-14, -6], [-6, 4], [2, -2], [10, 6], [16, -4], [-2, 12], [6, -12]]) d += `M${pt(cam.P(gx + dx, DE.pf - 1, gz + dz))}L${pt(cam.P(gx + dx * 0.9, y0 - 12, gz + dz * 0.9))}`;
      S.raw(`<path class="k-water" d="${d}" fill="none" stroke="var(--acc)" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="7 6"/>`);
    },
  });
  return { vb: groupFrame(cam, 150) };
};

scenes.knock = (S) => {
  const cam = Cam(YAW, 26, 1.3, 210, 330);
  const { by, br, bz } = O.KB;
  // the upturned portafilter's rim strikes the bar just behind its centre;
  // the puck (paper side down) drops in front of the bar
  const pz = bz + 26, hitY = by + br, restY = hitY + 30;
  const hit = (restY - hitY) * cam.s * cam.cp;
  const fall = (hitY + 8 - 14) * cam.s * cam.cp;
  knockBox(S, cam, 0, 0, {
    front: ({ cut, inner, sil }) => {
      const cid = S.uid('kc');
      S.raw(`<clipPath id="${cid}"><path clip-rule="evenodd" d="M-2000 -2000H2000V2000H-2000Z${sil}"/><path d="${inner}"/><path d="${cut}"/></clipPath>`);
      S.raw(`<g clip-path="url(#${cid})"><g class="k-puck fx" style="--hit:${px(hit)};--fall:${px(fall)}">`);
      const py = restY + 8;
      const pk = lathe(cam, 2, pz, [[py + 11, 28.2], [py + 1.2, 28.4], [py, 27.8]]);
      S.solid(pk.sil, 'coffee', { under: false, rim: 0.6 });
      S.face(pk.ring(py + 11, 28.2), 'rgb(0 0 0 / .22)');
      S.hl(pk.streak(py + 10, py + 2, 28.3, 150), 0.25);
      S.raw(`<path d="${pk.front(py + 0.8, 28)}" stroke="#f4f5f1" stroke-width="2.4" fill="none"/>`);
      S.raw('</g></g>');
    },
  });
  S.open('k-knock', ` style="--hit:${px(hit)}"`);
  invertedPortafilter(S, cam, 2, restY, pz);
  S.close();
};
function invertedPortafilter(S, cam, cx, y0, cz) {
  const ang = 150 * Math.PI / 180;
  const dir = norm3([Math.cos(ang), 0.05, Math.sin(ang)]);
  const holder = G.stackLathe(cam, cx, cz, [[y0 + 13.6, 34.6], [y0 + 12, 36.2], [y0 + 1.4, 36.5], [y0 + 0.6, 36]], 3);
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
  const H = [[0, 11.5], [12, 11.4], [26, 11.9], [42, 13.6], [60, 15.8], [78, 16.5], [96, 16], [112, 14], [124, 11.2], [133, 7.6], [138.5, 3.4], [140, 0.6]];
  O.handleMarble(S, cam, add3(a0, dir, 30), dir, H);
}

scenes.done = (S) => {
  const cam = Cam(YAW, 18, 1.15, 160, 330);
  const sx = -40, sz = 0, gx = 92, gz = 30;
  S.open('k-shadow');
  groundShadow(S, cam, sx, sz, 36, 0, 1.05);
  S.close();
  // the glass, filling with the latte, foam on top
  const g = glass(S, cam, gx, gz, {
    inside: (gl) => {
      const liq = lathe(cam, gx, gz, [[58, 31.6], [6.5, 28.6, 1], [6, 28.4]]);
      const bot = cam.P(gx, 6, gz);
      S.raw(`<g class="k-fill"${origin(bot)}>`);
      S.fill(liq.sil, `url(#${S.id}latte)`);
      S.raw(`<path d="${liq.streak(54, 10, 30, 150)}" stroke="rgb(255 240 220 / .35)" stroke-width="2" fill="none"/>`);
      S.raw('</g>');
      S.open('k-foam');
      const fm = lathe(cam, gx, gz, [[68, 32.4], [58, 31.6]]);
      S.fill(fm.sil, 'rgb(246 236 220 / .95)');
      S.fill(fm.ring(68, 32.4), 'rgb(255 250 240)');
      const ft = fm.ell(68, 32.4);
      S.fill(ellD({ ...ft, rx: ft.rx * 0.55, ry: ft.ry * 0.5, cx: ft.cx - ft.rx * 0.18, cy: ft.cy - ft.ry * 0.12 }), 'rgb(255 255 255 / .45)');
      S.raw(`<path d="${fm.front(66.5, 32.3)}" fill="none" stroke="rgb(200 170 130 / .35)" stroke-width="1"/>`);
      S.close();
    },
  });
  // pour stream (only while pouring)
  const gt = cam.P(gx - 4, 84, gz);
  const pivot = cam.P(sx, 100, sz);
  const spout = cam.P(sx, 192, sz);
  const th = 118 * Math.PI / 180;
  const v = [spout[0] - pivot[0], spout[1] - pivot[1]];
  const rv = [v[0] * Math.cos(th) - v[1] * Math.sin(th), v[0] * Math.sin(th) + v[1] * Math.cos(th)];
  const land = [gt[0] - 2, gt[1] - 46];
  const T = [land[0] - (pivot[0] + rv[0]), land[1] - (pivot[1] + rv[1])];
  S.raw(`<path class="k-stream fx" d="M${f(land[0])} ${f(land[1] + 2)}C${f(land[0] + 3)} ${f(land[1] + 20)} ${f(gt[0] - 1)} ${f(gt[1] - 14)} ${f(gt[0] - 1)} ${f(gt[1] + 18)}" stroke="url(#${S.id}latte)" stroke-width="4.5" stroke-linecap="round" fill="none" stroke-dasharray="80 200"/>`);
  S.raw(`<g class="k-shaker" style="transform-origin:${px(pivot[0])} ${px(pivot[1])};--tx:${px(T[0])};--ty:${px(T[1])}">`);
  shaker(S, cam, sx, sz, { capCls: 'k-cap' });
  S.raw('</g>');
  return { extra: { top: 30 } };
};

module.exports = scenes;
