'use strict';
// P7 §5/§6: one Premier League matchweek -> output/runs/<date>_premier_league_mwNN_<map>[_preview][_dryrun]/
//   node build_matchweek.js --week N [--dir <season folder>] [--map <id>] [--preview] [--workers N] [--no-reels] [--dry-run] [--date YYYY-MM-DD]
// Called by `league.js play` (START.bat -> 7) after the week's results are saved. Results come from
// league/<id>/results/week_NN.json; the matches are re-simulated from their seeds (same timeline hash, checked).
// Steps: show (matchweek + finale on week 38) -> audio -> video (render cache) -> mux -> chapters / LOGO_USAGE
//        -> 1 reel -> publish/ texts (no thumbnails) -> run.json -> PUBLISH_CHECKLIST.md -> preflight.
// --dry-run: everything except audio / video / reel video (P5 rehearsal; no history entry, output/latest unchanged).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const LC = require('./sim/league/config');
const SEASON = require('./sim/league/season');
const SH = require('./sim/league/show');
const LP = require('./sim/league/publish');
const ROOT = __dirname;
const node = process.execPath;
const py = process.platform === 'win32' ? 'python' : 'python3';
class RunError extends Error {}
const ACCENTS = ['#2FD3C4', '#7A5CFF', '#FF8C42', '#E84A7F', '#3FA7FF', '#9BD64A', '#F2C230'];

function step(i, n, msg, t0) { console.log(`\n[${i}/${n}] ${msg}   (${((Date.now() - t0) / 60000).toFixed(1)} min de la start)`); }
function plan(opts) {
  const C = LC.loadLeague(opts.league);
  const wr = JSON.parse(fs.readFileSync(SEASON.resultsFile(C, opts.week, opts), 'utf8'));
  const map = opts.map || wr.map;
  const date = opts.date || require('./generate').copenhagenDate();
  const runName = `${date}_${C.league.id.replace(/_\d{4}_\d{2}$/, '')}_mw${String(opts.week).padStart(2, '0')}_${map}${opts.preview ? '_preview' : ''}${opts.dryRun ? '_dryrun' : ''}`;
  return { C, wr, map, date, runName, runDir: path.join(opts.outRoot || path.join(ROOT, 'output', 'runs'), runName), buildDir: path.join(ROOT, 'build', 'runs', runName) };
}
function fingerprintOf(show, P, accent) {
  const mu = show.map.music || {};
  return { id: P.runName, competition: show.league.id, competition_name: show.league.display_name, map: show.map.id, accent, colours: [accent, show.map.sky[1], show.map.windmill ? show.map.windmill[0] : '#e8553e'],
    music: `${mu.progression}/${mu.arp}/${mu.transpose}/${mu.bpm}/week${show.league.week}`, bracket: show.matches.map((m) => [show.teams[m.ta].id, show.teams[m.tb].id].sort().join('-')) };
}

