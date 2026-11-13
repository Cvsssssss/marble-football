'use strict';
// P7: headless match pool (worker_threads). Runs simulateMatch for many {seed, ctx, cfg} jobs in parallel and
// returns compact summaries only (score, goal times/teams, gate reason, hash). No frames leave the worker.
const os = require('os');
const path = require('path');
const { Worker, isMainThread, parentPort } = require('worker_threads');

function summarise(r, gateFn) {
  return { seed: r.seed, A: r.score.A, B: r.score.B, gate: gateFn ? gateFn(r) : null, hash: r.hash,
    goals: r.goals.map((g) => ({ t: +g.t.toFixed(2), team: g.team, ball: g.ball, shot: g.shot || null })), addedTime: r.addedTime };
}

if (!isMainThread) {
  const { simulateMatch } = require('../engine');
  const { passesRules } = require('../tournament');
  parentPort.on('message', (jobs) => {
    const out = jobs.map((j) => { const r = simulateMatch(j.seed, j.ctx, j.cfg); return summarise(r, (x) => passesRules(x, j.cfg)); });
    parentPort.postMessage(out);
  });
}

// jobs: [{ seed, ctx, cfg }] -> Promise<[summary]> in the same order
function runPool(jobs, nWorkers) {
  nWorkers = Math.max(1, Math.min(nWorkers || Math.max(1, os.cpus().length - 1), jobs.length));
  return new Promise((resolve, reject) => {
    const res = new Array(jobs.length); let next = 0, done = 0; const CH = 8; const ws = [];
    const feed = (w) => {
      if (next >= jobs.length) { w.terminate(); return; }
      const i0 = next; next = Math.min(jobs.length, next + CH); w._i0 = i0; w.postMessage(jobs.slice(i0, next));
    };
    for (let k = 0; k < nWorkers; k++) {
      const w = new Worker(__filename); ws.push(w);
      w.on('message', (out) => { out.forEach((o, q) => { res[w._i0 + q] = o; }); done += out.length; if (done === jobs.length) { ws.forEach((x) => x.terminate()); resolve(res); } else feed(w); });
      w.on('error', reject);
      feed(w);
    }
  });
}
module.exports = { runPool, summarise };
