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
const images=JSON.parse(await readFile(resolve(root,'data/story-images.json'),'utf8'));
const articles=await Promise.all(ledger.items.map(async item=>JSON.parse(await readFile(resolve(root,`_editorial/articles/${item.id}.json`),'utf8'))));
const articlesById=new Map(articles.map(article=>[article.id,article]));
const categories=['달과 행성','별과 우주','우주 탐사','관측 이야기'];
const firstStory=[...ledger.items].sort((a,b)=>a.date.localeCompare(b.date))[0];
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.webp':'image/webp','.avif':'image/avif'};
const server=createServer(async(req,res)=>{
 const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
 try{res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}
 catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();let count=0;
const ok=(name,value)=>{assert.ok(value,name);count++;console.log('✓ '+name);};
const storyId=href=>new URL(href,base).pathname.split('/').pop().replace(/\.html$/,'');
const visibleStoryIds=page=>page.locator('[data-story-search]:visible').evaluateAll(rows=>rows.map(row=>row.querySelector('a[href]').getAttribute('href'))).then(hrefs=>hrefs.map(storyId));
async function waitForCover(page,cover){
 // Scrolling lazy srcset images into view can replace the pending source. Poll
 // until the selected source finishes decoding rather than racing that change.
 await page.waitForFunction(async img=>{
  const src=img.currentSrc;
  if(!src||!img.complete||!img.naturalWidth)return false;
  try{await img.decode();return img.currentSrc===src&&img.complete&&img.naturalWidth>0;}
  catch{return false;}
 },await cover.elementHandle(),{timeout:5000});
}
function expectedStories(category='',query=''){
 const needle=query.trim().toLocaleLowerCase('ko-KR');
 return articles.filter(a=>(!category||a.category===category)&&[a.title,a.summary,a.category,...a.sections.flatMap(section=>section.paragraphs)].join(' ').toLocaleLowerCase('ko-KR').includes(needle)).map(a=>a.id).sort();
}
async function checkStoryResults(page,category='',query=''){
 const visible=await visibleStoryIds(page),expected=expectedStories(category,query);
 ok(`filter ${category||'전체'} / search ${query||'(empty)'} shows exactly the matching published stories`,JSON.stringify([...visible].sort())===JSON.stringify(expected)&&new Set(visible).size===visible.length);
 const status=await page.locator('#storyCount').textContent();
 ok('result status identifies category, search and exact count',status.includes(category||'전체')&&(!query||status.includes(query.trim()))&&new RegExp(`(?:^|\\D)${expected.length}편$`).test(status));
 ok('only the chosen filter is pressed',await page.locator('.story-filter[aria-pressed="true"]').count()===1&&await page.locator('.story-filter[aria-pressed="true"]').getAttribute('data-story-category')===category);
}
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
   if(path==='stories.html'){
    const cover=page.locator('.story-feature .story-cover');
    await waitForCover(page,cover);
    const hero=await cover.boundingBox();
    const featureCopy=await page.locator('.story-feature-copy').boundingBox();
    const cards=await page.locator('.story-card').evaluateAll(els=>els.slice(0,2).map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
    ok(`hero keeps its wide image at ${width}px`,Math.abs(hero.width/hero.height-16/9)<0.01&&await cover.evaluate(img=>img.naturalWidth>0&&img.alt.length>0));
    ok(`feature copy fits ${width>=1200?'beside':'below'} its image at ${width}px`,width>=1200?hero.x+hero.width<=featureCopy.x+1:hero.y+hero.height<=featureCopy.y+1);
    if(width>=1200){
     const headline=await page.locator('#latestStoryTitle').boundingBox();
     ok('desktop headline appears in the first viewport',headline.y+headline.height<900);
    }
    ok(`cards use ${width<=600?'one':'two'} columns at ${width}px`,width<=600?Math.abs(cards[0].x-cards[1].x)<1&&cards[1].y>=cards[0].y+cards[0].height:Math.abs(cards[0].y-cards[1].y)<1&&cards[1].x>=cards[0].x+cards[0].width);
    ok('each published story has exactly one searchable cover',await page.locator('[data-story-search] .story-cover').count()===ledger.items.length&&await page.locator('.story-card').count()===ledger.items.length-1);
    const listed=await visibleStoryIds(page);
    ok('featured and regular cards list each published story exactly once',new Set(listed).size===ledger.items.length&&articles.every(a=>listed.includes(a.id)));
    ok(`topic filters have readable touch targets at ${width}px`,await page.locator('.story-filter').evaluateAll(buttons=>buttons.length===5&&buttons.every(button=>{const r=button.getBoundingClientRect();return r.height>=44&&r.width>=44;})));
    for(const image of await page.locator('.story-card .story-cover').all()){
     await image.scrollIntoViewIfNeeded();
     await waitForCover(page,image);
    }
    ok('every local cover loads with meaningful alt text',await page.locator('.story-cover').evaluateAll(imgs=>imgs.every(img=>img.complete&&img.naturalWidth>0&&img.alt.length>0)));
    await page.evaluate(()=>scrollTo(0,0));
   }else if(path.startsWith('stories/')){
    const image=page.locator('.story-article-cover .story-cover');
    await waitForCover(page,image);
    ok(`${path} resolves its relative cover`,await image.evaluate(img=>img.naturalWidth>0)&&await page.locator('.story-article-cover figcaption').isVisible());
    const article=articlesById.get(storyId(path));
    const related=page.locator('.story-related-card');
    const recommended=await related.evaluateAll(cards=>cards.map(card=>({href:card.getAttribute('href'),tag:card.tagName,tabIndex:card.tabIndex,title:card.querySelector('h3')?.textContent,summary:card.querySelector('.story-related-copy p')?.textContent,category:card.querySelector('.story-tag')?.textContent,nested:card.querySelectorAll('a,button,input').length})));
    const recommendedIds=recommended.map(card=>storyId(card.href));
    ok(`${path} recommends 2–3 distinct published stories without itself`,recommended.length>=2&&recommended.length<=3&&new Set(recommendedIds).size===recommended.length&&new Set(recommended.map(card=>card.title)).size===recommended.length&&recommended.every(card=>card.title!==article.title)&&recommendedIds.every(id=>id!==article.id&&articlesById.has(id)));
    ok(`${path} gives each related card one complete, named keyboard link`,recommended.every(card=>card.tag==='A'&&card.tabIndex===0&&!card.nested&&card.title===articlesById.get(storyId(card.href)).title&&card.summary===articlesById.get(storyId(card.href)).summary)&&await related.evaluateAll(cards=>cards.every(card=>document.getElementById(card.getAttribute('aria-labelledby'))?.textContent===card.querySelector('h3').textContent)));
    const sameCategory=articles.filter(a=>a.id!==article.id&&a.category===article.category).length;
    ok(`${path} prioritizes the current category`,recommended.slice(0,Math.min(sameCategory,recommended.length)).every(card=>card.category===article.category));
    for(const cover of await related.locator('.story-cover').all()){
     await cover.scrollIntoViewIfNeeded();await waitForCover(page,cover);
    }
    ok(`${path} related covers load and cards stay within ${width}px`,await related.evaluateAll(cards=>cards.every(card=>{const img=card.querySelector('img'),r=card.getBoundingClientRect();return img?.naturalWidth>0&&img.alt.length>0&&r.left>=0&&r.right<=innerWidth+1;})));
    const relatedColumns=width<=600?1:width<=1080?2:3;
    ok(`${path} uses ${relatedColumns} readable related-card columns at ${width}px`,await related.evaluateAll((cards,columns)=>{const boxes=cards.map(card=>card.getBoundingClientRect());return boxes.filter(box=>Math.abs(box.y-boxes[0].y)<1).length===Math.min(columns,boxes.length);},relatedColumns));
    const toolBox=await page.locator('.story-next').boundingBox(),relatedBox=await page.locator('.story-related').boundingBox();
    ok(`${path} places recommendations below the observation connection`,relatedBox.y>=toolBox.y+toolBox.height);
    if(width===390){
     const key=images.articles[article.id]||images.categories[article.category];
     const canonical=`https://orbithere.com/stories/${article.id}.html`,shareImage=`https://orbithere.com/images/stories/${key}-1200.webp`;
     ok(`${path} title and canonical identify the article`,await page.title()===article.title+' | ORBIT'&&await page.locator('h1').textContent()===article.title&&await page.locator('link[rel="canonical"]').getAttribute('href')===canonical);
     for(const [selector,expected] of [
      ['meta[name="description"]',article.summary],['meta[property="og:title"]',article.title],['meta[property="og:description"]',article.summary],['meta[property="og:url"]',canonical],['meta[property="og:type"]','article'],
      ['meta[property="og:image"]',shareImage],['meta[property="og:image:width"]','1200'],['meta[property="og:image:height"]','675'],['meta[property="og:image:type"]','image/webp'],['meta[property="og:image:alt"]',images.images[key].alt],
      ['meta[name="twitter:card"]','summary_large_image'],['meta[name="twitter:title"]',article.title],['meta[name="twitter:description"]',article.summary],['meta[name="twitter:image"]',shareImage],['meta[name="twitter:image:alt"]',images.images[key].alt]
     ])ok(`${path} has matching ${selector}`,await page.locator(selector).count()===1&&await page.locator(selector).getAttribute('content')===expected);
     const schema=JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
     ok(`${path} structured data matches its article and cover`,schema.headline===article.title&&schema.description===article.summary&&schema.url===canonical&&schema.image===shareImage);
     ok(`${path} serves the declared 1200px share image`,await page.evaluate(async path=>{const img=new Image();img.src=path;await img.decode();return img.naturalWidth===1200&&img.naturalHeight===675;},new URL(shareImage).pathname));
    }
    if(process.env.ORBIT_QA_DIR&&[390,1440].includes(width)&&article.id===firstStory.id){
     await mkdir(process.env.ORBIT_QA_DIR,{recursive:true});await page.locator('.story-related').scrollIntoViewIfNeeded();
     await page.screenshot({path:`${process.env.ORBIT_QA_DIR}/story-related-${width}.png`});
    }
    await page.evaluate(()=>scrollTo(0,0));
   }
   if(process.env.ORBIT_QA_DIR&&[390,1440].includes(width)){
    await mkdir(process.env.ORBIT_QA_DIR,{recursive:true});
    await page.screenshot({path:`${process.env.ORBIT_QA_DIR}/${path.replaceAll('/','-')}-${width}.png`,fullPage:path==='stories.html'});
   }
  }
  await page.goto(base+'/main.html');await page.locator('#panel-planets.on').waitFor();
  // The planet iframe reports its height asynchronously. Capture both siblings
  // in one layout snapshot so a resize between two RPCs cannot fake an overlap.
  const {box,panel}=await page.evaluate(()=>({
   box:document.querySelector('.story-teaser').getBoundingClientRect().toJSON(),
   panel:document.querySelector('#panel-planets').getBoundingClientRect().toJSON(),
  }));
  ok(`main teaser follows the tool at ${width}px`,panel.y+panel.height<=box.y+1);
  if(width===1440){
   await page.locator('.news-brief-title').first().waitFor();
   const rail=await page.locator('.news-brief--rail').boundingBox();
   const about=await page.locator('#sideNav a[href="about.html"]').boundingBox();
   ok('news sits below the left menu without reducing teaser or tool width',rail.x+rail.width<=box.x&&rail.y>=about.y+about.height&&Math.abs(box.x+box.width-panel.x-panel.width)<2);
  }
  if(process.env.ORBIT_QA_DIR&&[390,1440].includes(width))await page.screenshot({path:`${process.env.ORBIT_QA_DIR}/main-${width}.png`});
  await page.goto(base+'/index.html');
  ok(`community home keeps the story archive reachable at ${width}px`,await page.locator('#sideNav a[href="stories.html"]').isVisible());
  ok(`community home fits ${width}px`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  ok('no browser errors',errors.length===0);await context.close();
 }
 {
  const {context,page,sent}=await fixture();
  await page.goto(base+'/stories.html');
  const filters=page.getByRole('group',{name:'이야기 주제'}),search=page.getByRole('searchbox');
  ok('all five topic choices have native button semantics',await filters.getByRole('button').allTextContents().then(labels=>JSON.stringify(labels)===JSON.stringify(['전체',...categories]))&&await filters.getByRole('button').evaluateAll(buttons=>buttons.every(button=>button.tagName==='BUTTON'&&button.type==='button'&&button.getAttribute('aria-controls')==='storyResults')));
  ok('result changes have a polite, atomic status announcement',await page.locator('#storyCount').getAttribute('role')==='status'&&await page.locator('#storyCount').getAttribute('aria-live')==='polite'&&await page.locator('#storyCount').getAttribute('aria-atomic')==='true');
  for(const category of ['',...categories]){
   await filters.getByRole('button',{name:category||'전체',exact:true}).click();
   await search.fill('');await checkStoryResults(page,category);
   await search.fill('달');await checkStoryResults(page,category,'달');
  }
  await search.fill('');await filters.getByRole('button',{name:'전체',exact:true}).click();
  await search.focus();await page.keyboard.press('Tab');
  ok('Tab reaches the first filter after search',await filters.getByRole('button',{name:'전체',exact:true}).evaluate(button=>button===document.activeElement));
  await page.keyboard.press('Tab');await page.keyboard.press('Space');
  await checkStoryResults(page,categories[0]);
  ok('keyboard-selected filter has visible focus',await page.locator('.story-filter:focus-visible').count()===1&&await page.locator('.story-filter:focus-visible').evaluate(button=>getComputedStyle(button).outlineStyle!=='none'));
  await page.keyboard.press('Tab');await page.keyboard.press('Enter');await checkStoryResults(page,categories[1]);
  await filters.getByRole('button',{name:'전체',exact:true}).click();
  const latestTitle=await page.locator('#latestStoryTitle').textContent();
  const latestCategory=await page.locator('.story-feature').getAttribute('data-story-category');
  await search.fill(latestTitle);await checkStoryResults(page,'',latestTitle);
  ok('latest story appears once when searched, without an empty grid',await page.locator('[data-story-search]:visible').count()===1&&await page.locator('.story-feature').isVisible()&&!await page.locator('.story-grid').isVisible());
  await filters.getByRole('button',{name:latestCategory,exact:true}).click();await checkStoryResults(page,latestCategory,latestTitle);
  const otherCategory=categories.find(category=>category!==latestCategory);
  await filters.getByRole('button',{name:otherCategory,exact:true}).click();await checkStoryResults(page,otherCategory,latestTitle);
  ok('featured story is excluded when only its search text matches',!await page.locator('.story-feature').isVisible()&&await page.locator('#storyEmpty').isVisible());
  const regular=articles.find(article=>article.category===otherCategory);
  await search.fill(regular.title);await checkStoryResults(page,otherCategory,regular.title);
  ok('a matching regular card remains when the feature does not match',await page.locator('.story-card:visible').count()===1&&!await page.locator('.story-feature').isVisible());
  if(process.env.ORBIT_QA_DIR){
   await mkdir(process.env.ORBIT_QA_DIR,{recursive:true});await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:`${process.env.ORBIT_QA_DIR}/story-filter-search-390.png`,fullPage:true});
  }
  await search.fill('없는검색어-SEARCH-PRIVATE');await checkStoryResults(page,otherCategory,'없는검색어-SEARCH-PRIVATE');
  ok('no-match search explains both the chosen topic and query',await page.locator('#storyEmpty').isVisible()&&!await page.locator('.story-feature').isVisible()&&(await page.locator('#storyEmptyMessage').textContent()).includes(otherCategory)&&(await page.locator('#storyEmptyMessage').textContent()).includes('없는검색어-SEARCH-PRIVATE'));
  await page.getByRole('button',{name:'검색과 분류 초기화',exact:true}).click();await checkStoryResults(page);
  ok('empty state reset clears both controls and returns focus to search',await search.inputValue()===''&&!await page.locator('#storyEmpty').isVisible()&&await search.evaluate(input=>input===document.activeElement));
  await search.fill('달과 행성');
  ok('category words find stories',await page.locator('[data-story-search]:visible').count()>=1);
  await search.fill('동주기');
  ok('full article text is searchable',await page.locator('[data-story-search]:visible').count()>=1);
  await search.fill('');
  await page.locator('.story-row').getByRole('link',{name:seed.title+' 읽기',exact:true}).click();
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
  const {context,page}=await fixture();
  await page.goto(base+`/stories/${firstStory.id}.html`);
  const related=page.locator('.story-related-card');
  await page.locator('.story-sources a').last().focus();await page.keyboard.press('Tab');
  ok('Tab reaches the related whole-card link after the article references',await related.first().evaluate(link=>link===document.activeElement));
  await page.keyboard.press('Tab');
  ok('one Tab advances to the next card with a visible focus outline',await related.nth(1).evaluate(link=>link===document.activeElement&&link.matches(':focus-visible')&&getComputedStyle(link).outlineStyle!=='none'));
  const destination=await related.nth(1).getAttribute('href');await page.keyboard.press('Enter');await page.waitForURL(base+'/stories/'+destination);
  ok('keyboard activation opens the recommended article',await page.locator('h1').textContent()===articlesById.get(storyId(destination)).title);
  await page.goBack();
  await related.first().locator('.story-cover').click();
  ok('the related cover itself opens its article',await page.locator('h1').textContent()!==articlesById.get(firstStory.id).title&&new URL(page.url()).pathname.startsWith('/stories/'));
  await context.close();
 }
 {
  const {context,page}=await fixture({javaScriptEnabled:false});
  await page.goto(base+'/index.html');
  ok('no-JS home keeps the story archive reachable',await page.locator('#sideNav a[href="stories.html"]').isVisible());
  await page.goto(base+'/stories.html');
  ok('stories work without JavaScript',await page.getByRole('link',{name:'이야기 읽기',exact:true}).isVisible()&&!await page.locator('.story-search').isVisible()&&!await page.locator('.story-filters').isVisible());
  await page.getByRole('link',{name:'이야기 읽기',exact:true}).click();
  ok('article body and sources are static HTML',await page.locator('.story-body').isVisible()&&await page.locator('.story-sources li').count()>=1);
  ok('related stories are available without JavaScript',await page.locator('.story-related-card').count()>=2&&await page.locator('.story-related-card').first().isVisible());
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
