'use strict';
// Vertical reel timeline (P3 A). The reel replays the SAME match record as the long video (same seed, same frames):
//   hook (2 s: the deficit, score + clock) -> the match with quiet stretches fast-forwarded x2 (each <= 1.5 s of
//   output, goals never cut) -> decisive goal in slow motion with caption -> Man of the Match (2 s) -> end card.
// Output is a "reel show" consumed by render/reel.js (vertical renderer) and audio/make_audio.py (same synth).
const CFG = require('./config');
const CLOCK = require('./clock');
const FPS = CFG.FPS;

const FF_MAX_OUT = 1.5;       // s of output per fast-forward stretch (spec)
const FF_SPEED = 2;
const QUIET_BEFORE = 2.6, QUIET_AFTER = 2.4; // s around goals / shots / whistles that always play at normal speed
const TARGET_MAX = 54, TARGET_MIN = 30;      // s total reel length

function scoreAtT(m, t) { let a = 0, b = 0; for (const g of m.goals) { if (g.t > t + 1e-9) break; if (g.team === 'A') a++; else b++; } return [a, b]; }

// decisive goal index: the goal that put the eventual winner ahead for good (leg 2: on aggregate)
function decisiveGoal(m) {
  const w = m.winnerSide; if (!w) return m.goals.length - 1;
  let a = m.kind === 'leg2' ? m.prev[0] : 0, b = m.kind === 'leg2' ? m.prev[1] : 0, idx = -1;
  m.goals.forEach((g, i) => { const was = w === 'A' ? a > b : b > a; if (g.team === 'A') a++; else b++; const now = w === 'A' ? a > b : b > a; if (now && !was) idx = i; });
  return idx >= 0 ? idx : m.goals.length - 1;
}
// moment of the largest deficit of the eventual winner (for the hook)
function deficitMoment(m) {
  const w = m.winnerSide || 'A';
  let a = m.kind === 'leg2' ? m.prev[0] : 0, b = m.kind === 'leg2' ? m.prev[1] : 0;
  let best = { def: w === 'A' ? b - a : a - b, t: 0.5 };
  for (const g of m.goals) { if (g.team === 'A') a++; else b++; const d = w === 'A' ? b - a : a - b; if (d > best.def) best = { def: d, t: g.t + 1.6 }; }
  return best;
}

