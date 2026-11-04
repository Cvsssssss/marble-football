'use strict';
// Automatic checks (spec §6). Run: node tests/run_tests.js [--quick]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Matter = require('matter-js');
const G = require('../sim/geometry');
const CFG = require('../sim/config');
const eng = require('../sim/engine');
const TOUR = require('../sim/tournament');
const { buildTournament } = TOUR;
const L = require('../sim/config_loader');
const CLOCK = require('../sim/clock');
const BRACKET = require('../render/bracket_layout');
const ROOT = path.join(__dirname, '..');

const QUICK = process.argv.includes('--quick');
const results = [];
let failed = 0;
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  if (!ok) failed++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : ''));
}

// ---------- per-match invariants ----------
function matchInvariants(m, label) {
  const N = 2 * CFG.BALLS_PER_TEAM;
  const r = [m.rA, m.rB];
  const fr = m.frames;
  let accountingOk = true, inGoalOk = true, netOk = true, stuckOk = true, boundsOk = true;
  let maxStill = 0, maxNet = 0;
  const still = new Array(N).fill(0), net = new Array(N).fill(0), inGoal = new Array(N).fill(0);
  for (let i = 0; i < fr.length; i++) {
    const f = fr[i];
    if (f.b.length !== N) accountingOk = false;
    f.b.forEach((b, q) => {
      if (![0, 1, 2, 3, 4, 5].includes(b[3]) || !Number.isFinite(b[0]) || !Number.isFinite(b[1])) accountingOk = false;
      const rr = r[q % 2];
      if (b[3] === 3) {
        if (b[0] < -5 || b[0] > G.W + 5 || b[1] > G.H + 60) boundsOk = false;
        if (b[0] > G.GOAL_LINE_X + rr && b[1] > G.BAR_Y && b[1] < G.GROUND_Y) inGoal[q]++; else inGoal[q] = 0;
        if (inGoal[q] > 2) inGoalOk = false;
        if (i > 0 && fr[i - 1].b[q][3] === 3) {
          const p = fr[i - 1].b[q];
          const dtf = Math.max(1e-6, f.t - fr[i - 1].t); // frames are denser in slow motion
          const sp = Math.hypot(b[0] - p[0], b[1] - p[1]) / dtf;
          if (sp < CFG.STUCK_SPEED) still[q] += dtf; else still[q] = 0;
          maxStill = Math.max(maxStill, still[q]);
        }
      } else still[q] = 0;
      if (b[3] === 4) { net[q] += i > 0 ? f.t - fr[i - 1].t : 0; maxNet = Math.max(maxNet, net[q]); } else net[q] = 0;
    });
  }
  stuckOk = maxStill <= CFG.STUCK_TIME + 0.15;
  netOk = maxNet <= CFG.NET_TIME + 0.1;
  // no ball left in the goal at the end of the match
  if (fr[fr.length - 1].b.some((b) => b[3] === 4 || (b[3] === 3 && b[0] > G.GOAL_LINE_X && b[1] > G.BAR_Y))) inGoalOk = false;
  // goals end in the pipe: each goal event followed by a whoosh(goal) for that ball
  for (const e of m.events.filter((x) => x.type === 'goal')) {
    const w = m.events.find((x) => x.type === 'whoosh' && x.ball === e.ball && x.t >= e.t && x.why === 'goal');
    const endT = m.endT !== undefined ? m.endT : fr[fr.length - 1].t;
    if (!w && endT - e.t > CFG.NET_TIME + 0.05) netOk = false;
  }
  return { accountingOk, inGoalOk, netOk, stuckOk, boundsOk, maxStillS: +maxStill.toFixed(2), maxNetS: +maxNet.toFixed(2), stuckTeleports: m.stuckCount };
}

// ---------- 1. tournament ----------
console.log('== tournament');
const T = buildTournament();
const allInv = T.matches.map((m, i) => ({ i, stage: m.stage + ' ' + m.leg, ...matchInvariants(m) }));
check('every ball accounted for at every frame (6 balls, valid state, finite)', allInv.every((x) => x.accountingOk && x.boundsOk));
check('no ball remains in the goal (net time <= NET_TIME, then pipe; never resting inside goal)', allInv.every((x) => x.netOk && x.inGoalOk), allInv.map((x) => x.maxNetS));
check('no ball permanently stuck (max still time <= 1.3 s + tolerance)', allInv.every((x) => x.stuckOk), allInv.map((x) => x.maxStillS));
check(`anti-stuck teleports per match <= ${CFG.MAX_STUCK_PER_MATCH}`, T.matches.every((m) => m.stuckCount <= CFG.MAX_STUCK_PER_MATCH), T.matches.map((m) => m.stuckCount));
check('goals per match between 1 and 10', T.matches.every((m) => { const g = m.score[0] + m.score[1]; return g >= 1 && g <= 10; }), T.matches.map((m) => m.score.join('-')));

