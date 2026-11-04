'use strict';
// Loads and validates all content config (config/*.json) for one competition.
// Small built-in schema validator -> clear error messages, no extra dependency.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const HEX = /^#[0-9A-Fa-f]{6}$/;

// ---------- schemas ----------
// type: 'string' | 'number' | 'integer' | 'boolean' | 'hex' | 'array' | 'object'
const PLAYERS = { type: 'array', minItems: 3, maxItems: 3, items: { type: 'object', required: ['name', 'number'],
  props: { name: { type: 'string', minLen: 2, maxLen: 24 }, number: { type: 'integer', min: 1, max: 99 }, position: { type: 'string' },
    source_url: { type: 'string', pattern: /^https?:\/\// }, retrieved: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/ }, verified: { type: 'boolean' }, number_note: { type: 'string' } } } };
const S = {
  team: {
    type: 'object', required: ['id', 'name', 'primary', 'secondary', 'strength', 'players'],
    props: {
      id: { type: 'string', pattern: /^[a-z0-9_]+$/ }, name: { type: 'string', minLen: 1, maxLen: 40 }, short: { type: 'string', maxLen: 4 },
      short_name: { type: 'string', minLen: 1, maxLen: 14 }, // compact name for small bracket boxes (default = name)
      national: { type: 'boolean' }, // national team: the ball decal is the flag (logos_on_balls)
      colours_verified: { type: 'boolean' }, logo: { type: 'string', pattern: /^[a-z0-9_.-]+\.png$/ }, // file in assets/logos (default <id>.png)
      primary: { type: 'hex' }, secondary: { type: 'hex' }, strength: { type: 'number', min: 1, max: 100 },
      players: PLAYERS,
      fictional_players: PLAYERS, // used when the competition sets real_names: false
    },
  },
  map: {
    type: 'object', required: ['id', 'sky', 'rock', 'grass'],
    props: {
      id: { type: 'string' }, name: { type: 'string' },
      sky: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'hex' } },
      rock: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'hex' } },
      grass: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'hex' } },
      grass_blades: { type: 'hex' },
      // P3 theme parameters (visual only; the physics layout is identical for every theme)
      scenery: { type: 'string', enum: ['none', 'stadium', 'sunset'] }, night: { type: 'boolean' },
      stand: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'hex' } }, floodlight: { type: 'hex' },
      sun: { type: 'hex' }, hills: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'hex' } },
      windmill: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'hex' } },
      keeper: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'hex' } },
      music: { type: 'object', props: { transpose: { type: 'integer', min: -7, max: 7 }, bpm: { type: 'number', min: 90, max: 130 },
        progression: { type: 'string', enum: ['v2', 'open', 'stride', 'warm'] }, arp: { type: 'string', enum: ['up', 'down', 'wave'] } } },
    },
  },
  rules: {
    type: 'object', required: ['BALLS_PER_TEAM', 'GAME_MIN_PER_SEC', 'ADDED_MIN', 'boost', 'golden_ball'],
    props: {
      BALLS_PER_TEAM: { type: 'integer', min: 3, max: 3 },
      GAME_MIN_PER_SEC: { type: 'number', min: 0.5, max: 6 },
      ADDED_MIN: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'integer', min: 0, max: 3 } },
      windmill_fast_from_min: { type: 'number', min: 0, max: 90 }, // P5: game minute where the windmill speed-up is centred (was windmill_boost_from: 70)
      windmill_boost_ramp_half: { type: 'number', min: 0, max: 10 }, // P5: half width of the smooth ramp (game minutes)
      windmill_boost_from: { type: 'number', min: 0, max: 90 },   // legacy name (pre-P5), used only if windmill_fast_from_min is missing
      windmill_boost_ramp: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number', min: 0, max: 90 } },
      boost: { type: 'number', min: 1, max: 1.6 },
      golden_ball: { type: 'boolean' },
      GOALS_MIN: { type: 'integer', min: 0, max: 20 }, GOALS_MAX: { type: 'integer', min: 1, max: 20 },
      ball_radius: { type: 'number', min: 14, max: 20 },   // P2: ONE radius for every ball of every team (design px)
      logos_on_balls: { type: 'boolean' },                  // P2: team crest printed on the ball (false = colour-only ball)
      strength_edge: { type: 'number', min: 0, max: 0.5 },  // P2: invisible strength lever (release-turn probability)
      show_simulation_label: { type: 'boolean' },            // P5: small SIMULATION pill on screen (default false = no label)
    },
  },
  audio: {
    type: 'object', required: ['goal_sfx'],
    props: { goal_sfx: { type: 'string', enum: ['A', 'B', 'C', 'v2_A', 'v2_B', 'v2_C'] }, music_seed: { type: 'integer', min: 0 } },
  },
  competition: {
    type: 'object', required: ['id', 'name', 'format', 'teams', 'map', 'rules'],
    props: {
      id: { type: 'string' }, name: { type: 'string', minLen: 1, maxLen: 30 }, subtitle: { type: 'string' },
      format: { type: 'string', enum: ['semis_two_legs_final', 'knockout16'] },
      teams: { type: 'array', minItems: 4, maxItems: 16, items: { type: 'string' } },
      pairing: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'integer', min: 0, max: 3 } } },
      map: { type: 'string' }, rules: { type: 'string' }, output: { type: 'string' }, screenshots: { type: 'string' },
      real_names: { type: 'boolean' }, bracket_style: { type: 'string', enum: ['left_to_right', 'symmetric'] },
      // P2 (knockout16)
      preview_output: { type: 'string' }, output_dir: { type: 'string' },
      GAME_MIN_PER_SEC: { type: 'number', min: 0.5, max: 6 },          // overrides rules.GAME_MIN_PER_SEC
      strength_from_position: { type: 'boolean' },                     // strength derived from the teams order (league position)
      placeholder: { type: 'boolean' },                                 // true = team list is a placeholder, to be replaced by Max
      standings: { type: 'object', required: ['source_url', 'retrieved'], props: {
        source_url: { type: 'string', pattern: /^https?:\/\// }, retrieved: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/ }, note: { type: 'string' },
        table: { type: 'array', items: { type: 'object', required: ['pos', 'team'], props: { pos: { type: 'integer', min: 1, max: 36 }, team: { type: 'string' }, fifa_rank: { type: 'integer', min: 1, max: 211 }, club: { type: 'string' }, played: { type: 'integer', min: 0, max: 8 }, points: { type: 'integer', min: 0, max: 24 }, gd: { type: 'integer', min: -60, max: 60 } } } } } },
      draw_seed: { type: 'integer', min: 0 }, // P5: optional fixed seed of the bracket draw (default: derived from id + seed_salt + map)
      seed_salt: { type: 'integer', min: 0, max: 999 }, // P3: offsets the seed search so different competitions never replay the same matches
      forced_pairs: { type: 'array', maxItems: 4, items: { type: 'object', required: ['a', 'b'], props: { a: { type: 'string' }, b: { type: 'string' }, round: { type: 'string', enum: ['R16', 'QF'] } } } },
    },
  },
};

