/* FarmSense Brew - user manual pages on older Safari (before iOS 16).
   The manual's page sizes come from --in, one inch of the page, worked out in
   CSS with the cqw unit. Without that unit every size and position on the page
   is lost, so here each page is measured and --in is set in pixels instead.
   Browsers that have cqw skip all of this. */
(function () {
  if (!window.CSS || !CSS.supports || CSS.supports('width', '1cqw')) return;
  if (!window.ResizeObserver || !window.MutationObserver) return;
  var ro = new ResizeObserver(function (entries) {
    entries.forEach(function (e) {
      var w = e.contentRect.width;
      if (w > 0) e.target.style.setProperty('--in', (w / 8.5) + 'px');
    });
  });
  var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
  function scan(root) {
    if (!root.querySelectorAll) return;
    var list = root.querySelectorAll('.mb-sheet');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (seen && seen.has(el)) continue;
      if (seen) seen.add(el);
      ro.observe(el);
    }
  }
  new MutationObserver(function (records) {
    records.forEach(function (r) {
      for (var i = 0; i < r.addedNodes.length; i++) scan(r.addedNodes[i]);
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
  scan(document);
})();
