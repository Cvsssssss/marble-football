'use strict';
// P7 §3: invisible strength model for league matches. All balls are identical (same radius, same look); strength only
// changes which team's ball the spout releases when it is not its turn (engine ctx.fav / ctx.edge, the P2 lever).
//   signed = beta * (eff(rating_home) - eff(rating_away)) + home_advantage      (home = team A)
//   eff(r) = r below top_compress.above, else above + factor * (r - above): the gaps AMONG the top clubs are compressed
//   (so the pre-season favourite does not win the title too often) while they keep their edge over the rest
//   fav = signed >= 0 ? 'A' : 'B', edge = min(edge_max, |signed|)
// ratings are 2025/26 points per game (sim/league/config.js ratingsOf).
function eff(strength, r) { const c = strength.top_compress; return c && r > c.above ? c.above + c.factor * (r - c.above) : r; }
function edgeFor(strength, rHome, rAway) {
  const s = strength.beta * (eff(strength, rHome) - eff(strength, rAway)) + strength.home_advantage;
  const e = Math.min(strength.edge_max, Math.abs(s));
  return { signed: +s.toFixed(5), fav: e > 0 ? (s >= 0 ? 'A' : 'B') : null, edge: +e.toFixed(5) };
}
// engine ctx for a league match (team A = home)
function leagueCtx(strength, rHome, rAway, ballRadius) {
  const E = edgeFor(strength, rHome, rAway);
  const ctx = { kind: 'league', rA: ballRadius, rB: ballRadius };
  if (E.fav) { ctx.fav = E.fav; ctx.edge = E.edge; }
  return ctx;
}

// ---- fitted outcome model (from tools/league_calibrate.js, league/<id>/calibration.json) ----
// cal.grid: [{ edge, hist: { "f-d": count } }] (fav goals - underdog goals), sorted by edge.
// sampleScore: draws a (fav, dog) score from the two nearest grid points (mixture weighted by distance).
function makeSampler(cal) {
  const G = cal.grid.map((g) => {
    const keys = Object.keys(g.hist), w = keys.map((k) => g.hist[k]), tot = w.reduce((a, b) => a + b, 0);
    let acc = 0; const cdf = w.map((x) => (acc += x) / tot);
    return { edge: g.edge, scores: keys.map((k) => k.split('-').map(Number)), cdf };
  });
  const pick = (g, u) => { let lo = 0, hi = g.cdf.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (g.cdf[m] < u) lo = m + 1; else hi = m; } return g.scores[lo]; };
  return function sampleScore(edge, rng) {
    let i = 0; while (i < G.length - 2 && G[i + 1].edge <= edge) i++;
    const a = G[i], b = G[i + 1] || a, t = b.edge > a.edge ? Math.max(0, Math.min(1, (edge - a.edge) / (b.edge - a.edge))) : 0;
    return pick(rng() < t ? b : a, rng());
  };
}
// home/away goals for a fixture with the fitted model
function sampleMatch(sampler, strength, rHome, rAway, rng) {
  const E = edgeFor(strength, rHome, rAway);
  const [f, d] = sampler(E.edge, rng);
  if (!E.fav) return rng() < 0.5 ? [f, d] : [d, f]; // edge 0: symmetric
  return E.fav === 'A' ? [f, d] : [d, f];
}

module.exports = { eff, edgeFor, leagueCtx, makeSampler, sampleMatch };
