// Captures the README screenshots and the walkthrough video from the mock
// machine (?mock=1), so they show the skin with simulated data only.
//
// Usage, from the repo root, with the dev server running:
//   npx vite --port 5231 &
//   node scripts/capture-docs.cjs [shots|video|all] [baseUrl]
//
// Needs Playwright (`npm i -D playwright` or NODE_PATH pointing at one) and
// ffmpeg on the PATH. Output goes to docs/: PNG/JPG screenshots, walkthrough.mp4
// and walkthrough.gif. Screenshots are 960x600 at device scale 2; the video is
// 960x600. Everything is in memory in the mock, so each run starts clean.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright')); }

const mode = process.argv[2] || 'all';
const BASE = process.argv[3] || 'http://localhost:5231';
const URL = `${BASE}/?mock=1`;
const DOCS = path.resolve(__dirname, '..', 'docs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'flimsy-docs-'));
fs.mkdirSync(DOCS, { recursive: true });

const wait = (p, ms) => p.waitForTimeout(ms);

// ---- generated pictures (no real photos in the repo) ------------------------
async function makePictures(browser) {
  const page = await browser.newPage();
  const out = await page.evaluate(() => {
    const mk = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c.toDataURL('image/jpeg', 0.9); };
    const bag = (bg, label, ink, n) => mk(600, 600, (g, w, h) => {
      const bgr = g.createLinearGradient(0, 0, w, h); bgr.addColorStop(0, bg[0]); bgr.addColorStop(1, bg[1]); g.fillStyle = bgr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 0, 40, h);
      // the bag
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.roundRect(150, 90, 330, 450, 24); g.fill();
      g.fillStyle = label[0]; g.beginPath(); g.roundRect(135, 70, 330, 450, 24); g.fill();
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(135, 70, 330, 54);
      g.fillStyle = label[1]; g.beginPath(); g.roundRect(175, 190, 250, 210, 14); g.fill();
      g.fillStyle = ink; g.font = '700 38px sans-serif'; g.textAlign = 'center'; g.fillText(n[0], 300, 262);
      g.font = '500 26px sans-serif'; g.fillText(n[1], 300, 310);
      g.fillRect(230, 336, 140, 4);
      g.beginPath(); g.arc(300, 440, 26, 0, 7); g.fill();
    });
    const scene = () => mk(1600, 1000, (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#1b3a4b'); sky.addColorStop(0.55, '#b5654b'); sky.addColorStop(1, '#f1b36a'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f7d9a0'; g.beginPath(); g.arc(1150, 560, 120, 0, 7); g.fill();
      [['#33586a', 640, 0.9], ['#264658', 720, 0.8], ['#1a3140', 820, 0.7]].forEach(([c, y, s], i) => {
        g.fillStyle = c; g.beginPath(); g.moveTo(0, h);
        for (let x = 0; x <= w; x += 40) g.lineTo(x, y + Math.sin(x / (180 + i * 60) + i * 2) * 70 * s + Math.sin(x / 70 + i) * 14);
        g.lineTo(w, h); g.fill();
      });
    });
    const saver = () => scene();
    return {
      b1: bag(['#cdb58f', '#b79f78'], ['#f3ead7', '#e0482f'], '#2a1d16', ['HAMBELA', 'Ethiopia · washed']),
      b2: bag(['#9fb7b0', '#86a199'], ['#27445a', '#f0c24b'], '#1d2a33', ['SEASONAL', 'Espresso blend']),
      b3: bag(['#d7a9a0', '#c28f86'], ['#3b2a2f', '#e9d6c4'], '#2b1c20', ['KILLBEAN', 'Decaf · sugarcane']),
      scene: scene(),
    };
  });
  await page.close();
  const files = {};
  for (const [k, v] of Object.entries(out)) { const f = path.join(TMP, `${k}.jpg`); fs.writeFileSync(f, Buffer.from(v.split(',')[1], 'base64')); files[k] = f; }
  return files;
}

