# P9 — "Pro" graphics pass: goal, keeper, platforms, effects, small animated details

Depends on: P1–P8. Requires from Max: nothing. Follow CLAUDE.md: **no video renders of any kind**, at most ~10 still PNG frames in total, no taste questions (decide, record). Report: `reports/P9_REPORT.md` (first 5 lines in Romanian). Notes: `progress/P9.md`. Commit `P9: pro graphics` (no push).

Max's feedback: the current look (goal, keeper, ground, the floating "islands"/platforms, effects) looks like a child's drawing; he wants **much more polish: many small details that look irrelevant at first glance but make the difference**, more animations, more realistic and pleasant effects. Max also offered to download skills/tools if they help.

## Scope and rules
- Apply the new art first to the **Premier League map** (all four variants) as a reusable "pro art kit" (config `art_style: "pro"`, default on for the premier map only). Other maps keep their approved look unless Max later asks. If the kit is cleanly reusable, also expose it for other maps through the flag but leave it off.
- **No physics change.** Collision shapes, sizes, windmill/pump timing and all timelines/hashes stay identical (assert hashes unchanged). Art only. Ball radius and all balls stay the same size.
- Performance: render cost per frame must stay close to now (cache static layers offscreen; animate only small elements). Report the measured per-frame time before/after on a still-frame benchmark (no video).
- Tools: Claude Code may install **npm packages or open-source libraries/skills** that help (for example a canvas/WebGL 2D library with glow, shadow and bloom filters, noise generators, a particles library), provided they run inside the existing Playwright/Chromium render, are deterministic (seeded, no real-time randomness) and licensed for use; record each in `docs/ART_KIT.md` with version and licence. Do not add network use at render time. Prefer fewer dependencies.

## 1. Platforms ("islands")
Replace flat stone-block rectangles by believable structures: top face with grass (blades with slight animated sway), soil/stone edge with irregular chips, cracks, moss, small pebbles, contact shadow and ambient occlusion on the pitch below, soft side lighting from the scene's light direction (varies with day/evening/night variants), subtle reflection/rim light. No tiling that is obvious: vary block size/tint with a seeded noise.

## 2. Goal and net
Thicker metal frame with highlights and shading, round posts with gradient, crossbar shadow on the net, **net with depth (back and side panels, perspective)**, individual cords, knots, slight cloth shading; on a goal the net ripples outward with damped waves from the impact point and the frame vibrates a little (visual only); small particles (grass/dust), light flash. Goal-line detail and a subtle shadow on the ground.

## 3. Keeper
Better character: proportions, simple shaded kit using the keeper colour, gloves, boots, head with hair/cap, soft shadow, idle breathing/bounce, reaction animation synchronised with the existing keeper logic (visual only: lean, arm reach, little jump or dive pose), no faces/photos/real kit designs.

## 4. Windmill, spout, ball, ground
Windmill: metal with highlights, rivets, a hub with a glint, blade motion blur at speed, soft shadow on the ground; spout/pump: pipe with shading, steam or air puff and a small bounce on launch; ball: shading, specular highlight, soft shadow on the ground, subtle trail only at high speed (bomb shots), ring/crest decal unchanged in size; ground: mown-stripe pattern with lighting, tiny grass detail, painted lines with slight texture, damp/drizzle variants for the weather versions.

## 5. Ambient detail and effects (the "irrelevant" details)
Animated crowd and flags (premier map), floodlight flares and gentle pulsing, drifting clouds, birds or small particles in the day variant, rain streaks and puddle ripples in the drizzle variant, floodlight cones and dust in the evening/night, camera with a very slight breathing/sway (≤ 2 px, deterministic, never during slow-motion/zoom triggers), scoreboard with glass/metal look, goal celebration extras (confetti or sparks in the scorer's colours, light sweep), hit effects on windmill contact (spark + small shock ring), slow-motion good-hit effect with a subtle chromatic edge or speed lines, soft bloom on bright elements. Everything deterministic from the seed and cheap to draw.

## 6. UI polish used in the league
Scoreboard, result flash, goal banner and the table (rows, zone bars, arrows) get consistent rounded corners, subtle shadows, gradients and micro-animations (easing, small overshoot), without changing layout/readability rules from P7 (row height ≥ 36 px, font ≥ 22 px).

## Verification (stills only, ≤ 10 total)
Day variant overview, night variant overview, goal close-up with net, keeper close-up, windmill/spout area, table frame, one reel layout frame. Self-review loop up to 3 iterations per element: open each PNG, compare with this list, fix. Add tests where possible (hash unchanged, layers cached, determinism of the animated details, no frame exceeding a time budget).

## Finish
Docs in Romanian (`docs/ART_KIT.md`: what exists, how to switch `art_style`, dependencies). Report with before/after stills list, per-frame time numbers, dependencies added, and what could NOT be verified (motion quality, whether it looks "pro" to Max). `npm test` green, commit, no push. Final message in Romanian, 3-5 lines.
