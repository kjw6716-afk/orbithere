// 고정 KST 시각에서 밤의 선택·실제 지금·앞으로의 추천을 함께 검사한다.
// 브라우저와 시스템 시계에 의존하지 않으며 astronomy.mjs에서도 실행한다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../planets.html', import.meta.url), 'utf8');
const from = src.indexOf('var RAD = Math.PI / 180');
const to = src.indexOf('// ---------- 하늘 지도 ----------');
assert.ok(from >= 0 && to > from, '행성 계산부 표식');
const scope = {};
new Function('exports', src.slice(from, to) + `
  Object.assign(exports, {
    PLACES, PLANETS, MIN_ALT, state, kstMs, kstParts, fmtDate, fmtTimeRel,
    solarAltitude, solarCrossing, observationWindow, nextRefreshAt, sampleAt,
    buildSamples, nightRange, bestViewIdx, summarize, sunCross
  });
`)(scope);
const {
  PLACES, PLANETS, MIN_ALT, state, kstMs, kstParts, fmtDate, fmtTimeRel,
  solarAltitude, solarCrossing, observationWindow, nextRefreshAt, sampleAt,
  buildSamples, nightRange, bestViewIdx, summarize, sunCross
} = scope;
const HOUR = 3600000, DAY = 24 * HOUR;
let checked = 0;

function checkFixture(place, label, now, expectedStart, ongoing) {
  const context = `${place.ko} ${label} ${new Date(now).toISOString()}`;
  state.place = place;
  buildSamples(now);
  assert.equal(state.window.start, expectedStart, context + ': 밤의 기준 날짜');
  assert.equal(state.window.end, expectedStart + DAY, context + ': 다음 날까지 24시간');
  assert.equal(state.window.ongoing, ongoing, context + ': 현재 밤 여부');
  assert.equal(state.nightLabel, ongoing ? '현재 밤' : '오늘 밤', context + ': 밤 문구');
  assert.equal(state.baseDay, kstParts(expectedStart).d, context + ': 날짜 표시 기준');
  assert.equal(state.current.ms, now, context + ': 실제 현재 시각');
  assert.equal(state.samples.length, 289, context + ': 표본 수 유지');
  assert.deepEqual(state.current, sampleAt(now, place), context + ': 실제 시각의 위치·밝기');
  for (let i = 1; i < state.samples.length; i++) {
    assert.ok(state.samples[i - 1].ms < state.samples[i].ms, context + ': 표본 시간순');
  }
  if (now < expectedStart) {
    assert.equal(state.nowIdx, -1, context + ': 미래 정오를 지금으로 표시하지 않음');
  } else {
    assert.ok(state.nowIdx >= 0, context + ': 지금 표본 존재');
    assert.equal(state.samples[state.nowIdx].ms, now, context + ': 지금은 반올림 시각이 아님');
  }
  const nr = nightRange();
  assert.ok(nr.a < nr.b, context + ': 하나의 밤 구간');
  const candidates = state.samples.slice(nr.a, nr.b + 1).filter(s => s.ms >= now);
  const best = bestViewIdx(nr);
  if (candidates.length) {
    assert.ok(best >= nr.a && best <= nr.b, context + ': 추천은 밤 구간 안');
    assert.ok(state.samples[best].ms >= now, context + ': 지난 시각을 추천하지 않음');
    assert.ok(state.samples[best].sunAlt < -6, context + ': 기존 민간박명 기준 유지');
  } else {
    assert.equal(best, -1, context + ': 남은 어두운 시간이 없으면 추천 없음');
    assert.ok(ongoing, context + ': 일출 전 박명은 현재 밤 유지');
  }
  // renderAll이 쓰는 기본 시각도 일출 직전(-6° 이후)까지 유효해야 한다.
  const displayed = ongoing ? state.nowIdx : best;
  assert.ok(displayed >= 0 && displayed < state.samples.length, context + ': 기본 화면 표본 유효');
  assert.ok(state.samples[displayed].ms >= now, context + ': 기본 화면에 과거 추천 없음');
  assert.equal(sunCross(true), state.window.sunset, context + ': 화면 일몰과 밤의 일몰 일치');
  assert.equal(sunCross(false), state.window.sunrise, context + ': 화면 일출과 밤의 일출 일치');
  for (const planet of PLANETS) {
    const result = summarize(planet.key);
    assert.equal(result.visibleNow, ongoing && state.current.sunAlt < -6 && state.current.b[planet.key].alt > MIN_ALT,
      context + `: ${planet.ko} 지금 보임은 실제 시각 기준`);
    for (const key of ['bestMs', 'firstMs', 'lastMs']) {
      if (result[key]) assert.ok(result[key] >= now, context + `: ${planet.ko} ${key}가 과거가 아님`);
    }
    if (result.firstMs) assert.ok(result.firstMs <= result.lastMs, context + `: ${planet.ko} 관측 구간 순서`);
    assert.ok(Number.isFinite(result.mag) && Number.isFinite(result.nowAlt) && Number.isFinite(result.nowAz),
      context + `: ${planet.ko} 수치 유효`);
  }
  checked++;
}

