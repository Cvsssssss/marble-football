'use strict';
// P5: timing-aware pump (spout). Before each launch the engine predicts, with the same physics, how a ball thrown
// from the spout will meet the windmill, and chooses the pop moment (delay up to one blade period, i.e. half a
// turn: the windmill is point-symmetric) and the launch speed (one of the TOSS_VY grid values) so the ball meets a
// blade at a good contact point. A small seeded jitter picks among the good options, so it is not robotic.
//
// Prediction = single-ball flight in the real world (same statics, same compound windmill, same 120 Hz step,
// gravity, air friction and swept crossbar; keeper parked, other balls ignored) from the moment the ball becomes
// physical at the spout. The flight outcome depends only on (windmill angle mod pi at that moment, windmill
// angular speed, launch velocity), so it is tabulated once per process (and cached on disk):
//   OMEGA levels: 1, (1+BOOST)/2 and BOOST times OMEGA; ANG_BINS angles over [0, pi); VY_GRID launch speeds; vx = 0.
// Each cell stores the first-contact peak speed (0.3 s window), its direction and the outcome of the flight.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Matter = require('matter-js');
const G = require('./geometry');
const GH = require('./good_hit');

const ANG_BINS = 96;
const VY_GRID = [300, 315, 330, 345, 360];
const FLIGHT_T = 4.0; // s (long enough for the high lobs to land)
const modPi = (x) => ((x % Math.PI) + Math.PI) % Math.PI;

// One flight. Returns { contact, peak, peakVx, peakVy, outcome, mouth, good }. outcome: 'goal' | 'right' (lands on the
// right platform) | 'over' (flies over the goal, out) | 'down' (void gap or back on the left platform) | 'rehit' (comes
// back to the windmill for a second contact first) | 'other' (still in the air). mouth: the ball passed within
// good_hit.MOUTH_MARGIN of the goal-mouth region (goal, bar/post or near miss).
function makeFlyer(cfg, eng) {
  const W = eng.buildWorld(cfg);
  const dt = 1 / cfg.HZ, gScale = cfg.GRAVITY / 1e6, maxV = cfg.MAX_SPEED / 60;
  const park = { footY: G.GROUND_Y + 400, c: 0, a: 0 };
  let hitMill = false, body = null, millStarts = 0;
  Matter.Events.on(W.engine, 'collisionStart', (e) => {
    for (const p of e.pairs) if ((p.bodyA.parent === W.mill && p.bodyB === body) || (p.bodyB.parent === W.mill && p.bodyA === body)) { hitMill = true; millStarts++; }
  });
  return function fly(a0, omega, vx, vy) {
    const r = cfg.BALL_RADIUS || G.BALL_R;
    body = Matter.Bodies.circle(G.SPOUT_X, G.GROUND_Y - r - 1, r, { restitution: cfg.BALL_RESTITUTION, friction: 0, frictionStatic: 0, frictionAir: cfg.FRICTION_AIR,
      collisionFilter: { category: eng.CAT.BALL, mask: eng.CAT.STATIC | eng.CAT.MILL } });
    body.deltaTime = W.dtMs;
    Matter.Body.setVelocity(body, { x: vx / 60, y: -vy / 60 });
    Matter.Composite.add(W.engine.world, body);
    hitMill = false; millStarts = 0;
    const st = { barGhost: false };
    let contactStep = -1, peak = 0, peakVx = 0, peakVy = 0, outcome = 'other', startsAtContact = 0, mouth = false;
    const ang = (t) => a0 - omega * t;
    for (let s = 0; s < cfg.HZ * FLIGHT_T; s++) {
      const t = s * dt;
      eng.driveKinematic(W.mill, G.HUB_X, G.HUB_Y, ang(t), G.HUB_X, G.HUB_Y, ang(t + dt));
      eng.driveKinematic(W.keeper.legs, -3000, -3000, 0, -3000, -3000, 0);
      body.force.y += body.mass * gScale;
      const px = body.position.x, py = body.position.y;
      Matter.Engine.update(W.engine, W.dtMs);
      const sp = Math.hypot(body.velocity.x, body.velocity.y);
      if (sp > maxV) Matter.Body.setVelocity(body, { x: body.velocity.x * maxV / sp, y: body.velocity.y * maxV / sp });
      eng.sweptBar(st, body, r, px, py, cfg.BALL_RESTITUTION);
      if (hitMill && contactStep < 0) { contactStep = s; startsAtContact = millStarts; }
      if (contactStep >= 0 && millStarts > startsAtContact) { if (s - contactStep > Math.round(0.25 * cfg.HZ)) { outcome = 'rehit'; break; } startsAtContact = millStarts; }
      if (contactStep >= 0 && s - contactStep <= Math.round(0.3 * cfg.HZ)) {
        const v = Math.hypot(body.velocity.x, body.velocity.y) * 60;
        if (v > peak) { peak = v; peakVx = body.velocity.x * 60; peakVy = body.velocity.y * 60; }
      }
      const x = body.position.x, y = body.position.y;
      if (px < G.GOAL_LINE_X && x >= G.GOAL_LINE_X && y > G.BAR_Y && y < G.GROUND_Y) { outcome = 'goal'; break; }
      if (contactStep >= 0 && GH.pointDist(x, y) <= GH.MOUTH_MARGIN) mouth = true;
      if (x + r >= G.W - 1.5 && y < G.BAR_TOP) { outcome = 'over'; break; }
      if (x >= G.RIGHT_PLAT[0] && y >= G.GROUND_Y - r - 2) { outcome = 'right'; break; }
      if (y > G.GROUND_Y + r) { outcome = 'down'; break; }
      if (contactStep >= 0 && s - contactStep > 6 && x <= G.LEFT_PLAT[1] && y >= G.GROUND_Y - r - 2) { outcome = 'down'; break; } // landed back on the left platform
    }
    Matter.Composite.remove(W.engine.world, body);
    const contact = contactStep >= 0;
    const good = goodHit({ contact, peak, peakVx, outcome, mouth }, cfg);
    return { contact, peak: Math.round(peak), peakVx: Math.round(peakVx), peakVy: Math.round(peakVy), outcome, mouth, good, end: [Math.round(body.position.x), Math.round(body.position.y)], secondContacts: millStarts - startsAtContact };
  };
}
// "Good hit" for the pump: the first windmill contact gives the ball >= PUMP_GOOD_V towards the goal side
// (peak vx > 0) and the ball really attacks the goal: it scores, passes the goal mouth (bar, post, near miss: the
// keeper would be there) or lands on the right platform in front of the goal. Flying over the goal is NOT good.
function goodHit(f, cfg) { return !!(f.contact && f.peak >= cfg.PUMP_GOOD_V && f.peakVx > 0 && (f.outcome === 'goal' || f.mouth || f.outcome === 'right')); }