function buildReel(show, matchIndex, opts) {
  opts = opts || {};
  const m = show.matches[matchIndex];
  const F = m.frames;
  // --- protected (normal speed) windows ---
  const keyT = [];
  for (const e of m.events) if (['goal', 'shot', 'golden', 'added'].includes(e.type) || (e.type === 'whistle')) keyT.push(e.t);
  const prot = (t) => keyT.some((k) => t > k - QUIET_BEFORE && t < k + QUIET_AFTER) || (F[0] && t < 1.0);
  // frame list for the match part: each output frame -> source frame index (float), ff flag
  const quiet = F.map((f, i) => !prot(f.t) && !(f.ts !== undefined && f.ts < 1) && !f.cam);
  // runs of quiet frames
  const runs = [];
  for (let i = 0; i < F.length;) { if (!quiet[i]) { i++; continue; } let j = i; while (j < F.length && quiet[j]) j++; runs.push([i, j]); i = j; }
  const hookLen = 2.0, replayExtra = 0.3, motmLen = 2.0, endLen = 2.2;
  const dg = decisiveGoal(m), g = m.goals[dg];
  const rt0 = Math.max(0.2, g.t - 1.35), rt1 = Math.min(m.endT, g.t + 0.55), rSpeed = 0.5;
  const replayLen = (rt1 - rt0) / rSpeed + replayExtra;
  const fixed = hookLen + replayLen + motmLen + endLen;
  // fast-forward stretches: inside each quiet run, chunks of up to FF_MAX_OUT*FF_SPEED s of source with 0.5 s normal play between
  // them; applied from the longest runs first until the reel fits TARGET_MAX
  let matchOut = F.length / FPS;
  const ffMark = new Uint8Array(F.length);
  const chunks = [];
  for (const [i, j] of runs) {
    let k = i + Math.round(0.3 * FPS);
    while (k + Math.round(1.0 * FPS) < j - Math.round(0.3 * FPS)) {
      const len = Math.min(Math.round(FF_MAX_OUT * FF_SPEED * FPS), j - Math.round(0.3 * FPS) - k);
      if (len < Math.round(0.8 * FPS)) break;
      chunks.push([k, k + len]); k += len + Math.round(0.5 * FPS);
    }
  }
  chunks.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]));
  for (const [a, b] of chunks) {
    if (fixed + matchOut <= TARGET_MAX) break;
    for (let q = a; q < b; q++) ffMark[q] = 1;
    matchOut -= (b - a) / FPS * (1 - 1 / FF_SPEED);
  }
  const plan = [];
  for (let i = 0; i < F.length; i++) { if (ffMark[i]) { if ((i - (ffStart(i))) % FF_SPEED === 0) plan.push({ src: i, ff: 1 }); } else plan.push({ src: i, ff: 0 }); }
  function ffStart(i) { let s = i; while (s > 0 && ffMark[s - 1]) s--; return s; }
  // follow camera (design x of the window centre), eased; zone = windmill side or goal side
  const VIEW = opts.view || { w: 720, h: 660 };
  const zoom = Math.max(VIEW.h / 720, 0.9);
  const half = VIEW.w / (2 * zoom);
  const leftC = half, rightC = 1280 - half;
  let camX = leftC;
  const camPath = [];
  for (const p of plan) {
    const f = F[p.src];
    const play = f.b.filter((b) => b[3] === 3 || b[3] === 4);
    const lead = play.length ? Math.max(...play.map((b) => b[0])) : 0;
    const target = lead > 560 ? rightC : leftC;
    const k = p.ff ? 0.16 : 0.08;
    camX += (target - camX) * k;
    camPath.push(+camX.toFixed(2));
  }
  // --- reel segments ---
  const segs = [];
  let fo = 0;
  const add = (type, len, extra) => { const s = Object.assign({ type, start: fo, len }, extra || {}); segs.push(s); fo += len; return s; };
  const dm = deficitMoment(m);
  const hookSrc = Math.min(F.length - 1, Math.round(dm.t * FPS));
  add('hook', Math.round(hookLen * FPS), { src: hookSrc, cam: leftC, def: dm.def, score: scoreAtT(m, dm.t) });
  const ms = add('match', plan.length, { plan, camPath });
  const rp = add('replay', Math.round(replayLen * FPS), { goal: dg, t0: rt0, t1: rt1, speed: rSpeed });
  add('motm', Math.round(motmLen * FPS));
  add('end', Math.round(endLen * FPS));
  // audio events re-timed onto the reel (fast-forward stretches keep their events at the compressed time; no fanfare/horn)
  const audio = [];
  const outOfSrc = new Map(); plan.forEach((p, k) => { if (!outOfSrc.has(p.src)) outOfSrc.set(p.src, k); });
  const srcToOut = (vf) => { let i = Math.round(vf); while (i < F.length && !outOfSrc.has(i)) i++; return outOfSrc.has(i) ? outOfSrc.get(i) : plan.length - 1; };
  audio.push({ t: 0, type: 'swoosh' });
  for (const e of m.events) {
    if (['fanfare', 'cheer'].includes(e.type)) continue;
    const x = Object.assign({}, e, { match: 0 }); delete x.t; delete x.vf;
    audio.push(Object.assign(x, { t: +((ms.start + srcToOut(e.vf !== undefined ? e.vf : e.t * FPS)) / FPS).toFixed(4), type: e.type }));
  }
  audio.push({ t: +(rp.start / FPS).toFixed(4), type: 'replay_in' });
  audio.push({ t: +((rp.start + ((g.t - rt0) / rSpeed) * FPS) / FPS).toFixed(4), type: 'replay_goal' });
  audio.push({ t: +((rp.start + rp.len) / FPS).toFixed(4), type: 'swoosh' });
  audio.sort((a, b) => a.t - b.t);
  const total = fo;
  const ti = (s) => (s === 'A' ? m.ta : m.tb);
  return {
    reel: true, fps: FPS, totalFrames: total, seconds: +(total / FPS).toFixed(2), matchIndex, seed: m.seed, timeline_hash: m.hash,
    view: Object.assign({ zoom }, VIEW), segments: segs, audio,
    decisive: { goal: dg, team: ti(g.team), player: g.player, minute: CLOCK.minuteLabel(m, g.t, show.cfg.GAME_MIN_PER_SEC) },
    ffStretches: chunks.filter(([a]) => ffMark[a]).length,
  };
}

module.exports = { buildReel, decisiveGoal, deficitMoment, FF_MAX_OUT, FF_SPEED, TARGET_MAX, TARGET_MIN };
