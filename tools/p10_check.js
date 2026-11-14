'use strict';
// P10 dev check (NO video, no PNG): draws frames of every segment type of the week + finale shows headless and prints
// page errors, atmosphere summary and the time of a stands rebuild. node tools/p10_check.js
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P7S = require('./p7_stills');
const { shows } = require('./p10_shows');
(async () => {
  const t0 = Date.now();
  const { week, finale, maps } = await shows({ maps: ['premier_night'] });
  console.log('shows', ((Date.now() - t0) / 1000).toFixed(1), 's', week.map.id, 'segments', week.segments.length, 'total min', (week.totalFrames / 30 / 60).toFixed(2));
  const at = week.atmo; console.log('atmo kind', at.kind, 'rain', at.rain, 'm0', JSON.stringify({ react: at.matches[0].react, chances: at.matches[0].chances.length, smoke: at.matches[0].smoke.length, drums: at.matches[0].drums.length, thumps: at.matches[0].thumps.length, wind: at.matches[0].wind }));
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  for (const sh of [week, finale, maps.premier_night]) {
    const { page, errors } = await P7S.openPage(browser, sh, [960, 540]);
    const types = [...new Set(sh.segments.map((s) => s.type))];
    for (const ty of types) for (const s of sh.segments.filter((x) => x.type === ty).slice(0, 2)) for (const u of [0.05, 0.5, 0.95]) await page.evaluate((g) => window.renderFrame(g), s.start + Math.floor(s.len * u));
    const ms = sh.segments.filter((s) => s.type === 'match');
    const tr = await page.evaluate(([a, b]) => { const t1 = performance.now(); window.renderFrame(a); const t2 = performance.now(); window.renderFrame(b); const t3 = performance.now(); return { first: t2 - t1, second: t3 - t2, info: window.atmoInfo() }; }, [ms[3].start + 10, ms[4].start + 10]);
    console.log(sh.map.id, 'types', types.join(','), 'errors', JSON.stringify(errors.slice(0, 4)), 'rebuild ms', tr.first.toFixed(0), tr.second.toFixed(0), JSON.stringify(tr.info).slice(0, 300));
    await page.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
