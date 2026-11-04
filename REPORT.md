# MARBLE CUP — demo video report

## Final deliverable
- **Video:** `output/demo_final_1080p.mp4`. **5:21** (321.3 s), 1920×1080, 30 fps (9 639 frames), H.264 High yuv420p, AAC stereo 48 kHz 192 kb/s, 71.8 MB. Loudness is **−14.0 LUFS integrated** with a true peak of −1.5 dBFS. These values come from ffprobe and EBU R128; see `build/ffprobe.json`.
- **Screenshots:** `output/screenshots/`. There are 20 key moments, plus `sample_begin/middle/end.png` taken from the final MP4.
- **Result in the video:**
  - SF1: Manchester City vs Arsenal, 3–2 and 3–3, so City go through **6–5 on aggregate**.
  - SF2: Real Madrid vs Bayern Munich, 1–3, then leg 2 is level at 5–5 on aggregate after 90'+3. **Golden ball:** Bayern score after 12.4 s, so leg 2 ends 4–3 (5–6 on aggregate) and Bayern advance.
  - **Final:** Manchester City 4–3 Bayern Munich. **Manchester City are champions.**

## What was built
- **Deterministic 2D simulation** (`sim/`):
  - matter-js 0.19 with a fixed 120 Hz step and a mulberry32 random generator.
  - Each match produces a per-frame timeline at 30 fps: ball position, spin and state, windmill angle, keeper pose and score. It also produces an event list.
- **Seed gate** (`sim/tournament.js`):
  - Simulates seeds for each match until one passes every hard rule: no failure, 1–10 goals, at most 3 anti-stuck teleports, golden ball resolved within the cap, all balls accounted for.
  - It then applies demo preferences (see Decisions).
  - It builds the bracket and the show timeline: segments plus global audio events.
- **Renderer** (`render/`):
  - Canvas 2D in headless Chromium through Playwright. The design space is 1280×720, scaled ×1.5 to 1920×1080.
  - The static background is cached at 2560×1440 and downsampled, which supersamples it. Moving vector elements use the canvas's native anti-aliasing.
  - 10 parallel pages each pipe JPEG frames into their own ffmpeg/libx264 chunk. The chunks are then concatenated. The full render takes about 2.5 minutes.
- **Scene:**
  - Clean blue gradient sky, two grass-and-rock platforms with the void between them.
  - One goal at the right edge: thick white front post, flat crossbar at y=390, fine square net that ripples on a goal.
  - A small orange keeper in profile, two steps in front of the post.
  - The windmill: a 190 px bar with gently curved hooks that curl toward the direction of rotation (counter-clockwise).
  - The spout with a collar and a ring pop effect. A muted, flat return pipe runs down the left edge, under the left platform and up to the spout. Balls inside the pipe are drawn dimmed.
  - Football-style balls with patches, shading, highlight and a soft ground shadow. Radius is 18 px in design space (27 px at 1080p); team A is light blue, team B white.
- **Effects:**
  - On a goal: camera zoom with a slight screen shake (clamped to stay inside the scene), a GOAL banner and a score pulse.
  - Motion trails on fast balls, and spark rings when a ball hits the windmill, the keeper or the bar.
  - A slow-motion replay (0.45×, about 4.5 s) of each match's goal of the match.
  - Half-time flash, "ADDED TIME +N" announcement, golden-ball banner and blinking golden clock.
  - Full-time card, animated bracket updates and qualification animation, then trophy, confetti and fade at the end.
- **Audio** (`audio/make_audio.py`, numpy only):
  - Every sound effect is synthesised and placed from the event list: ground, windmill, keeper, crossbar (short metallic ping), ball-ball, wall, outlet pop, pipe whoosh, net, goal (horn plus crowd), whistles (start, half-time, end), golden-ball sting, added-time chime, bracket swooshes, qualification chime, fanfare, cheer and applause.
  - There is a quiet crowd murmur under every match.
  - The music is original: a D-major loop at 112 bpm with pad, bass, arpeggio and light drums. It is louder on the title and bracket screens, quieter under play, and ducked under goals and whistles.
  - Loudness is normalised to −14 LUFS with two-pass ffmpeg loudnorm.

## How to re-run (one command)
```
npm install          # once (matter-js, playwright, ffmpeg-static, ffprobe-static); then: npx playwright install chromium
node build_all.js    # or: npm run all   (about 6 minutes on a 12-thread PC)
```
The pipeline runs these steps in order:
1. Tests
2. Tournament and seed gate (`build/show.json`, `build/tournament_summary.json`)
3. Screenshots
4. Audio
5. Parallel render
6. Mux, ffprobe and sample frames
7. A final quick test pass

