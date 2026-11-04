'use strict';
// Calibrates GOOD_HIT_V: for every added-time shot, the first windmill contact's peak launch speed (0.3 s window)
// and direction vs. whether the ball then reaches the right side (goal, right platform, or over the goal).
// Usage: node tests/calibrate_good_hit.js [matches]   -> build/good_hit_calibration.json
const fs = require('fs');
const path = require('path');
const eng = require('../sim/engine');
const G = require('../sim/geometry');

function run(n) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const r = eng.simulateMatch(300000 + i, { kind: 'leg1' });
    if (r.failed) continue;
    for (const c of r.shotContacts) {
      const sh = r.shots.find((s) => s.k === c.k); if (!sh) continue;
      let maxX = 0;
      for (const f of r.frames) { if (f.t < c.t || f.t > sh.t1) continue; const b = f.b[sh.ball]; if (b[3] === 3) maxX = Math.max(maxX, b[0]); }
      const reach = sh.result === 'goal' || sh.result === 'over' || maxX >= G.RIGHT_PLAT[0];
      rows.push({ v: c.v, vx: c.vx, reach, goal: sh.result === 'goal' });
    }
  }
  const table = [];
  for (let thr = 600; thr <= 1200; thr += 50) {
    const hi = rows.filter((x) => x.v >= thr && x.vx > 0), lo = rows.filter((x) => !(x.v >= thr && x.vx > 0));
    const pct = (a, k) => (a.length ? +(100 * a.filter((x) => x[k]).length / a.length).toFixed(1) : null);
    table.push({ thr, goodSharePct: +(100 * hi.length / rows.length).toFixed(1), reachPctGood: pct(hi, 'reach'), reachPctMiss: pct(lo, 'reach'), goalPctGood: pct(hi, 'goal'), goalPctMiss: pct(lo, 'goal') });
  }
  return { contacts: rows.length, table };
}
module.exports = { run };
if (require.main === module) {
  const res = run(+(process.argv[2] || 300));
  fs.mkdirSync(path.join(__dirname, '..', 'build'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'good_hit_calibration.json'), JSON.stringify(res, null, 1));
  console.log('contacts', res.contacts);
  for (const r of res.table) console.log(JSON.stringify(r));
}
