'use strict';
// P9 still-frame benchmark (NO video, no PNG written): draws match frames into the canvas and measures the time per
// frame inside Chromium. node tools/p9_bench.js <label> [map]  -> build/p9/bench_<label>.json
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P7S = require('./p7_stills');
const SH = require('../sim/league/show');
async function bench(label, mapId) {
  const { C, week: w0 } = await P7S.shows();
  const week = mapId ? SH.buildMatchweekShow(C, 1, { dir: path.join(ROOT, 'build', 'p7_scratch'), map: mapId }) : w0;
  const m0 = week.matches.findIndex((m) => m.goals.length > 0);
  const seg = week.segments.find((s) => s.type === 'match' && s.match === m0);
  const frames = []; for (let k = 0; k < 150; k++) frames.push(seg.start + Math.floor((seg.len - 1) * k / 149));
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const { page, errors } = await P7S.openPage(browser, week, [1920, 1080]);
  const r = await page.evaluate((F) => {
    const c = document.getElementById('c'), x = c.getContext('2d');
    for (let i = 0; i < 10; i++) window.renderFrame(F[i]); // warm-up (caches, JIT)
    const ts = [];
    for (const f of F) { const t0 = performance.now(); window.renderFrame(f); x.getImageData(0, 0, 1, 1); ts.push(performance.now() - t0); }
    ts.sort((a, b) => a - b);
    return { n: ts.length, mean: ts.reduce((a, b) => a + b, 0) / ts.length, p50: ts[ts.length >> 1], p95: ts[Math.floor(ts.length * 0.95)], max: ts[ts.length - 1] };
  }, frames);
  await browser.close();
  const out = Object.assign({ label, map: week.map.id, size: [1920, 1080], errors: errors.slice(0, 3) }, r);
  fs.mkdirSync(path.join(ROOT, 'build', 'p9'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'build', 'p9', `bench_${label}.json`), JSON.stringify(out, null, 1));
  return out;
}
module.exports = { bench };
if (require.main === module) bench(process.argv[2] || 'now', process.argv[3]).then((o) => console.log(JSON.stringify(o))).catch((e) => { console.error(e); process.exit(1); });
