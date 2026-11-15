/* FarmSense Brew - pinch to zoom the user manual flipbook while it is full
   screen on a touch screen. Two fingers zoom; one finger still turns pages.
   The book follows the fingers while pinching, then settles on the nearest of
   the manual's own zoom steps (by pressing its Zoom in / Zoom out buttons).
   The flipbook library starts tracking the first finger as a possible page
   turn, so once a second finger lands it is told that touch ended without a
   turn, and it sees nothing more until every finger is lifted.
   While zoomed in, one finger moves the page freely in any direction instead
   of turning it, the view keeps its place when the zoom changes, and a small
   "Zoom out" button sits at the bottom right until the book is back to normal
   size; then pages turn as usual.
   Past the manual's largest step (2.1x) a pinch keeps magnifying with the CSS
   zoom property, up to 5x in all, so text is drawn sharp at the new size.
   Pinching in, the toolbar's Zoom out and the Zoom out button take that extra
   magnification off first. */
(function () {
  // Zoomed in, the book is bigger than the screen. Centring it with flexbox
  // pushes its top edge out of reach (a scroll box cannot scroll above its
  // start), so while zoomed it is centred with auto margins instead, which
  // only centre when there is room. This applies to mouse users too.
  var fix = document.createElement('style');
  fix.textContent = '.mbk-stage.zoomed{align-items:flex-start!important;justify-content:flex-start!important}' +
    '.mbk-stage.zoomed>.mbk-book-wrap{margin:auto!important;flex:none}';
  (document.head || document.documentElement).appendChild(fix);

  if (!('ontouchstart' in window)) return;
  var STEP = 1.27; // average ratio between the manual's zoom steps
  var TOP_STEP = 2.1, MAX_TOTAL = 5; // the manual's largest step, and the most in all
  var extra = 1; // magnification added on top of the largest step
  var pinching = false, startDist = 0, scale = 1, wrap = null, firstTouch = null;

  var pan = null;

  function book() {
    var fs = document.fullscreenElement;
    return fs && fs.classList && fs.classList.contains('mbk') ? fs : null;
  }
  function anyBook() { return book() || document.querySelector('.mbk'); }
  function zoomedStage(b) { return b && b.querySelector('.mbk-stage.zoomed'); }
  function isControl(el) { return !!(el && el.closest && el.closest('button, a, input, select, .mbk-bar')); }
  function dist(t) {
    var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function fake(type, x, y) {
    var ev = document.createEvent('Event');
    ev.initEvent(type, true, true);
    var list = [{ clientX: x, clientY: y, pageX: x, pageY: y }];
    Object.defineProperty(ev, 'changedTouches', { value: list });
    Object.defineProperty(ev, 'touches', { value: [] });
    return ev;
  }
  // End the library's single-finger touch without a page turn: a move of more
  // than 10 px marks it as a drag (if it had started), and a drag that ends is
  // put back instead of turned.
  function cancelTurn() {
    if (!firstTouch) return;
    var x = firstTouch.x, y = firstTouch.y;
    pinching = false;
    window.dispatchEvent(fake('touchmove', x + 12, y));
    window.dispatchEvent(fake('touchend', x + 12, y));
    pinching = true;
  }

  window.addEventListener('touchstart', function (e) {
    var b = book() || (function (m) { return m && zoomedStage(m) ? m : null; })(document.querySelector('.mbk'));
    if (!b || !b.contains(e.target)) { firstTouch = null; pan = null; return; }
    if (e.touches.length === 1) {
      firstTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      var st = zoomedStage(b);
      if (st && !isControl(e.target)) {
        pan = { stage: st, x: firstTouch.x, y: firstTouch.y, left: st.scrollLeft, top: st.scrollTop, winY: window.pageYOffset };
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
      }
      return;
    }
    pan = null;
    if (e.touches.length === 2 && !pinching) {
      if (!e.changedTouches || e.changedTouches.length < 2) cancelTurn();
      pinching = true;
      startDist = dist(e.touches) || 1;
      scale = 1;
      wrap = b.querySelector('.mbk-book-wrap');
      if (wrap) { wrap.style.transformOrigin = '50% 50%'; wrap.style.transition = 'none'; }
    }
    if (pinching) { e.stopPropagation(); if (e.cancelable) e.preventDefault(); }
  }, { capture: true, passive: false });

  window.addEventListener('touchmove', function (e) {
    if (pan && !pinching && e.touches.length === 1) {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      var dx = e.touches[0].clientX - pan.x, dy = e.touches[0].clientY - pan.y;
      var st = pan.stage;
      st.scrollLeft = pan.left - dx;
      if (st.scrollHeight > st.clientHeight + 1) st.scrollTop = pan.top - dy;
      else window.scrollTo(window.pageXOffset, pan.winY - dy);
      return;
    }
    if (!pinching) return;
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    if (e.touches.length < 2) return;
    scale = Math.max(0.5, Math.min(2.5, dist(e.touches) / startDist));
    if (wrap) wrap.style.transform = 'scale(' + scale + ')';
  }, { capture: true, passive: false });

  function end(e) {
    if (pan && !pinching) {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault(); // no page turn and no emulated click
      if (!e.touches || e.touches.length === 0) pan = null;
      return;
    }
    if (!pinching) return;
    e.stopPropagation();
    if (e.touches && e.touches.length > 0) return; // wait for every finger
    pinching = false;
    firstTouch = null;
    if (wrap) { wrap.style.transform = ''; wrap.style.transition = ''; }
    var b = anyBook();
    if (!b) return;
    var zin = b.querySelector('.mbk-bar [aria-label="Zoom in"]');
    var zout = b.querySelector('.mbk-bar [aria-label="Zoom out"]');
    if (scale < 1 && extra > 1) { // take the extra magnification off first
      var left = extra * scale;
      if (left >= 1) { setExtra(left); return; }
      setExtra(1);
      scale = left;
    }
    if (scale > 1 && zin && zin.disabled) { setExtra(extra * scale); return; } // already at 2.1x
    var steps = Math.round(Math.log(scale) / Math.log(STEP));
    var target = steps > 0 ? zin : zout;
    for (var i = 0; target && i < Math.abs(steps); i++) target.click();
    if (steps > 0) {
      // whatever the steps could not give goes on top once 2.1x is reached
      var rest = scale / Math.pow(STEP, steps);
      setTimeout(function () { if (zin && zin.disabled && rest > 1.05) setExtra(extra * rest); }, 150);
    }
  }
  function setExtra(v) {
    extra = Math.max(1, Math.min(MAX_TOTAL / TOP_STEP, v));
    if (extra < 1.03) extra = 1;
    var w = document.querySelector('.mbk .mbk-book-wrap');
    if (w) w.style.zoom = extra === 1 ? '' : String(extra);
  }
  // The toolbar's Zoom out removes the extra magnification before stepping down
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('.mbk-bar [aria-label="Zoom out"]');
    if (t && extra > 1) { e.stopPropagation(); e.preventDefault(); setExtra(1); }
  }, true);
  window.addEventListener('touchend', end, { capture: true, passive: false });
  window.addEventListener('touchcancel', end, { capture: true, passive: false });

  // Keep the view on the same spot when the zoom changes (the book is drawn
  // again at the new size, which would otherwise jump back to the left edge),
  // and show the Zoom out button while zoomed in.
  var btn = null, lastW = 0, lastH = 0, fx = 0.5, fy = 0.5, wasZoomed = false;
  function makeButton() {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'mbk-zoomout-overlay';
    el.setAttribute('aria-label', 'Zoom out');
    el.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">' +
      '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M7.5 10.5h6"/></svg><span>Zoom out</span>';
    el.style.cssText = 'position:absolute;z-index:2147483001;display:none;align-items:center;gap:6px;padding:9px 14px;border:0;border-radius:999px;' +
      'background:rgba(20,28,22,0.82);color:#fff;font:600 14px/1 system-ui,-apple-system,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,0.35);' +
      '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);cursor:pointer;touch-action:manipulation';
    el.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var m = el.parentNode, out = m && m.querySelector('.mbk-bar [aria-label="Zoom out"]');
      for (var i = 0; out && !out.disabled && i < 8; i++) out.click();
      fx = fy = 0.5;
    });
    return el;
  }
  function remember(st) {
    if (st.scrollWidth > 0) fx = (st.scrollLeft + st.clientWidth / 2) / st.scrollWidth;
    if (st.scrollHeight > 0) fy = (st.scrollTop + st.clientHeight / 2) / st.scrollHeight;
  }
  document.addEventListener('scroll', function (e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains('mbk-stage') && t.classList.contains('zoomed')) remember(t);
  }, true);
  setInterval(function () {
    var m = document.querySelector('.mbk');
    var st = m && m.querySelector('.mbk-stage');
    var zoomed = !!(st && st.classList.contains('zoomed'));
    if (st && (st.scrollWidth !== lastW || st.scrollHeight !== lastH)) {
      if (zoomed) {
        if (!wasZoomed) { fx = 0.5; fy = 0.5; }
        st.scrollLeft = fx * st.scrollWidth - st.clientWidth / 2;
        st.scrollTop = fy * st.scrollHeight - st.clientHeight / 2;
      }
      lastW = st.scrollWidth; lastH = st.scrollHeight;
    }
    wasZoomed = zoomed;
    if (!m) return;
    if (!btn) btn = makeButton();
    if (btn.parentNode !== m) m.appendChild(btn);
    btn.style.display = zoomed ? 'flex' : 'none';
    if (zoomed) {
      btn.style.left = (st.offsetLeft + st.clientWidth - btn.offsetWidth - 14) + 'px';
      btn.style.top = (st.offsetTop + st.clientHeight - btn.offsetHeight - 14) + 'px';
    }
  }, 150);

  // Safari's own pinch would zoom the whole screen instead of the book
  function noPageZoom(e) { if (book()) e.preventDefault(); }
  document.addEventListener('gesturestart', noPageZoom, { passive: false });
  document.addEventListener('gesturechange', noPageZoom, { passive: false });
})();
