# P2 — 16-team tournament (long video)

Depends on: P1. Requires from Max: nothing (web search is used for standings and players).
At the start: read `CLAUDE.md` (project rules and protocol). Max is present in this session.

You are continuing the project in the current folder (P1 / demo v2 is done). Follow CLAUDE.md. Work fully autonomously, never ask questions. When ambiguous pick the simplest option consistent with this document and record it in `reports/P2_REPORT.md`.

**Goal:** a **16-team knockout tournament video** (long format) built from the existing engine and the config files, **with no change to the physics, windmill, keeper, map look, music or sound effects** that I approved in v2 (a bug fix is allowed if you record it).

**Deliverables:**
- `output/tournament16_preview_720p.mp4` (fast preview, rendered first so problems show early)
- `output/tournament16_1080p.mp4` (1920×1080, 30 fps, H.264+AAC)
- `output/tournament16_chapters.txt` (YouTube-style timestamps for every round and match, usable in a video description)
- `output/screenshots_p2/`, `output/matches_index.json` (every match: round, teams, seed, score, aggregate, goals with player+minute, comeback flag, Man of the Match, start/end time in the video)
- `reports/P2_REPORT.md`, updated `PROGRESS.md`

**Scope:** ONLY the 16-team tournament. No vertical reels, no server, no bot, no upload, no map variants. (They come in later phases.)

### 1. Competition
- Name on screen: **MARBLE CHAMPIONS** (default, set in the competition file; not the official competition name, no official logo, no anthem, no real trophy design). A small corner label `SIMULATION` stays on screen throughout.
- Format: round of 16 (8 two-legged ties), quarterfinals (4 two-legged), semifinals (2 two-legged), final (single match). Total 29 matches. Two-legged rules as in v2 (aggregate in brackets for leg 2, golden ball if the aggregate is level after leg 2, final decided by golden ball if level).
- **The 16 teams** = the top 16 of the 36-team UEFA Champions League 2026–27 league phase, according to the **current standings**. Get the standings with the web search/fetch tools if available and save the snapshot to `config/competitions/ucl_2026_top16.json` with the source URL and the retrieval date. If you cannot get reliable standings, STOP that step, use a clearly labelled **placeholder list of 16 well-known clubs** that you mark as "placeholder, to be replaced by Max", and continue; record this in the report. Do not invent standings.
- Team files in `config/teams/`: name as plain text, `primary` and `secondary` colours (well-known kit colours only: **two colours, no stripes/patterns/crests/sponsors**; if unsure choose a plausible colour and mark `"verified": false`), `strength` (illustrative, may derive from league-phase position, say so in the report), and **3 players per team = the 3 best-known attackers of the current squad (wingers count)**, found with web search, with `name` (display format **initial + surname**, e.g. `L. Yamal`), `number` optional, `source_url`, `retrieved` date, `verified` flag. Write all players to `config/players_review.md` as a table so Max can correct it. Config flag `real_names` (default `true` for this competition): when `false`, generate fictional names instead. Player names appear ONLY in: goal-replay caption, Man of the Match card, winner screen, podium. Never during play, and never in the video title, description, tags or `matches_index.json` fields meant for metadata (keep names there only in a separate `internal` section).
- **Bracket seeding:** a function `buildBracket(teams, forcedPairs)`. Default: seeded by league position (1 vs 16, 2 vs 15, … in the usual snake layout so the strongest teams meet later). `forcedPairs` (optional) places a given pair as a tie in the round of 16 **or** quarterfinals (preparation for "play a real upcoming match"). Add a test with a forced pair. Final in the middle, symmetric layout (as in v2).

### 2. Timing and structure
- `GAME_MIN_PER_SEC` default for this competition: **2.4** (match ~38 s). Parameter in `config/rules/base.json` / competition file.
- Per match sequence: match → slow-motion replay of the best goal with caption (player + minute) → Man of the Match card (≈3 s) → bracket update (≈2 s). Keep each short; target total video length **25–30 minutes**. Report the real total.
- Round title cards (≈3 s) at the start of each round; the bracket (symmetric, final in the middle) shown at the start and after every round.
- Final: same as v2 (winner + trophy on one side, podium of the top-3 tournament scorers on the other).
- Clock rule as in v2: golden-ball banner with the clock **frozen** at `90+added`.

### 3. Seed gate and "comeback" matches
- All v2 tests apply to every match (goals 1–10, no stuck balls, determinism, no ball left in goal, clock rule, aggregate, correct qualifier).
- **Comeback detection:** a match is a comeback if the winner (or, for leg 2, the team that goes through on aggregate) trailed at some point by at least 1 goal and finishes ahead; "strong comeback" = trailed by 2 or more. Store `comeback` and `comeback_depth` in `matches_index.json`.
- **Selection rule (for later reels):** in the **round of 16 and quarterfinals only**, the seed gate must end up with **at least 3 matches that are comebacks (at least one strong)**. Not semifinals, not the final. Choose seeds to satisfy this **without breaking the other rules**; the winners come out of the simulation, nobody picks winners by hand. If it's impossible within the search budget (say 300 seeds per match), report how many comebacks you found and continue.
- Measure the favourite's win rate over ≥1,000 simulated matches (target 55–62 %) and report it honestly (in v1 it was 56.2 %).

### 4. Performance
- Render in parallel (as in v1, ~10 Chromium pages). Cache rendered segments per match (key = config hash + seed) so that re-running after a small fix re-renders only the changed matches. Add `node build_all.js --competition config/competitions/ucl_2026_top16.json --preview` (720p, lower quality, fast) and a normal mode.
- Reuse the one-command interface from v2.

### 5. Process
Never loop on the same failing step more than 3 times. Run all v2 tests first and record the baseline.

**Self-review loop (mandatory):** after each stage (config + bracket, one full round, the full tournament preview) render screenshots at key moments (bracket with 16 teams placed, round title card, a leg-2 match with aggregate in brackets, golden ball with frozen clock, replay caption, Man of the Match card, bracket after a round, semifinal, final screen with podium) and **open them with the image-reading tool**. Compare with this document, fix, repeat (max 4 times per stage). Record what remains imperfect.

Before the final 1080p render: open the **preview video's** frames at ≥30 sampled times across the whole timeline and check that nothing is broken (empty bracket slots, wrong team colours, overlapping text, wrong score).

Finish with `ffprobe` (resolution, fps, duration, audio) and frames from the beginning, middle and end of the 1080p file.

### 6. reports/P2_REPORT.md must contain

What was built; file map; one-command re-run; how standings were obtained (source, date) or the placeholder warning; the bracket as a table; every match result; list of comeback matches with depth; favourite win rate; real video length and chapter list; test results; decisions taken instead of asking; known problems; a list of what you could NOT verify (watching the video in motion, listening to audio).

Start now.
