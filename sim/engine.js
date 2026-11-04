'use strict';
// Deterministic marble-football match simulation (matter-js, fixed 120 Hz step, mulberry32 RNG).
const Matter = require('matter-js');
const crypto = require('crypto');
const G = require('./geometry');
const BASE_CFG = require('./config');
const CINE = require('./cinematic');

const { Engine, Bodies, Body, Composite, Events, Common } = Matter;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const uni = (rng, lo, hi) => lo + (hi - lo) * rng();
const modPi = (x) => ((x % Math.PI) + Math.PI) % Math.PI;
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

const CAT = { BALL: 0x1, STATIC: 0x2, KEEPER: 0x4, MILL: 0x8, BAR: 0x10 };
const STATE = { queue: 0, pipe: 1, emerge: 2, play: 3, net: 4, route: 5 }; // route = flying back to the pipe at 90'

// ---------- windmill angle (with the late-game boost) ----------
// omega(t) = OMEGA * (1 + (BOOST-1) * smoothstep((t - tA) / (tB - tA))), tA/tB = BOOST_RAMP game minutes.
// The angle is the exact integral of omega, so the windmill speeds up smoothly without any jump.
function makeMillAngle(cfg, phase) {
  const k = (cfg.BOOST || 1) - 1;
  const tA = cfg.BOOST_RAMP[0] / cfg.GAME_MIN_PER_SEC, tB = cfg.BOOST_RAMP[1] / cfg.GAME_MIN_PER_SEC, D = Math.max(1e-6, tB - tA);
  const F = (t) => { if (t <= tA) return 0; if (t >= tB) return D * 0.5 + (t - tB); const u = (t - tA) / D; return D * (u * u * u - 0.5 * u * u * u * u); };
  const angle = (t) => phase - cfg.OMEGA * (t + k * F(t)); // decreasing => counter-clockwise on screen
  const ramp = (t) => (k > 0 ? smooth((t - tA) / D) : 0);
  const omega = (t) => cfg.OMEGA * (1 + k * ramp(t));
  // the outlet toss phase follows the same ramp, so the faster arm still meets the ball at a good height
  const tossPhase = (t) => cfg.TOSS_PHASE + ((cfg.TOSS_PHASE_BOOST === undefined ? cfg.TOSS_PHASE : cfg.TOSS_PHASE_BOOST) - cfg.TOSS_PHASE) * ramp(t);
  return { angle, omega, tossPhase };
}

// ---------- crossbar (v2): one-way top surface, collider == drawn rectangle, swept test ----------
// Closest point of the drawn bar rectangle [BAR_X0,BAR_X1] x [BAR_TOP,BAR_BOTTOM] to (x,y).
function barClosest(x, y) {
  const cx = Math.max(G.BAR_X0, Math.min(G.BAR_X1, x)), cy = Math.max(G.BAR_TOP, Math.min(G.BAR_BOTTOM, y));
  if (cx === x && cy === y) return { cx: x, cy: G.BAR_TOP, d: 0, inside: true };
  return { cx, cy, d: Math.hypot(x - cx, y - cy), inside: false };
}
// visible overlap depth (px) of a ball of radius r centred at (x,y) into the drawn bar (<=0: no overlap)
function barOverlap(x, y, r) { const c = barClosest(x, y); return c.inside ? r + (y - G.BAR_TOP) : r - c.d; }
// b: ball state (holds barGhost), bd: matter body after Engine.update, (p0x,p0y): centre before the step.
// A ball is solid against the bar only if its centre was above the top surface at the start of the step.
// A ball that touches the bar with its centre below the top (from below / from the side) becomes a "ghost"
// and passes through until it is clear of the bar. Returns {impact, x, y} on contact, else null.
// Latch: for ~0.1 s after its centre was above the top surface, a ball that slid past the front corner is also
// solid against the bar's front end face (otherwise it would visibly slide into the bar end).
const BAR_LATCH_STEPS = 12;
function sweptBar(b, bd, r, p0x, p0y, e) {
  b.barAge = p0y < G.BAR_TOP ? 0 : (b.barAge === undefined ? 1e9 : b.barAge + 1);
  const latched = b.barAge <= BAR_LATCH_STEPS && p0x < G.BAR_X0 && p0y < G.BAR_BOTTOM + r;
  const o0 = barOverlap(p0x, p0y, r);
  if (b.barGhost) { if (o0 <= 0) b.barGhost = false; }
  else if (o0 > 0 && p0y >= G.BAR_TOP && !latched) b.barGhost = true;
  if (b.barGhost || (p0y >= G.BAR_TOP && !latched)) return null;
  const x1 = bd.position.x, y1 = bd.position.y;
  const K = Math.max(1, Math.ceil(Math.hypot(x1 - p0x, y1 - p0y) / 1.5));
  for (let k = 1; k <= K; k++) {
    const qx = p0x + ((x1 - p0x) * k) / K, qy = p0y + ((y1 - p0y) * k) / K;
    const c = barClosest(qx, qy);
    if (!c.inside && c.d >= r) continue;
    let nx = 0, ny = -1;
    if (!c.inside && c.d > 1e-6) { nx = (qx - c.cx) / c.d; ny = (qy - c.cy) / c.d; }
    const px = c.cx + nx * r, py = c.cy + ny * r;
    let vx = bd.velocity.x, vy = bd.velocity.y;
    const vn = vx * nx + vy * ny;
    if (vn < 0) { const ee = -vn * 60 < 40 ? 0 : e; vx -= (1 + ee) * vn * nx; vy -= (1 + ee) * vn * ny; }
    Body.setPosition(bd, { x: px, y: py });
    Body.setVelocity(bd, { x: vx, y: vy });
    return { impact: Math.max(0, -vn * 60), x: px, y: py };
  }
  return null;
}

