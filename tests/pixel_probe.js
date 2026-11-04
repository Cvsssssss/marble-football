'use strict';
// Renders the same global frame from build/test_show_base.json and build/test_show_changed.json and prints the mean
// colour inside City's ball 0 (match 0, local frame fi) and of a sky patch. Used by the config-change test.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const [g, fi] = process.argv.slice(2).map(Number);
(async () => {
  const browser = await chromium.launch();
  const out = {};
  for (const k of ['base', 'changed']) {
    const show = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', `test_show_${k}.json`), 'utf8'));
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto('file:///' + path.join(ROOT, 'render', 'index.html').split(path.sep).join('/'));
    await page.evaluate((d) => window.initRenderer(d), show);
    const b = show.matches[0].frames[fi].b[0], r = show.matches[0].rA;
    out[k] = await page.evaluate(([gg, bx, by, rr]) => {
      window.renderFrame(gg);
      const c = document.getElementById('c').getContext('2d');
      const mean = (x0, y0, rad, disk) => {
        const d = c.getImageData(Math.round(x0 - rad), Math.round(y0 - rad), Math.round(2 * rad), Math.round(2 * rad)).data;
        let s = [0, 0, 0], n = 0; const w = Math.round(2 * rad);
        for (let i = 0; i < d.length; i += 4) { const px = (i / 4) % w - rad, py = Math.floor(i / 4 / w) - rad; if (disk && px * px + py * py > rad * rad) continue; s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; n++; }
        return s.map((v) => Math.round(v / n));
      };
      return { ball: mean(bx * 1.5, by * 1.5, rr * 1.5 * 0.85, true), sky: mean(1100 * 1.5, 230 * 1.5, 20, false) };
    }, [g, b[0], b[1], r]);
    out[k].frame = g;
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(out));
})().catch((e) => { console.error(e); process.exit(1); });
