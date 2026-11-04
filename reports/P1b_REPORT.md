# P1b: corecțiile după demo v2

Există `output/demo_v2b_1080p.mp4` (1920×1080, 30 fps, 6:39) și capturi în `output/screenshots_v2b/`. Cele 5 corecții sunt făcute: jucători reali, tablou stânga→dreapta, moment de gol nou, sunete de gol cu public și prelungire = N șuturi cu slow-motion la loviturile bune.
Privește întâi: `09b_goal_banner_full`, `20b_added_time_banner`, `21b_good_hit_slowmo_zoom`, `22a_miss_no_effects`, `12b_golden_goal_title`, `bracket4_left_to_right` și `bracket16_left_to_right`. Ascultă `output/goal_sfx_samples/crowd_A/B/C.wav`. Verifică numele jucătorilor în `config/players_review.md`.
Teste: 57/57 trec (`logs/build_v2b.txt`). Prag „lovitură bună” = 850 px/s spre poartă. În demo: 12 șuturi de prelungire, 8 cu slow-motion, 2 goluri în prelungire și 1 golden ball.
NEVERIFICAT: n-am văzut video-ul în mișcare (fluiditatea slow-motion/zoom, a bannerului și a confetti) și n-am ascultat sunetul. Un public sintetizat nu sună ca o înregistrare reală.

---

## 1. What changed

| # | Item | Result |
|---|---|---|
| 1 | Real players | 3 attackers per team from the **current UEFA Champions League 2026/27 squad pages** (fetched 2026-11-04), stored in `config/teams/*.json` with `source_url`, `retrieved`, `verified`, `position`; review table `config/players_review.md`. `real_names: true` in the competition file; `false` switches to `fictional_players` (the old names, kept). Names appear only in the video. |
| 2 | Bracket | New `bracketLayoutLTR` (v1 look): semifinals left → final → CHAMPION slot with trophy on the right. Default `bracket_style: "left_to_right"`; `"symmetric"` still works. 16 teams: R16 → QF → SF → final → champion, 5 columns, rows 29 design px (43 px at 1080p). Qualifier slide animation kept. |
| 3 | GOAL moment | ~2 s. A dark slanted panel slides in with a soft bounce (easeOutBack). It has team-colour stripes, a big `GOAL!`, the team name on a pill in its colours, and the scorer strip `A. Semenyo · 25'`. It also triggers a 0.4 s colour wash in the team colour, a confetti burst from the goal mouth in primary/secondary, and the scorer's number "pops" (scale + colour) on the scoreboard. The camera zoom/shake are now eased in/out (smoothstep, low-frequency shake). Only the latest goal is shown. The ball still goes to the pipe after `NET_TIME`. |
| 4 | Goal sound | Three new numpy crowd sounds (see §5); default `A`; `config/audio.json` `"goal_sfx"`: `A`/`B`/`C` (old P1 sounds still as `v2_A..v2_C`). A file at `audio/custom/goal.wav` (16-bit WAV) overrides them automatically. |
| 5 | Added time = shots | See §2–§4. Golden goal: golden shockwave rings from the goal, gold confetti rain, a gold `GOLDEN GOAL` panel with the winner's colours + scorer, a bigger crowd + short sting. It has no zoom and no slow motion. |

## 2. Added time = N shots (engine, `sim/engine.js`)
- **At 90'** (second half only): a whistle (`kind:"reg"`, same two-blast sound as half-time) and a `90' · Added time next` banner. Every ball in play flies along a smooth arc to the pipe mouth (top-left), staggered by 0.12 s with 0.9 s each, so the pitch is clear after ≈1.5 s. Balls in the net finish their 0.75 s first.
- Then the `ADDED TIME +N · N EXTRA SHOT(S)` card (1.6 s) on the empty pitch.
- **N shots**, one ball at a time from the spout with the normal windmill/keeper/goal. Teams alternate, and the first team is chosen by the seed. Each shot runs until it resolves: goal, void, over the goal, back in the pipe (stuck), or the cap of 8.5 s of simulation. The cap keeps every shot ≤ 12 s of video even with slow motion; this is tested.
- After a missed shot there is a 0.7 s gap. After a goal there is a 2.2 s gap so the celebration can play.
- **Clock:** `90'` with the `+N` badge until the first shot, then `90+1'`, `90+2'` … as each shot starts, with a `SHOT k/N` badge and a short `SHOT k OF N · TEAM` pill. It never exceeds `90+N'`. Golden ball: frozen at `90+N'`.
- After the last shot: final whistle, or GOLDEN BALL if the deciding result is level (leg 2 aggregate, final). Goals in shots count normally (score, aggregate, MOTM, scorers, replay).
- No shots at 45' and none during golden ball.
- **Interpretation notes:**
  - (a) The idea of "time stops while the ball nearly goes in" is replaced by shots that are always played until they resolve, so no goal can happen after the final whistle (tested).
  - (b) The pitch is cleared at 90' before the shots.
