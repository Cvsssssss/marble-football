'use strict';
// P8: timeline hashes of the 5 cup competitions (3 seeds each, real rules + strength ctx) + their simHash.
// tests/p8_tests.js asserts they equal tests/fixtures/p8_cup_hashes.json (recorded before the P8 changes).
const path = require('path');
const fs = require('fs');
const L = require('../sim/config_loader');
const { simulateMatch } = require('../sim/engine');
const DIR = path.join(__dirname, '..', 'config', 'competitions');
function cupHashes() {
  const out = {};
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json')).sort()) {
    const conf = L.loadCompetition(path.join(DIR, f), { skipPlayerCheck: true });
    const rc = L.rulesToCfg(conf.rules);
    const R = rc.BALL_RADIUS;
    out[f] = { simHash: conf.simHash, matches: [11, 222, 3333].map((s, k) => simulateMatch(s, k === 1 ? { rA: R, rB: R, fav: 'A', edge: rc.STRENGTH_EDGE } : { rA: R, rB: R }, rc).hash.slice(0, 16)) };
  }
  return out;
}
module.exports = { cupHashes };
if (require.main === module) {
  const o = process.argv.indexOf('--out'); const h = cupHashes();
  if (o >= 0) fs.writeFileSync(process.argv[o + 1], JSON.stringify(h, null, 1) + '\n');
  console.log(JSON.stringify(h).slice(0, 300));
}
