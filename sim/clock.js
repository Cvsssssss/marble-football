// Match clock shown on screen. Shared by the Node tests and the browser renderer.
// Rules (P1b): regular time counts 0'..89'. At 90' the added time N is announced; it means N extra shots.
// The clock rests at 90' (badge "+N") until the first shot starts, then reads 90+1', 90+2', ... 90+N' as each
// shot starts (never beyond 90+N). During a golden ball the clock is frozen at "90+N'".
(function (root) {
  'use strict';
  function shotsStarted(m, t) {
    const s = m.shotStarts || [];
    let k = 0;
    for (const x of s) if (x <= t + 1e-6) k++;
    return Math.min(k, m.addedTime);
  }
  // m: { addedTime, goldenStart (s or null), shotStarts: [s] }, t: match (simulation) time (s), gmps: game minutes per second
  function clockAt(m, t, gmps) {
    const gm = t * gmps;
    if (m.goldenStart !== null && m.goldenStart !== undefined && t >= m.goldenStart - 1e-6) {
      return { phase: 'golden', main: `90+${m.addedTime}'`, value: 90 + m.addedTime, golden: true, added: m.addedTime };
    }
    if (gm < 90) { const v = Math.floor(gm); return { phase: 'regular', main: `${v}'`, value: v, added: null }; }
    const k = shotsStarted(m, t);
    if (k === 0) return { phase: 'added', main: `90'`, value: 90, plus: m.addedTime, added: m.addedTime, shot: 0 };
    return { phase: 'shots', main: `90+${k}'`, value: 90 + k, plus: m.addedTime, added: m.addedTime, shot: k };
  }
  // minute label for a moment (goal captions): never beyond 90+added
  function minuteLabel(m, t, gmps) {
    const gm = t * gmps;
    if (m.goldenStart !== null && m.goldenStart !== undefined && t >= m.goldenStart - 1e-6) return `90+${m.addedTime}'`;
    if (gm < 90) return `${Math.max(1, Math.floor(gm))}'`;
    return `90+${Math.max(1, shotsStarted(m, t))}'`;
  }
  const api = { clockAt, minuteLabel, shotsStarted };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CLOCK = api;
})(typeof self !== 'undefined' ? self : this);