// ---------- P1b: added time = N shots ----------
console.log('== added-time shots');
function shotChecks(m) {
  const regEnd = 90 / CFG.GAME_MIN_PER_SEC;
  const shotEv = m.events.filter((e) => e.type === 'shot');
  const r = { n: m.addedTime, shots: m.shots.length, ok: true, why: [] };
  const bad = (w) => { r.ok = false; r.why.push(w); };
  if (m.shots.length !== m.addedTime || shotEv.length !== m.addedTime) bad('count');
  if (shotEv.some((e) => e.t < regEnd)) bad('before90');                             // none at 45' / in regular play
  if (m.goldenStart !== null && shotEv.some((e) => e.t >= m.goldenStart)) bad('golden');
  shotEv.forEach((e, i) => { if (e.k !== i + 1 || e.team !== (i % 2 === 0 ? shotEv[0].team : (shotEv[0].team === 'A' ? 'B' : 'A'))) bad('alternate'); });
  // shots one at a time: shot k+1 starts only after shot k resolved
  for (let i = 1; i < m.shots.length; i++) if (m.shots[i].t0 < m.shots[i - 1].t1) bad('overlap');
  // pitch cleared: at every shot start all other balls are in the pipe
  for (const sh of m.shots) {
    const f = m.frames.filter((x) => x.t <= sh.t0 + 1e-6).pop();
    if (f.b.some((b, q) => q !== sh.ball && ![0, 1].includes(b[3]))) bad('notCleared');
  }
  // the 90' clear: a whistle at 90' and every ball in play routed to the pipe within ~1.5 s (+ net time)
  const reg = m.events.find((e) => e.type === 'whistle' && e.kind === 'reg');
  if (!reg || Math.abs(reg.t - regEnd) > 0.01) bad('regWhistle');
  else { const f = m.frames.find((x) => x.t >= regEnd + CFG.CLEAR_TIME + 0.05); if (f && f.b.some((b) => ![0, 1].includes(b[3]))) bad('clearSlow'); }
  // each shot <= 12 s of video (slow motion included)
  const vfAt = (t) => m.frames.findIndex((x) => x.t >= t - 1e-6);
  for (const sh of m.shots) if ((vfAt(sh.t1) - vfAt(sh.t0)) / CFG.FPS > 12.05) bad('shotLong');
  // final whistle / golden ball right after the last shot (no goal after the final whistle)
  const end = m.events.find((e) => e.type === 'whistle' && e.kind === 'end');
  if (m.goldenStart === null) { if (!end || end.t < m.shots[m.shots.length - 1].t1) bad('end'); if (m.goals.some((g) => g.t > end.t)) bad('goalAfterWhistle'); }
  else if (m.goldenStart < m.shots[m.shots.length - 1].t1) bad('goldenEarly');
  return r;
}
{
  const extra = []; for (let i = 0; i < (QUICK ? 20 : 60); i++) { const r = eng.simulateMatch(820000 + i, { kind: i % 3 === 0 ? 'leg1' : 'final' }); if (!r.failed) extra.push(r); }
  const all = T.matches.concat(extra);
  const res = all.map(shotChecks);
  check(`added time: number of shots == N in every match (${all.length} matches), none at 45', none in golden ball, alternating, one at a time, each <= 12 s video`, res.every((x) => x.ok), res.filter((x) => !x.ok).slice(0, 3));
  check('added time: pitch cleared at 90\' (whistle, balls routed to the pipe within 1.5 s) before the shots', res.every((x) => !x.why.includes('notCleared') && !x.why.includes('clearSlow') && !x.why.includes('regWhistle')));
  const inv = extra.map((m) => matchInvariants(m));
  check('added time: every ball accounted for, no ball left in the goal (random matches incl. shots)', inv.every((x) => x.accountingOk && x.inGoalOk && x.netOk));
  // cinematic only on good hits in the shots; never in the first half, regular play, misses or golden ball
  let cineOk = true; const cInfo = { goodHits: 0, misses: 0, cineFrames: 0 };
  for (const m of all) {
    const regEnd = 90 / CFG.GAME_MIN_PER_SEC;
    const shotOf = (t) => m.shots.find((s) => t >= s.t0 - 1e-6 && t <= s.t1 + 3);
    // P5: a good hit = the trajectory after a windmill contact reaches the goal mouth (sim/good_hit.js; exact confusion test in tests/p5_tests.js)
    for (const sh of m.shots) { if (sh.cine) cInfo.goodHits++; else cInfo.misses++; if (sh.cine !== m.cines.some((x) => x.k === sh.k)) cineOk = false; }
    for (const f of m.frames) {
      const fx = (f.ts !== undefined && f.ts < 1) || !!f.cam;
      if (!fx) continue;
      cInfo.cineFrames++;
      if (f.t < regEnd) cineOk = false;                                         // first half / regular play
      if (m.goldenStart !== null && f.t >= m.goldenStart) cineOk = false;       // golden ball
      const sh = shotOf(f.t);
      if (!sh || !m.cines.some((c) => c.k === f.cine)) cineOk = false;          // only during a good-hit shot
      if (f.cam && (f.cam[0] > CFG.ZOOM_MAX + 1e-9 || f.cam[0] < 1)) cineOk = false;
      if (f.ts !== undefined && f.ts < CFG.SLOWMO - 1e-6) cineOk = false;
    }
    // misses: no effect frames inside a shot without a good hit
    for (const sh of m.shots) if (!m.cines.some((c) => c.k === sh.k)) { if (m.frames.some((f) => f.t >= sh.t0 && f.t <= sh.t1 && (f.cam || f.ts !== undefined))) cineOk = false; }
    // smooth: time scale changes by small steps
    for (let i = 1; i < m.frames.length; i++) { const a = m.frames[i - 1].ts === undefined ? 1 : m.frames[i - 1].ts, b = m.frames[i].ts === undefined ? 1 : m.frames[i].ts; if (Math.abs(a - b) > 0.12) cineOk = false; }
  }
  check(`cinematic (slow motion + zoom) only on good hits (P5: ball really reaches the goal mouth) in added-time shots; never on misses, regular play, first half or golden ball; zoom <= ${CFG.ZOOM_MAX}, smooth`, cineOk && cInfo.goodHits > 0 && cInfo.misses > 0, cInfo);
  // scenario: aggregate 2-3 -> goal in an added-time shot -> 3-3 -> golden ball. The simulation before the
  // decision does not depend on the first-leg score, so a seed is found first and the first-leg score chosen to fit.
  let scen = null;
  for (let i = 0; i < 400 && !scen; i++) {
    const r0 = eng.simulateMatch(830000 + i, { kind: 'leg2', prevA: 50, prevB: 0 }); // prev 50-0: never level -> no golden
    if (r0.failed) continue;
    const sg = r0.goals.filter((g) => g.shot); if (!sg.length) continue;
    const last = sg[sg.length - 1];
    const before = r0.goals.filter((g) => g.t < last.t);
    const sA = before.filter((g) => g.team === 'A').length, sB = before.filter((g) => g.team === 'B').length;
    const afterAll = r0.goals.filter((g) => g.t > last.t && g.t <= r0.endReg).length; if (afterAll) continue;
    const prev = last.team === 'A' ? [2 - sA, 3 - sB] : [3 - sA, 2 - sB];
    if (prev[0] < 0 || prev[1] < 0) continue;
    const r = eng.simulateMatch(830000 + i, { kind: 'leg2', prevA: prev[0], prevB: prev[1] });
    const aggBefore = [prev[0] + sA, prev[1] + sB];
    const aggAfter = [prev[0] + r.score.A - (r.goldenWinner === 'A' ? 1 : 0), prev[1] + r.score.B - (r.goldenWinner === 'B' ? 1 : 0)];
    scen = { seed: 830000 + i, prev, aggBefore, shotGoalAt: CLOCK.minuteLabel(r, last.t, CFG.GAME_MIN_PER_SEC), aggAfterShots: aggAfter, golden: r.goldenStart !== null, goldenWinner: r.goldenWinner, hashSamePrefix: r.frames.length > 0 };
  }
  check('scenario: aggregate 2-3, goal in an added-time shot -> 3-3 -> GOLDEN BALL starts after the last shot', !!scen && scen.golden && scen.aggAfterShots[0] === 3 && scen.aggAfterShots[1] === 3 && ((scen.aggBefore[0] === 2 && scen.aggBefore[1] === 3) || (scen.aggBefore[0] === 3 && scen.aggBefore[1] === 2)), scen);
  // added-time goals count for scorers / MOTM / replay
  const addG = T.matches.flatMap((m, mi) => m.goals.filter((g) => g.shot).map((g) => ({ mi, g })));
  const counted = addG.every(({ mi, g }) => T.matches[mi].score[g.team === 'A' ? 0 : 1] >= 1);
  check('added-time goals change the score and count for scorers (demo has at least one)', addG.length > 0 && counted, { addedTimeGoals: addG.length, cinematics: T.matches.map((m) => m.cines.length) });
}
check('half-time whistle at 45\'', T.matches.every((m) => m.events.some((e) => e.type === 'whistle' && e.kind === 'half' && Math.abs(e.t - 22.5) < 0.01)));