console.log('\n[시간 경계] 행성 — 8개 도시 · 일출/일몰 · 월말/연말');
// 하지(도시별 일출 차이가 큼), 재현일, 월말, 연말. 날짜는 월을 1부터 표기한다.
for (const place of PLACES) {
  for (const [year, month, day] of [[2026, 6, 21], [2026, 9, 26], [2026, 1, 31], [2026, 12, 31]]) {
    const noon = kstMs(year, month - 1, day, 12);
    const sunset = solarCrossing(noon, noon + 12 * HOUR, place, true);
    const sunrise = solarCrossing(noon + 12 * HOUR, noon + DAY, place, false);
    assert.ok(sunset !== null && sunrise !== null, `${place.ko}: 일몰·일출 존재`);
    assert.ok(solarAltitude(sunset - 1, place) > -0.833 && solarAltitude(sunset, place) <= -0.833,
      `${place.ko}: 기존 태양식의 일몰 교차`);
    assert.ok(solarAltitude(sunrise - 1, place) < -0.833 && solarAltitude(sunrise, place) >= -0.833,
      `${place.ko}: 기존 태양식의 일출 교차`);
    for (const boundary of [sunset, sunrise, noon + 12 * HOUR]) {
      const before = boundary - 1;
      assert.equal(nextRefreshAt(before, observationWindow(before, place)), boundary,
        `${place.ko}: 일출·일몰·KST 자정에 5분을 기다리지 않고 갱신`);
      assert.ok(nextRefreshAt(boundary, observationWindow(boundary, place)) > boundary,
        `${place.ko}: 정확한 경계에서 타이머가 무한 반복하지 않음`);
    }
    const fixtures = [
      ['일몰 1ms 전', sunset - 1, noon, false],
      ['일몰 정확히', sunset, noon, true],
      ['일몰 1ms 후', sunset + 1, noon, true],
      ['23:59', noon + 11 * HOUR + 59 * 60000, noon, true],
      ['다음 날 00:01', noon + 12 * HOUR + 60000, noon, true],
      ['다음 날 02:00', noon + 14 * HOUR, noon, true],
      ['일출 1ms 전', sunrise - 1, noon, true],
      ['일출 정확히', sunrise, noon + DAY, false],
      ['일출 1ms 후', sunrise + 1, noon + DAY, false],
      ['오전 10:00', noon - 2 * HOUR, noon, false],
      ['다음 날 오전 10:00', noon + 22 * HOUR, noon + DAY, false],
      ['다음 날 11:59', noon + 23 * HOUR + 59 * 60000, noon + DAY, false],
      ['다음 날 12:00', noon + DAY, noon + DAY, false],
      ['다음 날 오후 15:00', noon + 27 * HOUR, noon + DAY, false]
    ];
    for (const [label, now, expectedStart, ongoing] of fixtures) {
      checkFixture(place, label, now, expectedStart, ongoing);
    }
  }
}
assert.equal(PLACES.length, 8, '기존 8개 관측지 모두 검사');
console.log(`  ✓ ${checked}개 고정 시각: 선택 날짜·지금·앞으로의 추천·카드 요약 일치`);

