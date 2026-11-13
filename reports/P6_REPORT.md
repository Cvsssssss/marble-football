Există: mingea de aur e acum naturală (pe 200 de turnee simulate: 0 meciuri în 15 turnee, 1 în 42, 2–6 în 143; media 2,26), jucători reverificați pe web (19 echipe schimbate, Colombia fără „L. Suárez”), UN singur reel per video cu tot terenul în cadru și cameră fixă, texte de publicare gata de copiat în `publish/`, „Ranked #N” la naționale.
De văzut: `output/screenshots_p6/01_reel_layout_goal.png` (așezarea reel-ului), `02_nations_intro_ranked.png` (intro naționale), `config/players_review.md` (coloana „De verificat”: 22 de intrări), repetiția fără video `output/runs/2026-11-13_ucl_2026_top16_stadium_night_dryrun/publish/` (titluri + descrieri).
Nu am randat niciun video sau reel (regula ta). Nu am descărcat sigle. Nu am făcut push (cum ai cerut); P7 NU a fost început în această sesiune.
Nu am verificat: reel-ul în mișcare (fluiditate, cum arată pe telefon cu butoanele YouTube peste), sunetul, corectitudinea datelor despre jucători dincolo de surse (Danemarca, Ucraina, câțiva la Croația/Norvegia/Austria/Maroc nu au listă confirmată din noiembrie 2026).
Toate testele: vezi „Test results” mai jos (`npm test`, P1–P6).

# P6 — fixes: random golden ball, correct players, ONE full-pitch reel, publish texts (English details)

Max's instructions this session: run P6 only (P7 later in a fresh session), no video renders, no questions about taste, no crest downloads, commit without push.

## 1. Golden ball is natural
**Before:** `sim/tournament.js` steered the seed gate: the last tie of the last two-legged round *preferred* a golden ball when none had happened yet ("show one golden ball at least"), every other second leg and the final *preferred* no golden ball, and the 4-team demo preferred a golden ball in SF2 and an added-time goal in SF1. Result: almost always exactly one golden ball per long video.
**After:** all of that is removed for every format. The remaining preferences are golden-neutral: the replay-quality preference (2–7 goals and a *regulation* goal past an airborne/crouching keeper; it ignores golden and added-time goals) and the existing comeback gate for R16/QF. Hard technical gates unchanged (goals 1–10, stuck limit, ball accounting, golden-ball resolution cap, decisive result). The golden-ball rule itself is unchanged. A new `GATE_VERSION` ('p6-1') is part of `simHash`, so seeds chosen by the old gate are never replayed from the cache (all tournaments are re-simulated once).
**Histogram** (`tools/golden_histogram.js`, 200 tournaments, 50 per competition, different seed salt and draw each, timeline simulator only):

| golden-ball matches per tournament | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| tournaments | 15 | 42 | 63 | 48 | 24 | 5 | 3 |

Mean **2.26** per tournament. Every tournament still has ≥ 1 comeback in R16/QF. Long-video length 29.7–32.6 min (median 31.2), inside the 25–33 min window: **no window change needed**. 0 scorers outside their team. (Values re-checked by `tests/p6_tests.js`; the test re-runs the 200 tournaments whenever the simulation code changes.)

