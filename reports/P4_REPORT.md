Există: START.bat / `npm start` (meniu în română 1–6, 0), `generate.js` (rulare completă într-un folder `output/runs/<data>_<competiție>_<hartă>/`), `npm run next` (ce să generezi acum), `preflight` automat și `PUBLISH_CHECKLIST.md` pe fiecare rulare. Nu există cod de upload.
De deschis: `output/runs/2026-11-04_uel_top16_stadium_day/` (rularea 1080p, V01 din plan): `PUBLISH_CHECKLIST.md`, `PREFLIGHT.md`, `thumbnails/`, `reels/`. Documentația e în `docs/` (PORNIRE, CONFIGURARE, REGULI, DEPANARE).
Repetiția: același preview de două ori → aceleași hash-uri; următoarea intrare din plan → amprentă diferită; toate cu preflight VERDE. Testele: P1 58/58, P2 30/30, P3 25/25, P4 24/24.
Nu am verificat: videoul în mișcare, sunetul ascultat cu urechea, API-ul football-data.org (n-ai token; condițiile sunt luate din surse terțe), timpul de randare pe un calculator mai slab.
Thumbnail-urile sunt prim-planuri cu golul (bila cu sigla, portarul, plasa), fără text: textul îl adaugi tu dacă vrei.

# P4 — launcher, recommender, preflight, checklist, rehearsal, docs (English details)

