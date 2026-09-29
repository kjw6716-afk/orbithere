// Shared by reader surfaces, the operator dashboard and scheduled recovery.
(function (root) {
  'use strict';
  var staleAfterHours = 2, maxAge = staleAfterHours * 3600000;
  function sourceStale(source, now) {
    now = now === undefined ? Date.now() : now;
    var success = Date.parse(source && source.lastSuccessfulAt);
    return !source || source.status !== 'ok' || !Number.isFinite(success) ||
      success > now + 300000 || now - success > maxAge;
  }
  root.orbitNewsHealth = function (feed, now) {
    now = now === undefined ? Date.now() : now;
    var checked = Date.parse(feed && feed.checkedAt), sources = feed && feed.sources;
    var valid = Number.isFinite(checked) && checked <= now + 300000 && Array.isArray(sources) && sources.length > 0;
    var age = valid ? Math.max(0, now - checked) : Infinity;
    var failed = valid ? sources.filter(function (s) { return sourceStale(s, now); }).length : 0;
    return {valid:valid,ageHours:age / 3600000,stale:!valid || age > maxAge,
      failedSources:failed,totalSources:valid ? sources.length : 0,
      allFailed:valid && failed === sources.length,checkedAt:valid ? feed.checkedAt : null};
  };
  root.orbitNewsHealth.staleAfterHours = staleAfterHours;
  root.orbitNewsHealth.sourceStale = sourceStale;
})(typeof window === 'undefined' ? globalThis : window);