## 2. Players (audit 2026-11-13)
- **Nations (22 teams):** re-collected from the latest call-ups found on the web (federation pages and national press; November 2026 squads for most). 19 teams changed — full list in `build/p6_player_changes.txt`, summary:
  Argentina (Simeone → S. Castro), France (Dembélé injured, not called → K. Mbappé), England (Saka injured → E. Eze), Morocco (→ Y. En-Nesyri, A. El Kaabi), Netherlands (Zirkzee → C. Gakpo), Mexico (→ A. González, J. Quiñones), **Colombia (L. Suárez, K. Viveros → J. Arias, D. Mosquera; Ó. Perea kept)**, Switzerland (→ B. Embolo, R. Vargas), Germany (new coach; → K. Havertz, N. Füllkrug, Y. Ebnoutalib), Croatia (Perišić, Budimir not called → F. Ivanović, L. Majer), Italy (Maldini → N. Cambiaghi), USA (Weah → C. Sullivan), Norway (Strand Larsen → A. Sørloth), Denmark (Skov Olsen → J. Wind), Austria (→ M. Grüll, C. Baumgartner, R. Florucz), Türkiye (→ Y. Akgün, B. Yılmaz, D. Gül), Sweden (P. Abraham → A. Elanga), Ukraine (Yarmolenko → A. Dovbyk). Spain, Portugal, Brazil, Belgium unchanged (confirmed in the November lists).
  - **Difference from Max's report:** the "L. Suárez" shown for Colombia was *Luis Javier Suárez* (Sporting CP), who is Colombian and is in the 6 Nov 2026 Colombia squad — not Luis Suárez of Uruguay. To avoid the confusion I still replaced him in the Colombia team (he stays at Sporting in MARBLE CHAMPIONS, correctly a Colombian there).
  - National-team shirt numbers change per camp, so nations no longer store a number; the video shows "Team" instead of "#9 · Team" for them (`numTag` in `render/draw.js`).
- **Clubs (32 teams):** the UEFA 2026/27 squad lists retrieved on 2026-11-04 (registration window closed since 1 September, so they cannot have changed; spot-checked Real Madrid again on 2026-11-13). Added `team` and `nationality` for every player. Real Madrid: Mbappé, **Vinícius Jr.** (was "V. Júnior") and **Y. Diomande** (Max's hint; #25, a winger listed as midfielder by UEFA) instead of Rodrygo. Barcelona: Yamal, Raphinha, A. Gordon (matches Max's hint).
- **Schema:** `name, team, nationality, position, source_url, retrieved, verified` (+ optional `number`, `note`).
- **Validator** `sim/players.js` — at startup (`config_loader`, real names only) and as tests: 3 players per team, `team` equals the team, nations `nationality == nation`, no player in two teams of one competition, `retrieved` ≤ 120 days, and **every goal's scorer belongs to the scoring team** (`assertScorers`, run inside `buildTournament` on every generated tournament, plus on 200 simulated tournaments). `npm run players:check` prints the list to check.
- `config/players_review.md` regenerated (`node tools/players_review.js`) with columns Team / Name / Position / Nationality / Source / Retrieved / Verified / **De verificat**.
- **Audit summary:** 54 teams, 162 entries; **140 verified**, **22 need a check**:
  - unverified squad membership (no full Nov 2026 list found): Denmark (Højlund, Isaksen, Wind), Ukraine (Dovbyk, Vanat, Yaremchuk — latest list found is Nov 2025), Norway A. Nusa, Austria R. Florucz, Morocco A. El Kaabi, Croatia L. Majer (listed by HNS among the forwards, usually an attacking midfielder);
  - nationality to confirm (club players, competition rules do not depend on it): LASK Usor, Adeniran; Leverkusen M. Diaby; Ferencváros Kovačević, Yusuf, Joseph; Union SG Rodriguez, Biondic; Beşiktaş Poku; AZ Patati; Sparta Braut Brunes, Singhateh.
- Stale names: `git grep` finds none of the old names any more (the P3 one-off generator `tools/make_teams_nations.js`, which held the old squads, was removed; it is in git history).

