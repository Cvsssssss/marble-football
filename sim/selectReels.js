'use strict';
// Reel selection (P6: ONE reel per long video), driven by matches_index.json of the long video.
// Candidates: round of 16 / quarter-final matches only (never semifinal or final) whose reel fits <= 60 s.
// 1) comeback matches, ranked by the drama score below; 2) fallback (no comeback among the candidates): the match
//    with the latest winning goal (then most goals). Deterministic: ties broken by the match order.
// Drama score (documented in reports/P6_REPORT.md):
//    3.0 x deficit overturned (goals the winner was behind)  +  minute of the winning goal / 30 (0..~3.2)
//    + 0.25 x goals in the match  +  1.0 if the winning goal came in added time (90+)
// Usage: node sim/selectReels.js [output/matches_index.json] [output/reels/selection.json]
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const EARLY = /^(ROUND OF 16|QUARTER-FINAL)/;

const minuteValue = (s) => { const m = String(s).match(/^(\d+)(?:\+(\d+))?/); return m ? +m[1] + (m[2] ? +m[2] / 10 : 0) : 0; };

// decisive goal = the goal that put the eventual winner ahead for good (leg 2: on aggregate)
function decisiveMinute(m) {
  if (!m.winner) return 0;
  const isA = m.winner === m.team_a;
  let a = 0, b = 0;
  if (m.leg === 'LEG 2' && m.aggregate) { a = m.aggregate[0] - m.score[0]; b = m.aggregate[1] - m.score[1]; }
  let last = 0;
  for (const g of m.goals) {
    const wasAhead = isA ? a > b : b > a;
    if (g.team === m.team_a) a++; else b++;
    const ahead = isA ? a > b : b > a;
    if (ahead && !wasAhead) last = minuteValue(g.minute);
  }
  return last;
}
function dramaScore(m) {
  const late = decisiveMinute(m);
  return +(3 * (m.comeback ? m.comeback_depth : 0) + late / 30 + 0.25 * m.goals.length + (late > 90 ? 1 : 0)).toFixed(3);
}

function selectReel(index) {
  const early = index.matches.filter((m) => EARLY.test(m.stage) && m.goals.length > 0);
  const cands = early.filter((m) => m.comeback);
  let pick, rule;
  if (cands.length) {
    const scored = cands.map((m) => ({ m, s: dramaScore(m) })).sort((x, y) => y.s - x.s || x.m.index - y.m.index);
    pick = scored[0]; rule = 'best comeback (drama score)';
  } else {
    const scored = early.filter((m) => m.winner).map((m) => ({ m, s: dramaScore(m), late: decisiveMinute(m) }))
      .sort((x, y) => y.late - x.late || y.m.goals.length - x.m.goals.length || x.m.index - y.m.index);
    pick = scored[0] || (early[0] && { m: early[0], s: dramaScore(early[0]) }); rule = 'FALLBACK: no comeback in R16/QF -> latest winning goal';
  }
  // P8 last resort: no R16/QF match fits <= 59 s at normal speed (index is pre-filtered by the caller) -> any later match
  if (!pick) {
    const any = index.matches.filter((m) => m.goals.length > 0 && m.winner).map((m) => ({ m, s: dramaScore(m) })).sort((x, y) => y.s - x.s || x.m.index - y.m.index);
    if (any.length) { pick = any[0]; rule = 'LAST RESORT: no R16/QF match fits at normal speed -> best drama score of any round'; }
  }
  const reels = [];
  if (pick) {
    const m = pick.m;
    reels.push({
      rank: 1, id: m.id, index: m.index, stage: m.stage, leg: m.leg, team_a: m.team_a, team_b: m.team_b, seed: m.seed, timeline_hash: m.timeline_hash,
      score: m.score, aggregate: m.aggregate, winner: m.winner, comeback: !!m.comeback, comeback_depth: m.comeback ? m.comeback_depth : 0, drama_score: pick.s,
      why: `${rule}: ${m.comeback ? 'came back from ' + m.comeback_depth + ' down' : 'no comeback'}; winning goal at ${decisiveMinute(m)}'; ${m.goals.length} goals; score ${pick.s}`,
      long_video: { start_s: m.start_s, match_start_s: m.match_start_s, match_end_s: m.match_end_s, end_s: m.end_s },
    });
  }
  return { competition: index.competition, rule: 'ONE reel: best comeback of the round of 16 / quarter-finals by drama score; fallback latest winning goal',
    fallback: !cands.length, candidates: cands.length, reels };
}
// kept for older callers: always one reel now
const selectReels = (index) => selectReel(index);

module.exports = { selectReel, selectReels, decisiveMinute, dramaScore };
if (require.main === module) {
  const inF = path.resolve(ROOT, process.argv[2] || 'output/matches_index.json');
  const outF = path.resolve(ROOT, process.argv[3] || 'output/reels/selection.json');
  const sel = selectReel(JSON.parse(fs.readFileSync(inF, 'utf8')));
  fs.mkdirSync(path.dirname(outF), { recursive: true });
  fs.writeFileSync(outF, JSON.stringify(sel, null, 1));
  console.log(sel.reels.map((r) => `${r.id} ${r.team_a} vs ${r.team_b} ${r.score.join('-')} (${r.why})`).join('\n'));
}
