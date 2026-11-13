P7 complet: START.bat → 7 → 1 generează etapa următoare = rezultate + video lung (~20–22 min, clasament animat după fiecare meci, Golul etapei) + 1 reel + texte în `publish/`; etapa 38 are ceremonia trofeului (30 s, 3 unghiuri).
Siglele celor 20 de cluburi sunt pe bile (13 descărcate azi de pe Wikipedia, surse în `assets/logos/manifest.json` și `LOGO_USAGE.md`); ceasul e mai lent (1 min joc = 1 s), forța recalibrată: 3,0 goluri/meci, 26,5 % egaluri, 42,7 % victorii acasă.
4 hărți „premier” se rotesc; `premier_pitchside` folosește imaginea ta `premier_day.png` (fără deformare, aliniată jos, tăiată stânga/dreapta, mărită ~20%); celelalte 3 au stadion procedural până pui imaginile lor.
De văzut: `docs/LIGA.md`, apoi generează etapa 1 și uită-te la tot videoul înainte de publicare (clasamentul animat, golul etapei, plasa porții, sunetul).
Neverificat: niciun video/reel randat și nimic ascultat (regula ta); doar 8 cadre PNG; stadionul procedural și ceremonia în mișcare nu au fost văzute; datele jucătorilor sunt cât de corecte sunt sursele.

# P7 report, session 2 (sections 5, 6, 7, 7b + crests + slower clock), 13 Nov 2026