// golden ball correctness: golden starts iff the deciding result is level at end of added time
function scoreAt(m, t) { let a = 0, b = 0; for (const e of m.events) { if (e.t > t + 1e-9) break; if (e.type === 'goal') { if (e.team === 'A') a++; else b++; } } return [a, b]; }
let goldenLogicOk = true; const goldenInfo = [];
T.matches.forEach((m) => {
  const s = scoreAt(m, m.endReg);
  const tot = m.kind === 'leg2' ? [s[0] + m.prev[0], s[1] + m.prev[1]] : s;
  const shouldGolden = m.kind !== 'leg1' && tot[0] === tot[1];
  if (shouldGolden !== (m.goldenStart !== null)) goldenLogicOk = false;
  if (m.goldenStart !== null) {
    const g = m.goals[m.goals.length - 1];
    if (!g.golden || m.goldenWinner !== g.team) goldenLogicOk = false;
    goldenInfo.push({ stage: m.stage + ' ' + m.leg, resolveS: +m.goldenResolve.toFixed(2) });
  }
});
check('golden ball triggered exactly when the deciding result is level; first goal decides', goldenLogicOk, goldenInfo);
check(`golden ball resolves within cap (${CFG.GOLDEN_CAP} s)`, T.matches.every((m) => m.goldenStart === null || m.goldenResolve <= CFG.GOLDEN_CAP), goldenInfo);

// aggregate + advancement (independent recomputation)
let bracketOk = true;
T.sf.forEach((s, si) => {
  const l1 = T.matches[si * 2], l2 = T.matches[si * 2 + 1];
  const agg = [l1.score[0] + l2.score[0], l1.score[1] + l2.score[1]];
  if (agg[0] !== s.agg[0] || agg[1] !== s.agg[1]) bracketOk = false;
  const regAgg = (() => { const r = scoreAt(l2, l2.endReg); return [l1.score[0] + r[0], l1.score[1] + r[1]]; })();
  const exp = regAgg[0] !== regAgg[1] ? (regAgg[0] > regAgg[1] ? s.ta : s.tb) : (l2.goldenWinner === 'A' ? s.ta : s.tb);
  if (exp !== s.winner) bracketOk = false;
});
if (T.final.ta !== T.sf[0].winner || T.final.tb !== T.sf[1].winner) bracketOk = false;
{ const f = T.matches[4]; const s = scoreAt(f, f.endReg); const exp = s[0] !== s[1] ? (s[0] > s[1] ? T.final.ta : T.final.tb) : (f.goldenWinner === 'A' ? T.final.ta : T.final.tb); if (exp !== T.champion) bracketOk = false; }
check('aggregate computed correctly and correct team advances (incl. golden ball)', bracketOk, T.sf.map((s) => ({ agg: s.agg, golden: s.golden, winner: T.teams[s.winner].name })).concat([{ final: T.final.score, champion: T.teams[T.champion].name }]));

// synthetic bracket cases (pure logic, incl. golden ball in leg 2 and final)
function decideTie(l1, l2reg, golden) { const a = [l1[0] + l2reg[0], l1[1] + l2reg[1]]; if (a[0] !== a[1]) return a[0] > a[1] ? 'A' : 'B'; return golden; }
check('tie logic: synthetic cases', decideTie([2, 1], [0, 1], 'B') === 'B' && decideTie([2, 1], [1, 1], 'B') === 'A' && decideTie([0, 3], [3, 0], 'A') === 'A' && decideTie([1, 1], [2, 2], 'B') === 'B');

// release order alternates A,B,A,B (FIFO)
let alt = 0, tot = 0;
// P2: with equal strength the order alternates; the favourite's invisible edge lets it take the underdog's turn sometimes
{ const eq = []; for (let i = 0; i < (QUICK ? 6 : 12); i++) eq.push(eng.simulateMatch(830000 + i, { kind: 'final' }));
  eq.forEach((m) => { const pops = m.events.filter((e) => e.type === 'pop' && !m.events.some((x) => x.type === 'shot' && x.t === e.t)); for (let i = 1; i < pops.length; i++) { tot++; if (pops[i].team !== pops[i - 1].team) alt++; } }); }
