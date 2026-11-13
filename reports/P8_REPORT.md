P8 gata: meciurile de ligă se joacă acum exact ca la MARBLE CHAMPIONS (bilă la ~2 s, nu la ~9 s), video etapă ~12–13 min, o reluare pe meci.
Reel-urile (toate competițiile) arată meciul întreg la viteză normală, fără x2/x4, centrat; extra-urile se scurtează ca să rămână ≤ 59 s.
Harta Premier nu mai folosește fotografia: stadion desenat de program (tribune pe 3 niveluri, benzi mov, acoperiș din grinzi, reflectoare, nori), 4 variante.
Uită-te la: build/p8_stills/ (p8_match_day, p8_goal_closeup, p8_reel_layout, p8_variants); IMPORTANT: refă etapa 1 cu START → 7 → 2 (cea veche e cu reguli vechi).
NEVERIFICAT: mișcarea în video (fani/steaguri, ritmul aruncărilor), sunetul, cum arată stadionul după compresia YouTube — nu s-a randat niciun video.

# P8 — League fixes (English details)

## 1. Match clock and launch cadence (most important)

**Real cause of the long gaps (measured, not guessed)** — `tools/p8_cadence.js`, 40 seeds each, interval between consecutive spout pops in real seconds, regular play before the windmill boost ramp (same windmill speed phase):

| | GAME_MIN_PER_SEC | release interval | pop interval mean / p10 / median / p90 (s) | match timeline mean (s) |
|---|---|---|---|---|
| UCL (before = after) | 2.4 | engine default [1.6, 2.4] | 1.98 / 1.43 / 2.08 / 2.15 | 54.7 (incl. golden ball) |
| League **before** | 1 | **[7.6, 11.4]** (league-only key) | **9.47 / 7.75 / 9.12 / 11.16** | **104.7** |
| League **after** | 2.4 | engine default | 1.98 / 1.43 / 2.08 / 2.15 (identical) | 51.9 (no golden ball) |

Cause: `config/rules/league.json` had a league-only `release_interval` (engine `RELEASE_INTERVAL` override). P7 session 1 already set [3.8, 5.6] to bring the goal rate down to ~3/match; session 2 slowed the clock to 1 game-min/s and scaled it to [7.6, 11.4] → a ball every ~9 s. The pump logic itself (P5 timing-aware pump) was always the same code; only the interval differed.