## 3. ONE reel per video, whole pitch always in frame
- **Layout (1080×1920, `render/draw.js`):** the full 16:9 scene scaled to the full width = 1080×607.5 px band at y 600–1207 px, **static camera** (no pan, zoom or crop; the slow-motion zoom track is ignored in reels; slow motion itself stays). Above: competition name and a large scoreboard (teams, score, clock, leg, aggregate, stage). Below: goal / scorer caption, a yellow "COMEBACK" badge once the winner has come back, and an info strip (round · leg · computer simulation). Background: the map scene of the match, scaled to cover, blurred 22 px and darkened (drawn once per reel). Fast-forward ">> x2" and REPLAY tags sit top-left of the field (away from the Shorts buttons on the right).
- **Safe area:** every text box inside x 40–629, y 100–956 (design px of 720×1280) = out of the right 12 % and the bottom 25 % (approximate Shorts overlays, not verified on a phone).
- **Selection (`sim/selectReels.js`):** candidates = R16/QF matches whose reel fits ≤ 60 s. Best comeback by a documented **drama score = 3 × deficit overturned + minute of the winning goal / 30 + 0.25 × goals + 1 if the winning goal is in added time**; ties by match order (deterministic). No comeback → fallback: latest winning goal (then most goals), flagged `fallback: true`. The comeback seed gate (≥ 1 comeback in R16/QF) is unchanged; in 200 tournaments it never failed.
- `build_reels.js` makes exactly one reel folder `reels/reel_<match id>/` and deletes old `reel1_…/reel2_…/reel3_…` folders of that run; START menu item 3 ("Doar reel-ul (unul)") produces that single reel. `next.js` / checklist plan one reel slot per video.
- Tests: scene rectangle identical in every sampled frame of all 5 segments and fully inside the canvas; all text boxes in the safe area; exactly one reel per run; ≤ 60 s.

## 4. Publish texts (`sim/publish.js`, written by `generate.js` into `<run>/publish/`)
`long_title.txt` (3 options), `long_description.txt` (intro, how it works, facts of this video, **chapters from chapters.txt**, call to comment, disclaimer, 11 hashtags — first `#MarbleFootball #FootballSimulation #<Competition>`), `reel_title.txt` (3), `reel_description.txt` (result, disclaimer, 4 hashtags), `README_publish.txt` (Romanian: where to paste; Audience "not made for kids", Category Sports, the AI/synthetic-content question).
- Facts only from the timeline: matches, goals, R16/QF comebacks, golden balls (or "no tie needed a golden ball"), windmill bombs (good hits with slow motion), top-scoring **team**. Never player names, never the champion in the long title, no official names.
- Variety: title patterns, intros, "how it works" and call-to-action pools chosen by a seed from run name + simHash; `plan/history.json` gets `recent_titles` (last 10; not in dry runs) and fresh titles are preferred.
- Lint (generation fails if it does not pass; preflight re-checks the files): titles ≤ 100 with "Simulation", description ≤ 5000, hashtags 8–12 / 3–5 (≤ 15), YouTube chapter rules (0:00 first, ≥ 3, ≥ 10 s, last < duration), disclaimer, forbidden words (UEFA, FIFA, World Cup, Champions/Europa/Conference/Nations League, UCL, UEL, EPL, …), player names.
- The old per-reel `suggestions.txt` is no longer written (replaced by `publish/`).

## 5. Label fix
Nations intro grid: "Ranked #N" with the FIFA rank from the competition's standings (World: #1–#16; Euro: e.g. Türkiye #31, Ukraine #36) instead of "1st in the league phase"; clubs keep the league-phase wording. The intro subtitle says "16 nations" instead of "16 teams" for nation tournaments. No other nation-wrong text found (round cards, bracket, winner screen are generic).

## Other changes
- `preflight.js`: images in `assets/backgrounds/` (Max's own scene backgrounds for P7) are not crest decals and are excluded from the crest-manifest check — this check was already red before P6 because of `premier_day.png`. Reel SIMULATION-label detector moved to the new label position.
- Older tests adapted to the P6 decisions (one reel, new safe area, "Vinícius Jr." allowed as a known name, P4 uses a run of the current pipeline).

## Test results
`npm test` (2026-11-13, exit 0): **P1 59/59, P2 30/30, P3 24/24** (reel ffprobe check skipped: no mp4 rendered), **P4 24/24, P5 26/26, P6 35/35**. `npm run players:check` lists the 22 entries to check. Dry run without video `output/runs/2026-11-13_ucl_2026_top16_stadium_night_dryrun`: preflight GREEN. Still frames this phase: 2 (`output/screenshots_p6/`).

## Not verified
- The reel in motion and on a phone with the Shorts overlays (only one still frame checked); audio of the reel.
- Player data beyond the sources: the 22 "De verificat" entries; national squads change every camp, so re-check before a nations video after the next window (the validator fails after 120 days).
- Real 1080p long video / reel files (not rendered; Max renders with START.bat).
