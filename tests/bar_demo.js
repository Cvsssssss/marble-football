'use strict';
// Before/after crossbar sequence: the same throw simulated with the v1 collider and the v2 swept collider,
// rendered with the real renderer and stitched into output/screenshots_v2/crossbar_before_after.png
// Usage: node tests/bar_demo.js [throwIndex]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Matter = require('matter-js');
const ffmpeg = require('ffmpeg-static');
const G = require('../sim/geometry');
const CFG = require('../sim/config');
const eng = require('../sim/engine');
const XB = require('./crossbar_test');
const ROOT = path.join(__dirname, '..');

function record(mode, th) {
  const cfg = Object.assign({}, CFG, { BAR_MODE: mode });
  const W = eng.buildWorld(cfg); const r = G.BALL_R, dtMs = 1000 / cfg.HZ;
  const ball = Matter.Bodies.circle(th.x, th.y, r, { restitution: cfg.BALL_RESTITUTION, friction: 0, frictionStatic: 0, frictionAir: cfg.FRICTION_AIR, collisionFilter: { category: eng.CAT.BALL, mask: eng.CAT.STATIC } });
  ball.deltaTime = dtMs; Matter.Body.setVelocity(ball, { x: th.vx / 60, y: th.vy / 60 }); Matter.Composite.add(W.engine.world, ball);
  const st = { barGhost: false }; const pts = []; let spin = 0;
  for (let s = 0; s < 90; s++) {
    eng.driveKinematic(W.mill, -2000, -2000, 0, -2000, -2000, 0);
    for (const k of Object.values(W.keeper)) eng.driveKinematic(k, -3000, -3000, 0, -3000, -3000, 0);
    ball.force.y += ball.mass * cfg.GRAVITY / 1e6;
    if (mode === 'v1') ball.collisionFilter.mask = eng.CAT.STATIC | (ball.position.y + r <= G.BAR_TOP + 3 ? eng.CAT.BAR : 0);
    const px = ball.position.x, py = ball.position.y;
    Matter.Engine.update(W.engine, dtMs);
    if (mode !== 'v1') eng.sweptBar(st, ball, r, px, py, cfg.BALL_RESTITUTION);
    spin += ball.velocity.x / r;
    pts.push({ x: ball.position.x, y: ball.position.y, spin, ov: eng.barOverlap(ball.position.x, ball.position.y, r) });
  }
  return pts;
}

function showFor(pts) {
  const park = [-200, -200, 0, 0];
  const frames = pts.map((p, i) => ({ t: i / 120, m: 1.2, k: [G.GROUND_Y, 0.8, 0.05, 0], b: [[+p.x.toFixed(2), +p.y.toFixed(2), p.spin, 3], park, park, park, park, park], sc: [0, 0], mode: 0 }));
  const conf = require('../sim/config_loader').loadCompetition();
  const T = conf.teams;
  const m = { stage: 'TEST', leg: 'LEG 1', ta: 0, tb: 3, prev: [0, 0], rA: G.BALL_R, rB: G.BALL_R, addedTime: 1, goldenStart: null, events: [], goals: [], frames,
    kits: { A: { primary: T[0].primary, secondary: T[0].secondary }, B: { primary: T[3].primary, secondary: T[3].secondary } } };
  return { fps: 30, totalFrames: frames.length, segments: [{ type: 'match', start: 0, len: frames.length, match: 0 }], audio: [],
    matches: [m], teams: T.map((t) => ({ name: t.name, primary: t.primary, secondary: t.secondary, players: t.players })), map: conf.map,
    competition: { name: conf.competition.name, subtitle: '' }, cfg: { GAME_MIN_PER_SEC: 2, BALLS_PER_TEAM: 3 } };
}

const idx = +(process.argv[2] || 4877);
const th = XB.throwSet(5000, 2024)[idx];
const out = path.join(ROOT, 'output', 'screenshots_v2'); fs.mkdirSync(out, { recursive: true });
const rows = [];
const report = {};
for (const mode of ['v1', 'swept']) {
  const pts = record(mode, th);
  const first = pts.findIndex((p) => p.ov > -1);
  const pick = [-4, 0, 2, 4, 6, 9, 13].map((d) => Math.max(0, Math.min(pts.length - 1, first + d)));
  report[mode] = { maxOverlapPx: +Math.max(...pts.map((p) => p.ov)).toFixed(2), frames: pick, overlapAtFrames: pick.map((i) => +Math.max(0, pts[i].ov).toFixed(1)) };
  const sp = path.join(ROOT, 'build', `bar_demo_${mode}.json`);
  fs.writeFileSync(sp, JSON.stringify(showFor(pts)));
  const dir = path.join(ROOT, 'build', `bar_demo_${mode}`);
  fs.rmSync(dir, { recursive: true, force: true });
  execFileSync(process.execPath, [path.join(ROOT, 'render', 'render.js'), 'frames', pick.join(','), dir, '--show', sp], { cwd: ROOT, stdio: 'ignore' });
  const files = pick.map((i) => path.join(dir, `f_${i}.png`));
  const strip = path.join(ROOT, 'build', `bar_strip_${mode}.png`);
  const inputs = files.flatMap((f) => ['-i', f]);
  const crops = files.map((_, k) => `[${k}:v]crop=300:260:1590:450,scale=300:260[c${k}]`).join(';');
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', `${crops};${files.map((_, k) => `[c${k}]`).join('')}hstack=inputs=${files.length}`, strip]);
  rows.push(strip);
}
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', rows[0], '-i', rows[1], '-filter_complex', 'vstack=inputs=2', path.join(out, 'crossbar_before_after.png')]);
fs.writeFileSync(path.join(ROOT, 'build', 'bar_demo.json'), JSON.stringify({ throw: th, idx, report }, null, 1));
console.log(JSON.stringify({ idx, report }));
