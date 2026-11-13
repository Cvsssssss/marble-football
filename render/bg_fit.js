// P7 §7b: cover-fit of an image background into the 16:9 scene (design space 1280x720). Shared by Node tests and the
// browser renderer. Never stretches (one scale factor), never letterboxes (scale >= cover), crops left/right
// symmetrically and keeps the image bottom on the scene bottom (the pitch stays visible). If the image's pitch starts
// below the map ground line (pitchTop = fraction of the image height), the scale grows just enough (bottom-anchored)
// that the ground line sits `inset` px inside the pitch; the extra crop is taken from the top (sky) and the sides.
(function (root) {
  'use strict';
  function bgFit(imgW, imgH, sceneW, sceneH, opt) {
    opt = opt || {};
    const cover = Math.max(sceneW / imgW, sceneH / imgH);
    let s = cover;
    if (opt.pitchTop != null && opt.groundY != null) {
      const need = (sceneH - opt.groundY + (opt.inset || 0)) / ((1 - opt.pitchTop) * imgH);
      s = Math.max(cover, need);
    }
    const dw = imgW * s, dh = imgH * s;
    const dx = (sceneW - dw) / 2, dy = sceneH - dh;
    return { s, cover, dx, dy, dw, dh, cropLeft: -dx / s, cropRight: -dx / s, cropTop: -dy / s,
      pitchTopY: opt.pitchTop != null ? dy + opt.pitchTop * dh : null };
  }
  const api = { bgFit };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BGFIT = api;
})(typeof self !== 'undefined' ? self : this);
