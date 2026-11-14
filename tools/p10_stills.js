'use strict';
// P10 self-check stills (NO video): node tools/p10_stills.js <names...>  -> build/p10_stills/*.png (each PNG = 1 still)
//   intro    2x2: intro mid-blur (night) | intro after the scoreboard slid in | transition stripe | replay swoosh
//   day      day overview, split stands, wind (match frame)                                   1920x1080
//   night    night variant with rain, lens droplets, smoke + flares (moment of a smoke emitter) 1920x1080
//   goal     2 panels: rounded crossbar corner crop (3x) | goal-reaction frame (scoring half up)
//   trophy   2x2: trophy close-up | ceremony wide | lift | orbit
//   reel     league reel frame mid-match                                                      1080x1920
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P7S = require('./p7_stills');
const { shows } = require('./p10_shows');
const { buildReel } = require('../sim/reels');

async function main(names) {
  const { week, finale, maps } = await shows({ maps: ['premier_night'] });
  const night = maps.premier_night;
  const dir = path.join(ROOT, 'build', 'p10_stills'); fs.mkdirSync(dir, { recursive: true });
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const grab = async (sh, size, frame) => {
    const { page, errors } = await P7S.openPage(browser, sh, size);
    const png = await page.evaluate((g) => window.grabPNG(g), frame);
    await page.close();
    if (errors.length) console.log('page errors:', errors.slice(0, 3));
    return png;
  };
  const compose = async (W, Hh, parts) => {
    const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
    const png = await page.evaluate(async ([W, Hh, parts]) => {
      const c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, W, Hh); x.imageSmoothingQuality = 'high';
      for (const p of parts) { const im = new Image(); im.src = p[0]; await im.decode(); x.drawImage(im, p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8]); }
      return c.toDataURL('image/png');
    }, [W, Hh, parts]);
    await page.close(); return png;
  };
  const save = (n, png) => { fs.writeFileSync(path.join(dir, n + '.png'), Buffer.from(png.split(',')[1], 'base64')); console.log(n, 'ok'); };
  const want = (n) => names.includes(n);
  const seg = (sh, type, mi) => sh.segments.find((s) => s.type === type && (mi === undefined || s.match === mi));
  const full = (p) => [p, 0, 0, 1920, 1080];
  if (want('intro')) {
    const k1 = seg(night, 'lgKick', 1), tr = seg(week, 'lgTrans', 2), rp = week.segments.find((s) => s.type === 'replay');
    const a = await grab(night, [1920, 1080], k1.start + Math.round(0.75 * 30));
    const b = await grab(night, [1920, 1080], k1.start + Math.round(2.35 * 30));
    const c = await grab(week, [1920, 1080], tr.start + Math.round(tr.len * 0.5));
    const d = await grab(week, [1920, 1080], rp.start + 6);
    save('p10_intro', await compose(1920, 1080, [full(a).concat([0, 0, 960, 540]), full(b).concat([960, 0, 960, 540]), full(c).concat([0, 540, 960, 540]), full(d).concat([960, 540, 960, 540])]));
  }
  if (want('day')) { const ms = seg(week, 'match', 2); save('p10_day', await grab(week, [1920, 1080], ms.start + 400)); }
  if (want('night')) {
    const mi = 3, at = night.atmo.matches[mi], sk = at.smoke[0], ms = seg(night, 'match', mi);
    save('p10_night', await grab(night, [1920, 1080], ms.start + Math.round((sk.v + 1.6) * 30)));
    console.log('smoke', JSON.stringify(sk));
  }
  if (want('goal')) {
    const mi = week.atmo.matches.findIndex((a) => a.react.some((r) => r.k >= 1.3)), r = week.atmo.matches[mi].react.find((x) => x.k >= 1.3), ms = seg(week, 'match', mi);
    const corner = await grab(night, [1920, 1080], seg(night, 'match', 1).start + 300);
    const react = await grab(week, [1920, 1080], ms.start + Math.round((r.v + 2.3) * 30));
    const k = 1.5;
    save('p10_goal', await compose(1920, 1080, [[corner, 1100 * k, 360 * k, 180 * k, 200 * k, 0, 0, 972, 1080], [react, 0, 0, 1920, 1080, 972, 270, 948, 533]]));
    console.log('reaction', mi, JSON.stringify(r));
  }
  if (want('trophy')) {
    const cs = seg(finale, 'ceremony');
    const w = await grab(finale, [1920, 1080], cs.start + 6 * 30), l = await grab(finale, [1920, 1080], cs.start + 15 * 30), o = await grab(finale, [1920, 1080], cs.start + 25 * 30);
    save('p10_trophy', await compose(1920, 1080, [[l, 560, 60, 800, 900, 0, 0, 480, 540], full(w).concat([960, 0, 960, 540]), full(l).concat([0, 540, 960, 540]), full(o).concat([960, 540, 960, 540])]));
  }
  if (want('reel')) {
    const reel = buildReel(week, 2, require('../sim/league/publish').REEL_OPTS);
    const { page } = await P7S.openPage(browser, week, [1080, 1920]);
    await page.evaluate((j) => window.initReel(JSON.parse(j)), JSON.stringify(reel));
    const ms = reel.segments.find((s) => s.type === 'match');
    const png = await page.evaluate((k) => { window.renderReelFrame(k); return document.getElementById('c').toDataURL('image/png'); }, ms.start + Math.floor(ms.len * 0.4));
    await page.close(); save('p10_reel', png);
  }
  await browser.close();
}
module.exports = { main };
if (require.main === module) main(process.argv.slice(2)).catch((e) => { console.error(e); process.exit(1); });
