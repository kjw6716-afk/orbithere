// Fixed-clock UI regression: direct pages and the real main.html iframe route.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, extname, sep, join } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const planetSource = await readFile(join(root,'planets.html'),'utf8');
const planetMath = new Function(planetSource.slice(planetSource.indexOf('var RAD = Math.PI / 180'),planetSource.indexOf('// ---------- 하늘 지도 ----------'))+'; return {observationWindow,PLACES};')();
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml' };
const server = createServer(async (req, res) => {
  const full = resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (!full.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
  try { res.writeHead(200, {'Content-Type':types[extname(full)] || 'application/octet-stream'}); res.end(await readFile(full)); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const errors = [];
let checks = 0;
const check = (name, condition) => { assert.ok(condition, name); checks++; };
const snapshots = new Map();
const capture = async (frame, kind) => frame.evaluate(kind => {
  const text = id => document.getElementById(id)?.textContent;
  return kind === 'planets' ? {
    when:text('skyWhen'), summary:text('skySum'), scrub:text('scrubNow'), ends:text('scrubEnds'),
    cards:text('plist'), map:document.querySelector('#skyMap').innerHTML
  } : {
    name:text('nxName'), when:text('nxWhen'), dday:text('nxDday'), sub:text('nxDdaySub'), units:text('nxUnits'),
    timeline:text('timeline'), ids:[...document.querySelectorAll('.ev')].map(e=>e.dataset.id)
  };
},kind);
const contextAt = async (time, timezoneId, mobile=false) => {
  const context = await browser.newContext({timezoneId, viewport:mobile?{width:360,height:900}:{width:1200,height:1000}});
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    if (url.includes('@supabase/supabase-js')) return route.fulfill({path:join(root,'node_modules/@supabase/supabase-js/dist/umd/supabase.js'),contentType:'text/javascript'});
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', e=>errors.push(e.message));
  await page.clock.install({time:new Date(time)});
  await page.clock.pauseAt(new Date(time));
  return {context,page};
};
const loaded = async (page, kind, embedded) => {
  await page.goto(`${base}/${embedded?'main.html#'+kind:kind+'.html'}`, {waitUntil:'domcontentloaded'});
  const frame = embedded ? page.frameLocator(kind==='planets'?'#planetFrame':'#skyFrame') : page;
  await frame.locator(kind==='planets'?'.pl':'.ev').first().waitFor();
  return embedded ? page.frames().find(f=>f.url().includes(kind+'.html')) : page;
};
try {
  for (const timezone of ['Asia/Seoul','UTC','America/Los_Angeles']) {
    for (const [kind,time] of [
      ['planets','2026-09-26T10:00:00+09:00'],
      ['planets','2026-09-26T02:00:00+09:00'],
      ['planets','2026-12-31T23:59:00+09:00'],
      ['sky','2026-12-14T23:01:00+09:00'],
      ['sky','2026-12-15T00:01:00+09:00']
    ]) {
      const pair = [];
      for (const embedded of [false,true]) {
        const {context,page} = await contextAt(time,timezone);
        try {
          const frame = await loaded(page,kind,embedded);
          const view = await capture(frame,kind);
          pair.push(view);
          if (kind==='planets') {
            if (time.includes('10:00')) {
              check('morning recommendation has the upcoming dawn date',view.scrub.includes('2026년 9월 27일'));
              check('morning night range starts today',view.when.includes('2026년 9월 26일 저녁'));
              check('morning recommendation is not labeled now',!view.scrub.includes('· 지금'));
            } else {
              check('ongoing night displays the actual current time',view.scrub.includes(time.includes('02:00')?'02:00':'23:59') && view.scrub.includes('· 지금'));
              if(time.includes('12-31')) check('year boundary labels next year',view.when.includes('2027년 1월 1일'));
            }
          } else {
            check('Geminids remain next after the start',view.name==='쌍둥이자리 유성우');
            check('next card reports ongoing',view.dday==='진행 중');
            check('timeline keeps Geminids',view.ids.includes('geminids2026'));
            check('countdown targets the end',view.sub.includes('종료까지'));
            check('timeline state reports ongoing',await frame.locator('[data-id="geminids2026"] .ev-dday').textContent()==='진행 중');
          }
          if(process.env.ORBIT_SCREENSHOT_DIR && timezone==='Asia/Seoul' && (time.includes('10:00')||time.includes('23:01'))) {
            await mkdir(process.env.ORBIT_SCREENSHOT_DIR,{recursive:true});
            await page.screenshot({path:join(process.env.ORBIT_SCREENSHOT_DIR,`after-${kind}-${embedded?'iframe':'direct'}.png`)});
          }
        } finally { await context.close(); }
      }
      assert.deepEqual(pair[0],pair[1],`${kind} ${time}: direct/iframe mismatch`); checks++;
      const key=kind+time;
      if(snapshots.has(key)) { assert.deepEqual(pair[0],snapshots.get(key),`${key}: device timezone changed KST output`); checks++; }
      else snapshots.set(key,pair[0]);
    }
  }

  // Every city retains the same independent/iframe output after city selection.
  const {context,page}=await contextAt('2026-09-26T10:00:00+09:00','UTC',true);
  try {
    const direct=await loaded(page,'planets',false);
    const home=await context.newPage();
    await home.clock.install({time:new Date('2026-09-26T10:00:00+09:00')});
    await home.clock.pauseAt(new Date('2026-09-26T10:00:00+09:00'));
    const embedded=await loaded(home,'planets',true);
    for(const city of ['seoul','incheon','daejeon','daegu','gwangju','busan','gangneung','jeju']) {
      await direct.locator(`[data-place="${city}"]`).click();
      await embedded.locator(`[data-place="${city}"]`).click();
      assert.deepEqual(await capture(direct,'planets'),await capture(embedded,'planets'),`${city}: mobile direct/iframe mismatch`); checks++;
    }
    for(const frame of [direct,embedded]) check('mobile time labels do not cause page overflow',await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(process.env.ORBIT_SCREENSHOT_DIR) await page.screenshot({path:join(process.env.ORBIT_SCREENSHOT_DIR,'after-planets-mobile.png')});
  } finally {await context.close();}

  // Exercise timer transitions without reloading, so cached state cannot hide a bug.
  for(const embedded of [false,true]) {
    const {context,page}=await contextAt('2026-12-14T22:59:59.000+09:00','UTC',true);
    try {
      const frame=await loaded(page,'sky',embedded);
      check('pre-start D-day uses the KST calendar day',await frame.locator('#nxDday').textContent()==='D-DAY');
      await page.clock.runFor(1000);
      check('timer changes to ongoing at start',await frame.locator('#nxDday').textContent()==='진행 중');
      check('timer preserves the ongoing row',await frame.locator('[data-id="geminids2026"]').count()===1);
      check('mobile sky dates do not overflow',await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      if(process.env.ORBIT_SCREENSHOT_DIR && !embedded) await page.screenshot({path:join(process.env.ORBIT_SCREENSHOT_DIR,'after-sky-mobile.png')});
      await page.clock.setSystemTime(new Date('2026-12-15T05:59:59+09:00'));
      await page.clock.runFor(1000);
      check('timer removes the row at the end',await frame.locator('[data-id="geminids2026"]').count()===0);
      check('timer advances the next event',await frame.locator('#nxName').textContent()!=='쌍둥이자리 유성우');
    } finally {await context.close();}
  }

  const seoul=planetMath.PLACES.find(p=>p.id==='seoul');
  const day=planetMath.observationWindow(Date.parse('2026-09-26T02:00:00+09:00'),seoul);
  const evening=planetMath.observationWindow(Date.parse('2026-09-26T10:00:00+09:00'),seoul);
  for(const embedded of [false,true]) {
    for(const [boundary,instant] of [['sunrise',day.sunrise],['sunset',evening.sunset],['midnight',Date.parse('2027-01-01T00:00:00+09:00')]]) {
      const {context,page}=await contextAt(instant-1000,'America/Los_Angeles');
      try {
        const frame=await loaded(page,'planets',embedded);
        if(boundary==='sunrise') {
          await frame.locator('#scrubRange').evaluate(el=>{el.value=el.min;el.dispatchEvent(new Event('input',{bubbles:true}));});
        }
        await page.clock.runFor(1000);
        const view=await capture(frame,'planets');
        if(boundary==='sunrise') {
          check('sunrise replaces a manually selected previous night',view.when.includes('2026년 9월 26일 저녁') && view.scrub.includes('2026년 9월 27일'));
          check('sunrise clears an old now label',!view.scrub.includes('· 지금'));
        } else if(boundary==='sunset') {
          check('sunset displays the ongoing night immediately',view.when.startsWith('현재 밤') && view.scrub.includes('· 지금'));
        } else {
          check('midnight keeps the same night and updates now date',view.when.includes('2026년 12월 31일 저녁') && view.scrub.includes('2027년 1월 1일 00:00'));
        }
      } finally {await context.close();}
    }
    const {context,page}=await contextAt('2026-09-26T02:00:00+09:00','UTC');
    try {
      const frame=await loaded(page,'planets',embedded);
      await frame.locator('#scrubRange').evaluate(el=>{el.value=el.min;el.dispatchEvent(new Event('input',{bubbles:true}));});
      await page.clock.setSystemTime(new Date('2026-09-26T02:01:00+09:00'));
      await frame.locator('#scrubBack').click();
      check('return to now recalculates the current time', (await frame.locator('#scrubNow').textContent()).includes('02:01 · 지금'));
    } finally {await context.close();}
  }
  check('no page errors',errors.length===0);
  console.log(`시간 경계 화면 검증 — ${checks}개 통과 (3 timezones, direct/iframe, 8 cities, mobile, live timers)`);
} finally {
  await browser.close();
  await new Promise(r=>server.close(r));
}
