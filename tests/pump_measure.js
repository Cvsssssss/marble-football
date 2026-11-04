'use strict';
// P5 pump timing: before/after on the same N shots at normal and fast windmill speed.
//   old = pre-P5 pump (pop when the windmill angle hits TOSS_PHASE / TOSS_PHASE_BOOST +- jitter, random vy)
//   new = P5 engine rule: timing-aware pump (sim/pump.js planLaunch) once the windmill is faster, old timing at normal
//         speed (PUMP_PREDICT_FROM 'boost'); predictAlways = the planner at every speed (for comparison)
// Each shot uses the same random draws in both policies (request time, jitter, vx, vy). Single ball, same physics.
// Usage: node tests/pump_measure.js [N=200]  -> build/pump_measure.json
const fs = require('fs');
const path = require('path');
const CFG = require('../sim/config');
const eng = require('../sim/engine');
const PUMP = require('../sim/pump');

function run(n, cfgOverride) {
  const cfg = Object.assign({}, CFG, cfgOverride || {});
  const fly = PUMP.makeFlyer(cfg, eng);
  const dt = 1 / cfg.HZ;
  const out = {};
  for (const speed of ['normal', 'fast']) {
    const omega = cfg.OMEGA * (speed === 'fast' ? cfg.BOOST : 1);
    const phaseBase = speed === 'fast' ? cfg.TOSS_PHASE_BOOST : cfg.TOSS_PHASE;
    const rng = eng.mulberry32(777);
    const res = { old: [], new: [], predictAlways: [] };
    const usePredict = speed === 'fast' || cfg.PUMP_PREDICT_FROM === 'always'; // engine rule: prediction once the windmill is faster
    for (let i = 0; i < n; i++) {
      const phase0 = rng() * Math.PI * 2, tReq = rng() * 5, jit = (rng() * 2 - 1) * cfg.TOSS_PHASE_JIT;
      const vx = cfg.TOSS_VX[0] + (cfg.TOSS_VX[1] - cfg.TOSS_VX[0]) * rng(), vy = cfg.TOSS_VY[0] + (cfg.TOSS_VY[1] - cfg.TOSS_VY[0]) * rng();
      const prng = eng.mulberry32(1000 + i);
      const ang = (t) => phase0 - omega * t;
      // old: wait (from tReq) until the windmill angle mod pi reaches the toss phase, pop, emerge, launch
      const target = phaseBase + jit;
      const wait = PUMP.modPi(ang(tReq) - target) / omega;
      const tPopOld = tReq + Math.ceil(wait / dt) * dt;
      const fo = fly(ang(tPopOld + cfg.EMERGE_TIME), omega, vx, vy);
      // new: plan from tReq
      const p = PUMP.planLaunch(cfg, tReq, ang, () => omega, dt, prng, vx);
      const tPopNew = tReq + p.delaySteps * dt;
      const fn = fly(ang(tPopNew + cfg.EMERGE_TIME), omega, vx, p.vy);
      res.old.push(Object.assign({ wait: +(tPopOld - tReq).toFixed(3) }, fo));
      const pn = Object.assign({ wait: +(tPopNew - tReq).toFixed(3), plannedGood: p.good }, fn);
      res.predictAlways.push(pn);
      res.new.push(usePredict ? pn : res.old[res.old.length - 1]);
    }
    const summ = (a) => ({
      goodHitPct: +(100 * a.filter((f) => f.good).length / a.length).toFixed(1),
      fallDownNoGoodPct: +(100 * a.filter((f) => !f.good && f.outcome === 'down').length / a.length).toFixed(1),
      avgShotSpeed: Math.round(a.filter((f) => f.contact).reduce((s, f) => s + f.peak, 0) / Math.max(1, a.filter((f) => f.contact).length)),
      contactPct: +(100 * a.filter((f) => f.contact).length / a.length).toFixed(1),
      directGoalPct: +(100 * a.filter((f) => f.outcome === 'goal').length / a.length).toFixed(1),
      mouthPct: +(100 * a.filter((f) => f.mouth).length / a.length).toFixed(1), overPct: +(100 * a.filter((f) => f.outcome === 'over').length / a.length).toFixed(1),
      avgWait: +(a.reduce((s, f) => s + f.wait, 0) / a.length).toFixed(3), maxWait: Math.max(...a.map((f) => f.wait)),
    });
    out[speed] = { omega: +omega.toFixed(3), old: summ(res.old), new: summ(res.new), predictAlways: summ(res.predictAlways) };
  }
  return { n, ...out };
}
module.exports = { run };
if (require.main === module) {
  const t0 = Date.now();
  const r = run(+(process.argv[2] || 200));
  fs.mkdirSync(path.join(__dirname, '..', 'build'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'pump_measure.json'), JSON.stringify(r, null, 1));
  console.log(JSON.stringify(r, null, 1));
  console.log('ms', Date.now() - t0);
}
