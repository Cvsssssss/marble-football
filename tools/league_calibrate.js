'use strict';
// P7 §3: calibration of the league strength model with the REAL engine (headless, no rendering).
//   node tools/league_calibrate.js [--seeds 220] [--reuse] [--search] [--seasons 5000]
// 1. engine grid: for edge = 0, 0.1 .. 0.9, `seeds` seeds x 2 sides (favourite = A, then B): score histograms of
//    (favourite goals, underdog goals) after the technical gate (rejected runs are counted, never chosen by outcome)
// 2. engine season: the 380 real fixtures once with the configured beta / home advantage (single-match targets + home share)
// 3. Monte-Carlo: `seasons` seasons on the real fixtures with scores sampled from the grid (sim/league/strength.js)
//    -> season targets. --search: grid search of beta / home_advantage, prints the best values.
// Writes league/<id>/calibration.json (compact: histograms and numbers only).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const LC = require('../sim/league/config');
const ST = require('../sim/league/strength');
const SEASON = require('../sim/league/season');
const { runPool } = require('../sim/league/pool');
const { mulberry32 } = require('../sim/engine');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);

const EDGES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const TARGETS = {
  single: { avgGoals: [2.5, 3.2], draws: [0.18, 0.28], nilNilMax: 0.08, homeWin: [0.40, 0.50] },
  season: { share: 0.9, champion: [68, 95], last: [15, 40], gapMw15: [14, 30], topTitle: [0.20, 0.45], topLossesMin: 2 },
};

async function engineGrid(C, nSeeds) {
  const jobs = [];
  for (const e of EDGES) for (let i = 0; i < nSeeds; i++) for (const f of ['A', 'B']) {
    jobs.push({ seed: 7000000 + Math.round(e * 10) * 10000 + i, ctx: Object.assign({ kind: 'league', rA: C.rc.BALL_RADIUS, rB: C.rc.BALL_RADIUS }, e > 0 ? { fav: f, edge: e } : {}), cfg: C.rc, e, f });
  }
  const res = await runPool(jobs);
  const grid = EDGES.map((e) => ({ edge: e, n: 0, rejected: 0, hist: {}, W: 0, D: 0, L: 0, goals: 0, nil: 0 }));
  res.forEach((r, k) => {
    const j = jobs[k], g = grid[EDGES.indexOf(j.e)];
    if (r.gate) { g.rejected++; return; }
    const fg = j.f === 'A' ? r.A : r.B, dg = j.f === 'A' ? r.B : r.A;
    g.n++; g.hist[`${fg}-${dg}`] = (g.hist[`${fg}-${dg}`] || 0) + 1; g.goals += fg + dg; if (fg + dg === 0) g.nil++;
    if (fg > dg) g.W++; else if (fg === dg) g.D++; else g.L++;
  });
  for (const g of grid) { for (const k of ['W', 'D', 'L']) g[k] = +(g[k] / g.n).toFixed(4); g.avgGoals = +(g.goals / g.n).toFixed(3); g.nilNil = +(g.nil / g.n).toFixed(4); delete g.goals; delete g.nil; }
  return { matches: jobs.length, grid };
}
// least squares y = a + b x
function linfit(xs, ys) { const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n; let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; }); const b = sxy / sxx; return { a: +(my - b * mx).toFixed(4), b: +b.toFixed(4) }; }

async function engineSeason(C, fixtures, strength) {
  const jobs = [];
  fixtures.weeks.forEach((wk, w) => wk.forEach((m, i) => {
    const s = SEASON.matchSeed(C.league.season_seed, w + 1, i, 0);
    jobs.push({ seed: s, ctx: ST.leagueCtx(strength, C.ratings[C.ids.indexOf(m.home)], C.ratings[C.ids.indexOf(m.away)], C.rc.BALL_RADIUS), cfg: C.rc, m });
  }));
  const res = await runPool(jobs);
  let n = 0, rej = 0, goals = 0, dr = 0, nil = 0, hw = 0, aw = 0;
  res.forEach((r) => { if (r.gate) { rej++; return; } n++; goals += r.A + r.B; if (r.A === r.B) dr++; if (r.A + r.B === 0) nil++; if (r.A > r.B) hw++; if (r.B > r.A) aw++; });
  return { matches: jobs.length, accepted: n, rejectedByTechnicalGate: rej, avgGoals: +(goals / n).toFixed(3), draws: +(dr / n).toFixed(4), nilNil: +(nil / n).toFixed(4), homeWin: +(hw / n).toFixed(4), awayWin: +(aw / n).toFixed(4) };
}

