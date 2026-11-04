// Match clock shown on screen. Shared by the Node tests and the browser renderer.
// Rules: regular time counts 0'..89'; during added time the clock shows 90' with the "+N" badge;
// when a golden ball starts the clock is frozen at "90+N'" (end of regulation + added time) and never advances.
(function (root) {
  'use strict';
  // m: { addedTime, goldenStart (s or null) }, t: match time (s), gmps: game minutes per video second
  function clockAt(m, t, gmps) {
    const gm = t * gmps;
    if (m.goldenStart !== null && m.goldenStart !== undefined && t >= m.goldenStart - 1e-6) {
      return { phase: 'golden', main: `90+${m.addedTime}'`, value: 90 + m.addedTime, golden: true, added: m.addedTime };
    }
    if (gm < 90) { const v = Math.floor(gm); return { phase: 'regular', main: `${v}'`, value: v, added: null }; }
    // added time: clock rests at 90' and the badge shows the announced added minutes (v1 look)
    return { phase: 'added', main: `90'`, value: 90, plus: m.addedTime, added: m.addedTime };
  }
  // minute label for a moment (goal captions): never beyond 90+added
  function minuteLabel(m, t, gmps) {
    const gm = t * gmps;
    if (m.goldenStart !== null && m.goldenStart !== undefined && t >= m.goldenStart - 1e-6) return `90+${m.addedTime}'`;
    if (gm < 90) return `${Math.max(1, Math.floor(gm))}'`;
    return `90+${Math.min(m.addedTime, Math.floor(gm - 90) + 1)}'`;
  }
  const api = { clockAt, minuteLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CLOCK = api;
})(typeof self !== 'undefined' ? self : this);
