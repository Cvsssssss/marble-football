'use strict';
// Playwright driver. Usage (all accept --show build/show.json):
//   node render/render.js stills [dir]          -> key moments (auto-detected) as PNG
//   node render/render.js frames 10,200,.. [dir] -> <dir or build/check>/f_<n>.png
//   node render/render.js video [workers]       -> build/video_noaudio.mp4 (parallel chunks, concatenated)
//   node render/render.js bracket16 <png>       -> empty 16-team symmetric bracket (layout check)
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright');
const ffmpeg = require('ffmpeg-static');
const ROOT = path.join(__dirname, '..');
const argIdx = process.argv.indexOf('--show');
const showPath = argIdx > 0 ? path.resolve(process.argv[argIdx + 1]) : path.join(ROOT, 'build', 'show.json');
if (argIdx > 0) process.argv.splice(argIdx, 2);

async function openPage(browser, show) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto('file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((d) => window.initRenderer(d), show);
  return page;
}
const b64 = (s) => Buffer.from(s.slice(s.indexOf(',') + 1), 'base64');

// ---- key moment detection (global frame numbers) ----
function keyMoments(show) {
  const out = [];
  const segOf = (type, pred) => show.segments.find((s) => s.type === type && (!pred || pred(s)));
  const mSeg = (mi) => segOf('match', (s) => s.match === mi);
  const firstEv = (mi, type, pred) => show.matches[mi].events.find((e) => e.type === type && (!pred || pred(e)));
  const ev = (mi, e, dv) => mSeg(mi).start + Math.round(e.vf + (dv || 0) * 30);           // event + dv seconds of video
  const gt = (mi, t) => { const F = show.matches[mi].frames; let i = 0; while (i < F.length - 1 && F[i].t < t) i++; return mSeg(mi).start + i; };
  out.push(['01_intro', segOf('intro').start + 120]);
  out.push(['02_bracket_intro', segOf('bracket', (s) => s.step === 0).start + 90]);
  out.push(['03_kickoff_card', segOf('matchPre', (s) => s.match === 0).start + 20]);
  out.push(['04_kickoff', mSeg(0).start + 3]);
  const pop = firstEv(0, 'pop', (e) => e.t > 2); out.push(['05_ball_leaving_outlet', ev(0, pop, 0.12)]);
  const mill = firstEv(0, 'mill', (e) => e.t > 2); out.push(['06_windmill_hit', ev(0, mill, 0.02)]);
  const m0 = show.matches[0]; const s0 = mSeg(0);
  let crouchF = null, jumpF = null, best = 0;
  for (let i = 300; i < m0.frames.length; i++) {
    const k = m0.frames[i].k;
    if (!crouchF && k[3] === 0 && k[1] > 0.9 && k[2] < 0.05) crouchF = i;
    if (k[3] === 1 && i < 900 && (560 - k[0]) > best) { best = 560 - k[0]; jumpF = i; }
  }
  out.push(['07_keeper_crouched', s0.start + crouchF]);
  out.push(['08_keeper_jumping', s0.start + jumpF]);
  // goal moment: 3 moments of the animation (in, full, out)
  const gl = firstEv(0, 'goal');
  out.push(['09a_goal_banner_in', ev(0, gl, 0.2)]);
  out.push(['09b_goal_banner_full', ev(0, gl, 0.7)]);
  out.push(['09c_goal_banner_out', ev(0, gl, 1.85)]);
  for (let mi = 0; mi < show.matches.length; mi++) { const e = firstEv(mi, 'bar'); if (e) { out.push(['10_crossbar_hit', ev(mi, e)]); break; } }
  out.push(['10b_windmill_boosted_80min', gt(0, 80 / show.cfg.GAME_MIN_PER_SEC)]);
  // 90': pitch cleared, +N banner
  const reg = firstEv(0, 'whistle', (e) => e.kind === 'reg');
  out.push(['20a_90min_clearing_pitch', ev(0, reg, 0.6)]);
  const add = firstEv(0, 'added');
  out.push(['20b_added_time_banner', ev(0, add, 0.6)]);
  // added-time shots: good hit (before / during / after) and a miss
  let cineDone = false, missDone = false, addGoalDone = false;
  show.matches.forEach((m, mi) => {
    (m.cines || []).forEach((c) => {
      if (cineDone) return; cineDone = true;
      const ci = m.events.find((e) => e.type === 'cine_in' && e.k === c.k), co = m.events.find((e) => e.type === 'cine_out' && e.k === c.k);
      out.push(['21a_good_hit_before', ev(mi, ci, -0.25)]);
      out.push(['21b_good_hit_slowmo_zoom', ev(mi, ci, 1.1)]);
      out.push(['21c_good_hit_slowmo_late', ev(mi, ci, 2.0)]);
      if (co) out.push(['21d_good_hit_after', ev(mi, co, 0.9)]);
    });
    (m.shots || []).forEach((sh) => {
      if (missDone || sh.cine) return; missDone = true;
      const se = m.events.find((e) => e.type === 'shot' && e.k === sh.k);
      out.push(['22a_miss_no_effects', ev(mi, se, 0.9)]);
      out.push(['22b_miss_no_effects_later', ev(mi, se, 1.6)]);
    });
    m.goals.forEach((g) => {
      if (addGoalDone || !g.shot) return; addGoalDone = true;
      const ge = m.events.find((e) => e.type === 'goal' && Math.abs(e.t - g.t) < 1e-3);
      out.push(['23_added_time_goal', ev(mi, ge, 0.7)]);
    });
  });
  const gm = show.matches.findIndex((m) => m.goldenStart !== null);
  if (gm >= 0) {
    const gb = firstEv(gm, 'golden'), gg = firstEv(gm, 'goal', (e) => e.golden);
    out.push(['11_golden_ball_banner', ev(gm, gb, 0.8)]);
    out.push(['11b_golden_clock_frozen_late', Math.min(ev(gm, gg, -0.3), ev(gm, gb, 8))]);
    out.push(['12a_golden_goal_shockwave', ev(gm, gg, 0.35)]);
    out.push(['12b_golden_goal_title', ev(gm, gg, 1.1)]);
    out.push(['12c_golden_goal_rain', ev(gm, gg, 2.2)]);
  }
  out.push(['13_replay', segOf('replay').start + 30]);
  out.push(['13b_replay_caption', segOf('replay').start + 60]);
  out.push(['13c_man_of_the_match', segOf('motm').start + 45]);
  out.push(['13d_motm_final', segOf('motm', (s) => s.match === 4).start + 45]);
  out.push(['15a_bracket_sf1_advancing', segOf('bracket', (s) => s.step === 2).start + 45]);
  out.push(['14_fulltime_leg2', segOf('fulltime', (s) => s.match === 1).start + 40]);
  out.push(['15_bracket_after_sf1', segOf('bracket', (s) => s.step === 2).start + 100]);
  out.push(['16_bracket_finalists', segOf('bracket', (s) => s.step === 5).start + 90]);
  out.push(['17_final_match', mSeg(4).start + 600]);
  out.push(['18_final_screen_podium', segOf('winner').start + 150]);
  out.push(['18b_final_screen_end', segOf('winner').start + 235]);
  out.push(['19_leg2_hud', mSeg(1).start + 700]);
  return out;
}

