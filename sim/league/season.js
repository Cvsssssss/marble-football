'use strict';
// P7 §4: season state and matchweek workflow (no rendering here).
//   league/<id>/fixtures.json        generated once (sim/league/fixtures.js)
//   league/<id>/state.json           next matchweek, generated weeks, map per week, table after the last week
//   league/<id>/results/week_NN.json scores, scorers, goal events, timeline hash, seeds, standings after the week
// Seeds: matchSeed(season_seed, week, match index, attempt). attempt > 0 only when the run failed the TECHNICAL gate
// (stuck ball, engine failure, > 9 goals, wrong shot count); a seed is never chosen for its outcome.
// Only the latest generated week can be regenerated; earlier weeks are locked (the table carries on from them).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const F = require('./fixtures');
const ST = require('./strength');
const TB = require('./standings');
const { mulberry32 } = require('../engine');
const ROOT = path.join(__dirname, '..', '..');
const MAX_ATTEMPTS = 40;

class LeagueError extends Error {}
const pad = (n) => String(n).padStart(2, '0');
const leagueDir = (C, opts) => (opts && opts.dir) || path.join(ROOT, 'league', C.league.id);
const readJ = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);
const writeJ = (f, j) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(j, null, 1) + '\n'); };
const sha = (x) => crypto.createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');

function matchSeed(seasonSeed, week, idx, attempt) {
  return parseInt(sha(`${seasonSeed}|w${week}|m${idx}|a${attempt}`).slice(0, 8), 16) >>> 0;
}

// fixtures are made once and then only read (a different club list / seed is an error, never a silent rebuild)
function loadOrCreateFixtures(C, opts) {
  const f = path.join(leagueDir(C, opts), 'fixtures.json');
  const key = sha({ clubs: C.ids, ratings: C.ratings, seed: C.league.season_seed });
  const old = readJ(f, null);
  if (old) {
    if (old.key !== key) throw new LeagueError(`fixtures.json was made for another club list / seed; delete ${path.relative(ROOT, f)} only before matchweek 1`);
    return old;
  }
  const fx = F.generateFixtures(C.ids, C.ratings, C.league.season_seed);
  const errs = F.checkFixtures(fx, C.ids, C.ratings);
  if (errs.length) throw new LeagueError('fixtures invalid: ' + errs.join('; '));
  const out = { league: C.league.id, season: C.league.season, key, generated: new Date().toISOString().slice(0, 10), meta: fx.meta, weeks: fx.weeks.map((wk, w) => ({ week: w + 1, matches: wk })) };
  writeJ(f, out);
  return out;
}
const fixtureWeeks = (fx) => ({ weeks: fx.weeks.map((w) => w.matches) });

function loadState(C, opts) {
  return readJ(path.join(leagueDir(C, opts), 'state.json'), { league: C.league.id, season: C.league.season, next_week: 1, last_generated_week: 0, weeks: [], table: null });
}
function resultsFile(C, week, opts) { return path.join(leagueDir(C, opts), 'results', `week_${pad(week)}.json`); }
function allResults(C, upTo, opts) {
  const out = [];
  for (let w = 1; w <= upTo; w++) { const r = readJ(resultsFile(C, w, opts), null); if (!r) throw new LeagueError(`missing results for matchweek ${w}`); out.push(...r.matches.map((m) => ({ home: m.home, away: m.away, hg: m.hg, ag: m.ag }))); }
  return out;
}

// maps for the league: premier_* maps first (P7 §7, when they exist), then the others; default = next one after
// last week's map in that list (so the same map is not repeated week after week), starting at default_map.
function mapChoices(C) {
  const dir = path.join(ROOT, 'config', 'maps');
  const ids = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'default.json').map((f) => f.slice(0, -5));
  const prem = ids.filter((x) => x.startsWith('premier')), other = ids.filter((x) => !x.startsWith('premier'));
  return prem.length ? prem.concat(other) : other;
}
function defaultMap(C, state, choices) {
  choices = choices || mapChoices(C);
  const last = state.weeks.length ? state.weeks[state.weeks.length - 1].map : null;
  const prem = choices.filter((x) => x.startsWith('premier'));
  const pool = prem.length >= 2 ? prem : prem.length === 1 ? null : choices; // one premier map: always it (its backgrounds vary in §7)
  if (!pool) return prem[0];
  const start = choices.includes(C.league.default_map) ? C.league.default_map : choices.includes(C.league.fallback_map) ? C.league.fallback_map : pool[0];
  if (!last) return pool.includes(start) ? start : pool[0];
  const i = pool.indexOf(last);
  return pool[(i + 1) % pool.length];
}

