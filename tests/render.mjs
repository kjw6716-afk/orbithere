// 브라우저에서 실제로 그려본 뒤 «눈으로 봐야 알 수 있는 것»을 검사한다.
//
// 특히 하늘 지도의 이름표는 계산이 맞아도 자리가 틀릴 수 있다.
// 실제로 행성이 몰린 시각에 «화성» 이름표가 천왕성 점에 붙는 일이 있었고,
// 그건 어떤 수치 검사로도 잡히지 않았다. 그래서 여기서 확인한다 —
// 모든 이름표는 자기 점에 가장 가까워야 한다.
//
// node tests/render.mjs   (playwright 필요)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
                '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
                '.json': 'application/json', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json' };

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) console.log('  ✓ ' + name + (extra ? '  ' + extra : ''));
  else { failed++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')); }
};

// 의존성 없는 아주 작은 정적 서버 — 테스트에 http-server 를 끌어오지 않기 위함
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  try {
    const body = await readFile(join(root, path === '/' ? 'index.html' : path.slice(1)));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const pageErrors = [];
const newPage = async (opts) => {
  const p = await browser.newPage(opts);
  p.on('pageerror', (e) => pageErrors.push(e.message));
  return p;
};

// ------------------------------------------------------------------
console.log('\n[1] 하늘 지도 — 이름표가 자기 점에 붙어 있는가');
{
  const page = await newPage({ viewport: { width: 900, height: 1000 } });
  await page.goto(`${base}/planets.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('.pl').length > 0);

  // 밤 전체를 훑는다. 행성이 몰리는 시각은 날마다 다르므로 한 프레임만 봐서는 부족하다.
  const report = await page.evaluate(() => {
    const r = document.getElementById('scrubRange');
    let frames = 0, wrongOwner = [], labelClash = [], outOfBox = [];
    for (let i = +r.min; i <= +r.max; i += 2) {
      r.value = String(i);
      r.dispatchEvent(new Event('input', { bubbles: true }));
      frames++;

      const svg = document.getElementById('skyMap');
      // 화면 좌표로 잰다. 달은 <g transform="translate(...)"> 안에 그려지는데
      // getBBox() 는 그 변환을 적용하기 «전» 좌표를 주므로 늘 (0,0) 으로 잡힌다.
      const center = (el) => { const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, box: b }; };
      const dots = [...svg.querySelectorAll('[data-dot]')].map((d) => ({ name: d.dataset.dot, ...center(d) }));
      const labels = [...svg.querySelectorAll('[data-label]')].map((t) => ({ name: t.dataset.label, ...center(t) }));
      const led = new Set([...svg.querySelectorAll('[data-lead]')].map((l) => l.dataset.lead));
      if (dots.length !== labels.length) wrongOwner.push(`${i}: 점 ${dots.length}개 / 이름표 ${labels.length}개`);

      for (const l of labels) {
        // 가장 가까운 점이 자기 점이어야 한다.
        // 천체가 거의 포개진 순간에는 그게 불가능할 수 있는데, 그때는
        // 잇는 선이 그어져 있어야 어느 점의 이름인지 알 수 있다.
        let near = null, nd = Infinity;
        for (const d of dots) {
          const dist = Math.hypot(l.x - d.x, l.y - d.y);
          if (dist < nd) { nd = dist; near = d.name; }
        }
        if (near !== l.name && !led.has(l.name)) {
          wrongOwner.push(`${i}: «${l.name}» 이름표가 «${near}» 점에 더 가깝고 잇는 선도 없음`);
        }
      }
      for (let a = 0; a < labels.length; a++) {
        for (let b = a + 1; b < labels.length; b++) {
          const A = labels[a].box, B = labels[b].box;
          if (A.x < B.right && B.x < A.right && A.y < B.bottom && B.y < A.bottom) {
            labelClash.push(`${i}: ${labels[a].name} ↔ ${labels[b].name}`);
          }
        }
      }
      const frame = svg.getBoundingClientRect();
      for (const l of labels) {
        if (l.box.y < frame.y - 1 || l.box.bottom > frame.bottom + 1) outOfBox.push(`${i}: ${l.name}`);
      }
    }
    return { frames, wrongOwner, labelClash, outOfBox };
  });

  ok(`이름표가 남의 점에 붙지 않음 (${report.frames}개 시각)`, report.wrongOwner.length === 0,
     report.wrongOwner.slice(0, 5).join(' / '));
  ok('이름표끼리 겹치지 않음', report.labelClash.length === 0, report.labelClash.slice(0, 5).join(' / '));
  ok('이름표가 그림 밖으로 나가지 않음', report.outOfBox.length === 0, report.outOfBox.slice(0, 5).join(' / '));
  await page.close();
}

console.log('\n[2] 하늘 지도 — 일부러 몰아 놓았을 때');
{
  // 위의 검사는 «오늘 밤 하늘»을 본다. 그런데 하늘이 한산한 날에는
  // 이름표가 엉켜도 티가 나지 않아 검사가 조용히 통과해 버린다.
  // 그래서 실제로 문제가 났던 배치를 직접 만들어 넣고 확인한다.
  //   · 화성/천왕성 — 방위는 거의 같고 고도만 벌어진 세로 배치.
  //     위로만 밀어내는 방식에서는 «화성» 이름표가 천왕성 점에 붙어 버렸다.
  //   · 달/토성/해왕성 — 원반이 서로 겹칠 만큼 몰린 배치.
  const page = await newPage({ viewport: { width: 900, height: 1000 } });
  await page.goto(`${base}/planets.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('.pl').length > 0);

  const report = await page.evaluate(() => {
    const idx = state.defaultIdx;
    const s = state.samples[idx];
    const put = { 화성: [150, 13], 천왕성: [154, 27], 달: [195, 58], 토성: [193, 55],
                  해왕성: [200, 54], 금성: [250, 20], 수성: [95, 9], 목성: [300, 35] };
    for (const p of PLANETS) { const [az, alt] = put[p.ko]; s.b[p.key].az = az; s.b[p.key].alt = alt; }
    s.b.moon.az = put['달'][0]; s.b.moon.alt = put['달'][1];
    renderMap(idx);

    const svg = document.getElementById('skyMap');
    const center = (el) => { const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, box: b }; };
    const dots = [...svg.querySelectorAll('[data-dot]')].map((d) => ({ name: d.dataset.dot, ...center(d) }));
    const labels = [...svg.querySelectorAll('[data-label]')].map((t) => ({ name: t.dataset.label, ...center(t) }));
    const led = new Set([...svg.querySelectorAll('[data-lead]')].map((l) => l.dataset.lead));

    const wrong = [], clash = [];
    for (const l of labels) {
      let near = null, nd = Infinity;
      for (const d of dots) { const q = Math.hypot(l.x - d.x, l.y - d.y); if (q < nd) { nd = q; near = d.name; } }
      if (near !== l.name && !led.has(l.name)) wrong.push(`«${l.name}» → «${near}» 점에 더 가깝고 잇는 선도 없음`);
    }
    for (let a = 0; a < labels.length; a++) {
      for (let b = a + 1; b < labels.length; b++) {
        const A = labels[a].box, B = labels[b].box;
        if (A.x < B.right && B.x < A.right && A.y < B.bottom && B.y < A.bottom) clash.push(`${labels[a].name} ↔ ${labels[b].name}`);
      }
    }
    return { count: labels.length, wrong, clash, leds: [...led] };
  });

  ok('몰린 배치에서도 이름표가 제 점을 가리킴', report.wrong.length === 0, report.wrong.join(' / '));
  ok('몰린 배치에서도 이름표끼리 겹치지 않음', report.clash.length === 0, report.clash.join(' / '));
  ok('천체 8개가 모두 이름을 가짐', report.count === 8, `${report.count}개`);
  await page.close();
}

