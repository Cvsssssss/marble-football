'use strict';
// P4: one complete run -> output/runs/<YYYY-MM-DD>_<competition>_<map>[_preview]/
//   npm run generate -- --competition config/competitions/uel_top16.json --map stadium_day [--forced-pair "Benfica vs Juventus"]
//                       [--forced-round R16|QF] [--preview] [--no-reels] [--rerender-match <match id, e.g. R16-T1-L2>] [--date YYYY-MM-DD]
//                       [--match-day YYYY-MM-DD --fixture "A vs B"]  (strong real match slot from `npm run next`: publish D-1 evening)
// Steps: tournament + long video (build_all.js, render cache) -> 3 reels -> 3 thumbnails -> run.json -> checklist -> preflight.
// Safe to interrupt: re-running the same command resumes from the seed cache, the block render cache and the reel cache.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const L = require('./sim/config_loader');

const ROOT = __dirname;
const node = process.execPath;
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);

function copenhagenDate(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d || new Date()); }
function resolveTeam(comp, name) {
  const n = name.trim().toLowerCase();
  for (const id of comp.teams) {
    const t = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'teams', id + '.json'), 'utf8'));
    if ([t.id, t.name, t.short_name, t.short].filter(Boolean).some((x) => x.toLowerCase() === n)) return id;
  }
  return null;
}
class RunError extends Error {}

function planRun(opts) {
  const compFile = path.resolve(ROOT, opts.competition);
  if (!fs.existsSync(compFile)) throw new RunError(`Fișierul competiției nu există: ${opts.competition}`);
  const comp = JSON.parse(fs.readFileSync(compFile, 'utf8'));
  const map = opts.map || comp.map;
  if (!fs.existsSync(path.join(ROOT, 'config', 'maps', map + '.json'))) throw new RunError(`Tema de hartă nu există: ${map} (vezi config/maps/)`);
  let forced = [];
  if (opts.forcedPair) {
    const parts = opts.forcedPair.split(/\s+vs\.?\s+|\s*-\s*/i);
    if (parts.length !== 2) throw new RunError(`Perechea forțată trebuie scrisă "Echipa A vs Echipa B" (ai scris: ${opts.forcedPair})`);
    const a = resolveTeam(comp, parts[0]), b = resolveTeam(comp, parts[1]);
    if (!a || !b) throw new RunError(`Echipa ${!a ? parts[0] : parts[1]} nu este în ${comp.name}. Echipe: ${comp.teams.join(', ')}`);
    forced = [{ a, b, round: opts.forcedRound || 'R16' }];
  }
  const date = opts.date || copenhagenDate();
  const runName = `${date}_${comp.id}_${map}${opts.preview ? '_preview' : ''}`;
  return { compFile, comp, map, forced, date, runName, runDir: path.join(ROOT, 'output', 'runs', runName), buildDir: path.join(ROOT, 'build', 'runs', runName) };
}

function step(i, n, msg, t0) { console.log(`\n[${i}/${n}] ${msg}   (${((Date.now() - t0) / 60000).toFixed(1)} min de la start)`); }

