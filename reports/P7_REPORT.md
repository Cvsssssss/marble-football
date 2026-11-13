P7 sesiunea 1 (secțiunile 0–4): modul PREMIER LEAGUE există în START.bat → 7 (etapa următoare, regenerarea ultimei etape, clasament, alegerea hărții); 20 de cluburi 2026/27, câte 3 atacanți, program de 38 de etape, model de forță calibrat.
Thumbnail-urile sunt oprite peste tot (`generate_thumbnails: false`); le faci tu. Videoul etapei, finala sezonului și harta nouă (secțiunile 5–7) NU sunt făcute încă.
De verificat de tine: `config/players_review.md` (secțiunea PREMIER LEAGUE), `assets/logos/MISSING.md` (13 cluburi cu decal de rezervă), `docs/LIGA.md`.
Calibrare (motorul real, fără randare): 3,0 goluri/meci, 21,8 % egaluri, 3,5 % 0–0, 46,6 % victorii acasă; toate țintele de sezon trec (5000 de sezoane).
Neverificat: niciun video (nu s-a randat nimic); datele jucătorilor sunt doar cât de corecte sunt sursele (premierleague.com, 13 nov 2026); culorile noilor cluburi sunt din cunoștințe generale.

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
