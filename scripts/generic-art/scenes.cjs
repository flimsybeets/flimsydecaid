// The seventeen generic Guide me scenes. Each gets a Style (S) and returns meta.
const G = require('./geo.cjs');
const { Cam, ellD, lathe, stackLathe, f, pt, crD, polyD, tube, add3, norm3 } = G;
const O = require('./objects.cjs');
const T = require('./tools.cjs');
const Mo = require('./more.cjs');
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
  return { lcd: sc.lcd, lcdAt: sc.lcdAt, extra: { top: 34 } };
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
  return { extra: { top: 44 } };
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
  const g = M.grinder(S, cam, { full: false, big: true, dialCls: 'k-dial', hopper: false });
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


// ---- machine scenes: the DE1 seen from the front-left, framed on what matters
const W = 448, H = 320;
function frameAround(pts, pad = 0.05) {
  let x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
  let y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
  let w = x1 - x0, h = y1 - y0; const p = Math.max(w, h) * pad;
  x0 -= p; y0 -= p; w += 2 * p; h += 2 * p;
  if (w / h > W / H) { const nh = w * H / W; y0 -= (nh - h) / 2; h = nh; } else { const nw = h * W / H; x0 -= (nw - w) / 2; w = nw; }
  return [x0, y0, w, h].map((v) => +v.toFixed(1)).join(' ');
}
const { DE } = M;
const MC = () => Cam(YAW, 28, 1, 0, 0);

scenes.minerals = (S) => {
  const cam = Cam(YAW, 22, 1.5, 200, 300);
  const bx = -56, bz = -14, cx = 34, cz = 26;
  const restY = 52 + 14;
  const capY = 15, lift = 93 * cam.s * cam.cp;
  const inB = cam.P(bx, capY, bz), atC = cam.P(cx - 4, restY, cz);
  const dp = [];
  S.open('k-shake', ` style="transform-origin:${px(cam.P(bx, 0, bz)[0])} ${px(cam.P(bx, 0, bz)[1])}"`);
  Mo.dropperBottle(S, cam, bx, bz, {
    dropper: () => {
      S.raw(`<g class="k-dropper" style="--dx:${px(inB[0] - atC[0])};--dy:${px(inB[1] - atC[1])};--lift:${px(lift)}">`);
      dp.push(Mo.dropper(S, cam, cx - 4, restY, cz, { bulbCls: 'k-bulb' }));
      S.raw('</g>');
    },
  });
  S.close();
  const cup = O.espressoCup(S, cam, cx, 0, cz);
  const t = dp[0].tip;
  const dc = aboveClip(S, cup.ell(cup.rimY, cup.rimR));
  S.raw(`<g clip-path="url(#${dc})"><path class="k-drip" style="--dfall:${px(14 * cam.s * cam.cp)};fill:var(--acc)" d="${O.drop(t[0], t[1] + 7, 2.6)}"/></g>`);
  S.raw(`<ellipse class="k-ripple fx" cx="${f(cup.ell(cup.rimY - 4, 10).cx)}" cy="${f(cup.ell(cup.rimY - 4, 10).cy)}" rx="${f(cup.ell(0, 12).rx)}" ry="${f(cup.ell(0, 12).ry)}" fill="none" style="stroke:var(--acc)" stroke-width="1.4"/>`);
  return { extra: { top: 4 } };
};