// ---- one matchweek ----
// mode 'engine' = real engine (headless, worker pool); 'stub' = fitted model (dry runs / tests, flagged stub: true)
async function simulateWeek(C, fx, week, opts) {
  opts = opts || {};
  const wk = fx.weeks[week - 1].matches;
  const R = C.rc.BALL_RADIUS;
  const byId = new Map(C.teams.map((t) => [t.id, t]));
  const rat = (id) => C.ratings[C.ids.indexOf(id)];
  const scorerOf = (club, ball) => { const t = byId.get(club); const p = t.players[ball >> 1]; return { player: ball >> 1, scorer: p.name, scorer_team: p.team }; };
  const out = [];
  if (opts.mode === 'stub') {
    const cal = opts.calibration || readJ(path.join(ROOT, 'league', C.league.id, 'calibration.json'), null);
    if (!cal) throw new LeagueError('stub mode needs league/<id>/calibration.json (run tools/league_calibrate.js)');
    const sampler = ST.makeSampler(cal.engine_grid);
    wk.forEach((m, i) => {
      const seed = matchSeed(C.league.season_seed, week, i, 0), rng = mulberry32(seed);
      const [hg, ag] = ST.sampleMatch(sampler, C.league.strength, rat(m.home), rat(m.away), rng);
      const goals = [];
      for (let k = 0; k < hg + ag; k++) goals.push({ side: k < hg ? 'home' : 'away', t: +(rng() * 50).toFixed(2), shot: null, ball: (k < hg ? 0 : 1) + 2 * Math.floor(rng() * 3) });
      goals.sort((a, b) => a.t - b.t);
      out.push(finishMatch(m, i, seed, 0, `stub-${seed}`, goals, hg, ag, ST.edgeFor(C.league.strength, rat(m.home), rat(m.away)), null, scorerOf));
    });
    return out;
  }
  const { runPool } = require('./pool');
  let pending = wk.map((m, i) => ({ m, i, attempt: 0 }));
  const done = new Array(wk.length);
  while (pending.length) {
    const jobs = pending.map((p) => ({ seed: matchSeed(C.league.season_seed, week, p.i, p.attempt), ctx: ST.leagueCtx(C.league.strength, rat(p.m.home), rat(p.m.away), R), cfg: C.rc }));
    const res = await runPool(jobs, opts.workers);
    const next = [];
    res.forEach((r, k) => {
      const p = pending[k];
      if (r.gate) { if (p.attempt + 1 >= MAX_ATTEMPTS) throw new LeagueError(`match ${p.m.home}-${p.m.away}: ${MAX_ATTEMPTS} seeds failed the technical gate`); next.push(Object.assign({}, p, { attempt: p.attempt + 1, lastGate: r.gate })); return; }
      const goals = r.goals.map((g) => ({ side: g.team === 'A' ? 'home' : 'away', t: g.t, shot: g.shot, ball: g.ball }));
      done[p.i] = finishMatch(p.m, p.i, r.seed, p.attempt, r.hash, goals, r.A, r.B, ST.edgeFor(C.league.strength, rat(p.m.home), rat(p.m.away)), r.addedTime, scorerOf);
    });
    pending = next;
  }
  return done;
}
function finishMatch(m, i, seed, attempt, hash, goals, hg, ag, E, addedTime, scorerOf) {
  return {
    idx: i, home: m.home, away: m.away, hg, ag, seed, attempt, timeline_hash: hash, added_time: addedTime,
    strength: { fav: E.fav ? (E.fav === 'A' ? 'home' : 'away') : null, edge: E.edge },
    goals: goals.map((g) => Object.assign({ side: g.side, club: g.side === 'home' ? m.home : m.away, t: g.t, minute: g.shot ? `90+${g.shot}'` : `${Math.max(1, Math.floor(g.t * 2) + 1)}'`, shot: g.shot || null, ball: g.ball },
      scorerOf(g.side === 'home' ? m.home : m.away, g.ball))),
  };
}

