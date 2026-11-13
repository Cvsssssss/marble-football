'use strict';
// P8 self-check stills (NO video): node tools/p8_stills.js [names]
//   p8_match_day      league match frame, procedural stadium (day)       1920x1080
//   p8_goal_closeup   goal moment (zoom)                                   1920x1080
//   p8_reel_layout    league reel frame mid-match                          1080x1920
//   p8_variants       2x2: day / overcast / evening / night (one PNG)      1920x1080
// Writes build/p8_stills/*.png (max ~6 stills per phase, CLAUDE.md).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P7S = require('./p7_stills');
const SH = require('../sim/league/show');
const LP = require('../sim/league/publish');
const { buildReel } = require('../sim/reels');

async function main(names) {
  const { C, week } = await P7S.shows();
  const d1 = path.join(ROOT, 'build', 'p7_scratch');
  const dir = path.join(ROOT, 'build', 'p8_stills'); fs.mkdirSync(dir, { recursive: true });
  const m0 = week.matches.findIndex((m) => m.goals.length > 0);
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const grab = async (sh, size, frame) => {
    const { page, errors } = await P7S.openPage(browser, sh, size);
    const png = await page.evaluate((g) => window.grabPNG(g), frame);
    await page.close();
    if (errors.length) console.log('page errors:', errors.slice(0, 3));
    return png;
  };
  const save = (n, png) => { fs.writeFileSync(path.join(dir, n + '.png'), Buffer.from(png.split(',')[1], 'base64')); console.log(n, 'ok'); };
  const want = (n) => !names.length || names.includes(n);
  if (want('p8_match_day')) save('p8_match_day', await grab(week, [1920, 1080], P7S.frameOf(week, 'match', 20, (s) => s.match === m0)));
  if (want('p8_goal_closeup')) {
    const s = week.segments.find((x) => x.type === 'match' && x.match === m0), ev = week.matches[m0].events.find((e) => e.type === 'goal');
    save('p8_goal_closeup', await grab(week, [1920, 1080], s.start + Math.round((ev.vf !== undefined ? ev.vf : ev.t * 30) + 0.5 * 30)));
  }
  if (want('p8_reel_layout')) {
    const idx = SH.matchesIndexLeague(week);
    const sel = LP.selectLeagueReel(week, idx);
    const reel = buildReel(week, sel.reels[0].index, LP.REEL_OPTS);
    const ms = reel.segments.find((x) => x.type === 'match');
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto('file:///' + path.join(ROOT, 'render', 'index.html').replace(/\\/g, '/'));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate((j) => window.initRenderer(JSON.parse(j)), JSON.stringify(Object.assign({}, week, { outSize: [1080, 1920] })));
    await page.evaluate((j) => window.initReel(JSON.parse(j)), JSON.stringify(reel));
    const png = await page.evaluate((x) => { window.renderReelFrame(x); return document.getElementById('c').toDataURL('image/png'); }, ms.start + Math.round(ms.len * 0.45));
    await page.close();
    save('p8_reel_layout', png);
    console.log('reel', reel.seconds, 's, extras', JSON.stringify(reel.extras));
  }
  if (want('p8_variants')) {
    const shots = [];
    for (const map of ['premier_pitchside', 'premier_overcast', 'premier_evening', 'premier_night']) {
      const sh = SH.buildMatchweekShow(C, 1, { dir: d1, map });
      shots.push(await grab(sh, [960, 540], P7S.frameOf(sh, 'match', 12, (s) => s.match === m0)));
    }
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const png = await page.evaluate(async (srcs) => {
      const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const x = c.getContext('2d');
      for (let i = 0; i < 4; i++) { const im = new Image(); im.src = srcs[i]; await im.decode(); x.drawImage(im, (i % 2) * 960, Math.floor(i / 2) * 540, 960, 540); }
      return c.toDataURL('image/png');
    }, shots);
    await page.close();
    save('p8_variants', png);
  }
  await browser.close();
}
main(process.argv.slice(2)).catch((e) => { console.error(e); process.exit(1); });
