// Direct entry, shared menu state, keyboard recovery, embeds and Korean fallback.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('..', import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const server=createServer(async(req,res)=>{
  const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!path.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
  try{res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});res.end(await readFile(path));}
  catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();
let checks=0;
function ok(name,value=true){assert.ok(value,name);checks++;console.log('✓ '+name);}
const pages={main:'오늘 밤 행성',sky:'밤하늘 달력',planets:'오늘 밤 행성',lounge:'별빛 게시판',news:'우주 뉴스',guide:'관측 가이드',notes:null,stories:'우주 이야기','stories/moon-face-and-phases':'우주 이야기','reading-sky':'관측 가이드',about:'소개·문의',terms:null,privacy:null,admin:null};
async function context(options={}){
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',...options});
  await ctx.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.hostname==='cdn.jsdelivr.net' && u.pathname.includes('@supabase/supabase-js@'))
      return route.fulfill({contentType:'text/javascript',path:resolve(root,'node_modules/@supabase/supabase-js/dist/umd/supabase.js')});
    if(u.hostname.endsWith('.supabase.co'))
      return route.fulfill({contentType:'application/json',body:u.pathname.endsWith('/board_version')?'1':u.pathname.endsWith('/board_posts')?'[]':'null'});
    if(process.env.ORBIT_QA_FONT && u.pathname.includes('pretendard-dynamic'))
      return route.fulfill({contentType:'text/css',body:'@font-face{font-family:Pretendard;src:url(/qa-font.woff2)}'});
    if(process.env.ORBIT_QA_FONT && u.pathname==='/qa-font.woff2')
      return route.fulfill({contentType:'font/woff2',path:process.env.ORBIT_QA_FONT});
    return u.origin===base?route.continue():route.abort();
  });
  return ctx;
}
try{
  for(const width of [320,390,860,861,1440]){
    const ctx=await context({viewport:{width,height:900},isMobile:width<861});
    const page=await ctx.newPage();
    let reference;
    for(const [name,active] of Object.entries(pages)){
      await page.goto(`${base}/${name}.html`);
      await page.locator('.orbit-navigation.enhanced').waitFor();
      ok(`${name} ${width}px fits viewport`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      ok(`${name} has one shared logo/menu`,await page.locator('.orbit-brand').count()===1 && await page.locator('#sideNav .nav-item').count()===7);
      const selected=page.locator('#sideNav [aria-current="page"]');
      ok(`${name} marks current section`,active?(await selected.locator('.lbl').textContent()).trim()===active:await selected.count()===0);
      const logo=await page.locator('.orbit-brand').evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height,s.fontSize,s.color,s.fontFamily];});
      reference ??=logo;
      assert.deepEqual(logo,reference,`${name} shared logo geometry`);
      if(width<=860){
        await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
        const menu=page.locator('#sideNav');
        await menu.getByRole('link',{name:'소개·문의',exact:true}).focus();
        await page.keyboard.press('Escape');
        ok(`${name} Escape closes and restores focus`,await page.locator('#navToggle').evaluate(el=>el===document.activeElement&&el.getAttribute('aria-expanded')==='false'));
      }
      if(process.env.ORBIT_QA_DIR && ['news','notes','main','guide'].includes(name) && [390,1440].includes(width)){
        await mkdir(process.env.ORBIT_QA_DIR,{recursive:true});
        await page.evaluate(()=>document.fonts.ready);
        if(name==='guide')await page.locator('#choose-tonight').scrollIntoViewIfNeeded();
        if(name==='news'){
          await page.getByRole('link',{name:'SpaceX',exact:true}).click();
          await page.locator('.news-summary').first().waitFor();
        }
        await page.screenshot({path:`${process.env.ORBIT_QA_DIR}/${name}-${width}.png`});
      }
    }
    await ctx.close();
  }
  {
    const ctx=await context();const page=await ctx.newPage();
    await page.goto(base+'/news.html#nasa');
    await page.locator('.news-article').first().waitFor();
    await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
    await page.locator('#sideNav').getByRole('link',{name:'관측 가이드',exact:true}).click();
    await page.getByRole('heading',{name:'처음 별을 보는 밤',exact:true}).waitFor();
    await page.goBack();
    ok('Back restores the original news filter',new URL(page.url()).hash==='#nasa');
    for(const name of ['sky','planets','lounge','news']){
      await page.goto(`${base}/${name}.html?embed=1`);
      ok(`${name} embed has no duplicate menu`,!await page.locator('.orbit-navigation').isVisible());
    }
    await ctx.close();
  }
  {
    const ctx=await context({javaScriptEnabled:false});const page=await ctx.newPage();
    await page.goto(base+'/guide.html');
    ok('static mobile menu remains usable without JS',await page.locator('#sideNav').getByRole('link',{name:'우주 뉴스',exact:true}).isVisible());
    await ctx.close();
  }
  {
    const ctx=await context();const page=await ctx.newPage();
    const fixture=JSON.parse(await readFile(resolve(root,'data/news.json')));
    const english=fixture.items.filter(i=>i.language==='en').slice(0,4);
    english.forEach((item,n)=>Object.assign(item,{title:`Original headline ${n}`,titleKo:'우주 관측의 새 소식',titleKoOriginal:`Original headline ${n}`,titleKoMethod:'reviewed'}));
    english[1].titleKoOriginal='Older headline';
    english[2].titleKo='<img src=x onerror=alert(1)> 한글';
    delete english[3].titleKo;
    english[3].titleKoDraft='검토하지 않은 번역 초안';
    english[3].titleKoDraftOriginal=english[3].title;
    fixture.items=english;
    await ctx.route('**/data/news.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(fixture)}));
    await page.goto(base+'/news.html');await page.locator('.news-article').first().waitFor();
    await page.locator('.news-original summary').click();
    ok('translated title is primary and original stays visible',await page.getByRole('link',{name:'우주 관측의 새 소식',exact:true}).count()===1 && await page.locator('.news-original [lang=en]').innerText()==='Original headline 0');
    ok('changed original and unsafe translation fall back',await page.getByRole('link',{name:'Original headline 1',exact:true}).count()===1 && await page.getByRole('link',{name:'Original headline 2',exact:true}).count()===1 && await page.locator('#newsList img').count()===0);
    ok('unreviewed draft is never published',await page.getByRole('link',{name:'Original headline 3',exact:true}).count()===1 && await page.getByText('검토하지 않은 번역 초안',{exact:true}).count()===0);
    await page.setViewportSize({width:1440,height:900});
    await page.goto(base+'/main.html');await page.locator('.news-brief-title').first().waitFor();
    ok('mini card uses the same Korean title and internal destination',await page.locator('.news-brief-title').first().innerText()==='우주 관측의 새 소식' && (await page.locator('.news-brief-title').first().getAttribute('href')).startsWith('news.html#article-'));
    await ctx.close();
  }
  {
    const ctx=await context();const page=await ctx.newPage();
    const feed=JSON.parse(await readFile(resolve(root,'data/news.json')));
    const briefs=JSON.parse(await readFile(resolve(root,'data/news-summaries.json')));
    const row=briefs.items[0];const article=feed.items.find(i=>i.id===row.id);
    feed.items=[article];
    let summaryResponse={version:1,items:[row]}, summaryFailure=false;
    await ctx.route('**/data/news.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(feed)}));
    await ctx.route('**/data/news-summaries.json',r=>r.fulfill(summaryFailure?{status:503,body:'unavailable'}:{contentType:'application/json',body:JSON.stringify(summaryResponse)}));
    await page.goto(base+'/news.html');await page.locator('.news-summary p').first().waitFor();
    ok('checked Korean summary appears before a direct original link',await page.locator('.news-summary p').allTextContents().then(text=>JSON.stringify(text)===JSON.stringify(row.summaryKo)) && await page.getByRole('link',{name:'원문 읽기 ↗',exact:true}).getAttribute('href')===row.url);
    ok('source date is visible and translation proxy links are absent',await page.locator('.news-summary-date').innerText()==='자료 확인 '+row.checkedAt.replaceAll('-','.') && await page.locator('a[href*="translate.google"], a[href*="translate.goog"]').count()===0);
    const rejected=await page.evaluate(({article,row})=>[
      {titleOriginal:'A revised headline'}, {url:row.url+'?another-article'}, {publishedAt:'2000-01-01T00:00:00Z'},
      {summaryKo:['<img src=x onerror=alert(1)> 한글 내용', '다른 문장도 함께 들어 있습니다.']},
      {checkedAt:'2026-99-99'}, {checkedAt:'2026-02-30'}, {method:'draft'}, {summaryKo:['제목만 옮긴 한 문장입니다.']},
      {titleKo:'English only'}, {id:null}, {source:'unknown'}, {summaryKo:null}
    ].every(change=>window.OrbitNews.summaryFor(article,{version:1,items:[{...row,...change}]})===null),{article,row});
    ok('revised articles and malformed or unreviewed summaries are rejected',rejected);
    summaryFailure=true;await page.locator('#reloadNews').click();
    await page.waitForFunction(()=>!document.querySelector('#reloadNews').disabled);
    ok('summary refresh failure preserves an already readable brief',await page.locator('.news-summary p').count()===row.summaryKo.length);
    await page.reload();await page.locator('.news-article').first().waitFor();
    ok('first-load summary outage offers the original without a promised summary',await page.locator('.news-summary').count()===0 && !(await page.locator('#newsList').innerText()).includes('준비 중') && await page.getByRole('link',{name:'원문 읽기 ↗',exact:true}).isVisible());
    summaryFailure=false;summaryResponse={version:1,items:[null,{...row,method:'draft'}]};
    await page.locator('#reloadNews').click();await page.waitForFunction(()=>!document.querySelector('#reloadNews').disabled);
    ok('a malformed summary entry cannot break news rendering',await page.locator('.news-summary').count()===0 && await page.locator('.news-article').count()===1);
    feed.sources.forEach(s=>{s.status='ok';});
    feed.checkedAt='2026-09-13T00:00:00Z';
    await page.clock.setFixedTime(new Date('2026-09-13T04:00:00Z'));
    await page.locator('#reloadNews').click();await page.waitForFunction(()=>!document.querySelector('#reloadNews').disabled);
    ok('a four-hour-old list has no overdue notice',!(await page.locator('#newsStatus').textContent()).includes('4시간'));
    await page.clock.setFixedTime(new Date('2026-09-13T04:00:01Z'));
    await page.locator('#reloadNews').click();await page.waitForFunction(()=>!document.querySelector('#reloadNews').disabled);
    ok('an overdue collection is explained without hiding original links',(await page.locator('#newsStatus').innerText()).includes('4시간') && await page.getByRole('link',{name:'원문 읽기 ↗',exact:true}).isVisible());
    feed.checkedAt='2026-09-13T04:00:01Z';
    await page.locator('#reloadNews').click();await page.waitForFunction(()=>!document.querySelector('#reloadNews').disabled);
    ok('a refreshed collection clears the overdue notice',await page.locator('#newsStatus').isHidden());
    await ctx.close();
  }
  console.log(`Navigation and Korean news: ${checks} checks passed`);
}finally{await browser.close();await new Promise(r=>server.close(r));}
