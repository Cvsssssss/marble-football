'use strict';
// Playwright driver. Usage (all accept --show build/show.json):
//   node render/render.js stills [dir]          -> key moments (auto-detected) as PNG
//   node render/render.js frames 10,200,.. [dir] -> <dir or build/check>/f_<n>.png
//   node render/render.js video [workers] [--preview] -> build/video_noaudio.mp4 (or video_noaudio_preview.mp4)
//        The timeline is split into blocks (intro, round card, one block per match incl. its replay/MOTM/bracket
//        update, winner). Each block is rendered once into build/segcache/<key>.mp4; key = hash of the renderer source,
//        quality and everything the block shows (match seed/timeline hash, teams, colours, crests, bracket data),
//        so a re-run after a small fix only re-renders the blocks that changed.
//   node render/render.js bracket16 <png>       -> empty 16-team bracket (layout check)
//   node render/render.js brackets [dir]        -> bracket in both styles (current tournament data) + empty 16
//   node render/render.js balls <dir>           -> ball close-ups (crest decal readability)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright');
const ffmpeg = require('ffmpeg-static');
const ROOT = path.join(__dirname, '..');
const argIdx = process.argv.indexOf('--show');
const showPath = argIdx > 0 ? path.resolve(process.argv[argIdx + 1]) : path.join(ROOT, 'build', 'show.json');
if (argIdx > 0) process.argv.splice(argIdx, 2);
const PREVIEW = process.argv.includes('--preview');
if (PREVIEW) process.argv.splice(process.argv.indexOf('--preview'), 1);
const SIZE = PREVIEW ? [1280, 720] : [1920, 1080];

