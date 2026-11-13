'use strict';
// P7 §5-§7 checks without any video: builds a matchweek show (engine week 1 in a scratch season) and a season-finale
// show (stub weeks 1-37 + engine week 38), then
//   node tools/p7_stills.js smoke            draws one frame of every segment type headless (page errors -> exit 1), writes nothing
//   node tools/p7_stills.js stills [names]   writes the selected still PNGs to build/p7_stills/ (max ~8 per phase, CLAUDE.md)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const LC = require('../sim/league/config');
const SEASON = require('../sim/league/season');
const SH = require('../sim/league/show');

async function scratchSeason(C, name, upTo, engineFrom) {
  const dir = path.join(ROOT, 'build', name);
  const st = fs.existsSync(path.join(dir, 'state.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')) : null;
  // P8: rebuilt when the league rules / strength / engine change (old seeds would no longer re-simulate to the same hash)
  const key = require('crypto').createHash('sha256').update(JSON.stringify([C.rc, C.league.strength, require('../sim/config').ENGINE_VERSION])).digest('hex').slice(0, 16);
  const kf = path.join(dir, 'cfg.key');
  if (!st || st.last_generated_week !== upTo || !fs.existsSync(kf) || fs.readFileSync(kf, 'utf8') !== key) {
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'league', C.league.id, 'fixtures.json'), path.join(dir, 'fixtures.json'));
    for (let w = 1; w <= upTo; w++) await SEASON.playWeek(C, w, { dir, mode: w >= engineFrom ? 'engine' : 'stub' });
    fs.writeFileSync(kf, key);
  }
  return dir;
}
async function shows(opts) {
  const C = LC.loadLeague();
  const d1 = await scratchSeason(C, 'p7_scratch', 1, 1);
  const d38 = await scratchSeason(C, 'p7_finale', 38, 38);
  return { C, week: SH.buildMatchweekShow(C, 1, Object.assign({ dir: d1 }, opts)), finale: SH.buildMatchweekShow(C, 38, Object.assign({ dir: d38 }, opts)) };
}
async function openPage(browser, show, size) {
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file:///' + path.join(ROOT, 'render', 'index.html').replace(/\\/g, '/'));
  await page.evaluate(() => document.fonts.ready);
  const info = await page.evaluate((j) => window.initRenderer(JSON.parse(j)), JSON.stringify(Object.assign({}, show, { outSize: size })));
  return { page, errors, info };
}
// frame of a moment: [segment type, local second, optional predicate]
function frameOf(show, type, sec, pred) {
  const s = show.segments.find((x) => x.type === type && (!pred || pred(x)));
  return s ? s.start + Math.min(s.len - 1, Math.round(sec * 30)) : null;
}
async function smoke() {
  const { week, finale } = await shows();
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const out = [];
  for (const sh of [week, finale]) {
    const { page, errors } = await openPage(browser, sh, [1280, 720]);
    const types = [...new Set(sh.segments.map((s) => s.type))];
    for (const ty of types) for (const s of sh.segments.filter((x) => x.type === ty).slice(0, 2)) for (const u of [0.1, 0.5, 0.95]) await page.evaluate((g) => window.renderFrame(g), s.start + Math.floor(s.len * u));
    out.push({ week: sh.league.week, types, errors: errors.slice(0, 5) });
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(out, null, 1));
  if (out.some((o) => o.errors.length)) process.exit(1);
}
async function stills(names) {
  const { week, finale } = await shows();
  const dir = path.join(ROOT, 'build', 'p7_stills'); fs.mkdirSync(dir, { recursive: true });
  const m0 = week.matches.findIndex((m) => m.goals.length > 0);
  const g0 = week.matches[m0].goals[0];
  const goalFrame = () => { const s = week.segments.find((x) => x.type === 'match' && x.match === m0); const ev = week.matches[m0].events.find((e) => e.type === 'goal'); return s.start + Math.round((ev.vf !== undefined ? ev.vf : ev.t * 30) + 0.5 * 30); };
  const all = {
    p7_table_update: [week, () => frameOf(week, 'lgTable', 2.2, (s) => s.match === 9)],
    p7_table_full: [week, () => frameOf(week, 'lgTableFull', 4.0)],
    p7_match_premier_day: [week, () => frameOf(week, 'match', 20, (s) => s.match === m0)],
    p7_goal_closeup: [week, () => goalFrame()],
    p7_intro: [week, () => frameOf(week, 'lgIntro', 4.5)],
    p7_ceremony_wide: [finale, () => frameOf(finale, 'ceremony', 6.0)],
    p7_ceremony_lift: [finale, () => frameOf(finale, 'ceremony', 15.0)],
    p7_ceremony_orbit: [finale, () => frameOf(finale, 'ceremony', 25.0)],
  };
  const pick = names.length ? names : Object.keys(all);
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const pages = new Map();
  for (const n of pick) {
    const [sh, fn] = all[n];
    if (!pages.has(sh)) pages.set(sh, await openPage(browser, sh, [1920, 1080]));
    const { page, errors } = pages.get(sh);
    const png = await page.evaluate((g) => window.grabPNG(g), fn());
    fs.writeFileSync(path.join(dir, n + '.png'), Buffer.from(png.split(',')[1], 'base64'));
    console.log(n, errors.length ? 'ERR ' + errors[0] : 'ok');
  }
  await browser.close();
  console.log('goal used for the close-up:', week.teams[g0.team === 'A' ? week.matches[m0].ta : week.matches[m0].tb].name, g0.t.toFixed(1));
}
module.exports = { shows, scratchSeason, openPage, frameOf };
if (require.main === module) {
  const mode = process.argv[2];
  (mode === 'stills' ? stills(process.argv.slice(3)) : smoke()).catch((e) => { console.error(e); process.exit(1); });
}
