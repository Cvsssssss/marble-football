/* MARBLE CUP renderer: Canvas 2D, deterministic, frame-by-frame. Design space 1280x720, output scale 1.5. */
(function () {
  'use strict';
  const G = window.GEOM;
  let OUT_W = 1920, OUT_H = 1080, S = OUT_W / G.W; // preview: 1280x720 (set in initRenderer)
  const BG_SS = 2; // static background cached at 2x design (2560x1440) and downsampled = supersampling
  const FONT = '"Bahnschrift", "Segoe UI", "Arial", sans-serif';
  let show, canvas, ctx, bgCanvas, segIndex = [];
  const FPS = 30;

  // ---------- helpers ----------
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const easeOut = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const easeOutBack = (x) => { x = clamp(x, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const lerp = (a, b, u) => a + (b - a) * u;
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
  function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
  function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; } else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; } return `rgb(${r | 0},${g | 0},${b | 0})`; }
  function text(c, s, x, y, size, color, align, weight, base) {
    c.font = `${weight || 700} ${size}px ${FONT}`; c.fillStyle = color; c.textAlign = align || 'center'; c.textBaseline = base || 'middle'; c.fillText(s, x, y);
  }
  function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mixHex(a, b, u) { const x = hexRgb(a), y = hexRgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * u).toString(16).padStart(2, '0')).join(''); }
  function lum(hex) { const [r, g, b] = hexRgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }
  const inkOn = (hex) => (lum(hex) > 0.6 ? '#10233d' : '#ffffff');
  function fitText(c, s, maxW, size, weight) { let z = size; c.font = `${weight || 700} ${z}px ${FONT}`; while (c.measureText(s).width > maxW && z > 8) { z -= 1; c.font = `${weight || 700} ${z}px ${FONT}`; } return z; }

  // ---------- static background (sky, rock, grass, pipe base) ----------
  function buildBackground() {
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = G.W * BG_SS; bgCanvas.height = G.H * BG_SS;
    const c = bgCanvas.getContext('2d');
    c.scale(BG_SS, BG_SS);
    // sky: clean blue vertical gradient
    const sky = c.createLinearGradient(0, 0, 0, G.H);
    const MAP = show.map;
    sky.addColorStop(0, MAP.sky[0]); sky.addColorStop(0.55, MAP.sky[1]); sky.addColorStop(1, MAP.sky[2]);
    c.fillStyle = sky; c.fillRect(0, 0, G.W, G.H);
    // pipe (vertical part in the sky)
    drawPipeBase(c, 'sky');
    // platforms
    drawPlatform(c, G.LEFT_PLAT[0] - 20, G.LEFT_PLAT[1], 1);
    drawPlatform(c, G.RIGHT_PLAT[0], G.RIGHT_PLAT[1] + 20, 2);
    drawPipeBase(c, 'ground');
    // spout hole + collar
    const sx = G.SPOUT_X, gy = G.GROUND_Y;
    c.fillStyle = '#2b2622'; c.beginPath(); c.ellipse(sx, gy + 1, G.BALL_R + 4, 5, 0, 0, Math.PI * 2); c.fill();
  }
  function drawPlatform(c, x0, x1, seed) {
    const gy = G.GROUND_Y;
    c.save();
    // rock body with soft rounded inner edge
    c.beginPath();
    const inner = seed === 1 ? x1 : x0;
    if (seed === 1) { c.moveTo(x0, gy); c.lineTo(x1 - 6, gy); c.quadraticCurveTo(x1, gy + 4, x1, gy + 18); c.lineTo(x1 - 4, G.H + 10); c.lineTo(x0, G.H + 10); }
    else { c.moveTo(x1, gy); c.lineTo(x0 + 6, gy); c.quadraticCurveTo(x0, gy + 4, x0, gy + 18); c.lineTo(x0 + 4, G.H + 10); c.lineTo(x1, G.H + 10); }
    c.closePath();
    const rg = c.createLinearGradient(0, gy, 0, G.H);
    const MAP = show.map;
    rg.addColorStop(0, MAP.rock[0]); rg.addColorStop(0.5, MAP.rock[1]); rg.addColorStop(1, MAP.rock[2]);
    c.fillStyle = rg; c.fill();
    c.clip();
    // soft texture: blotches + faint strata
    for (let i = 0; i < 140; i++) {
      const h1 = hash(seed * 1000 + i), h2 = hash(seed * 2000 + i * 7), h3 = hash(seed * 3000 + i * 13);
      const x = x0 + h1 * (x1 - x0), y = gy + 18 + h2 * (G.H - gy), r = 6 + h3 * 22;
      const gr = c.createRadialGradient(x, y, 0, x, y, r);
      const light = h3 > 0.5;
      gr.addColorStop(0, light ? 'rgba(255,225,190,0.10)' : 'rgba(40,20,10,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = 'rgba(50,28,15,0.12)'; c.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      c.beginPath(); const yy = gy + 45 + k * 32;
      for (let x = x0; x <= x1; x += 16) c.lineTo(x, yy + Math.sin(x * 0.03 + k * 2 + seed) * 4);
      c.stroke();
    }
    // shading toward the void edge
    const eg = seed === 1 ? c.createLinearGradient(inner - 40, 0, inner, 0) : c.createLinearGradient(inner + 40, 0, inner, 0);
    eg.addColorStop(0, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(30,15,5,0.35)');
    c.fillStyle = eg; c.fillRect(x0, gy, x1 - x0, G.H - gy);
    // grass
    const gg = c.createLinearGradient(0, gy - 4, 0, gy + 16);
    gg.addColorStop(0, MAP.grass[0]); gg.addColorStop(0.35, MAP.grass[1]); gg.addColorStop(1, MAP.grass[2]);
    c.fillStyle = gg; c.fillRect(x0, gy - 1, x1 - x0, 17);
    c.fillStyle = 'rgba(30,70,20,0.35)'; c.fillRect(x0, gy + 15, x1 - x0, 3);
    c.restore();
    // blades along top edge
    c.fillStyle = MAP.grass_blades || MAP.grass[0];
    for (let x = x0 + 2; x < x1 - 2; x += 5) {
      const h = 2 + hash(seed * 77 + x) * 3.5;
      c.beginPath(); c.moveTo(x - 2, gy); c.lineTo(x, gy - h); c.lineTo(x + 2, gy); c.fill();
    }
  }
  const PIPE_FILL = '#8fa2b4', PIPE_EDGE = '#7b8fa2';
  function pipePath(c, part) {
    const P = G.PIPE_PATH;
    c.beginPath();
    if (part === 'sky') { c.moveTo(P[0][0], P[0][1]); c.lineTo(P[1][0], G.GROUND_Y + 10); }
    else { c.moveTo(P[1][0], G.GROUND_Y - 2); c.lineTo(P[1][0], P[1][1]); c.lineTo(P[2][0], P[2][1]); c.lineTo(P[3][0], G.GROUND_Y + 4); }
  }
  function drawPipeBase(c, part) {
    c.save(); c.lineJoin = 'round'; c.lineCap = 'butt';
    pipePath(c, part);
    c.strokeStyle = part === 'sky' ? 'rgba(90,110,130,0.30)' : 'rgba(40,30,25,0.35)'; c.lineWidth = G.PIPE_OUTER; c.stroke();
    pipePath(c, part);
    c.strokeStyle = part === 'sky' ? 'rgba(160,185,205,0.55)' : 'rgba(120,105,95,0.55)'; c.lineWidth = G.PIPE_INNER; c.stroke();
    c.restore();
  }
  function drawPipeGlass(c) {
    c.save(); c.lineJoin = 'round';
    pipePath(c, 'sky'); c.strokeStyle = 'rgba(200,225,245,0.22)'; c.lineWidth = G.PIPE_INNER; c.stroke();
    pipePath(c, 'ground'); c.strokeStyle = 'rgba(120,100,85,0.28)'; c.lineWidth = G.PIPE_INNER; c.stroke();
    c.restore();
  }

  // ---------- ball ----------
  // Ball style from a kit: body = primary (with realistic shading), pentagons/patches = secondary.
  // P2: with logos_on_balls the ball is a light neutral ball with the team crest printed on it, a thin ring and
  // small accents in the team colour (kit.ring); the crest never changes the ball size.
  const styleCache = {};
  const logoImgs = {};
  function kitStyle(kit) {
    const team = kit.team || kit.id;
    const ring = kit.ring || (lum(kit.primary) > 0.8 ? kit.secondary : kit.primary);
    const logo = show && show.logosOnBalls && logoImgs[team] ? logoImgs[team] : null;
    const k = kit.primary + kit.secondary + ring + (logo ? team : '');
    if (!styleCache[k]) {
      const p = kit.primary;
      styleCache[k] = { base: mixHex(p, '#ffffff', 0.35), mid: p, dark: mixHex(p, '#1a2433', 0.38), patch: kit.secondary,
        seam: mixHex(kit.secondary, p, 0.35), edge: lum(kit.secondary) > 0.75 && lum(p) > 0.75 ? 'rgba(40,50,60,0.55)' : 'rgba(10,20,30,0.28)', trail: logo ? ring : p,
        logo, ring };
    }
    return styleCache[k];
  }
  function drawLogoBall(c, r, spin, st) {
    // light neutral base with realistic shading
    const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.62, '#eef1f5'); g.addColorStop(1, '#b4bdc8');
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
    c.save(); c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.clip();
    c.rotate(spin);
    // small accents in the team colour (rotate with the ball -> shows the roll)
    c.fillStyle = st.ring;
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; c.beginPath(); c.arc(Math.cos(a) * r * 0.79, Math.sin(a) * r * 0.79, r * 0.075, 0, Math.PI * 2); c.fill(); }
    // the crest decal (fit in a square of 1.42 r, aspect kept)
    const im = st.logo, s = r * 1.42, k = Math.min(s / im.width, s / im.height), w = im.width * k, h = im.height * k;
    c.drawImage(im, -w / 2, -h / 2, w, h);
    c.restore();
    // printed look: the decal darkens towards the edge together with the ball
    const pr = c.createRadialGradient(0, 0, r * 0.45, 0, 0, r);
    pr.addColorStop(0, 'rgba(0,0,0,0)'); pr.addColorStop(1, 'rgba(20,30,45,0.22)');
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fillStyle = pr; c.fill();
    // thin ring in the team colour
    c.strokeStyle = st.ring; c.lineWidth = r * 0.17; c.beginPath(); c.arc(0, 0, r - r * 0.085, 0, Math.PI * 2); c.stroke();
  }
  function drawBall(c, x, y, r, spin, st, alpha) {
    c.save(); c.globalAlpha = alpha == null ? 1 : alpha;
    c.translate(x, y);
    if (st.logo) { drawLogoBall(c, r, spin, st); ballLight(c, r); c.restore(); return; }
    const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
    g.addColorStop(0, st.base); g.addColorStop(0.6, st.mid); g.addColorStop(1, st.dark);
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
    c.save(); c.clip();
    c.rotate(spin);
    c.fillStyle = st.patch; c.strokeStyle = st.edge; c.lineWidth = r * 0.045;
    const pent = (cx, cy, rr, rot) => { c.beginPath(); for (let i = 0; i < 5; i++) { const a = rot + (i * 2 * Math.PI) / 5 - Math.PI / 2; c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } c.closePath(); c.fill(); c.stroke(); };
    pent(0, 0, r * 0.36, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const ax = Math.cos(a) * r * 0.36, ay = Math.sin(a) * r * 0.36;
      c.strokeStyle = hexA(st.seam, 0.6); c.lineWidth = r * 0.07;
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72); c.stroke();
      c.strokeStyle = st.edge; c.lineWidth = r * 0.045;
      const b = a + Math.PI / 5;
      pent(Math.cos(b) * r * 0.98, Math.sin(b) * r * 0.98, r * 0.33, b + Math.PI);
    }
    c.restore();
    ballLight(c, r);
    c.restore();
  }
  function ballLight(c, r) {
    // fixed lighting on top (does not rotate)
    const sh = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.2, 0, 0, r);
    sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.75, 'rgba(0,0,0,0.05)'); sh.addColorStop(1, 'rgba(0,10,30,0.32)');
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fillStyle = sh; c.fill();
    c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.ellipse(-r * 0.38, -r * 0.45, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(10,25,45,0.45)'; c.lineWidth = 1.1; c.beginPath(); c.arc(0, 0, r - 0.5, 0, Math.PI * 2); c.stroke();
  }
  function groundYAt(x) {
    if (x >= G.LEFT_PLAT[0] && x <= G.LEFT_PLAT[1]) return G.GROUND_Y;
    if (x >= G.RIGHT_PLAT[0] && x <= G.RIGHT_PLAT[1]) return G.GROUND_Y;
    return null;
  }
  function drawShadow(c, x, y, r) {
    const gy = groundYAt(x); if (gy === null) return;
    const h = gy - (y + r); if (h < -2 || h > 260) return;
    const k = clamp(1 - h / 260, 0, 1);
    c.fillStyle = `rgba(20,40,10,${0.32 * k})`;
    c.beginPath(); c.ellipse(x, gy + 1, r * (0.6 + 0.5 * k), r * 0.22 * (0.5 + 0.5 * k), 0, 0, Math.PI * 2); c.fill();
  }

  // ---------- windmill ----------
  function drawWindmillStand(c) {
    c.save();
    const hx = G.HUB_X, hy = G.HUB_Y, gy = G.GROUND_Y;
    c.fillStyle = 'rgba(90,80,75,0.55)';
    c.beginPath(); c.moveTo(hx - 4, hy); c.lineTo(hx + 4, hy); c.lineTo(hx + 10, gy + 2); c.lineTo(hx - 10, gy + 2); c.closePath(); c.fill();
    c.restore();
  }
  function drawWindmill(c, angle) {
    const hx = G.HUB_X, hy = G.HUB_Y;
    c.save(); c.translate(hx, hy); c.rotate(angle);
    const col = '#e8553e', dark = '#a8321f';
    // soft shadow
    c.save(); c.translate(3, 4); c.globalAlpha = 0.18; c.fillStyle = '#000';
    rrect(c, -G.MILL_HALF, -G.MILL_THICK / 2, 2 * G.MILL_HALF, G.MILL_THICK, 6); c.fill(); c.restore();
    const hp = G.hookPoints(12);
    for (const sgn of [1, -1]) {
      c.beginPath(); hp.forEach((p, i) => (i ? c.lineTo(p[0] * sgn, p[1] * sgn) : c.moveTo(p[0] * sgn, p[1] * sgn)));
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = dark; c.lineWidth = G.HOOK_THICK + 2.5; c.stroke();
      c.strokeStyle = col; c.lineWidth = G.HOOK_THICK; c.stroke();
    }
    const bg = c.createLinearGradient(0, -G.MILL_THICK / 2, 0, G.MILL_THICK / 2);
    bg.addColorStop(0, '#ff8a6b'); bg.addColorStop(0.5, col); bg.addColorStop(1, '#c23f2a');
    rrect(c, -G.MILL_HALF - 1, -G.MILL_THICK / 2, 2 * G.MILL_HALF + 2, G.MILL_THICK, 6);
    c.fillStyle = bg; c.fill(); c.strokeStyle = dark; c.lineWidth = 1.2; c.stroke();
    c.restore();
    // hub
    const hg = c.createRadialGradient(hx - 3, hy - 3, 1, hx, hy, 11);
    hg.addColorStop(0, '#f4f4f4'); hg.addColorStop(1, '#5d6670');
    c.fillStyle = hg; c.beginPath(); c.arc(hx, hy, 10, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#39414a'; c.beginPath(); c.arc(hx, hy, 3.5, 0, Math.PI * 2); c.fill();
  }

  // ---------- goal ----------
  function drawNet(c, wob) {
    const x0 = G.GOAL_LINE_X, x1 = G.W, y0 = G.BAR_Y, y1 = G.GROUND_Y;
    c.save();
    c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 0.9;
    const step = 9;
    const off = (x, y) => (wob ? wob.a * Math.sin(x * 0.12 + wob.p) * Math.sin(y * 0.09 + wob.p * 0.7) * Math.exp(-((x - wob.x) ** 2 + (y - wob.y) ** 2) / 4000) : 0);
    for (let x = x0 + step; x < x1; x += step) { c.beginPath(); for (let y = y0; y <= y1; y += 6) c.lineTo(x + off(x, y), y); c.stroke(); }
    for (let y = y0 + step; y < y1; y += step) { c.beginPath(); for (let x = x0; x <= x1; x += 6) c.lineTo(x, y + off(x, y) * 0.6); c.stroke(); }
    c.restore();
  }
  function drawGoalFrame(c, barFlash) {
    const x0 = G.GOAL_LINE_X;
    c.save();
    // shadow on grass
    c.fillStyle = 'rgba(20,50,10,0.25)'; c.fillRect(x0 - 2, G.GROUND_Y, G.W - x0 + 2, 5);
    // crossbar (flat top)
    const cb = c.createLinearGradient(0, G.BAR_Y - G.BAR_THICK / 2, 0, G.BAR_Y + G.BAR_THICK / 2);
    cb.addColorStop(0, '#ffffff'); cb.addColorStop(1, '#cfd6de');
    c.fillStyle = cb; c.fillRect(G.BAR_X0, G.BAR_TOP, G.BAR_X1 - G.BAR_X0, G.BAR_BOTTOM - G.BAR_TOP); // == collider
    if (barFlash > 0) { c.fillStyle = `rgba(255,240,170,${0.8 * barFlash})`; c.fillRect(x0 - G.POST_W / 2, G.BAR_Y - G.BAR_THICK / 2 - 2, G.W - x0 + G.POST_W / 2, G.BAR_THICK + 4); }
    // thick white front post
    const pg = c.createLinearGradient(x0 - G.POST_W / 2, 0, x0 + G.POST_W / 2, 0);
    pg.addColorStop(0, '#ffffff'); pg.addColorStop(1, '#c9d1da');
    c.fillStyle = pg; c.fillRect(x0 - G.POST_W / 2, G.BAR_Y - G.BAR_THICK / 2, G.POST_W, G.GROUND_Y - G.BAR_Y + G.BAR_THICK / 2);
    c.strokeStyle = 'rgba(80,90,100,0.35)'; c.lineWidth = 1; c.strokeRect(x0 - G.POST_W / 2, G.BAR_Y - G.BAR_THICK / 2, G.POST_W, G.GROUND_Y - G.BAR_Y + G.BAR_THICK / 2);
    c.restore();
  }

  // ---------- keeper ----------
  function drawKeeper(c, k) {
    const footY = k[0], cr = k[1], arms = k[2];
    const sk = G.keeperSkeleton(G.KEEPER_X, footY, cr, arms);
    const j = sk.joints, x = G.KEEPER_X;
    const KIT = '#f28a1c', KIT_D = '#c9690c', SHORTS = '#2f3a4a', SKIN = '#e7b08a', GLOVE = '#f5f7fa', BOOT = '#1f242b';
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    // ground shadow
    const hAir = G.GROUND_Y - footY;
    c.fillStyle = `rgba(20,50,10,${0.28 * clamp(1 - hAir / 160, 0.2, 1)})`;
    c.beginPath(); c.ellipse(x, G.GROUND_Y + 1, 16 - hAir * 0.04, 3.5, 0, 0, Math.PI * 2); c.fill();
    // legs (two, bent forward=left in crouch)
    const L = G.K.legLen / 2 + 1.5;
    const leg = (dx, col, colSock) => {
      const hx = x + dx, hy = j.hipY, fx = x + dx - 2, fy = footY - 3;
      const d = Math.hypot(fx - hx, fy - hy);
      const kOut = Math.sqrt(Math.max(0, L * L - (d / 2) * (d / 2)));
      const kx = (hx + fx) / 2 - kOut, ky = (hy + fy) / 2;
      c.strokeStyle = col; c.lineWidth = 7.5; c.beginPath(); c.moveTo(hx, hy); c.lineTo(kx, ky); c.stroke();
      c.strokeStyle = colSock; c.lineWidth = 6.5; c.beginPath(); c.moveTo(kx, ky); c.lineTo(fx, fy); c.stroke();
      c.fillStyle = BOOT; rrect(c, fx - 9, fy - 1, 12, 5, 2.5); c.fill();
    };
    leg(4, shade(SHORTS, -0.2), KIT_D);
    // back arm
    const arm = (dphi, col, back) => {
      const ph = j.phi + dphi; const sx = j.shoulderX + (back ? 4 : 0), sy = j.shoulderY;
      const hx = sx + Math.cos(ph) * G.K.armLen, hy = sy + Math.sin(ph) * G.K.armLen;
      c.strokeStyle = col; c.lineWidth = G.K.armW; c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx, hy); c.stroke();
      c.fillStyle = back ? '#d9dde3' : GLOVE; c.strokeStyle = 'rgba(40,50,60,0.6)'; c.lineWidth = 1;
      c.beginPath(); c.arc(hx, hy, 5.2, 0, Math.PI * 2); c.fill(); c.stroke();
    };
    arm(-0.18, KIT_D, true);
    leg(-2, SHORTS, KIT);
    // torso (jersey) + shorts
    const t = sk.torso;
    const tg = c.createLinearGradient(t.x - t.w / 2, 0, t.x + t.w / 2, 0);
    tg.addColorStop(0, '#ffa543'); tg.addColorStop(1, KIT_D);
    c.fillStyle = tg; rrect(c, t.x - t.w / 2, t.y - t.h / 2, t.w, t.h, 7); c.fill();
    c.fillStyle = SHORTS; rrect(c, t.x - t.w / 2 + 0.5, t.y + t.h / 2 - 8, t.w - 1, 10, 4); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.font = `800 11px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('1', t.x + 3, t.y - 3);
    // head (profile facing left)
    const h = sk.head;
    c.fillStyle = SKIN; c.beginPath(); c.arc(h.x, h.y, h.r, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(h.x - h.r + 1, h.y - 1); c.lineTo(h.x - h.r - 3, h.y + 2); c.lineTo(h.x - h.r + 1, h.y + 3); c.fill(); // nose
    c.fillStyle = '#3b2a20'; c.beginPath(); c.arc(h.x + 1, h.y - 2, h.r + 0.5, Math.PI * 0.95, Math.PI * 2.15); c.fill(); // hair
    c.fillRect(h.x + 2, h.y - 3, h.r - 2, 6);
    c.fillStyle = '#1b1b1b'; c.beginPath(); c.arc(h.x - 4, h.y, 1.3, 0, Math.PI * 2); c.fill(); // eye
    // front arm
    arm(0, KIT, false);
    c.restore();
  }

  // ---------- data access ----------
  function findSeg(g) { let lo = 0, hi = segIndex.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (segIndex[m].start <= g) lo = m; else hi = m - 1; } return segIndex[lo]; }
  function matchFrame(m, fi) { return m.frames[clamp(Math.round(fi), 0, m.frames.length - 1)]; }
  function interpFrame(m, ft) {
    const i = clamp(Math.floor(ft), 0, m.frames.length - 1), j2 = clamp(i + 1, 0, m.frames.length - 1), u = ft - Math.floor(ft);
    const A = m.frames[i], B = m.frames[j2];
    if (u < 1e-6 || i === j2) return A;
    let dm = B.m - A.m;
    const f = { t: lerp(A.t, B.t, u), m: A.m + dm * u, k: A.k.map((v, q) => (q === 3 ? A.k[3] : lerp(v, B.k[q], u))), b: [], sc: A.sc, mode: A.mode };
    f.b = A.b.map((ba, q) => { const bb = B.b[q]; if (ba[3] !== bb[3] || Math.hypot(bb[0] - ba[0], bb[1] - ba[1]) > 80) return ba; return [lerp(ba[0], bb[0], u), lerp(ba[1], bb[1], u), lerp(ba[2], bb[2], u), ba[3]]; });
    return f;
  }
  // frame at a simulation time (frames are not uniform in time when slow motion is used)
  function frameAtTime(m, t) {
    const F = m.frames; let lo = 0, hi = F.length - 1;
    if (t <= F[0].t) return { fr: F[0], i: 0 };
    if (t >= F[hi].t) return { fr: F[hi], i: hi };
    while (lo < hi - 1) { const md = (lo + hi) >> 1; if (F[md].t <= t) lo = md; else hi = md; }
    return { fr: interpFrame(m, lo + (t - F[lo].t) / Math.max(1e-9, F[hi].t - F[lo].t)), i: lo };
  }
  // video time (s since the match segment start) of an event
  function evV(e) { return (e.vf !== undefined ? e.vf : e.t * FPS) / FPS; }
  function lastEventBeforeV(m, type, v, filt) { let best = null; for (const e of m.events) { if (evV(e) > v + 1e-9) break; if (e.type === type && (!filt || filt(e))) best = e; } return best; }
  function ballR(m, i) { return i % 2 === 0 ? m.rA : m.rB; }
  function teamOf(i) { return i % 2 === 0 ? 'A' : 'B'; }
  function styleOf(m, i) { return kitStyle(m.kits[teamOf(i)]); }
  function lastEventBefore(m, type, t, filt) { let best = null; for (const e of m.events) { if (e.t > t) break; if (e.type === type && (!filt || filt(e))) best = e; } return best; }

  // ---------- scene ----------
  function drawScene(c, m, fr, opts) {
    opts = opts || {};
    const t = fr.t;
    const v = opts.v !== undefined ? opts.v : t;
    // camera: cinematic track (good hit in added time) or goal zoom + shake, both eased in and out
    let zoom = 1, cx = G.W / 2, cy = G.H / 2, shx = 0, shy = 0;
    if (!opts.noCam && fr.cam) { zoom = fr.cam[0]; cx = fr.cam[1]; cy = fr.cam[2]; }
    else if (!opts.noCam) {
      const lg = lastEventBeforeV(m, 'goal', v);
      if (lg && !lg.golden && v - evV(lg) < 1.9) { // golden goal: no zoom (own effect)
        const u = v - evV(lg);
        const z = smooth(u / 0.4) * (1 - smooth((u - 1.05) / 0.8));
        zoom = 1 + 0.12 * z; cx = lerp(G.W / 2, 1110, z); cy = lerp(G.H / 2, 470, z);
        const env = smooth(u / 0.08) * Math.exp(-u * 4.2) * 5;
        shx = (Math.sin(u * 29) + 0.45 * Math.sin(u * 47 + 1.3)) * env; shy = (Math.cos(u * 25) + 0.45 * Math.sin(u * 39 + 0.7)) * env * 0.7;
      }
    }
    if (opts.zoom) { zoom = opts.zoom.z; cx = opts.zoom.x; cy = opts.zoom.y; }
    // keep the camera window inside the scene (no black borders when zoomed)
    const hw = G.W / (2 * zoom), hh = G.H / (2 * zoom);
    cx = clamp(cx, hw, G.W - hw); cy = clamp(cy, hh, G.H - hh);
    if (zoom > 1.0001) { const m = 6 / zoom; shx = clamp(shx, -m, m); shy = clamp(shy, -m, m); } else { shx = 0; shy = 0; }
    c.save();
    c.scale(S, S);
    c.translate(G.W / 2 + shx, G.H / 2 + shy); c.scale(zoom, zoom); c.translate(-cx, -cy);
    c.drawImage(bgCanvas, 0, 0, G.W, G.H);
    // balls inside the pipe (dim), then pipe glass over them
    fr.b.forEach((b, i) => { if (b[3] === 0 || b[3] === 1) drawBall(c, b[0], b[1], ballR(m, i) * 0.97, b[2], styleOf(m, i), 0.55); });
    drawPipeGlass(c);
    // emerging balls (clipped to above the ground, look like they rise out of the hole)
    fr.b.forEach((b, i) => {
      if (b[3] !== 2) return;
      c.save(); c.beginPath(); c.rect(0, 0, G.W, G.GROUND_Y + 1); c.clip();
      drawBall(c, b[0], b[1], ballR(m, i), b[2], styleOf(m, i), 1); c.restore();
    });
    // spout collar + pop ring
    const sx = G.SPOUT_X, gy = G.GROUND_Y;
    c.fillStyle = '#6f7c88'; rrect(c, sx - G.BALL_R - 9, gy - 4, 8, 7, 2); c.fill(); rrect(c, sx + G.BALL_R + 1, gy - 4, 8, 7, 2); c.fill();
    const pop = lastEventBefore(m, 'pop', t);
    if (pop && t - pop.t < 0.45) {
      const u = (t - pop.t) / 0.45;
      c.strokeStyle = `rgba(255,255,255,${0.85 * (1 - u)})`; c.lineWidth = 2.5 * (1 - u) + 0.5;
      c.beginPath(); c.ellipse(sx, gy - 2, 14 + 26 * easeOut(u), 4 + 7 * easeOut(u), 0, 0, Math.PI * 2); c.stroke();
    }
    drawWindmillStand(c);
    // goal: balls in the net drawn behind the net mesh
    fr.b.forEach((b, i) => { if (b[3] === 4) drawBall(c, b[0], b[1], ballR(m, i), b[2], styleOf(m, i), 1); });
    const ne = lastEventBefore(m, 'goal', t);
    let wob = null;
    if (ne && t - ne.t < 0.9) { const u = (t - ne.t) / 0.9; wob = { a: 5 * (1 - u), p: u * 30, x: 1235, y: 500 }; }
    drawNet(c, wob);
    const bh = lastEventBefore(m, 'bar', t);
    drawGoalFrame(c, bh && t - bh.t < 0.25 ? 1 - (t - bh.t) / 0.25 : 0);
    // shadows
    fr.b.forEach((b, i) => { if (b[3] === 3) drawShadow(c, b[0], b[1], ballR(m, i)); });
    drawKeeper(c, fr.k);
    drawWindmill(c, fr.m);
    // motion trails for fast balls
    if (opts.trail !== false && opts.frameIndex != null) {
      for (let i = 0; i < fr.b.length; i++) {
        const b = fr.b[i]; if (b[3] !== 3) continue;
        for (let k = 4; k >= 1; k--) {
          const pf = matchFrame(m, opts.frameIndex - k * (opts.trailStep || 1)); const pb = pf.b[i];
          if (pb[3] !== 3) continue;
          const sp = Math.hypot(b[0] - pb[0], b[1] - pb[1]) / Math.max(1e-6, fr.t - pf.t);
          if (sp < 420) continue;
          const a = 0.22 * (1 - k / 5) * clamp((sp - 420) / 400, 0, 1);
          c.fillStyle = hexA(m.kits[teamOf(i)].primary, a);
          c.beginPath(); c.arc(pb[0], pb[1], ballR(m, i) * (1 - k * 0.1), 0, Math.PI * 2); c.fill();
        }
      }
    }
    fr.b.forEach((b, i) => { if (b[3] === 3 || b[3] === 5) drawBall(c, b[0], b[1], ballR(m, i), b[2], styleOf(m, i), 1); });
    if (!opts.noFx) goalFx(c, m, v);
    c.restore();
  }

  // ---------- goal effects in scene space (confetti burst from the goal, golden shockwave) ----------
  function goalFx(c, m, v) {
    const lg = lastEventBeforeV(m, 'goal', v); if (!lg) return;
    const u = v - evV(lg); if (u < 0 || u > 2.6) return;
    const gi = m.events.indexOf(lg);
    const ox = G.GOAL_LINE_X - 6, oy = (G.BAR_Y + G.GROUND_Y) / 2;
    const kit = m.kits[lg.team];
    const cols = lg.golden ? ['#ffd84a', '#ffc400', '#fff1b0', '#e8a800'] : [kit.primary, kit.secondary, kit.primary, '#ffffff'];
    const n = lg.golden ? 90 : 70;
    c.save();
    for (let k = 0; k < n; k++) {
      const h1 = hash(gi * 7919 + k * 31 + 1), h2 = hash(gi * 7919 + k * 31 + 2), h3 = hash(gi * 7919 + k * 31 + 3);
      const delay = h3 * 0.12; const uu = u - delay; if (uu <= 0) continue;
      const ang = Math.PI * (0.62 + 0.62 * h1);           // up-left fan out of the goal mouth
      const sp = 380 + 520 * h2, drag = 2.4;
      const tau = (1 - Math.exp(-drag * uu)) / drag;
      const x = ox + Math.cos(ang) * sp * tau, y = oy - Math.sin(ang) * sp * tau + 0.5 * 380 * uu * uu * 0.55;
      const a = 1 - smooth((uu - 1.2) / 0.8); if (a <= 0) continue;
      c.save(); c.translate(x, y); c.rotate(uu * (6 + 10 * h1) + k);
      c.globalAlpha = a; c.fillStyle = cols[k % cols.length];
      const w = 4 + 4 * h2, hh = 2.5 + 3 * h3 * Math.abs(Math.cos(uu * 9 + k));
      c.fillRect(-w / 2, -hh / 2, w, hh);
      if (cols[k % cols.length].toLowerCase() === '#ffffff') { c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.6; c.strokeRect(-w / 2, -hh / 2, w, hh); }
      c.restore();
    }
    if (lg.golden) { // golden shockwave rings from the goal
      for (const d of [0, 0.18]) {
        const q = (u - d) / 1.0; if (q <= 0 || q >= 1) continue;
        const r = 30 + 900 * easeOut(q);
        c.globalAlpha = 0.85 * (1 - q); c.strokeStyle = '#ffd84a'; c.lineWidth = 16 * (1 - q) + 2;
        c.beginPath(); c.arc(ox, oy, r, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = 0.35 * (1 - q); c.strokeStyle = '#fff4c2'; c.lineWidth = 5 * (1 - q) + 1;
        c.beginPath(); c.arc(ox, oy, r * 0.93, 0, Math.PI * 2); c.stroke();
      }
    }
    c.restore();
  }

  // ---------- overlays ----------
  function teamName(i) { return show.teams[i].name; }
  function clockText(m, t) { return window.CLOCK.clockAt(m, t, show.cfg.GAME_MIN_PER_SEC); }
  function ballIcon(c, x, y, r, st, filled) {
    if (filled) { drawBall(c, x, y, r, 0.4, st, 1); }
    else { c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.6; c.beginPath(); c.arc(x, y, r - 0.8, 0, Math.PI * 2); c.stroke(); }
  }
  function drawHUD(c, m, fr, opts) {
    opts = opts || {};
    const t = fr.t;
    c.save(); c.scale(S, S);
    // stage label (top-left)
    const CN = show.competition.name;
    const label = m.leg === 'FINAL' ? `${CN} · FINAL` : `${CN} · ${m.stage} · ${m.leg}`;
    c.font = `700 15px ${FONT}`; const lw = c.measureText(label).width + 26;
    const maxLW = G.W / 2 - 270 - 16 - 12; // never reach the scoreboard
    if (lw <= maxLW) {
      c.fillStyle = 'rgba(8,20,38,0.72)'; rrect(c, 16, 14, lw, 30, 15); c.fill();
      text(c, label, 16 + lw / 2, 29.5, 15, '#ffffff');
    } else { // long stage names (QUARTER-FINAL n · LEG n): two lines
      const l1 = CN, l2 = m.leg === 'FINAL' ? 'FINAL' : `${m.stage} · ${m.leg}`;
      c.font = `700 14px ${FONT}`; const w2 = Math.min(maxLW, Math.max(c.measureText(l1).width, c.measureText(l2).width) + 26);
      c.fillStyle = 'rgba(8,20,38,0.72)'; rrect(c, 16, 12, w2, 46, 14); c.fill();
      text(c, l1, 16 + w2 / 2, 25.5, fitText(c, l1, w2 - 20, 13), 'rgba(255,255,255,0.78)');
      text(c, l2, 16 + w2 / 2, 44, fitText(c, l2, w2 - 20, 14), '#ffffff');
    }
    // scoreboard (top centre)
    const cx = G.W / 2, y = 16, h = 52, half = 270;
    c.fillStyle = 'rgba(8,20,38,0.80)'; rrect(c, cx - half, y, 2 * half, h, 14); c.fill();
    const sc = fr.sc;
    // team A
    kitDot(c, m.kits.A, cx - half + 24, y + h / 2 - 9, 8);
    let z = fitText(c, teamName(m.ta), 158, 22); text(c, teamName(m.ta), cx - half + 40, y + h / 2 - 9, z, '#ffffff', 'left');
    kitDot(c, m.kits.B, cx + half - 24, y + h / 2 - 9, 8);
    z = fitText(c, teamName(m.tb), 158, 22); text(c, teamName(m.tb), cx + half - 40, y + h / 2 - 9, z, '#ffffff', 'right');
    // per-team balls indicator: filled = on the pitch, hollow = in pipe / queue
    const N = show.cfg.BALLS_PER_TEAM;
    for (let q = 0; q < N; q++) {
      const ia = q * 2, ib = q * 2 + 1;
      ballIcon(c, cx - half + 48 + q * 21, y + h / 2 + 13, 8.5, kitStyle(m.kits.A), fr.b[ia][3] >= 2 && fr.b[ia][3] <= 4);
      ballIcon(c, cx + half - 48 - q * 21, y + h / 2 + 13, 8.5, kitStyle(m.kits.B), fr.b[ib][3] >= 2 && fr.b[ib][3] <= 4);
    }
    // score box
    c.fillStyle = '#ffffff'; rrect(c, cx - 62, y + 6, 124, h - 12, 9); c.fill();
    // score: the scoring team's number "pops" (scale + team colour flash)
    const pop = opts.scorePop || null;
    text(c, '–', cx, y + h / 2 + 1, 34, '#0b1a2e', 'center', 800);
    for (const [k, xx] of [[0, cx - 30], [1, cx + 30]]) {
      const isPop = pop && pop.side === k;
      const z = isPop ? 1 + 0.45 * pop.p : 1;
      const pc = isPop ? (lum(pop.color) > 0.75 ? '#0b1a2e' : mixHex(pop.color, '#0b1a2e', 0.35)) : '#0b1a2e';
      const col = isPop && pop.p > 0.05 ? mixHex('#0b1a2e', pc, Math.min(1, pop.p * 1.6)) : '#0b1a2e';
      text(c, String(sc[k]), xx, y + h / 2 + 1, 34 * z, col, 'center', 800);
    }
    // aggregate
    if (m.leg === 'LEG 2') {
      const ag = [m.prev[0] + sc[0], m.prev[1] + sc[1]];
      c.fillStyle = 'rgba(8,20,38,0.80)'; rrect(c, cx - 58, y + h + 4, 116, 26, 9); c.fill();
      text(c, `AGG (${ag[0]}–${ag[1]})`, cx, y + h + 17.5, 16, '#ffd84a', 'center', 700);
    }
    // clock
    const ck = clockText(m, t);
    const cyk = y + h + (m.leg === 'LEG 2' ? 36 : 4);
    if (ck.golden) {
      const bl = 0.5 + 0.5 * Math.sin(t * 7);
      c.fillStyle = `rgb(255,${(190 + 30 * bl) | 0},${(20 * bl) | 0})`; rrect(c, cx - 112, cyk, 224, 30, 10); c.fill();
      text(c, `GOLDEN BALL · ${ck.main}`, cx, cyk + 15.5, 17, '#2a1a00', 'center', 800); // clock frozen at 90+added
    } else {
      if (ck.phase === 'shots') { // 90+k' and the shot counter
        c.fillStyle = 'rgba(8,20,38,0.80)'; rrect(c, cx - 82, cyk, 164, 30, 10); c.fill();
        text(c, ck.main, cx - 36, cyk + 15.5, 19, '#ffffff', 'center', 700);
        c.fillStyle = '#ffd84a'; rrect(c, cx + 4, cyk + 5, 72, 20, 6); c.fill(); text(c, `SHOT ${ck.shot}/${ck.added}`, cx + 40, cyk + 15.5, 13, '#1a1200', 'center', 800);
      } else {
        c.fillStyle = 'rgba(8,20,38,0.80)'; rrect(c, cx - 44, cyk, 88, 30, 10); c.fill();
        text(c, ck.main, cx - (ck.plus ? 14 : 0), cyk + 15.5, 19, '#ffffff', 'center', 700);
        if (ck.plus) { c.fillStyle = '#ffd84a'; rrect(c, cx + 8, cyk + 5, 34, 20, 6); c.fill(); text(c, `+${ck.plus}`, cx + 25, cyk + 15.5, 15, '#1a1200', 'center', 800); }
      }
    }
    c.restore();
  }
  function banner(c, title, sub, u, color, textColor) {
    // u in [0,1] over banner life
    const a = u < 0.12 ? easeOut(u / 0.12) : u > 0.85 ? 1 - smooth((u - 0.85) / 0.15) : 1;
    const sx = u < 0.12 ? lerp(-60, 0, easeOut(u / 0.12)) : 0;
    c.save(); c.scale(S, S); c.globalAlpha = a;
    const cy = 300;
    c.fillStyle = color || 'rgba(8,20,38,0.86)';
    c.beginPath(); c.moveTo(G.W / 2 - 330 + sx, cy - 48); c.lineTo(G.W / 2 + 350 + sx, cy - 48); c.lineTo(G.W / 2 + 330 + sx, cy + (sub ? 48 : 36)); c.lineTo(G.W / 2 - 350 + sx, cy + (sub ? 48 : 36)); c.closePath(); c.fill();
    text(c, title, G.W / 2 + sx, cy - (sub ? 10 : -6) , 60, textColor || '#ffffff', 'center', 800);
    if (sub) text(c, sub, G.W / 2 + sx, cy + 30, 22, textColor || '#ffffff', 'center', 600);
    c.restore();
  }

  // P2 rule fix (CLAUDE.md): real player names never during play -> the in-play goal banner shows only the minute;
  // the scorer's name appears in the replay caption, MOTM card and podium.
  function scorerLine(m, e) {
    return window.CLOCK.minuteLabel(m, e.t, show.cfg.GAME_MIN_PER_SEC);
  }
  // GOAL moment banner (~2 s): slides in with a soft bounce, team colours, scorer + minute; slides out.
  function goalBanner(c, m, e, u, golden) {
    const D = golden ? 3.0 : 2.0;
    const side = e.team, ti = side === 'A' ? m.ta : m.tb, kit = m.kits[side];
    const inU = clamp(u / 0.42, 0, 1), outU = smooth((u - (D - 0.3)) / 0.3);
    const sx = lerp(-G.W * 0.75, 0, easeOutBack(inU)) + outU * G.W * 0.6;
    c.save(); c.scale(S, S); c.globalAlpha = 1 - outU;
    const cx = G.W / 2 + sx, cy = 270, W2 = 320, H1 = 62;
    // dark slanted panel (readable on any map) with team-colour stripes at both ends; golden goal = gold panel
    const body = golden ? '#ffc400' : 'rgba(8,20,38,0.93)';
    const ink = golden ? '#2a1a00' : '#ffffff';
    const slant = (x0, x1, y0, y1, k) => { c.beginPath(); c.moveTo(x0 + k, y0); c.lineTo(x1 + k, y0); c.lineTo(x1 - k, y1); c.lineTo(x0 - k, y1); c.closePath(); };
    c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 18; c.shadowOffsetY = 4;
    c.fillStyle = body; slant(cx - W2, cx + W2, cy - H1, cy + H1, 22); c.fill();
    c.shadowColor = 'transparent';
    for (const [dx, col] of [[-W2 - 2, kit.primary], [-W2 + 16, kit.secondary], [W2 - 16, kit.secondary], [W2 - 34, kit.primary]]) {
      c.fillStyle = col; slant(cx + dx, cx + dx + 18, cy - H1, cy + H1, 22); c.fill();
    }
    // title pops slightly after the panel lands
    const ts = 1 + 0.18 * (1 - easeOutBack(clamp((u - 0.2) / 0.35, 0, 1)));
    c.save(); c.translate(cx, cy - 8); c.scale(ts, ts);
    text(c, golden ? 'GOLDEN GOAL' : 'GOAL!', 0, 0, golden ? 70 : 84, ink, 'center', 800);
    c.restore();
    // team name on a pill in the team colours (primary fill, secondary border)
    const nm = teamName(ti).toUpperCase();
    const z = fitText(c, nm, 2 * W2 - 160, 26, 800);
    c.font = `800 ${z}px ${FONT}`; const pw = c.measureText(nm).width + 44;
    c.fillStyle = kit.primary; rrect(c, cx - pw / 2, cy + H1 - 20, pw, 40, 20); c.fill();
    c.strokeStyle = kit.secondary; c.lineWidth = 3; rrect(c, cx - pw / 2, cy + H1 - 20, pw, 40, 20); c.stroke();
    if (lum(kit.primary) > 0.85 && lum(kit.secondary) > 0.85) { c.strokeStyle = 'rgba(16,35,61,0.5)'; c.lineWidth = 1.5; rrect(c, cx - pw / 2, cy + H1 - 20, pw, 40, 20); c.stroke(); }
    text(c, nm, cx, cy + H1 + 1, z, inkOn(kit.primary), 'center', 800);
    // scorer strip under the panel
    const sl = scorerLine(m, e);
    c.font = `800 26px ${FONT}`; const sw = c.measureText(sl).width + 56;
    const sa = smooth((u - 0.3) / 0.25);
    c.globalAlpha = (1 - outU) * sa;
    const sy = cy + H1 + 30;
    c.fillStyle = 'rgba(8,20,38,0.92)'; rrect(c, cx - sw / 2, sy, sw, 44, 10); c.fill();
    text(c, sl, cx, sy + 23, 26, '#ffffff', 'center', 800);
    c.restore();
  }
  function colourWash(c, color, u) { // short full-screen wash in the scoring team's colour (~0.4 s)
    const a = 0.3 * (u < 0.06 ? u / 0.06 : 1 - smooth((u - 0.06) / 0.34));
    if (a <= 0) return;
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    const gr = c.createRadialGradient(OUT_W * 0.8, OUT_H * 0.62, 50, OUT_W * 0.8, OUT_H * 0.62, OUT_W);
    gr.addColorStop(0, hexA(color, a)); gr.addColorStop(1, hexA(color, a * 0.45));
    c.fillStyle = gr; c.fillRect(0, 0, OUT_W, OUT_H); c.restore();
  }
  function goldRain(c, u, seed) { // gold confetti falling over the whole screen (golden goal)
    c.save(); c.scale(S, S);
    const cols = ['#ffd84a', '#ffc400', '#fff1b0', '#e8a800', '#ffffff'];
    for (let k = 0; k < 140; k++) {
      const h1 = hash(seed * 131 + k * 7 + 1), h2 = hash(seed * 131 + k * 7 + 2), h3 = hash(seed * 131 + k * 7 + 3);
      const uu = u - h3 * 1.1; if (uu <= 0) continue;
      const y = -20 + (150 + 140 * h2) * uu, x = h1 * G.W + 22 * Math.sin(uu * (2 + 2 * h2) + k);
      if (y > G.H + 20) continue;
      const a = 1 - smooth((u - 2.4) / 0.6);
      c.save(); c.translate(x, y); c.rotate(uu * (3 + 4 * h1) + k); c.globalAlpha = a; c.fillStyle = cols[k % cols.length];
      c.fillRect(-4, -2.2 * Math.abs(Math.cos(uu * 6 + k)) - 0.6, 8, 4.4 * Math.abs(Math.cos(uu * 6 + k)) + 1.2); c.restore();
    }
    c.restore();
  }
  function matchOverlays(c, m, fr, v) {
    if (v === undefined) v = fr.t;
    // cinematic vignette (good hit in added time)
    if (fr.ts !== undefined && fr.ts < 1) {
      const w = (1 - fr.ts) / (1 - 0.35);
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      const gr = c.createRadialGradient(OUT_W / 2, OUT_H / 2, OUT_H * 0.45, OUT_W / 2, OUT_H / 2, OUT_W * 0.65);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${0.38 * w})`);
      c.fillStyle = gr; c.fillRect(0, 0, OUT_W, OUT_H); c.restore();
    }
    // goal moment (only the latest goal; ~2 s; golden goal ~3 s with its own effect)
    const lg = lastEventBeforeV(m, 'goal', v);
    if (lg) {
      const u = v - evV(lg);
      if (lg.golden) { if (u < 3.0) { colourWash(c, '#ffc400', u); goldRain(c, u, m.events.indexOf(lg)); goalBanner(c, m, lg, u, true); } }
      else if (u < 2.0) { colourWash(c, m.kits[lg.team].primary, u); goalBanner(c, m, lg, u, false); }
    }
    const half = lastEventBeforeV(m, 'whistle', v, (e) => e.kind === 'half');
    const goalShowing = lg && v - evV(lg) < (lg.golden ? 3.0 : 2.0);
    if (half && v - evV(half) < 1.3 && !goalShowing) banner(c, 'HALF-TIME', null, (v - evV(half)) / 1.3); // P2 fix: never on top of a goal banner
    const reg = lastEventBeforeV(m, 'whistle', v, (e) => e.kind === 'reg');
    if (reg && v - evV(reg) < 1.4) banner(c, "90'", 'Added time next', (v - evV(reg)) / 1.4);
    // +N banner: N added-time shots
    const add = lastEventBeforeV(m, 'added', v);
    if (add && v - evV(add) < 1.6) {
      const u = (v - evV(add)) / 1.6; const a = u < 0.1 ? u / 0.1 : 1 - smooth((u - 0.82) / 0.18);
      c.save(); c.scale(S, S); c.globalAlpha = a; const s = 1 + 0.35 * (1 - easeOutBack(Math.min(1, u / 0.22)));
      c.translate(G.W / 2, 270); c.scale(s, s);
      c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 16;
      c.fillStyle = '#ffd84a'; rrect(c, -170, -92, 340, 184, 22); c.fill(); c.shadowColor = 'transparent';
      text(c, 'ADDED TIME', 0, -60, 24, '#1a1200', 'center', 800);
      text(c, `+${add.minutes}`, 0, 4, 96, '#1a1200', 'center', 800);
      text(c, `${add.minutes} EXTRA SHOT${add.minutes === 1 ? "" : "S"}`, 0, 66, 22, '#1a1200', 'center', 800);
      c.restore();
    }
    // each added-time shot: small pill under the scoreboard
    const sh = lastEventBeforeV(m, 'shot', v);
    if (sh && v - evV(sh) < 1.3) {
      const u = (v - evV(sh)) / 1.3; const a = smooth(u / 0.12) * (1 - smooth((u - 0.8) / 0.2));
      c.save(); c.scale(S, S); c.globalAlpha = a;
      const ti = sh.team === 'A' ? m.ta : m.tb, kit = m.kits[sh.team];
      const lab = `SHOT ${sh.k} OF ${sh.n} · ${teamName(ti).toUpperCase()}`;
      c.font = `800 20px ${FONT}`; const w = c.measureText(lab).width + 60;
      const y = m.leg === 'LEG 2' ? 150 : 120;
      c.fillStyle = 'rgba(8,20,38,0.88)'; rrect(c, G.W / 2 - w / 2, y, w, 36, 10); c.fill();
      kitDot(c, kit, G.W / 2 - w / 2 + 20, y + 18, 8);
      text(c, lab, G.W / 2 + 10, y + 19, 20, '#ffffff', 'center', 800);
      c.restore();
    }
    const gb = lastEventBeforeV(m, 'golden', v);
    if (gb && v - evV(gb) < 2.4) banner(c, 'GOLDEN BALL', 'Level! Next goal wins', (v - evV(gb)) / 2.4, 'rgba(255,190,0,0.94)', '#2a1a00');
  }

  // ---------- full screens ----------
  function darkBG(c, g) {
    c.save(); c.scale(S, S);
    const bg = c.createLinearGradient(0, 0, 0, G.H);
    bg.addColorStop(0, '#0c1a33'); bg.addColorStop(1, '#173563');
    c.fillStyle = bg; c.fillRect(0, 0, G.W, G.H);
    // soft light streaks
    for (let i = 0; i < 6; i++) {
      const x = ((i * 260 + g * 0.6) % (G.W + 400)) - 200;
      const gr = c.createLinearGradient(x - 120, 0, x + 120, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(120,170,255,0.06)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.save(); c.translate(x, 0); c.transform(1, 0, -0.35, 1, 0, 0); c.fillRect(-120, 0, 240, G.H); c.restore();
    }
    c.restore();
  }
  function kitDot(c, kit, x, y, r) {
    c.fillStyle = kit.primary; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = kit.secondary; c.lineWidth = Math.max(1.5, r * 0.28); c.beginPath(); c.arc(x, y, r * 0.78, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
  }
  function teamChip(c, ti, x, y, r) { const T = show.teams[ti]; kitDot(c, { primary: T.primary, secondary: T.secondary }, x, y, r); }
  function teamBar(c, ti, x, y, w, h) { // two-colour stripe (primary over secondary)
    const T = show.teams[ti];
    c.save(); rrect(c, x, y, w, h, Math.min(4, w / 2)); c.clip();
    c.fillStyle = T.primary; c.fillRect(x, y, w, h); c.fillStyle = T.secondary; c.fillRect(x, y + h * 0.62, w, h * 0.38);
    c.restore();
  }
  function drawIntro(c, lf, g) {
    darkBG(c, g);
    c.save(); c.scale(S, S);
    const t = lf / FPS;
    // rolling decorative balls
    const big = show.teams.length > 4;
    if (!big) {
      for (let i = 0; i < 2; i++) { const x = ((t * 180 + i * 640) % 1480) - 100; const T = show.teams[i]; drawBall(c, x, 640, 22, x / 22, kitStyle(T), 0.9); }
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(0, 662, G.W, 2);
    }
    const a = easeOut(t / 0.8);
    c.globalAlpha = a;
    text(c, show.competition.name, G.W / 2, 170 - 30 * (1 - a), 96, '#ffffff', 'center', 800);
    text(c, show.competition.subtitle, G.W / 2, 240, 24, '#9fc7ff', 'center', 600);
    c.globalAlpha = 1;
    if (big) { drawIntroGrid(c, t); c.restore(); return; }
    show.teams.forEach((T, i) => {
      const u = easeOutBack((t - 1.0 - i * 0.35) / 0.5);
      if (u <= 0) return;
      const w = 250, x = 70 + i * (w + 30), y = 330;
      c.save(); c.globalAlpha = clamp(u, 0, 1); c.translate(x + w / 2, y + 90); c.scale(0.8 + 0.2 * u, 0.8 + 0.2 * u); c.translate(-(x + w / 2), -(y + 90));
      c.fillStyle = 'rgba(255,255,255,0.08)'; rrect(c, x, y, w, 180, 18); c.fill();
      teamBar(c, i, x, y, w, 8);
      teamChip(c, i, x + w / 2, y + 62, 28);
      const z = fitText(c, T.name, w - 24, 26); text(c, T.name, x + w / 2, y + 125, z, '#ffffff');
      text(c, `TEAM ${i + 1}`, x + w / 2, y + 155, 15, '#9fb6d6', 'center', 600);
      c.restore();
    });
    const u2 = smooth((t - 3.2) / 0.6);
    c.globalAlpha = u2; text(c, 'Semifinals over two legs · Golden ball decides ties', G.W / 2, 560, 22, '#d6e4ff', 'center', 600);
    c.restore();
  }
  function drawIntroGrid(c, t) {
    const a = smooth((t - 0.6) / 0.5);
    c.globalAlpha = a; text(c, `${show.teams.length} teams · two-legged ties · golden ball decides level ties`, G.W / 2, 286, 20, '#d6e4ff', 'center', 600); c.globalAlpha = 1;
    const cw = 282, ch = 78, gx = 16, gy = 14, x0 = (G.W - 4 * cw - 3 * gx) / 2, y0 = 330;
    show.teams.forEach((T, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const u = easeOutBack((t - 1.0 - i * 0.12) / 0.45);
      if (u <= 0) return;
      const x = x0 + col * (cw + gx), y = y0 + row * (ch + gy);
      c.save(); c.globalAlpha = clamp(u, 0, 1); c.translate(x + cw / 2, y + ch / 2); c.scale(0.85 + 0.15 * u, 0.85 + 0.15 * u); c.translate(-(x + cw / 2), -(y + ch / 2));
      c.fillStyle = 'rgba(255,255,255,0.08)'; rrect(c, x, y, cw, ch, 14); c.fill();
      teamBar(c, i, x, y, 7, ch);
      drawBall(c, x + 50, y + ch / 2, 26, 0.0, kitStyle(T), 1);
      const z = fitText(c, T.name, cw - 100, 23); text(c, T.name, x + 90, y + ch / 2 - 8, z, '#ffffff', 'left');
      text(c, `${i + 1}${['st', 'nd', 'rd'][i] || 'th'} in the league phase`, x + 90, y + ch / 2 + 17, 13, '#9fb6d6', 'left', 600);
      c.restore();
    });
  }
  function drawRoundCard(c, seg, lf, g) {
    darkBG(c, g);
    const t = lf / FPS, rd = show.rounds[seg.round];
    c.save(); c.scale(S, S);
    const a = easeOut(t / 0.5);
    c.globalAlpha = a; text(c, show.competition.name, G.W / 2, 110, 26, '#8fb0dc', 'center', 800);
    const sc = 0.85 + 0.15 * clamp(easeOutBack(t / 0.6), 0, 1.1);
    c.save(); c.translate(G.W / 2, 190); c.scale(sc, sc); text(c, rd.name, 0, 0, 82, '#ffffff', 'center', 800); c.restore();
    const sub = rd.twoLegs ? `${rd.ties.length} TIES · TWO LEGS · GOLDEN BALL DECIDES A LEVEL AGGREGATE` : 'ONE MATCH · GOLDEN BALL IF LEVEL';
    text(c, sub, G.W / 2, 258, 19, '#ffd84a', 'center', 700);
    c.globalAlpha = 1;
    const n = rd.ties.length, cols = n >= 4 ? 2 : 1, rows = Math.ceil(n / cols);
    const w = cols === 2 ? 540 : 620, h = n >= 8 ? 66 : 80, gx = 30, gy = 14;
    const x0 = (G.W - cols * w - (cols - 1) * gx) / 2, y0 = 300 + (n >= 8 ? 0 : (4 - rows) * (h + gy) / 2);
    rd.ties.forEach((tie, i) => {
      const col = cols === 2 ? (i < rows ? 0 : 1) : 0, row = cols === 2 ? i % rows : i;
      const u = smooth((t - 0.5 - i * 0.12) / 0.35); if (u <= 0) return;
      const x = x0 + col * (w + gx), y = y0 + row * (h + gy);
      c.save(); c.globalAlpha = u; c.translate(0, 10 * (1 - u));
      c.fillStyle = 'rgba(255,255,255,0.08)'; rrect(c, x, y, w, h, 12); c.fill();
      teamBar(c, tie.ta, x, y, 7, h); teamBar(c, tie.tb, x + w - 7, y, 7, h);
      const fz = n >= 8 ? 23 : 27, half = w / 2 - 44;
      const za = fitText(c, show.teams[tie.ta].name, half, fz); text(c, show.teams[tie.ta].name, x + w / 2 - 30, y + h / 2 + 1, za, '#ffffff', 'right');
      const zb = fitText(c, show.teams[tie.tb].name, half, fz); text(c, show.teams[tie.tb].name, x + w / 2 + 30, y + h / 2 + 1, zb, '#ffffff', 'left');
      text(c, 'vs', x + w / 2, y + h / 2 + 1, 18, '#9fb6d6', 'center', 700);
      c.restore();
    });
    c.restore();
  }
  // bracket
  // Demo data (4 teams, two-legged semis) mapped onto the generic symmetric layout:
  // semifinal 1 = left half, semifinal 2 = right half, final in the centre.
  const BL_OPTS4 = { top: 300, bottom: 420, maxBoxW: 380, maxRowH: 58 };
  const BL_LTR4 = { top: 175, bottom: 560, maxBoxW: 400, maxRowH: 58 };
  function bracketStyle(st) { return st || show.bracketStyle || 'left_to_right'; }
  function demoLayout(style) { return style === 'symmetric' ? window.BRACKET.bracketLayout(4, BL_OPTS4) : window.BRACKET.bracketLayoutLTR(4, BL_LTR4); }
  function drawPolyPrefix(c, poly, u) {
    let tot = 0; for (let i = 1; i < poly.length; i++) tot += Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
    let d = clamp(u, 0, 1) * tot;
    c.beginPath(); c.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length && d > 0; i++) {
      const l = Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
      const k = Math.min(1, d / l);
      c.lineTo(poly[i - 1][0] + (poly[i][0] - poly[i - 1][0]) * k, poly[i - 1][1] + (poly[i][1] - poly[i - 1][1]) * k);
      d -= l;
    }
    c.stroke();
  }
  function drawBracketBox(c, b, d, t) {
    d = d || {};
    const rowH = b.rowH, small = b.w < 260, compact = b.w < 200;
    const fs = Math.min(compact ? 21 : 23, rowH * 0.5);
    const nc = d.cols ? d.cols.length : 0, cw = compact ? 30 : small ? 30 : 44;
    const colX = (k) => b.x + b.w - cw * (nc - k) + cw / 2 - (compact ? 3 : 6);
    if (d.cur) { c.save(); c.strokeStyle = 'rgba(255,216,74,0.95)'; c.lineWidth = 2.5; rrect(c, b.x - 3, b.y - 1, b.w + 6, 2 * rowH + 2, 9); c.stroke(); c.restore(); }
    if (d.label) text(c, d.label, b.x, b.y - 16, small ? 11 : 14, '#8fb0dc', 'left', 700);
    if (d.cols) d.cols.forEach((h, k) => text(c, h, colX(k), b.y - 16, 13, '#8fb0dc', 'center', 700));
    const rows = d.rows || [null, null];
    for (let r = 0; r < 2; r++) {
      const yy = b.y + r * rowH, ti = rows[r];
      const has = ti !== null && ti !== undefined;
      const isWin = has && d.win != null && d.win === ti, isOut = has && d.win != null && d.win !== ti;
      const wA = d.newWin ? smooth((t - 0.6) / 0.5) : 1;
      c.fillStyle = isWin ? `rgba(255,216,74,${0.16 * wA})` : 'rgba(255,255,255,0.07)'; rrect(c, b.x, yy + 2, b.w, rowH - 4, Math.min(8, rowH * 0.15)); c.fill();
      if (!has) { text(c, d.placeholders ? d.placeholders[r] : '—', b.x + (small ? 14 : 30), yy + rowH / 2, Math.min(19, fs), 'rgba(255,255,255,0.35)', 'left', 600); continue; }
      if (compact) {
        const ap = d.newRows && d.newRows[r] ? smooth((t - 1.85) / 0.3) : 1;
        c.save(); c.globalAlpha = ap * (isOut ? 1 - 0.5 * wA : 1);
        teamBar(c, ti, b.x, yy + 2, 6, rowH - 4);
        const nm = show.teams[ti].short_name || show.teams[ti].name;
        const z = fitText(c, nm, b.w - 16 - nc * cw - 4, fs); text(c, nm, b.x + 13, yy + rowH / 2 + 1, z, '#ffffff', 'left');
        for (let k = 0; k < nc; k++) {
          const v = d.vals && d.vals[k] ? d.vals[k][r] : null, x = colX(k);
          if (v === null || v === undefined) continue;
          const a2 = d.newVals && d.newVals[k] ? easeOutBack((t - 0.2) / 0.45) : 1;
          c.save(); c.globalAlpha *= clamp(a2, 0, 1); text(c, String(v), x, yy + rowH / 2 + 1, 22 * (0.6 + 0.4 * clamp(a2, 0, 1.2)), isWin ? '#ffd84a' : '#ffffff', 'center', 800); c.restore();
        }
        c.restore();
        continue;
      }
      if (d.glow) { const gl = 0.5 + 0.5 * Math.sin(t * 5); c.fillStyle = `rgba(255,216,74,${0.12 + 0.12 * gl})`; rrect(c, b.x, yy + 2, b.w, rowH - 4, 8); c.fill(); }
      const ap = d.newRows && d.newRows[r] ? smooth((t - 1.85) / 0.3) : 1;
      c.save(); c.globalAlpha = ap * (isOut ? 1 - 0.5 * wA : 1);
      teamBar(c, ti, b.x, yy + 2, 8, rowH - 4);
      teamChip(c, ti, b.x + 30, yy + rowH / 2, Math.min(11, rowH * 0.2));
      const nameW = b.w - 52 - nc * cw - 6;
      const z = fitText(c, show.teams[ti].name, nameW, fs); text(c, show.teams[ti].name, b.x + 50, yy + rowH / 2 + 1, z, '#ffffff', 'left');
      for (let k = 0; k < nc; k++) {
        const v = d.vals && d.vals[k] ? d.vals[k][r] : null, x = colX(k);
        if (v === null || v === undefined) { text(c, '–', x, yy + rowH / 2, 20, 'rgba(255,255,255,0.3)'); continue; }
        const a2 = d.newVals && d.newVals[k] ? easeOutBack((t - 0.2) / 0.45) : 1;
        c.save(); c.globalAlpha *= clamp(a2, 0, 1); text(c, String(v), x, yy + rowH / 2 + 1, 24 * (0.6 + 0.4 * clamp(a2, 0, 1.2)), '#ffffff', 'center', 800); c.restore();
      }
      c.restore();
    }
    if (d.golden) {
      const ap = d.newWin ? smooth((t - 0.5) / 0.4) : 1, pw = compact ? Math.min(104, b.w) : 150, ph = compact ? 17 : 22;
      c.save(); c.globalAlpha = ap; c.fillStyle = '#ffc400'; rrect(c, b.x + b.w - pw, b.y + 2 * rowH + 4, pw, ph, 6); c.fill();
      text(c, 'GOLDEN BALL', b.x + b.w - pw / 2, b.y + 2 * rowH + 4 + ph / 2 + 0.5, compact ? 11 : 13, '#2a1a00', 'center', 800); c.restore();
    }
  }
  // generic symmetric bracket: L = BRACKET.bracketLayout(n), data = { boxId: {rows, cols, vals, win, newWin, ...} }
  function drawBracketGeneric(c, L, data, t, opts) {
    opts = opts || {};
    const B = window.BRACKET;
    if (L.style === 'left_to_right') L.headers.forEach((h) => text(c, h.text, h.x, L.headerY, L.nTeams > 8 ? 15 : 19, '#8fb0dc', 'center', 700));
    else if (opts.headers !== false && L.nTeams > 4) L.headers.forEach((h) => text(c, h.text, h.x, 125, L.nTeams > 8 ? 13 : 17, '#8fb0dc', 'center', 700));
    // connectors (grey), then the highlighted advance path of each decided match
    for (const b of L.boxes) {
      const poly = B.connector(L, b.id); if (!poly) continue;
      c.strokeStyle = 'rgba(160,190,230,0.35)'; c.lineWidth = 3; c.lineJoin = 'round'; drawPolyPrefix(c, poly, 1);
      const d = data[b.id];
      if (d && d.win != null) { c.strokeStyle = '#ffd84a'; c.lineWidth = 4; drawPolyPrefix(c, poly, d.newWin ? smooth((t - 0.9) / 1.0) : 1); }
    }
    drawTrophy(c, L.trophy.x, L.trophy.y, L.nTeams > 8 ? 0.38 : 0.5, L.style === 'left_to_right' ? 0.75 : 0.45);
    for (const b of L.boxes) {
      if (!b.champion) { drawBracketBox(c, b, data[b.id], t); continue; }
      const d = data[b.id] || {};
      c.fillStyle = 'rgba(255,255,255,0.07)'; rrect(c, b.x, b.y, b.w, b.h, 10); c.fill();
      if (d.team === null || d.team === undefined) text(c, '?', b.x + b.w / 2, b.y + b.h / 2 + 2, Math.min(48, b.h * 0.5), 'rgba(255,255,255,0.35)', 'center', 800);
      else { teamBar(c, d.team, b.x, b.y, 8, b.h); const z = fitText(c, show.teams[d.team].name, b.w - 30, 22); text(c, show.teams[d.team].name, b.x + b.w / 2 + 4, b.y + b.h / 2 + 1, z, '#ffffff', 'center'); }
    }
    // qualifying team moves along the connector towards the centre
    for (const b of L.boxes) {
      const d = data[b.id]; if (!d || !d.newWin || d.win == null) continue;
      const u = smooth((t - 0.9) / 1.0); if (u <= 0 || u >= 1) continue;
      const r = d.rows.indexOf(d.win);
      const start = [b.side === 'L' ? b.x + b.w : b.x, b.y + b.rowH * (r + 0.5)];
      const poly = [start].concat(B.connector(L, b.id));
      const p = B.pointAlong(poly, u);
      const cmp = b.w < 200, w = cmp ? Math.max(130, b.w * 0.9) : Math.min(240, b.w * 0.66), h = b.rowH * 0.72;
      const nm = cmp ? (show.teams[d.win].short_name || show.teams[d.win].name) : show.teams[d.win].name;
      c.save(); c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 14;
      c.fillStyle = 'rgba(30,52,90,0.97)'; rrect(c, p[0] - w / 2, p[1] - h / 2, w, h, 8); c.fill(); c.restore();
      c.strokeStyle = '#ffd84a'; c.lineWidth = 2; rrect(c, p[0] - w / 2, p[1] - h / 2, w, h, 8); c.stroke();
      teamBar(c, d.win, p[0] - w / 2, p[1] - h / 2, 8, h);
      const z = fitText(c, nm, w - 30, 21); text(c, nm, p[0] + 4, p[1] + 1, z, '#ffffff', 'center');
    }
  }
  const BL_SYM16 = { top: 165, bottom: 690, margin: 22, gap: 24 };
  const BL_LTR16 = { top: 160, bottom: 700, headerY: 132 };
  function layoutFor(style, n) {
    if (n <= 4) return demoLayout(style);
    return style === 'symmetric' ? window.BRACKET.bracketLayout(n, BL_SYM16) : window.BRACKET.bracketLayoutLTR(n, BL_LTR16);
  }
  // steps: show.bracket (style + per-step box data computed in sim/tournament.js bracketSteps)
  function drawBracket(c, step, lf, g, seg, over) {
    darkBG(c, g);
    const t = lf / FPS;
    const B = over || show.bracket, style = B.style;
    c.save(); c.scale(S, S);
    text(c, show.competition.name, G.W / 2, 62, 50, '#ffffff', 'center', 800);
    const L = layoutFor(style, show.teams.length);
    // 16 teams: the per-match bracket update is short (1.6 s) -> the same animations run 1.6x faster (done by ~1.3 s)
    drawBracketGeneric(c, L, B.steps[clamp(step, 0, B.steps.length - 1)] || {}, show.teams.length > 4 ? t / 0.62 : t);
    const cap = seg && seg.caption;
    if (cap) {
      const a = smooth((t - 0.4) / 0.6); c.globalAlpha = a;
      const y = show.teams.length > 4 ? (style === 'symmetric' ? 560 : 712) : (style === 'symmetric' ? 600 : 650);
      text(c, cap, G.W / 2, y, show.teams.length > 4 ? 24 : 30, '#ffd84a', 'center', 800); c.globalAlpha = 1;
    }
    c.restore();
  }
  function drawTrophy(c, x, y, s, alpha) {
    // original simple trophy: bowl + two handles + stem + plinth + star
    c.save(); c.translate(x, y); c.scale(s, s); c.globalAlpha = alpha == null ? 1 : alpha;
    const gold = c.createLinearGradient(-70, 0, 70, 0);
    gold.addColorStop(0, '#b8860b'); gold.addColorStop(0.35, '#ffe08a'); gold.addColorStop(0.55, '#ffd23f'); gold.addColorStop(1, '#a87406');
    c.lineCap = 'round';
    c.strokeStyle = '#d9a520'; c.lineWidth = 12;
    c.beginPath(); c.arc(-62, -40, 26, Math.PI * 0.55, Math.PI * 1.55); c.stroke();
    c.beginPath(); c.arc(62, -40, 26, -Math.PI * 0.55, Math.PI * 0.45); c.stroke();
    c.fillStyle = gold;
    c.beginPath(); c.moveTo(-70, -80); c.lineTo(70, -80); c.quadraticCurveTo(70, 10, 0, 22); c.quadraticCurveTo(-70, 10, -70, -80); c.fill();
    c.fillRect(-10, 18, 20, 40);
    c.beginPath(); c.moveTo(-36, 58); c.lineTo(36, 58); c.lineTo(46, 74); c.lineTo(-46, 74); c.closePath(); c.fill();
    c.fillStyle = '#3a2b1a'; rrect(c, -58, 74, 116, 30, 6); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(-30, -50, 9, 26, 0.15, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff6d0';
    c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? 7 : 16; c.lineTo(Math.cos(a) * r, -35 + Math.sin(a) * r); } c.closePath(); c.fill();
    c.restore();
  }
  function drawWinner(c, lf, g) {
    const t = lf / FPS;
    darkBG(c, lf);
    const ti = show.champion, TM = show.teams[ti];
    c.save(); c.scale(S, S);
    const LX = 330, RX = 940;
    // rays + glow behind the trophy (left half)
    c.save(); c.beginPath(); c.rect(0, 0, 660, G.H); c.clip();
    c.save(); c.translate(LX, 300); c.rotate(t * 0.15);
    for (let i = 0; i < 16; i++) { c.rotate(Math.PI / 8); c.fillStyle = 'rgba(255,215,90,0.07)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-60, -900); c.lineTo(60, -900); c.closePath(); c.fill(); }
    c.restore();
    const glow = c.createRadialGradient(LX, 300, 10, LX, 300, 280);
    glow.addColorStop(0, 'rgba(255,220,120,0.35)'); glow.addColorStop(1, 'rgba(255,220,120,0)');
    c.fillStyle = glow; c.fillRect(0, 0, 660, G.H);
    c.restore();
    // divider
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(660, 120, 2, 520);
    const u = easeOutBack(t / 1.1);
    drawTrophy(c, LX, 300 + 200 * (1 - clamp(u, 0, 1.2)), 1.25 * clamp(0.4 + 0.6 * u, 0, 1.15), clamp(t / 0.4, 0, 1));
    const a = smooth((t - 0.9) / 0.5);
    c.globalAlpha = a;
    { const CN = show.competition.name, ttl = /CHAMPIONS/.test(CN) ? `${CN} WINNERS` : `${CN} CHAMPIONS`; const zt = fitText(c, ttl, 600, 32); text(c, ttl, LX, 80, zt, '#ffd84a', 'center', 800); }
    const nm = TM.name.toUpperCase();
    const z = fitText(c, nm, 580, 62); text(c, nm, LX, 525, z, '#ffffff', 'center', 800);
    // team colours stripe
    c.fillStyle = TM.primary; rrect(c, LX - 160, 568, 160, 14, 5); c.fill();
    c.fillStyle = TM.secondary; rrect(c, LX, 568, 160, 14, 5); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; rrect(c, LX - 160, 568, 320, 14, 5); c.stroke();
    const f = show.final;
    const sl = `Final: ${show.teams[f.ta].name} ${f.score[0]}–${f.score[1]} ${show.teams[f.tb].name}${f.golden ? ' (golden ball)' : ''}`;
    const z2 = fitText(c, sl, 600, 21, 600); text(c, sl, LX, 625, z2, '#c9dcff', 'center', 600);
    c.globalAlpha = 1;
    // podium (right half): top 3 scorers of the tournament
    const ah = smooth((t - 0.5) / 0.5);
    c.globalAlpha = ah; text(c, 'TOP SCORERS', RX, 80, 32, '#ffffff', 'center', 800); c.globalAlpha = 1;
    const base = 640, stepW = 170;
    const spots = [{ rank: 2, dx: -180, h: 150, col: '#c9d3de', d: 0.35 }, { rank: 1, dx: 0, h: 205, col: '#ffd84a', d: 0.15 }, { rank: 3, dx: 180, h: 110, col: '#d99a62', d: 0.55 }];
    for (const sp of spots) {
      const e = show.topScorers[sp.rank - 1]; if (!e) continue;
      const x = RX + sp.dx;
      const k = easeOut((t - 0.8 - sp.d) / 0.6), h = sp.h * k;
      const pg = c.createLinearGradient(0, base - h, 0, base);
      pg.addColorStop(0, mixHex(sp.col, '#ffffff', 0.15)); pg.addColorStop(1, mixHex(sp.col, '#1a2433', 0.45));
      c.fillStyle = pg; rrect(c, x - stepW / 2, base - h, stepW, h, 8); c.fill();
      if (k > 0.5) { c.globalAlpha = smooth((k - 0.5) / 0.5); text(c, String(sp.rank), x, base - h + 42, 48, 'rgba(20,30,45,0.85)', 'center', 800); c.globalAlpha = 1; }
      const ea = smooth((t - 1.4 - sp.d) / 0.5);
      if (ea <= 0) continue;
      const T2 = show.teams[e.team], P = T2.players[e.player];
      const top = base - sp.h;
      c.save(); c.globalAlpha = ea; c.translate(0, 18 * (1 - ea));
      drawBall(c, x, top - 122, 26, 0.5, kitStyle(T2), 1);
      const zn = fitText(c, P.name, stepW + 20, 25); text(c, P.name, x, top - 78, zn, '#ffffff', 'center', 800);
      const zt = fitText(c, T2.name, stepW + 10, 16, 600); text(c, T2.name, x, top - 53, zt, '#9fb6d6', 'center', 600);
      const gl = `${e.goals} GOAL${e.goals === 1 ? '' : 'S'}`;
      c.fillStyle = sp.rank === 1 ? '#ffd84a' : 'rgba(255,255,255,0.14)'; rrect(c, x - 50, top - 38, 100, 24, 8); c.fill();
      text(c, gl, x, top - 25.5, 15, sp.rank === 1 ? '#2a1a00' : '#ffffff', 'center', 800);
      c.restore();
    }
    // confetti (deterministic)
    const cols = ['#ffd84a', '#ff5d5d', '#5dc8ff', '#7dff8a', '#ffffff', TM.primary, TM.secondary];
    for (let i = 0; i < 220; i++) {
      const h1 = hash(i * 3 + 1), h2 = hash(i * 7 + 2), h3 = hash(i * 11 + 3);
      const t0 = h1 * 2.2 + 0.3; const tt = t - t0; if (tt < 0) continue;
      const x = h2 * G.W + Math.sin(tt * (1.5 + h3 * 2) + i) * 30;
      const y = -20 + tt * (120 + h3 * 110);
      if (y > G.H + 20) continue;
      c.save(); c.translate(x, y); c.rotate(tt * (3 + h1 * 5) + i); c.scale(1, Math.cos(tt * (4 + h2 * 4)));
      c.fillStyle = cols[i % cols.length]; c.fillRect(-5, -3, 10, 6); c.restore();
    }
    c.restore();
    // fade out last 0.8 s
    const segLen = findSeg(g).len / FPS;
    if (t > segLen - 0.8) { c.fillStyle = `rgba(0,0,0,${smooth((t - (segLen - 0.8)) / 0.8)})`; c.fillRect(0, 0, OUT_W, OUT_H); }
  }

  // original "star award" drawing for Man of the Match (not a copy of any real trophy)
  function drawStarAward(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    const gold = c.createLinearGradient(-50, -60, 50, 60);
    gold.addColorStop(0, '#ffe9a3'); gold.addColorStop(0.5, '#ffcc33'); gold.addColorStop(1, '#b98200');
    c.fillStyle = '#3a2b1a'; rrect(c, -46, 62, 92, 26, 6); c.fill();
    c.fillStyle = gold; c.beginPath(); c.moveTo(-14, 62); c.lineTo(14, 62); c.lineTo(8, 22); c.lineTo(-8, 22); c.closePath(); c.fill();
    c.beginPath(); c.arc(0, -18, 46, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#a87406'; c.lineWidth = 4; c.stroke();
    c.fillStyle = '#fff6d0';
    c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? 13 : 31; c.lineTo(Math.cos(a) * r, -18 + Math.sin(a) * r); } c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(-22, -38, 7, 14, 0.6, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  function drawMotm(c, m, lf, seg) {
    const fr = m.frames[m.frames.length - 1];
    drawScene(c, m, fr, { noCam: true, frameIndex: m.frames.length - 1, trail: false });
    c.fillStyle = 'rgba(5,12,25,0.62)'; c.fillRect(0, 0, OUT_W, OUT_H);
    const mo = m.motm, ti = mo.team === 'A' ? m.ta : m.tb, TM = show.teams[ti], P = TM.players[mo.player];
    const a = smooth(lf / 8) * (1 - smooth((lf - seg.len + 8) / 8));
    const sc = 0.94 + 0.06 * easeOut(lf / 10);
    c.save(); c.scale(S, S); c.globalAlpha = a;
    c.translate(G.W / 2, 360); c.scale(sc, sc); c.translate(-G.W / 2, -360);
    const x0 = G.W / 2 - 390, y0 = 200, w = 780, h = 320;
    c.fillStyle = 'rgba(8,20,38,0.96)'; rrect(c, x0, y0, w, h, 22); c.fill();
    c.save(); rrect(c, x0, y0, w, h, 22); c.clip();
    c.fillStyle = TM.primary; c.fillRect(x0, y0, w, 10); c.fillStyle = TM.secondary; c.fillRect(x0, y0 + 10, w, 5);
    c.restore();
    text(c, 'MAN OF THE MATCH', G.W / 2, y0 + 52, 26, '#ffd84a', 'center', 800);
    drawStarAward(c, x0 + 135, y0 + 175, 1.05);
    const cx = x0 + 480;
    const zn = fitText(c, P.name, 470, 58); text(c, P.name, cx, y0 + 140, zn, '#ffffff', 'center', 800);
    kitDot(c, { primary: TM.primary, secondary: TM.secondary }, cx - 120, y0 + 200, 11);
    text(c, `#${P.number} · ${TM.name}`, cx - 100, y0 + 201, 24, '#c9dcff', 'left', 700);
    const why = `${mo.goals} goal${mo.goals === 1 ? '' : 's'} in this match${mo.tiebreak === 'decisive_goal' ? ' · decisive goal' : mo.tiebreak === 'last_goal' ? ' · last goal' : ''}`;
    text(c, why, cx, y0 + 252, 21, '#9fb6d6', 'center', 600);
    c.restore();
  }

  function matchCard(c, m, title, lines, alpha) {
    c.save(); c.scale(S, S); c.globalAlpha = alpha;
    c.fillStyle = 'rgba(8,20,38,0.95)'; rrect(c, G.W / 2 - 360, 230, 720, 230, 22); c.fill();
    text(c, title, G.W / 2, 275, 22, '#8fb0dc', 'center', 700);
    lines.forEach((l, i) => { const z = fitText(c, l.s, 680, l.size || 40, l.w || 800); text(c, l.s, G.W / 2, 330 + i * 52, z, l.color || '#ffffff', 'center', l.w || 800); });
    c.restore();
  }

  // ---------- main entry ----------
  // small SIMULATION label, always visible (project rule)
  function simLabel() {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(S, S); ctx.globalAlpha = 0.8;
    ctx.font = `700 11px ${FONT}`; const w = ctx.measureText('SIMULATION').width + 16;
    ctx.fillStyle = 'rgba(8,20,38,0.55)'; rrect(ctx, G.W - w - 10, G.H - 27, w, 18, 9); ctx.fill();
    text(ctx, 'SIMULATION', G.W - 10 - w / 2, G.H - 17.5, 11, '#ffffff', 'center', 700);
    ctx.restore();
  }
  function renderFrame(g) { renderInner(g); simLabel(); }
  function renderInner(g) {
    const seg = findSeg(g);
    const lf = g - seg.start;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, OUT_W, OUT_H);
    if (seg.type === 'intro') { drawIntro(ctx, lf, lf); fadeIn(lf); return; } // darkBG streaks follow the local frame (render cache)
    if (seg.type === 'bracket') { drawBracket(ctx, seg.step, lf, lf, seg); fadeIn(lf, 8); return; }
    if (seg.type === 'roundCard') { drawRoundCard(ctx, seg, lf, lf); fadeIn(lf, 8); return; }
    if (seg.type === 'winner') { drawWinner(ctx, lf, g); return; }
    const m = show.matches[seg.match];
    const names = `${teamName(m.ta)}  vs  ${teamName(m.tb)}`;
    const stageTitle = m.leg === 'FINAL' ? `${show.competition.name} · FINAL` : `${m.stage} · ${m.leg}`;
    if (seg.type === 'motm') { drawMotm(ctx, m, lf, seg); return; }
    if (seg.type === 'matchPre') {
      const fr = m.frames[0];
      drawScene(ctx, m, fr, { noCam: true, noFx: true }); drawHUD(ctx, m, fr);
      const a = smooth(lf / 8) * (1 - smooth((lf - seg.len + 8) / 8));
      const lines = [{ s: names, size: 40 }];
      if (m.leg === 'LEG 2') lines.push({ s: `Leg 1: ${m.prev[0]}–${m.prev[1]}`, size: 24, w: 600, color: '#ffd84a' });
      else lines.push({ s: 'KICK-OFF', size: 24, w: 700, color: '#ffd84a' });
      matchCard(ctx, m, stageTitle, lines, a);
      fadeIn(lf, 8);
      return;
    }
    if (seg.type === 'match') {
      const fr = m.frames[Math.min(lf, m.frames.length - 1)];
      const v = lf / FPS;
      drawScene(ctx, m, fr, { frameIndex: lf, v });
      const lg = lastEventBeforeV(m, 'goal', v);
      let scorePop = null;
      if (lg && v - evV(lg) < 0.7) { const u = (v - evV(lg)) / 0.7; scorePop = { side: lg.team === 'A' ? 0 : 1, p: Math.sin(Math.PI * clamp(u, 0, 1)) * (u < 0.3 ? easeOutBack(u / 0.3) : 1), color: m.kits[lg.team].primary }; }
      drawHUD(ctx, m, fr, { scorePop });
      matchOverlays(ctx, m, fr, v);
      return;
    }
    if (seg.type === 'fulltime') {
      const fr = m.frames[m.frames.length - 1];
      drawScene(ctx, m, fr, { noCam: true, noFx: true, frameIndex: m.frames.length - 1, trail: false });
      drawHUD(ctx, m, fr);
      ctx.fillStyle = `rgba(5,12,25,${0.45 * smooth(lf / 10)})`; ctx.fillRect(0, 0, OUT_W, OUT_H);
      const sc = m.score;
      const lines = [{ s: `${teamName(m.ta)}  ${sc[0]}–${sc[1]}  ${teamName(m.tb)}`, size: 38 }];
      if (m.leg === 'LEG 2') {
        const ag = [m.prev[0] + sc[0], m.prev[1] + sc[1]];
        lines.push({ s: `Aggregate ${ag[0]}–${ag[1]}`, size: 26, w: 700, color: '#ffd84a' });
        const w = m.goldenWinner ? (m.goldenWinner === 'A' ? m.ta : m.tb) : (ag[0] > ag[1] ? m.ta : m.tb);
        lines.push({ s: `${teamName(w)} advance to ${m.nextName || 'the final'}${m.goldenWinner ? ' (golden ball)' : ''}`, size: 24, w: 600, color: '#ffffff' });
      } else if (m.leg === 'FINAL') {
        const w = m.goldenWinner ? (m.goldenWinner === 'A' ? m.ta : m.tb) : (sc[0] > sc[1] ? m.ta : m.tb);
        lines.push({ s: `${teamName(w)} win the ${show.competition.name}${m.goldenWinner ? ' (golden ball)' : ''}`, size: 26, w: 700, color: '#ffd84a' });
      } else lines.push({ s: 'Second leg to come', size: 24, w: 600, color: '#c9dcff' });
      matchCard(ctx, m, m.goldenWinner ? 'DECIDED BY GOLDEN BALL' : 'FULL TIME', lines, smooth(lf / 8));
      return;
    }
    if (seg.type === 'replay') {
      const srcT = seg.t0 + (lf / FPS) * seg.speed;
      const at = frameAtTime(m, srcT);
      const fr = at.fr;
      drawScene(ctx, m, fr, { frameIndex: at.i, noCam: true, noFx: true, zoom: { z: 1.18, x: 1030, y: 450 } });
      // replay look: slight desaturating tint + letterbox + label
      ctx.fillStyle = 'rgba(20,30,50,0.10)'; ctx.fillRect(0, 0, OUT_W, OUT_H);
      ctx.save(); ctx.scale(S, S);
      ctx.fillStyle = '#05080d'; ctx.fillRect(0, 0, G.W, 44); ctx.fillRect(0, G.H - 44, G.W, 44);
      const bl = Math.floor(lf / 15) % 2 === 0;
      ctx.fillStyle = '#ff3b3b'; if (bl) { ctx.beginPath(); ctx.arc(40, 22, 7, 0, Math.PI * 2); ctx.fill(); }
      text(ctx, 'REPLAY', 56, 23, 22, '#ffffff', 'left', 800);
      text(ctx, 'SLOW MOTION', G.W - 30, 23, 16, '#bbbbbb', 'right', 700);
      // lower-third caption: scorer + game minute (never beyond 90+added)
      const gl = m.goals[seg.goal];
      const ti = gl.team === 'A' ? m.ta : m.tb, P = show.teams[ti].players[gl.player];
      const cap = `${P.name} · ${window.CLOCK.minuteLabel(m, gl.t, show.cfg.GAME_MIN_PER_SEC)}`;
      ctx.globalAlpha = smooth((lf - 6) / 10);
      const bx = 60, by = G.H - 44 - 100;
      ctx.font = `800 40px ${FONT}`; const cw = Math.max(ctx.measureText(cap).width, 260) + 64;
      ctx.fillStyle = 'rgba(8,20,38,0.9)'; rrect(ctx, bx, by, cw, 82, 10); ctx.fill();
      teamBar(ctx, ti, bx, by, 10, 82);
      text(ctx, cap, bx + 32, by + 32, 40, '#ffffff', 'left', 800);
      text(ctx, `#${P.number} · ${teamName(ti)}${gl.golden ? ' · GOLDEN GOAL' : ''}`, bx + 32, by + 64, 18, '#9fc7ff', 'left', 700);
      ctx.globalAlpha = 1;
      ctx.restore();
      fadeIn(lf, 6);
      return;
    }
  }
  function fadeIn(lf, n) { n = n || 10; if (lf < n) { ctx.fillStyle = `rgba(0,0,0,${1 - lf / n})`; ctx.fillRect(0, 0, OUT_W, OUT_H); } }

  window.initRenderer = function (data) {
    show = data;
    segIndex = show.segments;
    if (show.outSize) { OUT_W = show.outSize[0]; OUT_H = show.outSize[1]; S = OUT_W / G.W; }
    canvas = document.getElementById('c');
    canvas.width = OUT_W; canvas.height = OUT_H;
    ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    buildBackground();
    for (const k of Object.keys(styleCache)) delete styleCache[k];
    const L = show.logos || {};
    return Promise.all(Object.keys(L).map((id) => new Promise((res) => {
      const im = new Image(); im.onload = () => { logoImgs[id] = im; res(); }; im.onerror = () => res(); im.src = L[id];
    }))).then(() => ({ total: show.totalFrames, logos: Object.keys(logoImgs).length }));
  };
  window.renderFrame = renderFrame;
  window.renderEmptyBracket = function (n, title, style) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, OUT_W, OUT_H);
    darkBG(ctx, 0);
    ctx.save(); ctx.scale(S, S);
    text(ctx, title || show.competition.name, G.W / 2, 62, 50, '#ffffff', 'center', 800);
    const L = bracketStyle(style) === 'symmetric' ? window.BRACKET.bracketLayout(n, { top: 175, bottom: 690 }) : window.BRACKET.bracketLayoutLTR(n, n > 4 ? { top: 160, bottom: 700, headerY: 132 } : BL_LTR4);
    drawBracketGeneric(ctx, L, {}, 0);
    ctx.restore(); simLabel();
    return canvas.toDataURL('image/png');
  };
  // demo bracket at a given step in a given style (screenshots / tests); lf = local frame in the segment
  // bracket at a given step; over = { style, steps } (another style than the show's, computed in Node)
  window.renderDemoBracket = function (step, style, lf, over, caption) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, OUT_W, OUT_H);
    drawBracket(ctx, step, lf === undefined ? 90 : lf, 0, { caption: caption || null }, over && over.style === style ? over : (show.bracket.style === style ? show.bracket : over));
    simLabel();
    return canvas.toDataURL('image/png');
  };
  // close-up of balls (decal readability check): kits = [{team, primary, secondary, ring}], r in design px, zoom
  window.renderBallSheet = function (kits, r, zoom, spin) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#5aa0e0'; ctx.fillRect(0, 0, OUT_W, OUT_H);
    ctx.save(); ctx.scale(S * zoom, S * zoom);
    const gap = r * 3, per = Math.max(1, Math.min(kits.length, 8, Math.floor((G.W / zoom - r) / gap)));
    kits.forEach((k, i) => { const x = r * 2 + (i % per) * gap, y = r * 2 + Math.floor(i / per) * gap; drawBall(ctx, x, y, r, spin || 0, kitStyle(k), 1); });
    ctx.restore();
    return canvas.toDataURL('image/png');
  };
  window.ballStyleInfo = function (kit) { const st = kitStyle(kit); return { logo: !!st.logo, ring: st.ring }; };
  window.grabFrame = function (g, q) { renderFrame(g); return canvas.toDataURL('image/jpeg', q || 0.92); };
  window.grabPNG = function (g) { renderFrame(g); return canvas.toDataURL('image/png'); };
})();
