(function () {
  "use strict";
  var list = document.getElementById("newsList"),
    status = document.getElementById("newsStatus"),
    checked = document.getElementById("newsChecked"),
    button = document.getElementById("reloadNews");
  var news = window.OrbitNews,
    sources = news.sources;
  var data = null,
    summaries = null,
    images = null,
    imageLoading = false,
    failedImages = new Set(),
    loading = false,
    lastFocused = "",
    renderedMarkup = "";
  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }
  function format(stamp) {
    var date = new Date(stamp);
    return Number.isFinite(date.getTime())
      ? date.toLocaleString("ko-KR", {
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "확인 기록 없음";
  }
  function imageFor(item) {
    if (!images || !/^[a-f0-9]{16}$/.test(item.id || "") || !Object.hasOwn(images, item.id)) return null;
    var image = images[item.id];
    function text(value, max) {
      return typeof value === "string" && value.trim().length > 0 && value.length <= max &&
        !/[\x00-\x1f]/.test(value);
    }
    return image && typeof image === "object" && typeof image.src === "string" &&
      /^\/images\/news\/[a-z0-9][a-z0-9-]*\.(webp|png|jpe?g|avif)$/i.test(image.src) &&
      !failedImages.has(image.src) && image.sourceUrl === item.url &&
      text(image.alt, 240) && text(image.credit, 300) &&
      ["photo", "visualization"].includes(image.kind) ? image : null;
  }
  function applyImages() {
    if (!data) return;
    news.items(data).forEach(function (item) {
      var article = document.getElementById(news.articleId(item));
      if (!article) return;
      article.querySelectorAll(".news-thumbnail, .news-image-credit").forEach(function (node) { node.remove(); });
      article.classList.remove("news-article-imaged");
      var image = imageFor(item);
      if (!image) return;
      var thumbnail = document.createElement("div"),
        img = document.createElement("img"),
        credit = document.createElement("p"),
        link = document.createElement("a");
      thumbnail.className = "news-thumbnail";
      img.width = 160;
      img.height = 100;
      img.loading = "lazy";
      img.decoding = "async";
      img.alt = image.alt;
      credit.className = "news-image-credit";
      link.href = image.sourceUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = (image.kind === "visualization" ? "시각화·삽화" : "사진") + " · 이미지: " + image.credit + " ↗";
      credit.append(link);
      if ([
        "https://www.nasa.gov/nasa-brand-center/images-and-media/",
        "https://creativecommons.org/licenses/by/4.0/",
        "https://creativecommons.org/licenses/by-sa/3.0/igo/",
      ].includes(image.licenseUrl)) {
        var license = document.createElement("a");
        license.href = image.licenseUrl;
        license.target = "_blank";
        license.rel = "noopener noreferrer";
        license.className = "news-image-license";
        license.textContent = "이용 조건";
        credit.append(" · ", license);
      }
      img.addEventListener("error", function () {
        failedImages.add(image.src);
        thumbnail.remove();
        credit.remove();
        if (!article.querySelector(".news-thumbnail")) article.classList.remove("news-article-imaged");
      }, { once: true });
      thumbnail.append(img);
      article.prepend(thumbnail);
      article.querySelector(".news-article-body").append(credit);
      article.classList.add("news-article-imaged");
      img.src = image.src;
    });
  }
  async function loadImages() {
    if (imageLoading) return;
    imageLoading = true;
    var controller = new AbortController(),
      timer = setTimeout(function () { controller.abort(); }, 3000);
    try {
      var response = await fetch("data/news-images.json", { cache: "no-cache", signal: controller.signal });
      if (!response.ok) throw new Error("images unavailable");
      var result = await response.json();
      if (!result || result.version !== 1 || !result.images || typeof result.images !== "object" ||
          Array.isArray(result.images) || Object.keys(result.images).length > 256) throw new Error("invalid images");
      if (JSON.stringify(result.images) === JSON.stringify(images) && !failedImages.size) return;
      images = result.images;
      failedImages.clear();
      // Enhance existing rows without resetting open details or keyboard focus.
      applyImages();
    } catch (_) {
      // Curated imagery is optional; the news list remains usable on its own.
    } finally {
      clearTimeout(timer);
      imageLoading = false;
    }
  }
  function render(preserve) {
    if (!data) return;
    preserve = preserve === true;
    var filter = location.hash.slice(1);
    if (!["all", "science", "commercial"].includes(filter) && !Object.hasOwn(sources, filter)) filter = "all";
    document.querySelectorAll("[data-source]").forEach(function (a) {
      if (a.dataset.source === filter) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    var items = news
      .items(data)
      .filter(function (i) {
        return news.matches(i, filter);
      })
      .sort(function (a, b) {
        return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
      });
    var unavailable = data.sources.filter(function (s) {
      return (
        sources[s.id] && news.matches({source: s.id, title: ""}, filter) && news.stale(s)
      );
    });
    var notices = [];
    if (unavailable.length) notices.push(unavailable
          .map(function (s) {
            return sources[s.id].name;
          })
          .join(" · ") +
        "의 새 소식을 확인하지 못했어요. 저장된 목록을 표시하며, 공식 사이트에서 최신 소식을 확인할 수 있어요.");
    var lastChecked = Date.parse(data.checkedAt);
    if (Number.isFinite(lastChecked) && Date.now() - lastChecked > 4 * 60 * 60 * 1000) {
      notices.push("마지막 목록 확인 후 4시간이 지났어요. 최신 소식은 각 기사의 공식 원문에서도 확인해주세요.");
    }
    status.hidden = !notices.length;
    status.textContent = notices.join(" ");
    checked.textContent =
      "마지막 확인 " + format(data.checkedAt) + " · " + items.length + "건";
    var markup = items.length
      ? items
          .map(function (item) {
            var english = item.language !== "ko";
            var summary = news.summaryFor(item, summaries);
            var korean = english && (summary || news.hasKoreanTitle(item));
            var source = data.sources.find(function (s) {
              return s.id === item.source;
            });
            var stale = news.stale(source);
            var companyBadges = news.companiesFor(item).filter(function (id) {
              return id !== item.source && sources[item.source].company !== id;
            }).map(function (id) {
              return '<span class="news-language">' + news.companies[id] + '</span>';
            }).join('');
            return (
              '<article id="' +
              esc(news.articleId(item)) +
              '" tabindex="-1" class="board-row news-article"><div class="news-article-heading"><div class="row-meta"><span class="row-category">' +
              sources[item.source].name +
              '</span>' + companyBadges + '<span aria-hidden="true">·</span><time datetime="' +
              esc(item.publishedAt) +
              '">' +
              esc(new Date(item.publishedAt).toLocaleDateString("ko-KR")) +
              '</time><span class="news-language">' +
              (korean ? "한글 제목" : (english ? "영문" : "한국어")) +
              '</span></div><a class="row-title" href="' +
              esc(item.url) +
              '" target="_blank" rel="noopener noreferrer"' +
              (english && !korean ? ' lang="en"' : "") +
              ">" +
              esc(summary ? summary.titleKo : news.displayTitle(item)) +
              '</a></div><div class="news-article-body">' +
              (summary ? '<div class="news-summary"><span class="news-summary-label">핵심 요약</span><div class="news-summary-text" id="summary-' + esc(news.articleId(item)) + '">' +
                summary.summaryKo.map(function (sentence) { return '<p>' + esc(sentence) + '</p>'; }).join('') +
                '</div><button type="button" class="text-button news-summary-toggle" aria-expanded="false" aria-controls="summary-' + esc(news.articleId(item)) + '">요약 더보기</button></div>' : '') +
              (korean ? '<details class="news-original"><summary>영문 제목 보기</summary><span lang="en">' + esc(item.title) + '</span></details>' : '') +
              '<div class="news-links"><a href="' +
              esc(item.url) +
              '" target="_blank" rel="noopener noreferrer">원문 읽기 ↗</a>' +
              (summary ? '<span class="news-summary-date">자료 확인 ' + esc(summary.checkedAt.replaceAll('-', '.')) + '</span>' : '') +
              "</div>" +
              (stale
                ? '<div class="news-freshness">마지막 정상 확인 ' +
                  esc(format(source && source.lastSuccessfulAt)) +
                  "</div>"
                : "") +
              "</div></article>"
            );
          })
          .join("")
      : '<div class="empty-state"><p>아직 가져온 소식이 없어요.<br>아래 공식 사이트에서 최신 소식을 확인해주세요.</p></div>';
    if (!preserve || markup !== renderedMarkup) {
      var active = document.activeElement,
        activeArticle = active && active.closest(".news-article"),
        anchor = preserve && Array.from(list.children).find(function (row) {
          return row.getBoundingClientRect().bottom > 0;
        }),
        anchorTop = anchor && anchor.getBoundingClientRect().top,
        states = new Map();
      if (preserve) list.querySelectorAll(".news-article").forEach(function (row) {
        states.set(row.id, {
          expanded: !!row.querySelector('.news-summary-toggle[aria-expanded="true"]'),
          original: !!row.querySelector("details[open]"),
        });
      });
      list.innerHTML = markup;
      renderedMarkup = markup;
      states.forEach(function (state, id) {
        var row = document.getElementById(id);
        if (!row) return;
        var toggle = row.querySelector(".news-summary-toggle"), original = row.querySelector("details");
        if (toggle && state.expanded) {
          toggle.setAttribute("aria-expanded", "true");
          toggle.textContent = "요약 접기";
          toggle.closest(".news-summary").classList.add("news-summary-expanded");
        }
        if (original) original.open = state.original;
      });
      applyImages();
      if (preserve && activeArticle && list.contains(document.getElementById(activeArticle.id))) {
        var row = document.getElementById(activeArticle.id);
        var target = active === activeArticle ? row : Array.from(row.querySelectorAll("a, button, summary")).find(function (node) {
          return node.tagName === active.tagName && node.className === active.className &&
            node.getAttribute("href") === active.getAttribute("href");
        });
        if (target) target.focus({ preventScroll: true });
      }
      if (anchor) {
        var restored = document.getElementById(anchor.id);
        if (restored) window.scrollBy(0, restored.getBoundingClientRect().top - anchorTop);
      }
    }
    var selected = location.hash.slice(1);
    if (selected.startsWith("article-")) {
      var article = document.getElementById(selected);
      if (article) article.classList.add("news-article-selected");
      if (article && lastFocused !== selected && !preserve) {
        lastFocused = selected;
        article.focus({ preventScroll: true });
        article.scrollIntoView({ block: "center", behavior: "instant" });
      } else if (!article) {
        status.hidden = false;
        status.textContent +=
          " 선택한 기사가 최신 목록에서 빠졌어요. 아래 출처 링크에서 이전 소식을 확인할 수 있어요.";
      }
    } else lastFocused = "";
  }
  async function load(background) {
    if (loading) return;
    loading = true;
    loadImages();
    button.disabled = true;
    list.setAttribute("aria-busy", "true");
    try {
      var result = await Promise.all([news.load(), news.loadSummaries().catch(function () { return null; })]);
      data = result[0];
      if (result[1]) summaries = result[1];
      render(background === true);
    } catch (e) {
      status.hidden = false;
      status.textContent =
        "소식을 불러오지 못했어요. 다시 불러오거나 아래 공식 사이트에서 확인해주세요.";
      if (!data) {
        checked.textContent = "연결을 확인해주세요";
        list.innerHTML = "";
      }
    } finally {
      loading = false;
      button.disabled = false;
      list.setAttribute("aria-busy", "false");
    }
  }
  list.addEventListener("click", function (event) {
    var toggle = event.target.closest(".news-summary-toggle");
    if (!toggle || !list.contains(toggle)) return;
    var expanded = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "요약 접기" : "요약 더보기";
    toggle.closest(".news-summary").classList.toggle("news-summary-expanded", expanded);
  });
  window.addEventListener("hashchange", render);
  button.onclick = load;
  load();
  news.autoRefresh(function () { return load(true); });
})();
