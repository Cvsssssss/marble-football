// Renders PNG stills of a reel: node render/reel_stills.js <show.json> <reel.json> <outDir> [every-N-seconds | k1,k2,...]
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const [showF, reelF, outDir, which] = process.argv.slice(2);
  const show = JSON.parse(fs.readFileSync(showF, 'utf8')); show.outSize = [1080, 1920];
  const reel = JSON.parse(fs.readFileSync(reelF, 'utf8'));
  fs.mkdirSync(outDir, { recursive: true });
  let ks;
  if (which && which.includes(',')) ks = which.split(',').map(Number);
  else { const step = Math.round((+which || 1) * 30); ks = []; for (let k = 15; k < reel.totalFrames; k += step) ks.push(k); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto('file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((j) => window.initRenderer(JSON.parse(j)), JSON.stringify(show));
  await page.evaluate((j) => window.initReel(JSON.parse(j)), JSON.stringify(reel));
  for (const k of ks) {
    const png = await page.evaluate((x) => { window.renderReelFrame(x); return document.getElementById('c').toDataURL('image/png'); }, k);
    fs.writeFileSync(path.join(outDir, `r_${String(k).padStart(5, '0')}.png`), Buffer.from(png.split(',')[1], 'base64'));
  }
  await browser.close();
  console.log(ks.length, 'reel stills ->', outDir);
})();
