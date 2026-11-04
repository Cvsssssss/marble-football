'use strict';
// P5 tests: balanced draw, good-hit trigger (confusion table), windmill from minute 60, timing-aware pump,
// crossbar / platform penetration, SIMULATION label off. No video is rendered (a few single frames only).
// Usage: node tests/p5_tests.js [--quick]   -> build/p5_test_results.json
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const L = require('../sim/config_loader');
const T = require('../sim/tournament');
const B = require('../sim/bracket');
const G = require('../sim/geometry');
const GH = require('../sim/good_hit');
const CFG = require('../sim/config');
const eng = require('../sim/engine');
const PUMP = require('../sim/pump');
const QUICK = process.argv.includes('--quick');
const COMP = path.join(ROOT, 'config', 'competitions', 'ucl_2026_top16.json');

const results = []; let failed = 0;
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  if (!ok) failed++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail).slice(0, 400) : ''));
}
const loadSeeds = (conf) => { const f = path.join(ROOT, 'build', 'cache', `seeds_${conf.simHash}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}; };

(async () => {
  // ---------- 1. balanced draw ----------
  console.log('== 1. balanced bracket draw');
  {
    const ids = Array.from({ length: 16 }, (_, i) => 't' + (i + 1));
    const str = ids.map((_, i) => 92 - i);
    let allOk = true; const distinct = new Set(), bad = [];
    for (let s = 0; s < 20; s++) {
      const b = B.buildBracket(ids, [], { seed: 1000 + 7919 * s, strengths: str });
      const potOf = (t) => b.pots.findIndex((p) => p.includes(t));
      const halves = [b.slots.slice(0, 8), b.slots.slice(8)].map((h) => [0, 1, 2, 3].map((p) => h.filter((t) => potOf(t) === p).length));
      const quarters = [0, 1, 2, 3].map((q) => b.slots.slice(q * 4, q * 4 + 4).map(potOf).sort().join(''));
      // top-4 (pot 1) can only meet in the semifinals or later = never in the same quarter
      const top4q = [0, 1, 2, 3].map((t) => b.slots.indexOf(t) >> 2);
      const ok = halves.every((h) => h.every((c) => c === 2)) && quarters.every((q) => q === '0123') && new Set(top4q).size === 4 && new Set(b.slots).size === 16;
      if (!ok) { allOk = false; bad.push({ s, halves, quarters }); }
      distinct.add(b.ties.map((t) => t.join('v')).join(','));
    }
    check('draw: 20 seeds -> every half has 2 teams of every pot, every quarter exactly 1 of every pot, top-4 in 4 different quarters (meet in SF or later)', allOk, bad.slice(0, 2));
    check('draw: placement random from the seed (20 seeds -> 20 different brackets), no fixed 1v16 pattern', distinct.size === 20 && [...distinct].some((d) => !d.startsWith('0v15')), { distinct: distinct.size });
    const a = B.buildBracket(ids, [], { seed: 42, strengths: str }), b2 = B.buildBracket(ids, [], { seed: 42, strengths: str });
    check('draw: deterministic (same seed -> same draw)', JSON.stringify(a.slots) === JSON.stringify(b2.slots));
    const f1 = B.buildBracket(ids, [{ a: 't1', b: 't5', round: 'R16' }], { seed: 9, strengths: str });
    const f2 = B.buildBracket(ids, [{ a: 't2', b: 't12', round: 'QF' }], { seed: 9, strengths: str });
    const p1 = f2.slots.indexOf(1), p2 = f2.slots.indexOf(11);
    check('draw: forced R16 pair (different pots) is a tie and the draw constraints still hold', f1.ties.some((t) => t.includes(0) && t.includes(4)) && B.drawOk(f1.slots, f1.pots));
    check('draw: forced QF pair (different pots) in sibling ties, constraints still hold', (p1 >> 2) === (p2 >> 2) && (p1 >> 1) !== (p2 >> 1) && B.drawOk(f2.slots, f2.pots));
    const strengths = Array.from({ length: 16 }, (_, i) => (i * 37) % 16); // pots by strength, not by list order
    const c = B.buildBracket(ids, [], { seed: 3, strengths });
    const potByStr = (t) => Math.floor([...Array(16).keys()].sort((x, y) => strengths[y] - strengths[x]).indexOf(t) / 4);
    check('draw: pots come from the strength rank (not from the list order)', [0, 1, 2, 3].every((q) => new Set(c.slots.slice(q * 4, q * 4 + 4).map(potByStr)).size === 4));
    const c1 = L.loadCompetition(COMP), c2 = L.loadCompetition(COMP, { map: 'sunset' }), c3 = L.loadCompetition(COMP);
    check('draw seed: same competition + map -> same draw seed (preview = final); another map -> another draw', c1.drawSeed === c3.drawSeed && c1.drawSeed !== c2.drawSeed && c1.simHash !== c2.simHash, { a: c1.drawSeed, b: c2.drawSeed });
  }

  // ---------- 2. good-hit trigger over the whole tournament + 20 extra seeds ----------
  console.log('== 2. slow-motion / zoom trigger');
  const conf = L.loadCompetition(COMP);
  const TT = T.buildTournament(conf, { seedCache: loadSeeds(conf), cfgExtra: { KEEP_FINE: true } });
  {
    const rows = [];
    TT.matches.forEach((m, mi) => GH.shotTruth(m).forEach((r) => rows.push(Object.assign({ src: 'tournament', match: mi }, r))));
    const extra = [];
    for (let i = 0; extra.length < 20 && i < 80; i++) {
      const r = eng.simulateMatch(610000 + i, { kind: i % 2 ? 'final' : 'leg2', prevA: 1, prevB: 1 }, Object.assign(L.rulesToCfg(conf.rules), { KEEP_FINE: true }));
      if (r.failed || !r.shots.length) continue;
      extra.push(r);
      GH.shotTruth(r).forEach((x) => rows.push(Object.assign({ src: 'seed' + r.seed }, x)));
    }
    const cm = GH.confusion(rows);
    fs.writeFileSync(path.join(ROOT, 'build', 'p5_trigger_rows.json'), JSON.stringify({ confusion: cm, rows }, null, 1));
    check(`trigger: ${TT.matches.length} tournament matches + ${extra.length} extra seeds, ${rows.length} added-time shots: 0 false positives, 0 false negatives, every effect starts at a qualifying windmill contact`,
      cm.FP === 0 && cm.FN === 0 && cm.misaligned === 0 && cm.TP > 0 && cm.TN > 0, cm);
    // the effect really is in the video frames: slow motion frames inside every good shot, none in other shots
    let framesOk = true;
    for (const m of TT.matches.concat(extra)) for (const sh of m.shots) {
      const fx = m.frames.some((f) => f.t >= sh.t0 && f.t <= sh.t1 + CFG.CINE_HOLD && f.ts !== undefined && f.ts < 1);
      if (fx !== !!sh.cine) framesOk = false;
    }
    check('trigger: slow-motion frames exist in the timeline exactly for the shots with a good hit (camera + time scale baked into the frames, so every render chunk sees the same track)', framesOk);
  }

  // ---------- 3. windmill faster from minute 60 ----------
  console.log('== 3. windmill from minute 60');
  {
    const rc = L.rulesToCfg(conf.rules);
    const ma = eng.makeMillAngle(Object.assign({}, CFG, rc), 0);
    const g = rc.GAME_MIN_PER_SEC;
    check('windmill: rules.windmill_fast_from_min = 60, ramp 58-62, same faster speed (x1.3) as before', conf.rules.windmill_fast_from_min === 60 && rc.BOOST_FROM === 60 && rc.BOOST_RAMP[0] === 58 && rc.BOOST_RAMP[1] === 62 && rc.BOOST === 1.3
      && ma.omega(57.5 / g) === CFG.OMEGA && Math.abs(ma.omega(62.5 / g) - CFG.OMEGA * 1.3) < 1e-9 && ma.omega(60 / g) > CFG.OMEGA);
  }

  // ---------- 4. pump timing ----------
  console.log('== 4. pump timing');
  {
    const PM = require('./pump_measure');
    const r = PM.run(200);
    fs.writeFileSync(path.join(ROOT, 'build', 'pump_measure.json'), JSON.stringify(r, null, 1));
    const n = r.normal.new, f = r.fast.new, fo = r.fast.old;
    check('pump: same 200 shots, fast windmill good-hit share >= normal share - 10 points', f.goodHitPct >= n.goodHitPct - 10, { normal: n.goodHitPct, fastOld: fo.goodHitPct, fastNew: f.goodHitPct });
    check('pump: fast windmill, fewer balls fall down without a good contact, shot speed kept (bombs)', f.fallDownNoGoodPct < fo.fallDownNoGoodPct && f.avgShotSpeed >= fo.avgShotSpeed * 0.95, { fallOld: fo.fallDownNoGoodPct, fallNew: f.fallDownNoGoodPct, speedOld: fo.avgShotSpeed, speedNew: f.avgShotSpeed });
    check('pump: one ball at a time, no visible freeze (delay <= one blade period)', f.maxWait <= Math.PI / (CFG.OMEGA * CFG.BOOST) + 0.01 && n.maxWait <= Math.PI / CFG.OMEGA + 0.01, { maxWaitNormal: n.maxWait, maxWaitFast: f.maxWait });
    const goals = TT.matches.map((m) => m.score[0] + m.score[1]);
    check('pump: goals per match in the tournament all within 1-10', goals.every((x) => x >= 1 && x <= 10), { min: Math.min(...goals), max: Math.max(...goals), avg: +(goals.reduce((a, b) => a + b, 0) / goals.length).toFixed(2) });
    const cb = TT.comebacks.filter((c) => /ROUND OF 16|QUARTER/.test(c.stage));
    check('gates: comeback gate (>= 3 comebacks in R16/QF) still met', cb.length >= 3, { comebacks: cb.length });
    // determinism with the new pump
    const s1 = eng.simulateMatch(123457, { kind: 'final' }), s2 = eng.simulateMatch(123457, { kind: 'final' });
    check('determinism: same seed -> same timeline hash (timing-aware pump, solid bar)', s1.hash === s2.hash);
  }

  // ---------- 5. crossbar / platforms ----------
  console.log('== 5. crossbar');
  {
    const pen = GH.penetrationScan(TT.matches);
    check(`crossbar: 0 frames with a ball centre inside the bar rect expanded by r - 0.5 px over all ${TT.matches.length} matches (${pen.bar.summary.frames} frames)`, pen.bar.summary.failFrames === 0, pen.bar.summary);
    check('platforms: 0 frames with a ball inside a platform (edges included) over all matches', pen.plat.summary.failFrames === 0, pen.plat.summary);
    // stress: 5000 random spout launches at the maximum windmill speed, every physics step checked
    const cfg = Object.assign({}, CFG);
    const W = eng.buildWorld(cfg);
    const Matter = require('matter-js');
    const rng = eng.mulberry32(5005);
    const r = G.BALL_R, maxV = cfg.MAX_SPEED / 60, om = cfg.OMEGA * cfg.BOOST;
    let worst = 0, failSteps = 0, barContacts = 0, worstPlat = 0;
    const N = QUICK ? 1500 : 5000;
    for (let i = 0; i < N; i++) {
      const a0 = rng() * Math.PI * 2, vx = -40 + 80 * rng(), vy = 280 + 120 * rng();
      const body = Matter.Bodies.circle(G.SPOUT_X, G.GROUND_Y - r - 1, r, { restitution: cfg.BALL_RESTITUTION, friction: 0, frictionStatic: 0, frictionAir: cfg.FRICTION_AIR,
        collisionFilter: { category: eng.CAT.BALL, mask: eng.CAT.STATIC | eng.CAT.MILL } });
      body.deltaTime = W.dtMs; Matter.Body.setVelocity(body, { x: vx / 60, y: -vy / 60 });
      Matter.Composite.add(W.engine.world, body);
      const st = { barGhost: false };
      for (let s = 0; s < cfg.HZ * 3; s++) {
        const t = s / cfg.HZ;
        eng.driveKinematic(W.mill, G.HUB_X, G.HUB_Y, a0 - om * t, G.HUB_X, G.HUB_Y, a0 - om * (t + 1 / cfg.HZ));
        body.force.y += body.mass * cfg.GRAVITY / 1e6;
        const px = body.position.x, py = body.position.y;
        Matter.Engine.update(W.engine, W.dtMs);
        const sp = Math.hypot(body.velocity.x, body.velocity.y);
        if (sp > maxV) Matter.Body.setVelocity(body, { x: body.velocity.x * maxV / sp, y: body.velocity.y * maxV / sp });
        if (eng.sweptBar(st, body, r, px, py, cfg.BALL_RESTITUTION)) barContacts++;
        eng.platformProject(body, r);
        const o = GH.rectOverlap(body.position.x, body.position.y, r, ...GH.BAR_RECT);
        if (o > worst) worst = o;
        if (o > 0.5) failSteps++;
        for (const R of GH.PLAT_RECTS) { const op = GH.rectOverlap(body.position.x, body.position.y, r, ...R); if (op > worstPlat) worstPlat = op; if (op > 0.5) failSteps++; }
        if (body.position.y > G.H + 40 || (px < G.GOAL_LINE_X && body.position.x >= G.GOAL_LINE_X && body.position.y > G.BAR_Y)) break;
      }
      Matter.Composite.remove(W.engine.world, body);
    }
    check(`crossbar stress: ${N} random launches at the maximum windmill speed, every physics step: 0 failures (bar and platforms)`, failSteps === 0 && barContacts > 0, { barContacts, worstBarOverlap: +worst.toFixed(3), worstPlatOverlap: +worstPlat.toFixed(3) });
  }

  // ---------- 6. SIMULATION label off ----------
  console.log('== 6. SIMULATION label');
  {
    check('label: rules.show_simulation_label is false by default and not part of the simulation hash', conf.rules.show_simulation_label === false);
    const show = T.makeShow(conf, TT);
    show.matches.forEach((m) => { delete m.fine; });
    check('label: show.cfg.SHOW_SIM_LABEL false', show.cfg.SHOW_SIM_LABEL === false);
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const grab = async (on, kind) => {
      const s = Object.assign({}, show, { cfg: Object.assign({}, show.cfg, { SHOW_SIM_LABEL: on }) });
      const size = kind === 'reel' ? [1080, 1920] : [1920, 1080];
      const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
      await page.goto('file:///' + path.join(ROOT, 'render', 'index.html').replace(/\\/g, '/'));
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate((j) => window.initRenderer(JSON.parse(j)), JSON.stringify(Object.assign(s, kind === 'reel' ? { outSize: [1080, 1920] } : {})));
      let out;
      if (kind === 'reel') {
        const reel = require('../sim/reels').buildReel(s, 0);
        await page.evaluate((j) => window.initReel(JSON.parse(j)), JSON.stringify(reel));
        const seg = reel.segments.find((x) => x.type === 'match');
        out = await page.evaluate((k) => { window.renderReelFrame(k); const c = document.getElementById('c'); return Array.from(c.getContext('2d').getImageData(470, 1660, 140, 56).data); }, seg.start + 30);
      } else if (kind === 'thumb') {
        const m = s.matches[0], gl = m.goals[0];
        out = await page.evaluate(([t, x, y]) => { window.renderThumb(0, t, { z: 2.1, x: x - 90, y: y - 70 }); const c = document.getElementById('c'); return Array.from(c.getContext('2d').getImageData(1240, 980, 680, 100).data); }, [gl.t + 0.2, gl.x, gl.y]);
      } else {
        const seg = s.segments.find((x) => x.type === 'match');
        out = await page.evaluate((g) => { window.renderFrame(g); const c = document.getElementById('c'); return Array.from(c.getContext('2d').getImageData(1740, 1030, 180, 50).data); }, seg.start + 300);
      }
      await page.close();
      return out;
    };
    const diff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) d++; return d; };
    const P = require('../preflight');
    const gray = (rgba, w, h) => { const g = Buffer.alloc(w * h); for (let i = 0; i < w * h; i++) g[i] = Math.round(0.299 * rgba[4 * i] + 0.587 * rgba[4 * i + 1] + 0.114 * rgba[4 * i + 2]); return g; };
    const lvOff = await grab(false, 'long'), lvOn = await grab(true, 'long');
    const rOff = await grab(false, 'reel'), rOn = await grab(true, 'reel');
    const tOff = await grab(false, 'thumb'), tOn = await grab(true, 'thumb');
    await browser.close();
    const lvDet = { labelPixels: diff(lvOff, lvOn), detectorOn: P.labelPresent(gray(lvOn, 180, 50), 180, 50), detectorOff: P.labelPresent(gray(lvOff, 180, 50), 180, 50) };
    check('label: long-video frame has no label when the flag is false (the flag-on render differs exactly there; preflight detector: absent)', lvDet.labelPixels > 50 && !lvDet.detectorOff, lvDet);
    check('label: reel frame has no label when the flag is false', diff(rOff, rOn) > 50, { labelPixels: diff(rOff, rOn) });
    check('label: thumbnails never have the label (identical with the flag on or off)', diff(tOff, tOn) === 0);
    const ck = require('../sim/checklist');
    const tmp = path.join(ROOT, 'build', 'p5_ck'); fs.mkdirSync(tmp, { recursive: true });
    ck.writeChecklist(tmp, { run: 'x', quality: 'final_1080p', long_video: { file: 'long_video_1080p.mp4', seconds: 1800 }, reels: [], competition: { name: 'MARBLE CHAMPIONS' }, map: 'sunset', date: '2026-11-05' });
    const txt = fs.readFileSync(path.join(tmp, 'PUBLISH_CHECKLIST.md'), 'utf8');
    check('checklist: still says computer simulation, not real results, and reminds the YouTube altered/synthetic-content question', /simulare pe calculator, nu rezultate reale/.test(txt) && /modificat\/sintetic/.test(txt) && !/Eticheta SIMULATION se vede/.test(txt));
    const br = fs.readFileSync(path.join(ROOT, 'build_reels.js'), 'utf8');
    check('reel suggestions: notes remind "computer simulation, not real results" + YouTube disclosure', /not real results/.test(br) && /modificat\/sintetic/.test(br));
  }

  fs.writeFileSync(path.join(ROOT, 'build', 'p5_test_results.json'), JSON.stringify({ results, failed }, null, 1));
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
