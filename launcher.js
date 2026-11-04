'use strict';
// P4: Romanian console menu (START.bat / npm start). Everything runs locally; nothing is uploaded anywhere.
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');
const ROOT = __dirname;
const node = process.execPath;

// line queue: answers typed (or piped) ahead of the question are kept, not lost; end of input = exit
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const lines = [], waiting = [];
let closed = false;
rl.on('line', (l) => { if (waiting.length) waiting.shift()(l.trim()); else lines.push(l.trim()); });
rl.on('close', () => { closed = true; while (waiting.length) waiting.shift()('0'); });
const ask = (q) => { process.stdout.write(q); if (lines.length) return Promise.resolve(lines.shift()); if (closed) return Promise.resolve('0'); return new Promise((res) => waiting.push(res)); };
const listJson = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.json'));
const runNode = (args) => spawnSync(node, args, { stdio: 'inherit', cwd: ROOT }).status;

function fail(code, what) {
  if (code === 0) return true;
  if (code === 3) { console.log('\n*** Fișierele sunt gata, dar PREFLIGHT e ROȘU: deschide PREFLIGHT.md din folderul rulării (fiecare problemă are motivul).'); return false; }
  console.log(`\n*** ${what} nu a reușit (cod ${code}). Detalii: logs/generate_last.log (și mesajele de mai sus).`);
  console.log('*** Poți rula din nou aceeași opțiune: ce s-a randat deja este refolosit din cache.');
  return false;
}
async function choose(title, items, def) {
  console.log(`\n${title}`);
  items.forEach((it, i) => console.log(`  ${i + 1}. ${it.label}${i === def ? '  (implicit)' : ''}`));
  const a = await ask(`Alege 1-${items.length} [Enter = ${def + 1}]: `);
  const n = a === '' ? def : parseInt(a, 10) - 1;
  return items[n] || items[def];
}
async function pickCompetition() {
  const comps = listJson('config/competitions').map((f) => ({ f, c: JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'competitions', f), 'utf8')) })).filter((x) => x.c.format === 'knockout16');
  return choose('Competiția:', comps.map((x) => ({ label: `${x.c.name}  (${x.f})`, value: `config/competitions/${x.f}`, comp: x.c })), 0);
}
async function pickMap(comp) {
  const maps = listJson('config/maps').filter((f) => f !== 'default.json').map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'maps', f), 'utf8')));
  const def = Math.max(0, maps.findIndex((m) => m.id === comp.map));
  return choose('Harta / tema:', maps.map((m) => ({ label: `${m.name}  (${m.id})`, value: m.id })), def);
}
function generate(args) { return fail(runNode(['generate.js', ...args]), 'Generarea'); }