## What was built
- **START.bat** → checks Node, runs `npm install` the first time, opens `launcher.js`, `pause` keeps the window open on error and points to `logs/generate_last.log`.
- **launcher.js**: menu exactly as specified (1 choose competition/map/forced pair/quality; 2 preview 720p; 3 reels only from the last run; 4 generate the recommended video; 5 open results folder; 6 validate config + plan; 0 exit). `--rerender-match` only on the command line.
- **generate.js** (`npm run generate -- --competition <file> --map <theme> [--forced-pair "A vs B"] [--forced-round R16|QF] [--preview] [--no-reels] [--rerender-match <id>] [--accent] [--match-day --fixture]`): 7 steps with elapsed time; the renderer prints frames + ETA. Resumable: blocks are cached in `build/segcache`, a re-run renders only missing blocks (tested: after `forget F` 34 of 35 blocks reused). Exit 0 green, 3 preflight red, 1 error.
- **Run folder**: long video, `chapters.txt`, `reels/` (3 × reel.mp4 + suggestions.txt + selection.json), `thumbnails/` (3 × 1280×720 PNG, scene only), `PREFLIGHT.md`, `PUBLISH_CHECKLIST.md`, `run.json` (seeds, config hash, timeline hashes, durations, fingerprint), `LOGO_USAGE.md`. `output/latest` is a junction to the last run. `plan/history.json` is appended per run.
- **next.js**: fixtures from football-data.org if `FOOTBALL_DATA_TOKEN` is in `.env` (header `X-Auth-Token`, disk cache `build/fixtures_cache.json`, refreshed at most every 6 h), otherwise `plan/fixtures_manual.json`. Strong-match rule from `plan/strong_match_rules.json`. Strong fixture on D → long video D−1 19:00 Europe/Copenhagen (DST-aware via `Intl` long offset), pair forced in R16, reels on D−1 and D. Else, nothing in the last 7 days → next `weekly_random` entry of `plan/content_plan.json` with a different map and competition than the last run. Caps: 1 long video/day, 2 reels/day, min 4 days between long videos. `--simulate 8weeks`: no rule violated.
- **preflight.js**: ffprobe (resolution, fps, codecs, audio), loudness −14 ±1.5 LUFS, SIMULATION label in ≥ 95 % of sampled frames (pixel-transition detector on the label crop), reel ≤ 60 s + safe area, images only from the asset manifest, no player name in file names or text files (masked in the report), chapters valid, uniqueness ≤ 0.6 vs the last 5 runs, forced pair in the bracket, reel suggestions lint.
- **sim/checklist.js**: Romanian `PUBLISH_CHECKLIST.md` (order: long video first, then reels with a link to it; times; title/description reminders: SIMULATION + "simulare pe calculator, nu rezultate reale", no player names, upload private first, chapters to paste).
- **render/thumbs.js**: decisive goal of each reel match, 0.2 s after the line, zoom 2.1 on the goal mouth.
- **docs/**: PORNIRE.md, CONFIGURARE.md, REGULI.md, DEPANARE.md.

## Decisions
- A plan entry counts as "used" when a non-discarded run with its competition + map exists (preview or final). The first rehearsal showed `next` alternating V01/V02 because the generator does not store `plan_id`; fixed in `next.js`, and `plan:validate` now rejects duplicate competition+map pairs. Max frees an entry by marking the run `"status": "discarded"` in `plan/history.json`.
- Weekly video is proposed from day 6 after the last long video (so it can be published on day 7).
- min_days_between_long = 4 (a strong slot may come at most 4 days after another long video).
- Thumbnails: no text at all (spec); the close-up shows the crest ball, keeper and net.
- The content-plan `accent` is planning/uniqueness metadata only; it is not rendered.
- Strong-match rule is an OR (both in the 16 / big club / positions ≤ 12): with the current lists almost every UCL fixture between two of the 16 is "strong". Max can shorten `big_clubs` or lower `max_league_position`.

- Preflight uniqueness ignores preview runs (never published) and the preview of the same tournament: the first 1080p preflight was red because it compared the final with its own preview (score 1.0).

- **Reels ≤ 60 s for busy matches**: menu option 2 (MARBLE EURO NATIONS, stadium_night, preview) produced a 60.57 s reel, caught by preflight (red). Fix in `sim/reels.js`: if a reel exceeds 59.5 s, the protected normal-speed windows around goals/shots are shortened (×0.6, then ×0.35) so more quiet play is fast-forwarded; reels that already fit are unchanged. `build_reels.js` now only selects matches whose reel fits (in that tournament 28 of 29 fit; one 73 s second leg with 8 key events does not). Rebuilt with menu option 3 → green.
- **Launcher input**: answers typed/pasted ahead of a question were lost (readline); now kept in a queue, end of input = exit. Exit code 3 (files done, preflight red) now shows its own message instead of "generation failed".

## Provider terms (football-data.org) — as found, NOT verified on the official site
- Auth with header `X-Auth-Token`; free tier about 10 requests/minute; free tier covers the main competitions incl. Champions League; scores/fixtures may be delayed; competitions outside the plan return 403.
- Sources: anythingmcp.com/marketplace/football-data, thestatsapi.com/blog/thestatsapi-vs-football-data-org. Max has no token yet, so the API path is untested (only the manual-fixtures path and the cache logic are).

## Rehearsal
| Run | Command | Result |
|---|---|---|
| R1 | `next` → V02 `nations_world_16 / sunset --preview` | 710 s, preflight green |
| R2 | same inputs | 207 s (cache), all 29 timeline hashes and the config hash identical to R1 |
| R3 | `next` → `uel_top16 / stadium_day --preview` | 367 s, preflight green, similarity to R1 = 0.00 |
| menu 2 | `nations_euro_16 / stadium_night --preview` | 10.6 min; preflight red (reel 60.57 s) → fixed, reels rebuilt via menu 3, green |
| 1080p | `uel_top16 / stadium_day` (plan V01) | 981 s (16.4 min; simulation reused from the preview cache, all 1080p blocks rendered fresh), long video 1856.8 s (30:57), reels 53.6 / 53.3 / 54.8 s, run folder 519 MB, `build/` 1.8 GB (of which `segcache` 1.3 GB). Preflight first red (see below), green after the fix. |

## Tests
`npm test`: P1 58/58, P2 30/30, P3 25/25, P4 24/24. P4 covers: no-upload grep, Copenhagen time on both DST changes (Oct 2026, Mar 2027), strong match → D−1, too late, cap, fallback, plan advancing, wait, 8-week simulation (API + CLI), run-folder structure, run.json, `output/latest`, thumbnails, checklist, preflight green, preflight negative (file named after a player → red, name masked), label detector negative, resume after interruption, launcher option 6.

## Not verified
- Video in motion and audio by ear (only frames, ffprobe and measured loudness).
- football-data.org API (no token) and its official terms.
- Render time on a weaker machine (here: about 12 min per preview from scratch).
- Launcher options 1, 4, 5 by hand. Options 2, 3 and 6 were run end to end with piped input (option 2 → `output/runs/2026-11-04_nations_euro_16_stadium_night_preview`, 10.6 min); option 4 runs the same `generate.js` command as the rehearsal.
