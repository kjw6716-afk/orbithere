// Actual mobile viewport emulation catches layout expansion that width-only tests miss.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('..',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
 const full=resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
 if(!full.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
 try{res.writeHead(200,{'Content-Type':types[extname(full)]||'application/octet-stream'});res.end(await readFile(full));}
 catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();let checks=0;
function ok(name,value=true){assert.ok(value,name);checks++;console.log('✓ '+name);}
async function open(width,height,mobile=false,reducedMotion='no-preference',prepare){
 const ctx=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?3:1,reducedMotion});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(prepare)await prepare(page);
 await page.goto(base);return {ctx,page,errors};
}
try{
 {
  const {ctx,page,errors}=await open(390,844,true,'no-preference',async page=>{
   await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
   await page.addInitScript(()=>{Math.random=()=>0;});
  });
  await page.clock.fastForward(19900);
  ok('meteors leave at least twenty quiet seconds on entry',await page.locator('.meteor').count()===0);
  await page.clock.fastForward(200);
  ok('only one meteor appears after the quiet interval',await page.locator('.meteor').count()===1);
  const first=await page.locator('.meteor').evaluate(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top),duration:el.getAnimations()[0].effect.getTiming().duration}));
  ok('meteor starts inside the upper sky and is brief',first.x>0&&first.x<390&&first.y>0&&first.y<844*.31&&first.duration>=1600&&first.duration<=2400);
  ok('meteor motion cannot widen the mobile page',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.evaluate(()=>{Math.random=()=>0.999;});
  await page.locator('.meteor').evaluate(el=>el.getAnimations()[0].finish());
  await page.locator('.meteor').waitFor({state:'detached'});
  await page.clock.fastForward(44000);
  ok('next meteor waits for its own randomized interval',await page.locator('.meteor').count()===0);
  await page.clock.fastForward(1100);
  const second=await page.locator('.meteor').evaluate(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top)}));
  ok('later meteors use a different starting position',second.x>first.x+200&&second.y>first.y+100&&await page.locator('.meteor').count()===1);
  await page.evaluate(()=>{
   Object.defineProperty(document,'hidden',{configurable:true,value:true});
   document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(120000);
  ok('hidden tabs remove the meteor and do not accumulate flights',await page.locator('.meteor').count()===0);
  await page.evaluate(()=>{
   Math.random=()=>0;
   Object.defineProperty(document,'hidden',{configurable:true,value:false});
   document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(19900);
  ok('returning to the page starts a fresh quiet interval',await page.locator('.meteor').count()===0);
  await page.clock.fastForward(200);
  ok('resuming still allows just one meteor',await page.locator('.meteor').count()===1);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('.meteor').waitFor({state:'detached'});
  await page.clock.fastForward(120000);
  ok('reduced motion cancels both the current and future meteors',await page.locator('.meteor').count()===0);
  ok('meteor lifecycle has no script errors',errors.length===0);
  await ctx.close();
 }
 for(const [w,h,mobile] of [[412,800,true],[360,740,true],[768,1024,true],[1024,768,true],[1366,768,false],[1920,1080,false],[740,360,true]]){
  const {ctx,page,errors}=await open(w,h,mobile);
  await page.locator('.landing-nebula img').evaluate(img=>img.decode());
  ok('background image decodes and uses the matching viewport asset',await page.locator('.landing-nebula img').evaluate((img,small)=>
   img.naturalWidth>0&&img.currentSrc.endsWith(small?'nebula-landing-mobile.webp':'nebula-landing.webp'),w<=600));
  ok('the shared ORBIT wordmark is white',await page.locator('.orbit-brand').evaluate(el=>getComputedStyle(el).color==='rgb(255, 255, 255)'));
  for(const ms of [0,1900,3900,6100,7900]){
   const box=await page.evaluate(t=>{
    document.getAnimations().forEach(a=>{a.pause();a.currentTime=t;});
    const heading=document.querySelector('h1').getBoundingClientRect();
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,center:heading.x+heading.width/2};
   },ms);
   ok(`${w}×${h} at ${ms}ms keeps the real viewport (${JSON.stringify(box)})`,box.width<=w+1&&box.scroll<=w+1&&Math.abs(box.center-w/2)<2);
   if(!mobile)ok(`${w}×${h} has no decorative vertical overflow`,box.height<=h+1);
  }
  ok('page remains error free',errors.length===0);await ctx.close();
 }
 {
  const {ctx,page}=await open(412,800,true);
  for(const size of [{width:800,height:412},{width:412,height:800}]){
   await page.setViewportSize(size);
   await page.locator('h1').click();
   const box=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   ok('rotation and click effects do not enlarge the page',box.width<=size.width+1&&box.scroll<=size.width+1);
  }
  const stack=await page.evaluate(()=>{
   const star=document.querySelector('.gummy-star'),ring=document.querySelector('.orbit-ring');
   return Number(getComputedStyle(star).zIndex)>Number(getComputedStyle(ring).zIndex);
  });ok('the star stays above its orbit line',stack);
  await ctx.close();
 }
 {
  const {ctx,page}=await open(360,740,true,'reduce');
  ok('reduced motion keeps the main action fully visible',await page.locator('.click-hint').evaluate(e=>getComputedStyle(e).opacity==='1'));
  ok('reduced motion disables decorative movement',await page.locator('.starfield').evaluate(e=>getComputedStyle(e).display==='none'));
  ok('reduced motion keeps the stationary nebula visible',await page.locator('.landing-nebula').evaluate(e=>getComputedStyle(e).display!=='none'));
  await page.evaluate(()=>document.documentElement.style.fontSize='32px');
  await page.locator('a[href="guide.html"]').first().click();
  await page.getByRole('heading',{name:'처음 별을 보는 밤',exact:true}).waitFor();
  await page.evaluate(()=>document.documentElement.style.fontSize='32px');
  ok('guide navigation works with enlarged text');
  ok('guide does not overflow with enlarged text',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.getByLabel('관측할 대상과 시간을 정했어요').check();
  ok('observation checklist updates',await page.locator('#checkProgress').textContent()==='1 / 5 준비 완료');
  await page.getByRole('button',{name:'다시 준비하기'}).click();
  await page.locator('#checkProgress').filter({hasText:'0 / 5 준비 완료'}).waitFor();
  ok('checklist can be reset',await page.locator('#checkProgress').textContent()==='0 / 5 준비 완료');
  await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
  await page.locator('#sideNav').getByRole('link',{name:'소개·문의',exact:true}).click();
  ok('contact uses the existing public question board',await page.getByRole('link',{name:'게시판에 문의 남기기 →'}).getAttribute('href')==='lounge.html#ask');
  await page.goto(base+'/main.html');
  await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
  await page.locator('#sideNav').getByRole('link',{name:'관측 가이드',exact:true}).click();
  await page.getByRole('heading',{name:'처음 별을 보는 밤',exact:true}).waitFor();
  ok('the mobile main menu reaches the new guide');
  await page.setViewportSize({width:740,height:320});
  await page.goto(base+'/main.html');
  await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
  await page.locator('#sideNav').getByRole('link',{name:'소개·문의',exact:true}).click();
  await page.getByRole('heading',{name:'같은 하늘을 보는 사람들',exact:true}).waitFor();
  ok('the last menu item remains reachable in short landscape');
  await ctx.close();
 }
 console.log(`Landing: ${checks} checks passed`);
}finally{await browser.close();await new Promise(r=>server.close(r));}
