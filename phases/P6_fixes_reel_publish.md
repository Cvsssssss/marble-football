# P6 — Fixes: random golden ball, correct players, ONE full-pitch reel, publish texts

Depends on: P1–P5 (done). Requires from Max: nothing. Max is NOT watching: follow CLAUDE.md, especially **no video renders of any kind** (not even 720p or clips) and **no questions about whether he likes something**: decide, record in the report, continue. Verification = tests + at most ~8 still PNG frames. Report: `reports/P6_REPORT.md` (first 5 lines in Romanian). Notes: `progress/P6.md`. Commit `P6: fixes, reel, publish texts`.

Scope: ONLY the items below. Keep everything else Max approved (physics, windmill, pump timing from P5, bar fix, effects, music, bracket, crests on balls, no SIMULATION label).

## 1. Golden ball must be natural, not forced
Max saw exactly one golden-ball match in every long video; it must be completely natural (sometimes 2–3, sometimes none, depending on the scores).
- Find where the seed gate/selection prefers or forces a golden-ball match or an added-time goal (P1b demo preference, P2 gate) and remove it for all tournament builds. Seeds are accepted only by **technical** gates (no stuck balls, determinism, goals per match within limits, video length window, the comeback gate in section 3). Never choose a seed because it contains (or lacks) a golden ball.
- Golden ball keeps its current rules (only when a knockout tie is level on aggregate after the second leg's 90' + added-time shots).
- Test: simulate 200 tournaments with the timeline simulator only (no rendering) and print the histogram of golden-ball matches per tournament; it must include 0 and values ≥ 2. Report the mean. If the tournament length window rejects too many seeds because of this, widen the window and tell Max.

## 2. Players must match their teams (audit all competitions)
Max found a scorer (Suárez) shown for Colombia: wrong nationality and not even in a national squad any more. Data must be correct and current (today is mid-November 2026).
- Re-collect with **web search/fetch** (official federation/club pages, UEFA/club sites; Wikipedia only as a secondary source) the **3 current attackers** (wingers and forwards count) for every team in all four competitions (MARBLE CHAMPIONS 16 clubs, MARBLE CONTINENTAL 16 clubs, MARBLE WORLD NATIONS 16, MARBLE EURO NATIONS 16). Clubs: current first-team squad. Nations: the latest national-team squad (a player who retired from the national team or has not been called up for years is wrong).
- Schema per player: `name` (initial + surname, e.g. `L. Yamal`), `team`, `nationality`, `position`, `source_url`, `retrieved`, `verified`. Write `config/players_review.md` (table Max can correct) with a column "needs check" for unverified entries. Do not invent players. Max's examples (only hints, sources win; report any difference): Barcelona = Yamal, Raphinha and a third attacker; Real Madrid = Mbappé, Vinícius Júnior and a third attacker (he mentioned Diomande).
- Validator at startup and as test: nations → `nationality == team`; no player in two teams of the same competition; every team has exactly 3 players; `retrieved` within 120 days; **every goal event's scorer belongs to the scoring team** (assert on all generated timelines); unverified entries listed in the report. Grep the whole project for stale names from the old files and remove them.

## 3. Reels: ONE reel per video, whole pitch always in frame
Max has not posted any reel because the frame does not show the whole pitch and the camera pans to follow the ball into the goal. He also wants **one** reel per long video instead of three.
- **Layout (1080×1920):** the full 16:9 scene scaled to the full width (about 608 px tall) in the middle band, **static camera: no pan, no zoom, no crop**; both the windmill/spout side and the goal side always visible. Above it a large scoreboard (team names, score, minute, competition); below it the goal/scorer caption, the "comeback" badge and an info strip. Background: the map's colours, extended and softly blurred. Keep key text out of the bottom ~25% and the right ~12% of the frame (YouTube Shorts overlays; approximate, not verified).
- Slow-motion may stay on good hits; **no zoom and no camera movement** in reels. Duration ≤ 60 s, protected windows as before.
- **Selection (one reel per video):** tournaments: the best comeback match from the round of 16 / quarter-finals (never semi/final), choose the most dramatic by a documented score (lead overturned, minute of the winning goal, goals). Keep the seed gate "at least one comeback in R16/QF"; if none exists within the seed budget, fall back to the match with the latest winning goal and say so. Everything must be deterministic.
- START.bat menu item "reels only" now produces that single reel. Update docs.
- Tests: for sampled frames of the reel the pitch scene rectangle is fully inside the canvas and constant across all frames (assert on the camera track); text boxes inside safe areas; exactly one reel per run. One still frame of the reel layout (PNG) is enough for the visual check.

## 4. Publish texts generated per video (title + description for long video and reel)
Max writes nothing himself any more; he copies from files. For every run write `publish/`:
- `long_title.txt` (3 title options, ≤ 100 characters each, all containing "Simulation"), `long_description.txt` (ready to paste: intro, how it works, **chapters inserted automatically from the chapters file**, call to comment, disclaimer, 8–12 hashtags, first three being the most important), `reel_title.txt` (3 options), `reel_description.txt` (short, with 3–5 hashtags and the disclaimer), `README_publish.txt` in Romanian (where to paste, which options to set: Audience "not made for kids", Category Sports, AI-use answer reminder).
- Content depends on the run: competition display name, number of teams, round/matchweek, map style, whether the video had comebacks/golden ball/windmill bombs (facts from the timeline, never invented), top scorer **team** but **never player names** in any text, never the champion in the long title (spoiler), no official names (except where CLAUDE.md allows for the Premier League format), no "UEFA/FIFA/World Cup/UCL/Champions League" in tournaments. Disclaimer always: computer simulation, not real results, not affiliated with any club/league/competition.
- Variety: pools of intro sentences/title patterns chosen by seed so consecutive videos do not carry identical text; `plan/history.json` remembers the last 10 titles to avoid repeats.
- Checks (tests): title ≤ 100, description ≤ 5000 characters, ≤ 15 hashtags, chapters valid for YouTube (first at 0:00, ≥ 3, each ≥ 10 s, last < duration), no player names, no forbidden words, disclaimer present.

## 5. Small label fix
On the nations intro screen replace "1st in the league phase" by "Ranked #1" (and similar). Clubs keep the league-phase wording. Check any other text that is wrong for nations.

## Finish
Update docs (Romanian) for the changed menu and the `publish/` folder. Run `npm test` (all phases green). No video renders. Report: before/after for each item, the audit table summary (how many entries verified, which changed), histogram of golden balls, what you could NOT verify (visual quality of the reel layout in motion, player data correctness beyond sources). Final message to Max: 3–5 lines in Romanian.
