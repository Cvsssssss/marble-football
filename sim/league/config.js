'use strict';
// P7: league config loader (config/leagues/<id>.json), validated by schema at startup.
const fs = require('fs');
const path = require('path');
const L = require('../config_loader');
const ROOT = path.join(__dirname, '..', '..');

const HEX = { type: 'hex' };
const LEAGUE_SCHEMA = {
  type: 'object', required: ['id', 'display_name', 'season', 'season_seed', 'rules', 'clubs', 'zones', 'points', 'strength'],
  props: {
    id: { type: 'string', pattern: /^[a-z0-9_]+$/ }, display_name: { type: 'string', minLen: 1, maxLen: 40 }, season: { type: 'string', pattern: /^\d{4}\/\d{2}$/ },
    season_seed: { type: 'integer', min: 0 }, rules: { type: 'string' }, default_map: { type: 'string' }, fallback_map: { type: 'string' }, real_names: { type: 'boolean' },
    points: { type: 'object', required: ['win', 'draw', 'loss'], props: { win: { type: 'integer', min: 0, max: 5 }, draw: { type: 'integer', min: 0, max: 5 }, loss: { type: 'integer', min: 0, max: 5 } } },
    tiebreak: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'string', enum: ['points', 'goal_difference', 'goals_for', 'head_to_head_points', 'seeded_draw'] } },
    zones: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'object', required: ['id', 'label', 'from', 'to', 'colour'],
      props: { id: { type: 'string' }, label: { type: 'string', minLen: 1, maxLen: 24 }, from: { type: 'integer', min: 1, max: 20 }, to: { type: 'integer', min: 1, max: 20 }, colour: HEX } } },
    strength: { type: 'object', required: ['beta', 'home_advantage', 'edge_max'], props: { beta: { type: 'number', min: 0, max: 3 }, home_advantage: { type: 'number', min: 0, max: 0.5 },
      edge_max: { type: 'number', min: 0, max: 0.95 }, promoted_rating_from: { type: 'string' },
      top_compress: { type: 'object', required: ['above', 'factor'], props: { above: { type: 'number', min: 0, max: 3 }, factor: { type: 'number', min: 0, max: 1 } } } } },
    clubs: { type: 'array', minItems: 20, maxItems: 20, items: { type: 'object', required: ['id'],
      props: { id: { type: 'string', pattern: /^[a-z0-9_]+$/ }, pos_2025_26: { type: 'integer', min: 1, max: 20 }, points_2025_26: { type: 'integer', min: 0, max: 114 }, promoted: { type: 'string' } } } },
    sources: { type: 'object', props: { retrieved: { type: 'string' }, final_table_2025_26: { type: 'string' }, relegated_2025_26: { type: 'array', items: { type: 'string' } },
      relegation_confirmation: { type: 'string' }, promotion: { type: 'string' }, squads: { type: 'string' } } },
  },
};

// invisible rating (points per game of 2025/26); promoted clubs: rating of `promoted_rating_from` (weakest club that stayed up)
function ratingsOf(lg) {
  const byId = new Map(lg.clubs.map((c) => [c.id, c]));
  const kept = lg.clubs.filter((c) => !c.promoted);
  const weakest = lg.strength.promoted_rating_from ? byId.get(lg.strength.promoted_rating_from) : kept.slice().sort((a, b) => a.points_2025_26 - b.points_2025_26)[0];
  return lg.clubs.map((c) => +((c.promoted ? weakest.points_2025_26 : c.points_2025_26) / 38).toFixed(4));
}

function loadLeague(file, opts) {
  opts = opts || {};
  file = path.resolve(file || path.join(ROOT, 'config', 'leagues', 'premier_league_2026_27.json'));
  const lg = JSON.parse(fs.readFileSync(file, 'utf8'));
  const errs = [];
  L.validate(lg, LEAGUE_SCHEMA, path.basename(file), errs);
  if (errs.length) throw new L.ConfigError(errs);
  const ids = lg.clubs.map((c) => c.id);
  if (new Set(ids).size !== 20) errs.push('clubs: 20 different clubs needed');
  lg.clubs.forEach((c) => { if (!c.promoted && c.points_2025_26 === undefined) errs.push(`clubs.${c.id}: points_2025_26 or promoted is required`); });
  for (const z of lg.zones) if (z.from > z.to) errs.push(`zones.${z.id}: from > to`);
  const cfgDir = path.join(ROOT, 'config');
  const teams = ids.map((id) => {
    const f = path.join(cfgDir, 'teams', id + '.json');
    if (!fs.existsSync(f)) { errs.push(`missing config/teams/${id}.json`); return null; }
    const t = JSON.parse(fs.readFileSync(f, 'utf8')); const e2 = []; L.validate(t, L.SCHEMAS.team, `config/teams/${id}.json`, e2); errs.push(...e2);
    const lf = path.join(ROOT, 'assets', 'logos', (t.logo || id + '.png')); t.logoFile = fs.existsSync(lf) ? lf : null;
    return t;
  });
  const rulesF = path.join(cfgDir, 'rules', lg.rules + '.json');
  const rules = JSON.parse(fs.readFileSync(rulesF, 'utf8')); { const e3 = []; L.validate(rules, L.SCHEMAS.rules, `config/rules/${lg.rules}.json`, e3); errs.push(...e3); }
  if (rules.golden_ball !== false) errs.push(`config/rules/${lg.rules}.json: league matches need golden_ball: false`);
  if (lg.real_names !== false && !opts.skipPlayerCheck && teams.every(Boolean)) errs.push(...require('../players').validateTeams(teams, { today: opts.today }).errors);
  if (errs.length) throw new L.ConfigError(errs);
  return { league: lg, file, teams, rules, rc: Object.assign(L.rulesToCfg(rules), { GOLDEN_BALL: false }), ratings: ratingsOf(lg), ids };
}

// assets/logos/MISSING.md: clubs of the league without a crest file -> they get the fallback decal
// (3-letter code on a disc in the club's primary colour, same ring; render/draw.js). No crest is downloaded
// unless Max explicitly authorises it in a session.
function writeMissingLogos(C) {
  const miss = C.teams.filter((t) => !t.logoFile);
  const lines = ['# Sigle lipsă (Premier League)', '',
    `Pentru aceste ${miss.length} cluburi nu există fișier în \`assets/logos/\`, așa că pe bile apare **decalul de rezervă**: codul de 3 litere pe un disc în culoarea principală a clubului (bila, mărimea și inelul rămân la fel).`,
    'Dacă vrei sigla adevărată: pune fișierul PNG ca `assets/logos/<id>.png` (numele = id-ul clubului) și notează sursa în `assets/logos/manifest.json`. Siglele nu se descarcă automat fără acordul tău explicit.', '',
    '| id (nume fișier) | Club | Decal de rezervă | Culoare principală |', '|---|---|---|---|',
    ...miss.map((t) => `| \`${t.id}.png\` | ${t.name} | ${t.short} | ${t.primary} |`), ''];
  const f = path.join(ROOT, 'assets', 'logos', 'MISSING.md');
  fs.writeFileSync(f, lines.join('\n'));
  return { file: f, missing: miss.map((t) => t.id) };
}

module.exports = { loadLeague, ratingsOf, writeMissingLogos, LEAGUE_SCHEMA };