// Monte-Carlo seasons on the real fixtures (sampled scores). Returns the season metrics.
function monteCarlo(C, fixtures, strength, sampler, nSeasons, seed) {
  const rng = mulberry32(seed >>> 0);
  const idx = new Map(C.ids.map((c, i) => [c, i]));
  const top = C.ratings.indexOf(Math.max(...C.ratings));
  const M = { champion: [], last: [], gap15: [], topTitle: 0, topLosses: [], flatWeek: 0, lateUpsets: 0, homeWin: 0, draws: 0, n: 0, goals: 0 };
  for (let s = 0; s < nSeasons; s++) {
    const pts = new Array(20).fill(0), gd = new Array(20).fill(0), gf = new Array(20).fill(0); let topL = 0, flat = false;
    fixtures.weeks.forEach((wk, w) => {
      for (const m of wk) {
        const h = idx.get(m.home), a = idx.get(m.away);
        const [hg, ag] = ST.sampleMatch(sampler, strength, C.ratings[h], C.ratings[a], rng);
        M.n++; M.goals += hg + ag; if (hg > ag) M.homeWin++; if (hg === ag) M.draws++;
        gf[h] += hg; gf[a] += ag; gd[h] += hg - ag; gd[a] += ag - hg;
        if (hg > ag) pts[h] += 3; else if (ag > hg) pts[a] += 3; else { pts[h]++; pts[a]++; }
        if ((h === top && hg < ag) || (a === top && ag < hg)) topL++;
        if (w === 37) { const fav = C.ratings[h] >= C.ratings[a] ? h : a; const dog = fav === h ? a : h; const fg = fav === h ? hg : ag, dg = fav === h ? ag : hg; if (dg > fg && C.ratings[fav] - C.ratings[dog] > 0.4) M.lateUpsets++; }
      }
      if (w >= 9) { const sp = Math.max(...pts) - Math.min(...pts); if (sp < 6) flat = true; }
      if (w === 14) M.gap15.push(Math.max(...pts) - Math.min(...pts));
    });
    const order = [...Array(20).keys()].sort((a, b) => pts[b] - pts[a] || gd[b] - gd[a] || gf[b] - gf[a] || a - b);
    M.champion.push(pts[order[0]]); M.last.push(pts[order[19]]); if (order[0] === top) M.topTitle++; M.topLosses.push(topL); if (flat) M.flatWeek++;
  }
  const inR = (arr, [lo, hi]) => +(arr.filter((x) => x >= lo && x <= hi).length / arr.length).toFixed(4);
  const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.floor(p * (a.length - 1))]; };
  const T = TARGETS.season;
  const out = {
    seasons: nSeasons,
    champion: { inRange: inR(M.champion, T.champion), p05: q(M.champion, 0.05), median: q(M.champion, 0.5), p95: q(M.champion, 0.95) },
    last: { inRange: inR(M.last, T.last), p05: q(M.last, 0.05), median: q(M.last, 0.5), p95: q(M.last, 0.95) },
    gapAfterMw15: { inRange: inR(M.gap15, T.gapMw15), p05: q(M.gap15, 0.05), median: q(M.gap15, 0.5), p95: q(M.gap15, 0.95) },
    topRatedTitleShare: +(M.topTitle / nSeasons).toFixed(4),
    topRatedLosesAtLeast2: +(M.topLosses.filter((x) => x >= T.topLossesMin).length / nSeasons).toFixed(4), topRatedLossesMedian: q(M.topLosses, 0.5),
    seasonsWithFlatTableAfterMw10: +(M.flatWeek / nSeasons).toFixed(4),
    lastWeekUpsetsPerSeason: +(M.lateUpsets / nSeasons).toFixed(3),
    single: { avgGoals: +(M.goals / M.n).toFixed(3), homeWin: +(M.homeWin / M.n).toFixed(4), draws: +(M.draws / M.n).toFixed(4) },
  };
  out.pass = {
    champion: out.champion.inRange >= T.share, last: out.last.inRange >= T.share, gapAfterMw15: out.gapAfterMw15.inRange >= T.share,
    topRatedTitleShare: out.topRatedTitleShare >= T.topTitle[0] && out.topRatedTitleShare <= T.topTitle[1], topRatedLosesAtLeast2: out.topRatedLosesAtLeast2 >= T.share,
  };
  return out;
}
const score = (r) => Object.values(r.pass).filter(Boolean).length - Math.abs(r.single.homeWin - 0.45) - 0.5 * Math.max(0, 0.9 - r.champion.inRange) - 0.5 * Math.max(0, 0.9 - r.last.inRange) - 0.5 * Math.max(0, 0.9 - r.gapAfterMw15.inRange) - Math.abs(r.topRatedTitleShare - 0.32);