// ---- helpers -----------------------------------------------------------------
const tab = (p, name) => p.locator('nav button.tab, .tab').filter({ hasText: new RegExp(`^${name}$`) }).first().click();
async function setPhotos(p, pics) {
  await tab(p, 'Beans'); await wait(p, 800);
  const names = [['Ethiopia Hambela', pics.b1], ['Seasonal Espresso', pics.b2], ['Killbean Decaf', pics.b3]];
  for (const [name, file] of names) {
    const card = p.locator('article, li, section, div').filter({ hasText: name }).filter({ has: p.getByRole('button', { name: 'Edit', exact: true }) }).last();
    await card.getByRole('button', { name: 'Edit', exact: true }).first().click(); await wait(p, 500);
    await p.locator('input[type=file]:not([capture])').first().setInputFiles(file); await wait(p, 900);
    await p.getByRole('button', { name: 'Use photo' }).click(); await wait(p, 900);
    await p.getByRole('button', { name: 'Save', exact: true }).click(); await wait(p, 1200);
  }
}
async function setBackground(p, pic) {
  await tab(p, 'Settings'); await wait(p, 800);
  await p.locator('nav.rail button', { hasText: 'Look' }).click(); await wait(p, 600);
  await p.locator('input[type=file]').first().setInputFiles(pic); await wait(p, 2000);
}
async function home(p) { await tab(p, 'Home'); await wait(p, 300); await tab(p, 'Home'); await wait(p, 600); }
async function openProfile(p, cat, profile) {
  await home(p);
  await p.getByRole('button', { name: new RegExp(cat) }).first().click(); await wait(p, 900);
  await p.locator('.profile', { hasText: profile }).first().click(); await wait(p, 900);
}
async function startShot(p) { await p.getByRole('button', { name: 'Start shot' }).click(); }
async function drag(p, sel, from, to, steps = 18, step = 25) {
  const box = await p.locator(sel).first().boundingBox();
  const x0 = box.x + box.width * from, x1 = box.x + box.width * to, y = box.y + box.height * 0.45;
  await p.mouse.move(x0, y); await p.mouse.down();
  for (let i = 1; i <= steps; i++) { await p.mouse.move(x0 + ((x1 - x0) * i) / steps, y); await wait(p, step); }
}

async function newPage(browser, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 600 }, deviceScaleFactor: extra.recordVideo ? 1 : 2, hasTouch: false, ...extra });
  const p = await ctx.newPage();
  await p.goto(URL); await wait(p, 2500);
  return { ctx, p };
}

// ---- screenshots ---------------------------------------------------------------
async function setupGuide(p, profile, coffee) {
  await home(p);
  await p.locator('.tile.guide').click(); await wait(p, 900);
  await p.getByRole('radio', { name: new RegExp(profile) }).first().click(); await wait(p, 200);
  await p.getByRole('radio', { name: new RegExp(coffee) }).first().click(); await wait(p, 200);
  await p.getByRole('button', { name: 'Save', exact: true }).click(); await wait(p, 1500);
}
async function closeGuide(p) { await p.getByRole('button', { name: 'Close the guide' }).click(); await wait(p, 800); }