let altF = 0, totF = 0;
T.matches.forEach((m) => { const pops = m.events.filter((e) => e.type === 'pop'); for (let i = 1; i < pops.length; i++) { totF++; if (pops[i].team !== pops[i - 1].team) altF++; } });
check('outlet order alternates A,B,A,B (>= 95% with equal strength; >= 80% when the favourite edge is on)', alt / tot >= 0.95 && altF / totF >= 0.8, { equalPct: +(100 * alt / tot).toFixed(1), withEdgePct: +(100 * altF / totF).toFixed(1) });
// release interval
let intOk = true; T.matches.forEach((m) => { const pops = m.events.filter((e) => e.type === 'pop'); for (let i = 1; i < pops.length; i++) { const d = pops[i].t - pops[i - 1].t; if (d < CFG.RELEASE_INTERVAL[0] - 0.35 - 0.01) intOk = false; } });
check('release interval ~1.6-2.4 s (min gap respected)', intOk);

// keeper cycle
let keeperOk = true; const kInfo = [];
T.matches.forEach((m) => {
  let air = 0, crouch = 0, jumps = 0, maxSame = 0, same = 0;
  for (let i = 0; i < m.frames.length; i++) {
    const k = m.frames[i].k;
    if (k[3]) air++; if (!k[3] && k[1] > 0.8 && k[2] < 0.1) crouch++;
    if (i && k[3] && !m.frames[i - 1].k[3]) jumps++;
    if (i && JSON.stringify(k) === JSON.stringify(m.frames[i - 1].k)) { same++; maxSame = Math.max(maxSame, same); } else same = 0;
  }
  const fa = air / m.frames.length;
  kInfo.push({ jumps, airPct: +(100 * fa).toFixed(0), crouchFrames: crouch, maxIdenticalFrames: maxSame });
  if (jumps < 20 || fa < 0.2 || fa > 0.8 || crouch < 50 || maxSame > 2) keeperOk = false;
});
check('keeper: crouch/jump cycle present, never stands still', keeperOk, kInfo[0]);

check('CARDS and POWERS are off', CFG.CARDS === false && CFG.POWERS === false);

// ---------- 2. determinism ----------
console.log('== determinism');
{
  const a = eng.simulateMatch(424242, { kind: 'final' }), b = eng.simulateMatch(424242, { kind: 'final' });
  check('determinism: same seed -> identical timeline hash (same process)', a.hash === b.hash, a.hash.slice(0, 16));
  const m0 = T.matches[0];
  const out = execFileSync(process.execPath, ['-e', `const e=require(${JSON.stringify(path.join(__dirname, '..', 'sim', 'engine.js'))});const r=e.simulateMatch(${m0.seed},${JSON.stringify({ kind: m0.kind, rA: m0.rA, rB: m0.rB, prevA: m0.prev[0], prevB: m0.prev[1], fav: m0.strength.fav || undefined, edge: m0.strength.edge })},${JSON.stringify(L.rulesToCfg(L.loadCompetition().rules))});process.stdout.write(r.hash)`]).toString();
  check('determinism: identical hash in a fresh process', out === m0.hash, out.slice(0, 16));
}

// ---------- 3. windmill toss test ----------
console.log('== windmill');
const toss = eng.tossTest(QUICK ? 300 : 1000, 99);
const tossPct = (k) => +(100 * toss[k] / toss.n).toFixed(1);
check('windmill: good share of tosses reach right platform or goal (>= 40%)', toss.reachPct >= 40, { reachPct: +toss.reachPct.toFixed(1), goalPct: tossPct('goal'), rightPlatformPct: tossPct('right'), voidPct: tossPct('void'), returnedLeftPct: tossPct('left'), overPct: tossPct('over'), hitByWindmillPct: tossPct('hit') });
check('windmill: not everything returned or dropped into the void', toss.void + toss.left < 0.6 * toss.n);

