Există: kit grafic „pro” (render/art_pro.js) activ pe cele 4 hărți Premier League: platforme din piatră cu iarbă care se mișcă, poartă cu plasă 3D care face unde la gol, portar nou animat, moară metalică cu blur și scântei, nori, ploaie, lumini, UI cu luciu.
Uită-te la: build/p9_stills/p9_variants.png (cele 4 variante), p9_goal.png (gol), p9_sheet.png (portar, moară, piatră), p9_table.png, p9_reel.png; explicații în docs/ART_KIT.md.
Fizica NU s-a schimbat (hash-urile meciurilor identice), hărțile vechi arată pixel cu pixel la fel, cadrul e mai rapid (13,7 ms față de 23,1 ms).
NU am putut verifica: cum arată în mișcare (unde în plasă, iarbă, nori, respirația camerei, blur), dacă arată „pro” pentru tine; nu am generat niciun video.
Pas următor: pornește START.bat și generează o etapă de ligă; dacă ceva nu-ți place, pune "art_style": "classic" în harta respectivă.

# P9 — Pro graphics pass: report (English details)

## What was done
- **New art kit** `render/art_pro.js` (`window.ARTPRO`, ~600 lines, pure Canvas 2D, no dependencies), loaded before `render/draw.js`.
  `draw.js` dispatches to it when `show.map.art_style === 'pro'`; every classic code path is unchanged.
- **Config**: map schema key `art_style` (`classic` | `pro`), set to `"pro"` on `premier_pitchside`, `premier_overcast`,
  `premier_evening`, `premier_night`. All other maps have no key (classic). The kit also works on non-bowl maps
  (tested on `sky_clean` with the flag on) but stays off there.
- **§1 Platforms**: same outline as before (play layout untouched). Masonry with seeded rows of different heights,
  per-stone width, value-noise tint drift + warm/cool tint, chipped corners, bevel lit from the variant's light
  direction, weathering gradient, grain, cracks, moss (more near the top), pebbles in joints, AO under the turf lip,
  bottom darkening, inner-wall side lighting (lit = rim light, shadowed = falloff), evening/night tone, wet streaks at
  night. Turf layer: mown stripes, lit edge, specks, overhanging fringe + its shadow. Per frame: ~280 grass blades
  sway with a travelling gust (3 tones, 3 paths). Contact shadow / AO on the pitch in the gap; low-sun extra shadow.
- **§2 Goal**: far side panel, roof net, far frame tubes (behind the balls in the net); near panel with sag + idle sway,
  cloth shading incl. the crossbar's shadow band, cord shadows, knots; crossbar and front post shaded as round tubes
  **inside exactly the collider rectangles**; net hooks; goal line painted on the turf; goal shadow. On a goal: damped
  radial ripple from the ball's impact point (wave front, exp decay), frame vibration (≤1.1 px, visual only), flash,
  grass/dust particles. Bar hit: additive flash + vibration.
- **§3 Keeper**: drawn on the unchanged `G.keeperSkeleton` joints. Thighs/knees/socks with band/shin highlight, shaped
  boots with sole and accent, long sleeves with elbow bend and cuffs, padded gloves with wrist strap and finger lines,
  tapered jersey shaded from the key light with an own-design diagonal panel, collar, number 1, shorts with side stripe,
  neck, shaded head, ear, hair (cap with brim in the sunny variant), eye dot only (no face detail). Soft shadow that
  shrinks in the air, idle breathing (upper body ±0.7 px), lean into the reach, leg tuck on jumps.
- **§4** Windmill: motion-blur ghosts when the tip moves > 5 px/frame, cast shadow, hook highlights, approved bar fill
  and bands kept (`millBar`), metallic overlay whose highlight follows which side faces up, specular line, rivets,
  hub flange with rotating bolts, cap, angle-dependent glint, ground shadow following the bar's extent; steel A-frame
  stand with bracing and bolted base plate. Windmill contact detection from the timeline (ball within reach + Δv > 220
  px/s, first frame of contact) → spark + shock ring. Pipe: glass tube with highlights and clamps, channel carved in
  the stone, hole with depth; spout collars shaded, bounce on launch, air puff venting from both sides of the hole.
  Ball: soft shadow (size/alpha by height, offset by light), rim light + specular dot; tapered streak only above
  700 px/s (bomb shots); size and decal unchanged. Pitch: grass speckle, worn paint on the halfway line and circle,
  light falloff, damp variant (darker + floodlight reflections).
- **§5 Ambient/effects**: live sky layer (gradient, stars at night, evening glow, overcast deck) with drifting cloud
  sprites (with shaded undersides), birds in the day variant, pulsing floodlight flares on 1/3 of the roof lights,
  floodlight cones + floating dust (evening/night), 2-layer rain with splashes and puddle ripples (night), camera
  breathing ≤ 2 output px (measured max 1.85 px), faded to 0 around goals (zoom), cinematic slow-motion, and never in
  replays/reels/zoom options. Goal: sparks in the scorer's colours + light sweep (on top of the existing confetti).
  Slow motion: speed lines + subtle red/cyan edge. Bloom is done selectively with additive glow sprites (flares,
  post glint, flashes, sparks) — a full-frame bloom would cost too much.
