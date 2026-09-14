(function () {
  'use strict';
  var embedded = document.documentElement.classList.contains('embed') && parent !== window;
  var box = document.getElementById('boardMain'), queued = false, requestedScroll = null, lastHeight = 0;
  function viewport() {
    try {
      var frame = window.frameElement;
      if (!embedded || !frame) return null;
      var header = parent.document.querySelector('.topbar');
      return { top: frame.getBoundingClientRect().top, inset: header ? header.getBoundingClientRect().bottom + 12 : 12, height: parent.innerHeight };
    } catch (_) { return null; }
  }
  function report() {
    queued = false;
    var height = Math.ceil(box.getBoundingClientRect().height);
    if (height > 0 && (height !== lastHeight || requestedScroll !== null)) {
      var message = { orbit: 'loungeHeight', height: height };
      if (requestedScroll !== null) message.scrollY = requestedScroll;
      requestedScroll = null;
      lastHeight = height;
      parent.postMessage(message, location.origin);
    }
  }
  function schedule() {
    if (!queued && embedded) { queued = true; requestAnimationFrame(report); }
  }
  window.OrbitBoardEmbed = {
    scrollY: function () { var v = viewport(); return v ? Math.max(0, v.inset - v.top) : window.scrollY; },
    scrollTo: function (top) {
      if (!viewport()) { window.scrollTo(0, top); return; }
      requestedScroll = top;
      schedule();
    },
    prepareDialog: function (dialog) {
      var v = viewport();
      if (!v) return;
      dialog.style.top = Math.max(12, v.inset - v.top + 12) + 'px';
      dialog.style.bottom = 'auto';
      dialog.style.marginBlock = '0';
      dialog.style.maxHeight = Math.max(160, v.height - v.inset - 36) + 'px';
      dialog.style.overflowY = 'auto';
    },
  };
  if (!embedded) return;
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(box);
  window.addEventListener('load', schedule);
  window.addEventListener('resize', schedule);
  if (document.fonts) document.fonts.ready.then(schedule);
  schedule();
})();
