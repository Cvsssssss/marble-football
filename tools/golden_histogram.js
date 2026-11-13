'use strict';
// P6: golden-ball histogram over N simulated tournaments (timeline simulator only, no rendering).
//   node tools/golden_histogram.js [N=200] [workers=10] [out=build/p6_golden_hist.json]
// Tournament k uses competition k % 4 with seed_salt 300 + k and its own draw seed, so every tournament is different.
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const ROOT = path.join(__dirname, '..');
const COMPS = ['ucl_2026_top16', 'uel_top16', 'nations_world_16', 'nations_euro_16'];

function one(k) {
  const L = require('../sim/config_loader');
  const T = require('../sim/tournament');
  const conf = L.loadCompetition(path.join(ROOT, 'config', 'competitions', COMPS[k % 4] + '.json'));
  conf.competition.seed_salt = 300 + k;
  conf.drawSeed = 7919 * (k + 1);
  const tour = T.buildTournament(conf, { budget: 300 });
  const show = T.buildShow(tour);
  const golden = tour.matches.filter((m) => m.goldenStart !== null).length;
  const early = tour.matches.filter((m) => m.round <= 1 && m.comeback).length;
  const badScorer = tour.matches.reduce((n, m) => n + m.goals.filter((g) => { const t = tour.teams[g.team === 'A' ? m.ta : m.tb]; return !t.players[g.player]; }).length, 0);
  return { k, comp: COMPS[k % 4], golden, earlyComebacks: early, minutes: +(show.totalFrames / show.fps / 60).toFixed(2), goals: tour.matches.reduce((n, m) => n + m.goals.length, 0), badScorer };
}

if (process.argv[2] === '--child') {
  process.on('message', (ks) => { const out = ks.map(one); process.send(out); process.exit(0); });
} else if (require.main === module) {
  const N = +(process.argv[2] || 200), W = +(process.argv[3] || 10), outF = path.resolve(ROOT, process.argv[4] || 'build/p6_golden_hist.json');
  const parts = Array.from({ length: W }, () => []);
  for (let k = 0; k < N; k++) parts[k % W].push(k);
  const t0 = Date.now();
  Promise.all(parts.map((ks) => new Promise((res, rej) => { const c = fork(__filename, ['--child']); c.on('message', res); c.on('error', rej); c.send(ks); }))).then((rs) => {
    const all = rs.flat().sort((a, b) => a.k - b.k);
    const hist = {}; all.forEach((r) => { hist[r.golden] = (hist[r.golden] || 0) + 1; });
    const mean = all.reduce((s, r) => s + r.golden, 0) / all.length;
    const mins = all.map((r) => r.minutes).sort((a, b) => a - b);
    const res = { N: all.length, hist, mean: +mean.toFixed(3), noComeback: all.filter((r) => r.earlyComebacks === 0).length, badScorer: all.reduce((s, r) => s + r.badScorer, 0),
      minutes: { min: mins[0], p50: mins[Math.floor(mins.length / 2)], max: mins[mins.length - 1] }, seconds: Math.round((Date.now() - t0) / 1000), runs: all };
    fs.mkdirSync(path.dirname(outF), { recursive: true }); fs.writeFileSync(outF, JSON.stringify(res, null, 1));
    console.log('golden per tournament histogram', JSON.stringify(hist), 'mean', res.mean, 'no-comeback', res.noComeback, 'minutes', JSON.stringify(res.minutes), 'time', res.seconds + 's');
  });
}
module.exports = { one };
