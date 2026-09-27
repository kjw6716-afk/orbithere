// Exercise the unified night menu through real links, tabs and browser history.
// Remote requests are mocked or blocked; this suite never contacts production.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try{res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}
  catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();
let checks=0;
function ok(name,value=true){assert.ok(value,name);checks++;console.log('✓ '+name);}

async function fixture(options={}){
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',serviceWorkers:'block',...options});
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('@supabase/supabase-js@'))
      return route.fulfill({contentType:'text/javascript',path:resolve(root,'node_modules/@supabase/supabase-js/dist/umd/supabase.js')});
    if(url.hostname.endsWith('.supabase.co'))
      return route.fulfill({contentType:'application/json',body:url.pathname.endsWith('/board_version')?'1':url.pathname.endsWith('/board_posts')?'[]':'null'});
    return url.origin===base?route.continue():route.abort();
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  return {context,page,errors};
}

const tab=(page,name)=>page.locator(`#nightTabs [data-night-panel="${name}"]`);
async function ready(page,name){
  await page.locator(`#panel-${name}.on`).waitFor();
  if(name==='planets')await page.frameLocator('#planetFrame').locator('#scrubRange').waitFor();
  if(name==='sky')await page.frameLocator('#skyFrame').locator('.ev').first().waitFor();
}
async function menu(page,selector){
  if(await page.locator('#navToggle').isVisible())await page.locator('#navToggle').click();
  await page.locator('#sideNav '+selector).click();
  await page.locator('#navScrim').waitFor({state:'hidden'});
}
async function expectNight(page,name,label){
  await ready(page,name);
  ok(label+' keeps the shared night heading',await page.locator('#nightHub').isVisible()&&(await page.locator('#panelTitleLink').innerText()).trim()==='밤하늘');
  ok(label+' selects exactly one matching tab',await page.locator('#nightTabs [role="tab"][aria-selected="true"]').count()===1&&await tab(page,name).getAttribute('aria-selected')==='true');
  ok(label+' keeps the standalone title destination',await page.locator('#panelTitleLink').getAttribute('href')===name+'.html');
  ok(label+' marks the shared menu as current',await page.locator('#sideNav [data-nav-group="night"]').getAttribute('aria-current')==='page');
  ok(label+' has only one active tool panel',await page.locator('.panel.on').count()===1&&new URL(page.url()).hash==='#'+name);
}

