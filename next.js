'use strict';
// P4: `npm run next` — what to generate now and why (reads plan/). Rules: plan/OPERATING_RULES.md.
//   npm run next                      -> recommendation for now
//   npm run next -- --simulate 8weeks -> replays the logic over 8 fake weeks with synthetic fixtures and checks every rule
// Fixtures: football-data.org when FOOTBALL_DATA_TOKEN is in .env (cached on disk, refreshed at most every 6 h),
// otherwise plan/fixtures_manual.json.
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const PLAN = path.join(ROOT, 'plan');
const PV = require('./plan/validate');
const MAPS = ['sky_clean', 'stadium_day', 'stadium_night', 'sunset'];
const TZ = 'Europe/Copenhagen';
const DAY = 86400000;

// ---------- time (Europe/Copenhagen, DST-aware) ----------
function tzOffsetMin(utcMs) { // minutes east of UTC in Copenhagen at that instant
  const s = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' }).formatToParts(new Date(utcMs)).find((p) => p.type === 'timeZoneName').value; // GMT+01:00
  const m = s.match(/GMT([+-])(\d{2}):(\d{2})/); return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) : 0;
}
function localToUtc(dateStr, hhmm) { // Copenhagen wall-clock -> UTC ms
  const [y, mo, d] = dateStr.split('-').map(Number), [h, mi] = hhmm.split(':').map(Number);
  let t = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 2; i++) t = Date.UTC(y, mo - 1, d, h, mi) - tzOffsetMin(t) * 60000;
  return t;
}
function localDate(ms) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)); }
function localStr(ms) { return new Intl.DateTimeFormat('ro-RO', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' }).format(new Date(ms)); }
const addDays = (dateStr, n) => { const d = new Date(dateStr + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ---------- data ----------
const readJ = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);
function teamIndex() {
  const idx = {};
  for (const f of fs.readdirSync(path.join(ROOT, 'config', 'teams'))) {
    const t = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'teams', f), 'utf8'));
    for (const k of [t.id, t.name, t.short_name, t.short]) if (k) idx[k.toLowerCase()] = t.id;
  }
  return idx;
}
function competitions() {
  const out = {};
  for (const f of fs.readdirSync(path.join(ROOT, 'config', 'competitions'))) {
    const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'competitions', f), 'utf8'));
    if (c.format === 'knockout16') out[c.id] = Object.assign(c, { file: `config/competitions/${f}` });
  }
  return out;
}
function loadEnvToken() {
  const f = path.join(ROOT, '.env'); if (!fs.existsSync(f)) return null;
  const m = fs.readFileSync(f, 'utf8').match(/^\s*FOOTBALL_DATA_TOKEN\s*=\s*(\S+)/m); return m ? m[1].replace(/^["']|["']$/g, '') : null;
}
async function loadFixtures(nowMs, rules) {
  const token = loadEnvToken();
  if (!token) return { source: 'plan/fixtures_manual.json', fixtures: readJ(path.join(PLAN, 'fixtures_manual.json'), { fixtures: [] }).fixtures };
  const cacheF = path.join(ROOT, 'build', 'fixtures_cache.json');
  const cache = readJ(cacheF, null);
  if (cache && nowMs - cache.fetched_at < 6 * 3600 * 1000) return { source: `football-data.org (cache ${new Date(cache.fetched_at).toISOString()})`, fixtures: cache.fixtures };
  const from = localDate(nowMs), to = addDays(from, rules.lookahead_days || 10);
  const res = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${from}&dateTo=${to}`, { headers: { 'X-Auth-Token': token } }); // token never printed
  if (!res.ok) { if (cache) return { source: 'football-data.org (cache vechi; API a răspuns ' + res.status + ')', fixtures: cache.fixtures }; throw new Error(`football-data.org a răspuns ${res.status}`); }
  const j = await res.json();
  const fixtures = (j.matches || []).map((m) => ({ date: localDate(Date.parse(m.utcDate)), time: new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(m.utcDate)),
    competition: m.competition && m.competition.code, home: m.homeTeam && m.homeTeam.name, away: m.awayTeam && m.awayTeam.name }));
  fs.mkdirSync(path.dirname(cacheF), { recursive: true });
  fs.writeFileSync(cacheF, JSON.stringify({ fetched_at: nowMs, fixtures }, null, 1));
  return { source: 'football-data.org', fixtures };
}

// ---------- rules ----------
function strongInfo(fx, rules, comps, tidx) {
  const id = (n) => (n ? rules.aliases[n] || tidx[String(n).toLowerCase()] || null : null);
  const a = id(fx.home), b = id(fx.away);
  const compId = rules.competition_map[fx.competition];
  const comp = compId ? comps[compId] : Object.values(comps).find((c) => a && b && c.teams.includes(a) && c.teams.includes(b));
  if (!a || !b || !comp) return { strong: false, generatable: false, a, b, reason: 'echipă sau competiție necunoscută' };
  const inA = comp.teams.indexOf(a), inB = comp.teams.indexOf(b);
  const both16 = inA >= 0 && inB >= 0;
  const big = rules.big_clubs.includes(a) || rules.big_clubs.includes(b);
  const pos = both16 && inA + 1 <= rules.max_league_position && inB + 1 <= rules.max_league_position;
  const strong = both16 || big || pos;
  return { strong, generatable: strong && both16, a, b, comp, reason: [both16 && 'ambele echipe în cele 16', big && 'club mare', pos && `ambele în top ${rules.max_league_position}`].filter(Boolean).join(', ') || 'nu e meci tare' };
}

// history helpers: entries { run, competition, map, slot?, plan_id?, publish_long (ms), publish_reels [ms] , fingerprint }
function lastRun(hist) { return hist.length ? hist[hist.length - 1] : null; }
function longOnDate(hist, dateStr) { return hist.some((h) => h.publish_long && localDate(h.publish_long) === dateStr); }
function reelsOnDate(hist, dateStr) { return hist.reduce((n, h) => n + (h.publish_reels || []).filter((t) => localDate(t) === dateStr).length, 0); }
function placeReels(hist, startMs, n, rules) { // earliest slots with <= 2 reels per local day, never before startMs
  const out = [], slots = ['12:00', '17:00', '21:00'];
  let d = localDate(startMs);
  while (out.length < n) {
    const used = reelsOnDate(hist, d) + out.filter((t) => localDate(t) === d).length;
    let free = 2 - used;
    for (const s of slots) { if (free <= 0 || out.length >= n) break; const t = localToUtc(d, s); if (t >= startMs + 3600000) { out.push(t); free--; } }
    d = addDays(d, 1);
  }
  return out;
}
function pickMap(hist, compId, accent, comps) { // map != last run's map, lowest similarity vs the last 5 runs
  const last = lastRun(hist);
  const cands = MAPS.filter((m) => !last || m !== last.map);
  const score = (m) => { const fp = PV.fingerprint({ id: 'x', competition: compId, map: m, accent }); const prev = hist.slice(-5).filter((h) => h.fingerprint); return prev.length ? Math.max(...prev.map((h) => PV.similarity(fp, h.fingerprint))) : 0; };
  return cands.map((m) => ({ m, s: score(m) })).sort((x, y) => x.s - y.s)[0].m;
}

function recommend(state, nowMs) {
  const { plan, hist, rules, fixtures, comps, tidx } = state;
  const why = [];
  const today = localDate(nowMs);
  // 1. strong real fixture within the lookahead window, publishable on D-1 evening (still in the future)
  const cands = fixtures.map((fx) => Object.assign({ fx }, strongInfo(fx, rules, comps, tidx)))
    .filter((c) => c.generatable && c.fx.date > today && c.fx.date <= addDays(today, rules.lookahead_days))
    .filter((c) => !hist.some((h) => h.slot && h.slot.fixture === `${c.a} vs ${c.b}` && h.slot.match_day === c.fx.date))
    .sort((x, y) => (x.fx.date < y.fx.date ? -1 : 1));
  for (const c of cands) {
    const D = c.fx.date, D1 = addDays(D, -1);
    const publishLong = localToUtc(D1, rules.publish_long_local_time);
    const generateBy = publishLong - rules.generate_hours_before_publish * 3600000;
    if (nowMs > generateBy) { why.push(`${c.fx.home}–${c.fx.away} (${D}): prea târziu pentru D−1 seara`); continue; }
    if (longOnDate(hist, D1)) { why.push(`${c.fx.home}–${c.fx.away}: există deja un video lung pe ${D1} (maxim 1/zi)`); continue; }
    const gap = (rules.min_days_between_long || 4) * DAY;
    const near = hist.find((h) => h.publish_long && Math.abs(h.publish_long - publishLong) < gap);
    if (near) { why.push(`${c.fx.home}–${c.fx.away} (${D}): alt video lung la mai puțin de ${rules.min_days_between_long || 4} zile (${localStr(near.publish_long)}); 1 video lung pe săptămână`); continue; }
    // generate on (or after) the day before D-1, early enough: only when D-1 is at most 2 days away
    if (localDate(generateBy) > addDays(today, 1)) { why.push(`${c.fx.home}–${c.fx.away} (${D}): se generează mai aproape de dată (până la ${localStr(generateBy)})`); break; }
    const accent = '#E0457B';
    const map = pickMap(hist, c.comp.id, accent, comps);
    return { action: 'strong_match', competition: c.comp.id, competition_file: c.comp.file, map, accent, forced_pair: { a: c.a, b: c.b, round: rules.forced_round },
      match_day: D, fixture: `${c.a} vs ${c.b}`, generate_by: generateBy, publish_long: publishLong, publish_reels: placeReels(hist, publishLong, 1, rules),
      why: [`Meci real tare: ${c.fx.home} – ${c.fx.away} (${c.fx.competition}, ${D} ${c.fx.time}) — ${c.reason}.`, 'Videoul lung se publică în D−1 seara (Copenhaga), reel-urile în D−1 și D.', `Perechea e forțată în ${rules.forced_round === 'QF' ? 'sferturi' : 'optimi'}.`].concat(why) };
  }
  // 2. weekly: nothing published in the last 7 days -> next valid entry of content_plan.json
  const lastPub = hist.filter((h) => h.publish_long).map((h) => h.publish_long).sort((a, b) => b - a)[0];
  if (lastPub && nowMs - lastPub < 6 * DAY) { // the weekly video is prepared one day before it is due
    return { action: 'wait', next_weekly_due: lastPub + 7 * DAY, why: why.concat([`Ultimul video lung: ${localStr(lastPub)}. Următorul video săptămânal: după ${localStr(lastPub + 7 * DAY)}.`]) };
  }
  // an entry is used once a (not discarded) run has its id or its competition + map (each pair appears once in the plan)
  const used = new Set(hist.map((h) => h.plan_id).filter(Boolean));
  for (const v of plan.videos) if (hist.some((h) => h.competition === v.competition && h.map === v.map)) used.add(v.id);
  const last = lastRun(hist);
  const entry = plan.videos.find((v) => !used.has(v.id) && v.role === 'weekly_random' && (!last || (v.map !== last.map && v.competition !== last.competition)));
  if (!entry) return { action: 'wait', why: why.concat(['Planul nu mai are intrări valide: adaugă videouri în plan/content_plan.json.']) };
  let pubDay = localDate(Math.max(nowMs + DAY, lastPub ? lastPub + 7 * DAY : 0)); while (longOnDate(hist, pubDay)) pubDay = addDays(pubDay, 1);
  const publishLong = localToUtc(pubDay, rules.weekly_publish_local_time);
  const comp = comps[entry.competition];
  return { action: 'weekly', plan_id: entry.id, competition: entry.competition, competition_file: comp.file, map: entry.map, accent: entry.accent, forced_pair: null,
    publish_long: publishLong, publish_reels: placeReels(hist, publishLong, 1, rules),
    why: why.concat([`Niciun meci real tare de pregătit și niciun video lung în ultimele 7 zile → următoarea intrare din plan: ${entry.id} (${comp.name}, ${entry.map}).`]) };
}

function command(r) {
  if (r.action === 'wait') return null;
  const T = (id) => JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'teams', id + '.json'), 'utf8')).name;
  return `npm run generate -- --competition ${r.competition_file} --map ${r.map} --accent "${r.accent}"` + (r.forced_pair ? ` --forced-pair "${T(r.forced_pair.a)} vs ${T(r.forced_pair.b)}" --forced-round ${r.forced_pair.round} --match-day ${r.match_day} --fixture "${T(r.forced_pair.a)} vs ${T(r.forced_pair.b)}"` : '');
}

function loadState(fixtures) {
  const hj = readJ(path.join(PLAN, 'history.json'), { runs: [] });
  const hist = hj.runs.filter((h) => h.status !== 'discarded').map((h) => Object.assign({}, h, {
    publish_long: h.published_long ? Date.parse(h.published_long) : null, publish_reels: (h.published_reels || []).map((t) => Date.parse(t)) }));
  return { plan: readJ(path.join(PLAN, 'content_plan.json'), { videos: [] }), hist, rules: readJ(path.join(PLAN, 'strong_match_rules.json')), fixtures, comps: competitions(), tidx: teamIndex() };
}

// ---------- 8-week simulation ----------
function syntheticFixtures(startDate) {
  const fx = [];
  const pairs = [['CL', 'Real Madrid', 'Manchester City'], ['EL', 'Benfica', 'Juventus'], ['CL', 'Club Brugge', 'LASK'], ['CL', 'Barcelona', 'Inter'], ['EL', 'Lyon', 'Omonia'],
    ['FRIENDLY_EURO', 'Spain', 'Germany'], ['CL', 'Liverpool', 'Arsenal'], ['EL', 'Sunderland', 'AZ'], ['FRIENDLY_WORLD', 'Argentina', 'Brazil'], ['CL', 'Como', 'Stuttgart']];
  for (let w = 0; w < 8; w++) {
    if (w % 3 === 2) continue; // some weeks without strong matches -> weekly fallback
    const p = pairs[(w * 2) % pairs.length], q = pairs[(w * 2 + 1) % pairs.length];
    fx.push({ date: addDays(startDate, w * 7 + 2), time: '21:00', competition: p[0], home: p[1], away: p[2] });
    fx.push({ date: addDays(startDate, w * 7 + 3), time: '18:45', competition: q[0], home: q[1], away: q[2] });
  }
  // a fixture right after the DST change (29 Mar 2027 is outside; use the autumn change: 25 Oct 2026 is before start -> covered by tests)
  return fx;
}
function simulate(weeks, startDate) {
  const st = loadState(syntheticFixtures(startDate));
  st.hist = []; // fresh history
  const events = [];
  for (let d = 0; d < weeks * 7; d++) {
    const day = addDays(startDate, d), now = localToUtc(day, '09:00');
    const r = recommend(st, now);
    if (r.action === 'wait') continue;
    const fp = PV.fingerprint({ id: `S${events.length + 1}`, competition: r.competition, map: r.map, accent: r.accent });
    const h = { run: `${day}_${r.competition}_${r.map}`, competition: r.competition, map: r.map, plan_id: r.plan_id || null, slot: r.match_day ? { match_day: r.match_day, fixture: r.fixture } : null,
      role: r.action === 'strong_match' ? 'real_match_slot' : 'weekly_random', publish_long: r.publish_long, publish_reels: r.publish_reels, forced_pair: r.forced_pair, fingerprint: fp, generated: now };
    st.hist.push(h); events.push(h);
  }
  return { events, violations: checkSchedule(events) };
}
function checkSchedule(ev) {
  const v = [];
  ev.forEach((e, i) => {
    const p = ev[i - 1];
    if (p && p.map === e.map) v.push(`${e.run}: aceeași hartă de două ori la rând`);
    if (p && p.competition === e.competition && e.role !== 'real_match_slot') v.push(`${e.run}: aceeași competiție de două ori la rând (fără meci real)`);
    if (e.slot) {
      const exp = localToUtc(addDays(e.slot.match_day, -1), '19:00');
      if (e.publish_long !== exp) v.push(`${e.run}: video lung nu e în D−1 19:00 Copenhaga`);
      if (!e.forced_pair || !['R16', 'QF'].includes(e.forced_pair.round)) v.push(`${e.run}: perechea nu e forțată în optimi/sferturi`);
      const rd = e.publish_reels.map(localDate); if (!rd.every((d) => d === addDays(e.slot.match_day, -1) || d === e.slot.match_day)) v.push(`${e.run}: reel-urile nu sunt în D−1 și D`);
    }
    if (e.publish_reels.some((t) => t <= e.publish_long)) v.push(`${e.run}: reel înaintea videoului lung`);
    if (e.generated > e.publish_long) v.push(`${e.run}: generat după ora de publicare`);
  });
  const longs = {}, reels = {};
  ev.forEach((e) => { const d = localDate(e.publish_long); longs[d] = (longs[d] || 0) + 1; e.publish_reels.forEach((t) => { const x = localDate(t); reels[x] = (reels[x] || 0) + 1; }); });
  for (const [d, n] of Object.entries(longs)) if (n > 1) v.push(`${d}: ${n} videouri lungi (maxim 1)`);
  for (const [d, n] of Object.entries(reels)) if (n > 2) v.push(`${d}: ${n} reel-uri (maxim 2)`);
  // weekly gap: no week without a long video
  for (let i = 1; i < ev.length; i++) if (ev[i].publish_long - ev[i - 1].publish_long > 8 * DAY) v.push(`${ev[i].run}: pauză mai mare de o săptămână`);
  return v;
}

module.exports = { recommend, simulate, checkSchedule, localToUtc, localDate, strongInfo, loadState, command, tzOffsetMin, addDays };

if (require.main === module) {
  (async () => {
    const i = process.argv.indexOf('--simulate');
    if (i > 0) {
      const weeks = parseInt(process.argv[i + 1] || '8', 10) || 8;
      const r = simulate(weeks, process.argv[i + 2] || '2026-11-09');
      console.log(`Simulare ${weeks} săptămâni (fixturi sintetice):`);
      for (const e of r.events) console.log(`- ${e.role === 'real_match_slot' ? 'MECI TARE' : 'săptămânal'}: ${e.competition} / ${e.map}${e.forced_pair ? ` / pereche ${e.forced_pair.a}–${e.forced_pair.b} (${e.forced_pair.round})` : ''} → lung ${localStr(e.publish_long)}; reel-uri ${e.publish_reels.map((t) => localStr(t)).join(' | ')}`);
      console.log(r.violations.length ? `\nÎNCĂLCĂRI:\n - ${r.violations.join('\n - ')}` : '\nNicio regulă încălcată.');
      process.exit(r.violations.length ? 1 : 0);
    }
    const st = loadState([]);
    const fx = await loadFixtures(Date.now(), st.rules);
    st.fixtures = fx.fixtures;
    const r = recommend(st, Date.now());
    console.log(`Sursa meciurilor reale: ${fx.source}\n`);
    console.log(r.action === 'wait' ? 'Nu e nimic de generat acum.' : `RECOMANDARE: ${r.action === 'strong_match' ? 'meci real tare' : 'video săptămânal'} — ${st.comps[r.competition].name}, harta ${r.map}`);
    for (const w of r.why) console.log(`  · ${w}`);
    if (r.action !== 'wait') {
      if (r.generate_by) console.log(`  Generează până la: ${localStr(r.generate_by)}`);
      console.log(`  Publicare video lung: ${localStr(r.publish_long)}`);
      console.log(`  Reel-uri: ${r.publish_reels.map(localStr).join(' | ')}`);
      console.log(`\nComanda:\n  ${command(r)}`);
    }
    fs.writeFileSync(path.join(ROOT, 'build', 'next_recommendation.json'), JSON.stringify(Object.assign({ command: command(r) }, r), null, 1));
  })().catch((e) => { console.error('EROARE: ' + e.message); process.exit(1); });
}
