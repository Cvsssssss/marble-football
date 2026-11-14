'use strict';
// P10 tests (Premier League atmosphere). Visual/audio only: physics files and timelines unchanged, atmosphere data and
// crowd audio events at the right timeline moments, intro/transition segments, flags on/off, no ad boards, stands in
// the team colours, deterministic animated details, crowd audio without clipping, per-frame time budget.
// No video is rendered and nothing is written outside build/ (headless single frames + one short audio report).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const L = require('../sim/config_loader');
const ATMO = require('../sim/atmosphere');
const SH = require('../sim/league/show');
const P7S = require('../tools/p7_stills');
const PX = require('../tools/p9_pixels');
const HASH = require('../tools/p9_hashes');
const BENCH = require('../tools/p9_bench');
const { shows } = require('../tools/p10_shows');

let pass = 0, fail = 0;
function check(name, ok, info) { if (ok) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (info !== undefined ? ' :: ' + JSON.stringify(info).slice(0, 500) : '')); } }
const FPS = 30;
const vf = (e) => (e.vf !== undefined ? e.vf : e.t * FPS);

(async () => {
  console.log('== physics unchanged');
  const before = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'p9_hashes.json'), 'utf8'));
  check('timeline hashes identical to the pre-P9 recording (5 cups x 3 seeds + 4 league matches)', JSON.stringify(HASH.allHashes()) === JSON.stringify(before));
  const physFiles = ['sim/engine.js', 'sim/geometry.js', 'sim/config.js', 'sim/pump.js', 'sim/cinematic.js', 'config/rules/base.json'];
  const changed = physFiles.filter((f) => { try { execFileSync('git', ['diff', '--quiet', 'fd68745', '--', f], { cwd: ROOT }); return false; } catch (e) { return true; } });
  check('physics objects unchanged: engine, geometry (post/crossbar/keeper/windmill colliders), rules identical to the P9 commit', changed.length === 0, changed);
  const G = require('../sim/geometry');
  check('goal colliders: post x 1157.5..1166.5, crossbar y 386..394 (the rounded corner is drawing only)', G.BAR_X0 === 1157.5 && G.POST_W === 9 && G.BAR_TOP === 386 && G.BAR_BOTTOM === 394 && G.GOAL_LINE_X === 1162);

  console.log('== config');
  const AC = L.loadAtmosphere();
  check('config/atmosphere.json valid, enabled, every major effect has a flag', AC.enabled && ['match_intro', 'match_transitions', 'earth_platforms', 'wind', 'rain', 'rounded_goal', 'split_stands', 'stand_smoke', 'crowd_reactions', 'crowd_audio', 'trophy_v2'].every((k) => typeof AC[k] === 'boolean'));
  { const e = []; L.validate(Object.assign({}, AC, { stand_smoke: 'yes' }), L.SCHEMAS.atmosphere, 'a', e); check('schema rejects a non-boolean flag', e.length > 0, e); }
  const src = fs.readFileSync(path.join(ROOT, 'render', 'atmo.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'sim', 'atmosphere.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'audio', 'crowd.py'), 'utf8');
  check('atmosphere code deterministic and offline (no Math.random, Date, performance.now, fetch, URLs, np.random without seed)', !/Math\.random|Date\.|new Date|performance\.now|fetch\(|XMLHttpRequest|https?:\/\/|np\.random\.(rand|randn|normal|uniform)\(/.test(src));

  console.log('== show: segments, atmosphere data, crowd audio events');
  const { week, finale, maps } = await shows({ maps: ['premier_night'] });
  const night = maps.premier_night;
  const segs = week.segments;
  let segOk = true, pause = 0;
  week.matches.forEach((m, mi) => {
    const i = segs.findIndex((s) => s.type === 'lgTrans' && s.match === mi);
    const order = segs.slice(i, i + 4).map((s) => s.type).join();
    if (order !== 'lgTrans,lgPre,lgKick,match' || segs[i + 3].len !== m.frames.length || segs[i + 2].start + segs[i + 2].len !== segs[i + 3].start || !segs[i + 1].noFade) segOk = false;
    pause = Math.max(pause, (segs[i].len + segs[i + 2].len) / FPS);
  });
  check(`every match: transition (1 s) -> pre-card -> intro (2.8 s) -> match; intro ends exactly at kick-off; added pause ${pause.toFixed(1)} s <= 4 s`, segOk && pause <= 4.01);
  check('chapters point at the transition of each match', week.chapters.filter((c) => / vs /.test(c.title)).every((c, mi) => Math.abs(c.t - segs.find((s) => s.type === 'lgTrans' && s.match === mi).start / FPS) < 1e-6));
  const C = require('../sim/league/config').loadLeague();
  const d1 = path.join(ROOT, 'build', 'p7_scratch');
  const off = SH.buildMatchweekShow(C, 1, { dir: d1, atmosphere: { enabled: false } });
  const noTr = SH.buildMatchweekShow(C, 1, { dir: d1, atmosphere: Object.assign({}, AC, { match_transitions: false }) });
  const classic = SH.buildMatchweekShow(C, 1, { dir: d1, map: 'stadium_day' });
  check('flags: enabled=false -> no intro/transition, no atmo data, no crowd events; match_transitions=false -> intros only; classic map -> unchanged P9 timeline',
    !off.segments.some((s) => s.type === 'lgKick' || s.type === 'lgTrans') && off.atmo === null && !off.audio.some((e) => e.type.startsWith('crowd_') && e.type !== 'crowd_end') &&
    !noTr.segments.some((s) => s.type === 'lgTrans') && noTr.segments.filter((s) => s.type === 'lgKick').length === 10 &&
    !classic.segments.some((s) => s.type === 'lgKick' || s.type === 'lgTrans') && classic.atmo === null);
  const a2 = ATMO.annotate(JSON.parse(JSON.stringify(Object.assign({}, week, { audio: week.audio.filter((e) => !/^crowd_|_bed$|mill_thump|lights_on/.test(e.type)) }))), AC);
  check('atmosphere data deterministic (annotate again -> identical)', JSON.stringify(a2.atmo) === JSON.stringify(week.atmo));
  let reactOk = true, audioOk = true; const miss = [];
  const near = (t, type, f) => week.audio.some((e) => e.type === type && Math.abs(e.t - t) < 2e-3 && (!f || f(e)));
  week.matches.forEach((m, mi) => {
    const ms = segs.find((s) => s.type === 'match' && s.match === mi), at = week.atmo.matches[mi];
    const goals = m.events.filter((e) => e.type === 'goal');
    if (goals.length !== at.react.length || goals.some((g, k) => Math.abs(vf(g) / FPS - at.react[k].v) > 2e-3 || g.team !== at.react[k].side)) reactOk = false;
    for (const g of goals) {
      const t = (ms.start + vf(g)) / FPS;
      if (!near(t, 'crowd_roar', (e) => e.side === g.team && e.match === mi)) { audioOk = false; miss.push(['roar', mi, t]); }
      if (!near(t + 0.15, 'crowd_groan', (e) => e.side !== g.team)) { audioOk = false; miss.push(['groan', mi, t]); }
    }
    for (const c of at.chances) if (!near((ms.start / FPS) + c.v, 'crowd_gasp')) { audioOk = false; miss.push(['gasp', mi]); }
    const end = m.events.find((e) => e.type === 'whistle' && e.kind === 'end');
    if (!near((ms.start + vf(end)) / FPS, 'crowd_applause')) { audioOk = false; miss.push(['applause', mi]); }
    if (!week.audio.some((e) => e.type === 'crowd_bed' && e.match === mi && Math.abs(e.t - ms.start / FPS) < 2e-3 && Math.abs(e.d - ms.len / FPS) < 2e-3)) { audioOk = false; miss.push(['bed', mi]); }
    for (const th of at.thumps) if (!near(ms.start / FPS + th.v, 'mill_thump')) { audioOk = false; miss.push(['thump', mi]); }
  });
  check('crowd reactions = the goal events (same video time, scoring side)', reactOk);
  check('crowd audio events at the right moments: roar (scoring side) + groan (other side) per goal, gasp per chance, applause at the final whistle, bed over every match, thump per bomb hit', audioOk, miss.slice(0, 5));
  const nChances = week.atmo.matches.reduce((a, x) => a + x.chances.length, 0), kinds = new Set(week.atmo.matches.flatMap((x) => x.chances.map((c) => c.kind)));
  check(`big chances found (${nChances}, kinds ${[...kinds].join('/')}) and none within 3 s of a goal`, nChances >= 10 && week.atmo.matches.every((a) => a.chances.every((c) => a.react.every((r) => Math.abs(r.v - c.v) >= 3))));
  check('rain on the night variant (and not on the sunny day), wind per match from the seed', night.atmo.rain === true && week.atmo.rain === false && new Set(week.atmo.matches.map((a) => a.wind.str)).size > 3);
  const reel = require('../sim/reels').buildReel(week, 2, require('../sim/league/publish').REEL_OPTS);
  check(`reel: no intro, no transition, still <= 60 s (${reel.seconds} s)`, !reel.segments.some((s) => s.type === 'lgKick' || s.type === 'lgTrans') && reel.seconds <= 60);
  const cer = finale.segments.find((s) => s.type === 'ceremony');
  check('finale ceremony timeline still valid (30 s, 3 angles)', cer && cer.len === 30 * FPS && cer.shots.map((s) => s.angle).join() === 'wide,lift,orbit');

  console.log('== crowd audio (synthesis, short window, no video)');
  {
    fs.mkdirSync(path.join(ROOT, 'build', 'p10'), { recursive: true });
    const sf = path.join(ROOT, 'build', 'p10', 'night_show.json'), rf = path.join(ROOT, 'build', 'p10', 'crowd_report_test.json');
    fs.writeFileSync(sf, JSON.stringify(night));
    const ms = night.segments.filter((s) => s.type === 'match');
    const t0 = ms[0].start / FPS - 3, t1 = (ms[1].start + ms[1].len) / FPS;
    execFileSync('python', [path.join(ROOT, 'audio', 'crowd.py'), sf, rf, String(t0), String(t1)], { stdio: 'pipe', timeout: 300000 });
    const r = JSON.parse(fs.readFileSync(rf, 'utf8'));
    const clear = r.onsets.filter((o) => o.after_dB > o.before_dB + 3).length;
    console.log(`   crowd bus: peak ${r.peak.toFixed(3)}, ${r.rms_dBFS.toFixed(1)} dBFS RMS, ${r.lufs} LUFS (before the final mix normalisation); onsets ${clear}/${r.onsets.length}`);
    check('crowd bus does not clip (peak < 0.9) and stays a bed under the effects (integrated <= -20 LUFS before normalisation)', r.peak < 0.9 && r.lufs <= -20, r);
    check('roars/gasps/thumps/applause audible at their timestamps (>= 80 % of onsets rise >= 3 dB; the rest overlap an earlier roar)', r.onsets.length >= 8 && clear >= 0.8 * r.onsets.length, r.onsets.filter((o) => !(o.after_dB > o.before_dB + 3)));
  }

  console.log('== renderer (headless single frames)');
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const ms = (sh, mi) => sh.segments.find((s) => s.type === 'match' && s.match === mi);
  {
    const { page, errors } = await PX.openPage(browser, week, [960, 540]);
    const texts = await page.evaluate(([a, b]) => { const seen = []; const f = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (s, ...r) { seen.push(String(s)); return f.call(this, s, ...r); }; window.renderFrame(a); window.renderFrame(b); CanvasRenderingContext2D.prototype.fillText = f; return seen; }, [ms(week, 1).start + 50, ms(week, 2).start + 50]);
    const info = await page.evaluate(() => window.atmoInfo());
    const m2 = week.matches[2], kits = new Set([m2.kits.A.primary, m2.kits.B.primary]);
    check('no advertising boards: no "PREMIER LEAGUE" board text drawn in the stadium, plain touchline wall layer', !texts.includes(week.league.display_name) && info.layers.includes('touchline_wall'), { layers: info.layers });
    check('stands in the two teams\' colours: flags of the left half in the home kit, right half in the away kit; banners hung; reaction groups built', info.flags2.every(([c, sd]) => c === (sd === 'A' ? m2.kits.A.primary : m2.kits.B.primary)) && info.flags2.some((f) => f[1] === 'A') && info.flags2.some((f) => f[1] === 'B') && kits.size === 2 && info.banners === 8 && info.groups && Object.keys(info.groups).length === 2, info);
    const r0 = info.standBuilds;
    for (let k = 0; k < 30; k++) await page.evaluate((g) => window.renderFrame(g), ms(week, 2).start + 60 + k * 41);
    const r1 = (await page.evaluate(() => window.atmoInfo())).standBuilds;
    check(`stands rebuilt only when the match changes (${r0} builds for 2 matches, none over 30 more frames of the same match)`, r0 === 2 && r1 === 2, { r0, r1 });
    const k1 = week.segments.find((s) => s.type === 'lgKick' && s.match === 2);
    const kk = await page.evaluate(([s, n]) => { const o = []; for (const f of [s, s + Math.floor(n * 0.45), s + n - 1]) { window.renderFrame(f); o.push(window.atmoInfo().lastKick); } return o; }, [k1.start, k1.len]);
    check('intro: strongly blurred and zoomed above the pitch at the start, scoreboard off-screen; sharp, at rest and scoreboard in place at kick-off', kk[0].blur > 12 && kk[0].zoom > 1.4 && kk[0].slide === 0 && kk[2].blur < 0.5 && kk[2].zoom < 1.001 && kk[2].slide === 1, kk);
    check('no page errors (week)', errors.length === 0, errors.slice(0, 3));
    await page.close();
  }
  { // determinism: same frame twice, and a fresh page vs a page that drew other matches first (reaction frame after a goal)
    const mi = week.atmo.matches.findIndex((a) => a.react.length), r = week.atmo.matches[mi].react[0];
    const f = ms(week, mi).start + Math.round((r.v + 1.0) * FPS), sm = night.segments.find((s) => s.type === 'match' && s.match === 3);
    const a = await PX.openPage(browser, week, [960, 540]); await PX.frameHashes(a.page, [ms(week, 5).start + 99, ms(week, 7).start + 300]); const ha = await PX.frameHashes(a.page, [f, f]); await a.page.close();
    const b = await PX.openPage(browser, week, [960, 540]); const hb = await PX.frameHashes(b.page, [f]); await b.page.close();
    const n1 = await PX.openPage(browser, night, [960, 540]); const hn = await PX.frameHashes(n1.page, [sm.start + 340, sm.start + 341, sm.start + 340]); await n1.page.close();
    check('animated details deterministic: same frame -> same pixels; fresh page = used page (goal reaction frame); night rain/smoke frames repeatable and moving', ha[0] === ha[1] && ha[0] === hb[0] && hn[0] === hn[2] && hn[0] !== hn[1], { ha, hb, hn });
  }
  { // flags off: everything still draws; split stands / reactions really off
    const sh = Object.assign({}, night, { atmoCfg: Object.assign({}, night.atmoCfg, { split_stands: false, crowd_reactions: false, stand_smoke: false, earth_platforms: false, rounded_goal: false, wind: false, lens_droplets: false }) });
    const { page, errors } = await PX.openPage(browser, sh, [640, 360]);
    for (const s of sh.segments.filter((x) => ['lgTrans', 'lgKick', 'match', 'replay'].includes(x.type)).slice(0, 8)) await page.evaluate((g) => window.renderFrame(g), s.start + Math.floor(s.len / 2));
    const i = await page.evaluate(() => ({ a: window.atmoInfo(), s: window.artInfo().stats }));
    check('flags off (split_stands, reactions, smoke, earth, rounded goal, wind, droplets): no stand rebuild, no groups, stone platforms, no errors', i.a.standBuilds === 0 && !i.a.groups && i.s.earth === false && errors.length === 0, { i, errors });
    await page.close();
  }
  { // finale + every segment type on the night map
    const errs = [];
    for (const sh of [finale, night]) {
      const { page, errors } = await PX.openPage(browser, sh, [640, 360]);
      for (const ty of [...new Set(sh.segments.map((s) => s.type))]) for (const s of sh.segments.filter((x) => x.type === ty).slice(0, 2)) for (const u of [0.1, 0.5, 0.95]) await page.evaluate((g) => window.renderFrame(g), s.start + Math.floor(s.len * u));
      errs.push(...errors); await page.close();
    }
    check('all segment types of the finale (ceremony with the new trophy) and the night matchweek draw without errors', errs.length === 0, errs.slice(0, 3));
  }
  await browser.close();

  console.log('== per-frame time (still-frame benchmark, 1920x1080, no video)');
  const bb = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'p10_bench_before.json'), 'utf8')); // P9 renderer, same machine, start of P10
  const now = await BENCH.bench('p10_test');
  console.log(`   before (P9 renderer): mean ${bb.mean.toFixed(1)} ms, p95 ${bb.p95.toFixed(1)}, max ${bb.max.toFixed(1)} | now (P10): mean ${now.mean.toFixed(1)} ms, p95 ${now.p95.toFixed(1)}, max ${now.max.toFixed(1)}`);
  check('render time per frame stays near P9 (mean <= 1.25 x the P9 mean measured at the start of P10) and no frame over 70 ms', now.mean <= 1.25 * bb.mean && now.max <= 70 && now.errors.length === 0, now);

  console.log(`\nP10 tests: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