Python 3 with numpy must be available as `python`.

## File map
| Path | Purpose |
|---|---|
| `sim/config.js` | All parameters (HZ 120, FPS 30, gravity, ω, BALLS_PER_TEAM, release interval, golden cap, strength, CARDS/POWERS=false, …) |
| `sim/geometry.js` | Scene geometry and keeper skeleton, shared by the simulation and the renderer, so what is drawn is exactly what collides |
| `sim/engine.js` | Match simulation, kinematic bodies, toss test |
| `sim/tournament.js` | Seed gate, bracket logic, show timeline |
| `render/draw.js`, `render/index.html` | Canvas renderer (scene, HUD, banners, bracket, intro, trophy) |
| `render/render.js` | Playwright driver: `stills`, `frames`, `video [workers]` |
| `render/mux.js` | Loudnorm, mux, ffprobe, sample frames |
| `audio/make_audio.py` | Sound effects and music synthesis |
| `tests/run_tests.js` | Automatic checks; results go to `build/test_results.json` |
| `build_all.js` | One-command pipeline |
| `PROGRESS.md` | Work log, including failed attempts |

## Checks (all 26 pass)
The full-run output is in `build/build_all_log.txt`. `build/test_results.json` holds the closing quick re-check, which uses smaller samples, for example a strength win rate of 55.7 % over 300 matches.
| Check | Result |
|---|---|
| Every ball accounted for at every frame (6 balls, valid state) | PASS |
| No ball stays in the goal: net phase ≤ 0.77 s, then the pipe; no ball ever rests inside the goal | PASS |
| No ball permanently stuck (longest still period ≤ 1.3 s, then anti-stuck) | PASS |
| Anti-stuck teleports per match ≤ 3 | PASS. Actual: 0, 0, 1, 0, 0 |
| Goals per match between 1 and 10 | PASS. 3-2, 3-3, 1-3, 4-3, 4-3 |
| Clock ends at 90' + added time (1–3); half-time whistle at 45' | PASS. +1, +2, +2, +3, +3 |
| Golden ball starts exactly when the deciding result is level; the first goal decides | PASS |
| Golden ball resolves within 40 s | PASS. 12.4 s in the video; 66 of 66 random golden-ball finals resolved, slowest 26.6 s |
| Aggregate is correct and the correct team advances, including by golden ball, plus synthetic cases | PASS |
| Outlet order alternates A, B, A, B | PASS. 100 % |
| Determinism: same seed gives the same hash, also in a fresh process | PASS |
| Windmill: share of tosses reaching the right platform or goal | PASS (see below) |
| Crossbar: a ball from above bounces; a ball from below passes through; no collision with posts; all bar contacts in the tournament came from above | PASS |
| Keeper: crouch/jump cycle present and never still (max 1 identical frame); both poses in screenshots (`07_…`, `08_…`) | PASS |
| Strength: favourite win rate 55–62 % | PASS. 56.2 % |
| CARDS and POWERS off | PASS |

## Windmill reach
- Test: 1 000 single tosses from the spout.
- **70.3 % reach the right platform or the goal.** 30.0 % go straight toward the goal line and 40.3 % land on the right platform.
- 27.9 % fall into the void, 1.8 % come back to the left platform and 0 % go over the goal. The windmill touched 100 % of the tosses.

## Strength / win rate
- Ratings are illustrative only: City 90, Real 89, Bayern 87, Arsenal 86.
- The favourite in each match gets a ball radius ×1.05 and the underdog ×0.95 (±5 %).
- Over 1 200 single matches (600 seeds, each played with the favourite as team A and again as team B, golden ball deciding), **the favourite wins 56.2 %.**

## Decisions taken instead of asking
1. **Tools:** ffmpeg came from the `ffmpeg-static` and `ffprobe-static` npm packages (ffmpeg 6.0), so no admin install was needed. numpy only, no scipy; loudness is normalised with ffmpeg loudnorm.
2. **Gravity and kinematic bodies:**
   - The engine's own gravity is switched off and gravity is applied manually to balls only, so the huge-mass kinematic bodies never drift.
   - Kinematic bodies are driven with `Body.setPosition` / `Body.setAngle` plus an explicit `positionPrev` / `anglePrev`. This is equivalent to `setPosition(…, true)` without the one-step overshoot.
