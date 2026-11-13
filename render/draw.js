/* MARBLE CUP renderer: Canvas 2D, deterministic, frame-by-frame. Design space 1280x720, output scale 1.5. */
(function () {
  'use strict';
  const G = window.GEOM;
  let OUT_W = 1920, OUT_H = 1080, S = OUT_W / G.W; // preview: 1280x720 (set in initRenderer)
  const BG_SS = 2; // static background cached at 2x design (2560x1440) and downsampled = supersampling
  const FONT = '"Bahnschrift", "Segoe UI", "Arial", sans-serif';
  let show, canvas, ctx, bgCanvas, segIndex = [], bgImg = null, bgLayers = [];
  const FPS = 30;

  // ---------- helpers ----------
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const numTag = (P) => (P && P.number ? '#' + P.number + ' · ' : ''); // P6: national-team players have no shirt number
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
    const MAP = show.map;
    bgLayers = [];
    if (bgImg) { // P7 §7b: Max's image as the background layer (cover-fit, bottom-anchored); nothing procedural behind it
      const F = bgFitInfo();
      c.drawImage(bgImg, F.dx, F.dy, F.dw, F.dh); bgLayers.push('image');
      if (MAP.tint) { c.fillStyle = MAP.tint[0]; c.fillRect(0, 0, G.W, G.H); }
      if (MAP.center_screen_rect) { centerScreenText(c, MAP.center_screen_rect); bgLayers.push('center_screen'); }
    } else {
      const sky = c.createLinearGradient(0, 0, 0, G.H);
      sky.addColorStop(0, MAP.sky[0]); sky.addColorStop(0.55, MAP.sky[1]); sky.addColorStop(1, MAP.sky[2]);
      c.fillStyle = sky; c.fillRect(0, 0, G.W, G.H); bgLayers.push('sky');
      drawScenery(c, MAP); bgLayers.push('scenery:' + (MAP.scenery || 'none'));
    }
    // pipe (vertical part in the sky)
    drawPipeBase(c, 'sky');
    // platforms
    const plat = MAP.platform_style === 'blocks' ? drawPlatformBlocks : drawPlatform;
    plat(c, G.LEFT_PLAT[0] - 20, G.LEFT_PLAT[1], 1);
    plat(c, G.RIGHT_PLAT[0], G.RIGHT_PLAT[1] + 20, 2); bgLayers.push('platforms');
    drawPipeBase(c, 'ground'); bgLayers.push('pipe');
    // spout hole + collar
    const sx = G.SPOUT_X, gy = G.GROUND_Y;
    c.fillStyle = '#2b2622'; c.beginPath(); c.ellipse(sx, gy + 1, G.BALL_R + 4, 5, 0, 0, Math.PI * 2); c.fill();
  }
  // P3 map themes: sparse background scenery behind the (identical) play layout
  function drawScenery(c, MAP) {
    const sc = MAP.scenery || 'none';
    if (MAP.night) { // a few soft stars, fixed pattern
      let z = 7; const rnd = () => ((z = (z * 16807) % 2147483647) / 2147483647);
      c.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 38; i++) { const x = rnd() * G.W, y = 130 + rnd() * 250, r = 0.6 + rnd() * 1.1; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
    }
    if (sc === 'sunset') {
      const sx = 640, sy = 500;
      const glow = c.createRadialGradient(sx, sy, 10, sx, sy, 330);
      glow.addColorStop(0, 'rgba(255,236,190,0.55)'); glow.addColorStop(1, 'rgba(255,200,150,0)');
      c.fillStyle = glow; c.fillRect(0, 0, G.W, G.H);
      c.fillStyle = MAP.sun || '#fff0b8'; c.beginPath(); c.arc(sx, sy, 58, 0, Math.PI * 2); c.fill();
      const H = MAP.hills || ['#b0668a', '#8e5276'];
      [[H[0], 590, 0.0045, 26], [H[1], 640, 0.007, 20]].forEach(([col, base, f, amp], li) => {
        c.fillStyle = col; c.beginPath(); c.moveTo(0, G.H);
        for (let x = 0; x <= G.W; x += 8) c.lineTo(x, base - amp * (Math.sin(x * f + li * 2.1) * 0.6 + Math.sin(x * f * 2.3 + 1 + li) * 0.4));
        c.lineTo(G.W, G.H); c.closePath(); c.fill();
      });
    }
    if (sc === 'bowl') drawBowl(c, MAP);
    if (sc === 'stadium') {
      const st = MAP.stand || ['#a9bfd2', '#93abc1'];
      // two low stands (tiers), clean silhouettes
      c.fillStyle = st[0]; c.beginPath(); c.moveTo(0, G.H); c.lineTo(0, 520); c.lineTo(G.W, 520); c.lineTo(G.W, G.H); c.closePath(); c.fill();
      // faint seat rows on the upper tier
      c.fillStyle = MAP.night ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.16)';
      for (let y = 532; y < 584; y += 13) c.fillRect(0, y, G.W, 2);
      c.fillStyle = st[1]; c.fillRect(0, 585, G.W, G.H - 585);
      c.fillStyle = MAP.night ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.35)'; c.fillRect(0, 518, G.W, 3); c.fillRect(0, 583, G.W, 2);
      // two floodlight towers in the open middle
      const FL = MAP.floodlight || '#e9eef3';
      for (const x of [470, 810]) {
        if (MAP.night) {
          const g = c.createRadialGradient(x, 200, 4, x, 200, 112);
          g.addColorStop(0, 'rgba(255,246,220,0.55)'); g.addColorStop(1, 'rgba(255,246,220,0)');
          c.fillStyle = g; c.fillRect(x - 112, 88, 224, 224);
        }
        c.fillStyle = MAP.night ? '#2a3a55' : 'rgba(120,140,160,0.75)';
        c.fillRect(x - 2.5, 210, 5, 310);
        c.fillStyle = MAP.night ? '#2a3a55' : 'rgba(120,140,160,0.85)'; rrect(c, x - 26, 186, 52, 24, 4); c.fill();
        c.fillStyle = FL;
        for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { c.beginPath(); c.arc(x - 18 + i * 12, 193 + j * 10, 3.6, 0, Math.PI * 2); c.fill(); }
      }
    }
  }
  // ---------- P7 §7: Premier League stadium bowl (procedural fallback when no background image exists) ----------
  function bgFitInfo() {
    const MAP = show.map;
    return window.BGFIT.bgFit(bgImg.naturalWidth || bgImg.width, bgImg.naturalHeight || bgImg.height, G.W, G.H,
      { pitchTop: MAP.bg_pitch_top != null ? MAP.bg_pitch_top : null, groundY: G.GROUND_Y, inset: MAP.bg_ground_inset || 0 });
  }
  function centerScreenText(c, R) { // plain text "PREMIER LEAGUE" in our own font/colours on the configured screen rectangle
    const [x, y, w, h] = R, SC = show.map.screen || ['#0e2a47', '#19b5a8'];
    const g = c.createLinearGradient(x, y, x, y + h); g.addColorStop(0, shade(SC[0], 0.12)); g.addColorStop(1, SC[0]);
    c.fillStyle = g; rrect(c, x, y, w, h, 4); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1.2; rrect(c, x, y, w, h, 4); c.stroke();
    const label = (show.league && show.league.display_name) || show.competition.name;
    const z = fitText(c, label, w - 18, h * 0.42, 900); text(c, label, x + w / 2, y + h * 0.52, z, SC[1], 'center', 900);
    c.fillStyle = hexA(SC[1], 0.5); c.fillRect(x + 10, y + h - 7, w - 20, 2);
  }
  function drawBowl(c, MAP) {
    const night = !!MAP.night, ST = MAP.stand || ['#4a3d78', '#2e2552'], CR = MAP.crowd || ['#6b4fb3', '#e8e2f4', '#3a2c6e', '#c9b6ef'];
    const RF = MAP.roof || ['#c9d3e2', '#7f8da3'], FL = MAP.floodlight || '#ffffff';
    const arc = (y0, sag) => (x) => y0 + sag * Math.pow((x - G.W / 2) / (G.W / 2), 2); // curved bowl rows (higher at the sides)
    // tiers (back to front): 3 curved stands full of procedural crowd
    const tiers = [[arc(250, -70), arc(330, -60)], [arc(338, -55), arc(420, -45)], [arc(430, -40), arc(520, -30)]];
    tiers.forEach(([top, bot], ti) => {
      c.fillStyle = ti % 2 ? ST[1] : ST[0];
      c.beginPath(); c.moveTo(0, top(0)); for (let x = 0; x <= G.W; x += 16) c.lineTo(x, top(x)); for (let x = G.W; x >= 0; x -= 16) c.lineTo(x, bot(x)); c.closePath(); c.fill();
      for (let i = 0; i < 1500; i++) {
        const hx = hash(ti * 7919 + i * 13 + 1), hy = hash(ti * 104729 + i * 7 + 3), hc = hash(i * 31 + ti);
        const x = hx * G.W, y = top(x) + 4 + hy * (bot(x) - top(x) - 8);
        c.fillStyle = CR[Math.floor(hc * CR.length)]; c.globalAlpha = night ? 0.55 : 0.85;
        c.fillRect(x, y, 2.2, 2.6);
      }
      c.globalAlpha = 1;
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); for (let x = 0; x <= G.W; x += 16) c.lineTo(x, bot(x)); for (let x = G.W; x >= 0; x -= 16) c.lineTo(x, bot(x) + 5); c.closePath(); c.fill();
    });
    // roof with truss structure + rows of floodlights
    const rtop = arc(150, -120), rbot = arc(232, -80);
    c.fillStyle = night ? shade(RF[1], -0.5) : RF[1];
    c.beginPath(); for (let x = 0; x <= G.W; x += 16) c.lineTo(x, rtop(x)); for (let x = G.W; x >= 0; x -= 16) c.lineTo(x, rbot(x)); c.closePath(); c.fill();
    c.strokeStyle = night ? 'rgba(200,215,235,0.35)' : RF[0]; c.lineWidth = 1.4;
    c.beginPath(); for (let x = 0; x <= G.W; x += 16) c.lineTo(x, rtop(x)); c.stroke();
    c.beginPath(); for (let x = 0; x <= G.W; x += 16) c.lineTo(x, rbot(x)); c.stroke();
    for (let x = 0; x < G.W; x += 32) { c.beginPath(); c.moveTo(x, rtop(x)); c.lineTo(x + 16, rbot(x + 16)); c.lineTo(x + 32, rtop(x + 32)); c.stroke(); }
    for (let x = 24; x < G.W; x += 44) {
      const y = rbot(x) - 4;
      const g = c.createRadialGradient(x, y, 0.5, x, y, night ? 26 : 12); g.addColorStop(0, hexA(FL, night ? 0.75 : 0.6)); g.addColorStop(1, hexA(FL, 0)); c.fillStyle = g; c.fillRect(x - 26, y - 26, 52, 52);
      c.fillStyle = FL; c.beginPath(); c.arc(x, y, 2.4, 0, Math.PI * 2); c.fill();
    }
    // advertising boards angled in a V towards the centre screen (fictional brands only) + the centre screen
    const SCR = MAP.center_screen_rect || [530, 250, 220, 62];
    const boards = ['NOVA ENERGY', 'KESTREL AIR', 'BRIXTON BANK', 'MARBLE FC', 'ORBIT MOBILE', 'HALCYON TEA'];
    const by1 = 548;
    for (let i = 0; i < 6; i++) {
      const left = i < 3, k = left ? i : i - 3;
      const xa = left ? 20 + k * 165 : 1260 - (k + 1) * 165, xb = xa + 150;
      const rise = left ? k : 2 - k; // V: boards rise towards the middle
      const ya = 528 - rise * 3, yb = 528 - (left ? rise + 1 : rise - 1) * 3;
      c.fillStyle = i % 2 ? '#13324f' : '#0f263f';
      c.beginPath(); c.moveTo(xa, ya); c.lineTo(xb, yb); c.lineTo(xb, by1); c.lineTo(xa, by1); c.closePath(); c.fill();
      const z = fitText(c, boards[i], 130, 11, 800); text(c, boards[i], (xa + xb) / 2, (Math.min(ya, yb) + by1) / 2 + 1, z, i % 2 ? '#8fe3d9' : '#ffffff', 'center', 800);
    }
    centerScreenText(c, SCR);
    // the real pitch, seen through the gap between the platforms: stripes, centre circle, halfway line
    const py = 552;
    const pg = c.createLinearGradient(0, py, 0, G.H); pg.addColorStop(0, shade(MAP.grass[1], 0.05)); pg.addColorStop(1, MAP.grass[2]);
    c.fillStyle = pg; c.fillRect(0, py, G.W, G.H - py);
    for (let i = 0; i < 16; i += 2) { c.fillStyle = 'rgba(255,255,255,0.06)'; c.beginPath(); const x0 = i * 80 - 40, x1 = x0 + 80; c.moveTo(G.W / 2 + (x0 - G.W / 2) * 0.55, py); c.lineTo(G.W / 2 + (x1 - G.W / 2) * 0.55, py); c.lineTo(G.W / 2 + (x1 - G.W / 2) * 1.6, G.H); c.lineTo(G.W / 2 + (x0 - G.W / 2) * 1.6, G.H); c.closePath(); c.fill(); }
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(G.W / 2, py); c.lineTo(G.W / 2, G.H); c.stroke();
    c.beginPath(); c.ellipse(G.W / 2, 640, 120, 30, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(0, py + 1); c.lineTo(G.W, py + 1); c.stroke();
    if (night) { const g = c.createLinearGradient(0, 0, 0, G.H); g.addColorStop(0, 'rgba(5,10,25,0.15)'); g.addColorStop(1, 'rgba(5,10,25,0)'); c.fillStyle = g; c.fillRect(0, 0, G.W, G.H); }
    if (MAP.tint) { c.fillStyle = MAP.tint[0]; c.fillRect(0, 0, G.W, G.H); }
  }
  // stone-block platform with a grass top (P7 premier maps); same outline as drawPlatform (the play layout is unchanged)
  function drawPlatformBlocks(c, x0, x1, seed) {
    const gy = G.GROUND_Y, MAP = show.map, RK = MAP.rock;
    c.save();
    c.beginPath();
    if (seed === 1) { c.moveTo(x0, gy); c.lineTo(x1 - 6, gy); c.quadraticCurveTo(x1, gy + 4, x1, gy + 18); c.lineTo(x1 - 4, G.H + 10); c.lineTo(x0, G.H + 10); }
    else { c.moveTo(x1, gy); c.lineTo(x0 + 6, gy); c.quadraticCurveTo(x0, gy + 4, x0, gy + 18); c.lineTo(x0 + 4, G.H + 10); c.lineTo(x1, G.H + 10); }
    c.closePath(); c.fillStyle = RK[2]; c.fill(); c.clip();
    const bh = 26, bw = 58;
    for (let row = 0, y = gy + 14; y < G.H + 10; row++, y += bh) {
      const off = (row % 2) * bw / 2;
      for (let x = x0 - bw + off; x < x1 + bw; x += bw) {
        const h1 = hash(seed * 997 + row * 131 + Math.round(x)), base = h1 < 0.33 ? RK[0] : h1 < 0.7 ? RK[1] : mixHex(RK[1], RK[2], 0.5);
        const g = c.createLinearGradient(0, y, 0, y + bh); g.addColorStop(0, shade(base, 0.12)); g.addColorStop(1, shade(base, -0.12));
        c.fillStyle = g; rrect(c, x + 1.5, y + 1.5, bw - 3, bh - 3, 3); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(x + 3, y + 2.5, bw - 6, 1.5);
        if (h1 > 0.82) { c.strokeStyle = 'rgba(30,25,20,0.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + bw * 0.3, y + 4); c.lineTo(x + bw * 0.45, y + bh * 0.6); c.stroke(); }
      }
    }
    const inner = seed === 1 ? x1 : x0;
    const eg = seed === 1 ? c.createLinearGradient(inner - 40, 0, inner, 0) : c.createLinearGradient(inner + 40, 0, inner, 0);
    eg.addColorStop(0, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(15,10,5,0.35)');
    c.fillStyle = eg; c.fillRect(x0, gy, x1 - x0, G.H - gy);
    const gg = c.createLinearGradient(0, gy - 4, 0, gy + 16);
    gg.addColorStop(0, MAP.grass[0]); gg.addColorStop(0.35, MAP.grass[1]); gg.addColorStop(1, MAP.grass[2]);
    c.fillStyle = gg; c.fillRect(x0, gy - 1, x1 - x0, 15);
    for (let x = x0, k = 0; x < x1; x += 12, k++) { if (k % 2) { c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(x, gy - 1, 12, 15); } } // mown stripes
    c.fillStyle = 'rgba(20,50,15,0.4)'; c.fillRect(x0, gy + 13, x1 - x0, 3);
    c.restore();
    c.fillStyle = MAP.grass_blades || MAP.grass[0];
    for (let x = x0 + 2; x < x1 - 2; x += 4) { const h = 2 + hash(seed * 77 + x) * 3; c.beginPath(); c.moveTo(x - 1.6, gy); c.lineTo(x, gy - h); c.lineTo(x + 1.6, gy); c.fill(); }
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
        logo, ring, flag: !!(logo && show.teams.some((t) => t.id === team && t.national)) };
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
    if (st.flag) { // national team: the flag covers the whole ball (printed), the ring keeps the team colour
      const im = st.logo, k = Math.max(2 * r / im.width, 2 * r / im.height) * 1.04;
      c.drawImage(im, -im.width * k / 2, -im.height * k / 2, im.width * k, im.height * k);
    } else {
    // small accents in the team colour (rotate with the ball -> shows the roll)
    c.fillStyle = st.ring;
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; c.beginPath(); c.arc(Math.cos(a) * r * 0.79, Math.sin(a) * r * 0.79, r * 0.075, 0, Math.PI * 2); c.fill(); }
    // the crest decal (fit in a square of 1.42 r, aspect kept)
    const im = st.logo, s = r * 1.42, k = Math.min(s / im.width, s / im.height), w = im.width * k, h = im.height * k;
    c.drawImage(im, -w / 2, -h / 2, w, h);
    }
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
    const WM = (show.map && show.map.windmill) || ['#e8553e', '#a8321f'], col = WM[0], dark = WM[1];
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
    const v2 = col.toLowerCase() === '#e8553e'; // approved v2 look stays bit-identical
    bg.addColorStop(0, v2 ? '#ff8a6b' : mixHex(col, '#ffffff', 0.32)); bg.addColorStop(0.5, col); bg.addColorStop(1, v2 ? '#c23f2a' : mixHex(col, dark, 0.6));
    rrect(c, -G.MILL_HALF - 1, -G.MILL_THICK / 2, 2 * G.MILL_HALF + 2, G.MILL_THICK, 6);
    c.fillStyle = bg; c.fill();
    if (show.map && show.map.windmill_stripes) { // P7: red-and-white bands (premier maps)
      c.save(); rrect(c, -G.MILL_HALF - 1, -G.MILL_THICK / 2, 2 * G.MILL_HALF + 2, G.MILL_THICK, 6); c.clip();
      for (let x = -G.MILL_HALF + 14; x < G.MILL_HALF - 10; x += 28) { const wg = c.createLinearGradient(0, -G.MILL_THICK / 2, 0, G.MILL_THICK / 2); wg.addColorStop(0, '#ffffff'); wg.addColorStop(1, '#d9dde3'); c.fillStyle = wg; c.fillRect(x, -G.MILL_THICK / 2, 14, G.MILL_THICK); }
      c.restore();
      rrect(c, -G.MILL_HALF - 1, -G.MILL_THICK / 2, 2 * G.MILL_HALF + 2, G.MILL_THICK, 6);
    }
    c.strokeStyle = dark; c.lineWidth = 1.2; c.stroke();
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
  // P7 premier maps: deeper net with perspective (roof + back panel receding up-right), gentle idle sway, ripple on goals.
  // Visual only: the colliders (bar, post, goal box) are the same as on every map.
  function drawNetDeep(c, wob, t) {
    const x0 = G.GOAL_LINE_X, x1 = G.W, y0 = G.BAR_Y, y1 = G.GROUND_Y, dx = 26, dy = -22; // depth offset of the back frame
    const sway = (x, y) => 0.8 * Math.sin(t * 1.3 + y * 0.05) * ((x - x0) / (x1 - x0));
    const off = (x, y) => sway(x, y) + (wob ? wob.a * Math.sin(x * 0.12 + wob.p) * Math.sin(y * 0.09 + wob.p * 0.7) * Math.exp(-((x - wob.x) ** 2 + (y - wob.y) ** 2) / 4000) : 0);
    c.save();
    // back panel (further away: dimmer, finer mesh)
    c.fillStyle = 'rgba(230,236,245,0.10)'; c.fillRect(x0 + dx, y0 + dy, x1 - x0, y1 - y0 - dy * 0.3);
    c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 0.7;
    for (let x = x0 + dx + 7; x < x1; x += 7) { c.beginPath(); for (let y = y0 + dy; y <= y1; y += 6) c.lineTo(x + off(x, y) * 0.5, y); c.stroke(); }
    for (let y = y0 + dy + 7; y < y1; y += 7) { c.beginPath(); for (let x = x0 + dx; x <= x1; x += 6) c.lineTo(x, y + off(x, y) * 0.3); c.stroke(); }
    // roof net (from the crossbar back to the back frame)
    c.fillStyle = 'rgba(240,244,250,0.12)'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y0); c.lineTo(x1, y0 + dy); c.lineTo(x0 + dx, y0 + dy); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 0.8;
    for (let k = 1; k < 4; k++) { const u = k / 4; c.beginPath(); c.moveTo(x0 + dx * u, y0 + dy * u); c.lineTo(x1, y0 + dy * u); c.stroke(); }
    for (let x = x0 + 9; x < x1; x += 9) { c.beginPath(); c.moveTo(x, y0); c.lineTo(x + dx * 0.9, y0 + dy); c.stroke(); }
    c.beginPath(); c.moveTo(x0, y1); c.lineTo(x0 + dx, y1 - 4); c.stroke();
    // back frame tubes (thicker than the mesh, behind the front frame)
    c.strokeStyle = 'rgba(205,214,226,0.95)'; c.lineWidth = 4.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0 + dx, y1 - 3); c.lineTo(x0 + dx, y0 + dy); c.lineTo(x1 + 4, y0 + dy); c.stroke();
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + dx, y0 + dy); c.stroke();
    // front mesh (as the classic net, slightly brighter, with the sway)
    c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 0.95;
    for (let x = x0 + 9; x < x1; x += 9) { c.beginPath(); for (let y = y0; y <= y1; y += 6) c.lineTo(x + off(x, y), y); c.stroke(); }
    for (let y = y0 + 9; y < y1; y += 9) { c.beginPath(); for (let x = x0; x <= x1; x += 6) c.lineTo(x, y + off(x, y) * 0.6); c.stroke(); }
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
    if (show.map && show.map.goal_style === 'deep') { // tube highlights + a dark rim on the far side (rounder, heavier frame look)
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(x0 - G.POST_W / 2 + 1.5, G.BAR_Y, 2, G.GROUND_Y - G.BAR_Y);
      c.fillStyle = 'rgba(60,70,85,0.45)'; c.fillRect(x0 + G.POST_W / 2 - 2, G.BAR_Y + 3, 2, G.GROUND_Y - G.BAR_Y - 3); c.fillRect(G.BAR_X0 + 3, G.BAR_BOTTOM - 1.6, G.BAR_X1 - G.BAR_X0 - 3, 1.6);
      c.fillStyle = 'rgba(255,255,255,0.95)'; c.fillRect(G.BAR_X0 + 2, G.BAR_TOP + 1, G.BAR_X1 - G.BAR_X0 - 2, 1.4);
    }
    c.restore();
  }

  // ---------- keeper ----------
  function drawKeeper(c, k) {
    const footY = k[0], cr = k[1], arms = k[2];
    const sk = G.keeperSkeleton(G.KEEPER_X, footY, cr, arms);
    const j = sk.joints, x = G.KEEPER_X;
    const KP = (show.map && show.map.keeper) || ['#f28a1c', '#c9690c'], KIT = KP[0], KIT_D = KP[1], SHORTS = '#2f3a4a', SKIN = '#e7b08a', GLOVE = '#f5f7fa', BOOT = '#1f242b';
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
    if (show.map && show.map.goal_style === 'deep') drawNetDeep(c, wob, t); else drawNet(c, wob);
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
    if (show.map && show.map.rain) { // light drizzle streaks (deterministic in time)
      c.strokeStyle = 'rgba(200,215,240,0.22)'; c.lineWidth = 1;
      for (let i = 0; i < 70; i++) { const h1 = hash(i * 17 + 5), h2 = hash(i * 29 + 9); const y = ((h2 * G.H + t * 520) % (G.H + 40)) - 20, x = (h1 * (G.W + 80) - t * 90 + 4000) % (G.W + 80) - 40; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 4, y + 14); c.stroke(); }
    }
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
    const label = m.league ? `${CN} · ${m.stage}` : m.leg === 'FINAL' ? `${CN} · FINAL` : `${CN} · ${m.stage} · ${m.leg}`;
    c.font = `700 15px ${FONT}`; const lw = c.measureText(label).width + 26;
    const maxLW = G.W / 2 - 270 - 16 - 12; // never reach the scoreboard
    if (lw <= maxLW) {
      c.fillStyle = 'rgba(8,20,38,0.72)'; rrect(c, 16, 14, lw, 30, 15); c.fill();
      text(c, label, 16 + lw / 2, 29.5, 15, '#ffffff');
    } else { // long stage names (QUARTER-FINAL n · LEG n): two lines
      const l1 = CN, l2 = m.league ? m.stage : m.leg === 'FINAL' ? 'FINAL' : `${m.stage} · ${m.leg}`;
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
    c.globalAlpha = a; text(c, `${show.teams.length} ${show.teams.every((x) => x.national) ? 'nations' : 'teams'} · two-legged ties · golden ball decides level ties`, G.W / 2, 286, 20, '#d6e4ff', 'center', 600); c.globalAlpha = 1;
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
      // P6: national teams show their ranking ("Ranked #3", FIFA rank when the standings list it); clubs keep the league-phase wording
      const sub = T.national ? `Ranked #${T.rank || i + 1}` : `${i + 1}${['st', 'nd', 'rd'][i] || 'th'} in the league phase`;
      text(c, sub, x + 90, y + ch / 2 + 17, 13, '#9fb6d6', 'left', 600);
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
    text(c, `${numTag(P)}${TM.name}`, cx - 100, y0 + 201, 24, '#c9dcff', 'left', 700);
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

  // ================= P7 §5/§6: Premier League matchweek screens + season finale =================
  // Plain text "PREMIER LEAGUE" only (our font + colours), never a competition logo. Player names appear only in
  // replay captions, Man of the Match, top scorers / Golden Boot screens (inside the video).
  const LG_ACC = '#2fd3c4', LG_PUR = '#7a5cff', LG_PANEL = 'rgba(8,20,38,0.92)';
  const FORM_COL = { W: '#2fbf71', D: '#9aa5b4', L: '#e5484d' };
  const ord = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)] || 'th');
  function lgZones() { return (show.league && show.league.zones) || []; }
  function zoneAtPos(pos) { return lgZones().find((z) => pos >= z.from && pos <= z.to) || null; }
  function crest(c, ti, x, y, r, a) { drawBall(c, x, y, r, 0, kitStyle(show.teams[ti]), a == null ? 1 : a); }
  function lgBG(c, lf, tint) {
    darkBG(c, lf);
    c.save(); c.scale(S, S);
    const g = c.createRadialGradient(G.W / 2, -80, 40, G.W / 2, -80, 760);
    g.addColorStop(0, hexA(tint || LG_PUR, 0.32)); g.addColorStop(1, hexA(tint || LG_PUR, 0));
    c.fillStyle = g; c.fillRect(0, 0, G.W, G.H);
    c.fillStyle = hexA(LG_ACC, 0.55); c.fillRect(0, 0, G.W, 3);
    c.restore();
  }
  function lgTitle(c, title, sub, a) {
    c.globalAlpha = a;
    const z = fitText(c, title, 1100, 36, 900); text(c, title, G.W / 2, 38, z, '#ffffff', 'center', 900);
    if (sub) text(c, sub, G.W / 2, 66, 15, LG_ACC, 'center', 700);
    c.globalAlpha = 1;
  }
  function formDots(c, form, x, y, r) {
    for (let i = 0; i < 5; i++) {
      const f = form[i], cx = x + i * (2 * r + 4);
      if (f) { c.fillStyle = FORM_COL[f]; c.beginPath(); c.arc(cx, y, r, 0, Math.PI * 2); c.fill(); text(c, f, cx, y + 0.5, r * 1.15, '#0b1a2e', 'center', 900); }
      else { c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 1.2; c.beginPath(); c.arc(cx, y, r - 0.6, 0, Math.PI * 2); c.stroke(); }
    }
  }
  function unpackRow(r) { return { ti: r[0], pos: r[1], p: r[2], w: r[3], d: r[4], l: r[5], gf: r[6], ga: r[7], gd: r[6] - r[7], pts: r[8], zone: r[9] }; }
  function gdTxt(gd) { return gd > 0 ? '+' + gd : String(gd); }
  // one table frame. rows: [{ ti, slot (0-based float), pos, p, w, d, l, gd, pts, hl, arrow, pulse, form, a, dx }]
  function drawTable(c, L, rows) {
    const C = L.cols, x = L.x, rh = L.rowH;
    c.fillStyle = 'rgba(8,20,38,0.88)'; rrect(c, x - 8, L.y - 30, L.w + 16, 20 * rh + 38, 12); c.fill();
    const hy = L.headY;
    c.globalAlpha = 0.85;
    text(c, '#', x + C.pos, hy, L.headFont, '#9fb6d6', 'center', 700); text(c, 'CLUB', x + C.name, hy, L.headFont, '#9fb6d6', 'left', 700);
    for (const k of ['p', 'w', 'd', 'l']) text(c, k.toUpperCase(), x + C[k], hy, L.headFont, '#9fb6d6', 'center', 700);
    text(c, 'GD', x + C.gd, hy, L.headFont, '#9fb6d6', 'center', 700); text(c, 'PTS', x + C.pts, hy, L.headFont, '#ffffff', 'center', 800);
    if (C.form) text(c, 'FORM', x + C.form + 44, hy, L.headFont, '#9fb6d6', 'center', 700);
    c.globalAlpha = 1;
    // positional zone stripes + faint row bands (fixed per position)
    for (let i = 0; i < 20; i++) {
      const y = L.y + i * rh, z = zoneAtPos(i + 1);
      if (i % 2 === 0) { c.fillStyle = 'rgba(255,255,255,0.035)'; c.fillRect(x, y, L.w, rh); }
      if (z) { c.fillStyle = z.colour; c.fillRect(x + C.stripe, y + 2, 5, rh - 4); }
      if (z && lgZones().some((q) => q.to === i + 1 && i < 19)) { c.fillStyle = hexA(z.colour, 0.55); c.fillRect(x, y + rh - 1, L.w, 1.2); }
    }
    const order = rows.slice().sort((a, b) => (a.hl ? 1 : 0) - (b.hl ? 1 : 0));
    for (const r of order) {
      const y = L.y + r.slot * rh, cy = y + rh / 2;
      c.save(); c.globalAlpha = r.a == null ? 1 : r.a; c.translate(r.dx || 0, 0);
      if (r.hl) { c.fillStyle = 'rgba(47,211,196,0.20)'; rrect(c, x + 7, y + 1, L.w - 9, rh - 2, 5); c.fill(); c.strokeStyle = hexA(LG_ACC, 0.8); c.lineWidth = 1.2; rrect(c, x + 7, y + 1, L.w - 9, rh - 2, 5); c.stroke(); }
      if (r.pulse) { c.fillStyle = hexA(r.pulse.colour, 0.42 * r.pulse.k); rrect(c, x + 7, y + 1, L.w - 9, rh - 2, 5); c.fill(); }
      const T = show.teams[r.ti];
      text(c, String(r.pos), x + C.pos, cy + 0.5, L.font, '#ffffff', 'center', 800);
      crest(c, r.ti, x + C.crest, cy, rh * 0.36);
      const nz = fitText(c, T.name, C.nameW, L.font, 700); text(c, T.name, x + C.name, cy + 0.5, nz, '#ffffff', 'left', 700);
      for (const k of ['p', 'w', 'd', 'l']) text(c, String(r[k]), x + C[k], cy + 0.5, L.font, '#d6e4ff', 'center', 600);
      text(c, gdTxt(r.gd), x + C.gd, cy + 0.5, L.font, '#d6e4ff', 'center', 600);
      text(c, String(r.pts), x + C.pts, cy + 0.5, L.font + 1, '#ffffff', 'center', 900);
      if (C.form && r.form) formDots(c, r.form, x + C.form, cy, 7.5);
      if (r.arrow) {
        const up = r.arrow.d < 0, ax = x + C.arrow, col = up ? '#2fbf71' : '#e5484d';
        c.globalAlpha *= r.arrow.a; c.fillStyle = col; c.beginPath();
        if (up) { c.moveTo(ax - 6, cy + 4); c.lineTo(ax + 6, cy + 4); c.lineTo(ax, cy - 5); } else { c.moveTo(ax - 6, cy - 4); c.lineTo(ax + 6, cy - 4); c.lineTo(ax, cy + 5); }
        c.closePath(); c.fill(); text(c, String(Math.abs(r.arrow.d)), ax + 16, cy + 0.5, 13, col, 'center', 800);
      }
      c.restore();
    }
  }
  function zoneLegend(c, y) {
    const Z = lgZones(); let w = 0; c.font = `700 14px ${FONT}`;
    const items = Z.map((z) => { const label = `${z.from}${z.to > z.from ? '–' + z.to : ''} ${z.label}`; const iw = c.measureText(label).width + 30; w += iw; return { z, label, iw }; });
    let x = G.W / 2 - w / 2;
    for (const it of items) { c.fillStyle = it.z.colour; rrect(c, x, y - 6, 14, 12, 3); c.fill(); text(c, it.label, x + 20, y, 14, '#d6e4ff', 'left', 700); x += it.iw; }
  }
  function fixturesGrid(c, list, t, y0, opts) {
    opts = opts || {};
    const cw = 560, ch = opts.ch || 74, gx = 24, gy = opts.gy || 12, x0 = (G.W - 2 * cw - gx) / 2;
    list.forEach((fx, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const u = easeOutBack((t - (opts.delay || 0.8) - i * 0.12) / 0.45); if (u <= 0) return;
      const x = x0 + col * (cw + gx), y = y0 + row * (ch + gy);
      c.save(); c.globalAlpha = clamp(u, 0, 1); c.translate(x + cw / 2, y + ch / 2); c.scale(0.88 + 0.12 * u, 0.88 + 0.12 * u); c.translate(-(x + cw / 2), -(y + ch / 2));
      c.fillStyle = 'rgba(255,255,255,0.075)'; rrect(c, x, y, cw, ch, 14); c.fill();
      teamBar(c, fx[0], x, y, 6, ch); teamBar(c, fx[1], x + cw - 6, y, 6, ch);
      const r = ch * 0.3, cy = y + ch / 2;
      crest(c, fx[0], x + 38, cy, r); crest(c, fx[1], x + cw - 38, cy, r);
      const nw = cw / 2 - 120;
      let z = fitText(c, show.teams[fx[0]].name, nw, 22, 800); text(c, show.teams[fx[0]].name, x + cw / 2 - 52, cy + 0.5, z, '#ffffff', 'right', 800);
      z = fitText(c, show.teams[fx[1]].name, nw, 22, 800); text(c, show.teams[fx[1]].name, x + cw / 2 + 52, cy + 0.5, z, '#ffffff', 'left', 800);
      if (fx.length >= 4) {
        c.fillStyle = '#ffffff'; rrect(c, x + cw / 2 - 42, cy - 18, 84, 36, 8); c.fill();
        text(c, `${fx[2]}–${fx[3]}`, x + cw / 2, cy + 1, 24, '#0b1a2e', 'center', 900);
        if (fx[2] !== fx[3]) { const wl = fx[2] > fx[3] ? 0 : 1; c.fillStyle = LG_ACC; c.fillRect(wl ? x + cw / 2 + 52 : x + cw / 2 - 52 - 40, cy + 14, 40, 2.5); }
      } else text(c, 'vs', x + cw / 2, cy + 1, 20, LG_ACC, 'center', 800);
      c.restore();
    });
  }
  const LG = {};
  LG.lgIntro = (c, seg, lf, g) => {
    lgBG(c, lf); const t = lf / FPS;
    c.save(); c.scale(S, S);
    const a = easeOut(t / 0.8);
    c.globalAlpha = a; text(c, show.league.display_name, G.W / 2, 74 - 24 * (1 - a), 66, '#ffffff', 'center', 900);
    text(c, `MATCHWEEK ${seg.week} · ${show.league.season}`, G.W / 2, 128, 24, LG_ACC, 'center', 800);
    text(c, 'Marble football simulation', G.W / 2, 158, 16, '#9fb6d6', 'center', 600); c.globalAlpha = 1;
    fixturesGrid(c, seg.fixtures, t, 190, { delay: 0.9 });
    c.restore(); fadeIn(lf, 10);
  };
  LG.lgNext = (c, seg, lf) => {
    lgBG(c, lf, LG_ACC); const t = lf / FPS;
    c.save(); c.scale(S, S);
    lgTitle(c, `NEXT UP · MATCHWEEK ${seg.week}`, `${show.league.display_name} · ${show.league.season} · coming next on the channel`, smooth(t / 0.4));
    if (seg.fixtures) fixturesGrid(c, seg.fixtures, t, 120, { delay: 0.4, ch: 66, gy: 10 });
    c.restore(); fadeIn(lf, 8);
    const segLen = seg.len / FPS; if (t > segLen - 0.8) { c.fillStyle = `rgba(0,0,0,${smooth((t - (segLen - 0.8)) / 0.8)})`; c.fillRect(0, 0, OUT_W, OUT_H); }
  };
  LG.lgResults = (c, seg, lf) => {
    lgBG(c, lf); const t = lf / FPS;
    c.save(); c.scale(S, S);
    lgTitle(c, `MATCHWEEK ${seg.week} · ALL RESULTS`, `${show.league.display_name} ${show.league.season} · simulated results`, smooth(t / 0.4));
    fixturesGrid(c, seg.results, t, 120, { delay: 0.3 });
    c.restore(); fadeIn(lf, 8);
  };
  LG.lgPre = (c, seg, lf) => {
    const m = show.matches[seg.match], fr = m.frames[0];
    drawScene(c, m, fr, { noCam: true, noFx: true }); drawHUD(c, m, fr);
    const a = smooth(lf / 8) * (1 - smooth((lf - seg.len + 8) / 8));
    c.save(); c.scale(S, S); c.globalAlpha = a;
    const x0 = G.W / 2 - 400, y0 = 196, w = 800, h = 260;
    c.fillStyle = 'rgba(8,20,38,0.95)'; rrect(c, x0, y0, w, h, 22); c.fill();
    c.fillStyle = LG_ACC; c.fillRect(x0 + 30, y0 + 52, w - 60, 2);
    text(c, `${show.league.display_name} · MATCHWEEK ${m.week} · MATCH ${seg.match + 1} OF ${show.matches.length}`, G.W / 2, y0 + 30, 17, '#9fc7ff', 'center', 800);
    [[m.ta, 0, x0 + 150], [m.tb, 1, x0 + w - 150]].forEach(([ti, k, cx]) => {
      crest(c, ti, cx, y0 + 112, 34);
      const nm = show.teams[ti].name, z = fitText(c, nm, 300, 30, 900); text(c, nm, cx, y0 + 168, z, '#ffffff', 'center', 900);
      const sub = seg.pos[k] ? `${ord(seg.pos[k])} · ${seg.pts[k]} pts` : 'Season opener';
      text(c, sub, cx, y0 + 198, 18, '#c9dcff', 'center', 700);
      formDots(c, seg.form[k], cx - 2 * 22, y0 + 228, 9);
    });
    text(c, 'vs', G.W / 2, y0 + 120, 30, LG_ACC, 'center', 900);
    text(c, 'KICK-OFF', G.W / 2, y0 + 160, 20, '#ffd84a', 'center', 800);
    text(c, 'last 5', G.W / 2, y0 + 228, 13, '#7f93b3', 'center', 700);
    c.restore(); fadeIn(lf, 8);
  };
  // animated live-table update after a match (rows slide, points count up, arrows, zone pulse)
  function tableAnimRows(seg, t) {
    const from = new Map(seg.from.map((r) => [r[0], unpackRow(r)])), to = seg.to.map(unpackRow);
    const u = smooth((t - 0.55) / 1.1), cu = clamp((t - 0.55) / 1.0, 0, 1);
    return to.map((tr) => {
      const fr = from.get(tr.ti), half = u >= 0.5 ? tr : fr;
      const moved = tr.pos - fr.pos, zoneChanged = fr.zone !== tr.zone;
      const pz = zoneChanged && t > 1.65 && t < 3.2 ? { colour: tr.zone >= 0 ? lgZones()[tr.zone].colour : '#ffffff', k: 0.5 + 0.5 * Math.sin((t - 1.65) * 9 - Math.PI / 2) } : null;
      return { ti: tr.ti, slot: lerp(fr.pos - 1, tr.pos - 1, u), pos: half.pos, p: half.p, w: half.w, d: half.d, l: half.l, gd: half.gd,
        pts: Math.round(lerp(fr.pts, tr.pts, cu)), hl: seg.focus.includes(tr.ti), arrow: moved && t > 1.5 ? { d: moved, a: smooth((t - 1.5) / 0.3) } : null, pulse: pz };
    });
  }
  LG.lgTable = (c, seg, lf) => {
    lgBG(c, lf); const t = lf / FPS, m = show.matches[seg.match];
    c.save(); c.scale(S, S);
    const a = smooth(t / 0.3);
    c.globalAlpha = a;
    // result card (left)
    const x0 = 34, y0 = 82, w = 420, h = 310;
    c.fillStyle = LG_PANEL; rrect(c, x0, y0, w, h, 18); c.fill();
    text(c, 'FULL TIME', x0 + w / 2, y0 + 30, 18, '#ffd84a', 'center', 900);
    text(c, `MATCHWEEK ${m.week} · MATCH ${seg.match + 1} OF ${show.matches.length}`, x0 + w / 2, y0 + 54, 13, '#9fc7ff', 'center', 700);
    crest(c, m.ta, x0 + 90, y0 + 120, 30); crest(c, m.tb, x0 + w - 90, y0 + 120, 30);
    c.fillStyle = '#ffffff'; rrect(c, x0 + w / 2 - 58, y0 + 94, 116, 54, 10); c.fill();
    text(c, `${m.score[0]}–${m.score[1]}`, x0 + w / 2, y0 + 122, 38, '#0b1a2e', 'center', 900);
    let z = fitText(c, show.teams[m.ta].name, 150, 20, 800); text(c, show.teams[m.ta].name, x0 + 92, y0 + 172, z, '#ffffff', 'center', 800);
    z = fitText(c, show.teams[m.tb].name, 150, 20, 800); text(c, show.teams[m.tb].name, x0 + w - 92, y0 + 172, z, '#ffffff', 'center', 800);
    const res = m.winnerSide ? `${show.teams[m.winnerSide === 'A' ? m.ta : m.tb].name} take 3 points` : 'Draw · a point each';
    z = fitText(c, res, w - 40, 19, 700); text(c, res, x0 + w / 2, y0 + 214, z, LG_ACC, 'center', 700);
    // position changes of the two clubs
    const fromPos = (ti) => seg.from.find((r) => r[0] === ti)[1], toPos = (ti) => seg.to.find((r) => r[0] === ti)[1];
    [m.ta, m.tb].forEach((ti, k) => {
      const f = fromPos(ti), tt = toPos(ti), y = y0 + 248 + k * 28;
      const s = `${show.teams[ti].short_name || show.teams[ti].name}: ${ord(f)} → ${ord(tt)}`;
      const col = tt < f ? '#2fbf71' : tt > f ? '#e5484d' : '#c9dcff';
      text(c, s, x0 + w / 2, y, fitText(c, s, w - 40, 16, 700), col, 'center', 700);
    });
    text(c, `${show.league.display_name} · LIVE TABLE`, 34, 46, 22, '#ffffff', 'left', 900);
    text(c, `matchweek ${m.week} in progress · ${seg.match + 1} of ${show.matches.length} matches played · simulation`, 34, 72, 14, LG_ACC, 'left', 700);
    c.globalAlpha = 1;
    const L = window.LEAGUE_LAYOUT.tableLayout('update');
    c.globalAlpha = a; drawTable(c, L, tableAnimRows(seg, t)); c.globalAlpha = 1;
    c.globalAlpha = a; zoneLegend(c, L.legendY + 8); c.globalAlpha = 1;
    c.restore(); fadeIn(lf, 6);
  };
  LG.lgTableFull = (c, seg, lf) => {
    lgBG(c, lf); const t = lf / FPS;
    c.save(); c.scale(S, S);
    lgTitle(c, `TABLE AFTER MATCHWEEK ${seg.week}`, `${show.league.display_name} · ${show.league.season} · simulation`, smooth(t / 0.4));
    const L = window.LEAGUE_LAYOUT.tableLayout('full');
    const rows = seg.rows.map(unpackRow).map((r, i) => { const u = easeOut((t - 0.3 - i * 0.05) / 0.4); return Object.assign(r, { slot: r.pos - 1, a: clamp(u, 0, 1), dx: 40 * (1 - clamp(u, 0, 1)), form: (seg.forms && seg.forms[i]) || '' }); });
    drawTable(c, L, rows);
    zoneLegend(c, L.legendY + 8);
    c.restore(); fadeIn(lf, 8);
  };
  LG.lgScorers = (c, seg, lf) => {
    lgBG(c, lf); const t = lf / FPS;
    c.save(); c.scale(S, S);
    lgTitle(c, 'TOP SCORERS', `after matchweek ${seg.week} · ${show.league.display_name} ${show.league.season}`, smooth(t / 0.4));
    const x0 = 250, w = 780, y0 = 140, rh = 92;
    seg.scorers.forEach((e, i) => {
      const u = easeOutBack((t - 0.4 - i * 0.18) / 0.45); if (u <= 0) return;
      const y = y0 + i * rh, T = show.teams[e.team], P = T.players[e.player];
      c.save(); c.globalAlpha = clamp(u, 0, 1); c.translate(60 * (1 - clamp(u, 0, 1)), 0);
      c.fillStyle = i === 0 ? 'rgba(255,216,74,0.16)' : 'rgba(255,255,255,0.07)'; rrect(c, x0, y, w, rh - 14, 14); c.fill();
      teamBar(c, e.team, x0, y, 7, rh - 14);
      text(c, String(i + 1), x0 + 42, y + 39, 30, i === 0 ? '#ffd84a' : '#ffffff', 'center', 900);
      crest(c, e.team, x0 + 106, y + 39, 26);
      const zn = fitText(c, P.name, 380, 28, 800); text(c, P.name, x0 + 150, y + 28, zn, '#ffffff', 'left', 800);
      text(c, T.name, x0 + 150, y + 56, 17, '#9fb6d6', 'left', 600);
      c.fillStyle = i === 0 ? '#ffd84a' : 'rgba(255,255,255,0.14)'; rrect(c, x0 + w - 150, y + 20, 124, 38, 10); c.fill();
      text(c, `${e.goals} GOAL${e.goals === 1 ? '' : 'S'}`, x0 + w - 88, y + 40, 18, i === 0 ? '#2a1a00' : '#ffffff', 'center', 900);
      c.restore();
    });
    c.restore(); fadeIn(lf, 8);
  };
  LG.lgGotwCard = (c, seg, lf) => {
    lgBG(c, lf, '#ffd84a'); const t = lf / FPS, m = show.matches[seg.match], gl = m.goals[seg.goal];
    const ti = gl.team === 'A' ? m.ta : m.tb, P = show.teams[ti].players[gl.player];
    c.save(); c.scale(S, S);
    const u = easeOutBack(t / 0.5);
    c.globalAlpha = clamp(u, 0, 1);
    c.save(); c.translate(G.W / 2, 250); c.scale(0.8 + 0.2 * clamp(u, 0, 1.1), 0.8 + 0.2 * clamp(u, 0, 1.1));
    text(c, 'GOAL OF THE WEEK', 0, 0, 72, '#ffd84a', 'center', 900); c.restore();
    crest(c, ti, G.W / 2, 370, 38);
    const nm = P.name, z = fitText(c, nm, 700, 40, 900); text(c, nm, G.W / 2, 445, z, '#ffffff', 'center', 900);
    const sub = `${show.teams[ti].name} · ${window.CLOCK.minuteLabel(m, gl.t, show.cfg.GAME_MIN_PER_SEC)} · ${show.teams[m.ta].name} ${m.score[0]}–${m.score[1]} ${show.teams[m.tb].name}`;
    text(c, sub, G.W / 2, 490, fitText(c, sub, 1000, 20, 700), '#c9dcff', 'center', 700);
    c.restore(); fadeIn(lf, 6);
  };
  LG.lgChampion = (c, seg, lf, g) => {
    const TM = show.teams[seg.team], t = lf / FPS;
    lgBG(c, lf, TM.primary);
    c.save(); c.scale(S, S);
    c.save(); c.translate(G.W / 2, 300); c.rotate(t * 0.18);
    for (let i = 0; i < 18; i++) { c.rotate(Math.PI / 9); c.fillStyle = i % 2 ? hexA(TM.primary, 0.12) : 'rgba(255,215,90,0.09)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-70, -900); c.lineTo(70, -900); c.closePath(); c.fill(); }
    c.restore();
    const u = easeOutBack((t - 0.2) / 0.7);
    crest(c, seg.team, G.W / 2, 300, 80 * clamp(u, 0, 1.1));
    const a = smooth((t - 0.8) / 0.5); c.globalAlpha = a;
    text(c, `${show.league.display_name} CHAMPIONS ${show.league.season}`, G.W / 2, 90, fitText(c, `${show.league.display_name} CHAMPIONS ${show.league.season}`, 1100, 38, 900), '#ffd84a', 'center', 900);
    const nm = TM.name.toUpperCase(); text(c, nm, G.W / 2, 450, fitText(c, nm, 1100, 74, 900), '#ffffff', 'center', 900);
    c.fillStyle = TM.primary; rrect(c, G.W / 2 - 180, 500, 180, 14, 5); c.fill(); c.fillStyle = TM.secondary; rrect(c, G.W / 2, 500, 180, 14, 5); c.fill();
    const rec = `${seg.pts} points · ${seg.rec[0]}W ${seg.rec[1]}D ${seg.rec[2]}L · ${seg.gap > 0 ? seg.gap + ' clear at the top' : 'on tie-breaks'}`;
    text(c, rec, G.W / 2, 556, fitText(c, rec, 1000, 24, 700), '#c9dcff', 'center', 700);
    c.globalAlpha = 1; c.restore(); fadeIn(lf, 8);
  };
  LG.lgEurope = (c, seg, lf) => {
    lgBG(c, lf); const t = lf / FPS;
    c.save(); c.scale(S, S);
    lgTitle(c, 'EUROPEAN PLACES AND RELEGATION', `${show.league.display_name} ${show.league.season} · final table`, smooth(t / 0.4));
    const rows = seg.rows.map(unpackRow);
    const boxes = [[0, 60, 120, 560, 500], [1, 660, 120, 560, 220], [2, 660, 360, 560, 120], [3, 660, 500, 560, 170]];
    lgZones().slice(0, 4).forEach((z, zi) => {
      const b = boxes[zi]; if (!b) return;
      const [, x, y, w, h] = b, u = easeOut((t - 0.3 - zi * 0.25) / 0.5); if (u <= 0) return;
      c.save(); c.globalAlpha = u;
      c.fillStyle = 'rgba(8,20,38,0.9)'; rrect(c, x, y, w, h, 14); c.fill(); c.fillStyle = z.colour; rrect(c, x, y, w, 8, 4); c.fill();
      text(c, z.label.toUpperCase(), x + 22, y + 32, 20, z.colour === '#D8343B' ? '#ff8a8f' : '#ffffff', 'left', 900);
      const list = rows.filter((r) => r.pos >= z.from && r.pos <= z.to);
      const step = Math.min(78, (h - 50) / Math.max(1, list.length));
      list.forEach((r, k) => {
        const yy = y + 52 + k * step + step / 2;
        text(c, String(r.pos), x + 34, yy, 20, '#ffffff', 'center', 800); crest(c, r.ti, x + 76, yy, Math.min(20, step * 0.36));
        const nm = show.teams[r.ti].name; text(c, nm, x + 106, yy, fitText(c, nm, 300, 22, 800), '#ffffff', 'left', 800);
        text(c, `${r.pts} pts`, x + w - 26, yy, 18, '#c9dcff', 'right', 700);
      });
      c.restore();
    });
    c.restore(); fadeIn(lf, 8);
  };
  function drawBoot(c, x, y, s) { // original golden boot (stylised football boot, not a copy of any real award)
    c.save(); c.translate(x, y); c.scale(s, s);
    const gold = c.createLinearGradient(-90, -60, 90, 60); gold.addColorStop(0, '#fff0a8'); gold.addColorStop(0.45, '#ffcc33'); gold.addColorStop(1, '#a87406');
    c.fillStyle = gold; c.beginPath();
    c.moveTo(-70, -70); c.lineTo(-20, -70); c.lineTo(-14, -12); c.quadraticCurveTo(40, -8, 86, 14); c.quadraticCurveTo(100, 22, 92, 40); c.lineTo(-74, 40); c.quadraticCurveTo(-84, 0, -70, -70); c.closePath(); c.fill();
    c.strokeStyle = '#a87406'; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#7a5406'; for (let i = 0; i < 5; i++) c.fillRect(-60 + i * 30, 40, 10, 10);
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 2.5; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-44 + i * 12, -40 + i * 7); c.lineTo(-12 + i * 12, -34 + i * 7); c.stroke(); }
    c.fillStyle = '#3a2b1a'; rrect(c, -80, 56, 180, 26, 6); c.fill();
    c.restore();
  }
  LG.lgBoot = (c, seg, lf) => {
    lgBG(c, lf, '#ffd84a'); const t = lf / FPS;
    c.save(); c.scale(S, S);
    lgTitle(c, 'GOLDEN BOOT', `top scorer · ${show.league.display_name} ${show.league.season}`, smooth(t / 0.4));
    const u = easeOutBack((t - 0.2) / 0.6);
    drawBoot(c, 380, 360, 1.6 * clamp(u, 0, 1.1));
    const e = seg.scorer;
    if (e) {
      const T = show.teams[e.team], P = T.players[e.player], a = smooth((t - 0.8) / 0.5);
      c.globalAlpha = a;
      crest(c, e.team, 820, 270, 40);
      text(c, P.name, 820, 350, fitText(c, P.name, 600, 52, 900), '#ffffff', 'center', 900);
      text(c, T.name, 820, 400, 24, '#c9dcff', 'center', 700);
      c.fillStyle = '#ffd84a'; rrect(c, 720, 430, 200, 50, 12); c.fill();
      text(c, `${e.goals} GOALS`, 820, 456, 26, '#2a1a00', 'center', 900);
      c.globalAlpha = 1;
    }
    c.restore(); fadeIn(lf, 8);
  };
  LG.lgPodium = (c, seg, lf) => {
    lgBG(c, lf); const t = lf / FPS;
    c.save(); c.scale(S, S);
    lgTitle(c, 'FINAL PODIUM', `${show.league.display_name} ${show.league.season}`, smooth(t / 0.4));
    const base = 640, spots = [{ k: 1, dx: -300, h: 200, col: '#c9d3de', d: 0.35 }, { k: 0, dx: 0, h: 280, col: '#ffd84a', d: 0.1 }, { k: 2, dx: 300, h: 150, col: '#d99a62', d: 0.6 }];
    for (const sp of spots) {
      const e = seg.top[sp.k]; if (!e) continue;
      const x = G.W / 2 + sp.dx, k = easeOut((t - 0.4 - sp.d) / 0.6), h = sp.h * k;
      const pg = c.createLinearGradient(0, base - h, 0, base); pg.addColorStop(0, mixHex(sp.col, '#ffffff', 0.15)); pg.addColorStop(1, mixHex(sp.col, '#1a2433', 0.45));
      c.fillStyle = pg; rrect(c, x - 120, base - h, 240, h, 10); c.fill();
      if (k > 0.5) { c.globalAlpha = smooth((k - 0.5) / 0.5); text(c, String(sp.k + 1), x, base - h + 50, 56, 'rgba(20,30,45,0.85)', 'center', 900); c.globalAlpha = 1; }
      const ea = smooth((t - 1.2 - sp.d) / 0.5); if (ea <= 0) continue;
      c.save(); c.globalAlpha = ea; c.translate(0, 18 * (1 - ea));
      const top = base - sp.h;
      crest(c, e[0], x, top - 110, 42);
      const nm = show.teams[e[0]].name; text(c, nm, x, top - 50, fitText(c, nm, 260, 26, 900), '#ffffff', 'center', 900);
      text(c, `${e[1]} pts`, x, top - 22, 18, '#c9dcff', 'center', 700);
      c.restore();
    }
    c.restore(); fadeIn(lf, 8);
  };
  LG.lgStats = (c, seg, lf) => {
    lgBG(c, lf); const t = lf / FPS, s = seg.stats, nm = (ti) => show.teams[ti].name;
    c.save(); c.scale(S, S);
    lgTitle(c, 'SEASON IN NUMBERS', `${show.league.display_name} ${show.league.season} · ${s.matches} simulated matches`, smooth(t / 0.4));
    const tiles = [
      ['GOALS', String(s.goals), `${s.perMatch} per match`], ['DRAWS', String(s.draws), `${Math.round(100 * s.draws / s.matches)} % of matches`],
      ['HOME / AWAY WINS', `${s.homeWins} / ${s.awayWins}`, 'home advantage in the model'], ['BEST ATTACK', nm(s.bestAttack[0]), `${s.bestAttack[1]} goals scored`],
      ['BEST DEFENCE', nm(s.bestDefence[0]), `${s.bestDefence[1]} goals conceded`], ['HIGHEST SCORING', `${nm(s.biggest[0])} ${s.biggest[2]}–${s.biggest[3]} ${nm(s.biggest[1])}`, 'most goals in one match'],
    ];
    tiles.forEach((tl, i) => {
      const col = i % 3, row = Math.floor(i / 3), w = 360, h = 200, x = 70 + col * (w + 25), y = 150 + row * (h + 30);
      const u = easeOutBack((t - 0.3 - i * 0.15) / 0.45); if (u <= 0) return;
      c.save(); c.globalAlpha = clamp(u, 0, 1);
      c.fillStyle = 'rgba(255,255,255,0.075)'; rrect(c, x, y, w, h, 16); c.fill(); c.fillStyle = LG_ACC; c.fillRect(x + 24, y + 22, 40, 3);
      text(c, tl[0], x + 24, y + 48, 16, '#9fc7ff', 'left', 800);
      text(c, tl[1], x + w / 2, y + 110, fitText(c, tl[1], w - 40, 40, 900), '#ffffff', 'center', 900);
      text(c, tl[2], x + w / 2, y + 160, fitText(c, tl[2], w - 40, 17, 600), '#c9dcff', 'center', 600);
      c.restore();
    });
    c.restore(); fadeIn(lf, 8);
    const segLen = seg.len / FPS; if (t > segLen - 1.0) { c.fillStyle = `rgba(0,0,0,${smooth((t - (segLen - 1.0)) / 1.0)})`; c.fillRect(0, 0, OUT_W, OUT_H); }
  };

  // ---------- season finale: trophy ceremony, 3 camera angles (wide stadium / low-angle lift / top-down orbit) ----------
  let cerBg = null;
  function ceremonyBackdrop() { // stadium for the wide shot: Max's image (plain cover-fit) or the procedural bowl
    if (cerBg) return cerBg;
    cerBg = document.createElement('canvas'); cerBg.width = G.W * 2; cerBg.height = G.H * 2;
    const c = cerBg.getContext('2d'); c.scale(2, 2);
    if (bgImg) { const F = window.BGFIT.bgFit(bgImg.naturalWidth, bgImg.naturalHeight, G.W, G.H, {}); c.drawImage(bgImg, F.dx, F.dy, F.dw, F.dh); }
    else { const MAP = show.map; const sky = c.createLinearGradient(0, 0, 0, G.H); sky.addColorStop(0, MAP.sky[0]); sky.addColorStop(0.55, MAP.sky[1]); sky.addColorStop(1, MAP.sky[2]); c.fillStyle = sky; c.fillRect(0, 0, G.W, G.H); drawBowl(c, Object.assign({}, MAP, { center_screen_rect: MAP.center_screen_rect || [530, 250, 220, 62] })); }
    return cerBg;
  }
  function fireworks(c, t, cols, region, n) {
    for (let k = 0; k < n; k++) {
      const t0 = 0.3 + k * 0.62 + hash(k * 13 + 2) * 0.3, tt = t - t0; if (tt < 0 || tt > 2.0) continue;
      const cx = region[0] + hash(k * 7 + 1) * region[2], cy = region[1] + hash(k * 11 + 3) * region[3], col = cols[k % cols.length];
      if (tt < 0.35) { const u = tt / 0.35; c.fillStyle = 'rgba(255,240,200,0.9)'; c.beginPath(); c.arc(cx, cy + 180 * (1 - u), 2.2, 0, Math.PI * 2); c.fill(); continue; }
      const u = (tt - 0.35) / 1.65, R = 90 * easeOut(u) + 10, a = 1 - u;
      if (u < 0.12) { const fl = c.createRadialGradient(cx, cy, 2, cx, cy, 120); fl.addColorStop(0, `rgba(255,255,255,${0.5 * (1 - u / 0.12)})`); fl.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = fl; c.fillRect(cx - 120, cy - 120, 240, 240); }
      for (let i = 0; i < 44; i++) {
        const ang = i / 44 * Math.PI * 2 + hash(k * 31 + i) * 0.1, sp = 0.75 + 0.25 * hash(k * 17 + i * 3);
        const x = cx + Math.cos(ang) * R * sp, y = cy + Math.sin(ang) * R * sp + 40 * u * u;
        c.strokeStyle = hexA(col, a * 0.5); c.lineWidth = 1.4; c.beginPath(); c.moveTo(x, y); c.lineTo(cx + Math.cos(ang) * R * sp * 0.82, cy + Math.sin(ang) * R * sp * 0.82 + 40 * u * u); c.stroke();
        c.fillStyle = hexA(i % 5 === 0 ? '#ffffff' : col, a); c.beginPath(); c.arc(x, y, 2.1, 0, Math.PI * 2); c.fill();
      }
    }
  }
  function confetti(c, t, cols, n, seed, opts) {
    opts = opts || {};
    for (let i = 0; i < n; i++) {
      const h1 = hash(i * 3 + seed), h2 = hash(i * 7 + 2 + seed), h3 = hash(i * 11 + 3 + seed);
      const tt = t - h1 * 2.5; if (tt < 0) continue;
      const x = h2 * G.W + Math.sin(tt * (1.5 + h3 * 2) + i) * 30, y = -20 + ((tt * (90 + h3 * 110)) % (G.H + 40));
      const sz = opts.big ? 2.2 : 1;
      c.save(); c.translate(x, y); c.rotate(tt * (3 + h1 * 5) + i); c.scale(1, Math.cos(tt * (4 + h2 * 4)));
      c.fillStyle = cols[i % cols.length]; c.globalAlpha = opts.alpha || 1; c.fillRect(-5 * sz, -3 * sz, 10 * sz, 6 * sz); c.restore();
    }
  }
  function cerShotAt(seg, t) { const sh = seg.shots || (show.ceremony && show.ceremony.shots); return sh.find((s) => t >= s.from && t < s.to) || sh[sh.length - 1]; }
  window.ceremonyAngleAt = (lf) => { const seg = show.segments.find((s) => s.type === 'ceremony'); return seg ? cerShotAt(seg, lf / FPS).angle : null; };
  LG.ceremony = (c, seg, lf) => {
    const t = lf / FPS, TM = show.teams[seg.team], sh = cerShotAt(seg, t), st = t - sh.from, dur = sh.to - sh.from;
    const cols = [TM.primary, TM.secondary, '#ffd84a', '#ffffff'];
    c.save(); c.scale(S, S);
    if (sh.angle === 'wide') {
      const z = 1 + 0.07 * (st / dur);
      c.save(); c.translate(G.W / 2, G.H * 0.6); c.scale(z, z); c.translate(-G.W / 2, -G.H * 0.6);
      c.drawImage(ceremonyBackdrop(), 0, 0, G.W, G.H);
      c.fillStyle = 'rgba(5,10,30,0.28)'; c.fillRect(0, 0, G.W, G.H); // dusk grade so the fireworks read
      for (let i = 0; i < 26; i++) { if (hash(i * 97 + lf * 13) > 0.5) continue; const x = hash(i * 5 + lf * 3) * G.W, y = 300 + hash(i * 9 + lf * 7) * 240; const g2 = c.createRadialGradient(x, y, 0, x, y, 7); g2.addColorStop(0, 'rgba(255,255,255,0.95)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g2; c.fillRect(x - 7, y - 7, 14, 14); } // camera flashes in the stands
      fireworks(c, st, cols, [80, 40, G.W - 160, 220], 16);
      // stage on the pitch with the champion's three balls and the trophy
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(G.W / 2, 664, 190, 30, 0, 0, Math.PI * 2); c.fill();
      const sg = c.createLinearGradient(0, 620, 0, 668); sg.addColorStop(0, '#2b2f45'); sg.addColorStop(1, '#151829');
      c.fillStyle = sg; c.beginPath(); c.ellipse(G.W / 2, 640, 180, 26, 0, 0, Math.PI * 2); c.fill(); c.fillRect(G.W / 2 - 180, 640, 360, 18); c.beginPath(); c.ellipse(G.W / 2, 658, 180, 26, 0, 0, Math.PI); c.fill();
      c.strokeStyle = hexA(TM.primary, 0.9); c.lineWidth = 3; c.beginPath(); c.ellipse(G.W / 2, 640, 180, 26, 0, 0, Math.PI * 2); c.stroke();
      drawTrophy(c, G.W / 2, 578, 0.58, 1); // stands on the stage
      const tglow = c.createRadialGradient(G.W / 2, 545, 4, G.W / 2, 545, 90); tglow.addColorStop(0, `rgba(255,225,140,${0.35 + 0.1 * Math.sin(st * 3)})`); tglow.addColorStop(1, 'rgba(255,225,140,0)'); c.fillStyle = tglow; c.fillRect(G.W / 2 - 90, 455, 180, 180);
      [-130, 130].forEach((dx) => crest(c, seg.team, G.W / 2 + dx, 616, 24));
      c.restore();
      confetti(c, st, cols, 160, 11);
      const a = smooth((st - 0.8) / 0.5);
      c.globalAlpha = a; c.fillStyle = 'rgba(8,20,38,0.85)'; rrect(c, 60, 60, 560, 74, 12); c.fill(); teamBar(c, seg.team, 60, 60, 10, 74);
      text(c, `${show.league.display_name} CHAMPIONS ${show.league.season}`, 90, 84, 18, '#ffd84a', 'left', 900);
      text(c, TM.name, 90, 114, fitText(c, TM.name, 500, 30, 900), '#ffffff', 'left', 900); c.globalAlpha = 1;
    } else if (sh.angle === 'lift') {
      const bg = c.createRadialGradient(G.W / 2, 260, 20, G.W / 2, 300, 820); bg.addColorStop(0, mixHex(TM.primary, '#ffd84a', 0.35)); bg.addColorStop(0.45, mixHex(TM.primary, '#0b1020', 0.55)); bg.addColorStop(1, '#05070f');
      c.fillStyle = bg; c.fillRect(0, 0, G.W, G.H);
      const rise = easeOutBack(clamp(st / 2.4, 0, 1)), ty = lerp(680, 405, rise) + (st > 2.4 ? 6 * Math.sin((st - 2.4) * 2.2) : 0);
      c.save(); c.translate(G.W / 2, ty - 60); c.rotate(st * 0.25);
      for (let i = 0; i < 20; i++) { c.rotate(Math.PI / 10); c.fillStyle = `rgba(255,220,120,${0.06 + 0.03 * Math.sin(st * 3 + i)})`; c.beginPath(); c.moveTo(0, 0); c.lineTo(-50, -1000); c.lineTo(50, -1000); c.closePath(); c.fill(); }
      c.restore();
      const glow = c.createRadialGradient(G.W / 2, ty - 60, 10, G.W / 2, ty - 60, 300); glow.addColorStop(0, 'rgba(255,230,150,0.55)'); glow.addColorStop(1, 'rgba(255,230,150,0)'); c.fillStyle = glow; c.fillRect(0, 0, G.W, G.H);
      // low angle: trophy large, slightly stretched upwards, lifted by the champion's three balls
      c.save(); c.translate(G.W / 2, ty); c.scale(1, 1.1); drawTrophy(c, 0, -60, 2.05, 1); c.restore();
      [-104, 0, 104].forEach((dx, k) => crest(c, seg.team, G.W / 2 + dx, ty + 178 - (k === 1 ? 10 : 0), 48));
      for (let i = 0; i < 30; i++) { const a2 = hash(i * 19) * Math.PI * 2, r = 130 + hash(i * 23) * 160, tw = 0.5 + 0.5 * Math.sin(st * 6 + i * 1.7); const x = G.W / 2 + Math.cos(a2 + st * 0.3) * r, y = ty - 80 + Math.sin(a2 + st * 0.3) * r * 0.7; c.fillStyle = `rgba(255,245,200,${0.8 * tw})`; c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 1.6, y); c.lineTo(x, y + 6); c.lineTo(x - 1.6, y); c.closePath(); c.fill(); c.fillRect(x - 6, y - 0.8, 12, 1.6); }
      // crowd silhouettes in the foreground, scarves in the club colours
      for (let i = 0; i < 34; i++) { const x = i * 40 - 10 + hash(i) * 20, h = 70 + hash(i * 3) * 40, bob = 6 * Math.sin(st * 5 + i); c.fillStyle = '#04060c'; c.beginPath(); c.arc(x, G.H - h + bob, 15, 0, Math.PI * 2); c.fill(); rrect(c, x - 25, G.H - h + 17 + bob, 50, h + 20, 18); c.fill(); if (i % 4 === 1) { c.strokeStyle = '#04060c'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + 18, G.H - h + 26 + bob); c.lineTo(x + 30, G.H - h - 22 + bob * 1.5); c.stroke(); } if (i % 3 === 0) { c.strokeStyle = i % 2 ? TM.primary : TM.secondary; c.lineWidth = 7; c.beginPath(); c.moveTo(x - 30, G.H - h - 30 + bob); c.lineTo(x + 30, G.H - h - 46 + bob); c.stroke(); } }
      if (st > 2.3 && st < 2.9) { c.fillStyle = `rgba(255,255,255,${0.75 * (1 - (st - 2.3) / 0.6)})`; c.fillRect(0, 0, G.W, G.H); } // flash as the trophy goes up
      for (let k = 0; k < 6; k++) { const ft = 3 + k * 1.1; if (st > ft && st < ft + 0.12) { c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(0, 0, G.W, G.H); } }
      confetti(c, st, cols, 70, 23, { big: true, alpha: 0.9 });
      const a = smooth((st - 3.0) / 0.5); c.globalAlpha = a;
      const tbg = c.createLinearGradient(0, 0, 0, 110); tbg.addColorStop(0, 'rgba(4,6,12,0.75)'); tbg.addColorStop(1, 'rgba(4,6,12,0)'); c.fillStyle = tbg; c.fillRect(0, 0, G.W, 110);
      const ttl = `${TM.name.toUpperCase()} LIFT THE TROPHY`; text(c, ttl, G.W / 2, 48, fitText(c, ttl, 1100, 36, 900), '#ffffff', 'center', 900); c.globalAlpha = 1;
    } else { // orbit: top-down stadium rotating slowly around the centre
      c.fillStyle = '#05070f'; c.fillRect(0, 0, G.W, G.H);
      const ang = st * 0.11, z = 1 + 0.06 * (st / dur);
      c.save(); c.translate(G.W / 2, G.H / 2); c.scale(z, z); c.rotate(ang);
      const RX = 560, RY = 400;
      c.fillStyle = '#20263d'; c.beginPath(); c.ellipse(0, 0, RX, RY, 0, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 2600; i++) { const a2 = hash(i * 7 + 1) * Math.PI * 2, rr = 0.66 + hash(i * 13 + 5) * 0.32; const hc = hash(i * 3); c.fillStyle = hc < 0.35 ? TM.primary : hc < 0.6 ? TM.secondary : hc < 0.8 ? '#d6dbe8' : '#3a3f5c'; c.fillRect(Math.cos(a2) * RX * rr, Math.sin(a2) * RY * rr, 3, 3); }
      c.fillStyle = '#3c9a34'; c.fillRect(-330, -215, 660, 430);
      for (let i = 0; i < 11; i += 2) { c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(-330 + i * 60, -215, 60, 430); }
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 2.5; c.strokeRect(-330, -215, 660, 430); c.beginPath(); c.moveTo(0, -215); c.lineTo(0, 215); c.stroke(); c.beginPath(); c.arc(0, 0, 70, 0, Math.PI * 2); c.stroke();
      c.strokeRect(-330, -90, 70, 180); c.strokeRect(260, -90, 70, 180);
      // waving flags around the ring in the club colours
      for (let i = 0; i < 24; i++) { const a2 = i / 24 * Math.PI * 2, fx = Math.cos(a2) * RX * 0.62, fy = Math.sin(a2) * RY * 0.62; c.save(); c.translate(fx, fy); c.rotate(a2 + Math.PI / 2); c.fillStyle = i % 2 ? TM.primary : TM.secondary; c.beginPath(); c.moveTo(0, 0); for (let q = 0; q <= 6; q++) c.lineTo(q * 6, -2 + 4 * Math.sin(st * 6 + q * 0.9 + i)); for (let q = 6; q >= 0; q--) c.lineTo(q * 6, 18 + 4 * Math.sin(st * 6 + q * 0.9 + i + 0.4)); c.closePath(); c.fill(); c.fillStyle = '#ddd'; c.fillRect(-1.5, -4, 3, 26); c.restore(); }
      // champion balls in a circle + trophy seen from above
      for (let k = 0; k < 6; k++) { const a2 = k / 6 * Math.PI * 2 - ang * 2; crest(c, seg.team, Math.cos(a2) * 120, Math.sin(a2) * 120, 26); }
      const tg = c.createRadialGradient(-10, -10, 4, 0, 0, 46); tg.addColorStop(0, '#fff3b0'); tg.addColorStop(0.6, '#ffcc33'); tg.addColorStop(1, '#a87406');
      c.fillStyle = tg; c.beginPath(); c.arc(0, 0, 44, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#d9a520'; c.lineWidth = 9; c.beginPath(); c.arc(-58, 0, 16, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(58, 0, 16, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#fff6d0'; c.beginPath(); for (let i = 0; i < 10; i++) { const a3 = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 8 : 19; c.lineTo(Math.cos(a3) * r, Math.sin(a3) * r); } c.closePath(); c.fill();
      // confetti swirl
      for (let i = 0; i < 260; i++) { const a2 = hash(i * 5) * Math.PI * 2 + st * (0.6 + hash(i) * 0.6), rr = 40 + ((hash(i * 9) * 500 + st * 60) % 520); c.save(); c.translate(Math.cos(a2) * rr, Math.sin(a2) * rr * 0.75); c.rotate(st * 4 + i); c.fillStyle = cols[i % cols.length]; c.fillRect(-4, -2.5, 8, 5); c.restore(); }
      c.restore();
      const vg = c.createRadialGradient(G.W / 2, G.H / 2, 260, G.W / 2, G.H / 2, 760); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.65)'); c.fillStyle = vg; c.fillRect(0, 0, G.W, G.H);
      const a = smooth((st - 0.6) / 0.5); c.globalAlpha = a;
      c.fillStyle = 'rgba(8,20,38,0.85)'; rrect(c, G.W / 2 - 330, G.H - 104, 660, 70, 14); c.fill();
      text(c, `CHAMPIONS · ${TM.name.toUpperCase()}`, G.W / 2, G.H - 69, fitText(c, `CHAMPIONS · ${TM.name.toUpperCase()}`, 620, 30, 900), '#ffd84a', 'center', 900); c.globalAlpha = 1;
    }
    // cut between angles: short white flash (0.3 s on both sides of the cut)
    const cuts = (seg.shots || []).slice(1).map((s) => s.from);
    for (const ct of cuts) { const d = Math.abs(t - ct); if (d < 0.3) { c.fillStyle = `rgba(255,255,255,${0.85 * (1 - d / 0.3)})`; c.fillRect(0, 0, G.W, G.H); } }
    c.restore(); fadeIn(lf, 10);
  };
  window.LEAGUE_SEGMENTS = Object.keys(LG);

  // ---------- main entry ----------
  // small SIMULATION label: only if rules.show_simulation_label is true (P5: default off)
  const simLabelOn = () => !!(show && show.cfg && show.cfg.SHOW_SIM_LABEL);
  function simLabel() {
    if (!simLabelOn()) return;
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
    if (LG[seg.type]) { LG[seg.type](ctx, seg, lf, g); return; } // P7 league screens + finale
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
      if (m.league) { // P7: league result flash (draws allowed)
        lines.push({ s: m.winnerSide ? `${teamName(m.winnerSide === 'A' ? m.ta : m.tb)} win` : 'Draw', size: 26, w: 700, color: '#ffd84a' });
        lines.push({ s: `${show.league.display_name} · ${m.stage}`, size: 20, w: 600, color: '#c9dcff' });
      } else if (m.leg === 'LEG 2') {
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
      text(ctx, seg.gotw ? 'GOAL OF THE WEEK' : 'SLOW MOTION', G.W - 30, 23, 16, seg.gotw ? '#ffd84a' : '#bbbbbb', 'right', 700);
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
      text(ctx, `${numTag(P)}${teamName(ti)}${gl.golden ? ' · GOLDEN GOAL' : ''}`, bx + 32, by + 64, 18, '#9fc7ff', 'left', 700);
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
    bgImg = null;
    buildBackground();
    for (const k of Object.keys(styleCache)) delete styleCache[k];
    const L = show.logos || {};
    const bgP = show.background && show.background.src ? new Promise((res) => { const im = new Image(); im.onload = () => { bgImg = im; buildBackground(); res(); }; im.onerror = () => res(); im.src = show.background.src; }) : Promise.resolve();
    return bgP.then(() => Promise.all(Object.keys(L).map((id) => new Promise((res) => {
      const im = new Image(); im.onload = () => { logoImgs[id] = im; res(); }; im.onerror = () => res(); im.src = L[id];
    }))).then(() => {
      // P7: club without a crest file (assets/logos/MISSING.md) -> fallback decal: its 3-letter code on a disc in the
      // club's primary colour (outline + text in a contrasting kit colour); the ball, its size and its ring are unchanged.
      if (show.logosOnBalls && show.fallbackDecals !== false) for (const t of show.teams || []) {
        if (logoImgs[t.id] || t.national) continue;
        const S = 192, cv = document.createElement('canvas'); cv.width = S; cv.height = S; const g = cv.getContext('2d');
        const light = lum(t.primary) > 0.8, fg = light ? (lum(t.secondary) > 0.6 ? '#1F2A38' : t.secondary) : (Math.abs(lum(t.secondary) - lum(t.primary)) > 0.35 ? t.secondary : (lum(t.primary) > 0.5 ? '#14202E' : '#FFFFFF'));
        g.beginPath(); g.arc(S / 2, S / 2, S * 0.47, 0, Math.PI * 2); g.fillStyle = t.primary; g.fill();
        g.lineWidth = S * 0.05; g.strokeStyle = fg; g.beginPath(); g.arc(S / 2, S / 2, S * 0.43, 0, Math.PI * 2); g.stroke();
        g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${Math.round(S * 0.34)}px "Arial Black", Arial, sans-serif`;
        g.fillText(String(t.short || t.name.slice(0, 3)).toUpperCase().slice(0, 3), S / 2, S / 2 + S * 0.02, S * 0.78);
        logoImgs[t.id] = cv; logoImgs[t.id].fallback = true;
      }
      return { total: show.totalFrames, logos: Object.keys(logoImgs).length, background: !!bgImg };
    }));
  };
  // P7 §7b test hooks: background layer order and the cover-fit actually used
  window.bgLayerInfo = () => ({ image: !!bgImg, layers: bgLayers.slice(), fit: bgImg ? bgFitInfo() : null, imgSize: bgImg ? [bgImg.naturalWidth, bgImg.naturalHeight] : null });
  window.fallbackDecalOf = (id) => (logoImgs[id] && logoImgs[id].fallback ? logoImgs[id].toDataURL('image/png') : null);
  window.renderFrame = renderFrame;

  // ================= P6: vertical reel (1080x1920, design space 720x1280) =================
  // The whole 16:9 scene scaled to the full width (720x405 design = 1080x608 px) in the middle band, STATIC camera
  // (no pan, no zoom, no crop: windmill/spout side and goal side always visible). Above: big scoreboard; below:
  // goal/scorer caption, comeback badge, info strip. Background: the map scene, extended and softly blurred (cached).
  // Key text stays inside SAFE (out of the bottom 25 % and the right 12 %: YouTube Shorts overlays, approximate).
  const RW = 720, RH = 1280, FIELD = { x: 0, y: 400, w: 720, h: 405 };
  const SAFE = { x0: 40, x1: Math.floor(RW * 0.88) - 4, y0: 100, y1: Math.floor(RH * 0.75) - 4 };
  let reel = null, RS = 1.5, reelBgCanvas = null, boxes = [];
  window.initReel = function (r) {
    reel = r; RS = OUT_W / RW; reelBgCanvas = null;
    window.REEL_LAYOUT = { RW, RH, FIELD, SAFE, RS };
    return { frames: reel.totalFrames };
  };
  const box = (name, x, y, w, h) => boxes.push({ name, x, y, w, h });
  function reelSeg(k) { let s = reel.segments[0]; for (const x of reel.segments) if (x.start <= k) s = x; return s; }
  // scene rectangle in output pixels: constant for every frame of the reel (asserted by the tests)
  function sceneRect() { return { x: FIELD.x * RS, y: FIELD.y * RS, w: FIELD.w * RS, h: FIELD.h * RS }; }
  function fieldScene(c, m, fr, opts) {
    const s = FIELD.w / G.W; // full scene width -> full canvas width
    c.save(); c.scale(RS, RS);
    c.beginPath(); c.rect(FIELD.x, FIELD.y, FIELD.w, FIELD.h); c.clip();
    c.translate(FIELD.x, FIELD.y); c.scale(s / S, s / S);
    drawScene(c, m, fr, Object.assign({ noCam: true }, opts)); // noCam: the slow-motion zoom track is ignored in reels
    c.restore();
    window.__reelSceneRect = sceneRect();
  }
  function reelBG(c, m) {
    if (!reelBgCanvas) { // the map scene (first frame) scaled to cover the canvas, blurred and darkened; drawn once per reel
      reelBgCanvas = document.createElement('canvas'); reelBgCanvas.width = OUT_W; reelBgCanvas.height = OUT_H;
      const b = reelBgCanvas.getContext('2d');
      const cover = (RH * RS) / (G.H * S);
      b.save(); b.filter = 'blur(22px)';
      b.translate(OUT_W / 2 - (G.W * S * cover) / 2, 0); b.scale(cover, cover);
      drawScene(b, m, m.frames[0], { noCam: true, trail: false, noFx: true, frameIndex: 0 });
      b.restore(); b.filter = 'none';
      const g = b.createLinearGradient(0, 0, 0, OUT_H);
      g.addColorStop(0, 'rgba(6,14,28,0.62)'); g.addColorStop(0.5, 'rgba(6,14,28,0.40)'); g.addColorStop(1, 'rgba(6,14,28,0.70)');
      b.fillStyle = g; b.fillRect(0, 0, OUT_W, OUT_H);
    }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(reelBgCanvas, 0, 0); c.restore();
  }
  function reelHeader(c) {
    const label = `${show.competition.name}`;
    const z = fitText(c, label, SAFE.x1 - SAFE.x0, 30, 900);
    text(c, label, (SAFE.x0 + SAFE.x1) / 2, 136, z, '#ffffff', 'center', 900); box('competition', SAFE.x0, 118, SAFE.x1 - SAFE.x0, 36);
  }
  function reelScoreboard(c, m, sc, clock, extra) {
    const x = SAFE.x0, y = 168, w = SAFE.x1 - SAFE.x0, h = 210, cx = x + w / 2;
    c.fillStyle = 'rgba(8,20,38,0.92)'; rrect(c, x, y, w, h, 22); c.fill(); box('scoreboard', x, y, w, h);
    const L = x + 22, R = x + w - 22;
    kitDot(c, m.kits.A, L + 10, y + 36, 10); kitDot(c, m.kits.B, R - 10, y + 36, 10);
    let z = fitText(c, teamName(m.ta), w / 2 - 50, 28, 800); text(c, teamName(m.ta), L + 28, y + 37, z, '#ffffff', 'left', 800);
    z = fitText(c, teamName(m.tb), w / 2 - 50, 28, 800); text(c, teamName(m.tb), R - 28, y + 37, z, '#ffffff', 'right', 800);
    c.fillStyle = '#ffffff'; rrect(c, cx - 125, y + 64, 250, 92, 16); c.fill();
    text(c, `${sc[0]} – ${sc[1]}`, cx, y + 112, 78, '#0b1a2e', 'center', 900);
    c.fillStyle = 'rgba(255,255,255,0.12)'; rrect(c, L, y + 88, 104, 44, 12); c.fill();
    text(c, clock, L + 52, y + 111, fitText(c, clock, 94, 28), '#ffffff', 'center', 800);
    const legTxt = m.league ? 'LEAGUE' : m.leg === 'FINAL' ? 'FINAL' : m.leg;
    text(c, legTxt, R - 52, y + 100, 20, '#c9dcff', 'center', 800);
    if (m.leg === 'LEG 2') text(c, `AGG ${m.prev[0] + sc[0]}–${m.prev[1] + sc[1]}`, R - 52, y + 126, 19, '#ffd84a', 'center', 800);
    const st = (m.stage || '').toUpperCase();
    text(c, st, cx, y + 182, fitText(c, st, w - 40, 18, 800), '#9fb6d6', 'center', 800);
    if (extra) text(c, extra, cx, y + h + 8, 16, '#ffd84a', 'center', 800);
  }
  // below the field: info strip (always) + comeback badge (once the winner has come from behind)
  function reelInfo(c, m, comebackNow) {
    const y = 905, x = SAFE.x0, w = SAFE.x1 - SAFE.x0;
    c.fillStyle = 'rgba(8,20,38,0.80)'; rrect(c, x, y, w, 46, 12); c.fill(); box('info', x, y, w, 46);
    const t = m.league ? `${m.stage.toLowerCase().replace(/^m/, 'M')} · ${show.league.season} · computer simulation` : `${(m.roundName || m.stage)} · ${m.leg === 'FINAL' ? 'final' : m.leg.toLowerCase()} · computer simulation`;
    text(c, t, x + w / 2, y + 24, fitText(c, t, w - 30, 18, 700), '#c9dcff', 'center', 700);
    if (comebackNow) {
      const bw = 300, bx = x + w / 2 - bw / 2, by = 856;
      const bt = reel.comebackDepth >= 2 ? `COMEBACK FROM ${reel.comebackDepth} DOWN` : 'COMEBACK!';
      c.fillStyle = '#ffd84a'; rrect(c, bx, by, bw, 40, 20); c.fill(); box('comeback', bx, by, bw, 40);
      text(c, bt, x + w / 2, by + 21, fitText(c, bt, bw - 24, 20, 900), '#0b1a2e', 'center', 900);
    }
  }
  function reelSimLabel(c) {
    if (!simLabelOn()) return;
    c.font = `800 15px ${FONT}`; const w = c.measureText('SIMULATION').width + 22;
    c.fillStyle = 'rgba(8,20,38,0.78)'; rrect(c, SAFE.x0, FIELD.y + FIELD.h - 36, w, 26, 10); c.fill();
    text(c, 'SIMULATION', SAFE.x0 + w / 2, FIELD.y + FIELD.h - 22.5, 15, '#ffffff', 'center', 800);
  }
  // goal / scorer caption under the field (y 815..899); the comeback badge uses y 856..896 only when no caption is up
  function caption(c, title, sub, ti, a) {
    if (a <= 0.001) return;
    c.save(); c.globalAlpha = a;
    const x = SAFE.x0, y = 813, w = SAFE.x1 - SAFE.x0, h = 84;
    c.fillStyle = 'rgba(8,20,38,0.96)'; rrect(c, x, y, w, h, 14); c.fill(); box('caption', x, y, w, h);
    if (ti != null) teamBar(c, ti, x, y, 12, h);
    text(c, title, x + 30, y + 31, fitText(c, title, w - 50, 34, 900), '#ffffff', 'left', 900);
    if (sub) text(c, sub, x + 30, y + 66, fitText(c, sub, w - 50, 20, 700), '#9fc7ff', 'left', 700);
    c.restore();
  }
  function scoreAt(m, t) { let a = 0, b = 0; for (const g of m.goals) { if (g.t > t + 1e-9) break; if (g.team === 'A') a++; else b++; } return [a, b]; }
  window.renderReelFrame = function (k) {
    const seg = reelSeg(k), lf = k - seg.start, m = show.matches[reel.matchIndex];
    boxes = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    reelBG(ctx, m);
    ctx.save(); ctx.scale(RS, RS); reelHeader(ctx); ctx.restore();
    const CL = (t) => { const ck = clockText(m, t); return ck.main + (ck.plus && ck.phase !== 'shots' ? ` +${ck.plus}` : ''); };
    const XT = (t) => { const ck = clockText(m, t); return ck.golden ? 'GOLDEN BALL' : ck.phase === 'shots' ? `ADDED-TIME SHOT ${ck.shot}/${ck.added}` : ''; };
    const dg = m.goals[reel.decisive.goal];
    const finish = () => { window.REEL_BOXES = boxes.slice(); };
    if (seg.type === 'hook') {
      const fr = matchFrame(m, seg.src);
      fieldScene(ctx, m, fr, { frameIndex: seg.src, trail: false, noFx: true });
      ctx.save(); ctx.scale(RS, RS);
      reelScoreboard(ctx, m, seg.score, CL(fr.t));
      ctx.fillStyle = 'rgba(5,12,25,0.55)'; ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
      const p = easeOutBack(clamp(lf / 12, 0, 1)), cx = (SAFE.x0 + SAFE.x1) / 2;
      ctx.save(); ctx.translate(cx, FIELD.y + 190); ctx.scale(p, p);
      text(ctx, `${seg.score[0]} – ${seg.score[1]}`, 0, 0, 130, '#ffffff', 'center', 900);
      ctx.restore(); box('hook_score', cx - 160, FIELD.y + 125, 320, 130);
      const behind = reel.winnerSide === 'A' ? teamName(m.ta) : teamName(m.tb);
      const ht = seg.def > 0 ? `${behind} are behind…` : `${teamName(m.ta)} vs ${teamName(m.tb)}`;
      caption(ctx, ht, 'watch what happens next', null, 1);
      reelInfo(ctx, m, false);
      reelSimLabel(ctx); ctx.restore(); fadeIn(lf, 6); return finish();
    }
    if (seg.type === 'match') {
      const p = seg.plan[lf], fr = matchFrame(m, p.src), v = p.src / FPS;
      fieldScene(ctx, m, fr, { frameIndex: p.src, v, trailStep: p.ff ? 2 : 1 });
      ctx.save(); ctx.scale(RS, RS);
      reelScoreboard(ctx, m, fr.sc || scoreAt(m, fr.t), CL(fr.t), XT(fr.t));
      if (p.ff) { // fast-forward indicator (top-left of the field, away from the Shorts buttons on the right)
        ctx.fillStyle = 'rgba(8,20,38,0.85)'; rrect(ctx, SAFE.x0, FIELD.y + 10, 96, 36, 12); ctx.fill();
        text(ctx, p.ff > 1 ? `>> x${p.ff}` : '>> x2', SAFE.x0 + 48, FIELD.y + 28.5, 20, '#ffd84a', 'center', 900); box('ff', SAFE.x0, FIELD.y + 10, 96, 36);
      }
      const lg = lastEventBeforeV(m, 'goal', v);
      let capOn = false;
      if (lg && v - evV(lg) < 2.2) { // goal: team + minute only (no player names during play)
        const u = v - evV(lg), a = smooth(u / 0.15) * (1 - smooth((u - 1.9) / 0.3));
        const ti = lg.team === 'A' ? m.ta : m.tb; capOn = a > 0.001;
        caption(ctx, lg.golden ? 'GOLDEN GOAL!' : 'GOAL!', `${teamName(ti)} · ${window.CLOCK.minuteLabel(m, lg.t, show.cfg.GAME_MIN_PER_SEC)}`, ti, a);
      }
      reelInfo(ctx, m, !capOn && reel.comebackDepth > 0 && dg && fr.t >= dg.t);
      reelSimLabel(ctx); ctx.restore(); if (lf < 6) fadeIn(lf, 6); return finish();
    }
    if (seg.type === 'replay') {
      const at = frameAtTime(m, seg.t0 + (lf / FPS) * seg.speed);
      fieldScene(ctx, m, at.fr, { frameIndex: at.i, noFx: true });
      ctx.save(); ctx.scale(RS, RS);
      reelScoreboard(ctx, m, scoreAt(m, at.fr.t), CL(at.fr.t), XT(at.fr.t));
      ctx.fillStyle = 'rgba(5,8,13,0.88)'; rrect(ctx, SAFE.x0, FIELD.y + 10, 150, 36, 12); ctx.fill(); box('replay', SAFE.x0, FIELD.y + 10, 150, 36);
      if (Math.floor(lf / 15) % 2 === 0) { ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(SAFE.x0 + 20, FIELD.y + 28, 6, 0, Math.PI * 2); ctx.fill(); }
      text(ctx, 'REPLAY', SAFE.x0 + 34, FIELD.y + 29, 20, '#ffffff', 'left', 900);
      const gl = m.goals[seg.goal], ti = gl.team === 'A' ? m.ta : m.tb, P = show.teams[ti].players[gl.player];
      caption(ctx, `${P.name} · ${window.CLOCK.minuteLabel(m, gl.t, show.cfg.GAME_MIN_PER_SEC)}`, `${numTag(P)}${teamName(ti)} · decisive goal`, ti, Math.max(0.002, smooth((lf - 6) / 10)));
      reelInfo(ctx, m, false);
      reelSimLabel(ctx); ctx.restore(); fadeIn(lf, 6); return finish();
    }
    const last = m.frames[m.frames.length - 1];
    if (seg.type === 'motm') {
      fieldScene(ctx, m, last, { frameIndex: m.frames.length - 1, trail: false, noFx: true });
      ctx.save(); ctx.scale(RS, RS);
      reelScoreboard(ctx, m, m.score, 'FT');
      ctx.fillStyle = 'rgba(5,12,25,0.62)'; ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
      const mo = m.motm, ti = mo.team === 'A' ? m.ta : m.tb, TM = show.teams[ti], P = TM.players[mo.player];
      const a = smooth(lf / 8), x = SAFE.x0, w = SAFE.x1 - SAFE.x0, y = FIELD.y + 22, h = FIELD.h - 44, cx = x + w / 2;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(8,20,38,0.96)'; rrect(ctx, x, y, w, h, 22); ctx.fill(); box('motm', x, y, w, h);
      ctx.fillStyle = TM.primary; ctx.fillRect(x, y, w, 10);
      text(ctx, 'MAN OF THE MATCH', cx, y + 50, 28, '#ffd84a', 'center', 900);
      drawStarAward(ctx, cx, y + 140, 0.75);
      text(ctx, P.name, cx, y + 252, fitText(ctx, P.name, w - 60, 50, 900), '#ffffff', 'center', 900);
      text(ctx, `${numTag(P)}${TM.name}`, cx, y + 300, 24, '#c9dcff', 'center', 700);
      ctx.globalAlpha = 1;
      reelInfo(ctx, m, reel.comebackDepth > 0);
      reelSimLabel(ctx); ctx.restore(); return finish();
    }
    // end card
    fieldScene(ctx, m, last, { frameIndex: m.frames.length - 1, trail: false, noFx: true });
    ctx.save(); ctx.scale(RS, RS);
    reelScoreboard(ctx, m, m.score, 'FT');
    ctx.fillStyle = 'rgba(10,24,48,0.90)'; ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
    const a = smooth(lf / 10), cx = (SAFE.x0 + SAFE.x1) / 2, w = SAFE.x1 - SAFE.x0; ctx.globalAlpha = a;
    const wn = reel.winnerSide === 'A' ? teamName(m.ta) : reel.winnerSide === 'B' ? teamName(m.tb) : null;
    const head = m.league ? (wn ? `${wn} take the 3 points` : 'Honours even') : wn ? (m.leg === 'LEG 1' ? `${wn} win the first leg` : m.leg === 'FINAL' ? `${wn} win` : `${wn} go through`) : 'All square';
    text(ctx, head, cx, FIELD.y + 80, fitText(ctx, head, w, 40, 900), '#ffd84a', 'center', 900);
    text(ctx, 'Full simulation', cx, FIELD.y + 190, 54, '#ffffff', 'center', 900);
    text(ctx, 'on the channel', cx, FIELD.y + 255, 54, '#ffffff', 'center', 900);
    text(ctx, 'Computer simulation · not real results', cx, FIELD.y + 345, 21, '#9fb6d6', 'center', 700);
    box('end', SAFE.x0, FIELD.y + 50, w, 310);
    ctx.globalAlpha = 1;
    reelInfo(ctx, m, reel.comebackDepth > 0);
    reelSimLabel(ctx); ctx.restore(); return finish();
  };
  // P4 thumbnails: the play scene only (no HUD, no captions, no names, no text), zoomed on a goal moment
  window.renderThumb = function (matchIndex, t, zoom) {
    const m = show.matches[matchIndex];
    const at = frameAtTime(m, t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawScene(ctx, m, at.fr, { frameIndex: at.i, v: t, noCam: true, zoom: zoom || { z: 1.28, x: 1020, y: 440 } });
    return canvas.toDataURL('image/png');
  };
  window.grabReelFrame = function (k, q) { window.renderReelFrame(k); return canvas.toDataURL('image/jpeg', q || 0.92); };
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
