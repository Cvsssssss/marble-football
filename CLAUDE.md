# CLAUDE.md — Marble Football Generator (local, no server, no bot, no upload)

Owner: Max (Romanian speaker). Project: a **local generator** of marble-football tournament videos for YouTube. Max starts it with START.bat and gets a finished folder (long video, vertical reels, thumbnails, chapters, checklist), then **publishes by hand and writes his own title and description**. There is NO server, NO Telegram bot, NO database, NO YouTube/Facebook upload code. Master plan: `PLAN.md`. Work is split into 4 phases in `phases/` (P1–P4). Max sits with you in an interactive session and pastes one phase at a time.

## How a phase works
1. Read this file and ONLY the phase file Max names. Don't read the whole repo; use Grep/Glob and read only what is needed.
2. Max is present. Decide small things yourself and record them in the report. If a decision really changes the result (look, rules, scope), ask **one short question** (use the question tool, 2–4 options) and continue after the answer.
3. Keep a short checklist in `progress/<PHASE>.md` as you go, so a new session can continue if this one runs out of context or hits a usage limit.
4. Write tests for the phase's "Definition of done" first or alongside; run them; fix until green. Never loop on the same failing step more than 3 times: try a different approach and tell Max.
5. Self-review loop for anything visual: render screenshots of key moments, open them with the image tool, compare with the phase file item by item, fix; max 4 iterations per stage. Show Max the most important screenshots/files when a part is ready, without waiting for approval to continue.
6. At the end write `reports/<PHASE>_REPORT.md`: **first 5 lines in Romanian** (what exists, what to look at, what is not verified), then English details: decisions taken, test results, known problems, what you could NOT verify (watching video in motion, listening to audio).
7. Then ensure `.gitignore` covers `.env`, `output/`, `build/`, `node_modules/`, `logs/`, `*.mp4`, `*.wav`; run `git add -A` and commit `"<PHASE>: <title>"`; if a remote exists, push. Never commit secrets or videos.
8. Final message to Max: 3–5 lines in Romanian: what to open, what you could not verify, and the exact next step ("deschide un chat nou și lipește P2").

## Token and context economy
- Short tool outputs (`| tail -n 40`, log to files and read the tail). Never print whole JSON timelines, frames or logs.
- Don't improve things outside the current phase. Don't change approved visuals, physics or audio unless the phase says so.
- Reuse the render cache (key = config hash + seed); never re-render everything for a small fix.
- Max starts a **new session per phase** (exit and run `claude` again, or `/clear`), so keep everything needed in files.

## Safety rules
- Secrets (only the optional `FOOTBALL_DATA_TOKEN`) live in `.env`. Never print, log or commit them.
- Don't touch files outside the project folder. Install only what the phase needs (npm packages, numpy, ffmpeg if missing, Playwright Chromium).
- No uploading or posting anywhere. Network use is limited to web search/fetch for team and player data, standings and fixtures.

## Content and rights rules (apply to every video and every file)
- Team names as **plain text**. **Team crests/logos are allowed ONLY as decals printed on the balls** (config flag `logos_on_balls`, Max's explicit decision on 4 Nov 2026). They come from files Max provides in `assets/logos/`; download crests from the web **only if Max explicitly tells you to in the current session**, and then record every source URL in `assets/logos/manifest.json` and in a per-run `LOGO_USAGE.md`. No competition logos, kit designs, sponsors, official trophy designs, anthems or third-party music. Kits = **two colours** (primary, secondary), used for the ball ring and the UI. National teams may show **flags**. Crests are trademarks and may be copyrighted: that is Max's risk (not legal advice); always keep the flag so he can switch it off.
- **All balls have exactly the same size and the same visible look rules** (radius from `config/rules/base.json`, one value for every ball of every team). Team strength may never be expressed through visible size.
- Competition names are our own: **MARBLE CHAMPIONS** (UEFA Champions League teams), **MARBLE CONTINENTAL** (Europa League teams), **MARBLE WORLD NATIONS**, **MARBLE EURO NATIONS**. Never official names or logos on screen. All are config values.
- Real player names (format `L. Yamal`, 3 attackers per team) appear **only inside the video**: goal-replay caption, Man of the Match, winner screen, podium. **Never during play; never in file names, thumbnails, suggested titles/descriptions/tags.** No faces, photos or real shirt designs. Flag `real_names` can switch to fictional names.
- A small `SIMULATION` label is always visible; every suggested title/description says it is a computer simulation, not real results.
- Every video must be visibly different from the previous ones (map/theme, colours, competition, music seed). `plan/` rules and the uniqueness check enforce this.
- Max reviews every video before publishing.

## Technical conventions
- Node 20+, ES modules, `npm` scripts (`npm test`, `npm start`). Python 3 + numpy only for audio. ffmpeg and Playwright Chromium for rendering.
- Deterministic simulation (matter-js, 120 Hz, mulberry32 seed): same config + seed → same timeline hash. Physics, windmill, keeper, map look, music and approved effects change only as a phase says.
- All content is configured by JSON in `config/` and `plan/`, validated by schema at startup.
- Code and comments in English. Messages to Max (menus, checklists, docs, report headers, final messages) in Romanian.
