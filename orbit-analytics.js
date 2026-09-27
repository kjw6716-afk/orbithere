// Minimal, best-effort funnel observations. See docs/funnel-measurement.md.
// No Auth account, durable visitor ID, content, URL, or user identifier is sent.
(function () {
  'use strict';
  var KEY = 'orbit_analytics_session_v1', EXCLUDE = 'orbit_analytics_exclude';
  var FEATURES = ['home','planets','calendar','board','guide','stories','story','news','about','policy','other'];
  var config = window.ORBIT_CONFIG || {}, embedded = parent !== window;
  var active = featureFor(location), context = location.pathname === '/main.html' ? 'embed' : 'direct';
  var state = null, booted = false, prepared = false, pending = [], memberResolved = !config.membersEnabled;
  var memberAllowed = memberResolved, readyFeatures = {}, currentAudience = 'guest', usedReferrer = false, memberSequence = 0;

  function safe(fn) { return function () { try { return fn.apply(null, arguments); } catch (_) { /* Never affect the product. */ } }; }
  function featureFor(url) {
    if (url.pathname === '/main.html') return url.hash === '#sky' ? 'calendar' : url.hash === '#lounge' ? 'board' : 'planets';
    if (/^\/stories\/[^/]+\.html$/.test(url.pathname)) return 'story';
    return ({'/':'home','/index.html':'home','/planets.html':'planets','/sky.html':'calendar','/lounge.html':'board',
      '/guide.html':'guide','/reading-sky.html':'guide','/stories.html':'stories','/news.html':'news',
      '/about.html':'about','/privacy.html':'policy','/terms.html':'policy'})[url.pathname] || 'other';
  }
  function pageFor(feature) {
    if (location.pathname === '/main.html') return 'main_' + (feature === 'board' ? 'board' : feature === 'calendar' ? 'calendar' : 'planets');
    var pages = {'/':'home','/index.html':'home','/planets.html':'planets','/sky.html':'calendar','/lounge.html':'board',
      '/guide.html':'guide','/reading-sky.html':'reading_sky','/stories.html':'stories','/news.html':'news',
      '/about.html':'about','/privacy.html':'policy','/terms.html':'terms'};
    if (pages[location.pathname]) return pages[location.pathname];
    var stories = ['are-shooting-stars-stars','cosmic-voids','how-gravity-assists-work','is-mars-all-red','iss-visible-at-dawn-and-dusk',
      'moon-face-and-phases','seasonal-constellations-camping','why-planets-go-retrograde','why-stars-twinkle','why-venus-is-hottest'];
    var match = /^\/stories\/([^/]+)\.html$/.exec(location.pathname);
    if (match) return stories.includes(match[1]) ? match[1] : 'story_other';
    return 'other';
  }
  function excluded() {
    if (!['orbithere.com','www.orbithere.com'].includes(location.hostname) || navigator.webdriver) return true;
    if (/bot|crawler|spider|headless|lighthouse|pagespeed|slurp|facebookexternalhit|preview/i.test(navigator.userAgent || '')) return true;
    try { if (localStorage.getItem(EXCLUDE) === '1') return true; } catch (_) { return true; }
    return false;
  }
  function source() {
    if (!document.referrer) return 'unattributed';
    try {
      var host = new URL(document.referrer).hostname.toLowerCase();
      if (['orbithere.com','www.orbithere.com'].includes(host)) return 'internal';
      if (/(^|\.)google\.(com|co\.kr|co\.jp|co\.uk|de|fr|ca|com\.au)$/.test(host)) return 'google';
      if (/(^|\.)naver\.com$/.test(host)) return 'naver';
      if (/(^|\.)(bing\.com|daum\.net|duckduckgo\.com|yahoo\.com|search\.yahoo\.co\.jp|baidu\.com|yandex\.(ru|com)|ecosia\.org|search\.brave\.com)$/.test(host)) return 'other_search';
      return 'external';
    } catch (_) { return 'unattributed'; }
  }
  function day(now) { return new Date(now + 9 * 3600000).toISOString().slice(0, 10); }
  function save() { sessionStorage.setItem(KEY, JSON.stringify(state)); }
  function discardWriteIntent() {
    if (state) { delete state.writeIntent; save(); return; }
    var saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (saved && saved.writeIntent) { delete saved.writeIntent; sessionStorage.setItem(KEY, JSON.stringify(saved)); }
  }
  function send(event, feature, detail, mode) {
    var key = event === 'write_start' ? event : event + ':' + feature + ':' + detail;
    // Preserve an authentication attempt after writing even if the same person
    // opened/attempted authentication earlier in this observation session.
    if (event === 'auth_open' || event === 'auth_attempt') key += state.seen.includes('write_start') ? ':post_write' : ':pre_write';
    if (state.seen.includes(key) || state.sequence >= 128) return;
    state.seen.push(key);
    state.sequence++;
    save(); // If storage is blocked, stop here instead of inventing new IDs per page.
    var payload = { session_id: state.id, event: event, feature: feature, detail: detail, context: mode, sequence: state.sequence, page_key: pageFor(feature), audience: state.audience };
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 4000);
    Promise.resolve().then(function () {
      if (excluded() || !memberAllowed) return;
      return fetch(config.url + '/rest/v1/rpc/record_funnel_event', {
        method: 'POST', headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_event: payload }), credentials: 'omit', referrerPolicy: 'no-referrer',
        keepalive: true, signal: controller.signal
      });
    }).catch(function () { /* No retries or user-facing error. */ }).finally(function () { clearTimeout(timer); });
  }
  function session(feature, mode) {
    var now = Date.now();
    if (!state) {
      try {
        var saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
        if (saved && /^[0-9a-f-]{36}$/i.test(saved.id) && Array.isArray(saved.seen) && saved.seen.length <= 128 &&
            saved.seen.every(function (key) { return typeof key === 'string' && key.length < 100; }) &&
            Number.isInteger(saved.sequence) && saved.sequence >= 0 && saved.sequence <= 128 &&
            Number.isFinite(saved.started) && Number.isFinite(saved.last) && FEATURES.includes(saved.feature) &&
            ['guest','member'].includes(saved.audience)) state = saved;
      } catch (_) { /* Bad or unavailable storage is handled by save(). */ }
    }
    if (!state || now < state.last || now - state.last >= 30 * 60000 || day(now) !== day(state.started)) {
      var writeIntent = state && state.writeIntent;
      state = { id: crypto.randomUUID(), started: now, last: now, sequence: 0, seen: [], feature: feature, audience: currentAudience };
      if (Number.isFinite(writeIntent) && now >= writeIntent && now - writeIntent < 60000) state.writeIntent = writeIntent;
      save();
      send('session_start', feature, usedReferrer ? 'unattributed' : source(), mode);
      usedReferrer = true;
      return true;
    }
    usedReferrer = true;
    return false;
  }
  function valid(event, feature, detail) {
    if (!FEATURES.includes(feature)) return false;
    if (event === 'feature_view') return detail === 'none';
    if (event === 'tool_ready') return ['planets','calendar'].includes(feature) && detail === 'none';
    if (event === 'tool_use') return feature === 'planets' ? ['time','region'].includes(detail) : feature === 'calendar' && detail === 'filter';
    if (event === 'write_start') return feature === 'board' && ['explicit','input'].includes(detail);
    if (event === 'auth_open') return ['login','signup'].includes(detail);
    if (event === 'auth_attempt') return ['email_login','email_signup','google'].includes(detail);
    return false;
  }
  function observe(event, feature, detail, mode) {
    if (excluded() || document.hidden || !valid(event, feature, detail)) return;
    if (event === 'tool_ready') readyFeatures[feature] = true;
    if (!booted || !memberResolved) {
      // Only enum intents, bounded in memory. Never store or retry a network queue.
      if (pending.length < 16 && !pending.some(function (p) { return p[0] === event && p[1] === feature && p[2] === detail; })) pending.push([event,feature,detail,mode]);
      return;
    }
    if (!memberAllowed || !config.url || !config.publishableKey) return;
    var fresh = session(feature, mode), previous = fresh ? 'landing' : state.feature;
    if (fresh || event === 'feature_view') {
      send('feature_view', feature, 'none', mode);
      if (feature === 'board' && previous !== 'board') send('board_enter', 'board', previous, mode);
      state.feature = feature;
    }
    if (fresh && readyFeatures[feature] && event !== 'tool_ready') send('tool_ready', feature, 'none', mode);
    if (event !== 'feature_view') send(event, feature, detail, mode);
    if (event === 'feature_view' && feature === 'board' && state.writeIntent) {
      var intent = state.writeIntent;
      delete state.writeIntent;
      var route = new URL(location.href);
      if (Number.isFinite(intent) && Date.now() >= intent && Date.now() - intent < 60000 && route.searchParams.has('write') && !route.searchParams.has('post'))
        send('write_start', 'board', 'explicit', mode);
    }
    if (event === 'feature_view' || event === 'tool_use' || event === 'write_start' || event === 'auth_attempt') state.last = Date.now();
    save();
  }
  function frameVisible(child, feature) {
    var ids = {planets:'planetFrame', calendar:'skyFrame', board:'loungeFrame'};
    var frame = document.getElementById(ids[feature]);
    return !!(frame && frame.contentWindow === child && frame.closest('.panel.on') && !document.hidden);
  }
  function submit(event, feature, detail) {
    if (!embedded) return observe(event, feature, detail, context);
    try {
      if (parent.location.origin === location.origin && parent.OrbitAnalytics) parent.OrbitAnalytics.fromFrame(window, event, feature, detail);
    } catch (_) { /* Unrelated embeds do not collect. */ }
  }
  function flush() {
    if (!booted || !memberResolved) return;
    var intents = pending; pending = [];
    if (!memberAllowed) return;
    intents.forEach(function (p) { observe.apply(null, p); });
  }
  function show() {
    if (document.hidden) return;
    submit('feature_view', active, 'none');
    if (prepared) submit('tool_ready', active, 'none');
    if (!embedded && location.pathname === '/main.html') {
      var frame = document.getElementById({planets:'planetFrame',calendar:'skyFrame',board:'loungeFrame'}[active]);
      if (frame && frame.contentWindow && frame.contentWindow.OrbitAnalytics) frame.contentWindow.OrbitAnalytics.activate();
    }
  }
  function readMember(member) {
    var unresolved = !member || member.error || (member.user && !member.user.is_anonymous && member.user.email_confirmed_at && !member.profile);
    if (unresolved) {
      pending = []; memberResolved = false; memberAllowed = false;
      discardWriteIntent();
      return;
    }
    memberResolved = true;
    currentAudience = member.user && !member.user.is_anonymous && member.user.email_confirmed_at ? 'member' : 'guest';
    memberAllowed = !(member.profile && member.profile.is_admin === true);
    if (!memberAllowed) { pending = []; discardWriteIntent(); }
    flush();
    if (booted && memberAllowed && !state) show();
  }
  window.OrbitAnalytics = {
    panel: safe(function (name) { active = {planets:'planets',sky:'calendar',lounge:'board'}[name] || 'planets'; context = 'embed'; if (booted) show(); }),
    ready: safe(function () { prepared = true; if (booted) submit('tool_ready', active, 'none'); }),
    use: safe(function (detail, event) { if (event && event.isTrusted) submit('tool_use', active, detail); }),
    write: safe(function (detail, event) { if (event && event.isTrusted) submit('write_start', 'board', detail); }),
    authOpen: safe(function (mode) { submit('auth_open', active, mode); }),
    authAttempt: safe(function (detail, event) { if (event && event.isTrusted) submit('auth_attempt', active, detail); }),
    activate: safe(show),
    fromFrame: safe(function (child, event, feature, detail) {
      if (embedded || !frameVisible(child, feature)) return;
      observe(event, feature, detail, 'embed');
    })
  };
  if (excluded()) return;
  if (!embedded) {
    document.addEventListener('click', safe(function (event) {
      if (!event.isTrusted || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || active === 'board' || !state || !memberAllowed) return;
      var link = event.target.closest('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      var destination = new URL(link.href, location.href);
      if (destination.origin !== location.origin || !destination.searchParams.has('write') || destination.searchParams.has('post')) return;
      if (destination.pathname !== '/lounge.html' && !(destination.pathname === '/main.html' && destination.hash === '#lounge')) return;
      // A one-minute enum intent connects a same-tab explicit CTA to arrival.
      // It contains no destination URL or text and is consumed only on the board.
      state.writeIntent = Date.now(); save();
    }));
    window.addEventListener('orbit:member', safe(function () {
      memberSequence++;
      readMember(window.OrbitMembers && window.OrbitMembers.state);
    }));
    // The deferred collector may load after the existing account lookup. Reuse
    // its resolved profile, or only read its current session to confirm a guest.
    // Never refresh attendance, construct another client, or create an account.
    var existing = window.OrbitMembers;
    if (config.membersEnabled && existing) {
      if (existing.state && (existing.state.profile || existing.state.error)) safe(readMember)(existing.state);
      else if (existing.sb && existing.sb.auth) {
        var version = memberSequence;
        Promise.resolve().then(function () { return existing.sb.auth.getSession(); }).then(safe(function (result) {
          if (version !== memberSequence || result.error) return;
          var user = result.data && result.data.session && result.data.session.user;
          if (user && !user.is_anonymous && user.email_confirmed_at) return;
          readMember({ user: null, profile: null, error: null });
        })).catch(function () { /* Missing identity coverage drops observations. */ });
      }
    }
  }
  // Activity extends an existing session but never creates one by itself.
  ['pointerdown','keydown','input'].forEach(function (name) {
    document.addEventListener(name, safe(function (event) {
      if (!event.isTrusted || document.hidden || excluded()) return;
      if (embedded) {
        if (parent.OrbitAnalytics) parent.OrbitAnalytics.activityFromFrame(window, active);
      } else if (state && memberAllowed && Date.now() - state.last < 30 * 60000 && day(Date.now()) === day(state.started)) { state.last = Date.now(); save(); }
    }), {passive:true});
  });
  window.OrbitAnalytics.activityFromFrame = safe(function (child, feature) {
    if (!frameVisible(child, feature) || !state || !memberAllowed) return;
    if (Date.now() - state.last < 30 * 60000 && day(Date.now()) === day(state.started)) { state.last = Date.now(); save(); }
  });
  document.addEventListener('visibilitychange', safe(function () { if (booted) show(); }));
  var boot = safe(function () {
    booted = true;
    prepared = document.documentElement.dataset.orbitToolReady === active && ['planets','calendar'].includes(active);
    show(); flush();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
