'use strict';
// P2 checks: 16-team bracket, tournament rules, comebacks, equal balls (also measured in pixels), crest decals.
// Run: node tests/p2_tests.js   (writes build/p2_test_results.json)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const G = require('../sim/geometry');
const CFG = require('../sim/config');
const eng = require('../sim/engine');
const TOUR = require('../sim/tournament');
const L = require('../sim/config_loader');
const CLOCK = require('../sim/clock');
const LOGOS = require('../sim/logos');
const { buildBracket, seedOrder } = require('../sim/bracket');
const COMP = path.join(ROOT, 'config', 'competitions', 'ucl_2026_top16.json');

const results = [];
let failed = 0;
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  if (!ok) failed++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail).slice(0, 400) : ''));
}

// ---------- 1. bracket seeding ----------
console.log('== bracket');
{
  const ids = Array.from({ length: 16 }, (_, i) => 't' + (i + 1));
  const b = buildBracket(ids, [], { seed: 7 });
  const pairs = b.ties.map(([x, y]) => `${x + 1}v${y + 1}`);
  const quarter = (i) => b.slots.indexOf(i) >> 2;
  check('buildBracket (P5 balanced draw): top 4 in different quarters, every quarter one team of every pot (details: tests/p5_tests.js)',
    new Set([0, 1, 2, 3].map(quarter)).size === 4 && require('../sim/bracket').drawOk(b.slots, b.pots), pairs);
  const f1 = buildBracket(ids, [{ a: 't1', b: 't5', round: 'R16' }]);
  const tie = f1.ties.find((t) => t.includes(0));
  check('buildBracket forced pair (R16): 1st vs 5th become a round-of-16 tie, every team still placed once', tie.includes(4) && new Set(f1.slots).size === 16, f1.ties.map(([x, y]) => `${x + 1}v${y + 1}`));
  const f2 = buildBracket(ids, [{ a: 't1', b: 't2', round: 'QF' }]);
  const p1 = f2.slots.indexOf(0), p2 = f2.slots.indexOf(1);
  check('buildBracket forced pair (QF): 1st and 2nd in sibling ties (meet in the quarter-final if both go through)', (p1 >> 2) === (p2 >> 2) && (p1 >> 1) !== (p2 >> 1), f2.ties.map(([x, y]) => `${x + 1}v${y + 1}`));
  let threw = false; try { buildBracket(ids, [{ a: 't1', b: 't5' }, { a: 't5', b: 't9' }]); } catch (e) { threw = true; }
  check('buildBracket: conflicting forced pairs give a clear error', threw);
  check('seed order for 4 teams = 1v4, 2v3', seedOrder(4).join(',') === '1,4,2,3');
}

