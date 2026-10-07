// The real collector in isolated documents: no browser installation or network.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';

const source = await readFile(new URL('../orbit-analytics.js', import.meta.url), 'utf8');
const KEY = 'orbit_analytics_session_v1';
let checks = 0;
function ok(label) { checks++; console.log('✓ ' + label); }
function storage(blocked = false) {
  const values = new Map();
  return {
    getItem(key) { if (blocked) throw new Error('blocked storage'); return values.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw new Error('blocked storage'); values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}
function shared() {
  return { local: storage(), session: storage(), calls: [], clock: { now: Date.parse('2026-10-07T10:00:00+09:00') } };
}
function documentFor(common, options = {}) {
  const ident = options.id === undefined ? 'cosmic-voids' : options.id;
  const location = new URL(options.url || `https://orbithere.com/stories/${ident}.html?secret=SENSITIVE_QUERY#private`);
  const listeners = new Map(), timers = new Map();
  let timerId = 0;
  const listen = (name, fn) => listeners.set(name, [...(listeners.get(name) || []), fn]);
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [common.clock.now])); }
    static now() { return common.clock.now; }
  }
  const document = {
    hidden: !!options.hidden, readyState: 'complete', referrer: 'https://search.example.test/?private=SENSITIVE_QUERY',
    documentElement: { dataset: {} }, addEventListener: listen,
    querySelector(selector) {
      assert.equal(selector, 'article.story-article[data-orbit-story-id]');
      return ident == null ? null : { dataset: { orbitStoryId: ident } };
    }
  };
  const window = {
    ORBIT_CONFIG: { url: 'https://backend.example.test', publishableKey: 'public-fixture-key', membersEnabled: !!options.members },
    addEventListener: listen, location
  };
  if (options.members) {
    window.OrbitMembers = { state: {
      user: { id: '11111111-1111-4111-8111-111111111111', email: 'private@example.test', email_confirmed_at: '2026-09-01', is_anonymous: false },
      profile: options.unresolved ? null : { is_admin: !!options.admin, nickname: 'PRIVATE_NICKNAME' },
      error: options.unresolved ? new Error('profile unavailable') : null
    } };
  }
  const context = vm.createContext({
    window, document, location, parent: options.embedded ? { location, OrbitAnalytics: { fromFrame() {} } } : window,
    navigator: { webdriver: !!options.webdriver, userAgent: options.bot ? 'Googlebot/2.1' : 'Browser fixture' },
    localStorage: common.local, sessionStorage: options.blocked ? storage(true) : common.session,
    crypto: { randomUUID }, Date: ClockDate, URL, AbortController,
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch: async (url, request) => {
      const call = { url, ...request, payload: JSON.parse(request.body) };
      common.calls.push(call);
      if (options.fail) throw new Error('offline fixture');
      if (options.hang) return new Promise((resolve, reject) => request.signal.addEventListener('abort', () => reject(new Error('timeout fixture'))));
      return { ok: true, json: async () => !options.unregistered };
    }
  });
  vm.runInContext(source, context, { filename: 'orbit-analytics.js' });
  return { window, document, timers, dispatch(name) { for (const fn of listeners.get(name) || []) fn({}); } };
}
async function settle() { await new Promise(setImmediate); }
const stories = c => c.calls.filter(call => call.url.endsWith('/record_story_view'));
const funnel = c => c.calls.filter(call => call.url.endsWith('/record_funnel_event'));

