'use strict';
// P9 self-check stills (NO video): node tools/p9_stills.js <names...>  -> build/p9_stills/*.png
//   sheet      2x2 contact sheet: day overview | keeper crop (jump) / windmill+spout crop (just after a launch) | night goal-side crop (2.4x)
//   goal       goal close-up 0.3 s after a goal (zoomed camera, net ripple, flash, dust)            1920x1080
//   variants   2x2: day / overcast / evening / night                                               1920x1080
//   table      league table frame                                                                   1920x1080
//   reel       league reel frame mid-match                                                          1080x1920
// CLAUDE.md: max ~10 stills per phase; each PNG here counts as one.
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
  const dir = path.join(ROOT, 'build', 'p9_stills'); fs.mkdirSync(dir, { recursive: true });
  const m0 = week.matches.findIndex((m) => m.goals.length > 0);
  const seg0 = week.segments.find((x) => x.type === 'match' && x.match === m0), M = week.matches[m0];
  const vf = (e) => (e.vf !== undefined ? e.vf : e.t * 30);
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const grab = async (sh, size, frame) => {
    const { page, errors } = await P7S.openPage(browser, sh, size);
    const png = await page.evaluate((g) => window.grabPNG(g), frame);
    await page.close();
    if (errors.length) console.log('page errors:', errors.slice(0, 3));
    return png;
  };
  const compose = async (W, Hh, parts) => { // parts: [src, sx, sy, sw, sh, dx, dy, dw, dh] (source in output px)
    const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
    const png = await page.evaluate(async ([W, Hh, parts]) => {
      const c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, W, Hh);
      x.imageSmoothingQuality = 'high';
      for (const p of parts) { const im = new Image(); im.src = p[0]; await im.decode(); x.drawImage(im, p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8]); }
      return c.toDataURL('image/png');
    }, [W, Hh, parts]);
    await page.close(); return png;
  };
  const save = (n, png) => { fs.writeFileSync(path.join(dir, n + '.png'), Buffer.from(png.split(',')[1], 'base64')); console.log(n, 'ok'); };
  const want = (n) => names.includes(n);
  if (want('sheet')) {
    const day = await grab(week, [1920, 1080], P7S.frameOf(week, 'match', 20, (s) => s.match === m0));
    let jf = 0, best = 0; for (let i = 300; i < Math.min(2400, M.frames.length); i++) { const k = M.frames[i].k; if (k[3] === 1 && 560 - k[0] > best) { best = 560 - k[0]; jf = i; } }
    const jump = await grab(week, [1920, 1080], seg0.start + jf);
    const pop = M.events.find((e) => e.type === 'pop' && e.t > 30);
    const launch = await grab(week, [1920, 1080], seg0.start + Math.round(vf(pop) + 4));
    const night = SH.buildMatchweekShow(C, 1, { dir: d1, map: 'premier_night' });
    const nightPng = await grab(night, [1920, 1080], P7S.frameOf(night, 'match', 20, (s) => s.match === m0));
    const k = 1.5; // design -> output
    save('p9_sheet', await compose(1920, 1080, [
      [day, 0, 0, 1920, 1080, 0, 0, 960, 540],
      [jump, 1010 * k, 380 * k, 270 * k, 200 * k, 960, 0, 729, 540],
      [launch, 40 * k, 330 * k, 360 * k, 270 * k, 0, 540, 720, 540],
      [nightPng, 880 * k, 440 * k, 400 * k, 225 * k, 960, 540, 960, 540],
    ]));
    console.log('jump frame', jf, 'height', best, 'pop', pop.t);
  }
  if (want('goal')) {
    const ev = M.events.find((e) => e.type === 'goal');
    save('p9_goal', await grab(week, [1920, 1080], seg0.start + Math.round(vf(ev) + 0.3 * 30)));
  }
  if (want('variants')) {
    const shots = [];
    for (const map of ['premier_pitchside', 'premier_overcast', 'premier_evening', 'premier_night']) {
      const sh = SH.buildMatchweekShow(C, 1, { dir: d1, map });
      shots.push(await grab(sh, [1920, 1080], P7S.frameOf(sh, 'match', 12, (s) => s.match === m0)));
    }
    save('p9_variants', await compose(1920, 1080, shots.map((s, i) => [s, 0, 0, 1920, 1080, (i % 2) * 960, Math.floor(i / 2) * 540, 960, 540])));
  }
  if (want('table')) save('p9_table', await grab(week, [1920, 1080], P7S.frameOf(week, 'lgTable', 3.5)));
  if (want('reel')) {
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
    save('p9_reel', png);
  }
  await browser.close();
}
main(process.argv.slice(2)).catch((e) => { console.error(e); process.exit(1); });