async function main() {
  const C = LC.loadLeague();
  const fixtures = SEASON.fixtureWeeks(SEASON.loadOrCreateFixtures(C));
  const outF = path.join(ROOT, 'league', C.league.id, 'calibration.json');
  const old = fs.existsSync(outF) ? JSON.parse(fs.readFileSync(outF, 'utf8')) : null;
  const t0 = Date.now();
  let grid;
  if (has('--reuse') && old && old.engine_grid) grid = old.engine_grid;
  else { grid = await engineGrid(C, +arg('--seeds', 220)); console.log(`engine grid: ${grid.matches} matches in ${((Date.now() - t0) / 1000).toFixed(0)} s`); }
  const fit = { favWin: linfit(grid.grid.map((g) => g.edge), grid.grid.map((g) => g.W)), draw: linfit(grid.grid.map((g) => g.edge), grid.grid.map((g) => g.D)), favLoss: linfit(grid.grid.map((g) => g.edge), grid.grid.map((g) => g.L)) };
  const sampler = ST.makeSampler(grid);
  const nS = +arg('--seasons', 5000);
  let strength = C.league.strength;
  let search = null;
  if (has('--search')) {
    search = [];
    const betas = arg('--betas', '0.3,0.4,0.5,0.6,0.7,0.8').split(',').map(Number), homes = arg('--homes', '0.04,0.07,0.1,0.13,0.16').split(',').map(Number);
    const comps = arg('--compress', 'none').split(',').map((x) => (x === 'none' ? null : { above: +x.split(':')[0], factor: +x.split(':')[1] }));
    for (const beta of betas) for (const home of homes) for (const tc of comps) {
      const s = Object.assign({ beta, home_advantage: home, edge_max: strength.edge_max }, tc ? { top_compress: tc } : {});
      const r = monteCarlo(C, fixtures, s, sampler, 800, 99);
      search.push({ beta, home, compress: tc, score: +score(r).toFixed(3), pass: Object.values(r.pass).filter(Boolean).length, homeWin: r.single.homeWin, champIn: r.champion.inRange, lastIn: r.last.inRange, champ: r.champion.median, last: r.last.median, gap: r.gapAfterMw15.median, top: r.topRatedTitleShare });
    }
    search.sort((a, b) => b.score - a.score);
    console.log('search (best 6, 800 seasons each):'); search.slice(0, 6).forEach((x) => console.log('  ' + JSON.stringify(x)));
  }
  const mc = monteCarlo(C, fixtures, strength, sampler, nS, 12345);
  const season = has('--no-engine-season') ? (old && old.engine_season) : await engineSeason(C, fixtures, strength);
  const cal = {
    _comment: 'P7 calibration (tools/league_calibrate.js). engine_grid = real engine, headless; monte_carlo = seasons sampled from the grid on the real fixtures.',
    created: new Date().toISOString().slice(0, 10), rules: C.league.rules, release_interval: C.rules.release_interval, strength,
    targets: TARGETS, engine_grid: grid, fit, engine_season: season, monte_carlo: mc, search: search ? search.slice(0, 10) : (old && old.search) || null,
    assumptions: [
      'Each league match is an independent draw from the engine score distribution at its edge (no form, injuries or fatigue).',
      'Scores between grid edges: mixture of the two nearest grid histograms (linear weights).',
      'Ratings are fixed for the whole season (2025/26 points per game; promoted clubs = weakest club that stayed up).',
      'Technical gate (stuck balls, 0-9 goals, failures) applied before counting; never a choice by outcome.',
    ],
  };
  fs.writeFileSync(outF, JSON.stringify(cal, null, 1) + '\n');
  console.log('grid W/D/L by edge: ' + grid.grid.map((g) => `${g.edge}:${g.W}/${g.D}/${g.L} g${g.avgGoals}`).join('  '));
  console.log('engine season: ' + JSON.stringify(season));
  console.log('monte carlo: ' + JSON.stringify(mc));
  console.log(`-> ${path.relative(ROOT, outF)}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
module.exports = { monteCarlo, TARGETS, EDGES };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
