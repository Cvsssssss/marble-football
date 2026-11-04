'use strict';
// One command to rebuild everything:
//   node build_all.js --competition config/competitions/demo_4teams.json     (or: npm run all)
// (without --competition the demo_4teams competition is used; the v1 output files are never overwritten)
// config check -> tests -> tournament/show -> key-moment screenshots -> 16-team bracket check -> audio -> video -> mux + ffprobe + samples
const { execFileSync } = require('child_process');
const os = require('os');
const path = require('path');
const L = require('./sim/config_loader');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const comp = path.resolve(arg('--competition', path.join('config', 'competitions', 'demo_4teams.json')));
let conf;
try { conf = L.loadCompetition(comp); } catch (e) { if (e instanceof L.ConfigError) { console.error(e.message); process.exit(2); } throw e; }
const out = conf.competition.output || 'output/demo_v2b_1080p.mp4';
const shots = conf.competition.screenshots || 'output/screenshots_v2b';
const skipTests = process.argv.includes('--skip-tests');
const run = (cmd, args) => { console.log('\n>>> ' + [cmd, ...args].join(' ')); execFileSync(cmd, args, { stdio: 'inherit', cwd: __dirname }); };
const node = process.execPath;
const py = process.platform === 'win32' ? 'python' : 'python3';
const workers = String(Math.max(2, Math.min(10, os.cpus().length - 2)));
const show = path.join('build', 'show.json');
const t0 = Date.now();
if (!skipTests) run(node, ['tests/run_tests.js']);
run(node, ['sim/tournament.js', '--competition', comp, '--out', show]);
run(node, ['render/render.js', 'stills', shots, '--show', show]);
run(node, ['render/render.js', 'brackets', shots, '--show', show]); // both bracket styles, 4 and 16 teams
run(py, ['audio/make_audio.py', show, path.join('build', 'audio_raw.wav')]);
run(node, ['render/render.js', 'video', workers, '--show', show]);
run(node, ['render/mux.js', '--out', out, '--shots', shots]);
console.log(`\nALL DONE in ${((Date.now() - t0) / 60000).toFixed(1)} min -> ${path.join(__dirname, out)}`);