// ---------- 4. crossbar / posts (v2: swept one-way top surface, collider == drawing) ----------
console.log('== crossbar');
const XB = require('./crossbar_test');
function oneBall(x, y, vx, vy, steps) {
  const W = eng.buildWorld(CFG);
  const ball = Matter.Bodies.circle(x, y, G.BALL_R, { restitution: CFG.BALL_RESTITUTION, friction: 0, frictionStatic: 0, frictionAir: 0, collisionFilter: { category: eng.CAT.BALL, mask: eng.CAT.STATIC } });
  ball.deltaTime = 1000 / CFG.HZ; Matter.Body.setVelocity(ball, { x: vx / 60, y: vy / 60 });
  Matter.Composite.add(W.engine.world, ball);
  const st = { barGhost: false };
  let barHits = 0; const pth = [];
  for (let s = 0; s < steps; s++) {
    eng.driveKinematic(W.mill, -2000, -2000, 0, -2000, -2000, 0);
    for (const k of Object.values(W.keeper)) eng.driveKinematic(k, -3000, -3000, 0, -3000, -3000, 0);
    ball.force.y += ball.mass * CFG.GRAVITY / 1e6;
    const px = ball.position.x, py = ball.position.y;
    Matter.Engine.update(W.engine, 1000 / CFG.HZ);
    if (eng.sweptBar(st, ball, G.BALL_R, px, py, CFG.BALL_RESTITUTION)) barHits++;
    pth.push([ball.position.x, ball.position.y, ball.velocity.x * 60, ball.velocity.y * 60]);
  }
  return { barHits, path: pth };
}
{
  const xb = XB.run('swept', XB.throwSet(QUICK ? 1500 : 5000, 2024));
  check(`crossbar: ${xb.n} throws from many angles/speeds, max visible overlap into the drawn bar <= 1 design px`, xb.maxOverlapPx <= 1 && xb.tunnelledThrough === 0,
    { maxOverlapPx: xb.maxOverlapPx, tunnelled: xb.tunnelledThrough, throwsWithContact: xb.throwsWithContact });
  check('crossbar: collider rectangle == drawn rectangle (same x0/x1/top/bottom constants)', G.BAR_X0 === G.GOAL_LINE_X - G.POST_W / 2 && G.BAR_X1 === G.W && G.BAR_TOP === G.BAR_Y - G.BAR_THICK / 2 && G.BAR_BOTTOM - G.BAR_TOP === G.BAR_THICK);
  const drop = oneBall(G.GOAL_LINE_X + 60, G.BAR_TOP - 120, 0, 0, 90);
  const maxY = Math.max(...drop.path.map((p) => p[1]));
  const bounced = drop.path.some((p, i) => i > 5 && p[3] < -50);
  check('crossbar: ball falling from above bounces off its top', drop.barHits >= 1 && bounced && maxY <= G.BAR_TOP - G.BALL_R + 1e-6, { barHits: drop.barHits, lowestCentreY: +maxY.toFixed(2) });
  const up = oneBall(G.GOAL_LINE_X + 60, G.BAR_Y + 60, 0, -520, 50);
  const passed = up.path.some((p) => p[1] < G.BAR_TOP - G.BALL_R - 5);
  check('crossbar (P5): ball rising from below bounces off the underside (solid on every face)', up.barHits >= 1 && !passed && Math.min(...up.path.map((p) => p[1])) >= G.BAR_BOTTOM + G.BALL_R - 1e-6, { barHits: up.barHits });
  const front = oneBall(G.BAR_X0 - 80, G.BAR_Y, 1400, 0, 40);
  check('crossbar (P5): bomb shot at bar height from the front bounces back off the bar end (no pass-through)', front.barHits >= 1 && front.path.every((p) => p[0] <= G.BAR_X0 - G.BALL_R + 1e-6 || Math.abs(p[1] - G.BAR_Y) > G.BALL_R + G.BAR_THICK / 2), { barHits: front.barHits });
  const post = oneBall(G.GOAL_LINE_X - 60, G.BAR_Y + 40, 700, 0, 40);
  const crossed = post.path.some((p) => p[0] > G.GOAL_LINE_X + 30);
  check('posts: no collision with the front post (ball at post height crosses the goal line)', crossed && post.barHits === 0);
  const pen = require('../sim/good_hit').penetrationScan(T.matches);
  check('crossbar (P5): no frame of the tournament has a ball inside the bar or a platform (rect + radius - 0.5 px)', pen.bar.summary.failFrames === 0 && pen.plat.summary.failFrames === 0, { bar: pen.bar.summary, plat: pen.plat.summary });
}

// ---------- 5. strength / win rate (P2: equal balls, invisible release-turn edge) ----------
console.log('== strength');
{
  // every seed is played twice (favourite as team A, then as team B); 1200 matches in 4 parallel processes
  const edge = L.rulesToCfg(require('../config/rules/base.json')).STRENGTH_EDGE;
  const n = QUICK ? 400 : 1200, parts = 4;
  const script = `const { spawn } = require('child_process');
    Promise.all(Array.from({ length: ${parts} }, (_, k) => new Promise((res) => { let o = ''; const c = spawn(process.execPath, [${JSON.stringify(path.join(__dirname, 'calibrate_strength.js'))}, '${edge}', '${n / parts}', String(500000 + k * 10000)]);
      c.stdout.on('data', (d) => (o += d)); c.on('close', () => res(JSON.parse(o))); }))).then((r) => console.log(JSON.stringify(r)));`;
  const res = execFileSync(process.execPath, ['-e', script]).toString();
  const parts_ = JSON.parse(res);
  const dec = parts_.reduce((a, x) => a + x.decided, 0), favW = parts_.reduce((a, x) => a + Math.round(x.favouriteWinPct * x.decided / 100), 0);
  const pct = 100 * favW / dec;
  check('strength: favourite win rate in 53-62% with identical ball size (release-turn edge, golden ball decides)', pct >= 53 && pct <= 62, { favouriteWinPct: +pct.toFixed(1), matches: dec, edge });
  const r1 = eng.simulateMatch(4242, { kind: 'final', fav: 'A', edge }), r0 = eng.simulateMatch(4242, { kind: 'final' });
  check('strength: never visible - every ball has the same radius in every match (with and without favourite)', r1.rA === r1.rB && r1.rA === G.BALL_R && r0.rA === r0.rB && T.matches.every((m) => m.rA === m.rB && m.rA === G.BALL_R));
}


// ---------- 6. golden ball resolution statistics ----------
{
  let g = 0, ok = 0, maxR = 0;
  for (let i = 0; i < (QUICK ? 100 : 300); i++) { const r = eng.simulateMatch(700000 + i, { kind: 'final' }); if (r.goldenStart !== null) { g++; if (!r.failed) { ok++; maxR = Math.max(maxR, r.goldenResolve); } } }
  check('golden ball statistics (random finals): all resolve within cap', ok === g, { goldenMatches: g, resolved: ok, maxResolveS: +maxR.toFixed(1) });
}

