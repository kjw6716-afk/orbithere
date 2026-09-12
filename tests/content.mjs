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
 const page=await context.newPage();page.on('dialog',dialog=>dialog.accept());page.on('pageerror',e=>errors.push(e.message));
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
 for(const mode of ['invalid','enabled','blocked','unfilled']){
  const {context,page,requests,errors}=await fixture();
  await page.route('**/ads-config.js',route=>route.fulfill({contentType:'text/javascript',body:`window.ORBIT_ADS={enabled:true,client:'${mode==='invalid'?'invalid':'ca-pub-1234567890123456'}',slot:'1234567890'};`}));
  let adRequests=0;
  await page.route('https://pagead2.googlesyndication.com/**',route=>{adRequests++;return mode==='blocked'?route.abort():route.fulfill({contentType:'text/javascript',body:'window.adsbygoogle={push:function(){window.testAdCalls=(window.testAdCalls||0)+1;'+(mode==='unfilled'?'document.querySelector(\".editorial-ad ins\").setAttribute(\"data-ad-status\",\"unfilled\");':'')+'}};' });});
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
