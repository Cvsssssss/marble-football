'use strict';
// P3 A / P6: ONE vertical reel (YouTube Shorts) per long video, static full-pitch layout.
//   npm run reels -- --competition config/competitions/ucl_2026_top16.json [--map <theme>] [--only 1] [--fast] [--out-dir <dir>]
// Same config + seed cache as the long video -> the reel replays the identical match (same seed, same timeline hash).
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn, spawnSync } = require('child_process');
const L = require('./sim/config_loader');
const TOUR = require('./sim/tournament');
const { selectReel } = require('./sim/selectReels');
const { buildReel, TARGET_MAX } = require('./sim/reels');
const ffmpeg = require('ffmpeg-static');

const ROOT = __dirname;
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const compFile = path.resolve(arg('--competition', path.join('config', 'competitions', 'ucl_2026_top16.json')));
const MAP = arg('--map', undefined);
const ONLY = arg('--only', null);
const FAST = process.argv.includes('--fast'); // quicker encode for tests
const NO_RENDER = process.argv.includes('--no-render'); // P5: selection + suggestions + reel_info only (no video)
const OUT = path.resolve(arg('--out-dir', path.join(ROOT, 'output', 'reels'))); // P4: run folder <run>/reels
const BUILD = path.join(ROOT, 'build', 'reels');

// words that must never appear in suggested titles / descriptions / tags (official names, CLAUDE.md)
const BANNED = ['champions league', 'europa league', 'conference league', 'uefa', 'fifa', 'world cup', 'euro 20', 'nations league', 'premier league', 'la liga', 'serie a', 'bundesliga', 'ligue 1'];

function suggestions(conf, sel, r, show) {
  const comp = conf.competition.name;
  const m = show.matches[r.index];
  const winner = r.winner || '';
  const loser = winner === r.team_a ? r.team_b : r.team_a;
  const depth = r.comeback_depth;
  const title = `${winner} come back from ${depth} down vs ${loser}! Marble football ${comp} | SIMULATION`;
  const desc = [
    `${comp} ${r.stage.toLowerCase()} (${r.leg.toLowerCase()}): ${r.team_a} ${r.score[0]}–${r.score[1]} ${r.team_b}${r.aggregate ? ` (aggregate ${r.aggregate[0]}–${r.aggregate[1]})` : ''}.`,
    'This is a computer simulation (marble football physics), not a real match and not real results.',
    'Full simulated tournament on the channel: [link to the long video].',
    `Team names are used as plain text for an unofficial fan simulation.`,
  ].join('\n');
  const tags = [...new Set([r.team_a, r.team_b, 'marble football', 'marble race', 'football simulation', 'comeback', comp.toLowerCase()])];
  return { title, description: desc, tags, publish: `Reel ${r.rank}: publish after the long video (PLAN.md §3: max 2 reels per day) — suggested day +${Math.ceil(r.rank / 2) - 1} after the long video, ${r.rank % 2 ? '12:00' : '19:00'} (Copenhagen time).`, matchId: r.id, motm: m.motm ? 'see video' : '' };
}
function lintSuggestion(s, playerNames) {
  const all = [s.title, s.description, ...s.tags].join('\n');
  const low = all.toLowerCase();
  const errs = [];
  if (!/\| SIMULATION$/.test(s.title)) errs.push('title must end with "| SIMULATION"');
  if (!/computer simulation/i.test(s.description) || !/not real results/i.test(s.description)) errs.push('description must say computer simulation, not real results');
  for (const b of BANNED) if (low.includes(b)) errs.push(`banned word: ${b}`);
  for (const n of playerNames) { const sur = n.split(' ').slice(-1)[0]; if (all.includes(n) || (sur.length > 3 && new RegExp(`\\b${sur}\\b`).test(all))) errs.push(`player name: ${n}`); }
  return errs;
}
function suggestionsTxt(s, r, why) {
  return [
    'SUGESTII (opțional) — Max scrie titlul și descrierea lui. Regulă: fără nume de jucători, fără nume oficiale, menționează că e simulare pe calculator, nu rezultate reale (pe ecran nu mai e etichetă). La încărcare verifică întrebarea YouTube despre conținut modificat/sintetic.',
    '', 'TITLU:', s.title, '', 'DESCRIERE:', s.description, '', 'TAGURI:', s.tags.join(', '), '',
    'ORDINE / ORĂ PUBLICARE:', s.publish, '', `De ce a fost ales meciul: ${why}`, `Meci în videoul lung: ${r.long_video.match_start_s}s – ${r.long_video.match_end_s}s`, '',
  ].join('\n');
}

