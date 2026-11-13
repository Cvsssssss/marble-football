// P7 §5: league table geometry in design units (1280x720; output 1080p = x1.5). Shared by render/draw.js and tests.
//   'update': live table next to the result card after every match;  'full': end-of-week table with zones and form.
(function (root) {
  'use strict';
  const W = 1280, H = 720;
  function tableLayout(kind) {
    const full = kind !== 'update';
    const w = full ? 900 : 760, x = full ? (W - w) / 2 : 486, y = 112, rowH = 26, font = 16;
    const cols = full
      ? { stripe: 0, pos: 30, crest: 64, name: 84, nameW: 300, p: 420, w: 470, d: 515, l: 560, gd: 625, pts: 700, form: 760, arrow: 870 }
      : { stripe: 0, pos: 30, crest: 64, name: 84, nameW: 300, p: 420, w: 468, d: 510, l: 552, gd: 610, pts: 676, arrow: 730 };
    return { kind: full ? 'full' : 'update', x, y, w, rowH, font, headFont: 13, headY: y - 13, rows: 20, bottom: y + 20 * rowH, legendY: y + 20 * rowH + 22, cols };
  }
  const api = { tableLayout, W, H };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LEAGUE_LAYOUT = api;
})(typeof self !== 'undefined' ? self : this);