async function shots(browser, pics) {
  const { ctx, p } = await newPage(browser);
  const shot = async (name, opts = {}) => { await wait(p, opts.pause ?? 700); await p.screenshot({ path: path.join(TMP, `${name}.png`) }); console.log('shot', name); };

  await setPhotos(p, pics);
  await setBackground(p, pics.scene);
  await p.evaluate(() => document.querySelectorAll('main, .col, section').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }));
  await shot('10-settings', { pause: 1000 });

  // Guide me needs a profile and a coffee before it opens; set it up, then close it again.
  await setupGuide(p, 'Classic Italian', 'Ethiopia Hambela');
  if (await p.getByRole('button', { name: 'Close the guide' }).count()) {
    await p.evaluate(() => window.__flimsyMock.setWeight(0));
    await wait(p, 800);
    for (let i = 0; i < 7; i++) {
      if (i === 0) await p.evaluate(() => window.__flimsyMock.setWeight(17.4));
      await shot(`07-guide-${i}`, { pause: 1200 });
      const next = p.getByRole('button', { name: /^(Next|Skip)$/ });
      if (!(await next.count()) || i === 5) break;
      await next.first().click();
    }
    await closeGuide(p);
  }

  await p.evaluate(() => window.__flimsyMock.setWeight(0));
  await home(p); await shot('01-home');

  await p.getByRole('button', { name: /Everyday/ }).first().click(); await wait(p, 1200);
  await shot('02-profiles', { pause: 1200 });

  await openProfile(p, 'Everyday', 'Classic Italian');
  await p.evaluate(() => window.__flimsyMock.setWeight(0));
  await p.getByRole('radio', { name: /Seasonal Espresso/ }).first().click().catch(() => {});
  await p.mouse.move(480, 580);
  await shot('03-brew', { pause: 2500 });

  // live shot (mid pull)
  await p.evaluate(() => window.__flimsyMock.setWeight(18));
  await startShot(p); await wait(p, 14000);
  await shot('04-shot', { pause: 200 });
  await p.getByRole('button', { name: 'Done' }).click({ timeout: 30000 }); await wait(p, 1500);

  // history
  await tab(p, 'History'); await wait(p, 1500);
  await drag(p, '.detail svg, .detail canvas', 0.15, 0.55);
  await shot('05-history', { pause: 500 });
  await p.mouse.up();

  await tab(p, 'Beans'); await shot('06-beans', { pause: 1000 });

  // guide steps editor
  await home(p);
  await p.getByRole('button', { name: 'Change' }).click(); await wait(p, 900);
  await p.getByRole('button', { name: 'Edit steps' }).click(); await wait(p, 1200);
  await p.locator('.list .pick').nth(3).click(); await wait(p, 600);
  await shot('08-steps-editor', { pause: 800 });
  await p.getByRole('button', { name: 'Add a step' }).click(); await wait(p, 1500);
  await shot('08b-add-step', { pause: 1000 });

  // profile editor (fresh page: nothing else open)
  await ctx.close();
  const b = await newPage(browser);
  const q = b.p;
  await tab(q, 'Profiles'); await wait(q, 1000);
  await q.getByRole('button', { name: 'Edit Blooming Espresso' }).click(); await wait(q, 1800);
  await q.screenshot({ path: path.join(TMP, '09-profile-editor.png') });
  await b.ctx.close();

  // convert to WebP into docs/
  const names = {
    '01-home': 'home', '02-profiles': 'category-profiles', '03-brew': 'brew-panel', '04-shot': 'shot-view',
    '05-history': 'history', '06-beans': 'beans', '07-guide-0': 'guide-weigh', '07-guide-2': 'guide-grind',
    '08-steps-editor': 'guide-steps-editor', '08b-add-step': 'guide-add-step', '09-profile-editor': 'profile-editor', '10-settings': 'settings',
  };
  for (const [from, to] of Object.entries(names)) {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(TMP, `${from}.png`), '-c:v', 'libwebp', '-quality', '92', path.join(DOCS, `${to}.webp`)]);
  }
}

// ---- video ----------------------------------------------------------------------
// A finger-like dot that follows the pointer and pulses on press, since recordings have no cursor.
const POINTER = `(() => {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:rgba(255,255,255,.28);border:2px solid rgba(255,255,255,.85);left:-60px;top:-60px;transition:transform .12s,background .12s';
  addEventListener('DOMContentLoaded', () => document.body.appendChild(d));
  addEventListener('mousemove', (e) => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => { d.style.transform = 'scale(.7)'; d.style.background = 'rgba(255,255,255,.6)'; }, true);
  addEventListener('mouseup', () => { d.style.transform = 'scale(1)'; d.style.background = 'rgba(255,255,255,.28)'; }, true);
})();`;

