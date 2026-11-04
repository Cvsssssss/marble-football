// Shared scene geometry + pose functions. Used by the Node simulation AND the browser renderer,
// so what is drawn is exactly what collides. Design space: 1280 x 720.
(function (root) {
  'use strict';

  const G = {};
  G.W = 1280;
  G.H = 720;
  G.GROUND_Y = 560;
  G.LEFT_PLAT = [0, 380];
  G.RIGHT_PLAT = [900, 1280];
  G.BALL_R = 18;

  // Goal (right side, flush with right edge, mouth facing centre)
  G.GOAL_LINE_X = 1162;       // front post / goal line
  G.GOAL_DEPTH = 118;
  G.BAR_Y = 390;              // crossbar centre line
  G.BAR_THICK = 8;
  G.BAR_TOP = G.BAR_Y - G.BAR_THICK / 2; // one-way surface (solid only from above)
  G.POST_W = 9;
  // Drawn crossbar rectangle == collider (v2): from the outer face of the front post to the right edge.
  G.BAR_X0 = G.GOAL_LINE_X - G.POST_W / 2;
  G.BAR_X1 = G.W;
  G.BAR_BOTTOM = G.BAR_Y + G.BAR_THICK / 2;

  // Keeper
  G.KEEPER_X = 1106;          // ~two steps in front of the post
  G.K = {
    legLen: 28, legW: 15,
    torsoH: 26, torsoW: 21,
    headR: 9,
    armLen: 28, armW: 8,
    crouchDrop: 13,
  };

  // Windmill (left side)
  G.MILL_HALF = 95;           // bar 190 px
  G.MILL_THICK = 12;
  G.HOOK_R = 22;              // gentle curl radius
  G.HOOK_SPAN = 1.15;         // radians of curl (~66 deg, gentle)
  G.HOOK_THICK = 9;
  G.MILL_EXTENT = G.MILL_HALF + G.HOOK_THICK / 2; // farthest point from hub along bar axis
  G.HUB_X = 205;
  // vertical bar: tip exactly one ball diameter above ground
  G.HUB_Y = G.GROUND_Y - 2 * G.BALL_R - G.MILL_EXTENT;

  // Spout: hole in ground just right of / below the hub
  G.SPOUT_X = G.HUB_X + 58;

  // Return pipe: top of screen along left edge, down, under the left platform, up to the spout
  G.PIPE_X = 26;
  G.PIPE_INNER = 2 * G.BALL_R + 6;
  G.PIPE_OUTER = G.PIPE_INNER + 8;
  G.PIPE_UNDER_Y = 650;
  G.WALL_LEFT_X = G.PIPE_X + G.PIPE_OUTER / 2; // physical left wall = outer face of pipe
  G.PIPE_PATH = [
    [G.PIPE_X, -40],
    [G.PIPE_X, G.PIPE_UNDER_Y],
    [G.SPOUT_X, G.PIPE_UNDER_Y],
    [G.SPOUT_X, G.GROUND_Y + G.BALL_R + 2],
  ];

  // Hook polylines in windmill-local coordinates (hub at origin, bar along +x/-x, angle 0).
  // Rotation is counter-clockwise on screen (angle decreasing in y-down coords).
  // For the +x end the leading side is local -y; hooks curl TOWARD the leading side
  // (they cradle / scoop the ball in the direction of travel). The -x end is point-symmetric.
  G.hookPoints = function (n) {
    n = n || 8;
    const pts = [];
    const cx = G.MILL_HALF - G.HOOK_R;
    for (let i = 0; i <= n; i++) {
      const b = (G.HOOK_SPAN * i) / n;
      pts.push([cx + G.HOOK_R * Math.cos(b), -G.HOOK_R * Math.sin(b)]);
    }
    return pts; // +x end; -x end = negate both coords
  };

  // Path helpers for the pipe
  G.pipeLength = function () {
    let L = 0;
    for (let i = 1; i < G.PIPE_PATH.length; i++) {
      const a = G.PIPE_PATH[i - 1], b = G.PIPE_PATH[i];
      L += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    return L;
  };
  G.pipePoint = function (s) {
    let acc = 0;
    for (let i = 1; i < G.PIPE_PATH.length; i++) {
      const a = G.PIPE_PATH[i - 1], b = G.PIPE_PATH[i];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (s <= acc + l || i === G.PIPE_PATH.length - 1) {
        const u = Math.max(0, Math.min(1, (s - acc) / l));
        return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, i - 1];
      }
      acc += l;
    }
    return [G.PIPE_PATH[0][0], G.PIPE_PATH[0][1], 0];
  };

  // Keeper skeleton from pose (footY, crouch c in [0,1], arms a in [0,1]).
  // Returns collider shapes + joints for drawing. Facing LEFT (toward centre), profile view.
  G.keeperSkeleton = function (x, footY, c, a) {
    const K = G.K;
    const hipY = footY - K.legLen + K.crouchDrop * c;
    const torsoCx = x + 2 * c;                 // slight forward lean in crouch is drawn, collider stays upright
    const torsoCy = hipY - K.torsoH / 2;
    const shoulderY = hipY - K.torsoH + 3;
    const shoulderX = x - 2;
    const headX = x - 3 - 3 * c;
    const headY = hipY - K.torsoH - K.headR + 1;
    // arm angle: down-forward (hands down) -> up-forward (hands up), sweeping through forward (left)
    const phiDown = Math.PI / 2 + 0.35;
    const phiUp = 1.5 * Math.PI + 0.12;   // pointing up, slightly forward (left)
    const phi = phiDown + (phiUp - phiDown) * a;
    const armCx = shoulderX + Math.cos(phi) * K.armLen / 2;
    const armCy = shoulderY + Math.sin(phi) * K.armLen / 2;
    const handX = shoulderX + Math.cos(phi) * K.armLen;
    const handY = shoulderY + Math.sin(phi) * K.armLen;
    return {
      legs: { x: x, y: footY - K.legLen / 2, w: K.legW, h: K.legLen, angle: 0 },
      torso: { x: torsoCx, y: torsoCy, w: K.torsoW, h: K.torsoH, angle: 0 },
      head: { x: headX, y: headY, r: K.headR },
      arm: { x: armCx, y: armCy, w: K.armLen, h: K.armW, angle: phi },
      joints: { hipY, shoulderX, shoulderY, handX, handY, footY, c, a, phi },
    };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.GEOM = G;
})(typeof self !== 'undefined' ? self : this);