function validate(val, sch, where, errs) {
  const bad = (msg) => errs.push(`${where}: ${msg}`);
  switch (sch.type) {
    case 'string':
      if (typeof val !== 'string') return bad(`must be a text string, got ${JSON.stringify(val)}`);
      if (sch.minLen && val.length < sch.minLen) bad(`too short (min ${sch.minLen} characters)`);
      if (sch.maxLen && val.length > sch.maxLen) bad(`too long (max ${sch.maxLen} characters)`);
      if (sch.pattern && !sch.pattern.test(val)) bad(`invalid format "${val}" (expected ${sch.pattern})`);
      if (sch.enum && !sch.enum.includes(val)) bad(`must be one of ${sch.enum.join(', ')}, got "${val}"`);
      return;
    case 'hex':
      if (typeof val !== 'string' || !HEX.test(val)) bad(`must be a colour like "#1A2B3C", got ${JSON.stringify(val)}`);
      return;
    case 'number': case 'integer':
      if (typeof val !== 'number' || !Number.isFinite(val)) return bad(`must be a number, got ${JSON.stringify(val)}`);
      if (sch.type === 'integer' && !Number.isInteger(val)) bad(`must be a whole number, got ${val}`);
      if (sch.min !== undefined && val < sch.min) bad(`must be >= ${sch.min}, got ${val}`);
      if (sch.max !== undefined && val > sch.max) bad(`must be <= ${sch.max}, got ${val}`);
      return;
    case 'boolean':
      if (typeof val !== 'boolean') bad(`must be true or false, got ${JSON.stringify(val)}`);
      return;
    case 'array':
      if (!Array.isArray(val)) return bad(`must be a list [...], got ${JSON.stringify(val)}`);
      if (sch.minItems !== undefined && val.length < sch.minItems) bad(`needs at least ${sch.minItems} items, has ${val.length}`);
      if (sch.maxItems !== undefined && val.length > sch.maxItems) bad(`allows at most ${sch.maxItems} items, has ${val.length}`);
      val.forEach((v, i) => validate(v, sch.items, `${where}[${i}]`, errs));
      return;
    case 'object':
      if (!val || typeof val !== 'object' || Array.isArray(val)) return bad('must be an object {...}');
      for (const k of sch.required || []) if (!(k in val)) bad(`missing required field "${k}"`);
      for (const k of Object.keys(val)) {
        if (k.startsWith('_') || k.startsWith('$')) continue; // comments
        if (!sch.props[k]) { bad(`unknown field "${k}" (allowed: ${Object.keys(sch.props).join(', ')})`); continue; }
        validate(val[k], sch.props[k], `${where}.${k}`, errs);
      }
      return;
    default: throw new Error('schema type ' + sch.type);
  }
}

