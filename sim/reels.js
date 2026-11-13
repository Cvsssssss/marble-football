'use strict';
// Vertical reel timeline (P3 A, P8). The reel replays the SAME match record as the long video (same seed, same frames).
// P8 (Max, 13 Nov 2026): NO fast-forward at all. The whole match plays from kick-off to the final whistle at normal
// speed (the approved good-hit / goal slow motion inside the match record stays; nothing is ever faster than 1x):
//   hook (deficit, score + clock) -> whole match -> decisive goal replay in slow motion -> Man of the Match -> end card.
// The extras are shortened / dropped (EXTRAS ladder) until the reel is <= REEL_MAX s; a match that is still too long
// at normal speed does not fit (reel.fits === false) and the selection skips it.
// Output is a "reel show" consumed by render/reel.js (vertical renderer) and audio/make_audio.py (same synth).
const CFG = require('./config');
const CLOCK = require('./clock');
const FPS = CFG.FPS;

const REEL_MAX = 59;                          // s: hard upper limit of a reel (YouTube Shorts <= 60 s)
const TARGET_MAX = REEL_MAX - 1, TARGET_MIN = 30; // callers keep `seconds <= TARGET_MAX + 1` == fits
// extras ladder (s): first entry that makes the reel fit wins. replay: decisive-goal replay on/off.
const EXTRAS = [
  { hook: 2.0, replay: true, motm: 2.0, end: 2.2 },
  { hook: 1.5, replay: true, motm: 1.6, end: 1.6 },
  { hook: 1.5, replay: false, motm: 1.6, end: 1.6 },
  { hook: 1.0, replay: false, motm: 0, end: 1.2 },
  { hook: 0, replay: false, motm: 0, end: 1.0 },
];
const REEL_SCENE = { x: 0, y: 400, w: 720, h: 405 }; // P6: full-width 16:9 scene band (design units of the 720x1280 reel)

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
  let r;
  for (let k = 0; k < EXTRAS.length; k++) { r = buildReelOnce(show, matchIndex, EXTRAS[k], k); if (r.seconds <= REEL_MAX) break; }
  r.fits = r.seconds <= REEL_MAX;
  return r;
}
function buildReelOnce(show, matchIndex, X, level) {
  const m = show.matches[matchIndex];
  const F = m.frames;
  // the whole match at normal speed: every recorded frame once, in order (ff = 0 everywhere)
  const plan = F.map((f, i) => ({ src: i, ff: 0 }));
  const dg = decisiveGoal(m), g = m.goals[dg];
  const rt0 = g ? Math.max(0.2, g.t - 1.35) : 0, rt1 = g ? Math.min(m.endT, g.t + 0.55) : 0, rSpeed = 0.5;
  const replayLen = X.replay && g ? (rt1 - rt0) / rSpeed + 0.3 : 0;
  const hookLen = X.hook, motmLen = m.motm ? X.motm : 0, endLen = X.end;
  const trimmedStart = 0;
  // P6: static camera. The whole 16:9 scene is always in frame (no pan, no zoom, no crop), so the camera track is one
  // constant rectangle (design units of the 720x1280 reel = render/draw.js FIELD) for every output frame.
  const SCENE = Object.assign({}, REEL_SCENE);
  // --- reel segments ---
  const segs = [];
  let fo = 0;
  const add = (type, len, extra) => { const s = Object.assign({ type, start: fo, len }, extra || {}); segs.push(s); fo += len; return s; };
  const dm = deficitMoment(m);
  const hookSrc = Math.min(F.length - 1, Math.round(dm.t * FPS));
  if (hookLen > 0) add('hook', Math.round(hookLen * FPS), { src: hookSrc, def: dm.def, score: scoreAtT(m, dm.t) });
  const ms = add('match', plan.length, { plan });
  const rp = replayLen > 0 ? add('replay', Math.round(replayLen * FPS), { goal: dg, t0: rt0, t1: rt1, speed: rSpeed }) : null;
  if (motmLen > 0) add('motm', Math.round(motmLen * FPS));
  add('end', Math.round(endLen * FPS));
  // audio events re-timed onto the reel (fast-forward stretches keep their events at the compressed time; no fanfare/horn)
  const audio = [];
  const outOfSrc = new Map(); plan.forEach((p, k) => { if (!outOfSrc.has(p.src)) outOfSrc.set(p.src, k); });
  const srcToOut = (vf) => { let i = Math.round(vf); while (i < F.length && !outOfSrc.has(i)) i++; return outOfSrc.has(i) ? outOfSrc.get(i) : plan.length - 1; };
  audio.push({ t: 0, type: 'swoosh' });
  for (const e of m.events) {
    if (['fanfare', 'cheer'].includes(e.type)) continue;
    if ((e.vf !== undefined ? e.vf : e.t * FPS) < trimmedStart) continue; // dropped opening
    const x = Object.assign({}, e, { match: 0 }); delete x.t; delete x.vf;
    audio.push(Object.assign(x, { t: +((ms.start + srcToOut(e.vf !== undefined ? e.vf : e.t * FPS)) / FPS).toFixed(4), type: e.type }));
  }
  if (rp) {
    audio.push({ t: +(rp.start / FPS).toFixed(4), type: 'replay_in' });
    audio.push({ t: +((rp.start + ((g.t - rt0) / rSpeed) * FPS) / FPS).toFixed(4), type: 'replay_goal' });
    audio.push({ t: +((rp.start + rp.len) / FPS).toFixed(4), type: 'swoosh' });
  }
  audio.sort((a, b) => a.t - b.t);
  const total = fo;
  const ti = (s) => (s === 'A' ? m.ta : m.tb);
  return {
    reel: true, fps: FPS, totalFrames: total, winnerSide: m.winnerSide, map: show.map, audioCfg: show.audioCfg, seconds: +(total / FPS).toFixed(2), matchIndex, seed: m.seed, timeline_hash: m.hash,
    camera: { mode: 'static', scene: SCENE }, camTrack: { frames: total, rect: [SCENE.x, SCENE.y, SCENE.w, SCENE.h], changes: 0 }, segments: segs, audio,
    comebackDepth: m.comeback ? m.comeback_depth : 0,
    decisive: g ? { goal: dg, team: ti(g.team), player: g.player, minute: CLOCK.minuteLabel(m, g.t, show.cfg.GAME_MIN_PER_SEC) } : null,
    speed: 1, maxSpeed: 1, ffStretches: 0, extrasLevel: level, extras: Object.assign({}, X, { replay: !!rp, motm: motmLen }), wholeMatch: plan.length === F.length, trimmedStartS: 0,
  };
}

const FF_SPEED = 1, FF_MAX_OUT = 0; // P8: no fast-forward (kept as exports for older callers)
module.exports = { REEL_SCENE, buildReel, decisiveGoal, deficitMoment, FF_MAX_OUT, FF_SPEED, TARGET_MAX, TARGET_MIN, REEL_MAX, EXTRAS };