console.log('\n[3] 지도와 요약 문장이 서로 어긋나지 않는가');
{
  const page = await newPage({ viewport: { width: 900, height: 1000 } });
  await page.goto(`${base}/planets.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('.pl').length > 0);
  const mismatch = await page.evaluate(() => {
    const r = document.getElementById('scrubRange');
    const bad = [];
    for (let i = +r.min; i <= +r.max; i += 5) {
      r.value = String(i);
      r.dispatchEvent(new Event('input', { bubbles: true }));
      const dots = new Set([...document.querySelectorAll('#skyMap [data-dot]')].map((d) => d.dataset.dot));
      dots.delete('달');
      const txt = document.getElementById('skySum').textContent;
      const m = txt.match(/하늘에 (.+?) (\d+)개가 떠 있습니다/);
      if (!m) { if (dots.size > 0) bad.push(`${i}: 지도엔 ${dots.size}개인데 문장은 없음`); continue; }
      const listed = m[1].split(' · ').map((s) => s.trim());
      if (listed.length !== dots.size || listed.some((n) => !dots.has(n))) {
        bad.push(`${i}: 문장 [${listed}] / 지도 [${[...dots]}]`);
      }
    }
    return bad;
  });
  ok('요약 문장의 행성 목록과 지도의 점이 일치', mismatch.length === 0, mismatch.slice(0, 4).join(' / '));
  await page.close();
}

console.log('\n[4] 관측지 8곳 — 계산과 저장');
{
  const page = await newPage({ viewport: { width: 900, height: 1000 } });
  await page.goto(`${base}/planets.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('.pl').length > 0);
  const rows = await page.evaluate(() => {
    const out = [];
    for (const btn of document.querySelectorAll('.pbtn')) {
      btn.click();
      out.push({ ko: btn.textContent, ends: document.getElementById('scrubEnds').textContent, saved: localStorage.getItem('orbit_place') });
    }
    return out;
  });
  ok('8곳 모두 일몰·일출이 계산됨', rows.length === 8 && rows.every((r) => /일몰 \d\d:\d\d/.test(r.ends) && /일출/.test(r.ends)));
  ok('마지막으로 고른 곳이 저장됨', rows[rows.length - 1].saved === 'jeju', rows[rows.length - 1].saved);
  // 제주는 남서쪽 끝이라 강릉보다 해가 늦게 뜬다 — 위치가 실제로 반영되는지 보는 검사
  const at = (ko) => rows.find((r) => r.ko === ko).ends;
  const rise = (s) => s.match(/일출.*?(\d\d):(\d\d)/).slice(1).map(Number);
  const [jh, jm] = rise(at('제주')), [gh, gm] = rise(at('강릉'));
  ok('제주 일출이 강릉보다 늦음 (관측지가 계산에 실제로 반영됨)', jh * 60 + jm > gh * 60 + gm,
     `제주 ${jh}:${String(jm).padStart(2, '0')} / 강릉 ${gh}:${String(gm).padStart(2, '0')}`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('.pbtn.on').length > 0);
  ok('새로고침해도 관측지가 유지됨', (await page.locator('.pbtn.on').textContent()) === '제주');
  await page.close();
}

