(function () {
  'use strict';
  var params = new URLSearchParams(location.search), fragment = new URLSearchParams(location.hash.slice(1));
  var flow = params.get('flow') === 'google-withdraw' ? 'google-withdraw'
    : params.get('flow') === 'recovery' || fragment.get('type') === 'recovery' ? 'recovery'
    : params.get('mode') === 'signup' ? 'signup' : 'login';
  if (params.has('error') || fragment.has('error')) flow = 'oauth-error';
  var route = new URL('main.html#lounge', location.href);
  try {
    var saved = JSON.parse(sessionStorage.getItem('orbit_account_return'));
    var candidate = saved && new URL(saved.path, location.origin);
    if (candidate && candidate.origin === location.origin && ['/main.html','/lounge.html','/index.html'].includes(candidate.pathname)
      && Number.isFinite(saved.at) && saved.at <= Date.now() && Date.now() - saved.at < 60 * 60 * 1000) route = candidate;
  } catch (_) {}
  // Existing email and Google callbacks stay valid. Consume tokens here before returning to the page.
  window.OrbitMembers.refresh().then(function () {
    history.replaceState(null, '', location.pathname);
    route.searchParams.set('account', flow);
    location.replace(route.pathname + route.search + route.hash);
  }).catch(function () {
    document.querySelector('[role="status"]').textContent = '로그인을 확인하지 못했어요. 새로고침해 다시 시도해주세요.';
  });
})();
