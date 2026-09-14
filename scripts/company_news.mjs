// Public official news indexes only. Keep metadata, never article bodies.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';

export const companyPages = {
  spacex: { url: 'https://www.spacex.com/updates', ready: '.header .title a[href*="updates#"]' },
  starlink: { url: 'https://starlink.com/kr/updates', ready: 'h2' },
  rocketlab: { url: 'https://rocketlabcorp.com/updates/', ready: 'article .blog__article-title' },
  firefly: { url: 'https://fireflyspace.com/news/', ready: 'article h2 a' },
};

// Runs in the page; exported so local fixture tests exercise the same extraction.
export function extractHeadlines(source) {
  const text = el => el?.textContent?.replace(/\s+/g, ' ').trim() || '';
  const row = (title, link, date, language = 'en') => ({ title: text(title), url: link?.href || '', date, language });
  if (source === 'spacex') return [...document.querySelectorAll('.header')].slice(0,100).map(el =>
    row(el.querySelector('.title a'), el.querySelector('.title a'), text(el.querySelector('.date'))));
  if (source === 'starlink') return [...document.querySelectorAll('h2')].slice(0,100).map(el => {
    const content = el.nextElementSibling;
    // Some cards have no publication date. Skip them rather than inventing one.
    const date = text(content).match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    const link = [...el.parentElement.querySelectorAll('a')].find(a => text(a) === '더 보기');
    return row(el, link, date ? `${date[1]}-${date[2].padStart(2,'0')}-${date[3].padStart(2,'0')}` : '', 'ko');
  });
  if (source === 'rocketlab') return [...document.querySelectorAll('article')].slice(0,100).map(el =>
    row(el.querySelector('.blog__article-title'), el.querySelector('a.blog__article'), text(el.querySelector('.blog__article-date'))));
  if (source === 'firefly') return [...document.querySelectorAll('article')].slice(0,100).map(el =>
    row(el.querySelector('h2'), el.querySelector('h2 a'), text(el.querySelector('time'))));
  throw new Error('Unknown source');
}

export async function collectCompanies() {
  const browser = await chromium.launch();
  try {
    const results = {};
    await Promise.all(Object.entries(companyPages).map(async ([id, config]) => {
      let context;
      try {
        context = await browser.newContext({ locale: 'ko-KR', serviceWorkers: 'block' });
        await context.route('**/*', route => ['image','media','font'].includes(route.request().resourceType()) ? route.abort() : route.continue());
        const page = await context.newPage();
        await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        if (new URL(page.url()).hostname !== new URL(config.url).hostname) throw new Error('Unexpected news destination');
        await page.locator(config.ready).first().waitFor({ timeout: 30000 });
        results[id] = { rows: await page.evaluate(extractHeadlines, id) };
      } catch (error) {
        results[id] = { error: String(error.message).slice(0,300) };
      } finally { await context?.close(); }
    }));
    return results;
  } finally { await browser.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await collectCompanies()));
}