async function stills(list, dir) {
  const show = JSON.parse(fs.readFileSync(showPath, 'utf8'));
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const page = await openPage(browser, show);
  const items = list === 'auto' ? keyMoments(show).filter(([, f]) => Number.isFinite(f)) : list.map((n) => ['f_' + n, n]);
  for (const [name, f] of items) {
    const png = await page.evaluate((gg) => window.grabPNG(gg), f);
    fs.writeFileSync(path.join(dir, name + '.png'), b64(png));
    console.log(name, f);
  }
  await browser.close();
}

async function video(workers) {
  const show = JSON.parse(fs.readFileSync(showPath, 'utf8'));
  const total = show.totalFrames;
  const segDir = path.join(ROOT, 'build', 'segments');
  fs.rmSync(segDir, { recursive: true, force: true }); fs.mkdirSync(segDir, { recursive: true });
  const browser = await chromium.launch();
  const chunk = Math.ceil(total / workers);
  const t0 = Date.now();
  let done = 0;
  const jobs = [];
  for (let w = 0; w < workers; w++) {
    const a = w * chunk, b = Math.min(total, a + chunk);
    if (a >= b) break;
    jobs.push((async () => {
      const page = await openPage(browser, show);
      const out = path.join(segDir, 'seg_' + String(w).padStart(2, '0') + '.mp4');
      const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-g', '60', out], { stdio: ['pipe', 'inherit', 'inherit'] });
      const closed = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
      for (let gg = a; gg < b; gg++) {
        const jpg = await page.evaluate((x) => window.grabFrame(x, 0.93), gg);
        if (!ff.stdin.write(b64(jpg))) await new Promise((r) => ff.stdin.once('drain', r));
        done++;
        if (done % 300 === 0) { const el = (Date.now() - t0) / 1000; console.log('frames ' + done + '/' + total + '  ' + el.toFixed(0) + 's  eta ' + ((total - done) * el / done).toFixed(0) + 's'); }
      }
      ff.stdin.end(); await closed; await page.close();
      return out;
    })());
  }
  const outs = await Promise.all(jobs);
  await browser.close();
  const list = path.join(segDir, 'list.txt');
  fs.writeFileSync(list, outs.map((o) => "file '" + o.replace(/\\/g, '/') + "'").join('\n'));
  const dst = path.join(ROOT, 'build', 'video_noaudio.mp4');
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', dst]);
  console.log('video done', dst, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}

async function bracket16(out, n, style) {
  const show = JSON.parse(fs.readFileSync(showPath, 'utf8'));
  const browser = await chromium.launch();
  const page = await openPage(browser, show);
  const png = await page.evaluate(([k, st]) => window.renderEmptyBracket(k, null, st), [n, style || null]);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, b64(png));
  await browser.close();
  console.log('bracket written', out);
}

