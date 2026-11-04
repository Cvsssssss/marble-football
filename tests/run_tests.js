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
      if (![0, 1, 2, 3, 4].includes(b[3]) || !Number.isFinite(b[0]) || !Number.isFinite(b[1])) accountingOk = false;
      const rr = r[q % 2];
      if (b[3] === 3) {
        if (b[0] < -5 || b[0] > G.W + 5 || b[1] > G.H + 60) boundsOk = false;
        if (b[0] > G.GOAL_LINE_X + rr && b[1] > G.BAR_Y && b[1] < G.GROUND_Y) inGoal[q]++; else inGoal[q] = 0;
        if (inGoal[q] > 2) inGoalOk = false;
        if (i > 0 && fr[i - 1].b[q][3] === 3) {
          const p = fr[i - 1].b[q];
          const sp = Math.hypot(b[0] - p[0], b[1] - p[1]) * CFG.FPS;
          if (sp < CFG.STUCK_SPEED) still[q]++; else still[q] = 0;
          maxStill = Math.max(maxStill, still[q]);
        }
      } else still[q] = 0;
      if (b[3] === 4) { net[q]++; maxNet = Math.max(maxNet, net[q]); } else net[q] = 0;
    });
  }
  stuckOk = maxStill / CFG.FPS <= CFG.STUCK_TIME + 0.15;
  netOk = maxNet / CFG.FPS <= CFG.NET_TIME + 0.1;
  // goals end in the pipe: each goal event followed by a whoosh(goal) for that ball
  for (const e of m.events.filter((x) => x.type === 'goal')) {
    const w = m.events.find((x) => x.type === 'whoosh' && x.ball === e.ball && x.t >= e.t && x.why === 'goal');
    const endT = m.endT !== undefined ? m.endT : fr[fr.length - 1].t;
    if (!w && endT - e.t > CFG.NET_TIME + 0.05) netOk = false;
  }
  return { accountingOk, inGoalOk, netOk, stuckOk, boundsOk, maxStillS: +(maxStill / CFG.FPS).toFixed(2), maxNetS: +(maxNet / CFG.FPS).toFixed(2), stuckTeleports: m.stuckCount };
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

// clock
const clockOk = T.matches.every((m) => [1, 2, 3].includes(m.addedTime) && Math.abs(m.endReg - (90 + m.addedTime) / CFG.GAME_MIN_PER_SEC) < 1e-9);
const endOk = T.matches.every((m) => {
  const last = m.frames[m.frames.length - 1].t;
  if (m.goldenStart === null) return Math.abs(last - m.endReg) <= 1 / CFG.FPS + 1e-6 && m.events.some((e) => e.type === 'whistle' && e.kind === 'end' && Math.abs(e.t - m.endReg) < 1e-6);
  return m.events.some((e) => e.type === 'golden' && Math.abs(e.t - m.endReg) < 1e-6);
});
check("clock ends at 90' + added time (1-3)", clockOk && endOk, T.matches.map((m) => `90+${m.addedTime}`));
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
T.matches.forEach((m) => { const pops = m.events.filter((e) => e.type === 'pop'); for (let i = 1; i < pops.length; i++) { tot++; if (pops[i].team !== pops[i - 1].team) alt++; } });
check('outlet order alternates A,B,A,B (>= 95% of consecutive releases)', alt / tot >= 0.95, { alternatingPct: +(100 * alt / tot).toFixed(1) });
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
  const out = execFileSync(process.execPath, ['-e', `const e=require(${JSON.stringify(path.join(__dirname, '..', 'sim', 'engine.js'))});const r=e.simulateMatch(${m0.seed},${JSON.stringify({ kind: m0.kind, rA: m0.rA, rB: m0.rB, prevA: m0.prev[0], prevB: m0.prev[1] })});process.stdout.write(r.hash)`]).toString();
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
  check('crossbar: ball rising from below passes through (solid only on top)', up.barHits === 0 && passed, { barHits: up.barHits });
  const post = oneBall(G.GOAL_LINE_X - 60, G.BAR_Y + 40, 700, 0, 40);
  const crossed = post.path.some((p) => p[0] > G.GOAL_LINE_X + 30);
  check('posts: no collision with the front post (ball at post height crosses the goal line)', crossed && post.barHits === 0);
  const barEv = T.matches.flatMap((m) => m.events.filter((e) => e.type === 'bar'));
  check('crossbar: every bar contact in the tournament happens from above', barEv.every((e) => e.y < G.BAR_TOP), { barContacts: barEv.length });
}

