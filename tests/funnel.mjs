// Actual pages + real Auth SDK, with every network request fulfilled or aborted.
// No request is continued to ORBIT, Supabase, CDNs, or any other remote server.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const browser = await chromium.launch();
const origin = 'https://orbithere.com';
const backend = 'unwxpuvfqyjhgrcrmuhu.supabase.co';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const tokenKey = 'sb-unwxpuvfqyjhgrcrmuhu-auth-token';
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml' };
let checks = 0;
function ok(name, value = true) { assert.ok(value, name); checks++; console.log('✓ ' + name); }
function session(actor = A, anonymous = false) {
  const expires_at = Math.floor(Date.now() / 1000) + 3600;
  const encode = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  return { access_token: encode({ alg: 'HS256' }) + '.' + encode({ sub: actor, exp: expires_at, role: 'authenticated', is_anonymous: anonymous }) + '.test', refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, expires_at,
    user: { id: actor, aud: 'authenticated', role: 'authenticated', is_anonymous: anonymous, email: anonymous ? '' : 'private@example.test', email_confirmed_at: anonymous ? null : new Date().toISOString(), created_at: new Date().toISOString(), app_metadata: { provider: anonymous ? 'anonymous' : 'email' }, user_metadata: {} } };
}
function profile(admin = false) { return { nickname: 'Private nickname', is_admin: admin, joined_at: '2026-09-14T00:00:00Z', level: 1, xp: 0, level_start: 0, next_level: 10, attendance_days: 1, today_claimed: true, badges: [], history: [], nickname_change_available_at: '2026-09-01T00:00:00Z' }; }
async function fixture(options = {}) {
  const context = await browser.newContext({ viewport: { width: options.mobile ? 390 : 1280, height: 900 }, isMobile: !!options.mobile, hasTouch: !!options.mobile, serviceWorkers: 'block', userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' });
  const state = { events: [], calls: [], handled: 0, remoteAborted: 0, errors: [], auth: options.auth || null, actor: A, admin: !!options.admin, failAnalytics: !!options.failAnalytics, postFail: false };
  const scriptGate = options.delayAnalyticsScript ? new Promise(resolve => { state.releaseScript = resolve; }) : null;
  await context.addInitScript(({ auth, webdriver, exclude, blockSessionStorage, tokenKey }) => {
    if (webdriver === false) Object.defineProperty(navigator, 'webdriver', { get: () => false });
    if (!sessionStorage.getItem('funnel-fixture-initialized')) {
      sessionStorage.setItem('funnel-fixture-initialized', '1');
      if (auth) localStorage.setItem(tokenKey, JSON.stringify(auth));
      if (exclude) localStorage.setItem('orbit_analytics_exclude', '1');
    }
    if (blockSessionStorage) {
      for (const method of ['getItem', 'setItem']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function (...args) {
          if (this === window.sessionStorage) throw new DOMException('Fixture blocks session storage', 'SecurityError');
          return original.apply(this, args);
        };
      }
    }
  }, { auth: state.auth, webdriver: options.webdriver === true, exclude: !!options.exclude, blockSessionStorage: !!options.blockSessionStorage, tokenKey });
  await context.route('**/*', async route => {
    state.handled++;
    const req = route.request(), url = new URL(req.url());
    let body;
    try { body = req.postDataJSON(); } catch (_) { body = null; }
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'x-supabase-api-version': '2024-01-01' }, body: JSON.stringify(data) });
    if (url.hostname === 'orbithere.com' || url.hostname === 'localhost') {
      if (options.failAnalyticsScript && url.pathname === '/orbit-analytics.js') return route.abort('failed');
      if (scriptGate && url.pathname === '/orbit-analytics.js') await scriptGate;
      const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const path = resolve(root, '.' + pathname);
      if (!path.startsWith(root + sep)) return route.fulfill({ status: 403, body: '' });
      try { return route.fulfill({ contentType: types[extname(path)] || 'application/octet-stream', body: await readFile(path) }); }
      catch (_) { return route.fulfill({ status: 404, body: '' }); }
    }
    if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('@supabase/supabase-js@'))
      return route.fulfill({ contentType: 'application/javascript', path: resolve(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js') });
    if (url.hostname !== backend) { state.remoteAborted++; return route.abort(); }
    state.calls.push({ path: url.pathname, method: req.method(), body, headers: req.headers() });
    if (req.method() === 'OPTIONS') return json({});
    const rpc = url.pathname.split('/').pop();
    if (rpc === 'record_funnel_event') {
      if (body?.p_event) state.events.push(body.p_event);
      if (state.failAnalytics) return route.abort('failed');
      return json(null);
    }
    if (url.pathname === '/auth/v1/token') {
      if (state.loginFail) return json({ code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
      state.auth = session(state.actor); return json(state.auth);
    }
    if (url.pathname === '/auth/v1/logout') { state.auth = null; return json({}); }
    if (url.pathname === '/auth/v1/user') return json(state.auth?.user || null);
    if (url.pathname === '/auth/v1/signup') return json({ id: A, email: body.email, is_anonymous: false, identities: [] });
    if (url.pathname === '/auth/v1/verify') { state.auth = session(state.actor); return json(state.auth); }
    if (url.pathname === '/auth/v1/authorize') return route.fulfill({ contentType: 'text/html', body: '<p>Intercepted OAuth</p>' });
    if (rpc === 'member_visit' || rpc === 'member_profile') return json(profile(state.admin));
    if (rpc === 'is_admin') return json(state.admin);
    if (rpc === 'board_version') return json(3);
    if (rpc === 'community_version') return json(2);
    if (rpc === 'board_observation_version') return json(1);
    if (rpc === 'create_board_post' || rpc === 'create_observation_post') return json({ code: '42501', message: 'fixture rejected write' }, 403);
    if (rpc === 'board_activity_summary') return json({ mine: 0, joined: 0, unread: 0 });
    if (rpc === 'record_visit') return json(null);
    return json([]);
  });
  const page = await context.newPage();
  page.on('pageerror', error => state.errors.push(error.message));
  return { context, page, state, mobile: !!options.mobile, close: () => context.close() };
}
const events = (f, name, feature) => f.state.events.filter(e => e.event === name && (!feature || e.feature === feature));
async function settle(page) { await page.waitForTimeout(100); }
async function waitEvent(f, name, feature) {
  for (let i = 0; i < 40 && !events(f, name, feature).length; i++) await f.page.waitForTimeout(50);
  assert.ok(events(f, name, feature).length, `missing ${name} ${feature || ''}: ${JSON.stringify(f.state.events)}`);
}
async function panel(f, name) {
  const action = f.mobile ? 'tap' : 'click';
  const night = name === 'planets' || name === 'sky';
  if (!night || !await f.page.locator('#nightHub').isVisible()) {
    if (await f.page.locator('#navToggle').isVisible()) await f.page.locator('#navToggle')[action]();
    const menu = night ? '#sideNav [data-nav-group="night"]' : `#sideNav [data-panel="${name}"]`;
    await f.page.locator(menu)[action]();
    // The mobile scrim fades for 0.2s and intercepts clicks until hidden.
    await f.page.locator('#navScrim').waitFor({ state: 'hidden' });
  }
  if (night) await f.page.locator(`#nightTabs [data-night-panel="${name}"]`)[action]();
}
function privacy(f) {
  const allowed = ['audience', 'context', 'detail', 'event', 'feature', 'page_key', 'sequence', 'session_id'];
  for (const event of f.state.events) {
    assert.deepEqual(Object.keys(event).sort(), allowed);
    assert.ok(Buffer.byteLength(JSON.stringify(event)) <= 512);
    assert.match(event.session_id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.ok(Number.isInteger(event.sequence) && event.sequence >= 1 && event.sequence <= 128);
    assert.ok(typeof event.page_key === 'string' && !/[/?#:.]/.test(event.page_key));
    assert.ok(['guest', 'member'].includes(event.audience));
  }
  const text = JSON.stringify(f.state.events);
  for (const secret of ['private@example.test', 'Private nickname', 'SENSITIVE_QUERY', 'SENSITIVE_TEXT', A, B]) assert.ok(!text.includes(secret), secret + ' leaked');
  assert.ok(f.state.events.every(e => !['auth_complete', 'post_publish', 'comment_publish', 'reaction'].includes(e.event)));
  for (const call of f.state.calls.filter(c => c.path.endsWith('/record_funnel_event'))) {
    assert.ok(!call.headers.authorization, 'analytics must not send the member bearer token');
    assert.ok(!call.headers.referer, 'analytics must omit the raw requesting page URL');
  }
}

try {
  for (const path of ['/', '/index.html']) {
    const f = await fixture();
    await f.page.goto(origin + path); await waitEvent(f, 'board_enter', 'board');
    ok(path + ' records one board visit with an accepted board page key',
      events(f, 'feature_view', 'board').length === 1 && f.state.events.every(e => e.feature === 'board' && e.page_key === 'board'));
    await f.page.locator('#writeTop').click(); await waitEvent(f, 'write_start', 'board');
    ok(path + ' preserves explicit write intent without a second board visit', events(f, 'feature_view', 'board').length === 1);
    privacy(f); await f.close();
  }
  for (const [name, options, url] of [
    ['default webdriver', { webdriver: true }, origin + '/planets.html'],
    ['localhost', {}, 'http://localhost/planets.html'],
    ['explicit exclusion', { exclude: true }, origin + '/planets.html'],
    ['known crawler', { userAgent: 'Googlebot/2.1 (+http://www.google.com/bot.html)' }, origin + '/planets.html'],
  ]) {
    const f = await fixture(options);
    await f.page.goto(url); await f.page.locator('#scrubRange').waitFor(); await settle(f.page);
    ok(name + ' sends no funnel requests', f.state.events.length === 0);
    await f.close();
  }

  {
    const f = await fixture({ blockSessionStorage: true });
    await f.page.goto(origin + '/planets.html'); await f.page.locator('#scrubRange').waitFor();
    await f.page.locator('#placeRow button').nth(1).click(); await settle(f.page);
    await f.page.goto(origin + '/guide.html'); await settle(f.page);
    ok('blocked session storage disables collection without blocking tools or navigation', !f.state.events.length && !f.state.errors.length);
    await f.close();
  }

  for (const [referrer, expected] of [
    ['https://www.google.com/search?q=SENSITIVE_QUERY', 'google'],
    ['https://search.naver.com/search.naver?query=SENSITIVE_QUERY', 'naver'],
    ['https://www.bing.com/search?q=SENSITIVE_QUERY', 'other_search'],
    ['https://example.test/path?secret=SENSITIVE_QUERY', 'external'],
    [origin + '/guide.html?secret=SENSITIVE_QUERY', 'internal'],
    ['', 'unattributed'],
    ['https://google.com.attacker.test/?q=SENSITIVE_QUERY', 'external'],
  ]) {
    const f = await fixture();
    await f.page.goto(origin + '/planets.html?q=SENSITIVE_QUERY', referrer ? { referer: referrer } : {});
    await waitEvent(f, 'session_start'); await waitEvent(f, 'tool_ready', 'planets');
    assert.equal(events(f, 'session_start')[0].detail, expected);
    assert.equal(events(f, 'session_start')[0].page_key, 'planets');
    privacy(f); ok('referrer classified without URL/query: ' + expected);
    assert.ok(!f.state.calls.some(c => c.path === '/auth/v1/signup'), 'analytics must not create anonymous Auth users');
    await f.close();
  }

  {
    const f = await fixture();
    await f.page.goto(origin + '/main.html#planets', { referer: 'https://www.google.com/search?q=SENSITIVE_QUERY' });
    await waitEvent(f, 'tool_ready', 'planets');
    const first = events(f, 'session_start')[0].session_id;
    assert.equal(events(f, 'session_start')[0].page_key, 'main_planets');
    ok('main and visible iframe produce one landing and view', events(f, 'session_start').length === 1 && events(f, 'feature_view', 'planets').length === 1);
    await f.page.evaluate(() => { const frame = document.querySelector('#skyFrame'); frame.src = frame.dataset.src; });
    await f.page.frameLocator('#skyFrame').locator('.ev').first().waitFor({ state: 'attached' });
    await settle(f.page);
    ok('hidden iframe preload has no view, ready, or use', !f.state.events.some(e => e.feature === 'calendar'));
    await panel(f, 'planets'); await panel(f, 'planets');
    await f.page.setViewportSize({ width: 1100, height: 760 }); await settle(f.page);
    ok('repeat selected night tab and resize do not create actual use', events(f, 'tool_use').length === 0);
    const planet = f.page.frameLocator('#planetFrame');
    await planet.locator('#scrubRange').focus(); await f.page.keyboard.press('Home'); await f.page.keyboard.press('ArrowRight');
    await waitEvent(f, 'tool_use', 'planets');
    await planet.locator('#placeRow button').nth(1).click(); await settle(f.page);
    ok('trusted time and region changes are distinct minimal actions', events(f, 'tool_use', 'planets').some(e => e.detail === 'time') && events(f, 'tool_use', 'planets').some(e => e.detail === 'region'));
    const useCount = events(f, 'tool_use').length;
    await planet.locator('#placeRow button').nth(1).click();
    await planet.locator('#scrubRange').evaluate(el => el.dispatchEvent(new Event('input', { bubbles: true })));
    await settle(f.page);
    ok('same choice and synthetic input do not add use', events(f, 'tool_use').length === useCount);
    await panel(f, 'sky'); await waitEvent(f, 'tool_ready', 'calendar');
    ok('changing night tabs records one view per feature without actual tool use', events(f, 'feature_view', 'planets').length === 1 && events(f, 'feature_view', 'calendar').length === 1 && events(f, 'tool_use').length === useCount);
    const sky = f.page.frameLocator('#skyFrame');
    await sky.locator('#filterRow button').nth(1).click(); await waitEvent(f, 'tool_use', 'calendar');
    ok('calendar filter is actual use', events(f, 'tool_use', 'calendar').some(e => e.detail === 'filter'));
    await panel(f, 'lounge'); await waitEvent(f, 'board_enter');
    await f.page.goBack(); await f.page.goForward(); await f.page.reload(); await waitEvent(f, 'board_enter');
    ok('back/forward/refresh reuse session and keep original source', events(f, 'session_start').length === 1 && f.state.events.every(e => e.session_id === first) && events(f, 'session_start')[0].detail === 'google');
    ok('view dedupe survives navigation and refresh', events(f, 'feature_view', 'planets').length === 1 && events(f, 'feature_view', 'calendar').length === 1 && events(f, 'feature_view', 'board').length === 1);
    privacy(f); ok('iframe payload contract excludes identity, location and sensitive input');
    await f.close();
  }

  {
    const f = await fixture();
    await f.page.goto(origin + '/lounge.html?write=1&q=SENSITIVE_QUERY', { referer: 'https://www.google.com/search?q=SENSITIVE_QUERY' });
    await f.page.locator('#postInput').waitFor(); await waitEvent(f, 'feature_view', 'board');
    ok('direct editor render is not a writing start', events(f, 'write_start').length === 0);
    await f.page.locator('#postInput').fill('SENSITIVE_TEXT'); await waitEvent(f, 'write_start');
    await f.page.reload(); await f.page.locator('#postInput').waitFor(); await settle(f.page);
    ok('input counts once; restored draft does not count again', events(f, 'write_start').length === 1 && events(f, 'write_start')[0].detail === 'input');
    await f.page.locator('#memberWriteGate [data-account-open="login"]').click();
    await f.page.locator('#email').waitFor(); await waitEvent(f, 'auth_open');
    await f.page.locator('#email').fill('private@example.test'); await f.page.locator('#password').fill('test-password');
    await f.page.locator('#authSubmit').click(); await waitEvent(f, 'auth_attempt');
    await f.page.waitForFunction(() => window.OrbitMembers?.state?.user?.email_confirmed_at);
    assert.ok(events(f, 'write_start')[0].sequence < events(f, 'auth_attempt')[0].sequence);
    ok('writing → authentication attempt has ordered bounded events');
    await f.page.waitForFunction(() => window.OrbitMembers?.state?.profile && !document.querySelector('#accountStatus')?.textContent?.includes('중이에요'));
    await f.page.keyboard.press('Escape');
    await f.page.locator('.account-dialog').waitFor({ state: 'hidden' });
    await f.page.locator('#btnTrace').click();
    await f.page.waitForFunction(() => document.querySelector('#writeStatus').textContent.includes('실패'));
    ok('failed database publish creates no success event and preserves input', events(f, 'write_start').length === 1 && await f.page.locator('#postInput').inputValue() === 'SENSITIVE_TEXT');
    privacy(f); ok('auth and post text never enter analytics payloads');
    ok('guest source and audience are not relabelled after login', f.state.events.every(e => e.audience === 'guest') && events(f, 'session_start').length === 1 && events(f, 'session_start')[0].detail === 'google');
    await f.close();
  }

  {
    const f = await fixture();
    await f.page.goto(origin + '/reading-sky.html?query=SENSITIVE_QUERY'); await waitEvent(f, 'session_start');
    assert.equal(events(f, 'session_start')[0].page_key, 'reading_sky');
    await f.page.goto(origin + '/guide.html'); await waitEvent(f, 'feature_view', 'guide');
    await f.page.locator('a[href="lounge.html?write=1#report"]').click();
    await f.page.locator('#postInput').waitFor(); await waitEvent(f, 'write_start');
    assert.equal(events(f, 'write_start')[0].detail, 'explicit');
    assert.ok(events(f, 'board_enter')[0].sequence < events(f, 'write_start')[0].sequence);
    ok('guide explicit write CTA preserves board-before-write order and canonical landing');
    privacy(f); await f.close();
    const story = await fixture();
    await story.page.goto(origin + '/stories/moon-face-and-phases.html?secret=SENSITIVE_QUERY');
    await waitEvent(story, 'session_start');
    assert.equal(events(story, 'session_start')[0].page_key, 'moon-face-and-phases');
    ok('story canonical allowlist identifies article without raw URL or query');
    privacy(story); await story.close();
  }

  {
    const f = await fixture();
    await f.page.goto(origin + '/main.html#lounge'); await waitEvent(f, 'feature_view', 'board');
    await f.page.locator('#headerSignup').click(); await f.page.locator('#email').waitFor();
    await f.page.locator('#email').fill('private@example.test'); await f.page.locator('#password').fill('test-password');
    await f.page.locator('#consent').check(); await f.page.locator('#authSubmit').click();
    await f.page.locator('#verifyCard').waitFor(); await waitEvent(f, 'auth_attempt');
    ok('email signup request awaiting verification stays guest and is not auth completion', events(f, 'auth_attempt').some(e => e.detail === 'email_signup') && !await f.page.evaluate(() => !!OrbitMembers.state.user?.email_confirmed_at));
    privacy(f); await f.close();
  }

  {
    const f = await fixture();
    f.state.loginFail = true;
    await f.page.goto(origin + '/lounge.html'); await waitEvent(f, 'feature_view', 'board');
    await f.page.locator('[data-account-link]').click(); await f.page.locator('#email').waitFor();
    await f.page.locator('#email').fill('private@example.test'); await f.page.locator('#password').fill('test-password');
    await f.page.locator('#authSubmit').click(); await waitEvent(f, 'auth_attempt');
    await f.page.waitForFunction(() => !document.querySelector('#authSubmit').disabled && document.querySelector('#accountStatus').textContent.length > 0);
    await f.page.keyboard.press('Escape'); await f.page.locator('.account-dialog').waitFor({ state: 'hidden' });
    await f.page.locator('#writeTop').click(); await f.page.locator('#postInput').fill('SENSITIVE_TEXT');
    await waitEvent(f, 'write_start');
    f.state.loginFail = false;
    await f.page.locator('#memberWriteGate [data-account-open="login"]').click(); await f.page.locator('#email').waitFor();
    await f.page.locator('#email').fill('private@example.test'); await f.page.locator('#password').fill('test-password');
    await f.page.locator('#authSubmit').click();
    await f.page.waitForFunction(() => OrbitMembers.state.user?.email_confirmed_at && OrbitMembers.state.profile);
    const attempts = events(f, 'auth_attempt'), writing = events(f, 'write_start')[0];
    ok('failed pre-write auth does not suppress the later same-method attempt', attempts.length === 2 && attempts[0].sequence < writing.sequence && attempts[1].sequence > writing.sequence && attempts.every(e => e.detail === 'email_login'));
    ok('auth screen retains one observation on each side of writing', events(f, 'auth_open').length === 2);
    privacy(f); await f.close();
  }

  {
    const f = await fixture();
    await f.page.clock.setFixedTime(new Date('2026-09-27T02:00:00Z'));
    await f.page.goto(origin + '/planets.html', { referer: 'https://www.google.com/search?q=SENSITIVE_QUERY' }); await waitEvent(f, 'tool_ready', 'planets');
    const first = events(f, 'session_start')[0].session_id;
    await f.page.clock.setFixedTime(new Date('2026-09-27T02:29:59Z'));
    await f.page.locator('#placeRow button').nth(1).click(); await settle(f.page);
    ok('activity inside 30 minutes retains the session', events(f, 'session_start').length === 1);
    await f.page.clock.setFixedTime(new Date('2026-09-27T03:00:00Z'));
    await f.page.locator('#scrubRange').focus(); await f.page.keyboard.press('Home'); await f.page.keyboard.press('ArrowRight');
    await settle(f.page);
    ok('30 minutes inactivity starts exactly one new session', events(f, 'session_start').length === 2 && events(f, 'session_start')[1].session_id !== first);
    const second = events(f, 'session_start')[1].session_id;
    assert.equal(events(f, 'session_start')[1].detail, 'unattributed', 'same-document resumption must not fabricate another Google arrival');
    ok('new session use still has a ready-tool denominator', f.state.events.some(e => e.session_id === second && e.event === 'tool_ready'));
    await f.close();
  }

  {
    const f = await fixture();
    await f.page.clock.setFixedTime(new Date('2026-09-27T14:59:58Z'));
    await f.page.goto(origin + '/planets.html'); await waitEvent(f, 'tool_ready', 'planets');
    await f.page.clock.setFixedTime(new Date('2026-09-27T15:00:02Z'));
    await f.page.locator('#placeRow button').nth(1).click(); await settle(f.page);
    ok('KST midnight rotates despite only four seconds elapsed', events(f, 'session_start').length === 2);
    privacy(f); await f.close();
  }

  {
    // Keep malformed-input rejection separate from the asynchronous rollover
    // batch. A late valid region event must not look like a privacy leak.
    const f = await fixture();
    await f.page.goto(origin + '/planets.html');
    await waitEvent(f, 'session_start');
    await waitEvent(f, 'feature_view', 'planets');
    await waitEvent(f, 'tool_ready', 'planets');
    assert.equal(f.state.events.length, 3, 'all initial planet observations have arrived');
    const before = f.state.events.length;
    const unchanged = await f.page.evaluate(() => {
      const before = sessionStorage.getItem('orbit_analytics_session_v1');
      OrbitAnalytics.use('SENSITIVE_TEXT', { isTrusted: true });
      OrbitAnalytics.authOpen('SENSITIVE_TEXT');
      OrbitAnalytics.authAttempt('SENSITIVE_TEXT', { isTrusted: true });
      OrbitAnalytics.write('SENSITIVE_TEXT', { isTrusted: true });
      return sessionStorage.getItem('orbit_analytics_session_v1') === before;
    });
    await settle(f.page);
    ok('client rejects arbitrary event detail and sensitive values', unchanged && f.state.events.length === before);
    const storage = await f.page.evaluate(() => Object.keys(localStorage));
    ok('analytics adds no durable ID or event queue', !storage.some(key => /analytics|funnel/.test(key)));
    privacy(f); await f.close();
  }

  {
    const f = await fixture({ auth: session(A) });
    await f.page.goto(origin + '/main.html#lounge'); await waitEvent(f, 'feature_view', 'board');
    f.state.actor = B;
    await f.page.evaluate(async () => { await OrbitMembers.sb.auth.signInWithPassword({ email: 'private@example.test', password: 'test-password' }); await OrbitMembers.refresh(); });
    await f.page.waitForFunction(id => OrbitMembers.state.user?.id === id && OrbitMembers.state.profile, B);
    await panel(f, 'planets'); await waitEvent(f, 'feature_view', 'planets');
    await f.page.evaluate(async () => { await OrbitMembers.sb.auth.signOut(); await OrbitMembers.refresh(); });
    await f.page.waitForFunction(() => !OrbitMembers.state.user && !OrbitMembers.state.profile);
    await panel(f, 'sky'); await waitEvent(f, 'feature_view', 'calendar');
    privacy(f);
    ok('A → B → logout keeps existing identity isolation and sends no account IDs', !f.state.errors.length && f.state.events.every(e => e.audience === 'member'));
    await f.close();
    const admin = await fixture({ auth: session(A), admin: true });
    await admin.page.goto(origin + '/main.html#planets');
    await admin.page.waitForFunction(() => OrbitMembers.state.profile?.is_admin === true);
    await panel(admin, 'sky'); await settle(admin.page);
    ok('resolved operator profile excludes all funnel requests', admin.state.events.length === 0);
    await admin.close();
  }

  {
    const f = await fixture({ delayAnalyticsScript: true });
    await f.page.goto(origin + '/planets.html', { waitUntil: 'commit' });
    await f.page.locator('#scrubNow').filter({ hasText: /20\d\d/ }).waitFor();
    const before = await f.page.locator('#scrubNow').textContent();
    await f.page.locator('#scrubRange').focus(); await f.page.keyboard.press('Home'); await f.page.keyboard.press('ArrowRight');
    ok('delayed analytics script does not block tool rendering or controls', before !== await f.page.locator('#scrubNow').textContent() && !await f.page.evaluate(() => !!window.OrbitAnalytics));
    f.state.releaseScript(); await waitEvent(f, 'tool_ready', 'planets');
    ok('deferred collector recovers already rendered tool readiness');
    await f.close();
    const blocked = await fixture({ failAnalyticsScript: true });
    await blocked.page.goto(origin + '/main.html#planets');
    await blocked.page.frameLocator('#planetFrame').locator('#scrubRange').waitFor();
    await panel(blocked, 'sky'); await blocked.page.frameLocator('#skyFrame').locator('#filterRow button').nth(1).click();
    await panel(blocked, 'lounge'); await blocked.page.frameLocator('#loungeFrame').locator('#postList .empty-state a').waitFor();
    assert.deepEqual(blocked.state.errors, [], 'missing analytics script must not cause page errors');
    assert.deepEqual(blocked.state.events, [], 'missing analytics script must not send events');
    ok('missing analytics script leaves panels and board usable', !blocked.state.events.length && !blocked.state.errors.length);
    await blocked.close();
  }

  {
    const f = await fixture({ mobile: true, failAnalytics: true });
    await f.page.goto(origin + '/main.html#planets'); await f.page.frameLocator('#planetFrame').locator('#scrubRange').waitFor();
    await panel(f, 'sky'); await f.page.frameLocator('#skyFrame').locator('#filterRow button').nth(1).tap();
    await panel(f, 'lounge');
    await f.page.frameLocator('#loungeFrame').locator('#postList .empty-state a').waitFor();
    await f.page.frameLocator('#loungeFrame').locator('#writeTop').tap();
    await f.page.frameLocator('#loungeFrame').locator('#postInput').fill('SENSITIVE_TEXT');
    await f.page.frameLocator('#loungeFrame').locator('#memberWriteGate [data-account-open="login"]').tap();
    await f.page.locator('#email').waitFor();
    await f.page.locator('#email').fill('private@example.test'); await f.page.locator('#password').fill('test-password');
    await f.page.locator('#authSubmit').click();
    await f.page.waitForFunction(() => window.OrbitMembers?.state?.user?.email_confirmed_at);
    ok('mobile navigation, writing and login work while analytics network fails');
    const before = f.state.events.length; await f.page.waitForTimeout(350);
    ok('analytics failure has no retry loop or feature error', f.state.events.length === before && !f.state.errors.length);
    privacy(f); await f.close();
  }

  console.log(`\n${checks} funnel checks passed (all network intercepted; zero live requests).`);
} finally { await browser.close(); }
