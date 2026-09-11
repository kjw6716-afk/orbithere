// Real Supabase browser SDK with intercepted HTTP; never writes to production.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname, extname, resolve } from 'node:path';
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
  if (!full.startsWith(root + '/')) {
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
function session() {
  const exp = Math.floor(Date.now() / 1000) + 3600,
    encode = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return {
    access_token:
      encode({ alg: 'HS256', typ: 'JWT' }) +
      '.' +
      encode({ sub: A, exp, role: 'authenticated', is_anonymous: true }) +
      '.test-signature',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    refresh_token: 'test-refresh-token',
    user: {
      id: A,
      aud: 'authenticated',
      role: 'authenticated',
      is_anonymous: true,
      app_metadata: { provider: 'anonymous' },
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
async function fixture({ nickname = '관측자', version = 1, admin = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const state = {
    comments: [],
    commentFail: false,
    reactionFail: false,
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
    loseCommit: false,
    version,
    signups: 0,
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
    { nickname, auth: admin ? session() : null },
  );
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
      return json(session());
    }
    if (url.pathname.endsWith('/rpc/board_version'))
      return version ? json(version) : json({ code: 'PGRST202', message: 'Not installed' }, 404);
    if (url.pathname.endsWith('/rpc/community_version')) return json(2);
    if (url.pathname.endsWith('/rpc/is_admin')) return json(admin);
    if (url.pathname.endsWith('/rpc/record_visit')) return json(null);
    if (url.pathname.endsWith('/rpc/board_posts')) {
      const b = req.postDataJSON();
      state.boardCalls.push(b);
      let rows = state.posts.filter(
        (p) =>
          !!p.is_pinned === !!b.p_pinned &&
          (!b.p_orbit || p.orbit === b.p_orbit) &&
          (!b.p_query || (p.title + ' ' + p.text).toLowerCase().includes(b.p_query.toLowerCase())),
      );
      rows = cursor(ordered(rows), b.p_before, b.p_before_id)
        .slice(0, b.p_limit || 21)
        .map(({ text, ...p }) => ({
          ...p,
          comment_count: state.comments.filter((c) => c.post_id === p.id).length,
        }));
      if (state.delays[b.p_orbit]) await new Promise((r) => setTimeout(r, state.delays[b.p_orbit]));
      return state.getFail ? json({ message: 'fixture outage' }, 503) : json(rows);
    }
    if (url.pathname.endsWith('/rpc/reserve_board_images')) {
      const b = req.postDataJSON();
      return json(
        Array.from({ length: b.p_count }, (_, i) => A + '/' + b.p_post_id + '/' + uid(i) + '.jpg'),
      );
    }
    if (url.pathname.endsWith('/rpc/create_board_post')) {
      state.inserts++;
      const b = req.postDataJSON();
      if (state.postFail) return json({ message: 'fixture write outage' }, 503);
      if (!state.posts.some((p) => p.id === b.p_id))
        state.posts.unshift({
          id: b.p_id,
          title: b.p_title,
          text: b.p_text,
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
    if (url.pathname.endsWith('/rpc/reaction_summary'))
      return state.reactionFail ? json({ message: 'reaction outage' }, 503) : json(state.reactions);
    if (url.pathname.endsWith('/rpc/delete_reaction')) {
      state.reactions = [];
      return json(null);
    }
    if (url.pathname === '/rest/v1/reactions') {
      state.reactions = [{ emoji: req.postDataJSON().emoji, n: 1, mine: true }];
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
    await page.getByLabel('제목 80자 이내').fill('서울에서 본 토성');
    await page.getByLabel('내용 5,000자 이내').fill('고리가 또렷하게 보였습니다.');
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
    await page.locator('#btnTrace:enabled').waitFor();
    await page.locator('#btnTrace').click();
    await page.getByRole('heading', { name: '서울에서 본 토성', exact: true }).waitFor();
    ok(
      'lost commit response retry publishes exactly once',
      state.posts.filter((p) => p.title === '서울에서 본 토성').length === 1 && state.signups === 1,
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
    state.delays.gear = 250;
    await page.locator('[data-orbit=gear]').click();
    await page.locator('[data-orbit=report]').click();
    await page.waitForTimeout(350);
    ok(
      'slow previous category cannot overwrite the selected category',
      (await page.locator('.row-title').filter({ hasText: '늦은 장비 글' }).count()) === 0,
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
    ok('reactions preserve authenticated ownership');
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
    const f = await fixture(),
      { page, state } = f;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '/lounge.html?write=1');
    await page.locator('#postTitle').fill('사진을 올리는 관측 후기');
    await page.locator('#postInput').fill('달과 토성을 보았습니다.');
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
        state.uploads.filter((p) => p.endsWith('.thumb.jpg')).length === 2,
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
      'mobile list uses readable 18px titles',
      await page
        .locator('.row-title')
        .first()
        .evaluate((n) => parseFloat(getComputedStyle(n).fontSize) >= 18),
    );
    await page.getByRole('link', { name: '사진을 올리는 관측 후기', exact: true }).click();
    await page.getByRole('button', { name: '글 삭제', exact: true }).click();
    await page.locator('#loungeStatus').filter({ hasText: '글을 삭제' }).waitFor();
    ok('own post deletion removes uploaded files', state.objects.size === 0);
    await f.close();
  }
  {
    const f = await fixture({ admin: true }),
      { page, state } = f;
    await page.goto(base + '/lounge.html?post=' + P);
    await page.getByRole('button', { name: '공지로 고정' }).click();
    await page.getByRole('button', { name: '공지 해제' }).waitFor();
    ok('administrator can pin an existing post', state.posts[0].is_pinned);
    await page.locator('#backToFeed').click();
    await page.locator('.pinned-row').waitFor();
    ok('pinned notice appears above normal posts');
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
    const translate = await page
      .getByRole('link', { name: '한국어 번역 ↗', exact: true })
      .first()
      .getAttribute('href');
    ok(
      'translation is an explicit link to the original URL',
      new URL(translate).hostname === 'translate.google.com' &&
        new URL(translate).searchParams.get('u') === 'https://www.nasa.gov/space/saturn/',
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
    await page.locator('#btnRename').click();
    await page.locator('#nicknameInput').fill('새로운별');
    await page.locator('#nicknameInput').press('Enter');
    await page.locator('#joinBack').waitFor({ state: 'hidden' });
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
    await page.locator('#btnRename').click();
    await page.keyboard.press('Escape');
    ok(
      'cancelling nickname change preserves existing nickname',
      (await page.evaluate(() => localStorage.getItem('orbit_nickname'))) === '관측자',
    );
    await page.locator('#profileChip').click();
    await page.locator('#joinClose').focus();
    await page.keyboard.press('Tab');
    ok(
      'dialog keyboard focus stays inside',
      await page.evaluate(() =>
        document.querySelector('#joinBack').contains(document.activeElement),
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
