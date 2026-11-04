'use strict';
// Builds the whole tournament from config: seed gate per match, bracket logic, awards, show timeline.
// Usage: node sim/tournament.js [--competition config/competitions/demo_4teams.json] [--out build/show.json]
const fs = require('fs');
const path = require('path');
const { simulateMatch } = require('./engine');
const G = require('./geometry');
const CFG = require('./config');
const L = require('./config_loader');

const ROOT = path.join(__dirname, '..');
const FPS = CFG.FPS;

function teamsFromConf(conf) {
  return conf.teams.map((t) => ({ id: t.id, name: t.name, short: t.short || t.name.slice(0, 3).toUpperCase(), primary: t.primary, secondary: t.secondary,
    rating: t.strength, players: t.players.map((p) => ({ name: p.name, number: p.number })) }));
}

function radii(TEAMS, ta, tb) {
  const s = CFG.STRENGTH_PCT;
  if (TEAMS[ta].rating === TEAMS[tb].rating) return [G.BALL_R, G.BALL_R];
  return TEAMS[ta].rating > TEAMS[tb].rating ? [G.BALL_R * (1 + s), G.BALL_R * (1 - s)] : [G.BALL_R * (1 - s), G.BALL_R * (1 + s)];
}

// Hard rules (spec): goals 1..10, stuck limit, safety, golden resolution, ball accounting, decisive result.
function passesRules(r, rc) {
  rc = rc || {};
  const gmin = rc.GOALS_MIN !== undefined ? rc.GOALS_MIN : CFG.GOALS_MIN, gmax = rc.GOALS_MAX !== undefined ? rc.GOALS_MAX : CFG.GOALS_MAX;
  if (r.failed) return 'failed:' + r.failed;
  if (r.shots && r.shots.length !== r.addedTime) return 'shots:' + r.shots.length; // added time N = exactly N shots
  const goals = r.score.A + r.score.B;
  if (goals < gmin || goals > gmax) return 'goals:' + goals;
  if (r.stuckCount > CFG.MAX_STUCK_PER_MATCH) return 'stuck:' + r.stuckCount;
  if (r.safetyCount > 0) return 'safety';
  if (r.goldenStart !== null && (r.goldenResolve === null || r.goldenResolve > CFG.GOLDEN_CAP)) return 'golden_cap';
  for (const f of r.frames) if (f.b.length !== 2 * CFG.BALLS_PER_TEAM) return 'accounting';
  // P1b gate (filters rare engine edge cases seen on screen, physics unchanged): every crossbar contact from above
  // (the 0.1 s front-corner latch can report a side contact), and no ball visibly resting > STUCK_TIME + 0.15 s
  if (r.events.some((e) => e.type === 'bar' && !(e.y < G.BAR_TOP))) return 'bar_side';
  { const still = new Array(2 * CFG.BALLS_PER_TEAM).fill(0); const F = r.frames;
    for (let i = 1; i < F.length; i++) { const dt = F[i].t - F[i - 1].t;
      for (let q = 0; q < still.length; q++) { const b = F[i].b[q], p = F[i - 1].b[q];
        if (b[3] === 3 && p[3] === 3 && Math.hypot(b[0] - p[0], b[1] - p[1]) / Math.max(1e-6, dt) < CFG.STUCK_SPEED) { still[q] += dt; if (still[q] > CFG.STUCK_TIME + 0.15) return 'visibly_stuck'; } else still[q] = 0; } } }
  if (r.ctx.kind !== 'leg1') { // a deciding match must produce a winner
    const tot = r.ctx.kind === 'leg2' ? [r.score.A + r.ctx.prevA, r.score.B + r.ctx.prevB] : [r.score.A, r.score.B];
    if (tot[0] === tot[1] && !r.goldenWinner) return 'no_winner';
  }
  return null;
}

