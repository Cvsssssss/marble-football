'use strict';
// P4 checks: no upload code, `next` rules (strong match, D-1 Copenhagen incl. DST, forced pair, fallback, caps, 8-week
// simulation), preflight positive + negative, run-folder structure, resume from the render cache, launcher option 6.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const N = require('../next');

let pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info === undefined ? '' : '  ' + JSON.stringify(info).slice(0, 300)}`);
}

console.log('== no upload code');
{
  const banned = ['google' + 'apis', 'youtube' + '.upload', 'api.tele' + 'gram.org'];
  const hits = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', 'build', 'output', 'logs', '.git'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (p === __filename) continue; // this test names the banned strings itself
      else if (/\.(js|py|bat|json|mjs|cjs|sh|ps1)$/i.test(e.name)) { const t = fs.readFileSync(p, 'utf8'); for (const b of banned) if (t.includes(b)) hits.push(`${path.relative(ROOT, p)}: ${b}`); }
    }
  })(ROOT);
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const deps = Object.keys(Object.assign({}, pkg.dependencies, pkg.devDependencies));
  check('no upload code: no googleapis / youtube.upload / api.telegram.org in the source, no such dependency', hits.length === 0 && !deps.some((d) => /googleapis|telegram|youtube/i.test(d)), hits);
}

console.log('== next: time (Europe/Copenhagen, DST)');
{
  const iso = (ms) => new Date(ms).toISOString().slice(0, 16);
  const cases = [
    ['2026-10-24', '2026-10-24T17:00'], // CEST (+2): day before the autumn change
    ['2026-10-25', '2026-10-25T18:00'], // CET (+1): DST ended at 03:00 that night
    ['2027-03-27', '2027-03-27T18:00'], // CET
    ['2027-03-28', '2027-03-28T17:00'], // CEST: DST started at 02:00
    ['2026-11-23', '2026-11-23T18:00'],
  ];
  const got = cases.map(([d]) => iso(N.localToUtc(d, '19:00')));
  check('D−1 19:00 Copenhagen -> UTC is right on both sides of the daylight-saving changes', got.every((g, i) => g === cases[i][1]), got);
}

console.log('== next: rules');
const baseState = () => { const s = N.loadState([]); s.hist = []; return s; };
{
  const s = baseState();
  const si = (h, a, c) => N.strongInfo({ home: h, away: a, competition: c }, s.rules, s.comps, s.tidx);
  const a = si('Real Madrid', 'Manchester City', 'CL'), b = si('Club Brugge KV', 'LASK', 'CL'), c = si('Benfica', 'Real Madrid', 'CL'), d = si('Spain', 'Germany', 'FRIENDLY_EURO');
  check('strong-match rule: both in the 16 / big club / positions; generated only when both teams are in the 16 (pair can be forced)',
    a.strong && a.generatable && b.strong && b.generatable && c.strong && !c.generatable && d.generatable && d.comp.id === 'nations_euro_16', [a.reason, b.reason, c.reason, d.reason]);
  // strong fixture on D -> long video D-1 19:00 Copenhagen, forced pair R16, reels on D-1 and D
  s.fixtures = [{ date: '2026-10-26', time: '21:00', competition: 'CL', home: 'Real Madrid', away: 'Manchester City' }];
  const now = N.localToUtc('2026-10-24', '09:00');
  const r = N.recommend(s, now);
  const days = r.publish_reels ? r.publish_reels.map(N.localDate) : [];
  check('strong fixture on D=26 Oct 2026 -> generate now, long video 25 Oct 19:00 CET (18:00 UTC), pair forced in R16, reels on D−1 and D',
    r.action === 'strong_match' && new Date(r.publish_long).toISOString() === '2026-10-25T18:00:00.000Z' && r.forced_pair.a === 'real_madrid' && r.forced_pair.round === 'R16'
    && days.every((x) => x === '2026-10-25' || x === '2026-10-26') && r.competition === 'ucl_2026_top16', { action: r.action, long: r.publish_long && new Date(r.publish_long).toISOString(), days });
  // too late
  const late = N.recommend(s, N.localToUtc('2026-10-25', '18:00'));
  check('too late for D−1 evening -> no strong slot (falls back to the weekly plan)', late.action !== 'strong_match', late.action);
  // cap: a long video already on D-1
  s.hist = [{ run: 'x', competition: 'uel_top16', map: 'sunset', publish_long: N.localToUtc('2026-10-25', '12:00'), publish_reels: [] }];
  const cap = N.recommend(s, now);
  check('cap: a long video already planned on D−1 -> the strong slot is skipped (max 1 long video per day)', cap.action !== 'strong_match', cap.why.slice(0, 2));
  // fallback: no fixtures, nothing in 7 days -> next content_plan entry with a different map/competition than the last run
  s.fixtures = []; s.hist = [{ run: 'h', competition: 'uel_top16', map: 'stadium_day', publish_long: N.localToUtc('2026-11-01', '19:00'), publish_reels: [] }];
  const wk = N.recommend(s, N.localToUtc('2026-11-09', '09:00'));
  check('fallback: no strong fixture and nothing in the last 7 days -> next valid weekly_random plan entry (not the same map / competition as the last run)',
    wk.action === 'weekly' && wk.competition !== 'uel_top16' && wk.map !== 'stadium_day' && !!wk.plan_id, { id: wk.plan_id, c: wk.competition, m: wk.map });
  const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan', 'content_plan.json'), 'utf8')).videos.filter((v) => v.role === 'weekly_random');
  s.hist = plan.slice(0, 2).map((v, i) => ({ run: 'r' + i, competition: v.competition, map: v.map, publish_long: null, publish_reels: [] }));
  const adv = N.recommend(s, N.localToUtc('2026-11-09', '09:00'));
  check('plan advances: runs of the first two entries (even without plan_id) -> the third weekly entry, no back-and-forth', adv.plan_id === plan[2].id, adv.plan_id);
  s.hist = [{ run: 'h', competition: 'uel_top16', map: 'stadium_day', publish_long: N.localToUtc('2026-11-01', '19:00'), publish_reels: [] }];
  const wait = N.recommend(s, N.localToUtc('2026-11-04', '09:00'));
  check('published 3 days ago and no strong fixture -> wait', wait.action === 'wait');
}
{
  const r = N.simulate(8, '2026-11-09');
  const strong = r.events.filter((e) => e.role === 'real_match_slot').length, weekly = r.events.length - strong;
  check('8-week simulation: no rule violated (map/competition rotation, D−1 timing, forced pairs, 1 long/day, 2 reels/day, weekly cadence)', r.violations.length === 0 && strong >= 3 && weekly >= 1, { strong, weekly, violations: r.violations });
  const cli = spawnSync(process.execPath, [path.join(ROOT, 'next.js'), '--simulate', '8weeks'], { encoding: 'utf8' });
  check('npm run next -- --simulate 8weeks exits 0 and prints the schedule', cli.status === 0 && /Nicio regulă încălcată/.test(cli.stdout));
}

console.log('== run folder + preflight');
const runsDir = path.join(ROOT, 'output', 'runs');
const runs = fs.existsSync(runsDir) ? fs.readdirSync(runsDir).filter((r) => fs.existsSync(path.join(runsDir, r, 'run.json'))) : [];
// P5: runs whose videos still exist first (Max's own runs), else the newest dry run (`generate.js --dry-run`, no videos)
const hasVideo = (r) => { try { const j = JSON.parse(fs.readFileSync(path.join(runsDir, r, 'run.json'), 'utf8')); return fs.existsSync(path.join(runsDir, r, j.long_video.file)); } catch (e) { return false; } };
// P6: only runs made by the current pipeline (one reel + publish/ texts); older 3-reel runs are legacy
const current = (r) => fs.existsSync(path.join(runsDir, r, 'publish', 'long_title.txt'));
const pick = runs.filter(current).find((r) => hasVideo(r) && r.endsWith('_preview')) || runs.filter(current).find(hasVideo) || runs.filter((r) => current(r) && r.endsWith('_dryrun')).sort().pop();
const runDir = pick ? path.join(runsDir, pick) : null;
if (!runDir) check('a generated run folder exists (npm run generate -- ... --preview)', false);
else {
  const run = JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf8'));
  // P7: thumbnails only when generate_thumbnails was on (run.thumbnails); runs made before P7 have no field and do have them
  const thumbsMade = run.thumbnails === true || (run.thumbnails === undefined && fs.existsSync(path.join(runDir, 'thumbnails', 'thumbnail_1.png')));
  const need = [run.long_video.file, 'chapters.txt', 'run.json', 'PREFLIGHT.md', 'PUBLISH_CHECKLIST.md', 'LOGO_USAGE.md', 'reels/selection.json'].concat(thumbsMade ? ['thumbnails/thumbnail_1.png', 'thumbnails/thumbnail_2.png', 'thumbnails/thumbnail_3.png'] : [])
    .concat(run.reels.map((r) => `${r.dir}/reel.mp4`)).concat(['publish/long_title.txt', 'publish/long_description.txt', 'publish/reel_title.txt', 'publish/reel_description.txt', 'publish/README_publish.txt']);
  const miss = need.filter((p) => !(run.dry_run && /\.mp4$/.test(p)) && !fs.existsSync(path.join(runDir, p)));
  check(`run folder structure (${path.basename(runDir)}): video, chapters, 1 reel, publish/ texts (thumbnails only if generate_thumbnails), PREFLIGHT, checklist, run.json`, miss.length === 0 && run.reels.length === 1 && /^\d{4}-\d{2}-\d{2}_[a-z0-9_]+_[a-z_]+(_preview|_dryrun)?$/.test(run.run), miss);
  check('run.json has seeds, config hash, timeline hashes, durations', run.configHash && run.matches.length === 29 && run.matches.every((m) => Number.isInteger(m.seed) && m.timeline_hash) && run.long_video.seconds > 0 && run.reels.every((r) => r.seconds > 0));
  const latest = path.join(ROOT, 'output', 'latest');
  check('output/latest points to the last run', fs.existsSync(latest) && (fs.existsSync(path.join(latest, 'run.json')) || fs.existsSync(path.join(latest, 'LATEST.txt'))));
  if (thumbsMade) {
    const thumbs = [1, 2, 3].map((k) => fs.readFileSync(path.join(runDir, 'thumbnails', `thumbnail_${k}.png`)));
    const dims = thumbs.map((b) => [b.readUInt32BE(16), b.readUInt32BE(20)]);
    check('thumbnails: 3 PNG 1280×720', dims.every(([w, h]) => w === 1280 && h === 720), dims);
  } else if (run.thumbnails === false) {
    // P7: generate_thumbnails false (default): no thumbnail is made and the texts tell Max to make his own
    const rd = fs.readFileSync(path.join(runDir, 'publish', 'README_publish.txt'), 'utf8');
    check('thumbnails off by default: rules flag false, checklist + README say Max makes it', require('../config/rules/base.json').generate_thumbnails === false && /îl faci tu/.test(fs.readFileSync(path.join(runDir, 'PUBLISH_CHECKLIST.md'), 'utf8')) && /îl faci tu/.test(rd));
  }
  const ck = fs.readFileSync(path.join(runDir, 'PUBLISH_CHECKLIST.md'), 'utf8');
  check('PUBLISH_CHECKLIST.md: order, SIMULATION + "not real results" reminders, no player names rule, private first, chapters to paste', /Video lung/.test(ck) && /SIMULATION/.test(ck) && /nu rezultate reale/.test(ck) && /Fără nume de jucători/.test(ck) && /privat/.test(ck) && ck.includes('0:00'));
  const P = require('../preflight');
  const pf = P.preflight(runDir);
  check('preflight is green on the generated run', pf.ok, pf.checks.filter((c) => !c.ok).map((c) => c.name));
  // negative: a file name with a player name must fail
  const comp = JSON.parse(fs.readFileSync(path.join(ROOT, run.competition.file), 'utf8'));
  const pl = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'teams', comp.teams[0] + '.json'), 'utf8')).players[0].name;
  const bad = path.join(runDir, `${pl} highlights.txt`);
  fs.writeFileSync(bad, 'test');
  const neg = P.preflight(runDir);
  fs.unlinkSync(bad);
  const nameCheck = neg.checks.find((c) => /nume de jucător/.test(c.name));
  check('preflight negative: a file named after a player turns the run red (explained in Romanian, name masked)', !neg.ok && nameCheck && !nameCheck.ok && !nameCheck.whyRo.includes(pl), nameCheck && nameCheck.whyRo);
  const md = fs.readFileSync(path.join(runDir, 'PREFLIGHT.md'), 'utf8');
  check('PREFLIGHT.md never prints the player name it found', !md.includes(pl));
  // negative: missing SIMULATION label detector on a plain frame
  const blank = Buffer.alloc(84 * 20, 200);
  check('preflight negative: SIMULATION detector says "absent" on a plain background', !P.labelPresent(blank, 84, 20));
  P.preflight(runDir); // restore the green PREFLIGHT.md
}

console.log('== resume after interruption (render cache)');
{
  const show = path.join(ROOT, 'build', 'show.json');
  // P5 (no full renders by Claude Code): the resume logic is checked with the render-cache plan, nothing is rendered.
  // The full interrupted-render rehearsal of P4 is not repeated (it would render a whole preview).
  if (!fs.existsSync(show)) check('resume test needs build/show.json', false);
  else {
    const plan = () => { const o = spawnSync(process.execPath, [path.join(ROOT, 'render', 'render.js'), 'plan', '--show', show, '--preview'], { encoding: 'utf8', cwd: ROOT }); const m = o.stdout.match(/blocks: (\d+), cached: (\d+), to render: (\d+)/); return m ? m.slice(1, 4).map(Number) : null; };
    const p0 = plan();
    const tmp = path.join(ROOT, 'build', 'segcache', 'interrupted_test.tmp.mp4'); fs.mkdirSync(path.dirname(tmp), { recursive: true }); fs.writeFileSync(tmp, 'partial');
    const p1 = plan();
    fs.unlinkSync(tmp);
    check('resume (plan only): blocks = cached + to render, a half-written .tmp block is ignored', p0 && p1 && p0[0] === p0[1] + p0[2] && p0.join() === p1.join(), { p0, p1 });
  }
}

console.log('== reels <= 60 s for every match');
{
  const show = path.join(ROOT, 'build', 'show.json');
  if (fs.existsSync(show)) {
    const S = JSON.parse(fs.readFileSync(show, 'utf8'));
    const R = require('../sim/reels');
    const lens = S.matches.map((m, i) => (m.goals.length ? R.buildReel(S, i).seconds : 0));
    const sel = require('../sim/selectReels').selectReels(Object.assign({}, require('../sim/tournament').matchesIndex(S), {}), 3);
    const fits = lens.filter((x) => x <= 60).length;
    check('reels: most matches fit in 60 s (shorter protected windows when there are many goals); build_reels only selects matches that fit', fits >= lens.length - 2 && /fitIndex/.test(fs.readFileSync(path.join(ROOT, 'build_reels.js'), 'utf8')), { fits, of: lens.length, max: Math.max(...lens), unfiltered_pick: sel.reels.map((r) => r.index) });
  }
}

console.log('== launcher');
{
  const r = spawnSync(process.execPath, [path.join(ROOT, 'launcher.js')], { input: '6\n0\n', encoding: 'utf8', cwd: ROOT, timeout: 120000 });
  check('START menu: Romanian options 1-6 + 0; option 6 validates config + plan', r.status === 0 && /1\. Alege competiția/.test(r.stdout) && /6\. Verifică configurarea și planul/.test(r.stdout) && /Totul este în regulă/.test(r.stdout), r.stdout.slice(-200));
  const bat = fs.readFileSync(path.join(ROOT, 'START.bat'), 'utf8');
  check('START.bat runs the menu and keeps the window open (pause)', /node launcher\.js/.test(bat) && /pause/i.test(bat));
}

console.log(`\nP4: ${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
