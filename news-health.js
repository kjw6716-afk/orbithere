// Shared by the operator dashboard and the scheduled recovery check.
(function (root) {
  'use strict';
  root.orbitNewsHealth = function (feed, now) {
    now = now === undefined ? Date.now() : now;
    var checked = Date.parse(feed && feed.checkedAt), sources = feed && feed.sources;
    var valid = Number.isFinite(checked) && checked <= now + 300000 && Array.isArray(sources) && sources.length > 0;
    var age = valid ? Math.max(0, now - checked) : Infinity;
    var failed = valid ? sources.filter(function (s) {
      var success = Date.parse(s && s.lastSuccessfulAt);
      return !s || s.status !== 'ok' || !Number.isFinite(success) || success > now + 300000 || now - success > 4 * 3600000;
    }).length : 0;
    return {valid:valid,ageHours:age / 3600000,stale:!valid || age > 4 * 3600000,
      failedSources:failed,totalSources:valid ? sources.length : 0,
      allFailed:valid && failed === sources.length,checkedAt:valid ? feed.checkedAt : null};
  };
})(typeof window === 'undefined' ? globalThis : window);
