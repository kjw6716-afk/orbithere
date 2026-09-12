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
const firstStory=[...ledger.items].sort((a,b)=>a.date.localeCompare(b.date))[0];
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
  const current=page.locator('[data-story-original] .story-belt-card').first();
  ok(`landing starts with the first story at ${width}px`,await current.isVisible()&&(await current.getAttribute('href')).includes(firstStory.id));
  ok(`carousel fits ${width}px`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  ok('story dates are absent from the teaser',await page.locator('.story-belt time').count()===0);
  if(process.env.ORBIT_QA_DIR&&[390,1440].includes(width))await page.screenshot({path:`${process.env.ORBIT_QA_DIR}/index-${width}.png`});
  ok('no browser errors',errors.length===0);await context.close();
 }
 {
  const {context,page,errors}=await fixture({viewport:{width:5120,height:1440},reducedMotion:'no-preference'});
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto(base+'/index.html');
  await page.locator('.story-belt.flowing').waitFor();
  const belt=page.locator('.story-belt'), track=page.locator('.story-belt-track');
  const first=page.locator('[data-story-original] .story-belt-card').first();
  const geometry=()=>belt.evaluate(el=>{
   const viewport=el.querySelector('.story-belt-viewport').getBoundingClientRect();
   return [...el.querySelectorAll('.story-belt-card')].map(card=>{
    const r=card.getBoundingClientRect();return {href:card.getAttribute('href'),x:r.x-viewport.x,width:r.width,height:r.height};
   }).filter(r=>r.x+r.width>0&&r.x<viewport.width);
  });
  const x=()=>track.evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
  const initial=await geometry(), view=await page.locator('.story-belt-viewport').boundingBox();
  const centerCard=initial.find(c=>Math.abs(c.x+c.width/2-view.width/2)<2);
  const full=initial.filter(c=>c.x>=0&&c.x+c.width<=view.width);
  ok('ultrawide starts with the first story centered among equal-sized cards',centerCard?.href.includes(firstStory.id)&&full.length>=13&&full.every(c=>c.width===340&&c.height===full[0].height));
  ok('ultrawide rail leaves only 32px at each edge',Math.abs(view.x-32)<1&&Math.abs(view.width-5056)<1);
  ok('there are no arrows or stop buttons',await belt.locator('button').count()===0);
  ok('every published story is on the original belt',await page.locator('[data-story-original] .story-belt-card').count()===ledger.items.length);
  const startX=await x();
  await page.clock.runFor(1000);const afterOne=await x();
  await page.clock.runFor(1000);const afterTwo=await x();
  ok('cards move slowly and continuously left to right',afterOne-startX>15&&afterOne-startX<25&&afterTwo-afterOne>15&&afterTwo-afterOne<25);
  await belt.hover();const held=await x();
  await page.clock.runFor(4000);
  ok('hover freezes the belt for reading',Math.abs(await x()-held)<0.01);
  await page.mouse.move(0,0);await page.clock.runFor(1000);
  ok('leaving the cards resumes the belt',await x()>held+15);
  const cycle=await page.locator('[data-story-original]').evaluate(el=>el.getBoundingClientRect().width);
  const phase=await first.evaluate((el,cycle)=>{
   const vp=el.closest('.story-belt-viewport').getBoundingClientRect(),r=el.getBoundingClientRect();
   return ((r.x+r.width/2-vp.x-vp.width/2)%cycle+cycle)%cycle;
  },cycle);
  await page.clock.runFor(Math.floor((cycle-phase)/20*1000)-40);
  const beforeWrap=await geometry();
  await page.clock.runFor(100);
  const afterWrap=await geometry();
  const covered=cards=>cards.length>0&&Math.min(...cards.map(c=>c.x))<19&&Math.max(...cards.map(c=>c.x+c.width))>view.width-19;
  const continuous=beforeWrap.filter(c=>c.x>20&&c.x+c.width<view.width-20).every(c=>afterWrap.some(n=>n.href===c.href&&Math.abs(n.x-c.x-2)<1));
  ok('the ultrawide loop keeps both edges filled without a backward jump',continuous&&covered(beforeWrap)&&covered(afterWrap));
  const last=page.locator('[data-story-original] .story-belt-card').last();
  await last.focus();
  const focusedX=await x(), focusedBox=await last.boundingBox();
  ok('keyboard focus centers the real link',Math.abs(focusedBox.x+focusedBox.width/2-view.x-view.width/2)<2);
  ok('both edges remain filled while the last original card has focus',covered(await geometry()));
  await page.clock.runFor(4000);
  ok('keyboard reading keeps the belt still',await x()===focusedX);
  ok('visual repeats are not duplicate keyboard stops',await page.locator('[data-story-clone]').evaluateAll(groups=>groups.every(g=>g.getAttribute('aria-hidden')==='true'&&[...g.querySelectorAll('a')].every(a=>a.tabIndex===-1))));
  await page.locator('.entry-secondary').focus();await page.clock.runFor(1000);
  ok('leaving keyboard focus resumes movement',await x()!==focusedX);
  for(const width of [1920,3440,2560,5120]){
   await page.setViewportSize({width,height:1440});await page.clock.runFor(100);
   await first.focus();
   const resized=await page.locator('.story-belt-viewport').boundingBox(), visible=await geometry();
   ok(`rail fills ${width}px after resizing without page overflow`,Math.abs(resized.x-32)<1&&Math.abs(resized.width-(width-64))<1&&Math.min(...visible.map(c=>c.x))<19&&Math.max(...visible.map(c=>c.x+c.width))>resized.width-19&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  await page.locator('.entry-secondary').focus();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('.story-belt.flowing').waitFor({state:'hidden'});
  await page.clock.runFor(100);
  ok('reduced motion provides one static scrollable copy of every story',!await belt.evaluate(el=>el.classList.contains('flowing'))&&await page.locator('[data-story-clone]').count()===0&&await page.locator('.story-belt-viewport').evaluate(el=>getComputedStyle(el).overflowX==='auto'));
  await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.story-belt.flowing').waitFor();await page.clock.runFor(100);
  await page.setViewportSize({width:390,height:844});await page.clock.runFor(100);
  ok('mobile belt stays within the page and shows neighboring cards',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)&&(await geometry()).length>=3);
  const mobileCard=page.locator('[data-story-original] .story-belt-card').first();
  await mobileCard.hover();
  const clickBox=await mobileCard.boundingBox(), href=await mobileCard.getAttribute('href');
  await page.mouse.move(clickBox.x+clickBox.width/2,clickBox.y+clickBox.height/2);await page.mouse.down();
  const pressed=await mobileCard.boundingBox();
  ok('pressing a card does not move the link away from the pointer',Math.abs(pressed.x-clickBox.x)<1);
  await page.mouse.up();
  await page.waitForURL(base+'/'+href);
  ok('a visible card opens its matching article',await page.locator('.story-article').isVisible());
  ok('belt has no script errors',errors.length===0);
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
  ok('no-JS landing keeps a readable story and archive link',await page.locator('[data-story-original] .story-belt-card').first().isVisible()&&await page.locator('.story-belt .story-teaser-all').isVisible()&&await page.locator('.story-belt button').count()===0);
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
