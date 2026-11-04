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

### 0. Two changes requested by Max after demo v2b (do these FIRST, no separate demo video)
Max liked everything in demo v2b except these two points. Apply them to the engine now, then build the 16-team tournament. Do not produce a separate demo video; verify with stills and tests, and let the tournament video be the proof.

**0.1 All balls the same size.** Max sees balls of different sizes between the two teams (the v2 strength rule made the favourite's ball about +5 % and the underdog's about −5 %). Remove every size difference: one radius for every ball of every team (`ball_radius` in `config/rules/base.json`). Team strength must **not** change the visible size. If you still want a small favourite edge, use only **invisible** parameters (for example ball mass/density, restitution within a tiny range, or release timing weights), calibrate on ≥ 1,200 simulated matches, and report the real favourite win rate (target 53–62 %, accepted earlier by Max; if it cannot be reached without visible changes, accept the lower number and say so). Tests: all balls in a match have identical radius; a rendered still measured at 1080p shows both teams' balls with the same pixel diameter (±1 px); the strength test is updated to the new mechanism.

**0.2 Team crest on the ball (decision of Max, 4 Nov 2026).** Replace the plain-colour/patch ball look with a ball that carries the team's **crest as a decal**. Rules (see CLAUDE.md, rights section):
- First, ask Max **one short question** with the question tool: "Pun eu siglele (în assets/logos/) sau vrei să le caut eu pe web? Căutarea are risc de drepturi." If he says he provides them: wait for the folder to have files for the teams in use; if files are missing, fall back to the colours for those teams and list them in the report. If he says to search: you may download crest images (prefer sources that publish them, such as Wikimedia Commons; prefer SVG or PNG ≥ 512 px with transparent background), and you must record `source_url`, `retrieved` and any licence/trademark note in `assets/logos/manifest.json`. Never download anything without his answer.
- Rendering: the ball keeps realistic shading and highlight; base = white or light neutral; a **thin ring and small accents in the team's primary colour** keep the two teams distinguishable at a glance; the crest is the main visual, drawn on the ball surface (clipped to the ball circle, rotating with the ball, slightly darkened at the edge to look printed, not stuck on). Where the crest has a busy background, use a soft circular plate behind it. Keep the colour-contrast rule between teams (ring colour).
- Readability: at 1080p a ball is only about 55 px across; render a close-up crop of both balls (and a 16-team sample of 6 different crests) and **open it with the image tool**; if a crest is unreadable, enlarge the decal up to the ball edge, but never change the ball size.
- Flag `logos_on_balls: true|false` in `config/rules/base.json` (default `true`). `false` returns to the colour-only ball. National teams: flag decal instead of a crest.
- Crests appear **only on the balls**. Not in the bracket, banners or titles, and never competition logos. Thumbnails in later phases will be produced from frames that may include balls; note this in the report.
- Write `LOGO_USAGE.md` in the output folder of every build: list of crests used with source and licence note, plus a one-line reminder in Romanian that the risk of rights/trademark claims is Max's.

Tests for 0.2: manifest and files exist for every team with `logos_on_balls: true` (or a documented fallback); decal pixel check on a rendered still (centre of the ball differs from the plain-colour ball); flag off reproduces the old look; no crest pixels outside balls (sample the bracket and banner stills).

### 1. Competition
- Name on screen: **MARBLE CHAMPIONS** (default, set in the competition file; not the official competition name, no official logo, no anthem, no real trophy design). A small corner label `SIMULATION` stays on screen throughout.
- Format: round of 16 (8 two-legged ties), quarterfinals (4 two-legged), semifinals (2 two-legged), final (single match). Total 29 matches. Two-legged rules as in v2 (aggregate in brackets for leg 2, golden ball if the aggregate is level after leg 2, final decided by golden ball if level).
- **The 16 teams** = the top 16 of the 36-team UEFA Champions League 2026–27 league phase, according to the **current standings**. Get the standings with the web search/fetch tools if available and save the snapshot to `config/competitions/ucl_2026_top16.json` with the source URL and the retrieval date. If you cannot get reliable standings, STOP that step, use a clearly labelled **placeholder list of 16 well-known clubs** that you mark as "placeholder, to be replaced by Max", and continue; record this in the report. Do not invent standings.
- Team files in `config/teams/`: name as plain text, `primary` and `secondary` colours (well-known kit colours only: **two colours, no stripes/patterns/sponsors**; the crest is added only as a ball decal, see 0.2; if unsure choose a plausible colour and mark `"verified": false`), `strength` (illustrative, may derive from league-phase position, say so in the report; it never changes the visible ball size, see 0.1), and **3 players per team = the 3 best-known attackers of the current squad (wingers count)**, found with web search, with `name` (display format **initial + surname**, e.g. `L. Yamal`), `number` optional, `source_url`, `retrieved` date, `verified` flag. Write all players to `config/players_review.md` as a table so Max can correct it. Config flag `real_names` (default `true` for this competition): when `false`, generate fictional names instead. Player names appear ONLY in: goal-replay caption, Man of the Match card, winner screen, podium. Never during play, and never in the video title, description, tags or `matches_index.json` fields meant for metadata (keep names there only in a separate `internal` section).
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