// ---------- keeper schedule / pose ----------
function makeKeeperSchedule(rng, cfg, tMax) {
  const cycles = [];
  let t = -uni(rng, 0, 0.5);
  while (t < tMax) {
    const c = {
      t0: t,
      crouch: uni(rng, cfg.KEEPER_CROUCH[0], cfg.KEEPER_CROUCH[1]),
      air: uni(rng, cfg.KEEPER_JUMP_T[0], cfg.KEEPER_JUMP_T[1]),
      h: uni(rng, cfg.KEEPER_JUMP_H[0], cfg.KEEPER_JUMP_H[1]),
      bobF: uni(rng, 10, 15),
    };
    cycles.push(c);
    t += c.crouch + c.air;
  }
  return cycles;
}
function extendKeeperSchedule(cycles, rng, cfg, tMax) {
  let last = cycles[cycles.length - 1], t = last.t0 + last.crouch + last.air;
  while (t < tMax) {
    const c = { t0: t, crouch: uni(rng, cfg.KEEPER_CROUCH[0], cfg.KEEPER_CROUCH[1]), air: uni(rng, cfg.KEEPER_JUMP_T[0], cfg.KEEPER_JUMP_T[1]),
      h: uni(rng, cfg.KEEPER_JUMP_H[0], cfg.KEEPER_JUMP_H[1]), bobF: uni(rng, 10, 15) };
    cycles.push(c); t += c.crouch + c.air;
  }
  return cycles;
}
function keeperPose(sched, t) {
  // binary search the cycle
  let lo = 0, hi = sched.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (sched[m].t0 <= t) lo = m; else hi = m - 1; }
  const cy = sched[lo];
  const tau = t - cy.t0;
  let footY = G.GROUND_Y, c, a, air = false;
  if (tau < cy.crouch) {
    // crouched with a continuous bob (never perfectly still)
    c = 0.6 + 0.25 * smooth(tau / 0.12) + 0.12 * Math.sin(tau * cy.bobF) * smooth(tau / 0.15);
    a = 0.05 * (1 - Math.cos(tau * cy.bobF * 0.5)) + (1 - 0.05 * (1 - Math.cos(tau * cy.bobF * 0.5))) * smooth((tau - (cy.crouch - 0.12)) / 0.12);
  } else {
    const u = (tau - cy.crouch) / cy.air;
    footY = G.GROUND_Y - 4 * cy.h * u * (1 - u);
    c = (1 - smooth(u / 0.25)) + 0.6 * smooth((u - 0.8) / 0.2);
    a = 1 - smooth((u - 0.72) / 0.28);
    air = true;
  }
  return { footY, c, a, air };
}

// ---------- world ----------
function setDt(body, dtMs) { body.deltaTime = dtMs; body.parts.forEach((p) => (p.deltaTime = dtMs)); }

function driveKinematic(body, x0, y0, a0, x1, y1, a1) {
  Body.setPosition(body, { x: x0, y: y0 });
  Body.setAngle(body, a0);
  body.positionPrev.x = x0 - (x1 - x0);
  body.positionPrev.y = y0 - (y1 - y0);
  body.anglePrev = a0 - (a1 - a0);
  body.velocity.x = x1 - x0; body.velocity.y = y1 - y0;
  body.angularVelocity = a1 - a0;
}

function makeKinematic(body, restitution) {
  Body.setMass(body, 1e7);
  Body.setInertia(body, Infinity);
  body.frictionAir = 0; body.friction = 0; body.frictionStatic = 0;
  body.restitution = restitution;
  return body;
}

