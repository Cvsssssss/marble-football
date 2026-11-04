'use strict';
// P5 diagnostics over a whole tournament (uses the seed cache of that competition, never renders anything).
//   node tools/p5_diag.js [competition.json] [outFile]
// Writes per added-time shot: contact speed/direction, trigger on/off, closest approach to the goal mouth, outcome;
// plus crossbar / platform penetration per frame. Used for the P5 before/after numbers.
const fs = require('fs');
const path = require('path');
const L = require('../sim/config_loader');
const T = require('../sim/tournament');
const G = require('../sim/geometry');
const GH = require('../sim/good_hit');

const ROOT = path.join(__dirname, '..');
const compFile = process.argv[2] || path.join(ROOT, 'config', 'competitions', 'ucl_2026_top16.json');
const outFile = process.argv[3] || path.join(ROOT, 'build', 'p5_diag.json');
const conf = L.loadCompetition(compFile);
const cacheFile = path.join(ROOT, 'build', 'cache', `seeds_${conf.simHash}.json`);
const seedCache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
console.log('simHash', conf.simHash, 'cached seeds', Object.keys(seedCache).length);
const t0 = Date.now();
const TT = T.buildTournament(conf, { seedCache, cfgExtra: { KEEP_FINE: true } });
if (!Object.keys(seedCache).length) { fs.mkdirSync(path.dirname(cacheFile), { recursive: true }); fs.writeFileSync(cacheFile, JSON.stringify(TT.usedSeeds)); }
console.log('built', TT.matches.length, 'matches in', ((Date.now() - t0) / 1000).toFixed(1), 's');
const res = { comp: path.basename(compFile), simHash: conf.simHash, matches: TT.matches.length, shots: [], bar: null, plat: null, goals: [] };
const pen = GH.penetrationScan(TT.matches);
res.bar = pen.bar; res.plat = pen.plat;
TT.matches.forEach((m, mi) => {
  res.goals.push(m.score[0] + m.score[1]);
  for (const row of GH.shotTruth(m)) res.shots.push(Object.assign({ match: mi }, row));
});
res.confusion = GH.confusion(res.shots);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(res, null, 1));
console.log('confusion', JSON.stringify(res.confusion));
console.log('bar', JSON.stringify(res.bar.summary), 'plat', JSON.stringify(res.plat.summary));
console.log('comebacks R16/QF', JSON.stringify(TT.comebacks || null));
console.log('goals/match avg', (res.goals.reduce((a, b) => a + b, 0) / res.goals.length).toFixed(2));
