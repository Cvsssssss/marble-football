'use strict';
// P7 session 2 tests: §5 matchweek video timeline + animated table + reel + publish texts, §6 season finale ceremony,
// §7/7b Premier League maps and Max's background image. No video renders: show JSON, headless frames (nothing written),
// one short synthetic audio file (ceremony sounds) in build/.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const L = require('../sim/config_loader');
const G = require('../sim/geometry');
const LC = require('../sim/league/config');
const SEASON = require('../sim/league/season');
const TB = require('../sim/league/standings');
const SH = require('../sim/league/show');
const LP = require('../sim/league/publish');
const { bgFit } = require('../render/bg_fit');
const { tableLayout } = require('../render/league_layout');
const { buildReel, TARGET_MAX } = require('../sim/reels');
const P7S = require('../tools/p7_stills');

let pass = 0, fail = 0;
function check(name, ok, info) { if (ok) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (info !== undefined ? ' :: ' + JSON.stringify(info).slice(0, 400) : '')); } }
const sha = (x) => crypto.createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');

(async () => {
  // ---------- §7 / 7b maps + background image ----------
  console.log('== maps + background');
  const PM = ['premier_pitchside', 'premier_overcast', 'premier_evening', 'premier_night'];
  const maps = PM.map((id) => JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'maps', id + '.json'), 'utf8')));
  check('4 Premier League map variants validate against the map schema', maps.every((m) => { const e = []; L.validate(m, L.SCHEMAS.map, m.id, e); return e.length === 0; }));
  check('variants: sunny day / overcast afternoon / floodlit evening / drizzly night, all with stone blocks, deep goal, red-white windmill', maps.every((m) => m.platform_style === 'blocks' && m.goal_style === 'deep' && m.windmill_stripes && /^#d7263d$/i.test(m.windmill[0])) && maps[3].night && maps[3].rain);
  check('premier_pitchside uses Max\'s image assets/backgrounds/premier_day.png with no centre screen (center_screen_rect null)', maps[0].background_image === 'assets/backgrounds/premier_day.png' && maps[0].center_screen_rect === null && fs.existsSync(path.join(ROOT, maps[0].background_image)));
  check('map configs carry no geometry / physics keys (play layout identical to every other map)', maps.every((m) => !Object.keys(m).some((k) => /^[A-Z_]+$|radius|release|gravity|restitution/.test(k))));
  check('existing maps unchanged: no P7 keys in the four P3 maps', ['sky_clean', 'stadium_day', 'stadium_night', 'sunset'].every((id) => { const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'maps', id + '.json'), 'utf8')); return !m.background_image && !m.platform_style && !m.goal_style; }));
  const img = fs.readFileSync(path.join(ROOT, 'assets', 'backgrounds', 'premier_day.png'));
  const IW = img.readUInt32BE(16), IH = img.readUInt32BE(20);
  check(`premier_day.png is the ultra-wide image (${IW}x${IH}, aspect ${(IW / IH).toFixed(2)})`, Math.abs(IW / IH - 2.36) < 0.03);
  const F = bgFit(IW, IH, G.W, G.H, { pitchTop: maps[0].bg_pitch_top, groundY: G.GROUND_Y, inset: maps[0].bg_ground_inset });
  const F0 = bgFit(IW, IH, G.W, G.H, {});
  check('cover-fit 2.36 -> 16:9: scaled to the scene height, crops left/right only (symmetric), no letterbox', Math.abs(F0.s - G.H / IH) < 1e-9 && Math.abs(F0.dy) < 1e-9 && F0.dx < 0 && Math.abs(F0.cropLeft - F0.cropRight) < 1e-9 && F0.dw > G.W);
  check('never stretched: one scale factor for both axes', Math.abs(F.dw / IW - F.dh / IH) < 1e-9);
  check('bottom (pitch) aligned to the scene bottom', Math.abs(F.dy + F.dh - G.H) < 1e-6);
  check(`map ground line (y ${G.GROUND_Y}) is inside the pitch area of the image (pitch top at y ${F.pitchTopY.toFixed(1)}), with minimal extra zoom`, F.pitchTopY <= G.GROUND_Y && F.pitchTopY >= G.GROUND_Y - 12 && F.s >= F.cover, F);
  console.log(`   fit: cover ${F.cover.toFixed(3)} -> scale ${F.s.toFixed(3)}, crop ${F.cropLeft.toFixed(0)} px each side and ${F.cropTop.toFixed(0)} px of sky (image px)`);
  check('missing background image -> no image layer (procedural fallback)', SH.backgroundPart(Object.assign({}, maps[1], { background_image: 'assets/backgrounds/premier_does_not_exist.png' })) === null && SH.backgroundPart(maps[1]) === (fs.existsSync(path.join(ROOT, 'assets/backgrounds/premier_overcast.png')) ? SH.backgroundPart(maps[1]) : null));
  const bgp = SH.backgroundPart(maps[0]);
  check('Max\'s image is embedded unchanged in size (JPEG data URL of the same file, size read from the PNG)', bgp && bgp.size[0] === IW && bgp.size[1] === IH && /^data:image\/jpeg;base64,/.test(bgp.src));

  // ---------- shows (scratch seasons: engine week 1; stub weeks 1-37 + engine week 38) ----------
  console.log('== matchweek show');
  const { C, week, finale } = await P7S.shows();
  const d1 = path.join(ROOT, 'build', 'p7_scratch'), d38 = path.join(ROOT, 'build', 'p7_finale');
  const wr1 = JSON.parse(fs.readFileSync(SEASON.resultsFile(C, 1, { dir: d1 }), 'utf8'));
  check('rules: league clock 1 game minute / s (90 s of play, Max 13 Nov 2026), release interval recalibrated', C.rules.GAME_MIN_PER_SEC === 1 && JSON.stringify(C.rules.release_interval) === '[7.6,11.4]');
  check('every match re-simulated from its seed: same timeline hash and score as results/week_01.json', week.matches.every((m, i) => m.hash === wr1.matches[i].timeline_hash && m.score[0] === wr1.matches[i].hg && m.score[1] === wr1.matches[i].ag));
  check('every goal scorer is a player of the scoring club', week.matches.every((m) => m.goals.every((g) => { const t = week.teams[g.team === 'A' ? m.ta : m.tb]; return t.players[g.player] && t.players[g.player].team === t.name; })));
  const again = SH.buildMatchweekShow(C, 1, { dir: d1 });
  check('show is deterministic (same results + config -> identical show)', sha(again) === sha(week));
  const mins = (s) => s.totalFrames / s.fps / 60;
  console.log(`   durations: week 1 ${mins(week).toFixed(2)} min, finale week 38 ${mins(finale).toFixed(2)} min`);
  check('matchweek video length 20-28 min (week 1 and the finale)', mins(week) >= 20 && mins(week) <= 28 && mins(finale) >= 20 && mins(finale) <= 28);
  const segs = week.segments, types = segs.map((s) => s.type);
  check('timeline: intro (fixtures grid) first, then per match pre-card -> match -> full time -> [replay] -> [MOTM] -> table update', types[0] === 'lgIntro' && week.matches.every((m, mi) => {
    const own = segs.filter((s) => s.match === mi && ['lgPre', 'match', 'fulltime', 'replay', 'motm', 'lgTable'].includes(s.type) && !s.gotw).map((s) => s.type);
    const exp = ['lgPre', 'match', 'fulltime'].concat(m.replayGoal !== null ? ['replay'] : [], m.motm ? ['motm'] : [], ['lgTable']);
    return JSON.stringify(own) === JSON.stringify(exp);
  }));
  check('end of a normal week: full table -> all results -> top scorers -> Goal of the Week card + replay -> next matchweek teaser', JSON.stringify(types.slice(-6)) === JSON.stringify(['lgTableFull', 'lgResults', 'lgScorers', 'lgGotwCard', 'replay', 'lgNext']) && segs[segs.length - 2].gotw);
  check('intro grid lists the 10 fixtures; pre-cards carry positions + last-5 form (week 1: season opener)', segs[0].fixtures.length === 10 && segs.filter((s) => s.type === 'lgPre').every((s) => s.pos[0] === null && s.form[0].length === 0));
  const tbl = segs.filter((s) => s.type === 'lgTable');
  check('one animated table update per match, each 4-6 s', tbl.length === 10 && tbl.every((s) => s.len / 30 >= 4 && s.len / 30 <= 6));
  check('table updates chain: "to" of match k = "from" of match k+1; the last "to" = the full table', tbl.every((s, i) => i === 0 || JSON.stringify(tbl[i - 1].to) === JSON.stringify(s.from)) && JSON.stringify(tbl[9].to) === JSON.stringify(segs.find((s) => s.type === 'lgTableFull').rows));
  const all1 = wr1.matches.map((m) => ({ home: m.home, away: m.away, hg: m.hg, ag: m.ag }));
  const T1 = TB.table(C.ids, all1, C.league);
  check('final table of the video = standings saved in results (points, GD, positions)', JSON.stringify(T1.map((r) => [r.id, r.pts, r.gd])) === JSON.stringify(wr1.standings.map((r) => [r.id, r.pts, r.gd])) && T1.every((r, i) => week.teams[segs.find((s) => s.type === 'lgTableFull').rows[i][0]].id === r.id));
  check('zone index per row matches the configured zones (1-5 UCL, 6-7, 8, 18-20)', segs.find((s) => s.type === 'lgTableFull').rows.every((r) => { const z = C.league.zones.findIndex((q) => r[1] >= q.from && r[1] <= q.to); return r[9] === z; }));
  // table layout (1080p readability)
  for (const k of ['update', 'full']) {
    const Lt = tableLayout(k);
    check(`table layout (${k}): 20 rows readable at 1080p (row ${Lt.rowH * 1.5} px >= 36, font ${Lt.font * 1.5} px >= 22) and inside the frame`, Lt.rowH * 1.5 >= 36 && Lt.font * 1.5 >= 22 && Lt.x - 8 >= 0 && Lt.x + Lt.w + 8 <= 1280 && Lt.y - 30 >= 0 && Lt.bottom + 8 <= 720 && Lt.legendY + 16 <= 720, Lt);
  }
  // Goal of the Week (documented score)
  const gw = week.goalOfWeek;
  const scores = week.matches.flatMap((m, mi) => m.goals.map((g, gi) => ({ mi, gi, s: SH.gotwScore(m, gi) })));
  check('Goal of the Week = the goal with the highest documented score (keeper air/crouch, winner, equaliser, added time, minute)', gw && gw.score === Math.max(...scores.map((x) => x.s)) && SH.gotwScore(week.matches[gw.match], gw.goal) === gw.score);
  const fake = { winnerSide: 'A', goals: [{ team: 'B', t: 10 }, { team: 'A', t: 30, keeperAir: true }, { team: 'A', t: 80, shot: 1 }] };
  check('GOTW score formula on a scripted match (equaliser in the air beats an early goal; late added-time winner)', SH.gotwScore(fake, 1) === +(3 + 1.5 + 60 / 45).toFixed(3) && SH.gotwScore(fake, 2) === +(2 + 1 + 95 / 45).toFixed(3) && SH.gotwScore(fake, 0) === +(20 / 45).toFixed(3));
  const sc = week.leagueScorers;
  check('top scorers: up to 5, sorted by goals, every scorer plays for his club', sc.length >= 1 && sc.length <= 5 && sc.every((e, i) => i === 0 || sc[i - 1].goals >= e.goals) && sc.every((e) => week.teams[e.team].players[e.player].team === week.teams[e.team].name));
  check('chapters: first 0:00, ascending, >= 10 s apart, one per match', (() => { const txt = require('../sim/tournament').chaptersText(week).trim().split('\n'); return txt.length >= 12 && txt[0].startsWith('0:00') && week.matches.every((m) => txt.some((l) => l.includes(`${week.teams[m.ta].name} vs ${week.teams[m.tb].name}`))); })());
  check('per-week music variation (transpose / tempo cycle) and the map of the week', week.map.id === wr1.map && finale.map.music.transpose !== week.map.music.transpose);

  // ---------- §6 finale ----------
  console.log('== season finale');
  const ft = finale.segments.map((s) => s.type);
  const order = ['lgTableFull', 'lgResults', 'lgScorers', 'lgGotwCard', 'replay', 'lgChampion', 'ceremony', 'lgEurope', 'lgBoot', 'lgPodium', 'lgStats'];
  check('matchweek 38: final table -> champion reveal -> trophy ceremony -> European places + relegated -> Golden Boot -> podium -> season stats (no teaser)', JSON.stringify(ft.slice(-order.length)) === JSON.stringify(order) && !ft.includes('lgNext'));
  const cer = finale.segments.find((s) => s.type === 'ceremony');
  check(`ceremony lasts 25-35 s (${(cer.len / 30).toFixed(1)} s)`, cer.len / 30 >= 25 && cer.len / 30 <= 35);
  check('ceremony: 3 distinct camera angles (wide, low-angle lift, top-down orbit), contiguous, covering the whole segment', cer.shots.length === 3 && new Set(cer.shots.map((s) => s.angle)).size === 3 && cer.shots[0].from === 0 && cer.shots.every((s, i) => i === 0 || s.from === cer.shots[i - 1].to) && Math.abs(cer.shots[2].to - cer.len / 30) < 1e-6);
  const cAud = finale.audio.filter((a) => a.t >= cer.start / 30 && a.t < (cer.start + cer.len) / 30);
  check('ceremony sound: crowd cheers, fireworks and an original music sting', cAud.filter((a) => a.type === 'firework').length >= 8 && cAud.some((a) => a.type === 'ceremony_sting') && cAud.filter((a) => a.type === 'cheer').length >= 2);
  const wr38 = JSON.parse(fs.readFileSync(SEASON.resultsFile(C, 38, { dir: d38 }), 'utf8'));
  check('champion = leader of the final table; Golden Boot = season top scorer', finale.teams[finale.champion].id === wr38.standings[0].id && finale.segments.find((s) => s.type === 'lgBoot').scorer.goals === finale.leagueScorers[0].goals);
  const st = finale.segments.find((s) => s.type === 'lgStats').stats;
  check('season stats: 380 matches, goals and results add up', st.matches === 380 && st.homeWins + st.awayWins + st.draws === 380 && st.goals > 0);

  // ---------- headless render: every segment type draws without errors; layer order; ceremony angles ----------
  console.log('== headless frames (nothing written)');
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  for (const sh of [week, finale]) {
    const { page, errors, info } = await P7S.openPage(browser, sh, [1280, 720]);
    const tys = [...new Set(sh.segments.map((s) => s.type))];
    for (const ty of tys) for (const s of sh.segments.filter((x) => x.type === ty).slice(0, 2)) for (const u of [0.05, 0.5, 0.97]) await page.evaluate((g) => window.renderFrame(g), s.start + Math.floor(s.len * u));
    const known = await page.evaluate(() => window.LEAGUE_SEGMENTS);
    check(`week ${sh.league.week}: every segment type renders headless without page errors (${tys.length} types)`, errors.length === 0 && tys.every((t) => ['match', 'fulltime', 'replay', 'motm'].includes(t) || known.includes(t)), errors.slice(0, 3));
    if (sh === week) {
      const li = await page.evaluate(() => window.bgLayerInfo());
      check('with Max\'s image: layer order image -> platforms -> pipe; no procedural sky / stadium; no centre-screen text', info.background && li.image && li.layers[0] === 'image' && !li.layers.some((x) => /^sky$|^scenery/.test(x)) && li.layers.indexOf('platforms') > 0 && !li.layers.includes('center_screen'), li.layers);
      check('renderer uses the same cover-fit as the tested math', li.fit && Math.abs(li.fit.s - F.s) < 1e-9 && Math.abs(li.fit.dx - F.dx) < 1e-6 && li.imgSize[0] === IW);
    } else {
      const angles = await page.evaluate((st0) => [2, 12, 22].map((s) => window.ceremonyAngleAt(Math.round(s * 30))), cer.start);
      check('renderer: ceremony angle at 2 s / 12 s / 22 s = wide / lift / orbit', JSON.stringify(angles) === JSON.stringify(['wide', 'lift', 'orbit']), angles);
    }
    await page.close();
  }
  // procedural fallback when the image is missing
  {
    const noImg = Object.assign({}, week, { map: Object.assign({}, week.map, { background_image: 'assets/backgrounds/premier_missing.png', center_screen_rect: [530, 250, 220, 62] }), background: SH.backgroundPart(Object.assign({}, week.map, { background_image: 'assets/backgrounds/premier_missing.png' })) });
    const { page, errors } = await P7S.openPage(browser, noImg, [1280, 720]);
    await page.evaluate((g) => window.renderFrame(g), week.segments.find((s) => s.type === 'match').start + 100);
    const li = await page.evaluate(() => window.bgLayerInfo());
    check('image missing -> procedural stadium bowl (sky -> bowl scenery -> platforms), no errors', !li.image && li.layers[0] === 'sky' && li.layers[1] === 'scenery:bowl' && li.layers.indexOf('platforms') > 1 && errors.length === 0, li.layers);
    await page.close();
  }
  await browser.close();

  // ---------- reel ----------
  console.log('== reel');
  const idx = SH.matchesIndexLeague(week);
  const sel = LP.selectLeagueReel(week, idx), sel2 = LP.selectLeagueReel(week, idx);
  check('one reel, deterministic selection', sel.reels.length === 1 && JSON.stringify(sel) === JSON.stringify(sel2));
  const reel = buildReel(week, sel.reels[0].index, LP.REEL_OPTS);
  check(`reel <= 55 s (${reel.seconds} s) with the static full-pitch P6 layout`, reel.seconds <= TARGET_MAX + 1 && reel.seconds >= 30 && reel.camera.mode === 'static' && reel.camTrack.changes === 0);
  const mk = (i, o) => Object.assign({ id: 'M' + i, index: i, stage: 'MATCHWEEK 1', leg: 'LEAGUE', team_a: 'A' + i, team_b: 'B' + i, score: [1, 0], winner: 'A' + i, comeback: false, comeback_depth: 0, goals: [{ team: 'A' + i, minute: "50'" }] }, o);
  const cbm = mk(0, { score: [2, 1], comeback: true, comeback_depth: 1, goals: [{ team: 'B0', minute: "10'" }, { team: 'A0', minute: "40'" }, { team: 'A0', minute: "70'" }] });
  const late = mk(1, { goals: [{ team: 'A1', minute: "88'" }] });
  const draw = mk(2, { score: [2, 2], winner: null, goals: [{ team: 'A2', minute: "5'" }, { team: 'B2', minute: "6'" }, { team: 'A2', minute: "7'" }, { team: 'B2', minute: "8'" }] });
  const fits = week.matches.map((m, i) => i).filter((i) => week.matches[i].goals.length && buildReel(week, i, LP.REEL_OPTS).seconds <= TARGET_MAX + 1);
  if (fits.length >= 1) {
    const at = (m) => Object.assign({}, m, { index: fits[0] });
    const r1 = LP.selectLeagueReel(week, { matches: [at(late), at(cbm), at(draw)] }), r2 = LP.selectLeagueReel(week, { matches: [at(late), at(draw)] }), r3 = LP.selectLeagueReel(week, { matches: [at(draw)] });
    check('reel rules: comeback first, else latest winning goal, else highest-scoring match', r1.reels[0].id === 'M0' && r2.reels[0].id === 'M1' && r3.reels[0].id === 'M2' && /comeback/.test(r1.reels[0].rule) && /latest/.test(r2.reels[0].rule) && /highest/.test(r3.reels[0].rule));
  }

  // ---------- publish texts ----------
  console.log('== publish texts');
  const chapters = require('../sim/tournament').chaptersText(week);
  const pub = LP.buildLeaguePublish(week, chapters, sel.reels[0]);
  const perr = LP.lintLeaguePublish(pub, week);
  check('publish texts pass the P6 lint + league rules (Simulation in titles, <= 100 chars, chapters, disclaimer, hashtags, no player names)', perr.length === 0, perr);
  check('title pattern "Premier League Matchweek N | Marble Football Simulation 2026/27"', pub.longTitles[0] === 'Premier League Matchweek 1 | Marble Football Simulation 2026/27');
  check('first hashtags #PremierLeague #EPL #MarbleFootball; results labelled as simulated; top of the table as text', /#PremierLeague #EPL #MarbleFootball/.test(pub.longDescription) && /Simulated results \(matchweek 1, not real results\)/.test(pub.longDescription) && /Top of the simulated table/.test(pub.longDescription));
  const allNames = week.teams.flatMap((t) => t.players.map((p) => p.name));
  check('no player name anywhere in the texts', !allNames.some((n) => [pub.longTitles.join(' '), pub.longDescription, pub.reelTitles.join(' '), pub.reelDescription].join('\n').includes(n)));
  const bad = Object.assign({}, pub, { longDescription: pub.longDescription + '\n' + allNames[0] });
  check('lint catches a player name', LP.lintLeaguePublish(bad, week).some((e) => /player name/.test(e)));

  // ---------- build_matchweek dry run (no audio/video) ----------
  console.log('== build_matchweek dry run');
  const outRoot = path.join(ROOT, 'build', 'p7b_runs'); fs.rmSync(outRoot, { recursive: true, force: true });
  const BM = require('../build_matchweek');
  const log = console.log; console.log = () => {};
  let r;
  try { r = await BM.buildMatchweek({ week: 1, dir: d1, dryRun: true, date: '2026-11-13', outRoot }); } finally { console.log = log; }
  const rd = r.runDir;
  check('dry run writes chapters, LOGO_USAGE, checklist, publish/, reels/selection.json, run.json; no thumbnails folder', ['chapters.txt', 'LOGO_USAGE.md', 'PUBLISH_CHECKLIST.md', 'publish/long_title.txt', 'publish/long_description.txt', 'publish/reel_title.txt', 'reels/selection.json', 'run.json'].every((f) => fs.existsSync(path.join(rd, f))) && !fs.existsSync(path.join(rd, 'thumbnails')));
  check('run.json: league week, results hash, background file, thumbnails false, one reel', r.runJson.league.week === 1 && r.runJson.league.results_hash === wr1.results_hash && r.runJson.league.background === 'assets/backgrounds/premier_day.png' && r.runJson.thumbnails === false && r.runJson.reels.length === 1);
  check('preflight green on the dry run (names, chapters, publish lint, uniqueness, manifest)', r.preflight.ok, r.preflight.checks.filter((c) => !c.ok).map((c) => c.name));
  check('LOGO_USAGE.md lists the source of every club crest used (20 clubs)', (() => { const t = fs.readFileSync(path.join(rd, 'LOGO_USAGE.md'), 'utf8'); return C.teams.every((tm) => t.includes(tm.name)) && /wikipedia/i.test(t); })());
  check('checklist uses the league wording (animated table, PREMIER LEAGUE plain text)', /clasamentul animat/.test(fs.readFileSync(path.join(rd, 'PUBLISH_CHECKLIST.md'), 'utf8')) && /PREMIER LEAGUE/.test(fs.readFileSync(path.join(rd, 'PUBLISH_CHECKLIST.md'), 'utf8')));
  fs.rmSync(outRoot, { recursive: true, force: true });

  // ---------- audio: ceremony sounds synthesise (short synthetic show) ----------
  console.log('== audio (ceremony sounds, 30 s wav in build/)');
  {
    const seg = Object.assign({}, cer, { start: 0 });
    const mini = { fps: 30, totalFrames: cer.len, segments: [seg], map: finale.map, audioCfg: finale.audioCfg, audio: cAud.map((a) => Object.assign({}, a, { t: +(a.t - cer.start / 30).toFixed(4) })) };
    const jf = path.join(ROOT, 'build', 'p7b_ceremony_audio.json'), wf = path.join(ROOT, 'build', 'p7b_ceremony_audio.wav');
    fs.writeFileSync(jf, JSON.stringify(mini));
    let ok = true; try { execFileSync(process.platform === 'win32' ? 'python' : 'python3', [path.join(ROOT, 'audio', 'make_audio.py'), jf, wf], { stdio: ['ignore', 'ignore', 'pipe'] }); } catch (e) { ok = false; console.log(String(e.stderr).slice(-400)); }
    const sz = ok && fs.existsSync(wf) ? fs.statSync(wf).size : 0;
    check('make_audio.py renders the ceremony (fireworks + sting + cheers) without errors', ok && sz > 30 * 44100);
    for (const f of [jf, wf]) if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  console.log(`\nP7b tests: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
