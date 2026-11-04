'use strict';
// P1b: slow motion + camera for "good hits" during added-time shots.
// The engine records one frame per physics step from the first shot on (fine frames). This module turns them
// into video frames: each video frame advances the simulation by stepsPerFrame * scale steps, where the time
// scale eases from 1 to SLOWMO when a cinematic starts and back to 1 when it ends (linear interpolation between
// physics steps). Outside cinematics the scale is exactly 1, so frames fall exactly on physics steps.
const G = require('./geometry');

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const lerp = (a, b, u) => a + (b - a) * u;
const GOAL_FOCUS = [G.GOAL_LINE_X + 30, (G.BAR_Y + G.GROUND_Y) / 2];

function interp(fine, sv) {
  const i = clamp(Math.floor(sv), 0, fine.length - 1), j = Math.min(i + 1, fine.length - 1), u = sv - Math.floor(sv);
  const A = fine[i], B = fine[j];
  if (u < 1e-9 || i === j) return Object.assign({}, A);
  const r3 = (x) => +x.toFixed(3);
  return {
    t: +lerp(A.t, B.t, u).toFixed(5), m: +lerp(A.m, B.m, u).toFixed(5),
    k: A.k.map((v, q) => (q === 3 ? (u < 0.5 ? A.k[3] : B.k[3]) : +lerp(v, B.k[q], u).toFixed(4))),
    b: A.b.map((ba, q) => { const bb = B.b[q]; if (ba[3] !== bb[3]) return u < 0.5 ? ba : bb; return [r3(lerp(ba[0], bb[0], u)), r3(lerp(ba[1], bb[1], u)), r3(lerp(ba[2], bb[2], u)), ba[3]]; }),
    sc: (u < 0.5 ? A : B).sc, mode: (u < 0.5 ? A : B).mode,
  };
}

// frames: coarse frames [0, fineStart) + fine frames [fineStart, end). cines: [{k, ball, tIn, tOut}] (sim time).
function resample(frames, fineStart, cines, cfg, stepsPerFrame) {
  const FPS = cfg.FPS;
  const out = frames.slice(0, fineStart);
  const fine = frames.slice(fineStart);
  const marks = [];
  let sv = 0, ci = 0, act = null;
  let fx = null, fy = null, fz = 1;
  while (sv <= fine.length - 1 + 1e-9) {
    const fr = interp(fine, sv);
    const v = out.length / FPS;
    if (!act && ci < cines.length && fr.t >= cines[ci].tIn - 1e-9) { act = { c: cines[ci], vIn: v, vOut: null }; marks.push({ k: cines[ci].k, tIn: fr.t, vfIn: out.length, tOut: null, vfOut: null }); ci++; fx = null; }
    let w = 0;
    if (act) {
      if (act.vOut === null && fr.t >= act.c.tOut - 1e-9) { act.vOut = v; const mk = marks[marks.length - 1]; mk.tOut = fr.t; mk.vfOut = out.length; }
      w = smooth((v - act.vIn) / cfg.SLOWMO_IN);
      if (act.vOut !== null) w *= 1 - smooth((v - act.vOut) / cfg.SLOWMO_OUT);
    }
    const scale = 1 - (1 - cfg.SLOWMO) * w;
    if (w > 0) {
      // camera: centre between the ball and the goal, zoom so both stay in view (<= ZOOM_MAX), smoothed follow
      const b = fr.b[act.c.ball];
      let tx = GOAL_FOCUS[0], ty = GOAL_FOCUS[1], tz = fz;
      if (b[3] === 3) {
        tx = (b[0] + GOAL_FOCUS[0]) / 2; ty = (b[1] + GOAL_FOCUS[1]) / 2;
        tz = clamp(Math.min(G.W / (Math.abs(b[0] - GOAL_FOCUS[0]) + 300), G.H / (Math.abs(b[1] - GOAL_FOCUS[1]) + 220)), 1, cfg.ZOOM_MAX);
      }
      if (fx === null) { fx = tx; fy = ty; fz = tz; } else { fx += (tx - fx) * 0.12; fy += (ty - fy) * 0.12; fz += (tz - fz) * 0.08; }
      const z = 1 + (fz - 1) * w;
      fr.cam = [+z.toFixed(4), +lerp(G.W / 2, fx, w).toFixed(2), +lerp(G.H / 2, fy, w).toFixed(2)];
      fr.ts = +scale.toFixed(4);
      fr.cine = act.c.k;
    }
    out.push(fr);
    if (act && act.vOut !== null && v - act.vOut >= cfg.SLOWMO_OUT) { act = null; sv = Math.round(sv); }
    sv += stepsPerFrame * (act ? scale : 1);
  }
  out.cineMarks = marks;
  return out;
}

// e.vf = video frame (fractional) of every event; adds cine_in / cine_out events; c.vIn / c.vOut (video s).
function annotate(events, out, cines, cfg) {
  const FPS = cfg.FPS;
  const ts = out.map((f) => f.t);
  const vfOf = (t) => {
    let lo = 0, hi = ts.length - 1;
    if (t <= ts[0]) return 0;
    if (t >= ts[hi]) return hi + (t - ts[hi]) * FPS;
    while (lo < hi - 1) { const m = (lo + hi) >> 1; if (ts[m] <= t) lo = m; else hi = m; }
    return lo + (t - ts[lo]) / Math.max(1e-9, ts[hi] - ts[lo]);
  };
  for (const e of events) e.vf = +vfOf(e.t).toFixed(3);
  for (const mk of out.cineMarks || []) {
    const c = cines.find((x) => x.k === mk.k);
    if (c) { c.vIn = +(mk.vfIn / FPS).toFixed(3); c.vOut = mk.vfOut === null ? null : +(mk.vfOut / FPS).toFixed(3); }
    events.push({ t: +mk.tIn.toFixed(4), type: 'cine_in', k: mk.k, vf: mk.vfIn });
    if (mk.vfOut !== null) events.push({ t: +mk.tOut.toFixed(4), type: 'cine_out', k: mk.k, vf: mk.vfOut });
  }
  events.sort((a, b) => a.vf - b.vf);
  delete out.cineMarks;
}

module.exports = { resample, annotate, interp };
