// Builds the Guide me scenes ("frosted glass objects") into
// src/features/guide/guideScenes.ts. Everything is modelled in millimetres
// and projected orthographically (geo.cjs), so shared objects keep their real
// proportions in every scene. Static SVG only: animation lives in CSS in
// GuideArt.svelte, keyed on the class names emitted here (k-*).
//   node scripts/guide-art/build.cjs
const fs = require('fs');
const path = require('path');
const G = require('./geo.cjs');
const { Cam, ellD, frontArcD, backArcD, rbox, rrectTop, lathe, f, pt, crD, polyD, smoothClosedD, hull, revolve, tube, circ3, add3, norm3 } = G;

const W = 420, H = 390;
const PAPER = '238 243 239';
const YAW = -32;

// ------------------------------------------------------------------ style
// Gradients are shared by every scene (ids 'gg*', in COMMON_DEFS); each
// scene's own paths and clips get ids prefixed with the scene.
function Style(sid) {
  const id = 'gg';
  const common = [], defs = [], out = [];
  let n = 0;
  const P = (s) => out.push(s);
  const lg = (name, stops, x2 = 1, y2 = 1, x1 = 0, y1 = 0) => common.push(`<linearGradient id="${id}${name}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" ${c.startsWith('var') ? `style="stop-color:${c.split('|')[0]};stop-opacity:${c.split('|')[1] ?? 1}"` : `stop-color="${c}"`}/>`).join('')}</linearGradient>`);
  common.push(`<linearGradient id="${id}bg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${H}"><stop offset="0" stop-color="#1a3a41"/><stop offset="1" stop-color="#0d2125"/></linearGradient>`);
  lg('cream', [[0, `rgb(${PAPER} / .26)`], [0.55, `rgb(${PAPER} / .10)`], [1, `rgb(${PAPER} / .06)`]]);
  lg('ceramic', [[0, `rgb(${PAPER} / .30)`], [0.55, `rgb(${PAPER} / .13)`], [1, `rgb(${PAPER} / .08)`]]);
  lg('dark', [[0, 'rgb(48 68 72 / .8)'], [0.5, 'rgb(8 18 21 / .88)'], [1, 'rgb(2 8 10 / .92)']]);
  lg('black', [[0, 'rgb(58 66 68)'], [0.18, 'rgb(24 29 31)'], [0.6, 'rgb(10 13 14)'], [1, 'rgb(3 5 6)']], 1, 0.15);
  lg('steel', [[0, 'rgb(150 162 162)'], [0.22, 'rgb(70 82 84)'], [0.45, 'rgb(190 200 198)'], [0.7, 'rgb(52 62 64)'], [1, 'rgb(110 122 122)']], 1, 0);
  lg('smoke', [[0, 'rgb(70 92 96 / .55)'], [0.5, 'rgb(14 26 29 / .72)'], [1, 'rgb(4 10 12 / .8)']]);
  lg('metal', [[0, `rgb(${PAPER} / .40)`], [0.35, `rgb(${PAPER} / .12)`], [0.62, `rgb(${PAPER} / .30)`], [1, `rgb(${PAPER} / .08)`]], 1, 0);
  lg('glass', [[0, `rgb(${PAPER} / .18)`], [0.3, `rgb(${PAPER} / .04)`], [0.8, `rgb(${PAPER} / .06)`], [1, `rgb(${PAPER} / .14)`]], 1, 0);
  lg('white', [[0, 'rgb(250 252 250 / .95)'], [0.35, 'rgb(232 238 236 / .9)'], [0.75, 'rgb(196 208 206 / .85)'], [1, 'rgb(160 176 174 / .85)']], 1, 0.3);
  lg('amber', [[0, 'rgb(214 128 40 / .75)'], [0.45, 'rgb(150 76 18 / .72)'], [1, 'rgb(84 38 8 / .82)']], 1, 0.2);
  lg('resin', [[0, '#3c2552'], [0.45, '#1a0f26'], [1, '#09060d']], 0.3, 1);
  lg('coffee', [[0, '#8a5a36'], [1, '#4a2c18']], 0.4, 1);
  lg('latte', [[0, '#d8b48c'], [1, '#a77a52']], 0, 1);
  lg('accent', [[0, 'var(--acc)|.75'], [1, 'var(--acc)|.35']]);
  lg('rim', [[0, 'rgb(255 255 255 / .85)'], [0.35, 'rgb(255 255 255 / .28)'], [0.7, 'rgb(255 255 255 / .06)'], [1, 'rgb(255 255 255 / .14)']]);
  lg('under', [[0.45, 'rgb(0 0 0 / 0)'], [1, 'rgb(0 0 0 / .32)']], 0, 1);
  lg('top', [[0, `rgb(${PAPER} / .22)`], [1, `rgb(${PAPER} / .07)`]], 1, 0.6);
  lg('side', [[0, 'rgb(0 0 0 / .05)'], [1, 'rgb(0 0 0 / .3)']], 1, 0);
  common.push(`<radialGradient id="${id}sh"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".6" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`);
  common.push(`<radialGradient id="${id}glow"><stop offset="0" style="stop-color:var(--acc);stop-opacity:.95"/><stop offset=".35" style="stop-color:var(--acc);stop-opacity:.45"/><stop offset="1" style="stop-color:var(--acc);stop-opacity:0"/></radialGradient>`);
  common.push(`<radialGradient id="${id}hole" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#000" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>`);
  common.push(`<radialGradient id="${id}mist"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`);
  const S = {
    id, out, defs, common,
    uid: (k = 'u') => `${sid}${k}${n++}`,
    shadow(d, o = 1) { P(`<path d="${d}" fill="url(#${id}sh)"${o !== 1 ? ` opacity="${o}"` : ''}/>`); },
    // a frosted object: opaque-ish backing, tone, darker underside, light rim
    solid(d, tone = 'cream', o = {}) {
      const k = S.uid('s');
      defs.push(`<path id="${k}" d="${d}"/>`);
      const back = o.back ?? ({ glass: 0, amber: 0.45, white: 0.92, ceramic: 1, metal: 0.95, resin: 0, coffee: 0, latte: 0, smoke: 0.75, black: 1, steel: 1 }[tone] ?? 0.8);
      if (back) P(`<use href="#${k}" fill="url(#${id}bg)" fill-opacity="${back}"/>`);
      P(`<use href="#${k}" fill="url(#${id}${tone})"/>`);
      if (o.under !== false) P(`<use href="#${k}" fill="url(#${id}under)"/>`);
      P(`<use href="#${k}" fill="none" stroke="url(#${id}rim)" stroke-width="${o.rim ?? 1.1}" stroke-linejoin="round"/>`);
      return k;
    },
    fill(d, fill, extra = '') { P(`<path d="${d}" fill="${fill}"${extra}/>`); },
    face(d, kind) {
      const fill = { hole: `url(#${id}hole)`, top: `url(#${id}top)`, side: `url(#${id}side)`, front: `rgb(${PAPER} / .03)`, deep: 'rgb(0 0 0 / .42)', light: `rgb(${PAPER} / .1)`, dim: 'rgb(0 0 0 / .2)' }[kind] || kind;
      P(`<path d="${d}" fill="${fill}"/>`);
    },
    line(d, w = 'p') { P(`<path d="${d}" class="${w === 'p' ? 'bp' : w === 's' ? 'bs' : w}"/>`); },
    hl(d, o) { P(`<path d="${d}" class="bh"${o ? ` stroke-opacity="${o}"` : ''}/>`); },
    aline(d, cls = '') { P(`<path d="${d}" class="as${cls ? ' ' + cls : ''}"/>`); },
    afill(d, a = 0.6, extra = '') { P(`<path d="${d}" class="af" fill-opacity="${a}"${extra}/>`); },
    glow(cx, cy, rx, ry, tr = '', cls = '') {
      P(`<ellipse${tr ? ` transform="${tr}"` : ''}${cls ? ` class="${cls}"` : ''} cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="url(#${id}glow)"/>`);
    },
    open(cls, extra = '') { P(`<g${cls ? ` class="${cls}"` : ''}${extra}>`); },
    close() { P('</g>'); },
    raw(s) { P(s); },
    slot() { P('<!--@-->'); },
  };
  return S;
}

