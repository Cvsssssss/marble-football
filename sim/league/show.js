'use strict';
// P7 §5/§6: matchweek show (the same show.json format render/draw.js and audio/make_audio.py read).
// The week's matches are re-simulated from the seeds saved in results/week_NN.json; every timeline hash must equal
// the saved one (same config + seed -> same match), otherwise the build stops.
// Timeline:
//   lgIntro (fixtures grid) -> per match: lgPre (positions + last-5 form) -> match -> fulltime (result flash)
//   -> replay (best goal) -> motm -> lgTable (animated live-table update, rows slide, points count up)
//   -> end: lgTableFull (zones) -> lgResults (all 10) -> lgScorers (season top 5) -> lgGotwCard + replay (Goal of the Week)
//   -> lgNext (next matchweek teaser)   | matchweek 38 instead of lgNext: lgChampion -> ceremony (3 angles, 30 s)
//   -> lgEurope (European places + relegated) -> lgBoot (Golden Boot) -> lgPodium -> lgStats.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { simulateMatch } = require('../engine');
const TOUR = require('../tournament');
const CFG = require('../config');
const G = require('../geometry');
const CLOCK = require('../clock');
const L = require('../config_loader');
const ST = require('./strength');
const TB = require('./standings');
const SEASON = require('./season');
const ROOT = path.join(__dirname, '..', '..');
const FPS = CFG.FPS;

// durations (s). Kept short so the video stays in 20-28 min (measured on real weeks: see the P7 report).
const DUR = {
  intro: 10.5, pre: 2.6, fulltime: 2.2, motm: 2.6, table: 5.0, tableFull: 9.0, results: 8.0, scorers: 7.0, gotwCard: 2.4, next: 6.0,
  champion: 5.0, ceremony: 30.0, europe: 8.0, boot: 6.5, podium: 7.5, stats: 8.0,
};
// P8: league video length gate (minutes). Matches play exactly like the cups (~45-50 s), so a normal matchweek is
// ~13-15 min; there is NO 20 min minimum and no filler (Max, 13 Nov 2026). The finale adds the ceremony.
const LENGTH_GATE_MIN = [10, 20];
// ceremony: 3 camera angles (wide stadium, low-angle trophy lift, top-down orbit), seconds inside the 30 s segment
const CEREMONY_SHOTS = [
  { angle: 'wide', from: 0, to: 10 },
  { angle: 'lift', from: 10, to: 20 },
  { angle: 'orbit', from: 20, to: 30 },
];

// Goal of the Week score (documented, deterministic; ties -> later match, then later goal):
//   +3 keeper beaten while airborne, +2 keeper beaten while crouching, +2 winning goal (put the winner ahead for good),
//   +1.5 equaliser, +1 added-time shot, + game minute / 45 (late goals weigh more, 0..~2.1)
function gotwScore(m, gi) {
  const g = m.goals[gi];
  let a = 0, b = 0, eq = false;
  for (let i = 0; i <= gi; i++) { if (m.goals[i].team === 'A') a++; else b++; }
  eq = a === b;
  const dec = m.winnerSide ? decisiveIdx(m) === gi : false;
  const min = Math.min(95, g.t * 2);
  return +((g.keeperAir ? 3 : 0) + (!g.keeperAir && g.keeperCrouch ? 2 : 0) + (dec ? 2 : 0) + (eq ? 1.5 : 0) + (g.shot ? 1 : 0) + min / 45).toFixed(3);
}
function decisiveIdx(m) {
  const w = m.winnerSide; if (!w) return -1;
  let a = 0, b = 0, idx = -1;
  m.goals.forEach((g, i) => { const was = w === 'A' ? a > b : b > a; if (g.team === 'A') a++; else b++; const now = w === 'A' ? a > b : b > a; if (now && !was) idx = i; });
  return idx;
}
function pickGoalOfWeek(matches) {
  let best = null;
  matches.forEach((m, mi) => m.goals.forEach((g, gi) => {
    const s = gotwScore(m, gi);
    if (!best || s > best.score || (s === best.score && (mi > best.match || (mi === best.match && gi > best.goal)))) best = { match: mi, goal: gi, score: s };
  }));
  return best;
}

// compact table rows for the renderer: [teamIndex, pos, p, w, d, l, gf, ga, pts, zoneIndex(-1)]
function packTable(rows, idxOf, zones) {
  return rows.map((r) => [idxOf[r.id], r.pos, r.p, r.w, r.d, r.l, r.gf, r.ga, r.pts, zones.findIndex((z) => z.id === r.zone)]);
}

