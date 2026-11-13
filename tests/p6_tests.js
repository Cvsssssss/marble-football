'use strict';
// P6 tests: natural golden ball (200-tournament histogram), player data validator + scorer check, ONE full-pitch reel
// (static camera, safe areas), publish texts, nations intro label. No video is rendered (single PNG stills only).
// Usage: node tests/p6_tests.js   -> build/p6_test_results.json, stills in output/screenshots_p6/
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const L = require('../sim/config_loader');
const T = require('../sim/tournament');
const PL = require('../sim/players');
const SEL = require('../sim/selectReels');
const { buildReel, REEL_SCENE } = require('../sim/reels');
const PUB = require('../sim/publish');
const COMP = (id) => path.join(ROOT, 'config', 'competitions', id + '.json');
const SHOTS = path.join(ROOT, 'output', 'screenshots_p6');

const results = []; let failed = 0;
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  if (!ok) failed++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail).slice(0, 400) : ''));
}
const throws = (f) => { try { f(); return null; } catch (e) { return e.message; } };

(async () => {
  // ---------- 1. golden ball ----------
  console.log('== 1. golden ball is natural');
  {
    const src = fs.readFileSync(path.join(ROOT, 'sim', 'tournament.js'), 'utf8');
    const gateBody = src.slice(src.indexOf('function buildTournament'), src.indexOf('// ---------- bracket data per step'));
    // preference lines: the niceGoals definition and every p1 / p2 / final prefs list handed to the gate
    const prefLines = gateBody.split(/\r?\n/).filter((l) => /let p1 =|let p2 =|p1 = |p2 = |run\(\+\+key, c, \[|const niceGoals =/.test(l));
    const leaks = prefLines.filter((l) => /goldenStart|goldenWinner/.test(l) || /\.golden\b/.test(l.replace(/!x\.golden/g, '')) || /\.shot\b/.test(l.replace(/!x\.shot/g, '')));
    check('seed gate: no preference reads golden-ball flags or added-time goals (wantGolden / goldenStart / g.shot in prefs gone)',
      !/wantGolden/.test(gateBody) && prefLines.length >= 4 && leaks.length === 0, { prefLines: prefLines.length, leaks });
    // 200 tournaments (timeline simulator only). Cached by a key of the simulation code + configs, recomputed when they change.
    const key = crypto.createHash('sha256');
    for (const f of ['sim/engine.js', 'sim/tournament.js', 'sim/config.js', 'sim/config_loader.js', 'sim/bracket.js', 'sim/good_hit.js', 'sim/pump.js', 'config/rules/base.json', 'tools/golden_histogram.js']) key.update(fs.readFileSync(path.join(ROOT, f)));
    for (const c of ['ucl_2026_top16', 'uel_top16', 'nations_world_16', 'nations_euro_16']) key.update(fs.readFileSync(COMP(c)));
    const k = key.digest('hex').slice(0, 16);
    const hf = path.join(ROOT, 'build', 'p6_golden_hist.json');
    let H = fs.existsSync(hf) ? JSON.parse(fs.readFileSync(hf, 'utf8')) : null;
    if (!H || H.key !== k) {
      console.log('   running 200 tournaments (about 6 min with 10 workers)...');
      execFileSync(process.execPath, [path.join(ROOT, 'tools', 'golden_histogram.js'), '200', '10', hf], { stdio: 'inherit' });
      H = JSON.parse(fs.readFileSync(hf, 'utf8')); H.key = k; fs.writeFileSync(hf, JSON.stringify(H, null, 1));
    }
    console.log(`   golden balls per tournament: ${JSON.stringify(H.hist)} mean ${H.mean} (N=${H.N})`);
    check('200 tournaments: histogram of golden-ball matches includes 0 and values >= 2', H.N >= 200 && H.hist['0'] > 0 && Object.keys(H.hist).some((x) => +x >= 2 && H.hist[x] > 0), { hist: H.hist, mean: H.mean });
    check('200 tournaments: every one has >= 1 comeback in R16/QF (reel gate) and length inside 25-33 min (no window change needed)', H.noComeback === 0 && H.minutes.min >= 25 && H.minutes.max <= 33, { noComeback: H.noComeback, minutes: H.minutes });
    check('200 tournaments: every goal scorer is a player of the scoring team', H.badScorer === 0, { badScorer: H.badScorer });
  }

  // ---------- 2. players ----------
  console.log('== 2. players');
  {
    const all = PL.validateAll();
    const errs = Object.values(all).flatMap((v) => v.errors);
    check('player validator: all competitions pass (3 per team, team field, nations nationality == nation, no duplicates in a competition, retrieved <= 120 days)', errs.length === 0, errs.slice(0, 5));
    const unv = Object.values(all).flatMap((v) => v.unverified.map((u) => `${u.team}: ${u.name}`));
    console.log(`   unverified / to check: ${[...new Set(unv)].length}`);
    // negative cases
    const base = L.loadCompetition(COMP('nations_world_16'), { skipPlayerCheck: true }).teams;
    const clone = () => JSON.parse(JSON.stringify(base));
    let t = clone(); t[0].players[0].nationality = 'Uruguay';
    check('validator rejects a national-team player of another nationality', PL.validateTeams(t).errors.some((e) => /nationality/.test(e)));
    t = clone(); t[1].players[0].name = t[0].players[0].name;
    check('validator rejects the same player in two teams of one competition', PL.validateTeams(t).errors.some((e) => /also listed/.test(e)));
    t = clone(); t[0].players[1].retrieved = '2026-05-01';
    check('validator rejects data older than 120 days', PL.validateTeams(t, { today: '2026-11-13' }).errors.some((e) => /older than 120/.test(e)));
    t = clone(); t[2].players.pop();
    check('validator rejects a team without exactly 3 players', PL.validateTeams(t).errors.some((e) => /exactly 3/.test(e)));
    t = clone(); t[3].players[0].team = 'Somewhere FC';
    check('validator rejects a player whose team is not the file team', PL.validateTeams(t).errors.some((e) => /team is/.test(e)));
    const col = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'teams', 'nt_colombia.json'), 'utf8'));
    check('Colombia: no "L. Suárez" any more (Max\'s report); 3 players of the November 2026 call-up, nationality Colombia', !col.players.some((p) => /Suárez/.test(p.name)) && col.players.every((p) => p.nationality === 'Colombia'), col.players.map((p) => p.name));
    const rm = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'teams', 'real_madrid.json'), 'utf8')).players.map((p) => p.name);
    const bar = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'teams', 'barcelona.json'), 'utf8')).players.map((p) => p.name);
    check("Max's hints: Real Madrid Mbappé + Vinícius + Diomande; Barcelona Yamal + Raphinha + a third attacker", rm.join() === 'K. Mbappé,Vinícius Jr.,Y. Diomande' && bar[0] === 'L. Yamal' && bar[1] === 'Raphinha', { rm, bar });
    const review = fs.readFileSync(path.join(ROOT, 'config', 'players_review.md'), 'utf8');
    const allPlayers = Object.keys(all).flatMap((id) => L.loadCompetition(COMP(id), { skipPlayerCheck: true }).teams.flatMap((x) => x.players.map((p) => p.name)));
    check('config/players_review.md lists every player and has the "De verificat" column', allPlayers.every((n) => review.includes(n)) && /De verificat/.test(review), { players: allPlayers.length });
    const stale = ['K. Viveros', 'G. Simeone', 'I. Perišić', 'A. Budimir', 'A. Yarmolenko', 'D. Maldini', 'T. Weah', 'V. Júnior'];
    const gr = require('child_process').spawnSync('git', ['grep', '-l', '-F', ...stale.flatMap((s) => ['-e', s]), '--', '.', ':!reports', ':!progress', ':!phases', ':!tests/p6_tests.js', ':!tools/p6_players.js'], { cwd: ROOT, encoding: 'utf8' });
    const hits = (gr.stdout || '').trim(); // exit 1 = no match
    check('no stale player names from the old files left in the project (git grep)', hits === '', hits);
  }

  // ---------- 3. reel ----------
  console.log('== 3. one full-pitch reel');
  const showF = path.join(ROOT, 'build', 'p6_show.json');
  const { show, conf } = T.buildAll(COMP('ucl_2026_top16'), showF, {});
  {
    const tour = { matches: show.matches };
    check('scorer check on the generated tournament passes (and would throw on a wrong scorer)', PL.assertScorers(tour, conf.teams) === true &&
      !!throws(() => PL.assertScorers({ matches: [{ ta: 0, tb: 1, goals: [{ team: 'A', player: 7 }] }] }, conf.teams)));
    const idx0 = T.matchesIndex(show);
    // same candidate rule as build_reels.js: only matches whose reel fits <= 60 s
    const idx = Object.assign({}, idx0, { matches: idx0.matches.filter((m) => !m.goals.length || buildReel(show, m.index).seconds <= require('../sim/reels').TARGET_MAX + 1) });
    const sel = SEL.selectReel(idx);
    const sel2 = SEL.selectReel(JSON.parse(JSON.stringify(idx)));
    check('selection: exactly one reel, from round of 16 / quarter-finals, deterministic', sel.reels.length === 1 && /^(ROUND OF 16|QUARTER-FINAL)/.test(sel.reels[0].stage) && JSON.stringify(sel) === JSON.stringify(sel2), sel.reels[0] && sel.reels[0].why);
    const cbs = idx.matches.filter((m) => /^(ROUND OF 16|QUARTER-FINAL)/.test(m.stage) && m.comeback);
    const best = Math.max(...cbs.map(SEL.dramaScore));
    check('selection: the chosen comeback has the highest drama score (3 x deficit + winning minute / 30 + 0.25 x goals + 1 if 90+)', sel.reels[0].comeback && sel.reels[0].drama_score === best, { chosen: sel.reels[0].drama_score, best });
    const noCb = JSON.parse(JSON.stringify(idx)); noCb.matches.forEach((m) => { m.comeback = false; });
    const fb = SEL.selectReel(noCb);
    const lateMax = Math.max(...noCb.matches.filter((m) => /^(ROUND OF 16|QUARTER-FINAL)/.test(m.stage) && m.winner && m.goals.length).map(SEL.decisiveMinute));
    check('selection fallback without comebacks: the match with the latest winning goal, flagged as fallback', fb.fallback && fb.reels.length === 1 && SEL.decisiveMinute(noCb.matches.find((m) => m.index === fb.reels[0].index)) === lateMax);
    const reel = buildReel(show, sel.reels[0].index);
    check('reel: <= 60 s, static camera (one constant scene rectangle for every frame, no pan/zoom)', reel.seconds <= 60 && reel.camera.mode === 'static' && reel.camTrack.changes === 0 && !reel.segments.some((s) => s.camPath || s.cam !== undefined), { seconds: reel.seconds });
    check('reel: scene band = full 16:9 width (720 x 405 design = 1080 x 607.5 px), inside the 720x1280 canvas', REEL_SCENE.x === 0 && REEL_SCENE.w === 720 && Math.abs(REEL_SCENE.w / REEL_SCENE.h - 16 / 9) < 0.01 && REEL_SCENE.y >= 0 && REEL_SCENE.y + REEL_SCENE.h <= 1280);
    // browser: sample frames of every segment, check the drawn scene rectangle and the text boxes
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto('file:///' + path.join(ROOT, 'render', 'index.html').replace(/\\/g, '/'));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate((j) => window.initRenderer(JSON.parse(j)), JSON.stringify(Object.assign({}, show, { outSize: [1080, 1920] })));
    await page.evaluate((j) => window.initReel(JSON.parse(j)), JSON.stringify(reel));
    const ks = [];
    for (const s of reel.segments) for (const f of [0.1, 0.5, 0.9]) ks.push(s.start + Math.floor(s.len * f));
    const ms = reel.segments.find((s) => s.type === 'match');
    const dg = show.matches[reel.matchIndex].goals[reel.decisive.goal];
    const goalK = ms.start + ms.plan.findIndex((p) => p.src / 30 >= dg.t + 0.4);
    ks.push(goalK);
    const rects = [], badBoxes = [];
    let layout;
    for (const k of ks) {
      const r = await page.evaluate((x) => { window.renderReelFrame(x); return { rect: window.__reelSceneRect, boxes: window.REEL_BOXES, L: window.REEL_LAYOUT }; }, k);
      rects.push(JSON.stringify(r.rect)); layout = r.L;
      for (const b of r.boxes) if (b.x < 0 || b.y < r.L.SAFE.y0 || b.x + b.w > r.L.SAFE.x1 + 0.5 || b.y + b.h > r.L.SAFE.y1 + 0.5) badBoxes.push(`${k}:${b.name}`);
    }
    const rr = JSON.parse(rects[0]);
    check('reel frames: the scene rectangle is identical in every sampled frame (all segments) and fully inside the 1080x1920 canvas', new Set(rects).size === 1 && rr.x >= 0 && rr.y >= 0 && rr.x + rr.w <= 1080 && rr.y + rr.h <= 1920 && rr.w === 1080, { rect: rr, frames: ks.length });
    check('reel frames: every text box inside the safe area (not in the bottom 25 % nor the right 12 %)', badBoxes.length === 0 && layout.SAFE.x1 <= 720 * 0.88 && layout.SAFE.y1 <= 1280 * 0.75, badBoxes.slice(0, 6));
    fs.mkdirSync(SHOTS, { recursive: true });
    const png = await page.evaluate((x) => { window.renderReelFrame(x); return document.getElementById('c').toDataURL('image/png'); }, goalK);
    fs.writeFileSync(path.join(SHOTS, '01_reel_layout_goal.png'), Buffer.from(png.split(',')[1], 'base64'));
    // nations intro label
    const nShowF = path.join(ROOT, 'build', 'p6_show_nations.json');
    const nat = T.buildAll(COMP('nations_world_16'), nShowF, {}).show;
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate((j) => window.initRenderer(JSON.parse(j)), JSON.stringify(Object.assign({}, nat, { outSize: [1920, 1080] })));
    const intro = nat.segments.find((s) => s.type === 'intro');
    const ipng = await page.evaluate((g) => window.grabPNG(g), intro.start + intro.len - 5);
    fs.writeFileSync(path.join(SHOTS, '02_nations_intro_ranked.png'), Buffer.from(ipng.split(',')[1], 'base64'));
    await browser.close();
    const draw = fs.readFileSync(path.join(ROOT, 'render', 'draw.js'), 'utf8');
    check('nations intro: "Ranked #N" (FIFA rank) instead of "in the league phase"; clubs keep the league-phase wording; "nations" in the subtitle',
      /T\.national \? `Ranked #\$\{T\.rank \|\| i \+ 1\}`/.test(draw) && /in the league phase/.test(draw) && nat.teams[0].rank === 1 && nat.teams.every((x) => x.national && x.rank) && show.teams.every((x) => !x.rank));
    // build_reels: exactly one reel folder (stale folders of 3-reel runs are removed); no render
    const outDir = path.join(ROOT, 'build', 'p6_reels'); fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(outDir, 'reel2_R16-T3-L2'), { recursive: true });
    execFileSync(process.execPath, [path.join(ROOT, 'build_reels.js'), '--competition', COMP('ucl_2026_top16'), '--no-render', '--out-dir', outDir], { cwd: ROOT, stdio: 'ignore' });
    const dirs = fs.readdirSync(outDir).filter((d) => /^reel/.test(d));
    const bsel = JSON.parse(fs.readFileSync(path.join(outDir, 'selection.json'), 'utf8'));
    check('build_reels (no render): exactly one reel folder per run, stale folders removed, no .mp4', dirs.length === 1 && bsel.reels.length === 1 && dirs[0] === `reel_${bsel.reels[0].id}` && !fs.readdirSync(path.join(outDir, dirs[0])).some((f) => f.endsWith('.mp4')), dirs);
    const launcher = fs.readFileSync(path.join(ROOT, 'launcher.js'), 'utf8');
    check('START menu item 3 = the single reel of the last run', /Doar reel-ul \(unul\)/.test(launcher));

    // ---------- 4. publish texts ----------
    console.log('== 4. publish texts');
    const chapters = T.chaptersText(show);
    const players = show.teams.flatMap((t) => t.players.map((p) => p.name));
    const lopts = { playerNames: players, teamNames: show.teams.map((t) => t.name), champion: show.teams[show.champion].name, durationS: show.totalFrames / show.fps };
    const P1 = PUB.buildPublish(show, chapters, sel.reels[0], { seed: 'runA', mapName: 'Sunset' });
    const e1 = PUB.lintPublish(P1, lopts);
    check('publish: 3 long titles + 3 reel titles, all <= 100 chars with "Simulation"; description <= 5000; hashtags 8-12 / 3-5; chapters valid; disclaimer; no player names; no forbidden words; no champion in the long title', e1.length === 0 && P1.reelTitles.length === 3, e1);
    check('publish: chapters inserted from the chapters file', P1.longDescription.includes(chapters.trim()));
    const tags = P1.hashtags;
    check('publish: first three hashtags are the most important (#MarbleFootball #FootballSimulation #<competition>)', tags[0] === '#MarbleFootball' && tags[1] === '#FootballSimulation' && tags[2] === '#MarbleChampions' && tags.length <= 15, tags.slice(0, 4));
    const F = P1.facts, golden = show.matches.filter((m) => m.goldenStart !== null).length;
    check('publish: facts come from the timeline (golden balls, comebacks, top-scoring team)', F.golden === golden && F.comebacks === show.matches.filter((m) => m.comeback && m.round <= 1).length &&
      (golden ? /golden ball/.test(P1.longDescription) : /No tie needed a golden ball/.test(P1.longDescription)) && P1.longDescription.includes(`Most goals: ${F.topTeam.name}`));
    const P2 = PUB.buildPublish(show, chapters, sel.reels[0], { seed: 'runB', mapName: 'Sunset', recentTitles: P1.longTitles });
    check('publish variety: another run seed + recent titles -> no repeated long title', P2.longTitles.every((t) => !P1.longTitles.includes(t)), P2.longTitles);
    const bad = (mut) => { const q = JSON.parse(JSON.stringify(P1)); mut(q); return PUB.lintPublish(q, lopts); };
    check('publish lint catches: player name, forbidden word, long title, missing Simulation, too many hashtags, missing disclaimer, champion in title', [
      bad((q) => { q.longDescription += '\nGoal by ' + players[0]; }),
      bad((q) => { q.longTitles[0] = 'UEFA Champions League Simulation'; }),
      bad((q) => { q.longTitles[1] = 'Simulation ' + 'x'.repeat(100); }),
      bad((q) => { q.reelTitles[0] = 'Great match'; }),
      bad((q) => { q.longDescription += '\n' + Array.from({ length: 6 }, (_, i) => '#Tag' + i).join(' '); }),
      bad((q) => { q.longDescription = q.longDescription.replace(/not real results/g, ''); }),
      bad((q) => { q.longTitles[2] = `${lopts.champion} wins | Simulation`; }),
    ].every((e) => e.length > 0));
    check('chapters check: needs 0:00 first, >= 3 entries, >= 10 s apart, last before the end', PUB.chaptersCheck('0:00 a\n0:05 b\n0:30 c', 100).length > 0 && PUB.chaptersCheck('0:10 a\n0:30 b\n0:50 c', 100).length > 0 &&
      PUB.chaptersCheck('0:00 a\n0:30 b', 100).length > 0 && PUB.chaptersCheck('0:00 a\n0:30 b\n2:00 c', 100).length > 0 && PUB.chaptersCheck('0:00 a\n0:30 b\n0:50 c', 100).length === 0);
    const dir = path.join(ROOT, 'build', 'p6_publish'); PUB.writePublish(dir, P1);
    const files = ['long_title.txt', 'long_description.txt', 'reel_title.txt', 'reel_description.txt', 'README_publish.txt'];
    const readme = fs.readFileSync(path.join(dir, 'README_publish.txt'), 'utf8');
    check('publish/ folder: 5 files; README in Romanian with Audience "not made for kids", Category Sports and the AI / synthetic-content reminder', files.every((f) => fs.existsSync(path.join(dir, f))) && /nu este conceput pentru copii/.test(readme) && /Sport/.test(readme) && /sintetic/.test(readme));
    // history keeps the last 10 titles (on a copy of plan/history.json)
    const hf = path.join(ROOT, 'plan', 'history.json'), before = fs.readFileSync(hf, 'utf8');
    try { for (let i = 0; i < 5; i++) PUB.recordTitles([`T${i}a`, `T${i}b`, `T${i}c`]); const h = JSON.parse(fs.readFileSync(hf, 'utf8')); check('plan/history.json remembers the last 10 titles', h.recent_titles.length === 10 && h.recent_titles[9] === 'T4c' && Array.isArray(h.runs)); }
    finally { fs.writeFileSync(hf, before); }
    const gen = fs.readFileSync(path.join(ROOT, 'generate.js'), 'utf8');
    check('generate.js writes publish/ (lint must pass) and records the titles (not in dry runs)', /writePublish\(path\.join\(P\.runDir, 'publish'\)/.test(gen) && /if \(!opts\.dryRun\) PUB\.recordTitles/.test(gen) && /lintPublish/.test(gen));
  }

  fs.writeFileSync(path.join(ROOT, 'build', 'p6_test_results.json'), JSON.stringify({ results, failed }, null, 1));
  console.log(`\nP6: ${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
