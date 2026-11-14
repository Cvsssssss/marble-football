# P10 — Premier League atmosphere: intro animation, living stands, wind/rain/grass, goal polish, original trophy, crowd sound

Depends on: P1–P9 (done). Requires from Max: nothing. Follow CLAUDE.md: **no video renders of any kind** (not even short clips), at most ~10 still PNG frames in total, no taste questions (decide, record in the report, continue). Report: `reports/P10_REPORT.md` (first 5 lines in Romanian). Notes: `progress/P10.md`. Commit `P10: premier atmosphere` (no push).

Max watched the P9 matchweek video and wants more atmosphere and polish. Scope: the **Premier League map family** (`art_style: "pro"`, all 4 variants). Other maps stay untouched unless a flag turns this on.

## Hard constraints (apply to everything below)
- **No physics change.** Match timelines/hashes of all competitions stay identical (assert). All effects are visual/audio and deterministic from the seed (no real-time randomness). Per-frame render time must stay near the P9 value (13.7 ms); cache static layers; report numbers. Each major effect gets a config flag so Max can switch it off if a render becomes too slow.
- **Rights:** trophy is an **original design** (see §7). No real stadium, no club crests anywhere except as ball decals, no real brand names. No advertising boards or sponsor-like text (Max's decision). **Audio is synthesised by our own code** (no third-party recordings, no music, no melodies or songs; crowd sounds are noise/formant synthesis, claps, generic non-melodic chanting rhythms).
- Match reels stay ≤ 60 s, whole match at normal speed, no fast-forward (P8): any intro/transition in a reel must be ≤ 1.5 s total or omitted so the reel still fits.

## 1. Match intro animation (long video, every league match)
About 2.5–3.5 s before kick-off: the camera starts above the pitch, strongly blurred, and tilts/glides downwards towards the pitch; the blur resolves to a sharp image; the scoreboard bar slides in from the left edge to its place on screen (easing with a small overshoot); team names appear with a short light sweep. Floodlights switch on in the evening/night variants (a flicker, then full brightness). The match clock does not start until the intro ends. The intro does not alter the match timeline (it is a pre-roll). Reel: omit it or use a ≤ 1.5 s version.

## 2. Ground, platforms, wind, rain
- The floating platforms ("islands") become **earth**: soil layers with roots, small stones, darker damp patches, a grass top with **many individual animated blades** swaying with the wind (seeded phase), contact shadow on the pitch and soft ambient occlusion.
- Wind as one global deterministic field per match (strength/direction from the seed and weather variant): drives grass blades, flags, the goal net sway, clouds, cloth, particles (leaves/dust/petals in the day variant).
- Rain in the drizzle/overcast/night variants: layered streaks with parallax, splashes on platforms and pitch, puddle ripples, droplets on a very light lens overlay (subtle, never obscuring the ball), wet shine on the pitch.

## 3. Goal frame
Round, smooth metal tubes: the **crossbar-to-post corners are rounded** (a proper bent corner, not a flat bar butted onto a post), with highlights/shading, small weld/bracket details and a shadow on the net. Net keeps the P9 depth and ripple. **Collision shapes stay exactly as they are** (this is drawing only); check with a test that physics objects are unchanged.

## 4. Stands: two sets of fans
- The crowd is split into **two halves in the two teams' colours** (primary/secondary), home on one side, away on the other, with a neutral mix between. Fans are many small animated figures (idle motion, jumping), with **flags and banners** in the team colours (plain colour stripes/shapes, optional plain-text team short name; no crests, no real kit designs), waved with the wind.
- **Smoke/flares:** occasional coloured smoke from the stands (smoke particles in the team colour, drifting with the wind, lasting a few seconds, rare, never blocking the pitch). Make it a flag `stand_smoke` (default on).
- **Reactions (visual):** on a goal the scoring team's half erupts: people jump, flags wave faster, a few scarves/arms up, confetti/streamers/sparks in the team colours, flares light up; the other half freezes/sits. On a big chance (shot hitting the bar/post, near miss within the margin, good windmill hit towards goal) both halves lean forward and gasp. Late goals/comebacks make the reaction stronger. Everything driven by the existing event timeline.

## 5. Crowd audio (our own synthesis)
Layered crowd bed that rises with the ball's proximity to a goal; roar on goals (the scoring side louder, a short groan from the other side); a distinct **"ooh/ahh" gasp** on a bar/post hit or a near miss; applause at the final whistle; drums/claps rhythm in quiet moments (non-melodic); ambient wind/rain bed matching the variant; sub-bass thump on windmill bomb hits. Mix under the existing music/effects so loudness stays in the existing normalisation range (report LUFS targets). Deterministic from the seed. Tests: audio events are generated at the right timeline moments (assert timestamps), no clipping.

## 6. Advertising boards — NOT wanted
Max decided on 14 Nov 2026: **no advertising boards at all.** Do not draw or add any LED/ad boards or sponsor-like text anywhere (remove any that exist on the premier map). Keep the touchline clean.

## 7. Original trophy (finale and anywhere a trophy appears)
Replace the current trophy with a new **original** design: tall elegant golden cup on a sculpted pedestal, high-quality shading (metal gradients, specular highlights, reflections), a gold light sweep, sparks and confetti in the champion's colours, ribbons in the club's colours. **Do not copy or approximate any existing real trophy** (no lion, crown, or real base/handle designs); it should read as its own object. Update the P7 finale ceremony (three camera angles) to use it and polish the three angles (wide stadium with the new fans/fireworks, low-angle lift, orbit with confetti). Test: ceremony timeline still valid.

## 8. More "invisible" details
Small details in the day/evening/night variants (each deterministic and cheap): birds in the day sky, floodlight cones and insects/dust in the light, lens-breath/very small camera sway (≤ 2 px, never during slow-motion or zoom), referee-whistle visual flash at kick-off and full time, corner flags waving with the wind, dust puffs from hard windmill hits and bomb shots, screen shake on goals (small, short), a brief white flash and light sweep on the goal banner with animated entry, celebration confetti, pitch reflections in the evening/night variants. Add a gentle goal-line/net sparkle on goals and a brief replay transition (swoosh) before goal replays.

## 9. Match transitions (flag `match_transitions`, default **true**, Max wants it)
About 1 s between matches in the long video: a coloured stripe in the two clubs' colours sweeps across the screen with the next fixture's team names, then the pitch appears (it can combine with the intro in §1 without doubling the delay: total pause between matches ≤ ~4 s). Does not appear in reels. Flag can switch it off.

## Verification (stills only, ≤ 10 total)
Intro mid-blur frame and the frame after the scoreboard slid in; day-variant overview with split stands and wind; night variant with rain and flares; goal close-up with the rounded crossbar corner; a goal-reaction frame (scoring half up); the intro/transition stripe; the trophy; one reel frame. Self-review loop up to 3 iterations per element: open each PNG, compare with this list, fix. Tests: physics objects/hashes unchanged, determinism of the animated details, audio event timing, intro timing, flags on/off, no ad boards present, frame-time budget.

## Finish
Docs in Romanian (`docs/ART_KIT.md` updated: list of all effects, their config flags and how to switch them off). Report: before/after stills list, frame-time numbers, audio levels, what could NOT be verified (motion, how the sounds actually sound, whether it feels "Premier League" to Max). `npm test` green (all phases), commit, no push. Final message in Romanian, 3-5 lines.
