'use strict';
// Validates plan/content_plan.json against plan/OPERATING_RULES.md §C and computes plan/uniqueness.json.
//   npm run plan:validate                 -> validate plan/content_plan.json, (re)write plan/uniqueness.json
//   node plan/validate.js <plan.json> --no-write
// Similarity of two videos (0..1):
//   0.30 same map theme + 0.30 same competition + 0.15 * accent-colour closeness (1 - dE76/60, floored at 0)
//   + 0.10 same music profile (map music) + 0.15 * bracket overlap (Jaccard of the first-round pairings)
// A video is rejected when its similarity to any of the previous 5 videos is > THRESHOLD (0.60):
// same map AND same competition already gives 0.60, so any further likeness (colour, music, bracket) fails.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const THRESHOLD = 0.6;
const COMPS = ['ucl_2026_top16', 'uel_top16', 'nations_world_16', 'nations_euro_16'];
const MAPS = ['sky_clean', 'stadium_day', 'stadium_night', 'sunset'];

function hexLab(h) {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92));
  const x = (c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047, y = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722, z = (c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const dE = (a, b) => { const p = hexLab(a), q = hexLab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const SEED_ORDER = [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11];

function fingerprint(v) {
  const comp = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'competitions', v.competition + '.json'), 'utf8'));
  const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'maps', v.map + '.json'), 'utf8'));
  const audio = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'audio.json'), 'utf8'));
  const pairs = [];
  for (let i = 0; i < 16; i += 2) pairs.push([comp.teams[SEED_ORDER[i] - 1], comp.teams[SEED_ORDER[i + 1] - 1]].sort().join('-'));
  const music = map.music || { transpose: 0, bpm: 112, progression: 'v2', arp: 'up' };
  return { id: v.id, competition: v.competition, competition_name: comp.name, map: v.map, accent: v.accent, colours: [v.accent, map.sky[1], map.windmill ? map.windmill[0] : '#e8553e'],
    music: `${music.progression}/${music.arp}/${music.transpose}/${music.bpm}/seed${audio.music_seed !== undefined ? audio.music_seed : 1234}`, bracket: pairs };
}
function similarity(a, b) {
  const inter = a.bracket.filter((p) => b.bracket.includes(p)).length, uni = new Set([...a.bracket, ...b.bracket]).size;
  const s = 0.3 * (a.map === b.map) + 0.3 * (a.competition === b.competition) + 0.15 * Math.max(0, 1 - dE(a.accent, b.accent) / 60) + 0.1 * (a.music === b.music) + 0.15 * (inter / uni);
  return +s.toFixed(3);
}

