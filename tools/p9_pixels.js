'use strict';
// P9 helpers for tests (NO video, no PNG): pixel hashes of single frames drawn by a renderer (render/index.html of this
// repo, or of another checkout via --render <dir>), the art-kit info, and a determinism probe.
//   node tools/p9_pixels.js classic [--render <dir>] [--out <json>]   -> sha of 6 frames of the league week on a classic map
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const P7S = require('./p7_stills');
const SH = require('../sim/league/show');

async function openPage(browser, show, size, renderDir) {
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file:///' + path.join(renderDir || path.join(ROOT, 'render'), 'index.html').replace(/\\/g, '/'));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((j) => window.initRenderer(JSON.parse(j)), JSON.stringify(Object.assign({}, show, { outSize: size })));
  return { page, errors };
}
async function frameHashes(page, frames) {
  const data = await page.evaluate((F) => F.map((f) => { window.renderFrame(f); const c = document.getElementById('c'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h1 = 0x811c9dc5 | 0, h2 = 7; for (let i = 0; i < d.length; i += 1) { h1 = Math.imul(h1 ^ d[i], 16777619); h2 = (h2 * 31 + d[i]) | 0; } return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16); }), frames);
  return data.map((x) => crypto.createHash('sha1').update(x).digest('hex').slice(0, 12));
}
// frames of the first match with a goal: kick-off area, mid-match, a goal moment, plus intro/table screens
function probeFrames(show) {
  const m0 = show.matches.findIndex((m) => m.goals.length > 0), s = show.segments.find((x) => x.type === 'match' && x.match === m0), M = show.matches[m0];
  const ev = M.events.find((e) => e.type === 'goal'), vf = ev.vf !== undefined ? ev.vf : ev.t * 30;
  const f = [s.start + 40, s.start + 600, s.start + Math.round(vf) + 9, s.start + Math.round(vf) + 40];
  for (const ty of ['lgTable', 'fulltime']) { const g = show.segments.find((x) => x.type === ty); if (g) f.push(g.start + Math.min(g.len - 1, 75)); }
  return f;
}
async function classicHashes(renderDir) {
  const { C } = await P7S.shows();
  const show = SH.buildMatchweekShow(C, 1, { dir: path.join(ROOT, 'build', 'p7_scratch'), map: 'stadium_day' });
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const { page, errors } = await openPage(browser, show, [1280, 720], renderDir);
  const h = await frameHashes(page, probeFrames(show));
  await browser.close();
  return { hashes: h, errors };
}
module.exports = { openPage, frameHashes, probeFrames, classicHashes };
if (require.main === module) {
  const a = process.argv, ri = a.indexOf('--render'), oi = a.indexOf('--out');
  classicHashes(ri > 0 ? path.resolve(a[ri + 1]) : null).then((r) => {
    if (oi > 0) fs.writeFileSync(a[oi + 1], JSON.stringify(r.hashes) + '\n');
    console.log(JSON.stringify(r));
  }).catch((e) => { console.error(e); process.exit(1); });
}
