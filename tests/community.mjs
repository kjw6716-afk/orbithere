// Browser regression tests use the real Supabase SDK and a local HTTP fixture.
// Every external request is intercepted; no test content reaches production.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,dirname,extname,resolve} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{
  const path=decodeURIComponent(req.url.split('?')[0]);
  const full=resolve(root,'.'+(path==='/'?'/index.html':path));
  if(!full.startsWith(root+ '/'.replace('/',process.platform==='win32'?'\\':'/'))){res.writeHead(403);res.end();return;}
  try{const body=await readFile(full);res.writeHead(200,{'Content-Type':types[extname(full)]||'application/octet-stream'});res.end(body);}
  catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();
const A='11111111-1111-4111-8111-111111111111', P='44444444-4444-4444-8444-444444444444';
const now=()=>new Date().toISOString();
let checks=0;
function ok(name,condition=true){assert.ok(condition,name);checks++;console.log('✓ '+name);}
async function fixture({nickname='관측자',version=2}={}){
  const context=await browser.newContext({viewport:{width:1200,height:900}});
  const state={posts:[{id:P,nick:'기존작성자',orbit:'report',text:'기존 관측 후기',created_at:now(),author_id:null}],getFail:false,postFail:false,version,signups:0,inserts:0,selects:[],reads:0,delays:{}};
  const errors=[];
  await context.addInitScript(n=>{if(n)localStorage.setItem('orbit_nickname',n);},nickname);
  await context.route('**/*',async route=>{
    const req=route.request(), url=new URL(req.url());
    if(url.origin===base) return route.continue();
    if(url.hostname==='cdn.jsdelivr.net' && url.pathname.includes('@supabase/supabase-js@'))
      return route.fulfill({contentType:'application/javascript',path:join(root,'node_modules/@supabase/supabase-js/dist/umd/supabase.js')});
    if(url.hostname!=='unwxpuvfqyjhgrcrmuhu.supabase.co') return route.abort();
    const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(url.pathname==='/auth/v1/signup'){
      state.signups++;
      const exp=Math.floor(Date.now()/1000)+3600;
      const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
      return json({access_token:encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:A,exp,role:'authenticated',is_anonymous:true})+'.test-signature',token_type:'bearer',expires_in:3600,expires_at:exp,refresh_token:'test-refresh-token',user:{id:A,aud:'authenticated',role:'authenticated',is_anonymous:true,app_metadata:{provider:'anonymous'},user_metadata:{},created_at:now()}});
    }
    if(url.pathname.endsWith('/rpc/community_version'))return state.version===2?json(2):json({code:'PGRST202',message:'function not found'},404);
    if(url.pathname.endsWith('/rpc/is_admin'))return json(false);
    if(url.pathname.endsWith('/rpc/record_visit'))return json(null);
    if(url.pathname.endsWith('/rpc/reaction_summary'))return json([]);
    if(url.pathname==='/rest/v1/posts'){
      if(req.method()==='GET'){
        state.reads++;state.selects.push(url.searchParams.get('select'));
        const orbit=(url.searchParams.get('orbit')||'').replace('eq.','');
        const snapshot=state.posts.filter(p=>!orbit||p.orbit===orbit);
        if(state.delays[orbit])await new Promise(r=>setTimeout(r,state.delays[orbit]));
        if(state.getFail)return json({message:'temporary fixture failure'},503);
        return json(snapshot);
      }
      if(req.method()==='POST'){
        state.inserts++;
        if(state.postFail)return json({message:'temporary write failure'},503);
        const body=req.postDataJSON();
        assert.equal(body.author_id,A);
        assert.match(req.headers().authorization,/^Bearer /);
        state.posts.unshift({...body,id:'55555555-5555-4555-8555-555555555555',created_at:now()});
        return json(null,201);
      }
    }
    if(url.pathname==='/rest/v1/comments')return json([]);
    return json({message:'unexpected fixture request '+url.pathname},400);
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  return {context,page,state,errors,close:async()=>{ok('no browser exceptions',errors.length===0);await context.close();}};
}
try{
  {
    const f=await fixture();const {page,state}=f;
    await page.goto(base+'/lounge.html');
    await page.getByText('기존 관측 후기',{exact:true}).waitFor();
    ok('reading does not create an anonymous account',state.signups===0);
    ok('public query omits legacy device IDs',state.selects.every(s=>!s.includes('*')&&!s.includes('author_device')));
    state.postFail=true;
    await page.getByLabel('게시글 내용').fill('서울에서 토성을 봤어요');
    await page.locator('#btnTrace').click();
    await page.locator('#loungeStatus').filter({hasText:'전송 실패'}).waitFor();
    ok('failed write preserves the draft',await page.getByLabel('게시글 내용').inputValue()==='서울에서 토성을 봤어요');
    ok('writer is authenticated only on first mutation',state.signups===1);
    state.postFail=false;
    await page.locator('#btnTrace').click();
    await page.getByText('서울에서 토성을 봤어요',{exact:true}).waitFor();
    ok('retry writes successfully without another account',state.signups===1&&state.inserts===2);
    ok('successful write clears the draft',await page.getByLabel('게시글 내용').inputValue()==='');
    state.getFail=true;
    await page.locator('.btn-refresh').click();
    await page.locator('#loungeStatus').filter({hasText:'새로고침 실패'}).waitFor();
    ok('failed refresh retains the existing feed',await page.getByText('서울에서 토성을 봤어요',{exact:true}).isVisible());
    state.getFail=false;
    state.posts.push({id:'66666666-6666-4666-8666-666666666666',nick:'장비사용자',orbit:'gear',text:'늦게 도착하는 장비 글',created_at:now(),author_id:null});
    state.delays.gear=250;
    await page.locator('[data-orbit="gear"]').click();
    await page.locator('[data-orbit="report"]').click();
    await page.getByText('서울에서 토성을 봤어요',{exact:true}).waitFor();
    await page.waitForTimeout(400); // Wait beyond the explicitly delayed fixture response.
    ok('late previous-channel response cannot overwrite the current channel',await page.locator('.post-body').filter({hasText:'늦게 도착하는'}).count()===0);
    await f.close();
  }
  {
    const f=await fixture();f.state.getFail=true;
    await f.page.goto(base+'/lounge.html');
    await f.page.getByRole('button',{name:'다시 불러오기'}).waitFor();
    f.state.getFail=false;
    await f.page.getByRole('button',{name:'다시 불러오기'}).click();
    await f.page.getByText('기존 관측 후기',{exact:true}).waitFor();
    ok('initial outage recovers with the visible retry button');
    await f.close();
  }
  {
    const f=await fixture({version:1});
    await f.page.goto(base+'/lounge.html');
    await f.page.getByText('기존 관측 후기',{exact:true}).waitFor();
    ok('pre-migration server remains readable',f.state.selects.every(s=>!s.includes('author_id')));
    await f.page.getByLabel('게시글 내용').fill('보안 전환 대기');
    await f.page.locator('#btnTrace').click();
    await f.page.locator('#loungeStatus').filter({hasText:'보안 업데이트'}).waitFor();
    ok('pre-migration writes fail closed',f.state.signups===0&&f.state.inserts===0);
    await f.close();
  }
  {
    const f=await fixture();const page=f.page;
    await page.goto(base+'/main.html');
    await page.locator('#panel-planets.on').waitFor();ok('today’s sky is the default panel');
    await page.locator('[data-panel="sky"]').click();
    await page.locator('[data-panel="lounge"]').click();
    await page.goBack();await page.locator('#panel-sky.on').waitFor();ok('browser back restores previous panel');
    await page.locator('#profileChip').click();
    await page.locator('#btnRename').click();
    await page.keyboard.press('Escape');
    ok('cancelling nickname change preserves existing nickname',await page.evaluate(()=>localStorage.getItem('orbit_nickname'))==='관측자');
    await page.locator('#profileChip').click();
    await page.locator('#joinClose').focus();await page.keyboard.press('Tab');
    ok('dialog keyboard focus stays inside',await page.evaluate(()=>document.querySelector('#joinBack').contains(document.activeElement)));
    await page.keyboard.press('Escape');
    ok('closing dialog restores trigger focus',await page.locator('#profileChip').evaluate(el=>el===document.activeElement));
    await page.setViewportSize({width:390,height:844});
    await page.locator('#navToggle').click();
    await page.locator('[data-panel="planets"]').click();
    const frame=page.frameLocator('#planetFrame');
    await frame.locator('#skyMap [data-label]').first().waitFor();
    await page.waitForFunction(()=>{const svg=document.querySelector('#planetFrame').contentDocument.querySelector('#skyMap');const text=svg.querySelector('[data-label]');return +text.getAttribute('font-size')*svg.getBoundingClientRect().width/svg.viewBox.baseVal.width>=11.9;});
    ok('map labels stay readable after desktop-to-mobile resize');
    ok('mobile shell does not overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await f.close();
  }
  {
    const f=await fixture();const page=f.page;
    await page.clock.install({time:new Date('2026-09-11T23:30:00+09:00')});
    await page.goto(base+'/sky.html');
    await page.evaluate(()=>{
      EVENTS.splice(0,EVENTS.length,{id:'regression',name:'자정 검증',ic:'☄️',type:'meteor',kr:true,watch:'2026-09-12T03:00:00+09:00',dateText:'검사용',best:'검사용',desc:'검사용',zhr:20});
      renderNext();renderTimeline();
    });
    ok('an event tomorrow in less than 24 hours is D-1',await page.locator('#nxDday').textContent()==='D-1');
    ok('hero and timeline use the same day',await page.locator('.ev-dday').textContent()===await page.locator('#nxDday').textContent());
    await page.clock.setSystemTime(new Date('2026-09-12T00:00:00+09:00'));await page.clock.runFor(1000);
    ok('midnight updates both countdown labels',await page.locator('#nxDday').textContent()==='D-DAY'&&await page.locator('.ev-dday').textContent()==='D-DAY');
    await f.close();
  }
  console.log(`Community/UI: ${checks} checks passed`);
}finally{await browser.close();await new Promise(r=>server.close(r));}
