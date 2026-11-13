'use strict';
// P6: writes config/players_review.md (table Max can correct) from config/teams/*.json for every competition.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const L = require('../sim/config_loader');
const lines = [
  '# Jucători reali — tabel de verificat de Max',
  '',
  'Numele apar **doar în video** (gol, reluare, Man of the Match, ecranul final, podium). Niciodată în numele fișierelor, thumbnail-uri, titluri, descrieri sau tag-uri.',
  'Fiecare echipă are 3 atacanți/extreme din lotul **actual** (cluburi: lotul UEFA 2026/27; naționale: ultima convocare găsită, de obicei noiembrie 2026). Audit P6: **2026-11-13**.',
  'Corectare: editează `config/teams/<id>.json` → `players[i]` (`name` format `I. Nume`, `team`, `nationality`, `source_url`, `retrieved`, `verified`). Apoi rulează `node tools/players_review.js` ca să refaci acest tabel.',
  'Validatorul (`node sim/players.js`, rulat și la pornire) cere: 3 jucători pe echipă, `team` = echipa, la naționale `nationality` = țara, niciun jucător în două echipe ale aceleiași competiții, `retrieved` de cel mult 120 de zile.',
  'Coloana „De verificat”: **DA** = sursa nu a confirmat complet (vezi nota).',
  '',
];
const dir = path.join(ROOT, 'config', 'competitions');
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const conf = L.loadCompetition(path.join(dir, f), { skipPlayerCheck: true });
  lines.push(`## ${conf.competition.name} (${conf.competition.id})`, '', '| Echipă | Nume în video | Post | Naționalitate | Sursă | Consultat | Verificat | De verificat |', '|---|---|---|---|---|---|---|---|');
  for (const t of conf.teams) for (const p of t.players) {
    const need = p.verified === false || /to confirm/.test(p.note || '');
    let host = ''; try { host = new URL(p.source_url).hostname.replace(/^www\./, ''); } catch (e) { host = 'sursă'; }
    lines.push(`| ${t.name} | ${p.name}${p.number ? ' (#' + p.number + ')' : ''} | ${p.position || ''} | ${p.nationality || ''} | [${host}](${p.source_url}) | ${p.retrieved} | ${p.verified ? 'da' : 'nu'} | ${need ? 'DA — ' + (p.note || '') : ''} |`);
  }
  lines.push('');
}
// P7: leagues (config/leagues/*.json)
const ldir = path.join(ROOT, 'config', 'leagues');
if (fs.existsSync(ldir)) for (const f of fs.readdirSync(ldir).filter((x) => x.endsWith('.json'))) {
  const C = require('../sim/league/config').loadLeague(path.join(ldir, f), { skipPlayerCheck: true });
  lines.push(`## ${C.league.display_name} ${C.league.season} (${C.league.id}) — loturi 2026/27 (premierleague.com / uefa.com)`, '', '| Echipă | Nume în video | Post | Naționalitate | Sursă | Consultat | Verificat | De verificat |', '|---|---|---|---|---|---|---|---|');
  for (const t of C.teams) for (const p of t.players) {
    const need = p.verified === false || /to confirm/.test(p.note || '');
    let host = ''; try { host = new URL(p.source_url).hostname.replace(/^www\./, ''); } catch (e) { host = 'sursă'; }
    lines.push(`| ${t.name} | ${p.name}${p.number ? ' (#' + p.number + ')' : ''} | ${p.position || ''} | ${p.nationality || ''} | [${host}](${p.source_url}) | ${p.retrieved} | ${p.verified ? 'da' : 'nu'} | ${need ? 'DA — ' + (p.note || '') : ''} |`);
  }
  lines.push('');
}
fs.writeFileSync(path.join(ROOT, 'config', 'players_review.md'), lines.join('\n'));
console.log('config/players_review.md written');
