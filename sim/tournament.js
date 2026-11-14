'use strict';
// Builds the whole tournament from config: seed gate per match, bracket logic, awards, show timeline.
// Usage: node sim/tournament.js [--competition config/competitions/demo_4teams.json] [--out build/show.json]
const fs = require('fs');
const path = require('path');
const { simulateMatch } = require('./engine');
const G = require('./geometry');
const CFG = require('./config');
const L = require('./config_loader');
const { buildBracket } = require('./bracket');
const BRACKET = require('../render/bracket_layout');

const ROOT = path.join(__dirname, '..');
const FPS = CFG.FPS;

function teamsFromConf(conf) {
  // P6: national teams carry their ranking (FIFA rank from competition.standings when listed) for the intro grid
  const table = (conf.competition && conf.competition.standings && conf.competition.standings.table) || [];
  const rankOf = (id) => { const r = table.find((x) => x.team === id); return r ? (r.fifa_rank || r.pos) : null; };
  return conf.teams.map((t) => ({ rank: t.national ? rankOf(t.id) : null, id: t.id, name: t.name, short: t.short || t.name.slice(0, 3).toUpperCase(), short_name: t.short_name || t.name, national: !!t.national, primary: t.primary, secondary: t.secondary,
    rating: t.strength, hasLogo: !!t.logoFile, players: t.players.map((p) => ({ name: p.name, number: p.number, team: p.team || t.name })) }));
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
  // P1b gate: no ball visibly resting > STUCK_TIME + 0.15 s. (The P1b "bar contact only from above" rule is gone in P5:
  // the crossbar is solid on every face, so side/underside bounces are real contacts.)
  { const still = new Array(2 * CFG.BALLS_PER_TEAM).fill(0); const F = r.frames;
    for (let i = 1; i < F.length; i++) { const dt = F[i].t - F[i - 1].t;
      for (let q = 0; q < still.length; q++) { const b = F[i].b[q], p = F[i - 1].b[q];
        if (b[3] === 3 && p[3] === 3 && Math.hypot(b[0] - p[0], b[1] - p[1]) / Math.max(1e-6, dt) < CFG.STUCK_SPEED) { still[q] += dt; if (still[q] > CFG.STUCK_TIME + 0.15) return 'visibly_stuck'; } else still[q] = 0; } } }
  if (r.ctx.kind !== 'leg1' && r.ctx.kind !== 'league') { // a deciding match must produce a winner (P7 league: draws allowed)
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

// Seed gate. prefs: list of predicates in priority order (prefs[0] = best). Scans up to `budget` seeds and returns
// the first run that passes the hard rules AND prefs[0]; otherwise the run matching the best (lowest) priority found;
// otherwise the first valid run. The winners always come out of the simulation (prefs only describe the match shape).
function gate(matchKey, ctx, prefs, cfgOverride, log, cachedSeed, budget, salt) {
  prefs = (prefs || []).filter(Boolean);
  budget = budget || 300;
  if (cachedSeed !== undefined && cachedSeed !== null) {
    const r = simulateMatch(cachedSeed, ctx, cfgOverride);
    if (!passesRules(r, cfgOverride)) { log.push({ matchKey, seed: cachedSeed, tried: 1, cached: true }); return r; }
  }
  const base = 100000 + matchKey * 1000 + (salt || 0) * 1000000; // seed_salt: each competition plays different matches
  let best = null, bestLevel = Infinity, tried = 0;
  for (let k = 0; k < budget; k++) {
    const seed = base + k; tried++;
    const r = simulateMatch(seed, ctx, cfgOverride);
    if (passesRules(r, cfgOverride)) continue;
    let level = prefs.findIndex((p) => p(r));
    if (level < 0) level = prefs.length;
    if (level < bestLevel) { best = r; bestLevel = level; }
    if (level === 0) break;
  }
  if (best) log.push({ matchKey, seed: best.seed, tried, preferLevel: bestLevel, preferred: bestLevel === 0 });
  return best;
}

// Winner side of a raw result for its context (null = leg 1 drawn)
function resultWinner(r) {
  const k = r.ctx.kind;
  const tot = k === 'leg2' ? [r.score.A + r.ctx.prevA, r.score.B + r.ctx.prevB] : [r.score.A, r.score.B];
  if (r.goldenWinner) return r.goldenWinner;
  return tot[0] > tot[1] ? 'A' : tot[1] > tot[0] ? 'B' : null;
}
// Comeback: the winner of the match (leg 2: the team that goes through on aggregate) trailed at some point by >= 1
// goal (leg 2: on aggregate, leg-1 result included) and finishes ahead. depth = largest deficit. Strong = depth >= 2.
function comebackInfo(kind, goals, prev, winnerSide) {
  if (!winnerSide) return { comeback: false, depth: 0 };
  let a = kind === 'leg2' ? prev[0] : 0, b = kind === 'leg2' ? prev[1] : 0;
  const def = () => (winnerSide === 'A' ? b - a : a - b);
  let maxDef = Math.max(0, def());
  for (const g of goals) { if (g.team === 'A') a++; else b++; maxDef = Math.max(maxDef, def()); }
  return { comeback: maxDef >= 1, depth: maxDef };
}
const resultComeback = (r) => comebackInfo(r.ctx.kind, r.goals, [r.ctx.prevA, r.ctx.prevB], resultWinner(r));

// Rounds of a format. stage(i) = label of tie i shown in the HUD; next = what the tie winner advances to.
function roundsFor(format) {
  if (format === 'semis_two_legs_final') return [
    { key: 'SF', name: 'SEMIFINALS', stage: (i) => `SEMIFINAL ${i + 1}`, twoLegs: true, next: 'the final' },
    { key: 'F', name: 'FINAL', stage: () => 'FINAL', twoLegs: false, next: null }];
  if (format === 'knockout16') return [
    { key: 'R16', name: 'ROUND OF 16', stage: () => 'ROUND OF 16', twoLegs: true, next: 'the quarter-finals' },
    { key: 'QF', name: 'QUARTER-FINALS', stage: (i) => `QUARTER-FINAL ${i + 1}`, twoLegs: true, next: 'the semifinals' },
    { key: 'SF', name: 'SEMIFINALS', stage: (i) => `SEMIFINAL ${i + 1}`, twoLegs: true, next: 'the final' },
    { key: 'F', name: 'FINAL', stage: () => 'FINAL', twoLegs: false, next: null }];
  throw new Error('unknown format ' + format);
}

// Invisible strength (P2): every ball has the same radius; the stronger team sometimes takes the release turn.
function strengthCtx(TEAMS, ta, tb, rc) {
  const R = rc.BALL_RADIUS || G.BALL_R;
  const ctx = { rA: R, rB: R };
  if (TEAMS[ta].rating !== TEAMS[tb].rating && rc.STRENGTH_EDGE > 0) { ctx.fav = TEAMS[ta].rating > TEAMS[tb].rating ? 'A' : 'B'; ctx.edge = rc.STRENGTH_EDGE; }
  return ctx;
}

function buildTournament(conf, opts) {
  opts = opts || {};
  conf = conf || L.loadCompetition();
  const TEAMS = teamsFromConf(conf);
  const rc = Object.assign(L.rulesToCfg(conf.rules), opts.cfgExtra || {}); // cfgExtra: test-only flags that do not change the simulation (KEEP_FINE)
  const cache = opts.seedCache || {};
  const comp = conf.competition;
  const format = comp.format;
  const rounds = roundsFor(format);
  const logos = conf.rules.logos_on_balls !== false;
  const usedSeeds = {};
  const log = [];
  const matches = [];
  // P6: golden-neutral replay-quality preference (2..7 goals and a regulation goal past an airborne/crouching keeper).
  // It never looks at golden-ball flags or added-time goals: seeds are never chosen because they contain or lack a golden ball.
  const niceGoals = (r) => { const g = r.score.A + r.score.B; return g >= 2 && g <= 7 && r.goals.some((x) => !x.golden && !x.shot && (x.keeperAir || x.keeperCrouch)); };
  const run = (key, ctx, prefs, extra) => {
    const r = gate(key, ctx, prefs, Object.assign({}, rc, extra || {}), log, cache[key], opts.budget, comp.seed_salt || 0);
    if (r) usedSeeds[key] = r.seed;
    return r;
  };
  // first-round ties
  let bracket = null;
  let firstTies;
  if (format === 'semis_two_legs_final') firstTies = comp.pairing.map((p) => p.slice());
  else { bracket = buildBracket(comp.teams, comp.forced_pairs || [], { seed: conf.drawSeed, strengths: TEAMS.map((t) => t.rating) }); firstTies = bracket.ties; }
  const R = [];
  let key = 0;
  const cb = { n: 0, strong: 0, list: [] };
  let goldenSeen = 0, cbPhaseIdx = 0;
  let curTies = firstTies;
  rounds.forEach((rd, ri) => {
    const ties = [];
    curTies.forEach(([ta, tb], ti) => {
      const sc = strengthCtx(TEAMS, ta, tb, rc);
      const early = format === 'knockout16' && ri <= 1; // round of 16 + quarter-finals (reel candidates)
      if (rd.twoLegs) {
        // --- leg 1 ---
        let p1 = [niceGoals]; // P6: the demo "added-time goal" preference is gone
        if (early) p1 = cbPrefs(p1);
        const l1 = run(++key, Object.assign({ kind: 'leg1' }, sc), p1);
        noteCB(l1, early);
        // --- leg 2 ---
        // P6: no golden-ball preference of any kind (it was "force one golden ball" + "avoid it elsewhere")
        let p2 = [niceGoals];
        if (early) p2 = cbPrefs(p2);
        const c2 = Object.assign({ kind: 'leg2', prevA: l1.score.A, prevB: l1.score.B }, sc);
        let l2 = run(++key, c2, p2);
        if (!l2) l2 = run(key, c2, null, { GOLDEN_FLOW_BOOST: 1.25 });
        noteCB(l2, early);
        if (l2.goldenStart !== null) goldenSeen++;
        const agg = [l1.score.A + l2.score.A, l1.score.B + l2.score.B];
        const winnerSide = l2.goldenWinner || (agg[0] > agg[1] ? 'A' : 'B');
        const winner = winnerSide === 'A' ? ta : tb;
        const i1 = matches.length;
        matches.push(mk(l1, rd, ri, ti, 'LEG 1', ta, tb, null));
        matches.push(mk(l2, rd, ri, ti, 'LEG 2', ta, tb, agg));
        ties.push({ round: ri, index: ti, ta, tb, legs: [i1, i1 + 1], l1: [l1.score.A, l1.score.B], l2: [l2.score.A, l2.score.B], agg, golden: l2.goldenStart !== null, winner, winnerSide });
      } else {
        const c = Object.assign({ kind: 'final' }, sc);
        let fin = run(++key, c, [niceGoals]);
        if (!fin) fin = run(key, c, null, { GOLDEN_FLOW_BOOST: 1.25 });
        const winnerSide = fin.goldenWinner || (fin.score.A > fin.score.B ? 'A' : 'B');
        const i1 = matches.length;
        matches.push(mk(fin, rd, ri, ti, 'FINAL', ta, tb, null));
        ties.push({ round: ri, index: ti, ta, tb, legs: [i1], score: [fin.score.A, fin.score.B], golden: fin.goldenStart !== null, winner: winnerSide === 'A' ? ta : tb, winnerSide });
      }
    });
    R.push({ key: rd.key, name: rd.name, twoLegs: rd.twoLegs, ties });
    // next round: winners of tie 2k (team A, top row) and 2k+1 (team B, bottom row)
    const next = [];
    for (let i = 0; i + 1 < ties.length; i += 2) next.push([ties[i].winner, ties[i + 1].winner]); // row order = feeder order (connectors)
    curTies = next;
  });
  const finTie = R[R.length - 1].ties[0];
  const finalRes = { ta: finTie.ta, tb: finTie.tb, score: finTie.score, golden: finTie.golden, winner: finTie.winner, winnerSide: finTie.winnerSide };
  const T = { competition: { id: comp.id, name: comp.name, subtitle: comp.subtitle || 'MARBLE FOOTBALL TOURNAMENT' }, format,
    teams: TEAMS, matches, rounds: R, bracketSeeding: bracket, sf: R[R.length - 2].ties, final: finalRes, champion: finalRes.winner, gateLog: log, usedSeeds,
    comebacks: cb.list, kitNotes: matches.filter((m) => m.kitNote).map((m) => `${m.stage} ${m.leg}: ${m.kitNote}`) };
  T.topScorers = topScorers(T, 3);
  require('./players').assertScorers(T, conf.teams); // P6: every goal's scorer is a player of the scoring team
  return T;

  // comeback preference for round-of-16 / quarter-final matches: every 4th one (from the 2nd) asks for a comeback
  // (a strong one while none exists) until >= 3 comebacks with >= 1 strong are in the bracket.
  function cbPrefs(base) {
    const j = cbPhaseIdx++;
    if (!(cb.n < 3 || cb.strong < 1) || j % 4 !== 1) return base;
    const need = cb.strong < 1 ? 2 : 1;
    const want = (r) => resultComeback(r).depth >= need && resultComeback(r).comeback;
    const wantAny = (r) => resultComeback(r).comeback;
    return [(r) => want(r) && base[0](r), (r) => want(r) && niceGoals(r), (r) => wantAny(r) && niceGoals(r)].concat(base);
  }
  function noteCB(r, early) {
    const c = resultComeback(r);
    if (early && c.comeback) { cb.n++; if (c.depth >= 2) cb.strong++; }
  }
  function mk(r, rd, ri, ti, leg, ta, tb, agg) {
    const kits = L.matchKits(conf.teams[ta], conf.teams[tb], { logos });
    const score = [r.score.A, r.score.B];
    const winnerSide = resultWinner(r);
    const c = comebackInfo(r.ctx.kind, r.goals, [r.ctx.prevA, r.ctx.prevB], winnerSide);
    const early = format === 'knockout16' && ri <= 1;
    const m = {
      round: ri, roundKey: rd.key, roundName: rd.name, tie: ti, stage: rd.stage(ti), leg, ta, tb, agg, seed: r.seed, hash: r.hash, kind: r.ctx.kind, prev: [r.ctx.prevA, r.ctx.prevB],
      nextName: rd.next, rA: r.rA, rB: r.rB, addedTime: r.addedTime, regEnd: r.regEnd, endReg: r.endReg, endT: r.endT,
      goldenStart: r.goldenStart, goldenWinner: r.goldenWinner, goldenResolve: r.goldenResolve,
      score, goals: r.goals, events: r.events, frames: r.frames,
      stuckCount: r.stuckCount, replayGoal: pickReplayGoal(r),
      kits: { A: kits.A, B: kits.B }, kitDE: kits.dE, kitNote: kits.note,
      motm: manOfTheMatch(r.goals, score, r.goldenWinner),
      launches: r.launches, strength: { fav: r.ctx.fav || null, edge: r.ctx.edge || 0 },
      shots: r.shots, shotStarts: r.shotStarts, shotContacts: r.shotContacts, cines: r.cines, fine: r.fine,
      winnerSide, comeback: c.comeback, comeback_depth: c.depth,
    };
    if (early && c.comeback) cb.list.push({ match: matches.length, stage: m.stage, leg, depth: c.depth });
    return m;
  }
}

// ---------- bracket data per step (step = number of matches completed) ----------
// Returns { style, n, steps: [ { boxId: data } ] } in the format drawBracketBox() expects.
function bracketSteps(T, style) {
  const n = T.teams.length;
  const L = BRACKET.layoutFor(style, n, {});
  const compact = n > 4;
  const steps = [];
  const total = T.matches.length;
  for (let s = 0; s <= total; s++) {
    const d = {};
    const curMatch = s > 0 ? T.matches[s - 1] : null;
    T.rounds.forEach((rd, ri) => rd.ties.forEach((tie, ti) => {
      const id = BRACKET.tieBoxId(L, ri, ti);
      // a team is shown once the feeder tie that produced it is decided
      const feederOf = (team) => { if (ri === 0) return null; const prevR = T.rounds[ri - 1].ties; return prevR.find((x) => x.winner === team && (x.index >> 1) === ti); };
      const vis = (team, st) => { const f = feederOf(team); return !f || f.legs[f.legs.length - 1] < st; };
      const rows = [tie.ta, tie.tb].map((tm) => (vis(tm, s) ? tm : null));
      const prevRows = [tie.ta, tie.tb].map((tm) => (vis(tm, s - 1) ? tm : null));
      const played = tie.legs.filter((mi) => mi < s), playedPrev = tie.legs.filter((mi) => mi < s - 1);
      const decided = played.length === tie.legs.length, decidedPrev = playedPrev.length === tie.legs.length;
      const sumOf = (ls) => ls.reduce((acc, mi) => [acc[0] + T.matches[mi].score[0], acc[1] + T.matches[mi].score[1]], [0, 0]);
      const box = { rows, newRows: rows.map((x, r) => x !== null && prevRows[r] === null), win: decided ? tie.winner : null, newWin: decided && !decidedPrev,
        golden: decided && tie.golden, cur: !!(curMatch && tie.legs.includes(s - 1)) };
      if (compact || !rd.twoLegs) {
        box.cols = [''];
        box.vals = [played.length ? sumOf(played) : null];
        box.newVals = [played.length !== playedPrev.length];
      } else {
        box.label = `${rd.ties.length > 1 ? T.matches[tie.legs[0]].stage : rd.name}`;
        box.cols = ['L1', 'L2', 'AGG'];
        const v1 = played.length >= 1 ? T.matches[tie.legs[0]].score : null, v2 = played.length >= 2 ? T.matches[tie.legs[1]].score : null;
        box.vals = [v1, v2, v2 ? sumOf(played) : null];
        box.newVals = [!!v1 && playedPrev.length < 1, !!v2 && playedPrev.length < 2, !!v2 && playedPrev.length < 2];
      }
      if (!rd.twoLegs) {
        if (!compact) box.label = style === 'symmetric' ? 'FINAL' : null;
        box.glow = rows[0] !== null && rows[1] !== null && !played.length;
        if (!compact && T.rounds.length === 2) box.placeholders = ['Winner SF1', 'Winner SF2'];
      }
      d[id] = box;
    }));
    if (style === 'left_to_right') d.CH = { team: s >= total ? T.champion : null };
    steps.push(d);
  }
  return { style, n, steps };
}

// ---------- show timeline ----------
// intro -> bracket -> per round: round card, then per match: card, match, full time, replay, MOTM, bracket update
// (short; longer after the last match of a round) -> winner screen.
function buildShow(T, opts) {
  opts = opts || {};
  const segs = [];
  const audio = [];
  let f = 0;
  const big = T.teams.length > 4;
  const add = (type, sec, extra) => { const len = Math.round(sec * FPS); const s = Object.assign({ type, start: f, len }, extra || {}); segs.push(s); f += len; return s; };
  const at = (frame, type, extra) => audio.push(Object.assign({ t: +(frame / FPS).toFixed(4), type }, extra || {}));
  const chapters = [];
  const chap = (seg, title) => chapters.push({ t: seg.start / FPS, title });

  const intro = add('intro', big ? 6.5 : 5.5); at(intro.start, 'sting_intro'); chap(intro, 'Intro');
  const b0 = add('bracket', 4, { step: 0, caption: big ? 'THE DRAW' : null }); at(b0.start, 'swoosh');
  T.rounds.forEach((rd, ri) => {
    let rcSeg = null;
    if (big) { rcSeg = add('roundCard', 3, { round: ri }); at(rcSeg.start, 'swoosh'); }
    rd.ties.forEach((tie) => tie.legs.forEach((mi) => {
      const m = T.matches[mi];
      if (!big && rd.key === 'F') { const bf = add('bracket', 4, { step: mi, caption: 'THE FINALISTS' }); at(bf.start, 'swoosh'); at(bf.start + 30, 'qualify'); }
      const pre = add('matchPre', big ? 1.1 : 1.4, { match: mi }); at(pre.start + 8, 'swoosh');
      const short = m.leg === 'FINAL' ? 'Final' : `${titleCase(m.stage)} (${m.leg.toLowerCase()})`;
      chap(rcSeg && mi === rd.ties[0].legs[0] ? rcSeg : pre, `${short}: ${T.teams[m.ta].name} vs ${T.teams[m.tb].name}`);
      const nFrames = m.frames.length;
      const ms = add('match', nFrames / FPS, { match: mi });
      ms.len = nFrames; f = ms.start + nFrames;
      for (const e of m.events) { const x = Object.assign({}, e, { match: mi }); delete x.t; delete x.type; delete x.vf; at(ms.start + (e.vf !== undefined ? e.vf : e.t * FPS), e.type, x); }
      const ft = add('fulltime', m.goldenStart !== null ? 2.8 : (big ? 1.7 : 2.6), { match: mi }); at(ft.start + 2, 'crowd_end');
      if (m.replayGoal !== null) {
        const g = m.goals[m.replayGoal];
        const t0 = Math.max(0.2, g.t - 1.35), t1 = Math.min(m.endT, g.t + 0.55), speed = big ? 0.55 : 0.45;
        const rp = add('replay', (t1 - t0) / speed + (big ? 0.3 : 0.5), { match: mi, goal: m.replayGoal, t0, t1, speed });
        at(rp.start, 'replay_in');
        at(rp.start + ((g.t - t0) / speed) * FPS, 'replay_goal');
      }
      if (m.motm) { const mm = add('motm', big ? 2.5 : 3.0, { match: mi }); at(mm.start, 'swoosh'); }
      if (rd.key === 'F') return;
      const lastOfRound = mi === rd.ties[rd.ties.length - 1].legs[rd.ties[rd.ties.length - 1].legs.length - 1];
      const decides = tie.legs[tie.legs.length - 1] === mi;
      const nextName = ri + 1 < T.rounds.length ? T.rounds[ri + 1].name : null;
      const len = lastOfRound ? (big ? 3.6 : 4.0) : (big ? 1.6 : (decides ? 3.5 : 2.6));
      const b = add('bracket', len, { step: mi + 1, caption: lastOfRound && big && nextName ? `${nextName === 'FINAL' ? 'THE FINAL' : nextName} NEXT` : null });
      at(b.start, 'swoosh'); if (decides) at(b.start + 30, 'qualify');
    }));
  });
  const win = add('winner', 8.8, { team: T.champion }); at(win.start, 'fanfare'); at(win.start + 6, 'cheer'); chap(win, 'Champion and top scorers');
  return { fps: FPS, totalFrames: f, segments: segs, audio, chapters };
}
function titleCase(s) { return s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (x, a, b) => a + b.toUpperCase()).replace(/ Of /g, ' of ').replace(/-Finals?/, (x) => x.toLowerCase()); }

function logoPart(conf) { const r = require('./logos').prepareLogos(conf); return { logos: r.logos, logosMissing: r.missing }; }
function makeShow(conf, T) {
  const S = buildShow(T);
  const style = conf.competition.bracket_style || 'left_to_right';
  return Object.assign({
    geometryNote: 'design space 1280x720', configHash: conf.hash, simHash: conf.simHash,
    map: conf.map, audioCfg: conf.audio, atmoCfg: { trophy_v2: require('./config_loader').loadAtmosphere().trophy_v2 !== false }, // P10: only the trophy flag applies to cups
    bracketStyle: style, logosOnBalls: conf.rules.logos_on_balls !== false,
    cfg: { OMEGA: CFG.OMEGA, GAME_MIN_PER_SEC: conf.rules.GAME_MIN_PER_SEC, BALLS_PER_TEAM: conf.rules.BALLS_PER_TEAM, BALL_RADIUS: conf.rules.ball_radius || G.BALL_R, SHOW_SIM_LABEL: conf.rules.show_simulation_label === true },
    bracket: bracketSteps(T, style),
  }, logoPart(conf), T, S);
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
    rounds: T.rounds.map((rd) => ({ round: rd.name, ties: rd.ties.map((s) => ({ tie: `${TEAMS[s.ta].name} vs ${TEAMS[s.tb].name}`, l1: s.l1, l2: s.l2, agg: s.agg, score: s.score, golden: s.golden, winner: TEAMS[s.winner].name })) })),
    comebacks: T.comebacks, bracketNotes: T.bracketSeeding ? T.bracketSeeding.notes : [],
    final: { tie: `${TEAMS[T.final.ta].name} vs ${TEAMS[T.final.tb].name}`, score: T.final.score, golden: T.final.golden, winner: TEAMS[T.final.winner].name },
    matches: T.matches.map((m) => ({ stage: m.stage, leg: m.leg, teams: `${TEAMS[m.ta].name} vs ${TEAMS[m.tb].name}`, seed: m.seed, comeback: m.comeback_depth, score: m.score, added: m.addedTime,
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

// ---------- chapters + match index (P2) ----------
function fmtTime(sec) { sec = Math.floor(sec); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0'); }
// YouTube chapters: first at 0:00, ascending, >= 10 s apart (closer ones are merged into the previous line)
function chaptersText(show) {
  const out = [];
  for (const c of show.chapters) { if (out.length && c.t - out[out.length - 1].t < 10) continue; out.push(c); }
  out[0].t = 0;
  return out.map((c) => `${fmtTime(c.t)} ${c.title}`).join('\n') + '\n';
}
// matches_index.json: public part has no player names (metadata-safe); names only in the "internal" section.
function matchesIndex(show) {
  const T = show, FPS_ = show.fps;
  const segOf = (type, mi) => show.segments.find((x) => x.type === type && x.match === mi);
  const name = (ti) => T.teams[ti].name;
  const matches = [], internal = {};
  T.matches.forEach((m, mi) => {
    const id = m.leg === 'FINAL' ? 'F' : `${m.roundKey}${m.roundKey === 'R16' || m.stage.match(/\d/) ? '-T' + (m.tie + 1) : ''}-L${m.leg.slice(-1)}`;
    const pre = segOf('matchPre', mi), ms = segOf('match', mi);
    const blockEnd = (() => { const i = show.segments.indexOf(ms); let j = i + 1; while (j < show.segments.length && show.segments[j].match === mi) j++; const last = show.segments[j - 1]; return last.start + last.len; })();
    const gmin = (g) => window_minute(m, g.t, show.cfg.GAME_MIN_PER_SEC);
    const tie = T.rounds[m.round].ties[m.tie];
    matches.push({ id, index: mi, round: m.roundName, stage: m.stage, leg: m.leg, team_a: name(m.ta), team_b: name(m.tb), seed: m.seed, timeline_hash: m.hash,
      score: m.score, aggregate: m.agg, golden_ball: m.goldenStart !== null,
      winner: m.winnerSide ? name(m.winnerSide === 'A' ? m.ta : m.tb) : null,
      qualified: m.leg === 'LEG 2' || m.leg === 'FINAL' ? name(tie.winner) : null,
      goals: m.goals.map((g) => ({ team: name(g.team === 'A' ? m.ta : m.tb), minute: gmin(g), added_time_shot: !!g.shot, golden: !!g.golden })),
      comeback: m.comeback, comeback_depth: m.comeback_depth,
      start_s: +(pre.start / FPS_).toFixed(2), match_start_s: +(ms.start / FPS_).toFixed(2), match_end_s: +((ms.start + ms.len) / FPS_).toFixed(2), end_s: +(blockEnd / FPS_).toFixed(2) });
    internal[id] = { goals: m.goals.map((g) => ({ player: T.teams[g.team === 'A' ? m.ta : m.tb].players[g.player].name, minute: gmin(g) })),
      man_of_the_match: m.motm ? T.teams[m.motm.team === 'A' ? m.ta : m.tb].players[m.motm.player].name : null };
  });
  return { competition: T.competition.name, note: 'Computer simulation, not real results. Player names only in "internal" (never use them in titles, descriptions or tags).',
    total_s: +(show.totalFrames / FPS_).toFixed(2), configHash: show.configHash, champion: name(T.champion), matches, internal };
}
function window_minute(m, t, gmps) { return require('./clock').minuteLabel(m, t, gmps); }

module.exports = { buildTournament, buildShow, makeShow, buildAll, chaptersText, matchesIndex, fmtTime, comebackInfo, resultWinner, roundsFor, bracketSteps, strengthCtx, passesRules, manOfTheMatch, topScorers, teamsFromConf, pickReplayGoal };
if (require.main === module) {
  try {
    const comp = argVal('--competition', path.join(ROOT, 'config', 'competitions', 'demo_4teams.json'));
    const out = argVal('--out', path.join(ROOT, 'build', 'show.json'));
    const { summary } = buildAll(comp, path.resolve(out), { map: argVal('--map', undefined) });
    const s = Object.assign({}, summary); delete s.gateLog;
    console.log(JSON.stringify(s, null, 1));
  } catch (e) {
    if (e instanceof L.ConfigError) { console.error(e.message); process.exit(2); }
    throw e;
  }
}
