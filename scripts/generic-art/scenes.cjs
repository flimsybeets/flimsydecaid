// The seventeen generic Guide me scenes. Each gets a Style (S) and returns meta.
const G = require('./geo.cjs');
const { Cam, ellD, lathe, stackLathe, f, pt, crD, polyD, tube, add3, norm3 } = G;
const O = require('./objects.cjs');
const T = require('./tools.cjs');
const M = require('./machines.cjs');
const { circle, groundShadow, aboveClip, clipTo, px, bean, beanHeap, dosingCup, scale } = O;
const YAW = -32;
const scenes = {};

scenes.weigh = (S) => {
  const cam = Cam(YAW, 36, 2.7, 210, 250);
  const sc = scale(S, cam, 0, 0, 0);
  const cy = sc.top;
  // cup stands on the scale, a little behind the display
  const cup = dosingCup(S, cam, 0, cy, -8, {
    inside: ({ inner, R, y0, h }) => {
      S.open('k-beans');
      beanHeap(S, cam, 0, y0 + h - 15, -8, R - 7, 17, cam.s * 0.4);
      S.close();
    },
  });
  // beans dropping into the cup: above the rim and through the opening
  const ac = aboveClip(S, cup.inner);
  S.raw(`<g clip-path="url(#${ac})" class="fx"><g class="k-fall">`);
  const cp = cam.P(0, cy + cup.h, -8);
  [[-14, 46], [12, 52], [-2, 58], [20, 50], [-22, 56]].forEach(([dx, land], i) => {
    const y0 = cp[1] - 78 - (i % 3) * 8;
    S.raw(`<g style="--fall:${f(cp[1] + land * 0.0 + 28 - y0)}px">`);
    bean(S, cp[0] + dx, y0, i * 47 - 30, cam.s * 0.4, `k-drop d${i}`);
    S.raw('</g>');
  });
  S.raw('</g></g>');
  S.slot();
  return { lcd: sc.lcd, lcdAt: sc.lcdAt, extra: { top: 20 } };
};


// ---- the portafilter series: same camera, same portafilter, one tool each
const PF = () => ({ cam: Cam(YAW, 26, 1.6, 210, 330), cx: 0, cz: 0, y0: 40 });