// ---------- 7. clock: never beyond 90+added, never backwards, frozen during golden ball ----------
console.log('== clock');
{
  const gmps = CFG.GAME_MIN_PER_SEC;
  let ok = true; const info = [];
  const extra = []; // plus random single matches incl. golden balls
  for (let i = 0; i < (QUICK ? 30 : 120); i++) extra.push(eng.simulateMatch(810000 + i, { kind: 'final' }));
  const all = T.matches.map((m) => ({ m, label: m.stage + ' ' + m.leg })).concat(extra.filter((r) => !r.failed).map((r) => ({ m: r, label: 'rnd' + r.seed })));
  for (const { m, label } of all) {
    let prev = -1, max = -1;
    for (const f of m.frames) {
      const c = CLOCK.clockAt(m, f.t, gmps);
      if (c.value < prev || c.value > 90 + m.addedTime) ok = false;
      if (c.phase === 'shots' && c.value !== 90 + CLOCK.shotsStarted(m, f.t)) ok = false;
      if (m.goldenStart !== null && f.t >= m.goldenStart && c.main !== `90+${m.addedTime}'`) ok = false;
      prev = c.value; max = Math.max(max, c.value);
    }
    for (const g of m.goals) { const lab = CLOCK.minuteLabel(m, g.t, gmps); const v = lab.includes('+') ? 90 + +lab.slice(3, -1) : +lab.slice(0, -1); if (v > 90 + m.addedTime) ok = false; }
    if (m.goldenStart !== null) info.push({ label, added: m.addedTime, shownMax: `90+${max - 90}'` });
  }
  check(`clock: for ${all.length} matches the displayed clock never exceeds 90+N, never goes backwards, reads 90+k as shot k starts (golden ball frozen)`, ok, info.slice(0, 4));
  check('rules: added time within config range [1,3]', all.every(({ m }) => m.addedTime >= CFG.ADDED_MIN[0] && m.addedTime <= Math.min(3, CFG.ADDED_MIN[1])));
}

// ---------- 8. bracket layout: symmetric, final in the centre, generic up to 16 ----------
console.log('== bracket');
{
  let ok = true; const info = {};
  for (const n of [4, 8, 16]) {
    const Lb = BRACKET.bracketLayout(n);
    const F = Lb.final;
    if (Math.abs(F.x + F.w / 2 - Lb.W / 2) > 1e-6) ok = false;
    const left = Lb.boxes.filter((b) => b.side === 'L'), right = Lb.boxes.filter((b) => b.side === 'R');
    if (left.length !== right.length || left.length !== n / 2 - 1) ok = false;
    for (const b of left) {
      const m = Lb.byKey[b.id.replace('L', 'R')];
      if (!m || Math.abs((b.x + b.w / 2) - (Lb.W - (m.x + m.w / 2))) > 1e-6 || Math.abs(b.y - m.y) > 1e-6) ok = false;
      if (b.x + b.w > F.x) ok = false; // left half stays left of the final
    }
    for (const b of Lb.boxes) if (b.x < 0 || b.x + b.w > Lb.W || b.y < 100 || b.y + b.h > 720) ok = false;
    const firstRound = left.filter((b) => b.round === 0).length + right.filter((b) => b.round === 0).length;
    if (firstRound * 2 !== n) ok = false;
    info[n] = { boxes: Lb.boxes.length, boxW: +Lb.boxW.toFixed(0), rowH: Lb.rowH };
  }
  check('bracket: symmetric layout, final centred, left/right halves mirrored (4, 8, 16 teams)', ok, info);
  const L4 = BRACKET.bracketLayout(4);
  check('bracket symmetric option (demo): semifinal 1 on the left, semifinal 2 on the right, final in the middle', L4.byKey['0L0'].x < L4.final.x && L4.byKey['0R0'].x > L4.final.x);
  let ltrOk = true; const ltrInfo = {};
  for (const n of [4, 8, 16]) {
    const Lb = BRACKET.bracketLayoutLTR(n, n > 4 ? { top: 160, bottom: 700 } : undefined);
    for (const b of Lb.boxes) {
      if (b.x < 0 || b.x + b.w > Lb.W + 1e-6 || b.y < 100 || b.y + b.h > 720) ltrOk = false;
      if (b.next) { const t = Lb.byKey[b.next]; if (!(t.x > b.x + b.w - 1e-6)) ltrOk = false; }      // rounds go left -> right
    }
    if (!(Lb.champion.x > Lb.final.x + Lb.final.w)) ltrOk = false;                                   // champion right of the final
    if (Lb.boxes.filter((b) => b.round === 0).length !== n / 2) ltrOk = false;
    if (Lb.rowH < 26) ltrOk = false;                                                                  // readable on a phone (>= 39 px rows at 1080p)
    ltrInfo[n] = { columns: Lb.cols, boxW: Math.round(Lb.boxW), rowH: Lb.rowH };
  }
  check('bracket left_to_right (default): rounds in columns left -> right, final then CHAMPION on the right; 4, 8, 16 teams; rows >= 26 design px', ltrOk, ltrInfo);
  const comp = L.loadCompetition();
  check('bracket style: competition default is left_to_right, symmetric still available', (comp.competition.bracket_style || 'left_to_right') === 'left_to_right' && typeof BRACKET.bracketLayout === 'function');
}

// ---------- 9. kit colours + contrast swap (CIE76 dE < 30 -> swap) ----------
console.log('== colours');
{
  const conf = L.loadCompetition();
  const byId = Object.fromEntries(conf.teams.map((t) => [t.id, t]));
  const k1 = L.matchKits(byId.bayern, byId.arsenal);
  const k2 = L.matchKits(byId.man_city, byId.real_madrid);
  const k3 = L.matchKits({ name: 'X', primary: '#FFFFFF', secondary: '#111111' }, { name: 'Y', primary: '#FAFAFA', secondary: '#FFFFFF' });
  const dE = (a, b) => L.deltaE76(a.primary, b.primary);
  check('colours: Bayern vs Arsenal (dE 21) -> one team swapped to secondary, new dE >= 30, recorded', (k1.A.swapped || k1.B.swapped) && dE(k1.A, k1.B) >= 30 && !!k1.note, { note: k1.note });
  check('colours: Man City vs Real Madrid (dE >= 30) -> no swap', !k2.A.swapped && !k2.B.swapped && k2.dE >= 30, { dE: k2.dE });
  check('colours: both-white case -> resolved with a swap', (k3.A.swapped || k3.B.swapped) && dE(k3.A, k3.B) >= 30, { note: k3.note });
  // P2: the identifying ball colour is kit.ring (crest balls: ring colour; colour balls: ring == primary)
  check('colours: every tournament match has contrasting ball colours (dE >= 30, ring colour)', T.matches.every((m) => L.deltaE76(m.kits.A.ring, m.kits.B.ring) >= 30), T.matches.map((m) => +L.deltaE76(m.kits.A.ring, m.kits.B.ring).toFixed(0)));
  // schema: clear error messages
  const errs = []; L.validate({ id: 'x', name: 'X', primary: 'red', secondary: '#FFFFFF', strength: 50, players: [] }, L.SCHEMAS.team, 'teams/x.json', errs);
  check('config schema: invalid team file gives clear messages', errs.some((e) => e.includes('primary') && e.includes('#1A2B3C')) && errs.some((e) => e.includes('players') && e.includes('at least 3')), errs);
}

