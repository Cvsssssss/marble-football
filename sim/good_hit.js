'use strict';
// P5: one definition of a "good hit" (added-time shot that really can score) + diagnostics shared by the engine,
// the tests and tools/p5_diag.js.
//
// Goal-mouth region: rectangle x in [GOAL_LINE_X - MOUTH_FRONT, GOAL_LINE_X], y in [BAR_TOP, GROUND_Y]
// (the mouth plus the keeper's zone in front of it). A ball "reaches the goal mouth" when its centre comes within
// MOUTH_MARGIN px of that rectangle (centre path between recorded positions is treated as straight segments).
// Good hit = after a windmill contact, the shot ball reaches the goal mouth within REACH_T s of simulation and before
// any other windmill contact. REACH_T is the speed threshold: the windmill tip is ~900 px from the mouth, so a ball
// must average >= ~600 px/s to qualify (slow rebounds that roll in later are not "hits").
const G = require('./geometry');

const MOUTH_FRONT = 60;   // px in front of the goal line (keeper at GOAL_LINE_X - 56)
const MOUTH_MARGIN = 30;  // px around the region (centre 30 px above the bar top = ball grazes the bar)
const REACH_T = 1.5;      // s of simulation from the windmill contact
const CONTACT_MERGE = 0.12; // s: windmill collision starts closer than this are one contact
const RX0 = G.GOAL_LINE_X - MOUTH_FRONT, RX1 = G.GOAL_LINE_X, RY0 = G.BAR_TOP, RY1 = G.GROUND_Y;

function pointDist(x, y) {
  const dx = Math.max(RX0 - x, 0, x - RX1), dy = Math.max(RY0 - y, 0, y - RY1);
  return Math.hypot(dx, dy);
}
// min distance of segment (x0,y0)-(x1,y1) to the region (sampled finely; segments are <= ~50 px)
function segDist(x0, y0, x1, y1) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
  let best = Infinity;
  for (let k = 0; k <= n; k++) { const d = pointDist(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n); if (d < best) best = d; }
  return best;
}
// path: [[t, x, y, inPlay]] in time order. Returns { dist, tReach (first time within margin) | null }
function approach(path, tFrom, tTo) {
  let dist = Infinity, tReach = null, prev = null;
  for (const p of path) {
    if (p[0] < tFrom - 1e-9) continue;
    if (p[0] > tTo + 1e-9) break;
    if (!p[3]) { prev = null; continue; }
    const d = prev ? segDist(prev[1], prev[2], p[1], p[2]) : pointDist(p[1], p[2]);
    if (d < dist) dist = d;
    if (tReach === null && d <= MOUTH_MARGIN) tReach = p[0];
    prev = p;
  }
  return { dist, tReach };
}
function mergeContacts(ts) {
  const out = [];
  for (const t of ts.slice().sort((a, b) => a - b)) if (!out.length || t - out[out.length - 1] > CONTACT_MERGE) out.push(t);
  return out;
}
// Decide the good hits of one shot. contacts: windmill contact times; path as in approach(); goalT: goal time or null.
function judgeShot(contacts, path, t1, goalT) {
  const cs = mergeContacts(contacts);
  const rows = cs.map((t, i) => {
    const tEnd = Math.min(i + 1 < cs.length ? cs[i + 1] : Infinity, t + REACH_T, t1);
    const a = approach(path, t, tEnd);
    let tReach = a.tReach;
    if (goalT !== null && goalT >= t - 1e-9 && goalT <= tEnd + 1e-9 && tReach === null) tReach = goalT;
    return { t, dist: +a.dist.toFixed(2), good: tReach !== null, tReach };
  });
  return rows;
}

