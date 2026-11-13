'use strict';
// P8 §1: launch cadence diagnosis. UCL vs league: interval between consecutive spout pops in REAL seconds
// (regular play, normal windmill speed = before the boost ramp starts) and the match timeline length.
//   node tools/p8_cadence.js [--seeds 60] [--out build/p8/cadence.json]
const fs = require('fs');
const path = require('path');
const L = require('../sim/config_loader');
const LC = require('../sim/league/config');
const ST = require('../sim/league/strength');
const { simulateMatch } = require('../sim/engine');
const TOUR = require('../sim/tournament');
const FPS = require('../sim/config').FPS;

function stats(xs) {
  const a = xs.slice().sort((p, q) => p - q), n = a.length, q = (p) => a[Math.min(n - 1, Math.floor(p * (n - 1)))];
  return { n, mean: +(a.reduce((s, x) => s + x, 0) / n).toFixed(3), p10: +q(0.1).toFixed(3), median: +q(0.5).toFixed(3), p90: +q(0.9).toFixed(3) };
}
// one competition: pops in regular play before the windmill boost ramp (same speed phase for both)
function measure(cfg, ctxOf, seeds) {
  const iv = [], dur = [], play = [], reg = [];
  for (const seed of seeds) {
    const r = simulateMatch(seed, ctxOf(seed), cfg);
    const tRamp = cfg.BOOST_RAMP[0] / cfg.GAME_MIN_PER_SEC;
    const pops = r.events.filter((e) => e.type === 'pop' && e.t < tRamp && e.t < r.regEnd).map((e) => e.t);
    for (let i = 1; i < pops.length; i++) iv.push(pops[i] - pops[i - 1]);
    dur.push(r.frames.length / FPS); play.push(r.regEnd); reg.push(r.endReg);
  }
  return { gameMinPerSec: cfg.GAME_MIN_PER_SEC, releaseInterval: cfg.RELEASE_INTERVAL || require('../sim/config').RELEASE_INTERVAL, popInterval_s: stats(iv), timeline_s: stats(dur), untilFinalWhistleNoGolden_s: stats(reg), regularPlay_s: play[0] };
}
function run(nSeeds) {
  const seeds = Array.from({ length: nSeeds }, (_, i) => 910000 + i);
  const conf = L.loadCompetition(path.join(__dirname, '..', 'config', 'competitions', 'ucl_2026_top16.json'), { skipPlayerCheck: true });
  const ucfg = L.rulesToCfg(conf.rules);
  const C = LC.loadLeague(undefined, { skipPlayerCheck: true });
  const R = C.rc.BALL_RADIUS;
  const ucl = measure(ucfg, () => ({ rA: R, rB: R }), seeds);
  const league = measure(C.rc, () => ST.leagueCtx(C.league.strength, C.ratings[0], C.ratings[1], R), seeds);
  return { ucl, league };
}
module.exports = { run, measure, stats };
if (require.main === module) {
  const a = process.argv.slice(2), i = a.indexOf('--seeds'), o = a.indexOf('--out');
  const res = run(i >= 0 ? +a[i + 1] : 60);
  console.log(JSON.stringify(res));
  if (o >= 0) fs.writeFileSync(a[o + 1], JSON.stringify(res, null, 1));
}