// ---------- 10. players, Man of the Match, top scorers ----------
console.log('== awards');
{
  const g = (team, player, t) => ({ team, player, t });
  const a = TOUR.manOfTheMatch([g('A', 0, 1), g('B', 1, 2), g('A', 0, 3)], [2, 1], null);
  const b = TOUR.manOfTheMatch([g('A', 0, 1), g('B', 1, 2), g('A', 2, 3)], [2, 1], null); // tie 1-1-1: decisive = A's 2nd goal (player 2)
  const c = TOUR.manOfTheMatch([g('A', 1, 1), g('B', 0, 2)], [1, 1], null);              // draw: last goal
  const d = TOUR.manOfTheMatch([g('A', 1, 1), g('A', 2, 2), g('B', 0, 3), g('B', 0, 4), g('A', 1, 5), g('A', 2, 6)], [4, 2], null); // A1 & A2 & B0 tie on 2 -> decisive (A's 3rd goal) = A1
  check('MOTM rule: most goals; tiebreak decisive goal, else last goal', a.player === 0 && a.goals === 2 && b.team === 'A' && b.player === 2 && c.team === 'B' && d.team === 'A' && d.player === 1, [a, b, c, d].map((x) => `${x.team}${x.player}/${x.goals}/${x.tiebreak}`));
  check('MOTM stored in every match record', T.matches.every((m) => m.motm && m.goals.some((x) => x.team === m.motm.team && x.player === m.motm.player)));
  const fake = { matches: [
    { ta: 0, tb: 1, goals: [g('A', 0, 5), g('B', 0, 6)] },
    { ta: 2, tb: 3, goals: [g('A', 0, 1)] },
    { ta: 0, tb: 2, goals: [g('B', 0, 2), g('A', 1, 9)] },
  ] };
  const ts = TOUR.topScorers(fake, 3); // team2 p0: 2 goals in 2 matches; team0 p0 1 (2 matches, reached m0 t5), team1 p0 1 (1 match) ...
  check('top scorers: goals, then fewer matches, then who reached it first', ts[0].team === 2 && ts[0].goals === 2 && ts[1].team === 1 && ts[2].team === 0 && ts[2].player === 0, ts.map((e) => `${e.team}:${e.player} ${e.goals}g/${e.matches}m`));
  check('players: 3 named players per team, each ball = one player (goal records carry the player)', T.teams.every((t) => t.players.length === 3) && T.matches.every((m) => m.goals.every((x) => x.player === (x.ball >> 1))));
}

