// Generic symmetric knockout bracket layout: final in the centre, the tree grows from both screen edges
// towards the centre (left half on the left, right half on the right). Works for 4, 8, 16, 32 teams.
// Shared by the browser renderer and the Node tests. Design space 1280x720.
(function (root) {
  'use strict';
  const ROUND_NAMES = { 2: 'FINAL', 4: 'SEMIFINALS', 8: 'QUARTER-FINALS', 16: 'ROUND OF 16', 32: 'ROUND OF 32' };

  // returns { nTeams, rounds, cols, colW, boxes: [{id, round, side, index, x, y, w, h, rowH, feeders:[id,id], next}], final }
  // round 0 = first round; side 'L' | 'R' | 'C' (final). Box (x,y) is its top-left corner.
  function bracketLayout(nTeams, opts) {
    opts = opts || {};
    const W = opts.W || 1280, top = opts.top || 160, bottom = opts.bottom || 640, margin = opts.margin || 36;
    const R = Math.round(Math.log2(nTeams));
    if (Math.pow(2, R) !== nTeams || R < 2) throw new Error('bracketLayout: nTeams must be a power of two >= 4');
    const cols = 2 * (R - 1) + 1;
    const colW = (W - 2 * margin) / cols;
    const gap = opts.gap !== undefined ? opts.gap : Math.min(70, colW * 0.18);
    const boxW = Math.min(opts.maxBoxW || 400, colW - gap);
    const perSide0 = nTeams / 4;                      // first-round matches per side
    const avail = bottom - top;
    const rowH = Math.min(opts.maxRowH || 58, Math.floor(avail / (perSide0 * 2 + (perSide0 - 1) * 0.9)));
    const boxH = 2 * rowH;
    const boxes = [];
    const byKey = {};
    const colX = (ci) => margin + ci * colW + (colW - boxW) / 2;
    for (let r = 0; r < R - 1; r++) {
      const n = nTeams / Math.pow(2, r + 2);
      for (const side of ['L', 'R']) {
        for (let i = 0; i < n; i++) {
          let cy;
          if (r === 0) {
            const span = avail - boxH;
            cy = top + boxH / 2 + (n === 1 ? span / 2 : (span * i) / (n - 1));
          } else {
            const a = byKey[`${r - 1}${side}${2 * i}`], b = byKey[`${r - 1}${side}${2 * i + 1}`];
            cy = (a.y + a.h / 2 + b.y + b.h / 2) / 2;
          }
          const ci = side === 'L' ? r : cols - 1 - r;
          const bx = { id: `${r}${side}${i}`, round: r, side, index: i, x: colX(ci), y: cy - boxH / 2, w: boxW, h: boxH, rowH, feeders: r === 0 ? null : [`${r - 1}${side}${2 * i}`, `${r - 1}${side}${2 * i + 1}`] };
          boxes.push(bx); byKey[bx.id] = bx;
        }
      }
    }
    // final (centre column)
    const lastL = byKey[`${R - 2}L0`], lastR = byKey[`${R - 2}R0`];
    const fy = (lastL.y + lastL.h / 2 + lastR.y + lastR.h / 2) / 2 - boxH / 2;
    const fin = { id: 'F', round: R - 1, side: 'C', index: 0, x: colX(cols >> 1), y: fy, w: boxW, h: boxH, rowH, feeders: [lastL.id, lastR.id] };
    boxes.push(fin); byKey.F = fin;
    // next pointers + slot (row) each box feeds into
    for (const b of boxes) if (b.feeders) b.feeders.forEach((fid, k) => { byKey[fid].next = b.id; byKey[fid].nextRow = k; });
    const headers = [];
    for (let r = 0; r < R; r++) {
      const name = ROUND_NAMES[nTeams / Math.pow(2, r)] || `ROUND ${r + 1}`;
      if (r === R - 1) headers.push({ text: name, x: colX(cols >> 1) + boxW / 2 });
      else { headers.push({ text: name, x: colX(r) + boxW / 2 }); headers.push({ text: name, x: colX(cols - 1 - r) + boxW / 2 }); }
    }
    return { style: 'symmetric', nTeams, rounds: R, cols, colW, boxW, rowH, boxes, byKey, final: fin, headers, W, trophy: { x: fin.x + boxW / 2, y: fin.y - 95 } };
  }

  // Left-to-right bracket (v1 look, default): first round in the left column, then one column per round,
  // the final, and a narrower CHAMPION slot on the right. All boxes have side 'L' (connectors go right).
  // Box ids: `${round}L${index}` for rounds before the final, 'F' = final, 'CH' = champion slot.
  function bracketLayoutLTR(nTeams, opts) {
    opts = opts || {};
    const W = opts.W || 1280, top = opts.top || 170, bottom = opts.bottom || 560, margin = opts.margin || 40;
    const R = Math.round(Math.log2(nTeams));
    if (Math.pow(2, R) !== nTeams || R < 2) throw new Error('bracketLayoutLTR: nTeams must be a power of two >= 4');
    const CHW = 0.72;                                  // champion column width (in round columns)
    const colW = (W - 2 * margin) / (R + CHW);
    const gap = opts.gap !== undefined ? opts.gap : Math.min(90, colW * 0.2);
    const boxW = Math.min(opts.maxBoxW || 400, colW - gap);
    const n0 = nTeams / 2;                             // first-round matches
    const avail = bottom - top;
    const gapRows = opts.gapRows !== undefined ? opts.gapRows : (n0 > 2 ? 0.35 : 1.6);
    const rowH = Math.min(opts.maxRowH || 58, Math.floor(avail / (n0 * 2 + (n0 - 1) * gapRows)));
    const boxH = 2 * rowH;
    const boxes = [], byKey = {};
    const colX = (ci) => margin + ci * colW;
    for (let r = 0; r < R; r++) {
      const n = nTeams / Math.pow(2, r + 1);
      for (let i = 0; i < n; i++) {
        let cy;
        if (r === 0) { const span = avail - boxH; cy = top + boxH / 2 + (n === 1 ? span / 2 : (span * i) / (n - 1)); }
        else { const a = byKey[`${r - 1}L${2 * i}`], b = byKey[`${r - 1}L${2 * i + 1}`]; cy = (a.y + a.h / 2 + b.y + b.h / 2) / 2; }
        const id = r === R - 1 ? 'F' : `${r}L${i}`;
        const bx = { id, round: r, side: 'L', index: i, x: colX(r), y: cy - boxH / 2, w: boxW, h: boxH, rowH,
          feeders: r === 0 ? null : [`${r - 1}L${2 * i}`, `${r - 1}L${2 * i + 1}`] };
        boxes.push(bx); byKey[id] = bx;
      }
    }
    const fin = byKey.F;
    const chW = Math.min(300, CHW * colW - gap * 0.4), chH = Math.round(boxH * 0.9);
    const ch = { id: 'CH', round: R, side: 'L', index: 0, x: colX(R) + gap * 0.4, y: fin.y + fin.h / 2 - chH / 2, w: chW, h: chH, rowH: chH, feeders: ['F'], champion: true };
    boxes.push(ch); byKey.CH = ch;
    for (const b of boxes) if (b.feeders) b.feeders.forEach((fid, k) => { byKey[fid].next = b.id; byKey[fid].nextRow = b.champion ? 0 : k; });
    const headers = [];
    for (let r = 0; r < R; r++) headers.push({ text: ROUND_NAMES[nTeams / Math.pow(2, r)] || `ROUND ${r + 1}`, x: colX(r) + boxW / 2 });
    headers.push({ text: 'CHAMPION', x: ch.x + ch.w / 2 });
    return { style: 'left_to_right', nTeams, rounds: R, cols: R + 1, colW, boxW, rowH, boxes, byKey, final: fin, champion: ch, headers, W,
      headerY: opts.headerY || top - 52, trophy: { x: ch.x + ch.w / 2, y: ch.y - 100 } };
  }
  function layoutFor(style, nTeams, opts) { return style === 'symmetric' ? bracketLayout(nTeams, opts) : bracketLayoutLTR(nTeams, opts); }

  // Connector polyline from a box's inner edge (towards the centre) into its target row.
  function connector(L, id) {
    const b = L.byKey[id];
    if (!b.next) return null;
    const t = L.byKey[b.next];
    const y0 = b.y + b.h / 2;
    const yT = t.y + t.rowH * (b.nextRow + 0.5);
    let x0, xT;
    if (b.side === 'L') { x0 = b.x + b.w; xT = t.x; } else { x0 = b.x; xT = t.x + t.w; }
    const xm = (x0 + xT) / 2;
    return [[x0, y0], [xm, y0], [xm, yT], [xT, yT]];
  }
  function pointAlong(poly, u) {
    let tot = 0; const seg = [];
    for (let i = 1; i < poly.length; i++) { const l = Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]); seg.push(l); tot += l; }
    let d = Math.max(0, Math.min(1, u)) * tot;
    for (let i = 1; i < poly.length; i++) {
      if (d <= seg[i - 1] || i === poly.length - 1) { const k = seg[i - 1] ? Math.min(1, d / seg[i - 1]) : 0; return [poly[i - 1][0] + (poly[i][0] - poly[i - 1][0]) * k, poly[i - 1][1] + (poly[i][1] - poly[i - 1][1]) * k]; }
      d -= seg[i - 1];
    }
    return poly[poly.length - 1];
  }

  const api = { bracketLayout, bracketLayoutLTR, layoutFor, connector, pointAlong };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BRACKET = api;
})(typeof self !== 'undefined' ? self : this);