// ---------- 2. config: standings snapshot, teams, players, crests ----------
console.log('== config');
const conf = L.loadCompetition(COMP);
{
  const c = conf.competition;
  check('competition: MARBLE CHAMPIONS, knockout16, 16 teams, standings snapshot with source URL + date, GAME_MIN_PER_SEC 2.4',
    c.name === 'MARBLE CHAMPIONS' && c.format === 'knockout16' && conf.teams.length === 16 && /^https:\/\//.test(c.standings.source_url) && /^\d{4}-\d{2}-\d{2}$/.test(c.standings.retrieved)
    && c.standings.table.length === 16 && c.standings.table.every((r, i) => r.team === c.teams[i] && r.pos === i + 1) && conf.rules.GAME_MIN_PER_SEC === 2.4);
  const fmt = conf.teams.every((t) => t.players.length === 3 && t.players.every((p) => /^([A-Z]\. \S.*|[A-Z][a-zà-ÿ]+( Jr\.)?)$/u.test(p.name) && /^https?:\/\//.test(p.source_url) && typeof p.verified === 'boolean'));
  const review = fs.readFileSync(path.join(ROOT, 'config', 'players_review.md'), 'utf8');
  check('players: 3 attackers per team with source/retrieved/verified, format "I. Surname", all listed in config/players_review.md', fmt && conf.teams.every((t) => t.players.every((p) => review.includes(p.name))),
    conf.teams.filter((t) => !t.players.every((p) => review.includes(p.name))).map((t) => t.id));
  const twoColours = conf.teams.every((t) => /^#[0-9A-F]{6}$/i.test(t.primary) && /^#[0-9A-F]{6}$/i.test(t.secondary));
  check('teams: two kit colours each (primary + secondary), strength from league position (never visible)', twoColours && conf.teams.every((t, i) => t.strength === 92 - i));
  const man = LOGOS.readManifest();
  const okLogos = conf.teams.every((t) => t.logoFile && fs.statSync(t.logoFile).size > 2000 && man[t.id] && /^https?:\/\//.test(man[t.id].source_url) && /^\d{4}-\d{2}-\d{2}$/.test(man[t.id].retrieved) && man[t.id].licence);
  check('crests: logos_on_balls true, a file + manifest entry (source_url, retrieved, licence note) for every team', conf.rules.logos_on_balls === true && okLogos, conf.teams.filter((t) => !t.logoFile || !man[t.id]).map((t) => t.id));
  const md = LOGOS.logoUsageMd(conf, []);
  check('LOGO_USAGE.md content: every crest with its source + the Romanian risk reminder', conf.teams.every((t) => md.includes(t.name)) && /riscul/i.test(md) && /Max/.test(md));
  const r = L.rulesToCfg(conf.rules);
  check('rules: one ball radius for every team (ball_radius == geometry radius), invisible strength edge set', conf.rules.ball_radius === G.BALL_R && r.BALL_RADIUS === G.BALL_R && r.STRENGTH_EDGE > 0);
}

// ---------- 3. the 16-team tournament ----------
console.log('== tournament');
const showFile = path.join(ROOT, 'build', 'test_show16.json');
const built = TOUR.buildAll(COMP, showFile);
const S = built.show;
{
  const M = S.matches;
  check('format: 29 matches = 8+4+2 two-legged ties + final', M.length === 29 && S.rounds.map((r) => r.ties.length).join(',') === '8,4,2,1' && S.rounds.slice(0, 3).every((r) => r.ties.every((t) => t.legs.length === 2)) && S.rounds[3].ties[0].legs.length === 1);
  const R = conf.rules.ball_radius;
  check('equal balls: every match has rA == rB == ball_radius (no size difference between teams)', M.every((m) => m.rA === R && m.rB === R), [...new Set(M.map((m) => `${m.rA}/${m.rB}`))]);
  const gmin = conf.rules.GOALS_MIN, gmax = conf.rules.GOALS_MAX;
  check('goals per match within 1..10, stuck limit, ball accounting (6 balls every frame)', M.every((m) => { const g = m.score[0] + m.score[1]; return g >= gmin && g <= gmax && m.stuckCount <= CFG.MAX_STUCK_PER_MATCH && m.frames.every((f) => f.b.length === 6); }), M.map((m) => m.score.join('-')));
  // no ball left in the goal: a ball in the net state never lasts longer than NET_TIME
  let netOk = true;
  for (const m of M) { const net = new Array(6).fill(0); for (let i = 1; i < m.frames.length; i++) { const dt = m.frames[i].t - m.frames[i - 1].t; m.frames[i].b.forEach((b, q) => { net[q] = b[3] === 4 ? net[q] + dt : 0; if (net[q] > CFG.NET_TIME + 0.1) netOk = false; }); } }
  check('no ball left in the goal (net time <= NET_TIME) in all 29 matches', netOk);
  // aggregate + qualifier, recomputed independently from the goal events
  const scoreAt = (m, t) => { let a = 0, b = 0; for (const e of m.events) { if (e.t > t + 1e-9) break; if (e.type === 'goal') { if (e.team === 'A') a++; else b++; } } return [a, b]; };
  let aggOk = true, goldenOk = true;
  S.rounds.forEach((rd, ri) => rd.ties.forEach((tie, ti) => {
    if (tie.legs.length === 2) {
      const l1 = M[tie.legs[0]], l2 = M[tie.legs[1]];
      const agg = [l1.score[0] + l2.score[0], l1.score[1] + l2.score[1]];
      if (agg.join() !== tie.agg.join() || l2.agg.join() !== agg.join()) aggOk = false;
      const reg = scoreAt(l2, l2.endReg), ra = [l1.score[0] + reg[0], l1.score[1] + reg[1]];
      const exp = ra[0] !== ra[1] ? (ra[0] > ra[1] ? tie.ta : tie.tb) : (l2.goldenWinner === 'A' ? tie.ta : tie.tb);
      if (exp !== tie.winner) aggOk = false;
      if ((ra[0] === ra[1]) !== (l2.goldenStart !== null)) goldenOk = false;
      if (l1.goldenStart !== null) goldenOk = false; // never in leg 1
    } else {
      const f = M[tie.legs[0]], reg = scoreAt(f, f.endReg);
      const exp = reg[0] !== reg[1] ? (reg[0] > reg[1] ? tie.ta : tie.tb) : (f.goldenWinner === 'A' ? tie.ta : tie.tb);
      if (exp !== tie.winner || exp !== S.champion) aggOk = false;
      if ((reg[0] === reg[1]) !== (f.goldenStart !== null)) goldenOk = false;
    }
    if (ri > 0) { const prev = S.rounds[ri - 1].ties; if (tie.ta !== prev[2 * ti].winner || tie.tb !== prev[2 * ti + 1].winner) aggOk = false; }
  }));
  check('aggregate correct, right team goes through every tie, winners feed the next round in bracket order', aggOk, S.rounds.map((r) => r.ties.map((t) => `${S.teams[t.winner].short_name}`).join(' ')));
  check('golden ball exactly when the deciding result is level after added time (never in leg 1); at least one in this tournament', goldenOk && M.some((m) => m.goldenStart !== null));
  let clockOk = true;
  for (const m of M) {
    if (m.goldenStart === null) continue;
    for (const f of m.frames) { if (f.t < m.goldenStart) continue; const ck = CLOCK.clockAt(m, f.t, S.cfg.GAME_MIN_PER_SEC); if (!ck.golden || ck.value !== 90 + m.addedTime) clockOk = false; }
  }
  check('clock rule: during golden ball the clock is frozen at 90+added', clockOk);
  // determinism: replay a few seeds in this process and in a fresh one
  const rc = L.rulesToCfg(conf.rules);
  const pick = [0, 13, 28].map((i) => M[i]);
  const same = pick.every((m) => eng.simulateMatch(m.seed, { kind: m.kind, prevA: m.prev[0], prevB: m.prev[1], rA: m.rA, rB: m.rB, fav: m.strength.fav || undefined, edge: m.strength.edge }, rc).hash === m.hash);
  const m28 = M[28];
  const fresh = execFileSync(process.execPath, ['-e', `const e=require('./sim/engine');const L=require('./sim/config_loader');const rc=L.rulesToCfg(L.loadCompetition(${JSON.stringify(COMP)}).rules);
    process.stdout.write(e.simulateMatch(${m28.seed},{kind:'final',rA:${m28.rA},rB:${m28.rB},fav:${JSON.stringify(m28.strength.fav)}||undefined,edge:${m28.strength.edge}},rc).hash)`], { cwd: ROOT }).toString();
  check('determinism: same config + seed -> same timeline hash (same process and fresh process)', same && fresh === m28.hash);
  // comebacks
  const cbSynth = [TOUR.comebackInfo('leg1', [{ team: 'A' }, { team: 'B' }, { team: 'B' }], [0, 0], 'B'), TOUR.comebackInfo('leg2', [{ team: 'B' }, { team: 'B' }, { team: 'B' }], [2, 0], 'B'),
    TOUR.comebackInfo('leg1', [{ team: 'A' }, { team: 'A' }], [0, 0], 'A'), TOUR.comebackInfo('leg1', [{ team: 'A' }, { team: 'B' }], [0, 0], null)];
  check('comeback detection: synthetic cases (1-0 -> 1-2 depth 1; leg-1 0-2 then 3-0 depth 2 strong; no deficit; draw)',
    cbSynth[0].comeback && cbSynth[0].depth === 1 && cbSynth[1].comeback && cbSynth[1].depth === 2 && !cbSynth[2].comeback && !cbSynth[3].comeback, cbSynth);
  let cbOk = true;
  for (const m of M) { const c = TOUR.comebackInfo(m.kind, m.goals, m.prev, m.winnerSide); if (c.comeback !== m.comeback || c.depth !== m.comeback_depth) cbOk = false; }
  const early = M.filter((m) => m.round <= 1 && m.comeback);
  check('comebacks: stored per match; round of 16 + quarter-finals have >= 3 comebacks incl. >= 1 strong (depth >= 2); reel list never from SF/final',
    cbOk && early.length >= 3 && early.some((m) => m.comeback_depth >= 2) && S.comebacks.every((c) => M[c.match].round <= 1), S.comebacks);
  // timeline / chapters / index
  const mins = S.totalFrames / 30 / 60;
  check('video length 25-33 minutes (P5, Max: ~32 min accepted after the good-hit / pump fixes)', mins >= 25 && mins <= 33, { minutes: +mins.toFixed(2) });
  const ch = TOUR.chaptersText(S).trim().split('\n');
  const secs = ch.map((l) => { const p = l.split(' ')[0].split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; });
  check('chapters: start at 0:00, ascending, >= 10 s apart, one per match (+ intro + champion)', secs[0] === 0 && secs.every((x, i) => !i || x - secs[i - 1] >= 10) && ch.length === 29 + 2, { lines: ch.length });
  const idx = TOUR.matchesIndex(S);
  const names = S.teams.flatMap((t) => t.players.map((p) => p.name));
  const pub = JSON.stringify(Object.assign({}, idx, { internal: undefined }));
  check('matches_index: 29 matches with round, teams, seed, score, aggregate, goals (team+minute), comeback, start/end; player names only in "internal"',
    idx.matches.length === 29 && idx.matches.every((m) => m.seed && m.score && m.goals && 'comeback_depth' in m && m.end_s > m.start_s) && !names.some((n) => pub.includes(n)) && names.some((n) => JSON.stringify(idx.internal).includes(n)));
  const segs = S.segments;
  check('timeline: round title cards (4), bracket at the start and after every round, replay + MOTM + bracket update per match', segs.filter((s) => s.type === 'roundCard').length === 4
    && segs.filter((s) => s.type === 'bracket').length === 1 + 28 && segs.filter((s) => s.type === 'motm').length === 29 && segs.filter((s) => s.type === 'replay').length === 29);
}

// ---------- 4. pixels: equal ball size, decal, flag off == old look, no crest outside balls ----------
console.log('== pixels');
{
  const out = execFileSync(process.execPath, [path.join(__dirname, 'p2_pixels.js'), showFile], { cwd: ROOT, timeout: 400000 }).toString();
  const px = JSON.parse(out.slice(out.lastIndexOf('\n{') + 1));
  check('pixels: in a rendered 1080p match frame both teams\' balls have the same pixel diameter (+-1 px)', px.diam && Math.abs(px.diam.A - px.diam.B) <= 1 && px.diam.A > 40, px.diam);
  check('pixels: crest decal visible - ball centre differs from the plain-colour ball (>= 30% of centre pixels, logos on vs off)', px.decal && px.decal.differentPct >= 30, px.decal);
  check('pixels: logos_on_balls false reproduces the v2b ball look (ball discs identical to the previous renderer)', px.oldLook && px.oldLook.maxDiff <= 2, px.oldLook);
  check('rule: no real player name drawn during play (all texts of match frames around every goal / shot / golden ball)', px.namesInPlay && px.namesInPlay.frames > 100 && px.namesInPlay.hits.length === 0, px.namesInPlay);
  check('pixels: no crest pixels outside the balls (bracket, round card, trophy screen identical with logos on/off)', px.outside && px.outside.every((x) => x.diffPixels === 0), px.outside);
}

fs.writeFileSync(path.join(ROOT, 'build', 'p2_test_results.json'), JSON.stringify({ when: new Date().toISOString(), failed, results }, null, 2));
console.log(`\nP2: ${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
