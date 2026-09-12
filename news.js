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
    loading = false,
    lastFocused = "";
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
  function render() {
    if (!data) return;
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
    status.hidden = !unavailable.length;
    status.textContent = unavailable.length
      ? unavailable
          .map(function (s) {
            return sources[s.id].name;
          })
          .join(" · ") +
        "의 새 소식을 확인하지 못했어요. 저장된 목록을 표시하며, 공식 사이트에서 최신 소식을 확인할 수 있어요."
      : "";
    checked.textContent =
      "마지막 확인 " + format(data.checkedAt) + " · " + items.length + "건";
    list.innerHTML = items.length
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
              '" tabindex="-1" class="board-row news-article"><div class="row-meta"><span class="row-category">' +
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
              '</a>' +
              (summary ? '<div class="news-summary"><span class="news-summary-label">핵심 요약</span>' +
                summary.summaryKo.map(function (sentence) { return '<p>' + esc(sentence) + '</p>'; }).join('') +
                '</div>' : '<p class="news-summary-pending">요약은 준비 중이에요. 원문에서 먼저 확인할 수 있어요.</p>') +
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
              "</article>"
            );
          })
          .join("")
      : '<div class="empty-state"><p>아직 가져온 소식이 없어요.<br>아래 공식 사이트에서 최신 소식을 확인해주세요.</p></div>';
    var selected = location.hash.slice(1);
    if (selected.startsWith("article-")) {
      var article = document.getElementById(selected);
      if (article && lastFocused !== selected) {
        lastFocused = selected;
        article.focus({ preventScroll: true });
        article.scrollIntoView({ block: "center", behavior: "instant" });
        article.classList.add("news-article-selected");
      } else if (!article) {
        status.hidden = false;
        status.textContent +=
          " 선택한 기사가 최신 목록에서 빠졌어요. 아래 출처 링크에서 이전 소식을 확인할 수 있어요.";
      }
    } else lastFocused = "";
  }
  async function load() {
    if (loading) return;
    loading = true;
    button.disabled = true;
    list.setAttribute("aria-busy", "true");
    try {
      var result = await Promise.all([news.load(), news.loadSummaries().catch(function () { return null; })]);
      data = result[0];
      if (result[1]) summaries = result[1];
      render();
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
  window.addEventListener("hashchange", render);
  button.onclick = load;
  load();
})();
