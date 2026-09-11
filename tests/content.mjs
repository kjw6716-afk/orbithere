// Exercise the new tools and ad failure modes without contacting an ad or data service.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('..', import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const server=createServer(async(req,res)=>{
 const name=resolve(root,'.'+req.url.split('?')[0]);
 if(!name.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
 try {res.writeHead(200,{'Content-Type':types[extname(name)]||'application/octet-stream'});res.end(await readFile(name));}
 catch {res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();let checks=0;
const ok=(name,condition)=>{assert.ok(condition,name);checks++;console.log('✓ '+name);};
async function fixture(width=390,height=844){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<700,deviceScaleFactor:3,hasTouch:width<700});
 const requests=[],errors=[];
 await context.route('**/*',route=>{
  requests.push(route.request().url());
  return new URL(route.request().url()).origin===base?route.continue():route.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 return {context,page,requests,errors};
}
try {
 for(const width of [360,768,1366]){
  const {context,page,requests,errors}=await fixture(width);
  for(const name of ['notes.html','reading-sky.html','privacy.html','terms.html','guide.html']){
   await page.goto(base+'/'+name);
   ok(`${name} fits ${width}px`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  ok('disabled ads never request Google',!requests.some(url=>url.includes('googlesyndication')));
  ok('no visible placeholder is left without an account',await page.locator('.editorial-ad').count()===0);
  ok('no browser script errors',errors.length===0);
  await context.close();
 }
 {
  const {context,page,requests}=await fixture();
  await page.goto(base+'/notes.html');
  await page.getByLabel('관측 대상',{exact:true}).fill('<script>my-test</script> 달');
  await page.getByLabel('관측 일시 (한국 시간)',{exact:true}).fill('2026-09-12T21:30');
  await page.getByLabel('대략적인 지역',{exact:true}).fill('서울');
  await page.getByLabel('사용한 장비',{exact:true}).selectOption('쌍안경');
  await page.getByLabel('관측 결과',{exact:true}).selectOption('찾았어요');
  const text=await page.locator('#noteOutput').inputValue();
  ok('note preserves text safely and uses the selected KST time',text.includes('<script>my-test</script> 달')&&text.includes('2026-09-12 21:30 KST')&&text.includes('쌍안경'));
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'텍스트로 내려받기'}).click();
  const download=await downloadPromise;
  const bytes=await readFile(await download.path());
  ok('download contains the actual note',bytes.toString('utf8').replace(/^\uFEFF/,'')===text);
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.getByRole('button',{name:'기록 복사',exact:true}).click();
  await page.locator('#noteStatus').filter({hasText:'기록을 복사했어요'}).waitFor();
  const copied=await page.evaluate(()=>navigator.clipboard.readText());
  ok('copy sends only the generated note to clipboard',copied.replace(/\r\n/g,'\n')===text);
  await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('blocked'))},configurable:true});});
  await page.getByRole('button',{name:'기록 복사',exact:true}).click();
  await page.locator('#noteStatus').filter({hasText:'기록을 선택했어요'}).waitFor();
  ok('clipboard denial leaves a manually selectable note',await page.locator('#noteOutput').evaluate(e=>e.selectionEnd-e.selectionStart===e.value.length));
  ok('note contents are never sent to a service',!requests.some(url=>url.includes('my-test')||url.includes(encodeURIComponent('서울'))));
  await page.getByRole('button',{name:'입력 지우기'}).click();
  await page.locator('#noteStatus').filter({hasText:'입력을 지웠어요'}).waitFor();
  ok('reset clears the inputs and generated note',await page.getByLabel('관측 대상',{exact:true}).inputValue()===''&&!(await page.locator('#noteOutput').inputValue()).includes('my-test'));
  await page.getByLabel('관측 대상',{exact:true}).fill('temporary-note');
  await page.reload();
  ok('private note is not persisted on reload',await page.getByLabel('관측 대상',{exact:true}).inputValue()==='');
  await page.goto(base+'/reading-sky.html');
  await page.locator('#altitudeRange').fill('90');
  ok('altitude control reaches the zenith',await page.locator('#angleValue').textContent()==='90°'&&Math.abs(Number(await page.locator('#sightPoint').getAttribute('cy'))-30)<.01);
  await page.locator('#altitudeRange').fill('0');
  ok('altitude control reaches the horizon',Number(await page.locator('#sightPoint').getAttribute('cy'))===210);
  await page.goto(base+'/privacy.html');
  const visible=await page.locator('body').innerText();
  ok('privacy copy describes purposes without internal keys',!visible.includes('orbit_')&&!visible.includes('auth-token')&&visible.includes('작성 권한을 유지하는 인증 정보'));
  await context.close();
 }
 for(const mode of ['invalid','enabled','blocked']){
  const {context,page,requests,errors}=await fixture();
  await page.route('**/ads-config.js',route=>route.fulfill({contentType:'text/javascript',body:`window.ORBIT_ADS={enabled:true,client:'${mode==='invalid'?'invalid':'ca-pub-1234567890123456'}',slot:'1234567890'};`}));
  let adRequests=0;
  await page.route('https://pagead2.googlesyndication.com/**',route=>{adRequests++;return mode==='blocked'?route.abort():route.fulfill({contentType:'text/javascript',body:'window.adsbygoogle={push:function(){window.testAdCalls=(window.testAdCalls||0)+1}};'});});
  await page.goto(base+'/guide.html');
  if(mode==='enabled'){
   await page.waitForFunction(()=>window.testAdCalls===1);
   ok('valid configuration loads one manual unit',await page.locator('.editorial-ad').count()===1&&await page.locator('.editorial-ad ins').getAttribute('data-full-width-responsive')==='false');
   ok('ad placement does not expand the viewport',await page.evaluate(()=>innerWidth===390&&document.documentElement.scrollWidth===390));
  }else{
   await page.waitForLoadState('networkidle');
   ok(`${mode} ad setup leaves no blank box or script error`,await page.locator('.editorial-ad').count()===0&&errors.length===0);
  }
  if(mode==='invalid')ok('invalid publisher cannot start an ad request',adRequests===0);
  await context.close();
 }
 console.log(`Content: ${checks} checks passed`);
} finally {await browser.close();await new Promise(r=>server.close(r));}