// season top scorers up to and including `week` (names appear only inside the video)
function seasonScorers(C, week, opts, n) {
  const map = new Map();
  for (let w = 1; w <= week; w++) {
    const wr = JSON.parse(fs.readFileSync(SEASON.resultsFile(C, w, opts), 'utf8'));
    wr.matches.forEach((m, mi) => m.goals.forEach((g, gi) => {
      const k = g.club + ':' + g.player;
      const e = map.get(k) || { club: g.club, player: g.player, name: g.scorer, goals: 0, reached: null };
      e.goals++; e.reached = [w, mi, gi]; map.set(k, e);
    }));
  }
  const cmpR = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  // tie-break: who reached the total first
  return [...map.values()].sort((a, b) => b.goals - a.goals || cmpR(a.reached, b.reached)).slice(0, n || 5);
}

function weekAudioMap(map, week) {
  // every matchweek sounds a little different: transpose / tempo cycle by week (original synthesised music only)
  const mu = Object.assign({ transpose: 0, bpm: 112, progression: 'stride', arp: 'up' }, map.music || {});
  const TR = [0, 2, -1, 3, 1, -2, 4], BP = [0, 4, -3, 6, 2, -5, 3];
  return Object.assign({}, map, { music: Object.assign({}, mu, { transpose: mu.transpose + TR[(week - 1) % TR.length], bpm: mu.bpm + BP[(week - 1) % BP.length] }) });
}

// background image of a map (P7 §7/7b): embedded as a JPEG data URL (a canvas loaded from file:// cannot export pixels
// drawn from file images). Missing file -> null (the renderer draws the procedural stadium).
function backgroundPart(map) {
  if (!map.background_image || map.use_background_image !== true) return null; // P8: image layer off by default (premier maps draw the procedural stadium)
  const f = path.join(ROOT, map.background_image);
  if (!fs.existsSync(f)) return null;
  const ffmpeg = require('ffmpeg-static');
  const h = crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 10);
  const dir = path.join(ROOT, 'build', 'backgrounds'); fs.mkdirSync(dir, { recursive: true });
  const dst = path.join(dir, `${path.basename(f, path.extname(f))}_${h}.jpg`);
  if (!fs.existsSync(dst)) require('child_process').execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', f, '-q:v', '2', dst]);
  const b = fs.readFileSync(f);
  const size = b.slice(0, 8).toString('hex') === '89504e470d0a1a0a' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null;
  return { src: 'data:image/jpeg;base64,' + fs.readFileSync(dst).toString('base64'), file: map.background_image, size, hash: h };
}

function loadMap(id) {
  const f = path.join(ROOT, 'config', 'maps', id + '.json');
  if (!fs.existsSync(f)) throw new SEASON.LeagueError(`map ${id} does not exist (config/maps/)`);
  const map = JSON.parse(fs.readFileSync(f, 'utf8'));
  const errs = []; L.validate(map, L.SCHEMAS.map, `config/maps/${id}.json`, errs);
  if (errs.length) throw new L.ConfigError(errs);
  return map;
}

