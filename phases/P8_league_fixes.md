# P8 — Premier League fixes after Max watched matchweek 1 (functional fixes)

Depends on: P1–P7 (done). Requires from Max: nothing. Follow CLAUDE.md: **no video renders of any kind** (not even clips), at most ~6 still PNG frames, no taste questions (decide, record in the report, continue). Report: `reports/P8_REPORT.md` (first 5 lines in Romanian). Notes: `progress/P8.md`. Commit `P8: league fixes` (no push).

Max watched the generated matchweek 1 (≈20 min). What he did NOT like, in his words, and what to do:

## 1. Match clock and ball cadence back to the approved feel (most important)
Problem: to lengthen the video, P7 slowed the league clock (1 game-minute = 1 s, matches ~75 s). Side effect: every ball is thrown several seconds after the previous one, not immediately, which makes the game boring. Max wants league matches **exactly like MARBLE CHAMPIONS / the nations tournaments**.
- Set the league match clock and everything tied to it back to the competitions' values (45 s of play per match, game clock as in UCL). Remove the league-specific slower clock config.
- Find the real cause of the long gaps between throws (do not guess): compare the launch schedule of a UCL match and a league match (log the interval between consecutive launches in real seconds, same windmill speed phase). The league must use the **identical launch cadence and pump logic** as UCL (including the P5 timing-aware pump). If the cadence depends on game minutes per second, it must come out the same in real seconds as in UCL.
- Revert "replay every goal" to the same replay rule as in the tournaments (one goal replay per match as before). The video becoming shorter (≈13–15 min for 10 matches) is **fine and intended**: do not add filler to reach a length target; change the league length gate accordingly (no minimum of 20 min).
- Recalibrate the league strength/home-advantage model for the 45 s clock using the engine, headless, with the same targets as P7 section 3 (print measured numbers). If a target cannot be met, say so in the report.
- Tests: league match timeline duration and launch-interval distribution equal the UCL ones within tolerance (print both); other competitions' timeline hashes are **unchanged** by this phase (assert); league video length gate updated.

## 2. Reels (all competitions): normal speed, whole match, centred
Max rejected the league reel: not centred, and parts were fast-forwarded (x2/x4).
- **No fast-forward at all** in any reel (remove the x2 quiet-stretch speed-up and any x4). The reel shows the **whole match from kick-off to the final whistle at its normal speed**. Slow motion only on good-hit/goal moments as already approved (never faster than 1x).
- The match is ~45 s, so with hook/outro the reel must still be ≤ 60 s: shorten or remove the extra hook/end card instead of speeding up. If a tournament match (two legs counted separately in the reel) would exceed 59 s at normal speed, make the selection skip it (documented) and, as the last resort, choose another match; never speed up.
- **Centring:** the scene rectangle must be exactly horizontally centred in the 1080x1920 frame (left margin = right margin, to the pixel) and also vertically placed in the middle band as in P6. Assert it in a test on the camera/layout track. Check the league reel layout too (scoreboard with the league name, matchweek label), and that all key text is inside the safe areas.
- Selection for the league reel stays as in P7 (best comeback, else latest winning goal, else most goals) but only among matches that satisfy the length rule above.
- One still frame of the new reel layout is enough for the check.

## 3. League map: stop using the background photo; draw our own stadium
Max says the image looks terrible in the video (compressed/stretched). Cause unknown: find it (resolution, cover-fit scaling of an ~2.4:1 image into 16:9, blur from upscaling, video compression) and note it in the report, but the decision is made:
- **Do not use `assets/backgrounds/premier_day.png` as a layer any more.** Keep the file only as a **visual reference** (open it with the image tool). Config flag `use_background_image: false` for the premier map (code path may stay for other users, default off).
- Instead, build a **procedural stadium** for the premier map that reproduces the same atmosphere, composition and colours: big curved three-tier bowl with crowd, purple ribbon boards along the tiers, steel truss roof, rows of bright floodlights with glow, blue sky with clouds, striped pitch with the centre circle visible below. Sharp at 1080p (no upscaled bitmaps): vector/canvas drawing, cached offscreen layers, crowd as many small coloured figures with gentle animation (waving flags, small movement), subtle bloom on the floodlights, soft vignette.
- All physics objects stay as they are (platforms, windmill, spout, goal, keeper, ball, scoreboard); only the background layer changes; it must pass all physics tests unchanged. The existing procedural premier stadium from P7 can be replaced.
- Keep the four variants (day, overcast, evening, night) working for the new drawing.
- Up to 3 still frames (day variant, a goal close-up, the reel layout) to self-check sharpness and composition. No competition logo, no text other than plain "PREMIER LEAGUE" where a board exists.

## Finish
Update docs (Romanian): league length now ~13–15 min, reels at normal speed, map without photo. `npm test` green (all earlier phases). Report: before/after for each item (launch-interval numbers UCL vs league before and after, reel duration and speed factor, centring numbers, league calibration numbers, cause of the ugly background), what could NOT be verified (motion in the video). Final message to Max in Romanian, 3-5 lines.