Fix / decisions:
- `league.json`: `GAME_MIN_PER_SEC` 2.4 (exactly the value all four cup competitions use; 37.5 s of play + added-time shots ≈ 45–50 s per match) and `release_interval` **removed**; the key is also removed from the rules schema and `rulesToCfg`, so a slower league clock can't come back through config (schema rejects it; tested).
- Until-final-whistle time (no golden ball) UCL vs league: 48.6 s vs 48.6 s (30 seeds, identical).
- Cup timelines unchanged: `tests/fixtures/p8_cup_hashes.json` was recorded **before** the changes (5 competitions × 3 seeds + simHash); P8 test asserts equality → pass.
- Replay rule: checked `sim/league/show.js` — it already had one goal replay per match (`pickReplayGoal`, same as the tournaments) + one Goal of the Week replay at the end; nothing to revert. Test asserts it.
- Length gate: `LENGTH_GATE_MIN = [10, 20]` min in `sim/league/show.js` (no 20-min minimum, no filler). Measured: week 1 = 11.8 min, finale week 38 = 13.2 min (the phase estimate was 13–15; it comes out a bit shorter because matches without golden ball are ~48 s).
- Bug fixed on the way: saved goal minutes in `results/week_NN.json` used a hard-coded ×2 (Max's week 1 file shows "135'"); now uses the rules' clock, capped at 90.
- Max's existing matchweek 1 was made with the old rules: building its video now stops with a clear message ("regenereaz-o (START → 7 → 2)"). Verified on a **copy** of his season folder that regenerate works (new scores, show builds, 11.8 min); his files were not touched.
- Preflight fix: a regenerated league matchweek is no longer flagged as "too similar" to the earlier run of the same week (`preflight.js` uniqueness ignores history entries with the same league + `mwNN`). Without this, regenerating week 1 on another day would have turned preflight red.

**Recalibration** (real engine, headless, `tools/league_calibrate.js --seeds 300 --search`, 6,000 grid matches + 5,000 Monte-Carlo seasons; logs `build/p8/calib*.log`):
- Chosen: beta 0.5, home_advantage 0.08, top_compress 1.8/0.3 (was 0.7 / 0.16).
- Single matches (380 real fixtures, engine): avg goals **5.05**, draws 19.5 %, 0–0 0.3 %, home wins 47.4 %, away 33.2 %, 15/380 technical-gate retries.
- Season (Monte-Carlo, 5,000): champion 69–86 pts (p05–p95, median 76; 97.1 % in 68–95), last 26–40 (96.5 % in 15–40), gap after MW15 median 22 (96.6 % in 14–30), top-rated club wins 33.1 %, loses ≥ 2 matches in 99.98 %, no flat tables, 0.62 last-week upsets per season. **All season targets pass.**
- **Target NOT met: average goals 2.5–3.2.** With the UCL cadence the engine scores ~5 goals per match (the cups score 5.9 with golden ball). Strength only decides *which* ball is released, not how often, so it can't lower the goal rate; the only lever would be slowing the throws again, which is exactly what Max rejected. Decision: keep the identical cadence, accept ~5 goals/match (documented in docs/LIGA.md). Draws, 0–0 and home-win targets are met.

## 2. Reels (all competitions): normal speed, whole match, centred
- `sim/reels.js` rewritten: the match part is **every recorded frame once, in order, ff = 0** (kick-off to final whistle; the approved good-hit / goal slow motion inside the match record stays; nothing faster than 1×). No quiet-stretch x2, no league x4, no trimmed opening; the ">> x2" indicator code was removed from `render/draw.js`.
- Length ≤ 59 s by shortening extras, never speed: ladder (hook / replay / MOTM / end card, s): 2/yes/2/2.2 → 1.5/yes/1.6/1.6 → 1.5/no/1.6/1.6 → 1/no/0/1.2 → 0/no/0/1.0. If the last level still exceeds 59 s, `reel.fits = false` and the selection skips the match (league and cups; `build_reels.js`, `sim/league/publish.js`). Cup last resort: if no R16/QF match fits, the best drama score of any round is chosen (`sim/selectReels.js`).
- Measured: league week 1 → 8 of 10 matches fit (53.6–58.2 s), 2 skipped (60.0 s at the last level). UCL tournament → 20 of 29 fit (long golden-ball matches are skipped). Speed factor everywhere: 1.0 (before: league x4 / cups x2 stretches).
- Centring: scene rectangle x = 0, w = 1080 → left margin 0 px = right margin 0 px; y 600–1207.5 px (middle band as in P6). Why it looked off-centre before: the text column (header, scoreboard, captions, cards) was 40..629 design px = centred at 334.5 instead of 360 (left 40 px vs right 91 px), because the right 12 % is reserved for the Shorts buttons. Now the column is symmetric: 91..629 design (136.5..943.5 px, centre 540 px). Test: every key box (competition, scoreboard, hook score, MOTM, end card) centred ±1 design px, all text boxes in the safe area, on every segment type of the league reel (league name + MATCHWEEK label included).
- One still: `build/p8_stills/p8_reel_layout.png`.

## 3. League map: procedural stadium instead of the photo
**Cause of the ugly background:** `premier_day.png` is 1925×817 (2.36:1). Cover-fit into the 16:9 scene plus the extra zoom that puts the game's ground line on the image's pitch crops **427 px on each side** (44 % of the width) and scales each source pixel to ~1.2 design px = **~1.8 output px at 1080p** → soft/upscaled; the image was also re-encoded to JPEG before embedding, and its dense high-frequency crowd turns into noise/blocking under H.264 at video bitrate. No stretching (one scale factor) — it was resolution + crop + compression.

Decision implemented:
- `use_background_image: false` on the 4 premier maps (new schema key, default off: `backgroundPart` embeds the image only when it is `true`; code path kept and still tested). The file stays as a reference only.
- `drawBowl` in `render/draw.js` rewritten (vector, drawn once into the 2× background cache, sharp at any size): blue sky with soft clouds (grey deck for overcast, warm clouds for evening, stars at night), steel truss roof ring (two chords, triangulated lattice, radial girders) with a solid underside, two rows of floodlights with additive bloom and star glints, three curved tiers with many thousands of small fan figures (shirt + head, purple/white majority, varied skin tones), radial aisles with steps, vomitories, depth haze, two glowing purple ribbons along the tier fronts, purple LED boards with only "PREMIER LEAGUE" (plain text, `display_name`), striped pitch with halfway line and centre circle, soft vignette.
- Animation: `drawStadiumLive(c, t)` per frame after the cached background: a few hundred fans (≈3 % of the middle and lower tiers) bob / raise arms and 34 flags wave; deterministic in t (slow motion slows them too). Same frame twice → identical pixels (tested).
- Physics objects unchanged (platforms, windmill, spout, goal, keeper, balls, scoreboard); physics tests untouched and green; cup hashes unchanged.
- Four variants (day, overcast, evening, night) drive light/glow/colours from the existing map colours (`stand`, `crowd`, `roof`, `floodlight`, `sky`, `night`, `tint`) + optional `ribbon`.
- Stills (4 used of ~6): `p8_match_day`, `p8_goal_closeup` (sharp at goal zoom), `p8_variants` (2×2), `p8_reel_layout` — all in `build/p8_stills/` (not committed).

## Tests
- New `tests/p8_tests.js` (in `npm test`): **33/33** — clock/cadence equality (numbers printed), cup hashes unchanged, calibration targets, replay rule, length gate, saved goal minutes, reels whole-match 1× / fits / selection / last resort / too-long match, centring and safe areas on every reel segment type, no ff indicator, procedural stadium (4 variants: layers, no image, animated, deterministic, no errors), board text only the league name.
- Earlier tests updated to the P8 decisions: P3 (reel 30–59 s, structure with optional extras, no fast-forward), P4 (cup-run block ignores league runs — it was picking Max's league run), P7 (avg-goals target replaced by "cup rate"), P7b (P8 rules, length gate, image path tested with `use_background_image: true`, run.json background null).
- `npm test` **all green**: run_tests 59/59, P2 30/30, P3 24/24, P4 24/24, P5 26/26, P6 35/35, P7 66/66, P7b 58/58, P8 33/33. Also fixed: preflight uniqueness for a regenerated matchweek (see §1).

## Known problems / not verified
- Not verified (no video render allowed): motion of fans/flags and the throw rhythm in a real video, audio, how the crowd texture survives YouTube compression (it is calmer and vector-sharp, but still detailed).
- Avg goals ~5 per league match (target 2.5–3.2 not met — see §1).
- Some long matches (mostly golden-ball cup matches) can never be the reel; selection skips them by design.
- Max must regenerate matchweek 1 once (START → 7 → 2); his old week-1 results/video are from the old clock.