async function renderReel(show, reel, dst) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto('file:///' + path.join(ROOT, 'render', 'index.html').replace(/\\/g, '/'));
  await page.evaluate(() => document.fonts.ready);
  const s2 = Object.assign({}, show, { outSize: [1080, 1920] });
  await page.evaluate((j) => window.initRenderer(JSON.parse(j)), JSON.stringify(s2));
  await page.evaluate((j) => window.initReel(JSON.parse(j)), JSON.stringify(reel));
  const enc = FAST ? ['-preset', 'veryfast', '-crf', '24'] : ['-preset', 'medium', '-crf', '18'];
  const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', ...enc, '-pix_fmt', 'yuv420p', '-r', '30', '-g', '60', dst], { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  for (let k = 0; k < reel.totalFrames; k++) {
    const jpg = await page.evaluate(([x]) => window.grabReelFrame(x, 0.93), [k]);
    if (!ff.stdin.write(Buffer.from(jpg.slice(jpg.indexOf(',') + 1), 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await closed;
  await browser.close();
}
function mux(video, wav, out) {
  const p1 = spawnSync(ffmpeg, ['-hide_banner', '-i', wav, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = JSON.parse(p1.stderr.slice(p1.stderr.lastIndexOf('{')));
  const af = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo`;
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', video, '-i', wav, '-af', af, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
}

async function main() {
  let conf;
  try { conf = L.loadCompetition(compFile, { map: MAP }); } catch (e) { if (e instanceof L.ConfigError) { console.error(e.message); process.exit(2); } throw e; }
  fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(BUILD, { recursive: true });
  const showFile = path.join(BUILD, 'show.json');
  const { show } = TOUR.buildAll(compFile, showFile, { map: MAP });
  const index = TOUR.matchesIndex(show);
  // P8: only matches whose reel (whole match at normal speed + shortened extras) fits <= 59 s are candidates; a longer one is skipped, never sped up
  const fitIndex = Object.assign({}, index, { matches: index.matches.filter((m) => !m.goals.length || buildReel(show, m.index).fits) });
  const sel = selectReel(fitIndex);
  // exactly one reel per run: folders of earlier reels (P3-P5 made three) are removed from this run's reels/ folder
  for (const d of fs.readdirSync(OUT)) if (/^reel/.test(d) && fs.statSync(path.join(OUT, d)).isDirectory() && (!sel.reels[0] || d !== `reel_${sel.reels[0].id}`)) fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
  fs.writeFileSync(path.join(OUT, 'selection.json'), JSON.stringify(sel, null, 1));
  console.log(`selection: ${sel.reels.length} reel (comeback candidates ${sel.candidates}${sel.fallback ? ', FALLBACK latest winning goal' : ''})`);
  const playerNames = show.teams.flatMap((t) => t.players.map((p) => p.name));
  const report = [];
  for (const r of sel.reels) {
    if (ONLY && String(r.rank) !== String(ONLY)) continue;
    const reel = buildReel(show, r.index);
    const dir = path.join(OUT, `reel_${r.id}`); fs.mkdirSync(dir, { recursive: true });
    const rj = path.join(BUILD, `reel${r.rank}.json`); fs.writeFileSync(rj, JSON.stringify(reel));
    const t0 = Date.now();
    const out = path.join(dir, 'reel.mp4');
    if (!NO_RENDER) {
    const vid = path.join(BUILD, `reel${r.rank}_noaudio.mp4`), wav = path.join(BUILD, `reel${r.rank}.wav`);
    // render cache: the silent video is reused when the reel timeline and the renderer are unchanged
    const key = require('crypto').createHash('sha256').update(JSON.stringify(reel)).update(fs.readFileSync(path.join(ROOT, 'render', 'draw.js'))).update(fs.readFileSync(path.join(ROOT, 'render', 'art_pro.js'))).digest('hex').slice(0, 16);
    const keyF = vid + '.key';
    if (!(fs.existsSync(vid) && fs.existsSync(keyF) && fs.readFileSync(keyF, 'utf8') === key)) { await renderReel(show, reel, vid); fs.writeFileSync(keyF, key); }
    else console.log(`reel ${r.rank}: video unchanged, reused`);
    execFileSync(process.platform === 'win32' ? 'python' : 'python3', [path.join(ROOT, 'audio', 'make_audio.py'), rj, wav], { stdio: ['ignore', 'ignore', 'inherit'] });
    mux(vid, wav, out);
    } else if (fs.existsSync(out)) fs.rmSync(out); // a stale video of another timeline must not stay next to new info
    // P6: the reel title / description are written by generate.js into <run>/publish/ (sim/publish.js)
    const stale = path.join(dir, 'suggestions.txt'); if (fs.existsSync(stale)) fs.rmSync(stale);
    fs.writeFileSync(path.join(dir, 'reel_info.json'), JSON.stringify({ rank: r.rank, id: r.id, rendered: !NO_RENDER, seconds: reel.seconds, seed: reel.seed, timeline_hash: reel.timeline_hash,
      ffStretches: reel.ffStretches, segments: reel.segments.map((x) => ({ type: x.type, start: x.start, len: x.len })) }, null, 1));
    report.push(`${r.rank}. ${r.id} ${r.team_a} vs ${r.team_b} -> ${NO_RENDER ? path.relative(ROOT, dir) + ' (info only, not rendered)' : path.relative(ROOT, out)} (${reel.seconds}s, ${((Date.now() - t0) / 1000).toFixed(0)}s build)`);
    console.log(report[report.length - 1]);
  }
  console.log('reels done');
}
module.exports = { suggestions, lintSuggestion, BANNED, renderReel, mux }; // P7: renderReel + mux reused by build_matchweek.js
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
