# P1b — Corrections after viewing demo v2

Depends on: P1 (done). Requires from Max: nothing.
At the start: read `CLAUDE.md` (project rules and protocol). Max is present in this session. Report: `reports/P1b_REPORT.md`. Notes: `progress/P1b.md`.

## Scope
ONLY the five changes below, on the 4-team demo. Keep everything Max liked unchanged: music, other sound effects, map look, windmill, keeper cycle, bar fix, colours on balls, symmetric-bracket code (it becomes an option), final screen, Man of the Match card. Do not touch earlier outputs: write the new video to `output/demo_v2b_1080p.mp4` and screenshots to `output/screenshots_v2b/`. `output/` stays git-ignored.

## 1. Real, current players (3 attackers per demo team)
The names in v2 were fictional (Max did not recognise them, e.g. "Varela"). Replace them for the 4 demo teams (Manchester City, Real Madrid, Bayern Munich, Arsenal) with the **3 best-known attackers of each team's CURRENT squad** (wingers and forwards count), found with **web search** (today is 4 November 2026; do not rely on memory: transfers happen). For every player store `name` in the format **initial + surname** (e.g. `L. Yamal`), `source_url`, `retrieved` date, `verified` flag. Write them in `config/players_review.md` (a table Max can correct) and keep config flag `real_names: true`. If a team's squad cannot be confirmed from a source, mark `verified: false` and say so in the report; do not invent players. Names stay **video-only** (CLAUDE.md rule): never in file names, thumbnails or metadata.

## 2. Bracket: back to the v1 look (left to right)
Max prefers the v1 bracket: columns left to right, semifinals on the left, final on the right, as in v1. Make that the **default** (`bracket_style: "left_to_right"` in the competition file) and keep the symmetric, final-in-the-middle layout available as `bracket_style: "symmetric"` (do not delete it). The left-to-right layout must also work for 16 teams (round of 16 → quarterfinals → semifinals → final, 4 columns plus the champion slot) and stay readable on a phone. Keep the animation of qualifying teams moving to the next column. Test: render both styles for 4 and 16 teams; screenshot of each; open and check.

