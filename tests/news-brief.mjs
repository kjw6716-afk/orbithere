// Browser behavior checks: rotation, keyboard/touch controls, responsive embeds,
// article navigation, and failed/untrusted feeds. All external requests are blocked.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const root = fileURLToPath(new URL("..", import.meta.url));
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const server = createServer(async (req, res) => {
  const path = resolve(
    root,
    "." + new URL(req.url, "http://localhost").pathname,
  );
  if (!path.startsWith(root)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    res.writeHead(200, {
      "Content-Type": mime[extname(path)] || "application/octet-stream",
    });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const fixture = JSON.parse(
  await readFile(new URL("../data/news.json", import.meta.url)),
);
let checks = 0;
function ok(name, value = true) {
  assert.ok(value, name);
  checks++;
  console.log("✓ " + name);
}
async function open(width = 1440, reducedMotion = "no-preference", state = {}) {
  state.data ??= structuredClone(fixture);
  state.requests = 0;
  state.ads = [];
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    reducedMotion,
    isMobile: width < 600,
    hasTouch: width < 600,
  });
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (/googlesyndication|doubleclick/.test(u.hostname))
      state.ads.push(u.href);
    if (
      u.hostname === "cdn.jsdelivr.net" &&
      u.pathname.includes("@supabase/supabase-js@")
    )
      return route.fulfill({
        contentType: "text/javascript",
        path: resolve(
          root,
          "node_modules/@supabase/supabase-js/dist/umd/supabase.js",
        ),
      });
    if (u.hostname.endsWith(".supabase.co")) {
      if (u.pathname.endsWith("/board_version"))
        return route.fulfill({ contentType: "application/json", body: "1" });
      if (u.pathname.endsWith("/board_posts"))
        return route.fulfill({ contentType: "application/json", body: "[]" });
      if (u.pathname.endsWith("/record_visit"))
        return route.fulfill({ contentType: "application/json", body: "null" });
      return route.abort();
    }
    if (
      process.env.ORBIT_QA_FONT &&
      u.hostname === "cdn.jsdelivr.net" &&
      u.pathname.includes("pretendard-dynamic")
    )
      return route.fulfill({
        contentType: "text/css",
        body: '@font-face{font-family:Pretendard;src:url(/qa-font.woff2) format("woff2");font-display:swap;}',
      });
    if (
      process.env.ORBIT_QA_FONT &&
      u.pathname === "/qa-font.woff2"
    )
      return route.fulfill({
        contentType: "font/woff2",
        headers: { "Access-Control-Allow-Origin": "*" },
        path: process.env.ORBIT_QA_FONT,
      });
    if (u.origin !== base) return route.abort();
    if (u.pathname === "/data/news.json") {
      state.requests++;
      if (state.hang) return;
      return route.fulfill({
        status: state.fail ? 503 : 200,
        contentType: "application/json",
        body: JSON.stringify(state.data),
      });
    }
    return route.continue();
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install();
  return {
    page,
    context,
    state,
    errors,
    async close() {
      ok(
        "no script errors or ad requests",
        errors.length === 0 && state.ads.length === 0,
      );
      await context.close();
    },
  };
}
async function ready(page, path = "/main.html#planets") {
  await page.goto(base + path);
  await page.locator(".news-brief-title").first().waitFor();
  await page.clock.pauseAt(new Date(Date.now() + 2000));
}
const first = (p) => p.locator(".news-brief-title").first().textContent();
try {
  {
    const f = await open(),
      p = f.page;
    await ready(p);
    ok(
      "wide rail shows three of the latest five items",
      (await p.locator(".news-brief-item").count()) === 3 &&
        /\/ 5/.test(await p.locator(".news-brief-count").textContent()),
    );
    const title = await first(p);
    await p.clock.runFor(8100);
    ok("one item advances after eight seconds", (await first(p)) !== title);
    await p.locator(".news-brief").hover();
    const hovered = await first(p);
    await p.clock.runFor(17000);
    ok("hover pauses rotation", (await first(p)) === hovered);
    await p.mouse.move(0, 0);
    await p.clock.runFor(8100);
    ok("leaving hover resumes rotation", (await first(p)) !== hovered);
    await p.locator(".news-brief-title").first().focus();
    const focused = await first(p);
    await p.clock.runFor(17000);
    ok(
      "keyboard focus preserves the focused headline",
      (await first(p)) === focused &&
        (await p
          .locator(".news-brief-title")
          .first()
          .evaluate((e) => e === document.activeElement)),
    );
    await p.locator(".side-logo").focus();
    await p.clock.runFor(8100);
    ok(
      "tabbing away does not silently resume rotation",
      (await first(p)) === focused,
    );
    await p.getByRole("button", { name: "뉴스 자동 전환 재생" }).click();
    await p.mouse.move(0, 0);
    await p.clock.runFor(8100);
    ok("explicit play resumes", (await first(p)) !== focused);
    await p.getByRole("button", { name: "뉴스 자동 전환 정지" }).click();
    await p.mouse.move(0, 0);
    const stopped = await first(p);
    await p.clock.runFor(8100);
    ok(
      "mouse pause button stays paused after pointer leaves",
      (await first(p)) === stopped,
    );
    await p.getByRole("button", { name: "다음 뉴스", exact: true }).click();
    ok(
      "manual next works and announces the headline",
      (await first(p)) !== stopped &&
        (await p.locator(".news-brief-sr").textContent()).includes(
          await first(p),
        ),
    );
    const target = await p
      .locator(".news-brief-title")
      .first()
      .getAttribute("href");
    await p.locator(".news-brief-title").first().click();
    await p.locator(".news-article-selected").waitFor();
    ok(
      "headline opens the matching article in the Orbit list",
      p.url() === base + "/" + target &&
        (await p
          .locator(".news-article-selected")
          .evaluate((e) => e === document.activeElement)),
    );
    ok(
      "original and translation links remain available",
      (await p.locator(".news-article-selected .news-links a").count()) >= 1,
    );
    await p.goto(base + "/news.html#article-0000000000000000");
    await p
      .locator("#newsStatus")
      .filter({ hasText: "최신 목록에서 빠졌어요" })
      .waitFor();
    ok(
      "expired headline explains the missing item and retains the news list",
      (await p.locator(".news-article").count()) > 0,
    );
    await f.close();
  }
  {
    const f = await open(390, "reduce"),
      p = f.page;
    await ready(p, "/lounge.html");
    ok(
      "mobile shows one two-line card with touch controls",
      (await p.locator(".news-brief-item").count()) === 1 &&
        (await p
          .locator("[data-news-next]")
          .evaluate((e) => e.getBoundingClientRect().height >= 44)),
    );
    const title = await first(p);
    await p.clock.runFor(24000);
    ok(
      "reduced motion disables automatic rotation and hides play",
      (await first(p)) === title &&
        (await p.locator("[data-news-toggle]").isHidden()),
    );
    await p.getByRole("button", { name: "다음 뉴스", exact: true }).click();
    ok(
      "reduced motion still permits manual navigation",
      (await first(p)) !== title,
    );
    await p.evaluate(() => {
      document.documentElement.style.fontSize = "32px";
    });
    ok(
      "enlarged mobile text has no horizontal overflow",
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await p.evaluate(() => {
      document.documentElement.style.fontSize = "";
    });
    await mkdir("/tmp/orbit-news-discovery", { recursive: true });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({
      path: "/tmp/orbit-news-discovery/mobile.png",
      fullPage: true,
    });
    await f.close();
  }
  {
    const f = await open(1440),
      p = f.page;
    await ready(p, "/main.html#lounge");
    const frame = p.frameLocator("#loungeFrame");
    await frame.locator(".news-parent-wide").waitFor({ state: "attached" });
    ok(
      "desktop embedded board does not duplicate the parent rail",
      await frame.locator(".news-brief").isHidden(),
    );
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({
      path: "/tmp/orbit-news-discovery/desktop.png",
      fullPage: true,
    });
    await p.setViewportSize({ width: 390, height: 844 });
    await p.clock.runFor(100);
    await frame.locator(".news-brief-title").first().waitFor();
    ok(
      "resizing moves discovery into the mobile board list",
      (await p.locator(".news-brief--rail").isHidden()) &&
        (await frame.locator(".news-brief-item").count()) === 1,
    );
    ok(
      "mobile embedded card fits the viewport",
      await frame
        .locator("html")
        .evaluate((e) => e.scrollWidth <= innerWidth + 1),
    );
    const href = await frame
      .locator(".news-brief-title")
      .first()
      .getAttribute("href");
    await frame.locator(".news-brief-title").first().click();
    await p.locator(".news-article-selected").waitFor();
    ok(
      "embedded card opens the news list in the full window",
      p.url() === base + "/" + href,
    );
    await f.close();
  }
  for (const width of [360, 860, 1024, 1279, 1280, 1366, 1920, 3440]) {
    const f = await open(width, "reduce"),
      p = f.page;
    await p.goto(base + "/main.html#lounge");
    await p.frameLocator("#loungeFrame").locator("#listView").waitFor();
    ok(
      `${width}px shell has no horizontal overflow`,
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    if (width >= 1280) {
      await p.locator(".news-brief-title").first().waitFor();
      const [rail, board] = await Promise.all([
        p.locator(".news-brief").boundingBox(),
        p.locator("#loungeFrame").boundingBox(),
      ]);
      ok(
        `${width}px rail stays beside the content without overlap`,
        rail.x >= board.x + board.width + 20 && rail.width === 288,
      );
    }
    await f.close();
  }
  {
    const f = await open(1440),
      p = f.page;
    await ready(p, "/lounge.html");
    ok(
      "standalone desktop board also shows a three-item rail",
      (await p.locator(".news-brief-item").count()) === 3,
    );
    await p.goto(base + "/lounge.html?write=1");
    await p.locator("#editorView").waitFor();
    ok(
      "news does not distract from the mobile/standalone editor",
      await p.locator(".news-brief").isHidden(),
    );
    await f.close();
  }
  {
    const f = await open(1440, "reduce", { fail: true }),
      p = f.page;
    await p.goto(base + "/main.html");
    await p.locator("[data-news-retry]").waitFor();
    ok(
      "failed feed retains a working full-news link",
      (await p.locator(".news-brief-all").getAttribute("href")) === "news.html",
    );
    f.state.fail = false;
    await p.locator("[data-news-retry]").click();
    await p.locator(".news-brief-title").first().waitFor();
    ok(
      "retry recovers without reloading the board",
      (await p.locator(".news-brief-item").count()) === 3,
    );
    await f.close();
  }
  {
    const data = structuredClone(fixture);
    data.items = [
      null,
      {
        source: "__proto__",
        title: "Bad",
        url: "https://example.com",
        publishedAt: new Date().toISOString(),
      },
      ...data.items.slice(0, 1),
    ];
    data.items[2].title = "<img src=x onerror=alert(1)> 신뢰할 수 없는 제목";
    data.sources = [null];
    const f = await open(1440, "reduce", { data }),
      p = f.page;
    await ready(p);
    ok(
      "unsafe entries are rejected, markup is text, and a single item never rotates",
      (await p.locator(".news-brief-item").count()) === 1 &&
        (await p.locator(".news-brief img").count()) === 0 &&
        (await p.locator(".news-brief-controls").isHidden()),
    );
    ok(
      "missing source freshness is disclosed",
      await p.locator(".news-brief-notice").isVisible(),
    );
    await f.close();
  }
  {
    const data = { ...fixture, items: [] };
    const f = await open(1440, "reduce", { data }),
      p = f.page;
    await p.goto(base + "/main.html");
    await p
      .locator(".news-brief-notice")
      .filter({ hasText: "아직 가져온 소식이 없어요" })
      .waitFor();
    await p.setViewportSize({ width: 1366, height: 900 });
    ok(
      "empty feed does not trigger a resize/refetch loop",
      f.state.requests === 1,
    );
    await f.close();
  }
  console.log(`News discovery: ${checks} checks passed`);
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