// opts: { dir, map (override), finale (default week === 38), noBackground }
function buildMatchweekShow(C, week, opts) {
  opts = opts || {};
  const wr = JSON.parse(fs.readFileSync(SEASON.resultsFile(C, week, opts), 'utf8'));
  if (wr.stub) throw new SEASON.LeagueError(`matchweek ${week} has stub results (rehearsal): no video can be made from it`);
  const fx = SEASON.loadOrCreateFixtures(C, opts);
  const lg = C.league;
  const teams = TOUR.teamsFromConf({ teams: C.teams, competition: {} });
  const idxOf = Object.fromEntries(C.ids.map((id, i) => [id, i]));
  const rat = (id) => C.ratings[C.ids.indexOf(id)];
  const R = C.rc.BALL_RADIUS;
  const logos = C.rules.logos_on_balls !== false;
  const stage = `MATCHWEEK ${week}`;
  // ---- re-simulate the week (same seed + ctx + rules -> same timeline hash) ----
  const matches = wr.matches.map((res, k) => {
    const ctx = ST.leagueCtx(lg.strength, rat(res.home), rat(res.away), R);
    const r = simulateMatch(res.seed, ctx, C.rc);
    if (r.hash !== res.timeline_hash) throw new SEASON.LeagueError(`match ${res.home}-${res.away}: re-simulation hash differs from results (config changed?). Etapa a fost generată cu reguli vechi: regenereaz-o (START → 7 → 2)`);
    if (r.score.A !== res.hg || r.score.B !== res.ag) throw new SEASON.LeagueError(`match ${res.home}-${res.away}: score differs from results`);
    const ta = idxOf[res.home], tb = idxOf[res.away];
    const kits = L.matchKits(C.teams[ta], C.teams[tb], { logos });
    const score = [r.score.A, r.score.B];
    const winnerSide = score[0] > score[1] ? 'A' : score[1] > score[0] ? 'B' : null;
    const c = TOUR.comebackInfo('league', r.goals, [0, 0], winnerSide);
    return {
      round: 0, roundKey: 'MW', roundName: stage, tie: k, stage, leg: 'LEAGUE', league: true, week, ta, tb, agg: null, seed: r.seed, hash: r.hash, kind: 'league', prev: [0, 0],
      nextName: null, rA: r.rA, rB: r.rB, addedTime: r.addedTime, regEnd: r.regEnd, endReg: r.endReg, endT: r.endT,
      goldenStart: r.goldenStart, goldenWinner: r.goldenWinner, goldenResolve: r.goldenResolve,
      score, goals: r.goals, events: r.events, frames: r.frames, stuckCount: r.stuckCount, replayGoal: TOUR.pickReplayGoal(r),
      kits: { A: kits.A, B: kits.B }, kitDE: kits.dE, kitNote: kits.note, motm: TOUR.manOfTheMatch(r.goals, score, null),
      launches: r.launches, strength: { fav: r.ctx.fav || null, edge: r.ctx.edge || 0 },
      shots: r.shots, shotStarts: r.shotStarts, shotContacts: r.shotContacts, cines: r.cines,
      winnerSide, comeback: c.comeback, comeback_depth: c.depth,
    };
  });
  // scorer of every goal must be a player of the scoring club (CLAUDE.md)
  for (const m of matches) for (const g of m.goals) {
    const ti = g.team === 'A' ? m.ta : m.tb, P = teams[ti].players[g.player];
    if (!P || P.team !== teams[ti].name) throw new SEASON.LeagueError(`scorer of a ${teams[ti].name} goal is not a ${teams[ti].name} player`);
  }
  // ---- tables: before the week, then live after each match ----
  const before = SEASON.allResults(C, week - 1, opts);
  const tables = [];
  const played = [];
  tables.push(TB.table(C.ids, before, lg));
  matches.forEach((m) => { played.push({ home: C.ids[m.ta], away: C.ids[m.tb], hg: m.score[0], ag: m.score[1] }); tables.push(TB.table(C.ids, before.concat(played), lg)); });
  const zones = lg.zones.map((z) => ({ id: z.id, label: z.label, from: z.from, to: z.to, colour: z.colour }));
  const T0 = tables[0];
  const rowOf = (tbl, id) => tbl.find((r) => r.id === id);
  const scorers = seasonScorers(C, week, opts, 5).map((e) => ({ team: idxOf[e.club], player: e.player, goals: e.goals }));
  const finale = opts.finale !== undefined ? opts.finale : week === 38;
  const nextWeek = week < 38 ? fx.weeks[week].matches.map((x) => [idxOf[x.home], idxOf[x.away]]) : null;

  // ---- timeline ----
  const segs = [], audio = [], chapters = [];
  let f = 0;
  const add = (type, sec, extra) => { const len = Math.round(sec * FPS); const s = Object.assign({ type, start: f, len }, extra || {}); segs.push(s); f += len; return s; };
  const at = (frame, type, extra) => audio.push(Object.assign({ t: +(frame / FPS).toFixed(4), type }, extra || {}));
  const chap = (seg, title) => chapters.push({ t: seg.start / FPS, title });
  const name = (ti) => teams[ti].name;
  const intro = add('lgIntro', DUR.intro, { week, fixtures: matches.map((m) => [m.ta, m.tb]) }); at(intro.start, 'sting_intro'); chap(intro, `Matchweek ${week} fixtures`);
  matches.forEach((m, mi) => {
    const rA = rowOf(T0, C.ids[m.ta]), rB = rowOf(T0, C.ids[m.tb]);
    const pre = add('lgPre', DUR.pre, { match: mi, pos: week === 1 ? [null, null] : [rA.pos, rB.pos], pts: [rA.pts, rB.pts], form: [rA.form.slice(-5), rB.form.slice(-5)] });
    at(pre.start + 8, 'swoosh'); chap(pre, `${name(m.ta)} vs ${name(m.tb)}`);
    const ms = add('match', m.frames.length / FPS, { match: mi }); ms.len = m.frames.length; f = ms.start + ms.len;
    for (const e of m.events) { const x = Object.assign({}, e, { match: mi }); delete x.t; delete x.type; delete x.vf; at(ms.start + (e.vf !== undefined ? e.vf : e.t * FPS), e.type, x); }
    const ft = add('fulltime', DUR.fulltime, { match: mi }); at(ft.start + 2, 'crowd_end');
    if (m.replayGoal !== null) {
      const g = m.goals[m.replayGoal];
      const t0 = Math.max(0.2, g.t - 1.35), t1 = Math.min(m.endT, g.t + 0.55), speed = 0.55;
      const rp = add('replay', (t1 - t0) / speed + 0.3, { match: mi, goal: m.replayGoal, t0, t1, speed });
      at(rp.start, 'replay_in'); at(rp.start + ((g.t - t0) / speed) * FPS, 'replay_goal');
    }
    if (m.motm) { const mm = add('motm', DUR.motm, { match: mi }); at(mm.start, 'swoosh'); }
    const tb = add('lgTable', DUR.table, { match: mi, step: mi + 1, from: packTable(tables[mi], idxOf, zones), to: packTable(tables[mi + 1], idxOf, zones), focus: [m.ta, m.tb] });
    at(tb.start, 'swoosh');
    // zone change pulse sound: a club entered/left a zone
    const zc = tables[mi + 1].some((r) => { const p = rowOf(tables[mi], r.id); return p.zone !== r.zone; });
    if (zc) at(tb.start + Math.round(1.6 * FPS), 'qualify');
  });
  const TF = tables[tables.length - 1];
  const tf = add('lgTableFull', DUR.tableFull, { week, rows: packTable(TF, idxOf, zones), forms: TF.map((r) => r.form.join('')) }); at(tf.start, 'swoosh'); chap(tf, `Table after matchweek ${week}`);
  const rs = add('lgResults', DUR.results, { week, results: matches.map((m) => [m.ta, m.tb, m.score[0], m.score[1]]) }); at(rs.start, 'swoosh'); chap(rs, 'All results');
  const sc = add('lgScorers', DUR.scorers, { week, scorers }); at(sc.start, 'swoosh');
  const gw = pickGoalOfWeek(matches);
  if (gw) {
    const m = matches[gw.match], g = m.goals[gw.goal];
    const card = add('lgGotwCard', DUR.gotwCard, { match: gw.match, goal: gw.goal, score: gw.score }); at(card.start, 'swoosh'); chap(card, 'Goal of the Week');
    const t0 = Math.max(0.2, g.t - 1.6), t1 = Math.min(m.endT, g.t + 0.7), speed = 0.45;
    const rp = add('replay', (t1 - t0) / speed + 0.4, { match: gw.match, goal: gw.goal, t0, t1, speed, gotw: true });
    at(rp.start, 'replay_in'); at(rp.start + ((g.t - t0) / speed) * FPS, 'replay_goal');
  }
  let ceremony = null;
  if (!finale) {
    const nx = add('lgNext', DUR.next, { week: week + 1, fixtures: nextWeek }); at(nx.start, 'swoosh'); chap(nx, `Next: matchweek ${week + 1}`);
  } else {
    const champ = idxOf[TF[0].id];
    const ch = add('lgChampion', DUR.champion, { team: champ, pts: TF[0].pts, rec: [TF[0].w, TF[0].d, TF[0].l], gap: TF[0].pts - TF[1].pts }); at(ch.start, 'fanfare'); chap(ch, 'Champions');
    ceremony = add('ceremony', DUR.ceremony, { team: champ, shots: CEREMONY_SHOTS });
    at(ceremony.start, 'cheer'); at(ceremony.start + Math.round(0.4 * FPS), 'ceremony_sting');
    for (let k = 0; k < 14; k++) at(ceremony.start + Math.round((0.8 + k * 2.05 + (k % 3) * 0.3) * FPS), 'firework', { k });
    at(ceremony.start + Math.round(10.6 * FPS), 'cheer'); at(ceremony.start + Math.round(20.2 * FPS), 'cheer');
    chap(ceremony, 'Trophy ceremony');
    const eu = add('lgEurope', DUR.europe, { rows: packTable(TF, idxOf, zones) }); at(eu.start, 'swoosh'); chap(eu, 'European places and relegation');
    const boot = add('lgBoot', DUR.boot, { scorer: scorers[0] || null }); at(boot.start, 'qualify'); chap(boot, 'Golden Boot');
    const pod = add('lgPodium', DUR.podium, { top: TF.slice(0, 3).map((r) => [idxOf[r.id], r.pts]) }); at(pod.start, 'cheer');
    const all = before.concat(played);
    const goals = all.reduce((a, x) => a + x.hg + x.ag, 0);
    const big = all.reduce((b, x) => (x.hg + x.ag > b.hg + b.ag ? x : b), all[0]);
    const stats = {
      matches: all.length, goals, perMatch: +(goals / all.length).toFixed(2), draws: all.filter((x) => x.hg === x.ag).length,
      homeWins: all.filter((x) => x.hg > x.ag).length, awayWins: all.filter((x) => x.hg < x.ag).length,
      bestAttack: (() => { const r = TF.slice().sort((a, b) => b.gf - a.gf)[0]; return [idxOf[r.id], r.gf]; })(),
      bestDefence: (() => { const r = TF.slice().sort((a, b) => a.ga - b.ga)[0]; return [idxOf[r.id], r.ga]; })(),
      biggest: [idxOf[big.home], idxOf[big.away], big.hg, big.ag],
    };
    const st = add('lgStats', DUR.stats, { stats }); at(st.start, 'swoosh'); chap(st, 'Season stats');
  }
  const map = weekAudioMap(loadMap(opts.map || wr.map), week);
  const bg = opts.noBackground ? null : backgroundPart(map);
  const lp = (() => { const conf = { rules: C.rules, teams: C.teams }; const r = require('../logos').prepareLogos(conf); return { logos: r.logos, logosMissing: r.missing }; })();
  const show = Object.assign({
    geometryNote: 'design space 1280x720', kind: 'league',
    configHash: crypto.createHash('sha256').update(JSON.stringify({ lg: lg.id, week, results: wr.results_hash, map: map.id })).digest('hex').slice(0, 16),
    simHash: wr.results_hash, map, bracketStyle: null, logosOnBalls: logos,
    cfg: { OMEGA: CFG.OMEGA, GAME_MIN_PER_SEC: C.rules.GAME_MIN_PER_SEC, BALLS_PER_TEAM: C.rules.BALLS_PER_TEAM, BALL_RADIUS: C.rules.ball_radius || G.BALL_R, SHOW_SIM_LABEL: C.rules.show_simulation_label === true },
    competition: { id: lg.id, name: lg.display_name, subtitle: `MARBLE FOOTBALL SIMULATION · ${lg.season}` },
    league: { id: lg.id, season: lg.season, week, finale, zones, display_name: lg.display_name },
    background: bg ? { src: bg.src, size: bg.size, hash: bg.hash, file: bg.file } : null,
    teams, matches, topScorers: scorers.slice(0, 3), leagueScorers: scorers, champion: finale ? idxOf[TF[0].id] : null,
    goalOfWeek: gw, ceremony: ceremony ? { start: ceremony.start, len: ceremony.len, shots: CEREMONY_SHOTS } : null,
    fps: FPS, totalFrames: f, segments: segs, audio: audio.sort((a, b) => a.t - b.t), chapters,
  }, lp);
  show.audioCfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'audio.json'), 'utf8'));
  return show;
}

