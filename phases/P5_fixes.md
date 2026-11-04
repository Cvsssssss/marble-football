# P5 — Fixes after viewing the 30-minute tournament video

Depends on: P2, P3, P4 (done). Requires from Max: nothing. No new demo videos: apply the fixes in the generator, re-render the tournament once (720p check, then 1080p), run the tests. Report: `reports/P5_REPORT.md` (first 5 lines in Romanian). Notes: `progress/P5.md`. Commit `P5: fixes`.

Scope: ONLY the five items below. Do not change music, other effects, map looks, UI or anything Max approved. Everything that changes physics changes all timelines: that is expected. Re-run the seed gate (winners are never chosen by hand), the comeback gate (≥3 comebacks in R16/QF), the favourite-win-rate measurement and regenerate the reels and plan/index files that depend on the matches.

## 1. Balanced bracket (draw)
In the 30-min video the strongest teams were all on the left side and the weakest on the right. Replace the seeding with a **balanced, seeded-random draw**: teams are in 4 pots by strength rank (1–4, 5–8, 9–12, 13–16); each half of the bracket gets 2 teams of every pot, each quarter gets exactly 1 team of every pot; within those constraints the placement is random from the competition seed (so it varies video to video). No fixed "1 vs 16" pattern. Left-to-right layout stays. Test: for 20 different seeds, assert the constraints; top-4 teams can only meet in the semifinals or later.

## 2. Slow-motion/zoom trigger is wrong (30-min video)
Observed: sometimes the ball clearly goes to the goal and there is no zoom/slow-motion; sometimes the ball clearly goes far from the goal (down) and there is zoom/slow-motion. The trigger must follow the rule: **only when the windmill hit sends the ball towards the goal and it really can score**.
- Find the real cause (do not guess): log per added-time shot `hit speed, direction, predicted trajectory, trigger on/off, final outcome`; check whether the camera/time-scale track is derived from the same timeline in every render chunk (parallel pages, cache) and whether the trigger is evaluated at the wrong frame, with the wrong ball (several balls on the pitch), or with a velocity measured before the collision resolved.
- New definition: right after a windmill contact, predict the ball's trajectory (ballistic simulation using the same physics, not a guess); **good hit = the prediction reaches the goal mouth region (within a documented margin) with speed above the calibrated threshold**. Otherwise no effect. Cancel immediately (ease out) if the ball is clearly not going to reach the goal after all.
- Tests over the **whole 29-match tournament** and 20 extra seeds: every shot where the ball ends in the goal or passes within the margin of the goal mouth after a windmill hit has the effect; every shot where the ball's closest approach to the goal mouth is larger than the margin has none. Print the confusion table in the report (target: 0 false positives, 0 false negatives).

## 3. Windmill faster from minute 60 (was 70)
Change the speed-up start from game minute 70 to **minute 60** (config `windmill_fast_from_min: 60`). Keep the current faster speed.

## 4. Pump timing (the important one)
After the windmill speeds up, many balls thrown up arrive when no blade can hit them properly; the windmill hits them badly and they fall down. Max wants to **keep the faster speed** (it produces great "bomb" shots) but the pump must launch at the right moment.
- Make the spout/pump **timing-aware**: before each launch, predict (using the same physics) when the ball will be in the blade's reach; choose the launch moment (delay up to one blade period, and a small seeded jitter so it is not robotic) and, if needed, a small variation of launch speed so the ball meets a blade at a good contact point (ball in the upper part of its flight, blade moving towards the goal side). Respect the game feel: balls are still thrown "one at a time", without visible freezing.
- Measure before and after on the same 200 shots at normal and fast windmill speed: share of "good hits" (>threshold towards goal), share of balls that fall down without a good contact, average shot speed, goals per match. Target: good-hit share at fast speed ≥ the share at normal speed minus 10 points, goals per match still 1–10 and the favourite win rate still 53–62%. Report the numbers.
- Don't change the windmill speed or the blade geometry.

## 5. Crossbar: ball passes through it
Sometimes the ball is not rejected by the crossbar and passes through it. The v2 fix (sub-stepped/swept collider) has a hole at high speeds (bomb shots), or the tunnelling is in the render interpolation, or in how the timeline is sampled.
- Reproduce with the 30-min tournament timelines: for every frame of every match compute the distance from every ball centre to the crossbar (and posts/platform edges); a frame with the ball centre inside the bar's rect expanded by radius − 0.5 px is a failure.
- Find the cause (physics step vs speed, ball-to-ball push into the bar, kinematic windmill pushing a ball into the bar, or rendering interpolation between two recorded states), fix it at the root (adaptive sub-steps by speed, swept test, max speed clamp as the last resort — if you clamp, say so and keep bombs as fast as possible).
- Test: 0 failures over all 29 matches + a stress test with 5,000 random launches at the maximum windmill speed.

## 6. Remove the on-screen SIMULATION label
Max wants the small `SIMULATION` text in the bottom-right corner gone. Make it a config flag `show_simulation_label` (default **false**) and remove the label from all videos and reels (long video, reels, thumbnails). In CLAUDE.md and PLAN.md update the rule: the label is no longer required on screen; the generated `PUBLISH_CHECKLIST.md` and the suggested-description notes must still remind Max that the video is a computer simulation, not real results, and to check YouTube's current altered/synthetic-content disclosure question when uploading. Test: no label pixels/text in rendered frames when the flag is false.

## Finish
To save time and tokens: do NOT view full-length 720p video. Instead render only still frames (and short clips of a few seconds) of the key moments for the checks, then render the full 1080p once. Screenshots of the key moments (fixed bracket, a good-hit effect, a miss without effect, a bar rebound), then 1080p. Update `reports/P5_REPORT.md` with before/after numbers and what you could NOT verify (motion smoothness, whether the new pump timing "feels" right: Max checks it). Run `npm test` (all phases' tests green), the P4 rehearsal check and commit. Final message to Max: 3–5 lines in Romanian.
