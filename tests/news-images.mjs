// Optional curated news images: isolated HTTP fixtures, no external requests.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('..',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const server=createServer(async(req,res)=>{
  const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!path.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
  try {
    const body=await readFile(path);
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});
    res.end(body);
  } catch {res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
const items=[
  {id:'1111111111111111',source:'nasa',url:'https://www.nasa.gov/first/',title:'First official headline',publishedAt:'2026-09-27T02:00:00Z'},
  {id:'2222222222222222',source:'esa',url:'https://www.esa.int/second',title:'Second official headline',publishedAt:'2026-09-27T01:00:00Z'},
  {id:'3333333333333333',source:'nasa',url:'https://www.nasa.gov/third/',title:'Third official headline',publishedAt:'2026-09-26T23:00:00Z'},
].map((item,i)=>({...item,language:'en',titleKo:'공식 우주 관측 소식 '+i,titleKoOriginal:item.title,titleKoMethod:'reviewed'}));
const fixture={version:1,checkedAt:new Date().toISOString(),items,
  sources:['nasa','esa'].map(id=>({id,status:'ok',lastSuccessfulAt:new Date().toISOString()}))};
const mapping={version:1,images:Object.fromEntries(items.slice(0,2).map((item,i)=>[item.id,{
  src:'/images/news/fixture-'+i+'.webp',alt:'우주 관측 자료 '+i,credit:'NASA / ESA',
  sourceUrl:item.url,kind:i?'visualization':'photo',
  ...(i?{licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/igo/'}:{}),
}]))};
// Keep enough valid summary text to exceed three lines at the desktop width too.
const summaries={version:1,items:items.map(item=>({...item,titleOriginal:item.title,method:'source-checked',
  checkedAt:'2026-09-27',summaryKo:['공식 자료를 바탕으로 정리한 첫 번째 관측 내용입니다. '.repeat(6).trim(),'관측 결과의 자세한 설명은 공식 원문에서 확인할 수 있습니다. '.repeat(6).trim()]}))};
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBzEAAAAASUVORK5CYII=','base64');
let checks=0;
function ok(name,value=true){assert.ok(value,name);checks++;console.log('✓ '+name);}
async function open(state={}) {
  state.map??=structuredClone(mapping);
  state.data??=structuredClone(fixture);
  state.requests=[];
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==base)return route.abort();
    state.requests.push(url.pathname);
    if(url.pathname==='/data/news.json')return route.fulfill({contentType:'application/json',body:JSON.stringify(state.data)});
    if(url.pathname==='/data/news-summaries.json')return route.fulfill({contentType:'application/json',body:JSON.stringify(summaries)});
    if(url.pathname==='/data/news-images.json'){
      if(state.gate)await state.gate;
      return route.fulfill({status:state.mapFailure?503:200,contentType:'application/json',body:JSON.stringify(state.map)});
    }
    if(url.pathname.startsWith('/images/news/'))return state.broken===url.pathname
      ?route.fulfill({status:404,body:'missing'})
      :route.fulfill({contentType:'image/png',body:pixel});
    return route.continue();
  });
  const page=await context.newPage(),errors=[];
  page.setDefaultTimeout(8000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/news.html');
  await page.locator('#newsList[aria-busy=false]').waitFor();
  return {page,state,async close(){ok('news image fixtures produce no script errors',!errors.length);await context.close();}};
}
try {
  {
    const f=await open(),p=f.page;
    try {
      await p.waitForFunction(()=>document.querySelector('.news-thumbnail img')?.naturalWidth>0);
      ok('exact article IDs receive a decoded local thumbnail; unmatched articles remain text-only',
        await p.locator('.news-thumbnail img').count()===2 && await p.locator('#article-'+items[2].id+' .news-thumbnail').count()===0);
      ok('photo and visualization credits link directly to their matched official article',
        await p.locator('.news-image-credit a').first().getAttribute('href')===items[0].url &&
        (await p.locator('.news-image-credit').allTextContents()).some(text=>text.startsWith('시각화·삽화')));
      ok('approved license links are available while entries without a license remain valid',
        await p.locator('.news-image-license').count()===1 &&
        await p.locator('.news-image-license').getAttribute('href')==='https://creativecommons.org/licenses/by-sa/3.0/igo/');
      const initialOrder=await p.locator('.news-article').evaluateAll(rows=>rows.map(row=>row.id));
      for(const width of [320,390,600,601,1440]) {
        await p.setViewportSize({width,height:1000});
        await p.waitForFunction(width=>innerWidth===width,width);
        await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const geometry=await p.locator('.news-article').first().evaluate(article=>{
          const rect=selector=>article.querySelector(selector).getBoundingClientRect();
          const image=rect('.news-thumbnail'),heading=rect('.news-article-heading'),body=rect('.news-article-body');
          return {width:image.width,height:image.height,imageRight:image.right,headingX:heading.x,bodyX:body.x,articleX:article.getBoundingClientRect().x,
            overflow:document.documentElement.scrollWidth>innerWidth+1};
        });
        assert.ok(!geometry.overflow, `${width}px overflow: ${JSON.stringify(geometry)}`);
        ok(`${width}px: compact image stays left of readable text without overflow (${geometry.width}x${geometry.height})`,
          geometry.width===(width<=600?96:160) && geometry.height===(width<=600?64:100) && geometry.imageRight<geometry.headingX && !geometry.overflow);
        ok(`${width}px: mobile summary uses the full row while desktop summary follows the headline`,
          Math.abs(geometry.bodyX-(width<=600?geometry.articleX:geometry.headingX))<1);
        if([390,1440].includes(width)) {
          const summary=p.locator('.news-summary').first(),preview=summary.locator('.news-summary-text'),toggle=summary.locator('.news-summary-toggle');
          const collapsed=await preview.evaluate(el=>({height:el.getBoundingClientRect().height,full:el.scrollHeight,line:parseFloat(getComputedStyle(el).lineHeight)}));
          ok(`${width}px: summary starts near three lines while retaining every source-checked sentence`,
            collapsed.height<=collapsed.line*3+12 && collapsed.full>collapsed.height &&
            await toggle.getAttribute('aria-expanded')==='false' &&
            JSON.stringify(await preview.locator('p').allTextContents())===JSON.stringify(summaries.items[0].summaryKo));
          await toggle.focus();
          await p.keyboard.press('Enter');
          ok(`${width}px: keyboard expands the full summary with a correctly associated toggle`,
            await toggle.getAttribute('aria-expanded')==='true' && await toggle.innerText()==='요약 접기' &&
            await toggle.getAttribute('aria-controls')===await preview.getAttribute('id') &&
            await preview.evaluate(el=>el.getBoundingClientRect().height)>collapsed.height &&
            await toggle.evaluate(el=>el===document.activeElement));
          await p.keyboard.press('Space');
          ok(`${width}px: keyboard can collapse the same summary without losing text or focus`,
            await toggle.getAttribute('aria-expanded')==='false' && await toggle.innerText()==='요약 더보기' &&
            Math.abs(await preview.evaluate(el=>el.getBoundingClientRect().height)-collapsed.height)<1 &&
            await preview.locator('p').count()===summaries.items[0].summaryKo.length && await toggle.evaluate(el=>el===document.activeElement));
          ok(`${width}px: reload remains a single unwrapped button`,await p.locator('#reloadNews').evaluate(el=>{
            const range=document.createRange();range.selectNodeContents(el);
            return range.getClientRects().length===1 && getComputedStyle(el).whiteSpace==='nowrap';
          }));
        }
      }
      await p.locator('[data-source=esa]').click();
      await p.waitForFunction(()=>document.querySelectorAll('.news-article').length===1);
      ok('source filtering retains the correct image and credit',await p.locator('.news-image-credit a').first().getAttribute('href')===items[1].url);
      await p.locator('[data-source=all]').click();
      await p.waitForFunction(()=>document.querySelectorAll('.news-article').length===3);
      assert.deepEqual(await p.locator('.news-article').evaluateAll(rows=>rows.map(row=>row.id)),initialOrder);
      f.state.data.items=f.state.data.items.slice(1);
      await p.locator('#reloadNews').click();
      await p.waitForFunction(()=>document.querySelectorAll('.news-article').length===2);
      ok('refresh updates article membership without attaching an old image to a new row',
        await p.locator('.news-thumbnail img').count()===1 && await p.locator('.news-image-credit a').first().getAttribute('href')===items[1].url);
    } finally {await f.close();}
  }
  {
    let release;
    const state={gate:new Promise(resolve=>{release=resolve;})},f=await open(state),p=f.page;
    try {
      ok('a pending image manifest does not block the readable news list or reload button',
        await p.locator('.news-article').count()===3 && await p.locator('#reloadNews').isEnabled() && await p.locator('.news-thumbnail').count()===0);
      const original=p.locator('.news-original summary').first();
      await original.click();
      await original.focus();
      release();
      await p.locator('.news-thumbnail').first().waitFor();
      ok('late imagery preserves expanded original headlines and keyboard focus',
        await p.locator('.news-original').first().getAttribute('open')!==null && await original.evaluate(el=>el===document.activeElement));
    } finally {release();await f.close();}
  }
  for(const state of [{mapFailure:true},{map:{version:1,images:[]}}]) {
    const f=await open(state);
    try {ok('missing or malformed optional manifest leaves all original article links readable',
      await f.page.locator('.news-thumbnail').count()===0 && await f.page.locator('.news-links a').count()===3);} finally {await f.close();}
  }
  {
    const f=await open({broken:mapping.images[items[0].id].src}),p=f.page;
    try {
      await p.locator('#article-'+items[1].id+' .news-thumbnail').waitFor();
      await p.waitForFunction(()=>!document.querySelector('#article-1111111111111111 .news-thumbnail'));
      ok('a missing image removes its reserved column and credit, retaining the full readable article',
        !await p.locator('#article-'+items[0].id).evaluate(el=>el.classList.contains('news-article-imaged')) &&
        await p.locator('#article-'+items[0].id+' .row-title').isVisible() && await p.locator('#article-'+items[0].id+' .news-image-credit').count()===0);
      const attempts=f.state.requests.filter(path=>path===mapping.images[items[0].id].src).length;
      await p.locator('[data-source=nasa]').click();
      await p.waitForFunction(()=>document.querySelectorAll('.news-article').length===2);
      ok('filter rerenders do not keep retrying a known missing image',await p.locator('.news-thumbnail').count()===0 &&
        f.state.requests.filter(path=>path===mapping.images[items[0].id].src).length===attempts);
    } finally {await f.close();}
  }
  for(const unsafe of [
    {src:'https://untrusted.test/photo.webp'},
    {src:'/images/news/../private.webp'},
    {src:'/images/news/%2e%2e/private.webp'},
    {sourceUrl:'javascript:alert(1)'},
    {sourceUrl:items[1].url},
    {alt:{text:'not a string'}},
  ]) {
    const map=structuredClone(mapping);
    Object.assign(map.images[items[0].id],unsafe);
    const f=await open({map});
    try {
      await f.page.locator('#article-'+items[1].id+' .news-thumbnail').waitFor();
      ok('unsafe paths, mismatched sources or malformed metadata are skipped without affecting other rows',
        await f.page.locator('#article-'+items[0].id+' .news-thumbnail').count()===0 && await f.page.locator('.news-article').count()===3);
    } finally {await f.close();}
  }
  {
    const map=structuredClone(mapping),entry=map.images[items[0].id];
    entry.alt='관측 자료 " onload="window.injected=true';
    entry.credit='<img src=x onerror="window.injected=true"> & NASA';
    entry.licenseUrl='javascript:alert(1)';
    const f=await open({map});
    try {
      await f.page.locator('.news-thumbnail').first().waitFor();
      ok('credit and alt metadata are rendered as literal text rather than executable markup',
        await f.page.locator('.news-thumbnail img').first().getAttribute('alt')===entry.alt &&
        (await f.page.locator('.news-image-credit').first().innerText()).includes(entry.credit) &&
        await f.page.locator('.news-image-credit img, [onload], [onerror]').count()===0 && !await f.page.evaluate(()=>window.injected));
      ok('unsafe optional license URLs are omitted without discarding a valid image',
        await f.page.locator('#article-'+items[0].id+' .news-thumbnail').count()===1 &&
        await f.page.locator('#article-'+items[0].id+' .news-image-license').count()===0);
    } finally {await f.close();}
  }
  console.log(`News images: ${checks} checks passed`);
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
