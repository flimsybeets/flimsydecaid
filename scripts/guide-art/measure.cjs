// Measures each scene's static bounding box in a real browser and writes
// frames.json, which build.cjs uses to frame every scene (viewBox). Run after
// changing a scene: node build.cjs && node measure.cjs && node build.cjs
// Needs Playwright (require('playwright')) with Chromium installed.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const src = fs.readFileSync(path.join(__dirname, '../../src/features/guide/guideScenes.ts'), 'utf8');
const common = src.match(/COMMON_DEFS = `([^`]*)`/)[1];
const scenes = [...src.matchAll(/^ {2}(\w+): \{ vb: "[^"]*", svg: `([^`]*)`/gm)].map((m) => [m[1], m[2].replace(/<!--@-->/g, '')]);
const html = `<!doctype html><style>.fx{display:none}</style>${scenes.map(([k, svg]) => `<svg data-k="${k}" width="420" height="390" viewBox="0 0 420 390"><defs>${common}</defs>${svg}</svg>`).join('')}`;
const file = path.join(os.tmpdir(), 'guide-art-measure.html');
fs.writeFileSync(file, html);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + file);
  const r = await p.evaluate(() => {
    const o = {};
    document.querySelectorAll('svg[data-k]').forEach((s) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const el of s.children) {
        if (el.tagName === 'defs' || el.tagName === 'clipPath' || el.tagName === 'linearGradient' || getComputedStyle(el).display === 'none') continue;
        try {
          const bb = el.getBBox();
          if (!bb.width && !bb.height) continue;
          const m = s.getScreenCTM().inverse().multiply(el.getScreenCTM());
          for (const [x, y] of [[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]]) {
            const q = new DOMPoint(x, y).matrixTransform(m);
            x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y);
          }
        } catch { /* not rendered */ }
      }
      o[s.dataset.k] = [x0, y0, x1 - x0, y1 - y0].map((v) => +v.toFixed(1));
    });
    return o;
  });
  fs.writeFileSync(path.join(__dirname, 'frames.json'), JSON.stringify(r, null, 1) + '\n');
  console.log(r);
  await b.close();
})();
