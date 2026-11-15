/* FarmSense Brew - full screen button on browsers without the standard
   Fullscreen API. iPads before iPadOS 16.4 only have the webkit-prefixed one,
   which is mapped across. iPhones have none at all, so there the element is
   pinned over the whole screen instead (Safari's own bars stay visible).
   Browsers with the standard API (Android Chrome, newer iPads, desktops) are
   left alone. */
(function () {
  var E = Element.prototype;
  if (E.requestFullscreen) return;
  var cls = 'fs-fallback';
  var css = '.' + cls + '{position:fixed!important;top:0;left:0;right:0;bottom:0;width:auto!important;height:auto!important;z-index:2147483000;' +
    'background:#26302a;padding:12px;justify-content:center;overflow:hidden}' +
    '.' + cls + ' .mbk-stage{flex:1;align-items:center}' +
    'html.fs-fallback-on,html.fs-fallback-on body{overflow:hidden}';
  var style = document.createElement('style');
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  var current = null;
  function changed() {
    var ev;
    try { ev = new Event('fullscreenchange'); } catch (e) { ev = document.createEvent('Event'); ev.initEvent('fullscreenchange', true, false); }
    document.dispatchEvent(ev);
  }
  function mark(el, on) {
    if (el) el.classList[on ? 'add' : 'remove'](cls);
    document.documentElement.classList[on ? 'add' : 'remove']('fs-fallback-on');
  }
  var prefixed = !!E.webkitRequestFullscreen && document.webkitFullscreenEnabled !== false;
  var pinned = null;

  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: function () { return (prefixed && document.webkitFullscreenElement) || current; }
  });

  function pin(el) {
    if (current) mark(current, false);
    current = el;
    mark(current, true);
    window.scrollTo(0, 0);
    changed();
  }
  function unpin() {
    mark(current, false);
    current = null;
    changed();
  }

  if (prefixed) {
    var last = null;
    document.addEventListener('webkitfullscreenchange', function () {
      var el = document.webkitFullscreenElement;
      mark(last, false);
      if (el) mark(el, true);
      last = el;
      changed();
    });
    // The iPad said no (or has no real full screen): pin the element instead
    document.addEventListener('webkitfullscreenerror', function () { if (pinned) pin(pinned); });
  }

  E.requestFullscreen = function () {
    if (prefixed) {
      var el = pinned = this;
      try {
        this.webkitRequestFullscreen();
        // Some iPads neither enter full screen nor report an error
        setTimeout(function () { if (pinned === el && !document.webkitFullscreenElement && !current) pin(el); }, 800);
        return Promise.resolve();
      } catch (e) { /* pin below */ }
    }
    pin(this);
    return Promise.resolve();
  };
  document.exitFullscreen = function () {
    pinned = null;
    if (prefixed && document.webkitFullscreenElement) document.webkitExitFullscreen();
    else unpin();
    return Promise.resolve();
  };
})();
