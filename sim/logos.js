'use strict';
// Team crests for the ball decals (logos_on_balls). Files come from assets/logos/<id>.png (manifest.json records the
// source of every file). They are downscaled once with ffmpeg (alpha kept) and embedded in show.json as data URLs,
// because a canvas loaded from file:// cannot export pixels drawn from file images.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const SIZE = 192;

function prepareLogos(conf) {
  const out = {}, missing = [];
  if (conf.rules.logos_on_balls === false) return { logos: out, missing };
  const ffmpeg = require('ffmpeg-static');
  const dir = path.join(ROOT, 'build', 'logos');
  fs.mkdirSync(dir, { recursive: true });
  for (const t of conf.teams) {
    if (!t.logoFile) { missing.push(t.id); continue; }
    const h = crypto.createHash('sha1').update(fs.readFileSync(t.logoFile)).digest('hex').slice(0, 10);
    const dst = path.join(dir, `${t.id}_${SIZE}_${h}.png`);
    if (!fs.existsSync(dst)) {
      execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', t.logoFile, '-vf', `scale=${SIZE}:${SIZE}:force_original_aspect_ratio=decrease:flags=lanczos,format=rgba`, dst]);
    }
    out[t.id] = 'data:image/png;base64,' + fs.readFileSync(dst).toString('base64');
  }
  return { logos: out, missing };
}

function readManifest() {
  const f = path.join(ROOT, 'assets', 'logos', 'manifest.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).logos || {} : {};
}

// LOGO_USAGE.md for a build output folder
function logoUsageMd(conf, missing) {
  const man = readManifest();
  const used = conf.rules.logos_on_balls === false ? [] : conf.teams.filter((t) => t.logoFile);
  const lines = ['# LOGO_USAGE', '',
    'Riscul unor reclamații privind drepturile de autor sau mărcile (siglele cluburilor) este al lui Max; siglele apar doar pe bile și pot fi oprite cu `logos_on_balls: false`.', '',
    `Competition: ${conf.competition.name} · logos_on_balls: ${conf.rules.logos_on_balls !== false} · generated ${new Date().toISOString().slice(0, 10)}`, '',
    'Crests are used ONLY as decals printed on the balls (not in the bracket, banners, titles or thumbnails text). No competition logos.', ''];
  if (!used.length) lines.push('No crests used in this build (colour-only balls).');
  else {
    lines.push('| Team | File | Source | Retrieved | Licence / note |', '|---|---|---|---|---|');
    for (const t of used) {
      const f = path.basename(t.logoFile), m = man[t.id] || Object.values(man).find((x) => x.file === f) || {};
      lines.push(`| ${t.name} | assets/logos/${f} | ${m.source_url || 'provided by Max (no manifest entry)'} | ${m.retrieved || '-'} | ${(m.licence || '-')}; ${m.note || ''} |`);
    }
  }
  if (missing && missing.length) lines.push('', `Teams without a crest file (colour-only ball): ${missing.join(', ')}`);
  return lines.join('\n') + '\n';
}

module.exports = { prepareLogos, logoUsageMd, readManifest };