function pickReplayGoal(r) {
  if (!r.goals.length) return null;
  let gi = r.goals.findIndex((g) => g.golden);
  if (gi < 0) {
    const nice = r.goals.map((g, i) => [g, i]).filter(([g]) => g.keeperAir || g.keeperCrouch);
    gi = nice.length ? nice[nice.length - 1][1] : r.goals.length - 1;
  }
  return gi;
}

// Man of the Match: most goals in the match; tiebreak = scorer of the decisive goal, else the last goal.
// Decisive goal = the winner's (loser goals + 1)-th goal (golden goal if any); in a drawn match = last goal.
function manOfTheMatch(goals, score, goldenWinner) {
  if (!goals.length) return null;
  const key = (g) => g.team + ':' + g.player;
  const cnt = new Map();
  goals.forEach((g) => cnt.set(key(g), (cnt.get(key(g)) || 0) + 1));
  const max = Math.max(...cnt.values());
  const cands = [...cnt.keys()].filter((k) => cnt.get(k) === max);
  const win = goldenWinner || (score[0] > score[1] ? 'A' : score[1] > score[0] ? 'B' : null);
  let decisive = goals[goals.length - 1];
  if (win) {
    const lose = win === 'A' ? score[1] : score[0];
    const wg = goals.filter((g) => g.team === win);
    decisive = wg[Math.min(lose, wg.length - 1)];
  }
  let pick;
  if (cands.length === 1) pick = cands[0];
  else if (cands.includes(key(decisive))) pick = key(decisive);
  else { // latest goal among the tied players
    for (let i = goals.length - 1; i >= 0; i--) if (cands.includes(key(goals[i]))) { pick = key(goals[i]); break; }
  }
  const [team, player] = pick.split(':');
  return { team, player: +player, goals: max, tiebreak: cands.length > 1 ? (win && pick === key(decisive) ? 'decisive_goal' : 'last_goal') : null, decisiveT: decisive.t };
}

// Tournament top scorers. Tiebreak: fewer matches played, then who reached that total first.
function topScorers(T, n) {
  const map = new Map();
  const played = new Map();
  T.matches.forEach((m, mi) => {
    for (const ti of [m.ta, m.tb]) played.set(ti, (played.get(ti) || 0) + 1);
    m.goals.forEach((g) => {
      const ti = g.team === 'A' ? m.ta : m.tb;
      const k = ti + ':' + g.player;
      const e = map.get(k) || { team: ti, player: g.player, goals: 0, reached: null };
      e.goals++; e.reached = [mi, g.t];
      map.set(k, e);
    });
  });
  const list = [...map.values()].map((e) => Object.assign(e, { matches: played.get(e.team) }));
  list.sort((a, b) => b.goals - a.goals || a.matches - b.matches || a.reached[0] - b.reached[0] || a.reached[1] - b.reached[1]);
  return list.slice(0, n || 3);
}

// prefer(r) -> true when the run is also nice for the demo (soft preference, after hard rules)
function gate(matchKey, ctx, prefer, cfgOverride, log, cachedSeed) {
  if (cachedSeed !== undefined && cachedSeed !== null) {
    const r = simulateMatch(cachedSeed, ctx, cfgOverride);
    if (!passesRules(r, cfgOverride)) { log.push({ matchKey, seed: cachedSeed, tried: 1, cached: true }); return r; }
  }
  const base = 100000 + matchKey * 1000;
  let firstValid = null;
  let tried = 0;
  for (let k = 0; k < 400; k++) {
    const seed = base + k; tried++;
    const r = simulateMatch(seed, ctx, cfgOverride);
    const bad = passesRules(r, cfgOverride);
    if (bad) continue;
    if (!firstValid) firstValid = r;
    if (!prefer || prefer(r)) { log.push({ matchKey, seed, tried, preferred: true }); return r; }
    if (k > 250) break;
  }
  if (firstValid) log.push({ matchKey, seed: firstValid.seed, tried, preferred: false });
  return firstValid;
}

