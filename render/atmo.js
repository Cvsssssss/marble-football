/* P10 atmosphere kit (Canvas 2D, no dependencies) for the Premier League "pro" maps: stands split into the two teams'
 * colours with reactions, flags and banners in the wind, coloured smoke and flares, match intro helpers (blur, light
 * sweep), club-colour transitions, lens droplets in the rain, whistle flash, replay swoosh and the original trophy.
 * Visual only and deterministic: everything depends on the show data (show.atmo, built by sim/atmosphere.js from the
 * recorded timeline), fixed hashes and the time passed in (no random generator, no wall clock).
 * Flags: config/atmosphere.json (show.atmoCfg). Loaded after art_pro.js and before draw.js. */
(function () {
  'use strict';
  const X = {};
  let H = null, G = null, show = null, AC = {};
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const eo = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const eio = (x) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const stats = { groupBuilds: 0, smokeSprites: 0 };
  X.stats = () => Object.assign({}, stats);
  X.on = (k) => !!(AC.enabled && AC[k] !== false && show && show.atmo);
  X.trophyOn = () => !show || !show.atmoCfg || show.atmoCfg.trophy_v2 !== false;
  X.setup = function (helpers, geom, sh) { H = helpers; G = geom; show = sh; AC = sh.atmoCfg || {}; cur = null; };
  const wind = (t, x) => (window.ARTPRO && X.on('wind') ? window.ARTPRO.wind(t, x) : 0.35);

  // ---------- per-match context (team colours by side, atmo data, smoke sprites) ----------
  let cur = null;
  X.match = function (m) {
    if (!show || !show.atmo || !m) return null;
    const mi = show.matches.indexOf(m); if (mi < 0) return null;
    if (cur && cur.mi === mi) return cur;
    const at = show.atmo.matches[mi];
    cur = { mi, at, kits: { A: m.kits.A, B: m.kits.B }, teams: { A: show.teams[m.ta], B: show.teams[m.tb] }, smokeSpr: {} };
    if (window.ARTPRO && at) window.ARTPRO.setWind(at.wind);
    return cur;
  };
  function smokeSprite(col) {
    if (cur.smokeSpr[col]) return cur.smokeSpr[col];
    const s = 64, cv = document.createElement('canvas'); cv.width = s; cv.height = s; const c = cv.getContext('2d');
    const [r, g, b] = H.hexRgb(H.mixHex(col, '#ffffff', H.lum(col) < 0.35 ? 0.35 : 0.12)), g2 = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g2.addColorStop(0, `rgba(${r},${g},${b},0.75)`); g2.addColorStop(0.45, `rgba(${r},${g},${b},0.38)`); g2.addColorStop(1, `rgba(${r},${g},${b},0)`);
    c.fillStyle = g2; c.fillRect(0, 0, s, s); stats.smokeSprites++;
    return (cur.smokeSpr[col] = cv);
  }
  // reaction state at match-local video time v: the latest goal (u = s since) and the latest big chance
  X.react = function (ctx, v) {
    const st = { goal: null, chance: null };
    if (!ctx || !ctx.at || !X.on('crowd_reactions')) return st;
    for (const r of ctx.at.react) { if (r.v > v) break; if (v - r.v < 6) st.goal = { side: r.side, u: v - r.v, k: r.k, i: ctx.at.react.indexOf(r) }; }
    for (const c of ctx.at.chances) { if (c.v > v) break; if (v - c.v < 1.6) st.chance = { u: v - c.v, kind: c.kind }; }
    return st;
  };
  const goalEnv = (u) => sm(u / 0.25) * (1 - sm((u - 3.4) / 1.6));
  const chanceEnv = (u) => Math.sin(Math.PI * clamp(u / 1.5, 0, 1));
  // side of a stand position: home (A) on the left, away (B) on the right, mixed in the middle band
  X.sideOf = (x, h) => (h < sm((720 - x) / 160) ? 'A' : 'B');
  X.fanColour = function (side, kits, h, neutral) {
    const k = kits[side];
    return h < 0.56 ? k.primary : h < 0.86 ? k.secondary : neutral;
  };

  // ---------- stands: reaction layers (fans copied into one canvas per side at output scale) ----------
  // fans: [x, y, sz, shirt, skin, side, group]; drawFan(c, x, y, sz, shirt, skin, arms) from draw.js; tone(c): the
  // stand overlays of draw.js (haze, dim, tint) applied with source-atop; S: design -> output scale
  let groups = null;
  X.buildGroups = function (fans, drawFan, tone, S) {
    stats.groupBuilds++;
    groups = {};
    const Y0 = 168, Y1 = 548;
    for (const side of ['A', 'B']) for (const gi of [0]) { // one layer per side (P10 perf: a second phase group doubled the raster cost)
      const list = fans.filter((f) => f[5] === side); if (!list.length) continue;
      let x0 = Infinity, x1 = -Infinity; for (const f of list) { x0 = Math.min(x0, f[0] - 4); x1 = Math.max(x1, f[0] + 4); }
      x0 = Math.max(0, Math.floor(x0 / 2) * 2); x1 = Math.min(G.W, Math.ceil(x1));
      const cv = document.createElement('canvas'); cv.width = Math.ceil((x1 - x0) * S); cv.height = Math.ceil((Y1 - Y0) * S);
      const c = cv.getContext('2d'); c.scale(S, S); c.translate(-x0, -Y0);
      for (const f of list) drawFan(c, f[0], f[1], f[2], f[3], f[4], 0);
      c.globalCompositeOperation = 'source-atop'; tone(c); c.globalCompositeOperation = 'destination-out';
      c.fillRect(-10, Y0 - 10, G.PIPE_X + G.PIPE_OUTER / 2 + 12, Y1 - Y0 + 20); // behind the pipe (it is in front of the stands)
      groups[side + gi] = { cv, x: x0, y: Y0, w: cv.width / S, h: cv.height / S, n: list.length, S };
    }
    return Object.keys(groups).length;
  };
  X.groupInfo = () => (groups ? Object.fromEntries(Object.entries(groups).map(([k, g]) => [k, g.n])) : null);
  // draws the moving copies (only while a reaction is on: the resting crowd is baked into the background)
  X.standsReact = function (c, ctx, v, standPath) {
    if (!groups || !ctx) return;
    const st = X.react(ctx, v);
    const off = { A0: 0, B0: 0 };
    let any = false;
    if (st.goal && st.goal.u < 5) {
      const e = goalEnv(st.goal.u), amp = 2.4 * st.goal.k * e, f = 2.3 + 0.4 * st.goal.k;
      off[st.goal.side + '0'] = -amp * Math.abs(Math.sin(TAU * f * st.goal.u / 2));
      any = e > 0.01;
      // the other half sits / freezes: a little darker
      const other = st.goal.side === 'A' ? 'B' : 'A';
      if (e > 0.01) { c.save(); standPath(c, other); c.clip(); c.fillStyle = `rgba(4,8,20,${0.14 * e})`; c.fillRect(0, 160, G.W, 400); c.restore(); }
    }
    if (st.chance) { const e = chanceEnv(st.chance.u); for (const k of Object.keys(off)) off[k] = Math.min(off[k], -1.3 * e); any = any || e > 0.01; }
    if (!any) return;
    const tr = c.getTransform(), atRest = Math.abs(tr.a / groups[Object.keys(groups)[0]].S - 1) < 0.005 && tr.b === 0; // 1:1 -> pixel-aligned plain copy (fast)
    const q0 = c.imageSmoothingQuality, e0 = c.imageSmoothingEnabled;
    if (atRest) c.imageSmoothingEnabled = false; else c.imageSmoothingQuality = 'medium';
    for (const k of ['A0', 'B0']) {
      const g = groups[k]; if (!g || off[k] > -0.05) continue;
      const dy = atRest ? Math.round(off[k] * g.S) / g.S : off[k];
      c.drawImage(g.cv, g.x, g.y + dy, g.w, g.h);
    }
    c.imageSmoothingEnabled = e0; c.imageSmoothingQuality = q0;
  };

  // ---------- stands: live fans, flags, banners (per frame) ----------
  // live: [x, y, sz, shirt, skin, ph, side]; flags: [x, y, w, c1, c2, ph, side]; banners: [x, y, w, c1, c2, label, side]
  X.standsLive = function (c, t, v, ctx, live, flags, banners, drawFan, dim) {
    const st = X.react(ctx, v);
    const gE = st.goal ? goalEnv(st.goal.u) * st.goal.k : 0, cE = st.chance ? chanceEnv(st.chance.u) : 0;
    for (const [x, y, sz, shirt, skin, ph, side] of live) {
      const scoring = st.goal && st.goal.side === side, frozen = st.goal && !scoring && gE > 0.2;
      let bob = frozen ? 0 : Math.max(0, Math.sin(t * 2.6 + ph)) * sz * 0.7, arms = Math.sin(t * 1.3 + ph * 1.7) > 0.55 ? 1 + Math.sin(t * 7 + ph) * 0.6 : 0;
      if (scoring) { bob = Math.max(bob, Math.abs(Math.sin(v * 7.5 + ph)) * sz * 1.8 * Math.min(1, gE)); arms = 1.6 + Math.sin(v * 9 + ph) * 0.6; }
      if (cE > 0.05 && !scoring) { bob = Math.max(bob, sz * 0.6 * cE); arms = Math.max(arms, 0.3 * cE); }
      drawFan(c, x, y - bob, sz, shirt, skin, arms);
      if (scoring && gE > 0.3 && H.hash(Math.round(ph * 1000)) < 0.35) { // scarf held up between the hands
        const k = ctx.kits[side]; c.fillStyle = k.primary; c.fillRect(x - sz * 1.1, y - bob - sz * 1.9 - arms, sz * 2.2, sz * 0.5); c.fillStyle = k.secondary; c.fillRect(x - sz * 1.1, y - bob - sz * 1.6 - arms, sz * 2.2, sz * 0.25);
      }
    }
    if (X.on('stand_flags')) {
      for (const [x, y, w, c1, c2, ph, side] of flags) {
        const scoring = st.goal && st.goal.side === side && gE > 0.1;
        const wd = wind(t, x), om = 5 * (0.75 + 0.7 * Math.abs(wd)) * (scoring ? 1.9 : 1), am = (1.2 + 1.4 * Math.abs(wd)) * (scoring ? 1.8 : 1);
        const h = w * 0.62, pole = w * 1.5, lift = scoring ? Math.abs(Math.sin(v * 5 + ph)) * 3 : 0, px = x + Math.sin(t * 1.8 + ph) * (scoring ? 4 : 2), py = y - pole - lift;
        const d = wd >= 0 ? 1 : -1;
        c.strokeStyle = '#d9d9e0'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x, y - lift); c.lineTo(px, py); c.stroke();
        const yy = (k, base) => py + base + Math.sin(t * om + ph + k * 1.1) * am * (k / 4);
        c.fillStyle = c1; c.beginPath(); c.moveTo(px, py);
        for (let k = 1; k <= 4; k++) c.lineTo(px + d * (w * k) / 4, yy(k, 0));
        for (let k = 4; k >= 0; k--) c.lineTo(px + d * (w * k) / 4, yy(k, h / 2));
        c.closePath(); c.fill();
        c.fillStyle = c2; c.beginPath(); c.moveTo(px, py + h / 2);
        for (let k = 1; k <= 4; k++) c.lineTo(px + d * (w * k) / 4, yy(k, h / 2));
        for (let k = 4; k >= 0; k--) c.lineTo(px + d * (w * k) / 4, yy(k, h));
        c.closePath(); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(Math.min(px, px + d * w), py + h * 0.78, w, h * 0.1);
      }
      for (const [x, y, w, c1, c2, label, side] of banners) { // banners hanging from the tier fronts, rippling in the wind
        const wd = wind(t, x), hh = 13, n = 8, scoring = st.goal && st.goal.side === side && gE > 0.1;
        const rip = (k) => Math.sin(t * (2.2 + 1.6 * Math.abs(wd)) + k * 0.9 + x * 0.02) * (0.6 + 1.2 * Math.abs(wd)) * (scoring ? 1.6 : 1);
        c.fillStyle = c1; c.beginPath(); c.moveTo(x - w / 2, y);
        for (let k = 0; k <= n; k++) c.lineTo(x - w / 2 + (w * k) / n, y + rip(k) * 0.25);
        for (let k = n; k >= 0; k--) c.lineTo(x - w / 2 + (w * k) / n + wd * 1.2, y + hh + rip(k));
        c.closePath(); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.6; c.stroke();
        c.fillStyle = c2; c.fillRect(x - w / 2, y + 1, w, 2); c.fillRect(x - w / 2 + wd * 1.2, y + hh - 2 + rip(n / 2) * 0.6, w, 2);
        if (label) { const L = labelSprite(label, H.inkOn(c1)); c.drawImage(L, x - L.width / 6 + wd * 0.6, y + hh / 2 + 0.8 - L.height / 6 + rip(n / 2) * 0.5, L.width / 3, L.height / 3); }
      }
    }
    if (dim < 1) { c.fillStyle = `rgba(6,10,26,${(1 - dim) * 0.5})`; for (const [x, y, sz] of live) c.fillRect(x - sz * 1.1, y - sz * 3.6, sz * 2.2, sz * 5.6); }
  };

  const labels = {};
  function labelSprite(s, ink) { // banner text rendered once at 3x (drawn per frame as an image)
    const k = s + ink; if (labels[k]) return labels[k];
    const cv = document.createElement('canvas'); cv.width = 96; cv.height = 36; const q = cv.getContext('2d'); q.scale(3, 3);
    H.text(q, s, 16, 6.3, 8.5, ink, 'center', 900); return (labels[k] = cv);
  }
  // ---------- smoke, flares, confetti over the stands ----------
  X.standsFx = function (c, t, v, ctx) {
    if (!ctx || !ctx.at) return;
    if (X.on('stand_smoke')) for (let si = 0; si < ctx.at.smoke.length; si++) {
      const sk = ctx.at.smoke[si], age = v - sk.v; if (age < 0 || age > sk.d + 3) continue;
      const col = ctx.kits[sk.side].primary, spr = smokeSprite(H.lum(col) > 0.85 ? ctx.kits[sk.side].secondary : col);
      for (let k = 0; k < 18; k++) {
        const born = (k / 18) * sk.d * 0.85, a = age - born; if (a < 0 || a > 3.2) continue;
        const h1 = H.hash(si * 131 + k * 7 + 1), h2 = H.hash(si * 131 + k * 7 + 2);
        const drift = wind(t, sk.x) * 26 * a, x = sk.x + (h1 - 0.5) * 10 + drift + Math.sin(a * 1.7 + k) * 3, y = sk.y - (16 + 10 * h2) * a - 4, r = 7 + 14 * a + 4 * h2;
        c.globalAlpha = 0.55 * (1 - sm(a / 3.2)) * sm(a / 0.3); c.drawImage(spr, x - r, Math.min(y, 535 - r) - r * 0.5, 2 * r, 2 * r);
      }
      c.globalAlpha = 1;
      if (age < sk.d * 0.85) flare(c, sk.x, sk.y, t, si);
    }
    const st = X.react(ctx, v);
    if (st.goal && st.goal.u < 4.5) { // the scoring half erupts: flares, sparks, confetti + streamers in the team colours
      const u = st.goal.u, side = st.goal.side, kit = ctx.kits[side], cols = [kit.primary, kit.secondary, '#ffffff'], gi = st.goal.i;
      const xa = side === 'A' ? 70 : 720, xw = 490, env = 1 - sm((u - 3.2) / 1.3);
      for (let k = 0; k < Math.round(3 + 2 * st.goal.k); k++) flare(c, xa + H.hash(gi * 17 + k) * xw, 360 + H.hash(gi * 19 + k) * 150, t, 50 + k, env);
      for (let k = 0; k < 80; k++) {
        const h1 = H.hash(gi * 977 + k), h2 = H.hash(gi * 983 + k * 3), h3 = H.hash(gi * 991 + k * 5), uu = u - h3 * 0.8; if (uu < 0) continue;
        const x = xa + h1 * xw + wind(t, 0) * 18 * uu + Math.sin(uu * 3 + k) * 6, y = 230 + h2 * 90 + uu * (38 + 30 * h3) - 70 * Math.exp(-uu * 3) * (1 - h3);
        if (y > 540) continue;
        const rot = uu * (4 + 4 * h1) + k, cw = Math.abs(Math.cos(rot)), fl = Math.abs(Math.cos(uu * (5 + 3 * h2))); // tumbling piece without a transform
        c.globalAlpha = env; c.fillStyle = cols[k % 3];
        if (k % 9 === 0) c.fillRect(x - 0.7, y - 6 * fl, 1.4, 12 * fl + 0.5); else c.fillRect(x - 2 * cw - 0.5, y - 1.3 * fl, 4 * cw + 1, 2.6 * fl + 0.4); // streamer / confetti piece
      }
      c.globalAlpha = 1;
    }
  };
  let flareSpr = null;
  function flare(c, x, y, t, i, a) {
    a = a == null ? 1 : a; if (a <= 0.01) return;
    if (!flareSpr) { // red stadium flare glow, built once
      const s = 48; flareSpr = document.createElement('canvas'); flareSpr.width = s; flareSpr.height = s; const q = flareSpr.getContext('2d');
      const g = q.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,240,220,1)'); g.addColorStop(0.12, 'rgba(255,200,170,0.9)'); g.addColorStop(0.25, 'rgba(255,90,60,0.55)'); g.addColorStop(1, 'rgba(255,60,40,0)');
      q.fillStyle = g; q.fillRect(0, 0, s, s);
    }
    const fl = 0.75 + 0.25 * Math.sin(t * 23 + i * 3.1) * Math.sin(t * 9.7 + i), r = 18 * fl;
    const op = c.globalCompositeOperation, ga = c.globalAlpha;
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = a; c.drawImage(flareSpr, x - r, y - r, 2 * r, 2 * r);
    c.globalCompositeOperation = op; c.globalAlpha = ga;
  }

  // ---------- lens droplets in the rain (screen space, faint, kept out of the middle of the frame) ----------
  X.droplets = function (c, t, W, Hh) {
    if (!X.on('lens_droplets') || !(show.atmo && show.atmo.rain)) return;
    c.save();
    for (let i = 0; i < 12; i++) {
      const per = 6 + 3 * H.hash(i * 13 + 1), ph = H.hash(i * 17 + 2) * per, cyc = Math.floor((t + ph) / per), u = ((t + ph) % per + per) % per / per;
      let x = H.hash(i * 31 + cyc * 7) , y = H.hash(i * 37 + cyc * 11);
      if (x > 0.16 && x < 0.84 && y > 0.2) y = 0.02 + y * 0.12; // only the top band and the side margins
      const px = x * W, py = y * Hh, r = (4 + 6 * H.hash(i * 41 + cyc)) * W / 1920, a = 0.9 * sm(u / 0.15) * (1 - sm((u - 0.7) / 0.3));
      if (a <= 0.01) continue;
      const g = c.createRadialGradient(px - r * 0.25, py - r * 0.3, r * 0.1, px, py, r);
      g.addColorStop(0, `rgba(255,255,255,${0.10 * a})`); g.addColorStop(0.7, `rgba(255,255,255,${0.04 * a})`); g.addColorStop(0.9, `rgba(220,235,255,${0.22 * a})`); g.addColorStop(1, 'rgba(220,235,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(px, py, r, 0, TAU); c.fill();
      c.fillStyle = `rgba(255,255,255,${0.45 * a})`; c.beginPath(); c.arc(px - r * 0.35, py - r * 0.4, r * 0.16, 0, TAU); c.fill();
      c.strokeStyle = `rgba(0,10,25,${0.12 * a})`; c.lineWidth = Math.max(0.6, r * 0.12); c.beginPath(); c.arc(px, py, r * 0.82, 0.2, Math.PI - 0.2); c.stroke();
    }
    c.restore();
  };

  // ---------- intro helpers ----------
  let blurCv = null;
  // amount: blur radius in output px (0 = sharp); the frame is downsampled, blurred and laid over itself
  X.blur = function (ctx, canvas, amount) {
    if (amount <= 0.3) return;
    const W = canvas.width, Hh = canvas.height, w = Math.ceil(W / 4), h = Math.ceil(Hh / 4);
    if (!blurCv || blurCv.width !== w) { blurCv = document.createElement('canvas'); blurCv.width = w; blurCv.height = h; }
    const b = blurCv.getContext('2d'); b.clearRect(0, 0, w, h); b.filter = `blur(${(amount / 4).toFixed(2)}px)`; b.drawImage(canvas, 0, 0, w, h); b.filter = 'none';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = clamp(amount / 3, 0, 1); ctx.imageSmoothingQuality = 'medium'; ctx.drawImage(blurCv, 0, 0, W, Hh); ctx.restore();
  };
  // light sweep over a rectangle (design px), q = 0..1 position of the band
  X.sweep = function (c, x, y, w, h, q, a) {
    if (q <= 0 || q >= 1) return;
    c.save(); H.rrect(c, x, y, w, h, 14); c.clip(); c.globalCompositeOperation = 'lighter';
    const gx = x - 80 + q * (w + 160), g = c.createLinearGradient(gx - 60, 0, gx + 60, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${(a || 0.32) * Math.sin(Math.PI * q)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.transform(1, 0, -0.3, 1, 0, 0); c.fillRect(gx - 60 + 0.3 * (y + h / 2), y, 120, h); c.restore();
  };
  // floodlights switching on (evening / night): darkness level 0..1 over the intro, flicker then full
  X.lightsDark = function (u) { // u = s since the intro start
    if (u < 0.45) return 0.62;
    if (u < 1.15) { const k = Math.floor((u - 0.45) / 0.07); return H.hash(k * 7 + 3) < 0.45 ? 0.5 : 0.12 * (1 - (u - 0.45) / 0.7); }
    return 0;
  };

  // ---------- transition between matches: club-colour stripes with the next fixture ----------
  X.transition = function (c, u, m, names, idx) {
    const kA = m.kits.A, kB = m.kits.B, W = G.W, Hh = G.H, sl = 170;
    const inQ = eo(u / 0.4), outQ = eio((u - 0.62) / 0.38), dx = outQ * (W + 2 * sl + 60);
    const xa = -sl - 40 + inQ * (W / 2 + sl + 40) + dx, xb = W + sl + 40 - inQ * (W / 2 + sl + 40) + dx; // right edge of A, left edge of B
    const band = (x0, x1, col, edge) => {
      c.fillStyle = col; c.beginPath(); c.moveTo(x0 + sl, 0); c.lineTo(x1 + sl, 0); c.lineTo(x1 - sl, Hh); c.lineTo(x0 - sl, Hh); c.closePath(); c.fill();
      c.fillStyle = edge; c.beginPath(); c.moveTo(x1 + sl - 14, 0); c.lineTo(x1 + sl, 0); c.lineTo(x1 - sl, Hh); c.lineTo(x1 - sl - 14, Hh); c.closePath(); c.fill();
    };
    c.save();
    band(xa - W - 2 * sl, xa, kA.primary, kA.secondary);
    band(xb, xb + W + 2 * sl, kB.primary, kB.secondary);
    c.globalCompositeOperation = 'lighter'; // motion streaks
    for (let i = 0; i < 14; i++) { const y = H.hash(i * 7 + 1) * Hh, L = 120 + 200 * H.hash(i * 11 + 2), x = (xa - 200 + H.hash(i * 13) * 400) % (W + 400); c.fillStyle = `rgba(255,255,255,${0.10 * Math.sin(Math.PI * clamp(u, 0, 1))})`; c.fillRect(x - L, y, L, 2); }
    c.globalCompositeOperation = 'source-over';
    const ta = sm((u - 0.22) / 0.14) * (1 - sm((u - 0.62) / 0.12));
    if (ta > 0.01) {
      c.globalAlpha = ta; c.translate(dx * 0.6, 0);
      c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 16; c.shadowOffsetY = 3;
      const za = H.fitText(c, names[0], 470, 54, 900), zb = H.fitText(c, names[1], 470, 54, 900);
      H.text(c, names[0], W / 2 - 70, Hh / 2 - 4, za, H.inkOn(kA.primary), 'right', 900);
      H.text(c, names[1], W / 2 + 70, Hh / 2 - 4, zb, H.inkOn(kB.primary), 'left', 900);
      c.fillStyle = 'rgba(8,20,38,0.9)'; H.rrect(c, W / 2 - 40, Hh / 2 - 34, 80, 60, 12); c.fill(); c.shadowColor = 'transparent';
      H.text(c, 'vs', W / 2, Hh / 2 - 4, 30, '#ffffff', 'center', 900);
      c.font = `800 18px "Bahnschrift", "Segoe UI", Arial, sans-serif`; const iw = c.measureText(idx).width + 36;
      c.fillStyle = 'rgba(8,20,38,0.88)'; H.rrect(c, W / 2 - iw / 2, Hh / 2 + 46, iw, 32, 16); c.fill();
      H.text(c, idx, W / 2, Hh / 2 + 62, 18, '#ffffff', 'center', 800);
    }
    c.restore();
  };
  // whistle visual flash around the clock (kick-off / full time); u = 0..1 over 0.6 s
  X.whistleFlash = function (c, u) {
    if (!X.on('whistle_flash') || u < 0 || u > 1) return;
    const x = G.W / 2, y = 87, a = 1 - u;
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y, 4, x, y, 90); g.addColorStop(0, `rgba(255,255,255,${0.55 * a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(x - 90, y - 90, 180, 180);
    c.strokeStyle = `rgba(255,255,255,${0.8 * a})`; c.lineWidth = 2.5 * a + 0.5; c.beginPath(); c.ellipse(x, y, 46 + 60 * eo(u), 16 + 22 * eo(u), 0, 0, TAU); c.stroke();
    c.restore();
  };
  // replay transition swoosh (u = 0..1 over ~0.45 s): bright diagonal band with team-colour edges + streaks
  X.swoosh = function (c, u, cols) {
    if (!X.on('replay_swoosh') || u < 0 || u > 1) return;
    const W = G.W, Hh = G.H, x = -300 + eio(u) * (W + 600), sl = 240;
    c.save();
    const g = c.createLinearGradient(x - 160, 0, x + 160, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, H.hexA(cols[0], 0.75)); g.addColorStop(0.5, 'rgba(255,255,255,0.95)'); g.addColorStop(0.7, H.hexA(cols[1], 0.75)); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - 160 + sl, 0); c.lineTo(x + 160 + sl, 0); c.lineTo(x + 160 - sl, Hh); c.lineTo(x - 160 - sl, Hh); c.closePath(); c.fill();
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) { const y = H.hash(i * 5 + 3) * Hh, L = 160 + 260 * H.hash(i * 9 + 1); c.fillStyle = `rgba(255,255,255,${0.18 * Math.sin(Math.PI * u)})`; c.fillRect(x - L - 40 + (y - Hh / 2) * -0.9, y, L, 2.2); }
    c.restore();
  };

  // ---------- original trophy (P10 section 7) ----------
  // A tall tulip cup with a band of embossed marbles, two swept wing handles, a golden ball resting in the mouth,
  // a slender stem with two knots, a sculpted stepped pedestal in dark stone with a gold band and a blank plaque.
  // Not modelled on any real trophy (no lid, no crown, no animals, no real base). Same anchor/scale as the old
  // drawTrophy: about x -64..64, y -110..104 at scale 1. o: { t, cols: [primary, secondary], ribbons, sweep, sparks }
  function goldGrad(c, x0, x1) {
    const g = c.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, '#6e4608'); g.addColorStop(0.12, '#b9851e'); g.addColorStop(0.27, '#ffe9a6'); g.addColorStop(0.36, '#fff8dc'); g.addColorStop(0.45, '#f2c94c');
    g.addColorStop(0.62, '#9c6a12'); g.addColorStop(0.78, '#f7d774'); g.addColorStop(0.9, '#c8921f'); g.addColorStop(1, '#5e3b06');
    return g;
  }
  function cupPath() {
    const p = new Path2D(); // tulip bowl, symmetric profile (y from the stem joint at 10 up to the lip at -86)
    p.moveTo(-6, 10); p.bezierCurveTo(-30, 2, -50, -18, -48, -34); p.bezierCurveTo(-46, -50, -38, -60, -40, -70); p.bezierCurveTo(-42, -78, -50, -83, -55, -86);
    p.lineTo(55, -86); p.bezierCurveTo(50, -83, 42, -78, 40, -70); p.bezierCurveTo(38, -60, 46, -50, 48, -34); p.bezierCurveTo(50, -18, 30, 2, 6, 10); p.closePath();
    return p;
  }
  function stemPath() {
    const p = new Path2D();
    p.moveTo(-8, 8); p.quadraticCurveTo(-4, 14, -4.5, 18); p.lineTo(-3.6, 30); p.quadraticCurveTo(-3, 44, -9, 54); p.quadraticCurveTo(-24, 58, -32, 62);
    p.lineTo(32, 62); p.quadraticCurveTo(24, 58, 9, 54); p.quadraticCurveTo(3, 44, 3.6, 30); p.lineTo(4.5, 18); p.quadraticCurveTo(4, 14, 8, 8); p.closePath();
    return p;
  }
  function wingPath(sg) { // swept wing handle, from the lower bowl out and up, curling back towards the lip
    const p = new Path2D(), k = sg;
    p.moveTo(36 * k, -8); p.bezierCurveTo(58 * k, -12, 70 * k, -34, 64 * k, -58); p.bezierCurveTo(61 * k, -70, 54 * k, -80, 47 * k, -82);
    p.bezierCurveTo(56 * k, -72, 58 * k, -60, 54 * k, -46); p.bezierCurveTo(50 * k, -30, 44 * k, -20, 40 * k, -16); p.closePath();
    return p;
  }
  X.trophy = function (c, x, y, s, o) {
    o = o || {}; const t = o.t || 0, cols = o.cols || null;
    c.save(); c.translate(x, y); c.scale(s, s); if (o.alpha != null) c.globalAlpha *= o.alpha;
    // pedestal: dark polished stone, two sculpted steps, gold band, blank plaque
    const st = c.createLinearGradient(-58, 0, 58, 0); st.addColorStop(0, '#0e0f14'); st.addColorStop(0.3, '#3b3e4b'); st.addColorStop(0.45, '#5a5e6e'); st.addColorStop(0.7, '#1e2029'); st.addColorStop(1, '#0a0b0f');
    c.fillStyle = st; c.beginPath(); c.moveTo(-50, 80); c.lineTo(50, 80); c.lineTo(58, 104); c.lineTo(-58, 104); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-36, 64); c.quadraticCurveTo(-30, 72, -42, 80); c.lineTo(42, 80); c.quadraticCurveTo(30, 72, 36, 64); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.10)'; c.lineWidth = 0.8; for (const [a0, a1] of [[-40, 98], [-12, 86], [20, 101]]) { c.beginPath(); c.moveTo(a0, 82); c.quadraticCurveTo(a0 + 9, a1 - 6, a0 + 22, a1); c.stroke(); } // stone veins
    c.fillStyle = goldGrad(c, -52, 52); c.fillRect(-50, 78, 100, 3.2); c.fillRect(-36, 62.5, 72, 2.4);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-50, 81.2, 100, 1.2);
    const pl = c.createLinearGradient(0, 88, 0, 98); pl.addColorStop(0, '#d9b45a'); pl.addColorStop(1, '#7a5512');
    c.fillStyle = pl; H.rrect(c, -22, 87, 44, 11, 2); c.fill(); c.strokeStyle = 'rgba(255,240,200,0.5)'; c.lineWidth = 0.6; H.rrect(c, -21, 88, 42, 9, 1.5); c.stroke();
    // ribbons in the club colours (behind the cup), tied to the wing handles
    if (cols && o.ribbons !== false) for (const sg of [-1, 1]) for (let r = 0; r < 2; r++) {
      const x0 = 58 * sg, y0 = -54, col = cols[r], len = 92 + r * 10;
      c.fillStyle = col; c.beginPath(); c.moveTo(x0, y0);
      const pts = []; for (let k = 0; k <= 10; k++) { const f = k / 10; pts.push([x0 + sg * (4 + r * 7) * f + Math.sin(t * 2.4 + f * 4 + r + sg) * 4 * f, y0 + len * f]); }
      for (const p of pts) c.lineTo(p[0] + sg * 3.2, p[1]);
      for (let k = pts.length - 1; k >= 0; k--) c.lineTo(pts[k][0] - sg * 3.2, pts[k][1] + 1);
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); for (const p of pts) c.lineTo(p[0] + sg * 3.2, p[1]); for (let k = pts.length - 1; k >= 0; k--) c.lineTo(pts[k][0] + sg * 1.4, pts[k][1]); c.closePath(); c.fill();
    }
    // stem + foot with two knots
    const SP = stemPath();
    c.fillStyle = goldGrad(c, -32, 32); c.fill(SP);
    for (const [ky, kr] of [[34, 7.5], [20, 5.5]]) { const kg = c.createRadialGradient(-kr * 0.4, ky - kr * 0.4, 0.5, 0, ky, kr); kg.addColorStop(0, '#fff6d0'); kg.addColorStop(0.5, '#e0a92c'); kg.addColorStop(1, '#6e4608'); c.fillStyle = kg; c.beginPath(); c.ellipse(0, ky, kr, kr * 0.8, 0, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-2.2, 40, 1.1, 12);
    // wing handles
    for (const sg of [-1, 1]) { const WP = wingPath(sg); c.fillStyle = goldGrad(c, sg < 0 ? -70 : 34, sg < 0 ? -34 : 70); c.fill(WP); c.strokeStyle = 'rgba(90,55,5,0.55)'; c.lineWidth = 0.8; c.stroke(WP); }
    // bowl back lip (inside of the cup), then the golden ball resting in the mouth
    c.fillStyle = '#3d2604'; c.beginPath(); c.ellipse(0, -86, 54, 7, 0, Math.PI, TAU); c.fill();
    const bg = c.createRadialGradient(-6, -104, 2, 0, -96, 19); bg.addColorStop(0, '#fffbe8'); bg.addColorStop(0.3, '#ffd65c'); bg.addColorStop(0.75, '#b9801a'); bg.addColorStop(1, '#5a3a06');
    c.fillStyle = bg; c.beginPath(); c.arc(0, -96, 17, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(110,70,10,0.45)'; c.lineWidth = 0.8; c.beginPath(); c.arc(0, -96, 11, -0.4, 1.9); c.stroke(); c.beginPath(); c.moveTo(-15, -92); c.quadraticCurveTo(0, -84, 15, -92); c.stroke(); // seams
    // bowl
    const CP = cupPath();
    c.fillStyle = goldGrad(c, -56, 56); c.fill(CP);
    c.save(); c.clip(CP);
    const vg = c.createLinearGradient(0, -86, 0, 10); vg.addColorStop(0, 'rgba(255,255,255,0.18)'); vg.addColorStop(0.45, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(60,30,0,0.35)');
    c.fillStyle = vg; c.fillRect(-60, -90, 120, 102);
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(-27, -48, 5, 26, 0.12, 0, TAU); c.fill(); // specular streaks
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.ellipse(-16, -56, 2, 18, 0.08, 0, TAU); c.fill();
    c.fillStyle = 'rgba(40,20,0,0.25)'; c.fillRect(-60, -68, 120, 2.4); c.fillStyle = 'rgba(255,240,200,0.4)'; c.fillRect(-60, -66, 120, 1); // engraved waist line
    for (let k = -3; k <= 3; k++) { // band of embossed marbles around the belly
      const bx = k * 13.5, by = -30 + Math.abs(k) * 1.2, br = 5.6 - Math.abs(k) * 0.55, mg = c.createRadialGradient(bx - br * 0.4, by - br * 0.45, 0.4, bx, by, br);
      mg.addColorStop(0, '#fffbe6'); mg.addColorStop(0.45, '#f0bf43'); mg.addColorStop(1, '#7c5208');
      c.fillStyle = 'rgba(60,30,0,0.35)'; c.beginPath(); c.arc(bx + 0.8, by + 1, br, 0, TAU); c.fill();
      c.fillStyle = mg; c.beginPath(); c.arc(bx, by, br, 0, TAU); c.fill();
    }
    if (o.sweep !== false) { // gold light sweep crossing the cup every ~3 s
      const q = ((t * 0.45) % 1.35 + 1.35) % 1.35;
      if (q < 1) { const gx = -90 + q * 180, sg2 = c.createLinearGradient(gx - 22, 0, gx + 22, 0); sg2.addColorStop(0, 'rgba(255,255,255,0)'); sg2.addColorStop(0.5, `rgba(255,252,235,${0.55 * Math.sin(Math.PI * q)})`); sg2.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = sg2; c.save(); c.transform(1, 0, -0.35, 1, 0, 0); c.fillRect(gx - 22 - 14, -90, 44, 104); c.restore(); }
    }
    c.restore();
    c.strokeStyle = 'rgba(90,55,5,0.6)'; c.lineWidth = 0.9; c.stroke(CP);
    // front lip (over the ball), rim highlight
    c.strokeStyle = goldGrad(c, -56, 56); c.lineWidth = 3.2; c.beginPath(); c.ellipse(0, -86, 54, 7, 0, 0, Math.PI); c.stroke();
    c.strokeStyle = 'rgba(255,250,230,0.85)'; c.lineWidth = 1; c.beginPath(); c.ellipse(0, -86.8, 53, 6.4, 0, 0.15, Math.PI - 0.15); c.stroke();
    if (o.sparks !== false) { // twinkles on the rim and the ball
      c.globalCompositeOperation = 'lighter'; c.fillStyle = '#ffffff';
      for (let i = 0; i < 5; i++) {
        const q = ((t * 0.8 + H.hash(i * 7 + 1)) % 1 + 1) % 1; if (q > 0.3) continue;
        const a = Math.sin(Math.PI * q / 0.3), px = [-44, 30, -8, 50, 4][i], py = [-86, -84, -106, -60, 30][i], r = 7 * a;
        c.globalAlpha = 0.9 * a; c.beginPath(); c.moveTo(px, py - r); c.lineTo(px + r * 0.18, py); c.lineTo(px, py + r); c.lineTo(px - r * 0.18, py); c.closePath(); c.fill(); c.fillRect(px - r, py - 0.4, 2 * r, 0.8);
      }
    }
    c.restore();
  };
  // seen from above (orbit shot): lip ring, the golden ball, wings and ribbons
  X.trophyTop = function (c, t, cols) {
    const g = c.createRadialGradient(-12, -12, 4, 0, 0, 58); g.addColorStop(0, '#fff3b0'); g.addColorStop(0.55, '#e7b23a'); g.addColorStop(0.85, '#9c6a12'); g.addColorStop(1, '#f2c94c');
    if (cols) for (let r = 0; r < 4; r++) { const a = r * Math.PI / 2 + 0.4; c.save(); c.rotate(a); c.fillStyle = cols[r % 2]; c.beginPath(); c.moveTo(56, -3); for (let k = 0; k <= 8; k++) c.lineTo(56 + k * 8, -3 + Math.sin(t * 3 + k + r) * 3); for (let k = 8; k >= 0; k--) c.lineTo(56 + k * 8, 3 + Math.sin(t * 3 + k + r) * 3); c.closePath(); c.fill(); c.restore(); }
    for (const sg of [-1, 1]) { c.fillStyle = goldGrad(c, -80, 80); c.beginPath(); c.moveTo(48 * sg, -10); c.quadraticCurveTo(86 * sg, -18, 80 * sg, 0); c.quadraticCurveTo(86 * sg, 18, 48 * sg, 10); c.closePath(); c.fill(); }
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 56, 0, TAU); c.fill();
    c.fillStyle = '#4a2e05'; c.beginPath(); c.arc(0, 0, 48, 0, TAU); c.fill();
    const bg = c.createRadialGradient(-7, -7, 2, 0, 0, 24); bg.addColorStop(0, '#fffbe8'); bg.addColorStop(0.35, '#ffd65c'); bg.addColorStop(1, '#7a5110');
    c.fillStyle = bg; c.beginPath(); c.arc(0, 0, 22, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,250,230,0.8)'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 53, Math.PI * 1.1 + t * 0.2, Math.PI * 1.6 + t * 0.2); c.stroke();
  };

  window.ATMO = X;
})();