// 기존 재현을 별도로 명시한다. 단순히 05:05라는 문자열을 금지하면 다음 날
// 05:05처럼 올바른 추천까지 막으므로 반드시 날짜를 포함한 시각으로 비교한다.
const seoul = PLACES.find(p => p.id === 'seoul');
state.place = seoul;
const regressionNow = kstMs(2026, 8, 26, 10);
buildSamples(regressionNow);
const bestMs = state.samples[bestViewIdx(nightRange())].ms;
assert.equal(state.window.start, kstMs(2026, 8, 26, 12));
assert.ok(bestMs > regressionNow && bestMs >= state.window.sunset);
assert.notEqual(bestMs, kstMs(2026, 8, 26, 5, 5));
assert.equal(state.nowIdx, -1);
assert.equal(fmtDate(state.window.start), '2026년 9월 26일');
assert.equal(fmtDate(state.window.end), '2026년 9월 27일');
console.log('  ✓ 서울 2026-09-26 10:00: 지난 9월 26일 05:05 추천 제거');

for (const [year, month, day, expectedDate] of [
  [2026, 1, 31, '2026년 2월 1일'], [2026, 12, 31, '2027년 1월 1일']
]) {
  const noon = kstMs(year, month - 1, day, 12);
  const nextDawn = noon + 14 * HOUR;
  assert.equal(fmtDate(nextDawn), expectedDate);
  assert.equal(fmtTimeRel(nextDawn, day), '익일 02:00');
  assert.equal(observationWindow(nextDawn, seoul).start, noon);
}
// 같은 UTC 순간에도 두 도시가 일출의 서로 다른 쪽에 있으면 밤 선택이 다르다.
const summerNoon = kstMs(2026, 5, 21, 12);
const rises = PLACES.map(place => ({ place, rise: solarCrossing(summerNoon - 12 * HOUR, summerNoon, place, false) }))
  .sort((a, b) => a.rise - b.rise);
assert.ok(rises.at(-1).rise - rises[0].rise > 20 * 60000, '도시별 일출 차이 20분 이상인 fixture');
const betweenRises = Math.floor((rises[0].rise + rises.at(-1).rise) / 2);
assert.equal(observationWindow(betweenRises, rises[0].place).start, summerNoon);
assert.equal(observationWindow(betweenRises, rises.at(-1).place).start, summerNoon - DAY);
console.log('  ✓ 월말·연말 날짜 표기 및 같은 순간 도시별 일출 차이 유지');

// Node도 TZ 변경에 맞춰 Date의 로컬 접근자를 바꾼다. 실제 로컬 시간 차이를
// 먼저 확인하고 KST 계산 결과 전체가 변하지 않는지 비교한다.
const originalTZ = process.env.TZ;
const zones = ['Asia/Seoul', 'UTC', 'America/Los_Angeles', 'Pacific/Honolulu'];
const zoneSnapshots = [], localHours = new Set();
try {
  for (const zone of zones) {
    process.env.TZ = zone;
    localHours.add(new Date(regressionNow).getHours());
    const snapshots = [];
    for (const place of [seoul, PLACES.find(p => p.id === 'jeju'), PLACES.find(p => p.id === 'gangneung')]) {
      state.place = place;
      for (const now of [regressionNow, kstMs(2026, 8, 27, 2), kstMs(2027, 0, 1, 0, 1)]) {
        buildSamples(now);
        snapshots.push({ window: state.window, baseDay: state.baseDay, label: state.nightLabel,
          nowIdx: state.nowIdx, now: state.current, best: bestViewIdx(nightRange()),
          summaries: PLANETS.map(p => summarize(p.key)),
          date: fmtDate(state.window.start), dawn: fmtTimeRel(state.window.sunrise, state.baseDay) });
      }
    }
    zoneSnapshots.push(snapshots);
  }
  assert.ok(localHours.size >= 3, '서로 다른 기기 timezone이 실제 적용됨');
  for (let i = 1; i < zoneSnapshots.length; i++) {
    assert.deepEqual(zoneSnapshots[i], zoneSnapshots[0], `${zones[i]}에서도 KST 결과 동일`);
  }
} finally {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
}
console.log('  ✓ 기기 timezone 4개: 날짜·일출/일몰·위치·밝기·추천 결과 동일');