function linkLatest(runDir) {
  const latest = path.join(ROOT, 'output', 'latest');
  try { fs.rmSync(latest, { recursive: false, force: true }); } catch (e) { /* not a link */ }
  try { if (fs.existsSync(latest)) fs.rmSync(latest, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  try { fs.symlinkSync(runDir, latest, 'junction'); } catch (e) { fs.mkdirSync(latest, { recursive: true }); fs.writeFileSync(path.join(latest, 'LATEST.txt'), runDir + '\n'); }
}

function updateHistory(entry) {
  const f = path.join(ROOT, 'plan', 'history.json');
  const h = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { _comment: '', runs: [] };
  h._comment = 'Ce s-a generat / publicat. Actualizat de generator; Max poate edita: status "generated" | "published" | "discarded", published_long (data-ora), published_reels.';
  const old = h.runs.find((r) => r.run === entry.run);
  if (old) Object.assign(old, entry, { status: old.status === 'published' ? 'published' : entry.status, published_long: old.published_long || null, published_reels: old.published_reels || [] });
  else h.runs.push(Object.assign({ published_long: null, published_reels: [] }, entry));
  fs.writeFileSync(f, JSON.stringify(h, null, 1) + '\n');
}

function generate(opts) {
  const t0 = Date.now();
  const P = planRun(opts);
  const N = opts.noReels ? 6 : 7;
  fs.mkdirSync(P.runDir, { recursive: true }); fs.mkdirSync(P.buildDir, { recursive: true });
  console.log(`Run: ${path.relative(ROOT, P.runDir)}`);
  // run-specific competition file (theme, forced pair, output paths); the simulation hash ignores output paths
  const runComp = Object.assign({}, P.comp, {
    map: P.map, forced_pairs: P.forced,
    output: path.relative(ROOT, path.join(P.runDir, 'long_video_1080p.mp4')).replace(/\\/g, '/'),
    preview_output: path.relative(ROOT, path.join(P.runDir, 'long_video_preview_720p.mp4')).replace(/\\/g, '/'),
    screenshots: path.relative(ROOT, path.join(P.buildDir, 'shots')).replace(/\\/g, '/'),
    output_dir: path.relative(ROOT, P.buildDir).replace(/\\/g, '/'),
  });
  const compRun = path.join(P.buildDir, 'competition.json');
  fs.writeFileSync(compRun, JSON.stringify(runComp, null, 1));
  let conf;
  try { conf = L.loadCompetition(compRun); } catch (e) { if (e instanceof L.ConfigError) throw new RunError('Configurare invalidă:\n' + e.message); throw e; }
  const run = (args, label) => { try { execFileSync(node, args, { stdio: 'inherit', cwd: ROOT }); } catch (e) { throw new RunError(`Pasul „${label}” a eșuat (cod ${e.status}).`); } };

  step(1, N, 'Turneu + video lung (cache: blocurile deja randate sunt refolosite)', t0);
  if (opts.rerenderMatch) run(['render/render.js', 'forget', opts.rerenderMatch, '--show', path.join('build', 'show.json')].concat(opts.preview ? ['--preview'] : []), 'șterge din cache meciul');
  run(['build_all.js', '--competition', compRun, '--skip-tests', '--no-stills'].concat(opts.preview ? ['--preview'] : []).concat(opts.workers ? ['--workers', String(opts.workers)] : []), 'video lung');
  const show = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'show.json'), 'utf8'));
  const base = path.basename(runComp.output).replace(/_1080p\.mp4$|\.mp4$/, '');
  fs.copyFileSync(path.join(P.buildDir, `${base}_chapters.txt`), path.join(P.runDir, 'chapters.txt'));
  fs.copyFileSync(path.join(P.buildDir, 'LOGO_USAGE.md'), path.join(P.runDir, 'LOGO_USAGE.md'));
  // matches_index.json has player names in "internal": it stays in build/, never in the run folder

  let reelsInfo = [];
  if (!opts.noReels) {
    step(2, N, 'Reel-uri verticale (3)', t0);
    run(['build_reels.js', '--competition', compRun, '--out-dir', path.join(P.runDir, 'reels')].concat(opts.preview ? ['--fast'] : []), 'reel-uri');
    const sel = JSON.parse(fs.readFileSync(path.join(P.runDir, 'reels', 'selection.json'), 'utf8'));
    reelsInfo = sel.reels.map((r) => Object.assign({ dir: `reels/reel${r.rank}_${r.id}` }, JSON.parse(fs.readFileSync(path.join(P.runDir, 'reels', `reel${r.rank}_${r.id}`, 'reel_info.json'), 'utf8'))));
  }
  step(opts.noReels ? 2 : 3, N, 'Thumbnail-uri (3, fără text)', t0);
  run(['render/thumbs.js', path.join('build', 'show.json'), path.join(P.runDir, 'thumbnails'), path.join(P.runDir, 'reels', 'selection.json')], 'thumbnail-uri');

  step(opts.noReels ? 3 : 4, N, 'run.json', t0);
  const PV = require('./plan/validate');
  const planF = path.join(ROOT, 'plan', 'content_plan.json');
  const planE = fs.existsSync(planF) ? JSON.parse(fs.readFileSync(planF, 'utf8')).videos.find((v) => v.competition === P.comp.id && v.map === P.map) : null;
  const accent = opts.accent || (planE && planE.accent) || '#1F6FEB';
  const fp = PV.fingerprint({ id: P.runName, competition: P.comp.id, map: P.map, accent });
  const videoFile = opts.preview ? 'long_video_preview_720p.mp4' : 'long_video_1080p.mp4';
  const T = require('./sim/tournament');
  const idx = T.matchesIndex(show);
  const r16 = show.matches.filter((m) => m.roundKey === 'R16' && m.leg === 'LEG 1').map((m) => [show.teams[m.ta].id, show.teams[m.tb].id].sort().join('-'));
  if (r16.length) fp.bracket = r16;
  const runJson = {
    run: P.runName, created: new Date().toISOString(), date: P.date, quality: opts.preview ? 'preview_720p' : 'final_1080p',
    competition: { id: P.comp.id, name: P.comp.name, file: path.relative(ROOT, P.compFile).replace(/\\/g, '/') }, map: P.map, accent,
    forced_pair: P.forced[0] || null, slot: opts.matchDay ? { match_day: opts.matchDay, fixture: opts.fixture || '' } : null, configHash: conf.hash, simHash: conf.simHash, music: fp.music,
    long_video: { file: videoFile, seconds: +(show.totalFrames / show.fps).toFixed(2) },
    matches: idx.matches.map((m) => ({ id: m.id, stage: m.stage, leg: m.leg, team_a: m.team_a, team_b: m.team_b, seed: m.seed, timeline_hash: m.timeline_hash, score: m.score })),
    champion: idx.champion, reels: reelsInfo.map((r) => ({ dir: r.dir, seconds: r.seconds, seed: r.seed, timeline_hash: r.timeline_hash })),
    bracket_r16: r16, fingerprint: fp, build_minutes: +((Date.now() - t0) / 60000).toFixed(1),
  };
  fs.writeFileSync(path.join(P.runDir, 'run.json'), JSON.stringify(runJson, null, 1) + '\n');

  step(opts.noReels ? 4 : 5, N, 'PUBLISH_CHECKLIST.md', t0);
  require('./sim/checklist').writeChecklist(P.runDir, runJson);
  updateHistory({ run: P.runName, generated_at: runJson.created, competition: P.comp.id, map: P.map, accent, quality: runJson.quality, status: 'generated', forced_pair: P.forced[0] || null, fingerprint: fp });
  linkLatest(P.runDir);

  step(opts.noReels ? 5 : 6, N, 'Preflight (verificări automate)', t0);
  const pf = require('./preflight').preflight(P.runDir);
  step(N, N, 'Gata', t0);
  console.log(`\nRezultat: ${P.runDir}\nPreflight: ${pf.ok ? 'VERDE (toate verificările au trecut)' : 'ROȘU (' + pf.red + ' probleme) — vezi PREFLIGHT.md'}\nTimp total: ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  return { runDir: P.runDir, preflight: pf, runJson };
}

module.exports = { generate, planRun, resolveTeam, copenhagenDate, RunError };
if (require.main === module) {
  const logF = path.join(ROOT, 'logs', 'generate_last.log');
  try {
    const r = generate({ competition: arg('--competition', 'config/competitions/ucl_2026_top16.json'), map: arg('--map'), forcedPair: arg('--forced-pair'), forcedRound: arg('--forced-round'),
      preview: has('--preview'), noReels: has('--no-reels'), rerenderMatch: arg('--rerender-match'), date: arg('--date'), workers: arg('--workers'), accent: arg('--accent'),
      matchDay: arg('--match-day'), fixture: arg('--fixture') });
    process.exit(r.preflight.ok ? 0 : 3);
  } catch (e) {
    fs.mkdirSync(path.dirname(logF), { recursive: true });
    fs.writeFileSync(logF, String(e && e.stack || e));
    console.error(`\nEROARE: ${e instanceof RunError ? e.message : 'eroare neașteptată: ' + e.message}\nDetalii în: ${logF}\nPoți relua aceeași comandă: ce s-a randat deja este refolosit.`);
    process.exit(1);
  }
}
