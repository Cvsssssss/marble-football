// One-off generator for the P3 competition presets (MARBLE CONTINENTAL, MARBLE WORLD NATIONS, MARBLE EURO NATIONS).
// Snapshots: UEL league-phase table (Wikipedia template, updated 22 Oct 2026) and FIFA men's ranking of 7 Oct 2026 (ESPN list).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = '2026-11-04';
const base = (o) => Object.assign({
  format: 'knockout16', rules: 'base', GAME_MIN_PER_SEC: 2.4, real_names: true, bracket_style: 'symmetric',
  strength_from_position: true, forced_pairs: [],
}, o);
const write = (id, o) => fs.writeFileSync(path.join(ROOT, 'config', 'competitions', id + '.json'), JSON.stringify(o, null, 1) + '\n');

// --- MARBLE CONTINENTAL ---
const uelIds = ['benfica', 'leverkusen', 'bournemouth', 'ferencvaros', 'olympiacos', 'union_sg', 'juventus', 'besiktas', 'sunderland', 'az', 'omonia', 'lyon', 'rennes', 'real_sociedad', 'crystal_palace', 'sparta_praha'];
const uelTable = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'uel_table.json'), 'utf8')).slice(0, 16);
write('uel_top16', base({
  id: 'uel_top16', seed_salt: 11, name: 'MARBLE CONTINENTAL', subtitle: 'MARBLE FOOTBALL TOURNAMENT · 16 TEAMS',
  _teams_note: 'Top 16 of the 2026-27 Europa League league phase in table order. Snapshot below; replace by editing teams[] and standings.',
  standings: {
    source_url: 'https://en.wikipedia.org/wiki/Template:2026%E2%80%9327_UEFA_Europa_League_league_phase_table', retrieved: D,
    note: 'Wikipedia template, updated to matches played on 22 October 2026 (3 matchdays). Ties on points ordered as in the source.',
    table: uelTable.map((r, i) => ({ pos: i + 1, team: uelIds[i], club: r[1], played: +r[2], points: +r[9], gd: +String(r[8]).replace('−', '-') })),
  },
  teams: uelIds, map: 'stadium_day',
  output: 'output/continental16_1080p.mp4', preview_output: 'output/continental16_preview_720p.mp4', screenshots: 'output/screenshots_continental', output_dir: 'output',
}));

// --- nations (FIFA ranking 7 Oct 2026) ---
const FIFA = { source_url: 'https://www.espn.com/soccer/story/_/id/46664763/fifa-mens-top-50-world-rankings', retrieved: D,
  note: 'FIFA/Coca-Cola men\'s world ranking of 7 October 2026 as listed by ESPN (FIFA.com did not render for the fetch tool).' };
const world = [['nt_spain', 1], ['nt_argentina', 2], ['nt_france', 3], ['nt_england', 4], ['nt_portugal', 5], ['nt_brazil', 6], ['nt_morocco', 7], ['nt_belgium', 8],
  ['nt_netherlands', 9], ['nt_mexico', 10], ['nt_colombia', 11], ['nt_switzerland', 12], ['nt_germany', 13], ['nt_croatia', 14], ['nt_italy', 15], ['nt_usa', 16]];
const euro = [['nt_spain', 1], ['nt_france', 3], ['nt_england', 4], ['nt_portugal', 5], ['nt_belgium', 8], ['nt_netherlands', 9], ['nt_switzerland', 12], ['nt_germany', 13],
  ['nt_croatia', 14], ['nt_italy', 15], ['nt_norway', 19], ['nt_denmark', 21], ['nt_austria', 22], ['nt_turkiye', 31], ['nt_sweden', 34], ['nt_ukraine', 36]];
const nat = (list) => ({ table: list.map(([t, r], i) => ({ pos: i + 1, team: t, fifa_rank: r })) });
write('nations_world_16', base({
  id: 'nations_world_16', seed_salt: 23, name: 'MARBLE WORLD NATIONS', subtitle: 'MARBLE FOOTBALL TOURNAMENT · 16 NATIONS',
  _teams_note: 'Top 16 of the FIFA men\'s ranking, in ranking order. National teams show their flag on the ball.',
  standings: Object.assign({}, FIFA, nat(world)), teams: world.map((x) => x[0]), map: 'sunset',
  output: 'output/world16_1080p.mp4', preview_output: 'output/world16_preview_720p.mp4', screenshots: 'output/screenshots_world', output_dir: 'output',
}));
write('nations_euro_16', base({
  id: 'nations_euro_16', seed_salt: 37, name: 'MARBLE EURO NATIONS', subtitle: 'MARBLE FOOTBALL TOURNAMENT · 16 NATIONS',
  _teams_note: 'Top 16 European national teams of the FIFA men\'s ranking. Russia (rank 35) is left out because it is suspended from UEFA competitions; Ukraine (36) takes the 16th place.',
  standings: Object.assign({}, FIFA, nat(euro)), teams: euro.map((x) => x[0]), map: 'stadium_night',
  output: 'output/euro16_1080p.mp4', preview_output: 'output/euro16_preview_720p.mp4', screenshots: 'output/screenshots_euro', output_dir: 'output',
}));
console.log('competitions written');
