'use strict';
// Favourite win rate with equal balls and the invisible release-turn edge.
// Usage: node tests/calibrate_strength.js <edge> <n> [seedBase]   -> prints JSON
// Every seed is played twice (favourite = A, then favourite = B) so side effects cancel out.
const { simulateMatch } = require('../sim/engine');
const { passesRules } = require('../sim/tournament');
const L = require('../sim/config_loader');
const edge = +(process.argv[2] || 0.3), n = +(process.argv[3] || 1200), base = +(process.argv[4] || 700000);
const rc = L.rulesToCfg(require('../config/rules/base.json'));
let fav = 0, dec = 0, rej = 0;
for (let i = 0; i < n / 2; i++) {
  for (const f of ['A', 'B']) {
    const r = simulateMatch(base + i, { kind: 'final', fav: f, edge }, rc);
    if (passesRules(r, rc)) { rej++; continue; }
    const w = r.goldenWinner || (r.score.A > r.score.B ? 'A' : r.score.B > r.score.A ? 'B' : null);
    if (!w) continue;
    dec++; if (w === f) fav++;
  }
}
console.log(JSON.stringify({ edge, played: n, decided: dec, rejectedByGate: rej, favouriteWinPct: +(100 * fav / dec).toFixed(1) }));
