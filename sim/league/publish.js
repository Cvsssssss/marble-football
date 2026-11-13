'use strict';
// P7 §5: league reel selection + publish texts (no thumbnails: Max makes them himself).
// Reel (ONE per matchweek, deterministic, full-pitch P6 layout, reel must fit <= 55 s):
//   1) best comeback of the week (winner was behind), ranked by the P6 drama score; ties -> later match
//   2) else the match with the latest winning goal (then more goals, then later match)
//   3) else (only draws / no winner) the highest-scoring match (then later match)
// Texts: title pattern `Premier League Matchweek N | Marble Football Simulation 2026/27` (+2 variants), description
// with the week's results labelled as simulated, the top of the table as text, chapters, disclaimer and hashtags
// (#PremierLeague #EPL #MarbleFootball first). Never player names.
const PUB = require('../publish');
const { dramaScore, decisiveMinute } = require('../selectReels');
const { buildReel, TARGET_MAX } = require('../reels');

const REEL_OPTS = { ffSpeed: 4, ffMaxOut: 2.5 }; // league matches are 90 s of play: stronger fast-forward than the cups (x2)

function selectLeagueReel(show, index) {
  const fits = (m) => buildReel(show, m.index, REEL_OPTS).seconds <= TARGET_MAX + 1;
  const cand = index.matches.filter((m) => m.goals.length > 0 && fits(m));
  const later = (a, b) => b.m.index - a.m.index;
  let pick = null, rule;
  const cb = cand.filter((m) => m.comeback && m.winner).map((m) => ({ m, s: dramaScore(m) })).sort((a, b) => b.s - a.s || later(a, b));
  if (cb.length) { pick = cb[0]; rule = 'best comeback of the week (drama score)'; }
  if (!pick) {
    const w = cand.filter((m) => m.winner).map((m) => ({ m, s: dramaScore(m), late: decisiveMinute(m) })).sort((a, b) => b.late - a.late || b.m.goals.length - a.m.goals.length || later(a, b));
    if (w.length) { pick = w[0]; rule = 'no comeback -> latest winning goal'; }
  }
  if (!pick) {
    const hs = cand.map((m) => ({ m, s: m.goals.length })).sort((a, b) => b.s - a.s || later(a, b));
    if (hs.length) { pick = hs[0]; rule = 'no winner -> highest-scoring match'; }
  }
  const reels = [];
  if (pick) {
    const m = pick.m;
    reels.push({ rank: 1, id: m.id, index: m.index, stage: m.stage, leg: m.leg, team_a: m.team_a, team_b: m.team_b, seed: m.seed, timeline_hash: m.timeline_hash, score: m.score, aggregate: null,
      winner: m.winner, comeback: !!m.comeback, comeback_depth: m.comeback ? m.comeback_depth : 0, drama_score: pick.s, rule,
      why: `${rule}: ${m.team_a} ${m.score[0]}-${m.score[1]} ${m.team_b}${m.comeback ? ', came back from ' + m.comeback_depth + ' down' : ''}`,
      long_video: { start_s: m.start_s, match_start_s: m.match_start_s, match_end_s: m.match_end_s, end_s: m.end_s } });
  }
  return { competition: index.competition, week: index.week, rule: 'ONE reel: best comeback of the week; else latest winning goal; else highest-scoring match', candidates: cand.length, reels, reel_opts: REEL_OPTS };
}

function buildLeaguePublish(show, chapters, reel) {
  const L = show.league, N = L.week, name = (ti) => show.teams[ti].name;
  const tf = show.segments.find((s) => s.type === 'lgTableFull');
  const top = tf.rows.slice(0, 5).map((r) => `${r[1]}. ${name(r[0])} ${r[8]} pts`);
  const results = show.matches.map((m) => `${name(m.ta)} ${m.score[0]}–${m.score[1]} ${name(m.tb)}`);
  const longTitles = [
    `Premier League Matchweek ${N} | Marble Football Simulation ${L.season}`,
    `Premier League Matchweek ${N}: All 10 Matches | Marble Football Simulation`,
    `Matchweek ${N} – Premier League Marble Race Simulation ${L.season}`,
  ];
  const tags = ['#PremierLeague', '#EPL', '#MarbleFootball', '#FootballSimulation', '#MarbleRace', '#Matchweek' + N, '#Football', '#Simulation', '#MarbleRun'];
  const desc = [
    `Premier League ${L.season}, matchweek ${N}: all 10 matches played out as a marble football computer simulation, with the live table after every game.`,
    '',
    `Simulated results (matchweek ${N}, not real results):`,
    ...results.map((x) => '• ' + x),
    '',
    `Top of the simulated table after matchweek ${N}:`,
    ...top.map((x) => '• ' + x),
    '',
    'Chapters:',
    chapters.trim(),
    '',
    N < 38 ? `Matchweek ${N + 1} comes next on the channel.` : 'That was the final matchweek of the simulated season, including the trophy ceremony.',
    '',
    PUB.DISCLAIMER,
    '',
    tags.join(' '),
  ].join('\n');
  let reelTitles = [], reelDescription = '';
  if (reel) {
    const res = `${reel.team_a} ${reel.score[0]}–${reel.score[1]} ${reel.team_b}`;
    const lose = reel.winner === reel.team_a ? reel.team_b : reel.team_a;
    reelTitles = (reel.comeback ? [`${reel.winner} Come Back vs ${lose}! Premier League Matchweek ${N} | Marble Simulation`] : [])
      .concat([`${res} | Premier League Matchweek ${N} Marble Simulation`, `${reel.team_a} vs ${reel.team_b}: Matchweek ${N} Drama | Marble Football Simulation`])
      .filter((t) => t.length <= PUB.LIMITS.title).slice(0, 3);
    reelDescription = [`Premier League matchweek ${N} (marble football simulation): ${res}.`, 'Full matchweek with the live table on the channel.',
      'Computer simulation, not real results. Not affiliated with any club, league or competition.', '#PremierLeague #MarbleFootball #Shorts #FootballSimulation'].join('\n');
  }
  return { longTitles, longDescription: desc, reelTitles, reelDescription, hashtags: tags };
}

function lintLeaguePublish(P, show) {
  const errs = PUB.lintPublish(P, { allowNames: [show.league.display_name, 'EPL'], playerNames: show.teams.flatMap((t) => t.players.map((p) => p.name)), teamNames: show.teams.map((t) => t.name), durationS: show.totalFrames / show.fps });
  const tags = (P.longDescription.match(/(^|\s)#[A-Za-z0-9]+/g) || []).map((x) => x.trim());
  if (tags.slice(0, 3).join(' ') !== '#PremierLeague #EPL #MarbleFootball') errs.push('long description: first hashtags must be #PremierLeague #EPL #MarbleFootball');
  if (!new RegExp(`^Premier League Matchweek ${show.league.week} \\| Marble Football Simulation ${show.league.season.replace('/', '\\/')}$`).test(P.longTitles[0])) errs.push('long title 1 must follow the league pattern');
  if (!/Simulated results/.test(P.longDescription)) errs.push('results must be labelled as simulated');
  return errs;
}

module.exports = { selectLeagueReel, buildLeaguePublish, lintLeaguePublish, REEL_OPTS };
