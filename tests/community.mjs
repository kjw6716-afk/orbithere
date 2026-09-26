// Real Supabase browser SDK with intercepted HTTP; never writes to production.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname, extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]),
    full = resolve(root, '.' + (path === '/' ? '/index.html' : path));
  if (!full.startsWith(root + sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const body = await readFile(full);
    res.writeHead(200, { 'Content-Type': types[extname(full)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`,
  browser = await chromium.launch();
const A = '11111111-1111-4111-8111-111111111111',
  P = '44444444-4444-4444-8444-444444444444';
const now = () => new Date().toISOString(),
  uid = (n) => 'aaaaaaaa-aaaa-4aaa-8aaa-' + n.toString(16).padStart(12, '0');
let checks = 0;
function ok(name, condition = true) {
  assert.ok(condition, name);
  checks++;
  console.log('✓ ' + name);
}
function session(anonymous = true) {
  const exp = Math.floor(Date.now() / 1000) + 3600,
    encode = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return {
    access_token:
      encode({ alg: 'HS256', typ: 'JWT' }) +
      '.' +
      encode({ sub: A, exp, role: 'authenticated', is_anonymous: anonymous }) +
      '.test-signature',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    refresh_token: 'test-refresh-token',
    user: {
      id: A,
      aud: 'authenticated',
      role: 'authenticated',
      is_anonymous: anonymous,
      email: anonymous ? undefined : 'member@example.test',
      email_confirmed_at: anonymous ? null : now(),
      app_metadata: { provider: anonymous ? 'anonymous' : 'email' },
      user_metadata: {},
      created_at: now(),
    },
  };
}
function ordered(rows) {
  return rows
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
}
function cursor(rows, time, id) {
  return time
    ? rows.filter((r) => r.created_at < time || (r.created_at === time && r.id < id))
    : rows;
}
async function fixture({ nickname = '관측자', version = 1, admin = false, signedIn = true, registered = true, profileReady = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const state = {
    profile: registered && profileReady ? {nickname:nickname || '관측자',level:2,xp:10,level_start:10,next_level:30,joined_at:now()} : null,
    receipts: new Set(), readCalls: [], activityCalls: [], activityFail: false, readFail: false,
    viewCalls: [],
    viewed: new Set(),
    viewFail: false,
    viewReadFail: false,
    comments: [],
    commentFail: false,
    reactionFail: false,
    reactionWriteFail: false,
    reactionCalls: [],
    reactions: [],
    reportBodies: [],
    queries: [],
    boardCalls: [],
    posts: [
      {
        id: P,
        title: '기존 관측 후기',
        nick: '기존작성자',
        orbit: 'report',
        text: '기존 글의 본문입니다.',
        created_at: now(),
        author_id: null,
        image_paths: [],
        is_pinned: false,
      },
    ],
    getFail: false,
    postFail: false,
    observationVersion: 1,
    observationColumn: true,
    loseCommit: false,
    version,
    signups: 0,
    logins: 0,
    postIds: [],
    inserts: 0,
    selects: [],
    delays: {},
    uploads: [],
    objects: new Map(),
    uploadFail: false,
  };
  const errors = [];
  await context.addInitScript(
    ({ nickname, auth }) => {
      if (nickname) localStorage.setItem('orbit_nickname', nickname);
      if (auth) localStorage.setItem('sb-unwxpuvfqyjhgrcrmuhu-auth-token', JSON.stringify(auth));
    },
    { nickname, auth: admin || signedIn ? session(!(admin || registered)) : null },
  );
  function unreadRows(p) {
    return state.comments.filter(c => c.post_id === p.id && c.author_id !== A && !state.receipts.has(c.id) &&
      (p.author_id === A || state.comments.some(own => own.post_id === p.id && own.author_id === A &&
        (own.created_at < c.created_at || own.created_at === c.created_at && own.id < c.id))));
  }
  function activityRows(scope) {
    return state.posts.filter(p => scope === 'mine' ? p.author_id === A : scope === 'joined' ?
      p.author_id !== A && state.comments.some(c => c.post_id === p.id && c.author_id === A) : unreadRows(p).length > 0);
  }
  await context.route('**/*', async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.origin === base && url.pathname === '/data/news.json' && state.newsData)
      return route.fulfill({
        status: state.newsFail ? 503 : 200,
        contentType: 'application/json',
        body: JSON.stringify(state.newsData),
      });
    if (url.origin === base) return route.continue();
    if (
      process.env.ORBIT_QA_FONT &&
      url.hostname === 'cdn.jsdelivr.net' &&
      url.pathname.includes('pretendard-dynamic')
    )
      return route.fulfill({
        contentType: 'text/css',
        body: '@font-face{font-family:Pretendard;src:url(https://cdn.jsdelivr.net/orbit-qa.woff2) format("woff2");font-display:swap;}',
      });
    if (process.env.ORBIT_QA_FONT && url.pathname === '/orbit-qa.woff2')
      return route.fulfill({ contentType: 'font/woff2', path: process.env.ORBIT_QA_FONT });
    if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('@supabase/supabase-js@'))
      return route.fulfill({
        contentType: 'application/javascript',
        path: join(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'),
      });
    if (url.hostname !== 'unwxpuvfqyjhgrcrmuhu.supabase.co') return route.abort();
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/auth/v1/signup') {
      state.signups++;
      if (state.authFail) return json({ message: 'signup unavailable' }, 503);
      return json(session());
    }
    if (url.pathname === '/auth/v1/token') {
      state.logins++;
      return json(session(false));
    }
    if (url.pathname.endsWith('/rpc/board_version'))
      return version ? json(version) : json({ code: 'PGRST202', message: 'Not installed' }, 404);
    if (url.pathname.endsWith('/rpc/board_observation_version'))
      return state.observationVersion ? json(1) : json({ code: 'PGRST202', message: 'Not installed' }, 404);
    if (url.pathname.endsWith('/rpc/community_version')) return json(2);
    if (url.pathname.endsWith('/rpc/is_admin')) return json(admin);
    if (url.pathname.endsWith('/rpc/admin_delivery_alerts')) {
      if (state.deliveryGate) await state.deliveryGate;
      return state.deliveryFail ? json({message:'offline'},503) : json(state.deliveries || {unread:0,events:[]});
    }
    if (url.pathname.endsWith('/rpc/acknowledge_delivery_event')) {
      state.deliveries.events.forEach(e => {if(e.event_id===req.postDataJSON().p_event_id)e.acknowledged_at=now();});
      state.deliveries.unread=0; return json(null);
    }
    if (url.pathname.endsWith('/rpc/member_visit')) {
      if (state.memberVisitGate) await state.memberVisitGate;
      return json(state.profile);
    }
    if (url.pathname.endsWith('/rpc/member_profile')) return json(state.profile);
    if (url.pathname.endsWith('/rpc/member_save_profile')) {state.profile.nickname=req.postDataJSON().p_nickname; return json(state.profile);}
    if (url.pathname.endsWith('/rpc/member_cards')) return json([]);
    if (url.pathname.endsWith('/rpc/visit_stats')) return json([{day:'2026-09-13',count:19,total:46}]);
    if (url.pathname.endsWith('/rpc/report_queue')) return json([]);
    if (url.pathname === '/auth/v1/logout') return json({});
    if (url.pathname.endsWith('/rpc/board_activity_summary'))
      return state.activityFail ? json({message:'activity unavailable'},503) : json(activityRows('unread').length);
    if (url.pathname.endsWith('/rpc/board_activity_posts')) {
      const b = req.postDataJSON(); state.activityCalls.push(b);
      if (state.activityFail) return json({message:'activity unavailable'},503);
      const rows = activityRows(b.p_scope).filter(p => !b.p_query || (p.title+' '+p.text).includes(b.p_query));
      return json(cursor(ordered(rows),b.p_before,b.p_before_id).slice(0,b.p_limit).map(p => ({...p,
        comment_count:state.comments.filter(c=>c.post_id===p.id).length,unread_count:unreadRows(p).length})));
    }
    if (url.pathname.endsWith('/rpc/mark_board_comments_read')) {
      const b = req.postDataJSON(); state.readCalls.push(b);
      if (state.readFail) return json({message:'receipt unavailable'},503);
      const p=state.posts.find(p=>p.id===b.p_post_id);
      const ids=p?unreadRows(p).filter(c=>b.p_comment_ids.includes(c.id)).map(c=>c.id):[];
      ids.forEach(id=>state.receipts.add(id));
      return json(ids.length);
    }
    if (url.pathname.endsWith('/rpc/record_visit')) return json(null);
    if (url.pathname.endsWith('/rpc/board_posts')) {
      const b = req.postDataJSON();
      state.boardCalls.push(b);
      let rows = state.posts.filter(
        (p) =>
          !!p.is_pinned === !!b.p_pinned &&
          (!b.p_orbit || p.orbit === b.p_orbit) &&
          (!b.p_query || (p.title + ' ' + p.text + ' ' + Object.values(p.observation || {}).join(' ')).toLowerCase().includes(b.p_query.toLowerCase())),
      );
      rows = cursor(ordered(rows), b.p_before, b.p_before_id)
        .slice(0, b.p_limit || 21)
        .map(({ text, ...p }) => ({
          ...p,
          view_count: p.view_count || 0,
          comment_count: state.comments.filter((c) => c.post_id === p.id).length,
        }));
      if (state.delays[b.p_orbit]) await new Promise((r) => setTimeout(r, state.delays[b.p_orbit]));
      return state.getFail ? json({ message: 'fixture outage' }, 503) : json(rows);
    }
    if (url.pathname.endsWith('/rpc/record_post_view')) {
      const b=req.postDataJSON(); state.viewCalls.push(b);
      if (state.viewDelay) await new Promise(r=>setTimeout(r,state.viewDelay));
      if (state.viewFail) return json({message:'counter unavailable'},503);
      const p=state.posts.find(p=>p.id===b.p_post_id);
      if (!p) return json(null);
      if (!state.viewed.has(p.id)) { p.view_count=(p.view_count||0)+1; state.viewed.add(p.id); }
      return json(p.view_count);
    }
    if (url.pathname==='/rest/v1/post_view_counts') {
      if(state.viewReadFail) return json({message:'counter unavailable'},503);
      const id=url.searchParams.get('post_id').slice(3), p=state.posts.find(p=>p.id===id);
      return json(p?{view_count:p.view_count||0}:null);
    }
    if (url.pathname.endsWith('/rpc/reserve_board_images')) {
      const b = req.postDataJSON();
      return json(
        Array.from({ length: b.p_count }, (_, i) => A + '/' + b.p_post_id + '/' + uid(i) + '.jpg'),
      );
    }
    if (/\/rpc\/(create_board_post|create_observation_post)$/.test(url.pathname)) {
      state.inserts++;
      const b = req.postDataJSON();
      state.postIds.push(b.p_id);
      if (state.postFail) return json({ message: 'fixture write outage' }, 503);
      if (!state.posts.some((p) => p.id === b.p_id))
        state.posts.unshift({
          id: b.p_id,
          title: b.p_title,
          text: b.p_text,
          observation: b.p_observation || {},
          nick: b.p_nick,
          orbit: b.p_orbit,
          image_paths: b.p_images,
          is_pinned: b.p_pinned,
          author_id: A,
          created_at: now(),
        });
      if (state.loseCommit) {
        state.loseCommit = false;
        return json({ message: 'lost response' }, 503);
      }
      return json(b.p_id);
    }
    if (url.pathname.endsWith('/rpc/reaction_summary')) {
      if (state.reactionFail) return json({ message: 'reaction outage' }, 503);
      const ids=req.postDataJSON().p_post_ids, grouped=new Map();
      for (const r of state.reactions.filter(r=>ids.includes(r.post_id))) {
        const key=r.post_id+'|'+r.emoji, row=grouped.get(key)||{post_id:r.post_id,emoji:r.emoji,n:0,mine:false};
        row.n++; row.mine ||= r.author_id===A; grouped.set(key,row);
      }
      return json([...grouped.values()]);
    }
    if (url.pathname.endsWith('/rpc/set_reaction')) {
      const b=req.postDataJSON(); state.reactionCalls.push(b);
      if(state.reactionWriteFail) return json({message:'reaction write outage'},503);
      const current=state.reactions.find(r=>r.post_id===b.p_post_id&&r.author_id===A);
      if(b.p_selected) {
        if(current) current.emoji=b.p_emoji;
        else state.reactions.push({post_id:b.p_post_id,author_id:A,emoji:b.p_emoji});
      } else if(current&&current.emoji===b.p_emoji) state.reactions.splice(state.reactions.indexOf(current),1);
      if(state.reactionLoseCommit) {state.reactionLoseCommit=false;return json({message:'lost response'},503);}
      return json(state.reactions.find(r=>r.post_id===b.p_post_id&&r.author_id===A)?.emoji||null);
    }
    if (url.pathname.endsWith('/rpc/delete_reaction')) {
      const b=req.postDataJSON();
      state.reactions=state.reactions.filter(r=>r.post_id!==b.p_post_id||r.author_id!==A||r.emoji!==b.p_emoji);
      return json(null);
    }
    if (url.pathname === '/rest/v1/reactions') {
      const b=req.postDataJSON();
      if(b.author_id&&b.author_id!==A)return json({message:'wrong owner'},403);
      if(state.reactions.some(r=>r.post_id===b.post_id&&r.author_id===A))return json({code:'23505',message:'duplicate reaction'},409);
      state.reactions.push({post_id:b.post_id,emoji:b.emoji,author_id:A});
      return json(null, 201);
    }
    if (url.pathname === '/rest/v1/reports' && req.method() === 'POST') {
      state.reportBodies.push(req.postDataJSON());
      return json(null, 201);
    }
    if (url.pathname.startsWith('/storage/v1/object/')) {
      const prefix = '/storage/v1/object/',
        path = decodeURIComponent(
          url.pathname
            .slice(prefix.length)
            .replace(/^authenticated\//, '')
            .replace(/^board-images\//, ''),
        );
      if (req.method() === 'POST') {
        state.uploads.push(path);
        if (state.uploadFail && path.endsWith('.thumb.jpg'))
          return json({ statusCode: '503', message: 'upload outage', error: 'unavailable' }, 503);
        const body = req.postDataBuffer();
        assert.ok(body.includes(Buffer.from([0xff, 0xd8])), 're-encoded JPEG upload');
        state.objects.set(
          path,
          body.subarray(
            body.indexOf(Buffer.from([0xff, 0xd8])),
            body.lastIndexOf(Buffer.from([0xff, 0xd9])) + 2,
          ),
        );
        return json({ Key: 'board-images/' + path, Id: uid(state.uploads.length) });
      }
      if (req.method() === 'GET')
        return route.fulfill({
          status: 200,
          contentType: 'image/jpeg',
          body:
            state.objects.get(path) ||
            Buffer.from(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
              'base64',
            ),
        });
      if (req.method() === 'DELETE') {
        const paths = req.postDataJSON().prefixes;
        paths.forEach((p) => state.objects.delete(p));
        return json(paths.map((name) => ({ name })));
      }
    }
    if (url.pathname === '/rest/v1/posts') {
      const id = (url.searchParams.get('id') || '').slice(3);
      state.selects.push(url.searchParams.get('select'));
      if (req.method() === 'GET' && !state.observationColumn && url.searchParams.get('select').includes('observation'))
        return json({ code: '42703', message: 'column observation does not exist' }, 400);
      if (req.method() === 'GET')
        return state.getFail
          ? json({ message: 'read outage' }, 503)
          : json(state.posts.find((p) => p.id === id) || null);
      if (req.method() === 'PATCH') {
        const p = state.posts.find((p) => p.id === id);
        if (admin && p) {
          Object.assign(p, req.postDataJSON());
          return json([{ id }]);
        }
        return json([]);
      }
      if (req.method() === 'DELETE') {
        state.posts = state.posts.filter((p) => p.id !== id);
        return json([{ id }]);
      }
    }
    if (url.pathname === '/rest/v1/comments') {
      state.queries.push(url);
      if (req.method() === 'GET') {
        if (state.commentFail) return json({ message: 'comment outage' }, 503);
        if (url.searchParams.get('id'))
          return json(
            state.comments.find((c) => c.id === url.searchParams.get('id').slice(3)) || null,
          );
        let rows = ordered(
          state.comments.filter(
            (c) => c.post_id === (url.searchParams.get('post_id') || '').slice(3),
          ),
        );
        const raw = url.searchParams.get('or');
        if (raw) {
          const match =
            /^\(created_at.lt.([^,]+),and\(created_at.eq.([^,]+),id.lt.([0-9a-f-]+)\)\)$/.exec(raw);
          assert.ok(match);
          assert.equal(match[1], match[2]);
          rows = cursor(rows, match[1], match[3]);
        }
        assert.equal(url.searchParams.get('limit'), '21');
        return json(rows.slice(0, 21));
      }
      if (req.method() === 'POST') {
        if (state.commentFail) return json({ message: 'write outage' }, 503);
        const b = req.postDataJSON();
        state.comments.push({
          ...b,
          id: b.id || uid(10000 + state.comments.length),
          created_at: now(),
        });
        if (state.loseComment) {
          state.loseComment = false;
          return json({ message: 'lost comment response' }, 503);
        }
        return json(null, 201);
      }
      if (req.method() === 'DELETE') {
        const id = url.searchParams.get('id').slice(3);
        state.comments = state.comments.filter((c) => c.id !== id);
        return json([{ id }]);
      }
    }
    return json({ message: 'unexpected fixture request ' + url.pathname }, 400);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => errors.push(e.message));
  return {
    context,
    page,
    state,
    errors,
    close: async () => {
      ok('no browser exceptions: ' + errors.join(', '), errors.length === 0);
      await context.close();
    },
  };
}
try {
  {
    const f = await fixture(), {page, state} = f;
    await page.goto(base + '/lounge.html');
    await page.getByRole('link', {name:'기존 관측 후기', exact:true}).waitFor();
    let release;
    state.memberVisitGate = new Promise(resolve => { release = resolve; });
    const checking = page.waitForRequest(r => r.url().endsWith('/rpc/member_visit'));
    await page.locator('#writeTop').click();
    await checking;
    await page.getByLabel('제목 선택 · 80자 이내').fill('서울에서 본 토성');
    const response = page.waitForResponse(r => r.url().endsWith('/rpc/member_visit'));
    release();
    await response;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    ok('late member refresh never steals focus from an active title field', await page.locator('#postTitle').evaluate(e => e === document.activeElement));
    state.memberVisitGate = null;
    await page.getByLabel('이야기나 궁금한 점').fill('고리가 또렷하게 보였습니다.');
    state.postFail = true;
    await page.locator('#btnTrace').click();
    await page.locator('#writeStatus').filter({hasText:'등록 여부'}).waitFor();
    ok('delayed identity check and failed save retain literal title and body',
      await page.locator('#postTitle').inputValue() === '서울에서 본 토성' &&
      await page.locator('#postInput').inputValue() === '고리가 또렷하게 보였습니다.');
    await f.close();
  }
  {
    const f = await fixture({admin:true}), {page,state} = f;
    state.deliveries={unread:1,events:[{event_id:'test-delivery',email_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',recipient:'naver-user@example.test',event_type:'email.suppressed',reason:'OnAccountSuppressionList',occurred_at:now(),acknowledged_at:null}]};
    await page.route('**/data/news.json',route=>route.fulfill({json:{checkedAt:new Date(Date.now()-5*3600000).toISOString(),sources:[{status:'ok',lastSuccessfulAt:new Date(Date.now()-5*3600000).toISOString()}]}}));
    await page.goto(base+'/admin.html');
    await page.locator('#noticePanel').waitFor();
    await page.locator('[data-mail-status]').filter({hasText:'미확인 1건'}).waitFor();
    await page.locator('[data-news-status]').filter({hasText:'갱신 지연'}).waitFor();
    ok('operator sees suppressed recipients and stale public news',await page.locator('[data-mail-list]').innerText().then(t=>t.includes('발송 차단')&&t.includes('naver-user@example.test')));
    await page.getByRole('button',{name:'확인했어요',exact:true}).click();
    await page.locator('[data-mail-status]').filter({hasText:'미확인 0건'}).waitFor();
    ok('acknowledgment clears unread count but preserves incident history',await page.locator('[data-mail-list]').innerText().then(t=>t.includes('확인됨')));
    state.deliveryFail=true;
    await page.getByRole('button',{name:'운영 상태 새로고침'}).click();
    await page.locator('[data-mail-status]').filter({hasText:'불러오지 못했어요'}).waitFor();
    ok('mail loading failure is not displayed as zero failures',await page.locator('[data-mail-status]').getAttribute('data-warning')==='true');
    state.deliveryFail=false;
    await page.getByRole('button',{name:'운영 상태 새로고침'}).click();
    await page.locator('[data-mail-status]').filter({hasText:'미확인 0건'}).waitFor();
    await page.locator('.vs-bar').first().waitFor({state:'attached'});
    ok('visit chart includes fourteen calendar days, with zero-visit days preserved',await page.locator('.vs-bar').count()===14&&await page.locator('.vs-bar').evaluateAll(rows=>rows.filter(r=>r.style.height==='0%').length>=12));
    await page.locator('#noticeTitle').fill('처음 오신 분께');
    await page.locator('#noticeBody').fill('자유롭게 이야기를 나눠주세요.');
    state.loseCommit = true;
    await page.locator('#publishNotice').click();
    await page.locator('#noticeStatus').filter({hasText:'중복 등록되지'}).waitFor();
    ok('uncertain notice save freezes its literal payload',await page.locator('#noticeTitle').evaluate(e=>e.readOnly));
    await page.locator('#publishNotice').click();
    await page.locator('.notice-row').waitFor();
    ok('notice retry publishes one pinned post',state.posts.filter(p=>p.is_pinned).length===1);
    const link=await page.locator('.notice-row a').getAttribute('href');
    ok('notice opens its permanent board URL',new URL(link,base).searchParams.get('post')===state.posts[0].id);
    for (const width of [390,1440]) {
      await page.setViewportSize({width,height:1000});
      ok('admin notice controls fit '+width+'px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    }
    if(process.env.ORBIT_QA_DIR) await page.screenshot({path:process.env.ORBIT_QA_DIR+'/admin-desktop.png',fullPage:true});
    await page.locator('.notice-row button').click();
    await page.locator('#noticeStatus').filter({hasText:'고정을 해제'}).waitFor();
    ok('unpin keeps the published post',state.posts.length===2&&!state.posts[0].is_pinned);
    await page.locator('#btnOut').click();
    await page.locator('#loginView').waitFor();
    ok('logout closes notice and private operations',await page.locator('#noticePanel').isHidden()&&await page.locator('#reportPanel').isHidden()&&await page.locator('#operationsPanel').isHidden()&&await page.locator('[data-mail-list]').innerText()==='');
    await f.close();
  }
  for(const registered of [false,true]) {
    const f=await fixture({signedIn:true,registered}), {page}=f;
    await page.goto(base+'/admin.html');
    await page.locator(registered?'#whoRole':'#loginView').waitFor();
    if(registered) await page.locator('#whoRole').filter({hasText:'권한 없음'}).waitFor();
    ok('non-admin cannot see notice or delivery controls, registered='+registered,await page.locator('#noticePanel').isHidden()&&await page.locator('#operationsPanel').isHidden());
    await page.goto(base+'/lounge.html?write=1');
    await page.locator('#postInput').waitFor();
    ok('ordinary writer has no notice toggle',await page.locator('#postPinned').count()===0);
    await f.close();
  }

  {
    const f=await fixture({signedIn:true}),{page,state}=f;
    state.posts=Array.from({length:40},(_,i)=>({id:uid(2000+i),title:'관측 이야기 '+i+' — 밝은 별을 봤어요',text:'본문',nick:'관측자',orbit:'report',author_id:A,created_at:'2026-09-14T01:00:00Z',image_paths:[]}));
    state.posts.push({id:uid(2990),title:'함께 읽는 게시판 공지',text:'공지 내용',nick:'ORBIT',orbit:'free',author_id:A,created_at:'2026-09-14T02:00:00Z',image_paths:[],is_pinned:true});
    await page.goto(base+'/main.html#lounge');
    const frame=page.frameLocator('#loungeFrame');
    await frame.locator('.board-row').first().waitFor();
    for(const width of [320,390,1440,1920,3440]) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.waitForFunction(()=>{const f=document.querySelector('#loungeFrame');return f.contentDocument.documentElement.scrollHeight<=f.clientHeight+2;});
      const layout=await frame.locator('#listView').evaluate(el=>{
        const row=el.querySelector('.board-row').getBoundingClientRect();
        const search=el.querySelector('#feedSearch').getBoundingClientRect();
        return {
          rowHeight:row.height,
          rows:el.querySelectorAll('.board-row').length,
          searchBefore:search.bottom<=el.querySelector('#postList').getBoundingClientRect().top,
          noticeBefore:el.querySelector('#pinnedPosts').getBoundingClientRect().bottom<=search.top,
          searchTarget:el.querySelector('#feedSearch button').getBoundingClientRect().height,
          writeTarget:document.querySelector('#writeTop').getBoundingClientRect().height,
        };
      });
      ok('twenty readable rows keep notices and search above the list at '+width+'px',layout.rows===20&&layout.rowHeight<=(width<=860?160:96)&&layout.noticeBefore&&layout.searchBefore);
      ok('search and writing keep 44px targets at '+width+'px',layout.searchTarget>=44&&layout.writeTarget>=44);
      if(width>=1440) ok('first post is visible without scrolling at '+width+'px',await page.evaluate(()=>{
        const f=document.querySelector('#loungeFrame');
        return f.getBoundingClientRect().top+f.contentDocument.querySelector('.board-row').getBoundingClientRect().bottom<=innerHeight;
      }));
      ok('expanded board fits its frame at '+width+'px',await page.evaluate(()=>{const f=document.querySelector('#loungeFrame'),p=document.querySelector('.panel-wrap'),t=document.querySelector('.story-teaser');return document.documentElement.scrollWidth<=innerWidth+1&&Math.abs(f.getBoundingClientRect().right-t.getBoundingClientRect().right)<2;}));
      if(process.env.ORBIT_QA_FONT&&[390,1440].includes(width)) await page.screenshot({path:'/tmp/orbit-compact-list-'+width+'.png',fullPage:true});
    }
    await page.setViewportSize({width:1440,height:1000});
    await frame.locator('.board-row').nth(14).scrollIntoViewIfNeeded();
    const oldScroll=await page.evaluate(()=>window.scrollY);
    await frame.locator('.row-title').nth(14).click();
    await frame.locator('.detail-title').waitFor();
    await frame.locator('#backToFeed').click();
    await page.waitForFunction(y=>Math.abs(window.scrollY-y)<8,oldScroll);
    ok('detail back restores the outer page scroll position');
    await frame.locator('#writeTop').click();
    await frame.locator('#postInput').fill('광학 장비 없이 본 하늘');
    for(const width of [390,1440]) {
      await page.setViewportSize({width,height:844});
      await frame.locator('#observationFields').evaluate(el=>el.open=true);
      await frame.locator('#equipmentFields').evaluate(el=>el.open=true);
      await page.waitForFunction(()=>{const f=document.querySelector('#loungeFrame');return f.contentDocument.documentElement.scrollHeight<=f.clientHeight+2;});
      ok('expanded writing options have no nested frame scrollbar at '+width+'px',await frame.locator('#postInput').inputValue()==='광학 장비 없이 본 하늘'&&!await frame.getByText('5,000자 이내',{exact:true}).count());
      await frame.locator('#observationFields').evaluate(el=>el.open=false);
      await frame.locator('#equipmentFields').evaluate(el=>el.open=false);
      await page.waitForFunction(()=>{const f=document.querySelector('#loungeFrame');return Math.abs(f.contentDocument.querySelector('#boardMain').getBoundingClientRect().height-f.clientHeight)<=2;});
    }
    await page.screenshot({path:'/tmp/orbit-writing-wide.png',fullPage:true});
    await f.close();
  }
  {
    const f=await fixture({signedIn:true}),{page,state}=f;
    state.posts[0].author_id=A;state.posts[0].text='긴 관측 이야기입니다.\n'.repeat(150);
    state.comments=[{id:uid(2999),post_id:P,nick:'다른별',text:'아직 화면 아래에 있는 답글',author_id:uid(99),created_at:now()}];
    await page.goto(base+'/main.html#lounge');
    const frame=page.frameLocator('#loungeFrame');
    await frame.locator('.row-title').click();
    await frame.locator('.comment-item').waitFor();
    await page.waitForFunction(()=>{const f=document.querySelector('#loungeFrame');return f.clientHeight>2000;});
    ok('full-height frame does not mark offscreen replies read',state.receipts.size===0);
    await frame.locator('.comment-item').scrollIntoViewIfNeeded();
    await page.waitForResponse(r=>r.url().endsWith('/rpc/mark_board_comments_read')&&r.status()===200);
    ok('reply becomes read after scrolling the outer page into view',state.receipts.has(uid(2999)));
    await frame.getByRole('button',{name:'신고·삭제 요청',exact:true}).last().click();
    await frame.locator('dialog[open]').waitFor();
    ok('embedded report dialog stays in the visible outer viewport',await page.evaluate(()=>{
      const f=document.querySelector('#loungeFrame'),r=f.contentDocument.querySelector('dialog[open]').getBoundingClientRect(),top=f.getBoundingClientRect().top;
      return top+r.top>=0&&top+r.bottom<=innerHeight+1;
    }));
    await frame.getByRole('button',{name:'취소',exact:true}).click();

    await f.close();
  }
  {
    const f=await fixture({nickname:'',signedIn:false,registered:false}), {page,state}=f;
    await page.goto(base+'/lounge.html?activity=mine&embed=1');
    await page.getByRole('heading',{name:'이 브라우저에서 시작한 활동이 없어요'}).waitFor();
    ok('viewing personal activity never creates an anonymous account or fetches someone else\'s posts', state.signups===0&&state.activityCalls.length===0);
    await page.getByRole('link',{name:'이야기 둘러보기',exact:true}).click();
    await page.locator('.board-row').waitFor();
    ok('personal empty state returns to the embedded community',new URL(page.url()).searchParams.get('embed')==='1'&&!new URL(page.url()).searchParams.has('activity'));
    await f.close();
  }
  {
    const f=await fixture({signedIn:true}), {page,state}=f;
    state.posts[0].author_id=A;
    state.posts[0].text='긴 이야기입니다.\n'.repeat(150);
    state.comments=Array.from({length:23},(_,i)=>({id:uid(300+i),post_id:P,nick:'답하는별',text:'새로운 답글 '+i,author_id:uid(99),created_at:new Date(Date.UTC(2026,8,13,10,i)).toISOString()}));
    await page.goto(base+'/lounge.html');
    await page.locator('#activityBadge').filter({hasText:'새 답글 1'}).waitFor();
    await page.locator('#activityLink').click();
    await page.locator('.reply-badge').filter({hasText:'23개'}).waitFor();
    ok('the new reply badge opens unread conversations directly',new URL(page.url()).searchParams.get('activity')==='unread');
    await page.locator('.row-title').click();
    await page.locator('#commentMessage').filter({hasText:'20개 표시'}).waitFor();
    ok('opening a long article does not mark offscreen replies read',state.readCalls.length===0);
    const late={id:uid(900),post_id:P,nick:'늦은별',text:'화면을 연 뒤 달린 답글',author_id:uid(99),created_at:'2026-09-13T12:00:00Z'};
    state.comments.push(late);
    state.readFail=true;
    await page.locator('.comment-item').first().scrollIntoViewIfNeeded();
    await page.locator('#readSyncStatus').waitFor();
    ok('failed read receipt keeps replies unread and offers retry',state.receipts.size===0&&await page.locator('#readSyncRetry').isVisible());
    state.readFail=false;
    const saved=page.waitForResponse(r=>r.url().endsWith('/rpc/mark_board_comments_read')&&r.status()===200);
    await page.locator('#readSyncRetry').click();
    await saved;
    await page.locator('#readSyncStatus').waitFor({state:'hidden'});
    ok('only rendered replies are acknowledged, excluding older pages and concurrent arrivals',state.receipts.size>0&&state.receipts.size<23&&![uid(300),uid(301),uid(302),late.id].some(id=>state.receipts.has(id)));
    await page.locator('#backToFeed').click();
    await page.locator('.reply-badge').waitFor();
    ok('returning to activity retains unread replies and a clean personal route',new URL(page.url()).searchParams.get('activity')==='unread'&&await page.locator('.board-row').count()===1);
    await page.reload();
    await page.locator('.reply-badge').waitFor();
    ok('personal activity and read state survive a page reload',state.receipts.size>0&&state.signups===0);
    state.activityFail=true;
    await page.locator('#refreshList').click();
    await page.locator('#activityStatus').waitFor();
    ok('activity service failure keeps the previously readable list',await page.locator('.board-row').count()===1);
    state.activityFail=false;
    await page.locator('#activityRetry').click();
    await page.locator('#activityStatus').waitFor({state:'hidden'});
    for(const width of [320,390,1440]) {
      await page.setViewportSize({width,height:900});
      ok('personal activity fits '+width+'px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    }
    await f.close();
  }
  {
    const f=await fixture({signedIn:true}),{page,state}=f;
    state.posts=Array.from({length:23},(_,i)=>({id:uid(600+i),title:'내 이야기 '+i,text:'내용',nick:'나',orbit:'free',author_id:A,created_at:'2026-09-13T12:00:00Z',image_paths:[],is_pinned:i===22}));
    state.posts.push({id:P,title:'다른 사람의 이야기',text:'내용',nick:'다른별',orbit:'free',author_id:uid(88),created_at:'2026-09-13T13:00:00Z',image_paths:[]});
    state.comments=[{id:uid(800),post_id:P,nick:'나',text:'참여했어요',author_id:A,created_at:'2026-09-13T14:00:00Z'}];
    await page.goto(base+'/lounge.html?activity=mine');
    await page.locator('#feedContext').filter({hasText:'20개 표시'}).waitFor();
    ok('personal feed includes owned pinned posts without unrelated notices',await page.locator('.row-title').filter({hasText:'내 이야기 22'}).count()===1&&await page.locator('.pinned-row').count()===0);
    await page.locator('#loadMore').click();
    await page.locator('#feedContext').filter({hasText:'23개 표시'}).waitFor();
    ok('personal cursor pagination loads older posts once',new Set(await page.locator('.board-row').evaluateAll(rows=>rows.map(r=>r.id))).size===23);
    await page.getByRole('link',{name:'참여한 글',exact:true}).click();
    await page.getByRole('link',{name:'다른 사람의 이야기',exact:true}).waitFor();
    ok('participated conversations are separate from authored posts',await page.locator('.board-row').count()===1);
    await page.getByLabel('게시글 찾기').fill('존재하지 않는 단어');
    await page.getByRole('button',{name:'검색',exact:true}).click();
    await page.getByRole('link',{name:'검색어 지우기',exact:true}).click();
    await page.locator('.row-title').waitFor();
    ok('empty personal search restores its current activity scope',new URL(page.url()).searchParams.get('activity')==='joined'&&!new URL(page.url()).searchParams.has('q'));
    await page.locator('#activityLink').click();
    await page.locator('.pinned-row').waitFor();
    await page.locator('#activityLink').click();
    await page.locator('.row-title').first().click();
    await page.locator('.detail-title').waitFor();
    await page.locator('#backToFeed').click();
    await page.locator('.row-title').first().waitFor();
    ok('returning from a personal detail never restores notices from the public feed',await page.locator('#pinnedPosts').isHidden()&&await page.locator('.pinned-row').count()===0);
    await f.close();
  }
  {
    const f = await fixture(), { page, state } = f;
    state.posts = [];
    await page.goto(base + '/lounge.html?embed=1');
    await page.getByRole('link', { name: '한 줄 남기기', exact: true }).waitFor();
    ok('empty board offers a first story without duplicate bottom writing controls',
      await page.getByRole('heading', { name: '오늘 하늘은 어땠나요?' }).isVisible() &&
      await page.locator('#writeBottom').isHidden());
    await page.getByLabel('질문만 보기', { exact: true }).check();
    await page.getByRole('link', { name: '질문 남기기', exact: true }).click();
    ok('question invitation keeps the embedded route and preselects a question',
      new URL(page.url()).searchParams.get('embed') === '1' &&
      await page.locator('#orbitSelect').inputValue() === 'ask');
    await page.locator('#cancelWriteLink').click();
    await page.getByRole('link', { name: '전체 글 보기', exact: true }).click();
    await page.getByRole('link', { name: '한 줄 남기기', exact: true }).waitFor();
    ok('empty question recovery returns to the unified feed',
      new URL(page.url()).hash === '#all' && !await page.getByLabel('질문만 보기', { exact: true }).isChecked());
    await page.getByRole('link', { name: '한 줄 남기기', exact: true }).click();
    ok('first story invitation still uses the free category', await page.locator('#orbitSelect').inputValue() === 'free');
    await page.locator('#cancelWriteLink').click();
    await page.getByLabel('질문만 보기', { exact: true }).check();
    await page.getByLabel('게시글 찾기').fill('없는 단어');
    await page.getByRole('button', { name: '검색', exact: true }).click();
    await page.getByRole('link', { name: '검색어 지우기', exact: true }).click();
    await page.getByRole('heading', { name: '아직 올라온 질문이 없어요' }).waitFor();
    ok('search recovery removes only the query and preserves the question filter',
      !new URL(page.url()).searchParams.has('q') && new URL(page.url()).hash === '#ask');
    state.getFail = true;
    await page.locator('#refreshList').click();
    await page.getByRole('button', { name: '다시 불러오기', exact: true }).waitFor();
    ok('a failed request is not presented as an empty community', await page.locator('.board-empty').count() === 0);
    await f.close();
  }
  {
    const f = await fixture(), { page, state } = f;
    await page.goto(base + '/lounge.html#report');
    await page.getByRole('link', { name: '기존 관측 후기', exact: true }).waitFor();
    ok('old category URLs retain their filter and offer an escape',
      state.boardCalls.some(b => b.p_orbit === 'report') && await page.locator('#clearChannel').isVisible());
    await page.locator('#clearChannel').click();
    await page.getByRole('link', { name: '기존 관측 후기', exact: true }).waitFor();
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction(()=>!!document.querySelector('.sidebar > .news-brief')===(innerWidth>860));
      const geometry = await page.evaluate(() => {
        const list = document.getElementById('postList').getBoundingClientRect();
        const news = document.querySelector('.news-brief--board').getBoundingClientRect();
        const write = document.getElementById('writeBottom').getBoundingClientRect();
        return { list: { bottom: list.bottom, right: list.right, left: list.left }, news: { top: news.top, left: news.left, right: news.right }, write: write.bottom,
          fits: document.documentElement.scrollWidth <= innerWidth + 1 };
      });
      ok('community comes before news without overflow at ' + width + 'px', geometry.fits &&
        (width <= 860 ? geometry.news.top >= Math.max(geometry.list.bottom, geometry.write) : geometry.news.right <= geometry.list.left));
    }
    await f.close();
  }
  {
    const f=await fixture({nickname:'',signedIn:false,registered:false}),{page,state}=f;
    const draftKey='orbit_board_drafts_v1', title='로그인 전에 쓴 달 관측 기록', text='오늘 달이 구름 사이로 잠깐 보였어요.';
    await page.goto(base+'/lounge.html?write=1');
    await page.locator('#postInput').waitFor();
    ok('visitor can draft before login without creating an account or public post',
      await page.locator('#postForm').isVisible()&&await page.locator('.account-dialog[open]').count()===0&&state.signups===0&&state.inserts===0);
    await page.locator('#postTitle').fill(title);
    await page.locator('#postInput').fill(text);
    await page.locator('#orbitSelect').selectOption('report');
    await page.locator('#observationFields summary').click();
    await page.locator('#observedLocation').fill('집 앞 공원');
    await page.waitForFunction(key=>(localStorage.getItem(key)||'').includes('집 앞 공원'),draftKey);
    ok('draft is stored on this device without sending its text to the service',
      state.inserts===0&&state.signups===0&&state.logins===0&&
      await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).drafts.some(d=>d.observation.location==='집 앞 공원'&&d.orbit==='report'),draftKey));
    await page.reload();
    await page.locator('#postInput').waitFor();
    await page.waitForFunction(title=>document.querySelector('#postTitle').value===title,title);
    ok('refresh restores literal title, body, category and observation details',
      await page.locator('#postTitle').inputValue()===title&&await page.locator('#postInput').inputValue()===text&&
      await page.locator('#orbitSelect').inputValue()==='report'&&await page.locator('#observedLocation').inputValue()==='집 앞 공원');
    const otherTab=await f.context.newPage();
    await otherTab.goto(base+'/lounge.html?write=1');
    await otherTab.locator('#postInput').waitFor();
    ok('another visitor tab does not reveal the saved draft',await otherTab.locator('#postTitle').inputValue()===''&&await otherTab.locator('#postInput').inputValue()==='');
    await otherTab.close();
    await page.locator('#btnTrace').click();
    await page.getByRole('dialog',{name:'로그인',exact:true}).waitFor();
    ok('publication asks for login and keeps the saved draft without creating an anonymous account',
      (await page.locator('#writeStatus').textContent()).includes('로그인')&&
      await page.locator('#postInput').inputValue()===text&&state.signups===0&&state.inserts===0);
    state.profile={nickname:'돌아온별',level:1,xp:0,level_start:0,next_level:10,joined_at:now()};
    await page.locator('#email').fill('draft-member@example.test');
    await page.locator('#password').fill('mock-login-password');
    await page.locator('#authSubmit').click();
    await page.locator('#profileCard').waitFor();
    ok('login preserves the editor and never publishes the draft automatically',
      state.logins===1&&state.inserts===0&&await page.locator('#postTitle').inputValue()===title&&await page.locator('#postInput').inputValue()===text);
    await page.locator('.account-close').click();
    await page.locator('#btnTrace').click();
    await page.locator('.detail-title').filter({hasText:title}).waitFor();
    ok('explicit publication uses the saved content once and removes its local copy',
      state.posts.filter(p=>p.title===title&&p.text===text&&p.observation.location==='집 앞 공원').length===1&&
      await page.evaluate(({key,title})=>!(localStorage.getItem(key)||'').includes(title),{key:draftKey,title}));
    await page.goto(base+'/lounge.html?write=1');
    await page.locator('#postInput').waitFor();
    ok('a new editor stays empty after successful publication',await page.locator('#postTitle').inputValue()===''&&await page.locator('#postInput').inputValue()==='');
    await page.locator('#postInput').fill('직접 지우려는 임시 글');
    await page.waitForFunction(key=>(localStorage.getItem(key)||'').includes('직접 지우려는 임시 글'),draftKey);
    await page.locator('#clearDraft').click();
    await page.reload();
    await page.locator('#postInput').waitFor();
    ok('explicitly clearing a draft keeps it removed after refresh',await page.locator('#postInput').inputValue()===''&&
      await page.evaluate(key=>!(localStorage.getItem(key)||'').includes('직접 지우려는 임시 글'),draftKey));
    await f.close();
  }
  {
    const f=await fixture({nickname:'',signedIn:false,registered:false}),{page,state}=f;
    await page.goto(base+'/main.html#lounge');
    const frame=page.frameLocator('#loungeFrame');
    await frame.locator('#writeTop').click();
    await frame.locator('#postTitle').fill('상단 로그인으로 이어 쓰는 글');
    await frame.locator('#postInput').fill('로그인 창을 열어도 이 문장은 남아 있어야 해요.');
    await page.waitForURL(url=>url.searchParams.get('write')==='1');
    await page.waitForFunction(()=>(localStorage.getItem('orbit_board_drafts_v1')||'').includes('로그인 창을 열어도 이 문장은 남아 있어야 해요.'));
    await page.reload();
    await frame.locator('#postForm').waitFor();
    await page.waitForFunction(()=>document.querySelector('#loungeFrame').contentDocument.querySelector('#postInput').value==='로그인 창을 열어도 이 문장은 남아 있어야 해요.');
    ok('refreshing the whole main page reopens the embedded editor with its draft',
      await frame.locator('#postTitle').inputValue()==='상단 로그인으로 이어 쓰는 글'&&
      await frame.locator('#postForm').isVisible()&&new URL(page.url()).hash==='#lounge');
    await page.locator('#profileChip').click();
    await page.getByRole('dialog',{name:'로그인',exact:true}).waitFor();
    state.profile={nickname:'상단로그인별',level:1,xp:0,level_start:0,next_level:10,joined_at:now()};
    await page.locator('#email').fill('header-login@example.test');
    await page.locator('#password').fill('mock-header-password');
    await page.locator('#authSubmit').click();
    await page.locator('#profileCard').waitFor();
    await page.waitForFunction(()=>document.querySelector('#loungeFrame').contentWindow.OrbitMembers.state.profile?.nickname==='상단로그인별');
    await page.locator('.account-close').click();
    ok('parent header login keeps the embedded visitor draft without publishing it',
      await frame.locator('#postTitle').inputValue()==='상단 로그인으로 이어 쓰는 글'&&
      await frame.locator('#postInput').inputValue()==='로그인 창을 열어도 이 문장은 남아 있어야 해요.'&&
      state.inserts===0&&state.signups===0&&state.logins===1);
    await f.close();
  }
  {
    const f=await fixture(),{page}=f;
    await f.context.addInitScript(({owner,otherOwner})=>{
      const row={updatedAt:Date.now(),title:'다른 계정의 비공개 초안',text:'다른 계정의 내용',orbit:'free',observation:{},hasPhotos:false};
      localStorage.setItem('orbit_board_drafts_v1',JSON.stringify({version:1,drafts:[
        {...row,owner:otherOwner},
        {...row,owner,title:'기한이 지난 내 초안',updatedAt:Date.now()-8*86400000},
      ]}));
    },{owner:'member:'+A,otherOwner:'member:'+uid(999)});
    await page.goto(base+'/lounge.html?write=1');
    await page.locator('#postInput').waitFor();
    await page.waitForFunction(()=>!(localStorage.getItem('orbit_board_drafts_v1')||'').includes('기한이 지난 내 초안'));
    ok('expired drafts are removed and another account draft never fills the editor',
      await page.locator('#postTitle').inputValue()===''&&await page.locator('#postInput').inputValue()===''&&
      await page.evaluate(()=>!(localStorage.getItem('orbit_board_drafts_v1')||'').includes('기한이 지난 내 초안')));
    await f.close();
  }
  {
    const f=await fixture(),{page,state}=f;
    await page.goto(base+'/lounge.html?write=1');
    await page.locator('#postInput').waitFor();
    await page.evaluate(async()=>{
      const original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){
        if(key==='orbit_board_drafts_v1'||key==='orbit_nickname')throw new DOMException('Test storage quota','QuotaExceededError');
        return original.call(this,key,value);
      };
      await window.OrbitMembers.refresh();
    });
    await page.locator('#postTitle').fill('저장 공간이 부족해도 남기는 이야기');
    await page.locator('#postInput').fill('이 화면에 입력한 내용은 유지되어야 해요.');
    await page.waitForFunction(()=>/저장.*(못|없)|저장 실패/.test(document.querySelector('#draftStatus').textContent));
    ok('storage failure keeps current input and does not turn a member into an authentication error',
      await page.locator('#postTitle').inputValue()==='저장 공간이 부족해도 남기는 이야기'&&
      await page.locator('#postInput').inputValue()==='이 화면에 입력한 내용은 유지되어야 해요.'&&
      await page.evaluate(()=>window.OrbitMembers.state.error===null)&&state.inserts===0);
    await page.locator('#btnTrace').click();
    await page.locator('.detail-title').filter({hasText:'저장 공간이 부족해도 남기는 이야기'}).waitFor();
    ok('blocked local draft storage does not prevent an authenticated publication',state.posts.some(p=>p.title==='저장 공간이 부족해도 남기는 이야기'));
    await f.close();
  }
  {
    const f = await fixture({ nickname: '처음본별' }), { page, state } = f;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '/lounge.html?write=1');
    await page.locator('#postInput').waitFor();
    ok('members write directly with their account nickname', await page.locator('#postForm').isVisible() && state.signups === 0);
    ok('optional observation sections begin collapsed', await page.locator('.observation-fields[open]').count() === 0);
    ok('a general first story defaults to the existing free channel', await page.locator('#orbitSelect').inputValue() === 'free');
    await page.locator('#postInput').fill('오늘은 달을 봤어요. 이름은 잘 몰라도 즐거웠어요.');
    await page.locator('#btnTrace').click();
    await page.locator('.detail-title').filter({ hasText: '오늘은 달을 봤어요.' }).waitFor();
    ok('one-line posting uses the member nickname without a second nickname form', state.posts[0].title === '오늘은 달을 봤어요.' && state.posts[0].nick === '처음본별' && state.posts[0].image_paths.length === 0 && Object.keys(state.posts[0].observation).length === 0);
    ok('empty optional metadata adds no empty detail panels', await page.locator('.observation-record').count() === 0);
    await f.close();
  }
  {
    const f = await fixture(), { page, state } = f;
    await page.goto(base + '/lounge.html?write=1#report');
    ok('direct observation link keeps its selected category', await page.locator('#orbitSelect').inputValue() === 'report');
    await page.locator('#postInput').fill('M13을 봤어요. M13은 작은 솜뭉치 같았어요. 돕으로 함께 봤어요.');
    await page.locator('#observationFields summary').click();
    await page.locator('#observedMethod').selectOption('telescope');
    await page.locator('#observedAt').fill('어젯밤 9시쯤');
    await page.locator('#observedLocation').fill('서울, 집 창문에서');
    await page.locator('#observedTarget').fill('M13');
    await page.locator('#equipmentFields summary').click();
    await page.locator('#observedTelescope').fill('Nexstar 102GT');
    await page.locator('#observedExposure').fill('30초씩 35장');
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      ok('expanded writing fields fit ' + width + 'px', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await page.screenshot({ path: '/tmp/orbit-easy-writing-expanded.png', fullPage: true });
    state.loseCommit = true;
    await page.locator('#btnTrace').click();
    await page.locator('#writeStatus').filter({ hasText: '등록 여부를 확인하지 못했어요' }).waitFor();
    ok('ambiguous save locks observation fields and retains the data', await page.locator('#observedLocation').isDisabled() && await page.locator('#observedLocation').inputValue() === '서울, 집 창문에서');
    await page.locator('#btnTrace').click();
    await page.locator('.detail-title').filter({ hasText: 'M13을 봤어요.' }).waitFor();
    ok('retry preserves one post and its separate observation record', state.posts.length === 2 && state.posts[0].observation.telescope === 'Nexstar 102GT' && state.posts[0].text === 'M13을 봤어요. M13은 작은 솜뭉치 같았어요. 돕으로 함께 봤어요.');
    ok('basic record is visible while equipment is folded', (await page.locator('#observationRecord').textContent()).includes('서울, 집 창문에서') && await page.locator('.observation-record-gear[open]').count() === 0);
    ok('only the first occurrence of each term is annotated across body and record', await page.getByRole('button', { name: 'M13 뜻 보기', exact: true }).count() === 1);
    await page.getByRole('button', { name: 'M13 뜻 보기', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    ok('tap opens a sourced glossary explanation', (await page.getByRole('dialog').textContent()).includes('구상성단') && (await page.getByRole('dialog').locator('a').getAttribute('href')).startsWith('https://science.nasa.gov/'));
    await page.keyboard.press('Escape');
    ok('Escape closes the glossary and returns keyboard focus', await page.getByRole('dialog').count() === 0 && await page.evaluate(() => document.activeElement.getAttribute('aria-label') === 'M13 뜻 보기'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: '돕 뜻 보기', exact: true }).click();
    await page.screenshot({ path: '/tmp/orbit-glossary-390.png', fullPage: true });
    ok('glossary fits a narrow screen', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.getByRole('button', { name: '설명 닫기' }).click();
    await page.reload();
    await page.locator('#observationRecord').filter({ hasText: '서울, 집 창문에서' }).waitFor();
    ok('observation record survives reload', true);
    await page.screenshot({ path: '/tmp/orbit-observation-detail-390.png', fullPage: true });
    await f.close();
  }
  {
    const f = await fixture(), { page, state } = f;
    state.observationColumn = false;
    await page.goto(base + '/lounge.html?post=' + P);
    await page.locator('.detail-body').waitFor();
    ok('old database rollout still permits reading existing posts', (await page.locator('.detail-body').textContent()) === '기존 글의 본문입니다.');
    state.observationVersion = 0;
    await page.goto(base + '/lounge.html?write=1');
    await page.locator('#postInput').fill('추가 정보도 남길게요.');
    await page.locator('#observationFields summary').click();
    await page.locator('#observedLocation').fill('광주');
    await page.locator('#btnTrace').click();
    await page.locator('#writeStatus').filter({ hasText: '추가 정보를 아직 저장할 수 없어요' }).waitFor();
    ok('unavailable observation storage never silently drops the record', state.inserts === 0 && await page.locator('#observedLocation').inputValue() === '광주');
    await f.close();
  }
  {
    const f = await fixture(), { page, state } = f;
    state.posts[0].text = '도와주셔서 고마워요. 구경 갔어요. M130도 있어요. https://example.com/M13 <img src=x onerror=alert(1)> M57을 봤어요.';
    state.posts[0].observation = { target: '<img src=x onerror=alert(1)>', telescope: '망원경' };
    await page.goto(base + '/lounge.html?post=' + P);
    await page.locator('.detail-body').waitFor();
    ok('annotation leaves URLs, longer identifiers and ordinary words alone', await page.locator('.glossary-term').count() === 1 && (await page.locator('.glossary-term').textContent()) === 'M57');
    ok('post and observation markup remain inert text', await page.locator('.detail-body img, #observationRecord img').count() === 0 && (await page.locator('#observationRecord').textContent()).includes('<img'));
    await f.close();
  }
  {
    const f = await fixture(), { page, state } = f;
    const cases = [
      ['https://example.test/observe?q=moon&target=M13#chart', 'https://example.test/observe?q=moon&target=M13#chart.'],
      ['https://example.test/관측?q=달#사진', 'https://example.test/관측?q=달#사진'],
      ['http://example.test/wiki/Orbit_(astronomy)', '(http://example.test/wiki/Orbit_(astronomy)).'],
      ['https://example.test/square/[1]', '[https://example.test/square/[1]]'],
      ['https://example.test/punctuation', 'https://example.test/punctuation,!?:;'],
      ['https://example.test/double', '"https://example.test/double"'],
      ['https://example.test/single', "'https://example.test/single'"],
      ['https://example.test/code', '`https://example.test/code`'],
      ['https://example.test/quote', '“https://example.test/quote”'],
      ['https://example.test/book', '「https://example.test/book」'],
      ['https://example.test/angle', '<https://example.test/angle>'],
    ];
    const longURL = 'https://example.test/long?q=' + 'a'.repeat(1200),
      localURL = base + '/lounge.html?post=' + uid(998),
      source = [
        '공백 두 칸도  그대로 남겨요.',
        ...cases.map(([, sentence]) => sentence),
        '',
        'M13 관측 기록을 함께 읽어요.',
        '<img src=x onerror="window.__postMarkupExecuted=true">',
        '<script>window.__postMarkupExecuted=true</script>',
        'javascript:alert(1) data:text/html,<svg onload="window.__postMarkupExecuted=true">',
        longURL,
        localURL,
      ].join('\n');
    state.posts[0].text = source;
    state.posts.push({ ...state.posts[0], id: uid(998), title: '링크로 연 게시글', text: '새 탭의 글입니다.' });
    await page.goto(base + '/lounge.html?post=' + P);
    const body = page.locator('.detail-body');
    await body.waitFor();
    await page.getByRole('button', { name: 'M13 뜻 보기', exact: true }).waitFor();
    const links = await body.locator('a').evaluateAll(nodes => nodes.map(a => ({
      href: a.getAttribute('href'), text: a.textContent, target: a.target, rel: a.rel.split(/\s+/),
    })));
    const expected = [...cases.map(([url]) => url), longURL, localURL];
    ok('body links preserve queries, fragments and balanced brackets while excluding enclosing punctuation',
      JSON.stringify(links.map(a => a.href)) === JSON.stringify(expected.map(url => new URL(url).href)) &&
      JSON.stringify(links.map(a => a.text)) === JSON.stringify(expected));
    ok('all detected body URLs use an isolated new tab and user-content link attributes',
      links.every(a => a.target === '_blank' && ['noopener', 'noreferrer', 'ugc'].every(rel => a.rel.includes(rel))));
    ok('linkification preserves the complete original text, spacing and line breaks',
      await body.textContent() === source && await body.innerText() === source);
    ok('HTML and non-web URL schemes remain inert text in the post body',
      await body.locator('img, script, svg, iframe, [onerror], [onload], a[href^="javascript:"], a[href^="data:"]').count() === 0 &&
      await page.evaluate(() => window.__postMarkupExecuted !== true));
    ok('glossary annotation skips URL contents and still explains the first normal M13 mention',
      await body.locator('a .glossary-term').count() === 0 &&
      await body.locator('.glossary-term').count() === 1 &&
      await body.locator('a').first().textContent() === expected[0]);
    await page.setViewportSize({ width: 320, height: 900 });
    ok('a long linked URL wraps without horizontal overflow at 320px',
      await body.evaluate(el => el.scrollWidth <= el.clientWidth + 1) &&
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const originalURL = page.url();
    const [popup] = await Promise.all([
      f.context.waitForEvent('page'),
      body.getByRole('link', { name: localURL, exact: true }).click(),
    ]);
    await popup.getByRole('heading', { name: '링크로 연 게시글', exact: true }).waitFor();
    ok('an internal body link opens its real destination in a new tab without an opener',
      popup.url() === localURL && await popup.evaluate(() => window.opener === null));
    ok('opening the linked post leaves the original article and its URL intact',
      page.url() === originalURL && await body.textContent() === source &&
      await page.locator('.detail-title').textContent() === '기존 관측 후기');
    await popup.close();
    await f.close();
  }
  {
    const f=await fixture(),{page,state}=f;
    state.posts[0].view_count=1234;
    await page.goto(base+'/lounge.html');
    await page.locator('.row-meta .view-count').filter({hasText:'조회 1,234'}).waitFor();
    ok('list displays formatted views without counting',state.viewCalls.length===0&&state.signups===0);
    await page.locator('.row-title').click();
    await page.locator('#postViews').filter({hasText:'조회 1,235'}).waitFor();
    ok('a successful detail open requests the server counter',state.viewCalls.length===1);
    await page.locator('#backToFeed').click();
    await page.locator('.row-meta .view-count').filter({hasText:'조회 1,235'}).waitFor();
    ok('returning to the list retains the updated count');
    await page.locator('.row-title').click();
    await page.locator('#postViews').filter({hasText:'조회 1,235'}).waitFor();
    ok('reopening keeps the deduplicated server count');
    state.viewFail=true;
    await page.reload();
    await page.locator('.detail-body').waitFor();
    await page.locator('#postViews').filter({hasText:'조회 1,235'}).waitFor();
    ok('counter failure preserves the readable body and last known total');
    state.viewReadFail=true;
    await page.reload();
    await page.locator('.detail-body').waitFor();
    ok('complete counter outage never shows a fabricated zero',await page.locator('#postViews').textContent()==='조회 —');
    for(const width of [320,390,1440]) {
      await page.setViewportSize({width,height:900});
      await page.waitForFunction(()=>!!document.querySelector('.sidebar > .news-brief')===(innerWidth>860));
      ok('detail views fit '+width+'px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    }
    await f.close();
  }
  {
    const f=await fixture({signedIn:false,registered:false}),{page,state}=f;
    state.authFail=true;
    await page.goto(base+'/lounge.html?post='+P);
    await page.locator('.detail-body').waitFor();
    await page.waitForFunction(()=>document.querySelector('#postViews').textContent==='조회 0');
    ok('authentication failure leaves the post readable',await page.locator('.detail-title').textContent()==='기존 관측 후기');
    const before=state.viewCalls.length;
    await page.goto(base+'/lounge.html?post='+uid(999));
    await page.getByRole('heading',{name:'글을 찾을 수 없어요'}).waitFor();
    ok('missing post does not request a view increment',state.viewCalls.length===before);
    await f.close();
  }
  {
    const f=await fixture(),{page,state}=f;
    state.posts.push({...state.posts[0],id:uid(777),title:'다른 게시글',view_count:20});
    state.viewDelay=250;
    const firstViewRequest = page.waitForRequest(r=>r.url().endsWith('/rpc/record_post_view'));
    await page.goto(base+'/lounge.html?post='+P);
    await firstViewRequest;
    await page.locator('#backToFeed').click();
    await page.getByRole('link',{name:'다른 게시글',exact:true}).click();
    await page.locator('#postViews').filter({hasText:'조회 21'}).waitFor();
    ok('late response for the previous post never overwrites the current count');
    await f.close();
  }
  {
    const f = await fixture(),
      { page, state } = f;
    await page.goto(base + '/lounge.html');
    await page.getByRole('link', { name: '기존 관측 후기', exact: true }).waitFor();
    ok('reading creates no anonymous account', state.signups === 0);
    ok(
      'list loads no article body, comments, or reactions',
      (await page.locator('.detail-body').count()) === 0 &&
        state.queries.length === 0 &&
        state.selects.length === 0,
    );
    await page.locator('#writeTop').click();
    await page.getByLabel('제목 선택 · 80자 이내').fill('서울에서 본 토성');
    await page.getByLabel('이야기나 궁금한 점').fill('고리가 또렷하게 보였습니다.');
    state.postFail = true;
    await page.locator('#btnTrace').click();
    await page.locator('#writeStatus').filter({ hasText: '등록 여부' }).waitFor();
    ok(
      'write failure preserves both title and body',
      (await page.locator('#postTitle').inputValue()) === '서울에서 본 토성' &&
        (await page.locator('#postInput').inputValue()) === '고리가 또렷하게 보였습니다.',
    );
    ok(
      'uncertain write freezes its payload for idempotent retry',
      await page.locator('#postTitle').isDisabled(),
    );
    state.postFail = false;
    state.loseCommit = true;
    await page.locator('#btnTrace').click();
    await page.locator('#writeStatus').filter({ hasText: '등록 여부' }).waitFor();
    const uncertainPostId=state.posts.find(p=>p.title==='서울에서 본 토성').id;
    await page.reload();
    await page.locator('#postTitle:disabled').waitFor();
    ok('an uncertain publication restores its locked payload after refresh',
      await page.locator('#postTitle').inputValue()==='서울에서 본 토성'&&
      await page.locator('#postInput').inputValue()==='고리가 또렷하게 보였습니다.'&&await page.locator('#clearDraft').isDisabled());
    await page.locator('#btnTrace:enabled').waitFor();
    await page.locator('#btnTrace').click();
    await page.getByRole('heading', { name: '서울에서 본 토성', exact: true }).waitFor();
    ok(
      'lost commit response retry after refresh keeps the same post ID and publishes exactly once',
      state.posts.filter((p) => p.title === '서울에서 본 토성').length === 1 && state.signups === 0&&
        state.postIds.every(id=>id===uncertainPostId),
    );
    ok(
      'success opens a permanent detail URL',
      new URL(page.url()).searchParams.has('post') &&
        (await page.locator('.detail-body').textContent()) === '고리가 또렷하게 보였습니다.',
    );
    ok(
      'success clears the editor draft',
      (await page.locator('#postTitle').inputValue()) === '' &&
        (await page.locator('#postInput').inputValue()) === '',
    );
    await page.locator('#backToFeed').click();
    await page.locator('.row-title').filter({ hasText: '서울에서 본 토성' }).waitFor();
    state.getFail = true;
    await page.locator('#refreshList').click();
    await page.locator('#loungeStatus').filter({ hasText: '새로고침 실패' }).waitFor();
    ok('refresh failure keeps the readable list', (await page.locator('.board-row').count()) === 2);
    state.getFail = false;
    state.posts.push({
      id: uid(2),
      title: '늦은 장비 글',
      nick: '장비사용자',
      orbit: 'gear',
      text: '내용',
      created_at: now(),
      author_id: null,
      image_paths: [],
    });
    state.delays.ask = 250;
    await page.getByLabel('질문만 보기', { exact: true }).check();
    await page.getByLabel('질문만 보기', { exact: true }).uncheck();
    await page.waitForTimeout(350);
    ok(
      'slow question response cannot overwrite the unified feed',
      (await page.locator('.row-title').filter({ hasText: '늦은 장비 글' }).count()) === 1 &&
        !await page.getByLabel('질문만 보기', { exact: true }).isChecked(),
    );
    await f.close();
  }
  {
    const f = await fixture(),
      { page, state } = f;
    state.posts = Array.from({ length: 63 }, (_, i) => ({
      id: uid(i + 1),
      title: i === 0 ? '오래된 토성 기록' : '관측 ' + (i + 1),
      text: i === 0 ? '구름 50%_조건' : '본문',
      nick: '관측자',
      orbit: 'report',
      created_at: '2026-09-10T12:00:00.000Z',
      image_paths: [],
      is_pinned: false,
    }));
    state.posts.push({
      id: uid(900),
      title: '처음 오신 분께 드리는 공지',
      text: '공지 내용',
      nick: '운영자',
      orbit: 'free',
      created_at: now(),
      image_paths: [],
      is_pinned: true,
    });
    await page.goto(base + '/lounge.html');
    await page.locator('#feedContext').filter({ hasText: '20개 표시' }).waitFor();
    ok(
      'pinned notice is separate from 20-row list',
      (await page.locator('.board-row').count()) === 20 &&
        (await page.locator('.pinned-row').count()) === 1,
    );
    state.posts.push({
      id: uid(500),
      title: '새 글',
      text: '새 본문',
      nick: '새글',
      orbit: 'report',
      created_at: now(),
      image_paths: [],
    });
    state.posts = state.posts.filter((p) => p.id !== uid(55));
    for (const total of [40, 60, 63]) {
      await page.locator('#loadMore').click();
      await page
        .locator('#feedContext')
        .filter({ hasText: total + '개 표시' })
        .waitFor();
    }
    const ids = await page.locator('.board-row').evaluateAll((nodes) => nodes.map((n) => n.id));
    ok(
      'cursor pagination survives equal dates, deletion and new inserts',
      ids.length === 63 && new Set(ids).size === 63 && ids.includes('post-' + uid(1)),
    );
    ok('last page hides the more button', await page.locator('#loadMore').isHidden());
    await page.getByLabel('게시글 찾기').fill('50%_');
    await page.getByRole('button', { name: '검색', exact: true }).click();
    await page.getByRole('link', { name: '오래된 토성 기록', exact: true }).waitFor();
    ok(
      'body search treats wildcard characters as literal text',
      (await page.locator('.board-row').count()) === 1 &&
        state.boardCalls.some((b) => b.p_query === '50%_'),
    );
    await page.getByRole('link', { name: '오래된 토성 기록', exact: true }).click();
    await page.locator('.detail-body').waitFor();
    await page.getByRole('button', { name: '글 공유', exact: true }).click();
    await page.getByLabel('공유할 글 주소').waitFor();
    const shared = await page.getByLabel('공유할 글 주소').inputValue();
    ok(
      'share fallback exposes a canonical post URL',
      new URL(shared).searchParams.get('post') === uid(1) && !shared.includes('embed='),
    );
    await page.locator('#backToFeed').click();
    ok(
      'detail back restores search results',
      (await page.locator('.board-row').count()) === 1 &&
        new URL(page.url()).searchParams.get('q') === '50%_',
    );
    await page.locator('#clearSearch').click();
    await page.locator('#feedContext').filter({ hasText: '20개 표시' }).waitFor();
    ok('clearing search actually reloads the normal list');
    await page.goto(base + '/lounge.html?post=' + uid(9999));
    await page.getByRole('heading', { name: '글을 찾을 수 없어요' }).waitFor();
    ok('missing post includes a recovery link', await page.locator('#backToFeed').isVisible());
    await f.close();
  }
  {
    const f = await fixture(),
      { page, state } = f;
    state.comments = Array.from({ length: 527 }, (_, i) => ({
      id: uid(i + 1),
      post_id: P,
      nick: '답변자',
      text: '답변 ' + (i + 1),
      created_at: '2026-09-10T12:00:00.000Z',
      author_id: null,
    }));
    state.commentFail = true;
    await page.goto(base + '/lounge.html?post=' + P);
    await page.locator('#commentMessage').filter({ hasText: '불러오지 못했어요' }).waitFor();
    await page.getByLabel('댓글 내용').fill('작성 중인 댓글');
    state.commentFail = false;
    await page.locator('[data-action=refresh-comments]').click();
    await page.locator('.comment-item').first().waitFor();
    ok(
      'comment read failure and retry retain draft',
      (await page.getByLabel('댓글 내용').inputValue()) === '작성 중인 댓글',
    );
    for (let i = 0; i < 26; i++) {
      await page.locator('#moreComments').click();
      await page.waitForFunction(
        (n) => document.querySelectorAll('.comment-item').length === Math.min(n, 527),
        (i + 2) * 20,
      );
    }
    ok(
      'all 527 replies remain accessible in bounded pages',
      (await page.locator('.comment-item').count()) === 527 &&
        (await page.locator('#moreComments').isHidden()),
    );
    state.commentFail = true;
    await page.getByRole('button', { name: '등록', exact: true }).click();
    await page.locator('#loungeStatus').filter({ hasText: '댓글 등록 실패' }).waitFor();
    ok(
      'comment write failure retains input',
      (await page.getByLabel('댓글 내용').inputValue()) === '작성 중인 댓글',
    );
    state.commentFail = false;
    state.loseComment = true;
    await page.getByRole('button', { name: '등록', exact: true }).click();
    await page.locator('#commentForm button:enabled').waitFor();
    await page.getByRole('button', { name: '등록', exact: true }).click();
    await page.locator('.comment-body').filter({ hasText: '작성 중인 댓글' }).waitFor();
    ok(
      'a lost comment response does not duplicate the reply',
      state.comments.filter((c) => c.text === '작성 중인 댓글').length === 1,
    );
    ok(
      'new reply appears first and clears draft',
      (await page.locator('.comment-body').first().textContent()) === '작성 중인 댓글' &&
        (await page.getByLabel('댓글 내용').inputValue()) === '',
    );
    await page.locator('.detail-actions .btn-report').click();
    await page.getByLabel('기타 · 내 글 삭제 요청').check();
    await page.getByLabel('요청 설명 (선택)').fill('이전 브라우저에서 쓴 글의 삭제를 요청합니다.');
    await page.getByRole('button', { name: '접수하기' }).click();
    await page.locator('#loungeStatus').filter({ hasText: '요청을 접수' }).waitFor();
    ok(
      'deletion request is sent to the private moderator inbox',
      state.reportBodies.length === 1 &&
        state.reportBodies[0].reason === 'etc' &&
        state.reportBodies[0].author_id === A,
    );
    await page.locator('[data-emoji="⭐"]').click();
    await page.locator('[data-emoji="⭐"][aria-pressed=true]').waitFor();
    ok('reaction RPC sends desired state without a caller-controlled author',state.reactionCalls.length===1&&state.reactionCalls[0].p_selected===true&&!('p_author_id' in state.reactionCalls[0]));
    await page.locator('[data-emoji="🔥"]').click();
    await page.locator('[data-emoji="🔥"][aria-pressed=true]').waitFor();
    ok('selecting another emoji replaces my selection',await page.locator('[data-emoji][aria-pressed=true]').count()===1&&state.reactions.length===1&&state.reactions[0].emoji==='🔥');
    state.reactionWriteFail=true;
    await page.locator('[data-emoji="❤️"]').click();
    await page.locator('#loungeStatus').filter({hasText:'공감 저장 실패'}).waitFor();
    await page.locator('[data-emoji="🔥"][aria-pressed=true]:enabled').waitFor();
    ok('reaction write failure preserves the confirmed selection',state.reactions.length===1&&state.reactions[0].emoji==='🔥');
    state.reactionWriteFail=false;
    await page.locator('[data-emoji="🔥"]').click();
    await page.locator('[data-emoji="🔥"][aria-pressed=false]:enabled').waitFor();
    ok('clicking the selected emoji sends cancellation',state.reactions.length===0&&state.reactionCalls.at(-1).p_selected===false);
    state.reactionLoseCommit=true;
    await page.locator('[data-emoji="⭐"]').click();
    await page.locator('[data-emoji="⭐"][aria-pressed=true]:enabled').waitFor();
    ok('lost write response reloads the stored choice without duplicating it',state.reactions.length===1&&state.reactions[0].emoji==='⭐');
    state.reactions.push({post_id:P,author_id:'22222222-2222-4222-8222-222222222222',emoji:'❤️'});
    const callsBefore=state.reactionCalls.length;
    await page.evaluate(()=>{document.querySelector('[data-emoji="❤️"]').click();document.querySelector('[data-emoji="👏"]').click();});
    await page.locator('[data-emoji="❤️"][aria-pressed=true]:enabled').waitFor();
    ok('rapid local clicks make one pending request and keep other users reactions',state.reactionCalls.length===callsBefore+1&&state.reactions.length===2&&state.reactions.every(r=>r.emoji==='❤️')&&await page.locator('[data-emoji="❤️"]').textContent()==='❤️ 2');
    await page.locator('[data-emoji="❤️"]').click();
    await page.locator('[data-emoji="❤️"][aria-pressed=false]:enabled').waitFor();
    ok('cancelling my reaction leaves another user count intact',state.reactions.length===1&&await page.locator('[data-emoji="❤️"]').textContent()==='❤️ 1');
    state.reactionFail = true;
    await page.reload();
    await page.getByRole('button', { name: '공감 다시 불러오기' }).waitFor();
    ok(
      'reaction outage leaves body readable without unsafe toggles',
      (await page.locator('.detail-body').isVisible()) &&
        (await page.locator('[data-emoji]').count()) === 0,
    );
    await f.close();
  }
  {
    const f=await fixture({registered:false}),{page,state}=f;
    await page.goto(base+'/lounge.html?post='+P);
    await page.locator('[data-emoji="⭐"]').click();
    await page.locator('[data-emoji="⭐"][aria-pressed=true]').waitFor();
    ok('anonymous Auth keeps its existing reaction eligibility',state.reactions.length===1&&state.signups===0&&await page.locator('.account-dialog[open]').count()===0);
    await f.close();
  }
  {
    const f = await fixture(),
      { page, state } = f;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '/lounge.html?write=1');
    await page.locator('#postTitle').fill('사진을 올리는 관측 후기');
    await page.locator('#postInput').fill('달과 토성을 보았습니다.');
    await page.locator('#observationFields summary').click();
    await page.locator('#observedMethod').selectOption('phone');
    const payload = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 2400;
      c.height = 1200;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#334a68';
      ctx.fillRect(0, 0, c.width, c.height);
      return c.toDataURL('image/png').split(',')[1];
    });
    const file = {
      name: 'gps-original-name.png',
      mimeType: 'image/png',
      buffer: Buffer.from(payload, 'base64'),
    };
    await page.locator('#photoInput').setInputFiles(file);
    await page.locator('#writeStatus').filter({ hasText: '사진 준비가 끝났어요' }).waitFor();
    ok(
      'photo preview and attachment count appear',
      (await page.locator('.photo-preview').count()) === 1 &&
        (await page.locator('#photoCount').textContent()) === '1 / 5장',
    );
    await page.locator('#photoInput').setInputFiles([file, file, file, file, file]);
    await page.locator('#writeStatus').filter({ hasText: '5장까지' }).waitFor();
    ok(
      'sixth image is rejected without losing selected image',
      (await page.locator('.photo-preview').count()) === 1,
    );
    state.uploadFail = true;
    await page.locator('#btnTrace').click();
    await page.locator('#writeStatus').filter({ hasText: '등록 실패' }).waitFor();
    ok(
      'partial photo upload cannot publish a partial post',
      state.inserts === 0 &&
        (await page.locator('#postInput').inputValue()) === '달과 토성을 보았습니다.',
    );
    state.uploadFail = false;
    await page.locator('#btnTrace').click();
    await page.getByRole('heading', { name: '사진을 올리는 관측 후기' }).waitFor();
    await page.waitForFunction(() => document.querySelector('.detail-image img')?.naturalWidth > 0);
    ok(
      'retry skips completed upload and sends a thumbnail',
      state.uploads.length === 3 &&
        state.uploads.filter((p) => p.endsWith('.thumb.jpg')).length === 2 && state.posts[0].observation.method === 'phone',
    );
    ok(
      'original filename never reaches Storage paths',
      state.uploads.every((p) => !p.includes('gps-original-name')),
    );
    ok(
      'uploaded photograph is reduced to 2048 pixels',
      await page
        .locator('.detail-image img')
        .evaluate((img) => img.naturalWidth === 2048 && img.naturalHeight === 1024),
    );
    ok(
      'mobile photo detail has no horizontal overflow',
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    );
    await page.screenshot({ path: '/tmp/orbit-board-detail-mobile.png', fullPage: true });
    await page.locator('#backToFeed').click();
    await page.getByRole('link', { name: '사진을 올리는 관측 후기', exact: true }).waitFor();
    await page.screenshot({ path: '/tmp/orbit-board-list-mobile.png', fullPage: true });
    ok(
      'compact mobile list keeps readable 16px titles',
      await page
        .locator('.row-title')
        .first()
        .evaluate((n) => parseFloat(getComputedStyle(n).fontSize) >= 16),
    );
    await page.getByRole('link', { name: '사진을 올리는 관측 후기', exact: true }).click();
    await page.getByRole('button', { name: '글 삭제', exact: true }).click();
    await page.locator('#loungeStatus').filter({ hasText: '글을 삭제' }).waitFor();
    ok('own post deletion removes uploaded files', state.objects.size === 0);
    await f.close();
  }
  {
    const f = await fixture({ admin: true, profileReady:false }),
      { page, state } = f;
    await page.goto(base + '/lounge.html?post=' + P);
    await page.getByRole('button', { name: '공지로 고정' }).click();
    await page.getByRole('button', { name: '공지 해제' }).waitFor();
    ok('administrator without a member profile can pin an existing post', state.posts[0].is_pinned);
    await page.locator('#backToFeed').click();
    await page.locator('.pinned-row').waitFor();
    ok('pinned notice appears above normal posts');
    await f.close();
  }
  {
    const f = await fixture({ signedIn: true, registered: true, profileReady:false }), { page, state } = f;
    await page.goto(base + '/lounge.html?write=1');
    await page.locator('#postInput').fill('프로필을 완성하기 전에 적어 둔 이야기');
    ok('incomplete member profile can prepare a draft without opening setup',await page.locator('.account-dialog[open]').count()===0);
    await page.locator('#btnTrace').click();
    await page.locator('.account-dialog #setupCard').waitFor();
    ok('profile setup opens at submission without losing the draft',new URL(page.url()).pathname==='/lounge.html' &&
      await page.locator('#postInput').inputValue()==='프로필을 완성하기 전에 적어 둔 이야기');
    ok('registered author must finish the profile before publication', state.inserts === 0);
    await f.close();
  }
  {
    const f=await fixture({signedIn:false,registered:false}), {page,state}=f;
    await page.goto(base+'/lounge.html?post='+P);
    await page.getByRole('button',{name:'로그인하고 댓글 쓰기'}).click();
    await page.locator('.account-dialog #authCard').waitFor();
    ok('visitor comments open login on the same readable post',new URL(page.url()).searchParams.get('post')===P&&state.comments.length===0&&await page.locator('#commentInput').isHidden());
    await f.close();
  }
  {
    const f = await fixture();
    f.state.getFail = true;
    await f.page.goto(base + '/lounge.html');
    await f.page.getByRole('button', { name: '다시 불러오기', exact: true }).waitFor();
    f.state.getFail = false;
    await f.page.getByRole('button', { name: '다시 불러오기', exact: true }).click();
    await f.page.getByRole('link', { name: '기존 관측 후기', exact: true }).waitFor();
    ok('initial outage has a working retry');
    await f.close();
  }
  {
    const f = await fixture({ version: 0 });
    await f.page.goto(base + '/lounge.html?write=1');
    await f.page.locator('#postTitle').fill('업데이트 대기');
    await f.page.locator('#postInput').fill('본문');
    await f.page.locator('#btnTrace').click();
    await f.page.locator('#writeStatus').filter({ hasText: '등록 실패' }).waitFor();
    ok(
      'missing migration blocks writes before account creation',
      f.state.signups === 0 && f.state.inserts === 0,
    );
    await f.close();
  }
  {
    const f = await fixture(),
      { page, state } = f;
    state.newsData = {
      version: 1,
      checkedAt: now(),
      sources: ['kasi', 'nasa', 'esa'].map((id) => ({ id, status: 'ok', lastSuccessfulAt: now() })),
      items: [
        {
          source: 'kasi',
          title: '우주에서 새로운 별을 발견했습니다',
          url: 'https://www.kasi.re.kr/kor/post/newsMaterial/1',
          publishedAt: now(),
          language: 'ko',
        },
        {
          source: 'nasa',
          title: 'A new view of Saturn',
          url: 'https://www.nasa.gov/space/saturn/',
          publishedAt: now(),
          language: 'en',
        },
        {
          source: 'esa',
          title: 'A telescope looks at distant galaxies',
          url: 'https://www.esa.int/Science_Exploration/Space_Science/story',
          publishedAt: now(),
          language: 'en',
        },
        {
          source: 'kasi',
          title: '<img src=x onerror=alert(1)>',
          url: 'https://www.kasi.re.kr/kor/post/newsMaterial/2',
          publishedAt: now(),
          language: 'ko',
        },
        {
          source: 'nasa',
          title: 'Unsafe link',
          url: 'javascript:alert(1)',
          publishedAt: now(),
          language: 'en',
        },
      ],
    };
    await page.goto(base + '/news.html');
    await page.locator('#newsChecked').filter({ hasText: '4건' }).waitFor();
    ok(
      'news rejects unsafe URLs and renders titles as text',
      (await page.locator('#newsList img').count()) === 0 &&
        (await page.getByText('Unsafe link', { exact: true }).count()) === 0,
    );
    const original = await page
      .getByRole('link', { name: '원문 읽기 ↗', exact: true })
      .first()
      .getAttribute('href');
    ok(
      'news keeps direct official links without the broken translation proxy',
      new URL(original).hostname === 'www.kasi.re.kr' &&
        (await page.getByRole('link', { name: '한국어 번역 ↗', exact: true }).count()) === 0,
    );
    await page.locator('[data-source=nasa]').click();
    await page.locator('#newsChecked').filter({ hasText: '1건' }).waitFor();
    ok('news source filter works', (await page.locator('.news-article').count()) === 1);
    state.newsData.sources[1].status = 'unavailable';
    state.newsData.sources[1].lastSuccessfulAt = '2026-01-01T00:00:00Z';
    await page.locator('#reloadNews').click();
    await page.locator('#newsStatus').filter({ hasText: '새 소식을 확인하지 못했어요' }).waitFor();
    ok(
      'stale source does not masquerade as current news',
      (await page.locator('.news-freshness').count()) === 1,
    );
    state.newsFail = true;
    await page.locator('#reloadNews').click();
    await page.locator('#newsStatus').filter({ hasText: '불러오지 못했어요' }).waitFor();
    ok(
      'news network error preserves the readable cache',
      (await page.locator('.news-article').count()) === 1,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    ok(
      'news filters and headlines fit mobile',
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    );
    await page.screenshot({ path: '/tmp/orbit-news-mobile.png', fullPage: true });
    await f.close();
  }
  {
    const f = await fixture(),
      { page } = f;
    await page.goto(base + '/main.html#lounge');
    const frame = page.frameLocator('#loungeFrame');
    await frame.locator('.row-title').click();
    await frame.locator('.detail-title').waitFor();
    await frame.locator('#backToFeed').click();
    await frame.locator('#writeTop').click();
    await frame.locator('#postTitle').fill('보존할 초안');
    await page.locator('#profileChip').click();
    await page.locator('#editProfile').click();
    await page.locator('#memberNickname').fill('새로운별');
    await page.locator('#profileForm button').click();
    await page.locator('#profileNickname').filter({hasText:'새로운별'}).waitFor();
    await page.locator('.account-close').click();
    ok(
      'embedded board preserves the editor when nickname changes',
      (await frame.locator('#postTitle').inputValue()) === '보존할 초안',
    );
    await f.close();
  }
  {
    const f = await fixture();
    const page = f.page;
    await page.goto(base + '/main.html');
    await page.locator('#panel-planets.on').waitFor();
    ok('today’s sky is the default panel');
    await page.locator('[data-panel="sky"]').click();
    await page.locator('[data-panel="lounge"]').click();
    await page.goBack();
    await page.locator('#panel-sky.on').waitFor();
    ok('browser back restores previous panel');
    await page.locator('#profileChip').click();
    await page.locator('#editProfile').click();
    await page.keyboard.press('Escape');
    ok(
      'cancelling nickname change preserves existing nickname',
      (await page.evaluate(() => localStorage.getItem('orbit_nickname'))) === '관측자',
    );
    await page.locator('#profileChip').click();
    await page.locator('.account-close').focus();
    await page.keyboard.press('Tab');
    ok(
      'dialog keyboard focus stays inside',
      await page.evaluate(() =>
        document.querySelector('.account-dialog').contains(document.activeElement),
      ),
    );
    await page.keyboard.press('Escape');
    ok(
      'closing dialog restores trigger focus',
      await page.locator('#profileChip').evaluate((el) => el === document.activeElement),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#navToggle').click();
    await page.locator('[data-panel="planets"]').click();
    const frame = page.frameLocator('#planetFrame');
    await frame.locator('#skyMap [data-label]').first().waitFor();
    await page.waitForFunction(() => {
      const svg = document.querySelector('#planetFrame').contentDocument.querySelector('#skyMap');
      const text = svg.querySelector('[data-label]');
      return (
        (+text.getAttribute('font-size') * svg.getBoundingClientRect().width) /
          svg.viewBox.baseVal.width >=
        11.9
      );
    });
    ok('map labels stay readable after desktop-to-mobile resize');
    ok(
      'mobile shell does not overflow',
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    );
    await f.close();
  }
  {
    const f = await fixture();
    const page = f.page;
    await page.clock.install({ time: new Date('2026-09-11T23:30:00+09:00') });
    await page.goto(base + '/sky.html');
    await page.evaluate(() => {
      EVENTS.splice(0, EVENTS.length, {
        id: 'regression',
        name: '자정 검증',
        ic: '☄️',
        type: 'meteor',
        kr: true,
        watch: '2026-09-12T03:00:00+09:00',
        dateText: '검사용',
        best: '검사용',
        desc: '검사용',
        zhr: 20,
      });
      renderNext();
      renderTimeline();
    });
    ok(
      'an event tomorrow in less than 24 hours is D-1',
      (await page.locator('#nxDday').textContent()) === 'D-1',
    );
    ok(
      'hero and timeline use the same day',
      (await page.locator('.ev-dday').textContent()) ===
        (await page.locator('#nxDday').textContent()),
    );
    await page.clock.setSystemTime(new Date('2026-09-12T00:00:00+09:00'));
    await page.clock.runFor(1000);
    ok(
      'midnight updates both countdown labels',
      (await page.locator('#nxDday').textContent()) === 'D-DAY' &&
        (await page.locator('.ev-dday').textContent()) === 'D-DAY',
    );
    await f.close();
  }
  console.log(`Community/UI: ${checks} checks passed`);
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
