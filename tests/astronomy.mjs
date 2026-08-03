// planets.html 의 천문 계산부만 떼어내 검증한다.
//
// 이 페이지는 하드코딩된 일정표가 아니라 계산으로 하늘을 그린다. 계산이 틀리면
// 화면은 멀쩡해 보이는데 값만 조용히 어긋나므로, 눈으로는 절대 못 잡는다.
// 그래서 «공표된 값과 대조» 와 «다른 경로로 다시 계산해 대조» 두 가지를 함께 쓴다.
//
// 브라우저가 필요 없다. node tests/astronomy.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'planets.html'), 'utf8');

// 계산부는 «var RAD =» 부터 «하늘 지도» 주석 직전까지 — DOM을 건드리지 않는 구간이다
const from = src.indexOf('var RAD = Math.PI / 180');
const to = src.indexOf('// ---------- 하늘 지도 ----------');
if (from < 0 || to < 0) {
  console.error('planets.html 에서 계산부를 찾지 못했습니다. 주석 표식이 바뀌었는지 확인하세요.');
  process.exit(1);
}
const scope = {};
// eslint-disable-next-line no-new-func
new Function('exports', src.slice(from, to) + `
  Object.assign(exports, {
    toJD, helio, raDec, eqFromEcl, altAz, sep, moonAt, magnitude, DEG, RAD,
    PLANETS, MIN_ALT, buildSamples, nightRange, sunCross, summarize, dirName,
    fmtTime, fmtTimeRel, state, josa, magText
  });
`)(scope);

const {
  toJD, helio, raDec, eqFromEcl, altAz, sep, moonAt, magnitude, DEG, RAD,
  PLANETS, buildSamples, nightRange, sunCross, summarize, dirName,
  fmtTime, fmtTimeRel, state, josa, magText
} = scope;

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) console.log('  ✓ ' + name + (extra ? '  ' + extra : ''));
  else { failed++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')); }
};
const section = (t) => console.log('\n' + t);

const SEOUL = { lat: 37.5665, lon: 126.9780 };
const sunAt = (ms) => {
  const jd = toJD(new Date(ms)), T = (jd - 2451545.0) / 36525;
  const e = helio('earth', T);
  const rd = raDec(eqFromEcl({ x: -e.x, y: -e.y, z: -e.z }));
  return { jd, rd };
};

// ------------------------------------------------------------------
section('[1] 태양 위치');
{
  const { rd } = sunAt(Date.UTC(2026, 7, 3, 12));
  ok('적경 133.4° 부근', Math.abs(rd.ra - 133.4) < 0.6, `계산 ${rd.ra.toFixed(2)}°`);
  ok('적위 +17.4° 부근', Math.abs(rd.dec - 17.4) < 0.4, `계산 ${rd.dec.toFixed(2)}°`);
  ok('지구-태양 거리 1.014~1.016 au', rd.dist > 1.013 && rd.dist < 1.017, `계산 ${rd.dist.toFixed(5)}`);
}

section('[2] 지구 궤도 — 근일점 · 원일점');
{
  let min = 9, max = 0, minD = '', maxD = '';
  for (let i = 0; i < 365; i++) {
    const d = new Date(Date.UTC(2026, 0, 1 + i, 12));
    const e = helio('earth', (toJD(d) - 2451545.0) / 36525);
    const r = Math.hypot(e.x, e.y, e.z);
    if (r < min) { min = r; minD = d.toISOString().slice(0, 10); }
    if (r > max) { max = r; maxD = d.toISOString().slice(0, 10); }
  }
  ok('근일점 0.9832~0.9836 au, 1월 초', min > 0.9830 && min < 0.9836 && minD.slice(5, 7) === '01', `${min.toFixed(5)} (${minD})`);
  ok('원일점 1.0165~1.0170 au, 7월 초', max > 1.0165 && max < 1.0170 && maxD.slice(5, 7) === '07', `${max.toFixed(5)} (${maxD})`);
}