// match index for the run folder (public part without player names)
function matchesIndexLeague(show) {
  const segOf = (type, mi) => show.segments.find((x) => x.type === type && x.match === mi);
  const name = (ti) => show.teams[ti].name;
  return {
    competition: show.competition.name, week: show.league.week, note: 'Computer simulation, not real results. No player names here.', total_s: +(show.totalFrames / show.fps).toFixed(2),
    matches: show.matches.map((m, mi) => {
      const pre = segOf('lgPre', mi), ms = segOf('match', mi), tb = segOf('lgTable', mi);
      return { id: `MW${show.league.week}-M${mi + 1}`, index: mi, stage: m.stage, leg: m.leg, team_a: name(m.ta), team_b: name(m.tb), seed: m.seed, timeline_hash: m.hash, score: m.score,
        winner: m.winnerSide ? name(m.winnerSide === 'A' ? m.ta : m.tb) : null, comeback: m.comeback, comeback_depth: m.comeback_depth,
        goals: m.goals.map((g) => ({ team: name(g.team === 'A' ? m.ta : m.tb), minute: CLOCK.minuteLabel(m, g.t, show.cfg.GAME_MIN_PER_SEC), added_time_shot: !!g.shot })),
        start_s: +(pre.start / show.fps).toFixed(2), match_start_s: +(ms.start / show.fps).toFixed(2), match_end_s: +((ms.start + ms.len) / show.fps).toFixed(2), end_s: +((tb.start + tb.len) / show.fps).toFixed(2) };
    }),
  };
}

module.exports = { LENGTH_GATE_MIN, buildMatchweekShow, matchesIndexLeague, pickGoalOfWeek, gotwScore, decisiveIdx, seasonScorers, packTable, backgroundPart, loadMap, weekAudioMap, DUR, CEREMONY_SHOTS };
