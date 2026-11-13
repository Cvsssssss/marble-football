'use strict';
// P7 §1 check (one still PNG, no video): fallback decals of clubs without a crest file.
//   node tools/p7_decal_still.js [out.png]  -> default build/p7_stills/fallback_decals.png
// Builds a throwaway 4-club show (headless simulation) and draws one play frame zoomed on the balls.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const L = require('../sim/config_loader');
const T = require('../sim/tournament');

async function decalShow(teams) {
  const dir = path.join(ROOT, 'build', 'p7_stills'); fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'decal_competition.json');
  fs.writeFileSync(f, JSON.stringify({ id: 'p7_decals', name: 'DECAL CHECK', format: 'semis_two_legs_final', teams, pairing: [[0, 3], [1, 2]], map: 'stadium_day', rules: 'base', real_names: true }));
  const conf = L.loadCompetition(f);
  const TT = T.buildTournament(conf, { budget: 40 });
  const show = T.makeShow(conf, TT);
  show.matches.forEach((m) => { delete m.fine; });
  return show;
}
async function main() {
  const out = path.resolve(process.argv[2] || path.join(ROOT, 'build', 'p7_stills', 'fallback_decals.png'));
  const show = await decalShow(['chelsea', 'fulham', 'tottenham', 'hull']);
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file:///' + path.join(ROOT, 'render', 'index.html').replace(/\\/g, '/'));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((j) => window.initRenderer(JSON.parse(j)), JSON.stringify(show));
  const m = show.matches[0];
  const g = m.goals[0] || { t: 20, x: 960, y: 700 };
  const png = await page.evaluate(([t]) => window.renderThumb(0, t, { z: 2.2, x: 620, y: 560 }), [Math.max(2, g.t - 1.5)]);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
  // one sheet with the 4 fallback decals side by side (light ball grey background)
  const sheet = await page.evaluate((ids) => new Promise((res) => {
    const cv = document.createElement('canvas'); cv.width = 4 * 220; cv.height = 220; const g = cv.getContext('2d');
    g.fillStyle = '#eef1f5'; g.fillRect(0, 0, cv.width, cv.height);
    let n = 0; ids.forEach((id, i) => { const im = new Image(); im.onload = () => { g.drawImage(im, i * 220 + 14, 14); if (++n === ids.length) res(cv.toDataURL('image/png')); }; im.src = window.fallbackDecalOf(id); });
  }), ['chelsea', 'fulham', 'tottenham', 'hull']);
  fs.writeFileSync(out.replace(/\.png$/, '_sheet.png'), Buffer.from(sheet.split(',')[1], 'base64'));
  await browser.close();
  console.log(out);
}
module.exports = { decalShow };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
