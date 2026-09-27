(function () {
  'use strict';
  // A direct tool remains a normal page. Only embedded tools ask their own
  // same-origin parent to switch panels, keeping the address and tabs in sync.
  if (window.parent === window || !document.documentElement.classList.contains('embed')) return;
  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[data-night-panel]');
    if (!link || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var panel = link.dataset.nightPanel;
    if (panel !== 'planets' && panel !== 'sky') return;
    // An arbitrary same-origin embedding page may not implement the hub.
    // Keep the top-level href fallback in that case.
    try {
      if (window.parent.location.origin !== location.origin ||
          !window.parent.document.getElementById('nightHub')) return;
    } catch (_) { return; }
    event.preventDefault();
    window.parent.postMessage({ orbit: 'nightPanel', panel: panel }, location.origin);
  });
})();
