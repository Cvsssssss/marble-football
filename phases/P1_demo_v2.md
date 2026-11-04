# P1 — Demo v2: corrections + config architecture

Depends on: existing v1 project. Requires from Max: nothing.
At the start: read `CLAUDE.md` (project rules and protocol). Max is present in this session.

You are continuing the existing project in the current folder (marble-football demo v1 is built and approved in spirit by Max). Follow CLAUDE.md (protocol, safety, token rules). Work fully autonomously, never ask questions. When something is ambiguous pick the simplest option consistent with this document and record it in `reports/P1_REPORT.md`.

**Deliverables:** `output/demo_v2_1080p.mp4` (1920×1080, 30 fps, H.264+AAC, ~5 min, 4 teams as in v1), `output/screenshots_v2/`, `output/goal_sfx_samples/` (3 alternatives), `reports/P1_REPORT.md`, updated `PROGRESS.md`. Keep v1 files untouched in `output/` (do not overwrite them). `output/` is git-ignored: do not commit videos.

**Scope:** ONLY the changes below. No server, no Telegram, no database, no upload, no new features beyond this document. Keep everything I liked in v1 unchanged: the background music, all sound effects except the goal sound, the map look, the windmill, the keeper cycle, the overall pacing and the interface style.

### A. Changes to implement

1. **Goal sound effect — replace it.** I dislike the current goal sound (the synthesized horn + crowd sounds artificial). Remove the horn. Create THREE alternative goal sounds, all short (≤1.8 s), synthesized by you with numpy, and save them as `output/goal_sfx_samples/goal_A.wav`, `goal_B.wav`, `goal_C.wav`:
   - A: bright net-swish + soft rising "ding" (two-note chime, no crowd).
   - B: low whoosh + gentle crowd swell made from band-pass filtered noise at low level, fading quickly, no horn.
   - C: short percussive "thump" + marimba-like three-note flourish.
   Use **A** in the video by default, selectable via `config/audio.json` (`"goal_sfx": "A"|"B"|"C"`). Check by measurement that the goal sound never masks the other effects (peak and loudness report in reports/P1_REPORT.md).

2. **Team colours on the balls.** Each team has `primary` and `secondary` colours in its config (§B). Ball body uses the primary colour, the pentagon/patch details use the secondary colour (keep the realistic shading and highlight). Teams used in the demo (text names only): Manchester City (primary `#6CABDD`, secondary `#FFFFFF`), Real Madrid (primary `#FFFFFF`, secondary `#FEBE10`), Bayern Munich (primary `#DC052D`, secondary `#FFFFFF`), Arsenal (primary `#EF0107`, secondary `#FFFFFF`). **Contrast rule:** if the two teams in a match have primary colours that are too similar (compute a colour distance, e.g. CIE76 ΔE < 30), automatically swap one team to its secondary colour as primary for that match, and record it. The bracket, scoreboard and labels use the same team colours.

3. **Crossbar fix (physics).** In v1 the ball sometimes appears to pass slightly *through* the top of the crossbar. Find the cause (tunnelling, collider thinner than the drawing, wrong one-way logic, render/collider mismatch) and fix it. Requirements: the collider must match what is drawn (same thickness and position); the crossbar is solid ONLY on its top surface (a ball falling from above bounces off, a ball from below passes); no collision with the posts. Use swept/sub-stepped detection near the bar if needed. **Write a test:** drop/throw at least 5,000 balls at the crossbar from many angles and speeds, and record the maximum penetration depth of any ball centre/edge into the drawn bar. The test fails if the visible overlap of the ball into the drawn bar exceeds 1 design pixel. Show a before/after screenshot sequence of a bar hit.

4. **Bracket layout: symmetric, final in the middle.** The final slot is in the **centre** of the screen. The tree grows from both edges towards the centre: left half on the left, right half on the right. For the 4-team demo: semifinal 1 on the left, semifinal 2 on the right, final in the middle. Make the layout generic so that a 16-team bracket (8+8 → 4+4 → 2+2 → final in the middle) works with the same code (do not build the 16-team tournament now, only make the layout code support it and add a test that renders a 16-team empty bracket screenshot `output/screenshots_v2/bracket16_empty.png`). Animate qualifying teams moving towards the centre.

