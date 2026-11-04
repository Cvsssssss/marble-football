'use strict';
// Knockout bracket: balanced, seeded-random draw (P5).
// buildBracket(teams, forcedPairs, opts) -> { slots: [teamIndex x N], ties: [[a,b], ...], pots: [[teamIndex]], notes: [] }
//   teams: competition team ids (or objects with .id) in league-position order.
//   opts.strengths: number per team (higher = stronger; default: list order). Pots by strength rank:
//     16 teams -> pot 1 = ranks 1-4, pot 2 = 5-8, pot 3 = 9-12, pot 4 = 13-16 (n/4 teams per pot).
//   opts.seed: draw seed (integer). Same seed -> same draw; another seed -> another draw.
//   Constraints: every quarter of the bracket (4 consecutive slots = one quarter-final path) gets exactly one team of
//   every pot, so every half gets two of every pot and the top-4 teams can only meet in the semifinals or later.
//   Within a quarter the four teams are placed in random slots (no fixed "1 vs 16" pattern).
//   Slots are in bracket order: winners of tie 2k and 2k+1 meet in the next round. The first half of the ties is the
//   left/top part of the drawn bracket (layout unchanged).
// forcedPairs: [{ a: teamId|index, b: teamId|index, round: 'R16' | 'QF' }]
//   R16: a and b play each other in the round of 16.  QF: a and b in sibling R16 ties (they meet in the quarter-final
//   IF both win; winners are never chosen by hand). If a and b are in different pots, b is swapped with the team of
//   its own pot in a's quarter, so all draw constraints still hold. Same pot: impossible without breaking the
//   one-per-pot rule, so b is moved anyway and a note says the constraint was relaxed for that quarter.
// For n = 4 the draw has 2 pots (1-2, 3-4) and the "quarter" is one half (2 slots).

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rng) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

// legacy snake order (pre-P5 default), kept for reference/tests: 16 -> 1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11
function seedOrder(n) {
  let order = [1, 2];
  while (order.length < n) {
    const m = order.length * 2 + 1;
    order = order.flatMap((s) => [s, m - s]);
  }
  return order;
}

function potsOf(n, strengths) {
  const rank = Array.from({ length: n }, (_, i) => i).sort((a, b) => (strengths[b] - strengths[a]) || (a - b));
  const P = n === 4 ? 2 : 4, per = n / P;
  return Array.from({ length: P }, (_, p) => rank.slice(p * per, (p + 1) * per));
}

function buildBracket(teams, forcedPairs, opts) {
  opts = opts || {};
  const n = teams.length;
  if (![4, 8, 16, 32].includes(n)) throw new Error('buildBracket: number of teams must be 4, 8, 16 or 32');
  const idx = (x) => {
    if (typeof x === 'number') return x;
    const i = teams.findIndex((t) => (typeof t === 'string' ? t : t.id) === x);
    if (i < 0) throw new Error(`buildBracket: forced pair team "${x}" is not in the competition`);
    return i;
  };
  const strengths = opts.strengths || teams.map((_, i) => n - i);
  const rng = mulberry32(((opts.seed === undefined ? 1 : opts.seed) ^ 0x7f4a7c15) >>> 0);
  const pots = potsOf(n, strengths);
  const P = pots.length, Q = n / P; // Q quarters (groups) of P slots
  const potOf = new Array(n); pots.forEach((pt, p) => pt.forEach((t) => (potOf[t] = p)));
  // group[q] = one team of each pot, then random slot order inside the group
  const permByPot = pots.map((pt) => shuffle(pt.slice(), rng));
  const groups = Array.from({ length: Q }, (_, q) => shuffle(pots.map((_, p) => permByPot[p][q]), rng));
  const slots = groups.flat();
  const notes = [`balanced draw (seed ${opts.seed === undefined ? 1 : opts.seed}): ${P} pots by strength rank, one team of every pot per quarter`];
  const locked = new Set();
  const swap = (i, j) => { const t = slots[i]; slots[i] = slots[j]; slots[j] = t; };
  const qOf = (s) => Math.floor(s / P);
  for (const fp of forcedPairs || []) {
    const a = idx(fp.a), b = idx(fp.b), round = fp.round || 'R16';
    if (a === b) throw new Error('buildBracket: a forced pair needs two different teams');
    if (round !== 'R16' && round !== 'QF') throw new Error('buildBracket: round must be R16 or QF');
    if (round === 'QF' && P < 4) throw new Error('buildBracket: a QF forced pair needs at least 8 teams');
    let pa = slots.indexOf(a), pb = slots.indexOf(b);
    const qa = qOf(pa);
    // 1) bring b into a's quarter (swap with the team of b's pot in that quarter = draw constraints kept)
    if (qOf(pb) !== qa) {
      let target = -1;
      if (potOf[a] !== potOf[b]) target = slots.findIndex((t, s) => qOf(s) === qa && potOf[t] === potOf[b]);
      else {
        target = slots.findIndex((t, s) => qOf(s) === qa && t !== a && !locked.has(s) && (round === 'R16' ? s === (pa ^ 1) : (s >> 1) !== (pa >> 1)));
        notes.push(`forced pair ${fp.a} vs ${fp.b}: same pot, one-team-per-pot relaxed in that quarter`);
      }
      if (target < 0 || locked.has(target) || locked.has(pb)) throw new Error(`buildBracket: forced pair ${fp.a} vs ${fp.b} conflicts with an earlier forced pair`);
      swap(pb, target); pb = target;
    }
    // 2) inside the quarter: R16 -> b next to a; QF -> b in the sibling tie
    if (round === 'R16' && pb !== (pa ^ 1)) {
      const target = pa ^ 1;
      if (locked.has(target) || locked.has(pb)) throw new Error(`buildBracket: forced pair ${fp.a} vs ${fp.b} conflicts with an earlier forced pair`);
      swap(pb, target); pb = target;
    } else if (round === 'QF' && (pb >> 1) === (pa >> 1)) {
      const sib = ((pa >> 1) ^ 1) * 2;
      const target = !locked.has(sib) ? sib : sib + 1;
      if (locked.has(target) || locked.has(pa)) throw new Error(`buildBracket: forced pair ${fp.a} vs ${fp.b} conflicts with an earlier forced pair`);
      swap(pb, target); pb = target;
    }
    if (locked.has(pa) && slots[pa] !== a) throw new Error(`buildBracket: forced pair ${fp.a} vs ${fp.b} conflicts with an earlier forced pair`);
    locked.add(slots.indexOf(a)); locked.add(slots.indexOf(b));
    notes.push(round === 'R16' ? `forced R16 tie: ${fp.a} vs ${fp.b}` : `forced QF path: ${fp.a} and ${fp.b} in sibling ties (they meet in the quarter-final if both go through)`);
  }
  const ties = [];
  for (let i = 0; i < n; i += 2) {
    // the better-placed team is listed first (team A, left on the scoreboard)
    const x = slots[i], y = slots[i + 1];
    ties.push(x < y ? [x, y] : [y, x]);
  }
  return { slots, ties, pots, notes };
}

// Draw constraint check (tests / preflight): every group of P consecutive slots holds one team of every pot.
function drawOk(slots, pots) {
  const P = pots.length, potOf = {};
  pots.forEach((pt, p) => pt.forEach((t) => (potOf[t] = p)));
  for (let q = 0; q < slots.length / P; q++) {
    const seen = new Set(slots.slice(q * P, (q + 1) * P).map((t) => potOf[t]));
    if (seen.size !== P) return false;
  }
  return true;
}

module.exports = { buildBracket, seedOrder, drawOk, potsOf };
