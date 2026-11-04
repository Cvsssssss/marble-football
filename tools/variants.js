'use strict';
// P3 B.5 variant test (config only): 4 map themes x 2 competitions.
//   node tools/variants.js            -> output/screenshots_f04/variants.png (contact sheet) + one 720p one-match preview per theme
//   node tools/variants.js --no-video -> contact sheet only
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const TOUR = require('../sim/tournament');
const ffmpeg = require('ffmpeg-static');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'output', 'screenshots_f04');
const THEMES = ['sky_clean', 'stadium_day', 'stadium_night', 'sunset'];
const COMPS = ['uel_top16', 'nations_world_16'];
const PREVIEW_COMP = { sky_clean: 'uel_top16', stadium_day: 'nations_world_16', stadium_night: 'uel_top16', sunset: 'nations_world_16' };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('file:///' + path.join(ROOT, 'render', 'index.html').replace(/\\/g, '/'));
  await page.evaluate(() => document.fonts.ready);
  const tiles = [];
  for (const comp of COMPS) for (const map of THEMES) {
    const { show } = TOUR.buildAll(path.join(ROOT, 'config', 'competitions', comp + '.json'), path.join(ROOT, 'build', `var_${comp}_${map}.json`), { map });
    show.outSize = [1280, 720];
    await page.evaluate((j) => window.initRenderer(JSON.parse(j)), JSON.stringify(show));
    const seg = show.segments.find((x) => x.type === 'match' && x.match === 0);
    const m = show.matches[0], g = m.goals[0];
    const f = seg.start + Math.round((g ? g.t : 10) * 30) + 20; // just after the first goal: banner + crest balls visible
    const png = await page.evaluate((x) => { window.renderFrame(x); return document.getElementById('c').toDataURL('image/png'); }, f);
    const tf = path.join(OUT, `${comp}__${map}.png`);
    fs.writeFileSync(tf, Buffer.from(png.split(',')[1], 'base64')); tiles.push(tf);
    if (!process.argv.includes('--no-video') && PREVIEW_COMP[map] === comp) {
      // one-match preview: pre-match card .. man of the match of match 0
      const segs = show.segments.filter((x) => x.match === 0);
      const a = segs[0].start, b = segs[segs.length - 1].start + segs[segs.length - 1].len;
      const dst = path.join(ROOT, 'build', `variant_${map}.mp4`);
      const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p', dst], { stdio: ['pipe', 'inherit', 'inherit'] });
      const closed = new Promise((res) => ff.on('close', res));
      for (let k = a; k < b; k++) {
        const jpg = await page.evaluate((x) => window.grabFrame(x, 0.85), k);
        if (!ff.stdin.write(Buffer.from(jpg.slice(jpg.indexOf(',') + 1), 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
      }
      ff.stdin.end(); await closed;
      // audio for exactly this window (same synth, theme music)
      const sub = Object.assign({}, show, { totalFrames: b - a, segments: segs.map((s) => Object.assign({}, s, { start: s.start - a })),
        audio: show.audio.filter((e) => e.t * 30 >= a && e.t * 30 < b).map((e) => Object.assign({}, e, { t: e.t - a / 30 })), reel: true });
      const sj = path.join(ROOT, 'build', `variant_${map}_show.json`), wav = path.join(ROOT, 'build', `variant_${map}.wav`);
      fs.writeFileSync(sj, JSON.stringify(sub));
      execFileSync('python', [path.join(ROOT, 'audio', 'make_audio.py'), sj, wav], { stdio: ['ignore', 'ignore', 'inherit'] });
      execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', dst, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', path.join(OUT, `preview_${map}_${comp}_720p.mp4`)]);
      console.log('preview', map, comp, ((b - a) / 30).toFixed(1) + 's');
    }
  }
  await browser.close();
  // contact sheet: rows = competitions, columns = themes
  const args = ['-y', '-loglevel', 'error'];
  tiles.forEach((t) => args.push('-i', t));
  const sc = tiles.map((_, i) => `[${i}]scale=640:360[t${i}]`).join(';');
  const lay = tiles.map((_, i) => `${(i % 4) * 640}_${Math.floor(i / 4) * 360}`).join('|');
  args.push('-filter_complex', `${sc};${tiles.map((_, i) => `[t${i}]`).join('')}xstack=inputs=${tiles.length}:layout=${lay}`, '-frames:v', '1', path.join(OUT, 'variants.png'));
  execFileSync(ffmpeg, args);
  console.log('contact sheet', path.relative(ROOT, path.join(OUT, 'variants.png')));
})().catch((e) => { console.error(e); process.exit(1); });