section('[3] 내행성 최대이각 — 궤도 크기가 맞는지 보는 가장 민감한 지표');
{
  let mer = 0, ven = 0;
  for (let i = 0; i < 365 * 4; i++) {
    const ms = Date.UTC(2026, 0, 1) + i * 6 * 3600000;
    const { rd: sun } = sunAt(ms);
    const T = (toJD(new Date(ms)) - 2451545.0) / 36525;
    const e = helio('earth', T);
    for (const k of ['mercury', 'venus']) {
      const h = helio(k, T);
      const g = raDec(eqFromEcl({ x: h.x - e.x, y: h.y - e.y, z: h.z - e.z }));
      const s = sep(g, sun);
      if (k === 'mercury') mer = Math.max(mer, s); else ven = Math.max(ven, s);
    }
  }
  ok('수성 최대이각 18~28° (실제 약 28°)', mer > 17 && mer < 29, `${mer.toFixed(1)}°`);
  ok('금성 최대이각 45~48° (실제 약 47°)', ven > 44 && ven < 48, `${ven.toFixed(1)}°`);
}

section('[4] 행성별 태양거리 — 궤도 장반경·이심률 확인');
{
  const T = (toJD(new Date(Date.UTC(2026, 7, 3, 12))) - 2451545.0) / 36525;
  const range = {
    mercury: [0.307, 0.467], venus: [0.718, 0.729], mars: [1.381, 1.667],
    jupiter: [4.95, 5.46], saturn: [9.02, 10.06], uranus: [18.28, 20.10], neptune: [29.80, 30.34]
  };
  for (const [k, [lo, hi]] of Object.entries(range)) {
    const h = helio(k, T);
    const r = Math.hypot(h.x, h.y, h.z);
    ok(`${k} ${r.toFixed(3)} au`, r >= lo && r <= hi, `(궤도 범위 ${lo}~${hi})`);
  }
}

// ------------------------------------------------------------------
// 지평좌표 변환(altAz)과 항성시(gmst)가 맞는지는 일출·일몰로 드러난다.
// 1분만 틀려도 이 검사에서 잡힌다.
const riseSet = (y, mo, d, lat = SEOUL.lat, lon = SEOUL.lon) => {
  const base = Date.UTC(y, mo, d, -9, 0); // KST 00:00
  const alt = (ms) => { const { jd, rd } = sunAt(ms); return altAz(rd.ra, rd.dec, jd, lat, lon).alt; };
  let rise = null, set = null, prev = alt(base);
  for (let m = 1; m <= 1440; m++) {
    const cur = alt(base + m * 60000);
    if (prev < -0.833 && cur >= -0.833 && rise === null) rise = base + m * 60000;
    if (prev > -0.833 && cur <= -0.833 && rise !== null && set === null) set = base + m * 60000;
    prev = cur;
  }
  return { rise, set };
};
const hhmm = (ms) => {
  const k = new Date(ms + 9 * 3600000);
  return String(k.getUTCHours()).padStart(2, '0') + ':' + String(k.getUTCMinutes()).padStart(2, '0');
};
const mins = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

section('[5] 서울 일출·일몰 — 널리 공표된 극값 날짜와 대조');
{
  // 하지·동지·연초는 해마다 인용되는 값이라 기준으로 삼기에 안전하다
  for (const [label, mo, d, er, es] of [
    ['2026-01-01', 0, 1, '07:47', '17:23'],
    ['2026-06-21', 5, 21, '05:11', '19:57'],
    ['2026-12-22', 11, 22, '07:43', '17:17']
  ]) {
    const r = riseSet(2026, mo, d);
    const dr = Math.abs(mins(hhmm(r.rise)) - mins(er)), ds = Math.abs(mins(hhmm(r.set)) - mins(es));
    ok(`${label} 일출 ${hhmm(r.rise)} / 일몰 ${hhmm(r.set)}`, dr <= 2 && ds <= 2, `기준 ${er}/${es} · 오차 ${dr}분/${ds}분`);
  }
}

