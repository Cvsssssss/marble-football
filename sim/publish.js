'use strict';
// P6: publish texts per run -> <run>/publish/
//   long_title.txt (3 options), long_description.txt (ready to paste, chapters inserted), reel_title.txt (3 options),
//   reel_description.txt, README_publish.txt (Romanian: where to paste, which options to set).
// Every fact comes from the show timeline (comebacks, golden balls, windmill bombs, top-scoring team). Never player
// names, never the champion in the long texts (spoiler), never official competition names. Text variety: pools of
// intros / title patterns chosen by a seed from the run, and plan/history.json "recent_titles" (last 10) avoids repeats.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');

const LIMITS = { title: 100, description: 5000, hashtags: 15, longTags: [8, 12], reelTags: [3, 5] };
// official names that must never appear in tournament texts (CLAUDE.md); league texts (P7) may use their display_name
const FORBIDDEN = ['champions league', 'europa league', 'conference league', 'uefa', 'fifa', 'world cup', 'euro 20', 'nations league', 'premier league', 'la liga', 'serie a', 'bundesliga', 'ligue 1', 'ucl', 'uel', 'epl'];
const DISCLAIMER = 'This video is a computer simulation (marble football physics). The results are not real results. It is not affiliated with, endorsed by or connected to any club, league, federation or competition. Team names are used as plain text only.';
const DISCLAIMER_SHORT = 'Computer simulation, not real results. Not affiliated with any club, league or competition.';

