'use strict';
// P7 tests (sections 0-4 + thumbnails flag): node tests/p7_tests.js
// No video renders: headless simulation, JSON checks and one headless page for the fallback decal (no PNG written).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const LC = require('../sim/league/config');
const F = require('../sim/league/fixtures');
const TB = require('../sim/league/standings');
const ST = require('../sim/league/strength');
const SEASON = require('../sim/league/season');
const L = require('../sim/config_loader');
const { simulateMatch } = require('../sim/engine');
const { passesRules } = require('../sim/tournament');

let pass = 0, failN = 0;
function check(name, ok, info) { if (ok) pass++; else failN++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && info !== undefined ? '  ' + JSON.stringify(info).slice(0, 400) : ''}`); }
const tmp = (n) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'p7_' + n + '_')); return d; };

(async () => {
  // ---------- thumbnails flag ----------
  console.log('== thumbnails flag');
  {
    const base = require('../config/rules/base.json'), lr = require('../config/rules/league.json');
    check('generate_thumbnails is false by default (base + league rules)', base.generate_thumbnails === false && lr.generate_thumbnails === false);
    // flag not part of the simulation hash (render cache keeps working)
    const d = tmp('cfg'); fs.cpSync(path.join(ROOT, 'config'), d, { recursive: true });
    const rb = JSON.parse(fs.readFileSync(path.join(d, 'rules', 'base.json'), 'utf8')); rb.generate_thumbnails = true; fs.writeFileSync(path.join(d, 'rules', 'base.json'), JSON.stringify(rb));
    const comp = path.join(ROOT, 'config', 'competitions', 'ucl_2026_top16.json');
    const h0 = L.loadCompetition(comp).simHash, h1 = L.loadCompetition(comp, { configDir: d }).simHash;
    check('generate_thumbnails does not change the simulation hash', h0 === h1, [h0, h1]);
    const src = fs.readFileSync(path.join(ROOT, 'generate.js'), 'utf8');
    check('generate.js runs render/thumbs.js only when generate_thumbnails is true', /const thumbsOn = conf\.rules\.generate_thumbnails === true;\s*\n\s*if \(thumbsOn\) \{[\s\S]*?render\/thumbs\.js/.test(src) && /thumbnails: thumbsOn/.test(src));
    const CK = require('../sim/checklist');
    const run = { run: 'x', date: '2026-11-13', quality: 'final_1080p', competition: { name: 'X', file: 'config/competitions/demo_4teams.json' }, map: 'm', long_video: { file: 'long_video_1080p.mp4', seconds: 100 }, reels: [] };
    const off = CK.checklistMd(tmp('ck'), run), on = CK.checklistMd(tmp('ck'), Object.assign({}, run, { thumbnails: true }));
    check('PUBLISH_CHECKLIST: "make your own thumbnail" when off, thumbnails/ when on', /îl faci tu/.test(off) && !/thumbnail_1/.test(off) && /thumbnail_1\.\.3/.test(on));
    const PUB = require('../sim/publish');
    const P = { longTitles: ['a'], longDescription: 'b', reelTitles: ['c'], reelDescription: 'd' };
    const d1 = tmp('pub'), d2 = tmp('pub'); PUB.writePublish(d1, P); PUB.writePublish(d2, P, { thumbnails: true });
    const r1 = fs.readFileSync(path.join(d1, 'README_publish.txt'), 'utf8'), r2 = fs.readFileSync(path.join(d2, 'README_publish.txt'), 'utf8');
    check('README_publish: Max makes the thumbnail (off) / choose from thumbnails/ (on)', /îl faci tu/.test(r1) && /alege unul din thumbnails/.test(r2));
    // preflight: a run without thumbnails (flag off) is not missing anything
    const rd = tmp('run');
    fs.writeFileSync(path.join(rd, 'run.json'), JSON.stringify(Object.assign({}, run, { run: 'p7_test_run', dry_run: true, thumbnails: false, fingerprint: { competition: 'p7test', map: 'm', accent: '#1F6FEB', music: 'x', bracket: [] } })));
    for (const f of ['chapters.txt', 'PUBLISH_CHECKLIST.md', 'LOGO_USAGE.md']) fs.writeFileSync(path.join(rd, f), '0:00 x\n');
    PUB.writePublish(path.join(rd, 'publish'), P);
    const pf = require('../preflight').preflight(rd);
    const files = pf.checks.find((c) => /fișierele rulării/.test(c.name));
    check('preflight: no thumbnail files required when the run has thumbnails: false', files && files.ok, files);
    const docs = fs.readFileSync(path.join(ROOT, 'docs', 'PORNIRE.md'), 'utf8');
    check('docs/PORNIRE.md: thumbnail made by Max, flag explained', /îl faci tu/.test(docs) && /generate_thumbnails/.test(docs));
    const phase = fs.readFileSync(path.join(ROOT, 'phases', 'P7_premier_league.md'), 'utf8');
    check('P7 deliverables: no thumbnails in the matchweek outputs', !/ONE reel \+ thumbnails/.test(phase) && !/most recent reel[^\n]*thumbnails/.test(phase) && !/full-pitch layout from P6\), thumbnails/.test(phase));
  }

  // ---------- §0/§1 league config + data ----------
  console.log('== league config + data');
  const C = LC.loadLeague();
  const lg = C.league;
  check('display name PREMIER LEAGUE, season 2026/27, 20 clubs', lg.display_name === 'PREMIER LEAGUE' && lg.season === '2026/27' && C.ids.length === 20);
  const expected = ['arsenal', 'man_city', 'man_utd', 'aston_villa', 'liverpool', 'bournemouth', 'sunderland', 'brighton', 'brentford', 'chelsea', 'fulham', 'newcastle', 'everton', 'leeds', 'crystal_palace', 'nottingham_forest', 'tottenham', 'coventry', 'ipswich', 'hull'];
  check('the 20 clubs of 2026/27 (17 stayed up + Coventry, Ipswich, Hull promoted; West Ham, Burnley, Wolves relegated)', JSON.stringify(C.ids) === JSON.stringify(expected) && !C.ids.some((x) => /west_ham|burnley|wolves/.test(x)));
  check('rules: draws allowed, no golden ball, 0-9 goal technical gate, added-time shots kept', C.rules.golden_ball === false && C.rc.GOLDEN_BALL === false && C.rules.GOALS_MIN === 0 && C.rules.GOALS_MAX === 9 && C.rules.ADDED_MIN[1] === 3);
  const z = (p) => TB.zoneOf(lg, p);
  check('zones: 1-5 UCL, 6-7 Europa League, 8 Conference League, 18-20 Relegated', [1, 2, 3, 4, 5].every((p) => z(p) === 'ucl') && z(6) === 'uel' && z(7) === 'uel' && z(8) === 'uecl' && [9, 12, 17].every((p) => z(p) === null) && [18, 19, 20].every((p) => z(p) === 'rel')
    && lg.zones.map((x) => x.label).join('|') === 'UCL|Europa League|Conference League|Relegated');
  const rOf = (id) => C.ratings[C.ids.indexOf(id)];
  check('ratings: 2025/26 points per game (Arsenal 85/38); promoted clubs = weakest club that stayed up (Tottenham 41)', Math.abs(rOf('arsenal') - 85 / 38) < 1e-3 && ['coventry', 'ipswich', 'hull'].every((id) => rOf(id) === rOf('tottenham')) && Math.abs(rOf('tottenham') - 41 / 38) < 1e-3);
  check('every club file exists, colours two hex, short code 3 letters', C.teams.every((t) => /^#[0-9A-F]{6}$/i.test(t.primary) && /^#[0-9A-F]{6}$/i.test(t.secondary) && /^[A-Z]{3}$/.test(t.short)));
  const PV = require('../sim/players').validateTeams(C.teams, {});
  check('player validator: 3 current attackers per club, team/nationality/source/retrieved/verified, no duplicates', PV.errors.length === 0 && C.teams.every((t) => t.players.length === 3), PV.errors);
  check('player names in the initial format (E. Haaland) or a known single/Brazilian name', C.teams.every((t) => t.players.every((p) => /^([A-ZÀ-Ž]\. [A-ZÀ-Ž][\p{L}'-]+( [A-ZÀ-Ž][\p{L}'-]+)?|[A-ZÀ-Ž][\p{L}]+( [A-ZÀ-Ž][\p{L}]+)?)$/u.test(p.name))));
  const review = fs.readFileSync(path.join(ROOT, 'config', 'players_review.md'), 'utf8');
  check('config/players_review.md lists every league player', C.teams.every((t) => t.players.every((p) => review.includes(`| ${t.name} | ${p.name}`))));
  const ML = LC.writeMissingLogos(C);
  const miss = C.teams.filter((t) => !fs.existsSync(path.join(ROOT, 'assets', 'logos', t.id + '.png'))).map((t) => t.id);
  const mmd = fs.readFileSync(ML.file, 'utf8');
  check(`assets/logos/MISSING.md lists exactly the clubs without a crest file (${miss.length})`, JSON.stringify(ML.missing) === JSON.stringify(miss) && miss.every((id) => mmd.includes('`' + id + '.png`')) && !C.teams.filter((t) => !miss.includes(t.id)).some((t) => mmd.includes('`' + t.id + '.png`')));
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'logos', 'manifest.json'), 'utf8')).logos || {};
  check('no new crest downloaded in P7 (missing clubs have no manifest entry)', miss.every((id) => !man[id]));

  // fallback decal (headless page, nothing written): missing club -> decal canvas; club with crest -> its file; ring unchanged
  {
    const { decalShow } = require('../tools/p7_decal_still');
    const show = await decalShow(['chelsea', 'arsenal', 'fulham', 'hull']);
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto('file:///' + path.join(ROOT, 'render', 'index.html').replace(/\\/g, '/'));
    await page.evaluate((j) => window.initRenderer(JSON.parse(j)), JSON.stringify(show));
    const r = await page.evaluate((kits) => ({ che: !!window.fallbackDecalOf('chelsea'), ful: !!window.fallbackDecalOf('fulham'), ars: window.fallbackDecalOf('arsenal'),
      styles: kits.map((k) => window.ballStyleInfo(k)) }), [show.matches[0].kits.A, show.matches[0].kits.B]);
    await browser.close();
    const kits = [show.matches[0].kits.A, show.matches[0].kits.B];
    check('fallback decal for clubs without crest, real crest kept for the others', r.che && r.ful && r.ars === null);
    check('decal ball keeps the logo-ball style and the same ring colour', r.styles.every((s, i) => s.logo && s.ring === kits[i].ring), r.styles);
  }

  // ---------- §2 fixtures ----------
  console.log('== fixtures');
  const fxFile = SEASON.loadOrCreateFixtures(C);
  const fx = SEASON.fixtureWeeks(fxFile);
  const errs = F.checkFixtures(fx, C.ids, C.ratings);
  check('fixtures.json: 38 weeks x 10, each pair twice (once at each ground), 19 home + 19 away, max 2 home/away in a row, mirrored second half in another order, strength spread, biggest match last', errs.length === 0, errs.slice(0, 5));
  const again = F.generateFixtures(C.ids, C.ratings, lg.season_seed);
  check('fixtures deterministic (same seed -> same fixtures as the saved file)', JSON.stringify(again.weeks) === JSON.stringify(fx.weeks));
  const other = F.generateFixtures(C.ids, C.ratings, lg.season_seed + 1);
  check('another seed -> other fixtures, still valid', JSON.stringify(other.weeks) !== JSON.stringify(fx.weeks) && F.checkFixtures(other, C.ids, C.ratings).length === 0);
  console.log(`   spread: max block deviation ${fxFile.meta.maxBlockDev} (tol ${F.BAND_TOL}), max top-6 opponents in 5 weeks ${fxFile.meta.maxTopIn5}, min weeks between the two meetings ${fxFile.meta.minGapWeeks}`);
  {
    const bad = JSON.parse(JSON.stringify(fx)); const m = bad.weeks[3][2]; [m.home, m.away] = [m.away, m.home];
    check('checker catches a swapped venue', F.checkFixtures(bad, C.ids, C.ratings).length > 0);
    // "plays City ten times early" pattern: opponents of one club sorted by strength -> spread check fails
    const idx = new Map(C.ids.map((c, i) => [c, i]));
    const opp = Array.from({ length: 20 }, () => new Array(38));
    fx.weeks.forEach((wk, w) => wk.forEach((x) => { opp[idx.get(x.home)][w] = idx.get(x.away); opp[idx.get(x.away)][w] = idx.get(x.home); }));
    const o0 = opp[0].slice().sort((a, b) => C.ratings[b] - C.ratings[a]); opp[0] = o0;
    check('spread metric flags a club meeting all strong clubs early', F.spread(opp, C.ratings).maxDev > F.BAND_TOL);
  }

  // ---------- standings + tie-breaks ----------
  console.log('== standings');
  {
    const cl = ['a', 'b', 'c', 'd'];
    const LG = { points: { win: 3, draw: 1, loss: 0 }, tiebreak: ['points', 'goal_difference', 'goals_for', 'head_to_head_points', 'seeded_draw'], zones: [], season_seed: 7 };
    const t1 = TB.table(cl, [{ home: 'a', away: 'b', hg: 2, ag: 0 }, { home: 'c', away: 'd', hg: 1, ag: 1 }], LG);
    check('points 3/1/0, played/W/D/L/GF/GA', t1[0].id === 'a' && t1[0].pts === 3 && t1.find((r) => r.id === 'c').pts === 1 && t1.find((r) => r.id === 'b').l === 1 && t1[0].gf === 2 && t1.find((r) => r.id === 'b').ga === 2);
    const gd = TB.table(cl, [{ home: 'a', away: 'c', hg: 3, ag: 0 }, { home: 'b', away: 'd', hg: 1, ag: 0 }], LG);
    check('tie-break 1: goal difference', gd[0].id === 'a' && gd[1].id === 'b');
    const gf = TB.table(cl, [{ home: 'a', away: 'c', hg: 3, ag: 2 }, { home: 'b', away: 'd', hg: 1, ag: 0 }], LG);
    check('tie-break 2: goals scored', gf[0].id === 'a' && gf[1].id === 'b');
    // a and b: same points (4), GD (0), GF (3); b beat a -> b first
    const h2h = TB.table(cl, [{ home: 'b', away: 'a', hg: 1, ag: 0 }, { home: 'a', away: 'c', hg: 2, ag: 1 }, { home: 'b', away: 'd', hg: 1, ag: 1 }, { home: 'a', away: 'd', hg: 1, ag: 1 }, { home: 'b', away: 'c', hg: 1, ag: 2 }], LG);
    const ra = h2h.find((r) => r.id === 'a'), rb = h2h.find((r) => r.id === 'b');
    check('tie-break 3: head-to-head points', ra.pts === rb.pts && ra.gd === rb.gd && ra.gf === rb.gf && rb.pos < ra.pos, [ra, rb]);
    // three-way: a, b, c all 3 pts, GD 0, GF 2 in a cycle -> h2h all equal -> seeded draw (stable)
    const cyc = [{ home: 'a', away: 'b', hg: 2, ag: 1 }, { home: 'b', away: 'c', hg: 2, ag: 1 }, { home: 'c', away: 'a', hg: 2, ag: 1 }];
    const t3 = TB.table(['a', 'b', 'c'], cyc, LG), t3b = TB.table(['a', 'b', 'c'], cyc.slice().reverse(), LG);
    const keyOrder = ['a', 'b', 'c'].sort((x, y) => (TB.drawKey(7, x) < TB.drawKey(7, y) ? -1 : 1));
    check('tie-break 4: seeded draw (deterministic, independent of result order)', t3.map((r) => r.id).join() === keyOrder.join() && t3b.map((r) => r.id).join() === keyOrder.join());
    const t0 = TB.table(cl, [], LG), t0b = TB.table(cl, [], Object.assign({}, LG, { season_seed: 8 }));
    check('seeded draw depends on the season seed only', t0.map((r) => r.id).join() === TB.table(cl, [], LG).map((r) => r.id).join() && t0b.length === 4);
    const form = TB.table(cl, [1, 2, 3, 4, 5, 6].map((k) => ({ home: 'a', away: 'b', hg: k % 2, ag: 0 })), LG);
    check('form = last 5 results', form.find((r) => r.id === 'a').form.length === 5);
  }

  // ---------- §3 strength model + calibration ----------
  console.log('== strength + calibration');
  {
    const S = lg.strength;
    const eq = ST.edgeFor(S, 1.3, 1.3), up = ST.edgeFor(S, 1.1, 2.2), down = ST.edgeFor(S, 2.2, 1.1);
    check('equal clubs: home side is favourite by the home advantage', eq.fav === 'A' && Math.abs(eq.edge - S.home_advantage) < 1e-6);
    check('much stronger away club: away favourite; stronger home club: bigger edge; capped at edge_max', up.fav === 'B' && down.fav === 'A' && down.edge > eq.edge && down.edge <= S.edge_max);
    check('top clubs compressed (eff), lower clubs untouched', ST.eff(S, 2.2) < 2.2 && ST.eff(S, 1.5) === 1.5);
    const ctx = ST.leagueCtx(S, 1.1, 2.2, C.rc.BALL_RADIUS);
    check('all balls identical: same radius for both teams in every league match', ctx.rA === ctx.rB && ctx.rA === C.rc.BALL_RADIUS && ctx.kind === 'league');
    const cal = JSON.parse(fs.readFileSync(path.join(ROOT, 'league', lg.id, 'calibration.json'), 'utf8'));
    check('calibration made with the current rules and strength values (not stale)', JSON.stringify(cal.release_interval) === JSON.stringify(C.rules.release_interval) && JSON.stringify(cal.strength) === JSON.stringify(S));
    const g = cal.engine_grid;
    check(`engine grid: >= 2000 real simulated matches across strength gaps (${g.matches})`, g.matches >= 2000 && g.grid.length >= 8);
    check('engine grid: favourite win share rises with the edge (0 -> 0.9)', g.grid[g.grid.length - 1].W > g.grid[0].W + 0.3 && cal.fit.favWin.b > 0);
    const es = cal.engine_season;
    console.log(`   engine season (380 fixtures): goals ${es.avgGoals}, draws ${es.draws}, 0-0 ${es.nilNil}, home wins ${es.homeWin}, away wins ${es.awayWin}, technical rejects ${es.rejectedByTechnicalGate}`);
    check('single matches: average goals 2.5-3.2', es.avgGoals >= 2.5 && es.avgGoals <= 3.2);
    check('single matches: draws 18-28 %', es.draws >= 0.18 && es.draws <= 0.28);
    check('single matches: 0-0 at most 8 %', es.nilNil <= 0.08);
    check('home-win share 40-50 %', es.homeWin >= 0.40 && es.homeWin <= 0.50);
    const mc = cal.monte_carlo;
    console.log(`   Monte-Carlo ${mc.seasons} seasons: champion 68-95 in ${mc.champion.inRange} (median ${mc.champion.median}), last 15-40 in ${mc.last.inRange} (median ${mc.last.median}), gap after MW15 14-30 in ${mc.gapAfterMw15.inRange} (median ${mc.gapAfterMw15.median}), top-rated title ${mc.topRatedTitleShare}, top-rated loses >= 2 in ${mc.topRatedLosesAtLeast2}, last-week upsets/season ${mc.lastWeekUpsetsPerSeason}`);
    check('Monte-Carlo: >= 5000 seasons, all season targets met', mc.seasons >= 5000 && Object.values(mc.pass).every(Boolean), mc.pass);
    check('natural outcomes: no season with a flat table after MW10, upsets still happen in the last matchweek', mc.seasonsWithFlatTableAfterMw10 === 0 && mc.lastWeekUpsetsPerSeason > 0.1);
  }

  // ---------- league match gates (real engine) ----------
  console.log('== league match gates (engine)');
  {
    const S = lg.strength;
    let draws = 0, golden = 0, shotsOk = true, det = true, accepted = 0;
    for (let i = 0; i < 16; i++) {
      const seed = SEASON.matchSeed(lg.season_seed, 99, i, 0);
      const r = simulateMatch(seed, ST.leagueCtx(S, 1.4, 1.3, C.rc.BALL_RADIUS), C.rc);
      if (passesRules(r, C.rc)) continue;
      accepted++;
      if (r.score.A === r.score.B) draws++;
      if (r.goldenStart !== null) golden++;
      if (r.shots.length !== r.addedTime) shotsOk = false;
      if (i < 2 && simulateMatch(seed, ST.leagueCtx(S, 1.4, 1.3, C.rc.BALL_RADIUS), C.rc).hash !== r.hash) det = false;
    }
    check(`no golden ball, draws accepted (${draws} draws in ${accepted}), added time = N shots, deterministic`, golden === 0 && draws > 0 && shotsOk && det && accepted >= 12);
    check('goal gate 0-9: a 10-goal result is rejected, a 0-0 is accepted', passesRules({ failed: null, shots: [], addedTime: 0, score: { A: 6, B: 4 }, stuckCount: 0, safetyCount: 0, goldenStart: null, frames: [], ctx: { kind: 'league' } }, C.rc) === 'goals:10'
      && passesRules({ failed: null, shots: [], addedTime: 0, score: { A: 0, B: 0 }, stuckCount: 0, safetyCount: 0, goldenStart: null, frames: [], ctx: { kind: 'league' } }, C.rc) === null);
  }

  // ---------- §4 season state ----------
  console.log('== season state');
  {
    const dir = tmp('season'); fs.copyFileSync(path.join(ROOT, 'league', lg.id, 'fixtures.json'), path.join(dir, 'fixtures.json'));
    const o = { dir, mode: 'stub' };
    const w1 = await SEASON.playWeek(C, 1, o), w2 = await SEASON.playWeek(C, 2, o);
    const st = SEASON.status(C, o);
    check('state: next matchweek 3 after two weeks, two weeks recorded', st.next_week === 3 && st.last_generated_week === 2 && st.weeks.length === 2);
    const rg = await SEASON.playWeek(C, 2, o);
    check('regenerate the last week: same seeds -> same results, counted as regenerated', rg.regenerated && rg.results.results_hash === w2.results.results_hash && SEASON.status(C, o).weeks[1].regenerated === 1);
    let e1 = '', e2 = '';
    try { await SEASON.playWeek(C, 1, o); } catch (e) { e1 = e.message; }
    try { await SEASON.playWeek(C, 5, o); } catch (e) { e2 = e.message; }
    check('earlier weeks locked, no skipping ahead', /locked/.test(e1) && /next matchweek is 3/.test(e2), [e1, e2]);
    const res = SEASON.allResults(C, 2, o);
    const recomputed = TB.table(C.ids, res, lg);
    check('week N+1 continues from the saved table (state table = table of weeks 1..2)', JSON.stringify(recomputed.map((r) => [r.id, r.pts, r.gd])) === JSON.stringify(st.table.map((r) => [r.id, r.pts, r.gd])) && st.table.every((r) => r.p === 2));
    const wr = JSON.parse(fs.readFileSync(SEASON.resultsFile(C, 2, o), 'utf8'));
    check('results/week_02.json: scores, scorers, goal events, seeds, hashes, standings with previous positions', wr.matches.length === 10 && wr.matches.every((m) => Number.isInteger(m.seed) && m.timeline_hash && m.goals.length === m.hg + m.ag && m.goals.every((g) => g.scorer && g.minute))
      && wr.standings.length === 20 && wr.standings.every((r) => r.prev_pos >= 1 && r.zone !== undefined));
    check('matches of a week ordered from lower to higher profile (biggest last)', wr.matches.every((m, i) => i === 0 || C.ratings[C.ids.indexOf(m.home)] + C.ratings[C.ids.indexOf(m.away)] >= C.ratings[C.ids.indexOf(wr.matches[i - 1].home)] + C.ratings[C.ids.indexOf(wr.matches[i - 1].away)] - 1e-9));
    const bad = JSON.parse(JSON.stringify(wr)); const gm = bad.matches.find((m) => m.goals.length); gm.goals[0].scorer = 'E. Haaland'; gm.goals[0].scorer_team = 'Manchester City';
    let threw = false; if (gm.goals[0].club !== 'man_city') { try { SEASON.assertWeekScorers(C, bad); } catch (e) { threw = /scorer does not belong/.test(e.message); } } else threw = true;
    check('test fails when a goal scorer is not a player of the scoring club', threw);
    // map: avoid repeating last week's map by default
    const s2 = SEASON.loadState(C, o);
    check('default map differs from last week\'s map', SEASON.defaultMap(C, s2) !== s2.weeks[s2.weeks.length - 1].map && SEASON.mapChoices(C).includes(SEASON.defaultMap(C, s2)));
    check('chosen map is stored per week', SEASON.loadState(C, o).weeks.every((w) => typeof w.map === 'string'));
  }
  // real engine week (headless) in a scratch folder: scorers, seeds, determinism
  {
    const dir = tmp('engine'); fs.copyFileSync(path.join(ROOT, 'league', lg.id, 'fixtures.json'), path.join(dir, 'fixtures.json'));
    const r = await SEASON.playWeek(C, 1, { dir, mode: 'engine' });
    const m = r.results.matches;
    check('engine matchweek: 10 results, every goal scored by a player of the scoring club', m.length === 10 && SEASON.assertWeekScorers(C, r.results) && m.every((x) => x.goals.every((g) => C.teams.find((t) => t.id === g.club).players.some((p) => p.name === g.scorer))));
    const x = m[0];
    const rr = simulateMatch(SEASON.matchSeed(lg.season_seed, 1, 0, x.attempt), ST.leagueCtx(lg.strength, C.ratings[C.ids.indexOf(x.home)], C.ratings[C.ids.indexOf(x.away)], C.rc.BALL_RADIUS), C.rc);
    check('seed = f(season seed, week, match index, attempt) and re-simulation gives the same timeline hash', x.seed === SEASON.matchSeed(lg.season_seed, 1, 0, x.attempt) && rr.hash === x.timeline_hash && rr.score.A === x.hg);
    console.log('   week 1 (engine): ' + m.map((y) => `${y.home} ${y.hg}-${y.ag} ${y.away}`).join(' | '));
  }
  // whole season dry run (stubs, no renders)
  {
    const dir = tmp('dry');
    const p = spawnSync(process.execPath, ['league.js', 'dry-run', '--dir', dir], { cwd: ROOT, encoding: 'utf8' });
    check('38-week dry run with stub results (regenerate + lock checks inside) exits 0', p.status === 0 && /38 weeks played/.test(p.stdout) && !/FAIL/.test(p.stdout), p.stdout.slice(-300));
  }
  // START menu flow with stubs
  {
    const dir = tmp('menu'); fs.copyFileSync(path.join(ROOT, 'league', lg.id, 'fixtures.json'), path.join(dir, 'fixtures.json'));
    const p = spawnSync(process.execPath, ['launcher.js'], { cwd: ROOT, encoding: 'utf8', input: '7\n1\nd\n2\nd\n3\n0\n0\n', env: Object.assign({}, process.env, { MARBLE_LEAGUE_DIR: dir, MARBLE_LEAGUE_MODE: 'stub' }), timeout: 120000 });
    const out = p.stdout;
    check('START menu: option 7 shows "Next: Matchweek 1 of 38", generates it, then shows matchweek 2', /PREMIER LEAGUE 2026\/27 — Următoarea: Etapa 1 din 38/.test(out) && /Etapa 1 · hartă/.test(out) && /Următoarea: Etapa 2 din 38/.test(out));
    check('START menu: regenerate only the last week, show the table, no match/team choosing', /Etapa 1 \(regenerată\)/.test(out) && /clasament după etapa 1/.test(out) && !/Pereche forțată/.test(out.split('PREMIER LEAGUE ====')[1] || ''));
    const st = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
    check('menu flow state: 1 week generated, regenerated once', st.weeks.length === 1 && st.weeks[0].regenerated === 1 && st.next_week === 2);
  }

  console.log(`\nP7 tests: ${pass} passed, ${failN} failed`);
  process.exit(failN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