function loadShow() { const s = JSON.parse(fs.readFileSync(showPath, 'utf8')); s.outSize = SIZE; return s; }
async function openPage(browser, show) {
  const page = await browser.newPage({ viewport: { width: SIZE[0], height: SIZE[1] } });
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto('file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.evaluate(() => document.fonts.ready);
  // pass the show as one JSON string (Playwright's object serialisation of a 10 MB show x N workers exhausts the Node heap)
  await page.evaluate((j) => window.initRenderer(JSON.parse(j)), show.__json || (show.__json = JSON.stringify(show)));
  return page;
}
const b64 = (s) => Buffer.from(s.slice(s.indexOf(',') + 1), 'base64');

// ---- key moment detection (global frame numbers); moments that do not exist in this show are skipped ----
function keyMoments(show) {
  const out = [];
  const push = (name, fn) => { try { const f = fn(); if (Number.isFinite(f)) out.push([name, Math.round(f)]); } catch (e) { /* moment not present */ } };
  const segOf = (type, pred) => show.segments.find((s) => s.type === type && (!pred || pred(s)));
  const mSeg = (mi) => segOf('match', (s) => s.match === mi);
  const firstEv = (mi, type, pred) => show.matches[mi].events.find((e) => e.type === type && (!pred || pred(e)));
  const ev = (mi, e, dv) => mSeg(mi).start + Math.round(e.vf + (dv || 0) * 30);
  const gt = (mi, t) => { const F = show.matches[mi].frames; let i = 0; while (i < F.length - 1 && F[i].t < t) i++; return mSeg(mi).start + i; };
  const big = show.teams.length > 4;
  push('01_intro', () => segOf('intro').start + (big ? 150 : 120));
  push('02_bracket_intro', () => segOf('bracket', (s) => s.step === 0).start + 90);
  push('02b_round_card', () => segOf('roundCard').start + 60);
  push('03_kickoff_card', () => segOf('matchPre', (s) => s.match === 0).start + 20);
  push('04_kickoff', () => mSeg(0).start + 3);
  push('05_ball_leaving_outlet', () => ev(0, firstEv(0, 'pop', (e) => e.t > 2), 0.12));
  push('06_windmill_hit', () => ev(0, firstEv(0, 'mill', (e) => e.t > 2), 0.02));
  push('07_keeper_crouched', () => { const m0 = show.matches[0]; for (let i = 300; i < m0.frames.length; i++) { const k = m0.frames[i].k; if (k[3] === 0 && k[1] > 0.9 && k[2] < 0.05) return mSeg(0).start + i; } return NaN; });
  push('08_keeper_jumping', () => { const m0 = show.matches[0]; let best = 0, jf = NaN; for (let i = 300; i < Math.min(900, m0.frames.length); i++) { const k = m0.frames[i].k; if (k[3] === 1 && (560 - k[0]) > best) { best = 560 - k[0]; jf = i; } } return mSeg(0).start + jf; });
  push('09a_goal_banner_in', () => ev(0, firstEv(0, 'goal'), 0.2));
  push('09b_goal_banner_full', () => ev(0, firstEv(0, 'goal'), 0.7));
  push('09c_goal_banner_out', () => ev(0, firstEv(0, 'goal'), 1.85));
  push('10_crossbar_hit', () => { for (let mi = 0; mi < show.matches.length; mi++) { const e = firstEv(mi, 'bar'); if (e) return ev(mi, e); } return NaN; });
  push('10b_windmill_boosted_80min', () => gt(0, 80 / show.cfg.GAME_MIN_PER_SEC));
  push('20a_90min_clearing_pitch', () => ev(0, firstEv(0, 'whistle', (e) => e.kind === 'reg'), 0.6));
  push('20b_added_time_banner', () => ev(0, firstEv(0, 'added'), 0.6));
  let cineDone = false, missDone = false, addGoalDone = false;
  show.matches.forEach((m, mi) => {
    (m.cines || []).forEach((c) => {
      if (cineDone) return; cineDone = true;
      const ci = m.events.find((e) => e.type === 'cine_in' && e.k === c.k), co = m.events.find((e) => e.type === 'cine_out' && e.k === c.k);
      push('21a_good_hit_before', () => ev(mi, ci, -0.25));
      push('21b_good_hit_slowmo_zoom', () => ev(mi, ci, 1.1));
      push('21c_good_hit_slowmo_late', () => ev(mi, ci, 2.0));
      if (co) push('21d_good_hit_after', () => ev(mi, co, 0.9));
    });
    (m.shots || []).forEach((sh) => {
      if (missDone || sh.cine) return; missDone = true;
      const se = m.events.find((e) => e.type === 'shot' && e.k === sh.k);
      push('22a_miss_no_effects', () => ev(mi, se, 0.9));
    });
    m.goals.forEach((g) => {
      if (addGoalDone || !g.shot) return; addGoalDone = true;
      push('23_added_time_goal', () => ev(mi, m.events.find((e) => e.type === 'goal' && Math.abs(e.t - g.t) < 1e-3), 0.7));
    });
  });
  const gm = show.matches.findIndex((m) => m.goldenStart !== null);
  if (gm >= 0) {
    const gb = firstEv(gm, 'golden'), gg = firstEv(gm, 'goal', (e) => e.golden);
    push('11_golden_ball_banner', () => ev(gm, gb, 0.8));
    push('11b_golden_clock_frozen_late', () => Math.min(ev(gm, gg, -0.3), ev(gm, gb, 8)));
    push('12a_golden_goal_shockwave', () => ev(gm, gg, 0.35));
    push('12b_golden_goal_title', () => ev(gm, gg, 1.1));
  }
  push('13_replay', () => segOf('replay').start + 30);
  push('13b_replay_caption', () => segOf('replay').start + 60);
  push('13c_man_of_the_match', () => segOf('motm').start + 45);
  push('14_fulltime_leg2', () => segOf('fulltime', (s) => show.matches[s.match].leg === 'LEG 2').start + 40);
  const leg2 = show.matches.findIndex((m) => m.leg === 'LEG 2');
  push('19_leg2_hud_aggregate', () => mSeg(leg2).start + 700);
  push('15a_bracket_update_after_match', () => segOf('bracket', (s) => s.step === 2).start + 45);
  const rounds = show.rounds || [];
  rounds.forEach((rd, ri) => {
    if (ri >= rounds.length - 1) return;
    const lastLeg = rd.ties[rd.ties.length - 1].legs.slice(-1)[0];
    push(`15_bracket_after_${rd.key}`, () => segOf('bracket', (s) => s.step === lastLeg + 1 && s.len >= 100).start + 100);
  });
  push('16_semifinal_match', () => { const mi = show.matches.findIndex((m) => /^SEMIFINAL/.test(m.stage)); return mSeg(mi).start + 600; });
  push('17_final_match', () => mSeg(show.matches.length - 1).start + 600);
  push('13d_motm_final', () => segOf('motm', (s) => s.match === show.matches.length - 1).start + 45);
  push('18_final_screen_podium', () => segOf('winner').start + 150);
  push('18b_final_screen_end', () => segOf('winner').start + 235);
  return out;
}

async function stills(list, dir) {
  const show = loadShow();
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const page = await openPage(browser, show);
  const items = list === 'auto' ? keyMoments(show) : list.map((n) => ['f_' + n, n]);
  for (const [name, f] of items) {
    const png = await page.evaluate((gg) => window.grabPNG(gg), f);
    fs.writeFileSync(path.join(dir, name + '.png'), b64(png));
  }
  console.log(`${items.length} stills -> ${path.relative(ROOT, dir)}`);
  await browser.close();
}

// ---- render cache: blocks of segments ----
function rendererHash() {
  const h = crypto.createHash('sha256');
  for (const f of ['render/draw.js', 'render/art_pro.js', 'render/atmo.js', 'render/index.html', 'render/bracket_layout.js', 'render/bg_fit.js', 'render/league_layout.js', 'sim/geometry.js', 'sim/clock.js']) h.update(fs.readFileSync(path.join(ROOT, f)));
  return h.digest('hex').slice(0, 12);
}
function blocks(show) {
  const out = [];
  let cur = null;
  for (const s of show.segments) {
    if (!cur || ['intro', 'roundCard', 'matchPre', 'winner', 'lgIntro', 'lgTrans', 'lgPre', 'lgTableFull', 'lgChampion', 'ceremony'].includes(s.type) && !(s.type === 'matchPre' && cur.segs.length === 1 && cur.segs[0].type === 'bracket' && cur.segs[0].caption === 'THE FINALISTS')) {
      cur = { segs: [] }; out.push(cur);
    }
    cur.segs.push(s);
  }
  const rh = rendererHash();
  const teamPart = show.teams.map((t) => [t.name, t.short_name, t.primary, t.secondary, t.players.map((p) => p.name + p.number)]);
  const logoHash = crypto.createHash('sha1').update(JSON.stringify(show.logos || {})).digest('hex').slice(0, 10);
  const common = { rh, size: SIZE, comp: show.competition, teams: teamPart, logos: logoHash, logosOn: show.logosOnBalls, map: show.map, cfg: show.cfg, style: show.bracketStyle };
  if (show.league) { common.league = show.league; common.bg = show.background ? show.background.hash : null; }
  if (show.atmoCfg) common.atmoCfg = show.atmoCfg; // P10 flags (atmosphere.json)
  for (const b of out) {
    b.start = b.segs[0].start; b.len = b.segs.reduce((a, s) => a + s.len, 0);
    const deps = b.segs.map((s) => {
      const d = Object.assign({}, s); delete d.start;
      if (s.match !== undefined && show.atmo) d.atmo = show.atmo.matches[s.match]; // P10
      if (s.match !== undefined) { const m = show.matches[s.match]; d.m = { seed: m.seed, hash: m.hash, ta: m.ta, tb: m.tb, kits: m.kits, prev: m.prev, agg: m.agg, stage: m.stage, leg: m.leg, next: m.nextName, motm: m.motm, rg: m.replayGoal }; }
      if (s.type === 'bracket') { d.data = show.bracket.steps[s.step]; d.prevData = show.bracket.steps[s.step - 1] || null; }
      if (s.type === 'roundCard') d.round = show.rounds[s.round];
      if (s.type === 'winner') d.w = { final: show.final, champion: show.champion, top: show.topScorers };
      if (s.type === 'intro') d.n = show.teams.length;
      return d;
    });
    b.key = crypto.createHash('sha256').update(JSON.stringify({ common, deps, q: PREVIEW ? 'preview' : 'final' })).digest('hex').slice(0, 20);
  }
  return out;
}

async function video(workers) {
  const show = loadShow();
  const total = show.totalFrames;
  const cacheDir = path.join(ROOT, 'build', 'segcache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const B = blocks(show);
  const todo = B.filter((b) => !fs.existsSync(path.join(cacheDir, b.key + '.mp4')));
  const todoFrames = todo.reduce((a, b) => a + b.len, 0);
  console.log(`blocks: ${B.length}, cached: ${B.length - todo.length}, to render: ${todo.length} (${todoFrames} of ${total} frames)`);
  const t0 = Date.now();
  let done = 0, lastLog = 0;
  const queue = todo.slice().sort((a, b) => b.len - a.len); // longest first
  const enc = PREVIEW ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25'] : ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18'];
  const browser = queue.length ? await chromium.launch() : null;
  let opening = Promise.resolve();
  const worker = async () => {
    const page = await (opening = opening.then(() => openPage(browser, show))); // open pages one at a time
    while (queue.length) {
      const b = queue.shift();
      const tmp = path.join(cacheDir, b.key + '.tmp.mp4'), dst = path.join(cacheDir, b.key + '.mp4');
      const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
        ...enc, '-pix_fmt', 'yuv420p', '-r', '30', '-g', '60', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
      const closed = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
      for (let g = b.start; g < b.start + b.len; g++) {
        const jpg = await page.evaluate(([x, q]) => window.grabFrame(x, q), [g, PREVIEW ? 0.85 : 0.93]);
        if (!ff.stdin.write(b64(jpg))) await new Promise((r) => ff.stdin.once('drain', r));
        done++;
        if (done - lastLog >= 900) { lastLog = done; const el = (Date.now() - t0) / 1000; console.log(`frames ${done}/${todoFrames}  ${el.toFixed(0)}s  eta ${((todoFrames - done) * el / done).toFixed(0)}s`); }
      }
      ff.stdin.end(); await closed;
      fs.renameSync(tmp, dst); // only complete blocks enter the cache (safe to interrupt)
    }
    await page.close();
  };
  if (queue.length) { await Promise.all(Array.from({ length: Math.min(workers, queue.length) }, worker)); await browser.close(); }
  const list = path.join(ROOT, 'build', PREVIEW ? 'concat_preview.txt' : 'concat_final.txt');
  fs.writeFileSync(list, B.map((b) => "file '" + path.join(cacheDir, b.key + '.mp4').replace(/\\/g, '/') + "'").join('\n'));
  const dst = path.join(ROOT, 'build', PREVIEW ? 'video_noaudio_preview.mp4' : 'video_noaudio.mp4');
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', dst]);
  fs.writeFileSync(path.join(ROOT, 'build', PREVIEW ? 'render_stats_preview.json' : 'render_stats.json'), JSON.stringify({ blocks: B.length, rendered: todo.length, renderedFrames: todoFrames, totalFrames: total, seconds: (Date.now() - t0) / 1000 }, null, 1));
  console.log('video done', path.relative(ROOT, dst), ((Date.now() - t0) / 1000).toFixed(1) + 's');
}

async function bracket16(out, n, style) {
  const show = loadShow();
  const browser = await chromium.launch();
  const page = await openPage(browser, show);
  const png = await page.evaluate(([k, st]) => window.renderEmptyBracket(k, null, st), [n, style || null]);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, b64(png));
  await browser.close();
  console.log('bracket written', out);
}