// seeded helpers (deterministic per run)
function rng(seedStr) { let h = parseInt(crypto.createHash('sha256').update(String(seedStr)).digest('hex').slice(0, 8), 16) >>> 0; return () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(a, r) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const tag = (s) => '#' + s.normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// facts from the show (no names of players, champion kept separately for the reel only)
function factsOf(show, opts) {
  const T = show;
  const early = (m) => m.round <= 1;
  const comebacks = T.matches.filter((m) => m.comeback && early(m)).length;
  const comebacksAll = T.matches.filter((m) => m.comeback).length;
  const golden = T.matches.filter((m) => m.goldenStart !== null).length;
  const bombs = T.matches.reduce((n, m) => n + (m.cines || []).length, 0); // windmill hits that really reach the goal mouth (slow motion)
  const goals = T.matches.reduce((n, m) => n + m.goals.length, 0);
  const addedGoals = T.matches.reduce((n, m) => n + m.goals.filter((g) => g.shot).length, 0);
  const teamGoals = new Map();
  T.matches.forEach((m) => m.goals.forEach((g) => { const ti = g.team === 'A' ? m.ta : m.tb; teamGoals.set(ti, (teamGoals.get(ti) || 0) + 1); }));
  const topTeam = [...teamGoals.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  const national = T.teams.every((t) => t.national);
  return { competition: T.competition.name, teams: T.teams.length, matches: T.matches.length, comebacks, comebacksAll, golden, bombs, goals, addedGoals,
    topTeam: topTeam ? { name: T.teams[topTeam[0]].name, goals: topTeam[1] } : null, national, map: opts.mapName || (T.map && T.map.name) || 'Marble Stadium', round: opts.round || null };
}

function longTitlePool(F) {
  const C = F.competition, kind = F.national ? 'Nations' : 'Teams';
  const p = [
    `${C}: ${F.teams} ${kind}, One Trophy | Marble Football Simulation`,
    `Marble Football ${C} – Who Lifts the Trophy? | ${F.teams}-${F.national ? 'Nation' : 'Team'} Simulation`,
    `${C} Knockout on ${F.map} | Marble Race Football Simulation`,
    `Can the Favourites Survive? ${C} | Marble Football Simulation`,
    `${F.teams} ${kind} Knockout Tournament | ${C} Marble Simulation`,
    `${C} Full Tournament | Marble Football Physics Simulation`,
    `Marbles Play Football: ${C} Knockout | Simulation`,
    `${plural(F.goals, 'Goal', 'Goals')} in One Tournament! ${C} Marble Football Simulation`,
  ];
  if (F.comebacks >= 2) p.push(`${F.comebacks} Comebacks in the Knockouts! ${C} | Marble Football Simulation`);
  if (F.golden >= 1) p.push(`${F.golden === 1 ? 'A Golden Ball Decider' : F.golden + ' Golden Ball Deciders'} | ${C} Marble Football Simulation`);
  if (F.bombs >= 10) p.push(`Windmill Bombs Everywhere! ${C} | Marble Football Simulation`);
  return p.filter((t) => t.length <= LIMITS.title);
}
const INTROS = [
  (F) => `${F.teams} ${F.national ? 'national teams' : 'clubs'} roll into the ${F.competition}, a marble football knockout decided only by physics.`,
  (F) => `Welcome to the ${F.competition}: ${F.teams} ${F.national ? 'nations' : 'teams'}, two-legged knockout ties and one original trophy, all played by marbles.`,
  (F) => `Marbles, a windmill and a goalkeeper: this is the ${F.competition}, a full ${F.teams}-${F.national ? 'nation' : 'team'} knockout tournament simulated with real physics.`,
  (F) => `Who survives the ${F.competition}? ${F.teams} ${F.national ? 'nations' : 'teams'} enter, only one lifts the trophy at the end of this marble football simulation.`,
  (F) => `Another ${F.competition} on the ${F.map} map: round of 16 to the final, every goal decided by the marble physics engine.`,
];
const HOW = [
  'How it works: each team has 3 identical marbles. A spout releases them, the spinning windmill fires them towards the goal and the goalkeeper tries to stop them. Every match lasts 90 simulated minutes plus added-time shots; a level knockout tie is decided by a golden ball.',
  'How it works: every marble has exactly the same size. The windmill launches them, the keeper jumps and crouches, and the clock runs 90 minutes plus added-time shots. Level ties after the second leg go to a golden ball.',
];
const CTA = [
  'Who do you think should have won? Tell me in the comments!',
  'Which match was your favourite? Drop the time stamp in the comments.',
  'Comment the team you want to see win the next tournament!',
  'Did your team go through? Let me know in the comments below.',
];

function facts(F) {
  const out = [`${F.matches} matches and ${plural(F.goals, 'goal', 'goals')}.`];
  if (F.comebacks) out.push(`${plural(F.comebacks, 'comeback', 'comebacks')} in the round of 16 and quarter-finals.`);
  if (F.golden) out.push(`${F.golden === 1 ? 'One tie' : F.golden + ' ties'} decided by a golden ball.`);
  else out.push('No tie needed a golden ball this time.');
  if (F.bombs) out.push(`${plural(F.bombs, 'windmill bomb', 'windmill bombs')} in added time.`);
  if (F.topTeam) out.push(`Most goals: ${F.topTeam.name} (${F.topTeam.goals}).`);
  return out;
}

function hashtagsLong(F, r) {
  const first = ['#MarbleFootball', '#FootballSimulation', tag(F.competition)];
  const rest = shuffle(['#MarbleRace', '#Simulation', '#Football', '#Soccer', '#PhysicsSimulation', '#Knockout', '#MarbleRun', '#Tournament'], r);
  if (F.comebacks) rest.unshift('#Comeback');
  if (F.golden) rest.unshift('#GoldenBall');
  return first.concat(rest).slice(0, 11);
}

function readHistory() { const f = path.join(ROOT, 'plan', 'history.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { runs: [] }; }
function recordTitles(titles) {
  const f = path.join(ROOT, 'plan', 'history.json');
  const h = readHistory();
  h.recent_titles = (h.recent_titles || []).concat(titles).filter((t, i, a) => a.indexOf(t) === i).slice(-10);
  fs.writeFileSync(f, JSON.stringify(h, null, 1) + '\n');
}

// show: tournament show; chapters: chapters.txt content; reel: selection entry (or null); opts: { seed, mapName, durationS, recentTitles }
function buildPublish(show, chapters, reel, opts) {
  opts = opts || {};
  const F = factsOf(show, opts);
  const r = rng(opts.seed || show.simHash || 'run');
  const recent = new Set(opts.recentTitles || []);
  let pool = shuffle(longTitlePool(F), r);
  const fresh = pool.filter((t) => !recent.has(t));
  const longTitles = (fresh.length >= 3 ? fresh : fresh.concat(pool.filter((t) => recent.has(t)))).slice(0, 3);
  const tags = hashtagsLong(F, r);
  const desc = [
    INTROS[Math.floor(r() * INTROS.length)](F),
    '',
    HOW[Math.floor(r() * HOW.length)],
    '',
    'In this tournament:',
    ...facts(F).map((x) => '• ' + x),
    '',
    'Chapters:',
    chapters.trim(),
    '',
    CTA[Math.floor(r() * CTA.length)],
    '',
    DISCLAIMER,
    '',
    tags.join(' '),
  ].join('\n');
  // reel
  let reelTitles = [], reelDesc = '';
  if (reel) {
    const win = reel.winner, lose = win === reel.team_a ? reel.team_b : reel.team_a;
    const res = `${reel.team_a} ${reel.score[0]}–${reel.score[1]} ${reel.team_b}`;
    const rp = [];
    if (reel.comeback && reel.comeback_depth >= 2) rp.push(`${win} Come Back From ${reel.comeback_depth} Down vs ${lose}! | Marble Football Simulation`);
    if (reel.comeback) rp.push(`What a Comeback! ${win} vs ${lose} | Marble Football Simulation`, `${lose} Were Winning… Then This Happened | Marble Simulation`);
    rp.push(`${reel.team_a} vs ${reel.team_b}: ${F.competition} Drama | Marble Football Simulation`, `${res} – Marble Football Simulation`, `Late Drama in the ${F.competition}! ${reel.team_a} vs ${reel.team_b} | Simulation`);
    reelTitles = shuffle(rp.filter((t) => t.length <= LIMITS.title && !recent.has(t)), r).slice(0, 3);
    const rtags = ['#MarbleFootball', '#Shorts', '#FootballSimulation', tag(F.competition)].slice(0, 4);
    reelDesc = [
      `${F.competition}, ${reel.stage.toLowerCase()} (${reel.leg.toLowerCase()}): ${res}${reel.aggregate && reel.leg === 'LEG 2' ? ` (aggregate ${reel.aggregate[0]}–${reel.aggregate[1]})` : ''}.`,
      'Full tournament on the channel.',
      DISCLAIMER_SHORT,
      rtags.join(' '),
    ].join('\n');
  }
  return { facts: F, longTitles, longDescription: desc, reelTitles, reelDescription: reelDesc, hashtags: tags };
}

const README_RO = [
  'CUM PUBLICI (YouTube Studio) — totul se copiază din fișierele din acest folder.',
  '',
  'VIDEOUL LUNG (long_video_1080p.mp4):',
  '1. Titlu: alege UNA dintre cele 3 variante din long_title.txt și lipește-o în „Titlu”.',
  '2. Descriere: copiază TOT textul din long_description.txt în „Descriere” (are deja capitolele, disclaimerul și hashtag-urile).',
  '3. Thumbnail: alege unul din thumbnails/.',
  '4. Public: „Nu, nu este conceput pentru copii” (Not made for kids).',
  '5. Categoria: Sport (Sports).',
  '6. Conținut modificat / sintetic (întrebarea despre AI): răspunde conform regulii YouTube; videoul este o simulare generată pe calculator (animație), nu imagini reale. Verifică formularea întrebării la momentul publicării.',
  '7. Tag-uri: opțional; hashtag-urile din descriere ajung.',
  '',
  'REEL-UL (reels/reel_*/reel.mp4) — publică-l DUPĂ videoul lung:',
  '1. Titlu: una dintre variantele din reel_title.txt.',
  '2. Descriere: copiază reel_description.txt; înlocuiește „Full tournament on the channel.” cu linkul videoului lung dacă vrei.',
  '3. Aceleași setări: nu e pentru copii, categoria Sport, aceeași întrebare despre conținut sintetic.',
  '',
  'Reguli: în texte nu apar nume de jucători și nici campionul în titlul videoului lung (spoiler). Nu adăuga nume oficiale de competiții.',
  '',
].join('\n');

function hashtagsOf(s) { return (s.match(/(^|\s)#[A-Za-z0-9]+/g) || []).map((x) => x.trim()); }
// validation used by tests and preflight. playerNames: real player names of the run; champion: name (not in long titles)
function lintPublish(P, opts) {
  opts = opts || {};
  const errs = [];
  const all = [P.longTitles.join('\n'), P.longDescription, P.reelTitles.join('\n'), P.reelDescription].join('\n');
  const low = all.toLowerCase();
  if (P.longTitles.length !== 3) errs.push('long_title: needs 3 options');
  for (const t of P.longTitles.concat(P.reelTitles)) {
    if (t.length > LIMITS.title) errs.push(`title longer than ${LIMITS.title}: ${t}`);
    if (!/simulation/i.test(t)) errs.push(`title without "Simulation": ${t}`);
  }
  if (P.longDescription.length > LIMITS.description) errs.push('long description > 5000 characters');
  const lt = hashtagsOf(P.longDescription);
  if (lt.length < LIMITS.longTags[0] || lt.length > LIMITS.longTags[1]) errs.push(`long description: ${lt.length} hashtags (8-12)`);
  if (P.reelDescription) { const rt = hashtagsOf(P.reelDescription); if (rt.length < LIMITS.reelTags[0] || rt.length > LIMITS.reelTags[1]) errs.push(`reel description: ${rt.length} hashtags (3-5)`); }
  if (!/computer simulation/i.test(P.longDescription) || !/not real results/i.test(P.longDescription) || !/not affiliated/i.test(P.longDescription)) errs.push('long description: disclaimer missing');
  if (P.reelDescription && (!/computer simulation/i.test(P.reelDescription) || !/not real results/i.test(P.reelDescription))) errs.push('reel description: disclaimer missing');
  const allowed = (opts.allowNames || []).map((x) => x.toLowerCase());
  for (const b of FORBIDDEN) {
    if (allowed.some((a) => a.includes(b))) continue;
    if (new RegExp(`(^|[^a-z])${b.replace(/ /g, '\\s+')}([^a-z]|$)`, 'i').test(low)) errs.push(`forbidden word: ${b}`);
  }
  for (const n of opts.playerNames || []) {
    const sur = n.split(' ').slice(-1)[0];
    if (all.includes(n) || (sur.length > 3 && new RegExp(`(^|[^\\p{L}])${sur}([^\\p{L}]|$)`, 'u').test(all) && !(opts.teamNames || []).some((t) => t.includes(sur)))) errs.push(`player name: ${n}`);
  }
  if (opts.champion && P.longTitles.some((t) => t.includes(opts.champion))) errs.push('champion in the long title (spoiler)');
  const ch = chaptersCheck(P.longDescription, opts.durationS);
  return errs.concat(ch);
}
// YouTube chapter rules: first at 0:00, >= 3, each >= 10 s, ascending, last < duration
function chaptersCheck(desc, durationS) {
  const errs = [];
  const ts = (desc.match(/^(\d+:)?\d{1,2}:\d{2} .+$/gm) || []).map((l) => l.split(' ')[0].split(':').map(Number).reduce((a, b) => a * 60 + b, 0));
  if (ts.length < 3) errs.push(`chapters: ${ts.length} (need >= 3)`);
  if (ts[0] !== 0) errs.push('chapters: first is not 0:00');
  for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] < 10) errs.push(`chapters: ${ts[i - 1]}s -> ${ts[i]}s shorter than 10 s`);
  if (durationS && ts.length && ts[ts.length - 1] >= durationS) errs.push('chapters: last chapter is after the end of the video');
  return errs;
}

function writePublish(dir, P) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'long_title.txt'), P.longTitles.map((t, i) => `${i + 1}. ${t}`).join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'long_description.txt'), P.longDescription + '\n');
  fs.writeFileSync(path.join(dir, 'reel_title.txt'), (P.reelTitles.length ? P.reelTitles.map((t, i) => `${i + 1}. ${t}`).join('\n') : '(fără reel în această rulare)') + '\n');
  fs.writeFileSync(path.join(dir, 'reel_description.txt'), (P.reelDescription || '(fără reel în această rulare)') + '\n');
  fs.writeFileSync(path.join(dir, 'README_publish.txt'), README_RO);
}

module.exports = { buildPublish, lintPublish, writePublish, chaptersCheck, recordTitles, readHistory, factsOf, FORBIDDEN, DISCLAIMER, LIMITS };