const VX_GRID = [-20, 0, 20];
const PEAK_TOL = 80; // px/s: options within this of the strongest robust good contact are equally likely (jitter)
const tables = new Map();
function tableKey(cfg) {
  const keys = ['HZ', 'GRAVITY', 'MAX_SPEED', 'OMEGA', 'BOOST', 'BALL_RESTITUTION', 'MILL_RESTITUTION', 'FRICTION_AIR', 'PUMP_GOOD_V', 'BALL_RADIUS', 'ENGINE_VERSION'];
  return crypto.createHash('sha256').update(JSON.stringify([keys.map((k) => cfg[k]), ANG_BINS, VY_GRID, VX_GRID, FLIGHT_T, 'pump-4'])).digest('hex').slice(0, 16);
}
function omegaLevels(cfg) { const b = cfg.BOOST || 1; return [1, (1 + b) / 2, b].map((k) => cfg.OMEGA * k); }
// tab.cells[level][vxIndex][vyIndex][angBin] = [good 0|1, peak, peakVx, outcome initial]
function getTable(cfg) {
  const key = tableKey(cfg);
  if (tables.has(key)) return tables.get(key);
  const file = path.join(__dirname, '..', 'build', 'cache', `pump_table_${key}.json`);
  let tab = null;
  try { if (fs.existsSync(file)) tab = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { tab = null; }
  if (!tab || tab.key !== key) {
    const eng = require('./engine');
    const fly = makeFlyer(cfg, eng);
    tab = { key, omegas: omegaLevels(cfg), vx: VX_GRID, vy: VY_GRID, bins: ANG_BINS, cells: [] };
    for (const om of tab.omegas) {
      tab.cells.push(VX_GRID.map((vx) => VY_GRID.map((vy) => Array.from({ length: ANG_BINS }, (_, i) => {
        const f = fly((i + 0.5) * Math.PI / ANG_BINS, om, vx, vy); return [f.good ? 1 : 0, f.peak, f.peakVx, f.mouth ? 'm' : f.outcome[0]]; }))));
    }
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(tab)); } catch (e) { /* cache is optional */ }
  }
  tables.set(key, tab);
  return tab;
}
function levelOf(tab, omega) { let li = 0; for (let i = 1; i < tab.omegas.length; i++) if (Math.abs(tab.omegas[i] - omega) < Math.abs(tab.omegas[li] - omega)) li = i; return li; }
function binOf(tab, angle) { return Math.min(tab.bins - 1, Math.floor(modPi(angle) / Math.PI * tab.bins)); }
function lookup(tab, omega, angle, vxIdx, vyIdx) { return tab.cells[levelOf(tab, omega)][vxIdx][vyIdx][binOf(tab, angle)]; }
// the two vx grid indices around vx (one if vx is on a grid value)
function vxIdxs(vx) {
  if (vx <= VX_GRID[0]) return [0];
  for (let i = 0; i < VX_GRID.length - 1; i++) if (vx <= VX_GRID[i + 1]) return vx === VX_GRID[i + 1] ? [i + 1] : [i, i + 1];
  return [VX_GRID.length - 1];
}

