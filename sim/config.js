'use strict';
// All tunable parameters in one place.
module.exports = {
  HZ: 120,                 // physics fixed timestep
  FPS: 30,                 // video frame rate (one frame recorded every HZ/FPS steps)
  GRAVITY: 500,            // px/s^2 (design space)
  MAX_SPEED: 1500,         // px/s speed cap (anti-tunnelling)
  BALLS_PER_TEAM: 3,
  RELEASE_INTERVAL: [1.6, 2.4],   // s of video time between outlet releases
  GOLDEN_FLOW_BOOST: 1.0,          // >1 shortens the release interval during golden ball (only if needed)
  TOSS_VY: [300, 360],     // px/s upward toss at the spout
  TOSS_VX: [-25, 25],
  TOSS_PHASE: 2.75,       // windmill angle (mod pi) at which the outlet pops a ball (tuned)
  TOSS_PHASE_JIT: 0.22,
  TOSS_PHASE_BOOST: 2.9,  // toss phase once the windmill boost is fully on (ramped together with the boost; tuned)    // +- random jitter on that phase (variety)
  EMERGE_TIME: 0.16,       // s, scripted rise out of the hole before becoming physical
  PIPE_SPEED_FALL: 700,    // px/s inside pipe (vertical part)
  PIPE_SPEED_FLAT: 520,
  STUCK_SPEED: 14,         // px/s
  STUCK_TIME: 1.3,         // s
  NET_TIME: 0.75,          // s the ball stays visible in the net before teleport into pipe
  OMEGA: 4.5,              // rad/s windmill, counter-clockwise on screen
  BALL_RESTITUTION: 0.55,
  MILL_RESTITUTION: 0.85,
  KEEPER_RESTITUTION: 0.5,
  FRICTION_AIR: 0.0015,
  GAME_MIN_PER_SEC: 2,     // 1 s video = 2 game minutes
  GOLDEN_WIDEN_AFTER: 20, // s into golden ball without a goal -> widen spout flow
  GOLDEN_WIDEN: 1.3,       // release interval divided by this (slightly wider flow)
  GOLDEN_CAP: 40,          // s of video for golden ball resolution
  MAX_STUCK_PER_MATCH: 3,
  GOALS_MIN: 1, GOALS_MAX: 10,
  // keeper cycle (randomised per cycle)
  KEEPER_CROUCH: [0.45, 0.95],   // s
  KEEPER_JUMP_H: [45, 105],      // px
  KEEPER_JUMP_T: [0.55, 0.8],    // s airtime
  // strength: favourite's ball radius x(1+S), underdog x(1-S)  (illustrative only)
  STRENGTH_PCT: 0.05, 
  CARDS: false,
  POWERS: false,
  // ---- v2 rule keys (defaults; the real values come from config/rules/<id>.json via config_loader.rulesToCfg) ----
  ADDED_MIN: [1, 3],       // added time range (minutes), max 3
  BOOST_FROM: 60,          // P5 (was 70): game minute from which the windmill turns faster
  BOOST_RAMP: [58, 62],    // smooth ramp window (game minutes)
  BOOST: 1.3,              // angular speed factor after the ramp
  GOLDEN_BALL: true,
  // crossbar: 'swept' = v2 one-way top surface with swept test (collider == drawing); 'v1' = old matter-js collider (for before/after measurement only)
  BAR_MODE: 'swept',
  // ---- P1b: added time = N extra shots (N = announced added minutes), cinematic good hits ----
  ENGINE_VERSION: 'p5-3',  // part of the seed-cache key (simHash)
  CLEAR_TIME: 1.5,         // s after the 90' whistle: balls in play are routed into the pipe
  ROUTE_TIME: 0.9,         // s each ball flies to the pipe mouth
  ROUTE_STAGGER: 0.12,     // s between balls
  ADDED_BANNER: 1.6,       // s the "+N" banner is shown before the first shot
  SHOT_CAP: 8.5,           // s of simulation per shot (<= 12 s of video even with slow motion)
  SHOT_GAP: 0.7,           // s after a missed shot before the next one
  SHOT_GOAL_GAP: 2.2,      // s after a goal (celebration) before the next shot / the final whistle
  SHOT_END_GAP: 0.8,       // s after the last missed shot before the final whistle
  GOOD_HIT_V: 850,         // px/s peak launch speed (0.3 s after windmill contact) that counts as a "good hit" (calibrated, see tests/calibrate_good_hit.js)
  SLOWMO: 0.35,            // time scale during the cinematic
  SLOWMO_IN: 0.3,          // s of video to ease into slow motion
  SLOWMO_OUT: 0.45,        // s of video to ease back
  CINE_MAX_SIM: 1.9,       // s of simulation a cinematic may last (P5: 1.8 -> 1.9 = good_hit.REACH_T + CINE_HOLD)
  CINE_HOLD: 0.35,         // P5: s of simulation the cinematic stays on after the ball reached the goal mouth
  ZOOM_MAX: 1.6,
  // ---- P5 ----
  PUMP_TIMING: 'predict',  // 'predict' = timing-aware pump (sim/pump.js); 'phase' = pre-P5 toss phase (before/after measurements only)
  PUMP_PREDICT_FROM: 'boost', // 'boost' = timing-aware pump once the windmill speeds up (from the ramp start); 'always' = also at normal speed
  PUMP_PICK: 'top',        // 'top' = among the robust good options prefer the strongest contacts (bombs); 'any' = uniform
  PUMP_GOOD_V: 540,        // px/s: first-contact peak speed of a good pump hit (with vx > 0 and the ball reaching the goal side; calibrated, tests/pump_measure.js)
};