try{
  for(const width of [320,390,861,1440]){
    const {context,page,errors}=await fixture({viewport:{width,height:900},isMobile:width<861,hasTouch:width<861});
    await page.goto(base+'/main.html');
    await expectNight(page,'planets',`default ${width}px`);
    ok(`default ${width}px keeps the calendar unloaded`,!(await page.locator('#skyFrame').getAttribute('src')));
    ok(`default ${width}px has one hero and two accessible tabs`,await page.locator('#nightHub .night-hero').count()===1&&await page.locator('#nightTabs[role="tablist"] [role="tab"]').count()===2);
    ok(`default ${width}px preserves both plain link destinations`,await tab(page,'planets').getAttribute('href')==='planets.html'&&await tab(page,'sky').getAttribute('href')==='sky.html');
    ok(`default ${width}px fits the page`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    ok(`planet embed ${width}px has no repeated night header`,!await page.frameLocator('#planetFrame').locator('.night-hub').isVisible());
    ok(`planet embed ${width}px fits its own viewport`,await page.frameLocator('#planetFrame').locator('html').evaluate(el=>el.scrollWidth<=el.ownerDocument.defaultView.innerWidth+1));
    await tab(page,'sky').click();
    await expectNight(page,'sky',`calendar tab ${width}px`);
    ok(`calendar embed ${width}px has no repeated night header`,!await page.frameLocator('#skyFrame').locator('.night-hub').isVisible());
    ok(`calendar tab ${width}px fits the page and frame`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)&&await page.frameLocator('#skyFrame').locator('html').evaluate(el=>el.scrollWidth<=el.ownerDocument.defaultView.innerWidth+1));
    ok(`story teaser follows the active calendar at ${width}px`,await page.evaluate(()=>{
      const panel=document.querySelector('#panel-sky').getBoundingClientRect(),teaser=document.querySelector('.story-teaser').getBoundingClientRect();
      return panel.bottom<=teaser.top+1;
    }));
    await menu(page,'[data-panel="lounge"]');
    await ready(page,'lounge');
    ok(`board ${width}px hides night hero and tabs`,!await page.locator('#nightHub').isVisible()&&!await page.locator('#nightTabs').isVisible());
    ok(`board ${width}px keeps its own heading`,(await page.locator('#panelTitleLink').innerText()).trim()==='자유게시판');
    await page.goBack();await expectNight(page,'sky',`Back ${width}px`);
    await page.goForward();await ready(page,'lounge');
    ok(`Forward ${width}px restores the board without night controls`,new URL(page.url()).hash==='#lounge'&&!await page.locator('#nightHub').isVisible());
    await menu(page,'[data-nav-group="night"]');
    await expectNight(page,'planets',`night menu ${width}px`);
    ok(`night menu ${width}px closes the mobile drawer`,await page.locator('#navToggle').getAttribute('aria-expanded')==='false');
    ok(`navigation ${width}px has no script errors`,errors.length===0);
    await context.close();
  }

  {
    const {context,page,errors}=await fixture();
    for(const name of ['sky','planets']){
      await page.goto(base+'/main.html#'+name);
      await expectNight(page,name,'direct #'+name);
      await page.reload();
      await expectNight(page,name,'reload #'+name);
    }
    await page.goto(base+'/main.html#unknown-panel');
    await expectNight(page,'planets','unknown hash recovery');
    await tab(page,'planets').focus();
    for(const [key,name] of [['ArrowRight','sky'],['Home','planets'],['End','sky'],['ArrowLeft','planets']]){
      await page.keyboard.press(key);await ready(page,name);
      ok(key+' changes the selected tab and keeps keyboard focus',await tab(page,name).evaluate(el=>el===document.activeElement&&el.getAttribute('aria-selected')==='true'));
    }
    const historyLength=await page.evaluate(()=>history.length);
    await tab(page,'planets').click();
    ok('reselecting the active tab does not add a browser history step',await page.evaluate(()=>history.length)===historyLength);
    await page.goBack();await expectNight(page,'sky','keyboard history Back');
    await page.goForward();await expectNight(page,'planets','keyboard history Forward');
    ok('deep links and keyboard navigation have no script errors',errors.length===0);
    await context.close();
  }

  {
    const {context,page,errors}=await fixture({viewport:{width:320,height:900},isMobile:true,hasTouch:true});
    for(const name of ['planets','sky']){
      await page.goto(base+'/'+name+'.html');
      const hub=page.locator('.night-hub');
      await hub.waitFor();
      ok(name+' standalone shows one shared header',await hub.count()===1&&await hub.locator('.night-hero').count()===1);
      const selected=hub.locator('.night-tabs [aria-current="page"]');
      ok(name+' standalone marks its own destination',await selected.count()===1&&await selected.getAttribute('href')===name+'.html');
      ok(name+' standalone has two real navigation links',await hub.locator('.night-tabs a[href="planets.html"]').count()===1&&await hub.locator('.night-tabs a[href="sky.html"]').count()===1);
      ok(name+' standalone fits 320px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      const other=name==='planets'?'sky':'planets';
      await hub.locator(`.night-tabs a[href="${other}.html"]`).click();
      await page.waitForURL(base+'/'+other+'.html');
      ok(name+' standalone tab opens the other existing tool',await page.locator('.night-hub').isVisible());
      await page.goto(base+'/'+name+'.html?embed=1');
      ok(name+' direct embed hides both menu and shared header',!await page.locator('.orbit-navigation').isVisible()&&!await page.locator('.night-hub').isVisible());
    }
    ok('standalone and embed navigation have no script errors',errors.length===0);
    await context.close();
  }

  {
    const {context,page,errors}=await fixture();
    await page.clock.install({time:new Date('2026-09-27T12:00:00+09:00')});
    await page.goto(base+'/main.html#planets');
    await ready(page,'planets');
    await page.frameLocator('#planetFrame').locator('#nightEventPreview a').click();
    await expectNight(page,'sky','nearest event link');
    await page.frameLocator('#skyFrame').locator('#nxAlt').click();
    await expectNight(page,'planets','calendar planet link');
    ok('embedded action links keep the main shell',new URL(page.url()).pathname==='/main.html');
    await page.goBack();await expectNight(page,'sky','action link Back');
    ok('embedded action links have no script errors',errors.length===0);
    await context.close();
  }

  {
    const {context,page,errors}=await fixture();
    let blockedScheduleRequests=0;
    await context.route(url=>url.pathname==='/sky-events.js',route=>{blockedScheduleRequests++;return route.abort();});
    await page.goto(base+'/main.html#planets');
    await ready(page,'planets');
    const planet=page.frameLocator('#planetFrame');
    await planet.locator('html[data-orbit-tool-ready="planets"]').waitFor();
    ok('missing schedule fixture blocks the versioned planet request',blockedScheduleRequests===1&&await planet.locator('html').evaluate(()=>typeof window.OrbitSkyEvents==='undefined'));
    ok('missing schedule script keeps the planet map ready',await planet.locator('#skyMap').isVisible());
    ok('missing schedule script keeps a working schedule link',await planet.locator('#nightEventPreview a[href="sky.html"]').isVisible());
    await planet.locator('#nightEventPreview a').click();
    const calendar=page.frameLocator('#skyFrame');
    await calendar.locator('#nxName').filter({hasText:'천문 일정을 불러오지 못했습니다'}).waitFor();
    ok('missing schedule fixture blocks the versioned calendar request',blockedScheduleRequests===2&&await calendar.locator('html').evaluate(()=>typeof window.OrbitSkyEvents==='undefined'));
    ok('missing schedule script explains the calendar failure',await calendar.locator('#nxWhen').innerText().then(text=>text.includes('새로고침')));
    ok('missing schedule script keeps the moon panel',await calendar.locator('#moonVis svg').isVisible());
    ok('missing schedule script does not report calendar readiness',await calendar.locator('html').getAttribute('data-orbit-tool-ready')===null);
    ok('missing schedule script disables unusable filters',await calendar.locator('.fbtn:not([disabled])').count()===0);
    await calendar.locator('#nxAlt').click();
    await ready(page,'planets');
    ok('calendar failure fallback returns to the selected planet tab',await tab(page,'planets').getAttribute('aria-selected')==='true'&&new URL(page.url()).hash==='#planets');
    ok('missing schedule script causes no uncaught script errors',errors.length===0);
    await context.close();
  }

  {
    const {context,page}=await fixture({javaScriptEnabled:false,viewport:{width:390,height:844}});
    await page.goto(base+'/main.html');
    ok('main night tabs remain real visible links without JavaScript',await page.locator('#nightTabs a[href="planets.html"]').isVisible()&&await page.locator('#nightTabs a[href="sky.html"]').isVisible());
    await page.locator('#nightTabs a[href="sky.html"]').click();
    await page.waitForURL(base+'/sky.html');
    ok('no-JS main calendar link reaches the standalone tool',await page.locator('.night-hub .night-tabs a[href="planets.html"]').isVisible());
    await page.locator('.night-hub .night-tabs a[href="planets.html"]').click();
    await page.waitForURL(base+'/planets.html');
    ok('no-JS standalone link returns to the other tool',await page.locator('.night-hub').isVisible());
    await context.close();
  }
  console.log(`Night sky navigation: ${checks} checks passed`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
