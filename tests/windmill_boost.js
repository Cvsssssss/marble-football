'use strict';
// Windmill boost measurement: N simulated matches with the boost and N with boost = 1.0 (same seeds).
// Reports mean launch speed and goal rate before/after game minute 70.
// Usage: node tests/windmill_boost.js [N] [boost]
const fs = require('fs');
const path = require('path');
const eng = require('../sim/engine');
const L = require('../sim/config_loader');

function measure(n, rulesCfg, seed0) {
  const s = { launchPre: [], launchPost: [], goalsPre: 0, goalsPost: 0, minPre: 0, minPost: 0, goalsPerMatch: [], over10: 0, under1: 0, failed: 0 };
  const from = rulesCfg.BOOST_FROM;
  for (let i = 0; i < n; i++) {
    const r = eng.simulateMatch(seed0 + i, { kind: 'leg1' }, rulesCfg);
    if (r.failed) { s.failed++; continue; }
    for (const l of r.launches) (l.gm < from ? s.launchPre : s.launchPost).push(l.v);
    for (const g of r.goals) { const gm = g.t * rulesCfg.GAME_MIN_PER_SEC; if (gm < from) s.goalsPre++; else s.goalsPost++; }
    s.minPre += from; s.minPost += 90 + r.addedTime - from;
    const tot = r.score.A + r.score.B; s.goalsPerMatch.push(tot);
    if (tot > rulesCfg.GOALS_MAX) s.over10++; if (tot < rulesCfg.GOALS_MIN) s.under1++;
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const m = s.goalsPerMatch.length;
  return {
    matches: m, failed: s.failed,
    meanLaunchSpeedBefore70: +mean(s.launchPre).toFixed(1), meanLaunchSpeedFrom70: +mean(s.launchPost).toFixed(1),
    launchesBefore: s.launchPre.length, launchesFrom70: s.launchPost.length,
    goalsPer10minBefore70: +(10 * s.goalsPre / s.minPre).toFixed(3), goalsPer10minFrom70: +(10 * s.goalsPost / s.minPost).toFixed(3),
    meanGoalsPerMatch: +mean(s.goalsPerMatch).toFixed(2), maxGoals: Math.max(...s.goalsPerMatch),
    pctOver10: +(100 * s.over10 / m).toFixed(2), pctZeroGoals: +(100 * s.under1 / m).toFixed(2),
  };
}

function main() {
  const n = +(process.argv[2] || 300);
  const conf = L.loadCompetition();
  const rc = L.rulesToCfg(conf.rules);
  if (process.argv[3]) rc.BOOST = +process.argv[3];
  const t0 = Date.now();
  const boosted = measure(n, rc, 900000);
  const base = measure(n, Object.assign({}, rc, { BOOST: 1.0 }), 900000);
  const res = { n, boost: rc.BOOST, ramp: rc.BOOST_RAMP, withBoost: boosted, noBoost: base,
    launchSpeedGainPct: +(100 * (boosted.meanLaunchSpeedFrom70 / boosted.meanLaunchSpeedBefore70 - 1)).toFixed(1),
    goalRateGainPct: +(100 * (boosted.goalsPer10minFrom70 / boosted.goalsPer10minBefore70 - 1)).toFixed(1), secs: (Date.now() - t0) / 1000 };
  fs.mkdirSync(path.join(__dirname, '..', 'build'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'windmill_boost.json'), JSON.stringify(res, null, 2));
  console.log(JSON.stringify(res, null, 1));
}
module.exports = { measure };
if (require.main === module) main();