const scenes = require('./scenes.cjs');
const { minifySvg } = require('./minify.cjs');

// ------------------------------------------------------------------ output
// Framing: frames.json holds each scene's measured bounding box (static
// state, from the browser); the viewBox is that box padded to the panel's
// aspect. Re-measure after changing a scene: node build.cjs, then the
// measure script, then node build.cjs again.
const ORDER = ['weigh', 'spray', 'dial', 'grind', 'basket', 'funnel', 'tamp', 'paper', 'minerals', 'start', 'knock', 'rinse', 'done'];
let frames = {};
try { frames = JSON.parse(fs.readFileSync(path.join(__dirname, 'frames.json'), 'utf8')); } catch { /* first run */ }
function fit(box, pad = 0.07, extra = {}) {
  if (!box) return `0 0 ${W} ${H}`;
  let [x, y, w, h] = box;
  const t = extra.top ?? 0, b = extra.bottom ?? 0;
  y -= t; h += t + b;
  const p = Math.max(w, h) * pad;
  x -= p; y -= p; w += 2 * p; h += 2 * p;
  const asp = W / H;
  if (w / h > asp) { const nh = w / asp; y -= (nh - h) / 2; h = nh; } else { const nw = h * asp; x -= (nw - w) / 2; w = nw; }
  return [x, y, w, h].map((v) => +v.toFixed(1)).join(' ');
}
const res = {};
let COMMON = '';
for (const k of ORDER) {
  if (!scenes[k]) continue;
  const S = Style(`g${k.slice(0, 3)}`);
  const meta = scenes[k](S) || {};
  const svg = minifySvg(`<defs>${S.defs.join('')}</defs>${S.out.join('')}`);
  COMMON = minifySvg(S.common.join(''));
  const { pad, extra, vb, ...rest } = meta;
  res[k] = { vb: vb || fit(frames[k], pad, extra), svg, ...rest };
}
const ts = `// Generated by scripts/guide-art/build.cjs. Do not edit by hand.
import type { GuideStepId } from '../../lib/guide';

export interface GuideScene {
  vb: string;
  /** Static SVG markup; '<!--@-->' marks where the live parts go. */
  svg: string;
  /** Plane transform + position of the scale's left display (live weight). */
  lcd?: string;
  lcdAt?: [number, number];
  /** Where the grind setting readout sits. */
  num?: [number, number];
}

/** Gradients shared by every scene (render once per svg, in <defs>). */
export const COMMON_DEFS = \`${COMMON}\`;

export const SCENES: Partial<Record<GuideStepId, GuideScene>> = {
${Object.entries(res).map(([k, v]) => `  ${k}: { ${Object.entries(v).map(([n, x]) => `${n}: ${n === 'svg' ? '\`' + x + '\`' : JSON.stringify(x)}`).join(', ')} },`).join('\n')}
};
`;
fs.writeFileSync(path.join(__dirname, '../../src/features/guide/guideScenes.ts'), ts);
console.log(Object.entries(res).map(([k, v]) => `${k} ${(v.svg.length / 1024).toFixed(1)}k`).join('  '), ' total', (ts.length / 1024).toFixed(1) + 'k');
