'use strict';
// P4 preflight: npm run preflight -- <run folder>   (also runs at the end of every generation)
// Writes <run>/PREFLIGHT.md with green / red items; red items are explained in Romanian. Exit code 1 if anything is red.
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const ffprobe = require('ffprobe-static').path;
const ROOT = __dirname;

function probe(f) {
  const j = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate:format=duration', '-of', 'json', f]).toString());
  const v = j.streams.find((s) => s.codec_type === 'video'), a = j.streams.find((s) => s.codec_type === 'audio');
  return { w: v && v.width, h: v && v.height, fps: v && v.r_frame_rate, vcodec: v && v.codec_name, acodec: a ? a.codec_name : null, dur: +(+j.format.duration).toFixed(2) };
}
function loudness(f) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-nostats', '-i', f, '-vn', '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const m = (r.stderr.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop();
  return m ? +m.match(/-?[\d.]+/)[0] : NaN;
}
// grey crop of frame at time t -> Buffer (w*h)
function grabGray(f, t, crop) {
  return execFileSync(ffmpeg, ['-v', 'error', '-ss', String(t), '-i', f, '-frames:v', '1', '-vf', `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 });
}
function grabRGB(f, t) { return execFileSync(ffmpeg, ['-v', 'error', '-ss', String(t), '-i', f, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 27 }); }
// "SIMULATION" text present in the crop: rows with many bright/dark transitions (letters), absent on plain backgrounds
function labelPresent(buf, w, h) {
  let rows = 0;
  for (let y = 0; y < h; y++) {
    let tr = 0, prev = null;
    for (let x = 0; x < w; x++) { const v = buf[y * w + x]; const s = v > 175 ? 1 : v < 135 ? 0 : prev; if (prev !== null && s !== null && s !== prev) tr++; if (s !== null) prev = s; }
    if (tr >= 12) rows++;
  }
  return rows >= 3;
}
function textFiles(dir) {
  const out = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(p); } })(dir);
  return out;
}
const mask = (n) => n[0] + '***';

function preflight(runDir) {
  const C = [];
  const add = (name, ok, whyRo, info) => C.push({ name, ok: !!ok, whyRo, info });
  const rf = (p) => path.join(runDir, p);
  if (!fs.existsSync(rf('run.json'))) { add('run.json există', false, 'Lipsește run.json: generarea nu s-a terminat. Rulează din nou aceeași comandă (se reia din cache).'); return finish(runDir, C); }
  const run = JSON.parse(fs.readFileSync(rf('run.json'), 'utf8'));
  const labelOn = run.show_simulation_label === true; // P5: label off by default
  const preview = run.quality !== 'final_1080p';
  const reelsExpected = (run.reels || []).length > 0;
  // 1. files
  const need = [run.long_video.file, 'chapters.txt', 'PUBLISH_CHECKLIST.md', 'LOGO_USAGE.md', 'thumbnails/thumbnail_1.png', 'thumbnails/thumbnail_2.png', 'thumbnails/thumbnail_3.png']
    .concat((run.reels || []).flatMap((r) => [`${r.dir}/reel.mp4`, `${r.dir}/suggestions.txt`]));
  // P5 dry run (rehearsal without videos): media files are not expected and their checks are skipped
  const missing = need.filter((p) => !(run.dry_run && /\.mp4$/.test(p)) && !fs.existsSync(rf(p)));
  if (run.dry_run) add('repetiție fără video (dry run): verificările video/audio sunt sărite', true, '');
  add('toate fișierele rulării există', missing.length === 0, `Lipsesc: ${missing.join(', ')}. Rulează din nou generarea.`);
  // 2. ffprobe
  const lv = rf(run.long_video.file);
  if (fs.existsSync(lv)) {
    const p = probe(lv), W = preview ? 1280 : 1920, H = preview ? 720 : 1080;
    add(`video lung: ${W}×${H}, 30 fps, H.264 + AAC`, p.w === W && p.h === H && p.fps === '30/1' && p.vcodec === 'h264' && p.acodec === 'aac', `Videoul lung are ${p.w}×${p.h}, ${p.fps}, video ${p.vcodec}, audio ${p.acodec || 'LIPSĂ'}.`, p);
    const I = loudness(lv);
    add('video lung: loudness −14 LUFS (±1,5)', Math.abs(I + 14) <= 1.5, `Volumul integrat este ${I} LUFS (ținta −14). Refă pasul audio (mux).`, { I });
    // SIMULATION label (bottom-right pill): present in >= 95 % of sampled frames if run.show_simulation_label, else absent in all (P5)
    const k = W / 1280, crop = { x: Math.round(1188 * k), y: Math.round(692 * k), w: Math.round(84 * k), h: Math.round(20 * k) };
    const n = 40; let seen = 0;
    for (let i = 0; i < n; i++) { const t = (p.dur - 1) * (i + 0.5) / n; if (labelPresent(grabGray(lv, t, crop), crop.w, crop.h)) seen++; }
    if (labelOn) add('eticheta SIMULATION se vede în ≥ 95 % din cadrele eșantionate (video lung)', seen / n >= 0.95, `Eticheta SIMULATION a fost găsită doar în ${seen} din ${n} cadre.`, { seen, n });
    else add('fără eticheta SIMULATION pe ecran (video lung, show_simulation_label = false)', seen === 0, `Eticheta SIMULATION apare în ${seen} din ${n} cadre, deși e oprită.`, { seen, n });
  }
  for (const r of run.reels || []) {
    const f = rf(`${r.dir}/reel.mp4`); if (!fs.existsSync(f)) continue;
    const p = probe(f);
    add(`${r.dir}: 1080×1920, 30 fps, audio, ≤ 60 s`, p.w === 1080 && p.h === 1920 && p.fps === '30/1' && p.acodec === 'aac' && p.dur <= 60 && p.dur >= 15, `Reel-ul are ${p.w}×${p.h}, ${p.dur} s, audio ${p.acodec || 'LIPSĂ'} (trebuie 1080×1920, cel mult 60 s, cu sunet).`, p);
    const I = loudness(f);
    add(`${r.dir}: loudness −14 LUFS (±1,5)`, Math.abs(I + 14) <= 1.5, `Volumul reel-ului este ${I} LUFS (ținta −14).`, { I });
    // safe area: outside the central 80 % (and outside the playfield) only the plain background
    let bad = 0, tot = 0, simSeen = 0; const ts = [1, p.dur * 0.35, p.dur * 0.7, p.dur - 1.5];
    for (const t of ts) {
      const b = grabRGB(f, t), W = 1080, fy0 = 490 * 1.5, fy1 = 1100 * 1.5;
      for (let y = 0; y < 1920; y += 4) {
        if (y >= fy0 && y < fy1) continue;
        const inBand = y < 192 || y >= 1728, r0 = 3 * (y * W + (inBand ? 540 : 4));
        for (let x = 0; x < W; x += 6) {
          if (!inBand && x >= 108 && x < 972) continue;
          const i = 3 * (y * W + x); tot++;
          if (Math.abs(b[i] - b[r0]) + Math.abs(b[i + 1] - b[r0 + 1]) + Math.abs(b[i + 2] - b[r0 + 2]) > 45) bad++;
        }
      }
      const g = grabGray(f, t, { x: 470, y: 1668, w: 140, h: 42 }); if (labelPresent(g, 140, 42)) simSeen++;
    }
    add(`${r.dir}: zona sigură (scor și texte în centrul de 80 %)`, bad / tot < 0.002, `Elemente desenate la marginea ecranului (${bad} pixeli), unde interfața telefonului le acoperă.`, { bad, tot });
    if (labelOn) add(`${r.dir}: eticheta SIMULATION vizibilă`, simSeen === ts.length, `Eticheta SIMULATION lipsește în ${ts.length - simSeen} din ${ts.length} cadre.`);
    else add(`${r.dir}: fără eticheta SIMULATION pe ecran`, simSeen === 0, `Eticheta SIMULATION apare în ${simSeen} din ${ts.length} cadre, deși e oprită.`);
  }
  // 3. image assets: only files listed in the asset manifest (crests / flags as ball decals)
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'logos', 'manifest.json'), 'utf8')).logos;
  const listed = new Set(Object.values(man).map((m) => m.file));
  const imgs = textFiles(path.join(ROOT, 'assets')).filter((p) => /\.(png|jpe?g|svg|gif|webp)$/i.test(p));
  const unlisted = imgs.filter((p) => !(path.dirname(p) === path.join(ROOT, 'assets', 'logos') && listed.has(path.basename(p))));
  add('nicio imagine în afara manifestului de resurse (assets/logos/manifest.json)', unlisted.length === 0, `Imagini fără sursă în manifest: ${unlisted.map((p) => path.relative(ROOT, p)).join(', ')}. Șterge-le sau adaugă sursa în manifest.`);
  // 4. no player names in any file name or text file of the run
  const comp = JSON.parse(fs.readFileSync(path.join(ROOT, run.competition.file), 'utf8'));
  const teams = comp.teams.map((id) => JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'teams', id + '.json'), 'utf8')));
  const teamText = teams.map((t) => `${t.name} ${t.short_name || ''}`).join(' ').toLowerCase();
  const names = teams.flatMap((t) => t.players.concat(t.fictional_players || []).map((p) => p.name));
  const surnames = names.map((n) => n.split(' ').slice(-1)[0]).filter((s) => s.length >= 5 && !teamText.includes(s.toLowerCase()));
  const hits = [];
  for (const f of textFiles(runDir)) {
    const rel = path.relative(runDir, f);
    const fn = names.find((n) => rel.includes(n)) || surnames.find((s) => rel.includes(s));
    if (fn) hits.push(`numele fișierului ${rel.split(fn).join(mask(fn))}`); // masked: the report never repeats the name
    if (/\.(txt|md|json|csv)$/i.test(f) && path.basename(f) !== 'PREFLIGHT.md') {
      const t = fs.readFileSync(f, 'utf8');
      const n = names.find((x) => t.includes(x)) || surnames.find((s) => new RegExp(`(^|[^\\p{L}])${s}([^\\p{L}]|$)`, 'u').test(t));
      if (n) hits.push(`${rel} (conține „${mask(n)}”)`);
    }
  }
  add('niciun nume de jucător în numele fișierelor sau în fișierele text', hits.length === 0, `Nume de jucător găsit în: ${hits.join('; ')}. Numele reale apar doar în video (replay, omul meciului, podium).`);
  // 5. chapters
  const ch = fs.existsSync(rf('chapters.txt')) ? fs.readFileSync(rf('chapters.txt'), 'utf8').trim().split(/\r?\n/) : [];
  const secs = ch.map((l) => { const m = l.match(/^(\d+):(\d{2})(?::(\d{2}))?\s+\S/); return m ? (m[3] ? (+m[1] * 3600 + +m[2] * 60 + +m[3]) : +m[1] * 60 + +m[2]) : NaN; });
  const chOk = ch.length >= 3 && secs[0] === 0 && secs.every((s, i) => Number.isFinite(s) && (i === 0 || s - secs[i - 1] >= 10)) && secs[secs.length - 1] < run.long_video.seconds;
  add('chapters.txt valid (începe la 0:00, crescător, ≥ 10 s între capitole)', chOk, 'Capitolele nu respectă regulile YouTube (prima la 0:00, minim 3, crescător, cel puțin 10 s între ele).', { lines: ch.length });
  // 6. uniqueness vs the last 5 runs in plan/history.json
  const PV = require('./plan/validate');
  const hf = path.join(ROOT, 'plan', 'history.json');
  const hist = fs.existsSync(hf) ? JSON.parse(fs.readFileSync(hf, 'utf8')).runs.filter((h) => h.run !== run.run && h.status !== 'discarded' && h.fingerprint
    // previews are never published, and a preview + final of the same tournament are one video
    && h.quality !== 'preview_720p' && h.run.replace(/_preview$/, '') !== run.run.replace(/_preview$/, '')) : [];
  const prev = hist.slice(-5).map((h) => ({ run: h.run, s: PV.similarity(run.fingerprint, h.fingerprint) }));
  const maxS = prev.length ? Math.max(...prev.map((x) => x.s)) : 0;
  add(`unicitate: similaritate ≤ ${PV.THRESHOLD} față de ultimele 5 rulări`, maxS <= PV.THRESHOLD, `Videoul seamănă prea mult cu ${prev.filter((x) => x.s > PV.THRESHOLD).map((x) => x.run).join(', ')} (scor ${maxS}). Alege altă hartă sau altă competiție.`, prev);
  // 7. forced pair really in the bracket
  if (run.forced_pair) {
    const fp = run.forced_pair, key = [fp.a, fp.b].sort().join('-'), r16 = run.bracket_r16 || [];
    let ok = false;
    if (fp.round === 'QF') { const ia = r16.findIndex((p) => p.split('-').includes(fp.a)), ib = r16.findIndex((p) => p.split('-').includes(fp.b)); ok = ia >= 0 && ib >= 0 && Math.floor(ia / 2) === Math.floor(ib / 2) && ia !== ib; }
    else ok = r16.includes(key);
    add(`perechea forțată ${fp.a} vs ${fp.b} (${fp.round}) e în tablou`, ok, `Perechea forțată nu apare în tablou cum s-a cerut (${fp.round === 'QF' ? 'în optimi alăturate, ca să se poată întâlni în sferturi' : 'ca meci din optimi'}).`);
  }
  // 8. reel suggestions lint
  if (reelsExpected) {
    const { lintSuggestion } = require('./build_reels');
    const errs = [];
    for (const r of run.reels) {
      const f = rf(`${r.dir}/suggestions.txt`); if (!fs.existsSync(f)) continue;
      const txt = fs.readFileSync(f, 'utf8'); const grab = (h) => { const i = txt.indexOf(h + '\n'); return txt.slice(i + h.length + 1).split('\n\n')[0].trim(); };
      errs.push(...lintSuggestion({ title: grab('TITLU:'), description: grab('DESCRIERE:'), tags: grab('TAGURI:').split(',').map((x) => x.trim()) }, names).map((e) => `${r.dir}: ${e.replace(/player name: .*/, 'nume de jucător')}`));
    }
    add('sugestiile reel-urilor respectă regulile (SIMULATION, fără nume, fără nume oficiale)', errs.length === 0, `Probleme: ${errs.join('; ')}`);
  }
  return finish(runDir, C, run);
}

function finish(runDir, C, run) {
  const red = C.filter((c) => !c.ok);
  const md = [`# PREFLIGHT — ${run ? run.run : path.basename(runDir)}`, '', red.length ? `**ROȘU: ${red.length} problemă(e).** Nu publica până nu sunt rezolvate.` : '**VERDE: toate verificările au trecut.** (Tot trebuie să te uiți tu la video înainte de publicare.)', '',
    '| | Verificare | Detalii |', '|---|---|---|',
    ...C.map((c) => `| ${c.ok ? '🟢' : '🔴'} | ${c.name} | ${c.ok ? 'ok' : c.whyRo} |`), '', `Verificat: ${new Date().toISOString()}`, ''].join('\n');
  fs.writeFileSync(path.join(runDir, 'PREFLIGHT.md'), md);
  return { ok: red.length === 0, red: red.length, checks: C };
}

module.exports = { preflight, labelPresent };
if (require.main === module) {
  const dir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'output', 'latest');
  if (!fs.existsSync(dir)) { console.error(`Folderul nu există: ${dir}`); process.exit(2); }
  const r = preflight(dir);
  for (const c of r.checks) console.log(`${c.ok ? 'OK  ' : 'ROȘU'} ${c.name}${c.ok ? '' : ' — ' + c.whyRo}`);
  console.log(r.ok ? '\nPREFLIGHT VERDE' : `\nPREFLIGHT ROȘU (${r.red})`);
  process.exit(r.ok ? 0 : 1);
}
