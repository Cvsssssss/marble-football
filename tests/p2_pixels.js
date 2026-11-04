'use strict';
// Pixel checks for P2 (called by tests/p2_tests.js): node tests/p2_pixels.js <show.json>  -> prints one JSON line
//  diam    : pixel diameter of a team-A ball and a team-B ball in rendered 1080p match frames (horizontal run through the centre)
//  decal   : mean colour difference at the ball centre, crest on vs off
//  oldLook : ball discs rendered with logos off by the current renderer vs the v2b renderer (git 23b3dde)
//  outside : pixel differences crest on vs off on screens without balls (bracket, round card, trophy half of the winner screen)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const show = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const S = 1.5;

function refRenderer() {
  const dir = path.join(ROOT, 'build', 'ref_render');
  fs.mkdirSync(dir, { recursive: true });
  const old = execFileSync('git', ['show', '23b3dde:render/draw.js'], { cwd: ROOT, maxBuffer: 1 << 24 }).toString();
  fs.writeFileSync(path.join(dir, 'draw_v2b.js'), old);
  fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000}</style></head><body><canvas id="c" width="1920" height="1080"></canvas>
<script src="../../sim/geometry.js"></script><script src="../../sim/clock.js"></script><script src="../../render/bracket_layout.js"></script><script src="draw_v2b.js"></script></body></html>`);
  return path.join(dir, 'index.html');
}
async function open(browser, html, data) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file:///' + html.replace(/\\/g, '/'));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((d) => window.initRenderer(d), data);
  return page;
}
// frame g where ball q is in play, slow, in the sky gap, far from other balls, no goal effect running
function findBall(q) {
  for (let mi = 0; mi < show.matches.length; mi++) {
    const m = show.matches[mi], seg = show.segments.find((s) => s.type === 'match' && s.match === mi);
    for (let i = 40; i < Math.min(m.frames.length - 1, 1000); i++) {
      const f = m.frames[i], b = f.b[q], p = m.frames[i - 1].b[q];
      if (b[3] !== 3 || p[3] !== 3) continue;
      if (b[0] < 700 || b[0] > 1050 || b[1] < 200 || b[1] > 480) continue;
      if (Math.hypot(b[0] - p[0], b[1] - p[1]) * 30 > 260) continue; // slow: no motion trail
      if (m.goals.some((g) => g.t <= f.t && f.t - g.t < 2.5)) continue;
      if (f.b.some((o, k) => k !== q && o[3] >= 2 && Math.hypot(o[0] - b[0], o[1] - b[1]) < 90)) continue;
      return { g: seg.start + i, x: b[0], y: b[1], r: q % 2 ? m.rB : m.rA, mi, i };
    }
  }
  return null;
}
(async () => {
  const browser = await chromium.launch();
  const html = path.join(ROOT, 'render', 'index.html');
  const on = await open(browser, html, show);
  const offShow = Object.assign({}, show, { logosOnBalls: false });
  const off = await open(browser, html, offShow);
  const res = {};
  // ---- diameters ----
  const runs = {};
  for (const [team, q] of [['A', 0], ['B', 1]]) {
    const at = findBall(q) || findBall(q + 2) || findBall(q + 4);
    if (!at) continue;
    runs[team] = await on.evaluate(([g, x, y, r]) => {
      window.renderFrame(g);
      const c = document.getElementById('c').getContext('2d');
      const cx = Math.round(x * 1.5), cy = Math.round(y * 1.5), w = Math.round(r * 1.5 * 4);
      const d = c.getImageData(cx - w / 2, cy, w, 1).data;
      const ref = [0, 1, 2].map((k) => (d[k] + d[(w - 1) * 4 + k]) / 2);
      const diff = (i) => Math.hypot(d[i * 4] - ref[0], d[i * 4 + 1] - ref[1], d[i * 4 + 2] - ref[2]);
      let lo = w / 2, hi = w / 2;
      while (lo > 0 && diff(lo - 1) > 18) lo--;
      while (hi < w - 1 && diff(hi + 1) > 18) hi++;
      return hi - lo + 1;
    }, [at.g, at.x, at.y, at.r]);
  }
  res.diam = runs.A && runs.B ? { A: runs.A, B: runs.B, expected: +(2 * show.cfg.BALL_RADIUS * S).toFixed(1) } : null;
  // ---- decal on vs off (centre of ball A) ----
  const at = findBall(0);
  const centre = async (page) => page.evaluate(([g, x, y, r]) => {
    window.renderFrame(g);
    const c = document.getElementById('c').getContext('2d'), rr = Math.round(r * 1.5 * 0.5);
    return Array.from(c.getImageData(Math.round(x * 1.5) - rr, Math.round(y * 1.5) - rr, 2 * rr, 2 * rr).data);
  }, [at.g, at.x, at.y, at.r]);
  const cOn = await centre(on), cOff = await centre(off);
  let nd = 0, n = 0;
  for (let i = 0; i < cOn.length; i += 4) { n++; if (Math.hypot(cOn[i] - cOff[i], cOn[i + 1] - cOff[i + 1], cOn[i + 2] - cOff[i + 2]) > 40) nd++; }
  res.decal = { pixels: n, differentPct: +(100 * nd / n).toFixed(1) };
  // ---- logos off == v2b renderer (ball discs) ----
  const ref = await open(browser, refRenderer(), offShow);
  const m = show.matches[at.mi], f = m.frames[at.i];
  const discs = f.b.map((b, q) => (b[3] === 3 ? [b[0] * 1.5, b[1] * 1.5, (q % 2 ? m.rB : m.rA) * 1.5 * 0.9] : null)).filter(Boolean);
  const grab = (page) => page.evaluate(([g, D]) => {
    window.renderFrame(g);
    const c = document.getElementById('c').getContext('2d');
    return D.map(([x, y, r]) => Array.from(c.getImageData(Math.round(x - r), Math.round(y - r), Math.round(2 * r), Math.round(2 * r)).data));
  }, [at.g, discs]);
  const a = await grab(off), b = await grab(ref);
  let maxDiff = 0;
  a.forEach((arr, k) => arr.forEach((v, i) => { if (i % 4 !== 3) maxDiff = Math.max(maxDiff, Math.abs(v - b[k][i])); }));
  res.oldLook = { balls: discs.length, maxDiff };
  // ---- no crest outside balls ----
  const screens = [['bracket', show.segments.find((s) => s.type === 'bracket' && s.step === 16), null], ['roundCard', show.segments.find((s) => s.type === 'roundCard'), null],
    ['winner_trophy_half', show.segments.find((s) => s.type === 'winner'), [0, 0, 960, 1080]]];
  res.outside = [];
  for (const [name, seg, rect] of screens) {
    const g = seg.start + 60;
    const px = async (page) => page.evaluate(([gg, R]) => { window.renderFrame(gg); const c = document.getElementById('c').getContext('2d'); return Array.from(R ? c.getImageData(R[0], R[1], R[2], R[3]).data : c.getImageData(0, 0, 1920, 1080).data); }, [g, rect]);
    const p1 = await px(on), p2 = await px(off);
    let n = 0; for (let i = 0; i < p1.length; i += 4) if (p1[i] !== p2[i] || p1[i + 1] !== p2[i + 1] || p1[i + 2] !== p2[i + 2]) n++;
    res.outside.push({ name, diffPixels: n });
  }
  // ---- no player names drawn during play (match segments around every goal, added-time shot, golden ball) ----
  const names = show.teams.flatMap((t) => t.players.map((p) => p.name));
  const frames = [];
  show.matches.forEach((m, mi) => {
    const seg = show.segments.find((x) => x.type === 'match' && x.match === mi);
    m.events.filter((e) => e.type === 'goal' || e.type === 'golden' || e.type === 'shot').forEach((e) => [0.3, 0.8, 1.5].forEach((dv) => frames.push(Math.min(seg.start + seg.len - 1, seg.start + Math.round(e.vf + dv * 30)))));
  });
  const drawn = await on.evaluate((F) => {
    const seen = new Set(); const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, x, y, w) { seen.add(String(t)); return orig.call(this, t, x, y, w); };
    for (const g of F) window.renderFrame(g);
    CanvasRenderingContext2D.prototype.fillText = orig;
    return [...seen];
  }, frames);
  res.namesInPlay = { frames: frames.length, texts: drawn.length, hits: drawn.filter((t) => names.some((n) => t.includes(n))) };
  await browser.close();
  console.log('\n' + JSON.stringify(res));
})().catch((e) => { console.error(e); process.exit(1); });
