/* Field staff Overview: fill the node card next to the map.
   On two-column screens the card is as tall as the map. This finds the
   largest text size (1x to 2.6x the original) at which everything in the
   card still fits, so the card is filled at any screen size, zoom, aspect
   ratio, language and message length. Phones (one column) are unchanged.
   Runs again when the window, the selected node or its text changes. */
(function () {
  var MIN_W = 761, MAX = 2.6, STEPS = 9, queued = false;

  function fits(card) {
    if (card.scrollHeight > card.clientHeight + 1 || card.scrollWidth > card.clientWidth + 1) return false;
    var cells = card.querySelectorAll('.node-reading');
    for (var i = 0; i < cells.length; i++) if (cells[i].scrollWidth > cells[i].clientWidth + 1) return false;
    return true;
  }

  function reset(card) {
    card.classList.remove('fit');
    card.style.height = '';
    card.style.removeProperty('--fit');
    card._fitSig = null;
  }

  function fit(card) {
    var map = card.previousElementSibling;
    if (window.innerWidth < MIN_W || !map) { reset(card); return; }
    var sig = window.innerWidth + '|' + card.clientWidth + '|' + map.clientWidth + '|' + card.textContent.length;
    if (card._fitSig === sig) return;
    card.classList.add('fit');
    card.style.setProperty('--fit', '1');
    card.style.height = '0px';            // let the map alone set the row height
    var h = map.offsetHeight;
    card.style.height = h + 'px';
    if (!fits(card)) { card.style.height = ''; card._fitSig = sig; return; }  // too much text: grow as before
    var lo = 1, hi = MAX;
    card.style.setProperty('--fit', String(hi));
    if (fits(card)) lo = hi;
    else for (var i = 0; i < STEPS; i++) {
      var mid = (lo + hi) / 2;
      card.style.setProperty('--fit', String(mid));
      if (fits(card)) lo = mid; else hi = mid;
    }
    card.style.setProperty('--fit', lo.toFixed(3));
    card._fitSig = sig;
  }

  function run() {
    queued = false;
    var cards = document.querySelectorAll('.app-shell .grid-2 > .card.node-card');
    for (var i = 0; i < cards.length; i++) fit(cards[i]);
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(run); } }

  window.addEventListener('resize', queue);
  new MutationObserver(queue).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  if (window.ResizeObserver) new ResizeObserver(queue).observe(document.documentElement);
  document.addEventListener('load', queue, true);   // map photo finished loading
  queue();
})();