function buildTournament(conf, opts) {
  opts = opts || {};
  conf = conf || L.loadCompetition();
  const TEAMS = teamsFromConf(conf);
  const rc = L.rulesToCfg(conf.rules);
  const cache = opts.seedCache || {};
  const usedSeeds = {};
  const log = [];
  const matches = [];
  const niceGoals = (r) => { const g = r.score.A + r.score.B; const gi = pickReplayGoal(r); return g >= 2 && g <= 7 && gi !== null && (r.goals[gi].keeperAir || r.goals[gi].keeperCrouch || r.goals[gi].golden); };
  const run = (key, ctx, prefer, extra) => {
    const r = gate(key, ctx, prefer, Object.assign({}, rc, extra || {}), log, cache[key]);
    if (r) usedSeeds[key] = r.seed;
    return r;
  };
  const sfPairs = conf.competition.pairing; // e.g. SF1: team1 vs team4, SF2: team2 vs team3
  const sfResults = [];
  let key = 0;
  for (let si = 0; si < 2; si++) {
    const [ta, tb] = sfPairs[si];
    const [rA, rB] = radii(TEAMS, ta, tb);
    // demo preference: SF1 leg 1 contains a goal in added time (an added-time shot); winners are never chosen
    const l1 = run(++key, { kind: 'leg1', rA, rB }, si === 0 ? (r) => niceGoals(r) && r.goals.some((g) => g.shot) : niceGoals);
    // demo preference: SF2 leg 2 shows a golden ball (aggregate level after added time)
    const wantGolden = si === 1;
    let l2 = run(++key, { kind: 'leg2', prevA: l1.score.A, prevB: l1.score.B, rA, rB },
      (r) => niceGoals(r) && (wantGolden ? r.goldenStart !== null : r.goldenStart === null));
    if (!l2) l2 = run(key, { kind: 'leg2', prevA: l1.score.A, prevB: l1.score.B, rA, rB }, null, { GOLDEN_FLOW_BOOST: 1.25 });
    const agg = [l1.score.A + l2.score.A, l1.score.B + l2.score.B];
    const winnerSide = l2.goldenWinner || (agg[0] > agg[1] ? 'A' : 'B');
    const winner = winnerSide === 'A' ? ta : tb;
    matches.push(mk(l1, `SEMIFINAL ${si + 1}`, 'LEG 1', ta, tb, null));
    matches.push(mk(l2, `SEMIFINAL ${si + 1}`, 'LEG 2', ta, tb, agg));
    sfResults.push({ ta, tb, l1: [l1.score.A, l1.score.B], l2: [l2.score.A, l2.score.B], agg, golden: l2.goldenStart !== null, winner, winnerSide });
  }
  const fa = sfResults[0].winner, fb = sfResults[1].winner;
  const [rA, rB] = radii(TEAMS, fa, fb);
  let fin = run(++key, { kind: 'final', rA, rB }, (r) => niceGoals(r) && r.goldenStart === null);
  if (!fin) fin = run(key, { kind: 'final', rA, rB }, null, { GOLDEN_FLOW_BOOST: 1.25 });
  const finWinnerSide = fin.goldenWinner || (fin.score.A > fin.score.B ? 'A' : 'B');
  const finalRes = { ta: fa, tb: fb, score: [fin.score.A, fin.score.B], golden: fin.goldenStart !== null, winner: finWinnerSide === 'A' ? fa : fb, winnerSide: finWinnerSide };
  matches.push(mk(fin, 'FINAL', 'FINAL', fa, fb, null));
  const T = { competition: { id: conf.competition.id, name: conf.competition.name, subtitle: conf.competition.subtitle || 'MARBLE FOOTBALL TOURNAMENT' },
    teams: TEAMS, matches, sf: sfResults, final: finalRes, champion: finalRes.winner, gateLog: log, usedSeeds, kitNotes: matches.filter((m) => m.kitNote).map((m) => `${m.stage} ${m.leg}: ${m.kitNote}`) };
  T.topScorers = topScorers(T, 3);
  return T;

  function mk(r, stage, leg, ta, tb, agg) {
    const kits = L.matchKits(TEAMS[ta], TEAMS[tb]);
    const score = [r.score.A, r.score.B];
    return {
      stage, leg, ta, tb, agg, seed: r.seed, hash: r.hash, kind: r.ctx.kind, prev: [r.ctx.prevA, r.ctx.prevB],
      rA: r.rA, rB: r.rB, addedTime: r.addedTime, regEnd: r.regEnd, endReg: r.endReg, endT: r.endT,
      goldenStart: r.goldenStart, goldenWinner: r.goldenWinner, goldenResolve: r.goldenResolve,
      score, goals: r.goals, events: r.events, frames: r.frames,
      stuckCount: r.stuckCount, replayGoal: pickReplayGoal(r),
      kits: { A: kits.A, B: kits.B }, kitDE: kits.dE, kitNote: kits.note,
      motm: manOfTheMatch(r.goals, score, r.goldenWinner),
      launches: r.launches,
      shots: r.shots, shotStarts: r.shotStarts, shotContacts: r.shotContacts, cines: r.cines,
    };
  }
}