// --- diagnostics on built matches (tournament match objects: frames, events, shots) ---
function ballPath(m, ball, t0, t1) {
  const out = [];
  for (const f of m.fine || m.frames) { if (f.t < t0 - 1e-9) continue; if (f.t > t1 + 1e-9) break; const b = f.b[ball]; out.push([f.t, b[0], b[1], b[3] === 3 || b[3] === 4]); }
  return out;
}
function shotTruth(m) {
  const rows = [];
  for (const sh of m.shots || []) {
    let contacts = sh.contacts;
    if (!contacts) contacts = m.events.filter((e) => e.type === 'mill' && e.ball === sh.ball && e.t >= sh.t0 && e.t <= sh.t1).map((e) => e.t); // pre-P5 timelines
    const path = ballPath(m, sh.ball, sh.t0, sh.t1 + 0.05);
    const g = sh.result === 'goal' ? (m.goals.find((x) => x.shot === sh.k) || null) : null;
    const judged = judgeShot(contacts, path, sh.t1, g ? g.t : null);
    const truth = judged.some((j) => j.good);
    const cines = (m.cines || []).filter((c) => c.k === sh.k);
    const effect = cines.length > 0;
    const old = (m.shotContacts || []).find((c) => c.k === sh.k) || null;
    rows.push({ k: sh.k, result: sh.result, contacts: judged.length, firstContact: old ? { v: old.v, vx: old.vx } : null,
      minDist: judged.length ? Math.min(...judged.map((j) => j.dist)) : null, truth, effect,
      aligned: !effect || cines.every((c) => judged.some((j) => j.good && Math.abs(j.t - c.tIn) < 0.02)) });
  }
  return rows;
}
function confusion(rows) {
  const c = { TP: 0, FP: 0, FN: 0, TN: 0, misaligned: 0, shots: rows.length };
  for (const r of rows) { if (r.truth && r.effect) c.TP++; else if (!r.truth && r.effect) c.FP++; else if (r.truth) c.FN++; else c.TN++; if (!r.aligned) c.misaligned++; }
  return c;
}

// --- penetration: ball centre inside a solid rectangle expanded by (r - 0.5) px ---
function rectOverlap(x, y, r, x0, x1, y0, y1) {
  const cx = Math.max(x0, Math.min(x1, x)), cy = Math.max(y0, Math.min(y1, y));
  if (cx === x && cy === y) return r + Math.min(x - x0, x1 - x, y - y0, y1 - y);
  return r - Math.hypot(x - cx, y - cy);
}
const BAR_RECT = [G.BAR_X0, G.BAR_X1, G.BAR_TOP, G.BAR_BOTTOM];
const PLAT_RECTS = [[G.LEFT_PLAT[0] - 40, G.LEFT_PLAT[1], G.GROUND_Y, G.GROUND_Y + 300], [G.RIGHT_PLAT[0], G.RIGHT_PLAT[1] + 40, G.GROUND_Y, G.GROUND_Y + 300]];
function penetrationScan(matches) {
  const bar = { fails: [], summary: { frames: 0, failFrames: 0, maxOverlap: 0 } }, plat = { fails: [], summary: { failFrames: 0, maxOverlap: 0 } };
  matches.forEach((m, mi) => {
    m.frames.forEach((f, fi) => {
      bar.summary.frames++;
      f.b.forEach((b, bi) => {
        const st = b[3];
        if (st !== 3 && st !== 4 && st !== 5) return;
        const r = bi % 2 === 0 ? m.rA : m.rB;
        const ob = rectOverlap(b[0], b[1], r, ...BAR_RECT);
        if (ob > bar.summary.maxOverlap) bar.summary.maxOverlap = +ob.toFixed(3);
        if (ob > 0.5) { bar.summary.failFrames++; if (bar.fails.length < 200) bar.fails.push({ match: mi, frame: fi, t: f.t, ball: bi, state: st, x: b[0], y: b[1], overlap: +ob.toFixed(2) }); }
        if (st !== 3) return;
        for (const R of PLAT_RECTS) {
          const op = rectOverlap(b[0], b[1], r, ...R);
          if (op > plat.summary.maxOverlap) plat.summary.maxOverlap = +op.toFixed(3);
          if (op > 0.5) { plat.summary.failFrames++; if (plat.fails.length < 200) plat.fails.push({ match: mi, frame: fi, t: f.t, ball: bi, x: b[0], y: b[1], overlap: +op.toFixed(2) }); }
        }
      });
    });
  });
  return { bar, plat };
}

module.exports = { MOUTH_FRONT, MOUTH_MARGIN, REACH_T, CONTACT_MERGE, REGION: [RX0, RX1, RY0, RY1], pointDist, segDist, approach, judgeShot, mergeContacts,
  ballPath, shotTruth, confusion, rectOverlap, penetrationScan, BAR_RECT, PLAT_RECTS };
