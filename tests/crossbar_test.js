'use strict';
// Crossbar penetration test: throws N balls at the crossbar from many angles and speeds and measures the
// maximum visible overlap of any ball into the DRAWN bar rectangle (design px).
// Usage: node tests/crossbar_test.js [N] [mode=swept|v1|both]  -> prints JSON, writes build/crossbar_<mode>.json
const fs = require('fs');
const path = require('path');
const Matter = require('matter-js');
const G = require('../sim/geometry');
const CFG = require('../sim/config');
const eng = require('../sim/engine');

function throwSet(n, seed) {
  const rng = eng.mulberry32(seed);
  const out = [];
  const r = G.BALL_R;
  for (let i = 0; i < n; i++) {
    const kind = rng();
    let x, y, ang, sp;
    if (kind < 0.15) { // aimed at the front corner (post side)
      x = G.BAR_X0 + (rng() - 0.5) * 2.2 * r; y = G.BAR_TOP - r - 2 - rng() * 120;
    } else {
      x = G.BAR_X0 - 40 + rng() * (G.BAR_X1 - G.BAR_X0 + 30); y = G.BAR_TOP - r - 2 - rng() * 220;
    }
    sp = rng() < 0.2 ? CFG.MAX_SPEED * (0.85 + 0.15 * rng()) : rng() * CFG.MAX_SPEED; // many near the speed cap
    ang = Math.PI / 2 + (rng() * 2 - 1) * (80 * Math.PI / 180); // from straight down +-80 deg
    out.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp });
  }
  return out;
}

function run(mode, throws) {
  const cfg = Object.assign({}, CFG, { BAR_MODE: mode });
  const W = eng.buildWorld(cfg);
  const dtMs = 1000 / cfg.HZ, r = G.BALL_R;
  const park = () => {
    eng.driveKinematic(W.mill, -2000, -2000, 0, -2000, -2000, 0);
    for (const k of Object.values(W.keeper)) eng.driveKinematic(k, -3000, -3000, 0, -3000, -3000, 0);
  };
  let maxOverlap = -Infinity, worst = null, bounced = 0, tunnelled = 0, contacts = 0;
  const hist = { '<=0': 0, '0-0.5': 0, '0.5-1': 0, '1-3': 0, '>3': 0 };
  throws.forEach((th, i) => {
    const ball = Matter.Bodies.circle(th.x, th.y, r, { restitution: cfg.BALL_RESTITUTION, friction: 0, frictionStatic: 0, frictionAir: cfg.FRICTION_AIR,
      collisionFilter: { category: eng.CAT.BALL, mask: eng.CAT.STATIC } });
    ball.deltaTime = dtMs; Matter.Body.setVelocity(ball, { x: th.vx / 60, y: th.vy / 60 });
    Matter.Composite.add(W.engine.world, ball);
    const st = { barGhost: false };
    let mo = -Infinity, hit = false, wentUp = false;
    for (let s = 0; s < 240; s++) {
      park();
      ball.force.y += ball.mass * cfg.GRAVITY / 1e6;
      if (mode === 'v1') {
        const above = ball.position.y + r <= G.BAR_TOP + 3;
        ball.collisionFilter.mask = eng.CAT.STATIC | (above ? eng.CAT.BAR : 0);
      } else ball.collisionFilter.mask = eng.CAT.STATIC;
      const px = ball.position.x, py = ball.position.y;
      Matter.Engine.update(W.engine, dtMs);
      const sp = Math.hypot(ball.velocity.x, ball.velocity.y), maxV = cfg.MAX_SPEED / 60;
      if (sp > maxV) Matter.Body.setVelocity(ball, { x: ball.velocity.x * maxV / sp, y: ball.velocity.y * maxV / sp });
      if (mode !== 'v1') { const h = eng.sweptBar(st, ball, r, px, py, cfg.BALL_RESTITUTION); if (h) hit = true; }
      else if (Math.abs(ball.position.y + r - G.BAR_TOP) < 3 && ball.velocity.y < 0) hit = true;
      if (ball.velocity.y < -0.3 && ball.position.y < G.BAR_TOP) wentUp = true;
      const o = eng.barOverlap(ball.position.x, ball.position.y, r);
      if (o > mo) mo = o;
      const x = ball.position.x, y = ball.position.y;
      if (y > G.BAR_BOTTOM + r + 2 || x < G.BAR_X0 - 80 || y > G.H) {
        if (x >= G.BAR_X0 && x <= G.BAR_X1 && y > G.BAR_BOTTOM + r) tunnelled++;
        break;
      }
    }
    Matter.Composite.remove(W.engine.world, ball);
    if (hit) contacts++;
    if (wentUp) bounced++;
    hist[mo <= 0 ? '<=0' : mo <= 0.5 ? '0-0.5' : mo <= 1 ? '0.5-1' : mo <= 3 ? '1-3' : '>3']++;
    if (mo > maxOverlap) { maxOverlap = mo; worst = Object.assign({ i }, th); }
  });
  return { mode, n: throws.length, maxOverlapPx: +maxOverlap.toFixed(3), throwsWithContact: contacts, bouncedUp: bounced, tunnelledThrough: tunnelled, overlapHistogram: hist, worst };
}

function main() {
  const n = +(process.argv[2] || 5000);
  const which = process.argv[3] || 'both';
  const throws = throwSet(n, 2024);
  const res = {};
  for (const m of which === 'both' ? ['v1', 'swept'] : [which]) {
    const t0 = Date.now();
    res[m] = run(m, throws); res[m].ms = Date.now() - t0;
  }
  fs.mkdirSync(path.join(__dirname, '..', 'build'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'crossbar_test.json'), JSON.stringify(res, null, 2));
  console.log(JSON.stringify(res, null, 1));
}
module.exports = { run, throwSet };
if (require.main === module) main();