// ---------- 5. strength / win rate ----------
console.log('== strength');
{
  // every seed is played twice (favourite as team A, then as team B) to cancel seed/position noise
  const n = QUICK ? 300 : 1200;
  let fav = 0, dec = 0;
  const s = CFG.STRENGTH_PCT;
  for (let i = 0; i < n; i++) {
    const favIsA = i % 2 === 0;
    const ctx = favIsA ? { kind: 'final', rA: G.BALL_R * (1 + s), rB: G.BALL_R * (1 - s) } : { kind: 'final', rA: G.BALL_R * (1 - s), rB: G.BALL_R * (1 + s) };
    const r = eng.simulateMatch(500000 + (i >> 1), ctx);
    if (r.failed) continue;
    dec++;
    const w = r.goldenWinner || (r.score.A > r.score.B ? 'A' : 'B');
    if ((w === 'A') === favIsA) fav++;
  }
  const pct = 100 * fav / dec;
  check('strength: favourite win rate in 55-62% (single matches, golden ball decides)', pct >= 55 && pct <= 62, { favouriteWinPct: +pct.toFixed(1), matches: dec, sizeDiff: `+-${(100 * s).toFixed(0)}% radius` });
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
      if (m.goldenStart !== null && f.t >= m.goldenStart && c.main !== `90+${m.addedTime}'`) ok = false;
      prev = c.value; max = Math.max(max, c.value);
    }
    for (const g of m.goals) { const lab = CLOCK.minuteLabel(m, g.t, gmps); const v = lab.includes('+') ? 90 + +lab.slice(3, -1) : +lab.slice(0, -1); if (v > 90 + m.addedTime) ok = false; }
    if (m.goldenStart !== null) info.push({ label, added: m.addedTime, shownMax: `90+${max - 90}'` });
  }
  check(`clock: for ${all.length} matches the displayed clock never exceeds 90+added and never goes backwards (golden ball frozen)`, ok, info.slice(0, 4));
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
  check('bracket (demo): semifinal 1 on the left, semifinal 2 on the right, final in the middle', L4.byKey['0L0'].x < L4.final.x && L4.byKey['0R0'].x > L4.final.x);
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
  check('colours: every tournament match has contrasting ball colours (dE >= 30)', T.matches.every((m) => L.deltaE76(m.kits.A.primary, m.kits.B.primary) >= 30), T.matches.map((m) => +L.deltaE76(m.kits.A.primary, m.kits.B.primary).toFixed(0)));
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

// ---------- 11. windmill boost from minute 70 ----------
console.log('== windmill boost');
{
  const WB = require('./windmill_boost');
  const rc = L.rulesToCfg(L.loadCompetition().rules);
  const n = QUICK ? 60 : 300;
  const r = WB.measure(n, rc, 900000);
  const ma = eng.makeMillAngle(Object.assign({}, CFG, rc), 0);
  const w0 = ma.omega(0), w1 = ma.omega(80 / rc.GAME_MIN_PER_SEC), wMid = ma.omega(70 / rc.GAME_MIN_PER_SEC);
  const gain = 100 * (w1 / w0 - 1);
  check('windmill boost: +25..35% angular speed after minute 72, smooth ramp 68-72', gain >= 25 && gain <= 35 && wMid > w0 && wMid < w1, { angularGainPct: +gain.toFixed(1), at70: +(wMid / w0).toFixed(3) });
  check(`windmill boost measured on ${n} matches: faster launches after 70', goal rate not lower, goals>10 rare (<= 2%)`,
    r.meanLaunchSpeedFrom70 > r.meanLaunchSpeedBefore70 * 1.15 && r.goalsPer10minFrom70 >= r.goalsPer10minBefore70 * 0.95 && r.pctOver10 <= 2,
    { launchBefore: r.meanLaunchSpeedBefore70, launchFrom70: r.meanLaunchSpeedFrom70, goalsPer10Before: r.goalsPer10minBefore70, goalsPer10From70: r.goalsPer10minFrom70, pctOver10: r.pctOver10 });
}

// ---------- 12. config change -> next render changes (no code edit) ----------
if (!QUICK) {
  console.log('== config change');
  const tmp = path.join(ROOT, 'build', 'tmp_config');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, 'config'), tmp, { recursive: true });
  const tf = path.join(tmp, 'teams', 'man_city.json');
  const team = JSON.parse(fs.readFileSync(tf, 'utf8')); team.primary = '#00C853'; fs.writeFileSync(tf, JSON.stringify(team));
  const mf = path.join(tmp, 'maps', 'default.json');
  const map = JSON.parse(fs.readFileSync(mf, 'utf8')); map.sky = ['#ff7a00', '#ffa64d', '#ffd9b3']; fs.writeFileSync(mf, JSON.stringify(map));
  const base = TOUR.buildAll(path.join(ROOT, 'config', 'competitions', 'demo_4teams.json'), path.join(ROOT, 'build', 'test_show_base.json'));
  const chg = TOUR.buildAll(path.join(tmp, 'competitions', 'demo_4teams.json'), path.join(ROOT, 'build', 'test_show_changed.json'), { configDir: tmp });
  execFileSync(process.execPath, [path.join(ROOT, 'render', 'render.js'), 'bracket16', 'output/screenshots_v2/bracket16_empty.png', '16', '--show', 'build/test_show_base.json'], { cwd: ROOT, stdio: 'ignore', timeout: 180000 });
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
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---------- screenshots present (only when they exist) ----------
const shots = path.join(__dirname, '..', 'output', 'screenshots_v2');
if (fs.existsSync(path.join(shots, '01_intro.png'))) {
  const need = ['07_keeper_crouched.png', '08_keeper_jumping.png', 'bracket16_empty.png'];
  check('screenshots: keeper poses + 16-team empty bracket present', need.every((f) => fs.existsSync(path.join(shots, f))), need.filter((f) => !fs.existsSync(path.join(shots, f))));
}

fs.mkdirSync(path.join(__dirname, '..', 'build'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'build', 'test_results.json'), JSON.stringify({ when: new Date().toISOString(), failed, results, invariants: allInv }, null, 2));
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
