# P1 — Demo v2: corecții + arhitectură de configurare

Există: `output/demo_v2_1080p.mp4` (1920×1080, 30 fps, H.264+AAC, 5:35), capturi în `output/screenshots_v2/`, 3 sunete de gol în `output/goal_sfx_samples/`. v1 a rămas neatins.
De privit întâi: `crossbar_before_after.png` (sus v1, jos v2), `11b_golden_clock_frozen_late.png`, `13b_replay_caption.png`, `13c_man_of_the_match.png`, `16_bracket_finalists.png`, `18_final_screen_podium.png`, `bracket16_empty.png`.
Ascultă `goal_A/B/C.wav` și alege; schimbarea se face în `config/audio.json` (`"goal_sfx"`), fără cod. Totul se reface cu `node build_all.js --competition config/competitions/demo_4teams.json` (~10 min).
Teste: 45/45 trec (logs/build_v2.txt). Bara: suprapunere maximă 25,8 px în v1 → 0,0 px acum (5.000 de mingi). Morișca după minutul 70: lansare +34%, rata de goluri +10%.
NEVERIFICAT: n-am urmărit video-ul în mișcare și n-am ascultat sunetul cu urechea; doar măsurători și capturi statice.

---

## 1. What changed (the 10 items)

| # | Item | Result |
|---|------|--------|
| 1 | Goal sound | Horn and synthetic crowd removed. Three original numpy sounds: **A** net-swish + rising two-note chime (1.60 s), **B** low whoosh + soft band-pass crowd swell (1.75 s), **C** thump + marimba three-note flourish (1.50 s). `config/audio.json` `"goal_sfx": "A"` (default). The replay uses the same sound at half gain. Own RNG, so all other effects and the music stay bit-identical to v1. |
| 2 | Team colours on balls | Ball body = primary (same v1 shading/highlight, gradient derived from the colour), pentagons = secondary, thin seam outline. Scoreboard dots, ball indicators, goal banner, bracket bars/chips, intro cards, MOTM card, podium balls all use the team colours. Contrast rule: CIE76 ΔE < 30 → team B plays in its secondary colour (fallback: team A, then both); recorded in `match.kitNote` and `tournament_summary.json`. Bayern vs Arsenal (ΔE 21.3) → Arsenal in white (ΔE 98.9). In this demo all 5 matches had ΔE ≥ 99, so no swap happened on screen. |
| 3 | Crossbar | Fixed. See §5. |
| 4 | Bracket | Generic symmetric layout (`render/bracket_layout.js`): final in the centre, tree grows from both edges. Demo: SF1 left, SF2 right, final centre, trophy above the final. The qualifying team slides along the connector to its final slot (yellow card with the team name). 16-team empty layout: `output/screenshots_v2/bracket16_empty.png`. |
| 5 | Golden ball clock | `sim/clock.js` (shared by tests and renderer). During golden ball the pill shows `GOLDEN BALL · 90+N'` and never advances. Goal minutes in captions are capped at `90+N'`. |
| 6 | Windmill from 70' | Angular speed ×1.30 with a smoothstep ramp from 68' to 72'. The angle is the exact integral of ω, so there are no jumps. No visual indicator. See §6. |
| 7 | Players + replay caption | 3 fictional players per team (name + number) in `config/teams/*.json`; ball i → player i>>1. The replay has a lower-third caption `D. Okafor · 71'` + `#7 · Manchester City` (40 px design = 60 px at 1080p). There is still no HUD/score in the replay. |
| 8 | Man of the Match | A 3 s card after each replay: "MAN OF THE MATCH", name, number, team, original star-award drawing. Rule: most goals; tiebreak = decisive goal (the winner's goal that made the lead final; the golden goal if any), else last goal. Stored as `match.motm`. |
| 9 | Final screen | Left: "MARBLE CUP CHAMPIONS", the v1 trophy (original drawing), team name, two-colour band, final score. Right: podium with the top 3 scorers (ball in the team colours, name, team, goals). Tiebreak: fewer matches, then who reached the total first. Confetti + cheer kept. Visible for 8.0 s + 0.8 s fade. |
| 10 | `GAME_MIN_PER_SEC` | Lives in `config/rules/base.json` (2.0). |

Also (project rule from CLAUDE.md): a small **SIMULATION** label is now always visible in the bottom-right corner (v1 had none).

## 2. File map
```
config/competitions/demo_4teams.json  name, format, pairing, team ids, map, rules, output paths
config/teams/<id>.json                name, short, primary, secondary, strength, players[3]{name,number}
config/maps/default.json              sky / rock / grass colours (v1 values)
config/rules/base.json                BALLS_PER_TEAM, GAME_MIN_PER_SEC, ADDED_MIN, windmill_boost_from/ramp, boost, golden_ball, goals 1..10
config/audio.json                     goal_sfx A|B|C, music_seed
sim/config_loader.js   NEW  schema validation (clear messages), CIE76 ΔE, matchKits(), simHash/hash
sim/clock.js           NEW  clockAt(), minuteLabel()  (Node + browser)
sim/engine.js          rules from config, windmill boost + toss-phase ramp, sweptBar(), scorer per goal, launch stats
sim/geometry.js        BAR_X0/X1/BOTTOM: one rectangle for collider and drawing
sim/tournament.js      config-driven, kits, MOTM, top scorers, seed cache build/cache/seeds_<simHash>.json, motm segment
render/bracket_layout.js NEW generic symmetric bracket (4/8/16/32)
render/draw.js         map + kit colours, frozen clock, caption, MOTM, bracket, podium, SIMULATION label
render/render.js       --show, new key moments, `bracket16` mode
render/mux.js          --out / --shots (default output/demo_v2_1080p.mp4)
audio/make_audio.py    goal SFX A/B/C, samples, peak/loudness/masking report (build/audio_goal_report.json)
tests/run_tests.js     v1 checks + v2 checks (45)
tests/crossbar_test.js NEW 5000-throw penetration test (v1 vs swept)
tests/windmill_boost.js NEW ≥300-match boost measurement
tests/pixel_probe.js   NEW pixel check for the config-change test
tests/bar_demo.js      NEW before/after bar-hit sequence image
build_all.js           one command, --competition
```

## 3. One-command re-run
`node build_all.js --competition config/competitions/demo_4teams.json` (= `npm start` / `npm run all`; with no arguments the same demo is built). Order: config validation → tests → tournament → screenshots → 16-team bracket → audio → parallel video → mux + ffprobe + sample frames. About 10 min (tests 2.5 min, video 230 s). `--skip-tests` skips the tests. The v1 file `output/demo_final_1080p.mp4` is never written.
Extra: `npm run test:crossbar`, `npm run test:boost`, `node tests/bar_demo.js`.

## 4. Test results
- Baseline before the changes: v1 suite 26/26 PASS (`logs/baseline_tests.txt`).
- Final: **45/45 PASS** (`logs/build_v2.txt`, `build/test_results.json`). New checks:
  - crossbar 5000 throws: max overlap ≤1 px, 0 tunnels
  - collider = drawing
  - from above bounces, from below passes, posts never collide, tournament bar contacts all from above
  - clock: never above 90+N and never backwards (125 matches, incl. golden); added time in range
  - bracket symmetry: 4/8/16 teams; SF1 left, SF2 right, final centre
  - colour swap: Bayern–Arsenal, no swap City–Real, both-white case; every match ΔE ≥ 30; schema error messages
  - MOTM rule (4 synthetic cases); MOTM present in every match; top-scorer tiebreak; players per goal
  - windmill boost: angular +30%, ramp; 300-match measurement
  - **config change**: a temp copy of config with City primary `#00C853` and an orange sky. The same frame was rendered from both copies; mean ball colour changed from (147,184,214) to (84,201,134) and moved closer to green, and the sky changed from (83,167,239) to (255,148,45). The simulation hashes stayed identical (a colour edit does not touch the physics).
  - determinism (same seed → same hash, also in a fresh process)
- ffprobe on the final file: 1920×1080, 30/1 fps, H.264 High yuv420p, 10045 frames, **334.83 s (5:35)**, AAC 48 kHz stereo 191 kb/s, −14.1 LUFS integrated, true peak −1.5 dBFS. 71 MB. Sample frames: `sample_begin/middle/end.png`.

## 5. Crossbar penetration (before / after)
**Cause:** three problems combined in v1.
1. **Collider ≠ drawing:** the bar was drawn from x=1157.5 (outer face of the post), but the collider started at 1162, so 4.5 px of drawn bar had no collider.
2. **One-way logic by mask switching with a +3 px tolerance:** a fast ball (up to 12.5 px per step) penetrated more than 3 px before matter-js resolved the contact. At the next step its mask turned the bar off and the ball fell through (tunnelling).
3. **Soft matter-js position correction:** the ball visibly sank into the bar before the correction pushed it out.

**Fix:** the bar is no longer a matter-js body for balls. `sweptBar()` runs after every physics step:
- It uses the exact drawn rectangle.
- The bar is solid only if the ball centre was above the top surface at the start of the step. A ball touching it from below or the side becomes a "ghost" until it is clear.
- The step is swept in 1.5 px sub-samples, the ball is placed exactly at contact distance, and the normal velocity is reflected (restitution 0.55; resting contact below 40 px/s).
- A 0.1 s latch makes the front end-face solid for a ball that just slid off the top corner.

| 5000 identical throws (seed 2024, 0–1500 px/s, ±80°, 15 % aimed at the corner) | v1 | v2 |
|---|---|---|
| max visible overlap into drawn bar | **25.77 px** | **0.000 px** |
| throws with overlap > 1 px | 606 | 0 |
| tunnelled through | 15 | 0 |

Image: `output/screenshots_v2/crossbar_before_after.png` (same throw #4877, 7 frames). Top v1: the ball sinks through the bar corner (overlap 0 → 25.8 px). Bottom v2: it bounces off the corner (0 px).

## 6. Windmill boost measurement (300 matches, same seeds with/without boost, `build/windmill_boost.json`)
| | before 70' | from 70' |
|---|---|---|
| mean launch speed (peak 0.3 s after windmill contact), boost on | 645.8 px/s | **867.8 px/s (+34.4 %)** |
| goals per 10 game-min, boost on | 0.518 | **0.569 (+9.8 %)** |
| goals per 10 game-min, boost off (reference) | 0.518 | 0.547 |

Matches with >10 goals: 0.67 % with boost (1.0 % without); the seed gate rejects them anyway. Mean goals/match 4.87.
**Tuning note:** the first try (boost only) gave +30.5 % launch speed but **−17 %** goals: the faster arm met the ball lower and threw it into the void. Fix: the outlet toss phase follows the same 68–72' ramp from 2.75 to `TOSS_PHASE_BOOST` = 2.9 rad, chosen with a toss-test grid (direct goals 28 % → 44 % at boosted speed).

## 7. Goal sound loudness (`build/audio_goal_report.json`, levels in the final mix before loudnorm)
| sound | duration | peak | max short-term (400 ms) RMS |
|---|---|---|---|
| A (used) | 1.60 s | −4.5 dBFS | −15.6 dBFS |
| B | 1.75 s | −4.5 dBFS | −17.3 dBFS |
| C | 1.50 s | −4.5 dBFS | −14.8 dBFS |
| reference: golden sting / whistle end / bar / windmill / ground / net | | −2.5 / −6.3 / −4.5 / −4.5 / −6.3 / −8.5 | −13.6 / −12.4 / −21.2 / −20.8 / −19.5 / −26.7 |

- **Criterion:** the goal sound is never louder (peak or short-term) than the loudest existing effect. **PASS** for A, B and C.
- **In the real mix** (19 goals, 1.8 s window): goal RMS minus all other effects is −7.3 to +11.3 dB. The goal sound dominates its own 1.8 s only when little else is happening, and it is shorter than the v1 horn + crowd (3.2 s). The music is still ducked.

## 8. Decisions taken instead of asking
- **Player names:** fictional, as the phase file asked (CLAUDE.md allows real names; the phase file overrides it).
- **SIMULATION label:** added because CLAUDE.md requires it; it is small, bottom-right.
- **v1 bug** (matter-js deep-copies `plugin`, so every collision event had x=y=0): I fixed the data, but I kept the v1 look and sound.
  - The impact sparks were drawn at (0,0) in v1, so they were invisible; I removed them.
  - Collision sounds stay panned as in v1 (constant pan).
  - Real panning could be a later improvement if you want it.
- **Added time:** the clock still shows `90'` + the `+N` badge (the v1 style you approved). Only golden ball shows `90+N'`.
- **Kit swap:** team B swaps first. In this demo none of the matches needed a swap.
- **Bracket labels:** for 4 teams the column headers are hidden (box labels "SEMIFINAL 1/2" and "FINAL" are enough); for ≥8 teams the round headers are shown.
- **Tournament format:** kept as in v1 (two-legged semis + final); the length is now 5:35 because of the 5 MOTM cards (3 s each) and the 8 s final screen.
- **Render cache:** the cache key is the simulation config hash. A colour, name or map change replays the cached seeds (tournament in under 1 s) instead of re-running the seed gate.
- `ADDED_MIN` is validated to max 3.
- `GOLDEN_BALL=false` is supported, but then a deciding match without a winner is rejected by the gate.

## 9. Known problems
- MOTM tiebreak labels are only shown in small text ("decisive goal / last goal").
- In this seed set no match needed a colour swap, so the swap is proven by tests only, not seen in the video.
- The bracket for 4 teams leaves empty space at the bottom (the boxes are centred vertically on purpose).
- The 16-team bracket uses small boxes (142 px design width); long names will be auto-shrunk (`fitText`). This is not tested with real names yet (P2).
- Collision sounds keep the v1 constant pan (see decisions).

## 10. Not verified
- I did not watch the video in motion: bracket token animation, ramp smoothness, MOTM fades and replay timing are checked only on static frames.
- I did not listen to any audio: goal sounds A/B/C, the mix and the absence of clicks are verified only by numbers.
- Readability on a phone screen is judged from font sizes, not from a real phone.

**Final file:** `output/demo_v2_1080p.mp4`, 334.83 s (5:35).
