# P4 — START launcher, "what next", preflight, publish checklist, rehearsal, docs

Depends on: P1–P3. Requires from Max: nothing. Optional `FOOTBALL_DATA_TOKEN` in `.env`.
At the start: read `CLAUDE.md` (project rules and protocol). Max is present in this session.

## PART A — Launcher, recommender, preflight, checklist

## Goal
Max double-clicks **START.bat** (or runs `npm start`), picks what to generate, and gets a finished set of files he publishes **by hand**. No server, no bot, no upload, no database.

## Spec
1. **Launcher** (`START.bat` for Windows + `npm start`): Max double-clicks `START.bat` and gets a simple console menu in Romanian, numbered exactly like this (his requested core first):
   1. Alege competiția, harta/tema și (opțional) o pereche forțată (ex. `Barcelona vs Aston Villa`), apoi generează (asks quality: final 1080p or preview 720p)
   2. Preview rapid (720p)
   3. Doar reel-uri din ultimul turneu
   4. Generează videoul recomandat (uses `npm run next`, below)
   5. Deschide folderul cu rezultate
   6. Verifică configurarea și planul (`plan:validate`, schema)
   0. Ieșire
   Re-rendering a single match stays available only as a command-line flag (`--rerender-match <id>`), not in the menu. Also non-interactive: `npm run generate -- --competition <file> --map <theme> [--forced-pair "A vs B"] [--preview] [--no-reels]`. The window must stay open on error and show a clear message and the log path. Show progress and an ETA. Safe to interrupt; re-running resumes from the render cache.
2. **Run folder**: each run writes to `output/runs/<YYYY-MM-DD>_<competition>_<map>/` containing: the long video (1080p or preview), `chapters.txt`, `reels/` (3 vertical reels from P3 part A), `thumbnails/` (3 candidate stills from the best moments, 1280×720, **no text and no player names on them**), `PREFLIGHT.md`, `PUBLISH_CHECKLIST.md`, `run.json` (seeds, config hash, timeline hashes, durations). `output/latest/` points to the last run. File names contain **no player names**.
3. **`npm run next`** (recommender, reads `plan/`):
   - Fixtures: if `FOOTBALL_DATA_TOKEN` exists, read upcoming matches (football-data.org, header `X-Auth-Token`; free tier ~10 requests/min and possibly delayed per third-party sources; cache on disk, refresh at most a few times a day). Otherwise read `plan/fixtures_manual.json` (ship a documented example Max can edit). Read the provider's terms via web search and put what they say in the report, or "unverified".
   - Strong-match rule from `plan/strong_match_rules.json` (both teams in the 16 of the matching Marble competition, or a team on the editable big-club list, or both league-phase positions ≤ 12).
   - Output: what to generate now and why. Strong fixture on day D → generate so that the long video can be published on **D−1 evening (Europe/Copenhagen)**, pair forced into the round of 16 or quarterfinals, reels on D−1 and D. No strong fixture and nothing published in the last 7 days → the next entry of `plan/content_plan.json` (`weekly_random`). Rules from `plan/OPERATING_RULES.md` apply: no same map or competition twice in a row, at most 1 long video/day, 2 reels/day, reels only from round of 16/quarterfinals.
   - `npm run next -- --simulate 8weeks` replays the logic over 8 fake weeks with a synthetic fixture list and prints the schedule; test that no rule is violated.
   - Keep `plan/history.json` (what was generated and published, updated by the launcher; Max can edit it, e.g. to mark a run as published or discarded).
4. **Preflight** (`npm run preflight -- <run folder>`, also runs automatically at the end of every generation), written to `PREFLIGHT.md` as green/red with reasons: ffprobe (resolution, fps, audio) for every file; `SIMULATION` label visible in ≥ 95 % of sampled frames; no image asset outside the allowed asset manifest (no logos); loudness in range; reels ≤ 60 s and safe-area test; **no player names in any file name or text file**; `chapters.txt` valid; uniqueness fingerprint vs the last 5 runs in `plan/history.json` below the threshold from P3 part B; for a forced pair, both teams really are in the bracket. Red items are explained in Romanian.
5. **`PUBLISH_CHECKLIST.md`** (Romanian, generated per run): files to upload and in which order (long video first, then reels with a link to it), suggested publish day/time from the rules, reminders that **Max writes title and description himself** and must: include "SIMULATION" and a sentence that it is a computer simulation, not real results; **not** put player names in title, description or tags; not use official competition names or logos; not use clickbait that promises real results; set the upload to private first, check it, then publish; what to look at in the video before publishing (windmill hits, keeper crouch/jump, ball colours, bracket correctness, captions, sound). Include the chapter text ready to paste. No titles or descriptions are generated here (Max writes them); the optional reel suggestions from P3 part A stay in the reel folders.
6. **No upload code at all** in this project (no YouTube API, no Telegram, no server). Add a test that greps the source for `googleapis`, `youtube.upload`, `api.telegram.org` and fails if found.

## Definition of done
- `START.bat` / `npm start` opens the menu; option 2 produces a preview run folder end to end; option 6 validates.
- Tests: the `next` rules (strong match, D−1 timing in Europe/Copenhagen incl. daylight-saving change, forced pair placement, fallback, caps, 8-week simulation), preflight positive and negative cases (e.g. a file name with a player name must fail), no-upload-code grep, run-folder structure, resume after interruption.
- A preview run folder exists in `output/runs/` and its `PREFLIGHT.md` has been read by you; deviations fixed (max 4 iterations).
- Report lists provider terms (as found), assumptions, and what you could not verify (motion, audio by ear).


---

## PART B — Rehearsal, Romanian docs, final report

## Spec
1. **Full rehearsal** at preview quality via the launcher's non-interactive command: recommended video from `next` → tournament → long video → 3 reels → thumbnails → preflight → checklist. Run it **twice** with the same inputs (identical timeline hashes) and once with the next plan entry (different fingerprint: different map or competition, colours, music seed).
2. **One full 1080p run** of the first entry of `plan/content_plan.json`, so Max has a real result to review. Report real duration, render time, disk usage.
3. **Docs for Max** (Romanian, short, in `docs/`): `PORNIRE.md` (how to start, what each menu option does, where results appear), `CONFIGURARE.md` (add or edit a team, players, colours, competition, map theme, forced pair, `real_names`, music seed, rules like `GAME_MIN_PER_SEC`, `BALLS_PER_TEAM`), `REGULI.md` (the content and rights rules from CLAUDE.md and `plan/OPERATING_RULES.md` in plain language), `DEPANARE.md` (common failures: ffmpeg missing, Chromium missing, out of disk, render too slow, what to send to Claude to fix it). Run every command you wrote in the docs at least once, or mark it untested.
4. **Clean-up**: remove dead code from the abandoned server/bot idea if any exists; make `npm test` green; secret scan (no tokens in repo or logs); `.gitignore` covers `.env`, `output/`, `logs/`.
5. **Honest final report**: status of each phase from `reports/`, every unverified item (motion smoothness, audio by ear, fixture provider terms, player data accuracy, real render time on weak machines), the open decisions for Max (competition name alternative `MARBLE LEAGUE`, `BALLS_PER_TEAM` 3 vs 5, nations ranking basis), and the biggest risks (YouTube treating mass-produced content as inauthentic, names of real players, niche saturation). Do not claim monetization or compliance you cannot demonstrate.

## Definition of done
- `npm test` green; rehearsal passes twice; docs exist; `FINAL_REPORT.md` created; a 1080p run folder exists.
