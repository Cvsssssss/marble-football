'use strict';
// P4: 3 thumbnail candidates (1280x720 PNG) from the best moments: the decisive goals of the reel matches
// (fallback: the last goals of the final). Scene only: no text, no HUD, no player names.
// usage: node render/thumbs.js <show.json> <outDir> [selection.json]
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { decisiveGoal } = require('../sim/reels');

(async () => {
  const [showF, outDir, selF] = process.argv.slice(2);
  const show = JSON.parse(fs.readFileSync(showF, 'utf8')); show.outSize = [1280, 720];
  const picks = [];
  if (selF && fs.existsSync(selF)) for (const r of JSON.parse(fs.readFileSync(selF, 'utf8')).reels) picks.push(r.index);
  const fi = show.matches.length - 1;
  while (picks.length < 3) picks.push(fi);
  const moments = picks.slice(0, 3).map((mi, k) => {
    const m = show.matches[mi];
    const gi = picks.indexOf(mi) === k ? decisiveGoal(m) : Math.max(0, m.goals.length - 1 - k);
    const g = m.goals[gi] || m.goals[0];
    // close-up on the goal mouth just after the ball crosses the line: ball in the net, keeper, confetti
    return { mi, t: g.t + 0.2, zoom: { z: 2.1, x: g.x - 90, y: g.y - 70 } };
  });
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((j) => window.initRenderer(JSON.parse(j)), JSON.stringify(show));
  let k = 0;
  for (const mo of moments) {
    k++;
    const png = await page.evaluate(([a, b, c]) => window.renderThumb(a, b, c), [mo.mi, mo.t, mo.zoom]);
    fs.writeFileSync(path.join(outDir, `thumbnail_${k}.png`), Buffer.from(png.split(',')[1], 'base64'));
  }
  await browser.close();
  console.log(`${moments.length} thumbnails -> ${outDir}`);
})().catch((e) => { console.error(e); process.exit(1); });
