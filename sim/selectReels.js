'use strict';
// Reel selection (P3 A.1), driven by matches_index.json of the long video.
// Picks 3 comeback matches from the round of 16 / quarter-finals only (never semifinal or final).
// Order of preference: comeback_depth >= 2, then the latest decisive goal, then the number of goals.
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

function selectReels(index, n) {
  n = n || 3;
  const cands = index.matches.filter((m) => EARLY.test(m.stage) && m.comeback);
  const scored = cands.map((m) => ({ m, strong: m.comeback_depth >= 2 ? 1 : 0, late: decisiveMinute(m), goals: m.goals.length }));
  scored.sort((x, y) => y.strong - x.strong || y.late - x.late || y.goals - x.goals || x.m.index - y.m.index);
  const pick = scored.slice(0, n).map((s, k) => ({
    rank: k + 1, id: s.m.id, index: s.m.index, stage: s.m.stage, leg: s.m.leg, team_a: s.m.team_a, team_b: s.m.team_b, seed: s.m.seed, timeline_hash: s.m.timeline_hash,
    score: s.m.score, aggregate: s.m.aggregate, winner: s.m.winner, comeback_depth: s.m.comeback_depth,
    why: `${s.strong ? 'strong comeback (trailed by ' + s.m.comeback_depth + ')' : 'comeback (trailed by 1)'}; decisive goal at ${s.late}'; ${s.goals} goals`,
    long_video: { start_s: s.m.start_s, match_start_s: s.m.match_start_s, match_end_s: s.m.match_end_s, end_s: s.m.end_s },
  }));
  return { competition: index.competition, rule: 'comebacks from round of 16 / quarter-finals only; prefer depth >= 2, then latest decisive goal, then goal count',
    candidates: cands.length, shortfall: Math.max(0, n - pick.length), reels: pick };
}

module.exports = { selectReels, decisiveMinute };
if (require.main === module) {
  const inF = path.resolve(ROOT, process.argv[2] || 'output/matches_index.json');
  const outF = path.resolve(ROOT, process.argv[3] || 'output/reels/selection.json');
  const sel = selectReels(JSON.parse(fs.readFileSync(inF, 'utf8')));
  fs.mkdirSync(path.dirname(outF), { recursive: true });
  fs.writeFileSync(outF, JSON.stringify(sel, null, 1));
  console.log(sel.reels.map((r) => `${r.rank}. ${r.id} ${r.team_a} vs ${r.team_b} ${r.score.join('-')} (${r.why})`).join('\n'));
}
