'use strict';
// P4: PUBLISH_CHECKLIST.md (Romanian) for a run folder. No titles / descriptions are generated here: Max writes them.
const fs = require('fs');
const path = require('path');

const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function schedule(run) {
  // strong real match on day D (run.slot from `npm run next`): long video D-1 evening, reels D-1 and D (max 2 per day)
  if (run.slot && run.slot.match_day) {
    const D = run.slot.match_day, D1 = addDays(D, -1);
    return { long: `${D1} 19:00 (D−1 seara, ora Copenhaga)`, reels: [`${D1} 21:00`, `${D} 12:00`, `${D} 17:00`], why: `meci real tare în ${D}: ${run.slot.fixture}` };
  }
  const d = addDays(run.date, 1);
  return { long: `${d} 19:00 (ora Copenhaga)`, reels: [`${addDays(d, 1)} 12:00`, `${addDays(d, 1)} 19:00`, `${addDays(d, 2)} 12:00`], why: 'video săptămânal din content_plan.json (fără meci real tare)' };
}

function checklistMd(runDir, run) {
  const S = schedule(run);
  const chapters = fs.existsSync(path.join(runDir, 'chapters.txt')) ? fs.readFileSync(path.join(runDir, 'chapters.txt'), 'utf8').trim() : '(lipsește chapters.txt)';
  const reels = run.reels || [];
  return [
    `# Listă de publicare — ${run.competition.name} · ${run.map}`,
    '',
    `Rulare: \`${run.run}\` · calitate: ${run.quality === 'final_1080p' ? 'finală 1080p' : 'PREVIEW 720p (nu pentru publicare)'} · durată video lung: ${Math.floor(run.long_video.seconds / 60)}:${String(Math.round(run.long_video.seconds % 60)).padStart(2, '0')}`,
    '',
    '## 1. Ce încarci și în ce ordine',
    `1. **Video lung**: \`${run.long_video.file}\` — publicare sugerată: **${S.long}** (${S.why}).`,
    ...reels.map((r, i) => `${i + 2}. **Reel**: \`${r.dir}/reel.mp4\` (${r.seconds} s, tot terenul în cadru) — după videoul lung, sugerat **${S.reels[i]}**; pune în descriere linkul către videoul lung.`),
    run.thumbnails === true
      ? `${reels.length + 2}. Thumbnail: alege unul din \`thumbnails/thumbnail_1..3.png\` (fără text; poți adăuga tu text, dar fără nume de jucători).`
      : `${reels.length + 2}. Thumbnail: îl faci tu (generatorul nu mai creează thumbnail-uri; \`generate_thumbnails: false\`). Fără nume de jucători pe el.`,
    '',
    'Reguli de ritm: maxim 1 video lung pe zi; un singur reel per video, ales din optimi/sferturi (cea mai spectaculoasă revenire).',
    '',
    '## 2. Titlul și descrierea: copiază-le din `publish/`',
    '- [ ] Titlul: una din cele 3 variante din `publish/long_title.txt`; descrierea: tot `publish/long_description.txt` (are capitolele). Reel: `publish/reel_title.txt` + `publish/reel_description.txt`. Pașii exacți: `publish/README_publish.txt`.',
    '- [ ] Titlul conține **Simulation** (toate variantele generate îl au).',
    '- [ ] Descrierea are o propoziție clară: *este o simulare pe calculator, nu rezultate reale* (pe ecran nu mai e etichetă SIMULATION, deci descrierea trebuie să spună asta).',
    '- [ ] La încărcare, YouTube întreabă dacă videoul are conținut modificat/sintetic („altered or synthetic content”): citește întrebarea actuală a YouTube și răspunde corect (e o simulare pe calculator cu nume reale de echipe).',
    '- [ ] **Fără nume de jucători** în titlu, descriere și taguri.',
    '- [ ] Fără nume oficiale de competiții și fără sigle (Champions League, Europa League, UEFA, FIFA, World Cup…). Numele noastre (MARBLE …) sunt OK.',
    '- [ ] Fără clickbait care promite rezultate reale.',
    '- [ ] Dacă schimbi ceva în texte: fără nume de jucători, fără câștigătorul în titlul videoului lung.',
    '',
    '## 3. Încarcă PRIVAT, verifică, apoi publică',
    '- [ ] Încarcă videoul ca **privat** (sau nelistat).',
    '- [ ] Uită-te la: loviturile morii de vânt, portarul (ghemuit / sărituri), culorile bilelor (fiecare echipă se distinge), tabloul (bracket) după fiecare tur, textele (replay, omul meciului, podium), sunetul (muzică, goluri, fluier).',
    '- [ ] Pe ecran nu e etichetă SIMULATION (oprită din config: `show_simulation_label`); mesajul de simulare e în titlu și descriere.',
    '- [ ] Verifică `PREFLIGHT.md` (toate verde).',
    '- [ ] Abia apoi schimbă pe **public**. Tu răspunzi de ce publici.',
    '- [ ] După publicare, notează în `plan/history.json`: `"status": "published"`, `published_long` și `published_reels` (data-ora).',
    '',
    '## 4. Capitole (copiază în descriere)',
    '```',
    chapters,
    '```',
    '',
    `Sigle pe bile: vezi \`LOGO_USAGE.md\` (sursele fiecărei sigle; riscul e al tău, se pot opri cu \`logos_on_balls: false\`).`,
    '',
  ].join('\n');
}
function writeChecklist(runDir, run) { fs.writeFileSync(path.join(runDir, 'PUBLISH_CHECKLIST.md'), checklistMd(runDir, run)); }
module.exports = { writeChecklist, checklistMd, schedule };