{
  const c = shared();
  const first = documentFor(c); await settle();
  const sessionId = stories(c)[0].payload.p_session_id;
  first.window.OrbitAnalytics.activate(); await settle();
  documentFor(c); await settle(); // refresh
  documentFor(c, { id: 'why-stars-twinkle' }); await settle();
  documentFor(c); await settle(); // back
  assert.deepEqual(stories(c).map(v => v.payload.p_story_id), ['cosmic-voids', 'why-stars-twinkle']);
  assert.ok(stories(c).every(v => v.payload.p_session_id === sessionId));
  assert.equal(funnel(c).filter(v => v.payload.p_event.event === 'feature_view').length, 1);
  ok('each different story counts once; refresh/back/visibility do not duplicate or alter funnel semantics');
  for (const call of stories(c)) {
    assert.deepEqual(Object.keys(call.payload).sort(), ['p_session_id', 'p_story_id']);
    assert.match(call.payload.p_session_id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(call.credentials, 'omit');
    assert.equal(call.referrerPolicy, 'no-referrer');
    assert.deepEqual(Object.keys(call.headers).sort(), ['Content-Type', 'apikey']);
    assert.ok(!JSON.stringify(call.payload).includes('SENSITIVE_QUERY'));
    assert.ok(!JSON.stringify(call.payload).includes('http'));
  }
  ok('payload contains only public story slug and temporary UUID, with no cookies, bearer or raw referrer');
  c.clock.now += 30 * 60000;
  documentFor(c); await settle();
  assert.equal(stories(c).length, 3);
  assert.notEqual(stories(c)[2].payload.p_session_id, sessionId);
  ok('30 minutes of inactivity starts a new observation session');
}
{
  const c = shared(); c.clock.now = Date.parse('2026-10-07T23:59:30+09:00');
  documentFor(c); await settle(); c.clock.now += 60000;
  documentFor(c); await settle();
  assert.equal(stories(c).length, 2);
  assert.notEqual(stories(c)[0].payload.p_session_id, stories(c)[1].payload.p_session_id);
  ok('KST midnight rotates the temporary session');
}
{
  const c = shared(), page = documentFor(c, { hidden: true }); await settle();
  assert.equal(stories(c).length, 0);
  page.document.hidden = false; page.dispatch('visibilitychange'); await settle();
  assert.equal(stories(c).length, 1);
  page.document.hidden = true; page.dispatch('visibilitychange'); await settle();
  assert.equal(stories(c).length, 1);
  ok('hidden article counts only when it first becomes visible');
}
for (const [label, options] of [
  ['webdriver', { webdriver: true }], ['crawler', { bot: true }],
  ['admin', { members: true, admin: true }], ['unresolved profile', { members: true, unresolved: true }],
  ['blocked session storage', { blocked: true }], ['embedded article', { embedded: true }],
  ['non-production host', { url: 'https://localhost/stories/cosmic-voids.html' }],
  ['missing publication marker', { id: null, url: 'https://orbithere.com/stories/unknown.html' }],
  ['marker/path mismatch', { id: 'cosmic-voids', url: 'https://orbithere.com/stories/another.html' }],
  ['invalid slug', { id: 'private@example.test' }], ['overlong slug', { id: 'a'.repeat(71) }],
  ['story list', { url: 'https://orbithere.com/stories.html' }]
]) {
  const c = shared(); documentFor(c, options); await settle();
  assert.equal(stories(c).length, 0, label); ok(label + ' sends no story observation');
}
{
  const c = shared(); c.local.setItem('orbit_analytics_exclude', '1');
  documentFor(c); await settle(); assert.equal(stories(c).length, 0);
  ok('explicit operator/QA exclusion is shared with the existing collector');
}
for (const mode of ['exclude', 'hidden', 'admin']) {
  const c = shared(), page = documentFor(c, { members: mode === 'admin' });
  if (mode === 'exclude') c.local.setItem('orbit_analytics_exclude', '1');
  if (mode === 'hidden') page.document.hidden = true;
  if (mode === 'admin') {
    page.window.OrbitMembers.state.profile.is_admin = true;
    page.dispatch('orbit:member');
  }
  await settle(); assert.equal(stories(c).length, 0);
  ok(mode + ' changing before the send microtask prevents the queued request');
}
{
  const c = shared(); documentFor(c, { members: true }); await settle();
  assert.equal(stories(c).length, 1);
  const sent = JSON.stringify(stories(c));
  for (const secret of ['private@example.test', 'PRIVATE_NICKNAME', '11111111-1111-4111-8111-111111111111']) assert.ok(!sent.includes(secret));
  ok('member observations do not expose account IDs or profile data');
}
for (const [label, options] of [['network failure', { fail: true }], ['unregistered server result', { unregistered: true }]]) {
  const c = shared(); const page = documentFor(c, options); await settle();
  assert.equal(stories(c).length, 1);
  assert.doesNotThrow(() => page.window.OrbitAnalytics.activate()); await settle();
  assert.equal(stories(c).length, 1);
  assert.equal(page.timers.size, 0);
  ok(label + ' stays silent, performs no retries and leaves page activation working');
}
{
  const c = shared(), page = documentFor(c, { hang: true }); await settle();
  assert.ok(page.timers.size > 0);
  for (const timer of [...page.timers.values()]) { assert.equal(timer.delay, 4000); timer.fn(); }
  await settle(); assert.equal(page.timers.size, 0);
  assert.ok(stories(c)[0].signal.aborted);
  assert.doesNotThrow(() => page.window.OrbitAnalytics.activate());
  ok('hanging collection aborts after four seconds without blocking the page');
}
{
  const c = shared(); documentFor(c); await settle();
  const state = JSON.parse(c.session.getItem(KEY)), originalId = state.id;
  state.seen = Array.from({ length: 128 }, (_, n) => 'fixture:' + n);
  c.session.setItem(KEY, JSON.stringify(state));
  documentFor(c, { id: 'why-stars-twinkle' }); await settle();
  assert.equal(stories(c).length, 1);
  assert.equal(JSON.parse(c.session.getItem(KEY)).seen.length, 128);
  documentFor(c); await settle();
  assert.equal(JSON.parse(c.session.getItem(KEY)).id, originalId);
  ok('bounded deduplication state cannot overflow and reset the session on refresh');
}
console.log(`Story views: ${checks} checks passed.`);