async function option1() {
  const c = await pickCompetition();
  const m = await pickMap(c.comp);
  console.log(`\nEchipe: ${c.comp.teams.join(', ')}`);
  const fp = await ask('Pereche forțată (ex. "Barcelona vs Aston Villa"), Enter = fără: ');
  let round = 'R16';
  if (fp) round = (await choose('Unde se întâlnesc?', [{ label: 'în optimi', value: 'R16' }, { label: 'în sferturi (dacă trec amândouă)', value: 'QF' }], 0)).value;
  const q = await choose('Calitatea:', [{ label: 'finală 1080p (durează mai mult)', value: 'final' }, { label: 'preview 720p (rapid, doar pentru verificare)', value: 'preview' }], 0);
  const args = ['--competition', c.value, '--map', m.value];
  if (fp) args.push('--forced-pair', fp, '--forced-round', round);
  if (q.value === 'preview') args.push('--preview');
  generate(args);
}
async function option2() {
  const c = await pickCompetition();
  const m = await pickMap(c.comp);
  generate(['--competition', c.value, '--map', m.value, '--preview']);
}
function latestRun() {
  const d = path.join(ROOT, 'output', 'runs');
  if (!fs.existsSync(d)) return null;
  const runs = fs.readdirSync(d).map((r) => ({ r, t: fs.statSync(path.join(d, r)).mtimeMs })).sort((a, b) => b.t - a.t);
  return runs.length ? path.join(d, runs[0].r) : null;
}
function option3() {
  const r = latestRun();
  if (!r || !fs.existsSync(path.join(r, 'run.json'))) { console.log('\nNu există încă un turneu generat. Folosește opțiunea 1 sau 2.'); return; }
  const run = JSON.parse(fs.readFileSync(path.join(r, 'run.json'), 'utf8'));
  const comp = path.join(ROOT, 'build', 'runs', run.run, 'competition.json');
  if (!fail(runNode(['build_reels.js', '--competition', comp, '--out-dir', path.join(r, 'reels')].concat(run.quality === 'final_1080p' ? [] : ['--fast'])), 'Reel-urile')) return;
  runNode(['preflight.js', r]);
  console.log(`\nReel-uri în: ${path.join(r, 'reels')}`);
}
function option4() {
  if (!fail(runNode(['next.js']), 'Recomandarea')) return;
  const f = path.join(ROOT, 'build', 'next_recommendation.json');
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!r.command) return;
  const args = ['--competition', r.competition_file, '--map', r.map, '--accent', r.accent];
  if (r.forced_pair) {
    const T = (id) => JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'teams', id + '.json'), 'utf8')).name;
    args.push('--forced-pair', `${T(r.forced_pair.a)} vs ${T(r.forced_pair.b)}`, '--forced-round', r.forced_pair.round, '--match-day', r.match_day, '--fixture', `${T(r.forced_pair.a)} vs ${T(r.forced_pair.b)}`);
  }
  return ask('\nGenerez acum (1080p)? [d = da, p = preview 720p, Enter = nu]: ').then((a) => {
    if (/^d/i.test(a)) generate(args); else if (/^p/i.test(a)) generate(args.concat(['--preview']));
  });
}
function option5() {
  const r = latestRun() || path.join(ROOT, 'output');
  console.log(`\nDeschid: ${r}`);
  if (process.platform === 'win32') spawnSync('explorer', [r]); else spawnSync('xdg-open', [r]);
}
function option6() {
  let ok = true;
  console.log('\n— Configurația (schema):');
  for (const f of listJson('config/competitions')) {
    const r = spawnSync(node, ['-e', `require('./sim/config_loader').loadCompetition(${JSON.stringify(path.join(ROOT, 'config', 'competitions', f))})`], { cwd: ROOT, encoding: 'utf8' });
    console.log(`  ${r.status === 0 ? 'OK  ' : 'EROARE'} ${f}${r.status === 0 ? '' : '\n' + r.stderr.split('\n').filter((l) => /^\s+-|Configuration/.test(l)).join('\n')}`);
    ok = ok && r.status === 0;
  }
  console.log('\n— Planul (plan:validate):');
  ok = runNode(['plan/validate.js']) === 0 && ok;
  console.log(ok ? '\nTotul este în regulă.' : '\nAu apărut erori (vezi mai sus).');
}

async function main() {
  for (;;) {
    console.log('\n==================== MARBLE FOOTBALL ====================');
    console.log('  1. Alege competiția, harta/tema și (opțional) o pereche forțată, apoi generează');
    console.log('  2. Preview rapid (720p)');
    console.log('  3. Doar reel-uri din ultimul turneu');
    console.log('  4. Generează videoul recomandat');
    console.log('  5. Deschide folderul cu rezultate');
    console.log('  6. Verifică configurarea și planul');
    console.log('  0. Ieșire');
    const a = await ask('Opțiunea: ');
    try {
      if (a === '1') await option1(); else if (a === '2') await option2(); else if (a === '3') option3(); else if (a === '4') await option4();
      else if (a === '5') option5(); else if (a === '6') option6(); else if (a === '0') break; else console.log('Opțiune necunoscută.');
    } catch (e) { console.log(`\n*** Eroare: ${e.message}`); }
  }
  rl.close();
}
main();