// Plan a launch at simulation time t0 (the step when the flow is due and a ball is ready).
// millAngle(t), omega(t): windmill functions; dt: physics step; vx: the ball's sideways launch speed (already drawn);
// rng: the pump's own rng (seeded jitter). Returns { delaySteps, vy, good, peak }: pop after delaySteps steps
// (0 .. one blade period) with upward speed vy (one of VY_GRID).
// Choice: options (delay, vy) whose predicted contact is good and ROBUST (also good one angle bin earlier and later,
// and for the vx grid values around vx); among them those within PEAK_TOL of the strongest one; one picked at random.
// Fallbacks: any good option; else the strongest contact towards the goal side.
function planLaunch(cfg, t0, millAngle, omega, dt, rng, vx) {
  const tab = getTable(cfg);
  const period = Math.PI / omega(t0);
  const J = Math.max(1, Math.ceil(period / dt));
  const xs = vxIdxs(vx || 0);
  const robust = [], good = [];
  let best = null, bestScore = -Infinity;
  for (let j = 0; j <= J; j++) {
    const tl = t0 + j * dt + cfg.EMERGE_TIME;
    const li = levelOf(tab, omega(tl)), bin = binOf(tab, millAngle(tl));
    for (let v = 0; v < VY_GRID.length; v++) {
      const cell = (xi, b) => tab.cells[li][xi][v][(b + tab.bins) % tab.bins];
      const c = cell(xs[0], bin);
      const allGood = xs.every((xi) => cell(xi, bin)[0] && cell(xi, bin - 1)[0] && cell(xi, bin + 1)[0]);
      const peak = Math.min(...xs.map((xi) => cell(xi, bin)[1]));
      if (allGood) robust.push({ j, v, peak });
      if (c[0]) good.push({ j, v, peak: c[1] });
      const score = (c[2] > 0 ? c[1] : 0) + (c[3] === 'g' || c[3] === 'm' ? 2000 : c[3] === 'r' ? 1000 : 0);
      if (score > bestScore) { bestScore = score; best = { j, v, peak: c[1] }; }
    }
  }
  const pool = robust.length ? robust : good;
  if (pool.length) {
    const pmax = Math.max(...pool.map((o) => o.peak));
    const top = cfg.PUMP_PICK === 'any' ? pool : pool.filter((o) => o.peak >= pmax - PEAK_TOL);
    const o = top[Math.floor(rng() * top.length)];
    return { delaySteps: o.j, vy: VY_GRID[o.v], good: true, robust: robust.length > 0, peak: o.peak };
  }
  return { delaySteps: best.j, vy: VY_GRID[best.v], good: false, robust: false, peak: best.peak };
}

module.exports = { makeFlyer, goodHit, getTable, lookup, planLaunch, VY_GRID, VX_GRID, ANG_BINS, omegaLevels, modPi };