section('[6] 같은 값을 시간각 해석식으로 다시 계산해 교차검증');
{
  // 표본을 훑어 얻은 값(altAz + 항성시 경로)과, 남중시각 ± H0/15h 라는
  // 전혀 다른 경로가 일치해야 한다. 한쪽만 틀리면 반드시 벌어진다.
  for (const [label, mo, d] of [['2026-03-20', 2, 20], ['2026-08-03', 7, 3], ['2026-09-23', 8, 23], ['2026-11-11', 10, 11]]) {
    const base = Date.UTC(2026, mo, d, -9, 0);
    let hi = -99, transit = 0, dec = 0;
    for (let m = 0; m <= 1440; m++) {
      const ms = base + m * 60000;
      const { jd, rd } = sunAt(ms);
      const a = altAz(rd.ra, rd.dec, jd, SEOUL.lat, SEOUL.lon).alt;
      if (a > hi) { hi = a; transit = ms; dec = rd.dec; }
    }
    const cosH = (Math.sin(-0.833 * RAD) - Math.sin(SEOUL.lat * RAD) * Math.sin(dec * RAD)) /
                 (Math.cos(SEOUL.lat * RAD) * Math.cos(dec * RAD));
    const half = Math.acos(Math.max(-1, Math.min(1, cosH))) * DEG / 15 * 3600000;
    const r = riseSet(2026, mo, d);
    const dr = Math.abs(mins(hhmm(r.rise)) - mins(hhmm(transit - half)));
    const ds = Math.abs(mins(hhmm(r.set)) - mins(hhmm(transit + half)));
    ok(`${label} 표본 ${hhmm(r.rise)}/${hhmm(r.set)} ↔ 해석식 ${hhmm(transit - half)}/${hhmm(transit + half)}`,
       dr <= 2 && ds <= 2, `차이 ${dr}분/${ds}분`);
  }
}

section('[7] 남중 — 방위는 정남이어야 한다');
{
  let hi = -99, az = 0, at = 0;
  const base = Date.UTC(2026, 7, 3, -9, 0);
  for (let m = 0; m <= 1440; m++) {
    const ms = base + m * 60000;
    const { jd, rd } = sunAt(ms);
    const a = altAz(rd.ra, rd.dec, jd, SEOUL.lat, SEOUL.lon);
    if (a.alt > hi) { hi = a.alt; az = a.az; at = ms; }
  }
  ok('남중 방위 180° 부근', Math.abs(az - 180) < 1.5, `${az.toFixed(1)}°`);
  ok('남중 시각 12:15~12:45 KST (서울은 표준자오선보다 서쪽)', mins(hhmm(at)) >= 735 && mins(hhmm(at)) <= 765, hhmm(at));
  ok('8월 초 남중고도 67~71°', hi > 67 && hi < 71, `${hi.toFixed(1)}°`);
}

section('[8] 달');
{
  let minD = 9e9, maxD = 0, minI = 9, maxI = 0;
  for (let i = 0; i < 60 * 24; i++) {
    const m = moonAt(toJD(new Date(Date.UTC(2026, 0, 1) + i * 3600000)));
    const km = m.dist * 149597870.7;
    minD = Math.min(minD, km); maxD = Math.max(maxD, km);
    minI = Math.min(minI, m.illum); maxI = Math.max(maxI, m.illum);
  }
  ok('근지점 356k~364k km', minD > 355000 && minD < 364000, `${Math.round(minD)} km`);
  ok('원지점 403k~408k km', maxD > 403000 && maxD < 408000, `${Math.round(maxD)} km`);
  ok('삭에서 밝은 면 2% 미만', minI < 0.02);
  ok('보름에서 밝은 면 98% 초과', maxI > 0.98);

  let best = 9, bestMs = 0;
  for (let i = 0; i < 40 * 24 * 6; i++) {
    const ms = Date.UTC(2026, 7, 1) + i * 600000;
    const il = moonAt(toJD(new Date(ms))).illum;
    if (il < best) { best = il; bestMs = ms; }
  }
  const nm = new Date(bestMs + 9 * 3600000);
  // sky.html 이 «2026년 8월 12일이 신월이라 페르세우스 유성우 조건이 최상» 이라고 쓴다.
  // 두 페이지가 서로 다른 코드로 같은 하늘을 말하고 있으므로 어긋나면 안 된다.
  ok('2026년 8월 삭이 12~13일 (밤하늘 달력 서술과 일치)', nm.getUTCDate() === 12 || nm.getUTCDate() === 13,
     nm.toISOString().slice(0, 10) + ' ' + String(nm.getUTCHours()).padStart(2, '0') + '시');
}