// ---------- show timeline ----------
function buildShow(T) {
  const segs = [];
  const audio = [];
  let f = 0;
  const add = (type, sec, extra) => { const len = Math.round(sec * FPS); const s = Object.assign({ type, start: f, len }, extra || {}); segs.push(s); f += len; return s; };
  const at = (frame, type, extra) => audio.push(Object.assign({ t: +(frame / FPS).toFixed(4), type }, extra || {}));

  const intro = add('intro', 5.5); at(intro.start, 'sting_intro');
  const b0 = add('bracket', 4, { step: 0 }); at(b0.start, 'swoosh');
  const order = [[0, 1], [1, 2], [2, 3], [3, 4]]; // match index -> bracket step after it
  T.matches.forEach((m, mi) => {
    if (mi === 4) {
      const bf = add('bracket', 4, { step: 5 }); at(bf.start, 'swoosh'); at(bf.start + 30, 'qualify');
    }
    const pre = add('matchPre', 1.4, { match: mi }); at(pre.start + 8, 'swoosh');
    const nFrames = m.frames.length;
    const ms = add('match', nFrames / FPS, { match: mi });
    ms.len = nFrames; f = ms.start + nFrames;
    for (const e of m.events) { const x = Object.assign({}, e, { match: mi }); delete x.t; delete x.type; delete x.vf; at(ms.start + (e.vf !== undefined ? e.vf : e.t * FPS), e.type, x); }
    const ft = add('fulltime', m.goldenStart !== null ? 2.8 : 2.6, { match: mi }); at(ft.start + 2, 'crowd_end');
    if (m.replayGoal !== null) {
      const g = m.goals[m.replayGoal];
      const t0 = Math.max(0.2, g.t - 1.35), t1 = Math.min(m.endT, g.t + 0.55), speed = 0.45;
      const rp = add('replay', (t1 - t0) / speed + 0.5, { match: mi, goal: m.replayGoal, t0, t1, speed });
      at(rp.start, 'replay_in');
      at(rp.start + ((g.t - t0) / speed) * FPS, 'replay_goal');
    }
    if (m.motm) { const mm = add('motm', 3.0, { match: mi }); at(mm.start, 'swoosh'); }
    if (mi < 4) {
      const step = order[mi][1];
      const b = add('bracket', step % 2 === 0 ? 3.5 : 2.6, { step }); at(b.start, 'swoosh');
      if (step % 2 === 0) at(b.start + 30, 'qualify');
    }
  });
  // final screen: shown ~8 s, then a short fade
  const win = add('winner', 8.8, { team: T.champion }); at(win.start, 'fanfare'); at(win.start + 6, 'cheer');
  return { fps: FPS, totalFrames: f, segments: segs, audio };
}

function makeShow(conf, T) {
  const S = buildShow(T);
  return Object.assign({
    geometryNote: 'design space 1280x720', configHash: conf.hash, simHash: conf.simHash,
    map: conf.map, audioCfg: conf.audio, bracketStyle: conf.competition.bracket_style || 'left_to_right',
    cfg: { OMEGA: CFG.OMEGA, GAME_MIN_PER_SEC: conf.rules.GAME_MIN_PER_SEC, BALLS_PER_TEAM: conf.rules.BALLS_PER_TEAM },
  }, T, S);
}