scenes.basket = (S) => {
  const cam = Cam(YAW, 24, 2.0, 210, 260);
  const cx = 0, cz = 0, y0 = 40;
  groundShadow(S, cam, cx, cz, 40, 0, 1.05);
  const pf = T.portafilter(S, cam, cx, y0, cz, { content: 'none', ang: 104 });
  S.face(pf.holder.ring(y0 - 0.6, 31.4), 'rgb(4 12 14 / .85)');
  // the basket is hidden only by the holder's front wall: visible outside the
  // holder, above the rim's centre line, and through the opening
  const rim = pf.holder.ell(y0 - 0.6, 36);
  const cid = S.uid('bh');
  S.raw(`<clipPath id="${cid}"><path clip-rule="evenodd" d="M-2000 -2000H2000V2000H-2000Z${pf.holder.sil}"/><path d="M-2000 -2000H2000V${f(rim.cy)}H-2000Z"/><path d="${pf.holder.ring(y0 - 0.6, 31.4)}"/></clipPath>`);
  S.raw(`<g clip-path="url(#${cid})"><g class="k-basket">`);
  T.basket(S, cam, cx, y0, cz);
  S.raw('</g></g>');
  S.line(pf.holder.front(y0 - 0.6, 36), 's');
  const c = cam.P(cx + 58, y0 + 18, cz - 4);
  S.raw(`<g class="k-check" style="transform-origin:${px(c[0])} ${px(c[1])}"><circle cx="${f(c[0])}" cy="${f(c[1])}" r="15" fill="url(#${S.id}glow)"/><circle cx="${f(c[0])}" cy="${f(c[1])}" r="11" fill="rgb(4 14 17 / .6)" stroke="var(--acc)" stroke-width="1.6"/><path d="M${f(c[0] - 5)} ${f(c[1])}l3.4 3.6l6.4 -7" fill="none" stroke="var(--acc)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  return { extra: { top: 56 } };
};

scenes.funnel = (S) => {
  const cam = Cam(YAW, 34, 1.6, 210, 330), cx = 0, cz = 0, y0 = 40;
  groundShadow(S, cam, cx, cz, 42, 0, 1.05);
  T.portafilter(S, cam, cx, y0, cz, { content: 'empty', ang: 104, inside: () => T.groundsMound(S, cam, cx, y0, cz, 'k-mound') });
  T.funnelRing(S, cam, cx, y0, cz);
  // grounds dropping in from above (visible above the funnel's rim and through its opening)
  const ftop = cam.ell(cx, y0 + 22, cz, 34);
  const ac = aboveClip(S, ftop);
  S.raw(`<g clip-path="url(#${ac})" class="fx"><g class="k-grains">`);
  const gp = cam.P(cx, y0 + 22, cz);
  [[-12, 0], [-4, 3], [5, 1], [12, 4], [0, 6], [-8, 7], [9, 8]].forEach(([dx, k], i) => {
    S.raw(`<g style="--fall:${f(34 - k)}px"><circle class="k-grain g${i}" cx="${f(gp[0] + dx)}" cy="${f(gp[1] - 70 - k * 4)}" r="${1.5 + (i % 3) * 0.35}" fill="#b07a4c"/></g>`);
  });
  S.raw('</g></g>');
  return { extra: { top: 30 } };
};

scenes.wdt = (S) => {
  const { cam, cx, cz, y0 } = PF();
  groundShadow(S, cam, cx, cz, 42, 0, 1.05);
  T.portafilter(S, cam, cx, y0, cz, { content: 'empty', ang: 104, inside: () => { T.groundsMound(S, cam, cx, y0, cz, 'k-clump'); T.groundsFlat(S, cam, cx, y0 - 3, cz, 'k-even'); } });
  // needles reach 14 mm below the rim: show only above the front rim and through the opening
  const ac = aboveClip(S, cam.ell(cx, y0, cz, 29));
  S.raw(`<g clip-path="url(#${ac})"><g class="k-stir">`);
  T.wdtTool(S, cam, cx, y0 + 4, cz);
  S.raw('</g></g>');
  return { extra: { top: 20 } };
};

scenes.distribute = (S) => {
  const { cam, cx, cz, y0 } = PF();
  groundShadow(S, cam, cx, cz, 42, 0, 1.05);
  T.portafilter(S, cam, cx, y0, cz, { content: 'level', ang: 104 });
  S.open('k-tool');
  T.distributor(S, cam, cx, y0 + 6, cz);
  S.close();
  // a swirl showing the turn
  const e = cam.ell(cx, y0 + 12, cz, 42);
  S.raw(`<path class="k-swirl fx" d="M${f(e.cx - e.rx)} ${f(e.cy)}A${f(e.rx)} ${f(e.ry)} 0 0 0 ${f(e.cx)} ${f(e.cy + e.ry)}" fill="none" stroke="var(--acc)" stroke-width="1.8" stroke-linecap="round"/>`);
  return { extra: { top: 10 } };
};

scenes.tamp = (S) => {
  const { cam, cx, cz, y0 } = PF();
  groundShadow(S, cam, cx, cz, 42, 0, 1.05);
  T.portafilter(S, cam, cx, y0, cz, {
    content: 'empty', ang: 104,
    inside: () => { T.groundsFlat(S, cam, cx, y0 - 3, cz, 'k-loose'); T.groundsFlat(S, cam, cx, y0 - 7, cz, 'k-tamped', { tamped: true }); },
  });
  const h = cam.P(cx, y0 + 6, cz);
  S.raw(`<path class="k-hit fx" d="M${f(h[0] - 70)} ${f(h[1] - 4)}l-12 -4M${f(h[0] - 68)} ${f(h[1] + 8)}l-12 2M${f(h[0] + 70)} ${f(h[1] - 8)}l12 -4M${f(h[0] + 70)} ${f(h[1] + 4)}l12 2" stroke="var(--acc)" stroke-width="1.8" stroke-linecap="round" fill="none"/>`);
  T.tamper(S, cam, cx, y0 - 3, cz, { cls: 'k-tamper', pressCls: 'k-press' });
  return { extra: { top: 20 } };
};

scenes.puckscreen = (S) => {
  const cam = Cam(YAW, 30, 2.0, 210, 260);
  const cx = 0, cz = 0, y0 = 40;
  groundShadow(S, cam, cx, cz, 40, 0, 1.05);
  const pf = T.portafilter(S, cam, cx, y0, cz, { content: 'tamped', ang: 104 });
  const ac = aboveClip(S, pf.holder.ell(y0, 29));
  S.raw(`<g clip-path="url(#${ac})"><g class="k-screen">`);
  T.puckScreen(S, cam, cx, y0 - 7, cz);
  S.raw('</g></g>');
  return { extra: { top: 10 } };
};

scenes.paper = (S) => {
  const cam = Cam(YAW, 30, 2.0, 210, 260);
  const cx = 0, cz = 0, y0 = 40;
  groundShadow(S, cam, cx, cz, 40, 0, 1.05);
  const pf = T.portafilter(S, cam, cx, y0, cz, { content: 'tamped', ang: 104 });
  const ac = aboveClip(S, pf.holder.ell(y0, 29));
  S.raw(`<g clip-path="url(#${ac})"><g class="k-paper">`);
  T.paperDisc(S, cam, cx, y0 - 6.6, cz);
  S.raw('</g></g>');
  return { extra: { top: 10 } };
};

scenes.spray = (S) => {
  // the bottle stands back on the left, the mist drifts across onto the beans
  const cam = Cam(YAW, 24, 1.9, 240, 300);
  const sp = M.sprayBottle(S, cam, -104, 36, { triggerCls: 'k-trigger' });
  const cx = 84, cz = -18;
  const cup = dosingCup(S, cam, cx, 0, cz, {
    inside: ({ R, y0, h }) => { beanHeap(S, cam, cx, y0 + h - 15, cz, R - 7, 17, cam.s * 0.4); },
  });
  const tgt = cam.P(cx - 4, 34, cz);
  S.open('k-mist fx');
  for (let i = 0; i < 11; i++) {
    const t = (i % 4) / 3, spread = (i * 37 % 11) - 5;
    const dx = (tgt[0] - sp.nozzle[0]) * (0.55 + 0.45 * t) + spread * 2, dy = (tgt[1] - sp.nozzle[1]) * (0.5 + 0.5 * t) + spread * 2.5;
    const r = 6 + (i % 4) * 2.6;
    S.raw(`<circle cx="${f(sp.nozzle[0])}" cy="${f(sp.nozzle[1])}" r="${f(r)}" fill="url(#${S.id}mist)" style="--dx:${px(dx)};--dy:${px(dy)};--i:${i}"/>`);
  }
  S.close();
  const c = cam.P(cx, 46, cz);
  S.open('k-dew fx');
  for (const [x, y] of [[-14, -6], [8, 0], [22, -5], [-26, 2], [12, -12]]) S.fill(circle([c[0] + x, c[1] + y], 1.7), 'rgb(220 240 255 / .85)');
  S.close();
  return { extra: { top: 4 } };
};

scenes.grinder = (S) => {
  const cam = Cam(YAW, 40, 1.9, 200, 330);
  const g = M.grinder(S, cam, { full: false, big: true, dialCls: 'k-dial', hopCls: '' });
  // readout tag to the right of the ring, with a leader to the pointer
  const pin = cam.P(0, M.GR.ringTop, M.GR.ringR - 14);
  const num = cam.P(M.GR.ringR + 54, M.GR.ringTop - 6, 40);
  S.raw(`<path d="M${pt(pin)}L${f(num[0] - 24)} ${f(num[1])}" stroke="var(--acc)" stroke-opacity=".6" stroke-width="1" stroke-dasharray="2 3" fill="none"/>`);
  return { num: [+f(num[0]), +f(num[1])] };
};

scenes.grind = (S) => {
  const cam = Cam(YAW, 20, 1.15, 210, 380);
  const pileY = 14 + 50 - 24;
  const g = M.grinder(S, cam, {
    btnCls: 'k-btn', hopCls: 'k-hopper',
    cup: {
      inside: ({ R }) => {
        const e = cam.ell(M.GR.cupX, pileY - 1.5, 0, R - 8);
        S.open('k-pile', ` style="transform-origin:${px(e.cx)} ${px(e.cy)}"`);
        T.groundsMound(S, cam, M.GR.cupX, pileY, 0, '', { r: R - 8, rise: 9 });
        S.close();
      },
    },
  });
  // grounds dropping from the chute into the cup
  const ac = aboveClip(S, g.cup.inner);
  const fall = (g.spout[1] < 0 ? 0 : (78 - (pileY + 6)) * cam.s * cam.cp);
  S.raw(`<g clip-path="url(#${ac})" class="fx"><g class="k-grains">`);
  for (let i = 0; i < 7; i++) {
    const p = cam.P(M.GR.cupX - 7 + (i % 4) * 4.6, 77, (i % 3 - 1) * 3);
    S.raw(`<g style="--fall:${f(fall)}px"><circle class="k-grain g${i}" cx="${f(p[0])}" cy="${f(p[1])}" r="${1.2 + (i % 3) * 0.3}" fill="#b07a4c"/></g>`);
  }
  S.raw('</g></g>');
  // vibration marks while running
  const vb = cam.P(-M.GR.r - 8, 120, 0);
  S.raw(`<path class="k-vib fx" d="M${f(vb[0])} ${f(vb[1] - 14)}q-5 14 0 28M${f(vb[0] - 7)} ${f(vb[1] - 20)}q-7 20 0 40" fill="none" stroke="var(--acc)" stroke-width="1.4" stroke-linecap="round"/>`);
  return {};
};

module.exports = scenes;