function buildWorld(cfg) {
  Common._nextId = 0; Common._seed = 0;
  const engine = Engine.create({ enableSleeping: false });
  engine.gravity.x = 0; engine.gravity.y = 0; engine.gravity.scale = 0; // gravity applied manually to balls
  engine.positionIterations = 8; engine.velocityIterations = 6;
  const dtMs = 1000 / cfg.HZ;
  const statics = [];
  const st = (x, y, w, h, label, cat) => {
    const b = Bodies.rectangle(x, y, w, h, { isStatic: true, label, friction: 0, frictionStatic: 0, restitution: 0,
      collisionFilter: { category: cat || CAT.STATIC, mask: CAT.BALL } });
    statics.push(b); return b;
  };
  const gy = G.GROUND_Y;
  st((G.LEFT_PLAT[0] + G.LEFT_PLAT[1]) / 2 - 20, gy + 150, G.LEFT_PLAT[1] - G.LEFT_PLAT[0] + 40, 300, 'ground');
  st((G.RIGHT_PLAT[0] + G.RIGHT_PLAT[1]) / 2 + 20, gy + 150, G.RIGHT_PLAT[1] - G.RIGHT_PLAT[0] + 40, 300, 'ground');
  st(G.WALL_LEFT_X - 50, -400, 100, 2400, 'wall');            // left wall = outer face of pipe
  st(G.W + 50, -400, 100, 2400, 'wall');                      // right wall (behind the net)
  const bar = st(G.GOAL_LINE_X + G.GOAL_DEPTH / 2, G.BAR_Y, G.GOAL_DEPTH, G.BAR_THICK, 'bar', CAT.BAR);
  // windmill: bar + two curved hooks as one compound kinematic body
  const parts = [Bodies.rectangle(0, 0, 2 * G.MILL_HALF, G.MILL_THICK)];
  const hp = G.hookPoints(6);
  for (const sgn of [1, -1]) {
    for (let i = 1; i < hp.length; i++) {
      const p0 = [hp[i - 1][0] * sgn, hp[i - 1][1] * sgn], p1 = [hp[i][0] * sgn, hp[i][1] * sgn];
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 3;
      const seg = Bodies.rectangle((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, len, G.HOOK_THICK, { chamfer: { radius: 3 } });
      Body.setAngle(seg, Math.atan2(p1[1] - p0[1], p1[0] - p0[0]));
      parts.push(seg);
    }
  }
  const mill = Body.create({ parts, label: 'mill', collisionFilter: { category: CAT.MILL, mask: CAT.BALL } });
  makeKinematic(mill, cfg.MILL_RESTITUTION);
  // compound centroid is the hub (point-symmetric shape); place it
  Body.setPosition(mill, { x: G.HUB_X, y: G.HUB_Y });
  // keeper parts
  const kf = { category: CAT.KEEPER, mask: CAT.BALL, group: -7 };
  const sk = G.keeperSkeleton(G.KEEPER_X, G.GROUND_Y, 0.5, 0);
  const kLegs = makeKinematic(Bodies.rectangle(sk.legs.x, sk.legs.y, sk.legs.w, sk.legs.h, { label: 'keeper', collisionFilter: kf, chamfer: { radius: 5 } }), cfg.KEEPER_RESTITUTION);
  const kTorso = makeKinematic(Bodies.rectangle(sk.torso.x, sk.torso.y, sk.torso.w, sk.torso.h, { label: 'keeper', collisionFilter: kf, chamfer: { radius: 7 } }), cfg.KEEPER_RESTITUTION);
  const kHead = makeKinematic(Bodies.circle(sk.head.x, sk.head.y, sk.head.r, { label: 'keeper', collisionFilter: kf }), cfg.KEEPER_RESTITUTION);
  const kArm = makeKinematic(Bodies.rectangle(sk.arm.x, sk.arm.y, sk.arm.w, sk.arm.h, { label: 'keeper', collisionFilter: kf, chamfer: { radius: 4 } }), cfg.KEEPER_RESTITUTION);
  const keeper = { legs: kLegs, torso: kTorso, head: kHead, arm: kArm };
  Composite.add(engine.world, [...statics, mill, kLegs, kTorso, kHead, kArm]);
  [...statics, mill, kLegs, kTorso, kHead, kArm].forEach((b) => setDt(b, dtMs));
  return { engine, mill, keeper, bar, dtMs };
}

function driveKeeper(keeper, p0, p1) {
  const s0 = G.keeperSkeleton(G.KEEPER_X, p0.footY, p0.c, p0.a);
  const s1 = G.keeperSkeleton(G.KEEPER_X, p1.footY, p1.c, p1.a);
  for (const k of ['legs', 'torso', 'head', 'arm']) {
    const a0 = s0[k].angle || 0, a1 = s1[k].angle || 0;
    driveKinematic(keeper[k], s0[k].x, s0[k].y, a0, s1[k].x, s1[k].y, a1);
  }
}

// ---------- match ----------
// ctx: { kind: 'leg1'|'leg2'|'final'|'test', prevA, prevB, rA, rB, massA, massB }
function simulateMatch(seed, ctx, cfgOverride) {
  const cfg = Object.assign({}, BASE_CFG, cfgOverride || {});
  ctx = Object.assign({ kind: 'final', prevA: 0, prevB: 0, rA: G.BALL_R, rB: G.BALL_R }, ctx || {});
  const rng = mulberry32(seed >>> 0);
  const dt = 1 / cfg.HZ;
  const stepsPerFrame = Math.round(cfg.HZ / cfg.FPS);
  const W = buildWorld(cfg);
  const { engine, mill, keeper } = W;
  const gScale = cfg.GRAVITY / 1e6; // px per ms^2
  const vToMatter = (v) => v / 60;  // px/s -> matter units (per 16.67 ms base step)
  const vFromMatter = (v) => v * 60;
  const maxV = vToMatter(cfg.MAX_SPEED);

  const addedTime = cfg.ADDED_MIN[0] + Math.floor(rng() * (cfg.ADDED_MIN[1] - cfg.ADDED_MIN[0] + 1)); // 1..3 by default
  const regEnd = 90 / cfg.GAME_MIN_PER_SEC;    // 45 s
  // P1b: added time = addedTime extra shots after 90' (not game minutes); endReg = when the last shot is over
  let endReg = null;
  const tMaxAll = regEnd + cfg.CLEAR_TIME + 3 + cfg.ADDED_BANNER + addedTime * (cfg.SHOT_CAP + cfg.SHOT_GOAL_GAP + 4) + cfg.GOLDEN_CAP + 6;
  // the main rng is consumed exactly as in v2 (keeper schedule for the old time span), so regular play up to 90'
  // is identical to v2 for the same seed; the extra time span and the first shot team use their own rng
  const xrng = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const ksched = makeKeeperSchedule(rng, cfg, regEnd + addedTime / cfg.GAME_MIN_PER_SEC + cfg.GOLDEN_CAP + 4 + 2);
  extendKeeperSchedule(ksched, xrng, cfg, tMaxAll + 2);
  const millPhase = rng() * Math.PI * 2;
  let shotTeam = xrng() < 0.5 ? 'A' : 'B'; // team of the first added-time shot (seeded)
  const srng = mulberry32((seed ^ 0x2c1b3c6d) >>> 0); // P2 strength lever
  const MA = makeMillAngle(cfg, millPhase);
  const millAngle = MA.angle;

  const L = G.pipeLength();
  const balls = [];
  const N = cfg.BALLS_PER_TEAM;
  for (let i = 0; i < 2 * N; i++) {
    const team = i % 2 === 0 ? 'A' : 'B';
    balls.push({ id: i, team, player: i >> 1, r: team === 'A' ? ctx.rA : ctx.rB, state: 'pipe', s: 0, body: null,
      x: 0, y: 0, vx: 0, vy: 0, spin: 0, still: 0, t: 0, scored: false, barGhost: false, launch: null });
  }
  // initial queue: A,B,A,B... with A at the front
  const spacingOf = (b) => 2 * Math.max(ctx.rA, ctx.rB) + 3;
  balls.forEach((b, i) => { b.s = L - i * spacingOf(b); });

  const events = [];
  const goals = [];
  const score = { A: 0, B: 0 };
  let stuckCount = 0, safetyCount = 0;
  let nextRelease = 0.5;
  let turn = 'A';
  let tossTarget = cfg.TOSS_PHASE + uni(rng, -cfg.TOSS_PHASE_JIT, cfg.TOSS_PHASE_JIT);
  let mode = 'regular'; // regular | clear | banner | shots | golden | decided | done
  let clearStart = null, bannerStart = null, nextShotAt = 0, decideAt = null;
  let shotIdx = 0, shotBall = null, shotT0 = 0, shotCineDone = false, cineOpen = null;
  const shots = [], shotStarts = [], shotContacts = [], cines = [];
  let fineMode = false, fineStart = -1; // from the first shot on, one frame per physics step (for slow-motion resampling)
  let goldenStart = null, goldenWinner = null, tailUntil = null;
  let ended = false, failed = null;
  const frames = [];
  const lastEv = new Map();
  const launches = []; // windmill launch stats: { gm, v } = peak ball speed within 0.3 s after a windmill contact

  const ev = (t, type, extra) => events.push(Object.assign({ t: +t.toFixed(4), type }, extra || {}));

  function toPipe(b, t, why) {
    if (b.body) { Composite.remove(engine.world, b.body); b.body = null; }
    b.state = 'pipe'; b.s = 0; b.still = 0; b.scored = false; b.barGhost = false; b.barAge = undefined; b.launch = null;
    ev(t, 'whoosh', { ball: b.id, why });
    if (b === shotBall) resolveShot(why, t);
  }
  function resolveShot(result, t) {
    const k = shotIdx + 1;
    shots.push({ k, team: shotBall.team, ball: shotBall.id, t0: +shotT0.toFixed(4), t1: +t.toFixed(4), result, cine: cines.some((c) => c.k === k) });
    if (cineOpen) { cineOpen.tOut = Math.min(t, cineOpen.tIn + cfg.CINE_MAX_SIM); cineOpen = null; }
    shotBall = null; shotIdx++;
    nextShotAt = t + (result === 'goal' ? cfg.SHOT_GOAL_GAP : cfg.SHOT_GAP);
    if (shotIdx >= addedTime) decideAt = t + (result === 'goal' ? cfg.SHOT_GOAL_GAP : cfg.SHOT_END_GAP);
  }
  // 90' clear: a ball flies along a smooth arc to the pipe mouth (top-left), then joins the pipe
  function startRoute(b, t, k) {
    const x = b.body ? b.body.position.x : b.x, y = b.body ? b.body.position.y : b.y;
    if (b.body) { Composite.remove(engine.world, b.body); b.body = null; }
    b.state = 'route'; b.t = -k * cfg.ROUTE_STAGGER; b.rx0 = x; b.ry0 = y; b.x = x; b.y = y; b.launch = null;
    ev(t + k * cfg.ROUTE_STAGGER, 'whoosh', { ball: b.id, why: 'clear' });
  }

  // collision sound events
  Events.on(engine, 'collisionStart', (e) => {
    for (const pair of e.pairs) {
      const A = pair.bodyA.parent, B = pair.bodyB.parent;
      const ba = A.plugin && A.plugin.ball, bb = B.plugin && B.plugin.ball;
      if (!ba && !bb) continue;
      // note: matter-js deep-copies plugin objects, so resolve the live ball state by id (v1 bug: x/y were always 0)
      const other = ba ? B : A; const ball = balls[(ba || bb).id];
      let type;
      if (ba && bb) type = 'ballball';
      else type = other.label; // ground | wall | bar | mill | keeper
      if (type === 'mill' && !ball.launch) ball.launch = { step0: step, best: 0, vx: 0, t0: simT };
      const n = pair.collision.normal;
      const rvx = A.velocity.x - B.velocity.x, rvy = A.velocity.y - B.velocity.y;
      const imp = Math.abs(rvx * n.x + rvy * n.y) * 60;
      const thr = type === 'ground' ? 60 : 35;
      if (imp < thr) continue;
      const key = ball.id + ':' + type;
      const tt = engine.timing.timestamp / 1000;
      if (lastEv.has(key) && tt - lastEv.get(key) < 0.08) continue;
      lastEv.set(key, tt);
      const px = ball.body ? ball.body.position.x : 0, py = ball.body ? ball.body.position.y : 0;
      ev(simT, type, { ball: ball.id, v: Math.round(imp), x: Math.round(px), y: Math.round(py) });
    }
  });
  function barEvent(b, hit) {
    if (hit.impact < 35) return;
    const key = b.id + ':bar';
    if (lastEv.has(key) && simT - lastEv.get(key) < 0.08) return;
    lastEv.set(key, simT);
    ev(simT, 'bar', { ball: b.id, v: Math.round(hit.impact), x: Math.round(hit.x), y: Math.round(hit.y) });
  }

  let simT = 0;
  let step = 0;
  const totalStepsCap = Math.ceil(tMaxAll * cfg.HZ);
  ev(0, 'whistle', { kind: 'start' });
  let halfDone = false, addedDone = false;

  const spoutTop = { x: G.SPOUT_X, y: G.GROUND_Y - Math.max(ctx.rA, ctx.rB) - 1 };

  function recordFrame() {
    const kp = keeperPose(ksched, simT);
    const fb = balls.map((b) => {
      let x, y;
      if (b.body) { x = b.body.position.x; y = b.body.position.y; }
      else if (b.state === 'pipe') { const p = G.pipePoint(b.s); x = p[0]; y = p[1]; }
      else { x = b.x; y = b.y; }
      return [+x.toFixed(2), +y.toFixed(2), +b.spin.toFixed(3), STATE[b.state]];
    });
    frames.push({ t: +simT.toFixed(4), m: +millAngle(simT).toFixed(5),
      k: [+kp.footY.toFixed(2), +kp.c.toFixed(4), +kp.a.toFixed(4), kp.air ? 1 : 0], b: fb,
      sc: [score.A, score.B], mode: mode === 'golden' ? 1 : 0 });
  }

  recordFrame();
  while (step < totalStepsCap) {
    const t0 = simT, t1 = simT + dt;
    // --- clock events ---
    if (!halfDone && t1 >= regEnd / 2) { halfDone = true; ev(regEnd / 2, 'whistle', { kind: 'half' }); }
    if (mode === 'regular' && t1 >= regEnd) {
      // 90': whistle, the pitch is cleared (balls in play fly into the pipe), then the +N banner and N shots
      mode = 'clear'; clearStart = regEnd; addedDone = true;
      ev(regEnd, 'whistle', { kind: 'reg' });
      let k = 0;
      for (const b of balls) if (b.state === 'play' || b.state === 'emerge') startRoute(b, regEnd, k++);
    }
    if (mode === 'clear' && t1 >= clearStart + cfg.CLEAR_TIME && balls.every((b) => b.state === 'pipe')) {
      mode = 'banner'; bannerStart = t1; ev(t1, 'added', { minutes: addedTime, shots: addedTime });
    }
    if (mode === 'banner' && t1 >= bannerStart + cfg.ADDED_BANNER) { mode = 'shots'; nextShotAt = t1; }
    if (mode === 'shots' && shotIdx >= addedTime && decideAt !== null && t1 >= decideAt) {
      endReg = t1;
      const tot = ctx.kind === 'leg2' ? [score.A + ctx.prevA, score.B + ctx.prevB] : [score.A, score.B];
      if (cfg.GOLDEN_BALL && ctx.kind !== 'leg1' && ctx.kind !== 'test' && tot[0] === tot[1]) {
        mode = 'golden'; goldenStart = t1; ev(t1, 'golden');
        nextRelease = t1 + 0.6; turn = shots.length ? (shots[shots.length - 1].team === 'A' ? 'B' : 'A') : 'A';
      } else {
        mode = 'done'; ev(t1, 'whistle', { kind: 'end' }); ended = true;
        break;
      }
    }
    if (mode === 'golden' && t1 - goldenStart > cfg.GOLDEN_CAP) { failed = 'golden_cap'; break; }
    if (tailUntil !== null && t1 >= tailUntil) { ended = true; break; }

    // --- kinematic bodies ---
    driveKinematic(mill, G.HUB_X, G.HUB_Y, millAngle(t0), G.HUB_X, G.HUB_Y, millAngle(t1));
    driveKeeper(keeper, keeperPose(ksched, t0), keeperPose(ksched, t1));

    // --- outlet ---
    const regularFlow = (mode === 'regular' || mode === 'golden') && tailUntil === null && t0 >= nextRelease;
    const shotFlow = mode === 'shots' && shotBall === null && shotIdx < addedTime && t0 >= nextShotAt;
    const phaseOk = modPi(millAngle(t0) - tossTarget) < MA.omega(t1) * dt * 1.001 + 1e-9;
    if ((regularFlow || shotFlow) && phaseOk) {
      const inPipe = balls.filter((b) => b.state === 'pipe').sort((a, b) => b.s - a.s);
      const spoutClear = !balls.some((b) => b.body && Math.hypot(b.body.position.x - spoutTop.x, b.body.position.y - spoutTop.y) < 2 * b.r + 6)
        && !balls.some((b) => b.state === 'emerge');
      if (inPipe.length && inPipe[0].s >= L - 0.5 && spoutClear) {
        // queued = balls resting in the final queue zone
        const queued = inPipe.filter((b, k) => b.s >= L - k * spacingOf(b) - 0.5);
        // P2 strength (invisible): in regular play the favourite sometimes takes the release turn (ctx.edge = probability,
        // ctx.fav = 'A'|'B'); own rng so the main sequence is unchanged. Ball size is identical for every team.
        let want = turn;
        if (!shotFlow && ctx.fav && ctx.edge > 0 && turn !== ctx.fav && srng() < ctx.edge) want = ctx.fav;
        const pick = shotFlow ? queued.find((b) => b.team === shotTeam) : (queued.find((b) => b.team === want) || queued[0]);
        if (pick) {
        pick.state = 'emerge'; pick.t = 0; pick.x = G.SPOUT_X; pick.y = G.GROUND_Y + pick.r;
        turn = pick.team === 'A' ? 'B' : 'A';
        ev(t0, 'pop', { ball: pick.id, team: pick.team });
        if (shotFlow) {
          shotBall = pick; shotT0 = t0; shotCineDone = false; shotStarts.push(+t0.toFixed(4));
          ev(t0, 'shot', { k: shotIdx + 1, n: addedTime, team: pick.team, ball: pick.id });
          shotTeam = shotTeam === 'A' ? 'B' : 'A';
        }
        // golden ball: if it has not resolved after GOLDEN_WIDEN_AFTER s, widen the spout flow slightly
        const boost = mode === 'golden' ? cfg.GOLDEN_FLOW_BOOST * (t0 - goldenStart > cfg.GOLDEN_WIDEN_AFTER ? cfg.GOLDEN_WIDEN : 1) : 1;
        nextRelease = t0 + uni(rng, cfg.RELEASE_INTERVAL[0], cfg.RELEASE_INTERVAL[1]) / boost - Math.PI / MA.omega(t0) / 2;
        tossTarget = MA.tossPhase(t0) + uni(rng, -cfg.TOSS_PHASE_JIT, cfg.TOSS_PHASE_JIT);
        }
      }
    }

    // --- scripted states ---
    const inPipe = balls.filter((b) => b.state === 'pipe').sort((a, b) => b.s - a.s);
    let prevS = Infinity;
    inPipe.forEach((b, k) => {
      const p = G.pipePoint(b.s);
      const v = p[2] === 0 ? cfg.PIPE_SPEED_FALL : cfg.PIPE_SPEED_FLAT;
      const limit = Math.min(L - k * spacingOf(b), prevS - spacingOf(b));
      b.s = Math.min(b.s + v * dt, limit);
      prevS = b.s;
      b.spin += (v * dt) / b.r * (b.s < limit ? 1 : 0);
    });
    for (const b of balls) {
      if (b.state === 'emerge') {
        b.t += dt;
        const u = Math.min(1, b.t / cfg.EMERGE_TIME);
        b.y = G.GROUND_Y + b.r - (2 * b.r + 1) * smooth(u);
        if (u >= 1) {
          const body = Bodies.circle(G.SPOUT_X, G.GROUND_Y - b.r - 1, b.r, {
            label: 'ball', restitution: cfg.BALL_RESTITUTION, friction: 0, frictionStatic: 0,
            frictionAir: cfg.FRICTION_AIR, density: 0.001 * (b.team === 'A' ? (ctx.densA || 1) : (ctx.densB || 1)),
            collisionFilter: { category: CAT.BALL, mask: CAT.BALL | CAT.STATIC | CAT.KEEPER | CAT.MILL | CAT.BAR },
            plugin: { ball: b } });
          setDt(body, W.dtMs);
          Body.setVelocity(body, { x: vToMatter(uni(rng, cfg.TOSS_VX[0], cfg.TOSS_VX[1])), y: vToMatter(-uni(rng, cfg.TOSS_VY[0], cfg.TOSS_VY[1])) });
          b.body = body; b.state = 'play'; b.still = 0;
          Composite.add(engine.world, body);
        }
      } else if (b.state === 'route') {
        b.t += dt;
        if (b.t > 0) {
          const u = smooth(b.t / cfg.ROUTE_TIME);
          // quadratic bezier: lift, then glide to the pipe mouth above the top-left corner
          const mx = (b.rx0 + G.PIPE_X) / 2, my = Math.min(b.ry0, 260) - 220;
          const ex = G.PIPE_X, ey = -40;
          b.x = (1 - u) * (1 - u) * b.rx0 + 2 * (1 - u) * u * mx + u * u * ex;
          b.y = (1 - u) * (1 - u) * b.ry0 + 2 * (1 - u) * u * my + u * u * ey;
          b.spin -= 0.25;
        }
        if (b.t >= cfg.ROUTE_TIME) { b.state = 'pipe'; b.s = 0; b.still = 0; b.barGhost = false; b.barAge = undefined; }
      } else if (b.state === 'net') {
        b.t += dt;
        b.x += b.vx * dt; b.vx *= Math.exp(-5 * dt);
        b.vy += cfg.GRAVITY * dt; b.y += b.vy * dt;
        if (b.x > G.W - b.r - 4) { b.x = G.W - b.r - 4; if (b.vx > 0) { ev(t0, 'net', { ball: b.id, v: Math.round(b.vx) }); b.vx = -0.15 * b.vx; } }
        if (b.y > G.GROUND_Y - b.r) { b.y = G.GROUND_Y - b.r; b.vy = -0.3 * Math.abs(b.vy); }
        if (b.y < G.BAR_Y + G.BAR_THICK / 2 + b.r) { b.y = G.BAR_Y + G.BAR_THICK / 2 + b.r; b.vy = Math.abs(b.vy) * 0.3; }
        b.spin += (b.vx * dt) / b.r;
        if (b.t >= cfg.NET_TIME) toPipe(b, t1, 'goal');
      }
    }

    // --- physics for balls in play ---
    for (const b of balls) {
      if (!b.body) continue;
      const bd = b.body;
      bd.force.y += bd.mass * gScale;
      if (cfg.BAR_MODE === 'v1') {
        // v1 (old, kept only for the before/after measurement): matter-js collider, one-way by mask switching
        const above = bd.position.y + b.r <= G.BAR_TOP + 3;
        bd.collisionFilter.mask = CAT.BALL | CAT.STATIC | CAT.KEEPER | CAT.MILL | (above ? CAT.BAR : 0);
      } else bd.collisionFilter.mask = CAT.BALL | CAT.STATIC | CAT.KEEPER | CAT.MILL; // bar handled by sweptBar()
      b.px = bd.position.x; b.py = bd.position.y;
    }
    Engine.update(engine, W.dtMs);
    simT = t1; step++;

    for (const b of balls) {
      if (!b.body) continue;
      const bd = b.body;
      const sp = Math.hypot(bd.velocity.x, bd.velocity.y);
      if (sp > maxV) Body.setVelocity(bd, { x: bd.velocity.x * maxV / sp, y: bd.velocity.y * maxV / sp });
      if (cfg.BAR_MODE !== 'v1') { const hit = sweptBar(b, bd, b.r, b.px, b.py, cfg.BALL_RESTITUTION); if (hit) barEvent(b, hit); }
      if (b.launch) {
        const spd = Math.hypot(bd.velocity.x, bd.velocity.y) * 60;
        if (spd > b.launch.best) { b.launch.best = spd; b.launch.vx = bd.velocity.x * 60; }
        if (step - b.launch.step0 >= Math.round(0.3 * cfg.HZ)) {
          launches.push({ gm: +(simT * cfg.GAME_MIN_PER_SEC).toFixed(2), v: Math.round(b.launch.best) });
          // added-time shot: the first windmill contact decides "good hit" (cinematic) or miss
          if (mode === 'shots' && b === shotBall && !shotCineDone) {
            shotCineDone = true;
            const good = b.launch.best >= cfg.GOOD_HIT_V && b.launch.vx > 0;
            shotContacts.push({ k: shotIdx + 1, t: +b.launch.t0.toFixed(4), v: Math.round(b.launch.best), vx: Math.round(b.launch.vx), good });
            if (good) { cineOpen = { k: shotIdx + 1, ball: b.id, tIn: b.launch.t0, tOut: null }; cines.push(cineOpen); }
          }
          b.launch = null;
        }
      }
      const vx = vFromMatter(bd.velocity.x), vy = vFromMatter(bd.velocity.y);
      b.spin += (vx * dt) / b.r;
      const x = bd.position.x, y = bd.position.y;
      // goal: centre crosses the goal line under the crossbar
      if (b.px < G.GOAL_LINE_X && x >= G.GOAL_LINE_X && y > G.BAR_Y + 2 && y < G.GROUND_Y) {
        Composite.remove(engine.world, bd); b.body = null;
        b.state = 'net'; b.t = 0; b.x = x; b.y = y; b.vx = Math.max(vx, 120); b.vy = vy;
        const kp = keeperPose(ksched, simT);
        const counts = (mode === 'regular' || mode === 'shots' || mode === 'golden') && tailUntil === null;
        if (counts) {
          score[b.team]++;
          const shotK = mode === 'shots' && b === shotBall ? shotIdx + 1 : null;
          const g = { t: simT, team: b.team, ball: b.id, player: b.player, x, y, keeperAir: kp.air, keeperCrouch: !kp.air && kp.c > 0.5, golden: mode === 'golden', shot: shotK };
          goals.push(g);
          ev(simT, 'goal', { team: b.team, ball: b.id, player: b.player, golden: mode === 'golden', shot: shotK, sc: [score.A, score.B] });
          if (b === shotBall) resolveShot('goal', simT);
          if (mode === 'golden') {
            goldenWinner = b.team; ev(simT, 'whistle', { kind: 'end' });
            tailUntil = simT + 3.0; mode = 'decided'; // 3 s: golden-goal effect
          }
        }
        continue;
      }
      if (y > G.H + b.r + 10) { toPipe(b, simT, 'void'); continue; }
      if (x + b.r >= G.W - 1.5 && y < G.BAR_TOP) { toPipe(b, simT, 'over'); continue; }
      if (x > G.GOAL_LINE_X + b.r && y > G.BAR_Y && y < G.GROUND_Y) { toPipe(b, simT, 'safety'); safetyCount++; continue; }
      if (Math.hypot(vx, vy) < cfg.STUCK_SPEED) b.still += dt; else b.still = 0;
      if (b.still > cfg.STUCK_TIME) { toPipe(b, simT, 'stuck'); stuckCount++; continue; }
    }

    if (shotBall && shotBall.body && simT - shotT0 > cfg.SHOT_CAP) toPipe(shotBall, simT, 'cap');

    if (fineMode) recordFrame();
    else if (step % stepsPerFrame === 0) { recordFrame(); if (mode === 'shots') { fineMode = true; fineStart = frames.length - 1; } }
  }
  if (!ended && !failed) failed = 'time_cap';
  for (const c of cines) c.tOut = Math.min(c.tOut === null ? simT : c.tOut, c.tIn + cfg.CINE_MAX_SIM);
  const outFrames = fineStart >= 0 ? CINE.resample(frames, fineStart, cines, cfg, stepsPerFrame) : frames;
  CINE.annotate(events, outFrames, cines, cfg);

  const res = {
    seed, ctx, addedTime, regEnd, endReg: endReg === null ? simT : endReg, endT: simT,
    shots, shotStarts, shotContacts, cines,
    goldenStart, goldenWinner, goldenResolve: goldenWinner ? goals[goals.length - 1].t - goldenStart : null,
    score, goals, events, frames: outFrames, stuckCount, safetyCount, failed,
    rA: ctx.rA, rB: ctx.rB, millPhase, omega: cfg.OMEGA, launches,
  };
  res.hash = crypto.createHash('sha256').update(JSON.stringify({ f: outFrames, e: events })).digest('hex');
  return res;
}

// ---------- windmill toss test ----------
// Releases single balls from the spout (no other balls) and classifies where each first lands.
function tossTest(n, seed, cfgOverride) {
  const cfg = Object.assign({}, BASE_CFG, cfgOverride || {});
  const rng = mulberry32(seed);
  const W = buildWorld(cfg);
  const { engine, mill, keeper } = W;
  const dt = 1 / cfg.HZ, gScale = cfg.GRAVITY / 1e6;
  // keeper parked crouched far away (not part of this test)
  const park = { footY: G.GROUND_Y + 400, c: 0, a: 0 };
  const out = { goal: 0, right: 0, void: 0, left: 0, over: 0, other: 0, hit: 0 };
  let t = rng() * 10;
  const ang = (tt) => -cfg.OMEGA * tt;
  for (let i = 0; i < n; i++) {
    const r = G.BALL_R;
    const tgt = cfg.TOSS_PHASE + uni(rng, -cfg.TOSS_PHASE_JIT, cfg.TOSS_PHASE_JIT);
    t += modPi(ang(t) - tgt) / cfg.OMEGA + cfg.EMERGE_TIME;
    const body = Bodies.circle(G.SPOUT_X, G.GROUND_Y - r - 1, r, { restitution: cfg.BALL_RESTITUTION, friction: 0, frictionStatic: 0, frictionAir: cfg.FRICTION_AIR,
      collisionFilter: { category: CAT.BALL, mask: CAT.STATIC | CAT.MILL | CAT.BAR } });
    setDt(body, W.dtMs);
    Body.setVelocity(body, { x: uni(rng, cfg.TOSS_VX[0], cfg.TOSS_VX[1]) / 60, y: -uni(rng, cfg.TOSS_VY[0], cfg.TOSS_VY[1]) / 60 });
    Composite.add(engine.world, body);
    let res = 'other';
    let hitMill = false;
    const tb = { barGhost: false };
    const onCol = (e) => { for (const p of e.pairs) { if ((p.bodyA.parent === mill && p.bodyB === body) || (p.bodyB.parent === mill && p.bodyA === body)) hitMill = true; } };
    Events.on(engine, 'collisionStart', onCol);
    for (let s = 0; s < cfg.HZ * 6; s++) {
      driveKinematic(mill, G.HUB_X, G.HUB_Y, ang(t), G.HUB_X, G.HUB_Y, ang(t + dt));
      driveKeeper(keeper, park, park);
      body.force.y += body.mass * gScale;
      body.collisionFilter.mask = CAT.STATIC | CAT.MILL;
      const px = body.position.x, py = body.position.y;
      Engine.update(engine, W.dtMs); t += dt;
      sweptBar(tb, body, r, px, py, cfg.BALL_RESTITUTION);
      const x = body.position.x, y = body.position.y, vy = body.velocity.y;
      if (px < G.GOAL_LINE_X && x >= G.GOAL_LINE_X && y > G.BAR_Y && y < G.GROUND_Y) { res = 'goal'; break; }
      if (y > G.H + r) { res = 'void'; break; }
      if (x + r >= G.W - 1.5 && y < G.BAR_TOP) { res = 'over'; break; }
      if (s > 30 && y >= G.GROUND_Y - r - 2 && vy >= -0.2) {
        if (x >= G.RIGHT_PLAT[0]) { res = 'right'; break; }
        if (x <= G.LEFT_PLAT[1] && s > cfg.HZ * 0.6) { res = 'left'; break; }
      }
    }
    Events.off(engine, 'collisionStart', onCol);
    if (hitMill) out.hit++;
    out[res]++;
    Composite.remove(engine.world, body);
    t += uni(rng, 0.3, 1.2);
  }
  out.n = n;
  out.reachPct = (100 * (out.goal + out.right)) / n;
  return out;
}

module.exports = { simulateMatch, tossTest, keeperPose, mulberry32, STATE, CAT, buildWorld, driveKinematic, sweptBar, barOverlap, barClosest, makeMillAngle };