- **§6 UI**: `uiPanel` / `uiScoreBox` replace the flat fills of the HUD (stage label, scoreboard, aggregate, clock
  pills), shot pill, goal-banner scorer strip, full-time result card, table panel, table result card, reel scoreboard
  and info strip — same rectangles, plus gradient sheen, 1 px edge, top highlight and soft shadow. Goal banner: glass
  sheen + a glint sweep once it has landed. Table: rounded zone bars with highlight, gradient highlight rows, arrows
  appear with a small overshoot (easeOutBack). Result card: 0.94→1 overshoot scale as it fades in. Layout and font
  sizes untouched (P7 rules hold; P7 tests pass).

## Decisions taken (no questions asked, per Max's rule)
- No libraries: Canvas 2D + own seeded hash noise was enough; fewer dependencies, no licence questions.
- `art_style` is a map key (not a global flag) so each map can be switched in one line.
- Performance fix: drawing the 2x background cache with `imageSmoothingQuality: 'high'` costs ~16 ms per frame in
  headless Chromium. In pro mode the static background is pre-downsampled once (high quality) to output size and drawn
  near 1:1 with 'medium'; zoomed frames use the 2x cache with 'medium' (mipmapped bilinear). Result: faster than before.
  Trade-off: during the goal zoom / replays the background is resampled bilinear instead of bicubic (slightly softer).
- Keeper wears a cap in the sunny variant (detail); hair otherwise.
- Background layer list (P7b/P8 tests): the sky stays the first layer named `sky` (in pro it is drawn live per frame)
  and `art:pro` is appended last, so the older layer-order tests keep their meaning (P8 test also filters it).

## Tests (`npm test`, all suites)
- New `tests/p9_tests.js` (19 checks): timeline hashes vs fixture recorded before any P9 change (5 cups × 3 seeds +
  simHash, 4 league matches); layout constants; config/schema; art source deterministic/offline; index.html order;
  cache keys include art_pro.js; no new dependency; **classic map pixel-identical to the pre-P9 renderer** (6 frames,
  fixture made with `git archive HEAD` renderer); per premier map: static layers built once over 40 frames, same
  frame → same pixels; fresh vs used page identical; sway ≤ 2 px and off in goal zoom/replay; all segment types of a
  matchweek + season finale draw without errors; kit reusable on sky_clean; time budget.
- Results: run 59/59, P2 30/30, P3 24/24, P4 24/24, P5 26/26, P6 35/35, P7 66/66, P7b 58/58, P8 33/33, **P9 19/19**.
  (First full run: P7b 3 failures on the layer names -> fixed as above, then P7b/P8/P9 re-run green; logs/p9_*.log.)

## Per-frame time (still-frame benchmark, 150 match frames, 1920x1080, no video; `tools/p9_bench.js`)
| | mean | p50 | p95 | max |
|---|---|---|---|---|
| before (P8 renderer), day | 23.1 ms | 22.2 | 26.4 | 32.6 |
| before, night | 23.3 | 22.5 | 27.0 | 32.3 |
| first pro version (no perf fix) | 35.3 | 34.1 | 43.2 | 48.1 |
| **after (pro), day** | **13.7** | 11.5 | 23.1 | 30.9 |
| **after (pro), night** | **14.7** | 12.5 | 24.7 | 32.4 |
(JPEG encoding of the real render pipeline comes on top of these numbers, the same as before.)

## Stills (6 of max 10; all in build/p9_stills/)
Before (not re-rendered, from P8): build/p8_stills/p8_match_day.png, p8_goal_closeup.png, p8_reel_layout.png.
After: `p9_sheet.png` (day overview, keeper jump crop, windmill/spout crop, night goal-side crop — rendered twice,
v2 kept), `p9_goal.png` (0.3 s after a goal, zoom), `p9_variants.png` (day/overcast/evening/night), `p9_table.png`,
`p9_reel.png`. Self-review fixes from them: stones too uniform → tint drift, weathering, stronger bevel; spout puff
hidden under the rising ball → vents sideways, larger, longer; windmill blur read as a red halo → ghost alpha lowered.

## Known problems / NOT verified
- Motion quality was not seen (no video by rule): net ripple, blade sway, cloud drift, camera breathing, windmill
  blur, sparks and puffs are verified only by math, single frames and determinism tests.
- Windmill hit detection is a heuristic on the recorded frames (Δv threshold); some light contacts may not spark,
  a ball cradled in a hook may spark once when it is picked up.
- The puff after the last fix was not re-checked on a still (budget kept for the report stills).
- Whether the look is "pro" enough for Max is not verified. Audio was not touched.
- Background resampling during zoomed shots is bilinear (slightly softer than before) — chosen for speed.
