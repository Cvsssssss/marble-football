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
const S = {
  team: {
    type: 'object', required: ['id', 'name', 'primary', 'secondary', 'strength', 'players'],
    props: {
      id: { type: 'string', pattern: /^[a-z0-9_]+$/ }, name: { type: 'string', minLen: 1, maxLen: 40 }, short: { type: 'string', maxLen: 4 },
      primary: { type: 'hex' }, secondary: { type: 'hex' }, strength: { type: 'number', min: 1, max: 100 },
      players: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'object', required: ['name', 'number'],
        props: { name: { type: 'string', minLen: 2, maxLen: 24 }, number: { type: 'integer', min: 1, max: 99 } } } },
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
    },
  },
  rules: {
    type: 'object', required: ['BALLS_PER_TEAM', 'GAME_MIN_PER_SEC', 'ADDED_MIN', 'windmill_boost_from', 'boost', 'golden_ball'],
    props: {
      BALLS_PER_TEAM: { type: 'integer', min: 3, max: 3 },
      GAME_MIN_PER_SEC: { type: 'number', min: 0.5, max: 6 },
      ADDED_MIN: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'integer', min: 0, max: 3 } },
      windmill_boost_from: { type: 'number', min: 0, max: 90 },
      windmill_boost_ramp: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number', min: 0, max: 90 } },
      boost: { type: 'number', min: 1, max: 1.6 },
      golden_ball: { type: 'boolean' },
      GOALS_MIN: { type: 'integer', min: 0, max: 20 }, GOALS_MAX: { type: 'integer', min: 1, max: 20 },
    },
  },
  audio: {
    type: 'object', required: ['goal_sfx'],
    props: { goal_sfx: { type: 'string', enum: ['A', 'B', 'C'] }, music_seed: { type: 'integer', min: 0 } },
  },
  competition: {
    type: 'object', required: ['id', 'name', 'format', 'teams', 'pairing', 'map', 'rules'],
    props: {
      id: { type: 'string' }, name: { type: 'string', minLen: 1, maxLen: 30 }, subtitle: { type: 'string' },
      format: { type: 'string', enum: ['semis_two_legs_final'] },
      teams: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string' } },
      pairing: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'integer', min: 0, max: 3 } } },
      map: { type: 'string' }, rules: { type: 'string' }, output: { type: 'string' }, screenshots: { type: 'string' },
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
function matchKits(teamA, teamB) {
  const kit = (t, sw) => ({ primary: sw ? t.secondary : t.primary, secondary: sw ? t.primary : t.secondary, swapped: !!sw });
  const d0 = deltaE76(teamA.primary, teamB.primary);
  if (d0 >= CONTRAST_MIN_DE) return { A: kit(teamA, false), B: kit(teamB, false), dE: +d0.toFixed(1), note: null };
  const options = [[false, true], [true, false], [true, true]];
  for (const [sa, sb] of options) {
    const a = kit(teamA, sa), b = kit(teamB, sb);
    const d = deltaE76(a.primary, b.primary);
    if (d >= CONTRAST_MIN_DE) return { A: a, B: b, dE: +d.toFixed(1), dE0: +d0.toFixed(1), note: `${sb ? teamB.name : teamA.name} plays in secondary colour (dE ${d0.toFixed(1)} -> ${d.toFixed(1)})` };
  }
  return { A: kit(teamA, false), B: kit(teamB, false), dE: +d0.toFixed(1), note: `WARNING: no contrasting combination (dE ${d0.toFixed(1)})` };
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
    return t;
  });
  if (new Set(comp.teams).size !== comp.teams.length) errs.push('competition: the same team is listed twice');
  const flat = comp.pairing.flat();
  if (new Set(flat).size !== 4) errs.push('competition.pairing must use each team index 0..3 exactly once');
  const mapF = path.join(cfgDir, 'maps', comp.map + '.json');
  const map = check(readJson(mapF), 'map', mapF);
  const rulesF = path.join(cfgDir, 'rules', comp.rules + '.json');
  const rules = check(readJson(rulesF), 'rules', rulesF);
  if (rules.ADDED_MIN[0] > rules.ADDED_MIN[1]) errs.push('rules.ADDED_MIN must be [min, max] with min <= max');
  const audioF = path.join(cfgDir, 'audio.json');
  const audio = check(readJson(audioF), 'audio', audioF);
  if (errs.length) throw new ConfigError(errs);
  const all = { competition: comp, teams, map, rules, audio };
  // sim hash: only what changes the simulation (render cache key = simHash + seed)
  const simPart = { rules, pairing: comp.pairing, format: comp.format, strength: teams.map((t) => t.strength) };
  all.simHash = crypto.createHash('sha256').update(JSON.stringify(simPart)).digest('hex').slice(0, 16);
  all.hash = crypto.createHash('sha256').update(JSON.stringify(all)).digest('hex').slice(0, 16);
  all.compFile = compFile;
  return all;
}

// rules/base.json -> engine config keys
function rulesToCfg(rules) {
  return {
    BALLS_PER_TEAM: rules.BALLS_PER_TEAM,
    GAME_MIN_PER_SEC: rules.GAME_MIN_PER_SEC,
    ADDED_MIN: rules.ADDED_MIN.slice(),
    BOOST_FROM: rules.windmill_boost_from,
    BOOST_RAMP: rules.windmill_boost_ramp ? rules.windmill_boost_ramp.slice() : [rules.windmill_boost_from - 2, rules.windmill_boost_from + 2],
    BOOST: rules.boost,
    GOLDEN_BALL: rules.golden_ball,
    GOALS_MIN: rules.GOALS_MIN !== undefined ? rules.GOALS_MIN : 1,
    GOALS_MAX: rules.GOALS_MAX !== undefined ? rules.GOALS_MAX : 10,
  };
}

module.exports = { loadCompetition, rulesToCfg, matchKits, deltaE76, hexToRgb, ConfigError, validate, SCHEMAS: S, CONTRAST_MIN_DE };
