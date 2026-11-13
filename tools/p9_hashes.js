'use strict';
// P9: art-only phase. Timeline hashes that must stay identical: the 5 cup competitions (tools/p8_hashes.js) and
// 4 league matches with the real league rules + strength (recorded BEFORE any P9 change in tests/fixtures/p9_hashes.json).
const fs = require('fs');
const { cupHashes } = require('./p8_hashes');
const { simulateMatch } = require('../sim/engine');
const LC = require('../sim/league/config');
const ST = require('../sim/league/strength');
function leagueHashes() {
  const C = LC.loadLeague(), R = C.rc.BALL_RADIUS;
  return [[0, 1, 101], [2, 3, 2026], [4, 5, 77777], [6, 7, 424242]].map(([a, b, seed]) =>
    simulateMatch(seed, ST.leagueCtx(C.league.strength, C.ratings[a], C.ratings[b], R), C.rc).hash.slice(0, 16));
}
function allHashes() { return { cups: cupHashes(), league: leagueHashes() }; }
module.exports = { allHashes };
if (require.main === module) {
  const o = process.argv.indexOf('--out'); const h = allHashes();
  if (o >= 0) fs.writeFileSync(process.argv[o + 1], JSON.stringify(h, null, 1) + '\n');
  console.log(JSON.stringify(h.league));
}