console.log('\n[5] 좁은 화면 — 가로 스크롤이 생기지 않는가');
{
  for (const [w, h] of [[360, 780], [390, 844], [768, 1000]]) {
    const page = await newPage({ viewport: { width: w, height: h } });
    await page.goto(`${base}/planets.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('.pl').length > 0);
    const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    ok(`${w}px 가로 넘침 없음`, !over);
    // 작은 화면에서 지도 글자가 읽을 수 없을 만큼 작아지지 않아야 한다
    const px = await page.evaluate(() => {
      const t = document.querySelector('#skyMap [data-label]');
      if (!t) return 99;
      const svg = document.getElementById('skyMap');
      const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      return parseFloat(t.getAttribute('font-size')) * scale;
    });
    ok(`${w}px 지도 글자 9px 이상`, px >= 9, `${px.toFixed(1)}px`);
    await page.close();
  }
}

console.log('\n[6] 커뮤니티 홈에 끼워 넣었을 때');
{
  const page = await newPage({ viewport: { width: 1200, height: 950 } });
  await page.goto(`${base}/main.html#planets`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('planetFrame')?.style.height);
  const st = await page.evaluate(() => ({
    panel: document.querySelector('.panel.on').id,
    height: parseInt(document.getElementById('planetFrame').style.height, 10)
  }));
  ok('#planets 딥링크로 행성 패널이 열림', st.panel === 'panel-planets');
  ok('iframe 높이가 내용에 맞춰 늘어남', st.height > 800, `${st.height}px`);

  const frame = page.frames().find((f) => f.url().includes('planets.html'));
  ok('임베드 모드에서 상단바·본문이 숨겨짐', frame && await frame.evaluate(() =>
    getComputedStyle(document.querySelector('.site-topbar')).display === 'none' &&
    getComputedStyle(document.querySelector('.seo-content')).display === 'none'));
  await page.close();
}

console.log('\n[7] 키보드만으로 조작되는가');
{
  const page = await newPage({ viewport: { width: 900, height: 1000 } });
  await page.goto(`${base}/planets.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('.pl').length > 0);
  await page.evaluate(() => document.querySelector('.pl').focus());
  await page.keyboard.press('Enter');
  ok('행성 카드가 Enter로 펼쳐짐', await page.evaluate(() => document.querySelector('.pl').classList.contains('open')));
  await page.keyboard.press('Enter');
  ok('한 번 더 누르면 접힘', await page.evaluate(() => !document.querySelector('.pl').classList.contains('open')));

  await page.evaluate(() => document.getElementById('scrubRange').focus());
  const before = await page.locator('#scrubNow').textContent();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  ok('시각 막대가 방향키로 움직임', (await page.locator('#scrubNow').textContent()) !== before);
  await page.close();
}

console.log('\n[8] 밤하늘 달력 — 일정이 비거나 멀 때 오늘 밤 행성으로 잇는가');
{
  // sky.html 의 이벤트는 하드코딩이라 마지막 항목을 지나면 카드가 통째로 빈다.
  // 그 «죽은 화면»이 첫 화면이라 우선순위가 높다. 오늘 날짜에 기대지 않도록
  // 상황별 일정표를 직접 넣어 확인한다.
  const page = await newPage({ viewport: { width: 900, height: 1000 } });
  await page.goto(`${base}/sky.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('nxName').textContent !== '불러오는 중…');

  const withEvents = (days, kr) => page.evaluate(([d, k]) => {
    EVENTS.length = 0;
    if (d !== null) {
      EVENTS.push({
        id: 'x', type: 'meteor', ic: '☄️', kr: k, name: '검사용 유성우',
        watch: new Date(Date.now() + d * 86400000).toISOString(),
        dateText: '검사용', peakText: '검사용', zhr: 50,
        radiant: '검사용', best: '검사용', desc: '검사용 설명입니다.'
      });
    }
    renderNext();
    const alt = document.getElementById('nxAlt');
    return {
      shown: alt.style.display !== 'none',
      text: alt.textContent,
      href: alt.getAttribute('href'),
      name: document.getElementById('nxName').textContent,
      units: document.getElementById('nxUnits').textContent.trim(),
      timer: !!window.__nxTimer
    };
  }, [days, kr]);

  const near = await withEvents(5, true);
  ok('국내에서 곧 볼 현상이 있으면 안내를 띄우지 않음', !near.shown, near.text.slice(0, 30));

  const far = await withEvents(60, true);
  ok('다음 현상이 21일 넘게 남으면 안내가 뜸', far.shown && /D-\d+/.test(far.text), far.text.slice(0, 34));
  ok('안내가 오늘 밤 행성으로 연결됨', far.href === 'planets.html');

  const abroad = await withEvents(5, false);
  ok('국내에서 못 보는 현상이면 안내가 뜸', abroad.shown && abroad.text.includes('국내에서 볼 수 없습니다'), abroad.text.slice(0, 30));

  const none = await withEvents(null, true);
  ok('일정표가 동나도 카드가 죽지 않음', none.shown, none.text.slice(0, 34));
  ok('빈 상태 문구가 운영자용이 아님', !none.name.includes('업데이트할 시기'), `«${none.name}»`);
  // 마지막 현상이 지나간 순간 숫자판이 안 지워지면 «9일 7시간 55분»이 화면에 굳는다
  ok('빈 상태에서 이전 현상의 카운트다운이 남지 않음', none.units === '', `«${none.units}»`);
  ok('빈 상태에서 1초 타이머가 멈춤', !none.timer);
  await page.close();
}

console.log('\n[9] 자바스크립트 오류');
ok('페이지 오류 0건', pageErrors.length === 0, pageErrors.slice(0, 3).join(' / '));

await browser.close();
server.close();

console.log('\n' + (failed === 0 ? '렌더링 검증 — 전부 통과' : `렌더링 검증 — ${failed}건 실패`));
process.exit(failed === 0 ? 0 : 1);
