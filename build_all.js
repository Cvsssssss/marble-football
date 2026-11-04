'use strict';
// One command to rebuild everything for a competition:
//   node build_all.js --competition config/competitions/ucl_2026_top16.json            (1080p final)
//   node build_all.js --competition config/competitions/ucl_2026_top16.json --preview  (720p, fast)
//   options: --skip-tests  --workers N  --no-stills  --map <theme id>
// config check -> tests -> tournament/show -> key-moment screenshots + bracket/ball sheets -> audio -> video (render cache)
// -> mux + ffprobe + samples -> chapters.txt, matches_index.json, LOGO_USAGE.md
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const L = require('./sim/config_loader');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const comp = path.resolve(arg('--competition', path.join('config', 'competitions', 'demo_4teams.json')));
let conf;
const MAP = arg('--map', undefined); // optional theme override (config/maps/<id>.json)
try { conf = L.loadCompetition(comp, { map: MAP }); } catch (e) { if (e instanceof L.ConfigError) { console.error(e.message); process.exit(2); } throw e; }
const PREVIEW = process.argv.includes('--preview');
const C = conf.competition;
const out = PREVIEW ? (C.preview_output || 'output/preview_720p.mp4') : (C.output || 'output/demo_v2b_1080p.mp4');
const shots = C.screenshots || 'output/screenshots_v2b';
const outDir = C.output_dir || path.dirname(out);
const base = path.basename(C.output || 'output/video_1080p.mp4').replace(/_1080p\.mp4$|\.mp4$/, '');
const skipTests = process.argv.includes('--skip-tests');
const SIM_ONLY = process.argv.includes('--sim-only'); // P5 dry run: tournament + text outputs only (no audio, no video)
const run = (cmd, args) => { console.log('\n>>> ' + [cmd, ...args].join(' ')); execFileSync(cmd, args, { stdio: 'inherit', cwd: __dirname }); };
const node = process.execPath;
const py = process.platform === 'win32' ? 'python' : 'python3';
const workers = arg('--workers', String(Math.max(2, Math.min(10, os.cpus().length - 2))));
const show = path.join('build', 'show.json');
const t0 = Date.now();
if (!skipTests) run(node, ['tests/run_tests.js']);
run(node, ['sim/tournament.js', '--competition', comp, '--out', show].concat(MAP ? ['--map', MAP] : []));
if (!process.argv.includes('--no-stills')) {
  run(node, ['render/render.js', 'stills', shots, '--show', show]);
  run(node, ['render/render.js', 'brackets', shots, '--show', show]);
  run(node, ['render/render.js', 'balls', shots, '--show', show]);
}
if (!SIM_ONLY) run(py, ['audio/make_audio.py', show, path.join('build', 'audio_raw.wav')]);
if (!SIM_ONLY) run(node, ['render/render.js', 'video', workers, '--show', show].concat(PREVIEW ? ['--preview'] : []));
if (!SIM_ONLY) run(node, ['render/mux.js', '--out', out, '--shots', shots, '--video', path.join('build', PREVIEW ? 'video_noaudio_preview.mp4' : 'video_noaudio.mp4')].concat(PREVIEW ? ['--tag', 'preview'] : []));
// text outputs next to the video
const TOUR = require('./sim/tournament');
const LOGOS = require('./sim/logos');
const S = JSON.parse(fs.readFileSync(path.join(__dirname, show), 'utf8'));
fs.mkdirSync(path.join(__dirname, outDir), { recursive: true });
fs.writeFileSync(path.join(__dirname, outDir, `${base}_chapters.txt`), TOUR.chaptersText(S));
fs.writeFileSync(path.join(__dirname, outDir, 'matches_index.json'), JSON.stringify(TOUR.matchesIndex(S), null, 1));
fs.writeFileSync(path.join(__dirname, outDir, 'LOGO_USAGE.md'), LOGOS.logoUsageMd(conf, S.logosMissing));
console.log(`\nALL DONE in ${((Date.now() - t0) / 60000).toFixed(1)} min -> ${path.join(__dirname, out)}`);
