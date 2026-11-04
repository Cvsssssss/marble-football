'use strict';
// Knockout bracket seeding.
// buildBracket(teams, forcedPairs) -> { slots: [teamIndex x N], ties: [[a,b], ...], notes: [] }
//   teams: list in league-position order (index 0 = 1st). Default seeding = standard snake order
//   (1v16, 8v9, 4v13, 5v12 | 2v15, 7v10, 3v14, 6v11): 1st and 2nd can only meet in the final, top 4 not before the semis.
//   Ties are listed in bracket order: winners of tie 2k and 2k+1 meet in the next round.
//   With the symmetric layout the first half of the ties is drawn on the left, the second half on the right.
// forcedPairs: [{ a: teamId|index, b: teamId|index, round: 'R16' | 'QF' }]
//   R16: a and b play each other in the round of 16.
//   QF : a and b are placed in sibling round-of-16 ties, so they meet in the quarter-final IF both win their tie
//        (winners are never chosen by hand; the simulation decides).
// The team moved is always b (swapped with the team currently in the target slot); slots of earlier forced pairs are locked.

function seedOrder(n) {
  let order = [1, 2];
  while (order.length < n) {
    const m = order.length * 2 + 1;
    order = order.flatMap((s) => [s, m - s]);
  }
  return order; // 16 -> 1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11
}

function buildBracket(teams, forcedPairs) {
  const n = teams.length;
  if (![4, 8, 16, 32].includes(n)) throw new Error('buildBracket: number of teams must be 4, 8, 16 or 32');
  const idx = (x) => {
    if (typeof x === 'number') return x;
    const i = teams.findIndex((t) => (typeof t === 'string' ? t : t.id) === x);
    if (i < 0) throw new Error(`buildBracket: forced pair team "${x}" is not in the competition`);
    return i;
  };
  const slots = seedOrder(n).map((s) => s - 1);
  const locked = new Set();
  const notes = [];
  const swap = (i, j) => { const t = slots[i]; slots[i] = slots[j]; slots[j] = t; };
  for (const fp of forcedPairs || []) {
    const a = idx(fp.a), b = idx(fp.b), round = fp.round || 'R16';
    if (a === b) throw new Error('buildBracket: a forced pair needs two different teams');
    const pa = slots.indexOf(a), pb = slots.indexOf(b);
    if (round === 'R16') {
      const target = pa ^ 1;
      if (pb !== target) {
        if (locked.has(target) || locked.has(pb) || locked.has(pa)) throw new Error(`buildBracket: forced pair ${fp.a} vs ${fp.b} conflicts with an earlier forced pair`);
        swap(pb, target);
      }
      locked.add(pa); locked.add(target);
      notes.push(`forced R16 tie: ${fp.a} vs ${fp.b}`);
    } else if (round === 'QF') {
      const sib = ((pa >> 1) ^ 1) * 2; // first slot of the sibling tie
      if (pb !== sib && pb !== sib + 1) {
        const target = !locked.has(sib) ? sib : sib + 1;
        if (locked.has(target) || locked.has(pb) || locked.has(pa)) throw new Error(`buildBracket: forced pair ${fp.a} vs ${fp.b} conflicts with an earlier forced pair`);
        swap(pb, target);
      }
      locked.add(pa); locked.add(slots.indexOf(b));
      notes.push(`forced QF path: ${fp.a} and ${fp.b} in sibling ties (they meet in the quarter-final if both go through)`);
    } else throw new Error('buildBracket: round must be R16 or QF');
  }
  const ties = [];
  for (let i = 0; i < n; i += 2) {
    // the better-placed team is listed first (team A, left on the scoreboard)
    const x = slots[i], y = slots[i + 1];
    ties.push(x < y ? [x, y] : [y, x]);
  }
  return { slots, ties, notes };
}

module.exports = { buildBracket, seedOrder };
