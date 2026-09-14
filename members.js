(function () {
  "use strict";
  var sb = window.createOrbitBackend(),
    sequence = 0,
    current = null,
    busy = null;
  var state = { user: null, profile: null, error: null };
  var badges = {
    "first-post": "첫 글",
    "attendance-30": "30일 출석",
    "level-10": "Lv.10 달성",
  };
  function publish() {
    window.dispatchEvent(new CustomEvent("orbit:member", { detail: state }));
  }
  function clearNickname() {
    ["orbit_nickname", "orbit_joindate", "orbit_jointime"].forEach(
      function (k) {
        localStorage.removeItem(k);
      },
    );
  }
  async function refresh() {
    if (!sb || !window.ORBIT_CONFIG.membersEnabled) return state;
    var token = ++sequence;
    try {
      var result = await sb.auth.getSession();
      if (result.error) throw result.error;
      var user = result.data.session && result.data.session.user;
      if (token !== sequence) return state;
      if (current && current !== (user && user.id)) clearNickname();
      current = user && !user.is_anonymous ? user.id : null;
      state.user = user || null;
      state.profile = null;
      state.error = null;
      if (user && !user.is_anonymous && user.email_confirmed_at) {
        var visit = await sb.rpc("member_visit");
        if (token !== sequence) return state;
        if (visit.error) throw visit.error;
        state.profile = visit.data;
        if (visit.data)
          localStorage.setItem("orbit_nickname", visit.data.nickname);
      }
    } catch (error) {
      if (token === sequence) {
        state.profile = null;
        state.error = error;
      }
    }
    if (token === sequence) publish();
    return state;
  }
  window.OrbitMembers = {
    sb: sb,
    state: state,
    badges: badges,
    refresh: refresh,
    clearNickname: clearNickname,
    async decorate(root) {
      if (!sb || !window.ORBIT_CONFIG.membersEnabled) return;
      var nodes = Array.from(root.querySelectorAll("[data-member-id]"));
      var ids = Array.from(
        new Set(
          nodes
            .map(function (n) {
              return n.dataset.memberId;
            })
            .filter(Boolean),
        ),
      );
      if (!ids.length) return;
      try {
        var result = await sb.rpc("member_cards", { p_ids: ids.slice(0, 100) });
        if (result.error || !Array.isArray(result.data)) return;
        var cards = new Map(
          result.data.map(function (p) {
            return [p.user_id, p];
          }),
        );
        nodes.forEach(function (node) {
          var p = cards.get(node.dataset.memberId);
          if (!node.isConnected || !p) return;
          node.replaceChildren(document.createTextNode(p.nickname + " · "));
          var level = document.createElement("span");
          level.className = "member-level";
          level.textContent = "Lv." + p.level;
          node.append(level);
          if (badges[p.badge]) {
            var badge = document.createElement("span");
            badge.className = "member-badge";
            badge.textContent = badges[p.badge];
            node.append(badge);
          }
        });
      } catch (_) {
        /* Public reading remains available when member cards fail. */
      }
    },
  };
  if (sb && window.ORBIT_CONFIG.membersEnabled) {
    sb.auth.onAuthStateChange(function () {
      clearTimeout(busy);
      busy = setTimeout(refresh, 0);
    });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) refresh();
    });
    refresh();
  }
})();
