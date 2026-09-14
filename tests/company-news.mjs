import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { companyPages, extractHeadlines } from '../scripts/company_news.mjs';
const fixtures = {
  spacex: '<div class="header"><div class="date">May 21, 2026</div><div class="title"><a href="updates#starship">Starship update</a></div></div>',
  starlink: '<div><h2>우주 안전 웹 도구</h2><div>2026년 5월 21일 본문은 복사하지 않습니다. <a href="/docs">관련 링크</a></div><div><a href="/kr/updates/safety">더 보기</a></div></div><div><h2>날짜 없는 소식</h2><div>본문</div><a href="/kr/updates/undated">더 보기</a></div>',
  rocketlab: '<article><a class="blog__article" href="/updates/mission/"><span class="blog__article-date">September 11, 2026</span><span class="blog__article-title">Mission success</span><span>Read more</span></a></article>',
  firefly: '<article><p>Press Release | <time>September 9, 2026</time></p><h2><a href="/news/alpha/"><strong>Alpha launch</strong></a></h2></article>',
};
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort());
  for (const [id, content] of Object.entries(fixtures)) {
    await page.setContent(`<base href="${companyPages[id].url}">${content}`);
    const rows = await page.evaluate(extractHeadlines, id);
    assert.ok(rows[0].title && rows[0].date && rows[0].url.startsWith('https:'));
    assert.deepEqual(Object.keys(rows[0]).sort(), ['date','language','title','url']);
    assert.ok(!JSON.stringify(rows).includes('Do not copy'));
    if (id === 'spacex') assert.equal(rows[0].url, 'https://www.spacex.com/updates#starship');
    if (id === 'starlink') {
      assert.equal(rows[0].url, 'https://starlink.com/kr/updates/safety');
      assert.equal(rows[0].date, '2026-05-21');
      assert.equal(rows[0].language, 'ko');
      assert.equal(rows[1].date, '');
    }
    console.log(`✓ ${id}: dated official metadata without article text`);
  }
} finally { await browser.close(); }
