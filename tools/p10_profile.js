'use strict';
// P10 dev profile (NO video): mean frame time with single atmosphere flags switched off. node tools/p10_profile.js
const P7S = require('./p7_stills');
const { shows } = require('./p10_shows');
(async () => {
  const { week } = await shows({ maps: ['premier_night'] });
  const m0 = week.matches.findIndex((m) => m.goals.length > 0), seg = week.segments.find((s) => s.type === 'match' && s.match === m0);
  const F = []; for (let k = 0; k < 120; k++) F.push(seg.start + Math.floor((seg.len - 1) * k / 119));
  const { chromium } = require('playwright'); const browser = await chromium.launch();
  const variants = [['all on', {}], ['all off', { enabled: false }], ['no stand_flags', { stand_flags: false }], ['no reactions', { crowd_reactions: false }], ['no smoke', { stand_smoke: false }], ['no earth(blades)', { earth_platforms: false }], ['no wind', { wind: false }], ['no corner/insects', { corner_flags: false, insects: false }], ['no split', { split_stands: false }]];
  for (const [name, o] of variants) {
    const sh = Object.assign({}, week, { atmoCfg: Object.assign({}, week.atmoCfg, o) });
    const { page } = await P7S.openPage(browser, sh, [1920, 1080]);
    const r = await page.evaluate((F) => { const x = document.getElementById('c').getContext('2d'); for (let i = 0; i < 8; i++) window.renderFrame(F[i]); const ts = []; for (const f of F) { const t0 = performance.now(); window.renderFrame(f); x.getImageData(0, 0, 1, 1); ts.push(performance.now() - t0); } return ts.reduce((a, b) => a + b, 0) / ts.length; }, F);
    console.log(name.padEnd(20), r.toFixed(1)); await page.close();
  }
  await browser.close();
})();
