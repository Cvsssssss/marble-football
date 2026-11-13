/* P9 "pro" art kit (Canvas 2D, no dependencies). Visual only: every shape that has a collider (platform top, crossbar,
 * post, keeper skeleton, windmill bar, ball radius) is drawn at exactly the same place and size as before; only shading,
 * texture, small animated details and effects are added. Deterministic: everything depends on the map, fixed hashes and
 * the time/frame passed in (no random generator, no wall clock). Static parts are drawn once into the background cache (draw.js);
 * per-frame parts are small (sprites, a few hundred short paths).
 * Switch: map config "art_style": "pro" (default on the four premier maps only). */
(function () {
  'use strict';
  const A = {};
  let H = null, G = null, show = null, LK = null; // helpers from draw.js, geometry, show, lighting look
  const stats = { setups: 0, staticBuilds: 0, sprites: 0 };
  let sky = null, cloudSprites = [], flareSprite = null, glowSprite = null, blades = [], dust = [], ripples = [], lights = [];
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const eo = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);

  A.enabled = (map) => !!map && map.art_style === 'pro';
  // lighting per variant: key light colour, horizontal direction it comes FROM (-1 = from the left), shadow strength,
  // rim strength, wet surfaces (drizzle), floodlight strength (0 day .. 1 night)
  function lookOf(MAP) {
    const sk = H.hexRgb(MAP.sky[1]), skyL = H.lum(MAP.sky[1]);
    const night = !!MAP.night, overcast = !night && Math.abs(sk[2] - sk[0]) < 40 && skyL >= 0.45, evening = !night && skyL < 0.35;
    const kind = night ? 'night' : evening ? 'evening' : overcast ? 'overcast' : 'day';
    const P = {
      day: { key: '#fff4d6', dir: -1, shadow: 0.34, rim: 0.55, flood: 0.25, amb: '#bcd4ff' },
      overcast: { key: '#eef1f5', dir: -0.35, shadow: 0.2, rim: 0.25, flood: 0.35, amb: '#c8d0da' },
      evening: { key: '#ffbe85', dir: -1, shadow: 0.38, rim: 0.75, flood: 0.75, amb: '#a99bd6' },
      night: { key: '#dfe9ff', dir: 0.45, shadow: 0.42, rim: 0.6, flood: 1, amb: '#7d8fc0' },
    }[kind];
    return Object.assign({ kind, night, wet: !!MAP.rain, rain: !!MAP.rain }, P);
  }
  A.look = () => LK;
  A.stats = () => Object.assign({}, stats, { blades: blades.length, dust: dust.length, ripples: ripples.length, lights: lights.length, clouds: cloudSprites.length, kind: LK && LK.kind });

  // ---------- setup (once per initRenderer) ----------
  A.setup = function (helpers, geom, sh) {
    H = helpers; G = geom; show = sh; LK = lookOf(sh.map); stats.setups++;
    sky = null; cloudSprites = []; lights = [];
    flareSprite = makeFlare(); glowSprite = makeGlow();
    // grass blades along both platform tops (per frame: sway). Skip the spout hole and the goal-post foot.
    blades = [];
    const sx = G.SPOUT_X, hole = G.BALL_R + 11;
    for (const [x0, x1, s] of [[G.LEFT_PLAT[0], G.LEFT_PLAT[1] - 3, 1], [G.RIGHT_PLAT[0] + 3, G.RIGHT_PLAT[1], 2]]) {
      for (let x = x0 + 1, k = 0; x < x1; x += 2.6, k++) {
        if (Math.abs(x - sx) < hole) continue;
        const h1 = H.hash(s * 7919 + k * 31 + 3), h2 = H.hash(s * 104729 + k * 17 + 9);
        blades.push([x + (h1 - 0.5) * 1.6, 2.2 + h2 * 4.6 + (h1 > 0.93 ? 3 : 0), h1 < 0.5 ? 0 : h1 < 0.85 ? 1 : 2, h1 * TAU]);
      }
    }
    // floating dust in the floodlight cones (evening / night)
    dust = [];
    if (LK.flood >= 0.7) for (let i = 0; i < 46; i++) dust.push([H.hash(i * 13 + 1), H.hash(i * 29 + 2), 0.6 + H.hash(i * 31 + 3) * 1.1, H.hash(i * 37 + 4) * TAU]);
    // rain splash / puddle ripple spots: wet pitch in the gap + the turf tops
    ripples = [];
    if (LK.rain) for (let i = 0; i < 26; i++) {
      const onPitch = i < 16, h1 = H.hash(i * 71 + 5), h2 = H.hash(i * 53 + 7);
      const x = onPitch ? 400 + h1 * 480 : (i % 2 ? 40 + h1 * 320 : 920 + h1 * 230), y = onPitch ? 575 + h2 * 130 : G.GROUND_Y + 3 + h2 * 7;
      ripples.push([x, y, onPitch ? 1 : 0.55, H.hash(i * 97 + 11)]);
    }
  };
  function canvas(w, h) { const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w)); cv.height = Math.max(1, Math.ceil(h)); stats.sprites++; return cv; }
  function makeFlare() { // soft round glow + thin horizontal streak (lens flare), white, drawn additively and tinted by alpha
    const s = 128, cv = canvas(s, s), c = cv.getContext('2d');
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.12, 'rgba(255,255,255,0.45)'); g.addColorStop(0.4, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    const st = c.createLinearGradient(0, 0, s, 0); st.addColorStop(0, 'rgba(255,255,255,0)'); st.addColorStop(0.5, 'rgba(255,255,255,0.55)'); st.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = st; c.fillRect(0, s / 2 - 1.2, s, 2.4);
    return cv;
  }
  function makeGlow() {
    const s = 64, cv = canvas(s, s), c = cv.getContext('2d');
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, s, s); return cv;
  }

  // ---------- sky layer (bowl scenery): gradient + stars cached; clouds are sprites that drift; birds in the day ----------
  // clouds: [x, y, size] in design px; built at 2x design resolution
  A.buildSky = function (MAP, clouds, cloudCol, cloudA, overcastDeck) {
    stats.staticBuilds++;
    const SS = 2, h = 260; // 2x design, drawn with 'medium' smoothing (mipmapped; 'high' costs ~5 ms per frame here)
    sky = canvas(G.W * SS, h * SS); const c = sky.getContext('2d'); c.scale(SS, SS);
    const g = c.createLinearGradient(0, 0, 0, G.H); g.addColorStop(0, MAP.sky[0]); g.addColorStop(0.55, MAP.sky[1]); g.addColorStop(1, MAP.sky[2]);
    c.fillStyle = g; c.fillRect(0, 0, G.W, h);
    if (MAP.night) { // stars, a few with a soft halo
      for (let i = 0; i < 70; i++) {
        const x = H.hash(i * 3 + 1) * G.W, y = 6 + H.hash(i * 5 + 2) * 200, r = 0.45 + H.hash(i * 7 + 3) * 1.0;
        c.fillStyle = `rgba(255,255,255,${0.35 + 0.5 * H.hash(i * 11 + 4)})`; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
        if (r > 1.25) { c.fillStyle = 'rgba(200,215,255,0.12)'; c.beginPath(); c.arc(x, y, r * 3.2, 0, TAU); c.fill(); }
      }
    }
    if (LK.kind === 'evening') { const s2 = c.createRadialGradient(150, 240, 10, 150, 240, 420); s2.addColorStop(0, 'rgba(255,190,130,0.35)'); s2.addColorStop(1, 'rgba(255,190,130,0)'); c.fillStyle = s2; c.fillRect(0, 0, G.W, h); }
    if (overcastDeck) { const d = c.createLinearGradient(0, 0, 0, 220); d.addColorStop(0, 'rgba(120,128,140,0.45)'); d.addColorStop(1, 'rgba(120,128,140,0)'); c.fillStyle = d; c.fillRect(0, 0, G.W, 220); }
    cloudSprites = (clouds || []).map(([x, y, s], i) => {
      const w = s * 4.6, hh = s * 2.4, cv = canvas(w * SS, hh * SS), q = cv.getContext('2d'); q.scale(SS, SS);
      H.cloud(q, w / 2, hh * 0.55, s, cloudCol, cloudA);
      // shaded underside (light from above) for volume
      q.globalCompositeOperation = 'source-atop';
      const sh = q.createLinearGradient(0, hh * 0.35, 0, hh); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, LK.kind === 'evening' ? 'rgba(120,60,90,0.28)' : 'rgba(70,90,120,0.22)');
      q.fillStyle = sh; q.fillRect(0, 0, w, hh);
      return { cv, x: x - w / 2, y: y - hh * 0.55, w, h: hh, v: 3 + 4 * H.hash(i * 17 + 3) + s * 0.04 };
    });
  };
  A.hasSky = () => !!sky;
  A.drawSky = function (c, t) {
    if (!sky) return;
    const q0 = c.imageSmoothingQuality; c.imageSmoothingQuality = 'medium';
    c.drawImage(sky, 0, 0, G.W, 260);
    const span = G.W + 420;
    for (const cl of cloudSprites) {
      let x = cl.x + t * cl.v; x = ((x + 210) % span + span) % span - 210;
      c.drawImage(cl.cv, x, cl.y, cl.w, cl.h);
    }
    c.imageSmoothingQuality = q0;
    if (LK.kind === 'day') drawBirds(c, t);
  };
  function drawBirds(c, t) {
    c.save(); c.strokeStyle = 'rgba(30,40,60,0.55)'; c.lineWidth = 1.1; c.lineCap = 'round';
    for (let i = 0; i < 5; i++) { // a small flock crossing every ~70 s, each bird flapping on its own phase
      const per = 70, ph = H.hash(i * 7 + 1), u = ((t / per + ph * 0.08) % 1 + 1) % 1;
      const x = -40 + u * (G.W + 80) + i * 14, y = 70 + i * 6 + Math.sin(t * 0.6 + i) * 5 + (i % 2) * 8;
      const f = Math.sin(t * 9 + i * 1.7), s = 3.2 + (i % 3) * 0.5;
      c.beginPath(); c.moveTo(x - s, y - f * s * 0.7); c.quadraticCurveTo(x - s * 0.4, y - 0.6, x, y + 0.6); c.quadraticCurveTo(x + s * 0.4, y - 0.6, x + s, y - f * s * 0.7); c.stroke();
    }
    c.restore();
  }

  // ---------- static: platforms (stone masonry + turf) ----------
  // same outline as draw.js drawPlatformBlocks (play layout unchanged)
  function platPath(c, x0, x1, seed) {
    const gy = G.GROUND_Y; c.beginPath();
    if (seed === 1) { c.moveTo(x0, gy); c.lineTo(x1 - 6, gy); c.quadraticCurveTo(x1, gy + 4, x1, gy + 18); c.lineTo(x1 - 4, G.H + 10); c.lineTo(x0, G.H + 10); }
    else { c.moveTo(x1, gy); c.lineTo(x0 + 6, gy); c.quadraticCurveTo(x0, gy + 4, x0, gy + 18); c.lineTo(x0 + 4, G.H + 10); c.lineTo(x1, G.H + 10); }
    c.closePath();
  }
  // smooth 1D value noise (seeded) for the tint drift across the wall (no obvious tiling)
  function vnoise(x, seed) { const i = Math.floor(x), f = x - i, a = H.hash(seed * 1013 + i), b = H.hash(seed * 1013 + i + 1); return a + (b - a) * sm(f); }
  A.platform = function (c, x0, x1, seed) {
    stats.staticBuilds++;
    const gy = G.GROUND_Y, MAP = show.map, RK = MAP.rock, GR = MAP.grass, inner = seed === 1 ? x1 : x0;
    const litInner = (seed === 1 && LK.dir > 0.2) || (seed === 2 && LK.dir < -0.2); // inner wall faces the key light
    c.save(); platPath(c, x0, x1, seed);
    c.fillStyle = H.shade(RK[2], -0.35); c.fill(); c.clip(); // mortar
    let rnd = seed * 7777 + 13; const R = () => H.hash(rnd++);
    for (let row = 0, y = gy + 11; y < G.H + 10; row++) {
      const bh = 19 + R() * 11;
      for (let x = x0 - 10 - R() * 40; x < x1 + 10;) {
        const bw = 30 + R() * 50, h1 = R(), n = vnoise(x / 120 + row * 0.37, seed);
        const warm = R(); // per-stone warm/cool tint drift so no two neighbours match
        const base = H.mixHex(H.mixHex(H.mixHex(RK[0], RK[1], n), RK[2], h1 * 0.45), warm < 0.5 ? '#9a846a' : '#7a8794', 0.12 + 0.22 * Math.abs(warm - 0.5));
        const j = () => (R() - 0.5) * 3.2; // irregular corners (chipped stones)
        const p = [[x + 1.4 + j(), y + 1.4 + j() * 0.5], [x + bw - 1.4 + j(), y + 1.4 + j() * 0.5], [x + bw - 1.4 + j(), y + bh - 1.4 + j() * 0.5], [x + 1.4 + j(), y + bh - 1.4 + j() * 0.5]];
        const chip = R() < 0.3 ? Math.floor(R() * 4) : -1;
        const sp = new Path2D();
        p.forEach((q, k) => { if (k === chip) { const a = p[(k + 3) % 4], b = p[(k + 1) % 4]; sp.lineTo(q[0] + (a[0] - q[0]) * 0.18, q[1] + (a[1] - q[1]) * 0.18); sp.lineTo(q[0] + (b[0] - q[0]) * 0.16 + (R() - 0.5) * 2, q[1] + (b[1] - q[1]) * 0.16 + 1.2); } else sp.lineTo(q[0], q[1]); });
        sp.closePath();
        const lx = LK.dir < 0 ? x : x + bw, gr = c.createLinearGradient(lx, y, LK.dir < 0 ? x + bw : x, y + bh);
        gr.addColorStop(0, H.shade(base, 0.16)); gr.addColorStop(0.55, base); gr.addColorStop(1, H.shade(base, -0.2));
        c.fillStyle = gr; c.fill(sp);
        // bevel: lit top + light-side edge, dark bottom + shadow-side edge
        c.lineWidth = 1.3;
        c.strokeStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.moveTo(p[3][0], p[3][1]); c.lineTo(p[0][0], p[0][1]); c.lineTo(p[1][0], p[1][1]); if (LK.dir > 0) c.lineTo(p[2][0], p[2][1]); c.stroke();
        c.strokeStyle = 'rgba(10,8,6,0.42)'; c.beginPath(); c.moveTo(p[1][0], p[1][1]); c.lineTo(p[2][0], p[2][1]); c.lineTo(p[3][0], p[3][1]); c.stroke();
        // weathering: darker rim, lighter worn centre, then grain speckles
        { const cxs = x + bw * (0.35 + 0.3 * R()), cys = y + bh * 0.4, wg = c.createRadialGradient(cxs, cys, 2, cxs, cys, Math.max(bw, bh) * 0.75); wg.addColorStop(0, 'rgba(255,250,240,0.10)'); wg.addColorStop(0.6, 'rgba(0,0,0,0)'); wg.addColorStop(1, 'rgba(10,8,6,0.22)'); c.fillStyle = wg; c.fill(sp); }
        for (let k = 0; k < 18; k++) { c.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)'; c.fillRect(x + 3 + R() * (bw - 6), y + 3 + R() * (bh - 6), 1 + R() * 1.4, 1 + R()); }
        // crack
        if (h1 > 0.8) {
          let cx = x + bw * (0.2 + R() * 0.5), cy = y + 3; c.beginPath(); c.moveTo(cx, cy);
          for (let k = 0; k < 4; k++) { cx += (R() - 0.4) * 7; cy += 3 + R() * (bh / 4); c.lineTo(cx, Math.min(cy, y + bh - 2)); }
          c.strokeStyle = 'rgba(20,15,12,0.45)'; c.lineWidth = 0.8; c.stroke();
          c.save(); c.translate(0.7, 0.5); c.strokeStyle = 'rgba(255,255,255,0.10)'; c.stroke(); c.restore();
        }
        // moss (more near the top and on the shaded side), small pebbles in the joints
        if (row < 2 ? R() < 0.55 : R() < 0.12) {
          const mx = x + R() * bw, my = y + (row < 2 ? 1 : R() * bh), n2 = 5 + Math.floor(R() * 8);
          for (let k = 0; k < n2; k++) { c.fillStyle = H.hexA(k % 3 ? H.mixHex(GR[2], '#3d5a22', 0.5) : GR[1], 0.35 + R() * 0.3); c.beginPath(); c.arc(mx + (R() - 0.5) * 12, my + R() * 5, 0.8 + R() * 2.2, 0, TAU); c.fill(); }
        }
        if (R() < 0.35) { c.fillStyle = H.shade(RK[0], 0.1 + R() * 0.2); c.beginPath(); c.ellipse(x + bw - 1, y + bh - 1, 1.2 + R() * 1.6, 0.9 + R(), 0, 0, TAU); c.fill(); }
        x += bw;
      }
      y += bh;
    }
    // ambient occlusion under the turf lip, darker towards the bottom
    const ao = c.createLinearGradient(0, gy + 8, 0, gy + 44); ao.addColorStop(0, 'rgba(8,6,4,0.55)'); ao.addColorStop(1, 'rgba(8,6,4,0)');
    c.fillStyle = ao; c.fillRect(x0, gy, x1 - x0, 50);
    const bt = c.createLinearGradient(0, gy + 60, 0, G.H); bt.addColorStop(0, 'rgba(0,0,0,0)'); bt.addColorStop(1, 'rgba(0,0,0,0.30)');
    c.fillStyle = bt; c.fillRect(x0, gy, x1 - x0, G.H - gy);
    // side lighting of the inner wall (lit: warm rim; shadowed: dark falloff)
    const eg = seed === 1 ? c.createLinearGradient(inner - 46, 0, inner, 0) : c.createLinearGradient(inner + 46, 0, inner, 0);
    if (litInner) { eg.addColorStop(0, 'rgba(0,0,0,0)'); eg.addColorStop(0.75, H.hexA(LK.key, 0.10 * LK.rim)); eg.addColorStop(1, H.hexA(LK.key, 0.35 * LK.rim)); }
    else { eg.addColorStop(0, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(12,8,4,0.45)'); }
    c.fillStyle = eg; c.fillRect(x0, gy, x1 - x0, G.H - gy);
    // overall tone from the variant (evening warm, night cool + wet)
    if (LK.kind === 'evening') { c.fillStyle = 'rgba(120,60,90,0.12)'; c.fillRect(x0, gy, x1 - x0, G.H - gy); }
    if (LK.night) { c.fillStyle = 'rgba(10,18,40,0.28)'; c.fillRect(x0, gy, x1 - x0, G.H - gy); }
    if (LK.wet) { c.strokeStyle = 'rgba(220,235,255,0.10)'; c.lineWidth = 0.8; for (let k = 0; k < 60; k++) { const xx = x0 + H.hash(seed * 31 + k) * (x1 - x0), yy = gy + 20 + H.hash(seed * 37 + k) * 140; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + 0.4, yy + 6 + H.hash(k) * 10); c.stroke(); } }
    c.restore();
    // rim light line along the inner wall when it faces the light
    if (litInner) { c.save(); c.strokeStyle = H.hexA(LK.key, 0.45 * LK.rim); c.lineWidth = 1.2; c.beginPath(); const xr = seed === 1 ? x1 - 0.6 : x0 + 0.6; c.moveTo(xr, gy + 18); c.lineTo(seed === 1 ? xr - 4 : xr + 4, G.H); c.stroke(); c.restore(); }
    // turf: thick top layer with mown stripes, lighting, tiny detail and an overhanging fringe
    c.save(); platPath(c, x0, x1, seed); c.clip();
    const tg = c.createLinearGradient(0, gy - 2, 0, gy + 14); tg.addColorStop(0, H.shade(GR[0], 0.08)); tg.addColorStop(0.3, GR[1]); tg.addColorStop(1, GR[2]);
    c.fillStyle = tg; c.fillRect(x0, gy - 1, x1 - x0, 15);
    for (let x = x0, k = 0; x < x1; x += 16, k++) { const sg = c.createLinearGradient(0, gy, 0, gy + 14); sg.addColorStop(0, `rgba(255,255,255,${k % 2 ? 0.10 : 0})`); sg.addColorStop(1, `rgba(0,0,0,${k % 2 ? 0 : 0.06})`); c.fillStyle = sg; c.fillRect(x, gy - 1, 16, 15); }
    for (let k = 0; k < (x1 - x0) * 0.9; k++) { const xx = x0 + H.hash(seed * 11 + k * 3) * (x1 - x0), yy = gy + H.hash(seed * 13 + k * 5) * 12; c.fillStyle = H.hash(k * 7 + seed) < 0.5 ? 'rgba(255,255,230,0.16)' : 'rgba(10,40,10,0.18)'; c.fillRect(xx, yy, 1, 1.4); }
    const lip = c.createLinearGradient(0, gy - 1, 0, gy + 2); lip.addColorStop(0, H.hexA(LK.key, 0.5)); lip.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = lip; c.fillRect(x0, gy - 1, x1 - x0, 3); // lit top edge
    if (LK.wet) { c.fillStyle = 'rgba(210,230,255,0.22)'; c.fillRect(x0, gy - 0.5, x1 - x0, 1); }
    // fringe of blades hanging over the stone + its shadow
    c.fillStyle = 'rgba(10,20,5,0.35)'; c.fillRect(x0, gy + 13, x1 - x0, 4);
    for (let x = x0, k = 0; x < x1; x += 2.2, k++) {
      const h = 2 + H.hash(seed * 59 + k) * 5.5, w = 1.2 + H.hash(seed * 61 + k) * 1.2;
      c.fillStyle = k % 3 ? GR[2] : H.shade(GR[2], -0.18); c.beginPath(); c.moveTo(x - w, gy + 12.5); c.lineTo(x + (H.hash(k) - 0.5) * 2, gy + 13 + h); c.lineTo(x + w, gy + 12.5); c.fill();
    }
    c.restore();
  };
  // soft contact shadow / AO of the two walls on the distant pitch (gap between the platforms)
  A.pitchStatic = function (c, py) {
    stats.staticBuilds++;
    const L0 = G.LEFT_PLAT[1], R0 = G.RIGHT_PLAT[0];
    // mown stripes with light falloff + tiny grass speckle on the visible pitch, textured painted lines
    c.save(); c.beginPath(); c.rect(L0 - 30, py, R0 - L0 + 60, G.H - py); c.clip();
    for (let k = 0; k < 900; k++) { const x = L0 - 30 + H.hash(k * 3 + 1) * (R0 - L0 + 60), y = py + H.hash(k * 5 + 2) * (G.H - py), s = 0.6 + (y - py) / 140; c.fillStyle = H.hash(k * 7 + 3) < 0.5 ? 'rgba(255,255,220,0.10)' : 'rgba(0,30,0,0.12)'; c.fillRect(x, y, s, s * 0.6); }
    const lt = c.createLinearGradient(L0, 0, R0, 0); // key light falloff across the pitch
    lt.addColorStop(0, H.hexA(LK.key, LK.dir < 0 ? 0.10 : 0)); lt.addColorStop(1, H.hexA(LK.key, LK.dir > 0 ? 0.10 : 0));
    c.fillStyle = lt; c.fillRect(L0 - 30, py, R0 - L0 + 60, G.H - py);
    // worn line paint: break up the halfway line and the circle with small darker flecks
    for (let k = 0; k < 120; k++) { const y = py + 4 + H.hash(k * 11 + 7) * (G.H - py - 4); c.fillStyle = `rgba(60,110,50,${0.15 + 0.25 * H.hash(k * 13)})`; c.fillRect(640 - 1.2 + H.hash(k * 17) * 1.6, y, 1.1, 1.6); }
    for (let k = 0; k < 160; k++) { const a = H.hash(k * 19 + 3) * TAU; c.fillStyle = `rgba(60,110,50,${0.12 + 0.25 * H.hash(k * 23)})`; c.fillRect(640 + Math.cos(a) * 132 - 0.6, 612 + Math.sin(a) * 26 - 0.6, 1.3, 1.2); }
    if (LK.wet) { // damp pitch: darker, with soft floodlight reflections
      c.fillStyle = 'rgba(5,15,30,0.18)'; c.fillRect(L0 - 30, py, R0 - L0 + 60, G.H - py);
      for (const x of [470, 560, 720, 810]) { const g = c.createLinearGradient(0, py, 0, G.H); g.addColorStop(0, 'rgba(230,240,255,0.16)'); g.addColorStop(1, 'rgba(230,240,255,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(x - 6, py); c.lineTo(x + 6, py); c.lineTo(x + 22, G.H); c.lineTo(x - 22, G.H); c.closePath(); c.fill(); }
    }
    c.restore();
    for (const [x, d] of [[L0, 1], [R0, -1]]) {
      const g = c.createLinearGradient(x, 0, x + d * 70, 0); g.addColorStop(0, `rgba(5,10,5,${0.42 * LK.shadow / 0.34})`); g.addColorStop(1, 'rgba(5,10,5,0)');
      c.fillStyle = g; c.fillRect(Math.min(x, x + d * 70), py, 70, G.H - py);
    }
    // the key light throws the left wall's shadow a little further on a low sun
    if (LK.dir < -0.5) { const g = c.createLinearGradient(L0, 0, L0 + 150, 0); g.addColorStop(0, 'rgba(10,15,30,0.16)'); g.addColorStop(1, 'rgba(10,15,30,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(L0, py); c.lineTo(L0 + 60, py); c.lineTo(L0 + 150, G.H); c.lineTo(L0, G.H); c.closePath(); c.fill(); }
  };
  // floodlight cones (evening / night), additive, static; lightList = [[x, y, k], ...] roof floodlights
  A.conesStatic = function (c, lightList) {
    lights = lightList.filter((l) => l[2] === 1).filter((l, i) => i % 3 === 1);
    if (LK.flood < 0.7) return;
    stats.staticBuilds++;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const cx of [190, 470, 810, 1090]) {
      const top = lightList.reduce((b, l) => (Math.abs(l[0] - cx) < Math.abs(b[0] - cx) ? l : b), lightList[0]);
      const g = c.createLinearGradient(0, top[1], 0, G.GROUND_Y + 30);
      g.addColorStop(0, H.hexA(show.map.floodlight || '#ffffff', 0.10 * LK.flood)); g.addColorStop(1, H.hexA(show.map.floodlight || '#ffffff', 0));
      c.fillStyle = g; c.beginPath(); c.moveTo(top[0] - 8, top[1]); c.lineTo(top[0] + 8, top[1]); c.lineTo(cx + (cx - 640) * 0.25 + 150, G.GROUND_Y + 30); c.lineTo(cx + (cx - 640) * 0.25 - 150, G.GROUND_Y + 30); c.closePath(); c.fill();
    }
    c.restore();
  };

  // ---------- per frame: ambient (after the background) ----------
  A.ambient = function (c, t) {
    // floodlight flares with a gentle pulse
    if (lights.length) {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < lights.length; i++) {
        const [x, y] = lights[i], ph = H.hash(i * 7 + 1) * TAU;
        const a = LK.flood * (0.42 + 0.1 * Math.sin(t * 1.6 + ph) + 0.05 * Math.sin(t * 5.3 + ph * 2));
        const s = 26 + 20 * LK.flood;
        c.globalAlpha = clamp(a, 0, 1); c.drawImage(flareSprite, x - s, y - s * 0.5, 2 * s, s);
      }
      c.restore();
    }
    // dust in the floodlight cones
    if (dust.length) {
      c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = H.hexA(show.map.floodlight || '#ffffff', 1);
      for (const [hx, hy, r, ph] of dust) {
        const x = 300 + hx * 700 + Math.sin(t * 0.21 + ph) * 18, y = 250 + ((hy * 300 + t * (4 + r * 3)) % 300);
        c.globalAlpha = (0.18 + 0.22 * (0.5 + 0.5 * Math.sin(t * 2.1 + ph * 3))) * LK.flood; c.beginPath(); c.arc(x, y, r * 0.8, 0, TAU); c.fill();
      }
      c.restore();
    }
  };
  // grass blades with wind sway (drawn after the background, before the play objects)
  A.blades = function (c, t) {
    const GR = show.map.grass, gy = G.GROUND_Y, cols = [show.map.grass_blades || GR[0], GR[1], H.shade(show.map.grass_blades || GR[0], 0.18)];
    for (let tone = 0; tone < 3; tone++) {
      c.fillStyle = cols[tone]; c.beginPath();
      for (const [x, h, tn, ph] of blades) {
        if (tn !== tone) continue;
        const gust = 0.5 + 0.5 * Math.sin(t * 0.37 + x * 0.004);
        const sw = (Math.sin(t * 1.9 + x * 0.045 + ph * 0.2) * 0.65 + Math.sin(t * 3.3 + x * 0.13) * 0.25) * h * (0.25 + 0.35 * gust) - h * 0.15;
        c.moveTo(x - 1.25, gy + 0.6); c.quadraticCurveTo(x + sw * 0.3, gy - h * 0.6, x + sw, gy - h); c.lineTo(x + 1.25, gy + 0.6);
      }
      c.fill();
    }
  };

  // ---------- pipe / spout ----------
  function pipePath(c, part) {
    const P = G.PIPE_PATH; c.beginPath();
    if (part === 'sky') { c.moveTo(P[0][0], P[0][1]); c.lineTo(P[1][0], G.GROUND_Y + 10); }
    else { c.moveTo(P[1][0], G.GROUND_Y - 2); c.lineTo(P[1][0], P[1][1]); c.lineTo(P[2][0], P[2][1]); c.lineTo(P[3][0], G.GROUND_Y + 4); }
  }
  A.pipeStatic = function (c, part) {
    stats.staticBuilds++;
    c.save(); c.lineJoin = 'round'; c.lineCap = 'butt';
    if (part === 'sky') { // glass tube: dark rim, light body, two highlight streaks, metal clamps
      pipePath(c, part); c.strokeStyle = 'rgba(70,90,110,0.42)'; c.lineWidth = G.PIPE_OUTER; c.stroke();
      pipePath(c, part); c.strokeStyle = 'rgba(170,195,215,0.42)'; c.lineWidth = G.PIPE_INNER; c.stroke();
      const x = G.PIPE_X;
      c.fillStyle = 'rgba(255,255,255,0.32)'; c.fillRect(x - G.PIPE_INNER / 2 + 4, -40, 3, G.GROUND_Y + 50);
      c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(x + G.PIPE_INNER / 2 - 7, -40, 1.6, G.GROUND_Y + 50);
      for (let y = 120; y < G.GROUND_Y - 20; y += 110) {
        const g = c.createLinearGradient(x - G.PIPE_OUTER / 2, 0, x + G.PIPE_OUTER / 2, 0); g.addColorStop(0, '#5e6b78'); g.addColorStop(0.35, '#dfe6ec'); g.addColorStop(1, '#4d5864');
        c.fillStyle = g; c.fillRect(x - G.PIPE_OUTER / 2 - 2, y, G.PIPE_OUTER + 4, 6);
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x - G.PIPE_OUTER / 2 - 2, y + 6, G.PIPE_OUTER + 4, 1.2);
        c.fillStyle = '#2f363d'; c.beginPath(); c.arc(x - G.PIPE_OUTER / 2 + 1, y + 3, 1.2, 0, TAU); c.arc(x + G.PIPE_OUTER / 2 - 1, y + 3, 1.2, 0, TAU); c.fill();
      }
    } else { // channel carved in the stone: dark recess, lit lower lip
      pipePath(c, part); c.strokeStyle = 'rgba(15,10,8,0.55)'; c.lineWidth = G.PIPE_OUTER + 2; c.stroke();
      pipePath(c, part); c.strokeStyle = 'rgba(110,98,90,0.55)'; c.lineWidth = G.PIPE_INNER; c.stroke();
      c.save(); c.translate(0, G.PIPE_INNER / 2 - 2); pipePath(c, part); c.strokeStyle = 'rgba(255,240,220,0.10)'; c.lineWidth = 2; c.stroke(); c.restore();
      c.save(); c.translate(0, -G.PIPE_INNER / 2 + 3); pipePath(c, part); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 4; c.stroke(); c.restore();
    }
    c.restore();
    if (part === 'ground') { // spout hole with depth
      const sx = G.SPOUT_X, gy = G.GROUND_Y, g = c.createRadialGradient(sx, gy + 2, 2, sx, gy + 1, G.BALL_R + 4);
      g.addColorStop(0, '#050403'); g.addColorStop(0.8, '#1d1915'); g.addColorStop(1, '#3a332c');
      c.fillStyle = g; c.beginPath(); c.ellipse(sx, gy + 1, G.BALL_R + 4, 5, 0, 0, TAU); c.fill();
    }
  };
  A.pipeGlass = function (c) {
    c.save(); c.lineJoin = 'round';
    pipePath(c, 'sky'); c.strokeStyle = 'rgba(200,225,245,0.22)'; c.lineWidth = G.PIPE_INNER; c.stroke();
    pipePath(c, 'ground'); c.strokeStyle = 'rgba(120,100,85,0.28)'; c.lineWidth = G.PIPE_INNER; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(G.PIPE_X - G.PIPE_INNER / 2 + 4, -40, 2, G.GROUND_Y + 50); // glass reflection over the balls
    c.restore();
  };
  // metal collar around the spout; bounces a little and puffs air/steam on each launch (pop event)
  A.spout = function (c, t, pop, popIdx) {
    const sx = G.SPOUT_X, gy = G.GROUND_Y;
    const u = pop ? t - pop.t : 9;
    const bounce = u < 0.6 ? -2.2 * Math.exp(-u * 8) * Math.cos(u * 34) : 0;
    for (const x of [sx - G.BALL_R - 10, sx + G.BALL_R + 1]) {
      const y = gy - 5 + bounce, g = c.createLinearGradient(x, y, x + 9, y + 8);
      g.addColorStop(0, '#e4eaf0'); g.addColorStop(0.45, '#8e9ba8'); g.addColorStop(1, '#46515c');
      c.fillStyle = g; H.rrect(c, x, y, 9, 8, 2.2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillRect(x + 1.5, y + 1, 6, 1);
      c.fillStyle = '#2b3138'; c.beginPath(); c.arc(x + 4.5, y + 5, 1.1, 0, TAU); c.fill();
    }
    c.strokeStyle = 'rgba(200,210,220,0.85)'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(sx, gy + 1.5 + bounce * 0.5, G.BALL_R + 4.5, 4.8, 0, 0.05, Math.PI - 0.05); c.stroke(); // front lip
    if (u < 1.1) { // air puff venting from both sides of the hole (the rising ball covers the centre), drifting up
      c.save();
      for (let k = 0; k < 14; k++) {
        const h1 = H.hash(popIdx * 131 + k * 7 + 1), h2 = H.hash(popIdx * 131 + k * 7 + 2), d = h2 * 0.1, uu = u - d; if (uu <= 0) continue;
        const side = k % 2 ? 1 : -1, ang = -Math.PI / 2 + side * (0.75 + 0.6 * h1), sp = 110 + 110 * h2, tau = (1 - Math.exp(-4.5 * uu)) / 4.5;
        const x = sx + side * (G.BALL_R - 2) + Math.cos(ang) * sp * tau, y = gy - 2 + Math.sin(ang) * sp * tau - 16 * uu, r = 4 + 14 * eo(uu / 0.9);
        c.globalAlpha = 0.7 * (1 - sm(uu / 1.0)); c.drawImage(glowSprite, x - r, y - r, 2 * r, 2 * r);
      }
      c.restore();
    }
  };

  // ---------- ball extras (scene only; the ball itself is draw.js drawBall, same size) ----------
  A.ballShadow = function (c, x, y, r) {
    const gy = (x >= G.LEFT_PLAT[0] && x <= G.LEFT_PLAT[1]) || (x >= G.RIGHT_PLAT[0] && x <= G.RIGHT_PLAT[1]) ? G.GROUND_Y : null;
    if (gy === null) return;
    const h = gy - (y + r); if (h < -2 || h > 300) return;
    const k = clamp(1 - h / 300, 0, 1), rx = r * (0.7 + 0.6 * (1 - k) + 0.25), ox = -LK.dir * h * 0.12;
    c.save(); c.translate(x + ox, gy + 1.5); c.scale(1, 0.24);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(10,25,5,${0.55 * k * LK.shadow / 0.34})`); g.addColorStop(1, 'rgba(10,25,5,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
  };
  A.ballGloss = function (c, x, y, r) {
    c.save(); c.translate(x, y);
    const a0 = LK.dir < 0 ? Math.PI * 0.95 : -Math.PI * 0.45; // rim light on the side facing the key light
    c.strokeStyle = H.hexA(LK.key, 0.45 * LK.rim + 0.1); c.lineWidth = 1.3; c.beginPath(); c.arc(0, 0, r - 1.2, a0, a0 + Math.PI * 0.55); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.arc(-r * 0.42, -r * 0.5, r * 0.075, 0, TAU); c.fill(); // sharp specular dot
    c.restore();
  };
  // speed streak behind a fast ball (bomb shots only): pts = previous centres, newest first
  A.trail = function (c, pts, r, col, k) {
    if (pts.length < 2) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      const w0 = r * (0.85 - i * 0.18), w1 = r * (0.85 - (i + 1) * 0.18); if (w1 <= 0) break;
      c.fillStyle = H.hexA(col, 0.30 * k * (1 - i / pts.length));
      c.beginPath(); c.moveTo(x0 + nx * w0, y0 + ny * w0); c.lineTo(x1 + nx * w1, y1 + ny * w1); c.lineTo(x1 - nx * w1, y1 - ny * w1); c.lineTo(x0 - nx * w0, y0 - ny * w0); c.closePath(); c.fill();
    }
    c.restore();
  };

  // ---------- windmill ----------
  A.windmillStand = function (c) {
    const hx = G.HUB_X, hy = G.HUB_Y, gy = G.GROUND_Y;
    c.save();
    // ground shadow of the stand
    c.save(); c.translate(hx - LK.dir * 6, gy + 2); c.scale(1, 0.22); const sg = c.createRadialGradient(0, 0, 0, 0, 0, 26); sg.addColorStop(0, `rgba(10,20,5,${0.5 * LK.shadow / 0.34})`); sg.addColorStop(1, 'rgba(10,20,5,0)'); c.fillStyle = sg; c.beginPath(); c.arc(0, 0, 26, 0, TAU); c.fill(); c.restore();
    const leg = (x0, x1) => { // steel leg (hub -> ground) with a lit edge
      const g = c.createLinearGradient(x1 - 3, 0, x1 + 3, 0); g.addColorStop(0, '#3e464f'); g.addColorStop(0.4, '#aeb8c2'); g.addColorStop(1, '#2c3238');
      c.strokeStyle = g; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, hy + 6); c.lineTo(x1, gy); c.stroke();
    };
    leg(hx - 2, hx - 13); leg(hx + 2, hx + 13);
    c.strokeStyle = 'rgba(150,160,170,0.9)'; c.lineWidth = 1.3; // cross bracing
    const yb = [hy + 30, hy + 60, gy - 6];
    const xl = (y) => hx - 2 - 11 * (y - hy - 6) / (gy - hy - 6), xr = (y) => hx + 2 + 11 * (y - hy - 6) / (gy - hy - 6);
    c.beginPath(); for (let i = 0; i < 2; i++) { c.moveTo(xl(yb[i]), yb[i]); c.lineTo(xr(yb[i + 1]), yb[i + 1]); c.moveTo(xr(yb[i]), yb[i]); c.lineTo(xl(yb[i + 1]), yb[i + 1]); } c.stroke();
    c.beginPath(); for (const y of yb) { c.moveTo(xl(y), y); c.lineTo(xr(y), y); } c.stroke();
    const bp = c.createLinearGradient(0, gy - 4, 0, gy + 1); bp.addColorStop(0, '#c7d0d8'); bp.addColorStop(1, '#4a535c'); // base plate + bolts
    c.fillStyle = bp; H.rrect(c, hx - 20, gy - 4, 40, 5, 1.5); c.fill();
    c.fillStyle = '#2a3036'; for (const x of [hx - 16, hx - 8, hx + 8, hx + 16]) { c.beginPath(); c.arc(x, gy - 1.6, 1.1, 0, TAU); c.fill(); }
    c.restore();
  };
  function barShape(c) { H.rrect(c, -G.MILL_HALF - 1, -G.MILL_THICK / 2, 2 * G.MILL_HALF + 2, G.MILL_THICK, 6); }
  function hookPath(c, hp, sgn) { c.beginPath(); hp.forEach((p, i) => (i ? c.lineTo(p[0] * sgn, p[1] * sgn) : c.moveTo(p[0] * sgn, p[1] * sgn))); }
  // dAng = angle change over the last video frame (motion blur when fast)
  A.windmill = function (c, angle, dAng, t, drawBase) {
    const hx = G.HUB_X, hy = G.HUB_Y, gy = G.GROUND_Y;
    const WM = show.map.windmill || ['#e8553e', '#a8321f'], col = WM[0], dark = WM[1];
    const hp = G.hookPoints(12);
    // soft ground shadow: width follows the bar's horizontal extent
    { const ext = 18 + Math.abs(Math.cos(angle)) * G.MILL_HALF * 0.95; c.save(); c.translate(hx - LK.dir * 14, gy + 2); c.scale(1, 0.09); const g = c.createRadialGradient(0, 0, 0, 0, 0, ext); g.addColorStop(0, `rgba(10,20,5,${0.36 * LK.shadow / 0.34})`); g.addColorStop(1, 'rgba(10,20,5,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, ext, 0, TAU); c.fill(); c.restore(); }
    // motion blur: faint copies along the arc already swept this frame
    const tip = Math.abs(dAng) * G.MILL_HALF;
    if (tip > 5) {
      const n = 4, k = clamp((tip - 5) / 14, 0, 1);
      c.save(); c.translate(hx, hy);
      for (let i = n; i >= 1; i--) {
        c.save(); c.rotate(angle - dAng * i / n); c.globalAlpha = 0.09 * k * (1 - (i - 1) / n);
        c.fillStyle = col; barShape(c); c.fill();
        c.strokeStyle = col; c.lineWidth = G.HOOK_THICK; c.lineCap = 'round'; for (const s of [1, -1]) { hookPath(c, hp, s); c.stroke(); }
        c.restore();
      }
      c.restore();
    }
    c.save(); c.translate(hx, hy); c.rotate(angle);
    // cast shadow (offset away from the light)
    c.save(); c.translate(-LK.dir * 3, 4); c.globalAlpha = 0.2; c.fillStyle = '#000'; barShape(c); c.fill(); c.restore();
    const up = Math.cos(angle) >= 0 ? -1 : 1; // which local side (-y or +y) faces up in the world -> gets the highlight
    for (const sgn of [1, -1]) {
      hookPath(c, hp, sgn); c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = dark; c.lineWidth = G.HOOK_THICK + 2.5; c.stroke();
      c.strokeStyle = col; c.lineWidth = G.HOOK_THICK; c.stroke();
      c.save(); c.translate(0, up * sgn * 1.8); hookPath(c, hp, sgn); c.strokeStyle = 'rgba(255,255,255,0.42)'; c.lineWidth = 1.6; c.stroke(); c.restore();
    }
    drawBase(c); // draw.js: the approved bar fill + red/white bands (+ outline)
    c.save(); barShape(c); c.clip();
    const T = G.MILL_THICK / 2, mg = c.createLinearGradient(0, -T * up, 0, T * up);
    mg.addColorStop(0, 'rgba(255,255,255,0.42)'); mg.addColorStop(0.22, 'rgba(255,255,255,0.06)'); mg.addColorStop(0.6, 'rgba(0,0,0,0)'); mg.addColorStop(1, 'rgba(0,0,0,0.32)');
    c.fillStyle = mg; c.fillRect(-G.MILL_HALF - 2, -T, 2 * G.MILL_HALF + 4, 2 * T);
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(-G.MILL_HALF + 4, up < 0 ? -T + 1.2 : T - 2.2, 2 * G.MILL_HALF - 8, 1); // specular line
    for (let x = -G.MILL_HALF + 9; x <= G.MILL_HALF - 9; x += 18) { // rivets
      if (Math.abs(x) < 16) continue;
      for (const y of [-T + 2.6, T - 2.6]) { c.fillStyle = 'rgba(40,20,20,0.55)'; c.beginPath(); c.arc(x, y, 1.25, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.arc(x - 0.35, y - 0.35 * -up, 0.5, 0, TAU); c.fill(); }
    }
    c.restore();
    c.restore();
    // hub: flange with bolts (rotating), cap, glint
    c.save(); c.translate(hx, hy);
    const hg = c.createRadialGradient(-4, -4, 1, 0, 0, 13); hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.45, '#aab3bd'); hg.addColorStop(1, '#3f4851');
    c.fillStyle = hg; c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(20,25,30,0.6)'; c.lineWidth = 1; c.stroke();
    c.save(); c.rotate(angle); c.fillStyle = '#2b3239';
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; c.beginPath(); c.arc(Math.cos(a) * 8.2, Math.sin(a) * 8.2, 1.3, 0, TAU); c.fill(); }
    c.restore();
    const cg = c.createRadialGradient(-1.5, -1.5, 0.5, 0, 0, 5); cg.addColorStop(0, '#f6f8fa'); cg.addColorStop(1, '#515a63');
    c.fillStyle = cg; c.beginPath(); c.arc(0, 0, 4.6, 0, TAU); c.fill();
    const gl = Math.pow(Math.max(0, Math.cos(angle * 2 + 0.6)), 10); // glint when the bar passes a certain angle
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.35 + 0.6 * gl; c.drawImage(glowSprite, -7, -9, 8, 8);
    if (gl > 0.05) { c.globalAlpha = gl; c.strokeStyle = '#ffffff'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-3 - 9 * gl, -5); c.lineTo(-3 + 9 * gl, -5); c.moveTo(-3, -5 - 7 * gl); c.lineTo(-3, -5 + 7 * gl); c.stroke(); }
    c.restore();
  };
  // spark + shock ring where a ball hits the windmill (u = seconds since contact, nx/ny = contact normal)
  A.millSpark = function (c, x, y, u, nx, ny, seed) {
    if (u < 0 || u > 0.32) return;
    const q = u / 0.32;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.8 * (1 - q); c.strokeStyle = '#fff2c8'; c.lineWidth = 2 * (1 - q) + 0.4;
    c.beginPath(); c.ellipse(x, y, 4 + 22 * eo(q), 3 + 14 * eo(q), Math.atan2(ny, nx), 0, TAU); c.stroke();
    c.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      const a = Math.atan2(ny, nx) + (H.hash(seed * 31 + k) - 0.5) * 2.4, sp = 70 + 110 * H.hash(seed * 37 + k), d = sp * eo(q) * 0.3, L = (1 - q) * (5 + 7 * H.hash(seed * 41 + k));
      const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d + 40 * q * q;
      c.strokeStyle = k % 3 ? '#ffd27a' : '#ffffff'; c.lineWidth = 1.3; c.globalAlpha = 1 - q;
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - Math.cos(a) * L, sy - Math.sin(a) * L); c.stroke();
    }
    c.globalAlpha = 0.7 * (1 - q); c.drawImage(glowSprite, x - 14, y - 14, 28, 28);
    c.restore();
  };

  // ---------- goal ----------
  const GD = { dx: 30, dy: -24 }; // depth offset of the far side of the goal (perspective)
  function netGrid(st, t) { // front (near-side) panel vertices with idle sway, slight sag and the goal ripple
    const x0 = G.GOAL_LINE_X + 3, x1 = G.W + 4, y0 = G.BAR_Y + 3, y1 = G.GROUND_Y, step = 9;
    const xs = [], ys = [];
    for (let x = x0; x <= x1; x += step) xs.push(x);
    for (let y = y0; y <= y1; y += step) ys.push(y);
    const rp = st && st.rip;
    const P = ys.map((y) => xs.map((x) => {
      const fx = (x - x0) / (x1 - x0), fy = (y - y0) / (y1 - y0);
      let ox = 0.9 * Math.sin(t * 1.3 + y * 0.05) * fx + 1.6 * Math.sin(Math.PI * fy) * fx, oy = 1.2 * Math.sin(Math.PI * fx) * fy; // sway + sag
      if (rp) {
        const dx = x - rp.x, dy = y - rp.y, r = Math.hypot(dx, dy) || 1;
        const front = sm((rp.u * 300 + 24 - r) / 24), d = rp.a * Math.exp(-3 * rp.u) * Math.sin(0.15 * r - 20 * rp.u) * Math.exp(-r / 150) * front;
        ox += (dx / r) * d; oy += (dy / r) * d * 0.7;
      }
      return [x + ox, y + oy];
    }));
    return P;
  }
  function meshStroke(c, P, close) {
    c.beginPath();
    for (const row of P) { row.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); }
    for (let i = 0; i < P[0].length; i++) { for (let j = 0; j < P.length; j++) { const p = P[j][i]; if (j) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); } }
  }
  // behind the balls in the net: far side panel, roof, back frame
  A.goalBack = function (c, t) {
    const x0 = G.GOAL_LINE_X, x1 = G.W, y0 = G.BAR_Y, y1 = G.GROUND_Y, { dx, dy } = GD, fx = x0 + dx, fy0 = y0 + dy, fy1 = y1 - 6;
    c.save();
    // shadow of the whole goal on the turf
    const sg = c.createLinearGradient(0, y1 - 2, 0, y1 + 9); sg.addColorStop(0, `rgba(10,25,5,${0.5 * LK.shadow / 0.34})`); sg.addColorStop(1, 'rgba(10,25,5,0)');
    c.fillStyle = sg; c.fillRect(x0 - 4 - LK.dir * 4, y1 - 2, x1 - x0 + 8, 11);
    // far side panel (dim, fine mesh)
    c.fillStyle = 'rgba(225,232,242,0.08)'; c.fillRect(fx, fy0, x1 - fx, fy1 - fy0);
    c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 0.6; c.beginPath();
    for (let x = fx + 7; x < x1; x += 7) { c.moveTo(x + 0.6 * Math.sin(t * 1.3 + x * 0.1), fy0); c.lineTo(x, fy1); }
    for (let y = fy0 + 7; y < fy1; y += 7) { c.moveTo(fx, y); c.lineTo(x1, y + 0.5 * Math.sin(t * 1.1 + y * 0.07)); }
    c.stroke();
    const fs = c.createLinearGradient(0, fy0, 0, fy1); fs.addColorStop(0, 'rgba(0,0,0,0.18)'); fs.addColorStop(0.2, 'rgba(0,0,0,0)'); fs.addColorStop(1, 'rgba(0,0,0,0.12)');
    c.fillStyle = fs; c.fillRect(fx, fy0, x1 - fx, fy1 - fy0);
    // roof net (from the crossbar back to the far side)
    c.fillStyle = 'rgba(240,244,250,0.10)'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y0); c.lineTo(x1, fy0); c.lineTo(fx, fy0); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.40)'; c.lineWidth = 0.7; c.beginPath();
    for (let k = 1; k < 4; k++) { const u = k / 4; c.moveTo(x0 + dx * u, y0 + dy * u); c.lineTo(x1, y0 + dy * u); }
    for (let x = x0 + 9; x < x1; x += 9) { c.moveTo(x, y0); c.lineTo(x + dx * 0.95, fy0); }
    c.stroke();
    // far frame: post, bar, the stanchion to the crossbar and the ground bar (tubes with a highlight)
    const tube = (pts, w) => {
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = 'rgba(120,132,148,0.95)'; c.lineWidth = w; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke();
      c.strokeStyle = 'rgba(235,240,246,0.95)'; c.lineWidth = w * 0.45; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0] - 0.6, p[1] - 0.6) : c.moveTo(p[0] - 0.6, p[1] - 0.6))); c.stroke();
    };
    tube([[fx, fy1], [fx, fy0], [x1 + 4, fy0]], 4.4);
    tube([[x0, y0], [fx, fy0]], 3.6);
    tube([[x0 + 4, y1 - 1], [fx, fy1]], 3);
    c.restore();
  };
  // in front of the balls in the net: near-side mesh (cords + knots + cloth shading), frame, ripple, vibration, flash
  // st: { rip: {x,y,u,a} | null, vib: px, barFlash: 0..1, flash: 0..1 at (fx,fy) }
  A.goalFront = function (c, t, st) {
    const x0 = G.GOAL_LINE_X, x1 = G.W, y0 = G.BAR_Y, y1 = G.GROUND_Y;
    c.save();
    // cloth shading of the near panel + the crossbar's shadow on the net
    c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    const cs = c.createLinearGradient(0, y0, 0, y1); cs.addColorStop(0, 'rgba(0,0,0,0.26)'); cs.addColorStop(0.1, 'rgba(0,0,0,0.04)'); cs.addColorStop(0.75, 'rgba(0,0,0,0)'); cs.addColorStop(1, 'rgba(0,0,0,0.10)');
    c.fillStyle = cs; c.fillRect(x0 + 4, y0 + 4, x1 - x0, y1 - y0 - 4);
    const P = netGrid(st, t);
    c.save(); c.translate(0.7, 0.8); meshStroke(c, P); c.strokeStyle = 'rgba(15,25,35,0.22)'; c.lineWidth = 1.5; c.stroke(); c.restore(); // cord shadow
    meshStroke(c, P); c.strokeStyle = 'rgba(255,255,255,0.68)'; c.lineWidth = 0.95; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.9)'; // knots
    for (const row of P) for (const p of row) c.fillRect(p[0] - 0.9, p[1] - 0.9, 1.8, 1.8);
    // goal line painted on the turf (seen edge-on: a short white band on the turf at the post foot), slightly worn
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillRect(x0 - 3, y1 - 0.5, 6, 13);
    for (let k = 0; k < 8; k++) { c.fillStyle = 'rgba(70,120,50,0.35)'; c.fillRect(x0 - 3 + H.hash(k * 3) * 5, y1 + H.hash(k * 5) * 12, 1.2, 1.2); }
    // frame: crossbar + front post exactly on their colliders, shaded as round tubes; vibrates a little after a hit
    const vib = st.vib || 0, vy = vib * Math.sin(t * 95), vx = vib * 0.6 * Math.sin(t * 83 + 1);
    c.save(); c.translate(0, vy);
    const bt = G.BAR_TOP, bb = G.BAR_BOTTOM, cb = c.createLinearGradient(0, bt, 0, bb);
    cb.addColorStop(0, '#d9e0e7'); cb.addColorStop(0.28, '#ffffff'); cb.addColorStop(0.62, '#e3e8ee'); cb.addColorStop(1, '#8996a4');
    c.fillStyle = cb; c.fillRect(G.BAR_X0, bt, G.BAR_X1 - G.BAR_X0, bb - bt);
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(G.BAR_X0 + 4, bb, G.BAR_X1 - G.BAR_X0, 1.2);
    c.fillStyle = '#f4f7fa'; for (let x = x0 + 14; x < x1; x += 18) c.fillRect(x, bb, 1.2, 2.2); // net hooks under the bar
    c.restore();
    c.save(); c.translate(vx, 0);
    const pl = x0 - G.POST_W / 2, pt = G.BAR_Y - G.BAR_THICK / 2, pg = c.createLinearGradient(pl, 0, pl + G.POST_W, 0);
    pg.addColorStop(0, '#9aa6b2'); pg.addColorStop(0.22, '#ffffff'); pg.addColorStop(0.5, '#eef2f6'); pg.addColorStop(0.82, '#b9c3cd'); pg.addColorStop(1, '#7d8a97');
    c.fillStyle = pg; c.fillRect(pl, pt, G.POST_W, y1 - pt);
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(pl, y1 - 3, G.POST_W, 3); // foot in the grass
    if (LK.flood >= 0.7) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 * LK.flood; c.drawImage(glowSprite, pl - 6, pt - 8, G.POST_W + 12, 18); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    c.restore();
    if (st.barFlash > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7 * st.barFlash; c.fillStyle = '#fff1c2'; c.fillRect(G.BAR_X0 - 2, G.BAR_TOP - 3, G.BAR_X1 - G.BAR_X0 + 2, G.BAR_THICK + 6); c.drawImage(glowSprite, st.barX - 30, G.BAR_Y - 30, 60, 60); c.restore(); }
    if (st.flash > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.55 * st.flash; c.drawImage(glowSprite, st.fx - 110, st.fy - 110, 220, 220); c.restore(); }
    c.restore();
  };
  // grass + dust kicked up where the goal ball lands in the net (u = s since the goal)
  A.goalDust = function (c, x, y, u, seed, cols) {
    if (u < 0 || u > 0.9) return;
    c.save();
    for (let k = 0; k < 18; k++) {
      const h1 = H.hash(seed * 71 + k), h2 = H.hash(seed * 73 + k * 3), a = -Math.PI / 2 + (h1 - 0.5) * 2.6, sp = 60 + 140 * h2;
      const tau = (1 - Math.exp(-3 * u)) / 3, px = x + Math.cos(a) * sp * tau, py = Math.min(G.GROUND_Y + 2, y + Math.sin(a) * sp * tau + 260 * u * u);
      c.globalAlpha = 1 - sm(u / 0.9);
      if (k % 3 === 0) { const r = 3 + 10 * eo(u / 0.9); c.globalAlpha *= 0.4; c.drawImage(glowSprite, px - r, py - r, 2 * r, 2 * r); }
      else { c.fillStyle = k % 3 === 1 ? cols[0] : cols[1]; c.save(); c.translate(px, py); c.rotate(u * 12 + k); c.fillRect(-1.6, -0.7, 3.2, 1.4); c.restore(); }
    }
    c.restore();
  };

  // ---------- keeper ----------
  // k = [footY, crouch, arms, mode] from the timeline; the skeleton (collider positions) comes from G.keeperSkeleton
  A.keeper = function (c, k, t) {
    const footY = k[0], cr = k[1], arms = k[2];
    const sk = G.keeperSkeleton(G.KEEPER_X, footY, cr, arms), j = sk.joints, x = G.KEEPER_X;
    const KP = show.map.keeper || ['#f28a1c', '#c9690c'], KIT = KP[0], KIT_D = KP[1], SHORTS = '#28323f', SKIN = '#e2a882', GLOVE = '#f7f9fb', BOOT = '#191d22';
    const air = clamp((G.GROUND_Y - footY) / 30, 0, 1);
    const bob = air < 0.05 ? Math.sin(t * 2.4) * 0.7 * (1 - cr * 0.5) : 0; // idle breathing (upper body only)
    const lean = -0.06 * arms - 0.04 * air; // leans into the reach
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    // soft shadow, smaller and lighter in the air
    { const hAir = G.GROUND_Y - footY, s = clamp(1 - hAir / 160, 0.25, 1); c.save(); c.translate(x - LK.dir * hAir * 0.1, G.GROUND_Y + 1.5); c.scale(1, 0.22); const g = c.createRadialGradient(0, 0, 0, 0, 0, 20 * (0.7 + 0.3 * s)); g.addColorStop(0, `rgba(10,25,5,${0.5 * s * LK.shadow / 0.34})`); g.addColorStop(1, 'rgba(10,25,5,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 20, 0, TAU); c.fill(); c.restore(); }
    const L = G.K.legLen / 2 + 1.5;
    const leg = (dx, shortsCol, sockCol, back) => {
      const hx = x + dx, hy = j.hipY, fx = x + dx - 2 + air * 5, fy = footY - 3 - air * 7; // tuck on a jump
      const d = Math.hypot(fx - hx, fy - hy), kOut = Math.sqrt(Math.max(0, L * L - (d / 2) * (d / 2)));
      const kx = (hx + fx) / 2 - kOut, ky = (hy + fy) / 2;
      c.strokeStyle = shortsCol; c.lineWidth = 8.5; c.beginPath(); c.moveTo(hx, hy); c.lineTo(kx, ky); c.stroke(); // thigh
      c.strokeStyle = SKIN; c.lineWidth = 6; c.beginPath(); c.moveTo(kx, ky); c.lineTo(kx + (fx - kx) * 0.18, ky + (fy - ky) * 0.18); c.stroke(); // knee
      c.strokeStyle = sockCol; c.lineWidth = 6.4; c.beginPath(); c.moveTo(kx + (fx - kx) * 0.18, ky + (fy - ky) * 0.18); c.lineTo(fx, fy); c.stroke(); // sock
      c.strokeStyle = back ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.75)'; c.lineWidth = 1.6; c.beginPath(); const tx = kx + (fx - kx) * 0.24, ty = ky + (fy - ky) * 0.24; c.moveTo(tx - 3, ty); c.lineTo(tx + 3, ty); c.stroke(); // sock band
      if (!back) { c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(kx - 1.5, ky + 3); c.lineTo(fx - 2, fy - 2); c.stroke(); }
      // boot: shaped, with a light sole and a lace highlight
      c.fillStyle = back ? '#101317' : BOOT; c.beginPath(); c.moveTo(fx + 3, fy - 2); c.quadraticCurveTo(fx + 3.5, fy + 3.5, fx + 1, fy + 3.6); c.lineTo(fx - 9.5, fy + 3.6); c.quadraticCurveTo(fx - 11, fy + 0.5, fx - 6, fy - 1.4); c.closePath(); c.fill();
      c.fillStyle = back ? '#6d747c' : '#cfd5db'; c.fillRect(fx - 9.5, fy + 3, 12, 1.3);
      if (!back) { c.fillStyle = H.hexA(KIT, 0.9); c.fillRect(fx - 5, fy - 0.6, 4, 1.1); }
    };
    leg(4, H.shade(SHORTS, -0.25), KIT_D, true);
    c.save(); c.translate(0, bob); c.translate(x, j.hipY); c.rotate(lean); c.translate(-x, -j.hipY); // upper body
    const glove = (hx, hy, ph, back) => {
      c.save(); c.translate(hx, hy); c.rotate(ph);
      c.fillStyle = back ? '#d3d8de' : GLOVE; H.rrect(c, -3.5, -4.6, 9.5, 9.2, 3.6); c.fill();
      c.strokeStyle = 'rgba(40,50,60,0.55)'; c.lineWidth = 0.9; H.rrect(c, -3.5, -4.6, 9.5, 9.2, 3.6); c.stroke();
      c.fillStyle = back ? KIT_D : KIT; c.fillRect(-4.2, -4.2, 2.6, 8.4); // wrist strap
      if (!back) { c.strokeStyle = 'rgba(60,70,80,0.35)'; c.lineWidth = 0.6; c.beginPath(); for (const yy of [-1.6, 0.8, 3]) { c.moveTo(2.5, yy); c.lineTo(5.6, yy); } c.stroke(); c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(-0.5, -3.8, 4, 1); }
      c.restore();
    };
    const arm = (dphi, back) => {
      const ph = j.phi + dphi, sx = j.shoulderX + (back ? 4 : 0), sy = j.shoulderY;
      const hx = sx + Math.cos(ph) * G.K.armLen, hy = sy + Math.sin(ph) * G.K.armLen;
      const ex = (sx + hx) / 2 + Math.cos(ph + Math.PI / 2) * 2.2, ey = (sy + hy) / 2 + Math.sin(ph + Math.PI / 2) * 2.2; // slight elbow bend
      c.strokeStyle = back ? KIT_D : KIT; c.lineWidth = G.K.armW; c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(ex, ey, hx, hy); c.stroke();
      if (!back) { c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 2; c.beginPath(); c.moveTo(sx - 1, sy - 2); c.quadraticCurveTo(ex - 1.5, ey - 2, hx - 1, hy - 1.5); c.stroke(); }
      c.strokeStyle = back ? H.shade(KIT_D, -0.3) : KIT_D; c.lineWidth = G.K.armW - 1; c.beginPath(); c.moveTo(hx - Math.cos(ph) * 4, hy - Math.sin(ph) * 4); c.lineTo(hx - Math.cos(ph) * 1.5, hy - Math.sin(ph) * 1.5); c.stroke(); // cuff
      glove(hx, hy, ph, back);
    };
    arm(-0.18 - 0.08 * (1 - arms), true);
    c.restore();
    leg(-2, SHORTS, KIT, false);
    c.save(); c.translate(0, bob); c.translate(x, j.hipY); c.rotate(lean); c.translate(-x, -j.hipY);
    // torso: tapered jersey with shading from the key light, chest panel, collar, number on the back
    const T = sk.torso, tl = T.x - T.w / 2, tr = T.x + T.w / 2, tt = T.y - T.h / 2, tb = T.y + T.h / 2;
    c.beginPath(); c.moveTo(tl + 1, tt + 5); c.quadraticCurveTo(tl, tt, tl + 6, tt); c.lineTo(tr - 6, tt); c.quadraticCurveTo(tr + 1, tt, tr + 0.5, tt + 6); c.lineTo(tr - 0.5, tb - 2); c.lineTo(tl + 1.5, tb - 2); c.closePath();
    const tg = c.createLinearGradient(LK.dir < 0 ? tl : tr, 0, LK.dir < 0 ? tr : tl, 0); tg.addColorStop(0, H.shade(KIT, 0.28)); tg.addColorStop(0.5, KIT); tg.addColorStop(1, KIT_D);
    c.fillStyle = tg; c.fill();
    c.save(); c.clip();
    c.fillStyle = H.hexA(KIT_D, 0.45); c.beginPath(); c.moveTo(tl, tt + 9); c.lineTo(tr, tt + 3); c.lineTo(tr, tt + 7); c.lineTo(tl, tt + 13); c.closePath(); c.fill(); // diagonal chest panel (own design)
    c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(tl, tb - 7, T.w, 6); // fold above the shorts
    c.restore();
    c.fillStyle = KIT_D; c.beginPath(); c.moveTo(T.x - 6, tt); c.lineTo(T.x - 1, tt + 4); c.lineTo(T.x + 3, tt); c.closePath(); c.fill(); // collar
    c.fillStyle = 'rgba(255,255,255,0.88)'; c.font = '800 10px "Bahnschrift", "Segoe UI", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('1', T.x + 4, T.y - 1);
    // shorts with a side stripe
    c.fillStyle = SHORTS; H.rrect(c, tl + 0.5, tb - 8, T.w - 1, 10, 4); c.fill();
    c.fillStyle = H.hexA(KIT, 0.85); c.fillRect(tr - 4, tb - 7.5, 1.8, 9);
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(tl + 2, tb - 7.5, T.w - 6, 1.4);
    // neck + head (stylised profile, no face detail beyond an eye dot; hair or a cap in the sunny variant)
    const hd = sk.head;
    c.fillStyle = H.shade(SKIN, -0.12); c.fillRect(hd.x - 2, hd.y + hd.r - 3, 5, 5);
    const sg = c.createRadialGradient(hd.x - 3, hd.y - 3, 1, hd.x, hd.y, hd.r + 1); sg.addColorStop(0, H.shade(SKIN, 0.18)); sg.addColorStop(1, H.shade(SKIN, -0.18));
    c.fillStyle = sg; c.beginPath(); c.arc(hd.x, hd.y, hd.r, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(hd.x - hd.r + 1, hd.y - 1); c.lineTo(hd.x - hd.r - 2.5, hd.y + 2); c.lineTo(hd.x - hd.r + 1, hd.y + 3); c.fill(); // nose
    c.fillStyle = H.shade(SKIN, -0.25); c.beginPath(); c.ellipse(hd.x + 2.5, hd.y + 1, 1.7, 2.3, 0, 0, TAU); c.fill(); // ear
    if (LK.kind === 'day') { // cap with a brim (sun)
      c.fillStyle = KIT_D; c.beginPath(); c.arc(hd.x + 0.5, hd.y - 1.5, hd.r + 0.6, Math.PI * 1.02, Math.PI * 2.02); c.fill();
      c.fillStyle = H.shade(KIT_D, -0.25); c.beginPath(); c.ellipse(hd.x - hd.r + 0.5, hd.y - 2.2, 5.5, 1.5, -0.1, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(hd.x - 3, hd.y - hd.r + 0.2, 6, 1.2);
    } else {
      c.fillStyle = '#33241b'; c.beginPath(); c.arc(hd.x + 1, hd.y - 2, hd.r + 0.6, Math.PI * 0.95, Math.PI * 2.15); c.fill(); c.fillRect(hd.x + 2, hd.y - 3, hd.r - 2, 6);
      c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1; c.beginPath(); c.arc(hd.x + 1, hd.y - 2, hd.r - 1, Math.PI * 1.25, Math.PI * 1.65); c.stroke();
    }
    c.fillStyle = '#161616'; c.beginPath(); c.arc(hd.x - 4, hd.y, 1.2, 0, TAU); c.fill();
    arm(0, false);
    c.restore();
    c.restore();
  };

  // ---------- weather + effects ----------
  A.rain = function (c, t) {
    if (!LK.rain) return;
    c.save(); c.lineCap = 'round';
    for (const [n, sp, len, a, w, sx] of [[60, 560, 11, 0.16, 0.8, 70], [26, 900, 22, 0.28, 1.3, 120]]) { // far + near layer
      c.strokeStyle = `rgba(205,220,245,${a})`; c.lineWidth = w; c.beginPath();
      for (let i = 0; i < n; i++) {
        const h1 = H.hash(i * 17 + n), h2 = H.hash(i * 29 + n * 3), v = sp * (0.85 + 0.3 * H.hash(i * 7 + n));
        const y = ((h2 * (G.H + 60) + t * v) % (G.H + 60)) - 30, x = ((h1 * (G.W + 120) - t * sx) % (G.W + 120) + G.W + 120) % (G.W + 120) - 60;
        c.moveTo(x, y); c.lineTo(x - len * sx / sp, y + len);
      }
      c.stroke();
    }
    // splashes + puddle ripples (wet pitch and turf tops), each spot repeating on its own phase
    for (const [x, y, s, ph] of ripples) {
      const u = ((t * 1.25 + ph) % 1 + 1) % 1;
      c.strokeStyle = `rgba(220,232,255,${0.45 * (1 - u) * s})`; c.lineWidth = 0.8;
      c.beginPath(); c.ellipse(x, y, 1.5 + 9 * u * s, 0.5 + 2.4 * u * s, 0, 0, TAU); c.stroke();
      if (u < 0.18) { c.strokeStyle = `rgba(230,240,255,${0.6 * (1 - u / 0.18)})`; c.beginPath(); c.moveTo(x - 2, y); c.lineTo(x - 3.5, y - 3 * s); c.moveTo(x + 2, y); c.lineTo(x + 3.5, y - 3 * s); c.stroke(); }
    }
    c.restore();
  };
  // goal celebration extras in scene space: sparks in the scorer's colours + a light sweep (u = s since the goal)
  A.goalExtras = function (c, u, cols, seed, ox, oy) {
    if (u < 0 || u > 1.6) return;
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (let k = 0; k < 26; k++) {
      const h1 = H.hash(seed * 191 + k), h2 = H.hash(seed * 193 + k * 3), d = h2 * 0.15, uu = u - d; if (uu <= 0 || uu > 1.1) continue;
      const a = Math.PI * (0.55 + 0.8 * h1), sp = 300 + 420 * h2, tau = (1 - Math.exp(-3 * uu)) / 3;
      const x = ox + Math.cos(a) * sp * tau, y = oy - Math.sin(a) * sp * tau + 120 * uu * uu, vx = Math.cos(a) * sp * Math.exp(-3 * uu), vy = -Math.sin(a) * sp * Math.exp(-3 * uu) + 240 * uu;
      const L = 0.035, al = 1 - sm(uu / 1.1);
      c.strokeStyle = H.hexA(cols[k % cols.length], 0.9 * al); c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - vx * L, y - vy * L); c.stroke();
      c.globalAlpha = 0.5 * al; c.drawImage(glowSprite, x - 4, y - 4, 8, 8); c.globalAlpha = 1;
    }
    const q = (u - 0.15) / 0.8; // light sweep: a soft diagonal band crossing the scene once
    if (q > 0 && q < 1) {
      const cx = -300 + q * (G.W + 600), g = c.createLinearGradient(cx - 120, 0, cx + 120, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${0.14 * Math.sin(Math.PI * q)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.save(); c.transform(1, 0, -0.35, 1, 0, 0); c.fillRect(cx - 120 + 0.35 * 360, 0, 240, G.H); c.restore();
    }
    c.restore();
  };
  // slow-motion good hit (screen space, w = 0..1 strength): speed lines + subtle chromatic edge
  A.slowmo = function (c, W, Hh, w, t) {
    if (w <= 0.01) return;
    c.save();
    const cx = W / 2, cy = Hh / 2, R = Math.hypot(cx, cy);
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU + H.hash(i * 7 + 1) * 0.2 + t * 0.05, r0 = R * (0.62 + 0.18 * H.hash(i * 11 + 2)), r1 = R * 1.02;
      c.strokeStyle = `rgba(255,255,255,${0.10 * w * (0.5 + 0.5 * H.hash(i * 13 + 3))})`; c.lineWidth = (1 + 2 * H.hash(i * 17)) * W / 1280;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.stroke();
    }
    for (const [dx, col] of [[-6, '255,40,60'], [6, '40,200,255']]) { // chromatic fringe only at the screen edges
      const g = c.createRadialGradient(cx + dx * W / 1280, cy, Hh * 0.52, cx + dx * W / 1280, cy, R);
      g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${0.16 * w})`);
      c.fillStyle = g; c.fillRect(0, 0, W, Hh);
    }
    c.restore();
  };

  // ---------- UI polish (rounded panels with gradient, top highlight, soft drop shadow) ----------
  // fill: base colour (rgba string or hex); same rectangle as the classic panel, so layouts do not move
  A.panel = function (c, x, y, w, h, r, fill, opts) {
    opts = opts || {};
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.38)'; c.shadowBlur = opts.blur == null ? 14 : opts.blur; c.shadowOffsetY = opts.dy == null ? 4 : opts.dy;
    c.fillStyle = fill; H.rrect(c, x, y, w, h, r); c.fill();
    c.shadowColor = 'transparent';
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,255,255,0.13)'); g.addColorStop(0.45, 'rgba(255,255,255,0.03)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.16)');
    c.fillStyle = g; H.rrect(c, x, y, w, h, r); c.fill(); // glass sheen
    c.strokeStyle = opts.edge || 'rgba(255,255,255,0.16)'; c.lineWidth = 1; H.rrect(c, x + 0.5, y + 0.5, w - 1, h - 1, Math.max(0, r - 0.5)); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(x + r, y + 1, w - 2 * r, 1); // top highlight
    c.restore();
  };
  // white score box with a brushed-metal edge
  A.scoreBox = function (c, x, y, w, h, r) {
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 8; c.shadowOffsetY = 2;
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#f1f4f8'); g.addColorStop(1, '#d6dde6');
    c.fillStyle = g; H.rrect(c, x, y, w, h, r); c.fill(); c.shadowColor = 'transparent';
    c.strokeStyle = 'rgba(120,135,155,0.6)'; c.lineWidth = 1.2; H.rrect(c, x + 0.6, y + 0.6, w - 1.2, h - 1.2, r); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(x + r, y + 1.5, w - 2 * r, 1.2);
    c.restore();
  };

  window.ARTPRO = A;
})();
