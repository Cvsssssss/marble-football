'use strict';
// P7: league table. Points 3/1/0 (config). Tie-break order (config.tiebreak): points, goal difference, goals scored,
// head-to-head points among the tied clubs (mini-table), then a deterministic seeded draw (fixed per club and season,
// never shown as "random").
const crypto = require('crypto');

function emptyRow(id) { return { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, form: [] }; }

// results: [{ home, away, hg, ag }] in played order. Returns rows sorted with positions + zones
function table(clubs, results, lg, opts) {
  opts = opts || {};
  const P = (lg && lg.points) || { win: 3, draw: 1, loss: 0 };
  const rows = new Map(clubs.map((c) => [c, emptyRow(c)]));
  for (const m of results) {
    const h = rows.get(m.home), a = rows.get(m.away);
    if (!h || !a) throw new Error(`table: unknown club in ${m.home}-${m.away}`);
    h.p++; a.p++; h.gf += m.hg; h.ga += m.ag; a.gf += m.ag; a.ga += m.hg;
    if (m.hg > m.ag) { h.w++; a.l++; h.pts += P.win; a.pts += P.loss; h.form.push('W'); a.form.push('L'); }
    else if (m.hg < m.ag) { a.w++; h.l++; a.pts += P.win; h.pts += P.loss; h.form.push('L'); a.form.push('W'); }
    else { h.d++; a.d++; h.pts += P.draw; a.pts += P.draw; h.form.push('D'); a.form.push('D'); }
  }
  for (const r of rows.values()) { r.gd = r.gf - r.ga; r.form = r.form.slice(-5); }
  const order = sortRows([...rows.values()], results, lg, opts.seed);
  order.forEach((r, i) => { r.pos = i + 1; r.zone = zoneOf(lg, i + 1); });
  return order;
}

// seeded draw key: fixed per (season seed, club) so the order of fully tied clubs never flips between weeks
const drawKey = (seed, id) => crypto.createHash('sha256').update(`${seed}|${id}`).digest('hex');

function sortRows(rows, results, lg, seed) {
  const tb = (lg && lg.tiebreak) || ['points', 'goal_difference', 'goals_for', 'head_to_head_points', 'seeded_draw'];
  seed = seed !== undefined ? seed : (lg && lg.season_seed) || 0;
  const basic = { points: (r) => r.pts, goal_difference: (r) => r.gd, goals_for: (r) => r.gf };
  // split into groups by the leading basic criteria, then resolve each group with h2h / seeded draw
  const lead = [];
  for (const k of tb) { if (basic[k]) lead.push(basic[k]); else break; }
  const rest = tb.slice(lead.length);
  const cmpLead = (a, b) => { for (const f of lead) { const d = f(b) - f(a); if (d) return d; } return 0; };
  rows.sort((a, b) => cmpLead(a, b) || (a.id < b.id ? -1 : 1));
  const out = [];
  for (let i = 0; i < rows.length;) {
    let j = i + 1; while (j < rows.length && cmpLead(rows[i], rows[j]) === 0) j++;
    out.push(...resolve(rows.slice(i, j), rest, results, lg, seed));
    i = j;
  }
  return out;
}

function resolve(group, rest, results, lg, seed) {
  if (group.length < 2 || !rest.length) return group;
  const [k, ...more] = rest;
  if (k === 'seeded_draw') return group.slice().sort((a, b) => (drawKey(seed, a.id) < drawKey(seed, b.id) ? -1 : 1));
  if (k === 'head_to_head_points') {
    const ids = new Set(group.map((r) => r.id));
    const P = (lg && lg.points) || { win: 3, draw: 1, loss: 0 };
    const hp = new Map(group.map((r) => [r.id, 0]));
    for (const m of results) {
      if (!ids.has(m.home) || !ids.has(m.away)) continue;
      if (m.hg > m.ag) { hp.set(m.home, hp.get(m.home) + P.win); hp.set(m.away, hp.get(m.away) + P.loss); }
      else if (m.hg < m.ag) { hp.set(m.away, hp.get(m.away) + P.win); hp.set(m.home, hp.get(m.home) + P.loss); }
      else { hp.set(m.home, hp.get(m.home) + P.draw); hp.set(m.away, hp.get(m.away) + P.draw); }
    }
    const g = group.slice().sort((a, b) => hp.get(b.id) - hp.get(a.id) || (a.id < b.id ? -1 : 1));
    const out = [];
    for (let i = 0; i < g.length;) { let j = i + 1; while (j < g.length && hp.get(g[j].id) === hp.get(g[i].id)) j++; out.push(...resolve(g.slice(i, j), more, results, lg, seed)); i = j; }
    return out;
  }
  return resolve(group, more, results, lg, seed);
}

function zoneOf(lg, pos) { const z = ((lg && lg.zones) || []).find((x) => pos >= x.from && pos <= x.to); return z ? z.id : null; }

// short console table (Romanian headers)
function formatTable(rows, teamsById, lg) {
  const zl = new Map(((lg && lg.zones) || []).map((z) => [z.id, z.label]));
  const name = (id) => (teamsById && teamsById[id] ? teamsById[id].name : id);
  const lines = [' #  Club                      M   V   E   Î   GM-GP   GD   Pct  Formă   Zonă'];
  for (const r of rows) {
    lines.push(`${String(r.pos).padStart(2)}  ${name(r.id).padEnd(24).slice(0, 24)} ${String(r.p).padStart(2)}  ${String(r.w).padStart(2)}  ${String(r.d).padStart(2)}  ${String(r.l).padStart(2)}  ${String(r.gf).padStart(3)}-${String(r.ga).padEnd(3)} ${(r.gd > 0 ? '+' : '') + r.gd}`.padEnd(62) + `${String(r.pts).padStart(3)}  ${r.form.join('').padEnd(5)}   ${r.zone ? zl.get(r.zone) : ''}`);
  }
  return lines.join('\n');
}

module.exports = { table, sortRows, zoneOf, formatTable, drawKey };