function argVal(name, def) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; }

// Builds show.json for a competition. Seed cache: build/cache/seeds_<simHash>.json (only the chosen seeds;
// a re-run with the same simulation config replays those seeds instead of re-running the gate).
function buildAll(compFile, outFile, opts) {
  opts = opts || {};
  const conf = L.loadCompetition(compFile, opts);
  const cacheDir = path.join(ROOT, 'build', 'cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const cacheFile = path.join(cacheDir, `seeds_${conf.simHash}.json`);
  const seedCache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
  const t0 = Date.now();
  const T = buildTournament(conf, { seedCache });
  fs.writeFileSync(cacheFile, JSON.stringify(T.usedSeeds));
  const show = makeShow(conf, T);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(show));
  const TEAMS = T.teams;
  const pn = (ti, p) => TEAMS[ti].players[p].name;
  const summary = {
    competition: conf.competition.name, configHash: conf.hash, simHash: conf.simHash,
    seconds: show.totalFrames / FPS, totalFrames: show.totalFrames, buildMs: Date.now() - t0,
    sf: T.sf.map((s) => ({ tie: `${TEAMS[s.ta].name} vs ${TEAMS[s.tb].name}`, l1: s.l1, l2: s.l2, agg: s.agg, golden: s.golden, winner: TEAMS[s.winner].name })),
    final: { tie: `${TEAMS[T.final.ta].name} vs ${TEAMS[T.final.tb].name}`, score: T.final.score, golden: T.final.golden, winner: TEAMS[T.final.winner].name },
    matches: T.matches.map((m) => ({ stage: m.stage, leg: m.leg, seed: m.seed, score: m.score, added: m.addedTime,
      shots: (m.shots || []).map((x) => `${x.k}:${x.team}:${x.result}${x.cine ? ':cine' : ''}`), addedGoals: m.goals.filter((g) => g.shot).length, cinematics: (m.cines || []).length,
      golden: m.goldenStart !== null, goldenResolve: m.goldenResolve, stuck: m.stuckCount,
      secs: +(m.frames.length / FPS).toFixed(2), hash: m.hash.slice(0, 16), kits: `${m.kits.A.primary}${m.kits.A.swapped ? '(swap)' : ''} vs ${m.kits.B.primary}${m.kits.B.swapped ? '(swap)' : ''} dE=${m.kitDE}`,
      motm: m.motm ? `${pn(m.motm.team === 'A' ? m.ta : m.tb, m.motm.player)} (${m.motm.goals})${m.motm.tiebreak ? ' tb:' + m.motm.tiebreak : ''}` : null })),
    topScorers: T.topScorers.map((e) => `${pn(e.team, e.player)} ${TEAMS[e.team].name} ${e.goals} goals / ${e.matches} matches`),
    kitNotes: T.kitNotes, gateLog: T.gateLog,
  };
  fs.writeFileSync(path.join(path.dirname(outFile), 'tournament_summary.json'), JSON.stringify(summary, null, 2));
  return { show, summary, conf };
}

module.exports = { buildTournament, buildShow, makeShow, buildAll, passesRules, radii, manOfTheMatch, topScorers, teamsFromConf, pickReplayGoal };
if (require.main === module) {
  try {
    const comp = argVal('--competition', path.join(ROOT, 'config', 'competitions', 'demo_4teams.json'));
    const out = argVal('--out', path.join(ROOT, 'build', 'show.json'));
    const { summary } = buildAll(comp, path.resolve(out));
    const s = Object.assign({}, summary); delete s.gateLog;
    console.log(JSON.stringify(s, null, 1));
  } catch (e) {
    if (e instanceof L.ConfigError) { console.error(e.message); process.exit(2); }
    throw e;
  }
}
