// Real SDK and browser, intercepted Auth/RPC HTTP. No production requests.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const root = fileURLToPath(new URL("../", import.meta.url)).replace(
  /[\\/]$/,
  "",
);
const server = createServer(async (req, res) => {
  const full = resolve(root, "." + new URL(req.url, "http://local").pathname);
  if (!full.startsWith(root + sep)) {
    res.writeHead(403);
    return res.end();
  }
  try {
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".json": "application/json",
      }[extname(full)] || "application/octet-stream",
    );
    res.end(await readFile(full));
  } catch (_) {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port,
  browser = await chromium.launch(),
  A = "11111111-1111-4111-8111-111111111111";
const tokenKey = "sb-unwxpuvfqyjhgrcrmuhu-auth-token";
let count = 0;
function ok(name, value = true) {
  assert.ok(value, name);
  console.log("✓ " + name);
  count++;
}
function session(anonymous = false, metadata = {}) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token:
      Buffer.from('{"alg":"HS256"}').toString("base64url") +
      "." +
      Buffer.from(
        JSON.stringify({
          sub: A,
          exp,
          role: "authenticated",
          is_anonymous: anonymous,
        }),
      ).toString("base64url") +
      ".signature",
    refresh_token: "test-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    user: {
      id: A,
      email: anonymous ? "" : "member@example.test",
      email_confirmed_at: anonymous ? null : new Date().toISOString(),
      is_anonymous: anonymous,
      app_metadata: { provider: anonymous ? "anonymous" : "email" },
      user_metadata: metadata,
      aud: "authenticated",
      created_at: new Date().toISOString(),
    },
  };
}
function profile() {
  return {
    nickname: "밤하늘",
    joined_at: "2026-09-14T00:00:00Z",
    level: 12,
    xp: 700,
    level_start: 660,
    next_level: 780,
    attendance_days: 30,
    badges: ["first-post", "attendance-30", "level-10"],
    selected_badge: null,
    today_claimed: true,
    history: [
      { kind: "visit", amount: 10, created_at: new Date().toISOString() },
      {
        kind: "event",
        title: "함께한 관측",
        amount: 50,
        created_at: new Date().toISOString(),
      },
    ],
  };
}
async function fixture({
  auth = null,
  p = profile(),
  enabled = true,
  google = true,
  width = 1280,
} = {}) {
  const context = await browser.newContext({
      viewport: { width, height: 900 },
    }),
    state = {
      auth,
      profile: p,
      calls: [],
      fail: false,
      signupFail: false,
      deleted: false,
    };
  if (auth)
    await context.addInitScript(
      ({ key, auth }) => {
        if (!sessionStorage.getItem("initialized")) {
          localStorage.setItem(key, JSON.stringify(auth));
          localStorage.setItem("orbit_nickname", "옛별칭");
          sessionStorage.setItem("initialized", "yes");
        }
      },
      { key: tokenKey, auth },
    );
  await context.route("**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      body = req.postDataJSON(),
      json = (data, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
    if (url.origin === base) {
      if (url.pathname === "/orbit-config.js")
        return route.fulfill({
          contentType: "application/javascript",
          body: (await readFile(root + "/orbit-config.js", "utf8"))
            .replace("membersEnabled:false", "membersEnabled:" + enabled)
            .replace("googleAuthEnabled:false", "googleAuthEnabled:" + google),
        });
      return route.continue();
    }
    if (
      url.hostname === "cdn.jsdelivr.net" &&
      url.pathname.includes("@supabase/supabase-js@")
    )
      return route.fulfill({
        contentType: "application/javascript",
        path: root + "/node_modules/@supabase/supabase-js/dist/umd/supabase.js",
      });
    if (url.hostname !== "unwxpuvfqyjhgrcrmuhu.supabase.co")
      return route.abort();
    state.calls.push({
      path: url.pathname,
      method: req.method(),
      body,
      query: Object.fromEntries(url.searchParams),
    });
    if (url.pathname === "/auth/v1/authorize")
      return route.fulfill({
        contentType: "text/html",
        body: "<p>Google authorization fixture</p>",
      });
    if (url.pathname === "/auth/v1/user/identities/authorize")
      return json({
        url: "https://unwxpuvfqyjhgrcrmuhu.supabase.co/auth/v1/authorize?provider=google&linked=true",
      });
    if (url.pathname === "/auth/v1/token") {
      state.auth = session();
      return json(state.auth);
    }
    if (url.pathname === "/auth/v1/signup") {
      if (state.signupFail)
        return json(
          { code: "over_email_send_rate_limit", msg: "rate limited" },
          429,
        );
      return json({
        id: A,
        email: body.email,
        is_anonymous: false,
        identities: [],
      });
    }
    if (url.pathname === "/auth/v1/user") {
      if (req.method() === "PUT") {
        if (body.email) {
          state.auth.user.user_metadata = body.data;
          state.auth.user.new_email = body.email;
        }
        if (body.password)
          state.auth.user.user_metadata = { orbit_needs_password: false };
        return json(state.auth.user);
      }
      return json(state.auth.user);
    }
    if (url.pathname === "/auth/v1/recover") return json({});
    if (url.pathname === "/auth/v1/logout") {
      state.auth = null;
      return json({});
    }
    if (url.pathname === "/functions/v1/member-withdraw") {
      if (state.fail) return json({ error: "withdrawal_retry_required" }, 409);
      state.deleted = true;
      return json({ deleted: true });
    }
    const rpc = url.pathname.split("/").pop();
    if (rpc === "member_visit" || rpc === "member_profile") {
      if (state.fail)
        return json({ code: "42501", message: "withdrawal_in_progress" }, 403);
      return json(state.profile);
    }
    if (rpc === "member_save_profile") {
      state.profile = { ...profile(), nickname: body.p_nickname };
      return json(state.profile);
    }
    if (rpc === "member_select_badge") {
      state.profile.selected_badge = body.p_badge;
      return json(state.profile);
    }
    if (rpc === "member_cards")
      return json([
        {
          user_id: A,
          nickname: "<img src=x onerror=alert(1)>",
          level: 12,
          badge: "first-post",
        },
      ]);
    if (rpc === "is_admin") return json(true);
    if (rpc === "member_admin_events") return json({ events: [], history: [] });
    if (rpc === "visit_stats" || rpc === "report_queue") return json([]);
    if (rpc === "community_version") return json(2);
    if (rpc === "board_version") return json(1);
    if (rpc === "board_posts")
      return json([
        {
          id: "44444444-4444-4444-8444-444444444444",
          author_id: A,
          title: "회원의 관측",
          text: "관측 내용",
          nick: "옛별칭",
          orbit: "free",
          created_at: new Date().toISOString(),
          image_paths: [],
          is_pinned: false,
          comment_count: 0,
          view_count: 0,
        },
      ]);
    if (rpc === "record_visit") return json(null);
    return json([], 200);
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page, state, errors, close: () => context.close() };
}
try {
  let oauthFixture = await fixture({ google: false });
  await oauthFixture.page.goto(base + "/account.html");
  await oauthFixture.page.locator("#authCard").waitFor();
  ok(
    "Google button stays hidden until provider setup is verified",
    await oauthFixture.page.locator("#googleAuth").isHidden(),
  );
  await oauthFixture.close();
  oauthFixture = await fixture();
  await oauthFixture.page.goto(base + "/account.html");
  await oauthFixture.page.locator("#googleSignIn").click();
  await oauthFixture.page.waitForURL("**/auth/v1/authorize?**");
  const oauthCall = oauthFixture.state.calls.find(
    (c) => c.path === "/auth/v1/authorize",
  );
  ok(
    "Google starts OAuth with a fixed return URL and account selector",
    oauthCall.query.provider === "google" &&
      oauthCall.query.redirect_to === base + "/account.html" &&
      oauthCall.query.prompt === "select_account",
  );
  await oauthFixture.close();
  oauthFixture = await fixture({ auth: session(true), p: null });
  await oauthFixture.page.goto(base + "/account.html?mode=signup");
  await oauthFixture.page.locator("#googleSignIn").click();
  await oauthFixture.page.waitForURL("**/auth/v1/authorize?**");
  ok(
    "Google signup links the current anonymous identity without replacing its account",
    oauthFixture.state.calls.some(
      (c) => c.path === "/auth/v1/user/identities/authorize",
    ) &&
      !oauthFixture.state.calls.some(
        (c) => c.path === "/auth/v1/signup" || c.path === "/auth/v1/logout",
      ),
  );
  await oauthFixture.close();
  const googleSession = () => {
    const s = session(false, { orbit_needs_password: true });
    s.user.app_metadata = { provider: "google", providers: ["google"] };
    s.user.identities = [{ provider: "google", user_id: A }];
    return s;
  };
  oauthFixture = await fixture({ auth: googleSession(), p: null });
  await oauthFixture.page.goto(base + "/account.html");
  await oauthFixture.page.locator("#setupCard").waitFor();
  ok(
    "first Google visit asks for nickname and consent without an Orbit password",
    (await oauthFixture.page.locator("#profileConsentField").isVisible()) &&
      (await oauthFixture.page.locator("#passwordCard").isHidden()),
  );
  await oauthFixture.page.locator("#memberNickname").fill("구글회원");
  await oauthFixture.page.locator("#profileForm button").click();
  ok(
    "profile is not saved before first consent",
    !oauthFixture.state.calls.some((c) =>
      c.path.endsWith("member_save_profile"),
    ),
  );
  await oauthFixture.page.locator("#profileConsent").check();
  await oauthFixture.page.locator("#profileForm button").click();
  await oauthFixture.page.locator("#profileCard").waitFor();
  await oauthFixture.page.reload();
  await oauthFixture.page.locator("#profileCard").waitFor();
  ok(
    "returning Google member opens the mini profile and external password management",
    (await oauthFixture.page.locator("#setupCard").isHidden()) &&
      (await oauthFixture.page.locator("#changePassword").isHidden()) &&
      (await oauthFixture.page.locator("#googleManage").isVisible()),
  );
  await oauthFixture.page.locator("#withdrawDetails summary").click();
  await oauthFixture.page.locator("#withdrawConsent").check();
  await oauthFixture.page.locator("#withdrawForm button").click();
  await oauthFixture.page.waitForURL("**/auth/v1/authorize?**");
  ok(
    "Google withdrawal redirects for reauthentication without deleting or asking a password",
    !oauthFixture.state.deleted &&
      oauthFixture.state.calls.some(
        (c) =>
          c.path === "/auth/v1/authorize" &&
          c.query.redirect_to === base + "/account.html?flow=google-withdraw",
      ),
  );
  await oauthFixture.page.goto(base + "/account.html?flow=google-withdraw");
  await oauthFixture.page
    .getByText("Google 계정을 확인했어요.", { exact: false })
    .waitFor();
  ok(
    "Google return requires a second explicit deletion confirmation",
    !oauthFixture.state.deleted &&
      !(await oauthFixture.page.locator("#withdrawConsent").isChecked()),
  );
  await oauthFixture.page.locator("#withdrawConsent").check();
  oauthFixture.page.once("dialog", (d) => d.accept());
  await oauthFixture.page.locator("#withdrawForm button").click();
  await oauthFixture.page
    .getByText("회원 탈퇴와 활동 삭제를 마쳤어요.")
    .waitFor();
  ok(
    "confirmed Google withdrawal does not invoke password login",
    oauthFixture.state.deleted &&
      !oauthFixture.state.calls.some((c) => c.path === "/auth/v1/token"),
  );
  await oauthFixture.close();
  oauthFixture = await fixture({ auth: googleSession() });
  await oauthFixture.context.addInitScript(() =>
    sessionStorage.setItem(
      "orbit_google_return",
      JSON.stringify({ userId: "someone-else", startedAt: Date.now() }),
    ),
  );
  await oauthFixture.page.goto(base + "/account.html?flow=google-withdraw");
  await oauthFixture.page
    .getByText("계정 확인을 완료하지 못해 삭제하지 않았어요.", { exact: false })
    .waitFor();
  ok(
    "switching Google accounts cannot delete the previous account",
    !oauthFixture.state.deleted &&
      !oauthFixture.state.calls.some(
        (c) => c.path === "/functions/v1/member-withdraw",
      ),
  );
  await oauthFixture.close();
  oauthFixture = await fixture({ auth: googleSession() });
  await oauthFixture.context.addInitScript(
    (id) =>
      sessionStorage.setItem(
        "orbit_google_return",
        JSON.stringify({ userId: id, startedAt: Date.now() }),
      ),
    A,
  );
  await oauthFixture.page.goto(base + "/account.html?flow=google-withdraw");
  await oauthFixture.page
    .getByText("Google 계정을 확인했어요.", { exact: false })
    .waitFor();
  await oauthFixture.page.evaluate(() => {
    window.OrbitMembers.state.user.id = "another-account";
    window.dispatchEvent(new Event("orbit:member"));
  });
  ok(
    "changing account after reauthentication clears the deletion approval",
    (await oauthFixture.page.locator("#withdrawForm button").textContent()) ===
      "Google로 본인 확인" && !oauthFixture.state.deleted,
  );
  await oauthFixture.close();
  oauthFixture = await fixture();
  await oauthFixture.page.goto(
    base +
      "/account.html?error=access_denied&error_description=provider-detail",
  );
  await oauthFixture.page
    .getByText("Google 로그인을 완료하지 못했어요.", { exact: false })
    .waitFor();
  ok(
    "cancelled OAuth offers retry and clears provider error from URL",
    !oauthFixture.page.url().includes("error=") &&
      !(await oauthFixture.page.locator("#googleAuth").isHidden()),
  );
  await oauthFixture.close();
  oauthFixture = await fixture({
    auth: session(false, { orbit_policy_version: "2026-09-14-members" }),
    p: null,
  });
  await oauthFixture.page.goto(base + "/account.html");
  await oauthFixture.page.locator("#setupCard").waitFor();
  ok(
    "email signup consent is not requested again after email verification",
    (await oauthFixture.page.locator("#profileConsentField").isHidden()) &&
      (await oauthFixture.page.locator("#profileConsent").isChecked()),
  );
  await oauthFixture.close();
  let f = await fixture({ enabled: false });
  await f.page.goto(base + "/account.html");
  await f.page
    .getByText("회원 기능을 준비하고 있어요.", { exact: false })
    .waitFor();
  ok(
    "unconfigured rollout does not expose working-looking signup forms",
    (await f.page.locator("#authCard").isHidden()) &&
      !f.state.calls.some((c) => c.path.includes("member_")),
  );
  await f.close();
  f = await fixture();
  await f.page.goto(base + "/account.html");
  await f.page.locator("#authCard").waitFor();
  ok(
    "reading the account page never creates an anonymous account",
    !f.state.calls.some((c) => c.path.includes("signup")),
  );
  await f.page.getByRole("button", { name: "회원가입", exact: true }).click();
  await f.page.locator("#email").fill("new@example.test");
  await f.page.locator("#password").fill("only-a-fixture-password");
  await f.page.locator("#consent").check();
  await f.page.locator("#authSubmit").click();
  await f.page
    .getByText("입력한 주소로 인증메일을 요청했어요.", { exact: false })
    .waitFor();
  ok(
    "new signup sends confirmation to the account callback",
    f.state.calls.some(
      (c) =>
        c.path === "/auth/v1/signup" && c.body.email === "new@example.test",
    ),
  );
  ok(
    "signup clears the password after submission",
    (await f.page.locator("#password").inputValue()) === "",
  );
  await f.page
    .getByRole("button", { name: "비밀번호 찾기", exact: true })
    .click();
  await f.page.locator("#authSubmit").click();
  await f.page
    .getByText("재설정 메일을 요청했어요.", { exact: false })
    .waitFor();
  ok(
    "password reset uses the Auth recovery endpoint",
    f.state.calls.some((c) => c.path === "/auth/v1/recover"),
  );
  await f.page
    .getByRole("button", { name: "로그인", exact: true })
    .first()
    .click();
  await f.page.locator("#password").fill("oldpass");
  await f.page.locator("#authSubmit").click();
  await f.page.locator("#profileCard").waitFor();
  ok(
    "existing short passwords can still log in",
    f.state.calls.some(
      (c) => c.path === "/auth/v1/token" && c.body.password === "oldpass",
    ),
  );
  await f.page.locator("#signOut").click();
  await f.page.getByText("로그아웃했어요.").waitFor();
  ok(
    "logout removes both Auth session and remembered nickname",
    await f.page.evaluate(
      (key) =>
        !localStorage.getItem(key) && !localStorage.getItem("orbit_nickname"),
      tokenKey,
    ),
  );
  ok("account flow has no uncaught browser errors", f.errors.length === 0);
  await f.close();
  f = await fixture({ auth: session(true), p: null });
  await f.page.goto(base + "/account.html?mode=signup");
  await f.page
    .getByRole("heading", { name: "지금의 활동을 계정에 연결하기" })
    .waitFor();
  ok(
    "anonymous upgrade does not request a password before email verification",
    await f.page.locator("#passwordField").isHidden(),
  );
  await f.page.locator("#email").fill("link@example.test");
  await f.page.locator("#consent").check();
  await f.page.locator("#authSubmit").click();
  await f.page
    .getByText("입력한 주소로 인증메일을 요청했어요.", { exact: false })
    .waitFor();
  ok(
    "upgrade links email on the existing user instead of creating another account",
    f.state.calls.some(
      (c) =>
        c.path === "/auth/v1/user" &&
        c.method === "PUT" &&
        c.body.email === "link@example.test",
    ) && !f.state.calls.some((c) => c.path === "/auth/v1/signup"),
  );
  ok("upgrade preserves the anonymous identity", f.state.auth.user.id === A);
  await f.close();
  f = await fixture({
    auth: session(false, { orbit_needs_password: true }),
    p: null,
  });
  await f.page.goto(base + "/account.html");
  await f.page.locator("#passwordCard").waitFor();
  await f.page.locator("#newPassword").fill("fixture-new-password");
  await f.page.locator("#confirmPassword").fill("fixture-new-password");
  await f.page.locator("#newPasswordForm button").click();
  await f.page.locator("#setupCard").waitFor();
  ok(
    "verified upgrade finishes password setup before the member profile",
    f.state.calls.some((c) => c.path === "/auth/v1/user" && c.body?.password),
  );
  await f.page.locator("#memberNickname").fill("첫회원");
  await f.page.locator("#profileConsent").check();
  await f.page.locator("#profileForm button").click();
  await f.page.getByText("프로필을 저장했어요.").waitFor();
  ok(
    "profile consent version and nickname reach server together",
    f.state.calls.some(
      (c) =>
        c.path.endsWith("/member_save_profile") &&
        c.body.p_policy_version === "2026-09-14-members" &&
        c.body.p_nickname === "첫회원",
    ),
  );
  await f.close();
  for (const width of [1280, 390]) {
    f = await fixture({ auth: session(), width });
    await f.page.goto(base + "/account.html");
    await f.page.locator("#profileCard").waitFor();
    ok(
      "profile progress is based on server XP at " + width,
      (await f.page.locator("#levelProgressText").textContent()) ===
        "다음 레벨까지 80 별빛",
    );
    ok(
      "profile has no horizontal overflow at " + width,
      await f.page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await f.page.setViewportSize({ width, height: 500 });
    await f.page.screenshot({
      path: root + "/../member-" + width + ".png",
      fullPage: true,
    });
    await f.page.evaluate((id) => {
      var node = document.createElement("span");
      node.dataset.memberId = id;
      document.body.append(node);
      return window.OrbitMembers.decorate(document);
    }, A);
    ok(
      "public nickname HTML is displayed as text at " + width,
      (await f.page.locator("[data-member-id] img").count()) === 0 &&
        (await f.page.locator("[data-member-id]").textContent()) ===
          "<img src=x onerror=alert(1)> · Lv.12첫 글",
    );
    await f.close();
  }
  f = await fixture({ auth: session() });
  await f.page.goto(base + "/account.html?flow=recovery");
  await f.page.locator("#passwordCard").waitFor();
  ok(
    "recovery callback opens password reset form",
    await f.page.locator("#newPassword").isVisible(),
  );
  await f.close();
  f = await fixture({ auth: session() });
  await f.page.goto(base + "/account.html");
  await f.page.locator("#profileCard").waitFor();
  await f.page.locator("#withdrawDetails summary").click();
  await f.page.locator("#withdrawPassword").fill("fixture-password");
  await f.page.locator("#withdrawConsent").check();
  f.page.once("dialog", (d) => d.accept());
  await f.page.locator("#withdrawForm button").click();
  await f.page.getByText("회원 탈퇴와 활동 삭제를 마쳤어요.").waitFor();
  ok(
    "withdrawal reauthenticates before the deletion function",
    f.state.calls.findIndex((c) => c.path === "/auth/v1/token") <
      f.state.calls.findIndex(
        (c) => c.path === "/functions/v1/member-withdraw",
      ),
  );
  ok(
    "withdrawal body cannot nominate another account",
    JSON.stringify(
      f.state.calls.find((c) => c.path === "/functions/v1/member-withdraw")
        .body,
    ) === '{"confirmation":"DELETE_MY_ACCOUNT"}',
  );
  await f.close();
  f = await fixture({ auth: session() });
  await f.page.goto(base + "/main.html#planets");
  await f.page
    .getByRole("button", { name: "밤하늘 · Lv.12", exact: false })
    .waitFor();
  await f.page.locator("#profileChip").click();
  await f.page.waitForURL("**/account.html");
  ok("home profile chip opens the signed-in account");
  await f.close();
  f = await fixture({ auth: session() });
  await f.page.goto(base + "/lounge.html");
  await f.page.locator("#postList .member-level").waitFor();
  ok(
    "board list loads member cards after rows render",
    (await f.page.locator("#postList .member-level").textContent()) === "Lv.12",
  );
  ok(
    "board provides a direct account entry",
    await f.page.locator("[data-account-link]").isVisible(),
  );
  ok("member-enabled board has no uncaught exceptions", f.errors.length === 0);
  await f.close();
  console.log("Members: " + count + " checks passed");
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