async function video(browser, pics) {
  const vdir = path.join(TMP, 'video');
  const ctx = await browser.newContext({ viewport: { width: 960, height: 600 }, recordVideo: { dir: vdir, size: { width: 960, height: 600 } } });
  await ctx.addInitScript(POINTER);
  const t0 = Date.now();
  const p = await ctx.newPage();
  await p.goto(URL); await wait(p, 2500);
  const mark = {};
  const at = (k) => { mark[k] = (Date.now() - t0) / 1000; };

  // Set the scene off camera: coffee photos, a background, Guide me chosen. It is trimmed off below.
  await setPhotos(p, pics);
  await setBackground(p, pics.scene);
  await setupGuide(p, 'Classic Italian', 'Ethiopia Hambela');
  if (await p.getByRole('button', { name: 'Close the guide' }).count()) await closeGuide(p);
  await home(p);
  await p.mouse.move(480, 300);
  await wait(p, 600);
  at('start');

  // glide to an element and tap it
  const tap = async (loc, pause = 1200) => {
    const box = await loc.first().boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
    await wait(p, 250); await p.mouse.down(); await wait(p, 90); await p.mouse.up();
    await wait(p, pause);
  };

  await wait(p, 1500);                                              // Home
  at('category');
  await tap(p.getByRole('button', { name: /Everyday/ }), 1800);       // category, tile graphs
  await tap(p.locator('.profile', { hasText: 'Classic Italian' }), 1500);
  await tap(p.getByRole('radio', { name: /Seasonal Espresso/ }), 1200);
  const plus = (label) => p.getByRole('button', { name: `Increase ${label}` });
  await tap(plus('Grind'), 600); await tap(plus('Grind'), 600);
  await tap(plus('Yield'), 500); await tap(plus('Yield'), 900);
  await tap(p.getByRole('button', { name: 'Start shot' }), 500);
  at('shot');
  await wait(p, 13000);                                             // live shot view
  await tap(p.getByRole('button', { name: 'Stop' }), 1800);         // stop early to keep the tour short
  const done = p.getByRole('button', { name: 'Done' });
  await done.waitFor({ timeout: 40000 }); await wait(p, 800);
  await tap(done, 1200);
  at('history');
  await tap(p.locator('.tab', { hasText: /^History$/ }), 1800);
  const box = await p.locator('.detail svg, .detail canvas').first().boundingBox();
  const y = box.y + box.height * 0.45;
  await p.mouse.move(box.x + box.width * 0.1, y, { steps: 10 }); await p.mouse.down();
  await p.mouse.move(box.x + box.width * 0.8, y, { steps: 70 }); await wait(p, 400);
  await p.mouse.move(box.x + box.width * 0.35, y, { steps: 40 }); await wait(p, 1500);
  await p.mouse.up(); await wait(p, 800);
  at('guide');
  await tap(p.locator('.tab', { hasText: /^Home$/ }), 1000);
  await tap(p.locator('.tile.guide'), 1500);
  for (const g of [3, 8, 12, 15, 17.4, 18]) { await p.evaluate((w) => window.__flimsyMock.setWeight(w), g); await wait(p, 450); }
  await wait(p, 1500);
  await tap(p.getByRole('button', { name: 'Next' }), 1800);          // grinder
  await tap(p.getByRole('button', { name: 'Next' }), 1800);          // grind
  await tap(p.getByRole('button', { name: 'Next' }), 1800);          // tamp
  await tap(p.getByRole('button', { name: 'Close the guide' }), 1000);
  at('editor');
  await tap(p.getByRole('button', { name: 'Change' }), 1500);
  await tap(p.getByRole('button', { name: 'Edit steps' }), 1800);
  await tap(p.locator('.list .pick').nth(3), 1800);
  await tap(p.getByRole('button', { name: 'Add a step' }), 3000);
  at('end');
  await wait(p, 600);
  await ctx.close();

  const webm = fs.readdirSync(vdir).find((f) => f.endsWith('.webm'));
  const src = path.join(vdir, webm);
  const trim = mark.start - 0.2;
  const len = mark.end - mark.start + 1.2;
  const mp4 = path.join(DOCS, 'walkthrough.mp4');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(trim), '-i', src, '-t', String(len), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', '-preset', 'slow', '-r', '30', '-movflags', '+faststart', '-an', mp4]);
  // GIF teaser: category -> brew -> start of the shot, shown at 2x speed.
  const gs = mark.category - 0.5 - trim, gl = 22;
  const pal = path.join(TMP, 'pal.png');
  const vf = `setpts=PTS/2,fps=12,scale=720:-1:flags=lanczos`;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(gs), '-t', String(gl), '-i', mp4, '-vf', `${vf},palettegen=max_colors=128:stats_mode=diff`, pal]);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(gs), '-t', String(gl), '-i', mp4, '-i', pal, '-lavfi', `${vf}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, path.join(DOCS, 'walkthrough.gif')]);
  console.log('marks', mark);
}

(async () => {
  const browser = await chromium.launch();
  const pics = await makePictures(browser);
  if (mode === 'shots' || mode === 'all') await shots(browser, pics);
  if (mode === 'video' || mode === 'all') await video(browser, pics);
  await browser.close();
  console.log('tmp', TMP);
})();