// both bracket styles for 4 teams (demo data, finalists step) and 16 teams (empty) -> <dir>/bracket_*.png
async function brackets(dir) {
  const show = JSON.parse(fs.readFileSync(showPath, 'utf8'));
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const page = await openPage(browser, show);
  const files = [];
  for (const st of ['left_to_right', 'symmetric']) {
    const a = await page.evaluate(([x]) => window.renderDemoBracket(5, x, 90), [st]);
    fs.writeFileSync(path.join(dir, `bracket4_${st}.png`), b64(a)); files.push(`bracket4_${st}.png`);
    const a2 = await page.evaluate(([x]) => window.renderDemoBracket(2, x, 45), [st]);
    fs.writeFileSync(path.join(dir, `bracket4_${st}_advancing.png`), b64(a2)); files.push(`bracket4_${st}_advancing.png`);
    const b = await page.evaluate(([x]) => window.renderEmptyBracket(16, null, x), [st]);
    fs.writeFileSync(path.join(dir, `bracket16_${st}.png`), b64(b)); files.push(`bracket16_${st}.png`);
  }
  await browser.close();
  console.log('brackets written', files.join(', '));
}

(async () => {
  const mode = process.argv[2];
  if (mode === 'stills') await stills('auto', path.resolve(ROOT, process.argv[3] || 'output/screenshots_v2'));
  else if (mode === 'frames') await stills(process.argv[3].split(',').map(Number), path.resolve(ROOT, process.argv[4] || 'build/check'));
  else if (mode === 'bracket16') await bracket16(path.resolve(ROOT, process.argv[3] || 'output/screenshots_v2/bracket16_empty.png'), +(process.argv[4] || 16), process.argv[5]);
  else if (mode === 'brackets') await brackets(path.resolve(ROOT, process.argv[3] || 'output/screenshots_v2b'));
  else if (mode === 'video') await video(+process.argv[3] || 8);
  else { console.log('usage: stills [dir] | frames a,b,c | video [workers]'); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