scenes.pull = (S) => {
  const cam = MC();
  const { gx, gz } = DE;
  const cz = gz + 4, ty = DE.FY - 2;
  const pf0 = DE.pf;
  let sc, cup;
  M.de1(S, cam, {
    wand: true,
    under: () => {
      sc = scale(S, cam, gx, cz, ty);
      cup = O.espressoCup(S, cam, gx, sc.top, cz, {
        inside: (c) => {
          const lv = sc.top + 30;
          const e = c.ell(lv, 20);
          S.raw(`<g class="k-fill"><ellipse cx="${f(e.cx)}" cy="${f(e.cy)}" rx="${f(e.rx)}" ry="${f(e.ry)}" fill="url(#${S.id}coffee)"/><ellipse cx="${f(e.cx)}" cy="${f(e.cy)}" rx="${f(e.rx * 0.8)}" ry="${f(e.ry * 0.7)}" fill="url(#${S.id}crema)"/></g>`);
        },
      });
    },
    pf: () => T.portafilter(S, cam, gx, pf0, gz, { content: 'none', ang: 150, tilt: -2 }),
    water: () => {
      // streams from the bottomless basket into the cup
      const top = pf0 - 16, bot = sc.top + 36;
      const ac = aboveClip(S, cup.ell(cup.rimY, cup.rimR));
      S.raw(`<g clip-path="url(#${ac})">`);
      let d = '';
      for (const [dx, dz] of [[-9, -4], [-3, 5], [4, -3], [9, 4], [0, -9], [-6, 8]]) d += `M${pt(cam.P(gx + dx, top, gz + dz))}L${pt(cam.P(gx + dx * 0.25, bot, cz + dz * 0.25))}`;
      S.raw(`<path class="k-stream fx" d="${d}" fill="none" stroke="url(#${S.id}crema)" stroke-width="2" stroke-linecap="round" stroke-dasharray="9 5"/>`);
      S.raw('</g>');
    },
  });
  const e = cam.ell(gx, DE.gTop, gz, DE.gR);
  return { vb: frameAround([[e.cx - e.rx - 56, e.cy - e.ry - 6], [e.cx + e.rx + 56, e.cy - e.ry - 6], cam.P(gx - 60, ty - 4, gz + 90), cam.P(gx + 70, ty - 4, gz + 80), cam.P(-66, pf0 - 8, 168)], 0.03) };
};

scenes.rinse = (S) => {
  const cam = MC();
  const { gx, gz } = DE;
  const y0 = 196;
  M.de1(S, cam, {
    wand: true,
    pf: () => T.portafilter(S, cam, gx, y0, gz, { content: 'empty', ang: 150, tilt: 3, inside: (h) => { S.raw(`<path class="k-pool" d="${h.ring(y0 - 14, 27.5)}" style="fill:var(--acc)" fill-opacity=".34"/>`); } }),
    water: () => {
      let d = '';
      for (const [dx, dz] of [[-14, -6], [-6, 4], [2, -2], [10, 6], [16, -4], [-2, 12], [6, -12]]) d += `M${pt(cam.P(gx + dx, DE.pf - 1, gz + dz))}L${pt(cam.P(gx + dx * 0.9, y0 - 12, gz + dz * 0.9))}`;
      S.raw(`<path class="k-water" d="${d}" fill="none" stroke="var(--acc)" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="7 6"/>`);
    },
  });
  const e = cam.ell(gx, DE.gTop, gz, DE.gR);
  return { vb: frameAround([[e.cx - e.rx - 56, e.cy - e.ry - 6], [e.cx + e.rx + 56, e.cy - e.ry - 6], cam.P(gx - 60, 150, gz + 90), cam.P(gx + 60, 150, gz + 80), cam.P(-66, y0 + 4, 172)], 0.03) };
};

scenes.steam = (S) => {
  const cam = MC();
  const jx = 184, jz = 98, ty = DE.FY - 2, wx = 201;
  let jug;
  const jugTop = ty + 92;
  const rim = cam.ell(jx, jugTop - 0.6, jz, 38.4);
  M.de1(S, cam, {
    wand: false,
    under: () => {
      jug = Mo.milkJug(S, cam, jx, ty, jz, {
        inside: ({ body, h }) => {
          const lv = ty + h - 20;
          const e = body.ell(lv, 38);
          S.raw(`<g class="k-milk"><ellipse cx="${f(e.cx)}" cy="${f(e.cy)}" rx="${f(e.rx)}" ry="${f(e.ry)}" fill="url(#${S.id}milk)"/><ellipse cx="${f(e.cx - 4)}" cy="${f(e.cy - 1)}" rx="${f(e.rx * 0.62)}" ry="${f(e.ry * 0.58)}" fill="#fff" fill-opacity=".35"/></g>`);
          S.raw(`<path class="k-swirl fx" d="M${f(e.cx - e.rx * 0.6)} ${f(e.cy)}A${f(e.rx * 0.6)} ${f(e.ry * 0.6)} 0 0 0 ${f(e.cx + e.rx * 0.2)} ${f(e.cy + e.ry * 0.58)}" fill="none" style="stroke:var(--acc)" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="10 8"/>`);
        },
      });
    },
  });
  // the wand, dipped into the jug: only the part above the rim's centre line and
  // through the opening shows
  const ac = aboveClip(S, rim);
  M.steamWand(S, cam, wx, { tipY: ty + 92 - 56, clipId: ac });
  const tp = cam.P(wx, ty + 92 + 14, 78);
  S.raw(`<g class="k-puffs fx">`);
  for (let i = 0; i < 3; i++) S.raw(`<path class="k-puff p${i}" d="M${f(tp[0] + i * 7 - 6)} ${f(tp[1])}c-6 -10 6 -16 0 -26" fill="none" stroke="rgb(${S.PAPER} / .7)" stroke-width="2" stroke-linecap="round"/>`);
  S.raw('</g>');
  return { vb: frameAround([cam.P(40, ty + 150, 130), cam.P(jx + 90, ty + 150, jz), cam.P(jx + 60, ty - 6, jz + 50), cam.P(jx - 80, ty - 6, jz + 60), cam.P(wx, 250, 78)], 0.03) };
};