- **Regular play unchanged:** the extra keeper-schedule span and the first-shot team use their own RNG. A given seed therefore plays exactly as in v2 up to 90'.

## 3. Cinematic "good hit" (`sim/cinematic.js`)
- **Definition:** the first windmill contact of an added-time shot. Peak ball speed within 0.3 s after contact ≥ **850 px/s** and moving right (vx > 0) at that peak.
- **Calibration** (`tests/calibrate_good_hit.js`, 300 matches, 592 shot contacts, `build/good_hit_calibration.json`):

| threshold | good share | good → reaches right side/goal | miss → reaches | goal % good / miss |
|---|---|---|---|---|
| 800 | 86 % | 77 % | 0 % | 24 / 0 |
| **850** | **67 %** | **95.7 %** | **6.7 %** | **30 / 1** |
| 900 | 44 % | 97.7 % | 42 % | 34 / 10 |

  850 gives the cleanest separation: almost every good hit really heads for the goal side, and almost every miss does not.
- **Effect:**
  - From one frame per physics step (120 Hz), video frames are resampled with a time scale that eases 1 → 0.35 over 0.3 s of video and back over 0.45 s. Positions are linearly interpolated between steps.
  - The camera follows the midpoint of ball and goal with smoothed follow. Zoom is eased with the same weight, capped at 1.6× and fitted so both stay in view.
  - A light vignette is added. The audio gets a rising crowd "oooh" plus a +3.5 dB music swell.
  - The effect ends when the shot resolves or after 1.8 s of simulation, whichever comes first, so a ball rolling slowly on the platform is not played for long in slow motion.
- Misses, regular play, first half and golden ball: none of these effects (asserted on the per-frame `ts`/`cam` track).

**Demo counts:** 12 added-time shots, **8 cinematic**, 4 misses. Matches with cinematic shots: **5 of 5**. Goals in added time: 2 (SF1 leg 1 `A. Semenyo · 90+1'`, SF1 leg 2). Golden ball: 1 (SF2 leg 2, resolved in 2.3 s).

| Match | Score | N | Shots (team:result) | Golden |
|---|---|---|---|---|
| SF1 L1 Man City–Arsenal | 2–2 | 2 | A goal (cine), B void (cine) | – |
| SF1 L2 | 3–4 (agg 5–6) | 2 | A goal (cine), B void | – |
| SF2 L1 Real–Bayern | 1–2 | 2 | B over (cine), A over (cine) | – |
| SF2 L2 | 3–3 (agg 4–5) | 3 | A void (cine), B void, A void (cine) | yes, Bayern |
| Final Arsenal–Bayern | 2–1 | 3 | A void, B void, A over (cine) | – |

Champion: Arsenal. Top scorers: B. Saka 5, H. Kane 4, E. Haaland 3.

## 4. Players (`config/players_review.md`)
Source: UEFA.com Champions League 2026/27 squad pages, retrieved 2026-11-04, all `verified: true`.
- Man City: E. Haaland 9, J. Doku 11, A. Semenyo 42
- Real Madrid: K. Mbappé 10, V. Júnior 7, Rodrygo 11
- Bayern: H. Kane 9, M. Olise 17, L. Díaz 14
- Arsenal: B. Saka 7, V. Gyökeres 14, E. Eze 10

Notes:
- Doku, Olise and Eze are listed by UEFA as midfielders but play wide or as attackers, so I counted them as wingers, as the phase allows.
- Rodrygo is a mononym, so it has no initial.
- Vinícius Júnior is written `V. Júnior` to keep the format.
- No team was left unverified.

## 5. Goal sounds (`audio/make_audio.py`, `build/audio_goal_report.json`)
- **How they are built:**
  - White noise goes through an STFT filter bank whose vowel formants glide from "oooh" to "aaah".
  - Several layers (lower and higher voices) start slightly offset, with slow random surges, a smooth swell and a soft release, plus a short net-thump.
  - All goal sounds are matched to the same max 400 ms RMS, so switching A/B/C does not change the mix level.
- **The three characters:**
  - **A**: big stadium roar, 4 layers, 2.4 s.
  - **B**: roar + short rising three-note chime, 2.2 s.
  - **C**: smaller, closer crowd with a few individual pitched "aaah!" voices, 1.8 s.
  - Golden goal: a bigger 4-layer roar + a short bell sting, 2.5 s.
