// The real sky.html functions, with a fixed clock and a minimal DOM for render assertions.
// Run directly or import from astronomy.mjs; failures throw rather than exiting the parent suite.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../sky.html', import.meta.url), 'utf8');
const from = html.indexOf('var RAD = Math.PI / 180');
const to = html.indexOf('// 카드 펼치기');
assert(from >= 0 && to > from, 'sky calculation/render markers exist');
let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; };

function fixture() {
  let now = Date.parse('2026-12-14T23:01:00+09:00');
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const elements = new Map();
  const document = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', style: {} });
    return elements.get(id);
  } };
  let timerId = 0;
  const timers = new Map();
  const window = {};
  const scope = {};
  new Function('exports', 'document', 'window', 'Date', 'setInterval', 'clearInterval',
    html.slice(from, to) + `
      Object.assign(exports, { EVENTS, eventTiming, activeEvents, upcoming, calendarDays,
        ddayLabel, fmtDday, eventDateTime, eventRangeText, renderNext, renderTimeline,
        setFilter: function (filter) { curFilter = filter; },
        setEvents: function (events) { EVENTS = events; } });
    `)(scope, document, window, ClockDate,
      (callback) => { timers.set(++timerId, callback); return timerId; },
      (id) => timers.delete(id));
  return {
    ...scope, window, elements, timers,
    setTime(value) { now = typeof value === 'number' ? value : Date.parse(value); },
    tick() { for (const callback of [...timers.values()]) callback(); },
    el(id) { return document.getElementById(id); },
  };
}

