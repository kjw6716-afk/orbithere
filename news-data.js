(function () {
  "use strict";
  var sources = {
    kasi: { name: "한국천문연구원", badge: "KASI", hosts: ["www.kasi.re.kr"] },
    nasa: {
      name: "NASA / JPL",
      badge: "NASA/JPL",
      hosts: ["www.nasa.gov", "science.nasa.gov"],
    },
    esa: { name: "ESA 우주과학", badge: "ESA", hosts: ["www.esa.int"] },
  };
  function valid(item) {
    try {
      var u = new URL(item.url);
      return (
        Object.hasOwn(sources, item.source) &&
        sources[item.source].hosts.includes(u.hostname) &&
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !u.port &&
        typeof item.title === "string" &&
        item.title.trim().length > 0 &&
        item.title.length <= 240 &&
        Number.isFinite(Date.parse(item.publishedAt))
      );
    } catch (e) {
      return false;
    }
  }
  function items(data) {
    var seen = new Set();
    return data.items
      .filter(valid)
      .filter(function (item) {
        if (seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      })
      .sort(function (a, b) {
        return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
      });
  }
  function articleId(item) {
    // Production feeds have stable SHA-derived IDs. URL encoding also gives legacy
    // entries without an ID a stable, collision-free fragment.
    return (
      "article-" +
      (/^[a-f0-9]{16}$/.test(item.id || "")
        ? item.id
        : encodeURIComponent(item.url))
    );
  }
  function hasKoreanTitle(item) {
    return item.language === "en" && typeof item.titleKo === "string" &&
      item.titleKo.length > 0 && item.titleKo.length <= 240 &&
      /[가-힣]/.test(item.titleKo) && !/[<>\x00-\x1f]/.test(item.titleKo) &&
      item.titleKoOriginal === item.title &&
      item.titleKoMethod === "reviewed";
  }
  function displayTitle(item) {
    return hasKoreanTitle(item) ? item.titleKo : item.title;
  }
  function stale(source) {
    return (
      !source ||
      source.status !== "ok" ||
      !Number.isFinite(Date.parse(source.lastSuccessfulAt)) ||
      Date.now() - Date.parse(source.lastSuccessfulAt) > 48 * 3600000
    );
  }
  async function load() {
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, 10000);
    try {
      var response = await fetch("data/news.json", {
        cache: "no-cache",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("news unavailable");
      var data = await response.json();
      if (
        !data ||
        data.version !== 1 ||
        !Array.isArray(data.items) ||
        !Array.isArray(data.sources)
      )
        throw new Error("invalid news");
      data.sources = data.sources.filter(function (s) {
        return s && Object.hasOwn(sources, s.id);
      });
      return data;
    } finally {
      clearTimeout(timer);
    }
  }
  window.OrbitNews = Object.freeze({
    sources: sources,
    valid: valid,
    items: items,
    articleId: articleId,
    hasKoreanTitle: hasKoreanTitle,
    displayTitle: displayTitle,
    stale: stale,
    load: load,
  });
})();
