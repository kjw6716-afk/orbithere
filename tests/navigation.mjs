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
const pages={main:'오늘 밤 행성',sky:'밤하늘 달력',planets:'오늘 밤 행성',lounge:'별빛 게시판',news:'우주 뉴스',guide:'관측 가이드',notes:'관측 노트','reading-sky':'관측 가이드',about:'소개·문의',terms:null,privacy:null,admin:null};
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
      if(process.env.ORBIT_QA_DIR && ['news','notes','main'].includes(name) && [390,1440].includes(width)){
        await mkdir(process.env.ORBIT_QA_DIR,{recursive:true});
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
    ok('translated title is primary and original stays visible',await page.getByRole('link',{name:'우주 관측의 새 소식',exact:true}).count()===1 && await page.locator('.news-original [lang=en]').innerText()==='Original headline 0');
    ok('changed original and unsafe translation fall back',await page.getByRole('link',{name:'Original headline 1',exact:true}).count()===1 && await page.getByRole('link',{name:'Original headline 2',exact:true}).count()===1 && await page.locator('#newsList img').count()===0);
    ok('unreviewed draft is never published',await page.getByRole('link',{name:'Original headline 3',exact:true}).count()===1 && await page.getByText('검토하지 않은 번역 초안',{exact:true}).count()===0);
    await page.setViewportSize({width:1440,height:900});
    await page.goto(base+'/main.html');await page.locator('.news-brief-title').first().waitFor();
    ok('mini card uses the same Korean title and internal destination',await page.locator('.news-brief-title').first().innerText()==='우주 관측의 새 소식' && (await page.locator('.news-brief-title').first().getAttribute('href')).startsWith('news.html#article-'));
    await ctx.close();
  }
  console.log(`Navigation and Korean news: ${checks} checks passed`);
}finally{await browser.close();await new Promise(r=>server.close(r));}
