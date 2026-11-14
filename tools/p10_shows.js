'use strict';
// P10 helper (NO video): the matchweek-1 and finale shows of the scratch season, cached as JSON in build/p10/ so tests
// and still tools do not re-simulate 20 matches every time. The cache key is the hash of every file that shapes a
// show (league show builder, atmosphere, config, maps); a change of any of them rebuilds.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const FILES = ['sim/league/show.js', 'sim/atmosphere.js', 'sim/engine.js', 'sim/good_hit.js', 'config/atmosphere.json', 'config/leagues/premier_league_2026_27.json', 'tools/p7_stills.js']
  .concat(fs.readdirSync(path.join(ROOT, 'config', 'maps')).map((f) => 'config/maps/' + f));
function key(extra) { const h = crypto.createHash('sha256'); for (const f of FILES) h.update(fs.readFileSync(path.join(ROOT, f))); h.update(JSON.stringify(extra || {})); return h.digest('hex').slice(0, 12); }
async function shows(opts) {
  opts = opts || {};
  const dir = path.join(ROOT, 'build', 'p10'); fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `shows_${key(opts)}.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const P7S = require('./p7_stills');
  const SH = require('../sim/league/show');
  const { C, week, finale } = await P7S.shows();
  const out = { week, finale, maps: {} };
  for (const id of opts.maps || []) out.maps[id] = SH.buildMatchweekShow(C, 1, { dir: path.join(ROOT, 'build', 'p7_scratch'), map: id });
  for (const old of fs.readdirSync(dir).filter((x) => x.startsWith('shows_'))) fs.unlinkSync(path.join(dir, old));
  fs.writeFileSync(f, JSON.stringify(out));
  return out;
}
module.exports = { shows };