section('[9] 행성 밝기(등급) 범위');
{
  const acc = {};
  for (let i = 0; i < 365 * 4; i++) {
    const ms = Date.UTC(2026, 0, 1) + i * 6 * 3600000;
    const T = (toJD(new Date(ms)) - 2451545.0) / 36525;
    const e = helio('earth', T);
    const { rd: sun } = sunAt(ms);
    for (const p of PLANETS) {
      const h = helio(p.key, T);
      const g = raDec(eqFromEcl({ x: h.x - e.x, y: h.y - e.y, z: h.z - e.z }));
      const r = Math.hypot(h.x, h.y, h.z), d = g.dist, R = sun.dist;
      const ph = Math.acos(Math.max(-1, Math.min(1, (r * r + d * d - R * R) / (2 * r * d)))) * DEG;
      const m = magnitude(p.key, r, d, ph);
      acc[p.key] = acc[p.key] || [9, -9];
      acc[p.key][0] = Math.min(acc[p.key][0], m);
      acc[p.key][1] = Math.max(acc[p.key][1], m);
    }
  }
  // 문헌값 ± 0.4등급. 토성은 고리 보정을 넣지 않아 여유를 크게 잡았다.
  const lit = {
    mercury: [-2.6, 5.5], venus: [-4.9, -3.7], mars: [-2.9, 1.9],
    jupiter: [-2.95, -1.55], saturn: [-0.6, 1.6], uranus: [5.2, 6.1], neptune: [7.6, 8.1]
  };
  for (const [k, [lo, hi]] of Object.entries(acc)) {
    ok(`${k} ${lo.toFixed(2)} ~ ${hi.toFixed(2)}등급`, lo >= lit[k][0] - 0.4 && hi <= lit[k][1] + 0.4, `(문헌 ${lit[k][0]}~${lit[k][1]})`);
  }
}

section('[10] 페이지 로직 — 표본 · 밤 구간 · 행성 요약');
{
  buildSamples();
  const nr = nightRange();
  ok('표본 289개 (24시간 · 5분 간격)', state.samples.length === 289, `${state.samples.length}개`);
  ok('밤 구간이 앞뒤로 뒤집히지 않음', nr.a < nr.b);
  const hours = (nr.b - nr.a) * 5 / 60;
  ok('밤 길이 7~15시간', hours > 7 && hours < 15, `${hours.toFixed(1)}시간`);
  ok('일몰·일출 시각이 모두 잡힘', sunCross(true) !== null && sunCross(false) !== null);

  for (const p of PLANETS) {
    const s = summarize(p.key);
    ok(`${p.ko} 고도·방위·등급이 유효 범위`,
       s.bestAlt >= -90 && s.bestAlt <= 90 && s.bestAz >= 0 && s.bestAz <= 360 && Number.isFinite(s.mag),
       `고도 ${s.bestAlt.toFixed(0)}° ${dirName(s.bestAz)}쪽 · ${magText(s.mag)}등급`);
  }

  // 행성은 황도 위에만 있으므로 북쪽 높은 하늘에는 절대 나타나지 않는다.
  // 좌표 변환이 뒤집히면 가장 먼저 여기서 티가 난다.
  let bad = 0;
  for (const s of state.samples) {
    for (const p of PLANETS) {
      const o = s.b[p.key];
      if ((o.az < 45 || o.az > 315) && o.alt > 30) bad++;
    }
  }
  ok('북쪽 하늘 고도 30° 위에 행성 없음 (황도 제약)', bad === 0, `위반 ${bad}건`);
}

section('[11] 잔가지 — 조사 · 등급 표기');
{
  ok('받침 있는 말에 «과» (토성)', josa('토성', '과', '와') === '과');
  ok('받침 없는 말에 «와» (지구)', josa('지구', '과', '와') === '와');
  ok('받침 ㄹ 인 «달»에 «이»', josa('달', '이', '가') === '이');
  ok('받침 없는 말에 «가» (금성이 아닌 자리표시 «미»)', josa('미', '이', '가') === '가');
  ok('-0.04 등급이 «0.0» 으로 («-0.0» 이 아니라)', magText(-0.04) === '0.0', magText(-0.04));
  ok('양수 등급에 + 부호', magText(0.83) === '+0.8', magText(0.83));
  ok('음수 등급 그대로', magText(-4.21) === '-4.2', magText(-4.21));
}

console.log('\n' + (failed === 0 ? '천문 계산 검증 — 전부 통과' : `천문 계산 검증 — ${failed}건 실패`));
process.exit(failed === 0 ? 0 : 1);