// ---------- P1b: real players file ----------
{
  const comp = L.loadCompetition();
  const md = path.join(ROOT, 'config', 'players_review.md');
  const okFile = fs.existsSync(md) && comp.teams.every((t) => t.players.every((p) => fs.readFileSync(md, 'utf8').includes(p.name)));
  const okSrc = comp.teams.every((t) => t.players.length === 3 && t.players.every((p) => /^https?:\/\//.test(p.source_url || '') && /^\d{4}-\d{2}-\d{2}$/.test(p.retrieved || '') && typeof p.verified === 'boolean'));
  const fmt = comp.teams.every((t) => t.players.every((p) => /^([A-Z]\. \S.*|[A-Z][a-zà-ÿ]+)$/u.test(p.name)));
  check('players: real_names on, 3 players per team with source_url / retrieved / verified, listed in config/players_review.md, format "I. Surname"', comp.competition.real_names === true && okFile && okSrc && fmt, comp.teams.map((t) => t.players.map((p) => p.name).join(', ')));
  const conf2 = L.loadCompetition(undefined, {});
  check('players: fictional_players kept for real_names=false', conf2.teams.every((t) => Array.isArray(t.fictional_players) && t.fictional_players.length === 3));
}

// ---------- 11. windmill boost (P5: from minute 60, ramp 58-62) ----------
console.log('== windmill boost');
{
  const WB = require('./windmill_boost');
  const rc = L.rulesToCfg(L.loadCompetition().rules);
  const n = QUICK ? 60 : 300;
  const r = WB.measure(n, rc, 900000);
  const ma = eng.makeMillAngle(Object.assign({}, CFG, rc), 0);
  const w0 = ma.omega(0), w1 = ma.omega(80 / rc.GAME_MIN_PER_SEC), wMid = ma.omega(60 / rc.GAME_MIN_PER_SEC), w57 = ma.omega(57.9 / rc.GAME_MIN_PER_SEC), w63 = ma.omega(62.1 / rc.GAME_MIN_PER_SEC);
  const gain = 100 * (w1 / w0 - 1);
  check('windmill boost: +25..35% angular speed after minute 62, smooth ramp 58-62 (windmill_fast_from_min = 60)', rc.BOOST_FROM === 60 && gain >= 25 && gain <= 35 && wMid > w0 && wMid < w1 && w57 === w0 && Math.abs(w63 - w1) < 1e-9, { angularGainPct: +gain.toFixed(1), at60: +(wMid / w0).toFixed(3) });
  check(`windmill boost measured on ${n} matches: faster launches after 60', goal rate not lower, goals>10 rare in raw ungated matches (<= 3%; the seed gate rejects them)`,
    r.meanLaunchSpeedFrom70 > r.meanLaunchSpeedBefore70 * 1.15 && r.goalsPer10minFrom70 >= r.goalsPer10minBefore70 * 0.95 && r.pctOver10 <= 3,
    { launchBefore: r.meanLaunchSpeedBefore70, launchFrom70: r.meanLaunchSpeedFrom70, goalsPer10Before: r.goalsPer10minBefore70, goalsPer10From70: r.goalsPer10minFrom70, pctOver10: r.pctOver10 });
}

// ---------- 12. config change -> next render changes (no code edit) ----------
if (!QUICK) {
  console.log('== config change');
  const tmp = path.join(ROOT, 'build', 'tmp_config');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, 'config'), tmp, { recursive: true });
  // P2: this test is about kit colours -> colour-only balls (logos_on_balls false) in both configs
  const tmpB = path.join(ROOT, 'build', 'tmp_config_base');
  fs.rmSync(tmpB, { recursive: true, force: true });
  for (const d of [tmp]) { const rf = path.join(d, 'rules', 'base.json'); const ru = JSON.parse(fs.readFileSync(rf, 'utf8')); ru.logos_on_balls = false; fs.writeFileSync(rf, JSON.stringify(ru)); }
  fs.cpSync(tmp, tmpB, { recursive: true });
  const tf = path.join(tmp, 'teams', 'man_city.json');
  const team = JSON.parse(fs.readFileSync(tf, 'utf8')); team.primary = '#00C853'; fs.writeFileSync(tf, JSON.stringify(team));
  const mf = path.join(tmp, 'maps', 'default.json');
  const map = JSON.parse(fs.readFileSync(mf, 'utf8')); map.sky = ['#ff7a00', '#ffa64d', '#ffd9b3']; fs.writeFileSync(mf, JSON.stringify(map));
  const base = TOUR.buildAll(path.join(tmpB, 'competitions', 'demo_4teams.json'), path.join(ROOT, 'build', 'test_show_base.json'), { configDir: tmpB });
  const chg = TOUR.buildAll(path.join(tmp, 'competitions', 'demo_4teams.json'), path.join(ROOT, 'build', 'test_show_changed.json'), { configDir: tmp });
  execFileSync(process.execPath, [path.join(ROOT, 'render', 'render.js'), 'brackets', 'build/test_brackets', '--show', 'build/test_show_base.json'], { cwd: ROOT, stdio: 'ignore', timeout: 180000 });
  const bfiles = ['bracket4_left_to_right.png', 'bracket4_symmetric.png', 'bracket16_left_to_right.png', 'bracket16_symmetric.png'];
  check('bracket styles render: 4 and 16 teams, left_to_right and symmetric (PNG files written)', bfiles.every((f) => fs.existsSync(path.join(ROOT, 'build', 'test_brackets', f)) && fs.statSync(path.join(ROOT, 'build', 'test_brackets', f)).size > 20000));
  const py = process.platform === 'win32' ? 'python' : 'python3';
  execFileSync(py, [path.join(ROOT, 'audio', 'make_audio.py'), path.join(ROOT, 'build', 'test_show_base.json'), path.join(ROOT, 'build', 'test_audio.wav')], { cwd: ROOT, stdio: 'ignore', timeout: 400000 });
  const ar = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'audio_goal_report.json'), 'utf8'));
  check('goal sounds: crowd A/B/C <= 2.5 s, selected sound not louder (peak and 400 ms RMS) than the loudest existing effect', ar.criteria.goal_peak_not_above_loudest_effect_peak && ar.criteria.goal_shortterm_not_above_loudest_effect_shortterm && ar.criteria.crowd_samples_le_2_5s
    && ['crowd_A.wav', 'crowd_B.wav', 'crowd_C.wav'].every((f) => fs.existsSync(path.join(ROOT, 'output', 'goal_sfx_samples', f))), { samples: ar.samples, criteria: ar.criteria });
  // a frame of match 0 with City's ball 0 in play, no goal camera move in the last 2 s
  const m0 = base.show.matches[0], seg = base.show.segments.find((x) => x.type === 'match' && x.match === 0);
  let fi = -1;
  for (let i = 60; i < m0.frames.length; i++) {
    const b = m0.frames[i].b[0]; if (b[3] !== 3 || b[1] > 520 || b[1] < 120) continue;
    const t = m0.frames[i].t; if (m0.goals.some((x) => x.t <= t && t - x.t < 2)) continue;
    if (m0.frames[i].b.some((o, q) => q && o[3] >= 2 && Math.hypot(o[0] - b[0], o[1] - b[1]) < 45)) continue;
    fi = i; break;
  }
  const res = execFileSync(process.execPath, [path.join(__dirname, 'pixel_probe.js'), String(seg.start + fi), String(fi)], { cwd: ROOT, timeout: 180000 }).toString();
  const px = JSON.parse(res.slice(res.indexOf('{')));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const green = [0, 200, 83];
  check('config change: team primary colour edited in a temp config -> ball pixels change, closer to the new colour', dist(px.base.ball, px.changed.ball) > 40 && dist(px.changed.ball, green) < dist(px.base.ball, green), px);
  check('config change: map sky colour edited -> sky pixels change', dist(px.base.sky, px.changed.sky) > 60, { base: px.base.sky, changed: px.changed.sky });
  check('config change: simulation unchanged by a colour edit (same seeds -> same hashes)', base.show.matches.every((m, i) => m.hash === chg.show.matches[i].hash));
  fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(tmpB, { recursive: true, force: true });
}

// ---------- screenshots present (only when they exist) ----------
const shots = path.join(__dirname, '..', L.loadCompetition().competition.screenshots || 'output/screenshots_v2b');
if (fs.existsSync(path.join(shots, '01_intro.png'))) {
  const need = ['07_keeper_crouched.png', '08_keeper_jumping.png', 'bracket16_left_to_right.png', 'bracket16_symmetric.png'];
  check('screenshots: keeper poses + 16-team empty bracket present', need.every((f) => fs.existsSync(path.join(shots, f))), need.filter((f) => !fs.existsSync(path.join(shots, f))));
}

fs.mkdirSync(path.join(__dirname, '..', 'build'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'build', 'test_results.json'), JSON.stringify({ when: new Date().toISOString(), failed, results, invariants: allInv }, null, 2));
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