async function buildMatchweek(opts) {
  const t0 = Date.now();
  const P = plan(opts);
  const { C } = P;
  const N = opts.noReels ? 7 : 8;
  fs.mkdirSync(P.runDir, { recursive: true }); fs.mkdirSync(P.buildDir, { recursive: true });
  console.log(`Rulare: ${path.relative(ROOT, P.runDir)}`);
  const run = (args, label, cmd) => { try { execFileSync(cmd || node, args, { stdio: 'inherit', cwd: ROOT }); } catch (e) { throw new RunError(`Pasul „${label}” a eșuat (cod ${e.status}).`); } };

  step(1, N, `Etapa ${opts.week}: re-simulare din semințele salvate + cronologia videoului`, t0);
  const show = SH.buildMatchweekShow(C, opts.week, { dir: opts.dir, map: P.map });
  const showF = path.join(P.buildDir, 'show.json');
  fs.writeFileSync(showF, JSON.stringify(show));
  const TOUR = require('./sim/tournament');
  const chapters = TOUR.chaptersText(show);
  fs.writeFileSync(path.join(P.runDir, 'chapters.txt'), chapters);
  const idx = SH.matchesIndexLeague(show);
  fs.writeFileSync(path.join(P.buildDir, 'matches_index.json'), JSON.stringify(idx, null, 1));
  const LOGOS = require('./sim/logos');
  fs.writeFileSync(path.join(P.runDir, 'LOGO_USAGE.md'), LOGOS.logoUsageMd({ competition: { name: `${C.league.display_name} ${C.league.season} matchweek ${opts.week}` }, rules: C.rules, teams: C.teams }, show.logosMissing));
  console.log(`durată: ${(show.totalFrames / show.fps / 60).toFixed(1)} min · hartă: ${show.map.id}${show.background ? ' (imaginea ta de fundal)' : ' (stadion procedural)'}${show.league.finale ? ' · FINALA SEZONULUI' : ''}`);

  const videoFile = opts.preview ? 'long_video_preview_720p.mp4' : 'long_video_1080p.mp4';
  if (!opts.dryRun) {
    step(2, N, 'Audio (sintetizat, original)', t0);
    run([path.join('audio', 'make_audio.py'), showF, path.join('build', 'audio_raw.wav')], 'audio', py);
    step(3, N, 'Video lung (cache: blocurile deja randate sunt refolosite)', t0);
    run(['render/render.js', 'video', String(opts.workers || Math.max(2, Math.min(10, require('os').cpus().length - 2))), '--show', showF].concat(opts.preview ? ['--preview'] : []), 'video lung');
    run(['render/mux.js', '--out', path.join(P.runDir, videoFile), '--shots', path.join(P.buildDir, 'shots'), '--video', path.join('build', opts.preview ? 'video_noaudio_preview.mp4' : 'video_noaudio.mp4')].concat(opts.preview ? ['--tag', 'preview'] : []), 'mux');
  } else { step(2, N, 'Audio: sărit (repetiție)', t0); step(3, N, 'Video: sărit (repetiție)', t0); }

  let reelSel = null; const reelsInfo = [];
  if (!opts.noReels) {
    step(4, N, 'Reel vertical (1: cea mai bună revenire a etapei / cel mai târziu gol decisiv / cele mai multe goluri)', t0);
    const { buildReel } = require('./sim/reels');
    const sel = LP.selectLeagueReel(show, idx);
    const rdir = path.join(P.runDir, 'reels'); fs.mkdirSync(rdir, { recursive: true });
    for (const d of fs.readdirSync(rdir)) if (/^reel/.test(d) && (!sel.reels[0] || d !== `reel_${sel.reels[0].id}`)) fs.rmSync(path.join(rdir, d), { recursive: true, force: true });
    fs.writeFileSync(path.join(rdir, 'selection.json'), JSON.stringify(sel, null, 1));
    for (const r of sel.reels) {
      const reel = buildReel(show, r.index, LP.REEL_OPTS);
      const dir = path.join(rdir, `reel_${r.id}`); fs.mkdirSync(dir, { recursive: true });
      if (!opts.dryRun) {
        const BR = require('./build_reels');
        const rj = path.join(P.buildDir, 'reel.json'), vid = path.join(P.buildDir, 'reel_noaudio.mp4'), wav = path.join(P.buildDir, 'reel.wav');
        fs.writeFileSync(rj, JSON.stringify(reel));
        const key = crypto.createHash('sha256').update(JSON.stringify(reel)).update(fs.readFileSync(path.join(ROOT, 'render', 'draw.js'))).update(fs.readFileSync(path.join(ROOT, 'render', 'art_pro.js'))).update(show.background ? show.background.hash : '').digest('hex').slice(0, 16);
        if (!(fs.existsSync(vid) && fs.existsSync(vid + '.key') && fs.readFileSync(vid + '.key', 'utf8') === key)) { await BR.renderReel(show, reel, vid); fs.writeFileSync(vid + '.key', key); }
        run([path.join('audio', 'make_audio.py'), rj, wav], 'audio reel', py);
        BR.mux(vid, wav, path.join(dir, 'reel.mp4'));
      }
      const info = { rank: 1, id: r.id, rendered: !opts.dryRun, seconds: reel.seconds, seed: reel.seed, timeline_hash: reel.timeline_hash, ffStretches: 0, speed: 1, extras: reel.extras,
        segments: reel.segments.map((x) => ({ type: x.type, start: x.start, len: x.len })) };
      fs.writeFileSync(path.join(dir, 'reel_info.json'), JSON.stringify(info, null, 1));
      reelsInfo.push(Object.assign({ dir: `reels/reel_${r.id}`, sel: r }, info));
      reelSel = r;
    }
  }

  step(opts.noReels ? 4 : 5, N, 'Texte de publicare (publish/) — fără thumbnail-uri (le faci tu)', t0);
  const PUB = require('./sim/publish');
  const pub = LP.buildLeaguePublish(show, chapters, reelSel);
  const errs = LP.lintLeaguePublish(pub, show);
  if (errs.length) throw new RunError('Textele de publicare nu trec verificarea: ' + errs.join('; '));
  PUB.writePublish(path.join(P.runDir, 'publish'), pub, { thumbnails: false });

  step(opts.noReels ? 5 : 6, N, 'run.json + PUBLISH_CHECKLIST.md', t0);
  const accent = ACCENTS[(opts.week - 1) % ACCENTS.length];
  const fp = fingerprintOf(show, P, accent);
  const runJson = {
    run: P.runName, created: new Date().toISOString(), date: P.date, quality: opts.preview ? 'preview_720p' : 'final_1080p',
    competition: { id: C.league.id, name: C.league.display_name, file: path.relative(ROOT, C.file).replace(/\\/g, '/') },
    league: { id: C.league.id, display_name: C.league.display_name, season: C.league.season, week: opts.week, finale: show.league.finale, results_hash: P.wr.results_hash, background: show.background ? show.background.file : null },
    map: show.map.id, accent, forced_pair: null, slot: null, configHash: show.configHash, simHash: show.simHash, music: fp.music,
    long_video: { file: videoFile, seconds: +(show.totalFrames / show.fps).toFixed(2) },
    matches: idx.matches.map((m) => ({ id: m.id, stage: m.stage, leg: m.leg, team_a: m.team_a, team_b: m.team_b, seed: m.seed, timeline_hash: m.timeline_hash, score: m.score })),
    champion: show.league.finale ? show.teams[show.champion].name : null, reels: reelsInfo.map((r) => ({ dir: r.dir, seconds: r.seconds, seed: r.seed, timeline_hash: r.timeline_hash })),
    dry_run: !!opts.dryRun, thumbnails: false, show_simulation_label: show.cfg.SHOW_SIM_LABEL === true, bracket_r16: [], fingerprint: fp, build_minutes: +((Date.now() - t0) / 60000).toFixed(1),
  };
  fs.writeFileSync(path.join(P.runDir, 'run.json'), JSON.stringify(runJson, null, 1) + '\n');
  require('./sim/checklist').writeChecklist(P.runDir, runJson);
  if (!opts.dryRun && !opts.noHistory) {
    const hf = path.join(ROOT, 'plan', 'history.json');
    const h = fs.existsSync(hf) ? JSON.parse(fs.readFileSync(hf, 'utf8')) : { runs: [] };
    const entry = { run: P.runName, generated_at: runJson.created, competition: C.league.id, map: show.map.id, accent, quality: runJson.quality, status: 'generated', forced_pair: null, fingerprint: fp, published_long: null, published_reels: [] };
    const old = h.runs.find((r) => r.run === P.runName); if (old) Object.assign(old, entry, { status: old.status === 'published' ? 'published' : 'generated' }); else h.runs.push(entry);
    fs.writeFileSync(hf, JSON.stringify(h, null, 1) + '\n');
    if (!opts.preview) PUB.recordTitles(pub.longTitles.concat(pub.reelTitles));
  }

  step(opts.noReels ? 6 : 7, N, 'Preflight (verificări automate)', t0);
  const pf = require('./preflight').preflight(P.runDir);
  step(N, N, 'Gata', t0);
  console.log(`\nRezultat: ${P.runDir}\nPreflight: ${pf.ok ? 'VERDE' : 'ROȘU (' + pf.red + ' probleme) — vezi PREFLIGHT.md'}\nTimp total: ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  return { runDir: P.runDir, preflight: pf, runJson, show };
}

module.exports = { buildMatchweek, plan, RunError };
if (require.main === module) {
  const argv = process.argv.slice(2);
  const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const has = (n) => argv.includes(n);
  buildMatchweek({ week: +arg('--week'), dir: arg('--dir', process.env.MARBLE_LEAGUE_DIR || undefined), map: arg('--map'), preview: has('--preview'), workers: arg('--workers'),
    noReels: has('--no-reels'), dryRun: has('--dry-run'), date: arg('--date'), league: arg('--league') })
    .then((r) => process.exit(r.preflight.ok ? 0 : 3))
    .catch((e) => {
      const logF = path.join(ROOT, 'logs', 'matchweek_last.log');
      fs.mkdirSync(path.dirname(logF), { recursive: true }); fs.writeFileSync(logF, String(e && e.stack || e));
      console.error(`\nEROARE: ${e instanceof RunError || e instanceof SEASON.LeagueError ? e.message : 'eroare neașteptată: ' + e.message}\nDetalii în: ${logF}\nPoți relua aceeași comandă: ce s-a randat deja este refolosit.`);
      process.exit(1);
    });
}