- **Files:** `output/goal_sfx_samples/crowd_A.wav`, `crowd_B.wav`, `crowd_C.wav`, `crowd_golden_goal.wav`. The P1 files `goal_A/B/C.wav` are untouched.
- **Loudness in the mix (before loudnorm):**
  - Goal: peak −6.0 to −7.2 dBFS, max short-term RMS −18.2 dBFS (golden −16.2).
  - Loudest existing effects: peak −1.8, short-term −11.7.
  - Criterion "not louder than the loudest existing effect": **PASS**. In the real mix the goal is 2–12 dB above the other effects in its window, so it is audible but does not cover them.
- **Honest limit:** a synthesised crowd cannot match a real stadium recording. It will sound like "noise shaped like a crowd". For a more natural result, put a **royalty-free** recording at `audio/custom/goal.wav`. **Check its licence** (it must allow commercial YouTube use) and **never use broadcast/TV audio** (copyrighted).

## 6. Tests (`node tests/run_tests.js`, 57/57 PASS, `logs/build_v2b.txt`)
**New tests:**
- Shot count == N in 65 matches; none before 90' or in golden ball; teams alternate, one shot at a time, each ≤ 12 s of video.
- Pitch cleared at 90' (whistle; all balls in the pipe within 1.5 s; all other balls in the pipe at every shot start).
- Ball accounting and no ball left in the goal, including the end of the match.
- Cinematic only on good hits (94 good / 45 misses checked): never in misses, regular play, first half or golden ball; zoom ≤ 1.6; time scale ≥ 0.35 and changing smoothly.
- Scenario test: aggregate 2–3, shot goal at `90+3'` → 3–3 → golden ball starts after the last shot.
- Added-time goals count. The clock reads `90+k` at shot k and never goes back or above `90+N`.
- Bracket left-to-right for 4/8/16 teams (columns left→right, champion right of the final, rows ≥ 26 design px); both styles render as PNG.
- Players have sources and the file is present.
- Goal sound loudness.

**v2 tests:** still green (determinism in the same and a fresh process, crossbar 5000 throws, keeper, windmill boost, colours, MOTM, config change).

**Changed after asking Max:** the favourite's win rate is now **54.7 %** (v2: 56.3 %). Added-time shots alternate and are equal for both teams. Max chose to keep the physics and set the range to 53–62 %.

**ffprobe** `output/demo_v2b_1080p.mp4`: 1920×1080, 30/1, H.264 High yuv420p, 11967 frames, 398.9 s (6:39), AAC 48 kHz stereo, −14.1 LUFS, true peak −1.5 dBFS, 106.5 MB. Sample frames: `sample_begin/middle/end.png`.

## 7. Decisions taken
- Kept the goal-banner panel **dark with team-colour stripes**. A first try with the panel in the team's primary colour was unreadable for Man City (sky blue on a sky-blue map).
- The scorer's minute on the banner uses the same rule as the replay caption (`90+k'` in shots).
- Time between shots: 0.7 s after a miss, 2.2 s after a goal (so the 2 s goal moment never overlaps the next shot).
- Cinematic end = resolution or 1.8 s of simulation (a slow roll on the platform would otherwise last 10+ s).
- Golden-goal tail extended from 2 s to 3 s so its effect is complete before the full-time card.
- **Seed gate additions** (physics unchanged):
  - Reject seeds with a crossbar side contact from the 0.1 s front-corner latch, or a ball visibly still > 1.45 s. Both are rare v2 engine edge cases that showed up with the new seeds.
  - The demo prefers an added-time goal in SF1 leg 1 and a golden ball in SF2 leg 2. Winners are never chosen; the first matching seed wins.
- The seed cache key now includes `ENGINE_VERSION` (`p1b-3`), so old cached seeds are not replayed with the new rules.
- `build_all.js` renders both bracket styles into the screenshots folder. The config-change test no longer writes into `output/screenshots_v2` (old outputs untouched).
- `P1b_corrections.md` was in the project root, not in `phases/`; I used and committed it there.

## 8. Known problems
- In `21a_good_hit_before.png` the ball is just leaving the spout, so it is barely visible. The "before" moment is fine in motion.
- `90' · Added time next` and the `+N` card mean two banners in a row (≈3 s total before the first shot).
- At 16 teams the left-to-right boxes are 203 design px wide; very long names are auto-shrunk by `fitText`.

## 9. Not verified
- I did not watch the video in motion: slow-motion smoothness, camera follow, banner bounce, confetti and the 90' ball flight were checked only on static frames and by tests on the time-scale/camera track.
- I did not listen: crowd sounds, the slow-motion swell and the mix were verified only by numbers.
- I did not check phone readability on a real phone.