function validatePlan(plan) {
  const errs = [];
  const H = plan.history || [], V = plan.videos || [];
  if (V.length !== 12) errs.push(`plan must list the next 12 videos (has ${V.length})`);
  V.forEach((v, i) => {
    for (const k of ['id', 'competition', 'map', 'accent', 'week', 'role']) if (v[k] === undefined) errs.push(`video ${i + 1}: missing "${k}"`);
    if (!COMPS.includes(v.competition)) errs.push(`video ${i + 1}: unknown competition "${v.competition}"`);
    if (!MAPS.includes(v.map)) errs.push(`video ${i + 1}: unknown map theme "${v.map}"`);
    if (!/^#[0-9A-Fa-f]{6}$/.test(v.accent || '')) errs.push(`video ${i + 1}: accent must be #RRGGBB`);
    if (!['weekly_random', 'real_match_slot'].includes(v.role)) errs.push(`video ${i + 1}: role must be weekly_random or real_match_slot`);
  });
  if (errs.length) return { ok: false, errors: errs, uniqueness: null };
  const all = H.concat(V);
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1], b = all[i], n = i - H.length + 1;
    if (i < H.length) continue;
    if (a.map === b.map) errs.push(`video ${n} (${b.id}): same map "${b.map}" twice in a row`);
    if (a.competition === b.competition) errs.push(`video ${n} (${b.id}): same competition "${b.competition}" twice in a row`);
    if (b.week < a.week) errs.push(`video ${n} (${b.id}): weeks must not go backwards`);
  }
  const pairs = V.map((v) => `${v.competition}/${v.map}`);
  pairs.forEach((p, i) => { if (pairs.indexOf(p) !== i) errs.push(`video ${i + 1}: competition + map "${p}" already used by ${V[pairs.indexOf(p)].id} (next.js tracks plan entries by this pair)`); });
  // same competition: at least 1 week apart
  for (let i = H.length; i < all.length; i++) for (let j = 0; j < i; j++) {
    if (all[j].competition === all[i].competition && all[i].week - all[j].week < 1) errs.push(`video ${i - H.length + 1} (${all[i].id}): competition "${all[i].competition}" again within 1 week`);
  }
  // per week: max 1 long video, or 2 if one is a real_match_slot
  const byWeek = {};
  V.forEach((v) => { (byWeek[v.week] = byWeek[v.week] || []).push(v); });
  for (const [w, list] of Object.entries(byWeek)) {
    if (list.length > 2 || (list.length === 2 && !list.some((v) => v.role === 'real_match_slot'))) errs.push(`week ${w}: too many long videos (${list.map((v) => v.id).join(', ')})`);
    if (list.length === 2 && list[0].day && list[0].day === list[1].day) errs.push(`week ${w}: two long videos on the same day`);
  }
  // rotation: every window of 4 has >= 3 different competitions and maps; whole plan uses each >= 2 times
  for (let i = 0; i + 4 <= V.length; i++) {
    const w = V.slice(i, i + 4);
    if (new Set(w.map((v) => v.competition)).size < 3) errs.push(`videos ${i + 1}-${i + 4}: fewer than 3 different competitions`);
    if (new Set(w.map((v) => v.map)).size < 3) errs.push(`videos ${i + 1}-${i + 4}: fewer than 3 different map themes`);
  }
  for (const c of COMPS) if (V.filter((v) => v.competition === c).length < 2) errs.push(`competition "${c}" used fewer than 2 times`);
  for (const m of MAPS) if (V.filter((v) => v.map === m).length < 2) errs.push(`map theme "${m}" used fewer than 2 times`);
  // uniqueness vs the previous 5 videos
  const fps = all.map(fingerprint);
  const uq = fps.map((f, i) => {
    const prev = fps.slice(Math.max(0, i - 5), i).map((p) => ({ id: p.id, similarity: similarity(f, p) }));
    const max = prev.length ? Math.max(...prev.map((p) => p.similarity)) : 0;
    if (i >= H.length && max > THRESHOLD) errs.push(`video ${i - H.length + 1} (${f.id}): similarity ${max} > ${THRESHOLD} vs one of the previous 5 videos`);
    return Object.assign({}, f, { history: i < H.length, vs_previous_5: prev, max_similarity: max });
  });
  return { ok: errs.length === 0, errors: errs, uniqueness: { threshold: THRESHOLD, formula: '0.30 map + 0.30 competition + 0.15 accent closeness + 0.10 music profile + 0.15 bracket overlap', videos: uq } };
}

module.exports = { validatePlan, similarity, fingerprint, THRESHOLD };
if (require.main === module) {
  const f = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, 'content_plan.json'));
  const r = validatePlan(JSON.parse(fs.readFileSync(f, 'utf8')));
  if (r.uniqueness && !process.argv.includes('--no-write')) fs.writeFileSync(path.join(__dirname, 'uniqueness.json'), JSON.stringify(r.uniqueness, null, 1) + '\n');
  if (!r.ok) { console.error('PLAN INVALID:\n - ' + r.errors.join('\n - ')); process.exit(1); }
  console.log(`plan OK: ${f} (${r.uniqueness.videos.length} videos incl. history, max similarity ${Math.max(...r.uniqueness.videos.filter((v) => !v.history).map((v) => v.max_similarity))} <= ${THRESHOLD})`);
}
