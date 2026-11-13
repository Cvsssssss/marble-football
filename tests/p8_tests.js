'use strict';
// P8 tests: league clock + launch cadence identical to the cups, cup timelines unchanged, calibration, replay rule,
// league video length gate, reels at normal speed (whole match, no fast-forward, <= 59 s, centred), procedural premier
// stadium (no background image layer). No video is rendered (headless single frames only, nothing written).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const L = require('../sim/config_loader');
const LC = require('../sim/league/config');
const SH = require('../sim/league/show');
const LP = require('../sim/league/publish');
const T = require('../sim/tournament');
const SEL = require('../sim/selectReels');
const R = require('../sim/reels');
const CAD = require('../tools/p8_cadence');
const HASH = require('../tools/p8_hashes');
const P7S = require('../tools/p7_stills');
const ENGINE_DEFAULT = require('../sim/config').RELEASE_INTERVAL;

let pass = 0, fail = 0;
function check(name, ok, info) { if (ok) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (info !== undefined ? ' :: ' + JSON.stringify(info).slice(0, 400) : '')); } }
const COMP = (id) => path.join(ROOT, 'config', 'competitions', id + '.json');

(async () => {
  // ---------- §1 clock + cadence ----------
  console.log('== §1 league clock and launch cadence vs MARBLE CHAMPIONS');
  const C = LC.loadLeague();
  const ucl = L.loadCompetition(COMP('ucl_2026_top16'), { skipPlayerCheck: true });
  check(`league clock = UCL clock (${C.rules.GAME_MIN_PER_SEC} vs ${ucl.rules.GAME_MIN_PER_SEC} game min / s -> ${(90 / C.rules.GAME_MIN_PER_SEC).toFixed(1)} s of play)`, C.rules.GAME_MIN_PER_SEC === ucl.rules.GAME_MIN_PER_SEC);
  check('no league-specific release interval: league engine cfg uses the engine default like the cups', C.rules.release_interval === undefined && C.rc.RELEASE_INTERVAL === undefined && L.rulesToCfg(ucl.rules).RELEASE_INTERVAL === undefined);
  { const e = []; L.validate(Object.assign({}, C.rules, { release_interval: [7.6, 11.4] }), L.SCHEMAS.rules, 'rules', e); check('schema: the removed release_interval key is rejected again (no slower league clock via config)', e.length > 0, e); }
  const lr = Object.assign({}, L.rulesToCfg(C.rules)), ur = L.rulesToCfg(ucl.rules);
  const same = ['GAME_MIN_PER_SEC', 'ADDED_MIN', 'BOOST_FROM', 'BOOST_RAMP', 'BOOST', 'BALL_RADIUS', 'BALLS_PER_TEAM'].filter((k) => JSON.stringify(lr[k]) !== JSON.stringify(ur[k]));
  check('every timing/pump-related engine key equals UCL (clock, added time, windmill boost, balls)', same.length === 0, same);
  const cad = CAD.run(30);
  console.log(`   pop interval (s, regular play, normal windmill speed): UCL ${JSON.stringify(cad.ucl.popInterval_s)}`);
  console.log(`                                                          league ${JSON.stringify(cad.league.popInterval_s)}`);
  console.log(`   match until final whistle (s, no golden ball): UCL ${JSON.stringify(cad.ucl.untilFinalWhistleNoGolden_s)} league ${JSON.stringify(cad.league.untilFinalWhistleNoGolden_s)}`);
  check('launch-interval distribution equal to UCL (mean, p10, median, p90 within 0.05 s)', ['mean', 'p10', 'median', 'p90'].every((k) => Math.abs(cad.ucl.popInterval_s[k] - cad.league.popInterval_s[k]) <= 0.05) && cad.league.popInterval_s.median < 2.6);
  check('match timeline until the final whistle equal to UCL (mean within 1.5 s); league has no golden ball so the full timeline is never longer', Math.abs(cad.ucl.untilFinalWhistleNoGolden_s.mean - cad.league.untilFinalWhistleNoGolden_s.mean) <= 1.5 && cad.league.timeline_s.mean <= cad.ucl.timeline_s.mean + 0.5);
  const before = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'p8_cup_hashes.json'), 'utf8'));
  const now = HASH.cupHashes();
  check('cup competitions: timeline hashes and simHash unchanged by P8 (5 competitions x 3 seeds, recorded before the changes)', JSON.stringify(now) === JSON.stringify(before), Object.keys(now).filter((k) => JSON.stringify(now[k]) !== JSON.stringify(before[k])));

  // ---------- calibration ----------
  const cal = JSON.parse(fs.readFileSync(path.join(ROOT, 'league', C.league.id, 'calibration.json'), 'utf8'));
  const es = cal.engine_season, mc = cal.monte_carlo;
  console.log(`   calibration: engine season ${JSON.stringify(es)}`);
  console.log(`   monte carlo: champion ${JSON.stringify(mc.champion)} last ${JSON.stringify(mc.last)} gap15 ${JSON.stringify(mc.gapAfterMw15)} top-title ${mc.topRatedTitleShare} single ${JSON.stringify(mc.single)}`);
  check('calibration made with the current rules (no release interval) and strength', cal.release_interval === undefined && JSON.stringify(cal.strength) === JSON.stringify(C.league.strength));
  check('season targets pass (champion, last, gap after MW15, top-rated title share, top club loses >= 2)', Object.values(mc.pass).every(Boolean), mc.pass);
  check('single-match targets that can be met with the UCL cadence: draws 18-28 %, 0-0 <= 8 %, home wins 40-50 % (avg goals reported, see report)', es.draws >= 0.18 && es.draws <= 0.28 && es.nilNil <= 0.08 && es.homeWin >= 0.40 && es.homeWin <= 0.50, es);

  // ---------- matchweek show: replay rule + length gate ----------
  console.log('== matchweek show');
  const { week, finale } = await P7S.shows();
  const reps = week.segments.filter((s) => s.type === 'replay');
  const withGoals = week.matches.filter((m) => m.goals.length).length;
  check(`one goal replay per match with goals (${reps.filter((s) => !s.gotw).length} of ${withGoals}) + the Goal of the Week replay, as in the tournaments`, reps.filter((s) => !s.gotw).length === withGoals && reps.filter((s) => s.gotw).length === 1 && week.matches.every((m, i) => reps.filter((s) => !s.gotw && s.match === i).length <= 1));
  const mins = (s) => s.totalFrames / s.fps / 60;
  console.log(`   durations: week 1 ${mins(week).toFixed(2)} min, finale week 38 ${mins(finale).toFixed(2)} min`);
  check(`league video length gate ${SH.LENGTH_GATE_MIN.join('-')} min (no 20 min minimum, no filler)`, mins(week) >= SH.LENGTH_GATE_MIN[0] && mins(week) <= SH.LENGTH_GATE_MIN[1] && mins(finale) >= SH.LENGTH_GATE_MIN[0] && mins(finale) <= SH.LENGTH_GATE_MIN[1]);
  check('saved goal minutes follow the league clock (never above 90 in regular play)', (() => { const wr = JSON.parse(fs.readFileSync(require('../sim/league/season').resultsFile(C, 1, { dir: path.join(ROOT, 'build', 'p7_scratch') }), 'utf8')); return wr.matches.every((m) => m.goals.every((g) => g.shot || (parseInt(g.minute, 10) >= 1 && parseInt(g.minute, 10) <= 90))); })());

  // ---------- §2 reels ----------
  console.log('== §2 reels');
  const reelChecks = (show, label) => {
    const out = [];
    show.matches.forEach((m, i) => {
      if (!m.goals.length) return;
      const r = R.buildReel(show, i, LP.REEL_OPTS);
      const ms = r.segments.find((s) => s.type === 'match');
      const whole = ms.plan.length === m.frames.length && ms.plan.every((p, k) => p.src === k && p.ff === 0);
      out.push({ i, s: r.seconds, fits: r.fits, whole, lvl: r.extrasLevel, speed: r.speed, sumOk: r.segments.reduce((a, s) => a + s.len, 0) === r.totalFrames });
    });
    console.log(`   ${label}: ` + out.map((o) => `#${o.i} ${o.s}s${o.fits ? '' : ' (skip)'} L${o.lvl}`).join(', '));
    return out;
  };
  const lg = reelChecks(week, 'league week 1 reels');
  check('league: every reel = the whole match frame by frame at 1x (no fast-forward, nothing cut), speed 1', lg.every((o) => o.whole && o.speed === 1 && o.sumOk));
  check('league: fits <=> reel <= 59 s; reels that fit are 30-59 s', lg.every((o) => o.fits === (o.s <= 59) && (!o.fits || o.s >= 30)));
  const sel = LP.selectLeagueReel(week, SH.matchesIndexLeague(week));
  check('league selection only among matches whose reel fits at normal speed', sel.reels.length === 1 && lg.find((o) => o.i === sel.reels[0].index).fits);
  const showF = path.join(ROOT, 'build', 'p8_ucl_show.json');
  const { show } = T.buildAll(COMP('ucl_2026_top16'), showF, {});
  const cu = reelChecks(show, 'UCL reels');
  check('cups: every reel = the whole match at 1x, no fast-forward', cu.every((o) => o.whole && o.speed === 1 && o.sumOk));
  const idx0 = T.matchesIndex(show);
  const idx = Object.assign({}, idx0, { matches: idx0.matches.filter((m) => !m.goals.length || R.buildReel(show, m.index).fits) });
  const csel = SEL.selectReel(idx);
  check('cup selection: one reel, only a match that fits <= 59 s at normal speed', csel.reels.length === 1 && R.buildReel(show, csel.reels[0].index).fits && R.buildReel(show, csel.reels[0].index).seconds <= 59, csel.reels[0] && csel.reels[0].why);
  {
    const none = Object.assign({}, idx, { matches: idx.matches.filter((m) => !/^(ROUND OF 16|QUARTER-FINAL)/.test(m.stage)) });
    const s2 = SEL.selectReel(none);
    check('last resort: no R16/QF match fits -> another match is chosen (never sped up)', s2.reels.length === 1 && /LAST RESORT/.test(s2.reels[0].why));
  }
  // a very long match: extras are dropped first, then it does not fit (never sped up)
  {
    const m = show.matches[0], long = JSON.parse(JSON.stringify(Object.assign({}, show, { matches: [Object.assign({}, m, { frames: m.frames.concat(m.frames.slice(0, 30 * 20)) })] })));
    const r = R.buildReel(long, 0);
    check('too-long match: last extras level tried, reel marked not fitting, still 1x', !r.fits && r.extrasLevel === R.EXTRAS.length - 1 && r.speed === 1);
  }
  fs.rmSync(showF, { force: true });

  // centring + safe areas (headless, one frame per segment type, nothing written)
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  {
    const reel = R.buildReel(week, sel.reels[0].index, LP.REEL_OPTS);
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('file:///' + path.join(ROOT, 'render', 'index.html').replace(/\\/g, '/'));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate((j) => window.initRenderer(JSON.parse(j)), JSON.stringify(Object.assign({}, week, { outSize: [1080, 1920] })));
    await page.evaluate((j) => window.initReel(JSON.parse(j)), JSON.stringify(reel));
    const res = [];
    for (const s of reel.segments) res.push(Object.assign({ type: s.type }, await page.evaluate((k) => { window.renderReelFrame(k); return { rect: window.__reelSceneRect, boxes: window.REEL_BOXES, L: window.REEL_LAYOUT }; }, s.start + Math.floor(s.len / 2))));
    await page.close();
    const L0 = res[0].L, rect = res.find((x) => x.type === 'match').rect;
    const left = rect.x, right = 1080 - (rect.x + rect.w);
    console.log(`   scene rect ${JSON.stringify(rect)} -> left margin ${left} px, right margin ${right} px; text column ${L0.SAFE.x0 * L0.RS}..${L0.SAFE.x1 * L0.RS} px (centre ${(L0.SAFE.x0 + L0.SAFE.x1) / 2 * L0.RS})`);
    check('scene rectangle exactly horizontally centred in 1080x1920 (left margin = right margin, to the pixel)', Math.abs(left - right) < 0.5 && rect.w <= 1080);
    check('scene in the middle band (as P6: below the scoreboard, above the bottom 25 %)', rect.y >= 1920 * 0.25 && rect.y + rect.h <= 1920 * 0.75);
    check('text column symmetric around the frame centre (x0 + x1 = frame width) and out of the right 12 %', Math.abs((L0.SAFE.x0 + L0.SAFE.x1) - L0.RW) < 1e-9 && L0.SAFE.x1 <= L0.RW * 0.88);
    const bad = [], off = [];
    for (const r of res) for (const b of r.boxes) {
      if (b.x < r.L.SAFE.x0 - 0.5 || b.y < r.L.SAFE.y0 || b.x + b.w > r.L.SAFE.x1 + 0.5 || b.y + b.h > r.L.SAFE.y1 + 0.5) bad.push(`${r.type}:${b.name}`);
      if (['competition', 'scoreboard', 'hook_score', 'motm', 'end'].includes(b.name) && Math.abs(b.x + b.w / 2 - r.L.RW / 2) > 1) off.push(`${r.type}:${b.name}:${(b.x + b.w / 2).toFixed(1)}`);
    }
    check('league reel: every text box inside the safe area (all segment types)', bad.length === 0 && errors.length === 0, bad.concat(errors).slice(0, 6));
    check('league reel: header / scoreboard / cards centred on the frame centre (±1 design px)', off.length === 0, off.slice(0, 6));
    check('no fast-forward indicator drawn anywhere', !res.some((r) => r.boxes.some((b) => b.name === 'ff')));
  }

  // ---------- §3 procedural stadium ----------
  console.log('== §3 premier stadium');
  const PM = ['premier_pitchside', 'premier_overcast', 'premier_evening', 'premier_night'];
  const maps = PM.map((id) => JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'maps', id + '.json'), 'utf8')));
  check('premier maps: use_background_image false, procedural "bowl" scenery, valid schema', maps.every((m) => { const e = []; L.validate(m, L.SCHEMAS.map, m.id, e); return e.length === 0 && m.use_background_image === false && m.scenery === 'bowl'; }));
  check('background image layer is not embedded any more (show.background null); the code path still works when a map sets use_background_image true', week.background === null && SH.backgroundPart(maps[0]) === null && !!SH.backgroundPart(Object.assign({}, maps[0], { use_background_image: true })));
  for (const id of PM) {
    const sh = SH.buildMatchweekShow(C, 1, { dir: path.join(ROOT, 'build', 'p7_scratch'), map: id });
    const { page, errors } = await P7S.openPage(browser, sh, [1280, 720]);
    const f = sh.segments.find((s) => s.type === 'match').start + 200;
    const a = await page.evaluate((g) => window.grabPNG(g), f);
    const b = await page.evaluate((g) => window.grabPNG(g), f + 40);
    const a2 = await page.evaluate((g) => window.grabPNG(g), f);
    const li = await page.evaluate(() => window.bgLayerInfo()), si = await page.evaluate(() => window.stadiumInfo());
    check(`${id}: procedural stadium layers (sky -> scenery:bowl -> platforms), no image, animated fans + flags, deterministic frames, no errors`,
      !li.image && li.layers[0] === 'sky' && li.layers[1] === 'scenery:bowl' && li.layers.indexOf('platforms') > 1 && si && si.fans > 100 && si.flags >= 20 && a === a2 && a !== b && errors.length === 0, { layers: li.layers, si, errors });
    await page.close();
  }
  await browser.close();
  // board text: only the plain league name
  const src = fs.readFileSync(path.join(ROOT, 'render', 'draw.js'), 'utf8');
  const bowl = src.slice(src.indexOf('function drawBowl('), src.indexOf('function drawStadiumLive('));
  const strings = (bowl.match(/'[A-Z][A-Z ]{3,}'/g) || []).filter((s) => s !== "'PREMIER LEAGUE'");
  check('stadium drawing: no text other than the plain league name (no brands, no logos)', strings.length === 0 && !/drawImage/.test(bowl), strings);

  console.log(`\nP8 tests: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
