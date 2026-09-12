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
    spacex: { name: "SpaceX", badge: "SpaceX", hosts: ["www.spacex.com"] },
    starlink: { name: "Starlink · SpaceX", badge: "SpaceX", hosts: ["starlink.com"], company: "spacex" },
    rocketlab: { name: "Rocket Lab", badge: "Rocket Lab", hosts: ["rocketlabcorp.com"] },
    blueorigin: { name: "Blue Origin", badge: "Blue Origin", hosts: ["www.blueorigin.com"] },
    firefly: { name: "Firefly Aerospace", badge: "Firefly", hosts: ["fireflyspace.com"] },
  };
  var companies = {
    spacex: "SpaceX", rocketlab: "Rocket Lab", blueorigin: "Blue Origin", firefly: "Firefly",
  };
  var topics = {
    spacex: /\b(space\s*x|starlink|starship|falcon\s*(9|heavy))\b|스페이스\s*엑스|스타링크|스타십|팰컨/i,
    rocketlab: /\brocket\s*lab\b|로켓\s*랩|로캣\s*랩/i,
    blueorigin: /\bblue\s*origin\b|블루\s*오리진/i,
    firefly: /\bfirefly\s*aerospace\b|파이어플라이/i,
  };
  function companiesFor(item) {
    var primary = sources[item.source]?.company || item.source;
    var found = Object.hasOwn(companies, primary) ? [primary] : [];
    Object.keys(topics).forEach(function (id) {
      if (!found.includes(id) && topics[id].test(item.title)) found.push(id);
    });
    // Musk belongs to SpaceX only in space-related headlines.
    if (!found.includes("spacex") && /elon\s*musk|일론\s*머스크/i.test(item.title) &&
        /space|rocket|satellite|mars|launch|우주|로켓|위성|화성|발사/i.test(item.title)) found.push("spacex");
    return found;
  }
  function matches(item, filter) {
    if (filter === "all") return true;
    var company = companiesFor(item);
    if (filter === "commercial") return company.length > 0;
    if (filter === "science") return company.length === 0;
    if (Object.hasOwn(companies, filter)) return company.includes(filter);
    return item.source === filter;
  }
  function briefItems(data) {
    // Each source/topic gets a turn; frequent Starlink launches cannot fill the rail.
    var groups = new Map();
    items(data).forEach(function (item) {
      var key = companiesFor(item)[0] || item.source;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    var mixed = [], previousSources = new Map();
    while (mixed.length < 14) {
      var added = false;
      groups.forEach(function (rows, key) {
        if (!rows.length || mixed.length >= 14) return;
        // Within SpaceX, give the Starlink index a turn too.
        var position = rows.findIndex(function (item) { return item.source !== previousSources.get(key); });
        var item = rows.splice(Math.max(0, position), 1)[0];
        mixed.push(item); previousSources.set(key, item.source); added = true;
      });
      if (!added) break;
    }
    return mixed;
  }
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
    companies: companies,
    companiesFor: companiesFor,
    matches: matches,
    briefItems: briefItems,
    valid: valid,
    items: items,
    articleId: articleId,
    hasKoreanTitle: hasKoreanTitle,
    displayTitle: displayTitle,
    stale: stale,
    load: load,
  });
})();
