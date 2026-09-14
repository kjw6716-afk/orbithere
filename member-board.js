(function () {
  "use strict";
  if (!window.ORBIT_CONFIG.membersEnabled) return;
  var pending = null;
  var observer = new MutationObserver(function (changes) {
    if (
      !changes.some((c) =>
        Array.from(c.addedNodes).some(
          (n) =>
            n.nodeType === 1 &&
            (n.matches("[data-member-id]") ||
              n.querySelector("[data-member-id]")),
        ),
      )
    )
      return;
    clearTimeout(pending);
    pending = setTimeout(function () {
      window.OrbitMembers.decorate(document);
    }, 0);
  });
  ["postList", "postDetail", "commentList"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) observer.observe(el, { childList: true, subtree: true });
  });
  window.OrbitMembers.decorate(document);
  window.addEventListener("orbit:member", function () {
    var state = window.OrbitMembers.state,
      profile = state.profile;
    document.querySelectorAll("[data-account-link]").forEach(function (el) {
      el.hidden = false;
      el.textContent = profile
        ? profile.nickname + " · Lv." + profile.level
        : "로그인 · 회원가입";
    });
  });
})();
