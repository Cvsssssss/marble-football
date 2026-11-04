'use strict';
// P3 checks: reels (selection, determinism, safe area, contrast, ffprobe, suggestions lint, no names in play)
// and variants (map / competition switching from config only, plan validator, presets + player data).
// Reel video checks need `npm run reels` first (skipped with a clear message otherwise).
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const L = require('../sim/config_loader');
const TOUR = require('../sim/tournament');
const eng = require('../sim/engine');
const { selectReels } = require('../sim/selectReels');
const { buildReel, TARGET_MAX } = require('../sim/reels');
const { lintSuggestion } = require('../build_reels');
const { validatePlan } = require('../plan/validate');

let pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) pass++; else fail++;
  const s = info === undefined ? '' : '  ' + JSON.stringify(info).slice(0, 300);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${s}`);
}
const UCL = path.join(ROOT, 'config', 'competitions', 'ucl_2026_top16.json');

(async () => {
  console.log('== reels: selection + timeline');
  const tmpShow = path.join(ROOT, 'build', 'p3test_show.json');
  const { show } = TOUR.buildAll(UCL, tmpShow);
  const index = TOUR.matchesIndex(show);
  const sel = selectReels(index, 3);
  check('selection: 3 comeback matches from round of 16 / quarter-finals only (never semifinal or final)',
    sel.reels.length === 3 && sel.reels.every((r) => /^(ROUND OF 16|QUARTER-FINAL)/.test(r.stage) && index.matches.find((m) => m.id === r.id).comeback), sel.reels.map((r) => `${r.id}:${r.why}`));
  { // synthetic: a strong semifinal comeback must still be excluded, depth >= 2 ranked first
    const fake = JSON.parse(JSON.stringify(index));
    const sf = fake.matches.find((m) => /^SEMIFINAL/.test(m.stage)); sf.comeback = true; sf.comeback_depth = 3;
    const s2 = selectReels(fake, 3);
    check('selection rule: semifinal/final comebacks are never picked; depth >= 2 ranked first', !s2.reels.some((r) => /^SEMI|FINAL$/.test(r.stage)) && (s2.reels[0].comeback_depth >= 2 || !fake.matches.some((m) => m.comeback && m.comeback_depth >= 2 && /^(ROUND|QUARTER)/.test(m.stage))), s2.reels.map((r) => r.id));
  }
  const reels = sel.reels.map((r) => ({ r, reel: buildReel(show, r.index) }));
  const rules = L.rulesToCfg(L.loadCompetition(UCL).rules);
  const det = reels.map(({ r, reel }) => {
    const m = show.matches[r.index];
    const again = eng.simulateMatch(reel.seed, { kind: m.kind, rA: m.rA, rB: m.rB, prevA: m.prev[0], prevB: m.prev[1], fav: m.strength.fav || undefined, edge: m.strength.edge }, rules);
    return { id: r.id, same: reel.seed === r.seed && reel.timeline_hash === r.timeline_hash && again.hash === r.timeline_hash };
  });
  check('determinism: reel seed = long-video seed and the re-simulated match has the same timeline hash', det.every((d) => d.same), det);
  check('reel length 30..55 s; structure hook -> match -> replay -> motm -> end', reels.every(({ reel }) => reel.seconds >= 30 && reel.seconds <= 55 && reel.segments.map((s) => s.type).join() === 'hook,match,replay,motm,end'), reels.map(({ reel }) => reel.seconds));
  check('fast-forward: x2 only, each stretch <= 1.5 s of output, never over a goal', reels.every(({ reel }) => {
    const plan = reel.segments[1].plan, m = show.matches[reel.matchIndex];
    let run = 0, ok = true;
    for (const p of plan) { run = p.ff ? run + 1 : 0; if (run > 1.5 * 30 + 1) ok = false; if (p.ff && m.goals.some((g) => Math.abs(p.src / 30 - g.t) < 1.0)) ok = false; }
    // every goal frame is present at normal speed
    for (const g of m.goals) if (!plan.some((p) => !p.ff && Math.abs(p.src - g.t * 30) < 1)) ok = false;
    return ok;
  }));
  check('reel audio: same effects re-timed, no horn / fanfare / cheer', reels.every(({ reel }) => !reel.audio.some((e) => ['fanfare', 'cheer', 'horn'].includes(e.type)) && reel.audio.some((e) => e.type === 'goal')));

  console.log('== reels: rendered frames (layout, safe area, names)');
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file:///' + path.join(ROOT, 'render', 'index.html').replace(/\\/g, '/'));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((j) => window.initRenderer(JSON.parse(j)), JSON.stringify(Object.assign({}, show, { outSize: [1080, 1920] })));
  const reel1 = reels[0].reel;
  await page.evaluate((j) => window.initReel(JSON.parse(j)), JSON.stringify(reel1));
  const seg = (t) => reel1.segments.find((s) => s.type === t);
  const samples = [seg('hook').start + 40, seg('match').start + 30, seg('match').start + Math.round(seg('match').len / 2), seg('replay').start + 60, seg('motm').start + 30, seg('end').start + 40];
  const safe = await page.evaluate((ks) => {
    const Ly = window.REEL_LAYOUT, cv = document.getElementById('c'), c = cv.getContext('2d');
    const fy0 = Ly.FIELD.y * Ly.RS, fy1 = (Ly.FIELD.y + Ly.FIELD.h) * Ly.RS;
    const x0 = Ly.SAFE.x0 * Ly.RS, x1 = Ly.SAFE.x1 * Ly.RS, y0 = Ly.SAFE.y0 * Ly.RS, y1 = Ly.SAFE.y1 * Ly.RS;
    const out = [];
    for (const k of ks) {
      window.renderReelFrame(k);
      const d = c.getImageData(0, 0, cv.width, cv.height).data, W = cv.width;
      let bad = 0;
      // outside the safe area and outside the playfield only the plain background gradient may appear (rows uniform)
      for (let y = 0; y < cv.height; y += 2) {
        if (y >= fy0 && y < fy1) continue;
        const inBand = y < y0 || y >= y1;
        const ref = 4 * (y * W + Math.floor(W / 2));
        const refPx = inBand ? [d[ref], d[ref + 1], d[ref + 2]] : null;
        // background reference for side columns: the pixel at x=4 of the same row
        const r0 = 4 * (y * W + 4);
        for (let x = 0; x < W; x += 3) {
          const side = x < x0 || x >= x1;
          if (!inBand && !side) continue;
          const i = 4 * (y * W + x), rp = inBand ? refPx : [d[r0], d[r0 + 1], d[r0 + 2]];
          if (Math.abs(d[i] - rp[0]) + Math.abs(d[i + 1] - rp[1]) + Math.abs(d[i + 2] - rp[2]) > 12) bad++;
        }
      }
      out.push({ k, bad });
    }
    return out;
  }, samples);
  check('safe area: header, bracket strip, scoreboard, captions and SIMULATION label inside the central 80 % (pixel check, 6 frames)', safe.every((s) => s.bad === 0), safe);
  // the lower-third caption and the MOTM card are drawn inside SAFE by construction; verify the drawn text boxes too
  const boxes = await page.evaluate((ks) => {
    const Ly = window.REEL_LAYOUT; const seen = [];
    const o = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, x, y, w) {
      const m = this.measureText(t), tr = this.getTransform(), al = this.textAlign;
      const wpx = m.width * tr.a, X = tr.a * x + tr.e, Y = tr.d * y + tr.f;
      const left = al === 'center' ? X - wpx / 2 : al === 'right' ? X - wpx : X;
      const scene = Math.abs(tr.a - Ly.RS * Ly.FIELD.h / 720) < 0.02; // texts of the playfield itself (keeper shirt number)
      if (!scene) seen.push({ t: String(t), l: left / Ly.RS, r: (left + wpx) / Ly.RS, y: Y / Ly.RS });
      return o.call(this, t, x, y, w);
    };
    for (const k of ks) window.renderReelFrame(k);
    CanvasRenderingContext2D.prototype.fillText = o;
    return seen.filter((s) => s.y > 120); // all reel texts
  }, samples);
  const outside = boxes.filter((b) => b.l < 72 - 1 || b.r > 648 + 1 || b.y < 128 || b.y > 1152);
  check('safe area: every text drawn on the reel (scoreboard, captions, cards) lies inside x 72..648, y 128..1152 (design px)', outside.length === 0, outside.slice(0, 5));
  // contrast (WCAG ratio) of the main text / background pairs used by the reel UI
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const pairs = [['#ffffff', '#0b1a2e'], ['#0b1a2e', '#ffffff'], ['#ffd84a', '#0b1a2e'], ['#c9dcff', '#0b1a2e'], ['#9fc7ff', '#0b1a2e'], ['#9fb6d6', '#0a1830'], ['#0b1a2e', '#ffd84a']];
  const cr = pairs.map(([f, b]) => +ratio(f, b).toFixed(1));
  check('contrast: reel text colours vs their panels >= 4.5:1 (WCAG AA)', cr.every((x) => x >= 4.5), cr);
  // no real player names during play (hook + match part); allowed in replay caption and MOTM
  const names = show.teams.flatMap((t) => t.players.map((p) => p.name));
  const playFrames = []; for (let k = 0; k < seg('replay').start; k += 7) playFrames.push(k);
  const drawn = await page.evaluate((F) => {
    const seen = new Set(); const o = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, x, y, w) { seen.add(String(t)); return o.call(this, t, x, y, w); };
    for (const k of F) window.renderReelFrame(k);
    CanvasRenderingContext2D.prototype.fillText = o; return [...seen];
  }, playFrames);
  check('rule: no real player name drawn during play in the reel (hook + match part)', drawn.filter((t) => names.some((n) => t.includes(n))).length === 0, { frames: playFrames.length });
  const capt = await page.evaluate((k) => { const seen = []; const o = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t, x, y, w) { seen.push(String(t)); return o.call(this, t, x, y, w); }; window.renderReelFrame(k); CanvasRenderingContext2D.prototype.fillText = o; return seen; }, seg('replay').start + 60);
  check('replay caption shows the decisive scorer as "I. Surname · minute\'"', capt.some((t) => t.startsWith(reel1.decisive.player !== undefined ? show.teams[reel1.decisive.team].players[reel1.decisive.player].name : '???') && /·\s*\d+/.test(t)), capt.filter((t) => t.includes('·')).slice(0, 2));

  console.log('== variants: map / competition switching (config only)');
  const showFor = (comp, map) => { const f = path.join(ROOT, 'build', `p3test_${path.basename(comp, '.json')}_${map || 'def'}.json`); return TOUR.buildAll(comp, f, { map }).show; };
  const sN = showFor(UCL, 'stadium_night'), sS = showFor(UCL, 'sunset');
  check('--map changes only the look: same seeds and timeline hashes as the long video', sN.matches.every((m, i) => m.hash === show.matches[i].hash) && sS.matches.every((m, i) => m.hash === show.matches[i].hash));
  await page.setViewportSize({ width: 1920, height: 1080 });
  const px = {};
  for (const [name, s] of [['sky_clean', show], ['stadium_night', sN], ['sunset', sS]]) {
    await page.evaluate((j) => window.initRenderer(JSON.parse(j)), JSON.stringify(Object.assign({}, s, { outSize: [1920, 1080] })));
    const g = s.segments.find((x) => x.type === 'match').start + 200;
    px[name] = await page.evaluate((gg) => { window.renderFrame(gg); const c = document.getElementById('c').getContext('2d');
      const p = (x, y) => Array.from(c.getImageData(x, y, 1, 1).data.slice(0, 3)); return { sky: p(960, 300), low: p(960, 1000) }; }, g);
  }
  const diff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  check('pixels: stadium_night and sunset backgrounds differ clearly from sky_clean (same frame)', diff(px.sky_clean.sky, px.stadium_night.sky) > 120 && diff(px.sky_clean.sky, px.sunset.sky) > 60 && diff(px.stadium_night.sky, px.sunset.sky) > 120, px);
  const sU = showFor(path.join(ROOT, 'config', 'competitions', 'uel_top16.json'));
  check('--competition changes teams, name and theme with no code edits', sU.competition.name === 'MARBLE CONTINENTAL' && sU.teams[0].id === 'benfica' && sU.map.id === 'stadium_day' && show.map.id !== sU.map.id);
  await browser.close();

  console.log('== presets + data');
  const comps = { ucl_2026_top16: 'MARBLE CHAMPIONS', uel_top16: 'MARBLE CONTINENTAL', nations_world_16: 'MARBLE WORLD NATIONS', nations_euro_16: 'MARBLE EURO NATIONS' };
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'logos', 'manifest.json'), 'utf8')).logos;
  const probs = [];
  for (const [id, nm] of Object.entries(comps)) {
    const c = L.loadCompetition(path.join(ROOT, 'config', 'competitions', id + '.json'));
    if (c.competition.name !== nm) probs.push(`${id}: name`);
    if (!c.competition.standings || !/^https?:/.test(c.competition.standings.source_url)) probs.push(`${id}: snapshot source`);
    for (const t of c.teams) {
      if (t.players.length !== 3 || t.players.some((p) => !p.source_url || !p.retrieved || p.verified === undefined || !/^([A-ZÀ-ÞİÓ][\p{L}]*\.\s)?\p{L}/u.test(p.name))) probs.push(`${t.id}: players`);
      if (!t.logoFile || !man[t.id] || !man[t.id].source_url) probs.push(`${t.id}: crest/flag + manifest`);
      if (id.startsWith('nations') && (!t.national || man[t.id].kind !== 'flag')) probs.push(`${t.id}: national flag`);
    }
  }
  check('4 competition presets (own names), snapshots with source, 3 attackers with source per team, crest/flag in manifest', probs.length === 0, probs);
  const review = fs.readFileSync(path.join(ROOT, 'config', 'players_review.md'), 'utf8');
  const missing = [];
  for (const id of Object.keys(comps)) for (const t of L.loadCompetition(path.join(ROOT, 'config', 'competitions', id + '.json')).teams) for (const p of t.players) if (!review.includes(p.name)) missing.push(p.name);
  check('players_review.md lists every player of the 4 presets', missing.length === 0, missing.slice(0, 8));
  const themes = ['sky_clean', 'stadium_day', 'stadium_night', 'sunset'].map((m) => JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'maps', m + '.json'), 'utf8')));
  check('4 map themes with own music profile (sky_clean = approved v2 track)', themes.length === 4 && !themes[0].music && new Set(themes.slice(1).map((t) => JSON.stringify(t.music))).size === 3);

  console.log('== plan/');
  const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan', 'content_plan.json'), 'utf8'));
  const good = validatePlan(plan);
  check('plan:validate passes on plan/content_plan.json (12 videos, rotation, uniqueness <= threshold)', good.ok && plan.videos.length === 12, good.errors);
  const broken = JSON.parse(JSON.stringify(plan));
  broken.videos[2].map = broken.videos[1].map; broken.videos[5].competition = broken.videos[4].competition;
  const bad = validatePlan(broken);
  check('plan:validate fails on a deliberately broken plan (same map / competition twice in a row)', !bad.ok && bad.errors.some((e) => /same map/.test(e)) && bad.errors.some((e) => /same competition/.test(e)), bad.errors.slice(0, 3));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'plan', 'validate.js'), '--no-write']);
  check('npm run plan:validate exits 0 on the provided plan', r.status === 0);
  check('plan/OPERATING_RULES.md has the PLAN.md §3 posting rules and the CLAUDE.md content rules', (() => { const t = fs.readFileSync(path.join(ROOT, 'plan', 'OPERATING_RULES.md'), 'utf8'); return t.includes('D−1 seara') && t.includes('MARBLE CHAMPIONS') && t.includes('SIMULATION'); })());

  console.log('== suggestions lint');
  const playerNames = names;
  const okS = { title: 'Dortmund come back from 2 down vs PSG! Marble football MARBLE CHAMPIONS | SIMULATION', description: 'This is a computer simulation, not a real match and not real results.', tags: ['Dortmund', 'marble football'] };
  const badS = { title: 'S. Guirassy wins the Champions League!', description: 'Real result', tags: ['UEFA'] };
  check('suggestions lint: accepts a correct suggestion, rejects player names / official names / missing SIMULATION', lintSuggestion(okS, playerNames).length === 0 && lintSuggestion(badS, playerNames).length >= 3, lintSuggestion(badS, playerNames));

  console.log('== rendered reels (output/reels)');
  const selF = path.join(ROOT, 'output', 'reels', 'selection.json');
  if (!fs.existsSync(selF)) { check('rendered reels present (run `npm run reels` first)', false); }
  else {
    const S = JSON.parse(fs.readFileSync(selF, 'utf8'));
    const fp = require('ffprobe-static').path;
    const info = [], lintErr = [];
    for (const r of S.reels) {
      const dir = path.join(ROOT, 'output', 'reels', `reel${r.rank}_${r.id}`);
      const f = path.join(dir, 'reel.mp4');
      if (!fs.existsSync(f)) { info.push({ id: r.id, missing: true }); continue; }
      const j = JSON.parse(execFileSync(fp, ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate:format=duration', '-of', 'json', f]).toString());
      const v = j.streams.find((s) => s.codec_type === 'video'), a = j.streams.find((s) => s.codec_type === 'audio');
      info.push({ id: r.id, w: v.width, h: v.height, fps: v.r_frame_rate, codec: v.codec_name, audio: a ? a.codec_name : null, dur: +(+j.format.duration).toFixed(1) });
      const txt = fs.readFileSync(path.join(dir, 'suggestions.txt'), 'utf8');
      const grab = (h) => { const i = txt.indexOf(h + '\n'); return txt.slice(i + h.length + 1).split('\n\n')[0].trim(); };
      const sObj = { title: grab('TITLU:'), description: grab('DESCRIERE:'), tags: grab('TAGURI:').split(',').map((x) => x.trim()) };
      lintErr.push(...lintSuggestion(sObj, playerNames).map((e) => `${r.id}: ${e}`));
    }
    check('ffprobe: 3 reels, 1080x1920, 30 fps, h264 + aac, 30..60 s', info.length === 3 && info.every((x) => x.w === 1080 && x.h === 1920 && x.fps === '30/1' && x.codec === 'h264' && x.audio === 'aac' && x.dur >= 30 && x.dur <= 60), info);
    check('suggestions.txt of every reel passes the lint (SIMULATION, no player names, no official names)', lintErr.length === 0, lintErr);
    const ln = spawnSync(require('ffmpeg-static'), ['-hide_banner', '-i', path.join(ROOT, 'output', 'reels', `reel1_${S.reels[0].id}`, 'reel.mp4'), '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
    const I = +(((ln.stderr.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop() || '').match(/-?[\d.]+/) || [NaN])[0];
    check('reel loudness about -14 LUFS (+-1.5)', Math.abs(I + 14) <= 1.5, { I });
  }
  console.log(`\nP3: ${pass}/${pass + fail} checks passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
