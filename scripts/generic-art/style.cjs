// Drawing context for one scene: collects the markup and offers the shared
// "frosted glass" materials. Gradient ids are prefixed `gn` (the personal set
// uses `gg`), shared by every scene through COMMON_DEFS; per-scene paths and
// clips get ids prefixed with the scene.
const PAPER = '238 243 239';

function Style(sid, H) {
  const id = 'gn';
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
  lg('brushed', [[0, 'rgb(120 134 136 / .9)'], [0.12, 'rgb(214 222 220 / .88)'], [0.26, 'rgb(150 162 162 / .86)'], [0.42, 'rgb(84 98 100 / .88)'], [0.6, 'rgb(196 206 204 / .86)'], [0.74, 'rgb(118 132 134 / .88)'], [0.88, 'rgb(66 80 82 / .9)'], [1, 'rgb(104 118 120 / .9)']], 1, 0);
  lg('smoke', [[0, 'rgb(70 92 96 / .55)'], [0.5, 'rgb(14 26 29 / .72)'], [1, 'rgb(4 10 12 / .8)']]);
  lg('metal', [[0, `rgb(${PAPER} / .40)`], [0.35, `rgb(${PAPER} / .12)`], [0.62, `rgb(${PAPER} / .30)`], [1, `rgb(${PAPER} / .08)`]], 1, 0);
  lg('glass', [[0, `rgb(${PAPER} / .18)`], [0.3, `rgb(${PAPER} / .04)`], [0.8, `rgb(${PAPER} / .06)`], [1, `rgb(${PAPER} / .14)`]], 1, 0);
  lg('white', [[0, 'rgb(250 252 250 / .95)'], [0.35, 'rgb(232 238 236 / .9)'], [0.75, 'rgb(196 208 206 / .85)'], [1, 'rgb(160 176 174 / .85)']], 1, 0.3);
  lg('coffee', [[0, '#8a5a36'], [1, '#4a2c18']], 0.4, 1);
  lg('crema', [[0, '#c78a52'], [1, '#8a5430']], 0.3, 1);
  lg('milk', [[0, '#f4ece0'], [1, '#d9c8ae']], 0, 1);
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
    id, out, defs, common, PAPER,
    uid: (k = 'u') => `${sid}${k}${n++}`,
    shadow(d, o = 1) { P(`<path d="${d}" fill="url(#${id}sh)"${o !== 1 ? ` opacity="${o}"` : ''}/>`); },
    // a frosted object: backing, tone, darker underside, light rim
    solid(d, tone = 'cream', o = {}) {
      const k = S.uid('s');
      defs.push(`<path id="${k}" d="${d}"/>`);
      const back = o.back ?? ({ glass: 0, white: 0.92, ceramic: 1, metal: 0.95, brushed: 0.6, coffee: 0, smoke: 0.75, black: 1, steel: 1 }[tone] ?? 0.8);
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
    glow(cx, cy, rx, ry, cls = '') { P(`<ellipse${cls ? ` class="${cls}"` : ''} cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="url(#${id}glow)"/>`); },
    open(cls, extra = '') { P(`<g${cls ? ` class="${cls}"` : ''}${extra}>`); },
    close() { P('</g>'); },
    raw(s) { P(s); },
    slot() { P('<!--@-->'); },
  };
  return S;
}
module.exports = { Style, PAPER };
