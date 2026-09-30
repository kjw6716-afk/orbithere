// Community homepage: real SDK and isolated HTTP fixtures; no production writes.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root = fileURLToPath(new URL('..', import.meta.url));
const origin = 'https://orbithere.com';
const browser = await chromium.launch();
const id = n => 'aaaaaaaa-aaaa-4aaa-8aaa-' + n.toString(16).padStart(12, '0');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.webp':'image/webp', '.avif':'image/avif', '.png':'image/png' };
let checks = 0;
function ok(name, result = true) { assert.ok(result, name); checks++; console.log('✓ ' + name); }
async function fixture(width = 1440, options = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'reduce', ...options });
  const now = new Date().toISOString();
  const state = { commentsFail: false, photosFail: false, calls: [], errors: [], posts: Array.from({length:16}, (_,i) => ({
    id:id(i+1), title:['오늘 새벽에 본 목성, 생각보다 밝네요','처음 망원경을 고를 때 무엇부터 볼까요?','도심에서도 별자리를 찾을 수 있을까요?'][i%3] + ' ' + (i+1),
    text:'동네 산책길에 올려다본 하늘 이야기입니다.', nick:'별보는사람', orbit:i%3===1?'ask':'report', author_id:id(99), created_at:now,
    image_paths:i===0?['public/photo.webp']:[], comment_count:2, view_count:12, is_pinned:false,
  })), comments: Array.from({length:6}, (_,i) => ({id:id(101+i), post_id:id(i+1), nick:'하늘산책', author_id:id(98), text:i===0?'저도 어제 같은 하늘을 봤어요. 사진 잘 봤습니다!':'다음 맑은 날에 다시 관측해 보고 싶어요.', created_at:now})) };
  await context.route('**/*', async route => {
    const req=route.request(), u=new URL(req.url());
    const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
    if(u.pathname.includes('pretendard-dynamic') && process.env.ORBIT_QA_FONT) return route.fulfill({contentType:'text/css',body:'@font-face{font-family:Pretendard;src:url(https://font.test/qa.woff2)}'});
    if(u.hostname==='font.test') return route.fulfill({contentType:'font/woff2',path:process.env.ORBIT_QA_FONT});
    if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes('@supabase/supabase-js@')) return route.fulfill({contentType:'text/javascript',path:resolve(root,'node_modules/@supabase/supabase-js/dist/umd/supabase.js')});
    if(u.origin===origin) {
      const path=resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));
      if(!path.startsWith(resolve(root)+'/')) return route.abort();
      try{return route.fulfill({contentType:types[extname(path)]||'application/octet-stream',body:await readFile(path)});}catch{return route.fulfill({status:404,body:''});}
    }
    if(!u.hostname.endsWith('.supabase.co')) return route.abort();
    state.calls.push({path:u.pathname,method:req.method(),query:u.search});
    if(u.pathname.includes('/storage/v1/object/')) return route.fulfill({contentType:'image/webp',body:await readFile(resolve(root,'images/nebula-landing-1200.webp'))});
    const name=u.pathname.split('/').at(-1), q=u.searchParams;
    if(name==='board_posts') return json(req.postDataJSON()?.p_pinned?[]:state.posts);
    if(name==='posts') {
      if(q.has('image_paths')) return state.photosFail?json({message:'unavailable'},503):json(state.posts.filter(p=>p.image_paths.length));
      if(q.get('id')?.startsWith('eq.')) return json(state.posts.find(p=>p.id===q.get('id').slice(3))||null);
      return json(state.posts);
    }
    if(name==='comments') {
      if(state.commentsFail) return json({message:'unavailable'},503);
      let rows=state.comments;
      if(q.has('post_id')) rows=rows.filter(c=>c.post_id===q.get('post_id').slice(3));
      if(q.has('id')) {
        const result=rows.find(c=>c.id===q.get('id').slice(3))||null;
        if(state.targetGate) { state.targetEntered(); await state.targetGate; }
        return json(result);
      }
      if(q.has('or')) {
        const match=/created_at.lt.([^,]+),and\(created_at.eq.[^,]+,id.lt.([0-9a-f-]+)/.exec(q.get('or'));
        if(match) rows=rows.filter(c=>c.created_at<match[1]||(c.created_at===match[1]&&c.id<match[2]));
      }
      return json(rows.slice(0,Number(q.get('limit')||21)));
    }
    if(name==='member_cards') return json([]);
    if(name==='member_profile'||name==='user') return json(null);
    if(name==='is_admin') return json(false);
    if(name==='board_version'||name==='board_observation_version') return json(1);
    if(name==='community_version') return json(2);
    if(name==='record_post_view'||name==='post_view_counts') return json({view_count:12});
    if(name==='signup') return json({message:'Fixture blocks account creation'},503);
    return json([]);
  });
  const page=await context.newPage(); page.on('pageerror',e=>state.errors.push(e.message));
  return {context,page,state};
}
try {
  for(const width of [320,390,768,1024,1440,1920]) {
    const {context,page,state}=await fixture(width);
    await page.goto(origin+'/');
    await page.locator('.board-row').first().waitFor();
    await page.locator('.community-conversation').first().waitFor();
    ok(`root immediately shows the board at ${width}px`,new URL(page.url()).pathname==='/'&&await page.locator('#boardTitle').textContent()==='자유게시판');
    ok(`viewport fits ${width}px`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    ok(`login and signup stay visible at ${width}px`,await page.locator('[data-account-link]').isVisible()&&await page.locator('[data-account-signup]').isVisible());
    const layout=await page.evaluate(()=>{
      const b=document.querySelector('.community-board').getBoundingClientRect(),s=document.querySelector('.community-sidebar').getBoundingClientRect(),r=document.querySelector('.board-row').getBoundingClientRect();
      return {board:{x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width},side:{x:s.x,y:s.y,width:s.width},row:{y:r.y,height:r.height},height:innerHeight};
    });
    ok(`board appears in the first viewport at ${width}px`,layout.row.y<layout.height-80);
    ok(`compact rows stay below 62px at ${width}px`,layout.row.height<=62);
    ok(`sidebar respects ${width>860?'desktop columns':'mobile reading order'}`,width>860?layout.side.x>=layout.board.right&&layout.board.width>layout.side.width*1.6:layout.side.y>=layout.board.bottom);
    await page.locator('#photosTab').click();
    await page.locator('.community-photo img').evaluate(img=>img.decode());
    ok('photos come from actual attached post images',await page.locator('.community-photo').count()===1&&state.calls.some(c=>c.query.includes('image_paths=not.eq.')));
    await page.locator('#photosTab').focus(); await page.keyboard.press('ArrowLeft');
    ok('tabs support keyboard navigation',await page.locator('#recentTab').getAttribute('aria-selected')==='true'&&await page.locator('#recentTab').evaluate(e=>e===document.activeElement));
    if(process.env.ORBIT_QA_DIR&&[390,1440].includes(width)) {
      await mkdir(process.env.ORBIT_QA_DIR,{recursive:true}); await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({path:resolve(process.env.ORBIT_QA_DIR,`community-home-${width}.png`),fullPage:width===390});
    }
    ok('passive timeline does not create accounts or read receipts',!state.calls.some(c=>/signup|record_post_view|board_mark_read/.test(c.path)));
    ok('page has no script errors',state.errors.length===0);
    await context.close();
  }
  {
    const {context,page,state}=await fixture(390);
    await page.goto(origin+'/'); await page.locator('.community-link').first().waitFor();
    await page.locator('.community-link').first().click();
    await page.locator('[data-comment-target]').waitFor();
    ok('timeline opens and focuses its comment',new URL(page.url()).searchParams.get('comment')===id(101)&&await page.locator('[data-comment-target]').evaluate(e=>e===document.activeElement));
    ok('comment body stays readable while spacing is compact',await page.locator('.comment-body').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16)&&await page.locator('.comment-item').first().evaluate(e=>parseFloat(getComputedStyle(e).paddingTop)<=5));
    await page.locator('#backToFeed').click(); await page.locator('#writeTop').click();
    await page.locator('#postInput').fill('로그인 전에도 보존해야 하는 초안');
    await page.locator('[data-account-link]').click(); await page.locator('.account-dialog[open]').waitFor();
    ok('root login remembers the actual root writing route',await page.evaluate(()=>JSON.parse(sessionStorage.getItem('orbit_account_return')).path.startsWith('/?write=1')));
    await page.getByRole('button',{name:'계정 창 닫기'}).click();
    ok('opening an account keeps the draft',await page.locator('#postInput').inputValue()==='로그인 전에도 보존해야 하는 초안');
    ok('direct comment and auth flow have no script errors',state.errors.length===0);
    await context.close();
  }
  {
    const {context,page,state}=await fixture(390);
    state.comments=Array.from({length:22},(_,i)=>({id:id(200+i),post_id:id(1),nick:'관측자',author_id:id(98),text:'페이지 밖 댓글 '+i,created_at:new Date(Date.now()-i*1000).toISOString()}));
    await page.goto(origin+'/?post='+id(1)+'&comment='+id(220));
    await page.locator('#comment-'+id(220)).waitFor();
    ok('the 21st comment remains reachable beyond the first 20',await page.locator('.comment-item').count()===21&&await page.locator('#comment-'+id(220)).isVisible());
    await page.locator('[data-action="refresh-comments"]').click();
    await page.locator('#moreComments:enabled').waitFor();
    ok('refresh does not force focus back to the old target',!await page.locator('#comment-'+id(220)).evaluate(e=>e===document.activeElement));
    await page.locator('#moreComments').click();
    await page.waitForFunction(()=>document.querySelectorAll('.comment-item').length===22);
    ok('linked comment is never duplicated when older comments load',await page.locator('#comment-'+id(220)).count()===1);
    await context.close();
  }
  for (const next of ['account', 'another-post']) {
    const {context,page,state}=await fixture(390);
    state.comments=Array.from({length:22},(_,i)=>({id:id(300+i),post_id:id(1),nick:'관측자',author_id:id(98),text:'지연된 댓글 '+i,created_at:new Date(Date.now()-i*1000).toISOString()}));
    let release;
    state.targetGate=new Promise(resolve=>{release=resolve;});
    const entered=new Promise(resolve=>{state.targetEntered=resolve;});
    await page.goto(origin+'/?post='+id(1)+'&comment='+id(321)); await entered;
    if(next==='account') {
      await page.locator('[data-account-link]').click(); await page.locator('.account-dialog[open]').waitFor();
      await page.locator('#email').fill('observer@example.test');
    } else {
      await page.locator('#backToFeed').click(); await page.locator('#post-'+id(2)+' .row-title').click();
      await page.locator('.detail-title').waitFor();
    }
    const response=page.waitForResponse(r=>new URL(r.url()).searchParams.get('id')==='eq.'+id(321));
    release(); await (await response).finished();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    if(next==='account') {
      await page.locator('#comment-'+id(321)).waitFor();
      ok('late linked comment cannot steal focus from login',await page.locator('#email').evaluate(e=>e===document.activeElement));
    } else {
      await page.locator('[data-action="refresh-comments"]').click();
      await page.locator('#commentMessage').getByText('첫 댓글을 남겨보세요.').waitFor();
      ok('late linked comment cannot enter another post',await page.locator('.comment-item').count()===0);
    }
    await context.close();
  }
  {
    const {context,page,state}=await fixture(1440);
    state.commentsFail=true; await page.goto(origin+'/index.html');
    await page.locator('#recentConversations').getByText('소식을 불러오지 못했어요.',{exact:false}).waitFor();
    ok('timeline outage leaves the board usable',await page.locator('.board-row').count()===16);
    state.commentsFail=false; state.comments=[]; await page.locator('#refreshCommunity').click();
    await page.locator('#recentConversations').getByText('아직 나눈 댓글이 없어요.',{exact:false}).waitFor();
    ok('empty timeline uses an honest empty state');
    state.photosFail=true; await page.locator('#photosTab').click();
    await page.locator('#recentPhotos').getByText('소식을 불러오지 못했어요.',{exact:false}).waitFor();
    state.photosFail=false; await page.locator('#refreshCommunity').click(); await page.locator('.community-photo').waitFor();
    ok('photo outage can be retried');
    await page.evaluate(()=>document.documentElement.style.fontSize='32px');
    ok('200% base text does not cause horizontal page overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await context.close();
  }
  {
    const {context,page}=await fixture(390,{javaScriptEnabled:false});
    await page.goto(origin+'/');
    ok('no-JS header preserves destinations and visible auth',await page.locator('[data-account-link]').isVisible()&&await page.locator('#sideNav a[href="stories.html"]').isVisible()&&await page.locator('#writeTop').isVisible());
    await context.close();
  }
  console.log(`Community home: ${checks} checks passed`);
} finally { await browser.close(); }
