'use strict';
// P7 §4: Premier League season mode (one video per matchweek). No rendering in this file.
//   node league.js status                      next matchweek + table summary
//   node league.js table                       full table in the console
//   node league.js maps                        maps available for the league and the default for the next matchweek
//   node league.js play [--map X]              play the NEXT matchweek (results + table saved; locks the previous one)
//   node league.js play --regenerate [--map X] replay ONLY the last generated matchweek (same seeds -> same results)
//   node league.js dry-run [--dir D]           whole 38-week flow with stub results in a scratch folder (no renders)
// Env (tests): MARBLE_LEAGUE_DIR = state folder instead of league/<id>; MARBLE_LEAGUE_MODE = stub (fitted model, no engine).
// The matchweek video (P7 §5) is built by build_matchweek.js when that file exists; until then only results are made.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const LC = require('./sim/league/config');
const SEASON = require('./sim/league/season');
const TB = require('./sim/league/standings');
const ROOT = __dirname;
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);

function ctx() {
  const C = LC.loadLeague(arg('--league'));
  const opts = { dir: arg('--dir', process.env.MARBLE_LEAGUE_DIR || undefined), mode: has('--stub') || process.env.MARBLE_LEAGUE_MODE === 'stub' ? 'stub' : 'engine' };
  return { C, opts, byId: Object.fromEntries(C.teams.map((t) => [t.id, t])) };
}
const VIDEO_BUILDER = path.join(ROOT, 'build_matchweek.js');

function summary(C, st, byId) {
  const lines = [`${C.league.display_name} ${C.league.season} — ` + (st.season_over ? 'sezonul s-a încheiat (38/38)' : `Următoarea: Etapa ${st.next_week} din 38`)];
  if (st.last_generated_week) lines.push(`Ultima etapă generată: ${st.last_generated_week} (doar ea se poate regenera; cele dinainte sunt blocate)`);
  if (!st.table) { lines.push('Clasament: încă nicio etapă jucată (toate echipele 0 puncte).'); return lines.join('\n'); }
  const nm = (id) => byId[id].name;
  const t = st.table;
  lines.push('Sus: ' + t.slice(0, 5).map((r) => `${r.pos}. ${nm(r.id)} ${r.pts}p`).join(' · '));
  lines.push('Jos: ' + t.slice(17).map((r) => `${r.pos}. ${nm(r.id)} ${r.pts}p`).join(' · '));
  return lines.join('\n');
}

async function play(C, opts, byId) {
  const st = SEASON.status(C, opts);
  const regen = has('--regenerate');
  const week = regen ? st.last_generated_week : st.next_week;
  if (regen && !week) throw new SEASON.LeagueError('nu există încă nicio etapă generată');
  const r = await SEASON.playWeek(C, week, Object.assign({}, opts, { map: arg('--map') }));
  const nm = (id) => byId[id].name;
  console.log(`\nEtapa ${week} ${r.regenerated ? '(regenerată) ' : ''}· hartă: ${r.results.map}${r.results.stub ? ' · STUB (repetiție)' : ''}`);
  for (const m of r.results.matches) console.log(`  ${nm(m.home).padEnd(24)} ${m.hg}-${m.ag}  ${nm(m.away)}`);
  console.log('\n' + summary(C, SEASON.status(C, opts), byId));
  if (!has('--no-video') && !r.results.stub) {
    if (fs.existsSync(VIDEO_BUILDER)) {
      const code = spawnSync(process.execPath, [VIDEO_BUILDER, '--week', String(week)].concat(opts.dir ? ['--dir', opts.dir] : []), { stdio: 'inherit', cwd: ROOT }).status;
      if (code !== 0) process.exitCode = code || 1;
    } else console.log('\nVideoul etapei (P7 secțiunea 5) nu e încă implementat: rezultatele și clasamentul sunt salvate în league/, iar videoul se va face din ele.');
  }
  return r;
}

async function dryRun() {
  const C = LC.loadLeague(arg('--league'));
  const dir = path.resolve(arg('--dir', path.join(ROOT, 'build', 'league_dryrun')));
  fs.rmSync(dir, { recursive: true, force: true });
  const opts = { dir, mode: 'stub' };
  const t0 = Date.now();
  // fixtures: copy the season's real fixtures if they exist (same as a real run), else build them in the scratch folder
  const real = path.join(ROOT, 'league', C.league.id, 'fixtures.json');
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(real)) fs.copyFileSync(real, path.join(dir, 'fixtures.json'));
  const checks = [];
  for (let w = 1; w <= 38; w++) {
    const r = await SEASON.playWeek(C, w, opts);
    if (w === 5) { // regenerate the last week: same results; an earlier week is locked
      const again = await SEASON.playWeek(C, 5, opts);
      checks.push(['regenerate last week gives the same results', again.results.results_hash === r.results.results_hash]);
      let locked = false; try { await SEASON.playWeek(C, 4, opts); } catch (e) { locked = /locked/.test(e.message); }
      checks.push(['earlier week is locked', locked]);
    }
  }
  const st = SEASON.status(C, opts);
  const byId = Object.fromEntries(C.teams.map((t) => [t.id, t]));
  checks.push(['38 weeks played, season over', st.season_over && st.weeks.length === 38]);
  checks.push(['every club played 38', st.table.every((r) => r.p === 38)]);
  console.log(TB.formatTable(st.table, byId, C.league));
  checks.forEach(([n, ok]) => console.log(`${ok ? 'OK ' : 'FAIL'} ${n}`));
  console.log(`dry run (stub results, no renders): ${dir}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (checks.some((c) => !c[1])) process.exitCode = 1;
}

async function main() {
  const cmd = argv[0] || 'status';
  if (cmd === 'dry-run') return dryRun();
  const { C, opts, byId } = ctx();
  if (cmd === 'status') { SEASON.loadOrCreateFixtures(C, opts); LC.writeMissingLogos(C); console.log(summary(C, SEASON.status(C, opts), byId)); return; }
  if (cmd === 'table') {
    const st = SEASON.status(C, opts);
    const rows = st.table || TB.table(C.ids, [], C.league);
    console.log(`\n${C.league.display_name} ${C.league.season} — clasament după etapa ${st.last_generated_week}\n` + TB.formatTable(rows, byId, C.league));
    console.log('Zone: ' + C.league.zones.map((z) => `${z.from}${z.to > z.from ? '-' + z.to : ''} ${z.label}`).join(' · '));
    return;
  }
  if (cmd === 'maps') {
    const ch = SEASON.mapChoices(C), def = SEASON.defaultMap(C, SEASON.loadState(C, opts), ch);
    console.log(JSON.stringify({ choices: ch, default: def }));
    return;
  }
  if (cmd === 'play') return play(C, opts, byId);
  throw new Error('unknown command ' + cmd);
}
if (require.main === module) {
  main().catch((e) => {
    const logF = path.join(ROOT, 'logs', 'league_last.log');
    fs.mkdirSync(path.dirname(logF), { recursive: true }); fs.writeFileSync(logF, String(e && e.stack || e));
    console.error(`\nEROARE: ${e instanceof SEASON.LeagueError ? e.message : e.message}\nDetalii în: ${logF}`);
    process.exit(1);
  });
}
module.exports = { summary };
