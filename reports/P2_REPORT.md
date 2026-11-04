Există: turneul MARBLE CHAMPIONS cu 16 echipe (29 de meciuri, 29:49 min), `output/tournament16_1080p.mp4` (1080p, 30 fps, AAC, -14.0 LUFS) și o previzualizare 720p.
Lângă video sunt capitolele (`tournament16_chapters.txt`), `matches_index.json`, `LOGO_USAGE.md` și capturile din `output/screenshots_p2/` (56 de fișiere).
De văzut: tabloul (bracket) de la început și după fiecare tur, siglele pe bile, replay-urile cu numele jucătorului și podiumul de la final.
Nu am verificat: video în mișcare (fluiditatea) și sunetul ascultat cu urechea. Am verificat doar cadre statice (36 din preview + capturi) și nivelul audio măsurat.
Siglele sunt luate de pe Wikipedia (multe „Fair use”). Riscul e al tău; le poți opri cu `logos_on_balls: false`.

# P2 — 16-team tournament: details

## Result (cached seeds, deterministic)
| Round | Ties (aggregate) |
|---|---|
| R16 | PSG–Dortmund 3–4 (Dortmund), Bayern–Arsenal 4–2, Liverpool–Brugge 5–4, Real Madrid–Man City 4–2, Barcelona–LASK 5–3, Betis–Stuttgart 3–2, Aston Villa–Inter 6–5, Sporting–Como 6–1 |
| QF | Dortmund–Bayern 5–3, Liverpool–Real Madrid 5–6, Barcelona–Betis 5–2, Aston Villa–Sporting 3–5 |
| SF | Dortmund–Real Madrid 5–3, Barcelona–Sporting 4–5 (golden ball) |
| Final | Dortmund 4–3 Sporting → champion Dortmund |

- Top scorers: S. Guirassy 9, L. Suárez 7, G. Catamo 7.
- Comebacks (match index): 1 (strong, depth 2), 5, 8, 11, 14, 19, 22. Requirement of ≥3 in R16/QF with ≥1 strong is met.
- Length: 1789.4 s (29.82 min). There are 31 chapters (see `output/tournament16_chapters.txt`).

## Data sources
- **Standings:** Wikipedia "Template:2026–27 UEFA Champions League league phase table", updated to 3 Nov 2026 and retrieved 2026-11-04. Matchday 4 was only partly played. The UEFA.com standings page did not render for the fetch tool.
- **Players:** 3 attackers per club, from the UEFA club squad pages (retrieved 2026-11-04). They are listed in `config/players_review.md`. Como's kit colours are not verified.
- **Crests:** fetched from Wikipedia/Commons through the imageinfo API (512 px thumbnails). Sources and licences are recorded in `assets/logos/manifest.json` and per run in `output/LOGO_USAGE.md`.

## Decisions
- **Strength:** balls are identical (radius 18 for every team). The only lever is invisible: the favourite takes the next release turn with probability `strength_edge` = 0.15. Calibration over 1200 matches: favourite wins 57.6% (no edge: 50%; 0.2: about 60%; 0.35: 68%).
- **Crest balls:** white base, a ring in the kit colour, the crest printed in the middle. If no kit combination gives enough contrast, the ring falls back to neutral dark #1F2A38. With `logos_on_balls: false` the balls look exactly like v2b (pixel test, maxDiff 0).
- **Bracket:** standard seed order (1v16, 8v9, …), so 1st and 2nd can only meet in the final. `forced_pairs` supports a forced R16 tie, or for a QF pair, placement in sibling ties so they meet in the quarter-final. The video plays tie by tie (leg 1, then leg 2).
- **Timing:** per-match cards were trimmed (pre-match 1.1 s, full time 1.7 s, MOTM 2.5 s, bracket update 1.6 s, or 3.6 s at the end of a round) to fit the 25–30 min target.
- **Render cache per block** (`build/segcache`). darkBG is now driven by the local frame, so blocks are independent.
- **Rule fixes:**
  - The in-play goal banner showed the scorer's name; it now shows only the minute. A test checks all 513 in-play frames for names.
  - HALF-TIME no longer overlaps the goal banner.
  - When the top-left stage label would touch the scoreboard (quarter-finals), it now wraps onto two lines.
- **Render OOM fix:** the 10 MB show is passed to the browser pages as a JSON string, and the pages are opened one at a time.
- Round title cards use the same music level as the bracket screens.
- **Test changes:**
  - Alternation is now ≥95% when strengths are equal and ≥80% with the edge on.
  - Colour contrast is measured on the ring colour.
  - The fresh-process determinism check now passes the strength context.

## Tests
- `npm test`: run_tests 58/58 and p2_tests 30/30 (`logs/p2_final_tests.log`).
- **ffprobe:** h264 1920×1080 at 30 fps, AAC audio, duration 1789.4 s. Integrated loudness −14.0 LUFS.
- **Self-review:** 36 frames sampled across the 720p preview (`build/check_preview/sheet_*.png`). The only problem found was the label/scoreboard touch, which is fixed and re-checked.

## Not verified
- Motion smoothness and audio by ear.
- The thumbnails may show crest balls; Max decides whether to keep them.