function readJson(file) {
  if (!fs.existsSync(file)) throw new ConfigError([`file not found: ${path.relative(ROOT, file)}`]);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new ConfigError([`${path.relative(ROOT, file)}: invalid JSON (${e.message})`]); }
}
class ConfigError extends Error { constructor(errs) { super('Configuration error:\n  - ' + errs.join('\n  - ')); this.errors = errs; } }

function check(obj, schemaName, file) {
  const errs = [];
  validate(obj, S[schemaName], path.relative(ROOT, file).replace(/\\/g, '/'), errs);
  if (errs.length) throw new ConfigError(errs);
  return obj;
}

// ---------- colour helpers (CIE76) ----------
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToLab([r, g, b]) {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const R = lin(r), Gc = lin(g), B = lin(b);
  const X = (R * 0.4124 + Gc * 0.3576 + B * 0.1805) / 0.95047;
  const Y = (R * 0.2126 + Gc * 0.7152 + B * 0.0722) / 1.0;
  const Z = (R * 0.0193 + Gc * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
function deltaE76(h1, h2) { const a = rgbToLab(hexToRgb(h1)), b = rgbToLab(hexToRgb(h2)); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
const CONTRAST_MIN_DE = 30;

// Kit colours for one match. If primaries are too similar, team B swaps to its secondary as primary
// (fallback: team A swaps). Returns { A:{primary,secondary,swapped}, B:{...}, dE, note }.
// ring = the identifying colour of the ball: the kit primary, or (logo balls on a white base) the secondary when the
// primary is near-white; NEUTRAL_RING only when no kit combination gives enough contrast.
const NEUTRAL_RING = '#1F2A38';
function lumHex(h) { const [r, g, b] = hexToRgb(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }
function ringOf(kit, logos) { return logos && lumHex(kit.primary) > 0.8 ? kit.secondary : kit.primary; }
function matchKits(teamA, teamB, opts) {
  const logos = !!(opts && opts.logos);
  const kit = (t, sw) => { const k = { team: t.id, primary: sw ? t.secondary : t.primary, secondary: sw ? t.primary : t.secondary, swapped: !!sw }; k.ring = ringOf(k, logos); return k; };
  const a0 = kit(teamA, false), b0 = kit(teamB, false);
  const d0 = deltaE76(a0.ring, b0.ring);
  if (d0 >= CONTRAST_MIN_DE) return { A: a0, B: b0, dE: +d0.toFixed(1), note: null };
  const options = [[false, true], [true, false], [true, true]];
  for (const [sa, sb] of options) {
    const a = kit(teamA, sa), b = kit(teamB, sb);
    const d = deltaE76(a.ring, b.ring);
    if (d >= CONTRAST_MIN_DE) return { A: a, B: b, dE: +d.toFixed(1), dE0: +d0.toFixed(1), note: `${sb ? teamB.name : teamA.name} plays in secondary colour (dE ${d0.toFixed(1)} -> ${d.toFixed(1)})` };
  }
  if (logos) {
    const b = Object.assign({}, b0, { ring: NEUTRAL_RING }); const d = deltaE76(a0.ring, b.ring);
    if (d >= CONTRAST_MIN_DE) return { A: a0, B: b, dE: +d.toFixed(1), dE0: +d0.toFixed(1), note: `${teamB.name} ball ring in neutral dark (no kit combination contrasts, dE ${d0.toFixed(1)} -> ${d.toFixed(1)})` };
  }
  return { A: a0, B: b0, dE: +d0.toFixed(1), note: `WARNING: no contrasting combination (dE ${d0.toFixed(1)})` };
}

// ---------- load everything for a competition ----------
function loadCompetition(compFile, opts) {
  opts = opts || {};
  const cfgDir = opts.configDir || path.join(ROOT, 'config');
  compFile = path.resolve(compFile || path.join(cfgDir, 'competitions', 'demo_4teams.json'));
  const comp = check(readJson(compFile), 'competition', compFile);
  const errs = [];
  const teams = comp.teams.map((id) => {
    const f = path.join(cfgDir, 'teams', id + '.json');
    const t = check(readJson(f), 'team', f);
    if (t.id !== id) errs.push(`${path.relative(ROOT, f)}: id "${t.id}" does not match file name "${id}"`);
    const nums = t.players.map((p) => p.number);
    if (new Set(nums).size !== nums.length) errs.push(`${path.relative(ROOT, f)}: duplicate shirt numbers`);
    if (comp.real_names === false) {
      if (!t.fictional_players) errs.push(`${path.relative(ROOT, f)}: real_names is false but "fictional_players" is missing`);
      else t.players = t.fictional_players;
    }
    return t;
  });
  if (new Set(comp.teams).size !== comp.teams.length) errs.push('competition: the same team is listed twice');
  const NT = { semis_two_legs_final: 4, knockout16: 16 }[comp.format];
  if (comp.teams.length !== NT) errs.push(`competition: format "${comp.format}" needs exactly ${NT} teams, has ${comp.teams.length}`);
  if (comp.format === 'semis_two_legs_final') {
    if (!comp.pairing) errs.push('competition.pairing is required for semis_two_legs_final');
    else if (new Set(comp.pairing.flat()).size !== 4) errs.push('competition.pairing must use each team index 0..3 exactly once');
  }
  for (const fp of comp.forced_pairs || []) for (const id of [fp.a, fp.b]) if (!comp.teams.includes(id)) errs.push(`competition.forced_pairs: team "${id}" is not in the competition`);
  // strength derived from the league position (illustrative; never visible): 1st = 92, 16th = 77
  if (comp.strength_from_position) teams.forEach((t, i) => { t.strength = 92 - i; });
  const logoDir = opts.logoDir || path.join(ROOT, 'assets', 'logos');
  teams.forEach((t) => { const f = path.join(logoDir, t.logo || t.id + '.png'); t.logoFile = fs.existsSync(f) ? f : null; });
  const mapF = path.join(cfgDir, 'maps', (opts.map || comp.map) + '.json'); // --map overrides the competition's theme
  const map = check(readJson(mapF), 'map', mapF);
  const rulesF = path.join(cfgDir, 'rules', comp.rules + '.json');
  const rules = check(readJson(rulesF), 'rules', rulesF);
  if (rules.ADDED_MIN[0] > rules.ADDED_MIN[1]) errs.push('rules.ADDED_MIN must be [min, max] with min <= max');
  if (comp.GAME_MIN_PER_SEC !== undefined) rules.GAME_MIN_PER_SEC = comp.GAME_MIN_PER_SEC; // competition override
  const audioF = path.join(cfgDir, 'audio.json');
  const audio = check(readJson(audioF), 'audio', audioF);
  if (errs.length) throw new ConfigError(errs);
  const all = { competition: comp, teams, map, rules, audio };
  // P5 bracket draw seed: fixed by competition.draw_seed, else derived from competition id + seed_salt + map,
  // so the same run (preview and final) gets the same draw and another competition/map gets another draw
  const mapName = opts.map || comp.map;
  all.drawSeed = comp.draw_seed !== undefined ? comp.draw_seed
    : parseInt(crypto.createHash('sha256').update(`${comp.id}|${comp.seed_salt || 0}|${mapName}`).digest('hex').slice(0, 8), 16);
  // sim hash: only what changes the simulation (render cache key = simHash + seed)
  const simPart = { engine: require('./config').ENGINE_VERSION, rules: Object.assign({}, rules, { logos_on_balls: undefined, show_simulation_label: undefined }), pairing: comp.pairing, format: comp.format,
    teams: comp.teams, draw: all.drawSeed, forced: comp.forced_pairs || [], ...(comp.seed_salt ? { salt: comp.seed_salt } : {}), strength: teams.map((t) => t.strength) };
  all.simHash = crypto.createHash('sha256').update(JSON.stringify(simPart)).digest('hex').slice(0, 16);
  all.hash = crypto.createHash('sha256').update(JSON.stringify(all)).digest('hex').slice(0, 16);
  all.compFile = compFile;
  return all;
}

// rules/base.json -> engine config keys
const fastFrom = (r) => (r.windmill_fast_from_min !== undefined ? r.windmill_fast_from_min : r.windmill_boost_from !== undefined ? r.windmill_boost_from : 60);
const rampHalf = (r) => (r.windmill_boost_ramp_half !== undefined ? r.windmill_boost_ramp_half : 2);
function rulesToCfg(rules) {
  return {
    BALLS_PER_TEAM: rules.BALLS_PER_TEAM,
    GAME_MIN_PER_SEC: rules.GAME_MIN_PER_SEC,
    ADDED_MIN: rules.ADDED_MIN.slice(),
    BOOST_FROM: fastFrom(rules),
    BOOST_RAMP: rules.windmill_boost_ramp ? rules.windmill_boost_ramp.slice() : [fastFrom(rules) - rampHalf(rules), fastFrom(rules) + rampHalf(rules)],
    BOOST: rules.boost,
    GOLDEN_BALL: rules.golden_ball,
    GOALS_MIN: rules.GOALS_MIN !== undefined ? rules.GOALS_MIN : 1,
    GOALS_MAX: rules.GOALS_MAX !== undefined ? rules.GOALS_MAX : 10,
    BALL_RADIUS: rules.ball_radius !== undefined ? rules.ball_radius : 18,
    STRENGTH_EDGE: rules.strength_edge !== undefined ? rules.strength_edge : 0.15,
  };
}

module.exports = { loadCompetition, rulesToCfg, matchKits, ringOf, NEUTRAL_RING, deltaE76, hexToRgb, ConfigError, validate, SCHEMAS: S, CONTRAST_MIN_DE };
