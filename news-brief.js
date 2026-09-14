(function () {
  "use strict";
  var root = document.querySelector("[data-news-brief]");
  if (!root || !window.OrbitNews) return;
  var news = window.OrbitNews;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)");
  // The embedded board uses the parent rail on a wide screen. The standalone
  // board keeps its own rail; on mobile the card stays inside the board list.
  if (
    document.documentElement.classList.contains("embed") &&
    window.parent !== window
  ) {
    try {
      var parentWide = window.parent.matchMedia("(min-width: 861px)");
      var syncParent = function () {
        document.documentElement.classList.toggle(
          "news-parent-wide",
          parentWide.matches,
        );
      };
      syncParent();
      parentWide.addEventListener("change", syncParent);
    } catch (e) {
      /* Standalone fallback for an external embed. */
    }
  }
  var list = root.querySelector(".news-brief-list");
  var viewport = document.createElement("div");
  viewport.className = "news-brief-viewport";
  list.before(viewport);
  viewport.append(list);
  var notice = root.querySelector(".news-brief-notice");
  var controls = root.querySelector(".news-brief-controls");
  var toggle = root.querySelector("[data-news-toggle]");
  var previous = root.querySelector("[data-news-prev]");
  var next = root.querySelector("[data-news-next]");
  var retry = root.querySelector("[data-news-retry]");
  var count = root.querySelector(".news-brief-count");
  var announcement = root.querySelector(".news-brief-sr");
  var items = [],
    index = 0,
    size = 1,
    timer,
    animation,
    motionIndex,
    motionManual = false;
  var userPaused = false,
    focusPaused = false,
    hovered = false,
    visible = false,
    loading = false;
  var attempted = false,
    pointerPlay = null;
  function shown() {
    return root.getClientRects().length > 0;
  }
  function capacity() {
    return (
      parseInt(getComputedStyle(root).getPropertyValue("--brief-count"), 10) ||
      1
    );
  }
  function schedule() {
    clearTimeout(timer);
    toggle.textContent = userPaused || focusPaused ? "재생" : "정지";
    toggle.setAttribute(
      "aria-label",
      userPaused || focusPaused ? "뉴스 자동 전환 재생" : "뉴스 자동 전환 정지",
    );
    toggle.hidden = reduced.matches;
    var blocked = items.length <= size || userPaused || focusPaused || hovered ||
      reduced.matches || document.hidden || !visible || !shown();
    if (animation) {
      // Explicit next/previous remains usable while the panel has focus. Only
      // automatic motion pauses on hover/focus, including halfway through a row.
      if (document.hidden || !visible || !shown() || (!motionManual && blocked)) {
        animation.pause();
      } else if (animation.playState === "paused") animation.play();
      return;
    }
    if (blocked) return;
    timer = setTimeout(function () { move(1, false); }, 8000);
  }
  function clearMotion() {
    if (animation) {
      animation.onfinish = null;
      animation.cancel();
      animation = null;
      index = motionIndex;
    }
    viewport.style.height = "";
    viewport.classList.remove("is-moving");
  }
  function createRow(item) {
    var row = document.createElement("li");
    row.className = "news-brief-item";
    var meta = document.createElement("div");
    meta.className = "news-brief-meta";
    var badge = document.createElement("span");
    badge.className = "news-brief-badge";
    badge.textContent = news.sources[item.source].badge;
    badge.title = news.sources[item.source].name;
    var date = document.createElement("time");
    date.dateTime = item.publishedAt;
    date.textContent = new Date(item.publishedAt).toLocaleDateString(
      "ko-KR", { month: "numeric", day: "numeric" },
    );
    meta.append(badge, date);
    var link = document.createElement("a");
    link.className = "news-brief-title";
    link.href = "news.html#" + news.articleId(item);
    if (window.parent !== window) link.target = "_top";
    link.textContent = news.displayTitle(item);
    link.title = item.title;
    if (item.language !== "ko" && !news.hasKoreanTitle(item)) link.lang = "en";
    if (news.hasKoreanTitle(item)) {
      var translation = document.createElement("span");
      translation.className = "news-brief-translation";
      translation.textContent = "한글 제목";
      meta.append(translation);
    }
    row.append(meta, link);
    return row;
  }
  function render(manual) {
    clearMotion();
    list.replaceChildren();
    size = capacity();
    var total = Math.min(size, items.length);
    for (var offset = 0; offset < total; offset++) {
      list.append(createRow(items[(index + offset) % items.length]));
    }
    controls.hidden = items.length <= size;
    count.textContent = (items.length ? index + 1 : 0) + " / " + items.length;
    if (manual && items.length)
      announcement.textContent = index + 1 + "번째 소식. " + news.displayTitle(items[index]);
    schedule();
  }
  function move(direction, manual) {
    if (!items.length) return;
    if (manual) userPaused = true;
    // Repeated button presses or a resize settle the pending destination before
    // the next move, so old animation callbacks cannot restore stale headlines.
    if (animation) render(false);
    var target = (index + direction + items.length) % items.length;
    if (reduced.matches || typeof list.animate !== "function") {
      index = target;
      render(manual);
      return;
    }
    var frames;
    if (size > 1) {
      viewport.style.height = list.getBoundingClientRect().height + "px";
      viewport.classList.add("is-moving");
      var incoming = createRow(items[direction > 0 ? (target + size - 1) % items.length : target]);
      // The incoming item becomes a normal keyboard stop after it enters fully.
      // It remains clickable if the reader pauses the movement partway through.
      incoming.querySelector("a").tabIndex = -1;
      if (direction > 0) list.append(incoming);
      else list.prepend(incoming);
      var metas = list.querySelectorAll(".news-brief-meta");
      // Measure content positions, including the separator/padding that disappear
      // when the second row becomes the first. This avoids a jump at completion.
      var distance = metas[1].getBoundingClientRect().top - metas[0].getBoundingClientRect().top;
      frames = [
        { transform: "translateY(" + (direction > 0 ? 0 : -distance) + "px)" },
        { transform: "translateY(" + (direction > 0 ? -distance : 0) + "px)" },
      ];
    } else {
      index = target;
      render(false);
      frames = [
        { opacity: 0.75, transform: "translateY(" + (direction * 6) + "px)" },
        { opacity: 1, transform: "translateY(0)" },
      ];
    }
    clearTimeout(timer);
    motionIndex = target;
    motionManual = manual;
    animation = list.animate(frames, {
      duration: size > 1 ? 650 : 220,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      fill: "both",
    });
    animation.onfinish = function () { render(manual); };
    schedule();
  }
  async function load() {
    if (loading) return;
    attempted = true;
    loading = true;
    retry.disabled = true;
    root.setAttribute("aria-busy", "true");
    try {
      var data = await news.load();
      clearMotion();
      items = news.briefItems(data);
      index = 0;
      var stale = Object.keys(news.sources).some(function (id) {
        return news.stale(
          data.sources.find(function (s) {
            return s.id === id;
          }),
        );
      });
      notice.hidden = items.length > 0 && !stale;
      notice.textContent = !items.length
        ? "아직 가져온 소식이 없어요."
        : "일부 출처의 갱신이 늦어져 저장된 소식을 표시해요.";
      retry.hidden = true;
      render(false);
    } catch (e) {
      notice.hidden = false;
      notice.textContent = items.length
        ? "새 소식을 확인하지 못해 이전 목록을 표시해요."
        : "소식을 불러오지 못했어요. 전체 뉴스에서 다시 확인해주세요.";
      retry.hidden = false;
    } finally {
      loading = false;
      retry.disabled = false;
      root.setAttribute("aria-busy", "false");
    }
  }
  root.addEventListener("pointerenter", function (e) {
    if (e.pointerType === "mouse") {
      hovered = true;
      schedule();
    }
  });
  root.addEventListener("pointerleave", function () {
    hovered = false;
    schedule();
  });
  root.addEventListener("focusin", function () {
    focusPaused = true;
    schedule();
  });
  // Focus pauses persist until an explicit play action, so tabbing away never
  // silently restarts a carousel that the reader was using.
  toggle.addEventListener("pointerdown", function () {
    pointerPlay = userPaused || focusPaused;
  });
  toggle.addEventListener("pointercancel", function () {
    pointerPlay = null;
  });
  toggle.addEventListener("click", function (e) {
    var play =
      e.detail && pointerPlay !== null
        ? pointerPlay
        : userPaused || focusPaused;
    pointerPlay = null;
    if (play) {
      userPaused = false;
      focusPaused = false;
    } else userPaused = true;
    schedule();
  });
  previous.addEventListener("click", function () {
    move(-1, true);
  });
  next.addEventListener("click", function () {
    move(1, true);
  });
  retry.addEventListener("click", load);
  reduced.addEventListener("change", function () {
    if (animation) render(false);
    schedule();
  });
  document.addEventListener("visibilitychange", schedule);
  window.addEventListener("pagehide", function () {
    clearTimeout(timer);
    if (animation) animation.pause();
  });
  window.addEventListener("pageshow", schedule);
  // Changing only the viewport height does not resize the rail until we render.
  matchMedia("(min-width: 861px) and (max-height: 800px)").addEventListener("change", function () {
    if (shown() && capacity() !== size) render(false);
  });
  new ResizeObserver(function () {
    if (shown() && capacity() !== size) render(false);
    if (shown() && !attempted) load();
    schedule();
  }).observe(root);
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    if (visible && !attempted) load();
    schedule();
  }).observe(root);
})();