3. **Windmill tuning:**
   - At ω=4.5 rad/s with free tosses, almost nothing reached the goal: launches were too steep, about 1 %.
   - Fix: the outlet tosses when the windmill reaches a phase window (2.75 rad ± 0.22 jitter).
   - Final values: gravity 500 px/s², windmill restitution 0.85, ω kept at **4.5 rad/s counter-clockwise**.
4. **Pipe:** it is visual and scripted, not physical. Balls are teleported to the top, travel along the path at a set speed and queue before the spout.
   - **Release order:** FIFO with A/B alternation. The first queued ball of the team whose turn it is gets released. This turned out to be 100 % alternating.
   - The interval is random in 1.6–2.4 s from the previous release; the actual pop then waits up to about 0.7 s for the windmill phase.
5. **Goal:** a goal counts when the ball's centre crosses the goal line below the crossbar. The ball then plays a scripted 0.75 s net animation (bounce off the back of the net, net ripple) and is teleported into the pipe.
   - **"Over the goal":** a ball touching the right wall above the crossbar is teleported.
6. **Colours and home team:** colours stay constant within a tie. The first-named team is always team A (light blue) in both legs, so there is no home/away colour swap. In the final, the SF1 winner is A and the SF2 winner is B.
   - The leg 2 HUD shows the match score with **"AGG (x–y)"** directly beneath it. The full-time card shows "Aggregate x–y".
7. **Full time:** the last frame freezes behind a "FULL TIME" card, rather than the balls running on.
   - After a golden goal, play continues for 2 s with the outlet closed, then the card shows "DECIDED BY GOLDEN BALL".
8. **Golden-ball flow:** this is the spec's remedy, built into the sim. If a golden ball has not resolved after 20 s, the release interval is divided by 1.3.
   - The tournament's golden ball resolved in 12.4 s, so the remedy was never used in the video.
9. **Demo preferences in the seed gate (soft, applied after the hard rules):**
   - 2–7 goals per match, for pacing.
   - A replayable "nice" goal: under the airborne keeper, over the crouched keeper, or a golden goal.
   - SF2 leg 2 should go to a golden ball, so the golden-ball feature appears in the video.
   - The final should not go to a golden ball.
   - Nobody chose the winners; they come from the first seed that passes.
10. **Team strength:** done through ball size only (±5 %). Size was a weak, noisy lever: ±6.5 % and ±8 % measured lower (53 %) than ±5 %. Density changes made no difference.
11. **Keeper size:** total height is about 74 design px (111 px at 1080p), roughly 0.44 of the goal height. "78 % of the first draft" cannot be measured without that draft, so this is a judgement call.
12. **Durations:**
    - Intro 5.5 s, bracket intro 4 s, bracket update after leg 1: 2.6 s, after leg 2: 3.5 s, finalists bracket 4 s.
    - Before each match, a 1.4 s card; after it, a 2.6 s full-time card; then the replay; winner screen 7.5 s.
    - The video ends right after the trophy screen.
13. **Supersampling:** used only for the static background (cached at 2×). Moving vector elements use the browser's native anti-aliasing at 1080p.
14. **Team chips:** plain colour circles, with no logos. Arsenal is red with a white ring, Real Madrid white with a gold ring.

## Known problems / honest limitations
- **Ball spin is visual only.** Friction is 0, as instructed, so the physics has no rolling. The renderer spins each ball from its horizontal speed, so a ball also "spins" in the air.
- **Balls pass the keeper and windmill visually during scripted states.** Balls in the pipe or the net are not physical, by design.
- **Strength is weak.** The favourite's 56 % sits at the low end of the 55–62 % target. Single matches are high-variance.
- **Release order can skip ahead in the queue.** When alternation needs a ball that is not at the front of the queue, that ball is released from up to 6 slots back. This happens underground and is hard to see.
- **Ball-ball contacts are few** (about 2 per match). The 6 balls are rarely in play at the same time, so the ball-ball sound is rare.
- **Audio is synthetic.** The crowd and horn are noise and additive synthesis and sound clearly artificial. Mix and levels were checked by measurement (LUFS and true peak) and by code review, not by listening.
- **Visual review was done on stills only.** Motion smoothness was checked by reasoning about the per-frame data and frame interpolation, not by watching the video.
- **Small replay overlaps.** The replay window can include a previous goal's ball still in the net, when two goals fall within about 1.5 s of each other.
