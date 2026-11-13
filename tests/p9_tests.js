'use strict';
// P9 tests (pro art kit). Art only: timelines unchanged, classic maps bit-identical to the pre-P9 renderer, static
// layers cached, animated details deterministic, camera sway small and off around zooms, per-frame time budget.
// No video is rendered and nothing is written (headless single frames only).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const L = require('../sim/config_loader');
const SH = require('../sim/league/show');
const P7S = require('../tools/p7_stills');
const PX = require('../tools/p9_pixels');
const HASH = require('../tools/p9_hashes');
const BENCH = require('../tools/p9_bench');

let pass = 0, fail = 0;
function check(name, ok, info) { if (ok) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (info !== undefined ? ' :: ' + JSON.stringify(info).slice(0, 400) : '')); } }
const MAPS = ['premier_pitchside', 'premier_overcast', 'premier_evening', 'premier_night'];
const readMap = (id) => JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'maps', id + '.json'), 'utf8'));

(async () => {
  console.log('== physics / timelines unchanged');
  const before = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'p9_hashes.json'), 'utf8'));
  const now = HASH.allHashes();
  check('timeline hashes identical to the pre-P9 recording (5 cup competitions x 3 seeds + simHash, 4 league matches)', JSON.stringify(now) === JSON.stringify(before), { now: now.league, before: before.league });
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'rules', 'base.json'), 'utf8'));
  const G = require('../sim/geometry');
  check('ball radius and layout constants unchanged (one radius for every ball)', G.BALL_R === 18 && G.GOAL_LINE_X === 1162 && G.BAR_Y === 390 && G.HUB_X === 205 && (base.ball_radius === undefined || typeof base.ball_radius === 'number'));

  console.log('== config');
  const maps = MAPS.map(readMap);
  check('the four premier maps use art_style "pro"', maps.every((m) => m.art_style === 'pro'));
  const others = fs.readdirSync(path.join(ROOT, 'config', 'maps')).filter((f) => f.endsWith('.json') && !f.startsWith('premier_')).map((f) => readMap(f.replace('.json', '')));
  check('every other map keeps its approved look (no art_style -> classic)', others.length >= 5 && others.every((m) => m.art_style === undefined || m.art_style === 'classic'), others.map((m) => m.id + ':' + m.art_style));
  { const e = []; L.validate(Object.assign({}, maps[0], { art_style: 'fancy' }), L.SCHEMAS.map, 'map', e); const e2 = []; L.validate(maps[0], L.SCHEMAS.map, 'map', e2); check('schema: art_style accepts classic|pro only', e.length > 0 && e2.length === 0, { e, e2 }); }

  console.log('== art kit source rules');
  const art = fs.readFileSync(path.join(ROOT, 'render', 'art_pro.js'), 'utf8');
  check('art_pro.js is deterministic and offline: no Math.random, Date, performance.now, fetch, XHR, external URLs', !/Math\.random|Date\.|new Date|performance\.now|fetch\(|XMLHttpRequest|https?:\/\//.test(art));
  const html = fs.readFileSync(path.join(ROOT, 'render', 'index.html'), 'utf8');
  check('index.html loads art_pro.js before draw.js and no remote script', html.indexOf('art_pro.js') > 0 && html.indexOf('art_pro.js') < html.indexOf('draw.js') && !/src="https?:/.test(html));
  const keys = ['render/render.js', 'build_matchweek.js', 'build_reels.js'].filter((f) => !fs.readFileSync(path.join(ROOT, f), 'utf8').includes('art_pro.js'));
  check('render cache keys include art_pro.js (a change of the art re-renders the blocks)', keys.length === 0, keys);
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  check('no new runtime dependency (docs/ART_KIT.md: pure Canvas 2D)', Object.keys(pkg.dependencies).sort().join() === 'ffmpeg-static,ffprobe-static,matter-js,playwright');

  console.log('== classic look unchanged');
  const cl = await PX.classicHashes();
  const clBefore = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'p9_classic_pixels.json'), 'utf8'));
  check('classic map (stadium_day): 6 frames (match, goal moment, table, full time) pixel-identical to the pre-P9 renderer', JSON.stringify(cl.hashes) === JSON.stringify(clBefore) && cl.errors.length === 0, { now: cl.hashes, before: clBefore, errors: cl.errors });

  console.log('== pro renderer (headless single frames)');
  const { C, week, finale } = await P7S.shows();
  const d1 = path.join(ROOT, 'build', 'p7_scratch');
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const m0 = week.matches.findIndex((m) => m.goals.length > 0), seg = week.segments.find((s) => s.type === 'match' && s.match === m0), M = week.matches[m0];
  for (const id of MAPS) {
    const sh = SH.buildMatchweekShow(C, 1, { dir: d1, map: id });
    const { page, errors } = await PX.openPage(browser, sh, [960, 540]);
    const i0 = await page.evaluate(() => window.artInfo());
    const fr = []; for (let k = 0; k < 40; k++) fr.push(seg.start + 30 + k * 37);
    const h1 = await PX.frameHashes(page, fr);
    const i1 = await page.evaluate(() => window.artInfo());
    const h2 = await PX.frameHashes(page, [fr[25], fr[3], fr[25]]);
    check(`${id}: pro on, static layers built once and cached (no rebuild over 40 frames), animated details deterministic (same frame -> same pixels)`,
      i0.pro && i0.skyLive && i0.bgBuilds === 1 && i1.bgBuilds === 1 && i1.stats.staticBuilds === i0.stats.staticBuilds && i1.stats.setups === 1 && h2[0] === h1[25] && h2[2] === h1[25] && h2[1] === h1[3] && new Set(h1).size > 30 && errors.length === 0,
      { i0: { b: i0.bgBuilds, s: i0.stats }, i1: { b: i1.bgBuilds, s: i1.stats }, errors });
    await page.close();
  }
  // a fresh page draws the same pixels as a page that has drawn other frames first (no hidden state)
  {
    const fr = seg.start + 450;
    const a = await PX.openPage(browser, week, [960, 540]); await PX.frameHashes(a.page, [seg.start + 20, seg.start + 900]); const ha = await PX.frameHashes(a.page, [fr]); await a.page.close();
    const b = await PX.openPage(browser, week, [960, 540]); const hb = await PX.frameHashes(b.page, [fr]); await b.page.close();
    check('fresh page and used page give identical pixels for the same frame', ha[0] === hb[0], [ha, hb]);
  }
  // camera breathing: <= 2 output px, zero during the goal zoom, replays and reels
  {
    const { page } = await PX.openPage(browser, week, [1920, 1080]);
    const ev = M.events.find((e) => e.type === 'goal'), gv = Math.round(ev.vf !== undefined ? ev.vf : ev.t * 30);
    const r = await page.evaluate(([s, len, gv]) => {
      let maxPx = 0, n = 0; const S = 1.5;
      for (let k = 0; k < len; k += 7) { window.renderFrame(s + k); const w = window.artInfo().sway; if (w) { n++; maxPx = Math.max(maxPx, Math.abs(w[0]) * S * w[2], Math.abs(w[1]) * S * w[2]); } }
      const during = []; for (const d of [1, 10, 25, 45]) { window.renderFrame(s + gv + d); during.push(window.artInfo().sway); }
      return { maxPx, n, during };
    }, [seg.start, seg.len, gv]);
    const rp = week.segments.find((x) => x.type === 'replay');
    const inReplay = rp ? await page.evaluate((g) => { window.renderFrame(g); return window.artInfo().sway; }, rp.start + 20) : null;
    check(`camera sway: max ${r.maxPx.toFixed(2)} output px (<= 2), active on ${r.n} sampled frames, none during the goal zoom or replays`, r.maxPx > 0.3 && r.maxPx <= 2 && r.n > 50 && r.during.every((x) => x === null) && inReplay === null, r);
    await page.close();
  }
  // every segment type of a matchweek + the season finale draws without page errors (pro)
  {
    const errs = [];
    for (const sh of [week, finale]) {
      const { page, errors } = await PX.openPage(browser, sh, [640, 360]);
      const types = [...new Set(sh.segments.map((s) => s.type))];
      for (const ty of types) for (const s of sh.segments.filter((x) => x.type === ty).slice(0, 2)) for (const u of [0.1, 0.5, 0.95]) await page.evaluate((g) => window.renderFrame(g), s.start + Math.floor(s.len * u));
      errs.push(...errors); await page.close();
    }
    check('all segment types of a matchweek and the season finale draw without errors (pro)', errs.length === 0, errs.slice(0, 3));
  }
  // the kit is reusable on another map through the flag (left off by default)
  {
    const map = Object.assign({}, readMap('sky_clean'), { art_style: 'pro' });
    const sh = Object.assign({}, week, { map });
    const { page, errors } = await PX.openPage(browser, sh, [640, 360]);
    for (let k = 0; k < 6; k++) await page.evaluate((g) => window.renderFrame(g), seg.start + k * 200);
    const i = await page.evaluate(() => window.artInfo());
    check('art kit reusable on a non-bowl map via art_style "pro" (sky_clean: static sky, no errors)', i.pro && !i.skyLive && errors.length === 0, { i, errors });
    await page.close();
  }
  await browser.close();

  console.log('== per-frame time (still-frame benchmark, 1920x1080, no video)');
  const bb = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'p9_bench_before.json'), 'utf8')); // measured on the P8 renderer before any P9 change
  const now1 = await BENCH.bench('test');
  console.log(`   before (P8 renderer): mean ${bb.mean && bb.mean.toFixed(1)} ms, p95 ${bb.p95}, max ${bb.max} | now (pro): mean ${now1.mean.toFixed(1)} ms, p95 ${now1.p95.toFixed(1)}, max ${now1.max.toFixed(1)}`);
  check('render time per frame stays close to before (mean <= 1.15 x pre-P9 mean) and no frame over the 60 ms budget', now1.mean <= 1.15 * (bb.mean || 23.1) && now1.max <= 60 && now1.errors.length === 0, now1);

  console.log(`\nP9 tests: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