console.log('\n[sky time boundaries] event periods, KST labels and live transitions');
const originalTZ = process.env.TZ;
try {
  for (const tz of ['Asia/Seoul', 'UTC', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
    process.env.TZ = tz;
    const f = fixture();
    const originalIds = f.EVENTS.map((event) => event.id).join(',');

    for (const event of f.EVENTS) {
      const start = Date.parse(event.watchStart);
      const end = Date.parse(event.watchEnd);
      check(Number.isFinite(start) && Number.isFinite(end) && end > start,
        `${tz} ${event.id}: valid explicit period`);
      check(event.watchStart.endsWith('+09:00') && event.watchEnd.endsWith('+09:00'),
        `${event.id}: dates carry their KST offset`);
      for (const [at, status] of [
        [start - 1, 'scheduled'], [start, 'ongoing'], [start + 1, 'ongoing'],
        [end - 1, 'ongoing'], [end, 'ended'], [end + 1, 'ended'],
      ]) {
        const timing = f.eventTiming(event, at);
        check(timing.status === status, `${tz} ${event.id} ${at}: ${status}`);
        const found = f.activeEvents([event], at, 'all').length === 1;
        check(found === (status !== 'ended'), `${event.id}: retained until end`);
        check(timing.target === (status === 'scheduled' ? start : end),
          `${event.id}: countdown targets ${status === 'scheduled' ? 'start' : 'end'}`);
        check(timing.remaining === Math.max(0, timing.target - at), `${event.id}: remaining time`);
        if (status === 'ongoing') check(timing.label === '진행 중', `${event.id}: ongoing label`);
        if (status === 'ended') check(timing.label === '종료', `${event.id}: ended label`);
      }
      if (event.peakAt !== null) {
        const peak = Date.parse(event.peakAt);
        check(Number.isFinite(peak) && peak >= start && peak < end, `${event.id}: peak within period`);
        for (const at of [peak - 1, peak, peak + 1]) {
          check(f.eventTiming(event, at).status === (at < start ? 'scheduled' : 'ongoing'),
            `${event.id}: peak never ends event`);
          check(f.activeEvents([event], at, 'all').length === 1, `${event.id}: retained at peak`);
        }
      }
      if (!event.kr) {
        check(f.activeEvents([event], start, 'kr').length === 0, `${event.id}: excluded by KR filter`);
        check(f.activeEvents([event], start, 'eclipse').length === 1, `${event.id}: retained by type filter`);
      }
    }
    check(f.EVENTS.map((event) => event.id).join(',') === originalIds, 'sorting does not mutate EVENTS');

    const gem = f.EVENTS.find((event) => event.id === 'geminids2026');
    const start = Date.parse(gem.watchStart);
    const end = Date.parse(gem.watchEnd);
    check(start === Date.parse('2026-12-14T23:00:00+09:00'), 'Geminids start retained');
    check(end === Date.parse('2026-12-15T06:00:00+09:00'), 'Geminids ends in the next dawn');
    const ongoing = Date.parse('2026-12-14T23:01:00+09:00');
    check(f.upcoming(ongoing)[0].e.id === gem.id, 'regression: Geminids remains next at 23:01');
    check(f.eventTiming(gem, ongoing).status === 'ongoing', 'regression: Geminids is ongoing at 23:01');
    check(f.eventTiming(gem, Date.parse('2026-12-15T00:01:00+09:00')).label === '진행 중',
      'crossing midnight never reverts to a misleading D-DAY');
    check(f.eventRangeText(gem) === '안내 기간 2026.12.14 23:00 ~ 2026.12.15 06:00 KST',
      `${tz}: full range dates are explicit and timezone independent`);
    check(f.ddayLabel(start, Date.parse('2026-12-13T23:59:00+09:00')) === 'D-1', 'KST D-1');
    check(f.ddayLabel(start, Date.parse('2026-12-14T00:00:00+09:00')) === 'D-DAY', 'KST D-DAY');
    check(f.calendarDays(Date.parse('2027-01-01T02:00:00+09:00'), Date.parse('2026-12-31T23:59:00+09:00')) === 1,
      'KST year boundary uses calendar dates');

    const perseids = f.EVENTS.find((event) => event.id === 'perseids2026');
    for (const when of ['2026-08-12T23:01:00+09:00', '2026-08-13T12:01:00+09:00', '2026-08-14T04:59:59+09:00']) {
      check(f.eventTiming(perseids, Date.parse(when)).status === 'ongoing', 'two-night period persists through peak and second dawn');
    }
    check(f.eventRangeText(perseids).includes('2026.08.14 05:00'), 'multi-night end is visible');
    check(html.includes('여러 밤에 걸친 유성우는 낮에도 기간이 진행 중'), 'multi-night daytime does not promise current visibility');
    check(html.includes('달빛 조건 최상') && html.includes('달 밝기만'), 'rating explicitly covers moonlight only');

    // Use the real rendering functions and ticker at both exact boundaries.
    f.setEvents([gem]);
    f.setTime(start - 1);
    f.renderNext(); f.renderTimeline();
    check(f.el('nxDday').textContent === 'D-DAY', 'scheduled hero displays KST D-day');
    check(f.el('nxDdaySub').textContent === '시작까지', 'scheduled countdown is to start');
    check(f.el('timeline').innerHTML.includes('>예정</span>'), 'timeline says scheduled');
    f.setTime(start); f.tick();
    check(f.el('nxDday').textContent === '진행 중', 'ticker transitions at exact start');
    check(f.el('timeline').innerHTML.includes('class="ev-dday">진행 중'), 'timeline transitions at exact start');
    check(f.el('nxDdaySub').textContent === '안내 기간 종료까지', 'ongoing countdown targets end');
    check(f.timers.size === 1, 'one timer after transition');
    f.setTime(ongoing); f.tick();
    check(f.el('nxName').textContent === gem.name, '23:01 hero retains Geminids');
    check([...f.el('nxUnits').innerHTML.matchAll(/<b>(\d+)<\/b>/g)].map((x) => +x[1]).join(',') === '0,6,59,0',
      '23:01 countdown has 6h 59m until end');
    f.setTime(end - 1); f.tick();
    check(f.el('nxName').textContent === gem.name, 'last millisecond retains event');
    f.setTime(end); f.tick();
    check(f.el('nxName').textContent === '다음 일정을 준비하고 있습니다', 'fallback at exact end');
    check(f.el('nxUnits').innerHTML === '' && f.el('nxRange').textContent === '', 'fallback clears countdown and date range');
    check(f.el('nxDday').textContent === '—' && f.window.__nxTimer === null && f.timers.size === 0, 'fallback clears D-day and stops timer');
    check(!f.el('timeline').innerHTML.includes('data-id='), 'ended event leaves timeline');
    f.setTime(end + 1); f.renderNext();
    check(f.el('nxName').textContent === '다음 일정을 준비하고 있습니다', 'fallback persists after end');

    // A later event can start/end while the earlier ongoing event stays on the hero.
    const nested = { ...gem, id: 'nested', name: '중첩 일정',
      watchStart: '2026-12-15T00:00:00+09:00', watchEnd: '2026-12-15T01:00:00+09:00' };
    f.setEvents([gem, nested]);
    f.setTime('2026-12-14T23:59:59+09:00'); f.renderNext(); f.renderTimeline();
    f.setTime('2026-12-15T00:00:00+09:00'); f.tick();
    check((f.el('timeline').innerHTML.match(/class="ev-dday">진행 중/g) || []).length === 2,
      'non-featured event starts without waiting for KST midnight or hero replacement');
    f.setTime('2026-12-15T01:00:00+09:00'); f.tick();
    check(!f.el('timeline').innerHTML.includes('data-id="nested"'), 'non-featured event disappears at its end');
    check(f.el('nxName').textContent === gem.name, 'earlier ongoing event stays featured');

    const last = f.EVENTS[f.EVENTS.length - 1];
    f.setEvents(f.EVENTS);
    f.setTime(Date.parse(last.watchEnd) + 1); f.renderNext(); f.renderTimeline();
    check(f.upcoming(Date.parse(last.watchEnd)).length === 0, 'all real registered events end at final boundary');
    check(f.el('nxAlt').innerHTML.includes('오늘 밤 행성 보기'), 'last real event fallback links to computed planets');
  }
} finally {
  if (originalTZ === undefined) delete process.env.TZ; else process.env.TZ = originalTZ;
}
console.log(`Sky time boundaries: ${checks} checks passed`);