// bracket of the current tournament in both styles (draw, after the first round, end) + empty 16-team brackets
async function brackets(dir) {
  const show = loadShow();
  const { bracketSteps } = require('../sim/tournament');
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const page = await openPage(browser, show);
  const files = [];
  const n = show.teams.length, nm = show.matches.length;
  const r0 = show.rounds[0].ties.slice(-1)[0].legs.slice(-1)[0] + 1;
  for (const st of ['left_to_right', 'symmetric']) {
    const over = st === show.bracketStyle ? show.bracket : bracketSteps(show, st);
    for (const [tag, step, lf, cap] of [['end', nm, 90, null], ['finalists', nm - 1, 90, 'THE FINALISTS'], ['advancing', r0, 45, null]]) {
      const a = await page.evaluate(([s, x, l, o, c]) => window.renderDemoBracket(s, x, l, o, c), [step, st, lf, over, cap]);
      const f = `bracket${n}_${st}_${tag}.png`; fs.writeFileSync(path.join(dir, f), b64(a)); files.push(f);
    }
    if (n === 4) { // legacy names used by the v2 tests
      fs.copyFileSync(path.join(dir, `bracket4_${st}_finalists.png`), path.join(dir, `bracket4_${st}.png`));
    }
    const b = await page.evaluate(([x]) => window.renderEmptyBracket(16, null, x), [st]);
    fs.writeFileSync(path.join(dir, `bracket16_${st}.png`), b64(b)); files.push(`bracket16_${st}.png`);
  }
  await browser.close();
  console.log('brackets written', files.length);
}