## Decisions
- **Crests**: Max authorised downloading the 13 missing club crests this session, as ball decals only. `tools/fetch_logos_p7.py` took each from the club's English Wikipedia file page (960 px PNG render); every source/download/article URL, retrieval date and licence note is in `assets/logos/manifest.json`; `assets/logos/LOGO_USAGE.md` lists all 20 (also copied into every run folder). `MISSING.md` is deleted automatically when nothing is missing; the 3-letter fallback decal still works (tested with simulated missing files). `logos_on_balls: false` switches all off.
- **Slower clock (Max's answer: "~21 min")**: `GAME_MIN_PER_SEC: 1` (90 s of play per match, was faster → 13.2 min video), `release_interval [7.6, 11.4]` (schema max raised to 15). Recalibrated with 400 seeds/team-pair grid + 5000 Monte-Carlo seasons; the strength parameters stayed (beta 0.7, home 0.16, compress 1.8/0.3; the search's best was beta 0.6 but 0.7 also passes every target and keeps the old calibration's spread). Old file kept as `build/calibration_session1.json` (not committed).
- **Physics geometry unchanged** on the new maps (goals, windmill, keeper, ground identical) → no physics recalibration needed; the premier look is pure drawing (stone platform blocks, deep goal with swaying/rippling net, red-white windmill stripes, rain on the night map).
- **Background image (7b)**: cover-fit (scale to height, symmetric left/right crop, bottom aligned), then the minimal extra zoom that puts the map ground line 6 px inside the image's pitch (`bg_pitch_top 0.83`, measured row 678/817): scale 1.195 vs plain cover 0.881. Never stretched. Missing/broken image → procedural bowl stadium. No centre screen on that map (`center_screen_rect: null`).
- **Map rotation**: the 4 premier maps rotate week by week (week 1 = `premier_pitchside`); 3 of them are procedural until Max adds `premier_overcast/evening/night.png`.
- **Timeline**: intro 10.5 s (fixtures grid), per match pre-card → match → full time → replay → MOTM → animated table (5 s); end: full table, all results, top 5 scorers, Goal of the Week card + replay, next-week teaser. Week 38: champion, 30 s ceremony (wide 0–10 s, low-angle lift 10–20 s, top-down orbit 20–30 s; fireworks, cheers, original sting), European places + relegated, Golden Boot, podium, season stats.
- **Goal of the Week score**: +3 keeper in the air, +2 keeper crouched, +2 winning goal, +1.5 equaliser, +1 added-time shot, + minute/45; highest wins (deterministic).
- **Reel**: one per week; comeback (drama score) → latest winning goal → highest-scoring match; must fit ≤ 55 s; league fast-forward x4 (cups keep x2), static full-pitch P6 layout.
- **Publish texts**: title `Premier League Matchweek N | Marble Football Simulation 2026/27` + 2 variants, results labelled "Simulated results … not real results", top 5 as text, chapters, disclaimer; hashtags start `#PremierLeague #EPL #MarbleFootball` ("EPL" allowed by the lint as part of the league name decision). No player names (lint-checked).
- **Music**: per-week transpose/tempo cycle so consecutive weeks sound different; new synthesised sounds (firework with its own RNG so the cups' audio stays byte-identical, ceremony sting).
- **Render cache**: `bg_fit.js` and `league_layout.js` are part of the renderer hash, so all existing cup render caches are invalidated once (cup sim hashes unchanged).

## Files
`build_matchweek.js`, `sim/league/show.js`, `sim/league/publish.js`, `render/bg_fit.js`, `render/league_layout.js`, `config/maps/premier_*.json`, changes in `render/draw.js`, `render/render.js`, `render/index.html`, `sim/reels.js`, `build_reels.js`, `audio/make_audio.py`, `preflight.js`, `sim/checklist.js`, `sim/config_loader.js`, `sim/league/config.js`; tools `tools/p7_stills.js`, `tools/fetch_logos_p7.py`; tests `tests/p7b_tests.js`; doc `docs/LIGA.md`.

## Tests
`npm test`: run_tests 59/59, P2 30/30, P3 24/24, P4 24/24, P5 26/26, P6 35/35, P7 66/66, **P7b 57/57** — all green. P7b covers: cover-fit math (only side crop, bottom aligned, ground line inside pitch, no stretch), layer order with/without image (headless), map schema, table layout readability at 1080p, show rebuilt from saved seeds (hash + score equal), timeline order, table chain = saved standings, GOTW formula, scorer-in-team, durations (week 1 20.4 min, week 38 22.1 min), ceremony 25–35 s with 3 angles + sounds (short wav synthesised and deleted), every segment type draws headless without page errors, reel rules + ≤ 55 s, publish lint/title/hashtags/no names, `build_matchweek` dry run + preflight green.
Stills used (8 of 8): table update, match on Max's background, goal close-up, ceremony lift (×2 after a framing fix), ceremony wide, ceremony orbit, full table (`build/p7_stills/`, not committed).

## Known problems / not verified
- No video, reel or audio was rendered or heard (Max's rule). Net sway, rain, fireworks, table animation and ceremony camera moves are only checked as single frames/headless.
- Two late layout tweaks were not re-checked with a still (trophy moved onto the stage in the wide shot; full-table title moved up) because the 8-still budget was used.
- The procedural bowl stadium (3 maps) was never seen as a PNG.
- The 1080p render of a ~21 min video takes longer than the old 13 min one (more frames).
- Player data is only as correct as the sources (premierleague.com, 13 Nov 2026).

---

# P7 report: Premier League season mode, session 1 (sections 0–4 + thumbnails flag)

## Scope of this session
Max asked for sections 0–4 only (decisions, data, fixtures, strength model + calibration, season state + START workflow), plus a new rule: **no thumbnails anywhere**. Sections 5 (matchweek video), 6 (season finale) and 7 (new map) are not started (see `progress/P7.md`). No video of any kind was rendered. Still images: 2 (fallback decal frame and decal sheet in `build/p7_stills/`).

## Thumbnails flag (Max's extra change)
- `generate_thumbnails` (rules, default **false**, also in `config/rules/league.json`). Excluded from the simulation hash, so the render cache stays valid (tested: the UCL sim hash is unchanged).
- `generate.js` skips `render/thumbs.js` unless the flag is true; `run.json` records `thumbnails: true|false`.
- `preflight.js` requires `thumbnails/*.png` only when `run.thumbnails === true`.
- `PUBLISH_CHECKLIST.md` and `publish/README_publish.txt` say "you make the thumbnail yourself" when off (old text when on).
- `docs/PORNIRE.md`, `docs/LIGA.md`, CLAUDE.md line 3 and the P7 phase file (deliverables of §4 and §5) no longer list thumbnails. `tests/p4_tests.js` expects thumbnails only for runs that made them (runs from before P7 keep their old check).
- The thumbnail code (`render/thumbs.js`, `renderThumb`) is untouched and still works with the flag on.

## §0 Decisions
- Name **PREMIER LEAGUE** as plain text (`display_name`); no competition logo, trophy copy, kits, sponsors or broadcast graphics.
- Format: 20 clubs, double round robin (each pair twice, once at each ground) = 38 matchweeks × 10. Max's example said 4 meetings per pair, which would be 76 matchweeks, so I used the real format.
- League matches: single match, 90' + added-time shots, **draws allowed, no golden ball** (`golden_ball: false`, engine ctx kind `league`, `passesRules` accepts draws for it).
- Points 3/1/0; tie-breaks: GD, goals scored, head-to-head points (mini-table of the tied clubs), then a seeded draw fixed per (season seed, club), never shown as random.
- Zones: 1–5 UCL, 6–7 Europa League, 8 Conference League, 18–20 Relegated (config, plain text, colours blue/orange/green/red for §5).
- **Goal rate (important):** the knockout engine gives 5.9 goals per match, far above the 2.5–3.2 target. League matches keep the same 45 s of play, physics, windmill, keeper and added-time shots, but the spout releases a ball every 3.8–5.6 s instead of 1.6–2.4 s (`release_interval` in `config/rules/league.json`, a league-only rule key; the four existing competitions are unchanged). Shortening the match instead would have broken the 20–28 min video target (≈ 64 s per match today).
- Strength is invisible (all balls the same radius and look): the existing "favourite takes the release turn" lever, with a continuous edge per match.
- Default map: there is no `premier_*` map yet (§7), so the default rotates through the existing maps and never repeats last week's map. Once §7 adds premier maps they come first automatically.
- "Generate matchweek" in START: the video builder (§5) doesn't exist yet, so the menu asks before saving results only (it locks the previous week). `league.js` calls `build_matchweek.js` automatically once that file exists.
- Regenerate: same seeds, so the results are identical (only the map or the render can change). Earlier weeks are locked.

## §1 Data (web, 13 Nov 2026)
- 2025/26 final table (newsx.com; relegation confirmed by worldsoccertalk.com): Arsenal 85, Man City 78, Man United 71, Aston Villa 65, Liverpool 60, Bournemouth 57, Sunderland 54, Brighton 53, Brentford 53, Chelsea 52, Fulham 52, Newcastle 49, Everton 49, Leeds 47, Crystal Palace 45, Nottingham Forest 44, Tottenham 41; relegated West Ham 39, Burnley 22, Wolves 20.
- Promoted: Coventry (champions), Ipswich (runners-up), Hull (play-off winners, 23 May 2026; theScore/AFP). I found no BBC article in the search results; several independent outlets agree.
- 13 new club files (`config/teams/`): man_utd, chelsea, brighton, brentford, fulham, newcastle, everton, leeds, nottingham_forest, tottenham, coventry, ipswich, hull. Players come from the official premierleague.com 2026/27 squad pages (forwards list, shirt numbers, nationality), all `verified: true`, `retrieved: 2026-11-13`. The 7 clubs that already had files (Arsenal, Man City, Aston Villa, Liverpool, Bournemouth, Sunderland, Crystal Palace) keep their P6-verified UEFA squad players (04 Nov).
- Ratings = 2025/26 points per game; promoted clubs = rating of the weakest club that stayed up (Tottenham 41 pts).
- Crests: Max did not authorise downloads. 7 clubs have crests already; 13 get the **fallback decal** (3-letter code on a disc in the primary colour, contrasting outline/text; same ball, same ring), listed in `assets/logos/MISSING.md`. Implemented in `render/draw.js` only for teams without a crest file, so existing competitions (all have crests) are unaffected. Checked on 2 stills (Chelsea, Fulham, Tottenham, Hull): readable, including the white-primary clubs.
- New club colours are from general knowledge (`colours_verified: false`).

## §2 Fixtures (`sim/league/fixtures.js` → `league/premier_league_2026_27/fixtures.json`)
Circle method with canonical home/away orientation. The second half is the first half rotated by r rounds with venues swapped (a different order). Only (start, direction, rotation) combinations with no 3 home or 3 away in a row are used (320 of them). Hill climbing with 8 seeded restarts on the club→slot permutation spreads the strong opponents. A first attempt with free round orders and a random-search home/away solver stalled at 15 violations, so I switched to this constructive method.
Measured: max deviation of a club's 10-week opponent average from its season average **0.078 ppg** (limit 0.10; random schedules give ~0.25), at most **2** top-6 opponents in any 5 weeks, the two meetings of a pair at least **13** weeks apart, 19H/19A each, deterministic. Inside a matchweek the matches go from lower to higher profile (week 1 ends with Arsenal–Man United).

## §3 Calibration (`tools/league_calibrate.js` → `league/.../calibration.json`)
- Engine grid: edge 0, 0.1 … 0.9 × 400 seeds × both sides = **8,000 real headless matches**. Favourite W/D/L goes from 38/24/38 % (edge 0) to 83/11/6 % (edge 0.9); about 3.0 goals at every edge.
- Model: signed edge = β·(eff(r_home) − eff(r_away)) + home, capped at 0.9. A linear β could not meet both "champion ≥ 68 pts" and "top-rated title ≤ 45 %" (Arsenal is far ahead of City in the base table). So `eff` compresses the gaps among the top clubs only (r > 1.8 ppg: 1.8 + 0.3·(r − 1.8)). Search result: **β 0.7, home advantage 0.16, compress 1.8/0.3**.
- Real-engine season on the 380 actual fixtures (single-match targets): **3.02 goals, 21.8 % draws, 3.5 % 0–0, 46.6 % home wins** (9 of 380 seeds re-drawn by the technical gate only).
- Monte-Carlo, 5,000 seasons (scores sampled from the engine grid on the real fixtures):

| Target | Result |
|---|---|
| champion 68–95 pts in ≥ 90 % | 95.5 % (median 75) |
| last club 15–40 in ≥ 90 % | 98.8 % (median 33) |
| 1st–20th gap after MW15 14–30 in ≥ 90 % | 97.8 % (median 22) |
| top-rated club wins the title 20–45 % | 37.5 % |
| top-rated club loses ≥ 2 matches in ≥ 90 % | 100 % (median 8 losses) |
| flat table after MW10 | 0 seasons |
| last-matchweek upsets (favourite by > 0.4 ppg loses) | 0.49 per season |

Assumptions (also in the file): independent matches, no form or fatigue, fixed ratings, linear mix between grid edges. Champion points sit lower than in the real league (median 75 vs ~85–90) because the engine has ~24 % draws; still inside the targets.

## §4 Season state and workflow
- `sim/league/season.js`: `state.json` (next week, generated weeks with map and results hash, current table), `results/week_NN.json` (scores, scorers with minute, goal events, seed, attempt, timeline hash, edge, standings with previous positions).
- Seeds = sha256(season seed, week, match index, attempt); attempt > 0 only after a technical-gate failure.
- Every goal's scorer is checked against the scoring club (throws otherwise).
- `league.js` CLI (status / table / maps / play / play --regenerate / dry-run); START option 7 is a submenu. `MARBLE_LEAGUE_DIR` + `MARBLE_LEAGUE_MODE=stub` let tests run the whole flow in a scratch folder.
- The real season folder `league/premier_league_2026_27/` holds only `fixtures.json` and `calibration.json`; no matchweek has been played in it.

## Tests
`tests/p7_tests.js`: **63/63 pass**. Covers: thumbnails flag, league config/zones/ratings, 20-club player validator, MISSING.md, fallback decal (headless), fixtures (all constraints, determinism, tampering), standings and tie-breaks (GD, GF, head-to-head, 3-way seeded draw), strength model, calibration numbers and Monte-Carlo targets, league match gates (no golden ball, draws, shots, 0–9), state persistence, regenerate-only-last, locks, scorer check, an engine matchweek with re-simulation hash, the 38-week dry run, and the START menu with stubs. Full `npm test` result: see the end of this report.

## Not verified / known limits
- No video rendered or watched (Max's rule). The decal is checked on 2 stills only.
- Player data is only as current as the premierleague.com squad pages on 13 Nov 2026; the "3 best-known attackers" pick is my choice among listed forwards (Max can edit `config/teams/<id>.json` and rerun `node tools/players_review.js`).
- New club colours are not source-checked.
- §5–§7 are open: matchweek video, table animation, reel, league publish texts, finale ceremony, premier map and backgrounds.

## Full test run
`npm test`: run_tests 59/59, P2 30/30, P3 24/24, P4 24/24, P5 26/26, P6 35/35, P7 63/63, all green. The first full run stopped in P6, because `validateAll` now also returns the league and the P6 test assumed every entry is a competition file. I fixed the test (it skips non-competition entries; league players are checked in P7) and re-ran P6 and P7.
Not committed: `phases/P1_demo_v2.md` had local changes from before this session (not mine), so I left it out of the commit.