scenes.knock = (S) => {
  const cam = Cam(YAW, 26, 1.3, 210, 330);
  const { by, br, bz } = Mo.KB;
  const pz = bz + 26, hitY = by + br, restY = hitY + 30;
  const hit = (restY - hitY) * cam.s * cam.cp;
  const fall = (hitY + 8 - 14) * cam.s * cam.cp;
  Mo.knockBox(S, cam, {
    inside: () => {
      S.raw(`<g class="k-puck fx" style="--hit:${px(hit)};--fall:${px(fall)}">`);
      const py = restY + 8;
      const pk = lathe(cam, 2, pz, [[py + 11, 28.2], [py + 1.2, 28.4], [py, 27.8]]);
      S.solid(pk.sil, 'coffee', { under: false, rim: 0.6 });
      S.face(pk.ring(py + 11, 28.2), 'rgb(0 0 0 / .22)');
      S.hl(pk.streak(py + 10, py + 2, 28.3, 150), 0.25);
      S.raw(`<path d="${pk.front(py + 0.8, 28)}" stroke="#f4f5f1" stroke-width="2.4" fill="none"/>`);
      S.raw('</g>');
    },
  });
  S.open('k-knock', ` style="--hit:${px(hit)}"`);
  T.invertedPortafilter(S, cam, 2, restY, pz, 150);
  S.close();
  return { extra: { top: 20 } };
};

scenes.done = (S) => {
  const cam = Cam(YAW, 22, 1.7, 200, 300);
  const cx = 0, cz = 0;
  O.saucer(S, cam, cx, 0, cz);
  const cup = O.espressoCup(S, cam, cx, 5, cz, {
    inside: (c) => {
      const e = c.ell(5 + 46, 27);
      S.raw(`<ellipse cx="${f(e.cx)}" cy="${f(e.cy)}" rx="${f(e.rx)}" ry="${f(e.ry)}" fill="url(#${S.id}coffee)"/><ellipse cx="${f(e.cx)}" cy="${f(e.cy)}" rx="${f(e.rx * 0.86)}" ry="${f(e.ry * 0.82)}" fill="url(#${S.id}crema)"/><ellipse cx="${f(e.cx - e.rx * 0.2)}" cy="${f(e.cy - e.ry * 0.2)}" rx="${f(e.rx * 0.4)}" ry="${f(e.ry * 0.3)}" fill="#fff" fill-opacity=".22"/>`);
    },
  });
  const t = cam.P(cx, 5 + 52, cz);
  S.raw('<g class="k-steam fx">');
  [[-14, 0], [0, 1], [14, 2]].forEach(([dx, i]) => {
    S.raw(`<path class="k-curl c${i}" d="M${f(t[0] + dx)} ${f(t[1] - 8)}c-9 -12 9 -22 0 -34c-8 -10 7 -20 0 -30" fill="none" stroke="rgb(${S.PAPER} / .6)" stroke-width="2.6" stroke-linecap="round"/>`);
  });
  S.raw('</g>');
  return { extra: { top: 60 } };
};

module.exports = scenes;
