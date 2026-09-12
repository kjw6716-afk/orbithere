// Verify real reading, sharing, navigation and recovery of legacy private notes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('..',import.meta.url));
const seed=JSON.parse(await readFile(resolve(root,'_editorial/articles/moon-face-and-phases.json'),'utf8'));
const ledger=JSON.parse(await readFile(resolve(root,'_editorial/published.json'),'utf8'));
const latest=[...ledger.items].reverse().sort((a,b)=>b.date.localeCompare(a.date))[0];
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root.replace(/\/$/,'')+sep)){res.writeHead(403);res.end();return;}
 try{res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}
 catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();let count=0;
const ok=(name,value)=>{assert.ok(value,name);count++;console.log('✓ '+name);};
async function fixture(options={}){
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',...options});
 const sent=[],errors=[];
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());
  sent.push({url:u.href,body:route.request().postData()});
  if(process.env.ORBIT_QA_FONT&&u.pathname.includes('pretendard-dynamic')) return route.fulfill({contentType:'text/css',body:'@font-face{font-family:Pretendard;src:url(/qa-font.woff2)}'});
  if(process.env.ORBIT_QA_FONT&&u.pathname==='/qa-font.woff2') return route.fulfill({contentType:'font/woff2',path:process.env.ORBIT_QA_FONT});
  if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes('@supabase/supabase-js@')) return route.fulfill({contentType:'text/javascript',path:resolve(root,'node_modules/@supabase/supabase-js/dist/umd/supabase.js')});
  if(u.hostname.endsWith('.supabase.co')) return route.fulfill({contentType:'application/json',body:u.pathname.endsWith('/board_version')?'1':u.pathname.endsWith('/board_posts')?'[]':'null'});
  return u.origin===base?route.continue():route.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 return {context,page,sent,errors};
}
try{
 for(const width of [320,390,860,1440]){
  const {context,page,errors}=await fixture({viewport:{width,height:900}});
  for(const path of ['stories.html',...ledger.items.map(i=>`stories/${i.id}.html`),'notes.html']){
   await page.goto(base+'/'+path);await page.locator('.orbit-navigation.enhanced').waitFor();
   ok(`${path} fits ${width}px`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   ok(`${path} offers stories instead of note creation`,await page.locator('#sideNav a[href$="stories.html"]').count()===1&&await page.locator('#sideNav a[href$="notes.html"]').count()===0);
   if(process.env.ORBIT_QA_DIR&&[390,1440].includes(width)){
    await mkdir(process.env.ORBIT_QA_DIR,{recursive:true});
    await page.screenshot({path:`${process.env.ORBIT_QA_DIR}/${path.replaceAll('/','-')}-${width}.png`,fullPage:path==='stories.html'});
   }
  }
  await page.goto(base+'/main.html');await page.locator('#panel-planets.on').waitFor();
  const box=await page.locator('.story-teaser').boundingBox(),panel=await page.locator('#panel-planets').boundingBox();
  ok(`main teaser sits above the tool at ${width}px`,box.y+box.height<=panel.y+1);
  if(width===1440){
   await page.locator('.news-brief-title').first().waitFor();
   const rail=await page.locator('.news-brief--rail').boundingBox();
   ok('news panel remains alongside the teaser and tool',rail.x>=box.x+box.width&&Math.abs(rail.y-box.y)<2);
  }
  if(process.env.ORBIT_QA_DIR&&[390,1440].includes(width))await page.screenshot({path:`${process.env.ORBIT_QA_DIR}/main-${width}.png`});
  await page.goto(base+'/index.html');
  const current=page.locator('.story-slide.is-current .story-teaser-title');
  ok(`landing links directly to latest story at ${width}px`,await current.isVisible()&&(await current.getAttribute('href')).includes(latest.id));
  ok(`carousel fits ${width}px`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  ok('story dates are absent from the teaser',await page.locator('.story-teaser time').count()===0);
  if(process.env.ORBIT_QA_DIR&&[390,1440].includes(width))await page.screenshot({path:`${process.env.ORBIT_QA_DIR}/index-${width}.png`});
  ok('no browser errors',errors.length===0);await context.close();
 }
 {
  const {context,page,errors}=await fixture({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
  await page.clock.install();
  await page.goto(base+'/index.html');
  await page.locator('.story-carousel.enhanced').waitFor();
  await page.locator('.story-carousel').scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.locator('.story-carousel').hover();
  await page.mouse.move(0,0);
  const current=()=>page.locator('.story-slide.is-current a').getAttribute('href');
  const settle=()=>page.locator('.story-slides').evaluate(el=>el.getAnimations({subtree:true}).forEach(a=>a.finish()));
  const first=await current();
  const height=(await page.locator('.story-carousel').boundingBox()).height;
  await page.clock.runFor(3800);
  ok('story stays readable until the four-second interval',await current()===first);
  await page.clock.runFor(300);
  ok('automatic rotation shows another story after four seconds',await current()!==first);
  const frames=await page.locator('.story-slide.is-current').evaluate(el=>el.getAnimations()[0]?.effect.getKeyframes());
  ok('next story slides from left to right',frames?.[0].transform==='translateX(-110%)'&&/^translateX\(0(?:px|%)?\)$/.test(frames.at(-1).transform));
  await settle();
  ok('card height remains stable across titles',Math.abs((await page.locator('.story-carousel').boundingBox()).height-height)<1);
  await page.locator('.story-carousel').hover();const hovered=await current();
  await page.clock.runFor(9000);
  ok('hover pauses automatic rotation',await current()===hovered);
  await page.mouse.move(0,0);await page.clock.runFor(4100);await settle();
  ok('leaving hover resumes after a full interval',await current()!==hovered);
  await page.locator('.story-slide.is-current a').focus();const focused=await current();
  await page.clock.runFor(9000);
  ok('keyboard reading pauses rotation',await current()===focused);
  await page.keyboard.press('ArrowRight');await settle();
  ok('keyboard advances and keeps focus on the visible story',await page.locator('.story-slide.is-current a').evaluate(el=>el===document.activeElement));
  ok('inactive stories cannot receive keyboard focus',await page.locator('.story-slide:not(.is-current)').evaluateAll(els=>els.every(el=>el.inert&&el.getAttribute('aria-hidden')==='true'&&el.querySelector('a').tabIndex===-1)));
  await page.getByRole('button',{name:'이전 이야기',exact:true}).click();await settle();
  ok('previous arrow returns to the same story',await current()===focused);
  await page.getByRole('button',{name:'이야기 자동 넘김 시작',exact:true}).click();await page.mouse.move(0,0);
  await page.clock.runFor(4100);await settle();
  ok('explicit start resumes autoplay',await current()!==focused);
  await page.getByRole('button',{name:'이야기 자동 넘김 정지',exact:true}).click();await page.mouse.move(0,0);
  const stopped=await current();await page.clock.runFor(9000);
  ok('stop remains stopped after pointer leaves',await current()===stopped);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:'다음 이야기',exact:true}).click();
  const reducedState=await page.locator('.story-slides').evaluate(el=>({href:el.querySelector('.is-current a').getAttribute('href'),moves:el.getAnimations({subtree:true}).filter(a=>a.effect.getKeyframes().some(f=>f.transform)).length}));
  ok('reduced motion keeps manual controls without sliding',reducedState.href!==stopped&&reducedState.moves===0);
  ok('carousel has no script errors',errors.length===0);
  await context.close();
 }
 {
  const {context,page,sent}=await fixture();
  await page.goto(base+'/stories.html');
  await page.getByRole('searchbox').fill('없는검색어-SEARCH-PRIVATE');
  ok('no-match search explains the empty result',await page.locator('#storyEmpty').isVisible()&&(await page.locator('#storyCount').textContent())==='0편');
  await page.getByRole('searchbox').fill('달과 행성');
  ok('category words find stories',await page.locator('[data-story-search]:visible').count()>=1);
  await page.getByRole('searchbox').fill('동주기');
  ok('full article text is searchable',await page.locator('[data-story-search]:visible').count()>=1);
  await page.getByRole('searchbox').fill('');
  await page.locator('.story-row').getByRole('link',{name:seed.title,exact:true}).click();
  await page.locator('.story-article').waitFor();
  ok('list opens a readable standalone article',await page.locator('.story-body section').count()===seed.sections.length&&await page.locator('.story-sources li').count()===seed.sources.length);
  const src=await page.locator('.story-sources li a').first().getAttribute('href');
  ok('real NASA sources remain linked',src==='https://science.nasa.gov/moon/facts/');
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.getByRole('button',{name:'이야기 주소 복사'}).click();
  await page.locator('#shareStatus').filter({hasText:'복사했어요'}).waitFor();
  ok('share copies canonical article URL',await page.evaluate(()=>navigator.clipboard.readText())==='https://orbithere.com/stories/moon-face-and-phases.html');
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('denied'))},configurable:true}));
  await page.getByRole('button',{name:'이야기 주소 복사'}).click();
  await page.locator('#shareFallback').waitFor({state:'visible'});
  ok('copy failure provides selected URL',await page.locator('#shareFallback').evaluate(el=>el.selectionEnd===el.value.length));
  await page.goBack();
  ok('Back returns to story list',new URL(page.url()).pathname==='/stories.html');
  ok('search text never leaves the page',!JSON.stringify(sent).includes('SEARCH-PRIVATE'));
  await context.close();
 }
 {
  const {context,page}=await fixture({javaScriptEnabled:false});
  await page.goto(base+'/index.html');
  ok('no-JS landing keeps a readable story and archive link',await page.locator('.story-slide.is-current a').isVisible()&&await page.locator('.story-carousel .story-teaser-all').isVisible()&&await page.locator('.story-carousel button:visible').count()===0);
  await page.goto(base+'/stories.html');
  ok('stories work without JavaScript',await page.getByRole('link',{name:'이야기 읽기'}).isVisible()&&!await page.locator('.story-search').isVisible());
  await page.getByRole('link',{name:'이야기 읽기'}).click();
  ok('article body and sources are static HTML',await page.locator('.story-body').isVisible()&&await page.locator('.story-sources li').count()>=1);
  await context.close();
 }
 {
  const {context,page,sent}=await fixture();
  await page.goto(base+'/notes.html');
  ok('empty legacy page has no new writing form',await page.locator('form').count()===0&&!await page.locator('#showSavedNote').isVisible());
  const raw=JSON.stringify({version:1,fields:{target:'PRIVATE-NOTE <img src=x onerror=alert(1)> 달',when:'2026-09-12T21:30',place:'광주',equipment:'맨눈',result:'찾았어요',detail:'얇은 구름'}});
  await page.evaluate(raw=>localStorage.setItem('orbit_observation_draft',raw),raw);
  await page.reload();
  ok('saved record is not exposed on a shared device before opening',!await page.locator('#noteOutput').isVisible()&&await page.locator('#showSavedNote').isVisible());
  await page.getByRole('button',{name:'저장한 기록 확인'}).click();
  const text=await page.locator('#noteOutput').inputValue();
  ok('old fields survive retirement and HTML remains text',text.includes('PRIVATE-NOTE <img')&&text.includes('광주')&&await page.locator('#savedNoteActions img').count()===0);
  const ready=page.waitForEvent('download');await page.getByRole('button',{name:'텍스트로 내려받기'}).click();
  const downloaded=await ready;
  ok('real export contains the saved note', (await readFile(await downloaded.path(),'utf8')).replace(/^\uFEFF/,'')===text);
  ok('viewing and export preserve the original stored bytes',await page.evaluate(()=>localStorage.getItem('orbit_observation_draft'))===raw);
  page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'기기 저장본 삭제'}).click();
  ok('cancelled deletion leaves the saved record intact',await page.evaluate(()=>localStorage.getItem('orbit_observation_draft'))===raw);
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'기기 저장본 삭제'}).click();
  ok('confirmed deletion removes only the old note',await page.evaluate(()=>localStorage.getItem('orbit_observation_draft'))===null&&!await page.locator('#savedNoteActions').isVisible());
  await page.evaluate(()=>localStorage.setItem('orbit_observation_draft','damaged legacy record {PRIVATE-NOTE'));
  await page.reload();await page.getByRole('button',{name:'저장한 기록 확인'}).click();
  ok('malformed legacy data stays recoverable',await page.locator('#noteOutput').inputValue()==='damaged legacy record {PRIVATE-NOTE');
  ok('no saved observation text is sent over the network',!JSON.stringify(sent).includes('PRIVATE-NOTE'));
  await context.close();
 }
 {
  const {context,page}=await fixture();
  await page.addInitScript(()=>{Storage.prototype.getItem=function(){throw new DOMException('Denied','SecurityError');};});
  await page.goto(base+'/notes.html');
  ok('blocked storage explains recovery without a script crash',(await page.locator('#noteStatus').textContent()).includes('접근할 수 없어요'));
  await page.goto(base+'/stories/moon-face-and-phases.html');
  await page.evaluate(()=>document.documentElement.style.fontSize='32px');
  ok('enlarged reading text stays inside viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await context.close();
 }
 console.log(`Stories: ${count} checks passed`);
}finally{await browser.close();await new Promise(r=>server.close(r));}