// ball close-ups: every team of the show at match size and zoomed (decal readability)
async function balls(dir) {
  const show = loadShow();
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const page = await openPage(browser, show);
  const kits = show.teams.map((t) => ({ team: t.id, primary: t.primary, secondary: t.secondary }));
  const R = show.cfg.BALL_RADIUS || 18;
  fs.writeFileSync(path.join(dir, 'balls_all_1x.png'), b64(await page.evaluate(([k, r]) => window.renderBallSheet(k, r, 1, 0.3), [kits, R])));
  fs.writeFileSync(path.join(dir, 'balls_6_zoom4.png'), b64(await page.evaluate(([k, r]) => window.renderBallSheet(k, r, 4, 0.3), [kits.slice(0, 6), R])));
  await browser.close();
  console.log('ball sheets written');
}

(async () => {
  const mode = process.argv[2];
  if (mode === 'stills') await stills('auto', path.resolve(ROOT, process.argv[3] || 'output/screenshots_p2'));
  else if (mode === 'frames') await stills(process.argv[3].split(',').map(Number), path.resolve(ROOT, process.argv[4] || 'build/check'));
  else if (mode === 'bracket16') await bracket16(path.resolve(ROOT, process.argv[3] || 'build/bracket16_empty.png'), +(process.argv[4] || 16), process.argv[5]);
  else if (mode === 'brackets') await brackets(path.resolve(ROOT, process.argv[3] || 'output/screenshots_p2'));
  else if (mode === 'balls') await balls(path.resolve(ROOT, process.argv[3] || 'output/screenshots_p2'));
  else if (mode === 'video') await video(+process.argv[3] || 8);
  else if (mode === 'plan') { // P5: render-cache plan only (what `video` would render), nothing is rendered
    const show = loadShow(); const B = blocks(show); const todo = B.filter((b) => !fs.existsSync(path.join(ROOT, 'build', 'segcache', b.key + '.mp4')));
    console.log(`blocks: ${B.length}, cached: ${B.length - todo.length}, to render: ${todo.length} (${todo.reduce((a, b) => a + b.len, 0)} of ${show.totalFrames} frames)`);
  }
  else if (mode === 'forget') { // P4 --rerender-match <id>: drop the cached block(s) of one match so only that match renders again
    const show = loadShow(); const id = process.argv[3];
    const idx = require('../sim/tournament').matchesIndex(show).matches.find((m) => m.id === id);
    if (!idx) { console.error('unknown match id ' + id); process.exit(2); }
    let n = 0;
    for (const b of blocks(show)) if (b.segs.some((s) => s.match === idx.index)) { const f = path.join(ROOT, 'build', 'segcache', b.key + '.mp4'); if (fs.existsSync(f)) { fs.unlinkSync(f); n++; } }
    console.log(`forget ${id}: ${n} cached block(s) removed`);
  }
  else { console.log('usage: stills [dir] | frames a,b,c [dir] | video [workers] [--preview] | brackets [dir] | balls [dir]'); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });

