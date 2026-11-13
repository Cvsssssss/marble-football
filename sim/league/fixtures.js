'use strict';
// P7 §2: double round-robin fixture generator (20 clubs, 38 matchweeks x 10 matches), generated ONCE from the season
// seed and saved to league/<season>/fixtures.json.
//   1. circle method -> 19 rounds of 10 pairings; canonical orientation (see homeFirst)
//   2. first half = the 19 rounds in circle order (start, direction), second half = the same rounds rotated by r with
//      venues swapped (a different order); only combinations with no club 3 home / 3 away in a row are kept
//   3. hill climbing with seeded random restarts on the club -> slot permutation for an even spread of strong
//      opponents: for every club, the average rating of its opponents in each block of 10 weeks stays within BAND_TOL
//      of its season average; at most MAX_TOP_IN_5 matches against the top-6 clubs in any 5 consecutive weeks; the two
//      meetings of a pair are at least MIN_GAP weeks apart
// Deterministic: same clubs + ratings + seed -> identical fixtures (mulberry32 only, no Math.random).
const { mulberry32 } = require('../engine');

const N_TEAMS = 20, ROUNDS = 19, WEEKS = 38, PER_WEEK = 10;
const BLOCKS = [[0, 10], [10, 20], [20, 30], [30, 38]];
const MIN_GAP = 6, MAX_TOP_IN_5 = 3, TOP_N = 6, BAND_TOL = 0.10; // BAND_TOL: max |block avg - season avg| (rating units = 2025/26 points per game)

function circleRounds() {
  // slots 0..18 rotate, slot 19 fixed. Round k: (19, k) and (k+j, k-j) mod 19, j = 1..9
  const R = [];
  for (let k = 0; k < ROUNDS; k++) {
    const pr = [[19, k]];
    for (let j = 1; j <= 9; j++) pr.push([(k + j) % 19, (k - j + 19) % 19]);
    R.push(pr);
  }
  return R;
}
const shuffle = (a, rng) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// opponent per (club, week) for a candidate (perm: slot -> club, P1/P2: week -> round)
function oppTable(R, perm, P1, P2) {
  const opp = Array.from({ length: N_TEAMS }, () => new Array(WEEKS));
  const put = (w, k) => { for (const [a, b] of R[k]) { const x = perm[a], y = perm[b]; opp[x][w] = y; opp[y][w] = x; } };
  for (let w = 0; w < ROUNDS; w++) { put(w, P1[w]); put(ROUNDS + w, P2[w]); }
  return opp;
}

// spread metrics of an opponent table; ratings[club]
function spread(opp, ratings) {
  const top = new Set(ratings.map((r, i) => [r, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, TOP_N).map((x) => x[1]));
  let maxDev = 0, sumSq = 0, maxTop5 = 0, minGap = WEEKS;
  for (let t = 0; t < N_TEAMS; t++) {
    const o = opp[t], all = o.reduce((s, x) => s + ratings[x], 0) / WEEKS;
    for (const [a, b] of BLOCKS) {
      let s = 0; for (let w = a; w < b; w++) s += ratings[o[w]];
      const d = Math.abs(s / (b - a) - all); maxDev = Math.max(maxDev, d); sumSq += d * d;
    }
    for (let w = 0; w + 5 <= WEEKS; w++) { let c = 0; for (let q = w; q < w + 5; q++) if (top.has(o[q])) c++; maxTop5 = Math.max(maxTop5, c); }
    const first = new Map();
    for (let w = 0; w < WEEKS; w++) { if (first.has(o[w])) minGap = Math.min(minGap, w - first.get(o[w])); else first.set(o[w], w); }
  }
  return { maxDev, sumSq, maxTop5, minGap };
}
function cost(opp, ratings, P1, P2) {
  const s = spread(opp, ratings);
  let samePos = 0; for (let w = 0; w < ROUNDS; w++) if (P1[w] === P2[w]) samePos++;
  return s.sumSq + 4 * Math.max(0, s.maxDev - BAND_TOL) + 2 * Math.max(0, s.maxTop5 - MAX_TOP_IN_5) + 2 * Math.max(0, MIN_GAP - s.minGap) + samePos;
}

// home/away (canonical circle-method orientation): pair 0 of round k (fixed slot 19 vs slot k): slot 19 at home in
// odd rounds; pair j >= 1: first listed slot at home when j is odd. With the rounds in circle order (any start,
// either direction) this alternates H/A with few breaks; the second half is the first half rotated by r rounds with
// venues swapped. Only (start, direction, r) combinations with no 3 home/away in a row and pair gaps >= MIN_GAP are kept.
const homeFirst = (k, j) => (j === 0 ? k % 2 === 1 : j % 2 === 1);
function orderCandidates(R) {
  const out = [];
  for (let start = 0; start < ROUNDS; start++) for (const dir of [1, -1]) for (let r = 1; r < ROUNDS; r++) {
    const P1 = [...Array(ROUNDS).keys()].map((w) => (((start + dir * w) % ROUNDS) + ROUNDS) % ROUNDS);
    const P2 = P1.map((_, w) => P1[(w + r) % ROUNDS]);
    const S = Array.from({ length: N_TEAMS }, () => new Array(WEEKS));
    const put = (k, w, swap) => R[k].forEach(([a, b], j) => { const h = homeFirst(k, j) !== swap; S[a][w] = h; S[b][w] = !h; });
    P1.forEach((k, w) => put(k, w, false)); P2.forEach((k, w) => put(k, ROUNDS + w, true));
    if (S.some((s) => /HHH|AAA/.test(s.map((h) => (h ? 'H' : 'A')).join('')))) continue;
    const gap = Math.min(...P1.map((k, w) => ROUNDS + P2.indexOf(k) - w));
    if (gap < MIN_GAP) continue;
    out.push({ start, dir, r, P1, P2 });
  }
  return out;
}

// clubs: [id], ratings: [number] (same order), seed: integer. Returns { weeks: [[{home, away}] x10] x38, meta }
function generateFixtures(clubs, ratings, seed, opts) {
  opts = opts || {};
  if (clubs.length !== N_TEAMS) throw new Error(`fixtures: need ${N_TEAMS} clubs, got ${clubs.length}`);
  const rng = mulberry32(seed >>> 0);
  const R = circleRounds();
  const cands = orderCandidates(R);
  if (!cands.length) throw new Error('fixtures: no valid round order');
  const restarts = opts.restarts || 8, iters = opts.iters || 4000;
  let best = null;
  for (let rs = 0; rs < restarts; rs++) {
    const cd = cands[Math.floor(rng() * cands.length)];
    const perm = shuffle([...Array(N_TEAMS).keys()], rng);
    let c = cost(oppTable(R, perm, cd.P1, cd.P2), ratings, cd.P1, cd.P2);
    for (let it = 0; it < iters; it++) {
      const i = Math.floor(rng() * N_TEAMS), j = Math.floor(rng() * N_TEAMS); if (i === j) continue;
      [perm[i], perm[j]] = [perm[j], perm[i]];
      const c2 = cost(oppTable(R, perm, cd.P1, cd.P2), ratings, cd.P1, cd.P2);
      if (c2 <= c) c = c2; else [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    if (!best || c < best.c) best = { c, perm: perm.slice(), cd, restart: rs };
  }
  const { perm, cd } = best;
  const weeks = [];
  const add = (k, secondHalf) => weeks.push(R[k].map(([a, b], j) => {
    const firstHome = homeFirst(k, j) !== secondHalf;
    return firstHome ? { home: clubs[perm[a]], away: clubs[perm[b]] } : { home: clubs[perm[b]], away: clubs[perm[a]] };
  }));
  cd.P1.forEach((k) => add(k, false)); cd.P2.forEach((k) => add(k, true));
  // inside a matchweek: lower profile first, the biggest match (highest sum of ratings) last
  const rat = new Map(clubs.map((c, i) => [c, ratings[i]]));
  weeks.forEach((wk) => wk.sort((x, y) => (rat.get(x.home) + rat.get(x.away)) - (rat.get(y.home) + rat.get(y.away)) || (x.home < y.home ? -1 : 1)));
  const idx = new Map(clubs.map((c, i) => [c, i]));
  const opp = Array.from({ length: N_TEAMS }, () => new Array(WEEKS));
  weeks.forEach((wk, w) => wk.forEach((m) => { opp[idx.get(m.home)][w] = idx.get(m.away); opp[idx.get(m.away)][w] = idx.get(m.home); }));
  return { weeks, meta: Object.assign({ seed, restarts, iters, candidates: cands.length, order: { start: cd.start, dir: cd.dir, rotation: cd.r }, cost: +best.c.toFixed(5) }, roundStats(spread(opp, ratings))) };
}
const roundStats = (s) => ({ maxBlockDev: +s.maxDev.toFixed(4), maxTopIn5: s.maxTop5, minGapWeeks: s.minGap });

// full constraint check of a fixtures object (tests + loader). Returns a list of problems (empty = valid)
function checkFixtures(fx, clubs, ratings) {
  const errs = [];
  const W = fx.weeks;
  if (W.length !== WEEKS) errs.push(`weeks: ${W.length} (need ${WEEKS})`);
  const idx = new Map(clubs.map((c, i) => [c, i]));
  const meet = new Map(), home = new Map(clubs.map((c) => [c, 0])), seq = new Map(clubs.map((c) => [c, []]));
  W.forEach((wk, w) => {
    if (wk.length !== PER_WEEK) errs.push(`week ${w + 1}: ${wk.length} matches`);
    const seen = new Set();
    wk.forEach((m) => {
      for (const c of [m.home, m.away]) { if (!idx.has(c)) errs.push(`week ${w + 1}: unknown club ${c}`); if (seen.has(c)) errs.push(`week ${w + 1}: ${c} plays twice`); seen.add(c); }
      const k = m.home + '>' + m.away; meet.set(k, (meet.get(k) || 0) + 1);
      home.set(m.home, home.get(m.home) + 1); seq.get(m.home).push('H'); seq.get(m.away).push('A');
    });
  });
  for (const a of clubs) for (const b of clubs) if (a !== b && meet.get(a + '>' + b) !== 1) errs.push(`${a} at home vs ${b}: ${meet.get(a + '>' + b) || 0} times (need 1)`);
  for (const c of clubs) { if (home.get(c) !== 19) errs.push(`${c}: ${home.get(c)} home matches (need 19)`); if (/HHH|AAA/.test(seq.get(c).join(''))) errs.push(`${c}: 3 home or away matches in a row`); }
  // mirror: week 20+i is a round of the first half with venues swapped, in a different order
  const key = (wk, swap) => wk.map((m) => (swap ? m.away + '>' + m.home : m.home + '>' + m.away)).sort().join(',');
  const first = W.slice(0, 19).map((wk) => key(wk, true)), second = W.slice(19).map((wk) => key(wk, false));
  if (first.slice().sort().join('|') !== second.slice().sort().join('|')) errs.push('second half is not the first half with venues swapped');
  if (first.join('|') === second.join('|')) errs.push('second half has the same order as the first');
  if (ratings) {
    const opp = Array.from({ length: clubs.length }, () => new Array(WEEKS));
    W.forEach((wk, w) => wk.forEach((m) => { opp[idx.get(m.home)][w] = idx.get(m.away); opp[idx.get(m.away)][w] = idx.get(m.home); }));
    const s = spread(opp, ratings);
    if (s.maxDev > BAND_TOL) errs.push(`strength spread: a club's opponent average in a 10-week block deviates ${s.maxDev.toFixed(3)} from its season average (max ${BAND_TOL})`);
    if (s.maxTop5 > MAX_TOP_IN_5) errs.push(`a club meets ${s.maxTop5} top-${TOP_N} clubs in 5 consecutive weeks (max ${MAX_TOP_IN_5})`);
    if (s.minGap < MIN_GAP) errs.push(`two meetings of a pair only ${s.minGap} weeks apart (min ${MIN_GAP})`);
    W.forEach((wk, w) => { for (let i = 1; i < wk.length; i++) { const p = (m) => ratings[idx.get(m.home)] + ratings[idx.get(m.away)]; if (p(wk[i]) < p(wk[i - 1]) - 1e-9) { errs.push(`week ${w + 1}: matches not ordered by profile`); break; } } });
  }
  return errs;
}

module.exports = { generateFixtures, checkFixtures, spread, N_TEAMS, WEEKS, PER_WEEK, BAND_TOL, MAX_TOP_IN_5, MIN_GAP, TOP_N, BLOCKS };
