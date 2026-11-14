'use strict';
// P10: atmosphere data of a league show (Premier League "pro" maps). Derived ONLY from the recorded match timeline
// (frames + events) and the match seed, so it is deterministic and never touches the physics.
//   show.atmo = { cfg, kind, rain, matches: [{ wind, react, chances, smoke, prox, drums, thumps, kick, end }] }
//   + crowd audio events in show.audio (absolute video seconds), played by audio/crowd.py:
//     crowd_bed, weather_bed, crowd_roar, crowd_groan, crowd_gasp, crowd_applause, crowd_drums, mill_thump, lights_on
// All times inside atmo.matches[] are match-local VIDEO seconds (v = video frame / FPS, like the renderer's v).
const G = require('./geometry');
const GH = require('./good_hit');
const L = require('./config_loader');

const FPS = 30;
const PROX_STEP = 3;            // proximity curve: one value every 3 video frames (10 Hz)
const THUMP_V = 240;            // windmill contact impact (engine units) that counts as a "bomb" hit (sub-bass thump + dust)
const CHANCE_MERGE = 2.5;       // s: chances closer than this are one crowd reaction
const GOAL_CLEAR = 3.0;         // s: no separate "chance" reaction this close to a goal
const KEEPER_SAVE_V = 380;      // keeper contact impact that counts as a save

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function lum(h) { const [r, g, b] = hexRgb(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }
// same classification as render/art_pro.js lookOf()
function kindOf(map) {
  const sk = hexRgb(map.sky[1]), skyL = lum(map.sky[1]);
  if (map.night) return 'night';
  if (skyL < 0.35) return 'evening';
  if (Math.abs(sk[2] - sk[0]) < 40 && skyL >= 0.45) return 'overcast';
  return 'day';
}
const evV = (e) => (e.vf !== undefined ? e.vf : e.t * FPS) / FPS;
const on = (cfg, k) => !!cfg.enabled && cfg[k] !== false;
function active(show, cfg) { return !!(cfg && cfg.enabled && show.map && show.map.art_style === 'pro'); }

// one global wind field per match: direction (+1 = blowing to the right), base strength 0..1, gust phase
function windOf(seed, kind, cfg) {
  if (!on(cfg, 'wind')) return { dir: 1, str: 0.15, ph: 0, gust: 0 };
  const R = mulberry32((seed ^ 0x5eed) >>> 0);
  const rng = { day: [0.35, 0.6], overcast: [0.5, 0.8], evening: [0.25, 0.45], night: [0.55, 0.85] }[kind];
  return { dir: R() < 0.5 ? -1 : 1, str: +(rng[0] + (rng[1] - rng[0]) * R()).toFixed(3), ph: +(R() * 6.283).toFixed(3), gust: +(0.25 + 0.3 * R()).toFixed(3) };
}

function matchAtmo(m, cfg, kind) {
  const R = mulberry32((m.seed * 2654435761) >>> 0);
  const len = m.frames.length / FPS;
  const goals = m.events.filter((e) => e.type === 'goal');
  // --- goal reactions: scoring side, strength (late goal / equaliser / comeback lead) ---
  let a = 0, b = 0;
  const react = goals.map((e) => {
    const wasBehind = e.team === 'A' ? a < b : b < a;
    if (e.team === 'A') a++; else b++;
    const eq = a === b, lead = e.team === 'A' ? a > b : b > a;
    const late = e.t >= 0.85 * (m.regEnd || m.endT) || !!e.shot || !!e.golden;
    const k = Math.min(1.8, 1 + (late ? 0.4 : 0) + (eq ? 0.3 : 0) + (wasBehind && lead ? 0.5 : 0) + (lead && wasBehind === false && a + b > 2 && Math.abs(a - b) === 1 ? 0.1 : 0));
    return { v: +evV(e).toFixed(3), side: e.team, k: +k.toFixed(2), late, eq };
  });
  const goalV = react.map((r) => r.v);
  // --- big chances: post/bar hits, keeper saves, good windmill hits (cinematics), near misses ---
  const raw = [];
  for (const e of m.events) {
    if (e.type === 'bar' && e.v >= 120) raw.push({ v: evV(e), kind: 'bar' });
    else if (e.type === 'keeper' && e.v >= KEEPER_SAVE_V) raw.push({ v: evV(e), kind: 'save' });
    else if (e.type === 'cine_in') raw.push({ v: evV(e), kind: 'hit' });
  }
  // near miss: a fast ball in play passes within the good-hit margin of the goal mouth and no goal follows
  for (let i = 2; i < m.frames.length; i += 2) {
    const F0 = m.frames[i - 2], F1 = m.frames[i], dt = Math.max(1e-4, F1.t - F0.t);
    for (let k = 0; k < F1.b.length; k++) {
      const p = F1.b[k], q = F0.b[k];
      if (p[3] !== 3 || q[3] !== 3) continue;
      const sp = Math.hypot(p[0] - q[0], p[1] - q[1]) / dt;
      if (sp < 320 || p[0] < G.GOAL_LINE_X - 140) continue;
      const d = GH.segDist(q[0], q[1], p[0], p[1]);
      if (d <= GH.MOUTH_MARGIN && d > 0) raw.push({ v: i / FPS, kind: 'miss' });
    }
  }
  raw.sort((x, y) => x.v - y.v);
  const pri = { bar: 3, hit: 2, save: 2, miss: 1 };
  const chances = [];
  for (const c of raw) {
    if (goalV.some((g) => c.v > g - GOAL_CLEAR && c.v < g + GOAL_CLEAR)) continue;
    const last = chances[chances.length - 1];
    if (last && c.v - last.v < CHANCE_MERGE) { if (pri[c.kind] > pri[last.kind]) last.kind = c.kind; continue; }
    chances.push({ v: +c.v.toFixed(3), kind: c.kind });
  }
  // --- proximity of the nearest ball in play to the goal mouth (crowd bed level), 10 Hz, fast attack / slow release ---
  const prox = [];
  let s = 0;
  for (let i = 0; i < m.frames.length; i += PROX_STEP) {
    let best = 0;
    for (const p of m.frames[i].b) if (p[3] === 3) best = Math.max(best, Math.pow(Math.max(0, 1 - GH.pointDist(p[0], p[1]) / 420), 2));
    s = best > s ? s + (best - s) * 0.5 : s + (best - s) * 0.08;
    prox.push(+s.toFixed(2));
  }
  // --- coloured smoke from the stands: rare (one idle emitter per match + one per goal on the scoring side) ---
  const smoke = [];
  if (on(cfg, 'stand_smoke')) {
    const side = R() < 0.5 ? 'A' : 'B';
    smoke.push({ v: +(8 + R() * Math.max(1, len - 22)).toFixed(2), side, x: +(side === 'A' ? 110 + R() * 400 : 770 + R() * 400).toFixed(1), y: +(410 + R() * 80).toFixed(1), d: 5.5 });
    for (const r of react) smoke.push({ v: +(r.v + 0.5).toFixed(2), side: r.side, x: +(r.side === 'A' ? 130 + R() * 380 : 770 + R() * 380).toFixed(1), y: +(400 + R() * 90).toFixed(1), d: 5 });
    smoke.sort((x, y) => x.v - y.v);
  }
  // --- drums/claps in quiet moments: no goal/chance in [v-2, v+6] and a low crowd bed ---
  const excite = goalV.concat(chances.map((c) => c.v));
  const drums = [];
  for (let v = 4, n = 0; v < len - 8;) {
    const i0 = Math.floor(v * FPS / PROX_STEP), i1 = Math.min(prox.length, Math.floor((v + 6) * FPS / PROX_STEP));
    let mean = 0; for (let i = i0; i < i1; i++) mean += prox[i]; mean /= Math.max(1, i1 - i0);
    if (!excite.some((x) => x > v - 2 && x < v + 6) && mean < 0.42) { drums.push({ v: +v.toFixed(2), d: 5, side: n++ % 2 ? 'B' : 'A' }); v += 14; } else v += 1;
  }
  // --- windmill "bomb" hits: sub-bass thump + dust puff ---
  const thumps = m.events.filter((e) => e.type === 'mill' && e.v >= THUMP_V).map((e) => ({ v: +evV(e).toFixed(3), x: e.x, y: e.y }));
  const end = m.events.filter((e) => e.type === 'whistle' && e.kind === 'end').map(evV)[0];
  return { wind: windOf(m.seed, kind, cfg), react: on(cfg, 'crowd_reactions') ? react : [], chances: on(cfg, 'crowd_reactions') ? chances : [], smoke, prox, proxStep: PROX_STEP, drums, thumps,
    kick: 0, end: end !== undefined ? +end.toFixed(3) : +len.toFixed(3) };
}

// annotate a league show in place (no-op unless the map is a "pro" map and atmosphere is enabled)
function annotate(show, cfg) {
  cfg = cfg || L.loadAtmosphere();
  show.atmoCfg = cfg;
  if (!active(show, cfg)) { show.atmo = null; return show; }
  const kind = kindOf(show.map);
  const rain = !!show.map.rain || (on(cfg, 'rain') && (kind === 'overcast' || kind === 'night'));
  show.atmo = { kind, rain, matches: show.matches.map((m) => matchAtmo(m, cfg, kind)) };
  if (!on(cfg, 'crowd_audio')) return show;
  const A = show.audio, f2s = (f) => +(f / FPS).toFixed(4);
  for (const seg of show.segments) {
    if (seg.type === 'lgKick') {
      A.push({ t: f2s(seg.start), type: 'weather_bed', match: seg.match, d: +(seg.len / FPS).toFixed(3), kind, rain, wind: show.atmo.matches[seg.match].wind.str, intro: true });
      A.push({ t: f2s(seg.start), type: 'crowd_bed', match: seg.match, d: +(seg.len / FPS).toFixed(3), intro: true });
      if (kind === 'evening' || kind === 'night') A.push({ t: f2s(seg.start + Math.round(0.45 * FPS)), type: 'lights_on', match: seg.match });
    }
    if (seg.type !== 'match') continue;
    const mi = seg.match, at = show.atmo.matches[mi], t0 = seg.start / FPS, d = +(seg.len / FPS).toFixed(3);
    A.push({ t: f2s(seg.start), type: 'crowd_bed', match: mi, d });
    A.push({ t: f2s(seg.start), type: 'weather_bed', match: mi, d, kind, rain, wind: at.wind.str });
    for (const r of at.react) {
      A.push({ t: +(t0 + r.v).toFixed(4), type: 'crowd_roar', match: mi, side: r.side, k: r.k });
      A.push({ t: +(t0 + r.v + 0.15).toFixed(4), type: 'crowd_groan', match: mi, side: r.side === 'A' ? 'B' : 'A' });
    }
    for (const c of at.chances) A.push({ t: +(t0 + c.v).toFixed(4), type: 'crowd_gasp', match: mi, kind: c.kind });
    for (const dr of at.drums) A.push({ t: +(t0 + dr.v).toFixed(4), type: 'crowd_drums', match: mi, d: dr.d, side: dr.side });
    for (const th of at.thumps) A.push({ t: +(t0 + th.v).toFixed(4), type: 'mill_thump', match: mi });
    A.push({ t: +(t0 + at.end).toFixed(4), type: 'crowd_applause', match: mi });
  }
  A.sort((x, y) => x.t - y.t);
  return show;
}

module.exports = { annotate, active, kindOf, windOf, matchAtmo, THUMP_V, PROX_STEP };