5. **Golden ball clock rule.** When a golden ball starts, show the GOLDEN BALL banner, but **freeze the clock** at the value where regulation + added time ended (for example `90+3'`). The clock never advances beyond that value. Nothing can exceed 90 + added time (max 3 as per rules). Add a test: for every simulated match, the displayed clock never exceeds `90+added` and never goes backwards.

6. **Windmill from minute 70.** From game-minute 70 onwards the windmill rotates faster (target +25–35 % angular speed, ramped smoothly between minute 68 and 72) so that balls are thrown harder towards the goal. Do NOT add any visual indicator for it (keep the screen clean). Tune it with a measurement: report the mean launch speed and goal rate before/after minute 70 over ≥300 simulated matches. The overall rules still hold (goals per match 1–10 etc.); if the boost pushes goals above 10 too often, reduce the boost or add safety in the seed gate and record it.

7. **Players, goal replay caption.** Every team has 3 named players (each ball = one player; name + shirt number) in its config. Use **fictional names**, not real people. After each match show the slow-motion replay of the match's best goal with a caption such as `K. Moreno · 67'` (player name + game minute) in the lower third, simple type, readable on a phone. The replay must not show the final score before it happens (as in v1).

8. **Man of the Match.** After every match (after the replay), show a clean card ~3 s: "MAN OF THE MATCH", player name, team, and a simple **original** trophy drawing (not a copy of any real trophy). Rule: most goals in the match; tiebreak: the scorer of the decisive goal / last goal. Store it in the match record.

9. **Final screen.** After the final: left side = winning team (name, team colours) with the trophy (original drawing, keep your v1 trophy if it was original); right side = a **podium with steps** showing the **top 3 scorers of the tournament** (name, team, goals). Tiebreak: fewer matches played, then who reached that total first. Keep confetti and cheering. The video ends when this screen has been shown for ~8 s.

10. Keep the match clock speed `GAME_MIN_PER_SEC` as parameter (`config/rules/base.json`), default 2.0 for this demo.

### B. Configuration architecture (do this too)

Move all content out of code into files, validated at startup by a JSON schema (or equivalent) with clear error messages:
```
config/
  competitions/demo_4teams.json     # name "MARBLE CUP", format, bracket pairing, team ids
  teams/<id>.json                   # name (text), primary, secondary, strength, players[3]{name,number}
  maps/default.json                 # sky colours, ground colours (map theme parameters)
  rules/base.json                   # BALLS_PER_TEAM=3, GAME_MIN_PER_SEC=2.0, ADDED_MIN=[1,3], windmill_boost_from=70, boost=1.3, golden_ball=true
  audio.json                        # goal_sfx "A", music seed
```
One command builds everything: `node build_all.js --competition config/competitions/demo_4teams.json` (keep the old command working or alias it). Changing a team name/colour/player or the map colours must change the next render **without editing code**; add a test that proves it (change one team colour in a temp config, render one still, assert the pixel colour of the ball changed).

### C. Process

Setup/continuation: reuse the existing project; run the existing test suite first and record the baseline. Never loop on the same failing step more than 3 times; try something different and note it in `PROGRESS.md`.

**Self-review loop (mandatory):** after each major change render screenshots at key moments (kick-off, spout, windmill hit, keeper crouched, keeper jumping, goal, bar hit, golden ball banner with frozen clock, replay with caption, Man of the Match card, symmetric bracket, final screen with podium) and **open them with the image-reading tool**. Compare item by item with this document, list deviations, fix, re-render. Max 4 iterations per stage. Record what remains imperfect, honestly.

Automatic tests to pass before the final render (in addition to v1 tests): crossbar penetration test, clock never exceeds 90+added, bracket symmetry + 16-team layout screenshot, colour contrast swap, config-change test, windmill boost measurement, determinism (same seed → same hash).

Finish with `ffprobe` on the final file (resolution, fps, duration, audio stream) and sample frames from start, middle, end.

### D. reports/P1_REPORT.md must contain

What changed (the 10 items), file map, one-command re-run, test results, crossbar penetration numbers (before/after), windmill-boost measurements, loudness report for the goal sounds, decisions you took instead of asking, known problems, honest list of what you could NOT verify (for example audio by ear, watching the video in motion), final path and duration.

Start now.
