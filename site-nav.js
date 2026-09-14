(function () {
  "use strict";
  var sidebar = document.querySelector('.orbit-navigation');
  if (!sidebar) return;
  // Keep one news widget: below the menu on desktop, in the document on mobile.
  var brief = document.querySelector('[data-news-brief]');
  if (brief && !document.documentElement.classList.contains('embed')) {
    var briefHome = document.createComment('news position on mobile');
    brief.before(briefHome);
    var desktop = matchMedia('(min-width: 861px)');
    function placeBrief() {
      if (desktop.matches) sidebar.append(brief);
      else briefHome.after(brief);
    }
    desktop.addEventListener('change', placeBrief);
    placeBrief();
  }
  var toggle = document.getElementById('navToggle');
  var scrim = document.getElementById('navScrim');
  sidebar.classList.add('enhanced');
  function setOpen(open, restoreFocus) {
    sidebar.classList.toggle('open', open);
    scrim.classList.toggle('on', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    if (restoreFocus) toggle.focus();
  }
  toggle.addEventListener('click', function () {
    setOpen(!sidebar.classList.contains('open'));
  });
  scrim.addEventListener('click', function () { setOpen(false, true); });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && sidebar.classList.contains('open')) {
      setOpen(false, true);
    }
  });
  sidebar.addEventListener('focusout', function (event) {
    if (event.relatedTarget && !sidebar.contains(event.relatedTarget)) setOpen(false);
  });
  document.getElementById('sideNav').addEventListener('click', function (event) {
    if (event.target.closest('.nav-item')) {
      setOpen(false, window.innerWidth <= 860);
    }
  });
  window.addEventListener('resize', function () {
    if (window.innerWidth > 860) setOpen(false);
  });
  window.OrbitNavigation = Object.freeze({ setOpen: setOpen });
})();
