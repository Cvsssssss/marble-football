'use strict';
// P6 player validator (startup + tests).
//   - every team has exactly 3 players with name, team, nationality, position, source_url, retrieved, verified
//   - player.team equals the team's name; national teams: nationality equals the nation
//   - no player name in two teams of the same competition
//   - retrieved within MAX_AGE_DAYS of today
//   - every goal's scorer belongs to the scoring team (assertScorers, run on every generated tournament)
// Usage: node sim/players.js   (checks all competitions, prints unverified entries)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const MAX_AGE_DAYS = 120;

const ageDays = (iso, today) => Math.floor((Date.parse(today) - Date.parse(iso)) / 86400000);
function todayIso() { return new Date().toISOString().slice(0, 10); }

// teams: loaded team configs (config/teams/*.json). Returns { errors: [], unverified: [] }
function validateTeams(teams, opts) {
  opts = opts || {};
  const today = opts.today || todayIso();
  const errors = [], unverified = [];
  const seen = new Map();
  for (const t of teams) {
    const where = `config/teams/${t.id}.json`;
    if (!Array.isArray(t.players) || t.players.length !== 3) { errors.push(`${where}: needs exactly 3 players`); continue; }
    t.players.forEach((p, i) => {
      const w = `${where} players[${i}] (${p.name})`;
      for (const k of ['name', 'team', 'nationality', 'position', 'source_url', 'retrieved']) if (!p[k]) errors.push(`${w}: missing "${k}"`);
      if (typeof p.verified !== 'boolean') errors.push(`${w}: missing "verified" (true/false)`);
      if (p.team && p.team !== t.name) errors.push(`${w}: team is "${p.team}" but the file is ${t.name}`);
      if (t.national && p.nationality && p.nationality !== t.name) errors.push(`${w}: nationality "${p.nationality}" is not ${t.name}`);
      if (p.retrieved) { const a = ageDays(p.retrieved, today); if (!(a <= MAX_AGE_DAYS)) errors.push(`${w}: data retrieved ${p.retrieved} is older than ${MAX_AGE_DAYS} days - check the squad again`); }
      if (p.verified === false || /to confirm/.test(p.note || '')) unverified.push({ team: t.name, name: p.name, why: p.note || 'not verified' });
      const k = p.name.toLowerCase();
      if (seen.has(k) && seen.get(k) !== t.id) errors.push(`${w}: ${p.name} is also listed for ${seen.get(k)} in the same competition`);
      seen.set(k, t.id);
    });
  }
  return { errors, unverified };
}

// T = tournament (sim/tournament.js) with teams[].players[] carrying `team`; teamsConf = loaded team configs in the same order
function assertScorers(T, teamsConf) {
  const bad = [];
  T.matches.forEach((m, mi) => m.goals.forEach((g) => {
    const ti = g.team === 'A' ? m.ta : m.tb;
    const team = teamsConf[ti], p = team && team.players[g.player];
    if (!p || (p.team && p.team !== team.name)) bad.push(`match ${mi}: goal by player ${g.player} of ${team ? team.name : ti} (${p ? p.name + ' / ' + p.team : 'no such player'})`);
  }));
  if (bad.length) throw new Error('scorer does not belong to the scoring team:\n  ' + bad.join('\n  '));
  return true;
}

function validateAll(opts) {
  const L = require('./config_loader');
  const dir = path.join(ROOT, 'config', 'competitions');
  const out = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const conf = L.loadCompetition(path.join(dir, f), { skipPlayerCheck: true });
    out[conf.competition.id] = Object.assign({ name: conf.competition.name, teams: conf.teams.length }, validateTeams(conf.teams, opts));
  }
  return out;
}

module.exports = { validateTeams, assertScorers, validateAll, MAX_AGE_DAYS };
if (require.main === module) {
  const r = validateAll();
  let bad = 0;
  for (const [id, v] of Object.entries(r)) {
    console.log(`${id} (${v.name}): ${v.errors.length ? v.errors.length + ' ERRORS' : 'OK'}, unverified ${v.unverified.length}`);
    v.errors.forEach((e) => console.log('  ERROR ' + e)); bad += v.errors.length;
    v.unverified.forEach((u) => console.log(`  needs check: ${u.team} - ${u.name} (${u.why})`));
  }
  process.exit(bad ? 1 : 0);
}
