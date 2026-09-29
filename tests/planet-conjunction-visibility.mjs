// 근접 안내가 지도에 나타나는 두 천체만 가리키는지 확인한다.
// 실제 재현 시각과 5° 경계를 검사하며 브라우저나 네트워크는 필요하지 않다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../planets.html', import.meta.url), 'utf8');
const from = src.indexOf('var RAD = Math.PI / 180');
const to = src.indexOf('// ---------- 행성 카드 ----------');
assert.ok(from >= 0 && to > from, '행성 계산·지도·근접 안내 표식');
const elements = {
  skyMap: { clientWidth: 720, innerHTML: '', setAttribute() {} },
  conjBox: { innerHTML: '' }
};
const scope = {};
new Function('document', 'exports', src.slice(from, to) + `
  Object.assign(exports, { state, PLACES, PLANETS, MIN_ALT, kstMs, buildSamples, renderMap, renderConj });
`)({ getElementById: id => elements[id] }, scope);
const { state, PLACES, PLANETS, MIN_ALT, kstMs, buildSamples, renderMap, renderConj } = scope;
state.place = PLACES.find(place => place.id === 'seoul');

function render(idx) {
  renderMap(idx);
  renderConj(idx);
  return {
    hasDot: name => elements.skyMap.innerHTML.includes(`data-dot="${name}"`),
    advice: elements.conjBox.innerHTML
  };
}

console.log('\n[근접 안내] 지도와 동일한 관측 고도 기준');
buildSamples(kstMs(2026, 9, 5, 0, 45));
assert.ok(state.current.b.mars.alt < 0, '재현 시각에는 화성이 지평선 아래');
assert.ok(state.current.b.moon.alt > MIN_ALT, '재현 시각에는 달이 지도에 보이는 높이');
let view = render(state.nowIdx);
assert.equal(view.hasDot('화성'), false);
assert.equal(view.hasDot('달'), true);
assert.doesNotMatch(view.advice, /화성/, '아직 뜨지 않은 화성을 찾으라고 안내하지 않음');
console.log('  ✓ 서울 2026-10-05 00:45: 달만 떠 있을 때 화성 찾기 안내 없음');

buildSamples(kstMs(2026, 9, 5, 1, 30));
assert.ok(state.current.b.mars.alt > MIN_ALT && state.current.b.moon.alt > MIN_ALT,
  '같은 밤 두 천체 모두 관측 가능한 높이');
view = render(state.nowIdx);
assert.equal(view.hasDot('화성'), true);
assert.equal(view.hasDot('달'), true);
assert.match(view.advice, /화성과 달이/, '두 천체가 떠오르면 근접 안내 유지');
console.log('  ✓ 서울 2026-10-05 01:30: 둘 다 보이는 화성·달 근접 안내 유지');

// 실제로 가까운 화성·달의 좌표를 유지하고 고도만 바꿔 경계를 확인한다.
const sample = structuredClone(state.current);
for (const planet of PLANETS) sample.b[planet.key].alt = -10;
sample.b.mars.alt = sample.b.moon.alt = MIN_ALT + 0.01;
state.samples = [sample];
for (const [key, name, other] of [['mars', '화성', '달'], ['moon', '달', '화성']]) {
  for (const alt of [-1, MIN_ALT - 0.01, MIN_ALT]) {
    sample.b[key].alt = alt;
    view = render(0);
    assert.equal(view.hasDot(name), false, `${name} ${alt}°: 지도에 표시하지 않음`);
    assert.equal(view.hasDot(other), true, `${other}: 상대 천체는 여전히 지도에 표시`);
    assert.equal(view.advice, '', `${name} ${alt}°: 한쪽만 보여도 근접 안내를 비움`);
  }
  sample.b[key].alt = MIN_ALT + 0.01;
}
view = render(0);
assert.equal(view.hasDot('화성'), true);
assert.equal(view.hasDot('달'), true);
assert.match(view.advice, /화성과 달이/, '둘 다 기준을 초과하면 안내를 다시 표시');
console.log('  ✓ 두 천체 각각 지평선 아래·5° 직전·정확히 5°는 제외, 둘 다 5° 초과면 안내');