## 3. Better GOAL moment (it felt dry)
Redesign the in-match goal moment, still clean and not cluttered:
- Banner slides in with a soft bounce: big `GOAL!`, the scoring team's name in its colours, and the scorer **`L. Yamal · 67'`** (player name + minute; this is the one place besides replay/MOTM/winner/podium where names may appear).
- A colour wash in the scoring team's colours (short, ~0.4 s), a burst of confetti/particles in those colours from the goal, a quick score change animation on the scoreboard (the number "pops").
- Keep the existing camera zoom/shake but make them smooth (ease in/out). Show only the latest goal banner (never overlapping). Duration ~2 s.
- The ball is teleported to the pipe after the animation, as in the rules.

## 4. Goal sound: more natural, crowd-like
Max finds the current goal sound artificial. Create **three new goal sounds** (≤ 2.5 s), synthesised with numpy: **crowd-based** (a stadium roar built from layered band-limited noise with slow swell, vowel-like formant colouring for "oooh→aaah", a little randomness, soft release; plus a short net-thump); give them clearly different characters (e.g. A: big roar, B: roar + short rising chime, C: smaller, closer crowd). Save as `output/goal_sfx_samples/crowd_A.wav`, `crowd_B.wav`, `crowd_C.wav`; default `A`, selectable in `config/audio.json` (`"goal_sfx"`). **Also support a custom file**: if `audio/custom/goal.wav` exists, use it instead (Max may add a royalty-free recording; the report must remind him to check the licence and not use copyrighted broadcast audio). Measure loudness so the sound does not mask other effects. State honestly in the report that synthesised crowds cannot match a real recording.

## 5. Added time = shots (the new rule) and the cinematic effect
This replaces how stoppage time works. Max's rule, in his words translated:

**At the end of the 90 regulation minutes** (second half, in every match: leg 1, leg 2 and the final), the announced added time **N ∈ {1, 2, 3}** means **N extra shots**, not N game minutes:
- **Not at the end of the first half** (no added-time shots there; the 45' flash stays as is) and **not during golden ball**.
- At 90': whistle, the pitch is cleared (balls in play are routed into the pipe, about 1.5 s), the banner `+N` is shown, then **N balls are launched one at a time from the spout, exactly like during the match** (windmill, keeper, goal as usual). Alternate the teams (the first ball's team chosen by the seed). Each shot is played **until it resolves** (goal, falls into the void, flies over the goal, or returns to the pipe; cap each shot at 12 s of video time), then the next one starts. After shot N resolves: final whistle. The clock reads `90+1`, `90+2`, … `90+N` as each shot starts and **never exceeds `90+N`**.
- **Goals in these shots count normally**: they change the score and, in a second leg, the aggregate (e.g. aggregate 2–3, at `90+2` a goal makes 3–3 → then the GOLDEN BALL banner). Man of the Match, scorers and the replay of the best goal include them.
- **Cinematic effect, only when the windmill hits the ball "decently"**: define a *good hit* as a windmill contact after which the ball travels towards the right platform/goal with launch speed above a threshold you calibrate (document it). On a good hit: smooth **slow-motion** (time scale eases to about 0.35 over ~0.3 s) and a **smooth zoom-in** on the ball and the goal (ease-in, not exceeding ~1.6×, camera follows the ball), plus a swell in the music/ambience; when the shot resolves, ease back to normal speed and zoom. On a **miss** (no good hit): **no slow-motion and no zoom**; the shot simply plays and ends.
- Never apply slow-motion/zoom in the first half, during regular play, or during golden ball.
- **Golden ball**: unchanged rules (banner, clock **frozen** at `90+N`, no slow-motion and no zoom), but the **golden goal gets a special effect**: a golden shockwave ring from the goal, gold confetti rain, a `GOLDEN GOAL` title with the winner's name and colours, a bigger crowd sound with a short sting. No slow-motion or zoom here. Then the match ends.
- Seed gate: goals per match still 1–10 in total (including shots); golden ball resolves within about 40 s; for the demo prefer seeds where **at least one match contains a goal in added time** and **at least one match goes to golden ball**, but never decide winners by hand (the first valid seed wins). Report how many matches had cinematic shots.
- Replace the old "added minutes" clock logic with this; keep `ADDED_MIN = [1,3]` as parameter. Keep `GAME_MIN_PER_SEC` as is.

## Tests (write them, run them, all must pass)
- Shot count equals N in every match; no shots at 45'; none in golden ball; clock never exceeds `90+N` and never goes backwards.
- Every ball accounted for at every frame; no ball left in the goal; pitch cleared before shots.
- Slow-motion/zoom triggers only on good hits, never on misses, first half, regular play or golden ball (assert on the camera/time-scale track in the timeline).
- Goals in added time update score/aggregate correctly and the golden ball logic reacts (test the scenario aggregate 2–3 → goal → 3–3 → golden ball).
- Determinism hash; goals 1–10; golden ball ≤ ~40 s; players file exists with sources; bracket styles render; goal sound loudness; v2 tests still green.

## Self-review loop (mandatory)
Screenshot and open with the image tool: both bracket styles (4 and 16 teams), the goal banner (3 moments of the animation), the `+N` banner with the cleared pitch, a good-hit slow-motion/zoom frame (before / during / after), a miss without effects, the golden-ball banner with the frozen clock, the golden-goal effect. Fix deviations (max 4 iterations per stage). Finish with ffprobe on the new MP4 and sample frames from start, middle and end.

## Report (`reports/P1b_REPORT.md`, first 5 lines in Romanian)
What changed (the 5 items), the players table with sources and any unverified entries, calibration of "good hit", how many matches had added-time shots/goals/golden ball, test results, the three goal-sound files, decisions you took, what you could NOT verify (motion smoothness, audio by ear). Interpretation notes to include: (a) the idea of "time stops while the ball nearly goes in" is replaced by shots that are always played to their resolution, so no goal can happen after the final whistle; (b) the pitch is cleared at 90' before the shots.

Commit as `P1b: corrections` per CLAUDE.md. Final message to Max: 3–5 lines in Romanian.