// every goal's scorer must be a player of the scoring club (CLAUDE.md) -> throws
function assertWeekScorers(C, wr) {
  const byId = new Map(C.teams.map((t) => [t.id, t]));
  const bad = [];
  for (const m of wr.matches) for (const g of m.goals) {
    const t = byId.get(g.club);
    if (!t || !t.players.some((p) => p.name === g.scorer && p.team === t.name) || g.scorer_team !== t.name) bad.push(`${m.home}-${m.away}: ${g.scorer} (${g.scorer_team}) for ${g.club}`);
    if ((g.side === 'home' ? m.home : m.away) !== g.club) bad.push(`${m.home}-${m.away}: goal side/club mismatch`);
  }
  if (bad.length) throw new LeagueError('scorer does not belong to the scoring club: ' + bad.join('; '));
  return true;
}

// plays (or regenerates) matchweek `week`, saves results + state. opts: { mode, map, regenerate, dir }
async function playWeek(C, week, opts) {
  opts = opts || {};
  const fx = loadOrCreateFixtures(C, opts);
  const state = loadState(C, opts);
  if (!Number.isInteger(week) || week < 1 || week > F.WEEKS) throw new LeagueError(`matchweek must be 1..${F.WEEKS}`);
  const isNew = week === state.next_week, isRegen = week === state.last_generated_week && state.last_generated_week > 0;
  if (!isNew && !isRegen) {
    if (week < state.last_generated_week) throw new LeagueError(`matchweek ${week} is locked: only the last generated matchweek (${state.last_generated_week}) can be regenerated`);
    throw new LeagueError(`next matchweek is ${state.next_week}; matchweeks are played in order`);
  }
  if (isNew && state.next_week > F.WEEKS) throw new LeagueError('the season is over');
  const map = opts.map || (isRegen ? state.weeks[state.weeks.length - 1].map : defaultMap(C, state));
  const matches = await simulateWeek(C, fx, week, opts);
  const before = allResults(C, week - 1, opts);
  const weekRes = matches.map((m) => ({ home: m.home, away: m.away, hg: m.hg, ag: m.ag }));
  const tableAfter = TB.table(C.ids, before.concat(weekRes), C.league);
  const prevTable = TB.table(C.ids, before, C.league);
  const prevPos = new Map(prevTable.map((r) => [r.id, r.pos]));
  const wr = {
    league: C.league.id, season: C.league.season, week, map, mode: opts.mode === 'stub' ? 'stub' : 'engine', stub: opts.mode === 'stub', generated_at: new Date().toISOString(),
    rules: C.league.rules, strength: C.league.strength, matches,
    standings: tableAfter.map((r) => Object.assign({}, r, { prev_pos: week === 1 ? null : prevPos.get(r.id) })),
  };
  assertWeekScorers(C, wr);
  wr.results_hash = sha(matches.map((m) => [m.home, m.away, m.hg, m.ag, m.seed, m.timeline_hash])).slice(0, 16);
  writeJ(resultsFile(C, week, opts), wr);
  const entry = { week, map, generated_at: wr.generated_at, results_hash: wr.results_hash, mode: wr.mode };
  if (isRegen) { state.weeks[state.weeks.length - 1] = Object.assign(entry, { regenerated: (state.weeks[state.weeks.length - 1].regenerated || 0) + 1 }); }
  else { state.weeks.push(entry); state.last_generated_week = week; state.next_week = week + 1; }
  state.table = tableAfter.map((r) => ({ pos: r.pos, id: r.id, p: r.p, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, gd: r.gd, pts: r.pts, form: r.form, zone: r.zone }));
  state.updated = wr.generated_at;
  writeJ(path.join(leagueDir(C, opts), 'state.json'), state);
  return { results: wr, state, regenerated: isRegen };
}

function status(C, opts) {
  const state = loadState(C, opts);
  return { next_week: state.next_week, last_generated_week: state.last_generated_week, season_over: state.next_week > F.WEEKS, table: state.table, weeks: state.weeks };
}

module.exports = { matchSeed, loadOrCreateFixtures, fixtureWeeks, loadState, playWeek, simulateWeek, status, allResults, mapChoices, defaultMap, assertWeekScorers, resultsFile, leagueDir, LeagueError, MAX_ATTEMPTS };
